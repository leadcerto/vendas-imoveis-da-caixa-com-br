import pandas as pd

def inspect():
    file_path = 'c:/Users/PICHAU/Desktop/antigravity/venda-imoveis-caixa/dev-csv-imoveis/2023-03-10-Lista_imoveis_RJ.csv'
    # Try different skip rows and encodings
    try:
        df = pd.read_csv(file_path, sep=';', encoding='iso-8859-1', skiprows=2, nrows=5)
        print("Columns found:")
        print(df.columns.tolist())
        print("\nFirst row data:")
        for col, val in df.iloc[0].to_dict().items():
            print(f"{col}: {val}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect()
