import sys
import os
import io
import shutil
import unicodedata
import random
from dotenv import load_dotenv
from supabase import create_client, Client

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
env_path = os.path.join(ROOT_DIR, "web", ".env")
load_dotenv(env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ ERRO: SUPABASE_URL ou SUPABASE_KEY (Service Role) não encontrados.")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def normalize_text(text):
    if not text:
        return ""
    # remove acentos e deixa caixa baixa
    nfd_form = unicodedata.normalize('NFD', str(text).strip().lower())
    return "".join(c for c in nfd_form if unicodedata.category(c) != 'Mn')

def generate_slug(uf, cidade, bairro, tipo, numero):
    parts = [uf, cidade, bairro, tipo, str(numero)]
    parts = [normalize_text(p).replace(" ", "-") for p in parts if p]
    raw_slug = "-".join(parts)
    # remover caracteres especiais
    return "".join(c for c in raw_slug if c.isalnum() or c == '-')

def get_hashtags(uf, cidade, bairro, tipo):
    tipo_n = normalize_text(tipo).replace(" ", "")
    cidade_n = normalize_text(cidade).replace(" ", "")
    bairro_n = normalize_text(bairro).replace(" ", "")
    uf_n = normalize_text(uf).replace(" ", "")
    
    cat1 = ["#imoveiscaixa", "#imoveis_da_caixa", "#imoveis_leilao", "#LeilaoDeImoveis", "#ImoveisDeLeilao", "#ImovelRetomado", "#ImoveisAdjudicados", "#OportunidadeDeLeilao", "#LeilaoCaixa", "#imovel_barato"]
    cat2 = [f"#{tipo_n}{cidade_n}", f"#{tipo_n}{bairro_n}", f"#{tipo_n}{uf_n}"]
    cat3 = ["#OportunidadeImobiliaria", "#AbaixoDoPreco", "#ImovelComDesconto", "#PrecoDeCusto", "#OportunidadeUnica", "#PrecoDeOcasiao", "#NegocioImperdivel"]
    cat4 = ["#LeilaoDeImoveis", "#ImoveisDeLeilao", "#ImovelRetomado", "#ImoveisAdjudicados", "#OportunidadeDeLeilao", "#LeilaoCaixa", f"#imoveiscaixa{cidade_n}"]
    cat5 = ["#InvestimentoImobiliario", "#InvestimentoCerto", "#LucroImobiliario", "#InvestidoresImobiliarios", "#RendaPassiva", "#ImoveisParaInvestimento"]
    cat6 = ["#MercadoImobiliario", "#CasaPropria", "#ComprarImovel", f"#Imoveis{cidade_n}", "#ImovelAVenda", "#CorretorDeImoveis", f"#Imoveis{bairro_n}"]
    
    selected = []
    selected.extend(random.sample(cat1, min(2, len(cat1))))
    selected.extend(random.sample(cat2, min(2, len(cat2))))
    selected.extend(random.sample(cat3, min(2, len(cat3))))
    selected.extend(random.sample(cat4, min(2, len(cat4))))
    selected.extend(random.sample(cat5, min(1, len(cat5))))
    selected.extend(random.sample(cat6, min(1, len(cat6))))
    
    # fallback se não bater 10
    extras = [h for h in (cat1+cat3+cat5+cat6) if h not in selected]
    while len(selected) < 10 and extras:
        h = random.choice(extras)
        selected.append(h)
        extras.remove(h)
        
    return " ".join(selected[:10])

def generate_image_process(slug):
    try:
        source_jpg = os.path.join(ROOT_DIR, "imagens", "imagem-destaque", "ImagemDestaque.jpg")
        dest_jpg_web = os.path.join(ROOT_DIR, "web", "public", "imagens-destaque", f"{slug}.jpg")
        
        # Copiar para o diretório local public do web (Next.js)
        if os.path.exists(source_jpg):
            os.makedirs(os.path.dirname(dest_jpg_web), exist_ok=True)
            shutil.copyfile(source_jpg, dest_jpg_web)
            
            # Fazer upload para o Storage Supabase
            with open(dest_jpg_web, "rb") as f:
                file_bytes = f.read()
                
            try:
                supabase.storage.from_("imoveis-destaque").upload(f"{slug}.jpg", file_bytes, {"content-type": "image/jpeg", "upsert": "true"})
            except Exception as se:
                # pode falhar se já existir, mas usamos upsert
                pass
                
            public_url = supabase.storage.from_("imoveis-destaque").get_public_url(f"{slug}.jpg")
            return public_url
    except Exception as e:
        print(f"Erro na imagem para {slug}: {e}")
    return None

def main():
    print("📥 Etapa 2 - Identificação de Grupo e SEO")
    
    # 1. Carregar Regras (Grupos Imóvel)
    resp_grupos = supabase.table("grupos_imovel").select("*").execute()
    grupos = sorted(resp_grupos.data, key=lambda x: x.get('valor_minimo', 0))
    
    # 2. Buscar imóveis na Etapa 1
    resp_imoveis = supabase.table("imoveis").select("imoveis_id, imovel_caixa_numero, imovel_caixa_endereco_uf, imovel_caixa_endereco_cidade, imovel_caixa_endereco_bairro, imovel_caixa_descricao_tipo").eq("etapa_processamento", 1).execute()
    
    imoveis = resp_imoveis.data
    if not imoveis:
        print("✅ Nenhum imóvel pendente na Etapa 1 processamento.")
        sys.exit(0)
        
    print(f"📊 Encontrados {len(imoveis)} imóveis pendentes para processar (Etapa 1 -> Etapa 2).")
    
    sucessos = 0
    erros = 0
    
    for imv in imoveis:
        try:
            imoveis_id = imv["imoveis_id"]
            numero = imv["imovel_caixa_numero"]
            uf = imv.get("imovel_caixa_endereco_uf", "")
            cidade = imv.get("imovel_caixa_endereco_cidade", "")
            bairro = imv.get("imovel_caixa_endereco_bairro", "")
            tipo = imv.get("imovel_caixa_descricao_tipo", "")
            
            # Buscar valor de venda na atualizacao (para grupos)
            resp_finan = supabase.table("atualizacoes_imovel").select("id, imovel_caixa_valor_venda, imovel_caixa_valor_avaliacao").eq("imovel_id", imoveis_id).order("created_at", desc=True).limit(1).execute()
            
            valor_venda = 0.0
            valor_avaliacao = 0.0
            desconto_moeda = 0.0
            atualizacao_id = None
            if resp_finan.data:
                valor_venda = float(resp_finan.data[0].get("imovel_caixa_valor_venda", 0))
                valor_avaliacao = float(resp_finan.data[0].get("imovel_caixa_valor_avaliacao", 0))
                desconto_moeda = max(0.0, valor_avaliacao - valor_venda)
                atualizacao_id = resp_finan.data[0].get("id")
                
            # Grupo ID
            grupo_id = None
            entrada_perc = 0.0
            prestacao_perc = 0.0
            for grp in grupos:
                min_v = float(grp.get('valor_minimo') or 0)
                max_v = float(grp.get('valor_maximo') or float('inf'))
                if min_v <= valor_venda <= max_v:
                    grupo_id = grp.get('id')
                    entrada_perc = float(grp.get('compra_financiamento_entrada_caixa') or 0.0)
                    prestacao_perc = float(grp.get('compra_financiamento_prestacao') or 0.0)
                    break
                    
            valor_entrada = valor_venda * entrada_perc
            valor_prestacao = valor_venda * prestacao_perc
            
            # Formatação moeda para SEO
            desconto_str = f"R$ {desconto_moeda:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            
            # SEO
            slug = generate_slug(uf, cidade, bairro, tipo, numero)
            titulo = f"{uf.upper()} {cidade.title()} {bairro.title()} {tipo.title()} {numero} - Imóveis da CAIXA 🧡💙"
            descricao = f"{uf.upper()} {cidade.title()} {bairro.title()} {tipo.title()} {numero}. Imóvel com desconto de {desconto_str}. ⚠️ Estamos Online!"
            palavra_chave = f"{tipo.title()} {bairro.title()} {cidade.title()} {uf.upper()} {numero}"
            hashtags = get_hashtags(uf, cidade, bairro, tipo)
            
            # Image Storage Upload
            img_url = generate_image_process(slug)
            
            # Update IMOVEIS
            dados_imovel = {
                "imovel_caixa_post_link_permanente": slug,
                "imovel_caixa_post_titulo": titulo,
                "imovel_caixa_post_descricao": descricao,
                "imovel_caixa_post_palavra_chave": palavra_chave,
                "imovel_caixa_post_hashtags": hashtags,
                "id_grupo_imovel_caixa": grupo_id,
                "etapa_processamento": 2
            }
            if img_url:
                dados_imovel["imovel_caixa_post_imagem_destaque"] = img_url
                
            supabase.table("imoveis").update(dados_imovel).eq("imoveis_id", imoveis_id).execute()
            
            # Update ATUALIZACOES
            if atualizacao_id:
                dados_atualizacao = {
                    "imovel_caixa_pagamento_financiamento_entrada": valor_entrada,
                    "imovel_caixa_pagamento_financiamento_prestacao": valor_prestacao,
                    "imovel_caixa_valor_desconto_moeda": desconto_moeda
                }
                supabase.table("atualizacoes_imovel").update(dados_atualizacao).eq("id", atualizacao_id).execute()
            
            sucessos += 1
            if sucessos % 50 == 0:
                print(f"⏳ Processados {sucessos}/{len(imoveis)} imóveis SEO...")
                
        except Exception as e:
            print(f"❌ Erro no imóvel {imv.get('imovel_caixa_numero')}: {e}")
            erros += 1

    print("=====================================================")
    print(f"✅ ETAPA 2 CONCLUÍDA")
    print(f"✅ SEO, Grupos e Financeiro gravados: {sucessos}")
    print(f"⚠️ Erros/Ignorados: {erros}")
    print("=====================================================")

if __name__ == "__main__":
    main()
