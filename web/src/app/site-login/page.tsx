'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { IoMailOutline, IoLockClosedOutline, IoEyeOutline, IoEyeOffOutline, IoArrowForward } from 'react-icons/io5';
import AdminPageLayout from '@/components/layout/AdminPageLayout';
import { Button, Input, Card } from '@/components/ui';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      router.push('/dashboard.html');
      router.refresh();
    } catch (err: any) {
      setError(err.message === 'Invalid login credentials' ? 'E-mail ou senha inválidos' : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminPageLayout>
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-md relative z-10">
          {/* Logo / Title Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-[#005CA9]/10 border border-[#005CA9]/20 mb-6 shadow-sm">
            <IoLockClosedOutline size={32} className="text-[#005CA9]" />
          </div>
          <h1 className="text-3xl font-black text-[#003870] uppercase tracking-tighter mb-2">Acesso Restrito</h1>
          <p className="text-gray-500 font-bold italic text-sm">Painel Administrativo Oportunidades Caixa</p>
        </div>

          <Card className="p-10">
            <form onSubmit={handleLogin} className="space-y-6">
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-bold flex items-center gap-3 animate-shake">
                  <span className="text-lg">⚠️</span>
                  {error}
                </div>
              )}

              <Input 
                label="E-mail"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@exemplo.com"
                icon={<IoMailOutline />}
              />

              <Input 
                label="Senha"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                icon={<IoLockClosedOutline />}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-600 hover:text-white transition-colors"
                  >
                    {showPassword ? <IoEyeOffOutline size={20} /> : <IoEyeOutline size={20} />}
                  </button>
                }
              />

              <Button 
                type="submit" 
                loading={loading}
                className="w-full py-5"
                icon={<IoArrowForward size={18} />}
              >
                Entrar no Painel
              </Button>
            </form>
          </Card>

          {/* Footer Info */}
          <p className="text-center text-gray-600 text-[10px] mt-10 font-bold uppercase tracking-widest opacity-50">
            &copy; 2026 Oportunidades Caixa - Tecnologia Segura
          </p>
        </div>
      </div>

    </AdminPageLayout>
  );
}
