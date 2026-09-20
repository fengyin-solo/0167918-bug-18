import { useAppStore } from '@/store/useAppStore';
import type { AudioSettings } from '@/types';

/**
 * 统一的语音播报模块。
 *
 * 自动播报、测试播报、重试播报都从这里走：
 * - 只有一份挑发音人逻辑（pickVoiceForLang），两处播报声音一致；
 * - 每次播报前实时读取音量/语速设置，设置调整即时生效；
 * - 多条内容进入队列逐条播报，新内容不会掐断上一条；
 * - 失败/被打断的条目保留在队列中，可重试，刷新后顺序不变。
 */

export const isTtsSupported = (): boolean =>
  typeof window !== 'undefined' && !!window.speechSynthesis;

// ---------- 发音人 ----------

let voicesCache: SpeechSynthesisVoice[] = [];

const refreshVoices = () => {
  if (!isTtsSupported()) return;
  voicesCache = window.speechSynthesis.getVoices();
};

const getVoices = (): SpeechSynthesisVoice[] => {
  if (voicesCache.length === 0) {
    refreshVoices();
  }
  return voicesCache;
};

// 唯一的一份挑人逻辑：完整匹配语言代码 → 匹配语言前缀 → 默认语音
export const pickVoiceForLang = (lang: string): SpeechSynthesisVoice | null => {
  const voices = getVoices();
  if (voices.length === 0) return null;

  const exact = voices.find(v => v.lang === lang);
  if (exact) return exact;

  const langPrefix = lang.split('-')[0];
  const byPrefix = voices.find(v => v.lang.startsWith(langPrefix));
  if (byPrefix) return byPrefix;

  return voices.find(v => v.default) || voices[0];
};

// 统一构建 utterance，调用时传入最新设置，保证音量/语速即时生效
const buildUtterance = (
  text: string,
  lang: string,
  settings: AudioSettings
): SpeechSynthesisUtterance => {
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoiceForLang(lang);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = lang;
  }
  utterance.volume = settings.volume / 100; // 0-1
  utterance.rate = settings.speed; // 0.5-2
  utterance.pitch = 1;
  return utterance;
};

// ---------- 播报队列引擎 ----------

let initialized = false;
let currentItemId: string | null = null;
let unavailableNotified = false;

const notifyUnavailable = () => {
  // 每次会话只提示一次，避免连续识别时刷屏
  if (unavailableNotified) return;
  unavailableNotified = true;
  useAppStore.getState().addToast('error', '当前浏览器不支持语音播报，无法播放译文');
};

// 逐条播报：上一条结束后才播下一条
const pump = () => {
  if (!initialized || !isTtsSupported()) return;
  if (currentItemId) return;

  const { ttsQueue, audioSettings } = useAppStore.getState();
  const next = ttsQueue.find(item => item.status === 'pending');
  if (!next) return;

  currentItemId = next.id;
  useAppStore.getState().setTtsItemStatus(next.id, 'speaking');

  // 播报前读取最新设置，音量/语速调整即时生效
  const utterance = buildUtterance(next.text, next.lang, audioSettings);

  utterance.onstart = () => {
    console.log('[TTS] 开始播报:', next.text);
  };

  utterance.onend = () => {
    // 条目可能已被重新排队或清空，只处理仍归本次播报持有的情况
    if (currentItemId !== next.id) return;
    currentItemId = null;
    console.log('[TTS] 播报完成:', next.text);
    useAppStore.getState().completeTtsItem(next.id);
    pump();
  };

  utterance.onerror = event => {
    if (currentItemId !== next.id) return;
    currentItemId = null;
    if (event.error === 'interrupted' || event.error === 'canceled') {
      // 被打断：重新排队等待重读，不丢弃
      console.log('[TTS] 播报被打断，重新排队:', next.text);
      useAppStore.getState().setTtsItemStatus(next.id, 'pending');
    } else {
      console.error('[TTS] 播报失败:', event.error);
      useAppStore.getState().setTtsItemStatus(next.id, 'error', event.error || 'unknown');
    }
    pump();
  };

  window.speechSynthesis.speak(utterance);
};

// 初始化：加载语音列表、订阅队列变化、恢复上次未播完的队列
export const initTts = () => {
  if (initialized) return;
  initialized = true;

  if (!isTtsSupported()) return;

  refreshVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = refreshVoices;
  }

  useAppStore.subscribe((state, prev) => {
    if (state.ttsQueue === prev.ttsQueue) return;
    // 队列被清空（如关闭自动播放）时，停止当前播报
    if (state.ttsQueue.length === 0 && currentItemId) {
      currentItemId = null;
      window.speechSynthesis.cancel();
      return;
    }
    pump();
  });

  // 恢复上次未播完的队列，顺序保持不变
  pump();
};

// ---------- 对外入口 ----------

// 自动播报入口：识别结果到达时调用
export const enqueueSpeech = (text: string, lang: string, subtitleId?: string) => {
  if (!isTtsSupported()) {
    notifyUnavailable();
    return;
  }
  const { audioSettings } = useAppStore.getState();
  if (!audioSettings.ttsEnabled) {
    console.log('[TTS] 语音播报已关闭');
    return;
  }
  if (!text.trim()) return;

  useAppStore.getState().enqueueTts({ text, lang, subtitleId });
};

// 重试/重读入口：列表中对失败或想重听的条目手动触发
export const retrySpeech = (subtitleId: string) => {
  if (!isTtsSupported()) {
    notifyUnavailable();
    return;
  }
  const state = useAppStore.getState();
  const existing = state.ttsQueue.find(item => item.subtitleId === subtitleId);
  if (existing) {
    state.retryTtsItem(existing.id);
    return;
  }
  // 队列中已不存在（如已播完），按字幕译文重新入队
  const subtitle = state.subtitles.find(s => s.id === subtitleId);
  if (subtitle) {
    state.enqueueTts({ text: subtitle.translatedText, lang: state.targetLang, subtitleId });
  }
};

// 测试播报：与自动播报共用同一份挑人逻辑和音量/语速设置
export const testSpeak = () => {
  if (!isTtsSupported()) {
    notifyUnavailable();
    return;
  }
  const { targetLang, audioSettings } = useAppStore.getState();
  const testText = targetLang.startsWith('zh')
    ? '语音播报测试成功'
    : 'Voice broadcast test successful';

  const utterance = buildUtterance(testText, targetLang, audioSettings);
  utterance.onerror = event => {
    console.error('[TTS] 测试播报失败:', event.error);
  };
  console.log('[TTS] 测试播报:', testText);
  window.speechSynthesis.speak(utterance);
};
