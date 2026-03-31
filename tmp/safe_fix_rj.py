import os
import sys
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client
from pathlib import Path

# Adiciona o diretório raiz ao path
sys.path.append(str(Path(__file__).parent.parent))

from automation.tools.ingest_caixa_csv import (
    MasterDataLoader, get_col, parse_brl_numeric, generate_seo_fields, 
    _enviar_batch, supabase, DESCONTO_MINIMO, MODALIDADES_ACEITAS
)

def safe_fix_rj():
    print("[SAFE-FIX] Iniciando correção dos dados do RJ...")
    file_path = r'c:\Users\PICHAU\Desktop\antigravity\venda-imoveis-caixa\automation\csv-caixa-xlsx\03-29-Lista_imoveis_RJ.xlsx'
    
    master = MasterDataLoader(supabase)
    
    # Lendo o Excel como string para garantir que IDs não sejam corrompidos
    df = pd.read_excel(file_path, dtype=str)
    df.columns = [str(c).strip() for c in df.columns]
    
    # Mapeamento de colunas
    c_numero     = get_col(df, ['imovel', 'numero', 'Nº do imóvel'])
    c_preco      = get_col(df, ['venda'])
    c_avaliacao  = get_col(df, ['avaliacao', 'avaliação'])
    c_desconto   = get_col(df, ['desconto'])
    c_modalidade = get_col(df, ['modalidade'])
    c_tipo       = get_col(df, ['tipo'])
    c_uf         = get_col(df, ['uf'])
    c_cidade     = get_col(df, ['cidade'])
    c_bairro     = get_col(df, ['bairro'])

    batch_imoveis = []
    batch_historico = []
    total_batch = 0

    for idx, row in df.iterrows():
        try:
            num_raw = row.get(c_numero)
            numero = int(float(str(num_raw)))
            
            # Use a nova função robusta
            preco     = parse_brl_numeric(row.get(c_preco, '0'))
            avaliacao = parse_brl_numeric(row.get(c_avaliacao, '0'))
            desconto  = parse_brl_numeric(row.get(c_desconto, '0'))
            if 0 < desconto < 1.0: desconto *= 100
            
            # Filtros básicos (igual ao pipeline)
            modalidade = str(row.get(c_modalidade, '')).strip()
            if modalidade.lower() not in [m.lower() for m in MODALIDADES_ACEITAS]: continue
            if desconto < DESCONTO_MINIMO: continue

            val_moeda = max(0.0, avaliacao - preco)
            
            # Localização
            uf_raw     = str(row.get(c_uf, '')).strip()
            cidade_raw = str(row.get(c_cidade, '')).strip()
            bairro_raw = str(row.get(c_bairro, '')).strip()
            uf_id, cid_id, bai_id, rev, uf_fin = master.resolve_location(uf_raw, cidade_raw, bairro_raw, "RJ")
            
            # SEO
            tipo_raw = str(row.get(c_tipo, 'Imóvel')).strip()
            titulo, slug, desc_seo, keyword = generate_seo_fields(
                numero, modalidade, uf_fin, cidade_raw, bairro_raw, val_moeda, tipo_raw
            )
            
            # Payload Imovel
            batch_imoveis.append({
                "imovel_caixa_numero": numero,
                "imovel_caixa_post_titulo": titulo,
                "imovel_caixa_post_link_permanente": slug,
                "imovel_caixa_post_descricao": desc_seo,
                "imovel_caixa_post_palavra_chave": keyword,
                "updated_at": datetime.now().isoformat()
            })

            # Payload Histórico
            batch_historico.append({
                "numero": numero, # temporário para _enviar_batch
                "imovel_caixa_modalidade": modalidade,
                "imovel_caixa_valor_venda": preco,
                "imovel_caixa_valor_avaliacao": avaliacao,
                "imovel_caixa_valor_desconto_moeda": val_moeda,
                "imovel_caixa_valor_desconto_percentual": desconto,
                "created_at": datetime.now().isoformat()
            })

            if len(batch_imoveis) >= 100:
                print(f"  [BULK] Inserindo lote de 100... (Total processado: {total_batch + 100})")
                _enviar_batch(batch_imoveis, batch_historico, supabase, master)
                batch_imoveis = []
                batch_historico = []
                total_batch += 100

        except Exception as e:
            print(f"  [FAIL] Row {idx}: {e}")

    # Lote final
    if batch_imoveis:
        _enviar_batch(batch_imoveis, batch_historico, supabase, master)

    print(f"[SAFE-FIX] Finalizado. Total: {total_batch + len(batch_imoveis)}")

if __name__ == "__main__":
    safe_fix_rj()
