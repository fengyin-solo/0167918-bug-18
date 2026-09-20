import React from 'react';
import { Volume2, AlertCircle, Clock, Loader2 } from 'lucide-react';
import type { SubtitleEntry } from '@/types';
import { formatTime } from '@/utils/helpers';
import { SpeechControlButton } from '@/components/ui';
import { useAppStore } from '@/store/useAppStore';

interface SubtitleItemProps {
  subtitle: SubtitleEntry;
}

const speechStatusHint: Record<string, { text: string; cls: string; icon: React.ReactNode }> = {
  speaking: {
    text: '正在朗读…',
    cls: 'text-primary-400',
    icon: <Volume2 className="w-3 h-3 animate-pulse" />,
  },
  pending: {
    text: '等待播报',
    cls: 'text-dark-500',
    icon: <Clock className="w-3 h-3" />,
  },
  error: {
    text: '播报失败，点击右侧按钮重试',
    cls: 'text-accent-yellow',
    icon: <AlertCircle className="w-3 h-3" />,
  },
};

export const SubtitleItem: React.FC<SubtitleItemProps> = ({ subtitle }) => {
  const targetLang = useAppStore(state => state.targetLang);
  const speechStatus = useAppStore(state => {
    const item = [...state.speechQueue]
      .reverse()
      .find(s => s.refId === subtitle.id);
    return item?.status;
  });
  const hint = speechStatus ? speechStatusHint[speechStatus] : null;

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
        <div className="flex-1 space-y-2 min-w-0">
          {/* 原文 */}
          <p
            className={`
              text-lg leading-relaxed
              ${subtitle.isActive ? 'text-dark-50 font-medium' : 'text-dark-200'}
            `}
          >
            {subtitle.originalText}
          </p>

          {/* 译文 + 朗读控制 */}
          <div className="flex items-start gap-2">
            <p
              className={`
                flex-1 text-base leading-relaxed
                ${subtitle.isActive ? 'text-primary-400' : 'text-dark-400'}
              `}
            >
              {subtitle.translatedText}
            </p>
            <SpeechControlButton
              text={subtitle.translatedText}
              lang={targetLang}
              refId={subtitle.id}
            />
          </div>

          {/* 播报状态提示（被打断排队 / 失败可重试时可见） */}
          {hint && (
            <div className={`flex items-center gap-1.5 text-xs ${hint.cls}`}>
              {speechStatus === 'pending' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                hint.icon
              )}
              <span>{hint.text}</span>
            </div>
          )}
        </div>

        {/* 活跃指示器 */}
        {subtitle.isActive && (
          <div className="flex-shrink-0">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary-500/20 text-primary-400">
              当前
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
