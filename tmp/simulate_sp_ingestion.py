import pandas as pd
import sys
import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
import unicodedata

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def normalize_text(text):
    if not text: return ""
    return "".join(c for c in unicodedata.normalize('NFD', str(text).strip().upper())
                  if unicodedata.category(c) != 'Mn')

class LocationResolver:
    def __init__(self, supabase_client):
        self.sb = supabase_client
        self.estados = {}
        self.cidades = {}
        self._load_master_data()

    def _load_master_data(self):
        res_uf = self.sb.table("estados").select("id, sigla").execute()
        self.estados = {normalize_text(r['sigla']): r['id'] for r in res_uf.data}
        # Only load a few cities for SP to test
        res_cit = self.sb.table("cidades").select("id, id_uf, nome").eq("id_uf", 25).limit(10).execute()
        for r in res_cit.data:
            self.cidades[(r['id_uf'], normalize_text(r['nome']))] = r['id']

    def resolve(self, uf_sigla, cidade_nome):
        uf_id = self.estados.get(normalize_text(uf_sigla))
        cidade_id = self.cidades.get((uf_id, normalize_text(cidade_nome))) if uf_id else None
        return uf_id, cidade_id

resolver = LocationResolver(supabase)
file_path = r"c:\Users\PICHAU\Desktop\antigravity\venda-imoveis-caixa\automation\csv-caixa\remote_1774490274493_Lista_imoveis_SP.csv"

# Find header
header_idx = 0
with open(file_path, 'r', encoding='latin1') as f:
    for i, line in enumerate(f):
        if i > 150: break
        clean_line = line.strip().lower()
        if len([k for k in ["imóvel", "cidade", "bairro", "desconto"] if k in clean_line]) >= 3:
            header_idx = i
            break

df = pd.read_csv(file_path, sep=';', encoding='latin1', skiprows=header_idx, on_bad_lines='skip')
df.columns = [str(c).strip() for c in df.columns]

print(f"COLUMNS: {df.columns.tolist()}")
c_numero = [c for c in df.columns if 'imóvel' in c.lower() or 'numero' in c.lower()][0]
c_uf = [c for c in df.columns if 'UF' == c.strip()][0]
c_cidade = [c for c in df.columns if 'Cidade' == c.strip()][0]

for i, row in df.head(10).iterrows():
    num_raw = row.get(c_numero)
    uf_raw = row.get(c_uf)
    cidade_raw = row.get(c_cidade)
    
    # Simulate processing logic
    try:
        s_num = str(num_raw).replace(',', '.').strip()
        num_val = pd.to_numeric(s_num, errors='coerce')
        numero = int(num_val)
    except:
        numero = "ERR"
        
    id_uf, id_cidade = resolver.resolve(uf_raw, cidade_raw)
    print(f"Row {i}: Numero={numero}, UF_CSV='{uf_raw}', Resolved_UF_ID={id_uf}, Cidade='{cidade_raw}', Resolved_Cidade_ID={id_cidade}")
