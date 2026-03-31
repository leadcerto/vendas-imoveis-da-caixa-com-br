import sys
import os
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client
import datetime

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
        
    print(f"📥 Etapa 1 - Cadastro Básico iniciado.")
    print(f"📄 Lendo arquivo: {excel_path}")
    
    try:
        df = pd.read_excel(excel_path)
    except Exception as e:
        print(f"❌ Erro ao ler Excel: {e}")
        sys.exit(1)
        
    total_linhas = len(df)
    sucessos = 0
    erros = 0
    
    print(f"📊 Total de linhas encontradas: {total_linhas}")
    
    for idx, row in df.iterrows():
        try:
            # 1. Dados básicos
            numero_imovel = int(row.get('imovel_caixa_numero', 0))
            if numero_imovel == 0:
                continue
                
            dados_imovel = {
                "imovel_caixa_numero": numero_imovel,
                "imovel_caixa_endereco_uf": str(row.get('imovel_caixa_endereco_uf', '')).strip(),
                "imovel_caixa_endereco_cidade": str(row.get('imovel_caixa_endereco_cidade', '')).strip(),
                "imovel_caixa_endereco_bairro": str(row.get('imovel_caixa_endereco_bairro', '')).strip(),
                "imovel_caixa_endereco_csv": str(row.get('imovel_caixa_endereco_csv', '')).strip(),
                "imovel_caixa_descricao_csv": str(row.get('imovel_caixa_descricao_csv', '')).strip(),
                "imovel_caixa_link_acesso_direto": str(row.get('imovel_caixa_link_acesso_direto', '')).strip(),
                "imovel_caixa_descricao_tipo": str(row.get('imovel_caixa_descricao_tipo', '')).strip(),
                "imovel_caixa_link_imagem": str(row.get('imovel_caixa_link_imagem', '')).strip(),
                "imovel_caixa_link_matricula": str(row.get('imovel_caixa_link_matricula', '')).strip(),
                "etapa_processamento": 1
            }
            
            # Upsert na tabela imoveis (se existir, atualiza os dados crús e reseta etapa_processamento para 1)
            resp_imovel = supabase.table("imoveis").upsert(
                dados_imovel, 
                on_conflict="imovel_caixa_numero",
                ignore_duplicates=False
            ).execute()
            
            # Buscar o imoveis_id para relacionamento
            imoveis_id = None
            if resp_imovel.data and len(resp_imovel.data) > 0:
                imoveis_id = resp_imovel.data[0].get("imoveis_id")
            else:
                resp_query = supabase.table("imoveis").select("imoveis_id").eq("imovel_caixa_numero", numero_imovel).execute()
                if resp_query.data:
                    imoveis_id = resp_query.data[0].get("imoveis_id")
                    
            if not imoveis_id:
                print(f"⚠️ Imóvel {numero_imovel}: Falha ao obter imoveis_id após Upsert.")
                erros += 1
                continue
            
            # 2. Dados financeiros para atualizacoes_imovel
            data_criacao = row.get('imovel_caixa_data_criacao')
            if pd.isna(data_criacao):
                data_criacao = datetime.datetime.now().isoformat()
            elif isinstance(data_criacao, str):
                pass
            else:
                data_criacao = str(data_criacao)
                
            aceita_finan = parse_financiamento(row.get('imovel_caixa_pagamento_financiamento'))
                
            dados_atualizacao = {
                "imovel_id": imoveis_id,
                "imovel_caixa_valor_venda": float(row.get('imovel_caixa_valor_venda', 0.0)),
                "imovel_caixa_valor_avaliacao": float(row.get('imovel_caixa_valor_avaliacao', 0.0)),
                "imovel_caixa_valor_desconto_percentual": float(row.get('imovel_caixa_valor_desconto_percentual', 0.0)),
                "imovel_caixa_pagamento_financiamento": aceita_finan,
                "imovel_caixa_modalidade": str(row.get('imovel_caixa_modalidade', '')).strip(),
                "imovel_caixa_data_criacao": data_criacao,
                "imovel_caixa_valor_desconto_moeda": float(row.get('imovel_caixa_valor_desconto_moeda', 0.0))
            }
            
            supabase.table("atualizacoes_imovel").insert(dados_atualizacao).execute()
            
            sucessos += 1
            if sucessos % 50 == 0:
                print(f"⏳ Processados {sucessos}/{total_linhas} imóveis...")
                
        except Exception as e:
            print(f"❌ Erro na linha {idx}: {e}")
            erros += 1
            continue

    print("=====================================================")
    print(f"✅ ETAPA 1 CONCLUÍDA")
    print(f"✅ Sucesso: {sucessos} imóveis gravados/atualizados.")
    print(f"⚠️ Erros/Ignorados: {erros}")
    print("=====================================================")

if __name__ == "__main__":
    main()
