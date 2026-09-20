import type { AudioSettings, Language } from '@/types';

export const LANGUAGES: Language[] = [
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文' },
  { code: 'en-US', name: 'English', nativeName: 'English' },
];

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  volume: 80,
  speed: 1.0,
  ttsEnabled: true,
  playbackOrder: 'sequential',
};

export const MAX_INPUT_LENGTH = 500;

export const TOAST_DURATION = 3000;

// 模拟字幕数据
export const MOCK_SUBTITLES = [
  {
    original: '欢迎使用实时字幕翻译系统',
    translated: 'Welcome to the real-time subtitle translation system',
  },
  {
    original: '这是一个演示示例',
    translated: 'This is a demonstration example',
  },
  {
    original: '您可以通过左侧面板控制麦克风',
    translated: 'You can control the microphone through the left panel',
  },
  {
    original: '中央区域会显示识别的字幕内容',
    translated: 'The central area will display the recognized subtitle content',
  },
  {
    original: '右侧可以手动输入文本进行翻译',
    translated: 'You can manually enter text for translation on the right side',
  },
];
