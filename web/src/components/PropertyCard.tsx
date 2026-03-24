"use client";

import { IoLocationOutline, IoBedOutline, IoSquareOutline, IoTrendingDownOutline, IoCheckboxOutline } from 'react-icons/io5';
import Link from 'next/link';
import { getLocalImagePath, getCorrectedCaixaUrl } from '@/lib/imageUtils';

interface PropertyCardProps {
  property: {
    numero_imovel: number;
    uf: string;
    cidade: string;
    bairro: string;
    preco_venda: number;
    valor_avaliacao: number;
    desconto: number;
    desconto_moeda: number;
    aceita_financiamento: boolean;
    descricao?: string;
    tipo_imovel: string;
    quartos?: number;
    area_privativa?: number;
    url_imagem?: string;
    post_link_permanente?: string;
    imovel_caixa_post_link_permanente?: string;
  };
}

export default function PropertyCard({ property }: PropertyCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const propertyLink = `/${property.post_link_permanente || property.imovel_caixa_post_link_permanente || property.numero_imovel}`;

  return (
    <Link href={propertyLink} className="group block h-full">
      <div className="relative flex flex-col h-full bg-white border border-gray-100 rounded-[40px] overflow-hidden transition-all duration-700 hover:border-[#005CA9]/30 hover:shadow-[0_40px_80px_-20px_rgba(0,92,169,0.15)] active:scale-[0.98]">
        
        {/* Badges Container - Top of the image mask */}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-start justify-between pointer-events-none">
          {property.desconto > 0 && (
            <div className="px-3 py-1.5 bg-[#F9B200] text-gray-900 text-[9px] font-black rounded-lg flex items-center gap-1 shadow-lg shadow-[#F9B200]/20 uppercase tracking-tighter">
              <IoTrendingDownOutline size={12} />
              {Math.round(property.desconto)}% OFF
            </div>
          )}
          <div className="px-3 py-1.5 bg-white/95 backdrop-blur-md text-[#005CA9] text-[9px] font-black rounded-lg shadow-md uppercase tracking-tighter border border-white/20">
            {property.tipo_imovel}
          </div>
        </div>

        {/* Image Container */}
        <div className="relative aspect-[16/10] overflow-hidden bg-gray-50 flex-shrink-0">
          <img 
            src={getCorrectedCaixaUrl(property.numero_imovel)}
            alt={`${property.tipo_imovel} em ${property.cidade}`}
            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              const currentSrc = target.src;
              
              const correctedCaixa = getCorrectedCaixaUrl(property.numero_imovel);
              const localPath = getLocalImagePath(property);
              const originalCaixa = property.url_imagem;
              const placeholder = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1073&auto=format&fit=crop';
              
              if (currentSrc === correctedCaixa) {
                target.src = localPath;
              } else if (currentSrc.includes('/imagens-destaque/') && originalCaixa && originalCaixa !== correctedCaixa) {
                target.src = originalCaixa;
              } else if (currentSrc !== placeholder && !currentSrc.includes('placeholder')) {
                target.src = placeholder;
              }
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 via-transparent to-transparent opacity-40 transition-opacity group-hover:opacity-60" />
          
          {/* Financing Badge - Bottom of the image mask */}
          {property.aceita_financiamento && (
            <div className="absolute bottom-4 left-4 z-20 pointer-events-none">
              <div className="px-3 py-1.5 bg-[#005CA9] text-white text-[9px] font-black rounded-lg flex items-center gap-1 shadow-lg shadow-[#005CA9]/20 uppercase tracking-tighter">
                <IoCheckboxOutline size={12} />
                Aceita Financiamento
              </div>
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="p-6 flex flex-col flex-grow bg-white">
          <div className="flex items-center gap-2 mb-2">
            <IoLocationOutline className="text-[#005CA9] flex-shrink-0" size={14} />
            <span className="text-[10px] font-bold text-[#005CA9] uppercase tracking-wide truncate">
              {property.cidade} - {property.bairro}
            </span>
          </div>

          <h3 className="text-xl font-black text-gray-900 mb-2 group-hover:text-[#005CA9] transition-colors leading-tight uppercase">
            {property.tipo_imovel}
          </h3>

          <p className="text-[11px] text-gray-500 line-clamp-2 mb-6 leading-relaxed">
            {property.descricao}
          </p>

          {/* Price Section */}
          <div className="mt-auto space-y-4">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">Avaliação</span>
                <span className="text-sm font-medium text-black">
                  {formatCurrency(property.valor_avaliacao)}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">Valor para Compra</span>
                <span className="text-2xl font-black text-[#005CA9] tracking-tight">
                  {formatCurrency(property.preco_venda)}
                </span>
              </div>
            </div>

            {/* Lucro Imediato Highlight - Glassmorphism */}
            <div className="relative overflow-hidden bg-gradient-to-br from-orange-50/80 to-white/40 backdrop-blur-sm rounded-3xl p-5 border border-orange-100/50 group/savings transition-all duration-500 hover:shadow-lg hover:shadow-orange-200/20">
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-600 shadow-inner">
                    <IoTrendingDownOutline size={20} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest leading-none mb-0.5">Lucro Imediato</span>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Oportunidade Única</span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xl font-black text-gray-900 tracking-tighter transition-transform duration-700 group-hover/savings:scale-110 origin-right">
                    {formatCurrency(property.valor_avaliacao - property.preco_venda)}
                  </span>
                </div>
              </div>
              {/* Subtle background glow */}
              <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-orange-500/5 blur-2xl rounded-full" />
            </div>

            {/* CTA Button - SAIBA MAIS - PREMIUM ORANGE */}
            <div className="relative group/btn pt-2">
              <div className="absolute inset-0 bg-orange-500/20 blur-xl rounded-2xl opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500" />
              <button className="relative w-full py-5 bg-[#FF9D2E] hover:bg-[#F9B200] text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl transition-all duration-500 transform active:scale-95 shadow-xl shadow-orange-500/10 border-b-4 border-orange-700/30 flex items-center justify-center gap-2 overflow-hidden">
                <span className="relative z-10">SAIBA MAIS DETALHES</span>
                <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20 transform translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
