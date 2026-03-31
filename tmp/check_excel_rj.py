import pandas as pd

file_path = r'c:\Users\PICHAU\Desktop\antigravity\venda-imoveis-caixa\automation\csv-caixa-xlsx\03-29-Lista_imoveis_RJ.xlsx'

try:
    df = pd.read_excel(file_path)
    print("Columns:", df.columns.tolist())
    print("\nFirst 5 rows (relevant columns):")
    cols = ['Nº do imóvel', 'Valor de avaliação', 'Valor de venda']
    available_cols = [c for c in cols if c in df.columns]
    print(df[available_cols].head(5))
except Exception as e:
    print(f"Error: {e}")
