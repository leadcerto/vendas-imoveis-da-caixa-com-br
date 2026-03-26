import pandas as pd
import os
from pathlib import Path

csv_path = "automation/csv-caixa/remote_1774491028940_Lista_imoveis_RJ-03-24.csv"

def get_col(df, frags):
    for c in df.columns:
        if any(f.lower() in c.lower() for f in frags): return c
    return None

try:
    # Simula a detecção de header do script original
    header_idx = 0
    with open(csv_path, 'r', encoding='latin1') as f:
        for i, line in enumerate(f):
            if i > 150: break
            clean_line = line.strip().lower()
            if len([k for k in ["imóvel", "cidade", "bairro", "desconto"] if k in clean_line]) >= 3:
                header_idx = i
                print(f"Header detectado na linha {i}")
                break
    
    df = pd.read_csv(csv_path, sep=';', encoding='latin1', skiprows=header_idx, on_bad_lines='skip')
    df.columns = [str(c).strip() for c in df.columns]
    
    c_num = get_col(df, ['N° do imóvel', 'Nº do imóvel', 'numero'])
    c_mod = get_col(df, ['Modalidade'])
    
    print(f"Colunas encontradas: Number={c_num}, Modalidade={c_mod}")
    
    stats = {"total": 0, "num_invalido": 0, "mod_invalida": 0, "ok": 0}
    MODS_ACEITAS = ["Venda Online", "Venda Direta Online"]
    
    for i, row in df.iterrows():
        stats["total"] += 1
        num_raw = row.get(c_num)
        if pd.isna(num_raw):
            stats["num_invalido"] += 1
            if i < 10: print(f"Linha {i}: Num RAW é NaN")
            continue
            
        try:
            s_num = str(num_raw).replace(',', '.').strip()
            num_val = pd.to_numeric(s_num, errors='coerce')
            numero = int(num_val)
        except Exception as e:
            stats["num_invalido"] += 1
            if i < 10: print(f"Linha {i}: Erro parse num '{num_raw}': {e}")
            continue
            
        mod_raw = str(row.get(c_mod, '')).strip()
        if mod_raw not in MODS_ACEITAS:
            stats["mod_invalida"] += 1
            if i < 10: print(f"Linha {i}: Mod invalida '{mod_raw}'")
            continue
            
        stats["ok"] += 1

    print("\nRESUMO FINAL:")
    print(stats)
except Exception as e:
    print(f"Erro Fatal: {e}")
