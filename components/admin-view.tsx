'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ServerConfigPanel } from './server-config';
import { ModManager } from './mod-manager';
import { ModSearch } from './mod-search';
import { Lock, Settings, Package, Search, LogOut } from 'lucide-react';

interface AdminViewProps {
  onLogout: () => void;
}

export function AdminView({ onLogout }: AdminViewProps) {
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

      {/* 标签页 */}
      <Tabs defaultValue="mods" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-[#1a1a1a] border border-[#2a2a2a]">
          <TabsTrigger 
            value="config" 
            className="data-[state=active]:bg-[#262626] data-[state=active]:text-white"
          >
            <Settings className="w-4 h-4 mr-2" />
            服务端配置
          </TabsTrigger>
          <TabsTrigger 
            value="mods"
            className="data-[state=active]:bg-[#262626] data-[state=active]:text-white"
          >
            <Package className="w-4 h-4 mr-2" />
            模组管理
          </TabsTrigger>
          <TabsTrigger 
            value="search"
            className="data-[state=active]:bg-[#262626] data-[state=active]:text-white"
          >
            <Search className="w-4 h-4 mr-2" />
            添加模组
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="mt-6">
          <ServerConfigPanel />
        </TabsContent>

        <TabsContent value="mods" className="mt-6">
          <ModManager />
        </TabsContent>

        <TabsContent value="search" className="mt-6">
          <ModSearch />
        </TabsContent>
      </Tabs>
    </div>
  );
}
