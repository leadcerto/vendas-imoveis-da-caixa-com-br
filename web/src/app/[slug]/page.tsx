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
      imovel_caixa_valor_venda,
      imovel_caixa_valor_avaliacao,
      imovel_caixa_valor_desconto_percentual,
      imovel_caixa_pagamento_financiamento,
      imovel_caixa_pagamento_fgts,
      imovel_caixa_descricao_csv,
      imovel_caixa_modalidade,
      imovel_caixa_link_imagem,
      imovel_caixa_link_matricula,
      imovel_caixa_link_acesso,
      imovel_caixa_criacao,
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
      imovel_caixa_descricao_cozinha,
      imovel_caixa_descricao_garagem,
      imovel_caixa_descricao_piscina,
      imovel_caixa_descricao_sala,
      imovel_caixa_descricao_terraco,
      imovel_caixa_descricao_varanda,
      imovel_caixa_descricao_wc_banheiro,
      imovel_caixa_cartorio_averbacao,
      imovel_caixa_cartorio_comarca,
      imovel_caixa_cartorio_inscricao_imobiliaria,
      imovel_caixa_cartorio_matricula,
      imovel_caixa_cartorio_oficio,
      imovel_caixa_link_matricula,
      imovel_caixa_venda_timer,
      imovel_caixa_venda_vendedor,
      imovel_caixa_venda_tipo_oficial,
      imovel_caixa_regra_condominio,
      imovel_caixa_regra_iptu,
      imovel_caixa_galeria_fotos,
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
    .eq('imovel_caixa_post_link_permanente', slug)
    .single();

  if (!property) {
    return null;
  }

  const id = property.imoveis_id;

  // Normalização para o componente PropertyDetailsClient
  // Nota: O componente espera nomes de campos em inglês/camelCase em algumas partes
  const normalizedProp = {
    ...property,
    id: property.imoveis_id,
    title: property.imovel_caixa_post_titulo,
    property_number: property.imovel_caixa_numero,
    valuation_value: Number(property.imovel_caixa_valor_avaliacao),
    price: Number(property.imovel_caixa_valor_venda),
    neighborhood: property.imovel_caixa_endereco_bairro,
    city: property.imovel_caixa_endereco_cidade,
    state: property.imovel_caixa_endereco_uf_sigla,
    address: property.imovel_caixa_endereco_csv,
    description: property.imovel_caixa_descricao_csv,
    property_type: (property.tipos_imovel as any)?.nome || 'Imóvel',
    sale_modality: property.imovel_caixa_modalidade,
    bedrooms: property.imovel_caixa_descricao_quartos,
    private_area: property.imovel_caixa_descricao_area_privativa,
    total_area: property.imovel_caixa_descricao_area_total,
    land_area: property.imovel_caixa_descricao_area_do_terreno,
    service_area: property.imovel_caixa_descricao_area_servico,
    barbecue: property.imovel_caixa_descricao_churrasqueira,
    kitchen: property.imovel_caixa_descricao_cozinha,
    garage: property.imovel_caixa_descricao_garagem,
    pool: property.imovel_caixa_descricao_piscina,
    living_room: property.imovel_caixa_descricao_sala,
    terrace: property.imovel_caixa_descricao_terraco,
    balcony: property.imovel_caixa_descricao_varanda,
    bathrooms: property.imovel_caixa_descricao_wc_banheiro,
    cartorio_averbacao: property.imovel_caixa_cartorio_averbacao,
    cartorio_comarca: property.imovel_caixa_cartorio_comarca,
    cartorio_inscricao: property.imovel_caixa_cartorio_inscricao_imobiliaria,
    cartorio_matricula: property.imovel_caixa_cartorio_matricula,
    cartorio_oficio: property.imovel_caixa_cartorio_oficio,
    link_matricula: property.imovel_caixa_link_matricula,
    post_link_permanente: property.imovel_caixa_post_link_permanente,
    url_imagem: property.imovel_caixa_link_imagem,
    vendedor: property.imovel_caixa_venda_vendedor,
    venda_timer: property.imovel_caixa_venda_timer,
    venda_tipo_oficial: property.imovel_caixa_venda_tipo_oficial,
    regra_condominio: property.imovel_caixa_regra_condominio,
    regra_iptu: property.imovel_caixa_regra_iptu,
    galeria_fotos: property.imovel_caixa_galeria_fotos,
    enrichment: property.ceps_imovel,
    investment_params: property.grupos_imovel,
    // Original DB field names for safety
    imovel_caixa_numero: property.imovel_caixa_numero,
    imovel_caixa_post_link_permanente: property.imovel_caixa_post_link_permanente
  };

  // 2. Histórico (Normalizado)
  const { data: historyRaw } = await supabase
    .from('atualizacoes_imovel')
    .select('*')
    .eq('id_imovel_caixa', property.imovel_caixa_numero)
    .order('data_atualizacao', { ascending: false });

  const history = historyRaw?.map(h => ({
    date_update: h.data_atualizacao,
    sale_value: Number(h.valor_venda),
    valuation_value: Number(h.valor_avaliacao),
    source: h.origem_caixa ? 'Caixa' : 'Sistema'
  })) || [];

  // 3. Imóveis Similares (Normalizado)
  const { data: similarRaw } = await supabase
    .from('imoveis')
    .select('*, tipos_imovel(nome)')
    .eq('id_tipo_imovel_caixa', property.id_tipo_imovel_caixa)
    .neq('imoveis_id', id)
    .limit(3);

  const similar = similarRaw?.map(s => ({
    id: s.imoveis_id,
    numero_imovel: s.imovel_caixa_numero,
    bairro: s.imovel_caixa_endereco_bairro,
    cidade: s.imovel_caixa_endereco_cidade,
    preco_venda: s.imovel_caixa_valor_venda,
    valor_avaliacao: s.imovel_caixa_valor_avaliacao,
    desconto: s.imovel_caixa_valor_desconto_percentual,
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
