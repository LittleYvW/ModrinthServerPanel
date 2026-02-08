'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ServerConfigPanel } from './server-config';
import { ModManager } from './mod-manager';
import { ModSearch } from './mod-search';
import { Lock, Settings, Package, Search, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminViewProps {
  onLogout: () => void;
}

type TabValue = 'config' | 'mods' | 'search';

interface TabItem {
  value: TabValue;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const tabs: TabItem[] = [
  {
    value: 'config',
    label: '服务端配置',
    icon: <Settings className="w-4 h-4" />,
    description: '配置服务器路径和版本信息',
  },
  {
    value: 'mods',
    label: '模组管理',
    icon: <Package className="w-4 h-4" />,
    description: '查看和管理已安装的模组',
  },
  {
    value: 'search',
    label: '添加模组',
    icon: <Search className="w-4 h-4" />,
    description: '从 Modrinth 搜索并添加模组',
  },
];

export function AdminView({ onLogout }: AdminViewProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('mods');
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationDirection, setAnimationDirection] = useState<'left' | 'right'>('right');

  const handleTabChange = (newTab: TabValue) => {
    if (newTab === activeTab || isAnimating) return;

    // 确定动画方向
    const currentIndex = tabs.findIndex((t) => t.value === activeTab);
    const newIndex = tabs.findIndex((t) => t.value === newTab);
    setAnimationDirection(newIndex > currentIndex ? 'right' : 'left');

    setIsAnimating(true);
    setTimeout(() => {
      setActiveTab(newTab);
      // 等待新内容渲染后开始进入动画
      requestAnimationFrame(() => {
        setIsAnimating(false);
      });
    }, 150);
  };

  const currentTab = tabs.find((t) => t.value === activeTab);

  return (
    <div className="space-y-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#00d17a] flex items-center justify-center">
            <Lock className="w-5 h-5 text-black" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">管理员面板</h1>
            <p className="text-sm text-[#a0a0a0]">管理服务器配置和模组</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={onLogout}
          className="border-[#2a2a2a] hover:border-[#e74c3c] hover:text-[#e74c3c]"
        >
          <LogOut className="w-4 h-4 mr-2" />
          退出管理
        </Button>
      </div>

      <Separator className="bg-[#2a2a2a]" />

      {/* 自定义标签页 */}
      <div className="space-y-6">
        {/* Tab 按钮组 */}
        <div className="relative">
          <div className="flex bg-[#151515] rounded-xl p-1.5 border border-[#2a2a2a]">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => handleTabChange(tab.value)}
                className={cn(
                  'relative flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium transition-all duration-250 ease-out',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d17a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0d0d]',
                  activeTab === tab.value
                    ? 'text-white'
                    : 'text-[#707070] hover:text-[#a0a0a0] hover:bg-[#1f1f1f]'
                )}
              >
                {/* 激活背景 */}
                {activeTab === tab.value && (
                  <span className="absolute inset-0 bg-[#262626] rounded-lg animate-in fade-in duration-200" />
                )}
                
                {/* 左侧发光指示条 */}
                <span
                  className={cn(
                    'absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-[#00d17a] transition-all duration-250',
                    activeTab === tab.value
                      ? 'opacity-100 translate-x-0'
                      : 'opacity-0 -translate-x-2'
                  )}
                />

                {/* 内容 */}
                <span className={cn(
                  'relative z-10 flex items-center gap-2 transition-transform duration-250',
                  activeTab === tab.value ? 'translate-y-0' : 'translate-y-0'
                )}>
                  <span className={cn(
                    'transition-colors duration-250',
                    activeTab === tab.value ? 'text-[#00d17a]' : ''
                  )}>
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </span>
              </button>
            ))}
          </div>

          {/* 底部进度条指示器 */}
          <div className="absolute -bottom-2 left-1.5 right-1.5 h-0.5 bg-[#2a2a2a] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#00d17a] to-[#00d17a]/60 rounded-full transition-all duration-300 ease-spring"
              style={{
                width: `${100 / tabs.length}%`,
                transform: `translateX(${tabs.findIndex((t) => t.value === activeTab) * 100}%)`,
              }}
            />
          </div>
        </div>

        {/* Tab 内容区 */}
        <div className="relative min-h-[500px]">
          {/* 标题和描述 */}
          <div className="mb-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#00d17a]/10 flex items-center justify-center">
              <span className="text-[#00d17a]">{currentTab?.icon}</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{currentTab?.label}</h2>
              <p className="text-xs text-[#707070]">{currentTab?.description}</p>
            </div>
          </div>

          {/* 内容动画容器 */}
          <div
            className={cn(
              'transition-all duration-250 ease-out',
              isAnimating
                ? animationDirection === 'right'
                  ? 'opacity-0 -translate-x-4'
                  : 'opacity-0 translate-x-4'
                : 'opacity-100 translate-x-0'
            )}
          >
            {activeTab === 'config' && <ServerConfigPanel />}
            {activeTab === 'mods' && <ModManager />}
            {activeTab === 'search' && <ModSearch />}
          </div>
        </div>
      </div>
    </div>
  );
}
