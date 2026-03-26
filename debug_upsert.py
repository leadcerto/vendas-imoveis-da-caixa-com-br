import os
from dotenv import load_dotenv
from supabase import create_client, Client
import datetime

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Mock com colunas REAIS encontradas no information_schema
dummy_property = {
    "imovel_caixa_numero": 9991112223334,
    "id_uf_imovel_caixa": 8,
    "imovel_caixa_endereco_csv": "TEST ADDRESS",
    "imovel_caixa_modalidade": "Venda Online",
    "updated_at": datetime.datetime.now().isoformat(),
    "requer_revisao_localizacao": False
}

print(f"Tentando Upsert no imóvel {dummy_property['imovel_caixa_numero']}...")
try:
    res = supabase.table("imoveis").upsert(dummy_property, on_conflict="imovel_caixa_numero").execute()
    print("Sucesso!")
    print(res.data)
except Exception as e:
    print(f"FALHA NO UPSERT: {e}")
