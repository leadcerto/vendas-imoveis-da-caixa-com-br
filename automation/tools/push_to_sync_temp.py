import os
import pandas as pd
import glob
import unicodedata
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
CSV_DIR = r'c:\Users\PICHAU\Desktop\antigravity\venda-imoveis-caixa\automation\csv-caixa'

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def normalize_text(text):
    if not text: return ""
    return "".join(c for c in unicodedata.normalize('NFD', str(text).strip().upper())
                  if unicodedata.category(c) != 'Mn')

def main():
    csv_files = glob.glob(os.path.join(CSV_DIR, "*.csv"))
    data = []

    for f_path in csv_files:
        header_idx = 0
        with open(f_path, 'r', encoding='latin1') as f:
            for i, line in enumerate(f):
                if "UF;Cidade;Bairro" in line:
                    header_idx = i
                    break
        try:
            df = pd.read_csv(f_path, sep=';', encoding='latin1', skiprows=header_idx, on_bad_lines='skip')
            df.columns = [str(c).strip() for c in df.columns]
        except: continue

        c_numero = 'N° do imóvel' if 'N° do imóvel' in df.columns else 'Nº do imóvel'
        for _, row in df.iterrows():
            uf = normalize_text(row.get('UF', ''))
            cidade = normalize_text(row.get('Cidade', ''))
            bairro = normalize_text(row.get('Bairro', ''))
            num_raw = row.get(c_numero)
            try:
                numero = int(str(num_raw).strip().split('.')[0])
            except: continue
            if uf and cidade and bairro:
                # Use real capitalization for bairro
                raw_bairro = str(row.get('Bairro')).strip().upper()
                data.append({
                    "imovel_numero": numero,
                    "uf": uf,
                    "cidade": cidade,
                    "bairro": raw_bairro
                })

    print(f"[INFO] Inserindo {len(data)} linhas em csv_sync_temp...")
    batch_size = 500
    for i in range(0, len(data), batch_size):
        batch = data[i:i+batch_size]
        supabase.table("csv_sync_temp").insert(batch).execute()
        if (i // batch_size) % 10 == 0:
            print(f"  {i} linhas inseridas...")

    print("[FIM] Inserção concluída.")

if __name__ == "__main__":
    main()
