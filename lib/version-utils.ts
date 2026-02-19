/**
 * 版本号比较工具
 */

/**
 * 提取纯 mod 版本号（去掉 Minecraft 版本前缀）
 * e.g., "1.21.1-6.0.9" -> "6.0.9"
 * e.g., "mc1.20-1.2.3" -> "1.2.3"
 * e.g., "6.0.9" -> "6.0.9"
 */
function extractModVersion(version: string): string {
  // 移除前缀 'v' 或 'V'
  const cleanVersion = version.replace(/^v/i, '');
  
  // 分割所有部分（按 - 或 +）
  const parts = cleanVersion.split(/[-+]/);
  
  // 如果有多段，找到第一个看起来像 Minecraft 版本的前缀（如 1.21.1, 1.20 等）
  // 返回最后一个有效版本号段（通常是 mod 版本）
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    // 如果这段包含数字和点，看起来像一个版本号，返回它及之后的所有部分
    if (/^\d[\d.]*/.test(part)) {
      return parts.slice(i).join('-');
    }
  }
  
  return cleanVersion;
}

/**
 * 解析版本号为数字数组
 * e.g., "1.20.1" -> [1, 20, 1]
 * e.g., "2.0-beta.3" -> [2, 0, 0, -3] (beta 标记为负数)
 */
function parseVersion(version: string): number[] {
  // 提取纯 mod 版本号（去掉 Minecraft 版本前缀如 1.21.1-）
  const modVersion = extractModVersion(version);
  
  // 分割主版本和预发布标签
  const [mainVersion, preRelease] = modVersion.split(/[-+]/);
  
  // 解析主版本号
  const parts = mainVersion.split('.').map(part => {
    const num = parseInt(part, 10);
    return isNaN(num) ? 0 : num;
  });
  
  // 如果有预发布标签，降低版本权重
  if (preRelease) {
    const preReleaseLower = preRelease.toLowerCase();
    if (preReleaseLower.includes('alpha')) {
      parts.push(-3);
    } else if (preReleaseLower.includes('beta')) {
      parts.push(-2);
    } else if (preReleaseLower.includes('rc') || preReleaseLower.includes('pre')) {
      parts.push(-1);
    } else {
      // 尝试提取预发布版本号
      const match = preRelease.match(/(\d+)/);
      if (match) {
        parts.push(-parseInt(match[1], 10));
      } else {
        parts.push(-1);
      }
    }
  }
  
  return parts;
}

/**
 * 比较两个版本号
 * @returns -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = parseVersion(v1);
  const parts2 = parseVersion(v2);
  
  const maxLength = Math.max(parts1.length, parts2.length);
  
  for (let i = 0; i < maxLength; i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    
    if (part1 < part2) return -1;
    if (part1 > part2) return 1;
  }
  
  return 0;
}

/**
 * 检查 v1 是否小于 v2（v1 有更新版本 v2）
 */
export function isNewerVersion(current: string, latest: string): boolean {
  return compareVersions(current, latest) < 0;
}

/**
 * 获取最新版本
 */
export function getLatestVersion(versions: string[]): string | null {
  if (versions.length === 0) return null;
  
  return versions.reduce((latest, current) => {
    return compareVersions(current, latest) > 0 ? current : latest;
  });
}

/**
 * 格式化版本号显示
 * e.g., "1.20.1+build.1" -> "1.20.1"
 * e.g., "1.21.1-6.0.9" -> "6.0.9" (去掉 Minecraft 版本前缀)
 */
export function formatVersion(version: string): string {
  if (!version) return '';
  // 如果版本号包含 '-'，取最后一段（通常是纯 mod 版本）
  const parts = version.replace(/^v/i, '').split(/[-+]/);
  if (parts.length > 1 && /^\d/.test(parts[parts.length - 1])) {
    return parts[parts.length - 1];
  }
  return parts[0];
}

/**
 * 版本比较结果
 */
export interface VersionComparisonResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  latestVersionId: string | null;
}
