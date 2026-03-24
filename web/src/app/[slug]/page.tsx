import { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import PropertyDetailsClient from '@/components/PropertyDetailsClient';

interface Props {
  params: Promise<{ slug: string }>;
}

/**
 * Funçao para buscar os dados do imóvel no servidor usando o SLUG
 */
async function getPropertyData(slug: string) {
  // 1. Dados Básicos do Imóvel buscando pelo SLUG
  const { data: property, error } = await supabase
    .from('imoveis')
    .select(`
      imoveis_id,
      imovel_caixa_numero,
      imovel_caixa_endereco_uf_sigla,
      imovel_caixa_endereco_cidade,
      imovel_caixa_endereco_bairro,
      imovel_caixa_endereco_csv,
      imovel_caixa_pagamento_fgts,
      imovel_caixa_descricao_csv,
      imovel_caixa_modalidade,
      imovel_caixa_link_imagem,
      imovel_caixa_link_matricula,
      imovel_caixa_link_acesso,
      imovel_caixa_post_titulo,
      imovel_caixa_post_descricao,
      imovel_caixa_post_imagem_destaque,
      imovel_caixa_post_link_permanente,
      imovel_caixa_post_palavra_chave,
      id_tipo_imovel_caixa,
      tipos_imovel (nome),
      imovel_caixa_descricao_quartos,
      imovel_caixa_descricao_area_privativa,
      imovel_caixa_descricao_area_total,
      imovel_caixa_descricao_area_do_terreno,
      imovel_caixa_descricao_area_servico,
      imovel_caixa_descricao_churrasqueira,
      *,
      ceps_imovel (
        cep_resumo,
        cep_info_localizacao,
        cep_m2_loft,
        cep_m2_quinto_andar,
        cep_m2_fipe_zap,
        cep_status
      ),
      grupos_imovel (
        id,
        nome,
        valor_minimo,
        valor_maximo,
        compra_financiamento_entrada_caixa,
        compra_financiamento_entrada_normal,
        compra_financiamento_prestacao,
        compra_registro,
        compra_despachante,
        compra_desocupacao,
        honorario_leiloeiro,
        honorarios_corretagem,
        honorarios_corretagem_caixa,
        venda_reforma,
        venda_impostos,
        aluguel_roi_comum,
        aluguel_roi_caixa
      )
    `)
    .eq('slug', slug)
    .single();

  if (!property) {
    return null;
  }

  // 2. Histórico (Normalizado) - Buscamos primeiro para usar o mais recente na normalização do imóvel
  const { data: historyRaw } = await supabase
    .from('atualizacoes_imovel')
    .select('*')
    .eq('imovel_id', property.id)
    .order('imovel_caixa_criacao', { ascending: false });

  const latestUpdate = historyRaw?.[0] || null;

  const id = String(property.id || '');

  // Normalização extremamente robusta utilizando os campos da VIEW
  const normalizedProp = {
    ...property,
    id: String(property.id || ''),
    property_number: property.property_number?.toString() || '',
    imovel_caixa_numero: property.property_number?.toString() || '', // Compatibilidade
    title: property.title || '',
    price: Number(property.price || 0),
    valuation_value: Number(property.appraisal_value || 0),
    discount_percent: Number(property.discount_percent || 0),
    imovel_caixa_pagamento_financiamento: property.allows_financing || false,
    imovel_caixa_pagamento_fgts: property.allows_fgts || false,
    imovel_caixa_pagamento_anotacoes: property.payment_notes || '',
    imovel_caixa_pagamento_condominio: Number(property.condo_debt || 0),
    imovel_caixa_criacao: latestUpdate?.imovel_caixa_criacao,
    bedrooms: Number(property.bedrooms || 0),
    bathrooms: Number(property.bathrooms || 0),
    garage: Number(property.garage || 0), // Este campo deve vir da view também, se adicionado
    private_area: property.private_area ? Number(property.private_area) : null, // Mapeado via view futuramente se necessário
    total_area: property.area_size ? Number(property.area_size) : null,
    land_area: property.land_area ? Number(property.land_area) : null,
    property_type: property.property_type || 'Imóvel',
    neighborhood: property.neighborhood || '',
    city: property.city || '',
    state: property.state || '',
    address: property.full_address || '',
    description: property.description || '',
    imovel_caixa_link_imagem: property.main_image || '',
    url_imagem: property.main_image || '',
    imovel_caixa_post_imagem_destaque: property.imovel_caixa_post_imagem_destaque || '',
    post_link_permanente: property.slug || '',
    investment_params: property.grupos_imovel ? [property.grupos_imovel] : [],
    // Garantir que campos de ID em joins não causem erro de serialização BigInt
    tipos_imovel: property.tipos_imovel ? { ...property.tipos_imovel, id: String((property.tipos_imovel as any).id || '') } : null,
    grupos_imovel: property.grupos_imovel ? { ...property.grupos_imovel, id: String((property.grupos_imovel as any).id || '') } : null,
    ceps_imovel: property.ceps_imovel ? { ...property.ceps_imovel, id: String((property.ceps_imovel as any).id || '') } : null
  };

  const history = historyRaw?.map(h => ({
    date_update: h.imovel_caixa_criacao,
    sale_value: Number(h.imovel_caixa_valor_venda || 0),
    valuation_value: Number(h.imovel_caixa_valor_avaliacao || 0),
    source: h.imovel_caixa_modalidade || 'Atualização'
  })) || [];

  // 3. Imóveis Similares (Normalizado)
  const { data: similarRaw } = await supabase
    .from('imoveis')
    .select('*, tipos_imovel(nome)')
    .eq('id_tipo_imovel_caixa', property.id_tipo_imovel_caixa)
    .neq('imoveis_id', id)
    .limit(3);

  const similar = similarRaw?.map(s => ({
    id: String(s.imoveis_id),
    numero_imovel: s.imovel_caixa_numero?.toString(),
    bairro: s.imovel_caixa_endereco_bairro,
    cidade: s.imovel_caixa_endereco_cidade,
    state: s.imovel_caixa_endereco_uf_sigla,
    preco_venda: Number(s.imovel_caixa_valor_venda || 0),
    valor_avaliacao: Number(s.imovel_caixa_valor_avaliacao || 0),
    desconto: Number(s.imovel_caixa_valor_desconto_percentual || 0),
    url_imagem: s.imovel_caixa_link_imagem,
    post_link_permanente: s.imovel_caixa_post_link_permanente,
    tipo_imovel: (s.tipos_imovel as any)?.nome || 'Imóvel'
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
