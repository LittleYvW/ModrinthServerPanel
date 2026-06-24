import { NextRequest, NextResponse } from 'next/server';
import { getMods } from '@/lib/db';
import { getVersion } from '@/lib/modrinth';

// 获取模组下载链接 - 返回 Modrinth CDN 直链，浏览器原生下载
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

    // 从 Modrinth API 获取版本详情，拿到 CDN 下载链接
    const version = await getVersion(mod.versionId);
    const primaryFile = version.files?.find((f: { primary: boolean }) => f.primary) || version.files?.[0];

    if (!primaryFile || !primaryFile.url) {
      return NextResponse.json(
        { error: 'File not found on Modrinth' },
        { status: 404 }
      );
    }

    // 返回 CDN 直链，由客户端 <a> 点击触发浏览器原生下载
    return NextResponse.json({
      downloadUrl: primaryFile.url,
      filename: primaryFile.filename || mod.filename,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to get download URL' },
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
