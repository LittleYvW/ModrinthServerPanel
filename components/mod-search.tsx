'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Download, Package, Check, Loader2, ExternalLink, Plus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SearchResult {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  icon_url: string;
  client_side: string;
  server_side: string;
  categories: string[];
  versions: string[];
}

interface Version {
  id: string;
  version_number: string;
  client_support: string;
  server_support: string;
  files: { filename: string; primary: boolean }[];
  loaders: string[];
  game_versions: string[];
}

export function ModSearch() {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedMod, setSelectedMod] = useState<SearchResult | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [installed, setInstalled] = useState<string | null>(null);
  const [error, setError] = useState('');

  const searchMods = async () => {
    if (!query.trim()) return;

    setSearching(true);
    setError('');
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.hits || []);
      } else {
        setError('搜索失败');
      }
    } catch (error) {
      setError('搜索出错');
    } finally {
      setSearching(false);
    }
  };

  const showVersions = async (mod: SearchResult) => {
    setSelectedMod(mod);
    setLoadingVersions(true);
    setVersions([]);
    setInstalled(null);
    
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: mod.project_id }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions || []);
      }
    } catch (error) {
      console.error('Failed to fetch versions:', error);
    } finally {
      setLoadingVersions(false);
    }
  };

  const installMod = async (versionId: string) => {
    if (!selectedMod) return;

    setInstalling(versionId);
    setError('');
    
    try {
      const res = await fetch('/api/mods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedMod.project_id,
          versionId: versionId,
        }),
      });

      if (res.ok) {
        setInstalled(versionId);
        setTimeout(() => {
          setSelectedMod(null);
          setInstalled(null);
        }, 1500);
      } else {
        const data = await res.json();
        setError(data.error || '安装失败');
      }
    } catch (error) {
      setError('安装出错');
    } finally {
      setInstalling(null);
    }
  };

  const getEnvironmentBadge = (client: string, server: string) => {
    // 优先级: 服务端 > 客户端 > 双端
    if (server === 'required') {
      return <Badge className="bg-[#1b8fff]/20 text-[#1b8fff] border-0">服务端</Badge>;
    } else if (client === 'required') {
      return <Badge className="bg-[#9b59b6]/20 text-[#9b59b6] border-0">客户端</Badge>;
    }
    return <Badge variant="outline" className="border-[#2a2a2a] text-[#707070]">可选</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* 搜索框 */}
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && searchMods()}
          placeholder="搜索 Modrinth 模组..."
          className="flex-1 bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder:text-[#505050] focus:border-[#00d17a] focus:ring-[#00d17a]"
        />
        <Button
          onClick={searchMods}
          disabled={searching || !query.trim()}
          className="bg-[#00d17a] hover:bg-[#00b86b] text-black"
        >
          {searching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </Button>
      </div>

      {error && (
        <Alert className="bg-[#e74c3c]/10 border-[#e74c3c]/30 text-[#e74c3c]">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 搜索结果 */}
      {results.length > 0 && (
        <ScrollArea className="h-[500px]">
          <div className="space-y-3">
            {results.map((mod) => (
              <Card
                key={mod.project_id}
                className="border-[#2a2a2a] bg-[#151515] hover:border-[#00d17a]/50 transition-colors"
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* 图标 */}
                    <div className="w-14 h-14 rounded-lg bg-[#1a1a1a] flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {mod.icon_url ? (
                        <img
                          src={mod.icon_url}
                          alt={mod.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="w-7 h-7 text-[#707070]" />
                      )}
                    </div>

                    {/* 信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-white">{mod.title}</h3>
                        {getEnvironmentBadge(mod.client_side, mod.server_side)}
                      </div>
                      <p className="text-sm text-[#a0a0a0] mt-1 line-clamp-2">
                        {mod.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {mod.categories.slice(0, 3).map((cat) => (
                          <Badge
                            key={cat}
                            variant="outline"
                            className="text-xs border-[#2a2a2a] text-[#707070]"
                          >
                            {cat}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        onClick={() => showVersions(mod)}
                        className="bg-[#00d17a] hover:bg-[#00b86b] text-black"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        添加
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="border-[#2a2a2a] text-[#a0a0a0] hover:text-white"
                      >
                        <a
                          href={`https://modrinth.com/mod/${mod.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          查看
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* 版本选择对话框 */}
      <Dialog open={!!selectedMod} onOpenChange={() => setSelectedMod(null)}>
        <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a] max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              {selectedMod?.icon_url && (
                <img
                  src={selectedMod.icon_url}
                  alt=""
                  className="w-6 h-6 rounded"
                />
              )}
              选择版本 - {selectedMod?.title}
            </DialogTitle>
          </DialogHeader>

          {loadingVersions ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#00d17a]" />
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 text-[#707070]">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>没有找到兼容的版本</p>
              <p className="text-xs mt-1">请检查服务端配置是否正确</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-[#151515] border border-[#2a2a2a]"
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white">
                          {version.version_number}
                        </span>
                        {getEnvironmentBadge(version.client_support, version.server_support)}
                      </div>
                      <p className="text-xs text-[#707070] mt-1 truncate">
                        {version.files.find(f => f.primary)?.filename || version.files[0]?.filename}
                      </p>
                      {/* 加载器和游戏版本元数据 */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {version.loaders?.map((loader) => (
                          <Badge
                            key={loader}
                            variant="outline"
                            className="text-[10px] h-5 px-1.5 border-[#00d17a]/30 text-[#00d17a] bg-[#00d17a]/5"
                          >
                            {loader}
                          </Badge>
                        ))}
                        {version.game_versions?.slice(0, 3).map((ver) => (
                          <Badge
                            key={ver}
                            variant="outline"
                            className="text-[10px] h-5 px-1.5 border-[#2a2a2a] text-[#707070]"
                          >
                            {ver}
                          </Badge>
                        ))}
                        {version.game_versions?.length > 3 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] h-5 px-1.5 border-[#2a2a2a] text-[#505050]"
                          >
                            +{version.game_versions.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => installMod(version.id)}
                      disabled={installing === version.id || installed === version.id}
                      className={`
                        ${installed === version.id 
                          ? 'bg-[#00d17a] text-black' 
                          : 'bg-[#00d17a] hover:bg-[#00b86b] text-black'
                        }
                      `}
                    >
                      {installing === version.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : installed === version.id ? (
                        <>
                          <Check className="w-4 h-4 mr-1" />
                          已安装
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-1" />
                          安装
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
