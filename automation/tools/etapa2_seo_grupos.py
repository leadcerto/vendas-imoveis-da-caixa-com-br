import sys
import os
import unicodedata
import random
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

def normalize_text(text):
    if not text: return ""
    nfd_form = unicodedata.normalize('NFD', str(text).strip().lower())
    return "".join(c for c in nfd_form if unicodedata.category(c) != 'Mn')

def generate_slug(uf, cidade, bairro, tipo, numero):
    parts = [uf, cidade, bairro, tipo, str(numero)]
    parts = [normalize_text(p).replace(" ", "-") for p in parts if p]
    raw_slug = "-".join(parts)
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
    
    # Check lengths before sampling to avoid ValueError
    if len(cat1) >= 2: selected.extend(random.sample(cat1, 2))
    else: selected.extend(cat1)

    if len(cat2) >= 2: selected.extend(random.sample(cat2, 2))
    else: selected.extend(cat2)

    if len(cat3) >= 2: selected.extend(random.sample(cat3, 2))
    else: selected.extend(cat3)

    if len(cat4) >= 2: selected.extend(random.sample(cat4, 2))
    else: selected.extend(cat4)

    if len(cat5) >= 1: selected.extend(random.sample(cat5, 1))
    else: selected.extend(cat5)

    if len(cat6) >= 1: selected.extend(random.sample(cat6, 1))
    else: selected.extend(cat6)

    return " ".join(selected)

def ensure_master_image():
    # Caminho do arquivo mestre local
    master_path = os.path.join(ROOT_DIR, "imagens", "imagem-destaque", "ImagemDestaque.jpg")
    try:
        with open(master_path, "rb") as f:
            return f.read()
    except Exception as e:
        print(f"⚠️ Aviso: Não foi possível ler ImagemDestaque.jpg local: {e}")
        return None

def upload_imagem_destaque_to_storage(slug, image_bytes):
    if not image_bytes: return
    try:
        # Verifica se já existe para não re-upar desnecessariamente (reduzir tráfego)
        file_path = f"{slug}.jpg"
        # O supabase tem método list ou upload com upsert
        # Faremos upsert=False ou tratar o erro de "The resource already exists"
        supabase.storage.from_("imoveis-destaque").upload(
            file_path, 
            image_bytes, 
            file_options={"content-type": "image/jpeg", "upsert": "true"}
        )
    except Exception as e:
        # Se falhar (ex: já existe ou restrição), ignoramos para não interromper o batch
        pass

def main():
    print("📥 Etapa 2 - SEO e Grupos (SUPER BATCH MODE)")
    
    # 1. Carregar Regras
    resp_grupos = supabase.table("grupos_imovel").select("*").execute()
    grupos = sorted(resp_grupos.data, key=lambda x: x.get('valor_minimo', 0))
    master_image_bytes = ensure_master_image()
    
    BATCH_SIZE = 500
    total_processados = 0
    
    while True:
        # Buscar imóveis na Etapa 1
        resp_imoveis = supabase.table("imoveis").select(
            "imoveis_id, imovel_caixa_numero, imovel_caixa_endereco_uf, imovel_caixa_endereco_cidade, imovel_caixa_endereco_bairro, imovel_caixa_descricao_tipo"
        ).eq("etapa_processamento", 1).limit(BATCH_SIZE).execute()
        
        imoveis = resp_imoveis.data
        if not imoveis: break
            
        imoveis_ids = [imv["imoveis_id"] for imv in imoveis]
        
        # BUSCA FINANCEIRA EM LOTE (BATCH SELECT)
        resp_finan = supabase.table("atualizacoes_imovel").select(
            "id, imovel_id, imovel_caixa_valor_venda, imovel_caixa_valor_avaliacao"
        ).in_("imovel_id", imoveis_ids).execute()
        
        # Mapear finan por imovel_id (pegar a mais recente se houver duplicatas no batch)
        finan_map = {}
        for f in resp_finan.data:
            finan_map[f["imovel_id"]] = f

        lote_imoveis_update = []
        lote_finan_update = []
        
        for imv in imoveis:
            iid = imv["imoveis_id"]
            num = imv["imovel_caixa_numero"]
            uf, cid, bai, tip = imv.get("imovel_caixa_endereco_uf",""), imv.get("imovel_caixa_endereco_cidade",""), imv.get("imovel_caixa_endereco_bairro",""), imv.get("imovel_caixa_descricao_tipo","")
            
            f_data = finan_map.get(iid)
            grupo_id = None
            if f_data:
                val_venda = float(f_data.get("imovel_caixa_valor_venda", 0))
                val_aval = float(f_data.get("imovel_caixa_valor_avaliacao", 0))
                
                # Calcular Grupo
                ent_p, pre_p = 0.0, 0.0
                for grp in grupos:
                    if float(grp.get('valor_minimo',0)) <= val_venda <= float(grp.get('valor_maximo', float('inf'))):
                        grupo_id, ent_p, pre_p = grp.get('id'), float(grp.get('compra_financiamento_entrada_caixa',0)), float(grp.get('compra_financiamento_prestacao',0))
                        break
                
                lote_finan_update.append({
                    "id": f_data["id"],
                    "imovel_caixa_pagamento_financiamento_entrada": val_venda * ent_p,
                    "imovel_caixa_pagamento_financiamento_prestacao": val_venda * pre_p,
                    "imovel_caixa_valor_desconto_moeda": max(0.0, val_aval - val_venda)
                })

            # SEO
            slug = generate_slug(uf, cid, bai, tip, num)
            
            # Formatação Exata Solicitada
            # Desconto precisa estar formatado em Reais (BRL)
            val_desconto = max(0.0, val_aval - val_venda) if f_data else 0.0
            desconto_moeda = f"R$ {val_desconto:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            
            titulo_exato = f"{slug} - Imóveis da CAIXA 🧡💙"
            descricao_exata = f"{slug}. Imóvel com desconto de {desconto_moeda}. ⚠️ Estamos Online!"
            palavra_chave_exata = slug
            imagem_destaque_exata = f"https://venda.imoveisdacaixa.com.br/imagens/imagem-destaque/{slug}.jpg"
            
            # Fazer upload físico para o Storage como o usuário pediu
            upload_imagem_destaque_to_storage(slug, master_image_bytes)
            
            lote_imoveis_update.append({
                "imoveis_id": iid,
                "imovel_caixa_post_link_permanente": slug,
                "imovel_caixa_post_titulo": titulo_exato,
                "imovel_caixa_post_descricao": descricao_exata,
                "imovel_caixa_post_palavra_chave": palavra_chave_exata,
                "imovel_caixa_post_hashtags": get_hashtags(uf, cid, bai, tip),
                "imovel_caixa_post_imagem_destaque": imagem_destaque_exata,
                "id_grupo_imovel_caixa": grupo_id,
                "etapa_processamento": 2
            })

        # Updates em Lote
        if lote_imoveis_update:
            supabase.table("imoveis").upsert(lote_imoveis_update).execute()
        if lote_finan_update:
            supabase.table("atualizacoes_imovel").upsert(lote_finan_update).execute()
            
        total_processados += len(imoveis)
        print(f"⏳ {total_processados} imóveis processados na Etapa 2...")
            
    print(f"✅ ETAPA 2 CONCLUÍDA. Total: {total_processados}")

if __name__ == "__main__":
    main()
