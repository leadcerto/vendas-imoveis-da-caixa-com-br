"""
Script para atualizar retroativamente os bairros já cadastrados no Supabase.
"""

import os
import sys
import pandas as pd
from dotenv import load_dotenv
from pathlib import Path
from supabase import create_client, Client

# Adiciona o diretório raiz ao path para importar o normalizador
sys.path.insert(0, str(Path(__file__).parent.parent))

from modules.data_processing.normalizers.bairro_normalizer import BairroNormalizer

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
CSV_DIR = "csv-caixa"

def update_existing_bairros():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[ERRO] SUPABASE_URL ou SUPABASE_KEY nao encontrados no .env")
        return

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    normalizer = BairroNormalizer(mapping_path=os.path.join(CSV_DIR, "bairros_normalizacao.json"))

    print("--- Iniciando Re-normalizacao da Base Existente ---")

    # Busca todos os registros (ou em lotes para evitar timeout)
    # Nota: Consultas grandes no Supabase podem precisar de paginação
    limit = 1000
    offset = 0
    total_updated = 0

    while True:
        response = supabase.table("imoveis_caixa").select("numero_imovel, data_geracao, bairro").range(offset, offset + limit - 1).execute()
        records = response.data
        
        if not records:
            break
            
        print(f"Processando lote: {offset} ate {offset + len(records)}")
        
        updates = []
        for rec in records:
            bairro_original = rec.get("bairro")
            if not bairro_original:
                continue
                
            bairro_normalizado = normalizer.normalize(bairro_original)
            
            # Só atualiza se houver mudança
            if bairro_normalizado and bairro_normalizado != bairro_original:
                updates.append({
                    "numero_imovel": rec["numero_imovel"],
                    "data_geracao": rec["data_geracao"], # Necessário para o upsert/not null
                    "bairro": bairro_normalizado
                })

        if updates:
            try:
                # Upsert usando numero_imovel e data_geracao
                supabase.table("imoveis_caixa").upsert(updates).execute()
                total_updated += len(updates)
                print(f"  [OK] {len(updates)} bairros atualizados neste lote.")
            except Exception as e:
                print(f"  [ERRO] Detalhes da falha: {str(e)}")



        if len(records) < limit:
            break
            
        offset += limit

    print(f"\n[CONCLUIDO] Total de registros atualizados: {total_updated}")

if __name__ == "__main__":
    update_existing_bairros()
