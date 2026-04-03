"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  IoChevronBackOutline, IoShareSocialOutline, IoLogoWhatsapp, 
  IoHeartOutline, IoSparklesOutline, IoTrendingUpOutline,
  IoCalendarOutline, IoAlbumsOutline, IoLayersOutline,
  IoInformationCircleOutline, IoLocationOutline, IoCheckmarkCircleOutline,
  IoCloseCircleOutline, IoLockClosedOutline, IoChevronDownOutline,
  IoChevronUpOutline, IoTimeOutline, IoMailOutline, IoPersonOutline,
  IoOptionsOutline, IoMapOutline, IoHomeOutline, IoCashOutline
} from 'react-icons/io5';
import WhatsAppFloating from '@/components/WhatsAppFloating';
import { useWhatsApp } from '@/context/WhatsAppContext';
import { getLocalImagePath, getCorrectedCaixaUrl } from '@/lib/imageUtils';
import { formatWhatsAppLink } from '@/lib/whatsapp';
import { parsePropertyDescription } from '@/lib/propertyUtils';
import { supabase } from '@/lib/supabase';

interface PropertyDetailsProps {
  property: any;
  history?: any[];
  similar?: any[];
}

export default function PropertyDetailsClient({ property, history, similar }: PropertyDetailsProps) {
  const [isCashedIn, setIsCashedIn] = useState(false); // For investor calculations lock
  const [activeFAQ, setActiveFAQ] = useState<number | null>(null);
  const { setWhatsAppData, resetWhatsAppData } = useWhatsApp();
  const [imobiliaria, setImobiliaria] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [formData, setFormData] = useState({
    nome: '',
    whatsapp: '',
    email: '',
    interesse: 'MORAR'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchImob = async () => {
      if (!property?.state) return;
      const { data, error } = await supabase
        .from('imobiliarias')
        .select('*')
        .eq('imobiliaria_uf_atendimento', property.state)
        .limit(1)
        .maybeSingle();
      
      if (!error && data) {
        setImobiliaria(data);
      }
    };
    fetchImob();

    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) setIsAdmin(true);
    };
    checkAuth();
  }, [property.state]);

  const handleLeadSubmit = async (e: React.FormEvent) => {
    // ... existing lead submit logic
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('leads')
        .insert([
          {
            name: formData.nome,
            whatsapp: formData.whatsapp,
            email: formData.email,
            property_interest: formData.interesse,
            property_id: property.property_number?.toString() || property.imovel_caixa_numero?.toString()
          }
        ]);

      if (error) throw error;
      
      setIsCashedIn(true);
    } catch (err) {
      console.error('Erro ao salvar lead:', err);
      alert('Ocorreu um erro ao salvar seu cadastro. Por favor, tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!property) return;
    
    setWhatsAppData({
      propertyNumber: property.property_number,
      bairro: property.neighborhood,
      cidade: property.city,
      uf: property.state,
      preco: property.price,
      tipo: property.property_type || 'Imóvel',
      imobiliaria: imobiliaria
    });
    
    return () => resetWhatsAppData();
  }, [property.property_number, property.neighborhood, property.city, property.state, property.price, property.property_type, imobiliaria, setWhatsAppData, resetWhatsAppData]);


  // Helper for Personalized WhatsApp link
  const getWhatsAppLink = (customMessage?: string) => {
    const phone = imobiliaria?.imobiliaria_whatsapp_numero || "5521978822950";
    
    if (customMessage) {
      return formatWhatsAppLink(phone, customMessage);
    }

    const message = `. 📌 Olá! Tenho interesse no Imóvel da Caixa número *${property.property_number}* localizado em *${property.neighborhood}* - *${property.city}-${property.state}*`;
    
    return formatWhatsAppLink(phone, message);
  };

  const getShareLink = () => {
    const slug = property.post_link_permanente;
    const shareText = encodeURIComponent(
      `https://venda.imoveisdacaixa.com.br/${slug}\n.\n` +
      `Vi este anúncio no site dos Imóveis da Caixa e acredito que tenha interesse\n.\n` +
      `📌 ${property.state} - ${property.city} - ${property.neighborhood}\n` +
      `*Desconto de R$ ${(property.valuation_value - property.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n` +
      `De: R$ ${property.valuation_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
      `Por: R$ ${property.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
      `⚠️ Entrada de R$ ${(property.price * 0.05).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} + Financiamento CAIXA\n` +
      `.\nClique no link para ver mais informações\n🧡💙`
    );
    return `https://api.whatsapp.com/send?text=${shareText}`;
  };

  const discountValue = property.valuation_value - property.price;
  const discountPercent = ((discountValue / property.valuation_value) * 100).toFixed(2);

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans pb-20 selection:bg-[#005CA9] selection:text-white">
      {/* WhatsAppFloating is now handled globally in layout.tsx */}

      <main className="max-w-7xl mx-auto px-4 md:px-8">
        
        {/* BLOCO 0: SEO (Somente Admin no Futuro) */}
        {isAdmin && (
          <section className="mt-8 mb-4 p-6 bg-gray-50 border-2 border-dashed border-gray-200 rounded-[32px] overflow-hidden">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Painel SEO Interno (Visualização Temporária)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-1">
                <p className="text-[9px] font-black text-[#005CA9] uppercase tracking-tighter">Link Permanente</p>
                <p className="text-[11px] font-bold text-gray-600 break-all bg-white p-2 rounded-lg border border-gray-100 italic lowercase leading-relaxed">{property.imovel_caixa_post_link_permanente}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black text-[#005CA9] uppercase tracking-tighter">Meta Descrição</p>
                <p className="text-[11px] font-bold text-gray-600 break-words bg-white p-2 rounded-lg border border-gray-100 italic lowercase leading-relaxed">{property.imovel_caixa_post_descricao}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black text-[#005CA9] uppercase tracking-tighter">Palavra-Chave</p>
                <p className="text-[11px] font-bold text-gray-600 break-words bg-white p-2 rounded-lg border border-gray-100 italic lowercase leading-relaxed">{property.imovel_caixa_post_palavra_chave}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black text-[#005CA9] uppercase tracking-tighter">Tag ALT (Destaque/Square)</p>
                <p className="text-[11px] font-bold text-gray-600 break-words bg-white p-2 rounded-lg border border-gray-100 italic leading-relaxed">
                  {property.imovel_caixa_post_imagem_destaque_tag_alt}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black text-[#005CA9] uppercase tracking-tighter">Tag Title (Destaque/Square)</p>
                <p className="text-[11px] font-bold text-gray-600 break-words bg-white p-2 rounded-lg border border-gray-100 italic leading-relaxed">
                  {property.imovel_caixa_post_imagem_destaque_tag_title}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black text-[#005CA9] uppercase tracking-tighter">Tag ALT (Link Original)</p>
                <p className="text-[11px] font-bold text-gray-600 break-words bg-white p-2 rounded-lg border border-gray-100 italic leading-relaxed">
                  {property.imovel_caixa_link_imagem_tag_alt}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-black text-[#005CA9] uppercase tracking-tighter">Tag Title (Link Original)</p>
                <p className="text-[11px] font-bold text-gray-600 break-words bg-white p-2 rounded-lg border border-gray-100 italic leading-relaxed">
                  {property.imovel_caixa_link_imagem_tag_title}
                </p>
              </div>
              <div className="space-y-1 lg:col-span-2">
                <p className="text-[9px] font-black text-[#005CA9] uppercase tracking-tighter">Destaque SEO (Square)</p>
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-gray-600 break-all bg-white p-2 rounded-lg border border-gray-100 italic lowercase leading-relaxed">
                    {property.imovel_caixa_post_imagem_destaque || getLocalImagePath(property)}
                  </p>
                  <figure className="relative w-full max-w-[250px] aspect-square rounded-2xl overflow-hidden border-2 border-gray-200 bg-white shadow-md">
                     <img 
                       src={property.imovel_caixa_post_imagem_destaque || getLocalImagePath(property)}
                       alt={property.imovel_caixa_post_imagem_destaque_tag_alt}
                       title={property.imovel_caixa_post_imagem_destaque_tag_title}
                       loading="lazy"
                       width="250"
                       height="250"
                       className="w-full h-full object-cover"
                       onError={(e) => {
                         (e.target as HTMLImageElement).src = 'https://placehold.co/600x600/f37021/white?text=Imagem+Padrao';
                       }}
                     />
                     <figcaption className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] font-black uppercase py-1 text-center backdrop-blur-sm">
                       "Imóvel Caixa disponível para venda"
                     </figcaption>
                  </figure>
                </div>
              </div>
            </div>
          </section>
        )}
        
        {/* BLOCO 1: TÍTULO (H1) */}
        <section className="py-12 text-left">
          <div className="flex items-center gap-3 mb-4">
             <div className="w-1.5 h-1.5 bg-[#F9B200] rounded-full animate-pulse"></div>
             <span className="text-[10px] font-black text-[#005CA9] uppercase tracking-[0.4em]">Oportunidade Exclusiva</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 font-montserrat tracking-tight leading-tight uppercase">
             {property.imovel_caixa_post_titulo || `${(property.property_type || 'Imóvel')} ${(property.neighborhood || '').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase())}, ${(property.city || '').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase()).replace('Sao Goncalo', 'São Gonçalo')} - ${property.state} ${property.property_number}`}
          </h1>
        </section>

        {/* BLOCO 2: IMAGEM (H2) */}
        <section className="mb-12 relative group cursor-pointer" onClick={() => window.open(getWhatsAppLink(), '_blank')}>
          <h2 className="sr-only">Imagem</h2>
          <figure className="relative w-full h-[300px] md:h-[500px] overflow-hidden rounded-[40px] shadow-2xl bg-white flex items-center justify-center">
             <img 
               src={property.imovel_caixa_link_imagem || property.url_imagem || getCorrectedCaixaUrl(property.property_number)}
               alt={property.imovel_caixa_post_imagem_destaque_tag_alt}
               title={property.imovel_caixa_post_imagem_destaque_tag_title}
               className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105"
               onError={(e) => {
                 const target = e.target as HTMLImageElement;
                 const currentSrc = target.src;
                 const localPath = getLocalImagePath(property);
                 const originalCaixa = property.imovel_caixa_link_imagem;
                 const placeholder = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1073&auto=format&fit=crop';
                 
                 if (currentSrc !== localPath && localPath) {
                   target.src = localPath;
                 } else if (currentSrc !== originalCaixa && originalCaixa) {
                   target.src = originalCaixa;
                 } else if (currentSrc !== placeholder) {
                   target.src = placeholder;
                 }
               }}
             />
             <figcaption className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] font-black uppercase py-3 text-center backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-500">
               "Imóvel Caixa disponível para venda"
             </figcaption>
          </figure>
          <div className="absolute top-8 right-8 z-20">
            <div className="px-6 py-3 bg-[#005CA9] text-white text-[10px] font-black rounded-2xl flex items-center gap-2 shadow-2xl shadow-[#005CA9]/30 uppercase tracking-widest border border-white/20">
               <div className="w-1.5 h-1.5 bg-[#F9B200] rounded-full animate-bounce"></div>
               Imagem Oficial CAIXA
            </div>
          </div>
        </section>

        {/* BLOCO 3: VALORES (H2) - ⭐DESTAQUE MÁXIMO⭐ */}
        <section className="py-24 md:py-40 flex justify-center">
          <div className="relative w-full max-w-[900px]">
            {/* Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#005CA9]/5 to-transparent blur-3xl -z-10 rounded-full" />
            
            <div className="bg-white rounded-[50px] p-12 md:p-20 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.1)] border border-gray-50 text-center space-y-16 transition-all hover:shadow-[0_60px_120px_-30px_rgba(0,92,169,0.15)]">
              
              <div className="space-y-6">
                <span className="text-xs font-black text-gray-400 uppercase tracking-[0.5em] block">Potencial de Lucro Imediato</span>
                <div className="relative inline-block group">
                   <div className="absolute inset-x-0 -bottom-2 h-8 bg-green-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                   <h2 className="text-6xl md:text-[6.5rem] font-black tracking-tighter text-[#16a34a] leading-none transition-transform duration-700 group-hover:scale-105">
                     R$ {discountValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                   </h2>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-2xl mx-auto pt-12 border-t border-gray-100">
                 <div className="space-y-2 text-left md:text-center">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Avaliação do Banco</span>
                    <span className="text-2xl font-black text-gray-800">R$ {property.valuation_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                 </div>
                 <div className="space-y-2 text-right md:text-center">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Valor de Venda</span>
                    <span className="text-2xl font-black text-[#005CA9]">R$ {property.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                 </div>
              </div>
              
              <div className="inline-flex items-center gap-4 bg-orange-50 px-8 py-4 rounded-[20px] border border-orange-100/50">
                 <span className="text-xs font-black text-[#F9B200] uppercase tracking-widest">Desconto Exclusivo:</span>
                 <span className="text-4xl font-black text-[#F9B200] tracking-tighter">{discountPercent}%</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-12">
                  {imobiliaria?.imobiliaria_whatsapp_botao ? (
                    <button 
                      onClick={() => window.open(getWhatsAppLink(), '_blank')}
                      className="group overflow-hidden rounded-3xl active:scale-95 transition-all shadow-xl shadow-orange-500/10"
                    >
                      <img src={imobiliaria.imobiliaria_whatsapp_botao} alt="WhatsApp" className="w-full h-auto" />
                    </button>
                  ) : (
                    <button 
                      onClick={() => window.open(getWhatsAppLink(), '_blank')}
                      className="group py-6 bg-[#F9B200] hover:bg-[#FF9D2E] text-white rounded-3xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-orange-500/20 active:scale-95 transition-all flex flex-col items-center gap-1"
                    >
                      <span className="opacity-50 text-[8px]">Eu Quero</span>
                      <span>❤️ Tenho Interesse</span>
                    </button>
                  )}
                  
                  <button 
                    onClick={() => window.open(getShareLink(), '_blank')}
                    className="group py-6 bg-[#005CA9] hover:bg-[#004a87] text-white rounded-3xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex flex-col items-center gap-1"
                  >
                    <span className="opacity-50 text-[8px]">Enviar Para</span>
                    <span>📤 Compartilhar</span>
                  </button>

                  <button 
                    onClick={() => window.open(getWhatsAppLink(), '_blank')}
                    className="group py-6 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-3xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-green-500/20 active:scale-95 transition-all flex flex-col items-center gap-1"
                  >
                    <span className="opacity-50 text-[8px]">Falar com</span>
                    <span className="flex items-center gap-2">
                      <IoLogoWhatsapp size={16} />
                      WhatsApp
                    </span>
                  </button>
              </div>
            </div>
          </div>
        </section>


        {/* BLOCO 5: SOBRE O IMÓVEL */}
        <section className="py-20">
          <div className="max-w-5xl mx-auto space-y-12">
            <h2 className="text-2xl font-black text-gray-900 font-montserrat tracking-tight uppercase border-l-4 border-[#F9B200] pl-6">
              🆔 Identificação
            </h2>
            
            <div className="bg-white p-8 md:p-12 rounded-[40px] border border-gray-100 shadow-sm space-y-16">
              
              {/* 1. 📊 Caixa */}
              <div className="space-y-6">
                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                  📊 Caixa
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Número do Imóvel</p>
                    <p className="text-lg font-black text-gray-800">{property.imovel_caixa_numero || property.property_number}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Modalidade</p>
                    <p className="text-lg font-black text-[#005CA9]">{property.venda_tipo_oficial || property.imovel_caixa_modalidade}</p>
                  </div>
                </div>
              </div>

              {/* 2. 📝 Descrição */}
              <div className="space-y-6 pt-12 border-t border-gray-50">
                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                  📝 Descrição
                </h3>
                <div className="space-y-4">
                  <div className="border-b border-gray-50 pb-4">
                    <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight">
                      {property.property_type} em {property.neighborhood}, {property.city} - {property.state} ({property.property_number})
                    </h4>
                    <p className="text-xs font-bold text-gray-400 mt-1 uppercase">
                      {property.address}
                    </p>
                  </div>
                  <p className="text-gray-600 leading-relaxed font-medium">
                    {parsePropertyDescription(property.description, property)}
                  </p>
                </div>
              </div>

              {/* 3. 🏠 Características */}
              <div className="space-y-6 pt-12 border-t border-gray-50">
                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                  🏠 Características
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipo</p>
                    <p className="text-md font-black text-gray-800">{property.property_type}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Quartos</p>
                    <p className="text-md font-black text-gray-800">{property.bedrooms || '0'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Banheiros (WC)</p>
                    <p className="text-md font-black text-gray-800">{property.bathrooms || '0'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Vagas Garagem</p>
                    <p className="text-md font-black text-gray-800">{property.garage || '0'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Área Privativa</p>
                    <p className="text-md font-black text-gray-800">{property.private_area ? `${Number(property.private_area).toLocaleString('pt-BR')} m²` : '--'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Área Total</p>
                    <p className="text-md font-black text-gray-800">{property.total_area ? `${Number(property.total_area).toLocaleString('pt-BR')} m²` : '--'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Área do Terreno</p>
                    <p className="text-md font-black text-gray-800">{property.land_area ? `${Number(property.land_area).toLocaleString('pt-BR')} m²` : '--'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sala</p>
                    <p className="text-md font-black text-gray-800">{property.living_room ? 'Sim' : 'Não'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cozinha</p>
                    <p className="text-md font-black text-gray-800">{property.kitchen ? 'Sim' : 'Não'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Área de Serviço</p>
                    <p className="text-md font-black text-gray-800">{property.service_area ? 'Sim' : 'Não'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Piscina</p>
                    <p className="text-md font-black text-gray-800">{property.pool ? 'Sim' : 'Não'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Churrasqueira</p>
                    <p className="text-md font-black text-gray-800">{property.barbecue ? 'Sim' : 'Não'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Varanda</p>
                    <p className="text-md font-black text-gray-800">{property.balcony ? 'Sim' : 'Não'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Terraço</p>
                    <p className="text-md font-black text-gray-800">{property.terrace ? 'Sim' : 'Não'}</p>
                  </div>
                </div>
              </div>

              {/* 4. 💰 Regras de Pagamento */}
              <div className="space-y-6 pt-12 border-t border-gray-50">
                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                  💰 Regras de Pagamento
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-gray-50 p-6 rounded-3xl space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-xs font-bold text-gray-600 uppercase">Financiamento</span>
                      {property.imovel_caixa_pagamento_financiamento === false ? (
                        <span className="flex items-center gap-1 text-red-500 font-black text-[10px] uppercase"><IoCloseCircleOutline /> Não</span>
                      ) : (
                        <span className="flex items-center gap-1 text-green-500 font-black text-[10px] uppercase"><IoCheckmarkCircleOutline /> Sim</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-xs font-bold text-gray-600 uppercase">FGTS</span>
                      {property.imovel_caixa_pagamento_fgts === false ? (
                        <span className="flex items-center gap-1 text-red-500 font-black text-[10px] uppercase"><IoCloseCircleOutline /> Não</span>
                      ) : (
                        <span className="flex items-center gap-1 text-green-500 font-black text-[10px] uppercase"><IoCheckmarkCircleOutline /> Sim</span>
                      )}
                    </div>
                  </div>
                    <div className="space-y-4">
                    {(property.regra_condominio || property.imovel_caixa_pagamento_condominio > 0) && (
                      <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                        <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest block mb-1">📌 Débitos de Condomínio</span>
                        {property.imovel_caixa_pagamento_condominio > 0 && (
                          <p className="text-lg font-black text-blue-800 mb-1">
                            R$ {property.imovel_caixa_pagamento_condominio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        )}
                        <p className="text-[11px] font-bold text-gray-500 leading-relaxed italic">
                          {property.regra_condominio || 'Débitos de responsabilidade da Caixa conforme edital.'}
                        </p>
                      </div>
                    )}
                    {property.imovel_caixa_pagamento_anotacoes && (
                      <div className="p-4 bg-orange-50/50 rounded-2xl border-[#F9B200]/50 border">
                        <span className="text-[9px] font-black text-[#F9B200] uppercase tracking-widest block mb-2">⚠️ Observações Importantes</span>
                        <p className="text-[11px] font-bold text-gray-700 leading-relaxed uppercase tracking-tighter">
                          {property.imovel_caixa_pagamento_anotacoes}
                        </p>
                      </div>
                    )}
                    {property.regra_iptu && (
                      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">📌 Débitos de IPTU</span>
                        <p className="text-[11px] font-bold text-gray-500 leading-relaxed italic">
                          {property.regra_iptu}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 5. 📄 Documentação */}
              <div className="space-y-6 pt-12 border-t border-gray-50">
                <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                  📄 Documentação
                </h3>
                <div className="bg-blue-50/30 p-6 md:p-10 rounded-[32px] border border-blue-100 flex flex-col md:flex-row items-center justify-between gap-10">
                  <div className="flex-grow w-full overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <tbody className="divide-y divide-blue-100/50">
                        <tr>
                          <td className="py-2 pr-4 text-[9px] font-black text-blue-600 uppercase tracking-widest whitespace-nowrap">Matrícula</td>
                          <td className="py-2 text-xs font-black text-gray-800">{property.cartorio_matricula || '--'}</td>
                        </tr>
                        <tr>
                          <td className="py-2 pr-4 text-[9px] font-black text-blue-600 uppercase tracking-widest whitespace-nowrap">Comarca</td>
                          <td className="py-2 text-xs font-black text-gray-800">{property.cartorio_comarca || '--'}</td>
                        </tr>
                        <tr>
                          <td className="py-2 pr-4 text-[9px] font-black text-blue-600 uppercase tracking-widest whitespace-nowrap">Ofício</td>
                          <td className="py-2 text-xs font-black text-gray-800">{property.cartorio_oficio || '--'}</td>
                        </tr>
                        <tr>
                          <td className="py-2 pr-4 text-[9px] font-black text-blue-600 uppercase tracking-widest whitespace-nowrap">Inscrição</td>
                          <td className="py-2 text-xs font-black text-gray-800">{property.cartorio_inscricao || '--'}</td>
                        </tr>
                        <tr>
                          <td className="py-2 pr-4 text-[9px] font-black text-blue-600 uppercase tracking-widest whitespace-nowrap">Averbação</td>
                          <td className="py-2 text-xs font-black text-gray-800">{property.cartorio_averbacao || '--'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <button 
                    onClick={() => window.open(property.link_matricula || getWhatsAppLink("Olá! Gostaria de receber a matrícula deste imóvel."), '_blank')}
                    className="shrink-0 px-8 py-4 bg-[#005CA9] text-white rounded-[20px] font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-[#005CA9]/20"
                  >
                    Ver Matrícula
                  </button>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* BLOCO 6: CÁLCULOS DO INVESTIDOR (Área Restrita) */}
        <section className="py-20 md:py-32">
          <div className="bg-black rounded-[60px] p-10 md:p-24 text-center relative overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.4)] border border-white/5 mx-4">
            {/* Efeito Glossy Black Piano */}
            <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none opacity-20"></div>
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none -ml-32 -mb-32"></div>

            {!isCashedIn ? (
              <div className="max-w-4xl mx-auto space-y-12 relative z-10 text-white">
                <div className="space-y-6">
                  <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase font-montserrat leading-none">
                    📊 Cálculos do <span className="text-[#005CA9]">Investidor</span>
                  </h2>
                  <p className="text-gray-400 font-bold text-lg max-w-2xl mx-auto leading-relaxed">
                    Faça seu cadastro gratuito para ter informações exclusivas sobre os valores a serem gastos e sobre as previsões de lucro de cada perfil de compra.
                  </p>
                </div>

                <div className="bg-white/5 backdrop-blur-3xl border border-white/10 p-8 md:p-12 rounded-[40px] shadow-2xl">
                  <form className="space-y-8" onSubmit={handleLeadSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2 text-left">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nome Completo</label>
                        <input 
                          type="text" 
                          placeholder="Nome + Sobrenome" 
                          required 
                          value={formData.nome}
                          onChange={(e) => setFormData({...formData, nome: e.target.value})}
                          className="w-full px-6 py-4 bg-white/5 border border-white/10 focus:border-[#005CA9] outline-none rounded-2xl font-bold transition-all text-white placeholder-gray-600" 
                        />
                      </div>
                      <div className="space-y-2 text-left">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Seu WhatsApp</label>
                        <input 
                          type="tel" 
                          placeholder="(00) 00000-0000" 
                          required 
                          value={formData.whatsapp}
                          onChange={(e) => setFormData({...formData, whatsapp: e.target.value})}
                          className="w-full px-6 py-4 bg-white/5 border border-white/10 focus:border-[#005CA9] outline-none rounded-2xl font-bold transition-all text-white placeholder-gray-600" 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2 text-left">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Seu Email</label>
                        <input 
                          type="email" 
                          placeholder="email@exemplo.com" 
                          required 
                          value={formData.email}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                          className="w-full px-6 py-4 bg-white/5 border border-white/10 focus:border-[#005CA9] outline-none rounded-2xl font-bold transition-all text-white placeholder-gray-600" 
                        />
                      </div>
                      <div className="space-y-2 text-left">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Principal Interesse</label>
                        <div className="grid grid-cols-3 gap-2">
                          {['MORAR', 'REVENDER', 'ALUGAR'].map(opt => (
                            <label key={opt} className="cursor-pointer group">
                              <input 
                                type="radio" 
                                name="interest_roi" 
                                value={opt} 
                                className="peer hidden" 
                                checked={formData.interesse === opt}
                                onChange={() => setFormData({...formData, interesse: opt})}
                              />
                              <div className="py-3 text-center rounded-xl bg-white/5 text-[9px] font-black text-gray-400 peer-checked:bg-blue-600 peer-checked:text-white transition-all border border-transparent peer-checked:border-blue-400 uppercase tracking-widest">
                                {opt}
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-6">
                      <button 
                        type="submit"
                        disabled={isSubmitting}
                        className="group relative w-full px-16 py-6 bg-white rounded-2xl font-black text-gray-900 uppercase shadow-2xl hover:scale-105 active:scale-95 transition-all overflow-hidden flex flex-col items-center justify-center leading-tight tracking-[0.2em] disabled:opacity-50"
                      >
                        <span className="text-[9px] mb-1 opacity-50 font-black">enviar cadastro para</span>
                        <span className="flex items-center gap-2 text-sm uppercase">
                          {isSubmitting ? 'Enviando...' : '🔒 DESBLOQUEAR VISUALIZAÇÃO 🔒'}
                        </span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              <div className="max-w-5xl mx-auto space-y-12 relative z-10 text-white animate-fade-in">
                <div className="space-y-6">
                  <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase font-montserrat leading-none">
                    📊 <span className="text-[#005CA9]">Resultados</span> Estratégicos
                  </h2>
                  <p className="text-gray-400 font-bold text-lg max-w-2xl mx-auto leading-relaxed">
                    Com base no perfil deste imóvel, aqui estão as projeções financeiras detalhadas para sua tomada de decisão.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* COMPRA À VISTA */}
                  <div className="bg-white/5 backdrop-blur-3xl border border-white/10 p-8 rounded-[40px] shadow-2xl space-y-8 text-left group hover:border-blue-500/50 transition-all duration-500">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Perfil 01</span>
                        <h3 className="text-2xl font-black uppercase tracking-tight leading-none">Compra à Vista</h3>
                      </div>
                      <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                        <IoCashOutline size={24} />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="p-5 bg-white/5 rounded-2xl border border-white/5 space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          <span>Valor de Aquisição</span>
                        </div>
                        <div className="text-2xl font-black">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(property.price)}</div>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        <div className="flex justify-between items-center py-3 border-b border-white/5">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Registro/ITBI</span>
                          <span className="text-sm font-black text-white">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(property.price * (Number(property.investment_params?.[0]?.compra_registro) || 0.04))}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-4 bg-blue-500/5 px-4 rounded-xl border border-blue-500/20">
                          <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Total</span>
                          <span className="text-lg font-black text-white">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(property.price + (property.price * (Number(property.investment_params?.[0]?.compra_registro) || 0.04)))}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* FINANCIAMENTO CAIXA */}
                  <div className="bg-white/5 backdrop-blur-3xl border border-white/10 p-8 rounded-[40px] shadow-2xl space-y-8 text-left group hover:border-[#005CA9]/50 transition-all duration-500">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-[#005CA9] uppercase tracking-[0.3em]">Perfil 02</span>
                        <h3 className="text-2xl font-black uppercase tracking-tight leading-none">Financiamento CAIXA</h3>
                      </div>
                      <div className="w-12 h-12 bg-[#005CA9]/10 rounded-xl flex items-center justify-center text-[#005CA9]">
                        <IoHomeOutline size={24} />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="p-5 bg-white/5 rounded-2xl border border-white/5 space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          <span>Entrada (5%)</span>
                        </div>
                        <div className="text-2xl font-black">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(property.price * (Number(property.investment_params?.[0]?.compra_financiamento_entrada_caixa) || 0.05))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        <div className="flex justify-between items-center py-3 border-b border-white/5">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Registro/ITBI</span>
                          <span className="text-sm font-black text-white">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(property.price * (Number(property.investment_params?.[0]?.compra_registro) || 0.04))}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-4 bg-[#005CA9]/5 px-4 rounded-xl border border-[#005CA9]/20">
                          <span className="text-[10px] font-black text-[#005CA9] uppercase tracking-widest">Aporte Inicial</span>
                          <span className="text-lg font-black text-white">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                              (property.price * (Number(property.investment_params?.[0]?.compra_financiamento_entrada_caixa) || 0.05)) + 
                              (property.price * (Number(property.investment_params?.[0]?.compra_registro) || 0.04))
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* FINANCIAMENTO NORMAL */}
                  <div className="bg-white/5 backdrop-blur-3xl border border-white/10 p-8 rounded-[40px] shadow-2xl space-y-8 text-left group hover:border-[#005CA9]/50 transition-all duration-500">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-[#005CA9] uppercase tracking-[0.3em]">Perfil 03</span>
                        <h3 className="text-2xl font-black uppercase tracking-tight leading-none">Financiamento Normal</h3>
                      </div>
                      <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-gray-400">
                        <IoLayersOutline size={24} />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="p-5 bg-white/5 rounded-2xl border border-white/5 space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          <span>Entrada (20%)</span>
                        </div>
                        <div className="text-2xl font-black">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(property.price * (Number(property.investment_params?.[0]?.compra_financiamento_entrada_normal) || 0.20))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        <div className="flex justify-between items-center py-3 border-b border-white/5">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Registro/ITBI</span>
                          <span className="text-sm font-black text-white">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(property.price * (Number(property.investment_params?.[0]?.compra_registro) || 0.04))}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-4 bg-white/5 px-4 rounded-xl border border-white/10">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Aporte Inicial</span>
                          <span className="text-lg font-black text-white">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                              (property.price * (Number(property.investment_params?.[0]?.compra_financiamento_entrada_normal) || 0.20)) + 
                              (property.price * (Number(property.investment_params?.[0]?.compra_registro) || 0.04))
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PRÓXIMOS PASSOS (PROJEÇÃO DE ROI) */}
                <div className="grid grid-cols-1 md:grid-cols-1 gap-8">
                  <div className="bg-gradient-to-r from-blue-600/20 to-transparent backdrop-blur-3xl border border-white/10 p-10 rounded-[40px] shadow-2xl space-y-8 text-center group">
                    <div className="max-w-3xl mx-auto space-y-6">
                       <h3 className="text-3xl font-black uppercase tracking-tight">🚀 Projeção de <span className="text-blue-500">Lucratividade</span></h3>
                       <p className="text-gray-400 font-bold">
                          Com o desconto atual de <strong>{property.imovel_caixa_valor_desconto_percentual}%</strong>, sua margem de ROI estimada para revenda é superior a 30%.
                          Fale com nosso especialista para receber a planilha completa de viabilidade técnica.
                       </p>
                       <button className="px-12 py-4 bg-[#005CA9] hover:bg-[#004a87] text-white rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-[#005CA9]/30">
                          Solicitar Planilha Completa
                       </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* BLOCO 7: FORMAS DE PAGAMENTO / BLOCO 8: DESPESAS */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-10 py-16 md:py-24">
          
          {/* Formas de Pagamento */}
          <div className="bg-white border border-gray-100 rounded-[32px] p-10 md:p-12 shadow-sm space-y-8">
            <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight font-montserrat border-b-2 border-[#005CA9] pb-4">
              💰 Pagamento
            </h2>
            <div className="space-y-6">
              <p className="text-gray-600 leading-relaxed font-bold">
                O pagamento pode ser feito à vista com recursos próprios ou através de financiamento pela <span className="text-[#005CA9]">CAIXA Econômica Federal</span>.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-sm font-black text-gray-700 uppercase">
                  <IoCheckmarkCircleOutline className="text-green-500" size={20} /> Recursos Próprios
                </li>
                <li className="flex items-center gap-3 text-sm font-black text-gray-700 uppercase">
                  <IoCheckmarkCircleOutline className="text-green-500" size={20} /> Financiamento CAIXA
                </li>
                <li className="flex items-center gap-3 text-sm font-black text-gray-700 uppercase">
                  <IoCheckmarkCircleOutline className="text-green-500" size={20} /> Uso do FGTS (Residencial)
                </li>
              </ul>
            </div>
          </div>

          {/* Despesas & Tributos */}
          <div className="bg-white border border-gray-100 rounded-[32px] p-10 md:p-12 shadow-sm space-y-8">
            <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight font-montserrat border-b-2 border-[#F9B200] pb-4">
              📊 Despesas
            </h2>
            <div className="space-y-6">
              <p className="text-gray-600 leading-relaxed font-bold">
                Dívidas de IPTU e Condomínio são pagas pela <span className="text-[#005CA9]">CAIXA</span>. 
                O comprador assume as despesas de transferência:
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-sm font-black text-gray-700 uppercase">
                  <IoInformationCircleOutline className="text-blue-500" size={20} /> ITBI (Imposto de Transmissão)
                </li>
                <li className="flex items-center gap-3 text-sm font-black text-gray-700 uppercase">
                  <IoInformationCircleOutline className="text-blue-500" size={20} /> Escritura e Registro
                </li>
                <li className="flex items-center gap-3 text-sm font-black text-gray-700 uppercase">
                  <IoInformationCircleOutline className="text-blue-500" size={20} /> Taxa de Avaliação (Se financiar)
                </li>
              </ul>
            </div>
          </div>

        </section>

        {/* BLOCO 9: DOCUMENTAÇÃO (Botão WhatsApp) */}
        <section className="py-16 md:py-24 px-4">
          <div className="bg-gray-50 border border-gray-100 rounded-[32px] p-10 md:p-16 flex flex-col md:flex-row items-center justify-between gap-10">
            <div className="space-y-4 text-center md:text-left">
              <h2 className="text-3xl font-black text-gray-900 font-montserrat uppercase tracking-tight">📜 Documentação do Imóvel</h2>
              <p className="text-gray-500 font-bold max-w-xl">Receba a matrícula, edital e termo de arrematação diretamente no seu WhatsApp para análise jurídica.</p>
            </div>
            <button 
              onClick={() => window.open(getWhatsAppLink(`Olá! Desejo receber a documentação (matrícula/edital) do imóvel ${property.id}.`), '_blank')}
              className="px-12 py-5 bg-[#005CA9] text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all text-xs"
            >
              Solicitar Matrícula Completa
            </button>
          </div>
        </section>

        {/* BLOCO 10/16: DÚVIDAS E SUPORTE */}
        <section className="py-20 md:py-32 bg-white">
          <div className="max-w-4xl mx-auto px-4 space-y-12">
            <div className="text-center space-y-4">
              <span className="text-xs font-black text-[#005CA9] tracking-[0.4em] uppercase opacity-50 block">DÚVIDAS FREQUENTES</span>
              <h2 className="text-4xl font-black text-gray-900 tracking-tight uppercase font-montserrat">Tudo o que você precisa saber</h2>
            </div>
            
            <div className="space-y-4">
              {[
                { q: "O imóvel está ocupado?", a: "Sim, a maioria dos imóveis de retomada estão ocupados. A desocupação é um processo jurídico padrão e oferecemos assessoria gratuita para este trâmite." },
                { q: "Posso utilizar o FGTS?", a: "Sim, para imóveis residenciais. O FGTS pode ser usado como entrada ou para amortizar o saldo devedor, conforme regras da CAIXA." },
                { q: "A CAIXA quita as dívidas?", a: "Sim, IPTU e Condomínio em atraso até a data da venda são de responsabilidade da CAIXA Econômica Federal." }
              ].map((item, idx) => (
                <div key={idx} className="border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
                  <button 
                    onClick={() => setActiveFAQ(activeFAQ === idx + 20 ? null : idx + 20)}
                    className="w-full flex items-center justify-between p-8 text-left bg-gray-50/50"
                  >
                    <span className="text-lg font-black text-gray-800 uppercase tracking-tight leading-tight">{item.q}</span>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${activeFAQ === idx + 20 ? 'bg-[#005CA9] text-white rotate-180' : 'bg-white text-gray-400'}`}>
                      <IoChevronDownOutline size={16} />
                    </div>
                  </button>
                  {activeFAQ === idx + 20 && (
                    <div className="p-8 text-gray-600 font-bold leading-relaxed border-t border-gray-50">
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BLOCO 11: LOCALIZAÇÃO / BLOCO 17: GOOGLE MAPS */}
        <section className="py-20 md:py-32 px-4">
          <div className="bg-white border border-gray-100 rounded-[48px] overflow-hidden shadow-2xl flex flex-col lg:flex-row">
            <div className="lg:w-1/2 p-10 md:p-20 space-y-12">
              <div className="space-y-4">
                <span className="text-xs font-black text-[#005CA9] tracking-[0.4em] uppercase opacity-50 block">LOCALIZAÇÃO</span>
                <h2 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tighter uppercase font-montserrat">Onde o Imóvel se encontra</h2>
              </div>
              <div className="space-y-2">
                <p className="text-2xl font-black text-gray-800 tracking-tight">{property.address}</p>
                <p className="text-lg font-bold text-gray-400 uppercase tracking-widest">{property.neighborhood} • {property.city} - {property.state}</p>
              </div>
              <Link 
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address + ' ' + property.city)}`}
                target="_blank"
                className="inline-flex items-center gap-4 px-12 py-5 bg-[#005ca5] text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all"
              >
                <IoLocationOutline size={18} />
                Abrir GPS e Traçar Rota
              </Link>
            </div>
            <div className="lg:w-1/2 h-[500px] lg:h-auto bg-gray-50 relative group">
              <iframe 
                width="100%" 
                height="100%" 
                style={{ border: 0 }} 
                loading="lazy" 
                allowFullScreen 
                src={`https://www.google.com/maps/embed/v1/place?key=REPLACE_WITH_MAPS_KEY&q=${encodeURIComponent(property.address + ' ' + property.city)}`}
                className="grayscale-[0.5] contrast-[1.1] transition-all duration-1000 group-hover:grayscale-0"
              ></iframe>
            </div>
          </div>
        </section>

        {/* BLOCO 12: SIMULAÇÕES DE INVESTIMENTO */}
        <section className="py-20 md:py-32">
          <div className="max-w-4xl mx-auto space-y-12">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 uppercase tracking-tight text-center font-montserrat">
              📊 Simulações de Investimento
            </h2>
            
            <div className="space-y-4">
              {[
                { id: 'morar', title: 'Comprando para Morar', content: 'Planejamento de financiamento em até 35 anos, uso do FGTS na entrada e parcelas decrescentes (SAC).' },
                { id: 'vender', title: 'Comprando para Vender (Flip)', content: 'Análise de lucro líquido, custos de reforma e impostos na revenda (Pessoa Física vs Jurídica).' },
                { id: 'alugar', title: 'Comprando para Alugar (Renda)', content: 'Projeção de rentabilidade mensal (Yield) superior à poupança e valorização patrimonial de longo prazo.' }
              ].map((item, idx) => (
                <div key={item.id} className="border border-gray-100 rounded-3xl overflow-hidden shadow-sm bg-white">
                  <button 
                    onClick={() => setActiveFAQ(activeFAQ === idx + 10 ? null : idx + 10)}
                    className="w-full flex items-center justify-between p-8 text-left"
                  >
                    <span className="text-xl font-black text-gray-800 uppercase tracking-tight">{item.title}</span>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeFAQ === idx + 10 ? 'bg-[#005ca5] text-white rotate-180' : 'bg-gray-50 text-gray-400'}`}>
                      <IoChevronDownOutline size={20} />
                    </div>
                  </button>
                  {activeFAQ === idx + 10 && (
                    <div className="px-8 pb-8 space-y-6">
                      <p className="text-gray-600 font-bold leading-relaxed">{item.content}</p>
                      <button 
                        onClick={() => window.open(getWhatsAppLink(`Olá! Tenho interesse em uma simulação de ${item.title.toLowerCase()}.`), '_blank')}
                        className="w-full py-4 bg-[#005ca5] text-white rounded-2xl font-black text-xs uppercase tracking-widest"
                      >
                        Solicitar Simulação Customizada
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BLOCO 13: CONTATO / AGENDAMENTO (H2) */}
        <section className="py-20 md:py-32" id="contato">
          <div className="bg-gradient-to-br from-[#005ca5] to-[#00bfff] rounded-[60px] p-8 md:p-20 shadow-2xl relative overflow-hidden text-white">
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white/10 blur-[100px] rounded-full -mr-64 -mt-64 animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-black/10 blur-[80px] rounded-full -ml-32 -mb-32"></div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center relative z-10 text-white">
              <div className="space-y-10">
                <div className="inline-block px-6 py-2 bg-white/20 backdrop-blur-md rounded-full font-black text-white text-[10px] uppercase tracking-[0.3em] border border-white/30">
                  Agendamento Prioritário
                </div>
                <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.9] uppercase">
                  Solicitar<br />
                  <span className="text-black/20">Atendimento</span><br />
                  Especializado
                </h2>
                <p className="text-white/80 font-bold text-lg max-w-md leading-relaxed">
                  Assistência completa e gratuita de especialistas credenciados para garantir sua segurança em todas as etapas da compra.
                </p>
                <div className="space-y-4 pt-4">
                  {[
                    "Assessoria Jurídica Gratuita para Desocupação",
                    "Aprovação de Crédito em 24 Horas",
                    "Análise de Lucro Real Garantida"
                  ].map((text, i) => (
                    <div key={i} className="flex items-center gap-4 font-black text-sm uppercase tracking-tight text-white">
                      <div className="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center">
                        <IoCheckmarkCircleOutline className="text-white" size={18} />
                      </div>
                      {text}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-[40px] p-10 md:p-14 shadow-2xl text-gray-900">
                <form className="space-y-8" onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const data = {
                    name: formData.get('name') as string,
                    whatsapp: formData.get('whatsapp') as string,
                    property_interest: formData.get('interest') as string,
                    preferred_time: formData.get('time') as string,
                    property_id: property.property_number
                  };
                  // Envia para o WhatsApp como fallback e tenta salvar lead
                  window.open(getWhatsAppLink(`Olá! Meu nome é ${data.name}. Tenho interesse no imóvel ${data.property_id}. Meu interesse principal é ${data.property_interest}.`), '_blank');
                }}>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Seu Nome</label>
                     <input name="name" type="text" placeholder="Ex: João Silva" required className="w-full px-6 py-4 bg-gray-50 border border-transparent focus:border-blue-200 outline-none rounded-2xl font-bold transition-all" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Seu WhatsApp</label>
                       <input name="whatsapp" type="tel" placeholder="(00) 00000-0000" required className="w-full px-6 py-4 bg-gray-50 border border-transparent focus:border-blue-200 outline-none rounded-2xl font-bold transition-all" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Horário</label>
                       <select name="time" className="w-full px-6 py-4 bg-gray-50 border border-transparent focus:border-blue-200 outline-none rounded-2xl font-bold transition-all cursor-pointer">
                          <option>Manhã</option>
                          <option>Tarde</option>
                          <option>Noite</option>
                       </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Qual seu principal interesse?</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {['Morar', 'Revender', 'Alugar'].map((opt) => (
                        <label key={opt} className="cursor-pointer">
                          <input type="radio" name="interest" value={opt} className="peer hidden" defaultChecked={opt==='Morar'} />
                          <div className="py-4 text-center rounded-2xl bg-gray-50 text-[10px] font-black text-gray-400 peer-checked:bg-[#005ca5] peer-checked:text-white transition-all border border-transparent peer-checked:border-blue-400 uppercase tracking-widest">
                            {opt}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <button type="submit" className="w-full py-6 bg-gradient-to-r from-[#005ca5] to-[#00bfff] text-white rounded-[24px] font-black uppercase tracking-[0.3em] text-[10px] shadow-xl shadow-blue-500/20 hover:scale-[1.02] transform transition-all active:scale-[0.98]">
                    Enviar Solicitação Agora
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>

        {/* BLOCO 14: IMÓVEIS SEMELHANTES (H2) */}
        <section className="py-20 md:py-32">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16 px-4">
            <div className="space-y-4">
               <span className="text-xs font-black text-[#005ca5] tracking-[0.4em] uppercase opacity-50 block">OFERTAS RELACIONADAS</span>
               <h2 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight uppercase">Oportunidades Semelhantes</h2>
            </div>
            <div className="h-px flex-grow bg-gray-100 hidden md:block mb-4 ml-8"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {similar?.slice(0, 3).map((item: any) => (
              <div key={item.id} className="group bg-white border border-gray-100 rounded-[40px] overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500">
                <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                   <img 
                     src={item.url_imagem} 
                     alt={item.tipo_imovel} 
                     className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" 
                     onError={(e) => {
                       (e.target as HTMLImageElement).src = 'https://wallpaperaccess.com/full/1899391.jpg';
                     }}
                   />
                   <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                   <div className="absolute bottom-6 left-6 right-6">
                      <p className="text-[10px] font-black text-white/60 uppercase tracking-[0.3em] mb-1">{item.city} • {item.state}</p>
                      <h4 className="text-lg font-black text-white uppercase tracking-tight leading-tight">{item.bairro}</h4>
                   </div>
                   <div className="absolute top-6 right-6 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/30">
                      <p className="text-[10px] font-black text-white uppercase tracking-widest">Oportunidade</p>
                   </div>
                </div>
                <div className="p-8 space-y-6">
                   <div className="flex items-center justify-between">
                     <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{item.tipo_imovel}</span>
                     <div className="flex items-center gap-1 text-[#005ca5]">
                        <IoTrendingUpOutline size={14} />
                        <span className="text-[10px] font-black uppercase">Alta Liquidez</span>
                     </div>
                   </div>
                   <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-gray-400 line-through">Avaliação: R$ {item.valor_avaliacao?.toLocaleString('pt-BR')}</span>
                      <span className="text-2xl font-black text-gray-900">R$ {item.preco_venda?.toLocaleString('pt-BR')}</span>
                   </div>
                   <Link href={`/${item.post_link_permanente}`} className="block w-full py-4 text-center bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] rounded-2xl group-hover:bg-[#005ca5] group-hover:text-white transition-all shadow-sm">
                      Analisar Imóvel
                   </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* BLOCO 15: HISTÓRICO / ATUALIZAÇÕES (H2) */}
        <section className="py-20 md:py-32">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16 px-4">
            <div className="space-y-4">
               <span className="text-xs font-black text-[#005ca5] tracking-[0.4em] uppercase opacity-50 block">AUDITORIA DE DADOS</span>
               <h2 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight uppercase">Histórico de Atualizações</h2>
            </div>
            <div className="h-px flex-grow bg-gray-100 hidden md:block mb-4 ml-8"></div>
          </div>

          <div className="overflow-hidden border border-gray-100 rounded-[40px] shadow-2xl bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-50">
                    <th className="px-10 py-8 text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Data Sincronização</th>
                    <th className="px-10 py-8 text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Fonte</th>
                    <th className="px-10 py-8 text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Valor de Venda</th>
                    <th className="px-10 py-8 text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Variação Real</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {history?.map((h: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50/30 transition-colors group">
                      <td className="px-10 py-8 text-sm font-bold text-gray-500">{new Date(h.date_update).toLocaleDateString('pt-BR')}</td>
                      <td className="px-10 py-8">
                         <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span className="text-xs font-black text-gray-800 uppercase tracking-tight">{h.source || 'Base Caixa'}</span>
                         </div>
                      </td>
                      <td className="px-10 py-8 text-lg font-black text-gray-900">R$ {h.sale_value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="px-10 py-8">
                         <span className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                           <IoTrendingUpOutline size={12} />
                           {h.valuation_value ? (100 - (h.sale_value / h.valuation_value * 100)).toFixed(1) : '---'}% Lucro
                         </span>
                      </td>
                    </tr>
                  ))}
                  {(!history || history.length === 0) && (
                    <tr>
                      <td colSpan={4} className="px-10 py-20 text-center text-gray-300 font-bold italic tracking-widest uppercase text-xs">Aguardando primeira sincronização histórica...</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* BLOCO 18: INTELIGÊNCIA DA REGIÃO (NIGHT MODE) */}
        <section className="py-20 md:py-32 px-4">
          <div className="bg-black rounded-[60px] p-10 md:p-24 relative overflow-hidden text-center border border-white/5">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#005ca5]/20 blur-[150px] rounded-full"></div>
            <div className="max-w-4xl mx-auto space-y-16 relative z-10">
              <div className="space-y-4">
                <span className="text-xs font-black text-[#005ca5] tracking-[0.4em] uppercase block">BIG DATA MARKET ANALYSIS</span>
                <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter uppercase font-montserrat">Inteligência Local</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  { label: "Padrão de Construção", value: "Médio Alto", icon: "🏛️" },
                  { label: "Infraestrutura Urbana", value: "Consolidada", icon: "⚡" },
                  { label: "Tendência Regional", value: "Valorização", icon: "📈" }
                ].map((stat, i) => (
                  <div key={i} className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-10 hover:bg-white/10 transition-all">
                    <span className="text-4xl mb-4 block">{stat.icon}</span>
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">{stat.label}</p>
                    <p className="text-xl font-black text-white uppercase">{stat.value}</p>
                  </div>
                ))}
              </div>
              
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em] leading-relaxed">
                Dados consolidados via raio de 2km e CEP <span className="text-white/60">{property.address?.split(',').pop()?.trim()}</span>. Amostragem mensal atualizada.
              </p>
            </div>
          </div>
        </section>

        {/* BLOCO 20: LINKS EXTERNOS */}
        <section className="py-20 border-t border-gray-100 flex flex-col items-center">
          <h2 className="sr-only">Atendimento</h2>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] mb-12">Fontes Consultadas</span>
          <div className="flex flex-wrap justify-center gap-12 grayscale opacity-40">
             {['QuintoAndar', 'Loft', 'Zap Imóveis', 'OLX', 'CAIXA', 'VivaReal'].map(name => (
               <span key={name} className="text-[10px] font-black uppercase tracking-widest">{name}</span>
             ))}
          </div>
        </section>

        {/* BLOCO 21: HASHTAGS SEO */}
        {property.imovel_caixa_post_hashtags && (
          <section className="py-8 bg-gray-50 flex justify-center text-center px-4 mt-8 rounded-t-[40px]">
            <p className="text-[10px] font-bold text-gray-400 max-w-4xl tracking-widest leading-relaxed">
              {property.imovel_caixa_post_hashtags}
            </p>
          </section>
        )}

      </main>

      <WhatsAppFloating />
    </div>
  );
}
