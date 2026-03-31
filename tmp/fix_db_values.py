import os
import sys
import json
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client
from pathlib import Path

# Adiciona o diretório raiz ao path para importar módulos do projeto
sys.path.append(str(Path(__file__).parent.parent))

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Importa as funções necessárias do script original
# (Copiadas aqui para evitar problemas de importação circular ou caminhos)
import unicodedata
import re

def normalize_text(text):
    if not text: return ""
    return "".join(c for c in unicodedata.normalize('NFD', str(text).strip().upper())
                   if unicodedata.category(c) != 'Mn')

def generate_seo_fields(numero, modalidade, uf, cidade, bairro, desconto_moeda, tipo):
    tipo    = str(tipo    or 'Imóvel').replace('None', 'Imóvel')
    bairro  = str(bairro  or '').replace('None', '')
    cidade  = str(cidade  or '').replace('None', '')
    uf      = str(uf      or '').replace('None', '')
    titulo = f"🔴 {tipo} {bairro} {cidade} {uf} {numero} Imóvel CAIXA 🧡💙"
    def fmt_brl(val):
        return f"R$ {float(val):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    descricao = f"Imóvel CAIXA {tipo} {bairro} {cidade} {uf} com desconto de {fmt_brl(desconto_moeda)}. ⚠️ Estamos Online!"
    keyword   = f"{tipo} {bairro} {cidade} {uf}"
    def seo_part(text):
        if not text: return ""
        n = "".join(c for c in unicodedata.normalize('NFD', str(text).strip().lower())
                    if unicodedata.category(c) != 'Mn')
        n = n.replace(" ", "_").replace("-", "_")
        return re.sub(r'[^a-z0-9_]', '', n)
    slug = f"{seo_part(tipo)}-{seo_part(bairro)}-{seo_part(cidade)}-{seo_part(uf)}-{numero}"
    return titulo, slug, descricao, keyword

def fix_batch():
    print("[FIX] Iniciando correção dos imóveis do RJ (29/03)...")
    
    # 1. Busca todos os imóveis do RJ importados em 29/03
    # Precisamos do id_uf = 19
    query = supabase.table("atualizacoes_imovel") \
        .select("id, imovel_id, imovel_caixa_valor_venda, imovel_caixa_valor_avaliacao") \
        .eq("created_at::date", "2026-03-29") \
        .execute()
    
    updates = query.data
    print(f"[FIX] Encontrados {len(updates)} registros para corrigir.")
    
    # Cache de grupos para recálculo financeiro
    grupos = supabase.table("grupos_imovel").select("*").order("valor_minimo").execute().data
    
    # Cache de metadados dos imóveis para SEO
    # Como são muitos, vamos processar em pequenos lotes para não estourar memória
    for i in range(0, len(updates), 50):
        batch = updates[i:i+50]
        imovel_ids = [item['imovel_id'] for item in batch]
        
        # Busca detalhes dos imóveis para SEO
        imoveis_data = supabase.table("imoveis").select(
            "imoveis_id, imovel_caixa_numero, id_tipo_imovel_caixa, id_cidade_imovel_caixa, id_uf_imovel_caixa, id_bairro_imovel_caixa"
        ).in_("imoveis_id", imovel_ids).execute().data
        
        # Mapeamento para busca rápida
        imv_map = {row['imoveis_id']: row for row in imoveis_data}
        
        # Tabelas auxiliares para nomes (cache rápido por ID)
        u_uf = {19: "RJ"} # Simplificado para RJ
        u_cidades = {r['id']: r['nome'] for r in supabase.table("cidades").select("id, nome").eq("id_uf", 19).execute().data}
        u_tipos = {r['id']: r['nome'] for r in supabase.table("tipos_imovel").select("id, nome").execute().data}
        # Bairros buscamos sob demanda ou cacheamos os do lote
        b_ids = [row['id_bairro_imovel_caixa'] for row in imoveis_data if row['id_bairro_imovel_caixa']]
        u_bairros = {r['id']: r['nome'] for r in supabase.table("bairros").select("id, nome").in_("id", b_ids).execute().data} if b_ids else {}

        for hist in batch:
            h_id = hist['id']
            imv_id = hist['imovel_id']
            
            # 1. Divide os valores por 100
            new_venda = float(hist['imovel_caixa_valor_venda']) / 100
            new_eval  = float(hist['imovel_caixa_valor_avaliacao']) / 100
            new_desc_moeda = new_eval - new_venda
            
            # 2. Recalcula financiamento
            entrada = prestacao = 0.0
            for g in grupos:
                if float(g['valor_minimo'] or 0) <= new_venda <= float(g['valor_maximo'] or 1e12):
                    entrada = new_venda * float(g.get('compra_financiamento_entrada_caixa') or 0.05)
                    prestacao = new_venda * float(g.get('compra_financiamento_prestacao') or 0.006)
                    break
            
            # 3. Atualiza Histórico
            supabase.table("atualizacoes_imovel").update({
                "imovel_caixa_valor_venda": new_venda,
                "imovel_caixa_valor_avaliacao": new_eval,
                "imovel_caixa_valor_desconto_moeda": new_desc_moeda,
                "imovel_caixa_pagamento_financiamento_entrada": entrada,
                "imovel_caixa_pagamento_financiamento_prestacao": prestacao
            }).eq("id", h_id).execute()
            
            # 4. Atualiza SEO no Imovel Principal
            imv = imv_map.get(imv_id)
            if imv:
                titulo, slug, desc_seo, keyword = generate_seo_fields(
                    imv['imovel_caixa_numero'], "", 
                    u_uf.get(imv['id_uf_imovel_caixa'], ""),
                    u_cidades.get(imv['id_cidade_imovel_caixa'], ""),
                    u_bairros.get(imv['id_bairro_imovel_caixa'], ""),
                    new_desc_moeda,
                    u_tipos.get(imv['id_tipo_imovel_caixa'], "Imóvel")
                )
                
                supabase.table("imoveis").update({
                    "imovel_caixa_post_titulo": titulo,
                    "imovel_caixa_post_link_permanente": slug,
                    "imovel_caixa_post_descricao": desc_seo,
                    "imovel_caixa_post_palavra_chave": keyword
                }).eq("imoveis_id", imv_id).execute()

        print(f"  [OK] Lote {i//50 + 1} processado.")

if __name__ == "__main__":
    fix_batch()
