/**
 * Parses dynamic tags in property descriptions and evaluates math expressions.
 * Supported fields: all imovel_caixa_* and groups_imovel (compra_*, revenda_*)
 */
export function parsePropertyDescription(text: string, property: any): string {
  if (!text || !property) return text || '';

  const investment = property.investment_params?.[0] || {};

  // Comprehensive map of available fields for replacement
  const fields: Record<string, any> = {
    // Basic Property Fields
    imovel_caixa_valor_venda: Number(property.price) || 0,
    imovel_caixa_valor_avaliacao: Number(property.valuation_value) || 0,
    imovel_caixa_valor_desconto_moeda: Number(property.discount_moeda) || 0,
    imovel_caixa_valor_desconto_percentual: Number(property.discount_percent) || 0,
    imovel_caixa_numero: property.property_number || '',
    
    // Group Metadata (grupos_imovel)
    grupo_nome: investment.nome || '',
    grupo_valor_minimo: Number(investment.valor_minimo) || 0,
    grupo_valor_maximo: Number(investment.valor_maximo) || 0,

    // Purchase Phase (grupos_imovel)
    compra_honorarios_corretagem: Number(investment.compra_honorarios_corretagem) || 0,
    compra_honorarios_corretagem_caixa: Number(investment.compra_honorarios_corretagem_caixa) || 0,
    compra_honorario_leiloeiro: Number(investment.compra_honorario_leiloeiro) || 0,
    compra_registro: Number(investment.compra_registro) || 0,
    compra_despachante: Number(investment.compra_despachante) || 0,
    compra_desocupacao: Number(investment.compra_desocupacao) || 0,
    compra_financiamento_entrada_caixa: Number(investment.compra_financiamento_entrada_caixa) || 0,
    compra_financiamento_entrada_normal: Number(investment.compra_financiamento_entrada_normal) || 0,
    compra_financiamento_prestacao: Number(investment.compra_financiamento_prestacao) || 0,

    // Resale Phase (grupos_imovel)
    revenda_reforma: Number(investment.revenda_reforma) || 0,
    revenda_condominio: Number(investment.revenda_condominio) || 0,
    revenda_fundo_reserva: Number(investment.revenda_fundo_reserva) || 0,
    revenda_financiamento: Number(investment.revenda_financiamento) || 0,
    revenda_agua_luz: Number(investment.revenda_agua_luz) || 0,
    revenda_impostos: Number(investment.revenda_impostos) || 0,
    revenda_tempo_meses: Number(investment.revenda_tempo_meses) || 0,
    revenda_despesas: Number(investment.revenda_despesas) || 0,
    revenda_aceleracao: Number(investment.revenda_aceleracao) || 0,
  };

  // 1. Replace all [field_name] tags with their numeric values
  let processed = text.replace(/\[(.*?)]/g, (match, fieldName) => {
    // Standardize: replace spaces with underscores and trim
    const trimmed = fieldName.trim().toLowerCase().replace(/\s+/g, '_');
    
    if (fields[trimmed] !== undefined) {
      return fields[trimmed].toString();
    }
    
    // Handle literal percentages like [10%] -> 0.10
    if (trimmed.endsWith('%')) {
      const val = parseFloat(trimmed.replace('%', ''));
      if (!isNaN(val)) return (val / 100).toString();
    }

    return '0';
  });

  // 2. Evaluate math expressions inside parentheses that were formed
  // Support for nested or complex expressions: ( (a + b) * c )
  for (let i = 0; i < 3; i++) {
    processed = processed.replace(/\(([\d.\s*/+x-]+)\)/gi, (match, expression) => {
      try {
        const sanitized = expression.replace(/x/gi, '*');
        
        // Final sanity check for characters to prevent arbitrary code execution
        if (/[^\d.\s*/+*-]/.test(sanitized)) return match;

        // eslint-disable-next-line no-new-func
        const result = new Function(`return ${sanitized}`)();
        
        if (typeof result === 'number' && !isNaN(result)) {
          // If the expression is very small (like 0.05), don't format as currency yet
          if (Math.abs(result) < 1 && result !== 0) return result.toString();
          
          return result.toLocaleString('pt-BR', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
          });
        }
        return match;
      } catch (e) {
        return match;
      }
    });
  }

  return processed;
}
