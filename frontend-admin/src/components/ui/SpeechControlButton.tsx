import React from 'react';
import { Volume2, AlertCircle, Clock } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { ttsEngine } from '@/utils/tts';

interface SpeechControlButtonProps {
  /** 要朗读的译文 */
  text: string;
  /** 译文语言 */
  lang: string;
  /** 关联的字幕 / 会话记录 id，用于定位队列中的朗读状态 */
  refId: string;
  /** 按钮尺寸 */
  size?: 'sm' | 'md';
  /** 不支持时由外部禁用 */
  disabled?: boolean;
}

const ICON_SIZE = { sm: 'w-3.5 h-3.5', md: 'w-4 h-4' } as const;

/**
 * 统一的「朗读译文 / 重试」按钮：
 * 根据该条目在播报队列中的状态展示等待、朗读中、失败可重试等反馈。
 */
export const SpeechControlButton: React.FC<SpeechControlButtonProps> = ({
  text,
  lang,
  refId,
  size = 'sm',
  disabled = false,
}) => {
  // 取该条目最近一次的播报状态
  const speechItem = useAppStore(state =>
    // 从后往前找，手动重听会生成新条目
    [...state.speechQueue].reverse().find(item => item.refId === refId),
  );
  const ttsSupported = useAppStore(state => state.ttsSupported);

  const status = speechItem?.status;
  const iconClass = ICON_SIZE[size];

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!ttsSupported || disabled) return;
    // 失败的条目原地重试；其他情况重新排队朗读
    if (status === 'error' && speechItem) {
      ttsEngine.retry(speechItem.id);
    } else {
      ttsEngine.enqueue(text, lang, { source: 'manual', refId });
    }
  };

  let icon = <Volume2 className={iconClass} />;
  let title = '朗读译文';
  let colorClass = 'text-dark-500 hover:text-primary-400 hover:bg-primary-500/10';

  if (!ttsSupported) {
    title = '浏览器不支持语音播报';
    colorClass = 'text-dark-600 cursor-not-allowed';
  } else if (status === 'speaking') {
    icon = <Volume2 className={`${iconClass} animate-pulse`} />;
    title = '正在朗读…';
    colorClass = 'text-primary-400 bg-primary-500/10';
  } else if (status === 'pending') {
    icon = <Clock className={iconClass} />;
    title = '已在播报队列中等待';
    colorClass = 'text-dark-400';
  } else if (status === 'error') {
    icon = <AlertCircle className={iconClass} />;
    title = speechItem?.errorMessage
      ? `${speechItem.errorMessage}，点击重试`
      : '播报失败，点击重试';
    colorClass = 'text-accent-yellow hover:text-accent-yellow hover:bg-accent-yellow/10';
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!ttsSupported || disabled || status === 'speaking' || status === 'pending'}
      title={title}
      aria-label={title}
      className={`p-1.5 rounded-lg transition-colors disabled:cursor-not-allowed ${colorClass}`}
    >
      {icon}
    </button>
  );
};
