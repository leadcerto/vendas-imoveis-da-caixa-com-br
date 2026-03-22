"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  IoHomeOutline, 
  IoStatsChartOutline, 
  IoCloudUploadOutline, 
  IoDocumentTextOutline, 
  IoSettingsOutline,
  IoLogOutOutline
} from 'react-icons/io5';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();

  const menuItems = [
    { name: 'Dashboard', icon: <IoStatsChartOutline size={20} />, href: '/admin' },
    { name: 'Importar CSV', icon: <IoCloudUploadOutline size={20} />, href: '/admin/import' },
    { name: 'Relatórios', icon: <IoDocumentTextOutline size={20} />, href: '/admin/reports' },
    { name: 'Configurações', icon: <IoSettingsOutline size={20} />, href: '/admin/settings' },
  ];

  return (
    <div className="flex min-h-screen bg-[#0a0a0b] text-white">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-black/40 backdrop-blur-xl flex flex-col fixed inset-y-0">
        <div className="p-8 flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
            <IoHomeOutline size={18} className="text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">Admin <span className="text-blue-500">Caixa</span></span>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive 
                    ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.icon}
                <span className="text-sm font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5">
          <Link 
            href="/busca-imoveis"
            className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            <IoLogOutOutline size={20} />
            <span className="text-sm font-medium">Voltar ao Site</span>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8 relative">
        {/* Background Glow */}
        <div className="fixed top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-6xl mx-auto relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}
