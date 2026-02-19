'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Download, Package, Check, Loader2, ExternalLink, Plus, ShieldCheck, Heart, Calendar, User, Info, Github, MessageCircle, Book, Tag, Layers, Hash, Code, Globe, Award } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDownloadQueue } from '@/lib/download-queue';
import { DependencyAnalyzer } from '@/components/dependency-analyzer';

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
  downloads: number;
  follows: number;
  date_created: string;
  date_modified: string;
  author: string;
  latest_version: string;
  license: string;
  project_type: string;
  gallery: string[];
  source_url?: string;
  issues_url?: string;
  wiki_url?: string;
  discord_url?: string;
  donation_urls?: { id: string; platform: string; url: string }[];
  color?: number;
  thread_id?: string;
  monetization_status?: string;
  organization?: string;
}

interface Version {
  id: string;
  version_number: string;
  client_support: string;
  server_support: string;
  files: { filename: string; primary: boolean }[];
  loaders: string[];
  game_versions: string[];
  date_published?: string;
  changelog?: string;
  dependencies?: Dependency[];
}

interface Dependency {
  version_id: string | null;
  project_id: string;
  dependency_type: 'required' | 'optional' | 'incompatible' | 'embedded';
  file_name?: string;
}

interface ServerConfig {
  minecraftVersion: string;
  loader: string;
}

// 格式化数字（如：1.2k, 3.4M）
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
}

// 格式化日期为相对时间
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffYears > 0) return `${diffYears}年前`;
  if (diffMonths > 0) return `${diffMonths}个月前`;
  if (diffDays > 0) return `${diffDays}天前`;
  if (diffHours > 0) return `${diffHours}小时前`;
  if (diffMins > 0) return `${diffMins}分钟前`;
  return '刚刚';
}

