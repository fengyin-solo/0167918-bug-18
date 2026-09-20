import React, { useState, useMemo } from 'react';
import {
  History,
  Search,
  Trash2,
  X,
  Mic,
  Languages,
  Copy,
  Check,
  Filter,
  Calendar,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { Button, SpeechControlButton } from '@/components/ui';
import { LANGUAGES } from '@/utils/constants';
import { formatTime, getLanguageDisplayName, truncateText } from '@/utils/helpers';
import type { SessionRecord, SessionRecordType } from '@/types';

type FilterType = 'all' | SessionRecordType;

export const SessionHistoryCenter: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const sessionRecords = useAppStore(state => state.sessionRecords);
  const deleteSessionRecord = useAppStore(state => state.deleteSessionRecord);
  const clearSessionRecords = useAppStore(state => state.clearSessionRecords);
  const addToast = useAppStore(state => state.addToast);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [selectedRecord, setSelectedRecord] = useState<SessionRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const filteredRecords = useMemo(() => {
    return sessionRecords.filter(record => {
      const matchesType = filterType === 'all' || record.type === filterType;
      const matchesSearch = !searchQuery.trim() || 
        record.sourceText.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.targetText.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [sessionRecords, filterType, searchQuery]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, SessionRecord[]> = {};
    filteredRecords.forEach(record => {
      const date = record.timestamp.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      });
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(record);
    });
    return groups;
  }, [filteredRecords]);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      addToast('success', '已复制到剪贴板');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      addToast('error', '复制失败');
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSessionRecord(id);
    if (selectedRecord?.id === id) {
      setSelectedRecord(null);
    }
  };

  const handleClearAll = () => {
    clearSessionRecords();
    setShowClearConfirm(false);
    setSelectedRecord(null);
  };

  const getTypeIcon = (type: SessionRecordType) => {
    return type === 'voice' ? (
      <Mic className="w-4 h-4" />
    ) : (
      <Languages className="w-4 h-4" />
    );
  };

  const getTypeLabel = (type: SessionRecordType) => {
    return type === 'voice' ? '语音识别' : '手动翻译';
  };

  const getTypeColor = (type: SessionRecordType) => {
    return type === 'voice' 
      ? 'bg-accent-red/20 text-accent-red' 
      : 'bg-primary-500/20 text-primary-400';
  };

  const filterOptions: { value: FilterType; label: string }[] = [
    { value: 'all', label: '全部记录' },
    { value: 'voice', label: '语音识别' },
    { value: 'manual', label: '手动翻译' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 主面板 */}
      <div className="relative w-full max-w-6xl h-[85vh] glass-panel rounded-2xl flex flex-col overflow-hidden animate-fade-in">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-500/20 rounded-lg">
              <History className="w-6 h-6 text-primary-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-dark-100">会话记录中心</h2>
              <p className="text-sm text-dark-500">
                共 {sessionRecords.length} 条记录 · 筛选后 {filteredRecords.length} 条
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {sessionRecords.length > 0 && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowClearConfirm(true)}
                icon={<Trash2 className="w-4 h-4" />}
              >
                清空全部
              </Button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-dark-400 hover:text-dark-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 工具栏 */}
        <div className="p-4 border-b border-white/10 flex-shrink-0">
          <div className="flex flex-col md:flex-row gap-3">
            {/* 搜索框 */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索原文或译文..."
                className="w-full pl-10 pr-4 py-2.5 bg-dark-800/50 border border-white/10 rounded-xl text-dark-100 placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded"
                >
                  <X className="w-4 h-4 text-dark-500" />
                </button>
              )}
            </div>

            {/* 筛选下拉 */}
            <div className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="flex items-center gap-2 px-4 py-2.5 bg-dark-800/50 border border-white/10 rounded-xl text-dark-200 hover:bg-dark-700/50 transition-colors min-w-[140px]"
              >
                <Filter className="w-4 h-4" />
                <span className="flex-1 text-left">
                  {filterOptions.find(o => o.value === filterType)?.label}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showFilterDropdown && (
                <div className="absolute top-full right-0 mt-2 w-44 bg-dark-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-10">
                  {filterOptions.map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setFilterType(option.value);
                        setShowFilterDropdown(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm hover:bg-white/10 transition-colors flex items-center justify-between ${
                        filterType === option.value ? 'text-primary-400 bg-primary-500/10' : 'text-dark-200'
                      }`}
                    >
                      {option.label}
                      {filterType === option.value && (
                        <Check className="w-4 h-4" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 内容区 */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* 记录列表 */}
          <div className={`${selectedRecord ? 'hidden md:block md:w-1/2 lg:w-3/5' : 'w-full'} overflow-y-auto border-r border-white/10`}>
            {Object.keys(groupedByDate).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-dark-500 p-8">
                <History className="w-16 h-16 mb-4 opacity-30" />
                <p className="text-lg font-medium mb-1">暂无记录</p>
                <p className="text-sm">
                  {searchQuery || filterType !== 'all' 
                    ? '没有找到符合条件的记录' 
                    : '开始使用语音识别或手动翻译后，记录将显示在这里'}
                </p>
              </div>
            ) : (
              <div className="p-4 space-y-6">
                {Object.entries(groupedByDate).map(([date, records]) => (
                  <div key={date}>
                    <div className="flex items-center gap-2 mb-3 px-2 sticky top-0 bg-dark-900/80 backdrop-blur-sm py-2 -mt-2 z-10">
                      <Calendar className="w-4 h-4 text-dark-500" />
                      <span className="text-sm font-medium text-dark-400">{date}</span>
                      <span className="text-xs text-dark-600">({records.length} 条)</span>
                    </div>
                    <div className="space-y-2">
                      {records.map(record => (
                        <div
                          key={record.id}
                          onClick={() => setSelectedRecord(record)}
                          className={`glass-card p-4 cursor-pointer transition-all hover:bg-white/5 group ${
                            selectedRecord?.id === record.id ? 'ring-2 ring-primary-500/50 bg-white/5' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getTypeColor(record.type)}`}>
                                  {getTypeIcon(record.type)}
                                  {getTypeLabel(record.type)}
                                </span>
                                <span className="text-xs text-dark-600 font-mono">
                                  {formatTime(record.timestamp)}
                                </span>
                                <span className="text-xs text-dark-600">
                                  {getLanguageDisplayName(record.sourceLang, LANGUAGES)} → {getLanguageDisplayName(record.targetLang, LANGUAGES)}
                                </span>
                              </div>
                              <p className="text-sm text-dark-300 truncate mb-1">
                                {truncateText(record.sourceText, 60)}
                              </p>
                              <p className="text-sm text-dark-100 truncate">
                                {truncateText(record.targetText, 60)}
                              </p>
                            </div>
                            <button
                              onClick={(e) => handleDelete(record.id, e)}
                              className="p-2 opacity-0 group-hover:opacity-100 hover:bg-accent-red/20 text-dark-500 hover:text-accent-red rounded-lg transition-all"
                              title="删除记录"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 详情面板 */}
          {selectedRecord && (
            <div className="hidden md:flex md:flex-col md:w-1/2 lg:w-2/5 bg-dark-800/30">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="font-medium text-dark-100">记录详情</h3>
                <button
                  onClick={() => setSelectedRecord(null)}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-dark-500 hover:text-dark-100 md:hidden"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* 类型标签 */}
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${getTypeColor(selectedRecord.type)}`}>
                    {getTypeIcon(selectedRecord.type)}
                    {getTypeLabel(selectedRecord.type)}
                  </span>
                </div>

                {/* 时间信息 */}
                <div className="text-sm text-dark-400 space-y-1">
                  <p className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {selectedRecord.timestamp.toLocaleString('zh-CN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      weekday: 'long',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </p>
                  <p className="flex items-center gap-2">
                    <Languages className="w-4 h-4" />
                    {getLanguageDisplayName(selectedRecord.sourceLang, LANGUAGES)} → {getLanguageDisplayName(selectedRecord.targetLang, LANGUAGES)}
                  </p>
                </div>

                {/* 原文 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-dark-400">原文</span>
                    <button
                      onClick={() => handleCopy(selectedRecord.sourceText, `source-${selectedRecord.id}`)}
                      className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                      title="复制原文"
                    >
                      {copiedId === `source-${selectedRecord.id}` ? (
                        <Check className="w-4 h-4 text-accent-green" />
                      ) : (
                        <Copy className="w-4 h-4 text-dark-500" />
                      )}
                    </button>
                  </div>
                  <div className="glass-card p-4">
                    <p className="text-dark-200 whitespace-pre-wrap break-words leading-relaxed">
                      {selectedRecord.sourceText}
                    </p>
                  </div>
                </div>

                {/* 译文 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-primary-400">译文</span>
                    <div className="flex items-center gap-1">
                      <SpeechControlButton
                        text={selectedRecord.targetText}
                        lang={selectedRecord.targetLang}
                        refId={selectedRecord.id}
                      />
                      <button
                        onClick={() => handleCopy(selectedRecord.targetText, `target-${selectedRecord.id}`)}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                        title="复制译文"
                      >
                        {copiedId === `target-${selectedRecord.id}` ? (
                          <Check className="w-4 h-4 text-accent-green" />
                        ) : (
                          <Copy className="w-4 h-4 text-dark-500" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="glass-card p-4 border-l-2 border-primary-500">
                    <p className="text-dark-100 whitespace-pre-wrap break-words leading-relaxed">
                      {selectedRecord.targetText}
                    </p>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="pt-4 border-t border-white/10">
                  <Button
                    variant="danger"
                    onClick={() => {
                      deleteSessionRecord(selectedRecord.id);
                      setSelectedRecord(null);
                    }}
                    icon={<Trash2 className="w-4 h-4" />}
                    className="w-full"
                  >
                    删除此记录
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 移动端详情遮罩 */}
        {selectedRecord && (
          <div className="md:hidden fixed inset-0 z-20 bg-dark-900 flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-medium text-dark-100">记录详情</h3>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-2 hover:bg-white/10 rounded-lg text-dark-400 hover:text-dark-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 类型标签 */}
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${getTypeColor(selectedRecord.type)}`}>
                  {getTypeIcon(selectedRecord.type)}
                  {getTypeLabel(selectedRecord.type)}
                </span>
              </div>

              {/* 时间信息 */}
              <div className="text-sm text-dark-400 space-y-1">
                <p className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {selectedRecord.timestamp.toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </p>
                <p className="flex items-center gap-2">
                  <Languages className="w-4 h-4" />
                  {getLanguageDisplayName(selectedRecord.sourceLang, LANGUAGES)} → {getLanguageDisplayName(selectedRecord.targetLang, LANGUAGES)}
                </p>
              </div>

              {/* 原文 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-dark-400">原文</span>
                  <button
                    onClick={() => handleCopy(selectedRecord.sourceText, `source-m-${selectedRecord.id}`)}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    {copiedId === `source-m-${selectedRecord.id}` ? (
                      <Check className="w-4 h-4 text-accent-green" />
                    ) : (
                      <Copy className="w-4 h-4 text-dark-500" />
                    )}
                  </button>
                </div>
                <div className="glass-card p-4">
                  <p className="text-dark-200 whitespace-pre-wrap break-words leading-relaxed">
                    {selectedRecord.sourceText}
                  </p>
                </div>
              </div>

              {/* 译文 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-primary-400">译文</span>
                  <div className="flex items-center gap-1">
                    <SpeechControlButton
                      text={selectedRecord.targetText}
                      lang={selectedRecord.targetLang}
                      refId={selectedRecord.id}
                    />
                    <button
                      onClick={() => handleCopy(selectedRecord.targetText, `target-m-${selectedRecord.id}`)}
                      className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      {copiedId === `target-m-${selectedRecord.id}` ? (
                        <Check className="w-4 h-4 text-accent-green" />
                      ) : (
                        <Copy className="w-4 h-4 text-dark-500" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="glass-card p-4 border-l-2 border-primary-500">
                  <p className="text-dark-100 whitespace-pre-wrap break-words leading-relaxed">
                    {selectedRecord.targetText}
                  </p>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="pt-4 border-t border-white/10">
                <Button
                  variant="danger"
                  onClick={() => {
                    deleteSessionRecord(selectedRecord.id);
                    setSelectedRecord(null);
                  }}
                  icon={<Trash2 className="w-4 h-4" />}
                  className="w-full"
                >
                  删除此记录
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 清空确认弹窗 */}
        {showClearConfirm && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="glass-panel rounded-2xl p-6 max-w-sm mx-4 animate-fade-in">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-accent-yellow/20 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-accent-yellow" />
                </div>
                <div>
                  <h3 className="font-semibold text-dark-100">确认清空</h3>
                  <p className="text-sm text-dark-400">此操作不可撤销</p>
                </div>
              </div>
              <p className="text-sm text-dark-300 mb-6">
                您确定要清空所有 {sessionRecords.length} 条会话记录吗？清空后将无法恢复。
              </p>
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1"
                >
                  取消
                </Button>
                <Button
                  variant="danger"
                  onClick={handleClearAll}
                  className="flex-1"
                >
                  确认清空
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
