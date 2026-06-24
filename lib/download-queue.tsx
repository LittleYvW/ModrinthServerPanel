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

      // 非 2xx 响应：前置校验失败，解析为普通 JSON 错误
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '下载失败' }));
        throw new Error(errorData.error || '下载失败');
      }

      if (!response.body) {
        throw new Error('无法读取下载流');
      }

      // 读取 NDJSON 流
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let lastLoaded = 0;
      let lastTime = Date.now();
      let downloadComplete = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 按行分割（NDJSON：每行一个 JSON 对象）
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留最后不完整的行

        for (const line of lines) {
          if (!line.trim()) continue;

          let event: {
            type: string;
            loaded?: number;
            total?: number;
            success?: boolean;
            mod?: { filename?: string };
            error?: string;
          };
          try {
            event = JSON.parse(line);
          } catch {
            continue; // 跳过无法解析的行
          }

          if (event.type === 'progress') {
            const loaded = event.loaded || 0;
            const total = event.total || 0;
            const now = Date.now();
            const elapsedSec = (now - lastTime) / 1000;
            const bytesDiff = loaded - lastLoaded;

            // 计算实时速度
            let speed = '-';
            if (elapsedSec > 0 && bytesDiff > 0) {
              const speedMBs = bytesDiff / elapsedSec / (1024 * 1024);
              if (speedMBs >= 1) {
                speed = `${speedMBs.toFixed(1)} MB/s`;
              } else {
                const speedKBs = bytesDiff / elapsedSec / 1024;
                speed = `${speedKBs.toFixed(0)} KB/s`;
              }
            }

            // 计算进度百分比（Content-Length 缺失时为 0，进度不更新）
            const progress = total > 0 ? Math.min((loaded / total) * 100, 100) : 0;

            setTasks((prev) =>
              prev.map((t) =>
                t.id === taskId ? { ...t, progress, speed } : t
              )
            );

            lastLoaded = loaded;
            lastTime = now;
          } else if (event.type === 'result') {
            if (event.success) {
              setTasks((prev) =>
                prev.map((t) =>
                  t.id === taskId
                    ? {
                        ...t,
                        status: 'completed' as DownloadStatus,
                        progress: 100,
                        speed: '-',
                        completedAt: new Date(),
                        filename: event.mod?.filename || t.filename,
                      }
                    : t
                )
              );
              downloadComplete = true;
            } else {
              throw new Error(event.error || '下载失败');
            }
          } else if (event.type === 'error') {
            throw new Error(event.error || '下载失败');
          }
        }

        if (downloadComplete) break;
      }

      // 流结束但未收到 result 事件
      if (!downloadComplete) {
        throw new Error('下载流意外结束');
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, status: 'error' as DownloadStatus, error: '已取消', speed: '-' }
              : t
          )
        );
      } else {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, status: 'error' as DownloadStatus, error: (error as Error).message, speed: '-' }
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
