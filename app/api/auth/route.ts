import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, saveAuth, isDefaultPassword } from '@/lib/db';

// GET: 获取密码状态（是否使用默认密码）
export async function GET() {
  try {
    const isDefault = isDefaultPassword();
    return NextResponse.json({ isDefaultPassword: isDefault });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get auth status' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, password, newPassword } = await request.json();
    
    if (action === 'login') {
      const isValid = verifyPassword(password);
      return NextResponse.json({ success: isValid });
    }
    
    if (action === 'change') {
      // 验证旧密码
      if (!verifyPassword(password)) {
        return NextResponse.json(
          { error: 'Invalid current password' },
          { status: 401 }
        );
      }
      
      saveAuth(newPassword);
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
