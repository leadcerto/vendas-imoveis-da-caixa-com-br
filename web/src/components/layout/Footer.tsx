"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  IoArrowForwardOutline, IoBusinessOutline, IoPeopleOutline
} from 'react-icons/io5';

export default function Footer() {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/dashboard') || pathname === '/site-login';
  
  if (pathname === '/busca-imoveis' || isAdminRoute) return null;

  return (
    <footer className="w-full bg-white border-t border-gray-100 py-8 px-4 md:px-8 mt-10">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* COLUNA ESQUERDA: Links & Infos */}
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-black text-[#005CA9] mb-4 border-b-2 border-[#005CA9] inline-block pb-1">
              Links
            </h2>
            <p className="font-black text-gray-800 mb-2 text-base">Imóveis da Caixa</p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 group">
                <span className="text-[#005CA9]">💙</span>
                <Link 
                  href="https://imoveisdacaixa.com.br/treinamentos/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-base font-bold text-gray-600 hover:text-[#005CA9] transition-colors"
                >
                  Treinamentos
                </Link>
              </li>
              <li className="flex items-center gap-2 group">
                <span className="text-[#F9B200]">🧡</span>
                <Link 
                  href="/busca-imoveis" 
                  className="text-base font-bold text-gray-600 hover:text-[#F9B200] transition-colors"
                >
                  Busca de Imóveis
                </Link>
              </li>
              <li className="flex items-center gap-2 group">
                <span className="text-[#005CA9]">💙</span>
                <Link 
                  href="https://www.fgts.gov.br/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-base font-bold text-gray-600 hover:text-[#005CA9] transition-colors"
                >
                  FGTS
                </Link>
              </li>
              <li className="flex items-center gap-2 group">
                <span className="text-[#F9B200]">🧡</span>
                <Link 
                  href="https://imoveisdacaixa.com.br/privacidade/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-base font-bold text-gray-600 hover:text-[#F9B200] transition-colors"
                >
                  Privacidade
                </Link>
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t border-gray-50">
            <p className="flex items-center gap-2 text-base font-black text-gray-800">
              <span className="text-[#005CA9]">💙</span> Imobiliária Credenciada da Caixa
            </p>
            <div className="mt-2 text-sm font-bold text-gray-500 space-y-1">
              <p>Imóveis da Caixa LTDA</p>
              <p>CNPJ 50.563.863/0001-45</p>
              <p>CRECI-PJ 10.234/RJ</p>
            </div>
            <p className="mt-4 text-sm font-black text-[#F9B200]">
              🧡 Copyright © 2020 Todos os direitos reservados
            </p>
          </div>
        </div>

        {/* COLUNA MEIO: Vazia */}
        <div className="hidden md:block">
          {/* Espaço mantido vazio conforme solicitado em etapas anteriores */}
        </div>

        {/* COLUNA DIREITA: Serviços & Quem Somos */}
        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2 uppercase tracking-wider">
              <IoBusinessOutline className="text-[#F9B200]" /> Nossos Serviços
            </h3>
            <ul className="space-y-3">
              {[
                { label: 'Documentação Imobiliária', url: 'https://imoveisdacaixa.com.br/documentacao-imobiliaria/' },
                { label: 'Avaliação Pericial', url: 'https://imoveisdacaixa.com.br/avaliacao-pericial/' },
                { label: 'Parceria em Arrematações', url: 'https://imoveisdacaixa.com.br/parceria-arrematacoes/' }
              ].map((link, idx) => (
                <li key={idx}>
                  <Link 
                    href={link.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-base font-bold text-gray-500 hover:text-[#005CA9] transition-colors flex items-center justify-between group"
                  >
                    {link.label}
                    <IoArrowForwardOutline className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-4 border-t border-gray-50">
            <h3 className="text-lg font-black text-gray-800 mb-4 flex items-center gap-2 uppercase tracking-wider">
              <IoPeopleOutline className="text-[#005CA9]" /> Quem somos
            </h3>
            <ul className="space-y-3">
              {[
                { label: 'Missão', url: 'https://imoveisdacaixa.com.br/quem-somos/#missao' },
                { label: 'Valores', url: 'https://imoveisdacaixa.com.br/quem-somos/#valores' },
                { label: 'Metas', url: 'https://imoveisdacaixa.com.br/quem-somos/#metas' },
                { label: 'Leo Leão', url: 'https://imoveisdacaixa.com.br/leo-leao/' }
              ].map((link, idx) => (
                <li key={idx}>
                  <Link 
                    href={link.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-base font-bold text-gray-500 hover:text-[#005CA9] transition-colors flex items-center justify-between group"
                  >
                    {link.label}
                    <IoArrowForwardOutline className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

      </div>
    </footer>
  );
}
