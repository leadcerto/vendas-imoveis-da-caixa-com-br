import pandas as pd

file_path = r'c:\Users\PICHAU\Desktop\antigravity\venda-imoveis-caixa\automation\csv-caixa-xlsx\03-29-Lista_imoveis_RJ.xlsx'

try:
    df = pd.read_excel(file_path, dtype=str)
    row = df[df['imovel_caixa_numero'].astype(str).str.contains('1555529631991')].iloc[0]
    print(f"Excel Venda (dtype=str): '{row['imovel_caixa_valor_venda']}'")
    print(f"Excel Avaliacao (dtype=str): '{row['imovel_caixa_valor_avaliacao']}'")
except Exception as e:
    print(f"Error: {e}")
