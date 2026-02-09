'use client';

import { useState, useEffect } from 'react';
import {
  DownloadTask,
  useDownloadQueue,
  DownloadStatus,
} from '@/lib/download-queue';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import {
  Download,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Package,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function formatTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDuration(start: Date, end?: Date): string {
  const endTime = end || new Date();
  const diff = Math.floor((endTime.getTime() - start.getTime()) / 1000);
  if (diff < 60) return `${diff}秒`;
  const minutes = Math.floor(diff / 60);
  const seconds = diff % 60;
  return `${minutes}分${seconds}秒`;
}

function getStatusIcon(status: DownloadStatus) {
  switch (status) {
    case 'pending':
      return <Clock className="w-4 h-4 text-[#707070]" />;
    case 'downloading':
      return <Loader2 className="w-4 h-4 text-[#00d17a] animate-spin" />;
    case 'processing':
      return <Loader2 className="w-4 h-4 text-[#1b8fff] animate-spin" />;
    case 'completed':
      return <CheckCircle2 className="w-4 h-4 text-[#00d17a]" />;
    case 'error':
      return <AlertCircle className="w-4 h-4 text-[#e74c3c]" />;
  }
}

function getStatusText(status: DownloadStatus): string {
  switch (status) {
    case 'pending':
      return '等待中';
    case 'downloading':
      return '下载中';
    case 'processing':
      return '处理中';
    case 'completed':
      return '已完成';
    case 'error':
      return '失败';
  }
}

function getStatusColor(status: DownloadStatus): string {
  switch (status) {
    case 'pending':
      return 'text-[#707070] bg-[#262626]';
    case 'downloading':
      return 'text-[#00d17a] bg-[#00d17a]/10';
    case 'processing':
      return 'text-[#1b8fff] bg-[#1b8fff]/10';
    case 'completed':
      return 'text-[#00d17a] bg-[#00d17a]/10';
    case 'error':
      return 'text-[#e74c3c] bg-[#e74c3c]/10';
  }
}

function TaskItem({ task, onRemove, onRetry }: {
  task: DownloadTask;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        'rounded-lg border transition-all',
        task.status === 'downloading'
          ? 'border-[#00d17a]/30 bg-[#00d17a]/5'
          : task.status === 'error'
          ? 'border-[#e74c3c]/30 bg-[#e74c3c]/5'
          : task.status === 'completed'
          ? 'border-[#00d17a]/20 bg-[#151515]'
          : 'border-[#2a2a2a] bg-[#151515]'
      )}
    >
      {/* 主行 */}
      <div className="p-3">
        <div className="flex items-start gap-3">
          {/* 图标 */}
          <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] flex items-center justify-center flex-shrink-0 overflow-hidden">
            {task.iconUrl ? (
              <img
                src={task.iconUrl}
                alt={task.modName}
                className="w-full h-full object-cover"
              />
            ) : (
              <Package className="w-5 h-5 text-[#707070]" />
            )}
          </div>

          {/* 信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-medium text-white text-sm truncate block flex-1 min-w-0">
                    {task.modName}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p>{task.modName}</p>
                </TooltipContent>
              </Tooltip>
              <Badge
                variant="secondary"
                className={cn('text-[10px] h-5 px-1.5 border-0 flex-shrink-0 whitespace-nowrap', getStatusColor(task.status))}
              >
                {getStatusIcon(task.status)}
                <span className="ml-1">{getStatusText(task.status)}</span>
              </Badge>
            </div>

            <div className="flex items-center gap-2 text-xs text-[#707070] mt-1 min-w-0">
              <span className="flex-shrink-0">{task.versionNumber}</span>
              <span className="flex-shrink-0">•</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="truncate block flex-1 min-w-0">{task.filename}</span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="break-all">{task.filename}</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* 进度条 */}
            {(task.status === 'downloading' || task.status === 'processing') && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-[#00d17a]">{task.speed}</span>
                  <span className="text-[#a0a0a0]">{task.progress.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#00d17a] to-[#00b86b] rounded-full transition-all duration-300"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* 错误信息 */}
            {task.status === 'error' && task.error && (
              <div className="mt-2 text-xs text-[#e74c3c]">
                {task.error}
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {task.status === 'error' && (
              <Button
                size="icon"
                variant="ghost"
                onClick={onRetry}
                className="w-7 h-7 text-[#707070] hover:text-[#00d17a] hover:bg-[#00d17a]/10 flex-shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={onRemove}
              className="w-7 h-7 text-[#707070] hover:text-[#e74c3c] hover:bg-[#e74c3c]/10 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* 展开详情 */}
      {task.completedAt && (
        <>
          <Separator className="bg-[#2a2a2a]" />
          <div className="px-3 py-2 bg-[#1a1a1a]/50">
            <div className="flex items-center justify-between text-xs text-[#707070] gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex-shrink-0">开始: {formatTime(task.addedAt)}</span>
                {task.completedAt && (
                  <span className="flex-shrink-0">完成: {formatTime(task.completedAt)}</span>
                )}
              </div>
              <span className="flex-shrink-0">
                耗时: {formatDuration(task.addedAt, task.completedAt)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function DownloadPanel() {
  return (
    <TooltipProvider delayDuration={200}>
      <DownloadPanelContent />
    </TooltipProvider>
  );
}

function DownloadPanelContent() {
  const {
    tasks,
    isPanelOpen,
    setPanelOpen,
    removeTask,
    clearCompleted,
    retryTask,
    pendingTasks,
    completedTasks,
    failedTasks,
  } = useDownloadQueue();

  const [minimized, setMinimized] = useState(false);

  // 如果没有任务且面板关闭，不渲染
  if (tasks.length === 0 && !isPanelOpen) return null;

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 flex flex-col transition-all duration-300',
        minimized ? 'w-72' : 'w-[440px]'
      )}
    >
      {/* 头部 */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-t-lg cursor-pointer"
        onClick={() => tasks.length > 0 && setMinimized(!minimized)}
      >
        <div className="flex items-center gap-2">
          <div className="relative">
            <Download className="w-5 h-5 text-[#00d17a]" />
            {pendingTasks > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#00d17a] text-black text-[10px] font-bold rounded-full flex items-center justify-center">
                {pendingTasks}
              </span>
            )}
          </div>
          <span className="font-medium text-white">下载队列</span>
          {tasks.length > 0 && (
            <Badge variant="secondary" className="bg-[#262626] text-[#a0a0a0] border-0">
              {tasks.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {tasks.length > 0 && (
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setMinimized(!minimized);
              }}
              className="w-7 h-7 text-[#707070] hover:text-white"
            >
              {minimized ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setPanelOpen(false);
            }}
            className="w-7 h-7 text-[#707070] hover:text-[#e74c3c]"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 内容区 */}
      {!minimized && (
        <div className="bg-[#0d0d0d] border-x border-b border-[#2a2a2a] rounded-b-lg overflow-hidden flex flex-col max-h-[calc(100vh-120px)]">
          {/* 统计栏 */}
          {tasks.length > 0 && (
            <div className="flex items-center gap-1 px-3 py-2 bg-[#151515] border-b border-[#2a2a2a] flex-shrink-0">
              {pendingTasks > 0 && (
                <Badge
                  variant="secondary"
                  className="bg-[#00d17a]/10 text-[#00d17a] border-0 text-xs"
                >
                  进行中 {pendingTasks}
                </Badge>
              )}
              {completedTasks > 0 && (
                <Badge
                  variant="secondary"
                  className="bg-[#00d17a]/10 text-[#00d17a] border-0 text-xs"
                >
                  已完成 {completedTasks}
                </Badge>
              )}
              {failedTasks > 0 && (
                <Badge
                  variant="secondary"
                  className="bg-[#e74c3c]/10 text-[#e74c3c] border-0 text-xs"
                >
                  失败 {failedTasks}
                </Badge>
              )}
              <div className="flex-1" />
              {completedTasks > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearCompleted}
                  className="h-6 px-2 text-xs text-[#707070] hover:text-[#e74c3c]"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  清除已完成
                </Button>
              )}
            </div>
          )}

          {/* 任务列表 */}
          <ScrollArea className="flex-1 w-full" type="auto">
            <div className="p-3 space-y-2" style={{ width: 'calc(100% - 4px)' }}>
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-[#707070]">
                  <Download className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">暂无下载任务</p>
                </div>
              ) : (
                tasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    onRemove={() => removeTask(task.id)}
                    onRetry={() => retryTask(task.id)}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* 最小化时的底部圆角 */}
      {minimized && <div className="h-2 bg-[#1a1a1a] border-x border-b border-[#2a2a2a] rounded-b-lg" />}
    </div>
  );
}

// 迷你下载指示器（当面板关闭但有任务时显示）
export function DownloadIndicator() {
  const { pendingTasks, completedTasks, failedTasks, setPanelOpen, tasks } = useDownloadQueue();

  if (tasks.length === 0) return null;

  return (
    <button
      onClick={() => setPanelOpen(true)}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-full shadow-lg hover:border-[#00d17a]/50 transition-all"
    >
      <div className="relative">
        <Download className="w-5 h-5 text-[#00d17a]" />
        {pendingTasks > 0 && (
          <Loader2 className="w-5 h-5 text-[#00d17a] animate-spin absolute inset-0" />
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {pendingTasks > 0 && (
          <span className="text-sm text-[#00d17a]">{pendingTasks} 进行中</span>
        )}
        {completedTasks > 0 && !pendingTasks && (
          <span className="text-sm text-[#00d17a]">{completedTasks} 已完成</span>
        )}
        {failedTasks > 0 && !pendingTasks && (
          <span className="text-sm text-[#e74c3c]">{failedTasks} 失败</span>
        )}
      </div>
    </button>
  );
}
