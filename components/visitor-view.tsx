'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Download, Package, Users, Server, Loader2 } from 'lucide-react';

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
}

interface CategorizedMods {
  both: Mod[];
  serverOnly: Mod[];
  clientOnly: Mod[];
}

interface Config {
  showServerOnlyMods: boolean;
}

export function VisitorView() {
  const [mods, setMods] = useState<CategorizedMods>({ both: [], serverOnly: [], clientOnly: [] });
  const [config, setConfig] = useState<Config>({ showServerOnlyMods: true });
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    fetchMods();
  }, []);

  const fetchMods = async () => {
    try {
      const res = await fetch('/api/mods');
      const data = await res.json();
      // 过滤掉禁用的模组（只显示启用的）
      const enabledMods = {
        both: data.categorized.both.filter((m: Mod) => m.enabled !== false),
        serverOnly: data.categorized.serverOnly.filter((m: Mod) => m.enabled !== false),
        clientOnly: data.categorized.clientOnly.filter((m: Mod) => m.enabled !== false),
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
    for (const mod of mods.both) {
      await downloadMod(mod.id, mod.filename);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#00d17a]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 欢迎信息 */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-white">必需模组下载</h1>
        <p className="text-[#a0a0a0]">
          以下是需要在客户端安装的双端模组
        </p>
      </div>

      {/* 批量下载按钮 */}
      {mods.both.length > 0 && (
        <div className="flex justify-center">
          <Button
            onClick={downloadAll}
            className="bg-[#00d17a] hover:bg-[#00b86b] text-black font-semibold px-6"
          >
            <Download className="w-4 h-4 mr-2" />
            下载全部 ({mods.both.length} 个)
          </Button>
        </div>
      )}

      {/* 双端模组列表 */}
      <Card className="border-[#2a2a2a] bg-[#151515] animate-fade-in-up">
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
            <div className="text-center py-8 text-[#a0a0a0]">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>暂无必需模组</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {mods.both.map((mod, index) => (
                  <div
                    key={mod.id}
                    className="flex items-center gap-4 p-3 rounded-lg bg-[#1a1a1a] hover:bg-[#1f1f1f] transition-all duration-250 ease-standard hover:translate-x-1"
                    style={{ animationDelay: `${index * 0.05}s` }}
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
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white truncate">{mod.name}</h3>
                      <p className="text-sm text-[#a0a0a0] truncate">
                        {mod.description || mod.filename}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs border-[#2a2a2a] text-[#a0a0a0]">
                          v{mod.versionNumber || 'unknown'}
                        </Badge>
                        <Badge className="text-xs bg-[#00d17a]/20 text-[#00d17a] border-0">
                          双端
                        </Badge>
                      </div>
                    </div>

                    {/* 下载按钮 */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadMod(mod.id, mod.filename)}
                      disabled={downloading === mod.id}
                      className="border-[#2a2a2a] hover:border-[#00d17a] hover:text-[#00d17a] flex-shrink-0"
                    >
                      {downloading === mod.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* 服务端模组信息 */}
      {config.showServerOnlyMods && mods.serverOnly.length > 0 && (
        <Card className="border-[#2a2a2a] bg-[#151515]/50 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
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
            <div className="flex flex-wrap gap-2 mt-3">
              {mods.serverOnly.map((mod) => (
                <Badge
                  key={mod.id}
                  variant="outline"
                  className="border-[#2a2a2a] text-[#707070]"
                >
                  {mod.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
