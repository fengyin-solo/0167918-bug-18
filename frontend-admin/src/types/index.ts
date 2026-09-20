// 语言类型
export interface Language {
  code: string;
  name: string;
  nativeName: string;
}

// 语音播报状态
export type TtsStatus = 'pending' | 'speaking' | 'done' | 'error';

// 字幕条目
export interface SubtitleEntry {
  id: string;
  originalText: string;
  translatedText: string;
  timestamp: Date;
  isActive: boolean;
  // 译文播报状态（未播报过则为空）
  ttsStatus?: TtsStatus;
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

// 播报顺序偏好
export type TtsPlaybackOrder = 'sequential' | 'latest';

// 音频设置
export interface AudioSettings {
  volume: number;
  speed: number;
  ttsEnabled: boolean;
  playbackOrder: TtsPlaybackOrder;
}

// 语音播报队列条目
export interface TtsQueueItem {
  id: string;
  text: string;
  lang: string;
  subtitleId?: string;
  status: TtsStatus;
  error?: string;
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
  
  // 会话记录
  sessionRecords: SessionRecord[];

  // 语音播报队列
  ttsQueue: TtsQueueItem[];

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
  enqueueTts: (item: { text: string; lang: string; subtitleId?: string }) => void;
  setTtsItemStatus: (id: string, status: TtsStatus, error?: string) => void;
  completeTtsItem: (id: string) => void;
  retryTtsItem: (id: string) => void;
  clearTtsQueue: () => void;
}
