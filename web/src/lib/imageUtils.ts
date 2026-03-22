/**
 * Utilitários para gerenciar caminhos de imagens dos imóveis
 */

/**
 * Remove acentos e caracteres especiais de uma string
 */
export function normalizeString(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Gera o caminho da imagem local em /public/imagens-destaque/
 */
export function getLocalImagePath(property: any): string {
  const tipo = normalizeString(property.tipo_imovel || property.property_type || 'imovel');
  const bairro = normalizeString(property.bairro || property.neighborhood || '');
  const cidade = normalizeString(property.cidade || property.city || '');
  const uf = normalizeString(property.uf || property.state || '');
  const numero = property.numero_imovel || property.property_number;

  return `/imagens-destaque/${tipo}-${bairro}-${cidade}-${uf}-${numero}.jpg`;
}

/**
 * Gera a URL da Caixa com o preenchimento de zeros (15 dígitos)
 */
export function getCorrectedCaixaUrl(numero: number | string): string {
  const numStr = numero.toString();
  // A Caixa usa um padrão de 15 dígitos (incluindo o sufixo '21' para fachada)
  // Ex: ID 10152998 -> F000001015299821.jpg
  const withSuffix = numStr.endsWith('21') ? numStr : `${numStr}21`;
  const padded = withSuffix.padStart(15, '0');
  return `https://venda-imoveis.caixa.gov.br/fotos/F${padded}.jpg`;
}
