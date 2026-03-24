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

  // Filters State initialized from URL
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

  // Sync state with URL search params when they change (navigation)
  useEffect(() => {
    setFilters({
      q: searchParams.get('q') || '',
      uf: searchParams.get('uf') || '',
      cidade: searchParams.get('cidade') || '',
      bairros: searchParams.get('bairros') || '',
      tipo: searchParams.get('tipo') || '',
      minPrice: searchParams.get('minPrice') || '',
      maxPrice: searchParams.get('maxPrice') || '',
      onlyFinancing: searchParams.get('onlyFinancing') === 'true',
    });
    setPage(1);
  }, [searchParams]);

  const fetchProperties = async () => {
    setLoading(true);
    // Usamos a view 'properties' que já traz o preço e status atuais via join com atualizacoes_imovel
    let query = supabase
      .from('properties')
      .select('*', { count: 'exact' });

    if (filters.q) {
      query = query.or(`neighborhood.ilike.%${filters.q}%,city.ilike.%${filters.q}%,full_address.ilike.%${filters.q}%`);
    }
    if (filters.uf) query = query.eq('state', filters.uf);
    if (filters.cidade) query = query.eq('city', filters.cidade);
    
    // Multiple Bairros support
    if (filters.bairros) {
      const bairroList = filters.bairros.split(',');
      query = query.in('neighborhood', bairroList);
    }

    if (filters.tipo) query = query.eq('type_id', filters.tipo);
    if (filters.minPrice) query = query.gte('price', filters.minPrice);
    if (filters.maxPrice) query = query.lte('price', filters.maxPrice);
    
    // Financing filter
    if (filters.onlyFinancing) {
      query = query.eq('allows_financing', true);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await query
      .order('discount_amount', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Error fetching properties:', error);
    } else if (data) {
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

      <main className="relative max-w-7xl mx-auto px-4 py-12 z-10">
        {/* Background Decor matching landing page */}
        <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#005CA9]/5 blur-[120px] rounded-full pointer-events-none -z-10" />
        <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#F9B200]/5 blur-[120px] rounded-full pointer-events-none -z-10" />

        {/* Results Info */}
        <div className="flex flex-col sm:flex-row items-center justify-between mb-12 bg-white/40 backdrop-blur-md p-8 rounded-[40px] border border-gray-100 shadow-sm transition-all hover:shadow-xl hover:border-[#005CA9]/10">
          <div className="space-y-1">
            <h2 className="text-[10px] font-black text-[#005CA9] uppercase tracking-[0.3em] mb-1">Oportunidades Encontradas</h2>
            <p className="text-sm font-medium text-gray-500">
              Mostrando <span className="text-gray-900 font-black">{properties.length}</span> de <span className="text-gray-900 font-black">{total}</span> imóveis exclusivos.
            </p>
          </div>
          <div className="flex items-center gap-3 mt-4 sm:mt-0">
              <span className="flex items-center gap-2 text-[10px] font-black text-gray-600 uppercase tracking-widest px-4 py-2 bg-white/60 rounded-full border border-gray-100 shadow-sm">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                {filters.cidade && filters.uf ? `${filters.cidade} - ${filters.uf}` : filters.uf || 'Brasil'}
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
                    key={p.id} 
                    property={{
                      ...p,
                      id: p.id,
                      numero_imovel: p.property_number,
                      uf: p.state,
                      cidade: p.city,
                      bairro: p.neighborhood,
                      preco_venda: p.price,
                      valor_avaliacao: p.appraisal_value,
                      desconto: p.discount_percent,
                      desconto_moeda: p.discount_amount,
                      aceita_financiamento: p.allows_financing,
                      descricao: p.description,
                      url_imagem: p.main_image,
                      tipo_imovel: p.type_name || 'Imóvel',
                      post_link_permanente: p.slug
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
            <div className="flex flex-col items-center justify-center py-48 text-center bg-gray-50/50 backdrop-blur-sm rounded-[60px] border border-dashed border-gray-200">
              <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center mb-8 shadow-2xl shadow-gray-200/50">
                <IoSearchOutline size={48} className="text-[#005CA9] animate-pulse" />
              </div>
              <h3 className="text-3xl font-black text-gray-900 mb-3 tracking-tight uppercase">Nenhum imóvel encontrado</h3>
              <p className="text-gray-500 max-w-sm font-bold text-sm leading-relaxed">
                Não encontramos resultados para seus filtros atuais.<br />
                <span className="text-[#005CA9]">Tente buscar em outras cidades ou redefinir suas preferências.</span>
              </p>
              <button 
                onClick={() => setFilters({ q: '', uf: 'RJ', cidade: '', bairros: '', tipo: '', minPrice: '', maxPrice: '', onlyFinancing: false })}
                className="mt-10 px-10 py-4 bg-[#005CA9] text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl shadow-2xl shadow-[#005CA9]/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
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
