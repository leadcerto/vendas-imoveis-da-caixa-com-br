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
  const pageSize = 12;

  // Filters State
  const [filters, setFilters] = useState({
    q: searchParams.get('q') || '',
    uf: searchParams.get('uf') || '',
    cidade: searchParams.get('cidade') || '',
    tipo: searchParams.get('tipo') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
  });

  const fetchProperties = async () => {
    setLoading(true);
    let query = supabase
      .from('imoveis_caixa')
      .select('*', { count: 'exact' });

    if (filters.q) {
      query = query.or(`bairro.ilike.%${filters.q}%,cidade.ilike.%${filters.q}%,endereco.ilike.%${filters.q}%`);
    }
    if (filters.uf) query = query.eq('uf', filters.uf);
    if (filters.cidade) query = query.ilike('cidade', `%${filters.cidade}%`);
    if (filters.tipo) query = query.eq('tipo_imovel', filters.tipo);
    if (filters.minPrice) query = query.gte('preco_venda', filters.minPrice);
    if (filters.maxPrice) query = query.lte('preco_venda', filters.maxPrice);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await query
      .order('nivel_destaque', { ascending: false })
      .order('desconto_percentual', { ascending: false })
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
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <WhatsAppFloating />
      {/* Header */}
      <nav className="border-b border-white/5 bg-black/20 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <IoSearchOutline size={18} />
            </div>
            <span className="font-bold text-lg hidden sm:inline">Imóveis <span className="text-blue-500">Caixa</span></span>
          </Link>
          
          <div className="flex-1 max-w-xl mx-4">
            <div className="relative">
              <IoSearchOutline className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input 
                name="q"
                value={filters.q}
                onChange={handleFilterChange}
                placeholder="Buscar por bairro ou cidade..."
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 outline-none focus:border-blue-500/50 transition-all text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-white/5 rounded-lg transition-colors">
              <IoFilterOutline size={20} />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">
        {/* Filters Sidebar */}
        <aside className="w-full md:w-64 space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <IoFilterOutline className="text-blue-500" /> Filtros
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2 block">Estado (UF)</label>
                <select 
                  name="uf"
                  value={filters.uf}
                  onChange={handleFilterChange}
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm outline-none focus:border-blue-500/50"
                >
                  <option value="">Todos</option>
                  {['SP', 'RJ', 'MG', 'ES', 'PR', 'SC', 'RS', 'BA', 'PE', 'CE', 'DF'].map(uf => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2 block">Preço Máximo</label>
                <input 
                  type="number"
                  name="maxPrice"
                  value={filters.maxPrice}
                  onChange={handleFilterChange}
                  placeholder="Até R$..."
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm outline-none focus:border-blue-500/50"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2 block">Tipo do Imóvel</label>
                <select 
                  name="tipo"
                  value={filters.tipo}
                  onChange={handleFilterChange}
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-sm outline-none focus:border-blue-500/50"
                >
                  <option value="">Todos</option>
                  <option value="Apartamento">Apartamento</option>
                  <option value="Casa">Casa</option>
                  <option value="Terreno">Terreno</option>
                  <option value="Comercial">Comercial</option>
                </select>
              </div>
            </div>
          </div>
        </aside>

        {/* Results Grid */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-8">
            <p className="text-sm text-gray-400">
              Mostrando <span className="text-white font-bold">{properties.length}</span> de <span className="text-white font-bold">{total}</span> oportunidades encontradas.
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-96 bg-white/5 rounded-3xl" />
              ))}
            </div>
          ) : properties.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {properties.map(p => (
                  <PropertyCard key={p.numero_imovel} property={p} />
                ))}
              </div>

              {/* Pagination */}
              {total > pageSize && (
                <div className="mt-12 flex items-center justify-center gap-4">
                  <button 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 bg-white/5 border border-white/10 rounded-xl disabled:opacity-30 hover:bg-white/10 transition-colors"
                  >
                    <IoChevronBackOutline size={20} />
                  </button>
                  <span className="text-sm font-bold">Página {page}</span>
                  <button 
                    onClick={() => setPage(p => p + 1)}
                    disabled={page * pageSize >= total}
                    className="p-2 bg-white/5 border border-white/10 rounded-xl disabled:opacity-30 hover:bg-white/10 transition-colors"
                  >
                    <IoChevronForwardOutline size={20} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                <IoSearchOutline size={32} className="text-gray-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">Nenhum imóvel encontrado</h3>
              <p className="text-gray-500 max-w-xs">Tente ajustar seus filtros ou buscar por outra região.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center text-white">Carregando portal...</div>}>
      <SearchResultsContent />
    </Suspense>
  );
}
