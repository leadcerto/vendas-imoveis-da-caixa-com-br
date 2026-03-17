import pandas as pd
import os

CSV_PATH = "csv-caixa/10-03-2026-Lista_imoveis_RJ.csv"

# Teste com header=2
try:
    df = pd.read_csv(CSV_PATH, sep=";", encoding="latin1", header=2)
    print(f"Header=2: {len(df)} linhas lidas.")
    print(f"Colunas: {list(df.columns)}")
    print(f"Primeira linha: {df.iloc[0].to_dict()}")
except Exception as e:
    print(f"Erro com header=2: {e}")

# Teste com header=1
try:
    df1 = pd.read_csv(CSV_PATH, sep=";", encoding="latin1", header=1)
    print(f"\nHeader=1: {len(df1)} linhas lidas.")
    print(f"Colunas: {list(df1.columns)}")
except Exception as e:
    print(f"Erro com header=1: {e}")
