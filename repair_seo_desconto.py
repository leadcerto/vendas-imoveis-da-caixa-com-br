import sys
import os
import unicodedata
import random
from dotenv import load_dotenv
from supabase import create_client, Client

# Carregar variáveis de ambiente
ROOT_DIR = r"c:\Users\PICHAU\Desktop\antigravity\venda-imoveis-caixa"
env_path = os.path.join(ROOT_DIR, "web", ".env")
load_dotenv(env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def normalize_text(text, keep_case=False):
    if not text: return ""
    text_str = str(text).strip()
    if not keep_case:
        text_str = text_str.lower()
    nfd_form = unicodedata.normalize('NFD', text_str)
    return "".join(c for c in nfd_form if unicodedata.category(c) != 'Mn')

def format_money_abbrev(val):
    val = float(val or 0)
    if val >= 1_000_000:
        return f"R$ {val/1_000_000:.1f} Mi".replace(".", ",")
    if val >= 1_000:
        return f"R$ {int(val/1_000)} Mil"
    return f"R$ {val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

def get_hashtags(uf, cidade, bairro, tipo):
    tipo_n = normalize_text(tipo).replace(" ", "")
    cidade_n = normalize_text(cidade).replace(" ", "")
    bairro_n = normalize_text(bairro).replace(" ", "")
    uf_n = normalize_text(uf).replace(" ", "")
    
    cat1 = ["#imoveiscaixa", "#imoveis_da_caixa", "#leilao_caixa", "#imoveis_leilao", "#ImoveisAdjudicados", "#ImovelRetomado"]
    cat2 = [f"#{tipo_n}{cidade_n}", f"#{tipo_n}{bairro_n}", f"#imoveis{cidade_n}", f"#{bairro_n}{cidade_n}", f"#imoveis{uf_n}", f"#imoveiscaixa{cidade_n}"]
    cat3 = ["#OportunidadeImobiliaria", "#AbaixoDoPreco", "#DescontoReal", "#ImovelBarato", "#MelhorOferta"]
    cat4 = ["#LeilaoDeImoveis", "#InvestimentoSeguro", "#CompraInteligente", "#OportunidadeUnica"]
    cat5 = ["#InvestimentoImobiliario", "#InvestidoresImobiliarios", "#Patrimonio"]
    cat6 = ["#MercadoImobiliario", "#CorretorDeImoveis", "#CasasLuxo", "#LarDoceLar"]

    selected = []
    for cat, count in [(cat1, 2), (cat2, 2), (cat3, 2), (cat4, 2), (cat5, 1), (cat6, 1)]:
        if len(cat) >= count: selected.extend(random.sample(cat, count))
        else: selected.extend(cat)
    return " ".join(selected)

def repair():
    print("🛠️ Iniciando Reparo de SEO (Fix R$ 0,00)...")
    
    BATCH_SIZE = 500
    while True:
        # Busca imóveis que estão na Etapa 1 ou que possuem R$ 0,00 na descrição
        resp = supabase.table("imoveis").select(
            "imoveis_id, imovel_caixa_numero, imovel_caixa_endereco_uf, imovel_caixa_endereco_cidade, imovel_caixa_endereco_bairro, imovel_caixa_descricao_tipo"
        ).filter("imovel_caixa_post_descricao", "ilike", "%desconto de R$ 0,00%").limit(BATCH_SIZE).execute()
        
        imoveis = resp.data
        if not imoveis:
            print("✅ Todos os registros corrigidos!")
            break
        
        imoveis_ids = [imv["imoveis_id"] for imv in imoveis]
        resp_finan = supabase.table("atualizacoes_imovel").select(
            "id, imovel_id, imovel_caixa_valor_venda, imovel_caixa_valor_avaliacao"
        ).in_("imovel_id", imoveis_ids).execute()
        
        finan_map = {str(f["imovel_id"]): f for f in resp_finan.data}
        
        lote_imoveis_update = []
        lote_finan_update = []
        
        for imv in imoveis:
            iid = str(imv["imoveis_id"])
            num = str(imv["imovel_caixa_numero"])
            uf, cid, bai, tip = imv.get("imovel_caixa_endereco_uf",""), imv.get("imovel_caixa_endereco_cidade",""), imv.get("imovel_caixa_endereco_bairro",""), imv.get("imovel_caixa_descricao_tipo","")
            
            f_data = finan_map.get(iid)
            val_venda, val_aval = 0.0, 0.0
            if f_data:
                val_venda = float(f_data.get("imovel_caixa_valor_venda") or 0)
                val_aval = float(f_data.get("imovel_caixa_valor_avaliacao") or 0)
            
            val_desconto = max(0.0, val_aval - val_venda)
            desconto_abrev = format_money_abbrev(val_desconto)
            
            # SEO Title
            tipo_fmt = str(tip or "Imóvel").capitalize()
            titulo_h1 = f"{tipo_fmt} em {bai}, {cid}/{uf} | Desconto de {desconto_abrev}"
            if len(titulo_h1) > 60:
                titulo_h1 = f"{tipo_fmt} em {cid}/{uf} | Desconto de {desconto_abrev}"
            
            desc_completa = f"{uf} {cid} {bai} {tip} {num}. Imóvel com desconto de {desconto_abrev}. ⚠️ Estamos Online!"
            tags = get_hashtags(uf, cid, bai, tip)
            
            lote_imoveis_update.append({
                "imoveis_id": imv["imoveis_id"],
                "imovel_caixa_post_titulo": titulo_h1,
                "imovel_caixa_post_descricao": desc_completa,
                "imovel_caixa_post_palavra_chave": f"{tip} {bai} {cid} {uf}",
                "imovel_caixa_post_imagem_destaque_tag_alt": f"{tip} em {bai}, {cid} - {uf}",
                "imovel_caixa_post_imagem_destaque_tag_title": f"{tip} com Desconto de {desconto_abrev}",
                "imovel_caixa_post_hashtags": tags,
                "etapa_processamento": 2
            })
            
            if f_data:
                lote_finan_update.append({
                    "id": f_data["id"],
                    "imovel_caixa_valor_desconto_moeda": val_desconto
                })
        
        if lote_imoveis_update:
            supabase.table("imoveis").upsert(lote_imoveis_update).execute()
        if lote_finan_update:
            supabase.table("atualizacoes_imovel").upsert(lote_finan_update).execute()
            
        print(f"📦 Lote de {len(imoveis)} corrigido com sucesso!")

if __name__ == "__main__":
    repair()
