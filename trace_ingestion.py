import os
import sys
from dotenv import load_dotenv
from pathlib import Path

# Adiciona o diretório atual ao path para importar o ingest_caixa_csv
sys.path.insert(0, str(Path(__file__).parent))
import ingest_caixa_csv

print("INICIANDO TESTE DE INGESTAO CONTROLADA (RJ ID 23)")
csv_path = "automation/csv-caixa/remote_1774491028940_Lista_imoveis_RJ-03-24.csv"

# Rodamos apenas 200 linhas para ver se os primeiros batches falham
filename, stats = ingest_caixa_csv.ingest_csv(csv_path)

print("\nRESULTADOS DO TESTE:")
print(stats)
