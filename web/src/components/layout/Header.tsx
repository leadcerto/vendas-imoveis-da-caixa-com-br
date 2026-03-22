"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IoHomeOutline, IoTimeOutline, IoSearchOutline } from 'react-icons/io5';
import { usePathname } from 'next/navigation';

export default function Header() {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('pt-BR', { hour12: false }));
    };
    
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const pathname = usePathname();
  if (pathname === '/busca-imoveis') return null;

  return (
    <header className="w-full bg-white border-b border-gray-100 py-6 px-4 md:px-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 items-center gap-6">
        
        {/* COLUNA ESQUERDA: Título */}
        <div className="text-left">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-[#005CA9]">
            Venda de Imóveis da Caixa
          </h2>
        </div>

        {/* COLUNA CENTRAL: Botão Home */}
        <div className="flex justify-center">
          <Link 
            href="/busca-imoveis" 
            className="flex items-center gap-2 px-8 py-3 bg-[#F9B200] hover:bg-[#e6a500] text-white rounded-full font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-[#F9B200]/20 active:scale-95"
          >
            <IoSearchOutline size={18} />
            Encontre seu Imóvel
          </Link>
        </div>

        {/* COLUNA DIREITA: Hora do Servidor */}
        <div className="text-right hidden md:flex items-center justify-end gap-2 text-[#005CA9] font-bold">
          <IoTimeOutline size={20} />
          <span className="text-xl font-mono">{time || '--:--:--'}</span>
        </div>
        
        {/* Mobile Clock fallback */}
        <div className="md:hidden text-center text-[#005CA9] font-bold flex items-center justify-center gap-2 border-t border-gray-50 pt-4 mt-2">
          <IoTimeOutline size={18} />
          <span className="font-mono">{time || '--:--:--'}</span>
        </div>

      </div>
    </header>
  );
}
