import pandas as pd
import unicodedata

def normalize_text(text):
    if not text: return ""
    return "".join(c for c in unicodedata.normalize('NFD', str(text).strip().upper())
                   if unicodedata.category(c) != 'Mn')

def get_col(df, frags):
    for c in df.columns:
        if any(f.lower() in c.lower() for f in frags):
            return c
    return None

file_path = r"automation\csv-caixa\03-29-Lista_imoveis_RJ.xlsx"
df = pd.read_excel(file_path, dtype=str)
df.columns = [str(c).strip() for c in df.columns]

print(f"Colunas do DF: {list(df.columns)}")

MODALIDADES_ACEITAS = ["Venda Online", "Venda Direta Online"]
DESCONTO_MINIMO = 30.0

c_modalidade = get_col(df, ['modalidade', 'Modalidade', 'MODALIDADE', 'Venda', 'venda'])
c_desconto = get_col(df, ['desconto', 'Desconto', 'DESCONTO'])

print(f"Mapping: modalidade->{c_modalidade}, desconto->{c_desconto}")

for idx, row in df.head(10).iterrows():
    modalidade = str(row.get(c_modalidade, '')).strip() if c_modalidade else ''
    desconto_raw = str(row.get(c_desconto, '0'))
    
    try:
        desconto = float(desconto_raw.replace('%', '').replace(',', '.').strip())
        if 0 < desconto < 1.0:
            desconto *= 100
    except:
        desconto = 0.0
    
    mod_ok = modalidade.lower() in [m.lower() for m in MODALIDADES_ACEITAS]
    desc_ok = desconto >= DESCONTO_MINIMO
    
    print(f"Row {idx}:")
    print(f"  Modalidade: '{modalidade}' | Lower: '{modalidade.lower()}' | OK: {mod_ok}")
    print(f"  Desconto: {desconto} (Raw: '{desconto_raw}') | OK: {desc_ok}")
    print(f"  Total OK: {mod_ok and desc_ok}")
