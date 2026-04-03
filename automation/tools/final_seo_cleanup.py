import os
import time
import re
import unicodedata
from dotenv import load_dotenv
from supabase import create_client

# Carrega variáveis de ambiente
load_dotenv('web/.env')
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

# Cliente Supabase
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def normalize_slug(text):
    if not text: return ""
    n = "".join(c for c in unicodedata.normalize('NFD', str(text).strip().lower())
                if unicodedata.category(c) != 'Mn')
    n = n.replace(" ", "-").replace("_", "-")
    n = re.sub(r'[^a-z0-9-]', '', n)
    n = re.sub(r'-+', '-', n).strip('-')
    return n

def format_currency(value):
    try:
        return f"R$ {float(value):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except:
        return "R$ 0,00"

def final_cleanup():
    print("Iniciando limpeza final (Tags + Caminhos de Imagem)...")
    
    offset = 0
    batch_size = 500
    total_updated = 0

    while True:
        print(f"Processando lote {offset}...")
        response = supabase.table("properties").select(
            "id, numero_imovel, tipo_nome, bairro_nome, cidade_nome, uf_sigla, valor_avaliacao, preco"
        ).range(offset, offset + batch_size - 1).execute()

        if not response.data:
            break

        batch_updates = []
        for p in response.data:
            iid = p['id']
            num = p['numero_imovel']
            tip = str(p.get('tipo_nome') or 'Imóvel').replace('None', 'Imóvel')
            bai = str(p.get('bairro_nome') or '').replace('None', '')
            cid = str(p.get('cidade_nome') or '').replace('None', '')
            uf = str(p.get('uf_sigla') or '').replace('None', '')
            
            val = float(p.get('valor_avaliacao', 0) or 0)
            pre = float(p.get('preco', 0) or 0)
            desconto = max(0.0, val - pre)
            desconto_fmt = format_currency(desconto)

            # Recalcula slug para o caminho da imagem se necessário
            t_s = normalize_slug(tip)
            b_s = normalize_slug(bai)
            c_s = normalize_slug(cid)
            u_s = normalize_slug(uf)
            slug = f"{t_s}-{b_s}-{c_s}-{u_s}-{num}"
            
            # Novo padrão de tags
            tag_alt = f"{tip} em {bai}, {cid} - {uf}"
            tag_title = f"{tip} com Desconto de {desconto_fmt}"
            img_destaque = f"https://venda.imoveisdacaixa.com.br/imagens/imagem-destaque/{slug}.jpg"

            batch_updates.append({
                "imoveis_id": iid,
                "imovel_caixa_post_imagem_destaque": img_destaque,
                "imovel_caixa_post_imagem_destaque_tag_alt": tag_alt,
                "imovel_caixa_post_imagem_destaque_tag_title": tag_title
            })

        if batch_updates:
            supabase.table("imoveis").upsert(batch_updates).execute()
            total_updated += len(batch_updates)
            print(f"Atualizados {total_updated} imóveis...")

        if len(response.data) < batch_size:
            break
            
        offset += batch_size
        time.sleep(0.5)

    print(f"Limpeza final concluída! Total: {total_updated} imóveis sincronizados.")

if __name__ == "__main__":
    final_cleanup()
