import os
import time
from dotenv import load_dotenv
from supabase import create_client

# Carrega variáveis de ambiente
load_dotenv('web/.env')
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

# Cliente Supabase
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def format_currency(value):
    try:
        return f"R$ {float(value):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except:
        return "R$ 0,00"

def refresh_tags():
    print("Iniciando atualização das tags de SEO de imagem...")
    
    # Busca todos os imóveis (usando range para paginação se necessário)
    # Mas aqui vamos usar a view 'properties' que já traz os nomes certinhos
    
    offset = 0
    batch_size = 500
    total_updated = 0

    while True:
        print(f"Buscando lote {offset}...")
        response = supabase.table("properties").select(
            "id, tipo_nome, bairro_nome, cidade_nome, uf_sigla, valor_avaliacao, preco"
        ).range(offset, offset + batch_size - 1).execute()

        if not response.data:
            break

        updates = []
        for p in response.data:
            iid = p['id']
            tip = str(p.get('tipo_nome') or 'Imóvel').replace('None', 'Imóvel')
            bai = str(p.get('bairro_nome') or '').replace('None', '')
            cid = str(p.get('cidade_nome') or '').replace('None', '')
            uf = str(p.get('uf_sigla') or '').replace('None', '')
            
            val = float(p.get('valor_avaliacao', 0) or 0)
            pre = float(p.get('preco', 0) or 0)
            desconto = max(0.0, val - pre)
            desconto_status = format_currency(desconto)

            tag_alt = f"{tip} em {bai}, {cid} - {uf}"
            tag_title = f"{tip} com Desconto de {desconto_status}"

            updates.append({
                "imoveis_id": iid,
                "imovel_caixa_post_imagem_destaque_tag_alt": tag_alt,
                "imovel_caixa_post_imagem_destaque_tag_title": tag_title
            })

        if updates:
            # Upsert (update) em lote
            supabase.table("imoveis").upsert(updates).execute()
            total_updated += len(updates)
            print(f"Atualizados {total_updated} imóveis...")

        if len(response.data) < batch_size:
            break
            
        offset += batch_size
        time.sleep(0.5)

    print(f"Sucesso! Total de {total_updated} imóveis atualizados.")

if __name__ == "__main__":
    refresh_tags()
