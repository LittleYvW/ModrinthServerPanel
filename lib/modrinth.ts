import axios from 'axios';

const MODRINTH_API = 'https://api.modrinth.com/v2';

const api = axios.create({
  baseURL: MODRINTH_API,
  headers: {
    'User-Agent': 'ModrinthServerPanel/1.0',
  },
});

// 搜索模组
export async function searchMods(
  query: string,
  filters: {
    versions?: string;
    loaders?: string;
  } = {}
) {
  const facets: string[] = [];
  
  if (filters.versions) {
    facets.push(`["versions:${filters.versions}"]`);
  }
  if (filters.loaders) {
    facets.push(`["categories:${filters.loaders}"]`);
  }
  
  const facetParam = facets.length > 0 ? `[${facets.join(',')}]` : '';
  
  const response = await api.get('/search', {
    params: {
      query,
      facets: facetParam,
      limit: 20,
      // 指定需要的字段以获取更多信息
      index: 'relevance',
    },
  });
  
  return response.data;
}

// 获取项目详情
export async function getProject(projectId: string) {
  const response = await api.get(`/project/${projectId}`);
  return response.data;
}

// 获取项目版本列表
export async function getProjectVersions(
  projectId: string,
  filters: {
    loaders?: string[];
    game_versions?: string[];
  } = {}
) {
  // 使用 axios 的 params 选项，它会自动处理数组参数
  const params: Record<string, string[]> = {};
  
  if (filters.loaders && filters.loaders.length > 0) {
    params.loaders = filters.loaders;
  }
  if (filters.game_versions && filters.game_versions.length > 0) {
    params.game_versions = filters.game_versions;
  }
  
  console.log('[Modrinth] Fetching versions for project:', projectId, 'with params:', params);
  
  try {
    const response = await api.get(`/project/${projectId}/version`, { params });
    console.log('[Modrinth] API response status:', response.status);
    return response.data;
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string; response?: { status?: number; statusText?: string; data?: unknown }; config?: { url?: string; params?: unknown } };
    // Log error details for debugging
    console.error('[Modrinth] API error:', err.message, err.code);
    console.error('[Modrinth] API error:', {
      message: err.message,
      code: err.code,
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data,
      url: err.config?.url,
      params: err.config?.params
    });
    throw error;
  }
}

// 获取版本详情
export async function getVersion(versionId: string) {
  const response = await api.get(`/version/${versionId}`);
  return response.data;
}

// 分析环境类型（支持 version 或 project 对象）
export function analyzeEnvironment(data: { client_support?: string; server_support?: string; client_side?: string; server_side?: string }): {
  client: 'required' | 'optional' | 'unsupported';
  server: 'required' | 'optional' | 'unsupported';
  category: 'both' | 'server-only' | 'client-only';
} {
  // 兼容 version 对象 (client_support/server_support) 和 project 对象 (client_side/server_side)
  const client = data.client_support || data.client_side || 'required';
  const server = data.server_support || data.server_side || 'required';
  
  // 确定分类 - 基于 API 返回的实际数据
  let category: 'both' | 'server-only' | 'client-only';
  
  if (client === 'required' && server === 'required') {
    // 双端必需
    category = 'both';
  } else if (server === 'required' && client !== 'required') {
    // 仅服务端必需
    category = 'server-only';
  } else if (client === 'required' && server !== 'required') {
    // 仅客户端必需
    category = 'client-only';
  } else {
    // 默认分类（可选情况下）
    category = 'both';
  }
  
  return {
    client: client as 'required' | 'optional' | 'unsupported',
    server: server as 'required' | 'optional' | 'unsupported',
    category,
  };
}

// 下载文件
export async function downloadFile(url: string): Promise<ArrayBuffer> {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
  });
  return response.data;
}

export interface ModrinthProject {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon_url: string;
  client_side: 'required' | 'optional' | 'unsupported';
  server_side: 'required' | 'optional' | 'unsupported';
  downloads: number;
  follows: number;
  date_created: string;
  date_modified: string;
  author: string;
  latest_version: string;
  license: string;
}

export interface ModrinthVersion {
  id: string;
  project_id: string;
  version_number: string;
  files: {
    url: string;
    filename: string;
    primary: boolean;
  }[];
  client_support: 'required' | 'optional' | 'unsupported';
  server_support: 'required' | 'optional' | 'unsupported';
  game_versions: string[];
  loaders: string[];
}
