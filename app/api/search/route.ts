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
        { error: 'Invalid request body', versions: [] },
        { status: 400 }
      );
    }
    
    if (!projectId) {
      console.error('[API] Missing projectId in request');
      return NextResponse.json(
        { error: 'Missing projectId', versions: [] },
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
        { error: 'Failed to read server configuration', versions: [] },
        { status: 500 }
      );
    }
    
    // 3. 检查配置是否有效
    if (!config.loader || !config.minecraftVersion) {
      console.error('[API] Server config incomplete:', { 
        loader: config.loader, 
        minecraftVersion: config.minecraftVersion 
      });
      return NextResponse.json(
        { error: 'Server configuration incomplete', versions: [] },
        { status: 400 }
      );
    }
    
    // 4. 调用 Modrinth API
    console.log('[API] Calling Modrinth API with:', {
      projectId,
      loaders: [config.loader],
      game_versions: [config.minecraftVersion]
    });
    
    let versions;
    try {
      versions = await getProjectVersions(projectId, {
        loaders: [config.loader],
        game_versions: [config.minecraftVersion],
      });
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
          { error: '连接 Modrinth API 超时或重置，请重试', versions: [], retryable: true },
          { status: 502 }
        );
      }
      
      if (modrinthError.response?.status === 404) {
        return NextResponse.json(
          { error: '模组项目不存在', versions: [] },
          { status: 404 }
        );
      }
      
      if (modrinthError.response?.status === 429) {
        return NextResponse.json(
          { error: '请求过于频繁，请稍后再试', versions: [], retryable: true },
          { status: 429 }
        );
      }
      
      return NextResponse.json(
        { 
          error: `Modrinth API 错误: ${modrinthError.message || '未知错误'}`, 
          errorCode: modrinthError.code,
          versions: [] 
        },
        { status: 502 }
      );
    }
    
    return NextResponse.json({ versions });
  } catch (error: any) {
    console.error('[API] Unexpected error:', error);
    return NextResponse.json(
      { error: `Internal server error: ${error.message}`, versions: [] },
      { status: 500 }
    );
  }
}
