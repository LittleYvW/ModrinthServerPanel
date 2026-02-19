import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/lib/modrinth';

// 批量获取项目信息
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ids = searchParams.get('ids');

    if (!ids) {
      return NextResponse.json(
        { error: 'Missing ids parameter' },
        { status: 400 }
      );
    }

    const projectIds = ids.split(',').filter(id => id.trim());
    
    if (projectIds.length === 0) {
      return NextResponse.json([]);
    }

    // 并行获取所有项目信息
    const projects = await Promise.all(
      projectIds.map(async (id) => {
        try {
          return await getProject(id);
        } catch (error) {
          console.error(`Failed to get project ${id}:`, error);
          return null;
        }
      })
    );

    // 过滤掉失败的请求
    const validProjects = projects.filter(p => p !== null);
    
    return NextResponse.json(validProjects);
  } catch (error: unknown) {
    console.error('Get projects error:', error);
    return NextResponse.json(
      { error: 'Failed to get project details' },
      { status: 500 }
    );
  }
}
