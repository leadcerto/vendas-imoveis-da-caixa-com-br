import os
import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

file_path = r'c:\Users\PICHAU\Desktop\antigravity\venda-imoveis-caixa\supabase\estados cidades e bairros.xlsx'
xl = pd.ExcelFile(file_path)

def seed_estados():
    print("Seeding estados...")
    df = xl.parse('Estados')
    data = []
    for _, row in df.iterrows():
        data.append({"sigla": row['uf-sigla'], "nome": row['uf-nome']})
    
    supabase.table("estados").upsert(data, on_conflict="sigla").execute()
    print(f"Inserted {len(data)} estados.")

def seed_cidades():
    print("Seeding cidades...")
    df = xl.parse('Cidades')
    
    # Deduplicate in Excel first
    df['cidade-nome'] = df['cidade-nome'].str.strip()
    df = df.drop_duplicates(subset=['uf-sigla', 'cidade-nome'])
    
    # Get state IDs
    res = supabase.table("estados").select("id, sigla").execute()
    state_map = {r['sigla']: r['id'] for r in res.data}
    
    data = []
    for _, row in df.iterrows():
        uf = row['uf-sigla']
        if uf in state_map:
            data.append({"id_uf": state_map[uf], "nome": row['cidade-nome']})
    
    # Batch insert (500 per batch)
    batch_size = 500
    for i in range(0, len(data), batch_size):
        batch = data[i:i + batch_size]
        try:
            supabase.table("cidades").upsert(batch, on_conflict="id_uf,nome").execute()
            print(f"Inserted cities batch {i//batch_size + 1}")
        except Exception as e:
            print(f"Error in cities batch {i//batch_size + 1}: {e}")
            raise e

def seed_bairros():
    print("Seeding bairros...")
    df = xl.parse('Bairros')
    
    # Deduplicate in Excel first
    df['bairro-nome'] = df['bairro-nome'].str.strip()
    df['cidade-nome'] = df['cidade-nome'].str.strip()
    df = df.drop_duplicates(subset=['uf-sigla', 'cidade-nome', 'bairro-nome'])

    # Get city mapping
    print("Fetching cities for mapping...")
    res_states = supabase.table("estados").select("id, sigla").execute()
    state_map = {r['id']: r['sigla'] for r in res_states.data}
    
    all_cities = []
    page = 0
    page_size = 1000
    while True:
        res = supabase.table("cidades").select("id, id_uf, nome").range(page * page_size, (page + 1) * page_size - 1).execute()
        if not res.data:
            break
        all_cities.extend(res.data)
        page += 1
    
    city_map = {}
    for c in all_cities:
        uf_sigla = state_map[c['id_uf']]
        key = (uf_sigla, str(c['nome']).strip().upper())
        city_map[key] = c['id']
    
    data = []
    for _, row in df.iterrows():
        uf = str(row['uf-sigla']).strip()
        cidade = str(row['cidade-nome']).strip().upper()
        bairro = str(row['bairro-nome']).strip()
        
        key = (uf, cidade)
        if key in city_map:
            regiao = row.get('bairro-regiao-01')
            data.append({
                "id_cidade": city_map[key],
                "nome": bairro,
                "regiao": str(regiao) if pd.notna(regiao) else None
            })
    
    print(f"Total bairros to insert: {len(data)}")
    # Batch insert
    batch_size = 500
    for i in range(0, len(data), batch_size):
        batch = data[i:i + batch_size]
        try:
            supabase.table("bairros").upsert(batch, on_conflict="id_cidade,nome").execute()
            if i % 2500 == 0:
                print(f"Inserted bairros batch {i//batch_size + 1}")
        except Exception as e:
            print(f"Error in bairros batch {i//batch_size + 1}: {e}")
            raise e

if __name__ == "__main__":
    try:
        seed_estados()
        seed_cidades()
        seed_bairros()
        print("Seeding completed!")
    except Exception as e:
        print(f"Error during seeding: {e}")
        import traceback
        traceback.print_exc()
