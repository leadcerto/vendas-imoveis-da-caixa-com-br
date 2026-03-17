"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { IoSearchOutline, IoHomeOutline, IoLocationOutline } from 'react-icons/io5';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PropertyCard from '@/components/PropertyCard';
import WhatsAppFloating from '@/components/WhatsAppFloating';

export default function Home() {
  const router = useRouter();
  const [propertiesCount, setPropertiesCount] = useState<number | null>(null);
  const [featuredProperties, setFeaturedProperties] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      // Fetch dynamic count
      const { count } = await supabase
        .from('imoveis_caixa')
        .select('*', { count: 'exact', head: true });
      
      if (count) setPropertiesCount(count);

      // Fetch latest high-discount opportunities
      const { data } = await supabase
        .from('imoveis_caixa')
        .select('*')
        .order('desconto_percentual', { ascending: false })
        .limit(3);
      
      if (data) setFeaturedProperties(data);
    };
    fetchData();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchTerm)}`);
    } else {
      router.push('/search');
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0b] text-white font-sans overflow-hidden">
      <WhatsAppFloating />
      {/* Background Glow */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto border-b border-white/5 backdrop-blur-md bg-black/20">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <IoHomeOutline size={22} className="text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">Imóveis <span className="text-blue-500">Caixa</span></span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
          <Link href="/" className="hover:text-white transition-colors">Início</Link>
          <Link href="/search" className="hover:text-white transition-colors">Busca Avançada</Link>
          <a href="#" className="hover:text-white transition-colors">Como Funciona</a>
          <a href="#" className="hover:text-white transition-colors">Sobre</a>
        </div>

        <button className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-full text-sm font-semibold transition-all shadow-lg shadow-blue-600/20 active:scale-95">
          Falar com Consultor
        </button>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-8 pt-24 pb-32">
        <div className="max-w-3xl">
          <h1 className="text-6xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-8">
            Encontre o imóvel dos seus <span className="bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">sonhos</span> com descontos exclusivos.
          </h1>
          <p className="text-xl text-gray-400 mb-12 max-w-2xl leading-relaxed">
            Plataforma inteligente de busca de imóveis da Caixa. Acesse oportunidades únicas em todo o Brasil com análise de dados em tempo real.
          </p>

          {/* Search Bar Container */}
          <form onSubmit={handleSearch} className="p-2 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl shadow-2xl flex flex-col md:flex-row items-center gap-2">
            <div className="flex-1 w-full flex items-center px-4 gap-3 border-r border-white/10">
              <IoLocationOutline className="text-blue-500" size={24} />
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Qual cidade ou bairro você busca?" 
                className="bg-transparent border-none outline-none w-full py-4 text-white placeholder-gray-500"
              />
            </div>
            
            <button type="submit" className="w-full md:w-auto px-10 py-4 bg-white text-black hover:bg-gray-200 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 active:scale-95">
              <IoSearchOutline size={20} />
              Buscar Agora
            </button>
          </form>

          <div className="mt-12 flex items-center gap-6">
            <div className="flex -space-x-3">
              {[1,2,3,4].map(i => (
                <div key={i} className="w-10 h-10 rounded-full border-2 border-[#0a0a0b] bg-gray-600 flex items-center justify-center text-[10px] font-bold">
                  {i}
                </div>
              ))}
            </div>
            <div className="text-sm text-gray-400">
              <span className="text-white font-bold">{propertiesCount?.toLocaleString('pt-BR') || '...'}</span> imóveis disponíveis hoje para você.
            </div>
          </div>
        </div>
      </section>

      {/* Latest Opportunities Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-8 pb-32">
        <div className="flex items-end justify-between mb-12">
          <div>
            <h2 className="text-3xl font-bold mb-2 tracking-tight">Últimas Oportunidades</h2>
            <p className="text-gray-500">Imóveis selecionados com os maiores descontos da semana.</p>
          </div>
          <Link href="/search" className="text-blue-500 font-bold hover:text-blue-400 transition-colors flex items-center gap-2 group">
            Ver todas <span className="group-hover:translate-x-1 transition-transform">→</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {featuredProperties.map(property => (
            <PropertyCard key={property.numero_imovel} property={property} />
          ))}
          {featuredProperties.length === 0 && Array(3).fill(0).map((_, i) => (
             <div key={i} className="h-96 bg-white/5 rounded-3xl animate-pulse" />
          ))}
        </div>
      </section>

      {/* Bento Grid Features */}
      <section className="relative z-10 max-w-7xl mx-auto px-8 pb-32">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-blue-500/30 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:bg-blue-500/20 transition-all">
              <IoSearchOutline className="text-blue-500" size={24} />
            </div>
            <h3 className="text-xl font-bold mb-3">Busca Inteligente</h3>
            <p className="text-gray-400 text-sm leading-relaxed">Filtros avançados para encontrar exatamente o que você precisa por preço, área ou localização.</p>
          </div>
          
          <div className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-blue-500/30 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:bg-blue-500/20 transition-all">
              <IoHomeOutline className="text-blue-500" size={24} />
            </div>
            <h3 className="text-xl font-bold mb-3">Análise de Dados</h3>
            <p className="text-gray-400 text-sm leading-relaxed">Cruzamos informações de editais e atualizamos nosso banco de dados diariamente.</p>
          </div>

          <div className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-blue-500/30 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:bg-blue-500/20 transition-all">
              <IoLocationOutline className="text-blue-500" size={24} />
            </div>
            <h3 className="text-xl font-bold mb-3">Cobertura Nacional</h3>
            <p className="text-gray-400 text-sm leading-relaxed">Imóveis em todos os estados do Brasil, desde apartamentos até grandes áreas comerciais.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
