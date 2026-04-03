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

# Import the new generation functions directly from etapa2
from etapa2_seo_grupos import generate_slug, get_hashtags, normalize_text
import random

def main():
    print("Iniciando correção de SEO para imóveis existentes...")
    
    BATCH_SIZE = 500
    total_processed = 0
    page = 0
    
    while True:
        # Pega do banco de 500 em 500 iterando páginas
        resp_imoveis = supabase.table("imoveis").select(
            "imoveis_id, imovel_caixa_numero, imovel_caixa_endereco_uf, imovel_caixa_endereco_cidade, imovel_caixa_endereco_bairro, imovel_caixa_descricao_tipo"
        ).order("imoveis_id")\
         .range(page * BATCH_SIZE, ((page + 1) * BATCH_SIZE) - 1)\
         .execute()
        
        imoveis = resp_imoveis.data
        if not imoveis:
            break
            
        imoveis_ids = [imv["imoveis_id"] for imv in imoveis]
        
        # BUSCA FINANCEIRA EM LOTE
        resp_finan = supabase.table("atualizacoes_imovel").select(
            "id, imovel_id, imovel_caixa_valor_venda, imovel_caixa_valor_avaliacao"
        ).in_("imovel_id", imoveis_ids).execute()
        
        finan_map = {}
        for f in resp_finan.data:
            # Mantém a mais atualizada (ou única)
            finan_map[f["imovel_id"]] = f
            
        lote_imoveis_update = []
        for imv in imoveis:
            iid = imv["imoveis_id"]
            num = imv["imovel_caixa_numero"]
            uf = imv.get("imovel_caixa_endereco_uf","")
            cid = imv.get("imovel_caixa_endereco_cidade","")
            bai = imv.get("imovel_caixa_endereco_bairro","")
            tip = imv.get("imovel_caixa_descricao_tipo","")
            
            f_data = finan_map.get(iid)
            val_venda = float(f_data.get("imovel_caixa_valor_venda", 0)) if f_data else 0.0
            val_aval = float(f_data.get("imovel_caixa_valor_avaliacao", 0)) if f_data else 0.0
            
            val_desconto = max(0.0, val_aval - val_venda)
            desconto_moeda = f"R$ {val_desconto:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            
            slug = generate_slug(uf, cid, bai, tip, num)
            
            # Application of user's EXACT format rules
            titulo_exato = f"{slug} - Imóveis da CAIXA \U0001f9e1\U0001f499"
            descricao_exata = f"{slug}. Imóvel com desconto de {desconto_moeda}. \u26a0\ufe0f Estamos Online!"
            palavra_chave_exata = f"{tip} {bai} {cid} {uf}"
            imagem_destaque_exata = f"https://venda.imoveisdacaixa.com.br/imagens/imagem-destaque/{slug}.jpg"
            hashtags = get_hashtags(uf, cid, bai, tip)

            tag_alt = f"{tip} em {bai}, {cid} - {uf}"
            tag_title = f"{tip} com Desconto de {desconto_moeda}"

            lote_imoveis_update.append({
                "imoveis_id": iid,
                "imovel_caixa_post_link_permanente": slug,
                "imovel_caixa_post_titulo": titulo_exato,
                "imovel_caixa_post_descricao": descricao_exata,
                "imovel_caixa_post_palavra_chave": palavra_chave_exata,
                "imovel_caixa_post_imagem_destaque_tag_alt": tag_alt,
                "imovel_caixa_post_imagem_destaque_tag_title": tag_title,
                "imovel_caixa_post_hashtags": hashtags,
                "imovel_caixa_post_imagem_destaque": imagem_destaque_exata
            })

        # Executar Upsert do lote
        if lote_imoveis_update:
            supabase.table("imoveis").upsert(lote_imoveis_update).execute()
        
        total_processed += len(imoveis)
        print(f"⏳ Processados {total_processed} imóveis...")
        page += 1

    print(f"✅ Correção em massa finalizada! Total atualizado: {total_processed}")

if __name__ == "__main__":
    main()
