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

# Caminhos
BASE_DIR = Path(__file__).parent.parent.parent
TEMPLATE_IMG = BASE_DIR / "imagens" / "imagem-destaque" / "ImagemDestaque.jpg"
DEST_DIR = BASE_DIR / "web" / "public" / "imagens-destaque"

if not DEST_DIR.exists():
    DEST_DIR.mkdir(parents=True, exist_ok=True)

# Cliente Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def normalize_seo(text):
    if not text: return ""
    return "".join(c for c in unicodedata.normalize('NFD', str(text).strip().upper())
                  if unicodedata.category(c) != 'Mn')

def normalize_slug(text):
    if not text: return ""
    # Mesmo padrão do imageUtils.ts: lowercase, sem acentos, espaços -> underscore
    n = "".join(c for c in unicodedata.normalize('NFD', str(text).strip().lower())
                if unicodedata.category(c) != 'Mn')
    n = n.replace(" ", "_").replace("-", "_")
    import re
    n = re.sub(r'[^a-z0-9_]', '', n)
    return n

def format_currency(value):
    return f"R$ {float(value):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

def process_imoveis():
    print("Buscando imóveis para migração SEO...")
    
    # Busca em lotes para não sobrecarregar
    page_size = 500
    offset = 0
    
    while True:
        # Usamos a view 'properties' que já tem os nomes normalizados
        response = supabase.table("properties").select(
            "id, numero_imovel, tipo_nome, bairro_nome, cidade_nome, uf_sigla, valor_avaliacao, preco"
        ).range(offset, offset + page_size - 1).execute()
        
        if not response.data:
            break
            
        print(f"Processando batch {offset} a {offset + len(response.data)}...")
        
        for p in response.data:
            id_imovel = p['id']
            numero = p['numero_imovel']
            tipo = p.get('tipo_nome', 'Imóvel')
            bairro = p.get('bairro_nome', '')
            cidade = p.get('cidade_nome', '')
            uf = p.get('uf_sigla', '')
            
            val = float(p.get('valor_avaliacao', 0) or 0)
            pre = float(p.get('preco', 0) or 0)
            desconto_moeda = max(0.0, val - pre)

            # Gerar campos SEO
            # Título: 🔴 [tipo] [bairro] [cidade] [uf] [numero] Imóvel CAIXA 🧡💙
            titulo = f"🔴 {tipo} {bairro} {cidade} {uf} {numero} Imóvel CAIXA 🧡💙"
            
            # Descrição: Imóvel CAIXA [tipo] [bairro] [cidade] [uf] com desconto de [valor]. ⚠️ Estamos Online!
            desconto_fmt = format_currency(desconto_moeda)
            descricao = f"Imóvel CAIXA {tipo} {bairro} {cidade} {uf} com desconto de {desconto_fmt}. ⚠️ Estamos Online!"
            
            # Palavra-Chave: [tipo] [bairro] [cidade] [uf]
            keyword = f"{tipo} {bairro} {cidade} {uf}"
            
            # Slug / Link Permanente
            t_s = normalize_slug(tipo)
            b_s = normalize_slug(bairro)
            c_s = normalize_slug(cidade)
            u_s = normalize_slug(uf)
            slug = f"{t_s}-{b_s}-{c_s}-{u_s}-{numero}"
            
            # Imagem Destaque
            img_name = f"{t_s}-{b_s}-{c_s}-{u_s}-{numero}.jpg"
            img_path_rel = f"/imagens-destaque/{img_name}"
            
            # Persistir no Banco (Tabela imoveis)
            supabase.table("imoveis").update({
                "imovel_caixa_post_titulo": titulo,
                "imovel_caixa_post_descricao": descricao,
                "imovel_caixa_post_palavra_chave": keyword,
                "imovel_caixa_post_link_permanente": slug,
                "imovel_caixa_post_imagem_destaque": img_path_rel
            }).eq("imoveis_id", id_imovel).execute()
            
            # Clonar Imagem
            dest_file = DEST_DIR / img_name
            if not dest_file.exists():
                try:
                    shutil.copy2(TEMPLATE_IMG, dest_file)
                except Exception as e:
                    print(f"Erro ao clonar imagem para {numero}: {e}")

        offset += page_size

if __name__ == "__main__":
    if not TEMPLATE_IMG.exists():
        print(f"ERRO: Template de imagem não encontrado em {TEMPLATE_IMG}")
        sys.exit(1)
    process_imoveis()
