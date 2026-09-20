import { create } from 'zustand';
import type {
  AppState,
  ToastType,
  AudioSettings,
  SessionRecord,
  SpeechItem,
  SpeechStatus,
} from '@/types';
import { generateId } from '@/utils/helpers';
import { DEFAULT_AUDIO_SETTINGS, TOAST_DURATION } from '@/utils/constants';
import { createSpeechItem } from '@/utils/tts';

const STORAGE_KEY = 'subtitle-translator-session-records';
const SPEECH_QUEUE_STORAGE_KEY = 'subtitle-translator-speech-queue';
// 持久化条目上限，避免待播队列无限增长
const MAX_PERSISTED_SPEECH_ITEMS = 100;

const loadRecordsFromStorage = (): SessionRecord[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((r: SessionRecord) => ({
        ...r,
        timestamp: new Date(r.timestamp),
      }));
    }
  } catch {
    console.error('Failed to load session records from storage');
  }
  return [];
};

const saveRecordsToStorage = (records: SessionRecord[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    console.error('Failed to save session records to storage');
  }
};

/**
 * 恢复未完成的播报队列：
 * - 只保留待播 / 失败条目（已播完的不恢复，进行中的一律按待播重新排队）
 * - 保持原有先后次序，重新打开后排在最前的先播
 */
