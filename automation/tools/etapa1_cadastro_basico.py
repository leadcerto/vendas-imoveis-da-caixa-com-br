import sys
import os
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client
import datetime
import re
import unicodedata

# Forçar UTF-8 no console Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# Carregar variáveis de ambiente
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
env_path = os.path.join(ROOT_DIR, "web", ".env")
load_dotenv(env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ ERRO: SUPABASE_URL ou SUPABASE_KEY (Service Role) não encontrados.")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def remove_accents(input_str):
    if not input_str: return ""
    nfkd_form = unicodedata.normalize('NFKD', str(input_str))
    return "".join([c for c in nfkd_form if not unicodedata.combining(c)])

def clean_name(name):
    if not name: return ""
    return remove_accents(name).strip().upper()

def parse_financiamento(texto) -> bool:
    txt = str(texto).strip().lower()
    return txt == 'sim' or txt == 'true' or txt == '1'

def main():
    if len(sys.argv) < 2:
        print("Uso: python etapa1_cadastro_basico.py <caminho_para_excel>")
        sys.exit(1)
        
    excel_path = sys.argv[1]
    
    if not os.path.exists(excel_path):
        print(f"❌ ERRO: Arquivo não encontrado - {excel_path}")
        sys.exit(1)
        
    print(f"📥 Etapa 1 - Cadastro Básico iniciado (MODO RELACIONAL ATIVO).")
    
    # 1. Cache de Estados e Cidades para Linkagem de IDs
    print("🔍 Carregando mapas de Estados e Cidades...")
    res_est = supabase.table("estados").select("id, sigla").execute()
    estados_map = {clean_name(e["sigla"]): e["id"] for e in res_est.data}
    
    # Carregar cidades (apenas o necessário ou tudo se for viável - 5.7k é ok para memória)
    res_cid = supabase.table("cidades").select("id, nome, id_uf").execute()
    # Criamos uma chave composta clean_nome + id_uf
    cidades_map = {}
    for c in res_cid.data:
        key = (clean_name(c["nome"]), c["id_uf"])
        cidades_map[key] = c["id"]

    try:
        df = pd.read_excel(excel_path)
    except Exception as e:
        print(f"❌ Erro ao ler Excel: {e}")
        sys.exit(1)
        
    total_linhas = len(df)
    sucessos = 0
    erros = 0
    
    print(f"📊 Total de linhas encontradas: {total_linhas}")
    
    BATCH_SIZE = 200
    
    for start_idx in range(0, total_linhas, BATCH_SIZE):
        batch_df = df.iloc[start_idx : start_idx + BATCH_SIZE]
        lote_imoveis = []
        lote_financeiro_raw = []
        
        for idx, row in batch_df.iterrows():
            try:
                numero_imovel = int(row.get('imovel_caixa_numero', 0))
                if numero_imovel == 0: continue
                
                uf_raw = str(row.get('imovel_caixa_endereco_uf', '')).strip()
                cidade_raw = str(row.get('imovel_caixa_endereco_cidade', '')).strip()
                
                # Lookup IDs
                id_uf = estados_map.get(clean_name(uf_raw))
                id_cidade = cidades_map.get((clean_name(cidade_raw), id_uf)) if id_uf else None
                
                lote_imoveis.append({
                    "imovel_caixa_numero": numero_imovel,
                    "imovel_caixa_endereco_uf": uf_raw,
                    "imovel_caixa_endereco_cidade": cidade_raw,
                    "imovel_caixa_endereco_bairro": str(row.get('imovel_caixa_endereco_bairro', '')).strip(),
                    "imovel_caixa_endereco_csv": str(row.get('imovel_caixa_endereco_csv', '')).strip(),
                    "imovel_caixa_descricao_csv": str(row.get('imovel_caixa_descricao_csv', '')).strip(),
                    "imovel_caixa_link_acesso_direto": str(row.get('imovel_caixa_link_acesso_direto', '')).strip(),
                    "imovel_caixa_descricao_tipo": str(row.get('imovel_caixa_descricao_tipo', '')).strip(),
                    "imovel_caixa_link_imagem": str(row.get('imovel_caixa_link_imagem', '')).strip(),
                    "imovel_caixa_link_matricula": str(row.get('imovel_caixa_link_matricula', '')).strip(),
                    "id_uf_imovel_caixa": id_uf,
                    "id_cidade_imovel_caixa": id_cidade,
                    "etapa_processamento": 1
                })
                
                lote_financeiro_raw.append(row)
            except Exception as e:
                erros += 1
                
        if not lote_imoveis: continue
            
        try:
            # Upsert
            resp_imoveis = supabase.table("imoveis").upsert(lote_imoveis, on_conflict="imovel_caixa_numero").execute()
            numero_to_id = {item["imovel_caixa_numero"]: item["imoveis_id"] for item in resp_imoveis.data}
            
            # Financeiro (sempre insert de nova atualização)
            lote_atualizacoes = []
            for row in lote_financeiro_raw:
                num = int(row.get('imovel_caixa_numero', 0))
                imoveis_id = numero_to_id.get(num)
                if not imoveis_id: continue
                
                data_criacao = row.get('imovel_caixa_data_criacao')
                if pd.isna(data_criacao): data_criacao = datetime.datetime.now().isoformat()
                else: data_criacao = str(data_criacao)
                
                lote_atualizacoes.append({
                    "imovel_id": imoveis_id,
                    "imovel_caixa_valor_venda": float(row.get('imovel_caixa_valor_venda', 0.0)),
                    "imovel_caixa_valor_avaliacao": float(row.get('imovel_caixa_valor_avaliacao', 0.0)),
                    "imovel_caixa_valor_desconto_percentual": float(row.get('imovel_caixa_valor_desconto_percentual', 0.0)),
                    "imovel_caixa_pagamento_financiamento": parse_financiamento(row.get('imovel_caixa_pagamento_financiamento')),
                    "imovel_caixa_modalidade": str(row.get('imovel_caixa_modalidade', '')).strip(),
                    "imovel_caixa_data_criacao": data_criacao,
                    "imovel_caixa_valor_desconto_moeda": float(row.get('imovel_caixa_valor_desconto_moeda', 0.0))
                })
            
            if lote_atualizacoes:
                supabase.table("atualizacoes_imovel").insert(lote_atualizacoes).execute()
                
            sucessos += len(lote_imoveis)
            print(f"⏳ Lote concluído: {sucessos}/{total_linhas} imóveis...")
            
        except Exception as e:
            print(f"❌ Erro no lote: {e}")
            erros += len(lote_imoveis)

    print(f"\n✅ ETAPA 1 CONCLUÍDA. Sucessos: {sucessos} | Erros: {erros}")

if __name__ == "__main__":
    main()


if __name__ == "__main__":
    main()
