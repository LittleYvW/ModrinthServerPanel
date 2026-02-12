import { NextRequest, NextResponse } from 'next/server';
import { getVersion } from '@/lib/modrinth';

// 获取版本详情（包含依赖信息）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const versionId = searchParams.get('versionId');

    if (!versionId) {
      return NextResponse.json(
        { error: 'Missing versionId' },
        { status: 400 }
      );
    }

    const version = await getVersion(versionId);
    
    return NextResponse.json(version);
  } catch (error: any) {
    console.error('Get version error:', error);
    
    if (error.response?.status === 404) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to get version details' },
      { status: 500 }
    );
  }
}
