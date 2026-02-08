import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const MODS_FILE = path.join(DATA_DIR, 'mods.json');
const AUTH_FILE = path.join(DATA_DIR, 'auth.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 默认配置
const defaultConfig: ServerConfig = {
  path: '',
  minecraftVersion: '',
  loader: 'fabric',
  loaderVersion: '',
  showServerOnlyMods: true,
};

// 默认管理员密码 (admin)
const defaultAuth = {
  password: 'admin',
};

// 初始化文件
function initFile<T>(filePath: string, defaultData: T): T {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf-8');
    return defaultData;
  }
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf-8');
    return defaultData;
  }
}

// 服务端配置
export interface ServerConfig {
  path: string;
  minecraftVersion: string;
  loader: 'fabric' | 'forge' | 'quilt' | 'neoforge';
  loaderVersion: string;
  showServerOnlyMods?: boolean;
}

export function getConfig(): ServerConfig {
  return initFile(CONFIG_FILE, defaultConfig);
}

export function saveConfig(config: ServerConfig): void {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

// 模组环境类型
export type Environment = 'required' | 'optional' | 'unsupported';

export interface ModEnvironment {
  client: Environment;
  server: Environment;
}

// 模组信息
export interface Mod {
  id: string;           // Modrinth project ID
  slug: string;         // URL slug
  name: string;         // 显示名称
  versionId: string;    // Modrinth version ID
  filename: string;     // 文件名
  environment: ModEnvironment;
  category: 'both' | 'server-only' | 'client-only';
  installedAt: string;
  iconUrl?: string;
  description?: string;
  versionNumber?: string;
}

export function getMods(): Mod[] {
  return initFile(MODS_FILE, []);
}

export function saveMods(mods: Mod[]): void {
  fs.writeFileSync(MODS_FILE, JSON.stringify(mods, null, 2), 'utf-8');
}

export function addMod(mod: Mod): void {
  const mods = getMods();
  // 检查是否已存在
  const existingIndex = mods.findIndex(m => m.id === mod.id);
  if (existingIndex >= 0) {
    mods[existingIndex] = mod;
  } else {
    mods.push(mod);
  }
  saveMods(mods);
}

export function removeMod(id: string): void {
  const mods = getMods();
  saveMods(mods.filter(m => m.id !== id));
}

export function getModById(id: string): Mod | undefined {
  return getMods().find(m => m.id === id);
}

// 获取分类后的模组
export function getCategorizedMods() {
  const mods = getMods();
  return {
    both: mods.filter(m => m.category === 'both'),
    serverOnly: mods.filter(m => m.category === 'server-only'),
    clientOnly: mods.filter(m => m.category === 'client-only'),
  };
}

// 管理员认证
export function getAuth(): { password: string } {
  return initFile(AUTH_FILE, defaultAuth);
}

export function saveAuth(password: string): void {
  fs.writeFileSync(AUTH_FILE, JSON.stringify({ password }, null, 2), 'utf-8');
}

export function verifyPassword(password: string): boolean {
  const auth = getAuth();
  return auth.password === password;
}
