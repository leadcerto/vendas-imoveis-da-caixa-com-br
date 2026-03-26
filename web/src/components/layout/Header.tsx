"use client";

import Link from 'next/link';
import { IoSearchOutline } from 'react-icons/io5';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/dashboard') || pathname === '/site-login';
  
  if (pathname === '/busca-imoveis' || isAdminRoute) return null;

  return (
    <header className="w-full bg-white border-b border-gray-100 py-3 px-4 md:px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* LADO ESQUERDO: Título */}
        <div className="text-center md:text-left">
          <h2 className="text-xl md:text-2xl font-black tracking-tight text-[#005CA9] whitespace-nowrap">
            Venda de Imóveis da Caixa
          </h2>
        </div>

        {/* LADO DIREITO: Botão de Busca */}
        <div className="flex justify-center md:justify-end w-full md:w-auto">
          <Link 
            href="/busca-imoveis" 
            className="flex items-center gap-2 px-6 py-2 bg-[#F9B200] hover:bg-[#e6a500] text-white rounded-full font-black text-xs md:text-sm uppercase tracking-widest transition-all shadow-lg shadow-[#F9B200]/20 active:scale-95"
          >
            <IoSearchOutline size={18} />
            Encontre seu Imóvel
          </Link>
        </div>

      </div>
    </header>
  );
}
