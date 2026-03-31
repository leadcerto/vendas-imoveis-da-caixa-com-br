import pandas as pd
import json
from datetime import datetime

file_path = r'c:\Users\PICHAU\Desktop\antigravity\venda-imoveis-caixa\automation\csv-caixa-xlsx\03-29-Lista_imoveis_RJ.xlsx'

def json_serial(obj):
    if isinstance(obj, (datetime, pd.Timestamp)):
        return obj.isoformat()
    return str(obj)

try:
    df = pd.read_excel(file_path)
    first_row = df.iloc[0].to_dict()
    # Manual serialization since JSON is failing on TIMESTAMP.
    output = {}
    for k, v in first_row.items():
        if pd.notnull(v):
            if isinstance(v, (datetime, pd.Timestamp)):
                output[k] = v.isoformat()
            else:
                output[k] = v
        else:
            output[k] = None
    print(json.dumps(output, indent=2, ensure_ascii=False))
except Exception as e:
    print(f"Error: {e}")
