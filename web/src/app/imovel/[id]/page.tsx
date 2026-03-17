"use client";

import { useEffect, useState, use } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  IoLocationOutline, IoBedOutline, IoSquareOutline, IoChevronBackOutline, 
  IoLogoWhatsapp, IoShieldCheckmarkOutline, IoTrendingDownOutline, 
  IoInformationCircleOutline, IoCalendarOutline, IoDocumentTextOutline,
  IoWalletOutline, IoFileTrayStackedOutline, IoHelpCircleOutline, IoMailOutline,
  IoShareSocialOutline, IoHeartOutline, IoChevronDownOutline, IoLockClosedOutline,
  IoBarChartOutline, IoAlertCircleOutline, IoTimeOutline
} from 'react-icons/io5';
import Link from 'next/link';
import WhatsAppFloating from '@/components/WhatsAppFloating';
import PropertyCard from '@/components/PropertyCard';

export default function PropertyDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [property, setProperty] = useState<any>(null);
  const [similarProperties, setSimilarProperties] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCalculations, setShowCalculations] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [currentUrl, setCurrentUrl] = useState('');

  useEffect(() => {
    setCurrentUrl(window.location.href);
    const fetchData = async () => {
      // Fetch property details
      const { data: propData, error: propError } = await supabase
        .from('imoveis_caixa')
        .select(`
          *,
          imoveis_despesas_calculadas (*)
        `)
        .eq('numero_imovel', id)
        .single();

      if (!propError && propData) {
        setProperty(propData);

        // Fetch similar properties
        const { data: similarData } = await supabase
          .from('imoveis_caixa')
          .select('*')
          .eq('cidade', propData.cidade)
          .neq('numero_imovel', id)
          .limit(3);
        
        if (similarData) setSimilarProperties(similarData);

        // Fetch history
        const { data: historyData } = await supabase
          .from('historico_atualizacoes')
          .select('*')
          .eq('numero_imovel', id)
          .order('data_geracao', { ascending: false });
        
        if (historyData) setHistory(historyData);
      }
      setLoading(false);
    };

    fetchData();
  }, [id]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center text-white font-sans">
        <div className="animate-pulse text-xl font-bold tracking-tight">Carregando portal de oportunidades...</div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center text-white px-4 text-center">
        <h1 className="text-3xl font-bold mb-6">Imóvel não localizado</h1>
        <p className="text-gray-400 mb-8 max-w-md">Este imóvel pode ter sido vendido ou o link está incorreto.</p>
        <Link href="/search" className="px-8 py-3 bg-blue-600 rounded-full font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-500 transition-all">
          Voltar para busca
        </Link>
      </div>
    );
  }

  const lucro = Number(property.valor_avaliacao - property.preco_venda);

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white font-sans pb-20">
      <WhatsAppFloating />

      {/* BLOCO 0: HEADER / NAV (AUX) */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/search" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
            <IoChevronBackOutline size={20} />
            <span className="hidden sm:inline">Voltar para busca</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <IoShieldCheckmarkOutline size={18} />
            </div>
            <span className="font-bold text-sm tracking-tight">Oportunidade <span className="text-blue-500">Caixa</span></span>
          </div>
          <button className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors">
            <IoShareSocialOutline size={22} />
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 pt-24 space-y-20">
        
        {/* BLOCO 1: TÍTULO */}
        <section className="text-center py-10">
          <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
            🏠 {property.tipo_imovel} em {property.bairro}
          </h1>
          <p className="text-xl text-gray-400 mt-4 font-medium italic">
            {property.cidade} - {property.uf} | Ref: {property.numero_imovel}
          </p>
        </section>

        {/* BLOCO 2: GALERIA DE FOTOS */}
        <section className="relative aspect-video max-w-5xl mx-auto rounded-[40px] overflow-hidden border border-white/10 group shadow-2xl">
          <img 
            src={property.url_imagem} 
            alt={property.tipo_imovel}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1073&auto=format&fit=crop';
            }}
          />
          <div className="absolute inset-x-0 bottom-0 p-8 md:p-12 bg-gradient-to-t from-black via-black/60 to-transparent">
            <div className="flex flex-wrap items-center gap-4">
              <span className="px-5 py-2 bg-blue-600 text-white rounded-full text-xs font-black uppercase tracking-widest shadow-lg">
                {property.modalidade_venda}
              </span>
              <span className="px-5 py-2 bg-white/10 backdrop-blur-md border border-white/10 text-white rounded-full text-xs font-black uppercase tracking-widest">
                Exclusivo
              </span>
            </div>
          </div>
        </section>

        {/* BLOCO 3: LUCRO IMOBILIÁRIO (DESTAQUE MÁXIMO) */}
        <section className="max-w-4xl mx-auto">
          <div className="relative p-10 md:p-16 rounded-[50px] bg-gradient-to-br from-white/5 to-transparent border border-white/10 overflow-hidden shadow-2xl text-center animate-pulse-soft">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-blue-600/20 blur-[100px] rounded-full pointer-events-none" />
            
            <h2 className="text-2xl font-black mb-10 flex items-center justify-center gap-3">
              💰 Lucro Imobiliário
            </h2>

            <div className="space-y-12 relative z-10">
              <div className="inline-block px-10 py-8 rounded-[40px] gradient-lucro shadow-2xl transform transition-transform hover:scale-105 border-2 border-white/20">
                <p className="text-sm font-black text-white/80 uppercase tracking-[0.2em] mb-2 flex items-center justify-center gap-2">
                   💎 Lucro Imobiliário
                </p>
                <h3 className="text-5xl md:text-7xl font-black text-white tracking-tighter">
                  {formatCurrency(lucro)}
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left border-t border-white/5 pt-12">
                <div className="p-4 rounded-3xl hover:bg-white/5 transition-colors">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                    🏷️ Valor da Avaliação:
                  </p>
                  <p className="text-xl font-bold text-gray-400 line-through">
                    {formatCurrency(Number(property.valor_avaliacao))}
                  </p>
                </div>
                <div className="p-4 rounded-3xl hover:bg-white/5 transition-colors">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                    💵 Valor Mínimo:
                  </p>
                  <p className="text-2xl font-black text-white">
                    {formatCurrency(Number(property.preco_venda))}
                  </p>
                </div>
                <div className="p-4 rounded-3xl hover:bg-white/5 transition-colors">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                    🎁 Desconto de:
                  </p>
                  <p className="text-2xl font-black text-green-400">
                    {Math.round(property.desconto_percentual)}%
                  </p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4 pt-8">
                <button className="flex-1 py-5 bg-orange-600 hover:bg-orange-500 text-white rounded-3xl font-black text-lg transition-all shadow-xl shadow-orange-600/20 active:scale-95 flex items-center justify-center gap-2 animate-shine">
                  <IoHeartOutline size={24} /> Tenho Interesse
                </button>
                <button className="flex-1 py-5 bg-blue-800 hover:bg-blue-700 text-white rounded-3xl font-black text-lg transition-all shadow-xl shadow-blue-800/20 active:scale-95 flex items-center justify-center gap-2">
                  <IoShareSocialOutline size={24} /> Compartilhar
                </button>
                <a 
                  href={`https://wa.me/5521997882950?text=${encodeURIComponent(`Tenho interesse no imóvel ${property.numero_imovel}`)}`}
                  target="_blank"
                  className="flex-1 py-5 bg-green-600 hover:bg-green-500 text-white rounded-3xl font-black text-lg transition-all shadow-xl shadow-green-600/20 active:scale-95 flex items-center justify-center gap-2"
                >
                  <IoLogoWhatsapp size={24} /> WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* BLOCO 4: ÚLTIMA ATUALIZAÇÃO */}
        <section className="bg-white/3 border border-white/5 rounded-[40px] p-10 md:p-14 text-center">
          <h2 className="text-2xl font-black mb-8 flex items-center justify-center gap-3">
             🔄 Última Atualização
          </h2>
          <div className="space-y-4 max-w-2xl mx-auto">
             <div className="flex items-center justify-center gap-2 text-blue-400 font-bold">
               <IoCalendarOutline /> {new Date(property.data_geracao).toLocaleString('pt-BR')}
             </div>
             <p className="text-2xl font-bold tracking-tight">{property.tipo_imovel} em {property.bairro}, {property.cidade} - {property.uf}</p>
             <p className="text-gray-500 text-lg">{property.endereco}</p>
          </div>
        </section>

        {/* BLOCO 5: SOBRE O IMÓVEL */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="bg-white/5 border border-white/10 rounded-[40px] p-10">
            <h2 className="text-2xl font-black mb-10 flex items-center gap-3">
              🏠 Sobre o Imóvel
            </h2>
            <div className="grid grid-cols-2 gap-y-10">
               <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Tipo</p>
                  <p className="text-lg font-bold">{property.tipo_imovel}</p>
               </div>
               <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Dormitórios</p>
                  <p className="text-lg font-bold">{property.quartos || '—'}</p>
               </div>
               <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Privativa</p>
                  <p className="text-lg font-bold">{Math.round(property.area_privativa)}m²</p>
               </div>
               <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Total</p>
                  <p className="text-lg font-bold">{Math.round(property.area_total)}m²</p>
               </div>
            </div>
            <div className="mt-12 pt-10 border-t border-white/5">
               <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                 <IoDocumentTextOutline /> Descrição
               </h3>
               <p className="text-gray-400 leading-relaxed text-sm">
                 {property.descricao || 'Informações técnicas detalhadas estão disponíveis no edital oficial da Caixa.'}
               </p>
            </div>
          </div>

          <div className="space-y-10">
             <div className="bg-white/5 border border-white/10 rounded-[40px] p-10">
               <h3 className="text-xl font-black mb-8 flex items-center gap-2">
                 <IoWalletOutline className="text-green-500" /> Regras de Pagamento
               </h3>
               <ul className="space-y-4">
                 <li className="flex items-center justify-between p-4 rounded-2xl bg-black/40 border border-white/5">
                   <span className="font-bold">Financiamento</span>
                   <span className={property.aceita_financiamento ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                     {property.aceita_financiamento ? '✅ SIM' : '❌ NÃO'}
                   </span>
                 </li>
                 <li className="flex items-center justify-between p-4 rounded-2xl bg-black/40 border border-white/5">
                   <span className="font-bold">Uso de FGTS</span>
                   <span className={property.permite_fgts ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                     {property.permite_fgts ? '✅ SIM' : '❌ NÃO'}
                   </span>
                 </li>
                 <li className="flex items-center justify-between p-4 rounded-2xl bg-black/40 border border-white/5">
                   <span className="font-bold">Consórcio</span>
                   <span className="text-red-400 font-bold">❌ NÃO</span>
                 </li>
               </ul>
             </div>

             <div className="bg-white/5 border border-white/10 rounded-[40px] p-10">
               <h3 className="text-xl font-black mb-8 flex items-center gap-2">
                 <IoFileTrayStackedOutline className="text-blue-500" /> Documentação
               </h3>
               <div className="space-y-3">
                 <div className="flex justify-between text-sm py-2 border-b border-white/5">
                   <span className="text-gray-500">Número</span>
                   <span className="font-bold font-mono">{property.numero_imovel}</span>
                 </div>
                 <div className="flex justify-between text-sm py-2 border-b border-white/5">
                   <span className="text-gray-500">Matrícula</span>
                   <span className="font-bold font-mono text-blue-400">{property.matricula || 'Disponível'}</span>
                 </div>
                 <div className="flex justify-between text-sm py-2">
                   <span className="text-gray-500">Ofício</span>
                   <span className="font-bold">{property.oficio || '—'}</span>
                 </div>
               </div>
             </div>
          </div>
        </section>

        {/* BLOCO 6: CÁLCULOS DO INVESTIDOR (Área Restrita) */}
        <section className="bg-white/3 border border-white/5 rounded-[40px] p-10 md:p-14 overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-3xl -mr-32 -mt-32 rounded-full" />
          
          <h2 className="text-2xl font-black mb-10 flex items-center gap-3">
            📊 Cálculos do Investidor
          </h2>

          {!showCalculations ? (
            <div className="flex flex-col items-center justify-center py-20 bg-black/40 rounded-3xl border border-white/5 backdrop-blur-sm">
               <IoLockClosedOutline size={48} className="text-gray-600 mb-4" />
               <p className="text-gray-400 font-medium mb-8">Esta área contém projeções detalhadas de ROI e custos.</p>
               <button 
                 onClick={() => setShowCalculations(true)}
                 className="px-10 py-4 bg-white text-black rounded-2xl font-black hover:bg-gray-100 transition-all flex items-center gap-2"
               >
                 Ver Cálculos do Investimento
               </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 animate-fade-in">
               <div className="space-y-6">
                 {[
                   { label: 'Valor de Compra', val: formatCurrency(Number(property.preco_venda)), icon: <IoWalletOutline /> },
                   { label: 'ITBI + Registro (Est.)', val: formatCurrency(Number(property.preco_venda) * 0.05), icon: <IoDocumentTextOutline /> },
                   { label: 'Valor de Mercado', val: formatCurrency(Number(property.valor_avaliacao)), icon: <IoBarChartOutline /> },
                   { label: 'Lucro Líquido Previsto', val: formatCurrency(lucro * 0.8), icon: <IoTrendingDownOutline />, highlight: true },
                 ].map((item, idx) => (
                   <div key={idx} className={`p-6 rounded-3xl border border-white/5 flex items-center justify-between ${item.highlight ? 'bg-blue-600/10 border-blue-500/20' : 'bg-white/5'}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-blue-400">{item.icon}</span>
                        <span className="font-bold text-gray-400">{item.label}</span>
                      </div>
                      <span className={`text-xl font-black ${item.highlight ? 'text-blue-400' : 'text-white'}`}>{item.val}</span>
                   </div>
                 ))}
               </div>
               <div className="bg-black/40 p-10 rounded-[40px] border border-white/5 flex flex-col items-center justify-center text-center">
                  <div className="relative w-48 h-48 mb-8">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="96" cy="96" r="80" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-white/5" />
                      <circle cx="96" cy="96" r="80" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={2 * Math.PI * 80} strokeDashoffset={2 * Math.PI * 80 * (1 - 0.42)} className="text-blue-500" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-black">42%</span>
                      <span className="text-xs font-bold text-gray-500 uppercase">ROI Est.</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed">Considerando valor médio de mercado e despesas operacionais padrão para leilões da Caixa.</p>
               </div>
            </div>
          )}
        </section>

        {/* BLOCO 6-10: PLACEHOLDERS PARA OUTROS BLOCOS (ESTRUTURA COMPLETA) */}
        
        {/* BLOCO 7: FORMAS DE PAGAMENTO */}
        <section className="bg-blue-900/10 border border-blue-500/20 rounded-[40px] p-10 md:p-14">
          <h2 className="text-2xl font-black mb-8 flex items-center gap-3">
            💳 Formas de Pagamento
          </h2>
          <div className="prose prose-invert max-w-none text-gray-400">
            <p>Os imóveis da Caixa podem ser adquiridos via pagamento à vista, FGTS ou Financiamento, dependendo da modalidade. Para imóveis que aceitam financiamento, as taxas são as mesmas praticadas para imóveis novos.</p>
          </div>
        </section>

        {/* BLOCO 8: DESPESAS */}
        <section className="bg-yellow-900/10 border border-yellow-500/20 rounded-[40px] p-10 md:p-14">
          <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
             💸 Regras de Despesas
          </h2>
          <p className="p-4 bg-yellow-500/10 text-yellow-500 rounded-2xl font-bold mb-6 flex items-center gap-2">
            ⚠️ As regras de pagamento de condomínio e IPTU variam por edital.
          </p>
          <p className="text-gray-400 leading-relaxed">Geralmente, despesas anteriores à data da venda são quitadas pela Caixa, mas recomendamos a consulta integral ao edital para confirmar os termos específicos deste lote.</p>
        </section>

        {/* BLOCO 9: INFORMAÇÕES ADICIONAIS */}
        {property.observacoes && (
          <section className="bg-blue-600 border border-white/10 rounded-[40px] p-10 md:p-14 text-white">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
              <IoAlertCircleOutline size={32} /> Informações Adicionais
            </h2>
            <div className="p-6 bg-white/10 rounded-3xl border border-white/10">
              <p className="text-lg font-medium leading-relaxed">{property.observacoes}</p>
            </div>
          </section>
        )}

        {/* BLOCO 10: DÚVIDAS FREQUENTES */}
        <section className="max-w-4xl mx-auto">
           <h2 className="text-2xl md:text-3xl font-black mb-12 text-center flex items-center justify-center gap-3">
             ❓ Dúvidas Frequentes
           </h2>
           <div className="space-y-4">
             {[
               { q: "Como faço para comprar este imóvel?", a: "Você deve registrar uma proposta oficial no site da Caixa. Nossa equipe pode auxiliar em todo o processo de análise e envio." },
               { q: "Posso financiar 100% do valor?", a: "Geralmente a Caixa financia até 80-90% para imóveis retomados, dependendo da sua modalidade de crédito." },
               { q: "O imóvel está desocupado?", a: "A maioria dos imóveis de leilão estão ocupados. O processo de desocupação é de responsabilidade do comprador, mas costuma ser simples judicialmente." },
               { q: "Quais são os custos além do valor do imóvel?", a: "Você deve considerar ITBI, Escritura e Registro. Em leilões da Caixa, débitos de IPTU e Condomínio costumam ser quitados pelo vendedor até a data da venda." }
             ].map((item, i) => (
               <div key={i} className={`accordion-item rounded-3xl bg-white/5 border border-white/10 transition-all ${activeFaq === i ? 'border-blue-500/50 bg-white/8' : ''}`}>
                  <button 
                    onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                    className="w-full p-6 text-left flex items-center justify-between group"
                  >
                    <span className="font-bold text-lg group-hover:text-blue-400 transition-colors">{item.q}</span>
                    <IoChevronDownOutline size={24} className={`text-gray-600 transition-transform duration-300 ${activeFaq === i ? 'rotate-180 text-blue-400' : ''}`} />
                  </button>
                  <div className={`accordion-content px-6 ${activeFaq === i ? 'max-h-96 pb-6' : 'max-h-0'}`}>
                    <p className="text-gray-400 leading-relaxed">{item.a}</p>
                  </div>
               </div>
             ))}
           </div>
        </section>

        {/* BLOCO 13: IMÓVEIS SEMELHANTES */}
        {similarProperties.length > 0 && (
          <section>
            <h2 className="text-2xl font-black mb-12 flex items-center justify-center gap-3">
              🏘️ Imóveis Semelhantes
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {similarProperties.map((similar: any) => (
                <PropertyCard key={similar.numero_imovel} property={similar} />
              ))}
            </div>
          </section>
        )}

        {/* BLOCO 14: HISTÓRICO DE ATUALIZAÇÕES */}
        <section className="overflow-hidden">
          <h2 className="text-2xl font-black mb-10 flex items-center justify-center gap-3">
            📜 Histórico de Atualizações
          </h2>
          <div className="bg-white/5 border border-white/10 rounded-[40px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white/5">
                    <th className="p-6 font-black text-gray-400 uppercase tracking-widest text-xs">Data</th>
                    <th className="p-6 font-black text-gray-400 uppercase tracking-widest text-xs">Valor Venda</th>
                    <th className="p-6 font-black text-gray-400 uppercase tracking-widest text-xs">Financ.</th>
                    <th className="p-6 font-black text-gray-400 uppercase tracking-widest text-xs">FGTS</th>
                    <th className="p-6 font-black text-gray-400 uppercase tracking-widest text-xs">Desconto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {history.length > 0 ? history.map((h, i) => (
                    <tr key={i} className="hover:bg-white/2 transition-colors">
                      <td className="p-6 font-bold">{new Date(h.data_geracao).toLocaleDateString('pt-BR')}</td>
                      <td className="p-6 font-black text-white">{formatCurrency(h.preco_venda)}</td>
                      <td className="p-6 font-bold text-green-400">{h.aceita_financiamento ? 'SIM' : 'NÃO'}</td>
                      <td className="p-6 font-bold text-green-400">SIM</td>
                      <td className="p-6 font-black text-blue-400">{Math.round(h.desconto_percentual)}%</td>
                    </tr>
                  )) : (
                    <tr className="hover:bg-white/2 transition-colors">
                      <td className="p-6 font-bold">{new Date(property.data_geracao).toLocaleDateString('pt-BR')}</td>
                      <td className="p-6 font-black text-white">{formatCurrency(property.preco_venda)}</td>
                      <td className="p-6 font-bold text-green-400">{property.aceita_financiamento ? 'SIM' : 'NÃO'}</td>
                      <td className="p-6 font-bold text-green-400">{property.permite_fgts ? 'SIM' : 'NÃO'}</td>
                      <td className="p-6 font-black text-blue-400">{Math.round(property.desconto_percentual)}%</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* BLOCO 11: LOCALIZAÇÃO */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-2xl font-black mb-8 flex items-center gap-3">
              📍 Localização
            </h2>
            <div className="space-y-6">
               <p className="text-xl font-bold leading-relaxed">{property.endereco}</p>
               <p className="text-gray-400">{property.bairro}, {property.cidade} - {property.uf}</p>
               <a 
                 href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.endereco + ' ' + property.cidade)}`}
                 target="_blank"
                 className="inline-flex items-center gap-2 px-8 py-4 bg-white/5 border border-white/10 rounded-2xl font-bold hover:bg-white/10 transition-all"
               >
                 🗺️ Ver no Google Maps
               </a>
            </div>
          </div>
          <div className="h-[400px] bg-white/5 rounded-[40px] border border-white/10 overflow-hidden relative">
             <div className="absolute inset-0 flex items-center justify-center text-gray-500 font-bold uppercase tracking-widest text-xs">
                Mapa Interativo
             </div>
          </div>
        </section>

        {/* BLOCO 12: CONTATO */}
        <section className="max-w-4xl mx-auto bg-blue-600 rounded-[50px] p-12 md:p-20 text-center shadow-2xl shadow-blue-600/20">
           <h2 className="text-3xl md:text-5xl font-black mb-6">Pronto para dar o próximo passo?</h2>
           <p className="text-blue-100 text-lg mb-12 max-w-xl mx-auto opacity-80">Nossos consultores especialistas em Caixa estão online para tirar suas dúvidas e ajudar na proposta.</p>
           <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="px-10 py-5 bg-white text-blue-600 rounded-3xl font-black text-xl hover:bg-gray-100 transition-all flex items-center justify-center gap-3 shadow-xl">
                 <IoMailOutline /> Iniciar Análise
              </button>
              <a 
                href={`https://wa.me/5521997882950?text=Tenho interesse no imóvel ${property.numero_imovel}`}
                target="_blank"
                className="px-10 py-5 bg-green-500 text-white rounded-3xl font-black text-xl hover:bg-green-400 transition-all flex items-center justify-center gap-3 shadow-xl"
              >
                 <IoLogoWhatsapp /> Falar Agora
              </a>
           </div>
        </section>

      </main>
    </div>
  );
}
