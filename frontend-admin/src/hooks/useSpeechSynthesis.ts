import { useEffect } from 'react';
import { ttsEngine } from '@/utils/tts';
import { useAppStore } from '@/store/useAppStore';

/**
 * 语音播报 Hook（自动播报与测试播报共用 ttsEngine）：
 * - speak：把译文加入 FIFO 队列逐条朗读，不再掐断上一条
 * - testSpeak：临时插播测试语音，使用同一套发音人 / 音量 / 语速逻辑
 * - retry：重试失败条目；stop：停止并清空队列
 */
export const useSpeechSynthesis = () => {
  const isSupported = useAppStore(state => state.ttsSupported);

  // 挂载时确保引擎初始化（幂等，多处挂载也只会初始化一次）
  useEffect(() => {
    ttsEngine.init();
  }, []);

  return {
    speak: (text: string, lang?: string, refId?: string) => {
      const targetLang = lang || useAppStore.getState().targetLang;
      return ttsEngine.enqueue(text, targetLang, { source: 'auto', refId });
    },
    speakManual: (text: string, lang: string, refId?: string) =>
      ttsEngine.enqueue(text, lang, { source: 'manual', refId }),
    retry: (id: string) => ttsEngine.retry(id),
    stop: () => ttsEngine.stop(),
    testSpeak: () => void ttsEngine.test(),
    isSupported,
  };
};
