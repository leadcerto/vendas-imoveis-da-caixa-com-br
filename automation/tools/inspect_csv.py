import pandas as pd

file_path = r'c:\Users\PICHAU\Desktop\antigravity\venda-imoveis-caixa\automation\csv-caixa\10-03-2026-Lista_imoveis_RJ.csv'

try:
    # Try different skiprows
    for s in [0, 1, 2, 3]:
        df = pd.read_csv(file_path, sep=';', encoding='latin1', skiprows=s, on_bad_lines='skip', nrows=10)
        print(f"\n--- Skiprows {s} ---")
        print("Columns:", df.columns.tolist())
        print("First row:", df.iloc[0].values if len(df) > 0 else "Empty")
except Exception as e:
    print(f"Error: {e}")
