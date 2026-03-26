import pandas as pd
import sys

file_path = r"c:\Users\PICHAU\Desktop\antigravity\venda-imoveis-caixa\automation\csv-caixa\remote_1774490274493_Lista_imoveis_SP.csv"

# Find header
header_idx = 0
with open(file_path, 'r', encoding='latin1') as f:
    for i, line in enumerate(f):
        if i > 150: break
        clean_line = line.strip().lower()
        if len([k for k in ["imóvel", "cidade", "bairro", "desconto"] if k in clean_line]) >= 3:
            header_idx = i
            print(f"HEADER AT LINE {i}: {line.strip()}")
            break

df = pd.read_csv(file_path, sep=';', encoding='latin1', skiprows=header_idx, on_bad_lines='skip')
print("\nCOLUMNS FOUND:")
print(df.columns.tolist())
print("\nFIRST 5 ROWS:")
print(df.head(5).to_string())
