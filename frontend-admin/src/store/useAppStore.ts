import { create } from 'zustand';
import type { AppState, ToastType, AudioSettings, SessionRecord, TtsQueueItem } from '@/types';
import { generateId } from '@/utils/helpers';
import { DEFAULT_AUDIO_SETTINGS, TOAST_DURATION } from '@/utils/constants';

const STORAGE_KEY = 'subtitle-translator-session-records';
const TTS_QUEUE_KEY = 'subtitle-translator-tts-queue';

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

// 加载上次未播完的队列，统一恢复为待播报，顺序保持不变
const loadTtsQueueFromStorage = (): TtsQueueItem[] => {
  try {
    const stored = localStorage.getItem(TTS_QUEUE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as TtsQueueItem[];
      return parsed.map(item => ({ ...item, status: 'pending', error: undefined }));
    }
  } catch {
    console.error('Failed to load tts queue from storage');
  }
  return [];
};

// 只持久化未完成的条目（播报中的按待播报保存，刷新后会重新播报）
const saveTtsQueueToStorage = (queue: TtsQueueItem[]) => {
  try {
    const unfinished = queue.filter(item => item.status === 'pending' || item.status === 'speaking');
    localStorage.setItem(TTS_QUEUE_KEY, JSON.stringify(unfinished));
  } catch {
    console.error('Failed to save tts queue to storage');
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
  
  // 会话记录
  sessionRecords: loadRecordsFromStorage(),

  // 语音播报队列（恢复上次未播完的内容）
  ttsQueue: loadTtsQueueFromStorage(),
  
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
    // 关闭自动播放时，清空未播队列并停止当前播报
    if (settings.ttsEnabled === false) {
      get().clearTtsQueue();
    }
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

  enqueueTts: ({ text, lang, subtitleId }) => {
    const { playbackOrder } = get().audioSettings;
    const item: TtsQueueItem = { id: generateId(), text, lang, subtitleId, status: 'pending' };
    set(state => {
      // 按偏好插入：顺序播报追加到队尾；最新优先插到所有待播报条目之前
      const firstPending = state.ttsQueue.findIndex(i => i.status === 'pending');
      const ttsQueue =
        playbackOrder === 'latest' && firstPending !== -1
          ? [...state.ttsQueue.slice(0, firstPending), item, ...state.ttsQueue.slice(firstPending)]
          : [...state.ttsQueue, item];
      saveTtsQueueToStorage(ttsQueue);
      return {
        ttsQueue,
        subtitles: subtitleId
          ? state.subtitles.map(s => (s.id === subtitleId ? { ...s, ttsStatus: 'pending' as const } : s))
          : state.subtitles,
      };
    });
  },

  setTtsItemStatus: (id, status, error) => {
    set(state => {
      const target = state.ttsQueue.find(i => i.id === id);
      if (!target) return state;
      const ttsQueue = state.ttsQueue.map(i =>
        i.id === id ? { ...i, status, error: status === 'error' ? error : undefined } : i
      );
      saveTtsQueueToStorage(ttsQueue);
      return {
        ttsQueue,
        subtitles: target.subtitleId
          ? state.subtitles.map(s => (s.id === target.subtitleId ? { ...s, ttsStatus: status } : s))
          : state.subtitles,
      };
    });
  },

  completeTtsItem: (id) => {
    set(state => {
      const target = state.ttsQueue.find(i => i.id === id);
      const ttsQueue = state.ttsQueue.filter(i => i.id !== id);
      saveTtsQueueToStorage(ttsQueue);
      return {
        ttsQueue,
        subtitles: target?.subtitleId
          ? state.subtitles.map(s => (s.id === target.subtitleId ? { ...s, ttsStatus: 'done' as const } : s))
          : state.subtitles,
      };
    });
  },

  retryTtsItem: (id) => {
    // 保持原有队列位置，重新等待播报
    get().setTtsItemStatus(id, 'pending');
  },

  clearTtsQueue: () => {
    set(state => ({
      ttsQueue: [],
      subtitles: state.subtitles.map(s =>
        s.ttsStatus === 'pending' || s.ttsStatus === 'speaking' ? { ...s, ttsStatus: undefined } : s
      ),
    }));
    saveTtsQueueToStorage([]);
  },
}));
