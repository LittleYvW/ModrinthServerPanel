'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  FileJson,
  FileCode,
  FileType,
  Plus,
  RefreshCw,
  Search,
  FolderOpen,
  Check,
  AlertCircle,
  ChevronRight,
  Link2,
  Unlink,
  Sparkles,
  Loader2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  staggerContainer,
  listItem,
} from '@/lib/animations';
import { ModConfigEditor } from './mod-config-editor';

// 配置文件信息
interface ModConfigFile {
  path: string;
  type: 'json' | 'json5' | 'toml';
  autoDetected: boolean;
  linkedAt: string;
}

// 可用文件
interface AvailableFile {
  path: string;
  name: string;
  type: 'json' | 'json5' | 'toml';
  size: number;
  modifiedAt: string;
}

// 模组设置对话框属性
interface ModSettingsDialogProps {
  modId: string;
  modName: string;
  isOpen: boolean;
  onClose: () => void;
}

// 文件类型图标
const FileTypeIcon = ({ type, className }: { type: string; className?: string }) => {
  switch (type) {
    case 'json':
    case 'json5':
      return <FileJson className={className} />;
    case 'toml':
      return <FileCode className={className} />;
    default:
      return <FileType className={className} />;
  }
};

// 获取文件类型颜色
const getFileTypeColor = (type: string) => {
  switch (type) {
    case 'json':
      return 'text-[#00d17a] bg-[#00d17a]/10 border-[#00d17a]/20';
    case 'json5':
      return 'text-[#1b8fff] bg-[#1b8fff]/10 border-[#1b8fff]/20';
    case 'toml':
      return 'text-[#9b59b6] bg-[#9b59b6]/10 border-[#9b59b6]/20';
    default:
      return 'text-[#707070] bg-[#2a2a2a] border-[#3a3a3a]';
  }
};

