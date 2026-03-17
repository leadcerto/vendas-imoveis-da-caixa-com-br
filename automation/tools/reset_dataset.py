import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print("Resetando as flags wp_publicado para False e os wp_post_id para NULL na Supabase...")

# A library python supabase client only supports update filtering by some condition. 
# We update where wp_publicado is True.
response = supabase.table("imoveis_caixa").update({
    "wp_publicado": False,
    "wp_post_id": None,
    "wp_post_url": None
}).eq("wp_publicado", True).execute()

print(f"Limpeza de flags de publicacao terminada. {len(response.data)} registros resetados.")
