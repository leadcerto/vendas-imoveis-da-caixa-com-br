import pandas as pd

file_path = r'c:\Users\PICHAU\Desktop\antigravity\venda-imoveis-caixa\automation\csv-caixa-xlsx\03-29-Lista_imoveis_RJ.xlsx'

try:
    df = pd.read_excel(file_path)
    # Search for property 1555529631991
    # Note: it might be as int or str in df
    row = df[df['imovel_caixa_numero'].astype(str).str.contains('1555529631991')]
    if not row.empty:
        print("Found row in Excel:")
        print(row[['imovel_caixa_numero', 'imovel_caixa_valor_venda', 'imovel_caixa_valor_avaliacao']].to_string())
    else:
        print("Property not found in Excel by that number.")
        # Try finding any row to see format
        print("\nFirst 3 rows values:")
        print(df[['imovel_caixa_numero', 'imovel_caixa_valor_venda', 'imovel_caixa_valor_avaliacao']].head(3).to_string())
except Exception as e:
    print(f"Error: {e}")
