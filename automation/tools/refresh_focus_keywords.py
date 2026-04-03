import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

# Carregar variáveis de ambiente
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
env_path = os.path.join(ROOT_DIR, "web", ".env")
load_dotenv(env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ ERRO: SUPABASE_URL ou SUPABASE_KEY não encontrados.")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def main():
    print("🚀 Iniciando atualização em massa da Palavra-Chave (Focus Keyword)...")
    print("Regra: [Tipo] [Bairro] [Cidade] [UF]")
    
    BATCH_SIZE = 500
    total_processed = 0
    page = 0
    
    while True:
        # Pega do banco de 500 em 500 iterando páginas
        resp_imoveis = supabase.table("imoveis").select(
            "imoveis_id, imovel_caixa_endereco_uf, imovel_caixa_endereco_cidade, imovel_caixa_endereco_bairro, imovel_caixa_descricao_tipo"
        ).order("imoveis_id")\
         .range(page * BATCH_SIZE, ((page + 1) * BATCH_SIZE) - 1)\
         .execute()
        
        imoveis = resp_imoveis.data
        if not imoveis:
            break
            
        lote_update = []
        for imv in imoveis:
            iid = imv["imoveis_id"]
            uf = imv.get("imovel_caixa_endereco_uf","")
            cid = imv.get("imovel_caixa_endereco_cidade","")
            bai = imv.get("imovel_caixa_endereco_bairro","")
            tip = imv.get("imovel_caixa_descricao_tipo","")
            
            # Nova Regra: [Tipo] [Bairro] [Cidade] [UF]
            palavra_chave = f"{tip} {bai} {cid} {uf}".strip()
            
            lote_update.append({
                "imoveis_id": iid,
                "imovel_caixa_post_palavra_chave": palavra_chave
            })

        # Executar Upsert do lote
        if lote_update:
            supabase.table("imoveis").upsert(lote_update).execute()
        
        total_processed += len(imoveis)
        print(f"⏳ Processados {total_processed} imóveis...")
        page += 1

    print(f"✅ Atualização finalizada! Total: {total_processed}")

if __name__ == "__main__":
    main()
