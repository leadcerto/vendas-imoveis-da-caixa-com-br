import pandas as pd
import os
from pathlib import Path

csv_path = Path("c:/Users/PICHAU/Desktop/antigravity/venda-imoveis-caixa/automation/csv-caixa/remote_1774487063596_Lista_imoveis_ES.csv")

if not csv_path.exists():
    print(f"File not found: {csv_path}")
    exit(1)

try:
    # Simular o skip de linhas que o script original faz
    df = pd.read_csv(csv_path, sep=';', encoding='latin1', skiprows=0, on_bad_lines='skip')
    # Localizar cabeçalho se necessário
    print(f"Columns found: {df.columns.tolist()}")
    
    c_numero = 'N° do imóvel' if 'N° do imóvel' in df.columns else df.columns[0]
    first_vals = df[c_numero].head(5).tolist()
    print(f"First numbers (raw): {first_vals}")
    
    for val in first_vals:
        num_str = str(val).strip().split('.')[0]
        print(f"Parsed: {num_str}")
        
except Exception as e:
    print(f"Error: {e}")
