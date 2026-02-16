import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const MODS_FILE = path.join(DATA_DIR, 'mods.json');
const AUTH_FILE = path.join(DATA_DIR, 'auth.json');
const MOD_CONFIGS_FILE = path.join(DATA_DIR, 'mod-configs.json');

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
  modManagementMode: 'classic',
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
  modManagementMode?: 'classic' | 'immersive';
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
  enabled?: boolean;    // 模组开关状态，默认为 true
  recommended?: boolean; // 客户端模组是否推荐（用于访客模式显示）
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

// 获取分类后的模组（所有模组，用于管理界面）
export function getCategorizedMods() {
  const mods = getMods();
  return {
    both: mods.filter(m => m.category === 'both'),
    serverOnly: mods.filter(m => m.category === 'server-only'),
    clientOnly: mods.filter(m => m.category === 'client-only'),
  };
}

// 获取启用的分类模组（用于访客界面）
export function getEnabledCategorizedMods() {
  const mods = getMods().filter(m => m.enabled !== false);
  return {
    both: mods.filter(m => m.category === 'both'),
    serverOnly: mods.filter(m => m.category === 'server-only'),
    clientOnly: mods.filter(m => m.category === 'client-only'),
  };
}

// 切换模组启用状态
export function toggleModEnabled(id: string): Mod | undefined {
  const mods = getMods();
  const modIndex = mods.findIndex(m => m.id === id);
  if (modIndex === -1) return undefined;
  
  mods[modIndex].enabled = !mods[modIndex].enabled;
  saveMods(mods);
  return mods[modIndex];
}

// 切换客户端模组推荐状态
export function toggleClientModRecommended(id: string): Mod | undefined {
  const mods = getMods();
  const modIndex = mods.findIndex(m => m.id === id);
  if (modIndex === -1) return undefined;
  
  // 只对客户端模组生效
  if (mods[modIndex].category !== 'client-only') return undefined;
  
  mods[modIndex].recommended = !mods[modIndex].recommended;
  saveMods(mods);
  return mods[modIndex];
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

// 检查是否使用的是默认密码
export function isDefaultPassword(): boolean {
  const auth = getAuth();
  return auth.password === defaultAuth.password;
}

// ========== 模组配置文件关联 ==========

// 配置文件信息
export interface ModConfigFile {
  path: string;           // 文件相对路径（相对于服务端目录）
  type: 'json' | 'json5' | 'toml';  // 文件类型
  autoDetected: boolean;  // 是否自动检测到
  linkedAt: string;       // 关联时间
}

// 模组配置关联
export interface ModConfig {
  modId: string;          // 模组 ID
  modName: string;        // 模组名称
  files: ModConfigFile[]; // 关联的配置文件列表
  lastScanAt?: string;    // 上次扫描时间
}

// 默认空配置
const defaultModConfigs: ModConfig[] = [];

// 获取所有模组配置关联
export function getModConfigs(): ModConfig[] {
  return initFile(MOD_CONFIGS_FILE, defaultModConfigs);
}

// 保存模组配置关联
export function saveModConfigs(configs: ModConfig[]): void {
  fs.writeFileSync(MOD_CONFIGS_FILE, JSON.stringify(configs, null, 2), 'utf-8');
}

// 获取单个模组的配置关联
export function getModConfigById(modId: string): ModConfig | undefined {
  return getModConfigs().find(c => c.modId === modId);
}

// 添加或更新模组配置关联
export function addOrUpdateModConfig(config: ModConfig): void {
  const configs = getModConfigs();
  const index = configs.findIndex(c => c.modId === config.modId);
  if (index >= 0) {
    configs[index] = config;
  } else {
    configs.push(config);
  }
  saveModConfigs(configs);
}

// 删除模组配置关联
export function removeModConfig(modId: string): void {
  const configs = getModConfigs();
  saveModConfigs(configs.filter(c => c.modId !== modId));
}

// 为模组添加配置文件
export function addModConfigFile(modId: string, modName: string, file: Omit<ModConfigFile, 'linkedAt'>): void {
  const configs = getModConfigs();
  const index = configs.findIndex(c => c.modId === modId);
  
  const newFile: ModConfigFile = {
    ...file,
    linkedAt: new Date().toISOString(),
  };
  
  if (index >= 0) {
    // 确保 files 数组存在
    if (!configs[index].files) {
      configs[index].files = [];
    }
    // 检查是否已存在相同路径的文件
    const existingIndex = configs[index].files.findIndex(f => f.path === file.path);
    if (existingIndex >= 0) {
      configs[index].files[existingIndex] = newFile;
    } else {
      configs[index].files.push(newFile);
    }
  } else {
    configs.push({
      modId,
      modName,
      files: [newFile],
      lastScanAt: new Date().toISOString(),
    });
  }
  
  saveModConfigs(configs);
}

// 移除模组的配置文件关联
export function removeModConfigFile(modId: string, filePath: string): void {
  const configs = getModConfigs();
  const index = configs.findIndex(c => c.modId === modId);
  
  if (index >= 0) {
    // 确保 files 数组存在
    if (!configs[index].files) {
      configs[index].files = [];
    }
    configs[index].files = configs[index].files.filter(f => f.path !== filePath);
    // 如果没有文件了，删除整个配置
    if (configs[index].files.length === 0) {
      configs.splice(index, 1);
    }
    saveModConfigs(configs);
  }
}
