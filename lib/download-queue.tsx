'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

export type DownloadStatus = 'pending' | 'downloading' | 'processing' | 'completed' | 'error';

export interface DownloadTask {
  id: string;
  modId: string;
  modName: string;
  versionId: string;
  versionNumber: string;
  filename: string;
  iconUrl?: string;
  status: DownloadStatus;
  progress: number;
  speed: string;
  error?: string;
  addedAt: Date;
  completedAt?: Date;
}

interface DownloadQueueContextType {
  tasks: DownloadTask[];
  activeTask: DownloadTask | null;
  isPanelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  addTask: (task: Omit<DownloadTask, 'id' | 'status' | 'progress' | 'speed' | 'addedAt'>) => string;
  removeTask: (id: string) => void;
  clearCompleted: () => void;
  retryTask: (id: string) => void;
  totalTasks: number;
  pendingTasks: number;
  completedTasks: number;
  failedTasks: number;
}

const DownloadQueueContext = createContext<DownloadQueueContextType | null>(null);

export function DownloadQueueProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const activeDownloads = useRef<Map<string, AbortController>>(new Map());

  const addTask = useCallback((taskData: Omit<DownloadTask, 'id' | 'status' | 'progress' | 'speed' | 'addedAt'>) => {
    const id = `${taskData.modId}-${Date.now()}`;
    const newTask: DownloadTask = {
      ...taskData,
      id,
      status: 'pending',
      progress: 0,
      speed: '-',
      addedAt: new Date(),
    };
    
    setTasks((prev) => [...prev, newTask]);
    setIsPanelOpen(true);
    
    // 开始下载
    startDownload(id, newTask);
    
    return id;
  }, []);

  const startDownload = async (taskId: string, task: DownloadTask) => {
    const controller = new AbortController();
    activeDownloads.current.set(taskId, controller);

    // 更新状态为下载中
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: 'downloading' } : t))
    );

    try {
      // 模拟进度更新（实际项目中可以使用 EventSource 或 WebSocket 获取实时进度）
      const progressInterval = setInterval(() => {
        setTasks((prev) => {
          const currentTask = prev.find((t) => t.id === taskId);
          if (!currentTask || currentTask.status !== 'downloading') {
            clearInterval(progressInterval);
            return prev;
          }
          
          const newProgress = Math.min(currentTask.progress + Math.random() * 15, 95);
          const speed = `${(Math.random() * 5 + 1).toFixed(1)} MB/s`;
          
          if (newProgress >= 95) {
            clearInterval(progressInterval);
          }
          
          return prev.map((t) =>
            t.id === taskId ? { ...t, progress: newProgress, speed } : t
          );
        });
      }, 300);

      // 发送下载请求
      const response = await fetch('/api/mods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: task.modId,
          versionId: task.versionId,
        }),
        signal: controller.signal,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '下载失败' }));
        throw new Error(errorData.error || '下载失败');
      }

      const result = await response.json();

      // 下载完成
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: 'completed',
                progress: 100,
                speed: '-',
                completedAt: new Date(),
                filename: result.mod?.filename || t.filename,
              }
            : t
        )
      );
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, status: 'error', error: '已取消', speed: '-' }
              : t
          )
        );
      } else {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, status: 'error', error: (error as Error).message, speed: '-' }
              : t
          )
        );
      }
    } finally {
      activeDownloads.current.delete(taskId);
    }
  };

  const removeTask = useCallback((id: string) => {
    const controller = activeDownloads.current.get(id);
    if (controller) {
      controller.abort();
      activeDownloads.current.delete(id);
    }
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setTasks((prev) => prev.filter((t) => t.status !== 'completed'));
  }, []);

  const retryTask = useCallback((id: string) => {
    setTasks((prev) => {
      const task = prev.find((t) => t.id === id);
      if (!task) return prev;
      
      const resetTask = {
        ...task,
        status: 'pending' as DownloadStatus,
        progress: 0,
        speed: '-',
        error: undefined,
        completedAt: undefined,
      };
      
      startDownload(id, resetTask);
      
      return prev.map((t) => (t.id === id ? resetTask : t));
    });
  }, []);

  const activeTask = tasks.find((t) => t.status === 'downloading') || null;
  const totalTasks = tasks.length;
  const pendingTasks = tasks.filter((t) => t.status === 'pending' || t.status === 'downloading').length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const failedTasks = tasks.filter((t) => t.status === 'error').length;

  return (
    <DownloadQueueContext.Provider
      value={{
        tasks,
        activeTask,
        isPanelOpen,
        setPanelOpen: setIsPanelOpen,
        addTask,
        removeTask,
        clearCompleted,
        retryTask,
        totalTasks,
        pendingTasks,
        completedTasks,
        failedTasks,
      }}
    >
      {children}
    </DownloadQueueContext.Provider>
  );
}

export function useDownloadQueue() {
  const context = useContext(DownloadQueueContext);
  if (!context) {
    throw new Error('useDownloadQueue must be used within DownloadQueueProvider');
  }
  return context;
}
