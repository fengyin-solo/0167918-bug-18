import type { SpeechItem, SpeechSource } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { generateId } from '@/utils/helpers';
/**
 * 全局唯一的语音合成（TTS）引擎。
 *
 * 自动播报（语音识别结果）与设置面板的测试播报共用这一份实现：
 * - 同一套发音人选择逻辑（精确语言 → 语言前缀 → default → 任意可用）
 * - 同一份音量 / 语速应用方式（每条朗读都取最新偏好，调整后即时重读生效）
 * - 统一的 FIFO 队列：逐条播报，新结果入队不再掐断上一条
 * - 出错自动重试，耗尽后保留 error 状态供手动重试
 * - 待播 / 失败条目随队列持久化，重新打开后排队次序保持一致
 */

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 600;
// cancel() 后给合成器一拍时间清空队列，Chrome 上紧随其后的 speak 才不会被丢弃
const CANCEL_SETTLE_MS = 80;
// 部分浏览器 cancel 后不再回调 end/error，用兜底超时防止队列卡死
const SETTLE_TIMEOUT_MS = 30_000;
// 偏好调节防抖：滑动条连续变动时不要频繁打断
const SETTINGS_RESTART_DEBOUNCE_MS = 300;

// 被主动取消 / 打断时浏览器抛出的错误，不属于真正的合成失败
const CANCELED_ERRORS = new Set(['canceled', 'interrupted']);

type SpeakOutcome =
  | { type: 'end' }
  | { type: 'error'; error: string }
  | { type: 'canceled' };

interface SpeakHandle {
  promise: Promise<SpeakOutcome>;
  cancel: () => void;
  // 本次朗读是否为主动取消（独立标记，避免吞掉后续真实错误）
  canceled: boolean;
}

const isBrowser = () => typeof window !== 'undefined';
const getSynth = (): SpeechSynthesis | null =>
  isBrowser() && 'speechSynthesis' in window ? window.speechSynthesis : null;

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * 统一的发音人选择逻辑（自动播报与测试播报共用）。
 * 1. 精确匹配完整语言代码（如 en-US）
 * 2. 匹配同语言前缀（如 en-*）
 * 3. 浏览器标记的 default 发音人
 * 4. 退而使用任意可用发音人
 */
export const pickVoice = (
  voices: SpeechSynthesisVoice[],
  lang: string,
): SpeechSynthesisVoice | null => {
  if (voices.length === 0) return null;

  const exact = voices.find(v => v.lang === lang);
  if (exact) return exact;

  const prefix = lang.split('-')[0].toLowerCase();
  const prefixed = voices.find(v =>
    v.lang.toLowerCase().startsWith(`${prefix}-`),
  );
  if (prefixed) return prefixed;

  const sameFamily = voices.find(
    v => v.lang.toLowerCase().split('-')[0] === prefix,
  );
  if (sameFamily) return sameFamily;

  return voices.find(v => v.default) || voices[0] || null;
};

/** 生成一条队列条目（供 store 使用）。 */
export const createSpeechItem = (
  item: Omit<SpeechItem, 'id' | 'status' | 'attempts' | 'enqueuedAt'>,
): SpeechItem => ({
  ...item,
  id: generateId(),
  status: 'pending',
  attempts: 0,
  enqueuedAt: Date.now(),
});

