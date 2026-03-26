import pandas as pd
import os
from pathlib import Path

csv_path = "c:/Users/PICHAU/Desktop/antigravity/venda-imoveis-caixa/automation/csv-caixa/remote_1774486877129_Lista_imoveis_ES.csv"

try:
    header_idx = 0
    with open(csv_path, 'r', encoding='latin1') as f:
        for i, line in enumerate(f):
            if i > 50: break
            if "uf;cidade;bairro" in line.lower():
                header_idx = i
                break
    
    df = pd.read_csv(csv_path, sep=';', encoding='latin1', skiprows=header_idx, on_bad_lines='skip')
    df.columns = [str(c).strip() for c in df.columns]
    print(f"Columns: {df.columns.tolist()}")
    
    def get_col(df, fragments):
        for col in df.columns:
            if any(f.lower() in col.lower() for f in fragments):
                return col
        return None

    c_num = get_col(df, ['N° do imóvel', 'Nº do imóvel', 'numero'])
    c_mod = get_col(df, ['Modalidade'])
    c_desc = get_col(df, ['Desconto'])

    print(f"Mapped Columns: Num={c_num}, Mod={c_mod}, Desc={c_desc}")
    print("\nSample Data:")
    
    subset = df[[c_num, c_mod, c_desc]].head(10)
    print(subset)
    
    # Check if they would be accepted
    MODALIDADES_ACEITAS = ["Venda Online", "Venda Direta Online"]
    DESCONTO_MINIMO = 30.0
    
    print("\nAcceptance Test:")
    for i, row in subset.iterrows():
        mod = str(row[c_mod]).strip()
        # Parse discount (Brazilian format 0,00)
        desc_str = str(row[c_desc]).replace('%', '').replace(',', '.').strip()
        try:
            desc_val = float(desc_str)
        except:
            desc_val = 0.0
        
        accepted_mod = mod in MODALIDADES_ACEITAS
        accepted_desc = desc_val >= DESCONTO_MINIMO
        print(f"Row {i}: Num={row[c_num]}, Mod='{mod}' ({accepted_mod}), Desc={desc_val}% ({accepted_desc}) -> Final: {accepted_mod and accepted_desc}")

except Exception as e:
    print(f"Error: {e}")
