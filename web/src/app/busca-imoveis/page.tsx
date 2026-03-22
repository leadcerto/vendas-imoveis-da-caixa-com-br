"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { IoSearchOutline, IoHomeOutline, IoLocationOutline } from 'react-icons/io5';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PropertyCard from '@/components/PropertyCard';
import WhatsAppFloating from '@/components/WhatsAppFloating';

export default function BuscaImoveis() {
  const router = useRouter();
  const [propertiesCount, setPropertiesCount] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Advanced Filter State
  const [cities, setCities] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [bairros, setBairros] = useState<string[]>([]);
  const [selectedBairros, setSelectedBairros] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [onlyFinancing, setOnlyFinancing] = useState(false);
  const [loadingBairros, setLoadingBairros] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      // Fetch dynamic count
      const { count } = await supabase
        .from('imoveis')
        .select('*', { count: 'exact', head: true });
      
      if (count) setPropertiesCount(count);

      // Fetch Cities in RJ
      const { data: citiesData } = await supabase
        .from('imoveis')
        .select('imovel_caixa_endereco_cidade')
        .eq('imovel_caixa_endereco_uf_sigla', 'RJ')
        .not('imovel_caixa_endereco_cidade', 'is', null)
        .order('imovel_caixa_endereco_cidade', { ascending: true });
      
      if (citiesData) {
        const uniqueCities = Array.from(new Set(citiesData.map(c => c.imovel_caixa_endereco_cidade)));
        setCities(uniqueCities);
      }
    };
    fetchInitialData();
  }, []);

  // Fetch Bairros when city changes
  useEffect(() => {
    const fetchBairros = async () => {
      if (!selectedCity) {
        setBairros([]);
        return;
      }
      setLoadingBairros(true);
      const { data } = await supabase
        .from('imoveis')
        .select('imovel_caixa_endereco_bairro')
        .eq('imovel_caixa_endereco_cidade', selectedCity)
        .eq('imovel_caixa_endereco_uf_sigla', 'RJ')
        .not('imovel_caixa_endereco_bairro', 'is', null)
        .order('imovel_caixa_endereco_bairro', { ascending: true });
      
      if (data) {
        const uniqueBairros = Array.from(new Set(data.map(b => b.imovel_caixa_endereco_bairro)));
        setBairros(uniqueBairros);
      }
      setLoadingBairros(false);
    };
    fetchBairros();
    setSelectedBairros([]); // Reset neighborhoods when city changes
  }, [selectedCity]);

  const toggleBairro = (bairro: string) => {
    setSelectedBairros(prev => 
      prev.includes(bairro) ? prev.filter(b => b !== bairro) : [...prev, bairro]
    );
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (selectedCity) params.set('cidade', selectedCity);
    if (selectedBairros.length > 0) params.set('bairros', selectedBairros.join(','));
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (onlyFinancing) params.set('onlyFinancing', 'true');
    params.set('uf', 'RJ');
    
    router.push(`/search?${params.toString()}`);
  };

  return (
    <main className="min-h-screen bg-white text-[#334155] font-sans pb-24">
      <WhatsAppFloating />
      {/* Background Decor */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#005CA9]/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#F9B200]/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Advanced Search Interface */}
      <section className="relative z-20 max-w-5xl mx-auto px-8 pt-12 md:pt-20">
        <form onSubmit={handleSearch} className="bg-white border border-gray-100 rounded-[40px] shadow-2xl p-8 md:p-12 space-y-12 transition-all hover:border-[#005CA9]/20">
          
          {/* Step 1: City & Bairro */}
          <div className="space-y-8">
            <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
              {/* Seção 1 Removida conforme pedido */}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-sm font-black text-gray-400 uppercase tracking-widest pl-2">Cidade / Município</label>
                <div className="relative">
                  <IoLocationOutline className="absolute left-4 top-1/2 -translate-y-1/2 text-[#005CA9]" size={24} />
                  <select 
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-5 pl-12 pr-4 text-gray-800 font-bold focus:ring-2 focus:ring-[#005CA9]/20 outline-none appearance-none cursor-pointer"
                  >
                    <option value="">Selecione a cidade</option>
                    {cities.map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedCity && (
                <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-500">
                  <label className="text-sm font-black text-gray-400 uppercase tracking-widest pl-2">
                    Bairros disponíveis em {selectedCity}
                  </label>
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 max-h-[220px] overflow-y-auto custom-scrollbar group">
                    {loadingBairros ? (
                      <div className="flex items-center justify-center py-8 text-gray-400 animate-pulse font-bold">Carregando bairros...</div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {bairros.map(bairro => (
                          <label key={bairro} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${selectedBairros.includes(bairro) ? 'bg-white border-[#005CA9] shadow-sm' : 'border-transparent hover:bg-white'}`}>
                            <input 
                              type="checkbox"
                              checked={selectedBairros.includes(bairro)}
                              onChange={() => toggleBairro(bairro)}
                              className="w-5 h-5 rounded-md border-gray-300 text-[#005CA9] focus:ring-[#005CA9]"
                            />
                            <span className={`text-sm font-bold ${selectedBairros.includes(bairro) ? 'text-[#005CA9]' : 'text-gray-600'}`}>
                              {bairro}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-right px-2">
                    {selectedBairros.length} selecionados
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Price Range & Options */}
          <div className="space-y-8">
            <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
              {/* Seção 2 Removida conforme pedido */}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-3">
                <label className="text-sm font-black text-gray-400 uppercase tracking-widest pl-2">Preço Mínimo (R$)</label>
                <input 
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="Ex: 100.000"
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-5 px-6 text-gray-800 font-bold focus:ring-2 focus:ring-[#005CA9]/20 outline-none"
                />
              </div>

              <div className="space-y-3">
                <label className="text-sm font-black text-gray-400 uppercase tracking-widest pl-2">Preço Máximo (R$)</label>
                <input 
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Ex: 500.000"
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-5 px-6 text-gray-800 font-bold focus:ring-2 focus:ring-[#005CA9]/20 outline-none"
                />
              </div>

              <div className="flex items-end pb-2">
                <label className="relative flex items-center gap-4 p-4 rounded-2xl bg-[#005CA9]/5 border border-[#005CA9]/10 cursor-pointer group hover:bg-[#005CA9]/10 transition-all w-full select-none">
                  <div className="relative h-6 w-11 flex-shrink-0 cursor-pointer rounded-full bg-gray-200 transition-colors duration-200 ease-in-out">
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={onlyFinancing}
                      onChange={() => setOnlyFinancing(!onlyFinancing)}
                    />
                    <div className={`absolute left-0 inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${onlyFinancing ? 'translate-x-5 bg-[#005CA9]' : 'translate-x-0'}`} />
                    <div className={`absolute inset-0 rounded-full transition-colors ${onlyFinancing ? 'bg-[#005CA9]' : ''}`} />
                  </div>
                  <span className="text-sm font-black text-[#005CA9] uppercase tracking-tight">Somente com Financiamento</span>
                </label>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-8">
            <button 
              type="submit" 
              className="w-full py-6 bg-[#F9B200] hover:bg-[#005CA9] text-white rounded-3xl font-black text-xl transition-all flex items-center justify-center gap-4 active:scale-[0.98] shadow-2xl shadow-[#F9B200]/40 group uppercase tracking-widest"
            >
              <IoSearchOutline size={32} className="group-hover:scale-125 transition-transform" />
              Buscar Imóveis
            </button>
            <p className="text-center mt-6 text-sm font-medium text-gray-400">
              Estamos monitorando <span className="text-[#005CA9] font-black">{propertiesCount?.toLocaleString('pt-BR') || '...'}</span> imóveis hoje.
            </p>
          </div>
        </form>
      </section>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #005CA940;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #005CA9;
        }
      `}</style>
    </main>
  );
}
