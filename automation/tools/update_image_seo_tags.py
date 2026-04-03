import sys
import os
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
    print("⚙️ Iniciando Re-Tagging de Imagens (Nova Regra SEO)...")
    
    BATCH_SIZE = 500
    total_processados = 0
    
    while True:
        # Buscar imóveis
        # Usamos uma estratégia de busca por lotes baseada em IDs ou apenas limit/offset
        # Mas para garantir que pegamos todos, podemos ir pegando os que ainda não foram processados 
        # ou apenas iterar por todos.
        resp = supabase.table("imoveis").select(
            "imoveis_id, imovel_caixa_endereco_uf, imovel_caixa_endereco_cidade, imovel_caixa_endereco_bairro, imovel_caixa_descricao_tipo"
        ).range(total_processados, total_processados + BATCH_SIZE - 1).execute()
        
        imoveis = resp.data
        if not imoveis: break
            
        lote_update = []
        
        for imv in imoveis:
            iid = imv["imoveis_id"]
            uf = imv.get("imovel_caixa_endereco_uf") or ""
            cid = imv.get("imovel_caixa_endereco_cidade") or ""
            bai = imv.get("imovel_caixa_endereco_bairro") or ""
            tip = imv.get("imovel_caixa_descricao_tipo") or "Imóvel"
            
            # Formatar Tipo: Maiúscula inicial
            tipo_fmt = str(tip).capitalize()
            
            # Nova Regra: Fachada de [tipo] à venda em [bairro], [cidade] [uf]
            tag_seo = f"Fachada de {tipo_fmt} à venda em {bai}, {cid} {uf}"
            
            lote_update.append({
                "imoveis_id": iid,
                "imovel_caixa_post_imagem_destaque_tag_alt": tag_seo,
                "imovel_caixa_post_imagem_destaque_tag_title": tag_seo,
                "imovel_caixa_link_imagem_tag_alt": tag_seo,
                "imovel_caixa_link_imagem_tag_title": tag_seo
            })
            
        if lote_update:
            supabase.table("imoveis").upsert(lote_update).execute()
            
        total_processados += len(imoveis)
        print(f"   ✅ {total_processados} imóveis atualizados...")
        
    print(f"🚀 CONCLUÍDO! Total de {total_processados} imóveis atualizados com a nova regra de SEO.")

if __name__ == "__main__":
    main()
