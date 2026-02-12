import { NextResponse } from 'next/server';
import { getMods, getConfig } from '@/lib/db';
import { getProjectVersions, analyzeEnvironment } from '@/lib/modrinth';
import { isNewerVersion, formatVersion } from '@/lib/version-utils';

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

export async function GET() {
  try {
    const mods = getMods();
    const config = getConfig();
    
    // 获取服务端配置用于筛选兼容版本
    const { minecraftVersion, loader } = config;
    
    // 并行检查所有模组的更新
    const updateChecks: UpdateCheckResult[] = await Promise.all(
      mods.map(async (mod) => {
        try {
          // 获取该模组的所有版本（不过滤，获取全部版本以找到任意兼容的新版本）
          const versions = await getProjectVersions(mod.id) as ModrinthVersion[];
          
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
          
          // 找到比当前版本新且兼容的任意版本（从旧到新排序，找第一个满足条件的）
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
        } catch {
          console.error(`Failed to check update for mod ${mod.id}`);
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
      })
    );
    
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