export function ModSearch() {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedMod, setSelectedMod] = useState<SearchResult | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [, setAddedToQueue] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);
  const [analyzerOpen, setAnalyzerOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const { addTask, tasks } = useDownloadQueue();
  const [installedMods, setInstalledMods] = useState<Map<string, string>>(new Map()); // versionId -> modName
  const [detailMod, setDetailMod] = useState<SearchResult | null>(null); // 详情对话框

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
    } catch {
      setError('搜索出错');
    } finally {
      setSearching(false);
    }
  };

  // 使用 ref 来跟踪最新的请求，避免竞争条件
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const fetchVersionsWithRetry = async (
    projectId: string, 
    abortController: AbortController,
    maxRetries = 3
  ): Promise<{ success: boolean; versions?: Version[]; serverConfig?: ServerConfig; error?: string }> => {
    let lastError = '';
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`[Frontend] Fetching versions for ${projectId}, attempt ${attempt + 1}/${maxRetries}`);
        
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId }),
          signal: abortController.signal,
        });
        
        // 如果请求被中止，立即返回
        if (abortController.signal.aborted) {
          console.log('[Frontend] Request aborted');
          return { success: false };
        }
        
        const data = await res.json().catch(() => ({}));
        
        if (res.ok) {
          console.log(`[Frontend] Successfully fetched ${data.versions?.length || 0} versions`);
          return { 
            success: true, 
            versions: data.versions || [],
            serverConfig: data.serverConfig
          };
        }
        
        // 记录错误信息
        lastError = data.error || `HTTP ${res.status}`;
        console.error(`[Frontend] Attempt ${attempt + 1} failed:`, res.status, data);
        
        // 如果是可重试的错误且不是最后一次尝试，则等待后重试
        if ((res.status === 502 || res.status === 429 || data.retryable) && attempt < maxRetries - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 3000); // 指数退避，最多3秒
          console.log(`[Frontend] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // 不可重试的错误，直接返回
        return { success: false, error: lastError };
        
      } catch (error) {
        // 忽略中止错误
        if (error instanceof DOMException && error.name === 'AbortError') {
          return { success: false };
        }
        
        lastError = error instanceof Error ? error.message : '网络错误';
        console.error(`[Frontend] Attempt ${attempt + 1} error:`, error);
        
        // 网络错误也重试
        if (attempt < maxRetries - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 3000);
          console.log(`[Frontend] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    return { success: false, error: lastError || '获取版本列表失败，请重试' };
  };

  // 获取已安装的模组列表
  const fetchInstalledMods = async () => {
    try {
      const res = await fetch('/api/mods');
      if (res.ok) {
        const data = await res.json();
        const modMap = new Map<string, string>();
        data.mods?.forEach((mod: { versionId: string; name: string }) => {
          modMap.set(mod.versionId, mod.name);
        });
        setInstalledMods(modMap);
      }
    } catch (error) {
      console.error('Failed to fetch installed mods:', error);
    }
  };

  const showVersions = async (mod: SearchResult) => {
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // 创建新的 AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    setSelectedMod(mod);
    setLoadingVersions(true);
    setVersions([]);
    setAddedToQueue(null);
    setError('');
    
    // 同时获取已安装的模组列表
    await fetchInstalledMods();
    
    const result = await fetchVersionsWithRetry(mod.project_id, abortController, 3);
    
    // 只有最新的请求才更新状态
    if (abortControllerRef.current === abortController) {
      if (result.success && result.versions) {
        setVersions(result.versions);
        setServerConfig(result.serverConfig || null);
      } else if (result.error) {
        setError(result.error);
      }
      setLoadingVersions(false);
    }
  };

  const addToDownloadQueue = (version: Version) => {
    if (!selectedMod) return;

    // 检查是否已在队列中
    const existingTask = tasks.find(
      (t) => t.modId === selectedMod.project_id && t.versionId === version.id
    );
    if (existingTask) {
      setError('该版本已在下载队列中');
      return;
    }

    const primaryFile = version.files.find((f) => f.primary) || version.files[0];
    
    addTask({
      modId: selectedMod.project_id,
      modName: selectedMod.title,
      versionId: version.id,
      versionNumber: version.version_number,
      filename: primaryFile?.filename || `${selectedMod.slug}-${version.version_number}.jar`,
      iconUrl: selectedMod.icon_url,
    });

    setAddedToQueue(version.id);
    setTimeout(() => {
      setSelectedMod(null);
      setAddedToQueue(null);
    }, 1000);
  };

  const getEnvironmentBadge = (client: string, server: string) => {
    // 基于 API 数据的稳定判断
    if (client === 'required' && server === 'required') {
      return <Badge className="bg-[#00d17a]/20 text-[#00d17a] border-0">双端</Badge>;
    } else if (server === 'required' && client !== 'required') {
      return <Badge className="bg-[#1b8fff]/20 text-[#1b8fff] border-0">服务端</Badge>;
    } else if (client === 'required' && server !== 'required') {
      return <Badge className="bg-[#9b59b6]/20 text-[#9b59b6] border-0">客户端</Badge>;
    }
    return null;
  };

  // 检查版本是否与服务器配置兼容
  const checkVersionCompatibility = (version: Version): {
    isCompatible: boolean;
    gameVersionMatch: boolean;
    loaderMatch: boolean;
  } => {
    if (!serverConfig) {
      return { isCompatible: false, gameVersionMatch: false, loaderMatch: false };
    }

    const gameVersionMatch = version.game_versions?.includes(serverConfig.minecraftVersion) ?? false;
    const loaderMatch = version.loaders?.includes(serverConfig.loader) ?? false;
    
    return {
      isCompatible: gameVersionMatch && loaderMatch,
      gameVersionMatch,
      loaderMatch
    };
  };

  const openDependencyAnalyzer = (version: Version) => {
    setSelectedVersion(version);
    setAnalyzerOpen(true);
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
                      {/* 统计信息 */}
                      <div className="flex items-center gap-4 mt-2 text-xs text-[#707070]">
                        <span className="flex items-center gap-1" title="总下载量">
                          <Download className="w-3.5 h-3.5" />
                          {formatNumber(mod.downloads)}
                        </span>
                        <span className="flex items-center gap-1" title="关注数">
                          <Heart className="w-3.5 h-3.5" />
                          {formatNumber(mod.follows)}
                        </span>
                        {mod.author && (
                          <span className="flex items-center gap-1" title="作者">
                            <User className="w-3.5 h-3.5" />
                            {mod.author}
                          </span>
                        )}
                        <span className="flex items-center gap-1" title="最后更新">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(mod.date_modified)}
                        </span>
                      </div>
                      {/* 分类标签 */}
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
                        {mod.categories.length > 3 && (
                          <Badge
                            variant="outline"
                            className="text-xs border-[#2a2a2a] text-[#505050]"
                          >
                            +{mod.categories.length - 3}
                          </Badge>
                        )}
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
                        onClick={() => setDetailMod(mod)}
                        className="border-[#2a2a2a] text-[#a0a0a0] hover:text-white"
                      >
                        <Info className="w-3 h-3 mr-1" />
                        详情
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

                {versions.map((version) => {
                  const compatibility = checkVersionCompatibility(version);
                  return (
                    <div
                      key={version.id}
                      className={`
                        flex items-center justify-between p-3 rounded-lg border transition-all
                        ${compatibility.isCompatible 
                          ? 'bg-[#00d17a]/10 border-[#00d17a]/50 shadow-[0_0_10px_rgba(0,209,122,0.1)]' 
                          : 'bg-[#151515] border-[#2a2a2a]'
                        }
                      `}
                    >
                      <div className="flex-1 min-w-0 mr-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`
                            font-medium
                            ${compatibility.isCompatible ? 'text-[#00d17a]' : 'text-white'}
                          `}>
                            {version.version_number}
                          </span>
                          {getEnvironmentBadge(version.client_support, version.server_support)}
                          {compatibility.isCompatible && (
                            <Badge className="bg-[#00d17a] text-black border-0 text-[10px] h-5 px-1.5">
                              <Check className="w-3 h-3 mr-0.5" />
                              推荐
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-[#707070] mt-1 truncate">
                          {version.files.find(f => f.primary)?.filename || version.files[0]?.filename}
                        </p>
                        {/* 加载器和游戏版本元数据 - 带兼容性高亮 */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {version.loaders?.map((loader) => {
                            const isMatchedLoader = serverConfig?.loader === loader;
                            return (
                              <Badge
                                key={loader}
                                variant="outline"
                                className={`
                                  text-[10px] h-5 px-1.5
                                  ${isMatchedLoader 
                                    ? 'border-[#00d17a] text-[#00d17a] bg-[#00d17a]/10' 
                                    : 'border-[#3a3a3a] text-[#606060]'
                                  }
                                `}
                              >
                                {loader}
                                {isMatchedLoader && <Check className="w-3 h-3 ml-0.5" />}
                              </Badge>
                            );
                          })}
                          {version.game_versions?.slice(0, 5).map((ver) => {
                            const isMatchedVersion = serverConfig?.minecraftVersion === ver;
                            return (
                              <Badge
                                key={ver}
                                variant="outline"
                                className={`
                                  text-[10px] h-5 px-1.5
                                  ${isMatchedVersion 
                                    ? 'border-[#00d17a] text-[#00d17a] bg-[#00d17a]/10' 
                                    : 'border-[#3a3a3a] text-[#606060]'
                                  }
                                `}
                              >
                                {ver}
                                {isMatchedVersion && <Check className="w-3 h-3 ml-0.5" />}
                              </Badge>
                            );
                          })}
                          {version.game_versions?.length > 5 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] h-5 px-1.5 border-[#2a2a2a] text-[#505050]"
                            >
                              +{version.game_versions.length - 5}
                            </Badge>
                          )}
                          {/* 不兼容提示标签 */}
                          {!compatibility.isCompatible && serverConfig && (
                            <>
                              {!compatibility.gameVersionMatch && (
                                <Badge className="text-[10px] h-5 px-1.5 bg-[#e74c3c]/20 text-[#e74c3c] border-0">
                                  不支持 {serverConfig.minecraftVersion}
                                </Badge>
                              )}
                              {!compatibility.loaderMatch && (
                                <Badge className="text-[10px] h-5 px-1.5 bg-[#e74c3c]/20 text-[#e74c3c] border-0">
                                  不支持 {serverConfig.loader}
                                </Badge>
                              )}
                            </>
                          )}
                        </div>

                      </div>
                      {installedMods.has(version.id) ? (
                        <Button
                          size="sm"
                          disabled
                          className="bg-[#2a2a2a] text-[#707070] border border-[#3a3a3a] cursor-not-allowed"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          已添加
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => openDependencyAnalyzer(version)}
                          className={`
                            ${compatibility.isCompatible
                              ? 'bg-[#00d17a] hover:bg-[#00c06e] text-black'
                              : 'bg-[#2a2a2a] hover:bg-[#333] text-white border border-[#3a3a3a]'
                            }
                          `}
                        >
                          <ShieldCheck className="w-4 h-4 mr-1" />
                          {compatibility.isCompatible ? '检查' : '仍检查'}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* 详情展示对话框 */}
      <Dialog open={!!detailMod} onOpenChange={() => setDetailMod(null)}>
        <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a] max-w-2xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-3">
              {detailMod?.icon_url && (
                <img
                  src={detailMod.icon_url}
                  alt=""
                  className="w-10 h-10 rounded-lg"
                />
              )}
              <div>
                <div className="flex items-center gap-2">
                  {detailMod?.title}
                  {detailMod && getEnvironmentBadge(detailMod.client_side, detailMod.server_side)}
                </div>
                <p className="text-xs text-[#707070] font-normal">{detailMod?.slug}</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[calc(85vh-120px)]">
            <div className="space-y-6 pr-4">
              {/* 描述 */}
              <div>
                <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                  <Info className="w-4 h-4 text-[#00d17a]" />
                  描述
                </h4>
                <p className="text-sm text-[#a0a0a0] leading-relaxed">
                  {detailMod?.description}
                </p>
              </div>

              {/* 统计信息卡片 */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-[#151515] border border-[#2a2a2a] rounded-lg p-3 text-center">
                  <Download className="w-5 h-5 text-[#00d17a] mx-auto mb-1" />
                  <p className="text-lg font-semibold text-white">{detailMod ? formatNumber(detailMod.downloads) : '-'}</p>
                  <p className="text-xs text-[#707070]">总下载量</p>
                </div>
                <div className="bg-[#151515] border border-[#2a2a2a] rounded-lg p-3 text-center">
                  <Heart className="w-5 h-5 text-[#e74c3c] mx-auto mb-1" />
                  <p className="text-lg font-semibold text-white">{detailMod ? formatNumber(detailMod.follows) : '-'}</p>
                  <p className="text-xs text-[#707070]">关注数</p>
                </div>
                <div className="bg-[#151515] border border-[#2a2a2a] rounded-lg p-3 text-center">
                  <Layers className="w-5 h-5 text-[#1b8fff] mx-auto mb-1" />
                  <p className="text-lg font-semibold text-white">{detailMod ? formatNumber(detailMod.versions.length) : '-'}</p>
                  <p className="text-xs text-[#707070]">版本数</p>
                </div>
                <div className="bg-[#151515] border border-[#2a2a2a] rounded-lg p-3 text-center">
                  <Tag className="w-5 h-5 text-[#9b59b6] mx-auto mb-1" />
                  <p className="text-lg font-semibold text-white">{detailMod ? detailMod.categories.length : '-'}</p>
                  <p className="text-xs text-[#707070]">分类数</p>
                </div>
              </div>

              {/* 基本信息 */}
              <div>
                <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <Hash className="w-4 h-4 text-[#00d17a]" />
                  基本信息
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center justify-between bg-[#151515] border border-[#2a2a2a] rounded-lg p-3">
                    <span className="text-[#707070] flex items-center gap-2">
                      <User className="w-4 h-4" />
                      作者
                    </span>
                    <span className="text-white">{detailMod?.author || '未知'}</span>
                  </div>
                  <div className="flex items-center justify-between bg-[#151515] border border-[#2a2a2a] rounded-lg p-3">
                    <span className="text-[#707070] flex items-center gap-2">
                      <Award className="w-4 h-4" />
                      许可证
                    </span>
                    <span className="text-white">{detailMod?.license || '未知'}</span>
                  </div>
                  <div className="flex items-center justify-between bg-[#151515] border border-[#2a2a2a] rounded-lg p-3">
                    <span className="text-[#707070] flex items-center gap-2">
                      <Code className="w-4 h-4" />
                      最新版本
                    </span>
                    <span className="text-[#00d17a] font-mono">{detailMod?.latest_version || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between bg-[#151515] border border-[#2a2a2a] rounded-lg p-3">
                    <span className="text-[#707070] flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      项目类型
                    </span>
                    <span className="text-white capitalize">{detailMod?.project_type || 'mod'}</span>
                  </div>
                </div>
              </div>

              {/* 时间信息 */}
              <div>
                <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#00d17a]" />
                  时间信息
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between bg-[#151515] border border-[#2a2a2a] rounded-lg p-3">
                    <span className="text-[#707070]">创建时间</span>
                    <span className="text-white">
                      {detailMod?.date_created ? new Date(detailMod.date_created).toLocaleString('zh-CN') : '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-[#151515] border border-[#2a2a2a] rounded-lg p-3">
                    <span className="text-[#707070]">最后更新</span>
                    <span className="text-white">
                      {detailMod?.date_modified ? new Date(detailMod.date_modified).toLocaleString('zh-CN') : '-'}
                      {detailMod && (
                        <span className="text-[#707070] ml-2">({formatDate(detailMod.date_modified)})</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* 分类 */}
              {detailMod?.categories && detailMod.categories.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-[#00d17a]" />
                    分类
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {detailMod.categories.map((cat) => (
                      <Badge
                        key={cat}
                        variant="outline"
                        className="border-[#2a2a2a] text-[#a0a0a0] capitalize"
                      >
                        {cat}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 支持的游戏版本 */}
              {detailMod?.versions && detailMod.versions.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#00d17a]" />
                    支持的游戏版本
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {detailMod.versions.slice(0, 15).map((ver) => (
                      <Badge
                        key={ver}
                        variant="outline"
                        className="border-[#2a2a2a] text-[#707070] font-mono text-xs"
                      >
                        {ver}
                      </Badge>
                    ))}
                    {detailMod.versions.length > 15 && (
                      <Badge variant="outline" className="border-[#2a2a2a] text-[#505050]">
                        +{detailMod.versions.length - 15} 更多
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* 外部链接 */}
              <div>
                <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-[#00d17a]" />
                  外部链接
                </h4>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    asChild
                    className="border-[#2a2a2a] text-[#a0a0a0] hover:text-white"
                  >
                    <a
                      href={`https://modrinth.com/${detailMod?.project_type || 'mod'}/${detailMod?.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Globe className="w-4 h-4 mr-1" />
                      Modrinth 页面
                    </a>
                  </Button>
                  {detailMod?.source_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                      className="border-[#2a2a2a] text-[#a0a0a0] hover:text-white"
                    >
                      <a href={detailMod.source_url} target="_blank" rel="noopener noreferrer">
                        <Github className="w-4 h-4 mr-1" />
                        源代码
                      </a>
                    </Button>
                  )}
                  {detailMod?.issues_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                      className="border-[#2a2a2a] text-[#a0a0a0] hover:text-white"
                    >
                      <a href={detailMod.issues_url} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="w-4 h-4 mr-1" />
                        问题反馈
                      </a>
                    </Button>
                  )}
                  {detailMod?.wiki_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                      className="border-[#2a2a2a] text-[#a0a0a0] hover:text-white"
                    >
                      <a href={detailMod.wiki_url} target="_blank" rel="noopener noreferrer">
                        <Book className="w-4 h-4 mr-1" />
                        Wiki
                      </a>
                    </Button>
                  )}
                  {detailMod?.discord_url && (
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                      className="border-[#2a2a2a] text-[#a0a0a0] hover:text-white"
                    >
                      <a href={detailMod.discord_url} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="w-4 h-4 mr-1" />
                        Discord
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              {/* 捐赠链接 */}
              {detailMod?.donation_urls && detailMod.donation_urls.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                    <Heart className="w-4 h-4 text-[#e74c3c]" />
                    支持作者
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {detailMod.donation_urls.map((donation) => (
                      <Button
                        key={donation.id}
                        size="sm"
                        variant="outline"
                        asChild
                        className="border-[#e74c3c]/30 text-[#e74c3c] hover:bg-[#e74c3c]/10"
                      >
                        <a href={donation.url} target="_blank" rel="noopener noreferrer">
                          <Heart className="w-4 h-4 mr-1" />
                          {donation.platform}
                        </a>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* 画廊图片 */}
              {detailMod?.gallery && detailMod.gallery.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#00d17a]" />
                    画廊
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {detailMod.gallery.slice(0, 4).map((img, idx) => (
                      <a key={idx} href={img} target="_blank" rel="noopener noreferrer">
                        <img
                          src={img}
                          alt={`画廊图片 ${idx + 1}`}
                          className="w-full h-24 object-cover rounded-lg border border-[#2a2a2a] hover:border-[#00d17a] transition-colors"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* 技术信息 */}
              <div>
                <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <Code className="w-4 h-4 text-[#00d17a]" />
                  技术信息
                </h4>
                <div className="bg-[#151515] border border-[#2a2a2a] rounded-lg p-3 space-y-1 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-[#505050]">Project ID:</span>
                    <span className="text-[#707070]">{detailMod?.project_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#505050]">Slug:</span>
                    <span className="text-[#707070]">{detailMod?.slug}</span>
                  </div>
                  {detailMod?.organization && (
                    <div className="flex justify-between">
                      <span className="text-[#505050]">Organization:</span>
                      <span className="text-[#707070]">{detailMod.organization}</span>
                    </div>
                  )}
                  {detailMod?.monetization_status && (
                    <div className="flex justify-between">
                      <span className="text-[#505050]">Monetization:</span>
                      <span className="text-[#707070]">{detailMod.monetization_status}</span>
                    </div>
                  )}
                  {detailMod?.color && (
                    <div className="flex justify-between items-center">
                      <span className="text-[#505050]">Theme Color:</span>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded border border-[#2a2a2a]"
                          style={{ backgroundColor: `#${detailMod.color.toString(16).padStart(6, '0')}` }}
                        />
                        <span className="text-[#707070]">#{detailMod.color.toString(16).padStart(6, '0')}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* 依赖分析器对话框 */}
      <DependencyAnalyzer
        isOpen={analyzerOpen}
        onClose={() => setAnalyzerOpen(false)}
        version={selectedVersion}
        selectedMod={selectedMod}
        serverConfig={serverConfig}
        onAdd={() => {
          if (selectedVersion && selectedMod) {
            addToDownloadQueue(selectedVersion);
          }
          setAnalyzerOpen(false);
        }}
      />
    </div>
  );
}
