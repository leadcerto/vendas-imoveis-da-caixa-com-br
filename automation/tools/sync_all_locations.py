import os
import pandas as pd
import glob
import unicodedata
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client
from pathlib import Path

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
CSV_DIR = r'c:\Users\PICHAU\Desktop\antigravity\venda-imoveis-caixa\automation\csv-caixa'

if not SUPABASE_URL or not SUPABASE_KEY:
    print("[ERRO] SUPABASE_URL ou SUPABASE_KEY não encontrados no .env")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def normalize_text(text):
    if not text: return ""
    return "".join(c for c in unicodedata.normalize('NFD', str(text).strip().upper())
                  if unicodedata.category(c) != 'Mn')

def get_all_bairros():
    all_bairros = []
    page = 0
    while True:
        res = supabase.table("bairros").select("id, id_cidade, nome").range(page*1000, (page+1)*1000 - 1).execute()
        if not res.data: break
        all_bairros.extend(res.data)
        page += 1
    return {(r['id_cidade'], normalize_text(r['nome'])): r['id'] for r in all_bairros}

def main():
    # 1. Load Master Tables
    print("[INFO] Carregando Estados e Cidades...")
    res_uf = supabase.table("estados").select("id, sigla").execute()
    estados_map = {normalize_text(r['sigla']): r['id'] for r in res_uf.data}
    
    res_cid = supabase.table("cidades").select("id, id_uf, nome").execute()
    cidades_map = {(r['id_uf'], normalize_text(r['nome'])): r['id'] for r in res_cid.data}
    
    bairros_map = get_all_bairros()
    print(f"[INFO] Inicialmente: {len(bairros_map)} bairros carregados.")

    # 2. First Pass: Collect Missing Bairros
    csv_files = glob.glob(os.path.join(CSV_DIR, "*.csv"))
    to_insert_bairros = []
    seen_in_pass = set()

    print("[INFO] Analisando CSVs para detectar bairros ausentes...")
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

        for _, row in df.iterrows():
            uf = normalize_text(row.get('UF', ''))
            cidade = normalize_text(row.get('Cidade', ''))
            bairro = normalize_text(row.get('Bairro', ''))
            
            if not uf or not cidade or not bairro: continue
            
            uf_id = estados_map.get(uf)
            if not uf_id: continue
            
            cid_id = cidades_map.get((uf_id, cidade))
            if not cid_id: continue
            
            if (cid_id, bairro) not in bairros_map and (cid_id, bairro) not in seen_in_pass:
                # Proper capitalization for names
                clean_bairro = str(row.get('Bairro')).strip().upper()
                to_insert_bairros.append({"id_cidade": cid_id, "nome": clean_bairro})
                seen_in_pass.add((cid_id, bairro))

    if to_insert_bairros:
        print(f"[INFO] Inserindo {len(to_insert_bairros)} novos bairros...")
        for i in range(0, len(to_insert_bairros), 100):
            batch = to_insert_bairros[i:i+100]
            supabase.table("bairros").upsert(batch, on_conflict="id_cidade, nome").execute()
        
        # Reload bairros map
        bairros_map = get_all_bairros()
        print(f"[INFO] Agora com {len(bairros_map)} bairros.")

    # 3. Second Pass: Link Properties
    print("[INFO] Vinculando imóveis aos bairros...")
    property_updates = []
    seen_properties = set()

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
            num_raw = row.get(c_numero)
            if pd.isna(num_raw): continue
            try:
                numero = int(str(num_raw).strip().split('.')[0])
            except: continue
            
            if numero in seen_properties: continue
            
            uf = normalize_text(row.get('UF', ''))
            cidade = normalize_text(row.get('Cidade', ''))
            bairro = normalize_text(row.get('Bairro', ''))
            
            uf_id = estados_map.get(uf)
            cid_id = cidades_map.get((uf_id, cidade)) if uf_id else None
            
            if cid_id and bairro:
                b_id = bairros_map.get((cid_id, bairro))
                if b_id:
                    property_updates.append({
                        "imovel_caixa_numero": numero,
                        "id_bairro_imovel_caixa": b_id
                    })
                    seen_properties.add(numero)

    if property_updates:
        print(f"[INFO] Atualizando {len(property_updates)} imóveis...")
        count = 0
        for i in range(0, len(property_updates), 100):
            batch = property_updates[i:i+100]
            # Use upsert to match by unique imovel_caixa_numero and update id_bairro
            try:
                supabase.table("imoveis").upsert(batch, on_conflict="imovel_caixa_numero").execute()
                count += len(batch)
                if count % 500 == 0: print(f"  {count} atualizados...")
            except Exception as e:
                print(f"  [ERRO] Falha no batch {i}: {e}")

    print("[FIM] Sincronização concluída com sucesso!")

if __name__ == "__main__":
    main()
