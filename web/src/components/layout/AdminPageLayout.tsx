'use client';

import React from 'react';
import { IoLogOutOutline } from 'react-icons/io5';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface AdminPageLayoutProps {
  children: React.ReactNode;
  showLogout?: boolean;
  title?: string;
  subtitle?: string;
}

export default function AdminPageLayout({ 
  children, 
  showLogout = false,
  title,
  subtitle 
}: AdminPageLayoutProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/site-login.html');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#111827] p-6 md:p-12 selection:bg-[#005CA9]/10 relative overflow-x-hidden">
      {/* Background Decorative Elements - Subtle gradients instead of dark glows */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-0 right-0 w-[60%] h-[40%] bg-[#005CA9]/5 blur-[100px] rounded-full"></div>
        <div className="absolute bottom-0 left-0 w-[30%] h-[30%] bg-[#F9B200]/5 blur-[80px] rounded-full"></div>
      </div>

      <div className="max-w-7xl mx-auto">
        {(title || showLogout || subtitle) && (
          <div className="mb-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-gray-200 pb-8">
            <div>
              {title && (
                <h1 className="text-3xl font-black tracking-tighter uppercase text-[#003870] mb-2">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="text-gray-500 font-bold flex items-center gap-2 text-sm uppercase tracking-wider">
                  <span className="w-2 h-2 bg-[#005CA9] rounded-full animate-pulse"></span>
                  {subtitle}
                </p>
              )}
            </div>

            {showLogout && (
              <button 
                onClick={handleSignOut}
                className="px-6 py-3 bg-white border border-gray-200 rounded-2xl text-[10px] uppercase font-black tracking-[0.2em] flex items-center gap-2 text-gray-600 hover:border-[#005CA9] hover:text-[#005CA9] transition-all active:scale-95 shadow-sm"
              >
                <IoLogOutOutline size={14} /> Sair do Painel
              </button>
            )}
          </div>
        )}

        <main className="mt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
