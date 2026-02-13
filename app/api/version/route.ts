import { NextRequest, NextResponse } from 'next/server';
import { getVersion } from '@/lib/modrinth';
import axios from 'axios';

const MODRINTH_API = 'https://api.modrinth.com/v2';

// 批量获取版本详情（并行请求）
async function getVersions(versionIds: string[]) {
  // Modrinth API 没有批量查询端点，使用并行单个查询
  const promises = versionIds.map(async (id) => {
    try {
      const response = await axios.get(`${MODRINTH_API}/version/${id}`, {
        headers: { 'User-Agent': 'ModrinthServerPanel/1.0' },
      });
      return response.data;
    } catch (error) {
      console.error(`[API] Failed to fetch version ${id}:`, error);
      return null;
    }
  });
  const results = await Promise.all(promises);
  return results.filter(r => r !== null);
}

// 获取版本详情（包含依赖信息）
// 支持单个 versionId 或批量 ids（逗号分隔）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const versionId = searchParams.get('versionId');
    const ids = searchParams.get('ids');

    // 批量查询
    if (ids) {
      const versionIds = ids.split(',').filter(id => id.trim());
      if (versionIds.length === 0) {
        return NextResponse.json(
          { error: 'No valid version ids provided' },
          { status: 400 }
        );
      }
      
      const versions = await getVersions(versionIds);
      return NextResponse.json(versions);
    }

    // 单个查询
    if (!versionId) {
      return NextResponse.json(
        { error: 'Missing versionId or ids' },
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
