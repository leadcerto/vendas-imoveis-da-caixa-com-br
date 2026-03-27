import os
import sys
import shutil
import unicodedata
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Carrega variáveis de ambiente
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

BATCH_SIZE = 100  # Reduzido para evitar timeout na view properties
# Caminhos
BASE_DIR = Path(__file__).parent.parent.parent
TEMPLATE_IMG = BASE_DIR / "imagens" / "imagem-destaque" / "ImagemDestaque.jpg"
PUBLIC_DEST_DIR = BASE_DIR / "web" / "public" / "imagens-destaque"
ROOT_DEST_DIR = BASE_DIR / "imagens" / "imagem-destaque"

if not PUBLIC_DEST_DIR.exists():
    PUBLIC_DEST_DIR.mkdir(parents=True, exist_ok=True)
if not ROOT_DEST_DIR.exists():
    ROOT_DEST_DIR.mkdir(parents=True, exist_ok=True)

# Cliente Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def normalize_seo(text):
    if not text: return ""
    return "".join(c for c in unicodedata.normalize('NFD', str(text).strip().upper())
                  if unicodedata.category(c) != 'Mn')

import re

def normalize_slug(text):
    if not text: return ""
    # Novo padrão: lowercase, sem acentos, espaços/especiais -> hífen
    n = "".join(c for c in unicodedata.normalize('NFD', str(text).strip().lower())
                if unicodedata.category(c) != 'Mn')
    n = n.replace(" ", "-").replace("_", "-")
    n = re.sub(r'[^a-z0-9-]', '', n)
    n = re.sub(r'-+', '-', n).strip('-')
    return n

def format_currency(value):
    return f"R$ {float(value):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

def process_imoveis():
    import time
    print("Buscando imóveis para migração SEO...")
    
    page_size = 100
    offset = 0
    
    while True:
        try:
            # Busca um lote de imóveis usando a view 'properties'
            response = supabase.table("properties").select(
                "id, numero_imovel, tipo_nome, bairro_nome, cidade_nome, uf_sigla, valor_avaliacao, preco"
            ).range(offset, offset + page_size - 1).execute()
            
            if not response.data:
                print("Migração concluída com sucesso!")
                break
                
            print(f"Processando lote: {offset} a {offset + len(response.data)}...")
            
            for p in response.data:
                try:
                    id_imovel = p['id']
                    numero = p['numero_imovel']
                    tipo = str(p.get('tipo_nome') or 'Imóvel').replace('None', 'Imóvel')
                    bairro = str(p.get('bairro_nome') or '').replace('None', '')
                    cidade = str(p.get('cidade_nome') or '').replace('None', '')
                    uf = str(p.get('uf_sigla') or '').replace('None', '')
                    
                    val = float(p.get('valor_avaliacao', 0) or 0)
                    pre = float(p.get('preco', 0) or 0)
                    desconto_moeda = max(0.0, val - pre)

                    titulo = f"🔴 {tipo} {bairro} {cidade} {uf} {numero} Imóvel CAIXA 🧡💙"
                    desconto_fmt = format_currency(desconto_moeda)
                    descricao = f"Imóvel CAIXA {tipo} {bairro} {cidade} {uf} com desconto de {desconto_fmt}. ⚠️ Estamos Online!"
                    keyword = f"{tipo} {bairro} {cidade} {uf}"
                    
                    t_s = normalize_slug(tipo)
                    b_s = normalize_slug(bairro)
                    c_s = normalize_slug(cidade)
                    u_s = normalize_slug(uf)
                    slug = f"{t_s}-{b_s}-{c_s}-{u_s}-{numero}"
                    
                    img_name = f"{slug}.jpg"
                    img_path_rel = f"/imagens-destaque/{img_name}"
                    
                    # Update DB
                    supabase.table("imoveis").update({
                        "imovel_caixa_post_titulo": titulo,
                        "imovel_caixa_post_descricao": descricao,
                        "imovel_caixa_post_palavra_chave": keyword,
                        "imovel_caixa_post_link_permanente": slug,
                        "imovel_caixa_post_imagem_destaque": img_path_rel
                    }).eq("imoveis_id", id_imovel).execute()
                    
                    # Clone Image to both locations
                    for d in [PUBLIC_DEST_DIR, ROOT_DEST_DIR]:
                        dest_file = d / img_name
                        if not dest_file.exists():
                            shutil.copy2(TEMPLATE_IMG, dest_file)
                        
                except Exception as e:
                    print(f"Erro no imóvel {p.get('numero_imovel')}: {e}")
                    continue
            
            offset += page_size
            time.sleep(1) # Pequena pausa entre lotes
            
        except Exception as e:
            print(f"Erro ao buscar lote {offset}: {e}. Tentando novamente em 5s...")
            time.sleep(5)
            # Tenta o mesmo lote novamente
            continue

if __name__ == "__main__":
    if not TEMPLATE_IMG.exists():
        print(f"ERRO: Template de imagem não encontrado em {TEMPLATE_IMG}")
        sys.exit(1)
    process_imoveis()
