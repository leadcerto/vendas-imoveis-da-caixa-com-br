"""
Normalizador específico para nomes de bairros.
"""

import json
import re
from pathlib import Path
from typing import Optional, Tuple
import pandas as pd
from unidecode import unidecode
from fuzzywuzzy import process, fuzz

from .rules import (
    PREFIXES_TO_REMOVE,
    SPECIFIC_REPLACEMENTS,
    DISTRICT_NORMALIZATIONS
)

class BairroNormalizer:
    """
    Normaliza nomes de bairros usando regras e mapeamentos.
    """
    
    def __init__(self, mapping_path: Optional[str] = None):
        """
        Args:
            mapping_path: Caminho para bairros_normalizacao.json (opcional)
        """
        self.mapping_path = mapping_path
        self.mappings = self._load_mappings() if mapping_path else {}
        self.variant_index = self._build_variant_index()
        self.confidence_cache = {}
        
    def _load_mappings(self) -> dict:
        """Carrega arquivo de mapeamentos"""
        if not self.mapping_path or not Path(self.mapping_path).exists():
            return {}
        try:
            with open(self.mapping_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return data.get('mappings', {})
        except Exception:
            return {}
    
    def _build_variant_index(self) -> dict:
        """
        Cria índice invertido: {variante: nome_normalizado}
        """
        index = {}
        
        for key, data in self.mappings.items():
            normalized = data['normalized']
            index[normalized.upper()] = normalized
            index[key.upper()] = normalized
            
            for variant in data.get('variants', []):
                index[variant.upper()] = normalized
        
        return index
    
    def _clean_text(self, text: str) -> str:
        """Limpeza inicial: strip + uppercase + remove acentos"""
        if not text: return ""
        # Remove acentos e converte para maiúsculas
        return unidecode(str(text)).strip().upper()

    def normalize(self, bairro_raw: str) -> str:
        """Pipeline de normalização"""
        if pd.isna(bairro_raw) or str(bairro_raw).strip() == '':
            return None
        
        bairro_raw = str(bairro_raw).strip()
        
        # 1. Limpeza básica (Sem acentos para busca no índice)
        cleaned = self._clean_text(bairro_raw)
        
        # 2. Busca exata no índice de variantes (Se existir mapeamento)
        if cleaned in self.variant_index:
            self.confidence_cache[bairro_raw] = 1.0
            return self.variant_index[cleaned]
        
        # 3. Mapeamento de Distritos
        if cleaned in DISTRICT_NORMALIZATIONS:
            self.confidence_cache[bairro_raw] = 1.0
            return DISTRICT_NORMALIZATIONS[cleaned]
        
        # 4. Processamento de Texto (Remover prefixos, etc)
        processed = cleaned
        for prefix in PREFIXES_TO_REMOVE:
            if processed.startswith(prefix):
                processed = processed[len(prefix):].strip()
                break
        
        for abbrev, full in SPECIFIC_REPLACEMENTS.items():
            processed = processed.replace(abbrev, full)
            
        # 5. Remove conteúdo entre parênteses para busca simplificada
        processed_simple = re.sub(r'\s*\([^)]*\)', '', processed).strip()
        
        # 6. Nova busca no índice com o texto processado
        if processed_simple in self.variant_index:
            self.confidence_cache[bairro_raw] = 0.95
            return self.variant_index[processed_simple]
            
        # 7. Busca Fuzzy (Apenas se houver índice)
        if self.variant_index:
            all_variants = list(self.variant_index.keys())
            result = process.extractOne(processed_simple, all_variants, scorer=fuzz.ratio)
            if result and result[1] >= 85:
                match = result[0]
                self.confidence_cache[bairro_raw] = result[1] / 100.0
                return self.variant_index[match]

        # 8. Fallback: Mantém o original limpo e formatado se nada funcionar
        # Vamos manter o original com acentos se possível, removendo apenas lixo
        self.confidence_cache[bairro_raw] = 0.5
        
        # Se não temos mapeamento, retornamos o original CAPITALIZADO (ou uppercase)
        # Para consistência com o que já temos:
        return bairro_raw.upper().strip()
    
    def get_confidence(self, value: str) -> float:
        """Retorna confiança da última normalização"""
        return self.confidence_cache.get(value, 1.0)
