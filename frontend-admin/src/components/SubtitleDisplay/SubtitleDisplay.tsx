import React, { useEffect, useRef } from 'react';
import { Subtitles, Clock, Square, RotateCw, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { ttsEngine } from '@/utils/tts';
import { formatTime } from '@/utils/helpers';
import { SubtitleItem } from './SubtitleItem';

export const SubtitleDisplay: React.FC = () => {
  const subtitles = useAppStore(state => state.subtitles);
  const currentSubtitle = useAppStore(state => state.currentSubtitle);
  const isMicOn = useAppStore(state => state.isMicOn);
  const pendingCount = useAppStore(
    state => state.speechQueue.filter(item => item.status === 'pending').length,
  );
  const speakingCount = useAppStore(
    state => state.speechQueue.filter(item => item.status === 'speaking').length,
  );
  const failedItems = useAppStore(state =>
    state.speechQueue.filter(item => item.status === 'error'),
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [subtitles, currentSubtitle]);

  return (
    <main className="flex-1 flex flex-col min-w-0 min-h-0 glass-panel rounded-2xl">
      {/* 标题栏 */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-dark-900/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-500/20 rounded-lg">
            <Subtitles className="w-5 h-5 text-primary-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-dark-100">实时字幕</h2>
            <p className="text-xs text-dark-500">中英双语对照显示</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-dark-500">
          <Clock className="w-4 h-4" />
          <span>{formatTime(new Date())}</span>
        </div>
      </header>

      {/* 字幕内容区 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth"
      >
        {subtitles.length === 0 && !currentSubtitle ? (
          <div className="flex flex-col items-center justify-center h-full text-dark-500">
            <Subtitles className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg">暂无字幕内容</p>
            <p className="text-sm mt-2">开启麦克风开始识别语音</p>
          </div>
        ) : (
          <>
            {/* 历史字幕 */}
            {subtitles.map(subtitle => (
              <SubtitleItem key={subtitle.id} subtitle={subtitle} />
            ))}

            {/* 当前正在识别的内容 */}
            {currentSubtitle && (
              <div className="glass-card p-4 border-l-4 border-primary-500 animate-fade-in">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-2 rounded-full bg-primary-500 animate-pulse" />
                  <div className="flex-1">
                    <p className="text-dark-100 text-lg typing-cursor">
                      {currentSubtitle}
                    </p>
                    <p className="text-dark-500 text-sm mt-2 italic">
                      正在识别...
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 底部状态栏 */}
      <footer className="px-6 py-3 border-t border-white/10 bg-dark-900/50">
        <div className="flex items-center justify-between gap-3 text-xs text-dark-500">
          <span>共 {subtitles.length} 条字幕</span>

          {/* 播报队列状态 */}
          <div className="flex items-center gap-3">
            {(speakingCount > 0 || pendingCount > 0) && (
              <span className="inline-flex items-center gap-1.5 text-primary-400">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse" />
                {speakingCount > 0 ? '播报中' : '排队中'}
                {pendingCount > 0 ? ` · 待播 ${pendingCount} 条` : ''}
                <button
                  type="button"
                  onClick={() => ttsEngine.stop()}
                  title="停止播报并清空队列"
                  className="ml-1 p-1 rounded hover:bg-white/10 hover:text-dark-200 transition-colors"
                >
                  <Square className="w-3 h-3" />
                </button>
              </span>
            )}

            {failedItems.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-accent-yellow">
                <AlertCircle className="w-3.5 h-3.5" />
                {failedItems.length} 条播报失败
                <button
                  type="button"
                  onClick={() => failedItems.forEach(item => ttsEngine.retry(item.id))}
                  title="重新将失败条目加入队列"
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-accent-yellow/10 transition-colors"
                >
                  <RotateCw className="w-3 h-3" />
                  全部重试
                </button>
              </span>
            )}

            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  isMicOn ? 'bg-accent-green animate-pulse' : 'bg-dark-600'
                }`}
              />
              <span>{isMicOn ? '实时识别中' : '等待开始'}</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
};
