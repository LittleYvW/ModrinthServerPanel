'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ServerConfigPanel } from './server-config';
import { ModManager } from './mod-manager';
import { ModSearch } from './mod-search';
import { Lock, Settings, Package, Search, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fadeIn, tabContent, springScale } from '@/lib/animations';

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
  const [animationDirection, setAnimationDirection] = useState<'left' | 'right'>('right');

  const handleTabChange = (newTab: TabValue) => {
    if (newTab === activeTab) return;

    // 确定动画方向
    const currentIndex = tabs.findIndex((t) => t.value === activeTab);
    const newIndex = tabs.findIndex((t) => t.value === newTab);
    setAnimationDirection(newIndex > currentIndex ? 'right' : 'left');
    setActiveTab(newTab);
  };

  const currentTab = tabs.find((t) => t.value === activeTab);

  return (
    <motion.div 
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={fadeIn}
    >
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div 
            className="w-10 h-10 rounded-lg bg-[#00d17a] flex items-center justify-center"
            variants={springScale}
          >
            <Lock className="w-5 h-5 text-black" />
          </motion.div>
          <div>
            <h1 className="text-xl font-bold text-white">管理员面板</h1>
            <p className="text-sm text-[#a0a0a0]">管理服务器配置和模组</p>
          </div>
        </div>
        <motion.div whileTap={{ scale: 0.96 }}>
          <Button
            variant="outline"
            onClick={onLogout}
            className="border-[#2a2a2a] hover:border-[#e74c3c] hover:text-[#e74c3c]"
          >
            <LogOut className="w-4 h-4 mr-2" />
            退出管理
          </Button>
        </motion.div>
      </div>

      <Separator className="bg-[#2a2a2a]" />

      {/* 自定义标签页 */}
      <div className="space-y-6">
        {/* Tab 按钮组 */}
        <div className="relative">
          <div className="flex bg-[#151515] rounded-xl p-1.5 border border-[#2a2a2a]">
            {tabs.map((tab) => (
              <motion.button
                key={tab.value}
                onClick={() => handleTabChange(tab.value)}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'relative flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-medium',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d17a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0d0d]',
                  activeTab === tab.value
                    ? 'text-white'
                    : 'text-[#707070] hover:text-[#a0a0a0] hover:bg-[#1f1f1f]'
                )}
              >
                {/* 激活背景 */}
                <AnimatePresence mode="wait">
                  {activeTab === tab.value && (
                    <motion.span
                      layoutId="activeTabBg"
                      className="absolute inset-0 bg-[#262626] rounded-lg"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    />
                  )}
                </AnimatePresence>
                
                {/* 左侧发光指示条 */}
                <motion.span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-[#00d17a]"
                  initial={false}
                  animate={{
                    opacity: activeTab === tab.value ? 1 : 0,
                    x: activeTab === tab.value ? 0 : -8,
                  }}
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                />

                {/* 内容 */}
                <span className="relative z-10 flex items-center gap-2">
                  <motion.span
                    animate={{
                      color: activeTab === tab.value ? '#00d17a' : 'inherit',
                    }}
                    transition={{ duration: 0.25 }}
                  >
                    {tab.icon}
                  </motion.span>
                  <span>{tab.label}</span>
                </span>
              </motion.button>
            ))}
          </div>

          {/* 底部进度条指示器 */}
          <div className="absolute -bottom-2 left-1.5 right-1.5 h-0.5 bg-[#2a2a2a] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[#00d17a] to-[#00d17a]/60 rounded-full"
              initial={false}
              animate={{
                width: `${100 / tabs.length}%`,
                x: `${tabs.findIndex((t) => t.value === activeTab) * 100}%`,
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          </div>
        </div>

        {/* Tab 内容区 */}
        <div className="relative min-h-[500px]">
          {/* 标题和描述 */}
          <div className="mb-4 flex items-center gap-3">
            <motion.div 
              className="w-8 h-8 rounded-lg bg-[#00d17a]/10 flex items-center justify-center"
              key={currentTab?.value}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            >
              <span className="text-[#00d17a]">{currentTab?.icon}</span>
            </motion.div>
            <div>
              <h2 className="text-lg font-semibold text-white">{currentTab?.label}</h2>
              <p className="text-xs text-[#707070]">{currentTab?.description}</p>
            </div>
          </div>

          {/* 内容动画容器 */}
          <AnimatePresence mode="wait" custom={animationDirection}>
            <motion.div
              key={activeTab}
              custom={animationDirection}
              variants={tabContent}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {activeTab === 'config' && <ServerConfigPanel />}
              {activeTab === 'mods' && <ModManager />}
              {activeTab === 'search' && <ModSearch />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
