import pandas as pd
df = pd.read_excel('c:/Users/PICHAU/Desktop/antigravity/venda-imoveis-caixa/automation/csv-caixa-xlsx/03-27-Lista_imoveis_RJ.xlsx')
print(df.columns.tolist())
try:
    print(df.iloc[0].to_dict())
except:
    pass
