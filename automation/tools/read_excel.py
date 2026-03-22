import pandas as pd

file_path = r'c:\Users\PICHAU\Desktop\antigravity\venda-imoveis-caixa\supabase\estados cidades e bairros.xlsx'
xl = pd.ExcelFile(file_path)

for sheet in xl.sheet_names:
    df = xl.parse(sheet)
    print(f"Sheet '{sheet}': {len(df)} rows")
