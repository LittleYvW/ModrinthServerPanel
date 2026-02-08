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
  const params = new URLSearchParams();
  
  if (filters.loaders) {
    filters.loaders.forEach(loader => params.append('loaders[]', loader));
  }
  if (filters.game_versions) {
    filters.game_versions.forEach(v => params.append('game_versions[]', v));
  }
  
  const response = await api.get(
    `/project/${projectId}/version?${params.toString()}`
  );
  return response.data;
}

// 获取版本详情
export async function getVersion(versionId: string) {
  const response = await api.get(`/version/${versionId}`);
  return response.data;
}

// 分析环境类型（支持 version 或 project 对象）
export function analyzeEnvironment(data: any): {
  client: 'required' | 'optional' | 'unsupported';
  server: 'required' | 'optional' | 'unsupported';
  category: 'both' | 'server-only' | 'client-only';
} {
  // 兼容 version 对象 (client_support/server_support) 和 project 对象 (client_side/server_side)
  const client = data.client_support || data.client_side || 'required';
  const server = data.server_support || data.server_side || 'required';
  
  // 确定分类
  // 优先级: server-only > client-only > both
  let category: 'both' | 'server-only' | 'client-only';
  
  if (server === 'required') {
    // 优先标记为服务端模组
    category = 'server-only';
  } else if (client === 'required') {
    category = 'client-only';
  } else {
    // 默认分类
    category = 'both';
  }
  
  return {
    client,
    server,
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
