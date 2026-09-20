import React from 'react';
import { Volume2, RotateCcw, AlertCircle, Clock } from 'lucide-react';
import type { SubtitleEntry } from '@/types';
import { formatTime } from '@/utils/helpers';
import { retrySpeech } from '@/utils/tts';

interface SubtitleItemProps {
  subtitle: SubtitleEntry;
}

export const SubtitleItem: React.FC<SubtitleItemProps> = ({ subtitle }) => {
  const handleRetry = () => {
    retrySpeech(subtitle.id);
  };

  return (
    <div
      className={`
        glass-card p-4 transition-all duration-300 animate-slide-up
        ${subtitle.isActive ? 'subtitle-highlight' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        {/* 时间戳 */}
        <div className="flex-shrink-0 text-xs text-dark-500 font-mono pt-1">
          {formatTime(subtitle.timestamp)}
        </div>

        {/* 字幕内容 */}
        <div className="flex-1 space-y-2">
          {/* 原文 */}
          <p
            className={`
              text-lg leading-relaxed
              ${subtitle.isActive ? 'text-dark-50 font-medium' : 'text-dark-200'}
            `}
          >
            {subtitle.originalText}
          </p>

          {/* 译文 */}
          <p
            className={`
              text-base leading-relaxed
              ${subtitle.isActive ? 'text-primary-400' : 'text-dark-400'}
            `}
          >
            {subtitle.translatedText}
          </p>

          {/* 播报失败：标记待重读并提供重试 */}
          {subtitle.ttsStatus === 'error' && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-accent-red/20 text-accent-red">
                <AlertCircle className="w-3 h-3" />
                播报失败，待重读
              </span>
              <button
                onClick={handleRetry}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-white/5 text-dark-300 hover:bg-white/10 hover:text-dark-100 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                重试
              </button>
            </div>
          )}
        </div>

        {/* 播报状态指示 */}
        <div className="flex-shrink-0 flex flex-col items-end gap-2">
          {subtitle.isActive && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary-500/20 text-primary-400">
              当前
            </span>
          )}
          {subtitle.ttsStatus === 'speaking' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-accent-green/20 text-accent-green">
              <Volume2 className="w-3 h-3 animate-pulse" />
              播报中
            </span>
          )}
          {subtitle.ttsStatus === 'pending' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-dark-700 text-dark-400">
              <Clock className="w-3 h-3" />
              排队待读
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
