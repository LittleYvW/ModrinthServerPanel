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
    const { projectId } = await request.json();
    const config = getConfig();
    
    const versions = await getProjectVersions(projectId, {
      loaders: [config.loader],
      game_versions: [config.minecraftVersion],
    });
    
    return NextResponse.json({ versions });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get versions' },
      { status: 500 }
    );
  }
}
