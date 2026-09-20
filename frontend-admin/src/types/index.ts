// 语言类型
export interface Language {
  code: string;
  name: string;
  nativeName: string;
}

// 字幕条目
export interface SubtitleEntry {
  id: string;
  originalText: string;
  translatedText: string;
  timestamp: Date;
  isActive: boolean;
}

// 翻译结果
export interface TranslationResult {
  id: string;
  sourceText: string;
  targetText: string;
  sourceLang: string;
  targetLang: string;
  timestamp: Date;
}

// 音频设置
export interface AudioSettings {
  volume: number;
  speed: number;
  ttsEnabled: boolean;
}

// 语音播报条目来源
export type SpeechSource = 'auto' | 'manual' | 'test';

// 语音播报状态
export type SpeechStatus = 'pending' | 'speaking' | 'done' | 'error';

// 语音播报队列条目
export interface SpeechItem {
  id: string;
  text: string;
  lang: string;
  status: SpeechStatus;
  attempts: number;
  source: SpeechSource;
  // 关联的字幕条目或会话记录 id，用于在列表中展示朗读状态
  refId?: string;
  // 入队序号，保证排队次序稳定
  enqueuedAt: number;
  errorMessage?: string;
}

// 控制面板状态
export interface ControlPanelState {
  sourceLang: string;
  targetLang: string;
  isMicOn: boolean;
  isRecording: boolean;
  audioSettings: AudioSettings;
}

// Toast 类型
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

// 会话记录类型
export type SessionRecordType = 'voice' | 'manual';

// 会话记录条目
export interface SessionRecord {
  id: string;
  type: SessionRecordType;
  sourceText: string;
  targetText: string;
  sourceLang: string;
  targetLang: string;
  timestamp: Date;
  metadata?: {
    confidence?: number;
    duration?: number;
  };
}

// 应用状态
export interface AppState {
  // 控制面板
  sourceLang: string;
  targetLang: string;
  isMicOn: boolean;
  isRecording: boolean;
  audioSettings: AudioSettings;
  
  // 字幕
  subtitles: SubtitleEntry[];
  currentSubtitle: string;
  
  // 翻译
  inputText: string;
  translationHistory: TranslationResult[];
  isTranslating: boolean;
  
  // Toast
  toasts: Toast[];

  // 语音播报队列
  speechQueue: SpeechItem[];
  ttsSupported: boolean;

  // 会话记录
  sessionRecords: SessionRecord[];

  // Actions
  setSourceLang: (lang: string) => void;
  setTargetLang: (lang: string) => void;
  toggleMic: () => void;
  setAudioSettings: (settings: Partial<AudioSettings>) => void;
  addSubtitle: (original: string, translated: string) => string;
  setCurrentSubtitle: (text: string) => void;
  setInputText: (text: string) => void;
  translate: () => Promise<void>;
  addToast: (type: ToastType, message: string) => void;
  removeToast: (id: string) => void;
  addSessionRecord: (record: Omit<SessionRecord, 'id' | 'timestamp'>) => void;
  deleteSessionRecord: (id: string) => void;
  clearSessionRecords: () => void;

  // 语音播报 Actions
  setTtsSupported: (supported: boolean) => void;
  enqueueSpeech: (item: Omit<SpeechItem, 'id' | 'status' | 'attempts' | 'enqueuedAt'>) => string;
  updateSpeechStatus: (
    id: string,
    status: SpeechStatus,
    extra?: { errorMessage?: string; incrementAttempts?: boolean },
  ) => void;
  retrySpeech: (id: string) => void;
  clearSpeechItem: (id: string) => void;
  clearDoneSpeech: () => void;
  restoreSpeechQueue: (items: SpeechItem[]) => void;
}
