import { NextRequest, NextResponse } from 'next/server';
import { 
  getModConfigs, 
  getModConfigById, 
  addOrUpdateModConfig, 
  removeModConfig,
  addModConfigFile,
  removeModConfigFile,
  getMods,
} from '@/lib/db';

// 获取所有模组配置关联
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modId = searchParams.get('modId');
    
    if (modId) {
      const config = getModConfigById(modId);
      return NextResponse.json({ config: config || null });
    }
    
    const configs = getModConfigs();
    return NextResponse.json({ configs });
  } catch (error) {
    console.error('Get mod configs error:', error);
    return NextResponse.json(
      { error: 'Failed to get mod configs' },
      { status: 500 }
    );
  }
}

// 添加或更新模组配置关联
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { modId, modName, files } = body;
    
    if (!modId || !modName) {
      return NextResponse.json(
        { error: 'Missing modId or modName' },
        { status: 400 }
      );
    }
    
    const config = {
      modId,
      modName,
      files: files || [],
      lastScanAt: new Date().toISOString(),
    };
    
    addOrUpdateModConfig(config);
    
    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('Save mod config error:', error);
    return NextResponse.json(
      { error: 'Failed to save mod config' },
      { status: 500 }
    );
  }
}

// 添加单个配置文件关联
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { modId, modName, file } = body;
    
    if (!modId || !modName || !file) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    addModConfigFile(modId, modName, file);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Add mod config file error:', error);
    return NextResponse.json(
      { error: 'Failed to add config file' },
      { status: 500 }
    );
  }
}

// 删除模组配置关联或单个文件
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modId = searchParams.get('modId');
    const filePath = searchParams.get('filePath');
    
    if (!modId) {
      return NextResponse.json(
        { error: 'Missing modId' },
        { status: 400 }
      );
    }
    
    if (filePath) {
      // 删除单个文件关联
      removeModConfigFile(modId, filePath);
    } else {
      // 删除整个模组配置
      removeModConfig(modId);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete mod config error:', error);
    return NextResponse.json(
      { error: 'Failed to delete mod config' },
      { status: 500 }
    );
  }
}