class TtsEngine {
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];

  private initialized = false;
  // 是否有队列工作循环在运行
  private workerRunning = false;
  // 当前占用合成器的朗读（队列条目或测试插播）
  private active: SpeakHandle | null = null;
  // 测试插播闸门：工作循环在闸门释放前不会启动下一条
  private preemptGate: Promise<void> | null = null;
  // 防止测试播报连点造成闸门错乱
  private testInProgress = false;
  // 首次用户交互后 resolve：自动播放策略要求由用户手势激活发声
  private gestureSeen = false;
  private userGesture: Promise<void> = Promise.resolve();
  private resolveUserGesture: () => void = () => undefined;

  private settingsRestartTimer: ReturnType<typeof setTimeout> | null = null;

  /** 初始化引擎：加载语音、订阅队列与偏好。可重复调用。 */
  init = (): void => {
    if (this.initialized || !isBrowser()) return;
    this.initialized = true;

    const synth = getSynth();
    this.synth = synth;
    const supported = !!synth;
    useAppStore.getState().setTtsSupported(supported);
    if (!synth) return;

    this.loadVoices();

    // Chrome 等浏览器语音列表异步加载，监听变化后刷新（两处播报共享同一份列表）
    synth.onvoiceschanged = this.loadVoices;

    // 自动播放策略：首次用户交互前不主动发声，避免 not-allowed 白白耗尽重试
    this.userGesture = new Promise<void>(resolve => {
      this.resolveUserGesture = resolve;
    });
    const markGesture = () => {
      if (this.gestureSeen) return;
      this.gestureSeen = true;
      this.resolveUserGesture();
      void this.runWorker();
      window.removeEventListener('pointerdown', markGesture);
      window.removeEventListener('keydown', markGesture);
    };
    window.addEventListener('pointerdown', markGesture);
    window.addEventListener('keydown', markGesture);

    // 队列变化（入队 / 状态变更 / 恢复）时推动工作循环；
    // 偏好变化时让进行中的朗读按新音量 / 语速重读
    let prevQueue = useAppStore.getState().speechQueue;
    let prevSettings = useAppStore.getState().audioSettings;
    useAppStore.subscribe(state => {
      if (state.speechQueue !== prevQueue) {
        prevQueue = state.speechQueue;
        void this.runWorker();
      }
      if (state.audioSettings !== prevSettings) {
        prevSettings = state.audioSettings;
        this.scheduleSettingsRestart();
      }
    });

    // Chrome 长文本朗读约 15s 后可能暂停，定时 resume 兜底
    setInterval(() => {
      if (this.synth && this.synth.speaking && this.synth.paused) {
        this.synth.resume();
      }
    }, 10_000);

    // 恢复持久化的待播队列：已见过手势则立即开始，否则等首次交互
    void this.runWorker();
  };

  /** 将一条译文加入播报队列尾部（逐条朗读，不打断当前条目）。 */
  enqueue = (
    text: string,
    lang: string,
    options: { source?: SpeechSource; refId?: string } = {},
  ): string | null => {
    if (!this.synth) {
      this.notifyUnavailable();
      return null;
    }

    const source: SpeechSource = options.source ?? 'auto';

    // 自动播报跟随「自动播放」开关；手动点朗读 / 测试不受开关限制
    if (source === 'auto' && !useAppStore.getState().audioSettings.ttsEnabled) {
      return null;
    }

    // 手动重听同一条时，清掉它此前未播完 / 失败的排队记录，避免重复朗读
    if (source === 'manual' && options.refId) {
      const store = useAppStore.getState();
      store.speechQueue
        .filter(
          item =>
            item.refId === options.refId &&
            (item.status === 'pending' || item.status === 'error'),
        )
        .forEach(item => store.clearSpeechItem(item.id));
    }

    return useAppStore.getState().enqueueSpeech({ text, lang, source, refId: options.refId });
  };

  /** 手动重试某条：重新排到队尾，按队列顺序朗读。 */
  retry = (id: string): void => {
    if (!this.synth) {
      this.notifyUnavailable();
      return;
    }
    useAppStore.getState().retrySpeech(id);
  };

  /** 停止播报并清空队列。 */
  stop = (): void => {
    const store = useAppStore.getState();
    store.speechQueue.forEach(item => store.clearSpeechItem(item.id));
    if (this.active) this.active.canceled = true;
    this.active?.cancel();
    this.synth?.cancel();
  };

  /** 测试播报：与正式播报共用挑发音人与参数逻辑，临时插播一条。 */
  test = async (): Promise<void> => {
    if (!this.synth) {
      this.notifyUnavailable();
      return;
    }
    // 连点测试按钮时忽略后续请求，避免插播闸门相互破坏
    if (this.testInProgress) return;
    this.testInProgress = true;

    let releaseGate: () => void = () => undefined;
    try {
      const { targetLang } = useAppStore.getState();
      const testText = targetLang.startsWith('zh')
        ? '语音播报测试成功'
        : 'Voice broadcast test successful';

      // 设置闸门：被打断的队列条目回到 pending 后，工作循环会等测试播完再继续
      this.preemptGate = new Promise<void>(resolve => {
        releaseGate = resolve;
      });

      // 打断当前条目并等其中断事件派发完毕，避免与测试语音竞争
      const previous = this.active;
      if (previous) previous.canceled = true;
      this.synth.cancel();
      if (previous) {
        await previous.promise.catch(() => undefined);
      }
      await sleep(CANCEL_SETTLE_MS);

      const outcome = await this.speakOnce(testText, targetLang);

      if (outcome.type === 'error') {
        useAppStore
          .getState()
          .addToast('error', `测试播报失败：${this.describeError(outcome.error)}`);
      }
    } finally {
      this.preemptGate = null;
      releaseGate();
      this.testInProgress = false;
      void this.runWorker();
    }
  };

  // ---- 内部实现 ----

  private loadVoices = () => {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
    console.log('[TTS] 可用语音数量:', this.voices.length);
  };

  private notifyUnavailable = () => {
    useAppStore
      .getState()
      .addToast('error', '语音合成不可用，当前浏览器不支持语音播报');
  };

  /** 偏好变化后让进行中的朗读按新音量 / 语速重新开始（防抖）。 */
  private scheduleSettingsRestart() {
    if (this.settingsRestartTimer) clearTimeout(this.settingsRestartTimer);
    this.settingsRestartTimer = setTimeout(() => {
      this.settingsRestartTimer = null;
      // 打断当前条目 → 它回到 pending → 工作循环用最新偏好重新朗读
      // 若刚刚关闭开关，工作循环会跳过自动条目；重新开启时本订阅会再次唤醒循环
      if (this.active) this.active.canceled = true;
      this.active?.cancel();
      this.synth?.cancel();
      void this.runWorker();
    }, SETTINGS_RESTART_DEBOUNCE_MS);
  }

  /** 串行消费队列的工作循环：同一时刻只有一条在朗读。 */
  private async runWorker(): Promise<void> {
    if (this.workerRunning || !this.synth) return;
    this.workerRunning = true;

    try {
      while (true) {
        // 测试插播期间等待闸门释放
        if (this.preemptGate) {
          await this.preemptGate;
        }

        // 自动播放策略：尚未有用户交互时挂起队列，避免 not-allowed 耗尽重试
        if (!this.gestureSeen) {
          await this.userGesture;
        }

        const store = useAppStore.getState();
        const next = store.speechQueue.find(item => {
          if (item.status !== 'pending') return false;
          // 关闭自动播放时挂起自动条目；手动重听不受影响
          if (item.source === 'auto' && !store.audioSettings.ttsEnabled) {
            return false;
          }
          return true;
        });

        if (!next) break;
        await this.playItem(next);
      }
    } finally {
      this.workerRunning = false;
    }
  }

  /** 朗读单条队列条目，内部处理自动重试与被打断后的归队。 */
  private async playItem(item: SpeechItem): Promise<void> {
    const store = useAppStore.getState();
    store.updateSpeechStatus(item.id, 'speaking');

    const outcome = await this.speakOnce(item.text, item.lang);

    const state = useAppStore.getState();
    const fresh = state.speechQueue.find(i => i.id === item.id);
    if (!fresh) return; // 已被移除（停止 / 手动替换）

    if (outcome.type === 'end') {
      state.updateSpeechStatus(item.id, 'done');
      return;
    }

    if (outcome.type === 'canceled') {
      // 被设置变更或测试插播打断：回到待播，稍后按原次序继续
      state.updateSpeechStatus(item.id, 'pending');
      // 给合成器一拍时间收尾，避免 cancel 后立即 speak 被浏览器丢弃
      await sleep(CANCEL_SETTLE_MS);
      return;
    }

    // 本次失败计数后 attempts 将变为 fresh.attempts + 1；
    // 总尝试次数（含本次）达到 MAX_ATTEMPTS 后不再自动重试
    const attemptsAfterThis = fresh.attempts + 1;
    const willRetry =
      !CANCELED_ERRORS.has(outcome.error) &&
      attemptsAfterThis < MAX_ATTEMPTS;

    state.updateSpeechStatus(item.id, willRetry ? 'pending' : 'error', {
      incrementAttempts: true,
      errorMessage: willRetry ? undefined : this.describeError(outcome.error),
    });

    if (willRetry) {
      console.warn(
        `[TTS] 第 ${attemptsAfterThis} 次播报失败（${outcome.error}），准备重试`,
      );
      await sleep(RETRY_DELAY_MS);
    } else {
      state.addToast('warning', '一条语音播报失败，可在字幕列表中点击重试');
    }
  }

  /**
   * 朗读一段文本（自动播报与测试播报的唯一出口）。
   * 发音人、音量、语速全部来自统一的选择逻辑与最新偏好。
   * 调用方需保证调用前已 cancel 旧朗读并等待其 settle。
   */
  private speakOnce(text: string, lang: string): Promise<SpeakOutcome> {
    const synth = this.synth;
    if (!synth) {
      return Promise.resolve({ type: 'error', error: 'not-supported' });
    }

    if (this.voices.length === 0) this.loadVoices();

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(this.voices, lang);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = lang;
    }

    const { volume, speed } = useAppStore.getState().audioSettings;
    utterance.volume = volume / 100;
    utterance.rate = speed;
    utterance.pitch = 1;

    let settled = false;
    let timer: ReturnType<typeof setTimeout>;

    const handle: SpeakHandle = {
      promise: null as unknown as Promise<SpeakOutcome>,
      canceled: false,
      cancel: () => {
        // 仅负责请求合成器中断，结果归类由错误事件处理
        synth.cancel();
      },
    };

    const promise = new Promise<SpeakOutcome>(resolve => {
      const finish = (outcome: SpeakOutcome) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        utterance.onstart = null;
        utterance.onend = null;
        utterance.onerror = null;
        if (this.active === handle) this.active = null;
        resolve(outcome);
      };

      utterance.onstart = () => console.log('[TTS] 开始朗读:', text);
      utterance.onend = () => {
        console.log('[TTS] 朗读结束');
        finish({ type: 'end' });
      };
      utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
        const error = event.error || 'synthesis-failed';
        // 主动 cancel 会以 interrupted/canceled 形式回调（只认本句柄的标记）
        if (handle.canceled || CANCELED_ERRORS.has(error)) {
          finish({ type: 'canceled' });
          return;
        }
        console.error('[TTS] 朗读错误:', error);
        finish({ type: 'error', error });
      };

      // 兜底：某些平台取消后既不回调 end 也不回调 error，避免队列永久挂起
      const armFallback = () => {
        timer = setTimeout(() => {
          if (synth.speaking) {
            armFallback(); // 仍在朗读（长文本），继续等
          } else if (handle.canceled) {
            finish({ type: 'canceled' });
          } else {
            finish({ type: 'error', error: 'synthesis-timeout' });
          }
        }, SETTLE_TIMEOUT_MS);
      };
      armFallback();

      try {
        synth.speak(utterance);
      } catch (err) {
        console.error('[TTS] 提交朗读失败:', err);
        finish({ type: 'error', error: 'synthesis-failed' });
      }
    });

    handle.promise = promise;
    this.active = handle;
    return promise;
  }

  private describeError(error: string): string {
    switch (error) {
      case 'not-allowed':
        return '浏览器阻止了语音播报';
      case 'network':
        return '语音服务网络错误';
      case 'synthesis-failed':
        return '语音合成失败';
      case 'not-supported':
        return '当前浏览器不支持语音合成';
      default:
        return `播报失败（${error}）`;
    }
  }
}

export const ttsEngine = new TtsEngine();
