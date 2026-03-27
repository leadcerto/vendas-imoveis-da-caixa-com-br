import os
import time
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def format_currency(value):
    if value is None: return "R$ 0,00"
    return f"R$ {float(value):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

def refresh_seo():
    print("Buscando imóveis com SEO corrompido ('None')...")
    
    while True:
        # Busca usando a view properties para ter o tipo_nome já corrigido
        res = supabase.table("properties").select("*") \
            .ilike("post_titulo", "%None%") \
            .limit(100).execute()
        
        if not res.data:
            print("Nenhum registro com 'None' restante.")
            break
            
        print(f"Processando lote de {len(res.data)} registros...")
        for p in res.data:
            tipo = p.get("tipo_nome") or "Imóvel"
            bairro = p.get("bairro_nome") or ""
            cidade = p.get("cidade_nome") or ""
            uf = p.get("uf_sigla") or ""
            numero = p.get("numero_imovel") or ""
            desconto_moeda = format_currency(p.get("desconto_moeda"))
            
            # Templates Premium
            novo_titulo = f"🔴 {tipo} {bairro} {cidade} {uf} {numero} Imóvel CAIXA 🧡💙"
            nova_desc = f"Imóvel CAIXA {tipo} {bairro} {cidade} {uf} com deconto de {desconto_moeda}. ⚠ Estamos Online!"
            nova_keyword = f"{tipo} {bairro} {cidade} {uf}"
            
            try:
                supabase.table("imoveis").update({
                    "imovel_caixa_post_titulo": novo_titulo,
                    "imovel_caixa_post_descricao": nova_desc,
                    "imovel_caixa_post_palavra_chave": nova_keyword
                }).eq("imoveis_id", p["id"]).execute()
            except Exception as e:
                print(f"Erro ao atualizar {p['id']}: {e}")
                time.sleep(1)

        print("Pausa curta...")
        time.sleep(0.5)

if __name__ == "__main__":
    refresh_seo()
