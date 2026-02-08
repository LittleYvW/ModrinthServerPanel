'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Loader2, Shield } from 'lucide-react';

interface LoginDialogProps {
  onLogin: () => void;
  onCancel: () => void;
}

export function LoginDialog({ onLogin, onCancel }: LoginDialogProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', password }),
      });

      const data = await res.json();

      if (data.success) {
        onLogin();
      } else {
        setError('密码错误');
      }
    } catch (error) {
      setError('登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in duration-300">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-md p-6 shadow-2xl animate-fade-in-scale">
        {/* 标题 */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-[#00d17a]/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-[#00d17a]" />
          </div>
          <h2 className="text-xl font-bold text-white">管理员登录</h2>
          <p className="text-sm text-[#a0a0a0] mt-1">
            默认密码: admin
          </p>
        </div>

        {/* 错误提示 */}
        {error && (
          <Alert className="mb-4 bg-[#e74c3c]/10 border-[#e74c3c]/30 text-[#e74c3c] animate-fade-in-up">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 登录表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-white flex items-center gap-2">
              <Lock className="w-4 h-4" />
              密码
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入管理员密码"
              autoFocus
              className="bg-[#262626] border-[#2a2a2a] text-white placeholder:text-[#505050] focus:border-[#00d17a] focus:ring-[#00d17a]"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1 border-[#2a2a2a] text-[#a0a0a0] hover:text-white hover:bg-[#262626]"
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={loading || !password}
              className="flex-1 bg-[#00d17a] hover:bg-[#00b86b] text-black font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  登录中...
                </>
              ) : (
                '登录'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
