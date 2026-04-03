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

def normalize_text(text, keep_case=False):
    if not text: return ""
    text_str = str(text).strip()
    if not keep_case:
        text_str = text_str.lower()
    nfd_form = unicodedata.normalize('NFD', text_str)
    return "".join(c for c in nfd_form if unicodedata.category(c) != 'Mn')

def format_money_abbrev(val):
    """Formata valor para o Title (H1) visando o limite de 60 caracteres: ex R$ 108 Mil."""
    val = float(val or 0)
    if val >= 1_000_000:
        return f"R$ {val/1_000_000:.1f} Mi".replace(".", ",")
    if val >= 1_000:
        return f"R$ {int(val/1_000)} Mil"
    return f"R$ {val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

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
    
    # Categorias Oficiais (Conforme Passo 02 do documento)
    cat1 = ["#imoveiscaixa", "#imoveis_da_caixa", "#imoveis_leilao", "#LeilaoDeImoveis", "#ImoveisDeLeilao", "#ImovelRetomado", "#ImoveisAdjudicados", "#OportunidadeDeLeilao", "#LeilaoCaixa", "#imovel_barato"]
    cat2 = [f"#{tipo_n}{cidade_n}", f"#{tipo_n}{bairro_n}", f"#{tipo_n}{uf_n}"]
    cat3 = ["#OportunidadeImobiliaria", "#AbaixoDoPreco", "#ImovelComDesconto", "#PrecoDeCusto", "#OportunidadeUnica", "#PrecoDeOcasiao", "#NegocioImperdivel"]
    cat4 = ["#LeilaoDeImoveis", "#ImoveisDeLeilao", "#ImovelRetomado", "#ImoveisAdjudicados", "#OportunidadeDeLeilao", "#LeilaoCaixa", f"#imoveiscaixa{cidade_n}"]
    cat5 = ["#InvestimentoImobiliario", "#InvestimentoCerto", "#LucroImobiliario", "#InvestidoresImobiliarios", "#RendaPassiva", "#ImoveisParaInvestimento"]
    cat6 = ["#MercadoImobiliario", "#CasaPropria", "#ComprarImovel", f"#Imoveis{cidade_n}", "#ImovelAVenda", "#CorretorDeImoveis", f"#Imoveis{bairro_n}"]
    
    selected = []
    
    # Distribuição Exata: 2 das cats 1,2,3,4 | 1 das cats 5,6
    for cat, count in [(cat1, 2), (cat2, 2), (cat3, 2), (cat4, 2), (cat5, 1), (cat6, 1)]:
        if len(cat) >= count:
            selected.extend(random.sample(cat, count))
        else:
            selected.extend(cat)

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
        
        # Mapear finan por imovel_id (usar string para evitar erro de tipo na chave)
        finan_map = {}
        for f in resp_finan.data:
            fid_map = str(f["imovel_id"])
            finan_map[fid_map] = f

        lote_imoveis_update = []
        lote_finan_update = []
        
        for idx, imv in enumerate(imoveis):
            iid = str(imv["imoveis_id"]) # Garantir string para match com finan_map
            num = imv["imovel_caixa_numero"]
            uf, cid, bai, tip = imv.get("imovel_caixa_endereco_uf",""), imv.get("imovel_caixa_endereco_cidade",""), imv.get("imovel_caixa_endereco_bairro",""), imv.get("imovel_caixa_descricao_tipo","")
            
            # Resetar valores financeiros para cada imóvel
            val_venda, val_aval = 0.0, 0.0
            f_data = finan_map.get(iid)
            grupo_id = None
            
            if f_data:
                try:
                    val_venda = float(f_data.get("imovel_caixa_valor_venda") or 0)
                    val_aval = float(f_data.get("imovel_caixa_valor_avaliacao") or 0)
                except:
                    pass
            
            if f_data:
                # Log a cada 50 imóveis para acompanhar progresso
                if (idx + 1) % 50 == 0:
                    print(f"   ⚙️ Processando financeiros {idx+1}/{len(imoveis)} do lote...")

                val_desconto = max(0.0, val_aval - val_venda)
                desconto_perc = (val_desconto / val_aval * 100) if val_aval > 0 else 0
                
                # Selo de Oportunidade (Baseado no desconto do modelo V3)
                if desconto_perc >= 80: selo_id = 1    # Ouro
                elif desconto_perc >= 60: selo_id = 2  # Prata
                elif desconto_perc >= 50: selo_id = 3  # Bronze
                else: selo_id = 4                    # Destaque

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
                    "imovel_caixa_valor_desconto_moeda": val_desconto,
                    "imovel_caixa_valor_desconto_percentual": round(desconto_perc, 2),
                    "imovel_selo_oportunidade_id": selo_id
                })

            # SEO
            slug = generate_slug(uf, cid, bai, tip, num)
            
            # SEO TITLE (H1) - Nova Regra max 60 chars
            # Formato: [Tipo] em [Bairro], [Cidade]/[UF] | Desconto de [Valor]
            val_desconto = max(0.0, val_aval - val_venda) if f_data else 0.0
            desconto_abreviado = format_money_abbrev(val_desconto)
            
            # Garantir que Tipo comece em Maiúsculo
            tipo_fmt = str(tip or "Imóvel").capitalize()
            
            titulo_h1 = f"{tipo_fmt} em {bai}, {cid}/{uf} | Desconto de {desconto_abreviado}"
            
            # Se ainda exceder 60 caracteres, tentamos encurtar removendo o bairro (fallback) ou truncando
            if len(titulo_h1) > 60:
                titulo_h1 = f"{tipo_fmt} em {cid}/{uf} | Desconto de {desconto_abreviado}"
            
            # SEO Metadata Readable (Passo 02 do documento)
            desc_completa = f"{uf} {cid} {bai} {tip} {num}. Imóvel com desconto de {format_money_abbrev(val_desconto)}. ⚠️ Estamos Online!"
            palavra_chave = f"{tip} {bai} {cid} {uf}"
            
            imagem_destaque_exata = f"https://venda.imoveisdacaixa.com.br/imagens/imagem-destaque/{slug}.jpg"
            
            # Fazer upload físico para o Storage como o usuário pediu
            upload_imagem_destaque_to_storage(slug, master_image_bytes)
            
            # Image SEO Tags (Nova Regra: Fachada de [tipo] à venda em [bairro], [cidade] [uf])
            tag_seo = f"Fachada de {tipo_fmt} à venda em {bai}, {cid} {uf}"
            tag_alt = tag_seo
            tag_title = tag_seo
            
            lote_imoveis_update.append({
                "imoveis_id": iid,
                "imovel_caixa_post_link_permanente": slug,
                "imovel_caixa_post_titulo": titulo_h1,
                "imovel_caixa_post_descricao": desc_completa[:160], # Limite meta desc
                "imovel_caixa_post_palavra_chave": palavra_chave,
                "imovel_caixa_post_imagem_destaque_tag_alt": tag_alt,
                "imovel_caixa_post_imagem_destaque_tag_title": tag_title,
                "imovel_caixa_link_imagem_tag_alt": tag_alt,
                "imovel_caixa_link_imagem_tag_title": tag_title,
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