const loadSpeechQueueFromStorage = (): SpeechItem[] => {
  try {
    const stored = localStorage.getItem(SPEECH_QUEUE_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as SpeechItem[];
    return parsed
      .filter(
        item =>
          item &&
          typeof item.text === 'string' &&
          (item.status === 'pending' ||
            item.status === 'error' ||
            item.status === 'speaking'),
      )
      .map(item => ({
        ...item,
        status: 'pending' as SpeechStatus,
        attempts: 0,
      }))
      .slice(0, MAX_PERSISTED_SPEECH_ITEMS);
  } catch {
    console.error('Failed to load speech queue from storage');
    return [];
  }
};

/** 持久化未完成条目，已播完的测试 / 正常条目不写入。 */
const saveSpeechQueueToStorage = (queue: SpeechItem[]) => {
  try {
    const pending = queue.filter(
      item =>
        item.status !== 'done' &&
        item.source !== 'test' &&
        (item.status === 'pending' ||
          item.status === 'error' ||
          item.status === 'speaking'),
    );
    // 按入队时间排序，保证下次打开次序一致
    pending.sort((a, b) => a.enqueuedAt - b.enqueuedAt);
    localStorage.setItem(
      SPEECH_QUEUE_STORAGE_KEY,
      JSON.stringify(pending.slice(-MAX_PERSISTED_SPEECH_ITEMS)),
    );
  } catch {
    console.error('Failed to save speech queue to storage');
  }
};

export const useAppStore = create<AppState>((set, get) => ({
  // 控制面板状态
  sourceLang: 'zh-CN',
  targetLang: 'en-US',
  isMicOn: false,
  isRecording: false,
  audioSettings: DEFAULT_AUDIO_SETTINGS,
  
  // 字幕状态 - 初始为空
  subtitles: [],
  currentSubtitle: '',
  
  // 翻译状态
  inputText: '',
  translationHistory: [],
  isTranslating: false,
  
  // Toast状态
  toasts: [],

  // 语音播报队列（未完成条目持久化，重开后次序保持一致）
  speechQueue: loadSpeechQueueFromStorage(),
  ttsSupported:
    typeof window !== 'undefined' && 'speechSynthesis' in window,

  // 会话记录
  sessionRecords: loadRecordsFromStorage(),
  
  // Actions
  setSourceLang: (lang: string) => {
    set({ sourceLang: lang });
    get().addToast('info', `源语言已切换`);
  },
  
  setTargetLang: (lang: string) => {
    set({ targetLang: lang });
    get().addToast('info', `目标语言已切换`);
  },
  
  toggleMic: () => {
    const { isMicOn } = get();
    const newState = !isMicOn;
    set({ isMicOn: newState, isRecording: newState });
  },
  
  setAudioSettings: (settings: Partial<AudioSettings>) => {
    set(state => ({
      audioSettings: { ...state.audioSettings, ...settings },
    }));
  },
  
  addSubtitle: (original: string, translated: string) => {
    const { sourceLang, targetLang } = get();
    const id = generateId();
    set(state => ({
      subtitles: [
        ...state.subtitles.map(s => ({ ...s, isActive: false })),
        {
          id,
          originalText: original,
          translatedText: translated,
          timestamp: new Date(),
          isActive: true,
        },
      ],
      currentSubtitle: '',
    }));
    get().addSessionRecord({
      type: 'voice',
      sourceText: original,
      targetText: translated,
      sourceLang,
      targetLang,
    });
    return id;
  },
  
  setCurrentSubtitle: (text: string) => {
    set({ currentSubtitle: text });
  },
  
  setInputText: (text: string) => {
    set({ inputText: text });
  },
  
  translate: async () => {
    const { inputText, sourceLang, targetLang, addToast, addSessionRecord } = get();
    
    if (!inputText.trim()) {
      addToast('warning', '请输入要翻译的文本');
      return;
    }
    
    set({ isTranslating: true });
    
    try {
      // 模拟翻译
      await new Promise(resolve => setTimeout(resolve, 800));
      const result = `[Translated] ${inputText}`;
      
      set(state => ({
        translationHistory: [
          {
            id: generateId(),
            sourceText: inputText,
            targetText: result,
            sourceLang,
            targetLang,
            timestamp: new Date(),
          },
          ...state.translationHistory,
        ],
        inputText: '',
        isTranslating: false,
      }));
      
      addSessionRecord({
        type: 'manual',
        sourceText: inputText,
        targetText: result,
        sourceLang,
        targetLang,
      });
      
      addToast('success', '翻译完成');
    } catch {
      set({ isTranslating: false });
      addToast('error', '翻译失败，请重试');
    }
  },
  
  addToast: (type: ToastType, message: string) => {
    const id = generateId();
    set(state => ({
      toasts: [...state.toasts, { id, type, message, duration: TOAST_DURATION }],
    }));
    
    // 自动移除
    setTimeout(() => {
      get().removeToast(id);
    }, TOAST_DURATION);
  },
  
  removeToast: (id: string) => {
    set(state => ({
      toasts: state.toasts.filter(t => t.id !== id),
    }));
  },
  
  addSessionRecord: (record) => {
    set(state => {
      const newRecord: SessionRecord = {
        id: generateId(),
        timestamp: new Date(),
        ...record,
      };
      const newRecords = [newRecord, ...state.sessionRecords];
      saveRecordsToStorage(newRecords);
      return { sessionRecords: newRecords };
    });
  },
  
  deleteSessionRecord: (id: string) => {
    set(state => {
      const newRecords = state.sessionRecords.filter(r => r.id !== id);
      saveRecordsToStorage(newRecords);
      return { sessionRecords: newRecords };
    });
    get().addToast('success', '记录已删除');
  },
  
  clearSessionRecords: () => {
    set({ sessionRecords: [] });
    saveRecordsToStorage([]);
    get().addToast('success', '所有记录已清空');
  },

  setTtsSupported: (supported: boolean) => {
    if (get().ttsSupported !== supported) {
      set({ ttsSupported: supported });
    }
  },

  enqueueSpeech: item => {
    const newItem = createSpeechItem(item);
    set(state => {
      const queue = [...state.speechQueue, newItem];
      saveSpeechQueueToStorage(queue);
      return { speechQueue: queue };
    });
    return newItem.id;
  },

  updateSpeechStatus: (id, status, extra) => {
    set(state => {
      const index = state.speechQueue.findIndex(item => item.id === id);
      if (index === -1) return {};

      // 播完即出队，避免已完成条目无限累积
      if (status === 'done') {
        const queue = state.speechQueue.filter(item => item.id !== id);
        saveSpeechQueueToStorage(queue);
        return { speechQueue: queue };
      }

      const queue = state.speechQueue.map(item => {
        if (item.id !== id) return item;
        return {
          ...item,
          status,
          attempts: extra?.incrementAttempts
            ? item.attempts + 1
            : item.attempts,
          errorMessage:
            extra && 'errorMessage' in extra
              ? extra.errorMessage
              : item.errorMessage,
        };
      });
      saveSpeechQueueToStorage(queue);
      return { speechQueue: queue };
    });
  },

  retrySpeech: id => {
    set(state => {
      let changed = false;
      const queue = state.speechQueue.map(item => {
        if (item.id !== id) return item;
        changed = true;
        // 重新排到队尾：保持「逐条按序播报」，失败重听不插队
        return {
          ...item,
          status: 'pending' as SpeechStatus,
          attempts: 0,
          errorMessage: undefined,
          enqueuedAt: Date.now(),
        };
      });
      if (changed) {
        queue.sort((a, b) => a.enqueuedAt - b.enqueuedAt);
        saveSpeechQueueToStorage(queue);
        return { speechQueue: queue };
      }
      return {};
    });
  },

  clearSpeechItem: id => {
    set(state => {
      const queue = state.speechQueue.filter(item => item.id !== id);
      if (queue.length === state.speechQueue.length) return {};
      saveSpeechQueueToStorage(queue);
      return { speechQueue: queue };
    });
  },

  clearDoneSpeech: () => {
    set(state => {
      const queue = state.speechQueue.filter(item => item.status !== 'done');
      if (queue.length === state.speechQueue.length) return {};
      saveSpeechQueueToStorage(queue);
      return { speechQueue: queue };
    });
  },

  restoreSpeechQueue: items => {
    set({ speechQueue: items });
    saveSpeechQueueToStorage(items);
  },
}));
