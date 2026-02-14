'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Package,
  Check,
  RefreshCw,
  AlertTriangle,
  Info,
  Loader2,
  ListPlus,
  ExternalLink,
  ChevronRight,
  Layers,
  Ban,
  HelpCircle,
  Search,
  X,
} from 'lucide-react';
import {
  analysisPhase,
  analysisPhaseContainer,
  scanningExit,
  radarExit,
  resultsEnter,
  dependencyItem,
  analysisPulse,
} from '@/lib/animations';
import { useDownloadQueue } from '@/lib/download-queue';

interface Dependency {
  version_id: string | null;
  project_id: string;
  dependency_type: 'required' | 'optional' | 'incompatible' | 'embedded';
  file_name?: string;
}

interface Version {
  id: string;
  version_number: string;
  client_support: string;
  server_support: string;
  files: { filename: string; primary: boolean }[];
  loaders: string[];
  game_versions: string[];
  dependencies?: Dependency[];
}

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

interface ServerConfig {
  minecraftVersion: string;
  loader: string;
}

interface InstalledMod {
  id: string;
  name: string;
  slug: string;
  versionId: string;
  versionNumber?: string;
  filename: string;
  category: 'both' | 'server-only' | 'client-only';
  enabled?: boolean;
  iconUrl?: string;
}

interface DependencyAnalysis {
  projectId: string;
  name: string;
  slug: string;
  iconUrl?: string;
  type: 'required' | 'optional' | 'incompatible' | 'embedded';
  status: 'installed' | 'missing' | 'conflict' | 'optional-missing' | 'version-mismatch' | 'not-installed';
  installedMod?: InstalledMod;
  specifiedVersionId?: string | null;
  specifiedVersionNumber?: string;
  description?: string;
}

interface AnalysisPhase {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'completed';
}

interface DependencyAnalyzerProps {
  isOpen: boolean;
  onClose: () => void;
  version: Version | null;
  selectedMod: SearchResult | null;
  serverConfig: ServerConfig | null;
  onAdd: () => void;
  mode?: 'add' | 'update';
}

