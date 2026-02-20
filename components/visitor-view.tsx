'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Package, Users, Server, Loader2, Monitor, Star, Box, Wrench } from 'lucide-react';
import { 
  fadeIn, 
  fadeInUp, 
  staggerContainer, 
  listItem,
  springScale
} from '@/lib/animations';

interface Mod {
  id: string;
  name: string;
  slug: string;
  description?: string;
  versionNumber?: string;
  filename: string;
  iconUrl?: string;
  category: 'both' | 'server-only' | 'client-only';
  environment: {
    client: string;
    server: string;
  };
  enabled?: boolean;
  recommended?: boolean;
}

interface CategorizedMods {
  both: Mod[];
  serverOnly: Mod[];
  clientOnly: Mod[];
}

type Loader = 'fabric' | 'forge' | 'quilt' | 'neoforge';

interface Config {
  showServerOnlyMods: boolean;
  minecraftVersion: string;
  loader: Loader;
  loaderVersion: string;
}

const loaderConfig: Record<Loader, { label: string; color: string; bgColor: string }> = {
  fabric: { label: 'Fabric', color: '#dbb69b', bgColor: 'rgba(219, 182, 155, 0.15)' },
  forge: { label: 'Forge', color: '#e67e22', bgColor: 'rgba(230, 126, 34, 0.15)' },
  quilt: { label: 'Quilt', color: '#9b59b6', bgColor: 'rgba(155, 89, 182, 0.15)' },
  neoforge: { label: 'NeoForge', color: '#e67e22', bgColor: 'rgba(230, 126, 34, 0.15)' },
};

