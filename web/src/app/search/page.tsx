"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import PropertyCard from '@/components/PropertyCard';
import { IoFilterOutline, IoSearchOutline, IoChevronBackOutline, IoChevronForwardOutline } from 'react-icons/io5';
import Link from 'next/link';
import WhatsAppFloating from '@/components/WhatsAppFloating';

function SearchResultsContent() {
  const searchParams = useSearchParams();
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 9;

  // Filters State
  const [filters, setFilters] = useState({
    q: searchParams.get('q') || '',
    uf: searchParams.get('uf') || '',
    cidade: searchParams.get('cidade') || '',
    bairros: searchParams.get('bairros') || '',
    tipo: searchParams.get('tipo') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    onlyFinancing: searchParams.get('onlyFinancing') === 'true',
  });

  const fetchProperties = async () => {
    setLoading(true);
    let query = supabase
      .from('imoveis')
      .select('*, tipos_imovel(nome)', { count: 'exact' });

    if (filters.q) {
      query = query.or(`imovel_caixa_endereco_bairro.ilike.%${filters.q}%,imovel_caixa_endereco_cidade.ilike.%${filters.q}%,imovel_caixa_endereco_csv.ilike.%${filters.q}%`);
    }
    if (filters.uf) query = query.eq('imovel_caixa_endereco_uf_sigla', filters.uf);
    if (filters.cidade) query = query.eq('imovel_caixa_endereco_cidade', filters.cidade);
    
    // Multiple Bairros support
    if (filters.bairros) {
      const bairroList = filters.bairros.split(',');
      query = query.in('imovel_caixa_endereco_bairro', bairroList);
    }

    if (filters.tipo) query = query.eq('id_tipo_imovel_caixa', filters.tipo);
    if (filters.minPrice) query = query.gte('imovel_caixa_valor_venda', filters.minPrice);
    if (filters.maxPrice) query = query.lte('imovel_caixa_valor_venda', filters.maxPrice);
    
    // Financing filter
    if (filters.onlyFinancing) {
      query = query.eq('imovel_caixa_pagamento_financiamento', true);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await query
      .order('imovel_caixa_valor_desconto_moeda', { ascending: false })
      .range(from, to);

    if (!error && data) {
      setProperties(data);
      setTotal(count || 0);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProperties();
  }, [page, filters]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFilters(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <WhatsAppFloating />

      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Results Info */}
        <div className="flex flex-col sm:flex-row items-center justify-between mb-12 bg-gray-50 p-6 rounded-[32px] border border-gray-100/50">
          <p className="text-sm font-medium text-gray-500">
            Mostrando <span className="text-gray-900 font-black">{properties.length}</span> de <span className="text-gray-900 font-black">{total}</span> oportunidades encontradas para sua busca.
          </p>
          <div className="flex items-center gap-3">
             <span className="text-[10px] font-black text-[#005CA9] uppercase tracking-widest px-3 py-1 bg-white rounded-full border border-gray-200 shadow-sm">
               Rio de Janeiro
             </span>
          </div>
        </div>

        {/* Results Grid */}
        <div className="w-full">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 animate-pulse">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
                <div key={i} className="h-[450px] bg-gray-50 rounded-3xl" />
              ))}
            </div>
          ) : properties.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {properties.map(p => (
                  <PropertyCard 
                    key={p.imoveis_id} 
                    property={{
                      ...p,
                      id: p.imoveis_id,
                      numero_imovel: p.imovel_caixa_numero,
                      uf: p.imovel_caixa_endereco_uf_sigla,
                      cidade: p.imovel_caixa_endereco_cidade,
                      bairro: p.imovel_caixa_endereco_bairro,
                      preco_venda: p.imovel_caixa_valor_venda,
                      valor_avaliacao: p.imovel_caixa_valor_avaliacao,
                      desconto: p.imovel_caixa_valor_desconto_percentual,
                      desconto_moeda: p.imovel_caixa_valor_desconto_moeda,
                      aceita_financiamento: p.imovel_caixa_pagamento_financiamento,
                      descricao: p.imovel_caixa_descricao_csv || p.imovel_caixa_post_descricao,
                      url_imagem: p.imovel_caixa_link_imagem,
                      tipo_imovel: (p.tipos_imovel as any)?.nome || 'Imóvel',
                      post_link_permanente: p.imovel_caixa_post_link_permanente
                    }} 
                  />
                ))}
              </div>

              {/* Pagination */}
              {total > pageSize && (
                <div className="mt-16 flex items-center justify-center gap-6">
                  <button 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-2xl text-[10px] font-black text-gray-600 uppercase tracking-widest disabled:opacity-30 hover:border-[#005CA9]/30 hover:text-[#005CA9] transition-all shadow-sm"
                  >
                    <IoChevronBackOutline size={18} />
                    Anterior
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="w-12 h-12 flex items-center justify-center bg-[#005CA9] text-white rounded-xl text-sm font-black shadow-lg shadow-[#005CA9]/20">
                      {page}
                    </span>
                    <span className="text-gray-400 font-bold">/</span>
                    <span className="text-gray-900 font-black">{Math.ceil(total / pageSize)}</span>
                  </div>
                  <button 
                    onClick={() => setPage(p => p + 1)}
                    disabled={page * pageSize >= total}
                    className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-2xl text-[10px] font-black text-gray-600 uppercase tracking-widest disabled:opacity-30 hover:border-[#005CA9]/30 hover:text-[#005CA9] transition-all shadow-sm"
                  >
                    Próximo
                    <IoChevronForwardOutline size={18} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-40 text-center">
              <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
                <IoSearchOutline size={40} className="text-gray-300" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">Nenhum imóvel encontrado</h3>
              <p className="text-gray-500 max-w-sm font-medium">Não encontramos resultados para seus filtros atuais. Tente buscar em outras cidades ou redefinir suas preferências.</p>
              <button 
                onClick={() => setFilters({ q: '', uf: 'RJ', cidade: '', bairros: '', tipo: '', minPrice: '', maxPrice: '', onlyFinancing: false })}
                className="mt-8 px-8 py-3 bg-[#005CA9] text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-[#005CA9]/20 hover:scale-105 transition-all"
              >
                Limpar todos os filtros
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center font-black text-[#005CA9] uppercase tracking-widest">Carregando portal oficial...</div>}>
      <SearchResultsContent />
    </Suspense>
  );
}
