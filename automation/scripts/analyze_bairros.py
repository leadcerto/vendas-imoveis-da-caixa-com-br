"""
Script para análise inicial dos bairros no CSV.
Uso: python scripts/analyze_bairros.py
"""

import sys
import os
import pandas as pd
import json
from pathlib import Path
from collections import defaultdict
from fuzzywuzzy import fuzz
from unidecode import unidecode

# Adiciona o diretório raiz ao path
sys.path.insert(0, str(Path(__file__).parent.parent))

from modules.data_processing.normalizers.rules import PREFIXES_TO_REMOVE

class BairroAnalyzer:
    def __init__(self, similarity_threshold: int = 85):
        self.threshold = similarity_threshold
        
    def _clean_basic(self, text: str) -> str:
        if pd.isna(text): return ""
        cleaned = unidecode(str(text)).upper().strip()
        for prefix in PREFIXES_TO_REMOVE:
            if cleaned.startswith(prefix):
                cleaned = cleaned[len(prefix):].strip()
        return cleaned

    def analyze_csv(self, csv_path: str, column_name: str = 'Bairro') -> dict:
        print(f"Lendo {csv_path}...")
        df = pd.read_csv(csv_path, sep=";", encoding="latin1", header=1)
        # Limpa nomes das colunas
        df.columns = [c.strip() for c in df.columns]
        
        bairros_unicos = df[column_name].dropna().unique()
        print(f"Variantes encontradas: {len(bairros_unicos)}")
        
        processados = set()
        grupos = []
        
        for i, b1 in enumerate(bairros_unicos):
            if b1 in processados: continue
            
            clean1 = self._clean_basic(b1)
            grupo = {
                'principal': b1,
                'variantes': [],
                'count': int((df[column_name] == b1).sum())
            }
            
            for j, b2 in enumerate(bairros_unicos):
                if i == j or b2 in processados: continue
                
                clean2 = self._clean_basic(b2)
                score = fuzz.ratio(clean1, clean2)
                
                if score >= self.threshold:
                    grupo['variantes'].append({
                        'nome': b2,
                        'similarity': score,
                        'count': int((df[column_name] == b2).sum())
                    })
                    processados.add(b2)
            
            processados.add(b1)
            if grupo['variantes']:
                grupos.append(grupo)
                
        return {
            'total_variantes': len(bairros_unicos),
            'grupos_identificados': len(grupos),
            'grupos': grupos
        }

def main():
    INPUT_CSV = "csv-caixa/05-03-2026-Lista_imoveis_RJ.csv"
    OUTPUT_JSON = "csv-caixa/bairros_analysis.json"
    
    if not Path(INPUT_CSV).exists():
        print(f"Erro: Arquivo {INPUT_CSV} nao encontrado.")
        return

    analyzer = BairroAnalyzer()
    result = analyzer.analyze_csv(INPUT_CSV)
    
    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
        
    print(f"Analise salva em {OUTPUT_JSON}")

if __name__ == "__main__":
    main()
