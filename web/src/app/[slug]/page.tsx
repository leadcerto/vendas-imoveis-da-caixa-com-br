import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import PropertyDetailsClient from '@/components/PropertyDetailsClient';

interface Props {
  params: Promise<{ slug: string }>;
}

/**
 * Funçao para buscar os dados do imóvel no servidor usando o SLUG
 */
async function getPropertyData(slug: string) {
  // 1. Dados Básicos do Imóvel buscando pelo SLUG na view 'properties'
  let { data: property, error } = await supabase
    .from('properties')
    .select('*')
    .eq('slug', slug)
    .single();

  // Redirecionamento de Legado: Se não encontrar e o slug tiver underscore, tenta com hífen
  if (!property && slug.includes('_')) {
    const dashSlug = slug.replace(/_/g, '-');
    const { data: retryData } = await supabase
      .from('properties')
      .select('*')
      .eq('slug', dashSlug)
      .single();
    
    if (retryData) {
      return { redirect: dashSlug };
    }
  }

  if (!property) {
    return null;
  }

  // 2. Histórico - Já temos o preço atual na view, mas buscamos o histórico para o gráfico
  const { data: historyRaw } = await supabase
    .from('atualizacoes_imovel')
    .select('*')
    .eq('imovel_id', property.id)
    .order('imovel_caixa_criacao', { ascending: false });

  // Normalização extremamente robusta utilizando os campos da VIEW
  const normalizedProp = {
    ...property,
    id: String(property.id || ''),
    property_number: property.numero_imovel?.toString() || '',
    imovel_caixa_numero: property.numero_imovel?.toString() || '', // Compatibilidade
    title: property.post_titulo || '',
    price: Number(property.preco || 0),
    valuation_value: Number(property.valor_avaliacao || 0),
    discount_percent: Number(property.desconto || 0),
    imovel_caixa_pagamento_financiamento: property.modalidade?.toLowerCase().includes('financiamento') || false,
    imovel_caixa_pagamento_fgts: property.permite_fgts || false,
    imovel_caixa_pagamento_anotacoes: property.anotacoes_pagamento || '',
    imovel_caixa_pagamento_condominio: Number(property.debito_condominio || 0),
    imovel_caixa_criacao: historyRaw?.[0]?.imovel_caixa_criacao,
    bedrooms: Number(property.quartos || 0),
    bathrooms: Number(property.banheiros || 0),
    garage: Number(property.vagas || 0),
    private_area: property.area_privativa ? Number(property.area_privativa) : null,
    total_area: property.area_total ? Number(property.area_total) : null,
    land_area: property.area_terreno ? Number(property.area_terreno) : null,
    property_type: property.tipo_nome || 'Imóvel',
    neighborhood: property.bairro_nome || '',
    city: property.cidade_nome || '',
    state: property.uf_sigla || '',
    address: property.endereco || '',
    description: property.post_descricao || '',
    imovel_caixa_link_imagem: property.foto || '',
    url_imagem: property.foto || '',
    // Campos SEO do Banco (Renomeados na View)
    imovel_caixa_post_titulo: property.post_titulo || '',
    imovel_caixa_post_descricao: property.post_descricao || '',
    imovel_caixa_post_palavra_chave: property.post_palavra_chave || '',
    imovel_caixa_post_link_permanente: property.slug || '',
    imovel_caixa_post_imagem_destaque: property.post_imagem_destaque || '',
    post_link_permanente: property.slug || '',
    // Campos de cartório
    cartorio_matricula: property.cartorio_matricula,
    cartorio_comarca: property.cartorio_comarca,
    cartorio_oficio: property.cartorio_oficio,
    cartorio_inscricao: property.cartorio_inscricao,
    cartorio_averbacao: property.cartorio_averbacao,
    link_matricula: property.link_matricula
  };

  const history = historyRaw?.map(h => ({
    date_update: h.imovel_caixa_criacao,
    sale_value: Number(h.imovel_caixa_valor_venda || 0),
    valuation_value: Number(h.imovel_caixa_valor_avaliacao || 0),
    source: h.imovel_caixa_modalidade || 'Atualização'
  })) || [];

  // 3. Imóveis Similares (Normalizado via VIEW)
  const { data: similarRaw } = await supabase
    .from('properties')
    .select('*')
    .eq('tipo_imovel_id', property.tipo_imovel_id)
    .neq('id', property.id)
    .limit(3);

  const similar = similarRaw?.map(s => ({
    id: String(s.id),
    numero_imovel: s.numero_imovel?.toString(),
    bairro: s.bairro_nome,
    cidade: s.cidade_nome,
    state: s.uf_sigla,
    preco_venda: Number(s.preco || 0),
    valor_avaliacao: Number(s.valor_avaliacao || 0),
    desconto: Number(s.desconto || 0),
    url_imagem: s.foto,
    post_link_permanente: s.slug,
    tipo_imovel: s.tipo_nome || 'Imóvel'
  })) || [];

  return { 
    property: normalizedProp, 
    history: history || [], 
    similar: similar || [] 
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPropertyData(slug);

  if (!data || !data.property) {
    return {
      title: 'Imóvel não encontrado | Oportunidades Caixa',
    };
  }

  const { property } = data;
  const title = property.title;
  const description = property.imovel_caixa_post_descricao || `Grande oportunidade de investimento em ${property.city}. Confidentialidade e lucro garantido.`;
  
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://venda.imoveisdacaixa.com.br';
  
  const imageUrl = property.imovel_caixa_post_imagem_destaque 
    ? `${baseUrl}${property.imovel_caixa_post_imagem_destaque}`
    : property.url_imagem;

  return {
    title: `${title} | Oportunidades Caixa`,
    description,
    alternates: {
      canonical: `${baseUrl}/${property.post_link_permanente}`,
    },
    openGraph: {
      title,
      description,
      url: `${baseUrl}/${property.post_link_permanente}`,
      siteName: 'Imóveis da Caixa',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
        },
      ],
      locale: 'pt_BR',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: description, // Changed to description as per common practice for Twitter card description
      description: description,
      images: [imageUrl],
    },
  };
}

export default async function PropertyPage({ params }: Props) {
  const { slug } = await params;
  const data = await getPropertyData(slug);

  if (data?.redirect) {
    redirect(`/${data.redirect}`);
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-black text-gray-900 uppercase">404</h1>
          <p className="text-gray-500 font-bold uppercase tracking-widest">Imóvel não encontrado</p>
          <a href="/busca-imoveis" className="inline-block px-8 py-4 bg-[#005CA9] text-white rounded-2xl font-black uppercase">Voltar ao Início</a>
        </div>
      </div>
    );
  }

  return (
    <PropertyDetailsClient 
      property={data.property} 
      history={data.history} 
      similar={data.similar} 
    />
  );
}
