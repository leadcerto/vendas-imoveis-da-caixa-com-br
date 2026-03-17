"use client";

import { IoLocationOutline, IoBedOutline, IoSquareOutline, IoTrendingDownOutline } from 'react-icons/io5';
import Link from 'next/link';

interface PropertyCardProps {
  property: {
    numero_imovel: number;
    uf: string;
    cidade: string;
    bairro: string;
    preco_venda: number;
    valor_avaliacao: number;
    desconto_percentual: number;
    tipo_imovel: string;
    quartos?: number;
    area_privativa?: number;
    url_imagem?: string;
  };
}

export default function PropertyCard({ property }: PropertyCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <Link href={`/imovel/${property.numero_imovel}`} className="group block h-full">
      <div className="relative h-full bg-white/5 border border-white/10 rounded-3xl overflow-hidden hover:border-blue-500/50 transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/10">
        
        {/* Discount Badge */}
        {property.desconto_percentual > 0 && (
          <div className="absolute top-4 left-4 z-10 px-3 py-1.5 bg-green-500/90 backdrop-blur-md text-white text-xs font-bold rounded-full flex items-center gap-1 shadow-lg">
            <IoTrendingDownOutline size={14} />
            {Math.round(property.desconto_percentual)}% OFF
          </div>
        )}

        {/* Featured Badge */}
        <div className="absolute top-4 right-4 z-10 px-3 py-1.5 bg-blue-600/90 backdrop-blur-md text-white text-xs font-bold rounded-full shadow-lg">
          {property.tipo_imovel}
        </div>

        {/* Image Container */}
        <div className="relative aspect-[4/3] overflow-hidden">
          <img 
            src={property.url_imagem} 
            alt={`${property.tipo_imovel} em ${property.cidade}`}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1073&auto=format&fit=crop';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0b] via-transparent to-transparent opacity-60" />
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col h-full bg-[#0a0a0b]/40 backdrop-blur-sm">
          <div className="flex items-center gap-1 text-gray-400 text-xs mb-2">
            <IoLocationOutline className="text-blue-500" />
            <span className="truncate">{property.bairro}, {property.cidade} - {property.uf}</span>
          </div>

          <h3 className="text-lg font-bold text-white mb-4 line-clamp-1 group-hover:text-blue-400 transition-colors uppercase tracking-tight">
            {property.tipo_imovel}
          </h3>

          <div className="grid grid-cols-2 gap-4 mb-6">
            {property.quartos && (
              <div className="flex items-center gap-2 text-gray-400">
                <IoBedOutline className="text-blue-500" size={18} />
                <span className="text-sm font-medium">{property.quartos} Quartos</span>
              </div>
            )}
            {property.area_privativa && (
              <div className="flex items-center gap-2 text-gray-400">
                <IoSquareOutline className="text-blue-500" size={18} />
                <span className="text-sm font-medium">{Math.round(Number(property.area_privativa))}m²</span>
              </div>
            )}
          </div>

          <div className="mt-auto space-y-2">
            <p className="text-xs text-gray-500 line-through">
              Avaliado em {formatCurrency(Number(property.valor_avaliacao))}
            </p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-black text-white tracking-tighter">
                  {formatCurrency(Number(property.preco_venda))}
                </p>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-blue-500 text-[10px] font-black uppercase tracking-widest group-hover:translate-x-1 transition-transform">
                  Ver Detalhes 
                </span>
                <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                  Ref: {property.numero_imovel}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
