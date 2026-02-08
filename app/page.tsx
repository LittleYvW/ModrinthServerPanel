'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download, Loader2 } from 'lucide-react';
import { VisitorView } from '@/components/visitor-view';
import { AdminView } from '@/components/admin-view';
import { LoginDialog } from '@/components/login-dialog';
import { DownloadPanel } from '@/components/download-panel';
import { useDownloadQueue } from '@/lib/download-queue';
import { Shield, User, Github, ExternalLink } from 'lucide-react';

export default function Home() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  const handleLogin = () => {
    setIsAdmin(true);
    setShowLogin(false);
  };

  const handleLogout = () => {
    setIsAdmin(false);
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      {/* 顶部导航 */}
      <header className="border-b border-[#2a2a2a] bg-[#0d0d0d]/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#00d17a] to-[#00b86b] flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-5 h-5 text-black"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-white text-lg leading-tight">
                Modrinth Panel
              </h1>
              <p className="text-xs text-[#707070]">服务器模组管理</p>
            </div>
          </div>

          {/* 右侧操作 */}
          <div className="flex items-center gap-3">
            {/* 当前模式指示 */}
            <Badge
              variant="outline"
              className={`
                ${isAdmin 
                  ? 'border-[#00d17a] text-[#00d17a] bg-[#00d17a]/10' 
                  : 'border-[#2a2a2a] text-[#707070]'
                }
              `}
            >
              {isAdmin ? (
                <>
                  <Shield className="w-3 h-3 mr-1" />
                  管理员
                </>
              ) : (
                <>
                  <User className="w-3 h-3 mr-1" />
                  访客
                </>
              )}
            </Badge>

            {/* 模式切换按钮 */}
            {!isAdmin ? (
              <Button
                size="sm"
                onClick={() => setShowLogin(true)}
                className="bg-[#262626] hover:bg-[#2a2a2a] text-white border border-[#2a2a2a]"
              >
                <Shield className="w-4 h-4 mr-2" />
                管理员登录
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {isAdmin ? (
          <AdminView onLogout={handleLogout} />
        ) : (
          <VisitorView />
        )}
      </main>

      {/* 底部 */}
      <footer className="border-t border-[#2a2a2a] mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-[#707070]">
              数据来自{' '}
              <a
                href="https://modrinth.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#00d17a] hover:underline inline-flex items-center gap-1"
              >
                Modrinth
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
            <div className="flex items-center gap-4 text-sm text-[#707070]">
              <span>Made with ❤️ for Minecraft</span>
            </div>
          </div>
        </div>
      </footer>

      {/* 登录对话框 */}
      {showLogin && (
        <LoginDialog
          onLogin={handleLogin}
          onCancel={() => setShowLogin(false)}
        />
      )}

      {/* 下载队列面板 */}
      <DownloadPanelContainer />
    </div>
  );
}

// 下载面板容器组件
function DownloadPanelContainer() {
  const { isPanelOpen, setPanelOpen, tasks, pendingTasks, completedTasks, failedTasks } = useDownloadQueue();
  
  // 如果面板关闭但有任务，显示迷你指示器
  if (!isPanelOpen && tasks.length > 0) {
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
  
  return <DownloadPanel />;
}
