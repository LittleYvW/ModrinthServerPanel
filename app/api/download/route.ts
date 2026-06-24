import { NextRequest, NextResponse } from 'next/server';
import { getMods } from '@/lib/db';
import { getVersion } from '@/lib/modrinth';

// 获取模组文件下载 - 从 Modrinth CDN 获取
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modId = searchParams.get('modId');

    if (!modId) {
      return NextResponse.json(
        { error: 'Missing modId' },
        { status: 400 }
      );
    }

    const mods = getMods();
    const mod = mods.find(m => m.id === modId);

    if (!mod) {
      return NextResponse.json(
        { error: 'Mod not found' },
        { status: 404 }
      );
    }

    if (!mod.versionId) {
      return NextResponse.json(
        { error: 'Mod version ID missing' },
        { status: 500 }
      );
    }

    // 从 Modrinth API 获取版本详情，拿到文件下载链接
    const version = await getVersion(mod.versionId);
    const primaryFile = version.files?.find((f: { primary: boolean }) => f.primary) || version.files?.[0];

    if (!primaryFile || !primaryFile.url) {
      return NextResponse.json(
        { error: 'File not found on Modrinth' },
        { status: 404 }
      );
    }

    // 从 Modrinth CDN 下载文件
    const cdnRes = await fetch(primaryFile.url);
    if (!cdnRes.ok) {
      return NextResponse.json(
        { error: `Modrinth CDN returned ${cdnRes.status}` },
        { status: 502 }
      );
    }

    const fileBuffer = await cdnRes.arrayBuffer();

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/java-archive',
        'Content-Disposition': `attachment; filename="${primaryFile.filename || mod.filename}"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    );
  }
}

// 批量下载 - 返回所有双端模组的下载链接
export async function POST() {
  try {
    const mods = getMods();
    const bothMods = mods.filter(m => m.category === 'both' && m.enabled !== false);

    return NextResponse.json({
      success: true,
      mods: bothMods.map(m => ({
        id: m.id,
        name: m.name,
        filename: m.filename,
        downloadUrl: `/api/download?modId=${m.id}`,
      }))
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to get download list' },
      { status: 500 }
    );
  }
}
