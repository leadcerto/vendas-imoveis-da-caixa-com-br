import sys
import os
from dotenv import load_dotenv
from supabase import create_client, Client

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
env_path = os.path.join(ROOT_DIR, "web", ".env")
load_dotenv(env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ ERRO: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontrados no .env")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def wipe_tables():
    print("⚠️ ATENÇÃO: Iniciando limpeza TOTAIS do banco de dados (Apenas Tabelas do Ingest)...")
    try:
        # A ordem importa para foreign keys, mas se cascade estiver on no supabase as deletes de parent limpam child.
        # Vamos deletar da imoveis primeiro
        res = supabase.table("imoveis").delete().neq("imoveis_id", -1).execute() # delete all
        print(f"✅ Limpos registros da tabela 'imoveis'.")
        
        # as demais que dependam (atualizacoes_imovel)
        res = supabase.table("atualizacoes_imovel").delete().neq("id", -1).execute()
        print(f"✅ Limpos registros da tabela 'atualizacoes_imovel'.")
        
        # Tabela ceps_imovel
        res = supabase.table("ceps_imovel").delete().neq("id", -1).execute()
        print(f"✅ Limpos registros da tabela 'ceps_imovel'.")
        
        print("🎉 Limpeza concluída! O seu Dashboard agora deve figurar ZERADO!")
        
    except Exception as e:
        print(f"❌ Erro ao limpar tabelas: {e}")

if __name__ == "__main__":
    wipe_tables()