// 格式化文件大小
const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function ModSettingsDialog({ modId, modName, isOpen, onClose }: ModSettingsDialogProps) {
  const [linkedFiles, setLinkedFiles] = useState<ModConfigFile[]>([]);
  const [availableFiles, setAvailableFiles] = useState<AvailableFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<ModConfigFile | null>(null);
  const [activeTab, setActiveTab] = useState('linked');
  const [, setError] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<Array<{ modId: string; modName: string; files: Array<{ path: string; type: string }> }> | null>(null);
  const [showScanResults, setShowScanResults] = useState(false);
  const [scanAnimationKey, setScanAnimationKey] = useState(0);
  const [linkingFiles, setLinkingFiles] = useState<Set<string>>(new Set());
  
  // 加载已关联的文件
  const loadLinkedFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/mod-configs?modId=${encodeURIComponent(modId)}`);
      const data = await res.json();
      
      if (data.config) {
        setLinkedFiles(data.config.files || []);
      } else {
        setLinkedFiles([]);
      }
    } catch (err) {
      console.error('Failed to load linked files:', err);
    }
  }, [modId]);
  
  // 加载所有可用文件
  const loadAvailableFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/mod-configs/all-files');
      const data = await res.json();
      
      if (data.success) {
        setAvailableFiles(data.files || []);
      }
    } catch (err) {
      console.error('Failed to load available files:', err);
    }
  }, []);
  
  // 初始加载
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      Promise.all([loadLinkedFiles(), loadAvailableFiles()]).finally(() => {
        setLoading(false);
      });
    }
  }, [isOpen, loadLinkedFiles, loadAvailableFiles]);
  
  // 扫描配置文件
  const handleScan = async () => {
    setScanning(true);
    setError(null);
    setScanResults(null);
    setShowScanResults(false);
    
    try {
      const res = await fetch('/api/mod-configs/scan', { method: 'POST' });
      const data = await res.json();
      
      if (data.success) {
        // 查找当前模组的结果
        const modResult = data.scanned.find((r: { modId: string }) => r.modId === modId);
        if (modResult) {
          setScanResults([modResult]);
        } else {
          setScanResults([]);
        }
        
        // 重新加载关联文件
        await loadLinkedFiles();
        
        // 显示扫描结果提示
        setShowScanResults(true);
        
        // 触发扫描动画
        setScanAnimationKey(prev => prev + 1);
        
        // 3秒后自动隐藏扫描结果提示
        setTimeout(() => {
          setShowScanResults(false);
        }, 3000);
        
        // 显示结果后切换回关联标签
        setTimeout(() => {
          setActiveTab('linked');
        }, 1500);
      } else {
        setError(data.error || '扫描失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '扫描失败');
    } finally {
      setScanning(false);
    }
  };
  
  // 手动关联文件
  const handleLinkFile = async (file: AvailableFile) => {
    // 先添加向左滑出动画
    setLinkingFiles(prev => new Set(prev).add(file.path));
    
    // 等待动画完成后再执行关联
    setTimeout(async () => {
      try {
        const res = await fetch('/api/mod-configs', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modId,
            modName,
            file: {
              path: file.path,
              type: file.type,
              autoDetected: false,
            },
          }),
        });
        
        if (res.ok) {
          await loadLinkedFiles();
          // 关联成功后保持在当前标签页，不自动切换
        }
      } catch (err) {
        console.error('Failed to link file:', err);
      } finally {
        // 从动画集合中移除
        setLinkingFiles(prev => {
          const next = new Set(prev);
          next.delete(file.path);
          return next;
        });
      }
    }, 300); // 动画持续时间
  };
  
  // 取消关联文件
  const handleUnlinkFile = async (filePath: string) => {
    try {
      const res = await fetch(`/api/mod-configs?modId=${encodeURIComponent(modId)}&filePath=${encodeURIComponent(filePath)}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        await loadLinkedFiles();
        if (selectedFile?.path === filePath) {
          setSelectedFile(null);
        }
      }
    } catch (err) {
      console.error('Failed to unlink file:', err);
    }
  };
  
  // 过滤可用文件
  const filteredAvailableFiles = availableFiles.filter(file => {
    // 排除已关联的文件
    if (linkedFiles.some(lf => lf.path === file.path)) return false;
    
    // 搜索过滤
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return file.path.toLowerCase().includes(query) || 
           file.name.toLowerCase().includes(query);
  });
  
  // 过滤已关联文件
  const filteredLinkedFiles = linkedFiles.filter(file => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return file.path.toLowerCase().includes(query);
  });
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[88vw] h-[75vh] p-0 bg-[#151515] border-[#2a2a2a] overflow-hidden sm:max-w-[1100px] rounded-xl">
        {selectedFile ? (
          // 编辑器视图
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="h-full flex flex-col"
          >
            {/* 编辑器头部 - 使用 sr-only 标题满足可访问性要求 */}
            <DialogHeader className="p-4 pb-2 border-b border-[#2a2a2a]">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFile(null)}
                  className="text-[#a0a0a0] hover:text-white"
                >
                  <ChevronRight className="w-4 h-4 mr-1 rotate-180" />
                  返回文件列表
                </Button>
                
                {/* 屏幕阅读器专用标题 */}
                <DialogTitle className="sr-only">
                  编辑配置文件 - {selectedFile.path}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  正在编辑 {modName} 的配置文件 {selectedFile.path}
                </DialogDescription>
                
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn('border-0', getFileTypeColor(selectedFile.type))}>
                    {selectedFile.type.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </DialogHeader>
            
            {/* 编辑器内容 */}
            <div className="flex-1 overflow-hidden">
              <ModConfigEditor
                modId={modId}
                modName={modName}
                filePath={selectedFile.path}
                fileType={selectedFile.type}
                onClose={() => setSelectedFile(null)}
              />
            </div>
          </motion.div>
        ) : (
          // 文件列表视图
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="h-full flex flex-col"
          >
            {/* 头部 */}
            <DialogHeader className="p-6 pb-4 border-b border-[#2a2a2a]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#00d17a]/10 flex items-center justify-center">
                    <Settings className="w-5 h-5 text-[#00d17a]" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-semibold text-white">
                      {modName}
                    </DialogTitle>
                    <p className="text-sm text-[#707070]">
                      配置文件管理
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {/* 扫描按钮 */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleScan}
                    disabled={scanning}
                    className={cn(
                      "border-[#2a2a2a] text-[#a0a0a0] hover:text-[#00d17a] hover:border-[#00d17a]/50 relative overflow-hidden",
                      scanning && "border-[#00d17a]/30 text-[#00d17a]"
                    )}
                  >
                    {scanning ? (
                      <>
                        {/* 扫描动画效果 */}
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-[#00d17a]/10 to-transparent"
                          animate={{
                            x: ['-100%', '100%'],
                          }}
                          transition={{
                            duration: 1.5,
                            ease: 'linear',
                            repeat: Infinity,
                          }}
                        />
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, ease: 'linear', repeat: Infinity }}
                          className="mr-2 relative z-10"
                        >
                          <Loader2 className="w-4 h-4" />
                        </motion.div>
                        <span className="relative z-10">扫描中...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        自动扫描
                      </>
                    )}
                  </Button>
                </div>
              </div>
              
              {/* 搜索框 */}
              <div className="mt-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#707070]" />
                <Input
                  placeholder="搜索配置文件..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder:text-[#707070]"
                />
              </div>
            </DialogHeader>
            
            {/* 扫描结果提示 - 带布局动画 */}
            <AnimatePresence>
              {showScanResults && scanResults && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ 
                    opacity: 1, 
                    height: 'auto',
                  }}
                  exit={{ 
                    opacity: 0, 
                    height: 0,
                  }}
                  transition={{
                    duration: 0.3,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                  style={{ overflow: 'hidden' }}
                  className="px-6"
                >
                  <motion.div
                    initial={{ y: -20, scale: 0.95 }}
                    animate={{ 
                      y: 0, 
                      scale: 1,
                      transition: { delay: 0.05, duration: 0.25, ease: [0.4, 0, 0.2, 1] }
                    }}
                    exit={{ 
                      y: -10, 
                      scale: 0.98,
                      transition: { duration: 0.2 }
                    }}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg border mb-4',
                      scanResults.length > 0 
                        ? 'bg-[#00d17a]/10 text-[#00d17a] border-[#00d17a]/20' 
                        : 'bg-[#707070]/10 text-[#a0a0a0] border-[#707070]/20'
                    )}
                  >
                    {scanResults.length > 0 ? (
                      <>
                        <motion.div
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0, rotate: 180 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 15, delay: 0.1 }}
                        >
                          <Check className="w-5 h-5" />
                        </motion.div>
                        <span className="font-medium">扫描完成！找到 {scanResults[0]?.files?.length || 0} 个相关配置文件</span>
                      </>
                    ) : (
                      <>
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 15, delay: 0.1 }}
                        >
                          <AlertCircle className="w-5 h-5" />
                        </motion.div>
                        <span className="font-medium">未找到相关配置文件</span>
                      </>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* 标签页 */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <div className="px-6 pt-4">
                <TabsList className="bg-[#1a1a1a] border border-[#2a2a2a]">
                  <TabsTrigger 
                    value="linked" 
                    className="data-[state=active]:bg-[#262626] data-[state=active]:text-white text-[#707070]"
                  >
                    <Link2 className="w-4 h-4 mr-2" />
                    已关联
                    {linkedFiles.length > 0 && (
                      <Badge variant="secondary" className="ml-2 bg-[#00d17a]/20 text-[#00d17a]">
                        {linkedFiles.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="available"
                    className="data-[state=active]:bg-[#262626] data-[state=active]:text-white text-[#707070]"
                  >
                    <FolderOpen className="w-4 h-4 mr-2" />
                    可用文件
                  </TabsTrigger>
                </TabsList>
              </div>
              
              {/* 已关联文件列表 */}
              <TabsContent value="linked" className="flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden relative">
                <ScrollArea className="h-full w-full absolute inset-0" type="always">
                  <div className="px-6 pb-6">
                  {loading ? (
                    <div className="flex items-center justify-center h-32">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, ease: 'linear', repeat: Infinity }}
                      >
                        <RefreshCw className="w-6 h-6 text-[#00d17a]" />
                      </motion.div>
                    </div>
                  ) : filteredLinkedFiles.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center justify-center h-64 text-center"
                    >
                      <Link2 className="w-12 h-12 text-[#3a3a3a] mb-4" />
                      <h3 className="text-lg font-medium text-white mb-2">
                        暂无关联的配置文件
                      </h3>
                      <p className="text-sm text-[#707070] max-w-sm mb-6">
                        点击&quot;自动扫描&quot;查找相关配置文件，或切换到&quot;可用文件&quot;标签手动添加
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => setActiveTab('available')}
                        className="border-[#2a2a2a] text-[#a0a0a0] hover:text-white"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        手动添加
                      </Button>
                    </motion.div>
                  ) : (
                    <div
                      key={scanAnimationKey}
                      className="space-y-2 pt-4"
                    >
                      {filteredLinkedFiles.map((file, index) => (
                        <motion.div
                          key={file.path}
                          initial={{ opacity: 0, x: 80 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{
                            type: 'spring',
                            stiffness: 300,
                            damping: 25,
                            delay: index * 0.06,
                          }}
                          className={cn(
                            "group flex items-center gap-3 p-3 rounded-lg border",
                            file.autoDetected 
                              ? "bg-[#00d17a]/5 border-[#00d17a]/20 hover:border-[#00d17a]/40 hover:bg-[#00d17a]/10" 
                              : "bg-[#1a1a1a] border-[#2a2a2a] hover:border-[#3a3a3a]"
                          )}
                        >
                          <div className={cn(
                            'p-2 rounded-lg',
                            getFileTypeColor(file.type)
                          )}>
                            <FileTypeIcon type={file.type} className="w-5 h-5" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {file.path}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className={cn('text-[10px] h-4 px-1 border-0', getFileTypeColor(file.type))}>
                                {file.type.toUpperCase()}
                              </Badge>
                              {file.autoDetected && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1 bg-[#00d17a]/10 text-[#00d17a] border-[#00d17a]/20">
                                  <Sparkles className="w-3 h-3 mr-1" />
                                  自动
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedFile(file)}
                              className="h-8 text-[#a0a0a0] hover:text-[#00d17a] hover:bg-[#00d17a]/10"
                            >
                              编辑
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleUnlinkFile(file.path)}
                              className="h-8 w-8 text-[#707070] hover:text-[#e74c3c] hover:bg-[#e74c3c]/10"
                            >
                              <Unlink className="w-4 h-4" />
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              {/* 可用文件列表 */}
              <TabsContent value="available" className="flex-1 overflow-hidden mt-0 data-[state=inactive]:hidden relative">
                <ScrollArea className="h-full w-full absolute inset-0" type="always">
                  <div className="px-6 pb-6">
                  {loading ? (
                    <div className="flex items-center justify-center h-32">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, ease: 'linear', repeat: Infinity }}
                      >
                        <RefreshCw className="w-6 h-6 text-[#00d17a]" />
                      </motion.div>
                    </div>
                  ) : filteredAvailableFiles.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center justify-center h-64 text-center"
                    >
                      <FolderOpen className="w-12 h-12 text-[#3a3a3a] mb-4" />
                      <h3 className="text-lg font-medium text-white mb-2">
                        没有可用的配置文件
                      </h3>
                      <p className="text-sm text-[#707070]">
                        config 目录中没有找到未关联的配置文件
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      variants={staggerContainer}
                      initial="hidden"
                      animate="visible"
                      className="space-y-2 pt-4"
                    >
                      {filteredAvailableFiles.map((file) => (
                        <motion.div
                          key={file.path}
                          variants={listItem}
                          layout
                          animate={{
                            x: linkingFiles.has(file.path) ? -400 : 0,
                            opacity: linkingFiles.has(file.path) ? 0 : 1,
                          }}
                          transition={{
                            x: { type: 'spring', stiffness: 300, damping: 25 },
                            opacity: { duration: 0.2 },
                          }}
                          className="group flex items-center gap-3 p-3 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#00d17a]/50 transition-colors"
                        >
                          <div className={cn(
                            'p-2 rounded-lg',
                            getFileTypeColor(file.type)
                          )}>
                            <FileTypeIcon type={file.type} className="w-5 h-5" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {file.path}
                            </p>
                            <p className="text-xs text-[#707070]">
                              {formatFileSize(file.size)} • {new Date(file.modifiedAt).toLocaleDateString()}
                            </p>
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLinkFile(file)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-8 text-[#00d17a] hover:text-[#00d17a] hover:bg-[#00d17a]/10"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            关联
                          </Button>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ModSettingsDialog;
