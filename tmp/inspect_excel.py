import pandas as pd
import sys

file_path = "c:/Users/PICHAU/Desktop/antigravity/venda-imoveis-caixa/automation/csv-caixa-xlsx/03-29-Lista_imoveis_RJ.xlsx"
df = pd.read_excel(file_path)
print("Columns:", df.columns.tolist())
print("\nFirst 5 rows:")
print(df.head())