export function DependencyAnalyzer({
  isOpen,
  onClose,
  version,
  selectedMod,
  serverConfig,
  onAdd,
  mode = 'add',
}: DependencyAnalyzerProps) {
  const [analysisState, setAnalysisState] = useState<'scanning' | 'analyzing' | 'complete'>('scanning');
  const [phases, setPhases] = useState<AnalysisPhase[]>([
    { id: 'fetch', label: '获取依赖信息', status: 'pending' },
    { id: 'load', label: '加载已安装模组', status: 'pending' },
    { id: 'analyze', label: '分析依赖关系', status: 'pending' },
    { id: 'validate', label: '验证兼容性', status: 'pending' },
  ]);
  const [dependencies, setDependencies] = useState<DependencyAnalysis[]>([]);
  const [installedMods, setInstalledMods] = useState<InstalledMod[]>([]);
  const [missingDependencies, setMissingDependencies] = useState<DependencyAnalysis[]>([]);
  const [optionalDependencies, setOptionalDependencies] = useState<DependencyAnalysis[]>([]);
  const [selectedMissingDep, setSelectedMissingDep] = useState<DependencyAnalysis | null>(null);
  const [availableVersions, setAvailableVersions] = useState<any[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [headerComplete, setHeaderComplete] = useState(false);
  const { addTask } = useDownloadQueue();

  // 重置状态
  const resetState = useCallback(() => {
    setAnalysisState('scanning');
    setPhases([
      { id: 'fetch', label: '获取依赖信息', status: 'pending' },
      { id: 'load', label: '加载已安装模组', status: 'pending' },
      { id: 'analyze', label: '分析依赖关系', status: 'pending' },
      { id: 'validate', label: '验证兼容性', status: 'pending' },
    ]);
    setDependencies([]);
    setInstalledMods([]);
    setMissingDependencies([]);
    setOptionalDependencies([]);
    setSelectedMissingDep(null);
    setAvailableVersions([]);
    setHeaderComplete(false);
  }, []);

  // 开始分析
  useEffect(() => {
    if (isOpen && version && selectedMod) {
      resetState();
      runAnalysis();
    }
  }, [isOpen, version, selectedMod]);

  const updatePhase = (phaseId: string, status: AnalysisPhase['status']) => {
    setPhases((prev) =>
      prev.map((p) => (p.id === phaseId ? { ...p, status } : p))
    );
  };

  const runAnalysis = async () => {
    if (!version || !selectedMod) return;

    setAnalysisState('scanning');

    // Phase 1: 获取依赖信息
    updatePhase('fetch', 'active');
    await new Promise((r) => setTimeout(r, 400));

    let versionDetails: any = null;
    try {
      const res = await fetch(`/api/version?versionId=${version.id}`);
      if (res.ok) {
        versionDetails = await res.json();
      }
    } catch (error) {
      console.error('Failed to fetch version details:', error);
    }

    const deps: Dependency[] = versionDetails?.dependencies || version?.dependencies || [];
    updatePhase('fetch', 'completed');

    // Phase 2: 加载已安装模组
    updatePhase('load', 'active');
    await new Promise((r) => setTimeout(r, 300));

    let mods: InstalledMod[] = [];
    try {
      const res = await fetch('/api/mods');
      if (res.ok) {
        const data = await res.json();
        mods = data.mods || [];
      }
    } catch (error) {
      console.error('Failed to fetch installed mods:', error);
    }

    setInstalledMods(mods);
    updatePhase('load', 'completed');

    // Phase 3: 分析依赖关系
    updatePhase('analyze', 'active');
    await new Promise((r) => setTimeout(r, 400));

    const analysis: DependencyAnalysis[] = [];

    for (const dep of deps) {
      const installedMod = mods.find((m) => m.id === dep.project_id);

      let status: DependencyAnalysis['status'];
      if (dep.dependency_type === 'incompatible') {
        status = installedMod ? 'conflict' : 'not-installed';
      } else if (dep.dependency_type === 'optional') {
        if (installedMod) {
          // 检查版本是否匹配
          status = (dep.version_id && dep.version_id !== installedMod.versionId) 
            ? 'version-mismatch' 
            : 'installed';
        } else {
          status = 'optional-missing';
        }
      } else {
        if (installedMod) {
          // 检查版本是否匹配
          status = (dep.version_id && dep.version_id !== installedMod.versionId) 
            ? 'version-mismatch' 
            : 'installed';
        } else {
          status = 'missing';
        }
      }

      analysis.push({
        projectId: dep.project_id,
        name: installedMod?.name || dep.project_id,
        slug: installedMod?.slug || dep.project_id,
        iconUrl: installedMod?.iconUrl,
        type: dep.dependency_type,
        status,
        installedMod,
        specifiedVersionId: dep.version_id,
        specifiedVersionNumber: undefined,
        description: undefined,
      });
    }

    // 获取缺失、版本不匹配或冲突（未安装）的依赖项目信息
    const missingDeps = analysis.filter(
      (a) => (a.status === 'missing' || a.status === 'version-mismatch') && a.type !== 'optional'
    );
    const optionalDeps = analysis.filter(
      (a) => a.status === 'optional-missing'
    );
    const conflictDeps = analysis.filter(
      (a) => a.status === 'conflict' || a.status === 'not-installed'
    );

    // 获取版本不匹配依赖的版本号信息
    const versionMismatchDeps = analysis.filter((a): a is DependencyAnalysis & { specifiedVersionId: string } => 
      a.status === 'version-mismatch' && !!a.specifiedVersionId
    );
    if (versionMismatchDeps.length > 0) {
      try {
        const versionIds = versionMismatchDeps.map((d) => d.specifiedVersionId).join(',');
        const res = await fetch(`/api/version?ids=${versionIds}`);
        if (res.ok) {
          const versions = await res.json();
          const versionsArray = Array.isArray(versions) ? versions : [versions];
          for (const dep of analysis) {
            if (dep.status === 'version-mismatch' && dep.specifiedVersionId) {
              const versionInfo = versionsArray.find((v: any) => v.id === dep.specifiedVersionId);
              if (versionInfo) {
                dep.specifiedVersionNumber = versionInfo.version_number;
              }
            }
          }
        }
      } catch (error) {
        console.error('[DependencyAnalyzer] Failed to fetch version numbers:', error);
      }
    }

    const depsNeedingInfo = [...missingDeps, ...optionalDeps, ...conflictDeps];
    if (depsNeedingInfo.length > 0) {
      try {
        const projectIds = depsNeedingInfo.map((d) => d.projectId).join(',');
        const res = await fetch(`/api/projects?ids=${projectIds}`);
        if (res.ok) {
          const projects = await res.json();
          for (const dep of analysis) {
            const project = projects.find((p: any) => p.id === dep.projectId);
            if (project) {
              dep.name = project.title;
              dep.slug = project.slug;
              dep.iconUrl = project.icon_url;
              dep.description = project.description;
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch project details:', error);
      }
    }

    setDependencies(analysis);
    setMissingDependencies(missingDeps);
    setOptionalDependencies(optionalDeps);
    updatePhase('analyze', 'completed');

    // Phase 4: 验证兼容性
    updatePhase('validate', 'active');
    await new Promise((r) => setTimeout(r, 150));
    updatePhase('validate', 'completed');

    // 设置完成状态，触发头部动画（提前）
    setHeaderComplete(true);

    setAnalysisState('complete');
  };

  // 检查版本兼容性
  const checkVersionCompatibility = (v: any): {
    isCompatible: boolean;
    gameVersionMatch: boolean;
    loaderMatch: boolean;
  } => {
    if (!serverConfig) {
      return { isCompatible: false, gameVersionMatch: false, loaderMatch: false };
    }

    const gameVersionMatch = v.game_versions?.includes(serverConfig.minecraftVersion) ?? false;
    const loaderMatch = v.loaders?.includes(serverConfig.loader) ?? false;

    return {
      isCompatible: gameVersionMatch && loaderMatch,
      gameVersionMatch,
      loaderMatch,
    };
  };

  const fetchVersionsForDependency = async (dep: DependencyAnalysis) => {

    setSelectedMissingDep(dep);
    setLoadingVersions(true);
    setAvailableVersions([]);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: dep.projectId }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        console.error('[DependencyAnalyzer] API error:', data.error);
        setAvailableVersions([]);
        return;
      }

      const versions = Array.isArray(data.versions) ? data.versions : [];

      // 如果API指定了版本，优先使用
      if (dep.specifiedVersionId) {
        const specifiedVersion = versions.find((v: any) => v.id === dep.specifiedVersionId);
        if (specifiedVersion) {
          // 直接添加到队列（传入 dep 避免状态未更新）
          await addDependencyToQueue(specifiedVersion, dep);
          setLoadingVersions(false);
          return;
        }
        // 找不到指定版本时，回退到显示版本列表
      }
      setAvailableVersions(versions);
    } catch (error) {
      console.error('[DependencyAnalyzer] Failed to fetch versions:', error);
      setAvailableVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  const addDependencyToQueue = async (depVersion: any, dep?: DependencyAnalysis, isReplace = false) => {
    // 使用传入的 dep 或状态中的 selectedMissingDep
    const targetDep = dep || selectedMissingDep;
    if (!targetDep) return;

    const primaryFile = depVersion.files?.find((f: any) => f.primary) || depVersion.files?.[0];

    // 如果是替换操作，先删除旧版本
    if (isReplace && targetDep.installedMod) {
      try {
        await fetch(`/api/mods?id=${targetDep.installedMod.id}&versionId=${targetDep.installedMod.versionId}`, {
          method: 'DELETE',
        });
      } catch (error) {
        console.error('Failed to delete old version:', error);
      }
    }

    // 添加到下载队列
    addTask({
      modId: targetDep.projectId,
      modName: targetDep.name,
      versionId: depVersion.id,
      versionNumber: depVersion.version_number,
      filename: primaryFile?.filename || `${targetDep.slug}-${depVersion.version_number}.jar`,
      iconUrl: targetDep.iconUrl,
    });

    // 更新状态
    setMissingDependencies((prev) =>
      prev.filter((d) => d.projectId !== targetDep.projectId)
    );

    // 更新依赖列表状态
    setDependencies((prev) =>
      prev.map((d) =>
        d.projectId === targetDep.projectId
          ? { ...d, status: 'installed' as const }
          : d
      )
    );

    setSelectedMissingDep(null);
    setAvailableVersions([]);
  };

  // 处理版本替换（用于 version-mismatch 状态）
  const handleReplaceVersion = async (dep: DependencyAnalysis) => {
    if (!dep.specifiedVersionId) return;

    setSelectedMissingDep(dep);
    setLoadingVersions(true);
    setAvailableVersions([]);

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: dep.projectId }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        console.error('[DependencyAnalyzer] API error:', data.error);
        setAvailableVersions([]);
        return;
      }

      const versions = Array.isArray(data.versions) ? data.versions : [];
      const specifiedVersion = versions.find((v: any) => v.id === dep.specifiedVersionId);

      if (specifiedVersion) {
        // 直接替换为指定版本
        await addDependencyToQueue(specifiedVersion, dep, true);
      } else {
        // 找不到指定版本，显示版本列表让用户选择
        setAvailableVersions(versions);
      }
    } catch (error) {
      console.error('[DependencyAnalyzer] Failed to fetch versions:', error);
      setAvailableVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleAddAll = () => {
    onAdd();
  };

  const hasBlockingIssues = dependencies.some(
    (d) => d.type === 'incompatible' && d.status === 'conflict'
  );

  const hasRequiredMissing = dependencies.some(
    (d) => d.type === 'required' && (d.status === 'missing' || d.status === 'version-mismatch')
  );

  const getTypeColor = (type: Dependency['dependency_type']) => {
    switch (type) {
      case 'required':
        return 'text-[#00d17a]';
      case 'optional':
        return 'text-[#1b8fff]';
      case 'incompatible':
        return 'text-[#e74c3c]';
      case 'embedded':
        return 'text-[#9b59b6]';
    }
  };

  const getTypeBg = (type: Dependency['dependency_type']) => {
    switch (type) {
      case 'required':
        return 'bg-[#00d17a]/10 border-[#00d17a]/30';
      case 'optional':
        return 'bg-[#1b8fff]/10 border-[#1b8fff]/30';
      case 'incompatible':
        return 'bg-[#e74c3c]/10 border-[#e74c3c]/30';
      case 'embedded':
        return 'bg-[#9b59b6]/10 border-[#9b59b6]/30';
    }
  };

  const getTypeLabel = (type: Dependency['dependency_type']) => {
    switch (type) {
      case 'required':
        return '前置';
      case 'optional':
        return '可选';
      case 'incompatible':
        return '冲突';
      case 'embedded':
        return '嵌入';
    }
  };

  const getStatusIcon = (status: DependencyAnalysis['status']) => {
    switch (status) {
      case 'installed':
      case 'not-installed':
        return <ShieldCheck className="w-5 h-5 text-[#00d17a]" />;
      case 'missing':
        return <ShieldAlert className="w-5 h-5 text-[#f1c40f]" />;
      case 'conflict':
        return <ShieldX className="w-5 h-5 text-[#e74c3c]" />;
      case 'optional-missing':
        return <Info className="w-5 h-5 text-[#707070]" />;
      case 'version-mismatch':
        return <RefreshCw className="w-5 h-5 text-[#e67e22]" />;
    }
  };

  const getStatusText = (status: DependencyAnalysis['status']) => {
    switch (status) {
      case 'installed':
        return '已安装';
      case 'not-installed':
        return '未安装';
      case 'missing':
        return '未安装';
      case 'conflict':
        return '冲突';
      case 'optional-missing':
        return '可选';
      case 'version-mismatch':
        return '版本不匹配';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a] max-w-2xl p-0 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-[#2a2a2a]">
          <DialogTitle className="text-white flex items-center gap-3">
            {/* 左上角动画 - 旋转刷新环，结束后跳出勾 */}
            <div className="relative w-8 h-8 flex items-center justify-center">
              <AnimatePresence>
                {!headerComplete && (
                  <motion.div
                    key="refresh"
                    className="absolute"
                    initial={{ opacity: 0, scale: 0, rotate: -180 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
                    transition={{
                      type: 'spring',
                      stiffness: 260,
                      damping: 12,
                      mass: 1.2,
                    }}
                  >
                    {/* 外圈脉冲 */}
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-[#00d17a]/30"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{
                        scale: [1, 1.5],
                        opacity: [0.6, 0],
                      }}
                      transition={{
                        duration: 1.5,
                        ease: 'easeOut',
                        repeat: Infinity,
                        repeatDelay: 0.5,
                      }}
                    />
                    {/* 旋转图标 - 使用更自然的缓动 */}
                    <motion.div
                      initial={{ rotate: 0 }}
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 2,
                        ease: [0.4, 0, 0.2, 1],
                        repeat: Infinity,
                        delay: 0.3,
                      }}
                      whileHover={{ scale: 1.1 }}
                    >
                      <RefreshCw className="w-6 h-6 text-[#00d17a]" />
                    </motion.div>
                  </motion.div>
                )}
                {headerComplete && (
                  <motion.div
                    key="check"
                    className="absolute"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                  >
                    <div className="w-7 h-7 rounded-full bg-[#00d17a]/20 flex items-center justify-center">
                      <Check className="w-5 h-5 text-[#00d17a]" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div>
              <div className="text-lg">{mode === 'update' ? '更新分析器' : '依赖分析器'}</div>
              {selectedMod && (
                <div className="text-sm text-[#707070] font-normal flex items-center gap-2">
                  {selectedMod.icon_url && (
                    <img src={selectedMod.icon_url} alt="" className="w-4 h-4 rounded" />
                  )}
                  {selectedMod.title}
                  {version && (
                    <>
                      <ChevronRight className="w-3 h-3" />
                      <span className="text-[#00d17a]">v{version.version_number}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Content */}
        <div className="p-6 pt-4">
          <AnimatePresence mode="wait">
          {analysisState !== 'complete' ? (
            /* Scanning Phase */
            <motion.div 
              key="scanning"
              className="space-y-6"
              variants={scanningExit}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {/* 雷达扫描动画 */}
              <motion.div 
                className="relative h-40 bg-[#151515] rounded-xl overflow-hidden flex items-center justify-center"
                variants={radarExit}
              >
                {/* 同心圆 */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {[1, 2, 3].map((ring) => (
                    <motion.div
                      key={ring}
                      className="absolute rounded-full border border-[#00d17a]/20"
                      style={{
                        width: `${ring * 80}px`,
                        height: `${ring * 80}px`,
                      }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: ring * 0.1, duration: 0.3 }}
                    />
                  ))}
                </div>

                {/* 旋转扫描线 */}
                <motion.div
                  className="absolute w-full h-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, ease: 'linear', repeat: Infinity }}
                >
                  <div className="absolute top-1/2 left-1/2 w-[140px] h-[2px] bg-gradient-to-r from-transparent via-[#00d17a] to-transparent origin-left -translate-y-1/2" />
                </motion.div>

                {/* 中心点脉冲 */}
                <motion.div
                  className="relative z-10 w-4 h-4 rounded-full bg-[#00d17a]"
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [1, 0.7, 1],
                    boxShadow: [
                      '0 0 0 0 rgba(0, 209, 122, 0.4)',
                      '0 0 0 15px rgba(0, 209, 122, 0)',
                      '0 0 0 0 rgba(0, 209, 122, 0)',
                    ],
                  }}
                  transition={{
                    duration: 1.5,
                    ease: 'easeInOut',
                    repeat: Infinity,
                  }}
                />

                {/* 扫描文字 */}
                <motion.div 
                  className="absolute bottom-4 text-[#00d17a]/70 text-sm"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  正在扫描依赖...
                </motion.div>
              </motion.div>

              {/* Phase Indicators */}
              <motion.div 
                className="space-y-3"
                variants={analysisPhaseContainer}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {phases.map((phase, index) => (
                  <motion.div
                    key={phase.id}
                    variants={analysisPhase}
                    custom={index}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      phase.status === 'active'
                        ? 'bg-[#00d17a]/5 border-[#00d17a]/30'
                        : phase.status === 'completed'
                        ? 'bg-[#151515] border-[#2a2a2a]'
                        : 'bg-[#151515]/50 border-[#2a2a2a]/50'
                    }`}
                  >
                    <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                      {phase.status === 'active' && (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1.5, ease: 'linear', repeat: Infinity }}
                        >
                          <Loader2 className="w-5 h-5 text-[#00d17a]" />
                        </motion.div>
                      )}
                      {phase.status === 'completed' && (
                        <motion.div
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                        >
                          <Check className="w-5 h-5 text-[#00d17a]" />
                        </motion.div>
                      )}
                      {phase.status === 'pending' && (
                        <motion.div 
                          className="w-2 h-2 rounded-full bg-[#3a3a3a]"
                          animate={{ opacity: [0.3, 0.7, 0.3] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        />
                      )}
                    </div>
                    <motion.span
                      initial={false}
                      animate={{
                        color: phase.status === 'active' 
                          ? '#ffffff' 
                          : phase.status === 'completed' 
                          ? '#a0a0a0' 
                          : '#505050'
                      }}
                      className="text-sm"
                    >
                      {phase.label}
                    </motion.span>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          ) : (
            /* Analysis Complete */
            <motion.div
              key="results"
              variants={resultsEnter}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <AnimatePresence mode="wait">
                {selectedMissingDep ? (
                  /* Version Selection for Missing Dependency */
                  <motion.div
                    key="version-select"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                  {/* 返回按钮和信息 */}
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedMissingDep(null);
                        setAvailableVersions([]);
                      }}
                      className="text-[#a0a0a0] hover:text-white"
                    >
                      <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
                      返回
                    </Button>
                    <div className="flex items-center gap-2">
                      {selectedMissingDep.iconUrl && (
                        <img
                          src={selectedMissingDep.iconUrl}
                          alt=""
                          className="w-6 h-6 rounded"
                        />
                      )}
                      <span className="text-white font-medium">{selectedMissingDep.name}</span>
                      <Badge className={`${getTypeBg(selectedMissingDep.type)} ${getTypeColor(selectedMissingDep.type)} border-0`}>
                        {getTypeLabel(selectedMissingDep.type)}
                      </Badge>
                    </div>
                  </div>

                  <div className="text-sm text-[#707070]">{selectedMissingDep.description}</div>

                  {loadingVersions ? (
                    <div className="flex items-center justify-center py-12">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, ease: 'linear', repeat: Infinity }}
                      >
                        <Loader2 className="w-8 h-8 text-[#00d17a]" />
                      </motion.div>
                    </div>
                  ) : availableVersions.length === 0 ? (
                    <div className="text-center py-8 text-[#707070]">
                      <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>没有找到可用版本</p>
                      <p className="text-xs mt-2 text-[#505050]">
                        {selectedMissingDep?.specifiedVersionId 
                          ? `指定版本 ID: ${selectedMissingDep.specifiedVersionId}`
                          : '该项目可能没有发布版本'}
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[300px] w-full">
                      <div className="space-y-2 pr-3">
                        {availableVersions.map((v, index) => {
                          const compatibility = checkVersionCompatibility(v);
                          return (
                            <motion.div
                              key={v.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.03 }}
                              className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                                compatibility.isCompatible
                                  ? 'bg-[#00d17a]/10 border-[#00d17a]/50 shadow-[0_0_10px_rgba(0,209,122,0.1)]'
                                  : 'bg-[#151515] border-[#2a2a2a]'
                              }`}
                            >
                              <div className="flex-1 min-w-0 mr-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`font-medium ${compatibility.isCompatible ? 'text-[#00d17a]' : 'text-white'}`}>
                                    {v.version_number}
                                  </span>
                                  {compatibility.isCompatible && (
                                    <Badge className="bg-[#00d17a] text-black border-0 text-[10px] h-5 px-1.5">
                                      <Check className="w-3 h-3 mr-0.5" />
                                      推荐
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-[#707070] mt-1 truncate">
                                  {v.files?.find((f: any) => f.primary)?.filename || v.files?.[0]?.filename}
                                </p>
                                {/* 加载器和游戏版本元数据 */}
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  {v.loaders?.map((loader: string) => {
                                    const isMatchedLoader = serverConfig?.loader === loader;
                                    return (
                                      <Badge
                                        key={loader}
                                        variant="outline"
                                        className={`text-[10px] h-5 px-1.5 ${
                                          isMatchedLoader
                                            ? 'border-[#00d17a] text-[#00d17a] bg-[#00d17a]/10'
                                            : 'border-[#3a3a3a] text-[#606060]'
                                        }`}
                                      >
                                        {loader}
                                        {isMatchedLoader && <Check className="w-3 h-3 ml-0.5" />}
                                      </Badge>
                                    );
                                  })}
                                  {v.game_versions?.slice(0, 5).map((ver: string) => {
                                    const isMatchedVersion = serverConfig?.minecraftVersion === ver;
                                    return (
                                      <Badge
                                        key={ver}
                                        variant="outline"
                                        className={`text-[10px] h-5 px-1.5 ${
                                          isMatchedVersion
                                            ? 'border-[#00d17a] text-[#00d17a] bg-[#00d17a]/10'
                                            : 'border-[#3a3a3a] text-[#606060]'
                                        }`}
                                      >
                                        {ver}
                                        {isMatchedVersion && <Check className="w-3 h-3 ml-0.5" />}
                                      </Badge>
                                    );
                                  })}
                                  {v.game_versions?.length > 5 && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] h-5 px-1.5 border-[#2a2a2a] text-[#505050]"
                                    >
                                      +{v.game_versions.length - 5}
                                    </Badge>
                                  )}
                                  {/* 不兼容提示 */}
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
                              <Button
                                size="sm"
                                onClick={() => addDependencyToQueue(v)}
                                className={`${
                                  compatibility.isCompatible
                                    ? 'bg-[#00d17a] hover:bg-[#00c06e] text-black'
                                    : 'bg-[#2a2a2a] hover:bg-[#333] text-white border border-[#3a3a3a]'
                                }`}
                              >
                                <ListPlus className="w-4 h-4 mr-1" />
                                {compatibility.isCompatible ? '添加' : '仍添加'}
                              </Button>
                            </motion.div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </motion.div>
              ) : (
                /* Analysis Results - 无分类 */
                <motion.div
                  key="results-content"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {/* Summary */}
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-[#151515] border border-[#2a2a2a]">
                    <div className="flex-1">
                      <div className="text-sm text-[#707070] mb-1">分析结果</div>
                      <div className="flex items-center gap-4">
                        {(() => {
                          const count = dependencies.filter((d) => d.status === 'installed').length;
                          const hasMissing = missingDependencies.length > 0;
                          if (count === 0 && hasMissing) return null;
                          return (
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="w-5 h-5 text-[#00d17a]" />
                              <span className="text-white">
                                {count === 0 ? '无条件' : `${count} 已满足`}
                              </span>
                            </div>
                          );
                        })()}
                        {missingDependencies.length > 0 && (
                          <div className="flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-[#f1c40f]" />
                            <span className="text-[#f1c40f]">
                              {missingDependencies.length} 需添加
                            </span>
                          </div>
                        )}
                        {optionalDependencies.length > 0 && (
                          <div className="flex items-center gap-2">
                            <Info className="w-5 h-5 text-[#1b8fff]" />
                            <span className="text-[#1b8fff]">
                              {optionalDependencies.length} 可添加
                            </span>
                          </div>
                        )}
                        {dependencies.some((d) => d.status === 'conflict') && (
                          <div className="flex items-center gap-2">
                            <ShieldX className="w-5 h-5 text-[#e74c3c]" />
                            <span className="text-[#e74c3c]">
                              {dependencies.filter((d) => d.status === 'conflict').length} 冲突
                            </span>
                          </div>
                        )}
                        {dependencies.some((d) => d.status === 'version-mismatch') && (
                          <div className="flex items-center gap-2">
                            <RefreshCw className="w-5 h-5 text-[#e67e22]" />
                            <span className="text-[#e67e22]">
                              {dependencies.filter((d) => d.status === 'version-mismatch').length} 需更新
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Dependencies List - 无分类 Tabs */}
                  <ScrollArea className="h-[240px] w-full">
                    <motion.div 
                      className="space-y-2 pr-3"
                      initial="hidden"
                      animate="visible"
                      variants={{
                        hidden: { opacity: 0 },
                        visible: {
                          opacity: 1,
                          transition: {
                            staggerChildren: 0.04,
                            delayChildren: 0.1,
                          },
                        },
                      }}
                    >
                      {dependencies.map((dep) => (
                        <motion.div
                          key={dep.projectId}
                          variants={dependencyItem}
                          className={`flex items-center gap-3 p-3 rounded-lg border ${
                            dep.status === 'conflict'
                              ? 'bg-[#e74c3c]/5 border-[#e74c3c]/30'
                              : dep.status === 'missing'
                              ? 'bg-[#f1c40f]/5 border-[#f1c40f]/30'
                              : dep.status === 'version-mismatch'
                              ? 'bg-[#e67e22]/5 border-[#e67e22]/30'
                              : 'bg-[#151515] border-[#2a2a2a]'
                          }`}
                        >
                          {/* Status Icon */}
                          <motion.div
                            variants={{
                              hidden: { scale: 0 },
                              visible: { 
                                scale: 1,
                                transition: { type: 'spring', stiffness: 500 }
                              }
                            }}
                          >
                            {getStatusIcon(dep.status)}
                          </motion.div>

                          {/* Icon */}
                          <div className="w-10 h-10 rounded-lg bg-[#1a1a1a] flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {dep.iconUrl ? (
                              <img src={dep.iconUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-5 h-5 text-[#707070]" />
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-medium text-sm truncate">{dep.name}</span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] h-5 px-1.5 border-[#2a2a2a] ${getTypeColor(dep.type)}`}
                              >
                                {getTypeLabel(dep.type)}
                              </Badge>
                              {dep.specifiedVersionId && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] h-5 px-1.5 border-[#00d17a]/50 text-[#00d17a] bg-[#00d17a]/10"
                                  title={`指定版本 ID: ${dep.specifiedVersionId}`}
                                >
                                  指定版本
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span
                                className={`text-xs ${
                                  dep.status === 'installed' || dep.status === 'not-installed'
                                    ? 'text-[#00d17a]'
                                    : dep.status === 'conflict'
                                    ? 'text-[#e74c3c]'
                                    : dep.status === 'missing'
                                    ? 'text-[#f1c40f]'
                                    : dep.status === 'version-mismatch'
                                    ? 'text-[#e67e22]'
                                    : 'text-[#707070]'
                                }`}
                              >
                                {dep.status === 'installed' && dep.installedMod
                                  ? `已安装 v${dep.installedMod.versionNumber || '?'}`
                                  : dep.status === 'version-mismatch' && dep.installedMod
                                  ? `当前 v${dep.installedMod.versionNumber || '?'} → 需 v${dep.specifiedVersionNumber || dep.specifiedVersionId?.slice(0, 8) || '?'}`
                                  : getStatusText(dep.status)}
                              </span>
                            </div>
                          </div>

                          {/* Action */}
                          {dep.status === 'missing' && (
                            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                              <Button
                                size="sm"
                                onClick={() => fetchVersionsForDependency(dep)}
                                className="bg-[#f1c40f] hover:bg-[#d4ac0d] text-black text-xs h-7"
                              >
                                <ListPlus className="w-3 h-3 mr-1" />
                                添加
                              </Button>
                            </motion.div>
                          )}

                          {dep.status === 'version-mismatch' && (
                            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                              <Button
                                size="sm"
                                onClick={() => handleReplaceVersion(dep)}
                                className="bg-[#e67e22] hover:bg-[#d35400] text-white text-xs h-7"
                              >
                                <RefreshCw className="w-3 h-3 mr-1" />
                                替换
                              </Button>
                            </motion.div>
                          )}

                          {dep.status === 'conflict' && dep.installedMod && (
                            <a
                              href={`https://modrinth.com/mod/${dep.installedMod.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#707070] hover:text-[#00d17a] transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </motion.div>
                      ))}
                    </motion.div>
                  </ScrollArea>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2a2a2a]">
                    <Button variant="outline" onClick={onClose} className="border-[#2a2a2a] text-[#a0a0a0] hover:text-white">
                      取消
                    </Button>

                    {hasRequiredMissing ? (
                      <Button
                        onClick={handleAddAll}
                        className="bg-[#2a2a2a] hover:bg-[#333] text-white border border-[#3a3a3a]"
                      >
                        <ShieldAlert className="w-4 h-4 mr-2" />
                        仍添加
                      </Button>
                    ) : hasBlockingIssues ? (
                      <Button
                        onClick={handleAddAll}
                        className="bg-[#e74c3c] hover:bg-[#c0392b] text-white"
                      >
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        强制添加
                      </Button>
                    ) : (
                      <Button onClick={handleAddAll} className="bg-[#00d17a] hover:bg-[#00c06e] text-black">
                        <ShieldCheck className="w-4 h-4 mr-2" />
                        {mode === 'update' ? '确认更新' : '添加'}
                      </Button>
                    )}
                  </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
