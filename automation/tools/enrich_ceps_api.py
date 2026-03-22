import os
import requests
import time
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def enrich_ceps():
    # 1. Busca CEPs pendentes
    res = supabase.table("ceps_imovel").select("id, cep_numerico").eq("cep_status", "pendente").limit(50).execute()
    
    if not res.data:
        print("[INFO] Nenhum CEP pendente encontrado.")
        return

    print(f"[INFO] Processando {len(res.data)} CEPs...")

    for item in res.data:
        cep = item['cep_numerico']
        print(f"  -> Consultando {cep}...")
        
        try:
            # BrasilAPI handles many formats and has good Lat/Long coverage via other providers
            response = requests.get(f"https://brasilapi.com.br/api/cep/v2/{cep}")
            
            if response.status_code == 200:
                data = response.json()
                
                update_data = {
                    "cep_logradouro_nome": data.get("street"),
                    "cep_bairro": data.get("neighborhood"),
                    "cep_cidade": data.get("city"),
                    "cep_estado_sigla": data.get("state"),
                    "cep_status": "pesquisado"
                }
                
                # Lat/Long usually in 'location.coordinates'
                if "location" in data and "coordinates" in data["location"]:
                    update_data["cep_longitude"] = data["location"]["coordinates"].get("longitude")
                    update_data["cep_latitude"] = data["location"]["coordinates"].get("latitude")

                supabase.table("ceps_imovel").update(update_data).eq("id", item['id']).execute()
                print(f"    [OK] Atualizado: {data.get('city')} - {data.get('neighborhood')}")
            else:
                print(f"    [AVISO] API retornou status {response.status_code}")
                # Marca como erro para evitar loop infinito se for CEP inválido
                supabase.table("ceps_imovel").update({"cep_status": "erro"}).eq("id", item['id']).execute()
        
        except Exception as e:
            print(f"    [ERRO] Falha ao processar {cep}: {e}")
        
        # Rate limit friendly
        time.sleep(0.5)

if __name__ == "__main__":
    enrich_ceps()
