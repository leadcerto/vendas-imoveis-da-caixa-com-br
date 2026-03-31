import os
import sys
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client
from pathlib import Path
import re

# Adiciona o diretório raiz ao path
sys.path.append(str(Path(__file__).parent.parent))

from automation.tools.ingest_caixa_csv import (
    MasterDataLoader, get_col, generate_seo_fields, 
    _enviar_batch, supabase, DESCONTO_MINIMO, MODALIDADES_ACEITAS
)

def parse_brl_numeric_v2(val):
    if not val or str(val).lower() == 'nan': return 0.0
    s = str(val).strip()
    if ',' not in s:
        try: return float(s)
        except: pass
    if ',' in s:
        if '.' in s: s = s.replace('.', '')
        s = s.replace(',', '.')
        try: return float(s)
        except: pass
    clean = re.sub(r'[^0-9\.\-]', '', s)
    try: return float(clean)
    except: return 0.0

def safe_fix_rj():
    print("[SAFE-FIX] Iniciando correção dos dados do RJ...")
    file_path = r'c:\Users\PICHAU\Desktop\antigravity\venda-imoveis-caixa\automation\csv-caixa-xlsx\03-29-Lista_imoveis_RJ.xlsx'
    
    master = MasterDataLoader(supabase)
    # master.fill_cache() <- Removido pois o cache de IDs é sob demanda no recover_ids
    
    # Lendo o Excel como string
    df = pd.read_excel(file_path, dtype=str)
    df.columns = [str(c).strip() for c in df.columns]
    
    # Mapeamento de colunas (com nomes exatos dessa vez para garantir)
    c_numero     = 'imovel_caixa_numero'
    c_preco      = 'imovel_caixa_valor_venda'
    c_avaliacao  = 'imovel_caixa_valor_avaliacao'
    c_desconto   = 'imovel_caixa_valor_desconto_percentual'
    c_modalidade = 'imovel_caixa_modalidade'
    c_tipo       = 'imovel_caixa_tipo'
    c_uf         = 'imovel_caixa_endereco_uf'
    c_cidade     = 'imovel_caixa_endereco_cidade'
    c_bairro     = 'imovel_caixa_endereco_bairro'

    batch_imoveis = []
    batch_historico = []
    total_processado = 0
    total_sucesso = 0

    for idx, row in df.iterrows():
        try:
            num_raw = row.get(c_numero)
            if not num_raw: continue
            numero = int(float(str(num_raw)))
            
            # Use a nova função robusta v2
            preco     = parse_brl_numeric_v2(row.get(c_preco, '0'))
            avaliacao = parse_brl_numeric_v2(row.get(c_avaliacao, '0'))
            desconto  = parse_brl_numeric_v2(row.get(c_desconto, '0'))
            if 0 < desconto < 1.0: desconto *= 100
            
            modalidade = str(row.get(c_modalidade, '')).strip()
            if modalidade.lower() not in [m.lower() for m in MODALIDADES_ACEITAS]: continue
            if desconto < DESCONTO_MINIMO: continue

            val_moeda = max(0.0, avaliacao - preco)
            
            # Localização
            uf_raw     = str(row.get(c_uf, '')).strip()
            cidade_raw = str(row.get(c_cidade, '')).strip()
            bairro_raw = str(row.get(c_bairro, '')).strip()
            # Simplificando location resolution se o master já souber
            uf_id, cid_id, bai_id, rev, uf_fin = master.resolve_location(uf_raw, cidade_raw, bairro_raw, "RJ")
            
            # SEO
            tipo_raw = str(row.get(c_tipo, 'Imóvel')).strip()
            titulo, slug, desc_seo, keyword = generate_seo_fields(
                numero, modalidade, uf_fin, cidade_raw, bairro_raw, val_moeda, tipo_raw
            )
            
            batch_imoveis.append({
                "imovel_caixa_numero": numero,
                "imovel_caixa_post_titulo": titulo,
                "imovel_caixa_post_link_permanente": slug,
                "imovel_caixa_post_descricao": desc_seo,
                "imovel_caixa_post_palavra_chave": keyword,
                "updated_at": datetime.now().isoformat()
            })

            batch_historico.append({
                "numero": numero,
                "imovel_caixa_modalidade": modalidade,
                "imovel_caixa_valor_venda": preco,
                "imovel_caixa_valor_avaliacao": avaliacao,
                "imovel_caixa_valor_desconto_moeda": val_moeda,
                "imovel_caixa_valor_desconto_percentual": desconto,
                "created_at": datetime.now().isoformat()
            })

            total_processado += 1
            if len(batch_imoveis) >= 100:
                _enviar_batch(batch_imoveis, batch_historico, supabase, master)
                total_sucesso += len(batch_historico)
                print(f"  [BULK] Inserido lote (Total ok: {total_sucesso})")
                batch_imoveis = []
                batch_historico = []

        except Exception as e:
            print(f"  [FAIL] Row {idx}: {e}")

    if batch_imoveis:
        _enviar_batch(batch_imoveis, batch_historico, supabase, master)
        total_sucesso += len(batch_historico)

    print(f"[SAFE-FIX] Finalizado. Sucesso: {total_sucesso} / Processado: {total_processado}")

if __name__ == "__main__":
    safe_fix_rj()
