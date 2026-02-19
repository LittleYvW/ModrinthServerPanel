'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save, Check, AlertCircle, Server, Eye, LayoutGrid, Sparkles, Lock } from 'lucide-react';

type Loader = 'fabric' | 'forge' | 'quilt' | 'neoforge';
type ModManagementMode = 'classic' | 'immersive';

interface Config {
  path: string;
  minecraftVersion: string;
  loader: Loader;
  loaderVersion: string;
  showServerOnlyMods: boolean;
  modManagementMode: ModManagementMode;
}

const loaders: { value: Loader; label: string; color: string }[] = [
  { value: 'fabric', label: 'Fabric', color: '#dbb69b' },
  { value: 'forge', label: 'Forge', color: '#e67e22' },
  { value: 'quilt', label: 'Quilt', color: '#9b59b6' },
  { value: 'neoforge', label: 'NeoForge', color: '#e67e22' },
];

const managementModes: { value: ModManagementMode; label: string; description: string; disabled?: boolean }[] = [
  { value: 'classic', label: '经典', description: '传统的三列网格布局，适合高效管理' },
  { value: 'immersive', label: '沉浸式', description: '视觉化的模组展示，更具沉浸感（即将推出）', disabled: true },
];

export function ServerConfigPanel() {
  const [config, setConfig] = useState<Config>({
    path: '',
    minecraftVersion: '',
    loader: 'fabric',
    loaderVersion: '',
    showServerOnlyMods: true,
    modManagementMode: 'classic',
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
    }
  };

  const saveConfig = async () => {
    setLoading(true);
    setError('');
    setSaved(false);

    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const data = await res.json();
        setError(data.error || '保存失败');
      }
    } catch {
      setError('保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-[#2a2a2a] bg-[#151515]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Server className="w-5 h-5 text-[#00d17a]" />
          服务端配置
        </CardTitle>
        <CardDescription className="text-[#a0a0a0]">
          配置 Minecraft 服务器的基本信息
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {saved && (
          <Alert className="bg-[#00d17a]/10 border-[#00d17a]/30 text-[#00d17a]">
            <Check className="w-4 h-4" />
            <AlertDescription>配置已保存</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert className="bg-[#e74c3c]/10 border-[#e74c3c]/30 text-[#e74c3c]">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 服务端路径 */}
        <div className="space-y-2">
          <Label htmlFor="path" className="text-white">
            服务端路径 <span className="text-[#e74c3c]">*</span>
          </Label>
          <div className="flex gap-2">
            <Input
              id="path"
              value={config.path}
              onChange={(e) => setConfig({ ...config, path: e.target.value })}
              placeholder="例如: D:\\MinecraftServer"
              className="flex-1 bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder:text-[#505050] focus:border-[#00d17a] focus:ring-[#00d17a]"
            />
          </div>
          <p className="text-xs text-[#707070]">
            服务器根目录，模组将下载到该目录的 mods 文件夹中
          </p>
        </div>

        {/* Minecraft 版本 */}
        <div className="space-y-2">
          <Label htmlFor="version" className="text-white">
            Minecraft 版本 <span className="text-[#e74c3c]">*</span>
          </Label>
          <Input
            id="version"
            value={config.minecraftVersion}
            onChange={(e) => setConfig({ ...config, minecraftVersion: e.target.value })}
            placeholder="例如: 1.20.1"
            className="bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder:text-[#505050] focus:border-[#00d17a] focus:ring-[#00d17a]"
          />
        </div>

        {/* 加载器类型 */}
        <div className="space-y-2">
          <Label className="text-white">模组加载器</Label>
          <div className="flex flex-wrap gap-2">
            {loaders.map((loader) => (
              <Button
                key={loader.value}
                type="button"
                variant={config.loader === loader.value ? 'default' : 'outline'}
                onClick={() => setConfig({ ...config, loader: loader.value })}
                className={`
                  ${config.loader === loader.value 
                    ? 'bg-[#00d17a] text-black hover:bg-[#00b86b]' 
                    : 'border-[#2a2a2a] text-[#a0a0a0] hover:border-[#00d17a] hover:text-white'
                  }
                `}
              >
                {loader.label}
              </Button>
            ))}
          </div>
        </div>

        {/* 加载器版本 */}
        <div className="space-y-2">
          <Label htmlFor="loaderVersion" className="text-white">
            加载器版本
          </Label>
          <Input
            id="loaderVersion"
            value={config.loaderVersion}
            onChange={(e) => setConfig({ ...config, loaderVersion: e.target.value })}
            placeholder="例如: 0.14.22 (Fabric) 或 47.1.0 (Forge)"
            className="bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder:text-[#505050] focus:border-[#00d17a] focus:ring-[#00d17a]"
          />
        </div>

        {/* 访客模式显示设置 */}
        <div className="space-y-3 pt-2 border-t border-[#2a2a2a]">
          <Label className="flex items-center gap-2 text-white">
            <Eye className="w-4 h-4 text-[#00d17a]" />
            访客模式显示设置
          </Label>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant={config.showServerOnlyMods ? 'default' : 'outline'}
              onClick={() => setConfig({ ...config, showServerOnlyMods: true })}
              className={`
                ${config.showServerOnlyMods 
                  ? 'bg-[#00d17a] text-black hover:bg-[#00b86b]' 
                  : 'border-[#2a2a2a] text-[#a0a0a0] hover:border-[#00d17a] hover:text-white'
                }
              `}
            >
              <Eye className="w-4 h-4 mr-2" />
              显示纯服务端模组
            </Button>
            <Button
              type="button"
              variant={!config.showServerOnlyMods ? 'default' : 'outline'}
              onClick={() => setConfig({ ...config, showServerOnlyMods: false })}
              className={`
                ${!config.showServerOnlyMods 
                  ? 'bg-[#00d17a] text-black hover:bg-[#00b86b]' 
                  : 'border-[#2a2a2a] text-[#a0a0a0] hover:border-[#00d17a] hover:text-white'
                }
              `}
            >
              隐藏纯服务端模组
            </Button>
          </div>
          <p className="text-xs text-[#707070]">
            控制访客在首页是否能看到纯服务端模组的列表
          </p>
        </div>

        {/* 模组管理模式 */}
        <div className="space-y-3 pt-2 border-t border-[#2a2a2a]">
          <Label className="flex items-center gap-2 text-white">
            <LayoutGrid className="w-4 h-4 text-[#00d17a]" />
            模组管理方式
          </Label>
          <div className="grid grid-cols-2 gap-3">
            {managementModes.map((mode) => (
              <button
                key={mode.value}
                type="button"
                disabled={mode.disabled}
                onClick={() => !mode.disabled && setConfig({ ...config, modManagementMode: mode.value })}
                className={`
                  relative p-4 rounded-lg border-2 text-left transition-all duration-200
                  ${mode.disabled
                    ? 'border-[#2a2a2a] bg-[#1a1a1a]/50 cursor-not-allowed opacity-60'
                    : config.modManagementMode === mode.value
                      ? 'border-[#00d17a] bg-[#00d17a]/10'
                      : 'border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#3a3a3a]'
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  <div className={`
                    p-2 rounded-lg
                    ${mode.disabled
                      ? 'bg-[#2a2a2a]/50 text-[#505050]'
                      : config.modManagementMode === mode.value
                        ? 'bg-[#00d17a]/20 text-[#00d17a]'
                        : 'bg-[#2a2a2a] text-[#707070]'
                    }
                  `}>
                    {mode.value === 'classic' ? (
                      <LayoutGrid className="w-5 h-5" />
                    ) : (
                      <Sparkles className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className={`
                      font-medium mb-1 flex items-center gap-2
                      ${mode.disabled
                        ? 'text-[#505050]'
                        : config.modManagementMode === mode.value
                          ? 'text-white'
                          : 'text-[#a0a0a0]'
                      }
                    `}>
                      {mode.label}
                      {mode.disabled && <Lock className="w-3 h-3" />}
                    </div>
                    <div className="text-xs text-[#707070]">
                      {mode.description}
                    </div>
                  </div>
                </div>
                {!mode.disabled && config.modManagementMode === mode.value && (
                  <div className="absolute top-2 right-2">
                    <div className="w-2 h-2 rounded-full bg-[#00d17a]" />
                  </div>
                )}
                {mode.disabled && (
                  <div className="absolute top-2 right-2">
                    <Lock className="w-3 h-3 text-[#505050]" />
                  </div>
                )}
              </button>
            ))}
          </div>
          <p className="text-xs text-[#707070]">
            切换已安装模组的管理界面展示方式
          </p>
        </div>

        {/* 保存按钮 */}
        <Button
          onClick={saveConfig}
          disabled={loading || !config.path || !config.minecraftVersion}
          className="w-full bg-[#00d17a] hover:bg-[#00b86b] text-black font-semibold"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 mr-2 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              保存配置
            </>
          )}
        </Button>

        {/* 当前配置概览 */}
        {config.path && config.minecraftVersion && (
          <div className="pt-4 border-t border-[#2a2a2a]">
            <h4 className="text-sm font-medium text-white mb-3">当前配置</h4>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-[#2a2a2a] text-[#a0a0a0]">
                MC {config.minecraftVersion}
              </Badge>
              <Badge 
                className="border-0"
                style={{ 
                  backgroundColor: `${loaders.find(l => l.value === config.loader)?.color}20`,
                  color: loaders.find(l => l.value === config.loader)?.color 
                }}
              >
                {loaders.find(l => l.value === config.loader)?.label}
              </Badge>
              {config.loaderVersion && (
                <Badge variant="outline" className="border-[#2a2a2a] text-[#a0a0a0]">
                  {config.loaderVersion}
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
