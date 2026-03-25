import os
import sys
import requests
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client, Client
from pathlib import Path

# Carrega variáveis de ambiente
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Importa o ingest_csv do script original
sys.path.insert(0, str(Path(__file__).parent))
from ingest_caixa_csv import ingest_csv

def process_pending_uploads():
    print(f"[{datetime.now()}] Verificando novos uploads no Supabase Storage...")
    
    # 1. Busca logs recentes (últimas 2 horas) que ainda não foram processados (total_lidos = 0)
    # E que tenham o storage_path nos motivos_rejeicao
    res = supabase.table("logs_ingestao").select("*").eq("total_lidos", 0).order("executado_em", desc=True).limit(10).execute()
    
    if not res.data:
        print("Nenhum upload pendente encontrado.")
        return

    for log in res.data:
        motivos = log.get("motivos_rejeicao", {})
        storage_path = motivos.get("storage_path")
        
        if not storage_path:
            continue
            
        print(f"\n--- Iniciando processamento de: {log['arquivo_csv']} ---")
        
        # 2. Download do arquivo do Storage
        local_path = os.path.join(Path(__file__).parent.parent, "csv-caixa", f"remote_{storage_path}")
        
        try:
            with open(local_path, 'wb+') as f:
                res_storage = supabase.storage.from_('csv-caixa').download(storage_path)
                f.write(res_storage)
            
            print(f"[INFO] Arquivo baixado para: {local_path}")
            
            # 3. Executa a ingestão
            filename, aceitos = ingest_csv(local_path)
            
            # 4. Atualiza o log com os resultados reais
            # (O ingest_csv original não retorna o total de lidos/rejeitados separadamente, 
            # mas podemos inferir ou adaptar se necessário. Por agora, marcamos como concluído)
            
            supabase.table("logs_ingestao").update({
                "total_aceitos": aceitos,
                "total_rejeitados": 0, # Simplificado
                "motivos_rejeicao": {
                    **motivos,
                    "status": "Concluído",
                    "processed_at": datetime.now().isoformat()
                }
            }).eq("id", log["id"]).execute()
            
            print(f"[SUCESSO] Log {log['id']} atualizado. {aceitos} imóveis processados.")
            
        except Exception as e:
            print(f"[ERRO] Falha ao processar log {log['id']}: {e}")
            supabase.table("logs_ingestao").update({
                "motivos_rejeicao": {
                    **motivos,
                    "status": "Erro",
                    "error": str(e)
                }
            }).eq("id", log["id"]).execute()

if __name__ == "__main__":
    process_pending_uploads()
