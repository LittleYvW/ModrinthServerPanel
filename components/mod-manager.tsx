'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Package, Trash2, Users, Server, Monitor, RefreshCw, Loader2, ExternalLink, Settings2, Check, Power, PowerOff, Star, StarOff, Download, ArrowUpCircle, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  fadeIn, 
  staggerContainer, 
  listItem, 
  springScale,
  cardHover,
  dropdownMenu 
} from '@/lib/animations';
import { useDownloadQueue } from '@/lib/download-queue';
import { DependencyAnalyzer } from '@/components/dependency-analyzer';

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
  installedAt: string;
  enabled?: boolean;
  recommended?: boolean;
}

interface CategorizedMods {
  both: Mod[];
  serverOnly: Mod[];
  clientOnly: Mod[];
}

interface UpdateInfo {
  modId: string;
  name: string;
  slug: string;
  currentVersion: string;
  targetVersion: string;
  targetVersionId: string | null;
  hasUpdate: boolean;
  releaseDate: string;
  changelog?: string;
  newCategory?: string;
  error?: boolean;
}

interface VersionInfo {
  id: string;
  version_number: string;
  client_support: string;
  server_support: string;
  files: { filename: string; primary: boolean }[];
  loaders: string[];
  game_versions: string[];
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

interface UpdateSummary {
  total: number;
  hasUpdates: number;
  upToDate: number;
  errors: number;
}

// ===== 纯工具函数（移到外部避免重新创建）=====

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'both':
      return <Users className="w-4 h-4" />;
    case 'server-only':
      return <Server className="w-4 h-4" />;
    case 'client-only':
      return <Monitor className="w-4 h-4" />;
    default:
      return <Package className="w-4 h-4" />;
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'both':
      return 'bg-[#00d17a]/20 text-[#00d17a]';
    case 'server-only':
      return 'bg-[#1b8fff]/20 text-[#1b8fff]';
    case 'client-only':
      return 'bg-[#9b59b6]/20 text-[#9b59b6]';
    default:
      return 'bg-[#2a2a2a] text-[#a0a0a0]';
  }
};

const getCategoryLabel = (category: string) => {
  switch (category) {
    case 'both':
      return '双端';
    case 'server-only':
      return '仅服务端';
    case 'client-only':
      return '仅客户端';
    default:
      return '未知';
  }
};

const isModDisabled = (mod: Mod) => {
  if (mod.category === 'client-only') return false;
  return mod.enabled === false;
};

// ===== 子组件（移到外部避免重新创建）=====

interface CategorySelectorProps {
  mod: Mod;
  updatingCategory: string | null;
  updateModCategory: (id: string, category: 'both' | 'server-only' | 'client-only') => void;
}

