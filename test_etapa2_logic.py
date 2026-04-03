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

def format_money_abbrev(val):
    val = float(val or 0)
    if val >= 1_000_000:
        return f"R$ {val/1_000_000:.1f} Mi".replace(".", ",")
    if val >= 1_000:
        return f"R$ {int(val/1_000)} Mil"
    return f"R$ {val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

def test():
    # Pega o imóvel específico que o usuário reportou
    num_alvo = "8444404425055"
    resp = supabase.table("imoveis").select("*").eq("imovel_caixa_numero", num_alvo).execute()
    if not resp.data:
        print(f"Imóvel {num_alvo} não encontrado.")
        return
    
    imv = resp.data[0]
    iid = imv["imoveis_id"]
    iid_str = str(iid)
    print(f"Imovel ID: {iid} (Type: {type(iid)}) -> Normalized: {iid_str}")

    # Busca financeira para este ID
    resp_finan = supabase.table("atualizacoes_imovel").select("*").eq("imovel_id", iid).execute()
    if not resp_finan.data:
        print(f"Financeiro para imovel_id {iid} não encontrado.")
        return
    
    f_data_list = resp_finan.data
    # Simula o finan_map com normalização de chave
    finan_map = {str(f["imovel_id"]): f for f in f_data_list}
    
    f_data = finan_map.get(iid_str)
    if not f_data:
        print(f"Falha no mapeamento finan_map para a chave {iid_str}")
        return

    val_venda = float(f_data.get("imovel_caixa_valor_venda") or 0)
    val_aval = float(f_data.get("imovel_caixa_valor_avaliacao") or 0)
    val_desconto = max(0.0, val_aval - val_venda)
    
    print(f"Venda: {val_venda} | Avaliação: {val_aval} | Desconto: {val_desconto}")
    print(f"Formatado: {format_money_abbrev(val_desconto)}")
    
    uf, cid, bai, tip = imv.get("imovel_caixa_endereco_uf",""), imv.get("imovel_caixa_endereco_cidade",""), imv.get("imovel_caixa_endereco_bairro",""), imv.get("imovel_caixa_descricao_tipo","")
    num = imv["imovel_caixa_numero"]
    desc_completa = f"{uf} {cid} {bai} {tip} {num}. Imóvel com desconto de {format_money_abbrev(val_desconto)}. ⚠️ Estamos Online!"
    palavra_chave = f"{tip} {bai} {cid} {uf}"
    print(f"Meta Descrição: {desc_completa}")
    print(f"Palavra-Chave (Focus): {palavra_chave}")

if __name__ == "__main__":
    test()
