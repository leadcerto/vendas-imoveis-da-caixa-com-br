import pandas as pd

file_path = r'c:\Users\PICHAU\Desktop\antigravity\venda-imoveis-caixa\automation\csv-caixa-xlsx\03-29-Lista_imoveis_RJ.xlsx'

try:
    df = pd.read_excel(file_path)
    row = df[df['imovel_caixa_numero'].astype(str).str.contains('8444409879488')].iloc[0]
    print(f"8444409879488 Excel Venda: '{row['imovel_caixa_valor_venda']}'")
    print(f"8444409879488 Excel Avaliacao: '{row['imovel_caixa_valor_avaliacao']}'")
except Exception as e:
    print(f"Error: {e}")
