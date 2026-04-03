import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv('web/.env')
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_KEY')
s = create_client(url, key)

r = s.table('imoveis').select('*').limit(1).execute()
if r.data:
    cols = sorted(list(r.data[0].keys()))
    print(f"Total de colunas: {len(cols)}")
    for c in cols:
        print(f"COL: {c}")
else:
    print("Nenhum dado encontrado.")
