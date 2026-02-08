'use client';

import { useState, useEffect } from 'react';
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
import { Package, Trash2, Users, Server, Monitor, RefreshCw, Loader2, ExternalLink, Settings2, Check, Power, PowerOff } from 'lucide-react';
import { cn } from '@/lib/utils';

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
}

interface CategorizedMods {
  both: Mod[];
  serverOnly: Mod[];
  clientOnly: Mod[];
}

export function ModManager() {
  const [mods, setMods] = useState<CategorizedMods>({ both: [], serverOnly: [], clientOnly: [] });
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingCategory, setUpdatingCategory] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

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

  const deleteMod = async (id: string) => {
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
  };

  const refreshMods = async () => {
    setRefreshing(true);
    await fetchMods();
    setRefreshing(false);
  };

  const updateModCategory = async (id: string, category: 'both' | 'server-only' | 'client-only') => {
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
  };

  const toggleMod = async (id: string) => {
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
  };

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

  const CategorySelector = ({ mod }: { mod: Mod }) => {
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
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <>
                {getCategoryIcon(mod.category)}
                <span>{getCategoryLabel(mod.category)}</span>
                <Settings2 className="w-3 h-3 ml-1 opacity-50" />
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-[#1a1a1a] border-[#2a2a2a]">
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
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const ModList = ({ mods, category }: { mods: Mod[]; category: string }) => (
    <Card className="border-[#2a2a2a] bg-[#151515]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-white">
          {getCategoryIcon(category)}
          {category === 'both' && '双端模组'}
          {category === 'server-only' && '纯服务端模组'}
          {category === 'client-only' && '纯客户端模组'}
          <Badge className={`${getCategoryColor(category)} border-0`}>
            {mods.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {mods.length === 0 ? (
          <div className="text-center py-6 text-[#707070]">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无模组</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {mods.map((mod) => (
                <div
                  key={mod.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg transition-colors group',
                    mod.enabled !== false
                      ? 'bg-[#1a1a1a] hover:bg-[#1f1f1f]'
                      : 'bg-[#1a1a1a]/50 opacity-60'
                  )}
                >
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
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-white text-sm truncate">
                        {mod.name}
                      </h4>
                      <a
                        href={`https://modrinth.com/mod/${mod.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ExternalLink className="w-3 h-3 text-[#707070] hover:text-[#00d17a]" />
                      </a>
                    </div>
                    <p className="text-xs text-[#707070] truncate">
                      {mod.filename}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs border-[#2a2a2a] text-[#707070]">
                        v{mod.versionNumber || '?'}
                      </Badge>
                      {/* 分类选择器 */}
                      <CategorySelector mod={mod} />
                    </div>
                  </div>

                  {/* 开关按钮 */}
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
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : mod.enabled !== false ? (
                      <Power className="w-4 h-4" />
                    ) : (
                      <PowerOff className="w-4 h-4" />
                    )}
                  </Button>

                  {/* 删除按钮 */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-[#707070] hover:text-[#e74c3c] hover:bg-[#e74c3c]/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-[#1a1a1a] border-[#2a2a2a]">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-white">
                          确认删除
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-[#a0a0a0]">
                          确定要删除模组 "{mod.name}" 吗？这将同时删除服务器上的文件。
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
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            '删除'
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#00d17a]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={refreshMods}
          disabled={refreshing}
          className="border-[#2a2a2a] text-[#a0a0a0] hover:text-white"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ModList mods={mods.both} category="both" />
        <ModList mods={mods.serverOnly} category="server-only" />
      </div>

      {mods.clientOnly.length > 0 && (
        <ModList mods={mods.clientOnly} category="client-only" />
      )}
    </div>
  );
}
