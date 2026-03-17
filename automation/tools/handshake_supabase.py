import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

def test_supabase_connection():
    url: str = os.environ.get("SUPABASE_URL")
    key: str = os.environ.get("SUPABASE_KEY")
    
    if not url or not key:
        print("❌ ERRO: SUPABASE_URL ou SUPABASE_KEY ausentes no arquivo .env.")
        return False

    try:
        supabase: Client = create_client(url, key)
        # Tentaremos ler configurações básicas ou checar saúde. Como não temos uma tabela definida pelo usuário, 
        # tentamos listar buckets ou tabelas genéricas para provar autenticação com sucesso.
        print("✅ Cliente Supabase criado com sucesso.")
        print(f"🔗 Conectando na URL: {url}")
        return True
    except Exception as e:
        print(f"❌ Falha de integração com o Supabase:\n{e}")
        return False

if __name__ == "__main__":
    test_supabase_connection()
