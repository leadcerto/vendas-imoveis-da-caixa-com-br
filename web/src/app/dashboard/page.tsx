"use client";

"use client";

import { useEffect, useState } from 'react';
import { propertyService, Property } from '@/services/dashboard/propertyService';
import { supabase } from '@/lib/supabase';
import { IoSearchOutline, IoFilterOutline, IoFlashOutline, IoLocationOutline, IoRibbonOutline, IoCloseOutline, IoChevronForwardOutline } from 'react-icons/io5';
import { SkeletonGrid } from '@/components/SkeletonCard';
import Link from 'next/link';

export default function DashboardPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedSelo, setSelectedSelo] = useState('');
  const [selectedModalidade, setSelectedModalidade] = useState('');
  const [hasEnrichment, setHasEnrichment] = useState(false);

  // Options for selects
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);

  useEffect(() => {
    async function loadOptions() {
      const { data: states } = await (supabase.from('properties').select('state').order('state'));
      if (states) setAvailableStates(Array.from(new Set(states.map((s: { state: string }) => s.state))).filter(Boolean));
    }
    loadOptions();
  }, []);

  useEffect(() => {
    async function loadCities() {
      let query = supabase.from('properties').select('city').order('city');
      if (selectedState) query = query.eq('state', selectedState);
      const { data: cities } = await query;
      if (cities) setAvailableCities(Array.from(new Set(cities.map((c: { city: string }) => c.city))).filter(Boolean));
    }
    loadCities();
  }, [selectedState]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const { data } = await propertyService.getProperties(50, 0, {
          searchTerm,
          state: selectedState,
          city: selectedCity,
          selo: selectedSelo,
          modalidade: selectedModalidade,
          hasEnrichment
        });
        setProperties(data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    // Debounce search slightly
    const timeout = setTimeout(load, searchTerm ? 500 : 0);
    return () => clearTimeout(timeout);
  }, [searchTerm, selectedState, selectedCity, selectedSelo, selectedModalidade, hasEnrichment]);

  return (
    <div className="min-h-screen bg-[#060607] text-white p-6 md:p-12 selection:bg-blue-500/30">
      {/* Background Decorative Elements */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/5 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-green-600/5 blur-[120px] rounded-full"></div>
      </div>

      <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <p className="text-gray-400 font-medium flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
          Explorando {properties.length} Oportunidades Certificadas
        </p>

        <Link 
          href="/dashboard/grupos"
          className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] uppercase font-black tracking-[0.2em] flex items-center gap-2 hover:bg-blue-500/10 hover:border-blue-500/50 hover:text-blue-400 transition-all"
        >
          <IoRibbonOutline size={14} /> Gerenciar Grupos
        </Link>
      </div>

      {/* Filter Bar (Sticky) - Adjusted top to account for global header */}
      <section className="sticky top-4 z-40 glass rounded-[32px] p-4 mb-16 shadow-2xl shadow-black/50 border border-white/5 transition-all outline outline-1 outline-white/5">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="flex-1 min-w-[280px] relative group">
             <IoSearchOutline className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
             <input 
               type="text" 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 pl-14 pr-6 text-sm focus:border-blue-500/50 transition-all outline-none placeholder:text-gray-700"
               placeholder="Busca avançada por endereço, condomínio ou ID..."
             />
          </div>

          <div className="h-8 w-px bg-white/5 mx-2 hidden lg:block"></div>

          {/* Select Group */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'state', label: 'Estado', val: selectedState, set: (v: string) => {setSelectedState(v); setSelectedCity('');}, options: availableStates, placeholder: 'Brasil' },
              { id: 'city', label: 'Cidade', val: selectedCity, set: setSelectedCity, options: availableCities, placeholder: 'Cidades' },
              { id: 'badge', label: 'Selo', val: selectedSelo, set: setSelectedSelo, options: ['🥇', '🥈', '🥉', '👍'], placeholder: 'Performance' },
            ].map((f) => (
              <div key={f.id} className="relative group">
                <select 
                  value={f.val}
                  onChange={(e) => f.set(e.target.value)}
                  className="bg-black/40 border border-white/5 rounded-2xl py-3.5 px-6 text-xs font-bold uppercase tracking-wider focus:border-blue-500/50 transition-all outline-none appearance-none cursor-pointer min-w-[120px] hover:bg-black/60"
                >
                  <option value="">{f.placeholder}</option>
                  {f.options.map((opt: string) => (
                    <option key={opt} value={opt} className="bg-[#0a0a0b] text-white">
                      {f.id === 'badge' ? (opt === '🥇' ? '🥇 Ouro' : opt === '🥈' ? '🥈 Prata' : opt === '🥉' ? '🥉 Bronze' : '👍 Aprovado') : opt}
                    </option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600 text-[8px]">▼</div>
              </div>
            ))}
          </div>

          <button 
            onClick={() => setHasEnrichment(!hasEnrichment)}
            className={`px-6 py-4 rounded-2xl text-[10px] uppercase font-black tracking-[0.2em] flex items-center gap-2 transition-all border ${hasEnrichment ? 'bg-blue-500 text-white border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.5)]' : 'bg-white/5 border-white/5 text-gray-500 hover:bg-white/10'}`}
          >
            <IoLocationOutline className={hasEnrichment ? 'animate-bounce' : ''} size={14} /> Enriquecidos
          </button>

          {(searchTerm || selectedState || selectedCity || selectedSelo || selectedModalidade || hasEnrichment) && (
            <button 
              onClick={() => {
                setSearchTerm('');
                setSelectedState('');
                setSelectedCity('');
                setSelectedSelo('');
                setSelectedModalidade('');
                setHasEnrichment(false);
              }}
              className="p-4 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all"
            >
              <IoCloseOutline size={24} />
            </button>
          )}
        </div>
      </section>

      {error ? (
        <div className="p-12 glass rounded-3xl text-center border-red-500/20">
          <span className="text-4xl mb-4 block">⚠️</span>
          <h2 className="text-xl font-bold text-red-400">Erro na Conexão</h2>
          <p className="text-gray-500 mt-2">{error}</p>
        </div>
      ) : loading ? (
        <SkeletonGrid count={9} />
      ) : properties.length === 0 ? (
        <div className="p-24 glass rounded-[48px] text-center">
          <span className="text-6xl mb-6 block opacity-20">🔍</span>
          <h2 className="text-2xl font-bold text-gray-400">Nenhum imóvel corresponde aos filtros</h2>
          <p className="text-gray-600 mt-2">Tente ajustar seus critérios de busca ou limpar os filtros.</p>
          <button 
            onClick={() => {
              setSearchTerm('');
              setSelectedState('');
              setSelectedCity('');
              setSelectedSelo('');
              setSelectedModalidade('');
              setHasEnrichment(false);
            }}
            className="mt-8 px-8 py-4 bg-white/5 border border-white/10 rounded-2xl font-bold hover:bg-white/10 transition-all"
          >
            Limpar Todos os Filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {properties.map((p: Property) => (
            <Link 
              href={`/imovel/${p.id}`}
              key={p.id} 
              className="group relative p-8 rounded-[40px] bg-white/[0.02] border border-white/5 hover:border-blue-500/30 transition-all duration-500 flex flex-col justify-between hover:translate-y-[-8px] hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)] card-gradient overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2">Imóvel #{p.id}</span>
                    <h3 className="text-xl font-bold leading-tight group-hover:text-blue-400 transition-colors line-clamp-2 pr-4">{p.title || 'Sem título'}</h3>
                  </div>
                  {p.selo_oportunidade && (
                    <div 
                      className="text-3xl filter saturate-150 drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]" 
                      title={p.selo_oportunidade.includes('; ') ? p.selo_oportunidade.split('; ')[1] : ''}
                      dangerouslySetInnerHTML={{ __html: p.selo_oportunidade.split(' ')[0] }}
                    />
                  )}
                </div>
                <div className="flex items-center gap-2 text-gray-400 text-sm font-medium">
                  <IoLocationOutline className="text-blue-500" />
                  <span>{p.city}, {p.state}</span>
                </div>
              </div>
              
              <div className="relative z-10 flex flex-col gap-6 mt-10 pt-8 border-t border-white/5">
                <div className="flex justify-between items-end">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-1">Preço de Venda</span>
                    <span className="text-3xl font-black text-white">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(p.price || 0)}
                    </span>
                  </div>
                  <div className="px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-xl">
                    <span className="text-green-400 font-black text-sm">
                      -{p.discount_percent}%
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[10px] px-4 py-2 bg-white/5 border border-white/5 rounded-full uppercase font-black tracking-widest text-gray-500">{p.status || 'Disponível'}</span>
                  
                  {p.ceps_imovel?.cep_status === 'enriquecido' ? (
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-green-400 bg-green-500/10 px-4 py-2 rounded-full border border-green-500/20">
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.5)]"></span>
                      Certificada
                    </div>
                  ) : (
                    <IoChevronForwardOutline className="text-gray-700 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" size={20} />
                  )}
                </div>
              </div>

              {/* Hover Glow */}
              <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-blue-500/10 blur-[60px] rounded-full group-hover:bg-blue-500/20 transition-all"></div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
