'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { 
  springScale 
} from '@/lib/animations';

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
      return (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, ease: 'linear', repeat: Infinity }}
        >
          <Loader2 className="w-4 h-4 text-[#00d17a]" />
        </motion.div>
      );
    case 'processing':
      return (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, ease: 'linear', repeat: Infinity }}
        >
          <Loader2 className="w-4 h-4 text-[#1b8fff]" />
        </motion.div>
      );
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
  const [expanded] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'rounded-lg border',
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
            <AnimatePresence>
              {(task.status === 'downloading' || task.status === 'processing') && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[#00d17a]">{task.speed}</span>
                    <span className="text-[#a0a0a0]">{task.progress.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-[#00d17a] to-[#00b86b] rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${task.progress}%` }}
                      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 错误信息 */}
            <AnimatePresence>
              {task.status === 'error' && task.error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 text-xs text-[#e74c3c]"
                >
                  {task.error}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <AnimatePresence>
              {task.status === 'error' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                >
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={onRetry}
                    className="w-7 h-7 text-[#707070] hover:text-[#00d17a] hover:bg-[#00d17a]/10 flex-shrink-0"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
            <motion.div whileTap={{ scale: 0.85 }}>
              <Button
                size="icon"
                variant="ghost"
                onClick={onRemove}
                className="w-7 h-7 text-[#707070] hover:text-[#e74c3c] hover:bg-[#e74c3c]/10 flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </motion.div>
          </div>
        </div>
      </div>

      {/* 展开详情 */}
      <AnimatePresence>
        {task.completedAt && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
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
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
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
    <motion.div
      layout
      className={cn(
        'fixed bottom-4 right-4 z-50 flex flex-col',
        minimized ? 'w-72' : 'w-[440px]'
      )}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* 头部 */}
      <motion.div
        layout
        className="flex items-center justify-between px-4 py-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-t-lg cursor-pointer"
        onClick={() => tasks.length > 0 && setMinimized(!minimized)}
        whileHover={tasks.length > 0 ? { backgroundColor: 'rgba(38, 38, 38, 1)' } : {}}
      >
        <div className="flex items-center gap-2">
          <div className="relative">
            <Download className="w-5 h-5 text-[#00d17a]" />
            <AnimatePresence>
              {pendingTasks > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-[#00d17a] text-black text-[10px] font-bold rounded-full flex items-center justify-center"
                >
                  {pendingTasks}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <span className="font-medium text-white">下载队列</span>
          <AnimatePresence>
            {tasks.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
              >
                <Badge variant="secondary" className="bg-[#262626] text-[#a0a0a0] border-0">
                  {tasks.length}
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-1">
          <AnimatePresence>
            {tasks.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
              >
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMinimized(!minimized);
                  }}
                  className="w-7 h-7 text-[#707070] hover:text-white"
                >
                  <motion.div
                    animate={{ rotate: minimized ? 0 : 180 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </motion.div>
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
          <motion.div whileTap={{ scale: 0.85 }}>
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
          </motion.div>
        </div>
      </motion.div>

      {/* 内容区 */}
      <AnimatePresence>
        {!minimized && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="bg-[#0d0d0d] border-x border-b border-[#2a2a2a] rounded-b-lg overflow-hidden flex flex-col max-h-[calc(100vh-120px)]"
          >
            {/* 统计栏 */}
            <AnimatePresence>
              {tasks.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-center gap-1 px-3 py-2 bg-[#151515] border-b border-[#2a2a2a] flex-shrink-0"
                >
                  <AnimatePresence>
                    {pendingTasks > 0 && (
                      <motion.div
                        key="pending-badge"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                      >
                        <Badge
                          variant="secondary"
                          className="bg-[#00d17a]/10 text-[#00d17a] border-0 text-xs"
                        >
                          进行中 {pendingTasks}
                        </Badge>
                      </motion.div>
                    )}
                    {completedTasks > 0 && (
                      <motion.div
                        key="completed-badge"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                      >
                        <Badge
                          variant="secondary"
                          className="bg-[#00d17a]/10 text-[#00d17a] border-0 text-xs"
                        >
                          已完成 {completedTasks}
                        </Badge>
                      </motion.div>
                    )}
                    {failedTasks > 0 && (
                      <motion.div
                        key="failed-badge"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                      >
                        <Badge
                          variant="secondary"
                          className="bg-[#e74c3c]/10 text-[#e74c3c] border-0 text-xs"
                        >
                          失败 {failedTasks}
                        </Badge>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="flex-1" />
                  <AnimatePresence>
                    {completedTasks > 0 && (
                      <motion.div
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                      >
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={clearCompleted}
                          className="h-6 px-2 text-xs text-[#707070] hover:text-[#e74c3c]"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          清除已完成
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 任务列表 */}
            <ScrollArea className="flex-1 w-full" type="auto">
              <div className="p-3 space-y-2" style={{ width: 'calc(100% - 4px)' }}>
                <AnimatePresence mode="popLayout">
                  {tasks.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center py-8 text-[#707070]"
                    >
                      <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">暂无下载任务</p>
                    </motion.div>
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
                </AnimatePresence>
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 最小化时的底部圆角 */}
      <AnimatePresence>
        {minimized && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-2 bg-[#1a1a1a] border-x border-b border-[#2a2a2a] rounded-b-lg"
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// 迷你下载指示器（当面板关闭但有任务时显示）
export function DownloadIndicator() {
  const { pendingTasks, completedTasks, failedTasks, setPanelOpen, tasks } = useDownloadQueue();

  if (tasks.length === 0) return null;

  return (
    <motion.button
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      whileHover={{ scale: 1.02, borderColor: 'rgba(0, 209, 122, 0.5)' }}
      whileTap={{ scale: 0.98 }}
      onClick={() => setPanelOpen(true)}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-full shadow-lg"
    >
      <div className="relative">
        <Download className="w-5 h-5 text-[#00d17a]" />
        {pendingTasks > 0 && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, ease: 'linear', repeat: Infinity }}
            className="absolute inset-0"
          >
            <Loader2 className="w-5 h-5 text-[#00d17a]" />
          </motion.div>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <AnimatePresence mode="wait">
          {pendingTasks > 0 && (
            <motion.span
              key="pending"
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 4 }}
              className="text-sm text-[#00d17a]"
            >
              {pendingTasks} 进行中
            </motion.span>
          )}
          {completedTasks > 0 && !pendingTasks && (
            <motion.span
              key="completed"
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 4 }}
              className="text-sm text-[#00d17a]"
            >
              {completedTasks} 已完成
            </motion.span>
          )}
          {failedTasks > 0 && !pendingTasks && (
            <motion.span
              key="failed"
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 4 }}
              className="text-sm text-[#e74c3c]"
            >
              {failedTasks} 失败
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.button>
  );
}
