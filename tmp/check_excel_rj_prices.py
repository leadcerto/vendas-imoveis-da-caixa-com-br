import pandas as pd

file_path = r'c:\Users\PICHAU\Desktop\antigravity\venda-imoveis-caixa\automation\csv-caixa-xlsx\03-29-Lista_imoveis_RJ.xlsx'

try:
    df = pd.read_excel(file_path)
    # Check column names carefully
    print("Found columns:", df.columns.tolist())
    
    # Let's see some actual values for the price columns
    price_cols = [col for col in df.columns if 'valor' in col.lower()]
    print("\nPrice related columns found:", price_cols)
    
    if price_cols:
        subset = df[['imovel_caixa_numero'] + price_cols].head(10)
        print("\nFirst 10 rows with prices:")
        print(subset.to_string())
except Exception as e:
    print(f"Error: {e}")
