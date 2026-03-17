"""
Gera o arquivo de mapeamento bairros_normalizacao.json
"""

import json
from pathlib import Path
from datetime import datetime

def main():
    ANALYSIS_FILE = "csv-caixa/bairros_analysis.json"
    OUTPUT_FILE = "csv-caixa/bairros_normalizacao.json"
    
    if not Path(ANALYSIS_FILE).exists():
        print(f"Erro: {ANALYSIS_FILE} nao encontrado. Rode analyze_bairros.py primeiro.")
        return
        
    with open(ANALYSIS_FILE, 'r', encoding='utf-8') as f:
        analysis = json.load(f)
        
    mappings = {}
    for grupo in analysis['grupos']:
        principal = grupo['principal']
        variantes = [v['nome'] for v in grupo['variantes']]
        
        # O nome normalizado por padrão será o "principal" (o que apareceu primeiro/mais)
        mappings[principal.upper()] = {
            "normalized": principal,
            "variants": variantes
        }
        
    output = {
        "version": "1.0.0",
        "last_updated": datetime.now().isoformat(),
        "mappings": mappings
    }
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
        
    print(f"Mapeamento gerado em {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
