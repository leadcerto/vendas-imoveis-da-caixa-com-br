import pandas as pd
import json

file_path = r"automation\csv-caixa\03-29-Lista_imoveis_RJ.xlsx"
df = pd.read_excel(file_path, nrows=5)
info = {
    "columns": df.columns.tolist(),
    "head": df.head(3).astype(str).to_dict()
}
with open("tmp_excel_info.json", "w", encoding="utf-8") as f:
    json.dump(info, f, indent=4, ensure_ascii=False)
