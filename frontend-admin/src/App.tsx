import React, { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { ControlPanel } from '@/components/ControlPanel';
import { SubtitleDisplay } from '@/components/SubtitleDisplay';
import { TranslationPanel } from '@/components/TranslationPanel';
import { SessionHistoryCenter } from '@/components/SessionHistoryCenter';
import { ToastContainer } from '@/components/ui';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useAppStore } from '@/store/useAppStore';
import { initTts } from '@/utils/tts';

const App: React.FC = () => {
  const [showHistory, setShowHistory] = useState(false);
  const sessionRecords = useAppStore(state => state.sessionRecords);

  // 初始化语音播报引擎（队列驱动、恢复上次未播完的内容）
  useEffect(() => {
    initTts();
  }, []);

  // 初始化语音识别（内部已集成TTS播报）
  useSpeechRecognition();

  return (
    <div className="min-h-screen h-screen w-full flex flex-col p-4 md:p-6 box-border">
      {/* 顶部导航栏 */}
      <header className="flex items-center justify-between mb-4 md:mb-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-500/20 rounded-lg">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary-400 to-primary-600" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold text-dark-100">实时字幕翻译</h1>
            <p className="text-xs text-dark-500 hidden sm:block">Real-time Subtitle Translator</p>
          </div>
        </div>
        <button
          onClick={() => setShowHistory(true)}
          className="flex items-center gap-2 px-4 py-2 bg-dark-800/50 hover:bg-dark-700/50 border border-white/10 rounded-xl text-dark-200 hover:text-dark-100 transition-all group"
        >
          <History className="w-4 h-4" />
          <span className="hidden sm:inline">会话记录</span>
          {sessionRecords.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-primary-500/20 text-primary-400 rounded-full">
              {sessionRecords.length}
            </span>
          )}
        </button>
      </header>

      {/* 三栏布局容器 - 使用 CSS Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] gap-4 md:gap-6 min-h-0">
        {/* 左侧控制面板 - 固定宽度 */}
        <div className="hidden lg:flex lg:flex-col min-h-0">
          <ControlPanel />
        </div>

        {/* 中央字幕显示区 - 自适应宽度 */}
        <div className="min-h-0 flex flex-col">
          <SubtitleDisplay />
        </div>

        {/* 右侧翻译面板 - 固定宽度 */}
        <div className="hidden lg:flex lg:flex-col min-h-0">
          <TranslationPanel />
        </div>
      </div>

      {/* 移动端底部导航提示 */}
      <div className="lg:hidden fixed bottom-4 left-4 right-4">
        <div className="glass-panel rounded-xl p-4 text-center">
          <p className="text-sm text-dark-400">
            请在桌面端访问以获得完整体验
          </p>
        </div>
      </div>

      {/* Toast 通知容器 */}
      <ToastContainer />

      {/* 会话记录中心 */}
      {showHistory && (
        <SessionHistoryCenter onClose={() => setShowHistory(false)} />
      )}
    </div>
  );
};

export default App;
