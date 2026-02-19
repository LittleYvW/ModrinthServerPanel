import { NextResponse } from 'next/server';
import { getMods, getConfig } from '@/lib/db';
import { getProjectVersions, analyzeEnvironment } from '@/lib/modrinth';
import { isNewerVersion, formatVersion } from '@/lib/version-utils';

// 并发控制配置
const BATCH_SIZE = 3; // 每批处理的模组数量
const BATCH_DELAY = 500; // 批次之间的延迟（毫秒）
const MAX_RETRIES = 3; // 单个模组的最大重试次数
const RETRY_DELAY = 1000; // 重试延迟（毫秒）

interface ModrinthVersion {
  id: string;
  version_number: string;
  date_published: string;
  changelog?: string;
  game_versions: string[];
  loaders: string[];
  client_support?: string;
  server_support?: string;
  client_side?: string;
  server_side?: string;
}

interface UpdateCheckResult {
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

// 延迟函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 带重试的获取版本函数
async function fetchVersionsWithRetry(
  projectId: string, 
  retries = MAX_RETRIES
): Promise<ModrinthVersion[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const versions = await getProjectVersions(projectId) as ModrinthVersion[];
      return versions || [];
    } catch (error: unknown) {
      const err = error as { response?: { status?: number }; code?: string };
      const status = err?.response?.status;
      const isRetryable = status === 502 || status === 429 || status === 503 || err?.code === 'ECONNRESET';
      
      if (isRetryable && attempt < retries) {
        const waitTime = RETRY_DELAY * attempt; // 指数退避
        console.log(`[CheckUpdates] Retry ${attempt}/${retries} for ${projectId} after ${waitTime}ms`);
        await delay(waitTime);
        continue;
      }
      
      throw error;
    }
  }
  return [];
}

// 检查单个模组的更新
async function checkModUpdate(
  mod: { id: string; name: string; slug: string; versionNumber?: string },
  minecraftVersion: string,
  loader: string
): Promise<UpdateCheckResult> {
  try {
    // 获取该模组的所有版本
    const versions = await fetchVersionsWithRetry(mod.id);
    
    if (!versions || versions.length === 0) {
      return {
        modId: mod.id,
        name: mod.name,
        slug: mod.slug,
        currentVersion: mod.versionNumber || '?',
        targetVersion: mod.versionNumber || '?',
        targetVersionId: null,
        hasUpdate: false,
        releaseDate: '',
      };
    }
    
    // 当前版本
    const currentVersion = mod.versionNumber || '0.0.0';
    
    // 按版本号排序（旧到新）
    const sortedVersions = [...versions].sort((a, b) => {
      if (isNewerVersion(a.version_number, b.version_number)) return 1;
      if (isNewerVersion(b.version_number, a.version_number)) return -1;
      return 0;
    });
    
    // 找到第一个比当前版本新且兼容的版本
    const compatibleUpdate = sortedVersions.find((v) => {
      // 必须比当前版本新
      if (!isNewerVersion(currentVersion, v.version_number)) return false;
      
      // 检查兼容性
      const gameVersionMatch = minecraftVersion 
        ? v.game_versions?.includes(minecraftVersion) ?? false
        : true;
      const loaderMatch = loader
        ? v.loaders?.includes(loader) ?? false
        : true;
      
      return gameVersionMatch && loaderMatch;
    });
    
    // 如果没有找到可更新的兼容版本
    if (!compatibleUpdate) {
      return {
        modId: mod.id,
        name: mod.name,
        slug: mod.slug,
        currentVersion: formatVersion(currentVersion),
        targetVersion: formatVersion(currentVersion),
        targetVersionId: null,
        hasUpdate: false,
        releaseDate: '',
      };
    }
    
    // 分析新版本的环境类型
    const env = analyzeEnvironment(compatibleUpdate);
    
    return {
      modId: mod.id,
      name: mod.name,
      slug: mod.slug,
      currentVersion: formatVersion(currentVersion),
      targetVersion: formatVersion(compatibleUpdate.version_number),
      targetVersionId: compatibleUpdate.id,
      hasUpdate: true,
      releaseDate: compatibleUpdate.date_published,
      changelog: compatibleUpdate.changelog,
      newCategory: env.category,
    };
  } catch (error) {
    console.error(`[CheckUpdates] Failed to check update for mod ${mod.id}:`, error);
    return {
      modId: mod.id,
      name: mod.name,
      slug: mod.slug,
      currentVersion: mod.versionNumber || '?',
      targetVersion: '?',
      targetVersionId: null,
      hasUpdate: false,
      releaseDate: '',
      error: true,
    };
  }
}

export async function GET() {
  try {
    const mods = getMods();
    const config = getConfig();
    
    // 获取服务端配置用于筛选兼容版本
    const { minecraftVersion, loader } = config;
    
    console.log(`[CheckUpdates] Starting update check for ${mods.length} mods`);
    
    // 分批处理模组，避免触发 API 限流
    const updateChecks: UpdateCheckResult[] = [];
    
    for (let i = 0; i < mods.length; i += BATCH_SIZE) {
      const batch = mods.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(mods.length / BATCH_SIZE);
      
      console.log(`[CheckUpdates] Processing batch ${batchNumber}/${totalBatches} (${batch.length} mods)`);
      
      // 并行处理当前批次
      const batchResults = await Promise.all(
        batch.map(mod => checkModUpdate(mod, minecraftVersion, loader))
      );
      
      updateChecks.push(...batchResults);
      
      // 批次之间添加延迟（除了最后一批）
      if (i + BATCH_SIZE < mods.length) {
        await delay(BATCH_DELAY);
      }
    }
    
    console.log(`[CheckUpdates] Completed. Total: ${updateChecks.length} mods checked`);
    
    // 只统计有可更新的
    const hasUpdates = updateChecks.filter((u) => u.hasUpdate);
    const upToDate = updateChecks.filter((u) => !u.hasUpdate && !u.error);
    const errors = updateChecks.filter((u) => u.error);
    
    return NextResponse.json({
      updates: updateChecks.map(u => ({...u, changelog: undefined})),
      summary: {
        total: mods.length,
        hasUpdates: hasUpdates.length,
        upToDate: upToDate.length,
        errors: errors.length,
      },
    });
  } catch (error) {
    console.error('Check updates error:', error);
    return NextResponse.json(
      { error: 'Failed to check updates' },
      { status: 500 }
    );
  }
}
