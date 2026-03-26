import pandas as pd

file_path = r"c:\Users\PICHAU\Desktop\antigravity\venda-imoveis-caixa\automation\csv-caixa\remote_1774490274493_Lista_imoveis_SP.csv"

# Read raw first few lines to see them clearly
with open(file_path, 'r', encoding='latin1') as f:
    lines = [f.readline() for _ in range(5)]
    for i, l in enumerate(lines):
        print(f"L{i}: {repr(l)}")

# Try reading sample data
df = pd.read_csv(file_path, sep=';', encoding='latin1', skiprows=1, on_bad_lines='skip')
print("\nDATAFRAME INFO:")
print(f"Columns: {df.columns.tolist()}")
print("\nFIRST 3 ROWS DATA:")
for i, row in df.head(3).iterrows():
    print(f"Row {i}:")
    for col in df.columns:
        print(f"  {col}: {repr(row[col])}")
