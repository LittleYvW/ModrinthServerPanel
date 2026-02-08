import { NextRequest, NextResponse } from 'next/server';
import { getConfig, saveConfig, ServerConfig } from '@/lib/db';

export async function GET() {
  try {
    const config = getConfig();
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get config' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const config: ServerConfig = await request.json();
    
    // 验证必填字段
    if (!config.path || !config.minecraftVersion) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    saveConfig(config);
    return NextResponse.json({ success: true, config });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to save config' },
      { status: 500 }
    );
  }
}
