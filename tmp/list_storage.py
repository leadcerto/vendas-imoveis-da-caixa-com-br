import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# List files in 'csv-caixa' bucket
res = supabase.storage.from_('csv-caixa').list(options={'limit': 100})
with open('tmp/storage_list.txt', 'w', encoding='utf-8') as f:
    f.write(f"{'Nome':<60} | {'Tamanho (KB)':<15}\n")
    f.write("-" * 80 + "\n")
    for file in res:
        size_kb = file['metadata'].get('size', 0) / 1024
        f.write(f"{file['name']:<60} | {size_kb:<15.2f}\n")
print("Lista salva em tmp/storage_list.txt")