const CategorySelector = ({ mod, updatingCategory, updateModCategory }: CategorySelectorProps) => {
  const categories: { value: 'both' | 'server-only' | 'client-only'; label: string; icon: React.ReactNode }[] = [
    { value: 'both', label: '双端', icon: <Users className="w-3 h-3" /> },
    { value: 'server-only', label: '仅服务端', icon: <Server className="w-3 h-3" /> },
    { value: 'client-only', label: '仅客户端', icon: <Monitor className="w-3 h-3" /> },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          disabled={updatingCategory === mod.id}
          className={cn(
            'h-7 px-2 text-xs gap-1',
            getCategoryColor(mod.category)
          )}
        >
          {updatingCategory === mod.id ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, ease: 'linear', repeat: Infinity }}
            >
              <Loader2 className="w-3 h-3" />
            </motion.div>
          ) : (
            <>
              {getCategoryIcon(mod.category)}
              <span>{getCategoryLabel(mod.category)}</span>
              <Settings2 className="w-3 h-3 ml-1 opacity-50" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="bg-[#1a1a1a] border-[#2a2a2a]"
        asChild
      >
        <motion.div
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={dropdownMenu}
        >
          {categories.map((cat) => (
            <DropdownMenuItem
              key={cat.value}
              onClick={() => updateModCategory(mod.id, cat.value)}
              className={cn(
                'text-sm cursor-pointer',
                mod.category === cat.value
                  ? 'bg-[#00d17a]/10 text-[#00d17a]'
                  : 'text-[#a0a0a0] hover:text-white hover:bg-[#262626]'
              )}
            >
              <div className="flex items-center gap-2">
                {cat.icon}
                <span>{cat.label}</span>
                {mod.category === cat.value && (
                  <Check className="w-3 h-3 ml-2" />
                )}
              </div>
            </DropdownMenuItem>
          ))}
        </motion.div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

interface UpdateBadgeProps {
  mod: Mod;
  updates: Map<string, UpdateInfo>;
}

const UpdateBadge = ({ mod, updates }: UpdateBadgeProps) => {
  const updateInfo = updates.get(mod.id);
  if (!updateInfo || !updateInfo.hasUpdate) return null;
  
  return (
    <Badge className="bg-[#00d17a]/20 text-[#00d17a] border-0 text-[10px] animate-pulse">
      <ArrowUpCircle className="w-3 h-3 mr-1" />
      {updateInfo.currentVersion} → {updateInfo.targetVersion}
    </Badge>
  );
};

interface ModListProps {
  mods: Mod[];
  category: string;
  showBatchDownload?: boolean;
  onBatchDownload?: () => void;
  batchDownloading?: boolean;
  animationKey: number;
  showOnlyUpdates: boolean;
  updates: Map<string, UpdateInfo>;
  deleting: string | null;
  toggling: string | null;
  downloading: string | null;
  updatingCategory: string | null;
  downloadMod: (mod: Mod) => void;
  toggleMod: (id: string) => void;
  deleteMod: (id: string) => void;
  updateModCategory: (id: string, category: 'both' | 'server-only' | 'client-only') => void;
  onUpdateMod?: (mod: Mod) => void;
  loadingUpdateVersion?: boolean;
  updateTargetMod?: Mod | null;
}

const ModList = ({ 
  mods: modList, 
  category, 
  showBatchDownload = false,
  onBatchDownload,
  batchDownloading = false,
  animationKey,
  showOnlyUpdates,
  updates,
  deleting,
  toggling,
  downloading,
  updatingCategory,
  downloadMod,
  toggleMod,
  deleteMod,
  updateModCategory,
  onUpdateMod,
  loadingUpdateVersion,
  updateTargetMod,
}: ModListProps) => {
  // 根据筛选条件过滤
  const filteredMods = showOnlyUpdates
    ? modList.filter(m => updates.has(m.id) && updates.get(m.id)?.hasUpdate)
    : modList;
  
  return (
    <Card className="border-[#2a2a2a] bg-[#151515]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base text-white">
          <div className="flex items-center gap-2">
            {getCategoryIcon(category)}
            {category === 'both' && '双端模组'}
            {category === 'server-only' && '纯服务端模组'}
            {category === 'client-only' && '纯客户端模组'}
            <Badge className={`${getCategoryColor(category)} border-0`}>
              {filteredMods.length}
              {showOnlyUpdates && ` / ${modList.length}`}
            </Badge>
          </div>
          {/* 客户端模组批量下载按钮 */}
          {showBatchDownload && onBatchDownload && !showOnlyUpdates && (
            <motion.div whileTap={{ scale: 0.96 }}>
              <Button
                variant="outline"
                size="sm"
                onClick={onBatchDownload}
                disabled={batchDownloading}
                className="border-[#9b59b6]/50 text-[#9b59b6] hover:text-[#9b59b6] hover:bg-[#9b59b6]/10 hover:border-[#9b59b6] text-xs h-7"
              >
                {batchDownloading ? (
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
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {filteredMods.length === 0 ? (
          <motion.div 
            className="text-center py-6 text-[#707070]"
            variants={springScale}
          >
            <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {showOnlyUpdates ? '没有可更新的模组' : '暂无模组'}
            </p>
          </motion.div>
        ) : (
          <ScrollArea className="h-[300px]">
            <motion.div 
              className="space-y-2"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              // 使用 key 控制：首次加载和点击刷新时触发动画，其他操作不触发
              key={`list-${animationKey}`}
            >
              {filteredMods.map((mod) => (
                <motion.div
                  key={mod.id}
                  variants={listItem}
                  whileHover={!isModDisabled(mod) ? { x: 4 } : {}}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg group relative',
                    !isModDisabled(mod)
                      ? updates.has(mod.id) && updates.get(mod.id)?.hasUpdate
                        ? 'bg-[#00d17a]/5 border border-[#00d17a]/20 hover:bg-[#00d17a]/10'
                        : 'bg-[#1a1a1a] hover:bg-[#1f1f1f]'
                      : 'bg-[#1a1a1a]/50 opacity-60'
                  )}
                >
                  {/* 更新指示器 */}
                  {updates.has(mod.id) && updates.get(mod.id)?.hasUpdate && (
                    <motion.div
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#00d17a] rounded-r-full"
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}

                  {/* 图标 */}
                  <div className="w-10 h-10 rounded bg-[#262626] flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {mod.iconUrl ? (
                      <img
                        src={mod.iconUrl}
                        alt={mod.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="w-5 h-5 text-[#707070]" />
                    )}
                  </div>

                  {/* 信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-white text-sm truncate">
                        {mod.name}
                      </h4>
                      {/* 更新标记 */}
                      <UpdateBadge mod={mod} updates={updates} />
                      <motion.a
                        href={`https://modrinth.com/mod/${mod.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <ExternalLink className="w-3 h-3 text-[#707070] hover:text-[#00d17a]" />
                      </motion.a>
                    </div>
                    <p className="text-xs text-[#707070] truncate">
                      {mod.filename}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs border-[#2a2a2a] text-[#707070]">
                        v{mod.versionNumber || '?'}
                      </Badge>
                      {/* 分类选择器 */}
                      <CategorySelector 
                        mod={mod} 
                        updatingCategory={updatingCategory}
                        updateModCategory={updateModCategory}
                      />
                    </div>
                  </div>

                  {/* 客户端模组：推荐按钮 + 下载按钮 */}
                  {mod.category === 'client-only' ? (
                    <>
                      {/* 推荐按钮 */}
                      <motion.div whileTap={{ scale: 0.85 }}>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleMod(mod.id)}
                          disabled={toggling === mod.id}
                          className={cn(
                            'h-8 w-8 p-0',
                            mod.recommended
                              ? 'text-[#f1c40f] hover:text-[#f39c12] hover:bg-[#f1c40f]/10'
                              : 'text-[#707070] hover:text-[#f1c40f] hover:bg-[#f1c40f]/10'
                          )}
                          title={mod.recommended ? '点击取消推荐' : '点击推荐此模组'}
                        >
                          {toggling === mod.id ? (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 2, ease: 'linear', repeat: Infinity }}
                            >
                              <Loader2 className="w-4 h-4" />
                            </motion.div>
                          ) : mod.recommended ? (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                            >
                              <Star className="w-4 h-4 fill-current" />
                            </motion.div>
                          ) : (
                            <StarOff className="w-4 h-4" />
                          )}
                        </Button>
                      </motion.div>
                      {/* 下载按钮 */}
                      <motion.div whileTap={{ scale: 0.85 }}>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => downloadMod(mod)}
                          disabled={downloading === mod.id}
                          className="h-8 w-8 p-0 text-[#707070] hover:text-[#00d17a] hover:bg-[#00d17a]/10"
                          title="下载此模组"
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
                    </>
                  ) : (
                    <motion.div whileTap={{ scale: 0.85 }}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleMod(mod.id)}
                        disabled={toggling === mod.id}
                        className={cn(
                          'h-8 w-8 p-0',
                          mod.enabled !== false
                            ? 'text-[#00d17a] hover:text-[#00b86b] hover:bg-[#00d17a]/10'
                            : 'text-[#707070] hover:text-[#a0a0a0] hover:bg-[#2a2a2a]'
                        )}
                        title={mod.enabled !== false ? '点击禁用' : '点击启用'}
                      >
                        {toggling === mod.id ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, ease: 'linear', repeat: Infinity }}
                          >
                            <Loader2 className="w-4 h-4" />
                          </motion.div>
                        ) : mod.enabled !== false ? (
                          <Power className="w-4 h-4" />
                        ) : (
                          <PowerOff className="w-4 h-4" />
                        )}
                      </Button>
                    </motion.div>
                  )}

                  {/* 更新按钮 */}
                  {updates.has(mod.id) && updates.get(mod.id)?.hasUpdate && onUpdateMod && (
                    <motion.div whileTap={{ scale: 0.85 }}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onUpdateMod(mod)}
                        disabled={loadingUpdateVersion && updateTargetMod?.id === mod.id}
                        className="h-8 w-8 p-0 text-[#00d17a] hover:text-[#00b86b] hover:bg-[#00d17a]/20"
                        title={`更新到 v${updates.get(mod.id)?.targetVersion}`}
                      >
                        {loadingUpdateVersion && updateTargetMod?.id === mod.id ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, ease: 'linear', repeat: Infinity }}
                          >
                            <Loader2 className="w-4 h-4" />
                          </motion.div>
                        ) : (
                          <ArrowUpCircle className="w-4 h-4" />
                        )}
                      </Button>
                    </motion.div>
                  )}

                  {/* 删除按钮 */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <motion.div whileTap={{ scale: 0.85 }}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-[#707070] hover:text-[#e74c3c] hover:bg-[#e74c3c]/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </motion.div>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-[#1a1a1a] border-[#2a2a2a]">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-white">
                          确认删除
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-[#a0a0a0]">
                          确定要删除模组 &quot;{mod.name}&quot; 吗？这将同时删除服务器上的文件。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-[#262626] border-[#2a2a2a] text-white hover:bg-[#2a2a2a]">
                          取消
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMod(mod.id)}
                          disabled={deleting === mod.id}
                          className="bg-[#e74c3c] hover:bg-[#c0392b] text-white"
                        >
                          {deleting === mod.id ? (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 2, ease: 'linear', repeat: Infinity }}
                            >
                              <Loader2 className="w-4 h-4" />
                            </motion.div>
                          ) : (
                            '删除'
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </motion.div>
              ))}
            </motion.div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

// 筛选图标
function FilterIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

// 更新分析器包装组件 - 使用 useMemo 确保对象引用稳定，防止不必要的重新分析
interface UpdateAnalyzerProps {
  isOpen: boolean;
  onClose: () => void;
  updateTargetMod: Mod;
  updateTargetVersion: VersionInfo;
  serverConfig: ServerConfig | null;
  onConfirm: () => void;
}

function UpdateAnalyzer({ isOpen, onClose, updateTargetMod, updateTargetVersion, serverConfig, onConfirm }: UpdateAnalyzerProps) {
  // 使用 useMemo 缓存对象，避免每次渲染创建新对象导致依赖分析器重新分析
  const selectedMod = useMemo(() => ({
    project_id: updateTargetMod.id,
    slug: updateTargetMod.slug,
    title: updateTargetMod.name,
    description: updateTargetMod.description || '',
    icon_url: updateTargetMod.iconUrl || '',
    client_side: updateTargetMod.environment.client,
    server_side: updateTargetMod.environment.server,
    categories: [],
    versions: [],
  }), [updateTargetMod]);

  // 同样缓存 version 对象
  const version = useMemo(() => updateTargetVersion, [updateTargetVersion]);

  return (
    <DependencyAnalyzer
      isOpen={isOpen}
      onClose={onClose}
      version={version}
      selectedMod={selectedMod}
      serverConfig={serverConfig}
      onAdd={onConfirm}
      mode="update"
    />
  );
}

// ===== 主组件 =====

export function ModManager() {
  const [mods, setMods] = useState<CategorizedMods>({ both: [], serverOnly: [], clientOnly: [] });
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingCategory, setUpdatingCategory] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [batchDownloading, setBatchDownloading] = useState(false);
  
  // 更新检查状态
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updates, setUpdates] = useState<Map<string, UpdateInfo>>(new Map());
  const [updateSummary, setUpdateSummary] = useState<UpdateSummary | null>(null);
  const [showOnlyUpdates, setShowOnlyUpdates] = useState(false);
  const [showCheckIcon, setShowCheckIcon] = useState(false);
  
  // 控制列表入场动画：首次加载播放，点击刷新按钮也播放
  const [animationKey, setAnimationKey] = useState(0);
  
  // 下载队列
  const { addTask } = useDownloadQueue();
  
  // 更新分析器状态
  const [isUpdateAnalyzerOpen, setIsUpdateAnalyzerOpen] = useState(false);
  const [updateTargetVersion, setUpdateTargetVersion] = useState<VersionInfo | null>(null);
  const [updateTargetMod, setUpdateTargetMod] = useState<Mod | null>(null);
  const [loadingUpdateVersion, setLoadingUpdateVersion] = useState(false);
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);

  useEffect(() => {
    fetchMods();
  }, []);

  const fetchMods = async () => {
    try {
      const res = await fetch('/api/mods');
      const data = await res.json();
      setMods(data.categorized);
    } catch (error) {
      console.error('Failed to fetch mods:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteMod = useCallback(async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/mods?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchMods();
      }
    } catch (error) {
      console.error('Failed to delete mod:', error);
    } finally {
      setDeleting(null);
    }
  }, []);

  const refreshMods = useCallback(async () => {
    setRefreshing(true);
    setAnimationKey(prev => prev + 1);  // 触发列表入场动画
    await fetchMods();
    setRefreshing(false);
  }, []);

  const updateModCategory = useCallback(async (id: string, category: 'both' | 'server-only' | 'client-only') => {
    setUpdatingCategory(id);
    try {
      const res = await fetch('/api/mods', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, category }),
      });
      if (res.ok) {
        await fetchMods();
      }
    } catch (error) {
      console.error('Failed to update category:', error);
    } finally {
      setUpdatingCategory(null);
    }
  }, []);

  const toggleMod = useCallback(async (id: string) => {
    setToggling(id);
    try {
      const res = await fetch('/api/mods', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        await fetchMods();
      }
    } catch (error) {
      console.error('Failed to toggle mod:', error);
    } finally {
      setToggling(null);
    }
  }, []);

  // 检查更新
  const checkUpdates = useCallback(async () => {
    setCheckingUpdates(true);
    setShowCheckIcon(false);
    try {
      const res = await fetch('/api/mods/check-updates');
      if (res.ok) {
        const data = await res.json();
        const updateMap = new Map<string, UpdateInfo>();
        data.updates.forEach((u: UpdateInfo) => {
          if (u.hasUpdate) {
            updateMap.set(u.modId, u);
          }
        });
        setUpdates(updateMap);
        setUpdateSummary(data.summary);
      }
    } catch (error) {
      console.error('Failed to check updates:', error);
    } finally {
      // 延迟显示勾选图标，产生弹性切换效果
      setTimeout(() => {
        setCheckingUpdates(false);
        setShowCheckIcon(true);
        // 2秒后恢复原始图标
        setTimeout(() => setShowCheckIcon(false), 2000);
      }, 500);
    }
  }, []);

  // 获取服务端配置
  const fetchServerConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const config = await res.json();
        setServerConfig({
          minecraftVersion: config.minecraftVersion,
          loader: config.loader,
        });
      }
    } catch (error) {
      console.error('Failed to fetch server config:', error);
    }
  }, []);

  // 打开更新分析器
  const openUpdateAnalyzer = useCallback(async (mod: Mod) => {
    const updateInfo = updates.get(mod.id);
    if (!updateInfo || !updateInfo.targetVersionId) return;
    
    setLoadingUpdateVersion(true);
    setUpdateTargetMod(mod);
    
    // 获取服务端配置
    await fetchServerConfig();
    
    try {
      // 获取目标版本详情（含依赖）
      const res = await fetch(`/api/version?versionId=${updateInfo.targetVersionId}`);
      if (res.ok) {
        const versionData = await res.json();
        setUpdateTargetVersion(versionData);
        setIsUpdateAnalyzerOpen(true);
      } else {
        console.error('Failed to fetch version details');
        // 如果获取失败，直接加入下载队列（降级处理）
        addTask({
          modId: mod.id,
          modName: `${mod.name} (更新)`,
          versionId: updateInfo.targetVersionId,
          versionNumber: updateInfo.targetVersion,
          filename: mod.filename,
          iconUrl: mod.iconUrl,
        });
        
        // 从更新列表中移除
        const newUpdates = new Map(updates);
        newUpdates.delete(mod.id);
        setUpdates(newUpdates);
        
        if (updateSummary) {
          setUpdateSummary({
            ...updateSummary,
            hasUpdates: Math.max(0, updateSummary.hasUpdates - 1),
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch version details:', error);
      // 如果获取失败，直接加入下载队列（降级处理）
      addTask({
        modId: mod.id,
        modName: `${mod.name} (更新)`,
        versionId: updateInfo.targetVersionId,
        versionNumber: updateInfo.targetVersion,
        filename: mod.filename,
        iconUrl: mod.iconUrl,
      });
    } finally {
      setLoadingUpdateVersion(false);
    }
  }, [updates, updateSummary, addTask, fetchServerConfig]);

  // 处理更新确认 - 从依赖分析器回调
  const handleUpdateConfirm = useCallback(() => {
    if (!updateTargetMod || !updateTargetVersion) return;
    
    const updateInfo = updates.get(updateTargetMod.id);
    if (!updateInfo) return;
    
    // 加入下载队列
    addTask({
      modId: updateTargetMod.id,
      modName: `${updateTargetMod.name} (更新)`,
      versionId: updateTargetVersion.id,
      versionNumber: updateTargetVersion.version_number,
      filename: updateTargetMod.filename,
      iconUrl: updateTargetMod.iconUrl,
    });
    
    // 从更新列表中移除
    const newUpdates = new Map(updates);
    newUpdates.delete(updateTargetMod.id);
    setUpdates(newUpdates);
    
    // 更新统计
    if (updateSummary) {
      setUpdateSummary({
        ...updateSummary,
        hasUpdates: Math.max(0, updateSummary.hasUpdates - 1),
      });
    }
    
    // 关闭分析器并清理状态
    setIsUpdateAnalyzerOpen(false);
    setUpdateTargetVersion(null);
    setUpdateTargetMod(null);
  }, [addTask, updateTargetMod, updateTargetVersion, updates, updateSummary]);

  // 处理更新分析器关闭
  const handleUpdateAnalyzerClose = useCallback(() => {
    setIsUpdateAnalyzerOpen(false);
    setUpdateTargetVersion(null);
    setUpdateTargetMod(null);
  }, []);

  // 下载模组
  const downloadMod = useCallback(async (mod: Mod) => {
    setDownloading(mod.id);
    try {
      const res = await fetch(`/api/download?modId=${mod.id}`);
      if (!res.ok) throw new Error('Download failed');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = mod.filename;
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
  }, []);

  // 批量下载客户端模组
  const downloadAllClientMods = useCallback(async () => {
    if (mods.clientOnly.length === 0) return;
    
    setBatchDownloading(true);
    try {
      for (const mod of mods.clientOnly) {
        await downloadMod(mod);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } catch (error) {
      console.error('Batch download error:', error);
    } finally {
      setBatchDownloading(false);
    }
  }, [mods.clientOnly, downloadMod]);

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
    <TooltipProvider>
      <motion.div 
        className="space-y-4"
        initial="hidden"
        animate="visible"
        variants={fadeIn}
      >
        {/* 操作栏 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* 检查更新按钮 */}
            <motion.div whileTap={{ scale: 0.96 }}>
              <Button
                variant="outline"
                size="sm"
                onClick={checkUpdates}
                disabled={checkingUpdates}
                className="border-[#2a2a2a] text-[#a0a0a0] hover:text-[#00d17a] hover:border-[#00d17a]/50"
              >
                <div className="relative w-4 h-4 mr-2">
                  <AnimatePresence mode="popLayout">
                    {checkingUpdates ? (
                      <motion.div
                        key="spinning"
                        className="absolute inset-0"
                        initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        exit={{ scale: 0.5, opacity: 0, rotate: 90 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20, mass: 0.8 }}
                      >
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, ease: 'linear', repeat: Infinity }}
                        >
                          <RefreshCw className="w-4 h-4 text-[#00d17a]" />
                        </motion.div>
                      </motion.div>
                    ) : showCheckIcon ? (
                      <motion.div
                        key="check"
                        className="absolute inset-0"
                        initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        exit={{ scale: 0.5, opacity: 0, rotate: 90 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                      >
                        <Check className="w-4 h-4 text-[#00d17a]" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="sparkles"
                        className="absolute inset-0"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.3, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      >
                        <Sparkles className="w-4 h-4" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                检查更新
              </Button>
            </motion.div>
            
            {/* 更新统计 */}
            {updateSummary && updateSummary.hasUpdates > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2"
              >
                <Badge className="bg-[#00d17a]/20 text-[#00d17a] border-0">
                  <ArrowUpCircle className="w-3 h-3 mr-1" />
                  {updateSummary.hasUpdates} 个可更新
                </Badge>
                
                {/* 仅显示可更新筛选 */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowOnlyUpdates(!showOnlyUpdates)}
                  className={cn(
                    'h-7 px-2 text-xs',
                    showOnlyUpdates 
                      ? 'text-[#00d17a] bg-[#00d17a]/10' 
                      : 'text-[#707070] hover:text-white'
                  )}
                >
                  {showOnlyUpdates ? (
                    <>
                      <X className="w-3 h-3 mr-1" />
                      显示全部
                    </>
                  ) : (
                    <>
                      <FilterIcon className="w-3 h-3 mr-1" />
                      仅看更新
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </div>
          
          {/* 刷新按钮 - 弹性旋转动画 */}
          <motion.div whileTap={{ scale: 0.96 }}>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshMods}
              disabled={refreshing}
              className="border-[#2a2a2a] text-[#a0a0a0] hover:text-white"
            >
              <div className="relative w-4 h-4 mr-2">
                <AnimatePresence mode="popLayout">
                  {refreshing ? (
                    <motion.div
                      key="spinning"
                      className="absolute inset-0"
                      initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      exit={{ scale: 0.5, opacity: 0, rotate: 90 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20, mass: 0.8 }}
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, ease: 'linear', repeat: Infinity }}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </motion.div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="static"
                      className="absolute inset-0"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.3, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    >
                      <RefreshCw className="w-4 h-4" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              刷新
            </Button>
          </motion.div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ModList 
            mods={mods.both} 
            category="both" 
            animationKey={animationKey}
            showOnlyUpdates={showOnlyUpdates}
            updates={updates}
            deleting={deleting}
            toggling={toggling}
            downloading={downloading}
            updatingCategory={updatingCategory}
            downloadMod={downloadMod}
            toggleMod={toggleMod}
            deleteMod={deleteMod}
            updateModCategory={updateModCategory}
            onUpdateMod={openUpdateAnalyzer}
            loadingUpdateVersion={loadingUpdateVersion}
            updateTargetMod={updateTargetMod}
          />
          <ModList 
            mods={mods.serverOnly} 
            category="server-only" 
            animationKey={animationKey}
            showOnlyUpdates={showOnlyUpdates}
            updates={updates}
            deleting={deleting}
            toggling={toggling}
            downloading={downloading}
            updatingCategory={updatingCategory}
            downloadMod={downloadMod}
            toggleMod={toggleMod}
            deleteMod={deleteMod}
            updateModCategory={updateModCategory}
            onUpdateMod={openUpdateAnalyzer}
            loadingUpdateVersion={loadingUpdateVersion}
            updateTargetMod={updateTargetMod}
          />
        </div>

        <AnimatePresence>
          {mods.clientOnly.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <ModList 
                mods={mods.clientOnly} 
                category="client-only" 
                showBatchDownload={true}
                onBatchDownload={downloadAllClientMods}
                batchDownloading={batchDownloading}
                animationKey={animationKey}
                showOnlyUpdates={showOnlyUpdates}
                updates={updates}
                deleting={deleting}
                toggling={toggling}
                downloading={downloading}
                updatingCategory={updatingCategory}
                downloadMod={downloadMod}
                toggleMod={toggleMod}
                deleteMod={deleteMod}
                updateModCategory={updateModCategory}
                onUpdateMod={openUpdateAnalyzer}
                loadingUpdateVersion={loadingUpdateVersion}
                updateTargetMod={updateTargetMod}
              />
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* 更新依赖分析器 */}
        {updateTargetMod && updateTargetVersion && (
          <UpdateAnalyzer 
            isOpen={isUpdateAnalyzerOpen}
            onClose={handleUpdateAnalyzerClose}
            updateTargetMod={updateTargetMod}
            updateTargetVersion={updateTargetVersion}
            serverConfig={serverConfig}
            onConfirm={handleUpdateConfirm}
          />
        )}
      </motion.div>
    </TooltipProvider>
  );
}
