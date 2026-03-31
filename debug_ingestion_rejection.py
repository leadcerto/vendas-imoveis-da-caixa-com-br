import pandas as pd
import re

file_path = r"automation\csv-caixa\03-29-Lista_imoveis_RJ.xlsx"
df = pd.read_excel(file_path, dtype=str)

MODALIDADES_ACEITAS = ["Venda Online", "Venda Direta Online"]
DESCONTO_MINIMO = 30.0

def get_col(df, frags):
    for c in df.columns:
        if any(f.lower() in c.lower() for f in frags):
            return c
    return None

c_desconto = get_col(df, ['desconto'])
c_modalidade = get_col(df, ['modalidade'])

print(f"Colunas: {c_desconto}, {c_modalidade}")

for idx, row in df.head(10).iterrows():
    modalidade = str(row.get(c_modalidade, '')).strip()
    desconto_raw = str(row.get(c_desconto, '0'))
    try:
        desconto = float(desconto_raw.replace('%', '').replace(',', '.').strip())
        if 0 < desconto < 1.0:
            desconto *= 100
    except:
        desconto = 0.0
    
    mod_ok = modalidade.lower() in [m.lower() for m in MODALIDADES_ACEITAS]
    desc_ok = desconto >= DESCONTO_MINIMO
    
    print(f"Row {idx}: Mod='{modalidade}' (OK:{mod_ok}) | Desc={desconto} (OK:{desc_ok})")