export function VisitorView() {
  const [mods, setMods] = useState<CategorizedMods>({ both: [], serverOnly: [], clientOnly: [] });
  const [config, setConfig] = useState<Config>({ 
    showServerOnlyMods: true,
    minecraftVersion: '',
    loader: 'fabric',
    loaderVersion: '',
  });
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [batchDownloadingClient, setBatchDownloadingClient] = useState(false);

  useEffect(() => {
    fetchMods();
  }, []);

  const fetchMods = async () => {
    try {
      const res = await fetch('/api/mods');
      const data = await res.json();
      // 过滤掉禁用的模组（只显示启用的），客户端模组显示推荐的
      const enabledMods = {
        both: data.categorized.both.filter((m: Mod) => m.enabled !== false),
        serverOnly: data.categorized.serverOnly.filter((m: Mod) => m.enabled !== false),
        clientOnly: data.categorized.clientOnly.filter((m: Mod) => m.recommended === true),
      };
      setMods(enabledMods);
      if (data.config) {
        setConfig(data.config);
      }
    } catch (error) {
      console.error('Failed to fetch mods:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadMod = async (modId: string, filename: string) => {
    setDownloading(modId);
    try {
      const res = await fetch(`/api/download?modId=${modId}`);
      if (!res.ok) throw new Error('Download failed');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      alert('下载失败');
    } finally {
      setDownloading(null);
    }
  };

  const downloadAll = async () => {
    // 仅下载双端必需模组
    for (const mod of mods.both) {
      await downloadMod(mod.id, mod.filename);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const downloadAllClientMods = async () => {
    // 仅下载推荐客户端模组
    for (const mod of mods.clientOnly) {
      await downloadMod(mod.id, mod.filename);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, ease: 'linear', repeat: Infinity }}
        >
          <Loader2 className="w-8 h-8 text-[#00d17a]" />
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div 
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={fadeIn}
    >
      {/* 服务端配置信息 - 醒目展示 */}
      {config.minecraftVersion && (
        <motion.div
          className="max-w-2xl mx-auto"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.4 }}
        >
          <div className="relative overflow-hidden rounded-xl border border-[#00d17a]/30 bg-gradient-to-r from-[#00d17a]/10 via-[#00d17a]/5 to-[#00d17a]/10 p-4">
            {/* 装饰性背景 */}
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9IiMwMGQxN2EiIG9wYWNpdHk9IjAuMSIvPjwvc3ZnPg==')] opacity-50" />
            
            <div className="relative flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
              {/* 标题 */}
              <div className="flex items-center gap-2 text-[#00d17a] shrink-0">
                <Server className="w-5 h-5" />
                <span className="font-semibold text-sm">客户端基本要求</span>
              </div>
              
              {/* 分隔线 */}
              <div className="hidden sm:block w-px h-8 bg-[#00d17a]/30" />
              
              {/* 配置信息 */}
              <div className="flex flex-wrap items-center justify-center gap-3">
                {/* Minecraft 版本 */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1a1a1a]/80 border border-[#2a2a2a]">
                  <Box className="w-4 h-4 text-[#00d17a]" />
                  <span className="text-white font-medium">{config.minecraftVersion}</span>
                </div>
                
                {/* 加载器类型 */}
                {config.loader && (
                  <div 
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
                    style={{ 
                      backgroundColor: loaderConfig[config.loader].bgColor,
                      borderColor: `${loaderConfig[config.loader].color}40`,
                    }}
                  >
                    <Wrench className="w-4 h-4" style={{ color: loaderConfig[config.loader].color }} />
                    <span className="font-medium" style={{ color: loaderConfig[config.loader].color }}>
                      {loaderConfig[config.loader].label}
                    </span>
                    {config.loaderVersion && (
                      <span className="text-[#a0a0a0] text-sm">
                        {config.loaderVersion}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* 欢迎信息 */}
      <motion.div 
        className="text-center space-y-2"
        variants={fadeInUp}
      >
        <h1 className="text-3xl font-bold text-white">必需模组下载</h1>
        <p className="text-[#a0a0a0]">
          以下是需要在客户端安装的双端模组
        </p>
      </motion.div>

      {/* 批量下载按钮 - 仅双端必需模组 */}
      <AnimatePresence>
        {mods.both.length > 0 && (
          <motion.div 
            className="flex justify-center"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ delay: 0.1 }}
          >
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={downloadAll}
                className="bg-[#00d17a] hover:bg-[#00b86b] text-black font-semibold px-6"
              >
                <Download className="w-4 h-4 mr-2" />
                下载全部 ({mods.both.length} 个)
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 双端模组列表 */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.1 }}
      >
        <Card className="border-[#2a2a2a] bg-[#151515]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Users className="w-5 h-5 text-[#00d17a]" />
              双端必需模组
              <Badge variant="secondary" className="bg-[#00d17a]/20 text-[#00d17a] border-0">
                {mods.both.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {mods.both.length === 0 ? (
              <motion.div 
                className="text-center py-8 text-[#a0a0a0]"
                variants={springScale}
              >
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>暂无必需模组</p>
              </motion.div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-3 pr-3">
                  <motion.div
                    className="space-y-3"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                  >
                  {mods.both.map((mod) => (
                    <motion.div
                      key={mod.id}
                      variants={listItem}
                      whileHover={{ x: 4, backgroundColor: 'rgba(31, 31, 31, 1)' }}
                      className="flex items-center gap-3 p-3 rounded-lg bg-[#1a1a1a] cursor-default min-w-0"
                    >
                      {/* 图标 */}
                      <div className="w-12 h-12 rounded-lg bg-[#262626] flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {mod.iconUrl ? (
                          <img
                            src={mod.iconUrl}
                            alt={mod.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-6 h-6 text-[#a0a0a0]" />
                        )}
                      </div>

                      {/* 信息 */}
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <h3 className="font-medium text-white truncate">{mod.name}</h3>
                        <p className="text-sm text-[#a0a0a0] truncate">
                          {mod.description || mod.filename}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-xs border-[#2a2a2a] text-[#a0a0a0] shrink-0">
                            v{mod.versionNumber || 'unknown'}
                          </Badge>
                          <Badge className="text-xs bg-[#00d17a]/20 text-[#00d17a] border-0 shrink-0">
                            双端
                          </Badge>
                        </div>
                      </div>

                      {/* 下载按钮 */}
                      <motion.div whileTap={{ scale: 0.92 }}>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadMod(mod.id, mod.filename)}
                          disabled={downloading === mod.id}
                          className="border-[#2a2a2a] hover:border-[#00d17a] hover:text-[#00d17a] flex-shrink-0"
                        >
                          {downloading === mod.id ? (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 2, ease: 'linear', repeat: Infinity }}
                            >
                              <Loader2 className="w-4 h-4" />
                            </motion.div>
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </Button>
                      </motion.div>
                    </motion.div>
                  ))}
                  </motion.div>
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* 推荐客户端模组 */}
      <AnimatePresence>
        {mods.clientOnly.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <Card className="border-[#2a2a2a] bg-[#151515]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Monitor className="w-5 h-5 text-[#f1c40f]" />
                    推荐客户端模组
                    <Badge variant="secondary" className="bg-[#f1c40f]/20 text-[#f1c40f] border-0">
                      {mods.clientOnly.length}
                    </Badge>
                    <Star className="w-4 h-4 text-[#f1c40f] fill-[#f1c40f]" />
                  </CardTitle>
                  {/* 批量下载推荐客户端模组 */}
                  <motion.div whileTap={{ scale: 0.96 }}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        setBatchDownloadingClient(true);
                        await downloadAllClientMods();
                        setBatchDownloadingClient(false);
                      }}
                      disabled={batchDownloadingClient}
                      className="border-[#f1c40f]/50 text-[#f1c40f] hover:text-[#f1c40f] hover:bg-[#f1c40f]/10 hover:border-[#f1c40f] text-xs h-8"
                    >
                      {batchDownloadingClient ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, ease: 'linear', repeat: Infinity }}
                          className="mr-1"
                        >
                          <Loader2 className="w-3 h-3" />
                        </motion.div>
                      ) : (
                        <Download className="w-3 h-3 mr-1" />
                      )}
                      下载全部
                    </Button>
                  </motion.div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#707070] mb-4">
                  以下模组为管理员推荐的客户端可选模组：
                </p>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3 pr-3">
                    <motion.div
                      className="space-y-3"
                      variants={staggerContainer}
                      initial="hidden"
                      animate="visible"
                    >
                    {mods.clientOnly.map((mod) => (
                      <motion.div
                        key={mod.id}
                        variants={listItem}
                        whileHover={{ x: 4, backgroundColor: 'rgba(31, 31, 31, 1)' }}
                        className="flex items-center gap-3 p-3 rounded-lg bg-[#1a1a1a] cursor-default min-w-0"
                      >
                        {/* 图标 */}
                        <div className="w-12 h-12 rounded-lg bg-[#262626] flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {mod.iconUrl ? (
                            <img
                              src={mod.iconUrl}
                              alt={mod.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-6 h-6 text-[#a0a0a0]" />
                          )}
                        </div>

                        {/* 信息 */}
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <h3 className="font-medium text-white truncate">{mod.name}</h3>
                          <p className="text-sm text-[#a0a0a0] truncate">
                            {mod.description || mod.filename}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-xs border-[#2a2a2a] text-[#a0a0a0] shrink-0">
                              v{mod.versionNumber || 'unknown'}
                            </Badge>
                            <Badge className="text-xs bg-[#f1c40f]/20 text-[#f1c40f] border-0 shrink-0">
                              可选
                            </Badge>
                          </div>
                        </div>

                        {/* 下载按钮 */}
                        <motion.div whileTap={{ scale: 0.92 }}>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadMod(mod.id, mod.filename)}
                            disabled={downloading === mod.id}
                            className="border-[#2a2a2a] hover:border-[#f1c40f] hover:text-[#f1c40f] flex-shrink-0"
                          >
                            {downloading === mod.id ? (
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, ease: 'linear', repeat: Infinity }}
                              >
                                <Loader2 className="w-4 h-4" />
                              </motion.div>
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </Button>
                        </motion.div>
                      </motion.div>
                    ))}
                    </motion.div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 服务端模组信息 */}
      <AnimatePresence>
        {config.showServerOnlyMods && mods.serverOnly.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <Card className="border-[#2a2a2a] bg-[#151515]/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#a0a0a0]">
                  <Server className="w-5 h-5" />
                  纯服务端模组
                  <Badge variant="secondary" className="bg-[#1b8fff]/20 text-[#1b8fff] border-0">
                    {mods.serverOnly.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#707070]">
                  以下模组仅在服务端运行，无需客户端安装：
                </p>
                <motion.div 
                  className="flex flex-wrap gap-2 mt-3"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                >
                  {mods.serverOnly.map((mod) => (
                    <motion.div
                      key={mod.id}
                      variants={listItem}
                      whileHover={{ scale: 1.05 }}
                    >
                      <Badge
                        variant="outline"
                        className="border-[#2a2a2a] text-[#707070]"
                      >
                        {mod.name}
                      </Badge>
                    </motion.div>
                  ))}
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
