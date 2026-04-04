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
    log_id = sys.argv[2] if len(sys.argv) > 2 else None
    
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
        
        # Tentar capturar a data da lista (CAIXA) para o log
        if log_id:
            try:
                # Pega a primeira data não nula que encontrar no lote
                data_exemplo = df['imovel_caixa_data_criacao'].dropna().iloc[0]
                dt_obj = pd.to_datetime(data_exemplo)
                data_formatada = dt_obj.strftime('%Y-%m-%d')
                supabase.table("logs_ingestao").update({"data_lista": data_formatada}).eq("id", log_id).execute()
                print(f"✅ Data da lista registrada no log: {data_formatada}")
            except Exception as e:
                print(f"⚠️ Não foi possível extrair a data da lista para o log: {e}")
    except Exception as e:
        print(f"❌ Erro ao ler Excel: {e}")
        sys.exit(1)
        
    total_linhas = len(df)
    sucessos = 0
    erros = 0
    
    print(f"📊 Total de linhas encontradas: {total_linhas}")
    
    # Contadores para o resumo final
    count_novos = 0
    count_conformes = 0
    count_fora_da_lista = 0
    count_removidos_120_dias = 0

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
                
                if uf_raw: ufs_processadas_set.add(uf_raw.strip().upper())
                numeros_processados_set.add(numero_imovel)
                
                # Validação de Imagem (Passo 1 marketing)
                link_img = str(row.get('imovel_caixa_link_imagem', '')).strip()
                if not link_img or not link_img.startswith('http'):
                    print(f"⚠️ Aviso: Imóvel {numero_imovel} sem link de imagem válido.")
                
                # Campos para o cadastro do imóvel
                imovel_data = {
                    "imovel_caixa_numero": numero_imovel,
                    "imovel_caixa_endereco_uf": uf_raw,
                    "imovel_caixa_endereco_cidade": cidade_raw,
                    "imovel_caixa_endereco_bairro": str(row.get('imovel_caixa_endereco_bairro', '')).strip(),
                    "imovel_caixa_endereco_csv": str(row.get('imovel_caixa_endereco_csv', '')).strip(),
                    "imovel_caixa_descricao_csv": str(row.get('imovel_caixa_descricao_csv', '')).strip(),
                    "imovel_caixa_link_acesso_direto": str(row.get('imovel_caixa_link_acesso_direto', '')).strip(),
                    "imovel_caixa_descricao_tipo": str(row.get('imovel_caixa_descricao_tipo', '')).strip(),
                    "imovel_caixa_link_imagem": link_img,
                    "imovel_caixa_link_matricula": str(row.get('imovel_caixa_link_matricula', '')).strip(),
                    "id_uf_imovel_caixa": id_uf,
                    "id_cidade_imovel_caixa": id_cidade,
                    "etapa_processamento": 1
                }
                
                lote_imoveis.append(imovel_data)
                lote_financeiro_raw.append(row)
            except Exception as e:
                print(f"❌ Erro ao processar linha {idx}: {e}")
                erros += 1
                
        if not lote_imoveis: continue
            
        try:
            # 1. Identificar quais imóveis já existem para fazer o "Smart Upsert"
            lista_numeros = [item["imovel_caixa_numero"] for item in lote_imoveis]
            res_exis = supabase.table("imoveis").select("imoveis_id, imovel_caixa_numero").in_("imovel_caixa_numero", lista_numeros).execute()
            existentes = {int(p["imovel_caixa_numero"]): p["imoveis_id"] for p in res_exis.data}
            
            # Separar novos de existentes (Smart Match)
            novos_imoveis = [i for i in lote_imoveis if i["imovel_caixa_numero"] not in existentes]
            ids_existentes = [existentes[i["imovel_caixa_numero"]] for i in lote_imoveis if i["imovel_caixa_numero"] in existentes]

            count_novos += len(novos_imoveis)
            count_conformes += len(ids_existentes)

            # Inserir novos (completo)
            if novos_imoveis:
                supabase.table("imoveis").insert(novos_imoveis).execute()
            
            # Atualizar existentes (Regra Smart Match: mantém dados básicos, reseta etapa se < 2)
            if ids_existentes:
                supabase.rpc("reset_etapa_if_needed", {"target_ids": ids_existentes}).execute()
            
            # Recarregar IDs para o financeiro
            res_all = supabase.table("imoveis").select("imoveis_id, imovel_caixa_numero").in_("imovel_caixa_numero", lista_numeros).execute()
            numero_to_id = {int(p["imovel_caixa_numero"]): p["imoveis_id"] for p in res_all.data}

            # Financeiro (Prevenção de duplicatas idênticas no mesmo processamento/hora)
            lote_atualizacoes = []
            
            # Consultar últimos registros de atualização para evitar duplicidade em curto prazo
            res_hist = supabase.table("atualizacoes_imovel").select("imovel_id, created_at")\
                .in_("imovel_id", list(numero_to_id.values()))\
                .order("created_at", desc=True).execute()
            
            # Mapa do último 'created_at' por imóvel
            ultimas_atualizacoes = {}
            for h in res_hist.data:
                if h["imovel_id"] not in ultimas_atualizacoes:
                    ultimas_atualizacoes[h["imovel_id"]] = h["created_at"]

            agora_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

            for row in lote_financeiro_raw:
                num = int(row.get('imovel_caixa_numero', 0))
                imoveis_id = numero_to_id.get(num)
                if not imoveis_id: continue
                
                # Regra: Se já houve uma atualização nas últimas 2 horas, não insere novamente para o mesmo batch
                ultima_data_str = ultimas_atualizacoes.get(imoveis_id)
                if ultima_data_str:
                    try:
                        ultima_dt = datetime.datetime.fromisoformat(ultima_data_str.replace("Z", "+00:00"))
                        agora_dt = datetime.datetime.now(datetime.timezone.utc)
                        delta = agora_dt - ultima_dt
                        if delta.total_seconds() < 7200: # 2 horas de janela para o mesmo batch
                            continue
                    except: pass

                data_criacao = row.get('imovel_caixa_data_criacao')
                if pd.isna(data_criacao): 
                    data_criacao = agora_iso
                else: 
                    # Forçar formato ISO para evitar erro de fuso no frontend
                    try:
                        dt_obj = pd.to_datetime(data_criacao)
                        data_criacao = dt_obj.strftime('%Y-%m-%d 12:00:00+00') # Meio-dia UTC para não pular dia no BR
                    except:
                        data_criacao = str(data_criacao)
                
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

    # 2. Lógica de Limpeza (Sold Properties / Fora de Venda - 120 dias)
    if ufs_processadas_set:
        print(f"\n🧹 Iniciando verificação de limpeza (Fora de Venda) para UF(s): {ufs_processadas_set}")
        try:
            # Pegamos todos os imóveis no banco desta UF para ver o que sumiu da lista
            res_off = supabase.table("imoveis").select("imoveis_id, imovel_caixa_numero, updated_at")\
                .in_("imovel_caixa_endereco_uf", list(ufs_processadas_set))\
                .execute()
            
            ids_para_deletar = []
            
            for item in res_off.data:
                num_db = int(item["imovel_caixa_numero"])
                if num_db not in numeros_processados_set:
                    count_fora_da_lista += 1
                    
                    # Regra dos 120 dias para deleção automática
                    dt_upd = datetime.datetime.fromisoformat(item["updated_at"].replace("Z", "+00:00"))
                    agora = datetime.datetime.now(datetime.timezone.utc)
                    if (agora - dt_upd).days > 120:
                        ids_para_deletar.append(item["imoveis_id"])
                        count_removidos_120_dias += 1
            
            if ids_para_deletar:
                print(f"🗑️ Removendo {len(ids_para_deletar)} imóveis vendidos/vencidos (> 120 dias)...")
                supabase.table("imoveis").delete().in_("imoveis_id", ids_para_deletar).execute()
            else:
                print("✨ Nenhum imóvel elegível para exclusão imediata por tempo (limite 120 dias).")

        except Exception as e:
            print(f"⚠️ Erro no processo de limpeza: {e}")

    # Resumo Final Detalhado
    print("\n" + "="*50)
    print("📊 RESUMO DE EXECUÇÃO - ETAPA 1 (Smart Match)")
    print("="*50)
    print(f"✅ Novos Cadastrados:      {count_novos}")
    print(f"🤝 Conformes (em banco):    {count_conformes}")
    print(f"🏷️  Fora de Venda (Lista):   {count_fora_da_lista}")
    print(f"🗑️  Auto-Removidos (120d):  {count_removidos_120_dias}")
    print("-" * 50)
    print(f"📈 Total Processado:        {sucessos}")
    print(f"❌ Falhas no Lote:          {erros}")
    print("="*50)
    print("Step 1/7: OK")

if __name__ == "__main__":
    main()
