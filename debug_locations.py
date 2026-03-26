import os
from dotenv import load_dotenv
from supabase import create_client, Client
import pandas as pd
import unicodedata

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def normalize_text(text):
    if not text: return ""
    return "".join(c for c in unicodedata.normalize('NFD', str(text).strip().upper())
                  if unicodedata.category(c) != 'Mn')

# Simular LocationResolver
print("Carregando estados...")
res = supabase.table("estados").select("id, sigla").execute()
estados = {normalize_text(r['sigla']): r['id'] for r in res.data}
print(f"Mapeamento Estados: {estados}")

csv_path = "c:/Users/PICHAU/Desktop/antigravity/venda-imoveis-caixa/automation/csv-caixa/remote_1774487063596_Lista_imoveis_ES.csv"
df = pd.read_csv(csv_path, sep=';', encoding='latin1', on_bad_lines='skip')
c_uf = 'UF'

for val in df[c_uf].head(5):
    norm = normalize_text(val)
    uf_id = estados.get(norm)
    print(f"UF Raw: {val} -> Norm: {norm} -> ID: {uf_id}")
