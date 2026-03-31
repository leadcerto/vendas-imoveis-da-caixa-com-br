import os
import sys
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client
from pathlib import Path

# Adiciona o diretório raiz ao path
sys.path.append(str(Path(__file__).parent.parent))

# Importa o ingest_caixa_csv (temos que importar as classes necessárias)
from automation.tools.ingest_caixa_csv import MasterDataLoader, ingest_csv, supabase

def re_ingest_rj():
    print("[RE-INGEST] Iniciando re-importação controlada do RJ...")
    file_path = r'c:\Users\PICHAU\Desktop\antigravity\venda-imoveis-caixa\automation\csv-caixa-xlsx\03-29-Lista_imoveis_RJ.xlsx'
    
    master = MasterDataLoader(supabase)
    
    # Vamos rodar apenas a ingestão desse arquivo
    # O script original já foi corrigido, então o parse_brl_numeric será usado.
    ingest_csv(file_path, master)
    print("[RE-INGEST] Concluído.")

if __name__ == "__main__":
    re_ingest_rj()
