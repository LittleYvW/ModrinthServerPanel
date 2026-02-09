import { NextRequest, NextResponse } from 'next/server';
import { searchMods, getProjectVersions } from '@/lib/modrinth';
import { getConfig } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    
    const config = getConfig();
    
    const results = await searchMods(query, {
      versions: config.minecraftVersion,
      loaders: config.loader,
    });
    
    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to search mods' },
      { status: 500 }
    );
  }
}

// 获取项目的可用版本
export async function POST(request: NextRequest) {
  try {
    let projectId: string;
    
    // 1. 解析请求体
    try {
      const body = await request.json();
      projectId = body.projectId;
      console.log('[API] Received request for projectId:', projectId);
    } catch (parseError) {
      console.error('[API] Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid request body', versions: [], serverConfig: null },
        { status: 400 }
      );
    }
    
    if (!projectId) {
      console.error('[API] Missing projectId in request');
      return NextResponse.json(
        { error: 'Missing projectId', versions: [], serverConfig: null },
        { status: 400 }
      );
    }
    
    // 2. 获取配置
    let config: ReturnType<typeof getConfig>;
    try {
      config = getConfig();
      console.log('[API] Server config:', { 
        loader: config.loader, 
        minecraftVersion: config.minecraftVersion 
      });
    } catch (configError) {
      console.error('[API] Failed to get config:', configError);
      return NextResponse.json(
        { error: 'Failed to read server configuration', versions: [], serverConfig: null },
        { status: 500 }
      );
    }
    
    // 3. 获取所有版本（不过滤），同时返回服务端配置用于前端比对
    console.log('[API] Calling Modrinth API for all versions of project:', projectId);
    
    let versions;
    try {
      // 不传入过滤参数，获取所有版本
      versions = await getProjectVersions(projectId);
      console.log('[API] Modrinth API returned', versions.length, 'versions');
    } catch (modrinthError: any) {
      console.error('[API] Modrinth API error:', {
        name: modrinthError.name,
        message: modrinthError.message,
        code: modrinthError.code,
        status: modrinthError.response?.status,
        statusText: modrinthError.response?.statusText,
        data: modrinthError.response?.data,
        requestUrl: modrinthError.config?.url,
        requestParams: modrinthError.config?.params
      });
      
      // 处理不同类型的错误
      if (modrinthError.code === 'ECONNRESET' || modrinthError.code === 'ETIMEDOUT') {
        return NextResponse.json(
          { error: '连接 Modrinth API 超时或重置，请重试', versions: [], serverConfig: null, retryable: true },
          { status: 502 }
        );
      }
      
      if (modrinthError.response?.status === 404) {
        return NextResponse.json(
          { error: '模组项目不存在', versions: [], serverConfig: null },
          { status: 404 }
        );
      }
      
      if (modrinthError.response?.status === 429) {
        return NextResponse.json(
          { error: '请求过于频繁，请稍后再试', versions: [], serverConfig: null, retryable: true },
          { status: 429 }
        );
      }
      
      return NextResponse.json(
        { 
          error: `Modrinth API 错误: ${modrinthError.message || '未知错误'}`, 
          errorCode: modrinthError.code,
          versions: [],
          serverConfig: null
        },
        { status: 502 }
      );
    }
    
    // 返回版本列表和服务端配置
    return NextResponse.json({ 
      versions,
      serverConfig: {
        minecraftVersion: config.minecraftVersion,
        loader: config.loader,
      }
    });
  } catch (error: any) {
    console.error('[API] Unexpected error:', error);
    return NextResponse.json(
      { error: `Internal server error: ${error.message}`, versions: [], serverConfig: null },
      { status: 500 }
    );
  }
}
