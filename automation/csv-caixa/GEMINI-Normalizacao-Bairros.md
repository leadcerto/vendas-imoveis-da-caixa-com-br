Especificação Técnica: Normalização de Bairros - Sistema Antigravity
📋 Contexto do Projeto
Problema Identificado
O sistema atualmente possui uma base de dados de imóveis com inconsistências nos nomes de bairros, causadas por:

Variações ortográficas (JACAREPAGUA vs JACAREPAGUÁ)
Diferenças de acentuação (CABUCU vs CABUÇU)
Abreviações inconsistentes (JD DA PAZ vs JARDIM DA PAZ)
Prefixos variados (LOT, COND, PARQUE, etc.)
Erros de digitação
Distritos/localidades entre parênteses (CENTRO vs CENTRO (CABUCU))
Impacto no Sistema
Buscas fragmentadas: Usuários que buscam por "Jacarepaguá" não encontram imóveis cadastrados como "JACAREPAGUA" ou "FREG DE JACAREPAGUA"
Dados duplicados: O mesmo bairro aparece múltiplas vezes em listas de seleção
Experiência do usuário prejudicada: Dificuldade em filtrar imóveis por localização
Objetivo da Solução
Implementar um pipeline de normalização de dados que:

Identifique e agrupe variantes do mesmo bairro
Padronize nomes em um formato único e consistente
Preserve dados originais para auditoria
Permita buscas flexíveis (usuário pode buscar por qualquer variante)
Mantenha integridade referencial no banco de dados
🎯 Habilidades Necessárias
Conhecimentos Técnicos Requeridos
Python: Manipulação de dados com Pandas, lógica de normalização
SQL/SQLAlchemy: Modelagem de banco de dados, relacionamentos
Fuzzy Matching: Algoritmos de similaridade de strings (Levenshtein)
ETL: Processos de extração, transformação e carga de dados
Pydantic: Validação de schemas
FastAPI (opcional): Implementação de endpoints de busca
Bibliotecas Python a Utilizar
txt


pandas>=2.0.0
unidecode>=1.3.6
fuzzywuzzy>=0.18.0
python-Levenshtein>=0.21.0
pydantic>=2.0.0
sqlalchemy>=2.0.0
📁 Estrutura de Arquivos a Criar


antigravity/
├── data/
│   ├── raw/
│   │   └── imoveis_original.csv          # CSV original (não modificar)
│   ├── processed/
│   │   └── imoveis_normalized.csv        # CSV após normalização
│   ├── mappings/
│   │   ├── bairros_normalizacao.json     # Mapeamento DE-PARA
│   │   ├── bairros_master.json           # Lista única de bairros válidos
│   │   └── bairros_analysis.json         # Relatório de análise inicial
│   └── reports/
│       └── normalization_report.json     # Relatório do processamento
│
├── modules/
│   ├── data_processing/
│   │   ├── __init__.py
│   │   ├── normalizers/
│   │   │   ├── __init__.py
│   │   │   ├── base_normalizer.py        # Classe abstrata base
│   │   │   ├── bairro_normalizer.py      # Normalizador específico
│   │   │   └── rules.py                  # Regras de normalização
│   │   ├── validators/
│   │   │   ├── __init__.py
│   │   │   └── geo_validator.py          # Validação geográfica
│   │   ├── analyzers/
│   │   │   ├── __init__.py
│   │   │   └── bairro_analyzer.py        # Análise de similaridade
│   │   └── pipeline.py                   # Orquestração ETL
│   │
│   ├── database/
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── bairro.py                 # Modelo Bairro e BairroVariante
│   │   │   └── imovel.py                 # Modelo Imovel (atualizado)
│   │   ├── repositories/
│   │   │   ├── __init__.py
│   │   │   └── imovel_repository.py      # CRUD + buscas
│   │   └── migrations/
│   │       └── 001_create_bairros_tables.py
│   │
│   └── api/
│       ├── routes/
│       │   └── imoveis.py                # Endpoints de busca
│       └── schemas/
│           └── search_schemas.py         # DTOs de request/response
│
├── scripts/
│   ├── analyze_bairros.py                # Passo 1: Análise inicial
│   ├── generate_mappings.py              # Passo 2: Gerar mapeamentos
│   ├── normalize_csv.py                  # Passo 3: Processar CSV
│   └── load_to_database.py               # Passo 4: Carregar no BD
│
└── tests/
    ├── test_normalizers/
    │   └── test_bairro_normalizer.py
    └── test_api/
        └── test_search_endpoints.py
🔧 PASSO A PASSO DE IMPLEMENTAÇÃO
FASE 1: Análise e Identificação de Inconsistências
Passo 1.1: Criar o Analisador de Bairros
Arquivo: modules/data_processing/analyzers/bairro_analyzer.py

python


"""
Analisa o CSV original e identifica grupos de bairros similares.
"""

import pandas as pd
from collections import defaultdict
from fuzzywuzzy import fuzz
from unidecode import unidecode
import json

class BairroAnalyzer:
    """
    Identifica duplicatas e variantes de nomes de bairros.
    """
    
    def __init__(self, similarity_threshold: int = 85):
        """
        Args:
            similarity_threshold: Score mínimo de similaridade (0-100)
        """
        self.threshold = similarity_threshold
        self.grupos = defaultdict(list)
        
    def analyze_csv(self, csv_path: str, column_name: str = 'bairro') -> dict:
        """
        Analisa coluna de bairros no CSV e agrupa variantes.
        
        Returns:
            dict: Relatório com grupos de bairros similares
        """
        # Carrega dados
        df = pd.read_csv(csv_path)
        bairros_unicos = df[column_name].dropna().unique()
        
        print(f"📊 Total de variantes encontradas: {len(bairros_unicos)}")
        
        # Normalização básica para análise
        bairros_limpos = [self._clean_basic(b) for b in bairros_unicos]
        
        # Agrupa por similaridade
        processados = set()
        grupos = []
        
        for i, bairro1 in enumerate(bairros_limpos):
            if bairro1 in processados:
                continue
                
            grupo = {
                'principal': bairros_unicos[i],
                'variantes': [],
                'count': int((df[column_name] == bairros_unicos[i]).sum())
            }
            
            for j, bairro2 in enumerate(bairros_limpos):
                if i != j and bairro2 not in processados:
                    score = fuzz.ratio(bairro1, bairro2)
                    if score >= self.threshold:
                        grupo['variantes'].append({
                            'nome': bairros_unicos[j],
                            'similarity': score,
                            'count': int((df[column_name] == bairros_unicos[j]).sum())
                        })
                        processados.add(bairro2)
            
            processados.add(bairro1)
            
            # Só adiciona se houver variantes ou casos especiais
            if grupo['variantes'] or self._is_special_case(bairros_unicos[i]):
                grupos.append(grupo)
        
        # Ordena por número de registros afetados
        grupos.sort(key=lambda x: x['count'] + sum(v['count'] for v in x['variantes']), reverse=True)
        
        return {
            'total_variantes': len(bairros_unicos),
            'grupos_identificados': len(grupos),
            'total_registros': len(df),
            'grupos': grupos
        }
    
    def _clean_basic(self, text: str) -> str:
        """Limpeza básica para comparação"""
        if pd.isna(text):
            return ""
        # Remove acentos, converte para maiúsculas, remove espaços extras
        cleaned = unidecode(str(text)).upper().strip()
        # Remove prefixos comuns
        for prefix in ['LOT ', 'LOTEAMENTO ', 'JD ', 'JARDIM ', 'COND ', 'CONDOMINIO ', 'PQ ', 'PARQUE ']:
            if cleaned.startswith(prefix):
                cleaned = cleaned[len(prefix):].strip()
        return cleaned
    
    def _is_special_case(self, bairro: str) -> bool:
        """Identifica casos especiais que precisam de atenção"""
        special_patterns = [
            'DIST',  # Distritos
            '1º', '2º', '3º',  # Ordinais
            '(',  # Parênteses (subdistritos)
        ]
        return any(pattern in bairro.upper() for pattern in special_patterns)
    
    def export_to_json(self, result: dict, output_path: str):
        """Salva resultado da análise em JSON"""
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"✅ Análise salva em: {output_path}")
Passo 1.2: Criar Script de Análise
Arquivo: scripts/analyze_bairros.py

python


"""
Script para análise inicial dos bairros no CSV.
Uso: python scripts/analyze_bairros.py
"""

import sys
from pathlib import Path

# Adiciona o diretório raiz ao path
sys.path.insert(0, str(Path(__file__).parent.parent))

from modules.data_processing.analyzers.bairro_analyzer import BairroAnalyzer

def main():
    """Executa análise de bairros"""
    
    # Configurações
    INPUT_CSV = "data/raw/imoveis_original.csv"
    OUTPUT_JSON = "data/mappings/bairros_analysis.json"
    SIMILARITY_THRESHOLD = 85  # Ajuste conforme necessário
    
    print("🔍 Iniciando análise de bairros...")
    print(f"📁 Arquivo de entrada: {INPUT_CSV}")
    print(f"🎯 Threshold de similaridade: {SIMILARITY_THRESHOLD}%\n")
    
    # Executa análise
    analyzer = BairroAnalyzer(similarity_threshold=SIMILARITY_THRESHOLD)
    result = analyzer.analyze_csv(INPUT_CSV, column_name='bairro')
    
    # Salva resultado
    analyzer.export_to_json(result, OUTPUT_JSON)
    
    # Exibe resumo
    print("\n" + "="*60)
    print("📊 RESUMO DA ANÁLISE")
    print("="*60)
    print(f"Total de variantes encontradas: {result['total_variantes']}")
    print(f"Grupos de bairros similares: {result['grupos_identificados']}")
    print(f"Total de registros no CSV: {result['total_registros']}")
    print("\n🔎 Revise o arquivo gerado para definir os mapeamentos corretos.")
    print(f"📄 Arquivo: {OUTPUT_JSON}")
    
if __name__ == "__main__":
    main()
Executar:

bash


python scripts/analyze_bairros.py
Output esperado: data/mappings/bairros_analysis.json com grupos de bairros similares.

FASE 2: Criação do Mapeamento de Normalização
Passo 2.1: Criar Regras de Normalização
Arquivo: modules/data_processing/normalizers/rules.py

python


"""
Regras de normalização para bairros.
"""

# Prefixos a serem removidos
PREFIXES_TO_REMOVE = [
    'LOT ',
    'LOTEAMENTO ',
    'JD ',
    'JARDIM ',
    'COND ',
    'CONDOMINIO ',
    'PQ ',
    'PARQUE ',
    'RES ',
    'RESIDENCIAL ',
]

# Sufixos a serem removidos (conteúdo entre parênteses pode ser opcional)
SUFFIXES_TO_REMOVE = [
    'ZR2',
    'ZONA RES 2',
]

# Substituições específicas
SPECIFIC_REPLACEMENTS = {
    'N SRA': 'NOSSA SENHORA',
    'N. SRA': 'NOSSA SENHORA',
    'N S': 'NOSSA SENHORA',
    'STA': 'SANTA',
    'STO': 'SANTO',
    'FCO': 'FRANCISCO',
}

# Abreviações de distrito
DISTRICT_NORMALIZATIONS = {
    '1 DIST': '1º DISTRITO',
    '1 DISTRITO': '1º DISTRITO',
    '2 DISTRITO': '2º DISTRITO',
    '3 DISTRITO': '3º DISTRITO',
    '3º DISTRITO ZONA URB': '3º DISTRITO',
    '5 DISTRITO': '5º DISTRITO',
    '6 DISTRITO': '6º DISTRITO',
}

# Casos especiais de normalização direta (mapeamento manual)
# Este dicionário será preenchido com base na análise
MANUAL_MAPPINGS = {
    # Será gerado no próximo passo
}
Passo 2.2: Criar Gerador de Mapeamentos
Arquivo: scripts/generate_mappings.py

python


"""
Gera o arquivo de mapeamento bairros_normalizacao.json
baseado na análise prévia e revisão manual.
"""

import json
from pathlib import Path
from datetime import datetime

def load_analysis(analysis_path: str) -> dict:
    """Carrega resultado da análise"""
    with open(analysis_path, 'r', encoding='utf-8') as f:
        return json.load(f)

def create_mapping_template(analysis: dict, output_path: str):
    """
    Cria template de mapeamento para revisão manual.
    """
    mappings = {}
    
    for grupo in analysis['grupos']:
        # Nome principal (o que tem mais registros)
        principal = grupo['principal']
        
        # Coleta todas as variantes
        variantes = [v['nome'] for v in grupo['variantes']]
        
        # Cria entrada no mapeamento
        # IMPORTANTE: Você deve revisar e ajustar o 'normalized'
        mappings[principal.upper()] = {
            "normalized": principal.upper(),  # ← REVISAR MANUALMENTE
            "confidence": 1.0,
            "variants": variantes,
            "total_records": grupo['count'] + sum(v['count'] for v in grupo['variantes'])
        }
    
    # Estrutura final
    output = {
        "version": "1.0.0",
        "last_updated": datetime.now().isoformat(),
        "description": "Mapeamento de normalização de bairros - REVISAR MANUALMENTE",
        "mappings": mappings
    }
    
    # Salva
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Template de mapeamento criado: {output_path}")
    print("⚠️  ATENÇÃO: Revise o arquivo e ajuste os nomes normalizados!")

def main():
    ANALYSIS_FILE = "data/mappings/bairros_analysis.json"
    OUTPUT_FILE = "data/mappings/bairros_normalizacao_template.json"
    
    print("📝 Gerando template de mapeamento...")
    
    analysis = load_analysis(ANALYSIS_FILE)
    create_mapping_template(analysis, OUTPUT_FILE)
    
    print("\n" + "="*60)
    print("🔧 PRÓXIMOS PASSOS:")
    print("="*60)
    print(f"1. Abra o arquivo: {OUTPUT_FILE}")
    print("2. Revise cada grupo de bairros")
    print("3. Ajuste o campo 'normalized' para o nome correto")
    print("4. Salve como: data/mappings/bairros_normalizacao.json")
    print("5. Execute: python scripts/normalize_csv.py")

if __name__ == "__main__":
    main()
Executar:

bash


python scripts/generate_mappings.py
Ação Manual Requerida:

Abrir data/mappings/bairros_normalizacao_template.json
Revisar cada entrada
Ajustar o campo normalized para o nome padrão correto
Salvar como data/mappings/bairros_normalizacao.json
FASE 3: Implementação do Normalizador
Passo 3.1: Criar Classe Base
Arquivo: modules/data_processing/normalizers/base_normalizer.py

python


"""
Classe abstrata para normalizadores.
"""

from abc import ABC, abstractmethod

class BaseNormalizer(ABC):
    """
    Interface base para todos os normalizadores de dados.
    """
    
    @abstractmethod
    def normalize(self, value: str) -> str:
        """
        Normaliza um valor.
        
        Args:
            value: Valor a ser normalizado
            
        Returns:
            Valor normalizado
        """
        pass
    
    @abstractmethod
    def get_confidence(self, value: str) -> float:
        """
        Retorna nível de confiança da normalização (0.0 a 1.0).
        
        Args:
            value: Valor original
            
        Returns:
            Score de confiança
        """
        pass
Passo 3.2: Implementar Normalizador de Bairros
Arquivo: modules/data_processing/normalizers/bairro_normalizer.py

python


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

from .base_normalizer import BaseNormalizer
from .rules import (
    PREFIXES_TO_REMOVE,
    SPECIFIC_REPLACEMENTS,
    DISTRICT_NORMALIZATIONS
)

class BairroNormalizer(BaseNormalizer):
    """
    Normaliza nomes de bairros usando regras e mapeamentos.
    """
    
    def __init__(self, mapping_path: str):
        """
        Args:
            mapping_path: Caminho para bairros_normalizacao.json
        """
        self.mapping_path = mapping_path
        self.mappings = self._load_mappings()
        self.variant_index = self._build_variant_index()
        self.confidence_cache = {}
        
    def _load_mappings(self) -> dict:
        """Carrega arquivo de mapeamentos"""
        with open(self.mapping_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data.get('mappings', {})
    
    def _build_variant_index(self) -> dict:
        """
        Cria índice invertido: {variante: nome_normalizado}
        para busca O(1).
        """
        index = {}
        
        for key, data in self.mappings.items():
            normalized = data['normalized']
            
            # Adiciona o próprio nome normalizado
            index[normalized.upper()] = normalized
            index[key.upper()] = normalized
            
            # Adiciona todas as variantes
            for variant in data.get('variants', []):
                index[variant.upper()] = normalized
        
        return index
    
    def normalize(self, bairro_raw: str) -> str:
        """
        Pipeline completo de normalização.
        
        Etapas:
        1. Validação de entrada
        2. Limpeza básica
        3. Busca em mapeamentos de distritos
        4. Remoção de prefixos/sufixos
        5. Substituições específicas
        6. Busca exata no índice
        7. Busca fuzzy
        8. Normalização básica (fallback)
        """
        # 1. Validação
        if pd.isna(bairro_raw) or str(bairro_raw).strip() == '':
            return None
        
        # 2. Limpeza básica
        cleaned = self._clean_text(bairro_raw)
        
        # 3. Distritos (mapeamento direto)
        if cleaned in DISTRICT_NORMALIZATIONS:
            return DISTRICT_NORMALIZATIONS[cleaned]
        
        # 4. Remove prefixos
        cleaned = self._remove_prefixes(cleaned)
        
        # 5. Substituições específicas
        cleaned = self._apply_replacements(cleaned)
        
        # 6. Busca exata no índice
        if cleaned in self.variant_index:
            return self.variant_index[cleaned]
        
        # 7. Busca fuzzy (apenas se não encontrou exato)
        match, score = self._fuzzy_match(cleaned)
        if score >= 90:  # Alta confiança
            self.confidence_cache[bairro_raw] = score / 100.0
            return match
        elif score >= 85:  # Confiança média (retorna mas marca)
            self.confidence_cache[bairro_raw] = score / 100.0
            return match
        
        # 8. Fallback: normalização básica
        self.confidence_cache[bairro_raw] = 0.5
        return self._apply_basic_normalization(cleaned)
    
    def get_confidence(self, value: str) -> float:
        """Retorna confiança da última normalização"""
        return self.confidence_cache.get(value, 1.0)
    
    def _clean_text(self, text: str) -> str:
        """Limpeza inicial: strip + uppercase"""
        return str(text).strip().upper()
    
    def _remove_prefixes(self, text: str) -> str:
        """Remove prefixos conhecidos"""
        for prefix in PREFIXES_TO_REMOVE:
            if text.startswith(prefix):
                text = text[len(prefix):].strip()
                break  # Remove apenas o primeiro
        return text
    
    def _apply_replacements(self, text: str) -> str:
        """Aplica substituições de abreviações"""
        for abbrev, full in SPECIFIC_REPLACEMENTS.items():
            text = text.replace(abbrev, full)
        return text
    
    def _fuzzy_match(self, text: str) -> Tuple[Optional[str], int]:
        """
        Busca por similaridade usando Levenshtein.
        
        Returns:
            (nome_normalizado, score)
        """
        if not self.variant_index:
            return None, 0
        
        all_variants = list(self.variant_index.keys())
        result = process.extractOne(text, all_variants, scorer=fuzz.ratio)
        
        if result:
            match, score = result[0], result[1]
            normalized = self.variant_index.get(match)
            return normalized, score
        
        return None, 0
    
    def _apply_basic_normalization(self, text: str) -> str:
        """
        Normalização básica quando não há mapeamento.
        - Remove acentos
        - Title case
        """
        # Remove acentos mas mantém formato original
        return text.strip()
    
    def _remove_parentheses_content(self, text: str) -> str:
        """Remove conteúdo entre parênteses"""
        return re.sub(r'\s*\([^)]*\)', '', text).strip()
FASE 4: Pipeline de Processamento
Passo 4.1: Criar Pipeline ETL
Arquivo: modules/data_processing/pipeline.py

python


"""
Pipeline de normalização de dados.
"""

import pandas as pd
from pathlib import Path
from datetime import datetime
import json

from .normalizers.bairro_normalizer import BairroNormalizer

class DataNormalizationPipeline:
    """
    Orquestra processo completo de normalização.
    """
    
    def __init__(self, mapping_path: str):
        """
        Args:
            mapping_path: Caminho para bairros_normalizacao.json
        """
        self.normalizer = BairroNormalizer(mapping_path)
        self.report = {
            'start_time': None,
            'end_time': None,
            'total_records': 0,
            'normalized_count': 0,
            'low_confidence_count': 0,
            'errors': []
        }
    
    def process_csv(
        self,
        input_path: str,
        output_path: str,
        column_name: str = 'bairro'
    ) -> dict:
        """
        Processa CSV completo.
        
        Args:
            input_path: CSV original
            output_path: CSV normalizado
            column_name: Nome da coluna de bairros
            
        Returns:
            Relatório do processamento
        """
        self.report['start_time'] = datetime.now().isoformat()
        
        print(f"📂 Carregando CSV: {input_path}")
        df = pd.read_csv(input_path)
        self.report['total_records'] = len(df)
        
        print(f"🔄 Processando {len(df)} registros...")
        
        # Aplica normalização
        df['bairro_original'] = df[column_name]  # Preserva original
        df[column_name] = df['bairro_original'].apply(
            self.normalizer.normalize
        )
        df['confianca_normalizacao'] = df['bairro_original'].apply(
            self.normalizer.get_confidence
        )
        
        # Contabiliza alterações
        self.report['normalized_count'] = int(
            (df['bairro_original'] != df[column_name]).sum()
        )
        
        # Identifica casos de baixa confiança
        low_confidence = df[df['confianca_normalizacao'] < 0.8]
        self.report['low_confidence_count'] = len(low_confidence)
        self.report['low_confidence_samples'] = low_confidence[
            ['bairro_original', column_name, 'confianca_normalizacao']
        ].head(20).to_dict('records')
        
        # Salva CSV processado
        print(f"💾 Salvando CSV normalizado: {output_path}")
        df.to_csv(output_path, index=False)
        
        self.report['end_time'] = datetime.now().isoformat()
        
        return self.report
    
    def save_report(self, report_path: str):
        """Salva relatório em JSON"""
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(self.report, f, ensure_ascii=False, indent=2)
        print(f"📊 Relatório salvo: {report_path}")
Passo 4.2: Criar Script de Normalização
Arquivo: scripts/normalize_csv.py

python


"""
Script para processar CSV e aplicar normalização.
Uso: python scripts/normalize_csv.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from modules.data_processing.pipeline import DataNormalizationPipeline

def main():
    """Executa pipeline de normalização"""
    
    # Configurações
    INPUT_CSV = "data/raw/imoveis_original.csv"
    OUTPUT_CSV = "data/processed/imoveis_normalized.csv"
    MAPPING_FILE = "data/mappings/bairros_normalizacao.json"
    REPORT_FILE = "data/reports/normalization_report.json"
    
    print("="*60)
    print("🚀 PIPELINE DE NORMALIZAÇÃO DE BAIRROS")
    print("="*60)
    print(f"📥 Input: {INPUT_CSV}")
    print(f"📤 Output: {OUTPUT_CSV}")
    print(f"🗺️  Mapeamentos: {MAPPING_FILE}\n")
    
    # Cria pipeline
    pipeline = DataNormalizationPipeline(MAPPING_FILE)
    
    # Processa
    report = pipeline.process_csv(INPUT_CSV, OUTPUT_CSV, column_name='bairro')
    
    # Salva relatório
    pipeline.save_report(REPORT_FILE)
    
    # Exibe resumo
    print("\n" + "="*60)
    print("✅ PROCESSAMENTO CONCLUÍDO")
    print("="*60)
    print(f"Total de registros: {report['total_records']}")
    print(f"Registros normalizados: {report['normalized_count']}")
    print(f"Baixa confiança: {report['low_confidence_count']}")
    
    if report['low_confidence_count'] > 0:
        print(f"\n⚠️  Revise casos de baixa confiança no relatório:")
        print(f"📄 {REPORT_FILE}")

if __name__ == "__main__":
    main()
Executar:

bash


python scripts/normalize_csv.py
FASE 5: Modelagem do Banco de Dados
Passo 5.1: Criar Modelos SQLAlchemy
Arquivo: modules/database/models/bairro.py

python


"""
Modelos de Bairro e Variantes.
"""

from sqlalchemy import Column, Integer, String, Float, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Bairro(Base):
    """
    Tabela de bairros normalizados (lista única).
    """
    __tablename__ = "bairros"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    nome_normalizado = Column(String(200), unique=True, nullable=False, index=True)
    
    # Relacionamentos
    variantes = relationship("BairroVariante", back_populates="bairro", cascade="all, delete-orphan")
    imoveis = relationship("Imovel", back_populates="bairro")
    
    def __repr__(self):
        return f"<Bairro(id={self.id}, nome='{self.nome_normalizado}')>"

class BairroVariante(Base):
    """
    Tabela de variantes de nomes (para busca flexível).
    """
    __tablename__ = "bairros_variantes"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    bairro_id = Column(Integer, ForeignKey("bairros.id"), nullable=False)
    nome_variante = Column(String(200), nullable=False, index=True)
    confianca = Column(Float, default=1.0)  # Score de confiança da normalização
    
    # Relacionamento
    bairro = relationship("Bairro", back_populates="variantes")
    
    # Índice composto para busca rápida
    __table_args__ = (
        Index('idx_variante_busca', 'nome_variante'),
    )
    
    def __repr__(self):
        return f"<BairroVariante(variante='{self.nome_variante}', bairro_id={self.bairro_id})>"
Arquivo: modules/database/models/imovel.py

python


"""
Modelo de Imóvel (atualizado com FK para Bairro).
"""

from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from .bairro import Base

class Imovel(Base):
    """
    Tabela de imóveis da Caixa.
    """
    __tablename__ = "imoveis_caixa"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Dados do imóvel
    endereco = Column(String(500))
    cidade = Column(String(200))
    estado = Column(String(2))
    cep = Column(String(10))
    
    # Bairro (normalizado)
    bairro_id = Column(Integer, ForeignKey("bairros.id"), nullable=True, index=True)
    bairro_original = Column(String(200))  # Preserva dado original para auditoria
    
    # Dados comerciais
    preco = Column(Float)
    area = Column(Float)
    quartos = Column(Integer)
    
    # Metadados
    data_cadastro = Column(DateTime, default=datetime.utcnow)
    data_atualizacao = Column(DateTime, onupdate=datetime.utcnow)
    
    # Relacionamento
    bairro = relationship("Bairro", back_populates="imoveis")
    
    def __repr__(self):
        return f"<Imovel(id={self.id}, endereco='{self.endereco}')>"
Passo 5.2: Criar Script de Migração
Arquivo: modules/database/migrations/001_create_bairros_tables.py

python


"""
Migração: Criação das tabelas de bairros.
"""

from sqlalchemy import create_engine
from modules.database.models.bairro import Base, Bairro, BairroVariante
from modules.database.models.imovel import Imovel

def run_migration(database_url: str):
    """
    Cria tabelas no banco de dados.
    
    Args:
        database_url: String de conexão (ex: sqlite:///antigravity.db)
    """
    print(f"🔧 Conectando ao banco: {database_url}")
    engine = create_engine(database_url, echo=True)
    
    print("📦 Criando tabelas...")
    Base.metadata.create_all(engine)
    
    print("✅ Migração concluída!")

if __name__ == "__main__":
    # Para testes locais
    run_migration("sqlite:///data/antigravity.db")
FASE 6: Carga no Banco de Dados
Passo 6.1: Criar Script de Carga
Arquivo: scripts/load_to_database.py

python


"""
Carrega CSV normalizado no banco de dados.
Popula tabelas: bairros, bairros_variantes, imoveis_caixa
"""

import sys
import json
from pathlib import Path
import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).parent.parent))

from modules.database.models.bairro import Bairro, BairroVariante
from modules.database.models.imovel import Imovel

def load_bairros_from_mapping(session, mapping_path: str):
    """
    Popula tabelas bairros e bairros_variantes a partir do mapeamento.
    """
    with open(mapping_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    mappings = data['mappings']
    print(f"📍 Carregando {len(mappings)} bairros...")
    
    for key, info in mappings.items():
        nome_normalizado = info['normalized']
        
        # Verifica se já existe
        bairro = session.query(Bairro).filter_by(
            nome_normalizado=nome_normalizado
        ).first()
        
        if not bairro:
            bairro = Bairro(nome_normalizado=nome_normalizado)
            session.add(bairro)
            session.flush()  # Para obter o ID
        
        # Adiciona variantes
        for variante in info.get('variants', []):
            # Verifica se variante já existe
            exists = session.query(BairroVariante).filter_by(
                nome_variante=variante.upper()
            ).first()
            
            if not exists:
                var = BairroVariante(
                    bairro_id=bairro.id,
                    nome_variante=variante.upper(),
                    confianca=info.get('confidence', 1.0)
                )
                session.add(var)
    
    session.commit()
    print("✅ Bairros carregados!")

def load_imoveis_from_csv(session, csv_path: str):
    """
    Carrega imóveis do CSV normalizado.
    """
    print(f"🏠 Carregando imóveis de: {csv_path}")
    df = pd.read_csv(csv_path)
    
    # Cria dicionário de lookup {nome_normalizado: bairro_id}
    bairros_dict = {
        b.nome_normalizado: b.id
        for b in session.query(Bairro).all()
    }
    
    registros_inseridos = 0
    
    for idx, row in df.iterrows():
        bairro_normalizado = row.get('bairro')
        bairro_id = bairros_dict.get(bairro_normalizado)
        
        imovel = Imovel(
            endereco=row.get('endereco'),
            cidade=row.get('cidade'),
            estado=row.get('estado'),
            cep=row.get('cep'),
            bairro_id=bairro_id,
            bairro_original=row.get('bairro_original'),
            preco=row.get('preco'),
            area=row.get('area'),
            quartos=row.get('quartos')
        )
        session.add(imovel)
        registros_inseridos += 1
        
        if registros_inseridos % 1000 == 0:
            print(f"  → {registros_inseridos} registros processados...")
            session.commit()
    
    session.commit()
    print(f"✅ {registros_inseridos} imóveis carregados!")

def main():
    """Executa carga completa"""
    
    # Configurações
    DATABASE_URL = "sqlite:///data/antigravity.db"  # Ajustar conforme necessário
    MAPPING_FILE = "data/mappings/bairros_normalizacao.json"
    CSV_FILE = "data/processed/imoveis_normalized.csv"
    
    print("="*60)
    print("📊 CARGA DE DADOS NO BANCO")
    print("="*60)
    
    # Conecta ao banco
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # 1. Carrega bairros
        load_bairros_from_mapping(session, MAPPING_FILE)
        
        # 2. Carrega imóveis
        load_imoveis_from_csv(session, CSV_FILE)
        
        print("\n✅ CARGA CONCLUÍDA COM SUCESSO!")
        
    except Exception as e:
        print(f"\n❌ ERRO: {e}")
        session.rollback()
        raise
    finally:
        session.close()

if __name__ == "__main__":
    main()
Executar:

bash


python scripts/load_to_database.py
FASE 7: API de Busca
Passo 7.1: Criar Schemas Pydantic
Arquivo: modules/api/schemas/search_schemas.py

python


"""
Schemas de request/response para busca de imóveis.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class ImovelResponse(BaseModel):
    """Schema de resposta de imóvel"""
    id: int
    endereco: str
    bairro_normalizado: str
    bairro_original: Optional[str]
    cidade: str
    preco: float
    area: Optional[float]
    quartos: Optional[int]
    
    class Config:
        from_attributes = True

class BuscaBairroResponse(BaseModel):
    """Schema de resposta de busca por bairro"""
    bairro_pesquisado: str
    bairro_normalizado: str
    total_imoveis: int
    imoveis: List[ImovelResponse]
    
class BairroInfo(BaseModel):
    """Informações de um bairro"""
    id: int
    nome_normalizado: str
    total_variantes: int
    total_imoveis: int
Passo 7.2: Criar Endpoint de Busca
Arquivo: modules/api/routes/imoveis.py

python


"""
Endpoints para busca de imóveis.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from modules.database.models.bairro import Bairro, BairroVariante
from modules.database.models.imovel import Imovel
from modules.api.schemas.search_schemas import (
    BuscaBairroResponse,
    ImovelResponse,
    BairroInfo
)
from modules.data_processing.normalizers.bairro_normalizer import BairroNormalizer

router = APIRouter(prefix="/imoveis", tags=["Imóveis"])

# Dependência: normalizer (carregar uma vez)
normalizer = BairroNormalizer("data/mappings/bairros_normalizacao.json")

def get_db():
    """Dependência de sessão do banco (configurar conforme seu setup)"""
    # Implementar conforme sua configuração de DB
    pass

@router.get("/buscar", response_model=BuscaBairroResponse)
async def buscar_por_bairro(
    bairro: str = Query(..., description="Nome do bairro (aceita variantes)"),
    db: Session = Depends(get_db)
):
    """
    Busca imóveis por bairro.
    
    Aceita qualquer variante do nome do bairro e retorna todos os imóveis
    cadastrados no bairro normalizado correspondente.
    
    Exemplos:
    - /imoveis/buscar?bairro=JACAREPAGUA
    - /imoveis/buscar?bairro=Jacarepaguá
    - /imoveis/buscar?bairro=FREG DE JACAREPAGUA
    """
    
    # 1. Normaliza input do usuário
    bairro_normalizado = normalizer.normalize(bairro)
    
    if not bairro_normalizado:
        raise HTTPException(400, "Nome de bairro inválido")
    
    # 2. Busca bairro no banco
    bairro_obj = db.query(Bairro).filter(
        Bairro.nome_normalizado == bairro_normalizado
    ).first()
    
    # 3. Se não encontrou pelo nome normalizado, tenta pela variante
    if not bairro_obj:
        variante = db.query(BairroVariante).filter(
            BairroVariante.nome_variante == bairro.upper()
        ).first()
        
        if variante:
            bairro_obj = variante.bairro
    
    # 4. Se ainda não encontrou, retorna erro
    if not bairro_obj:
        raise HTTPException(404, f"Bairro '{bairro}' não encontrado na base de dados")
    
    # 5. Busca imóveis
    imoveis = db.query(Imovel).filter(
        Imovel.bairro_id == bairro_obj.id
    ).all()
    
    # 6. Monta response
    return BuscaBairroResponse(
        bairro_pesquisado=bairro,
        bairro_normalizado=bairro_obj.nome_normalizado,
        total_imoveis=len(imoveis),
        imoveis=[
            ImovelResponse(
                id=i.id,
                endereco=i.endereco,
                bairro_normalizado=bairro_obj.nome_normalizado,
                bairro_original=i.bairro_original,
                cidade=i.cidade,
                preco=i.preco,
                area=i.area,
                quartos=i.quartos
            )
            for i in imoveis
        ]
    )

@router.get("/bairros", response_model=List[BairroInfo])
async def listar_bairros(db: Session = Depends(get_db)):
    """
    Lista todos os bairros cadastrados com estatísticas.
    """
    bairros = db.query(Bairro).all()
    
    return [
        BairroInfo(
            id=b.id,
            nome_normalizado=b.nome_normalizado,
            total_variantes=len(b.variantes),
            total_imoveis=len(b.imoveis)
        )
        for b in bairros
    ]
🧪 TESTES
Arquivo: tests/test_normalizers/test_bairro_normalizer.py
python


"""
Testes unitários para BairroNormalizer.
"""

import pytest
from modules.data_processing.normalizers.bairro_normalizer import BairroNormalizer

@pytest.fixture
def normalizer():
    """Fixture do normalizador"""
    return BairroNormalizer("data/mappings/bairros_normalizacao.json")

def test_normalize_exact_match(normalizer):
    """Testa normalização com match exato"""
    assert normalizer.normalize("JACAREPAGUA") == "JACAREPAGUÁ"
    assert normalizer.normalize("CABUCU") == "CABUÇU"

def test_normalize_with_prefix(normalizer):
    """Testa remoção de prefixos"""
    assert normalizer.normalize("JARDIM DA PAZ") == "PAZ"
    assert normalizer.normalize("LOT JARDIM CATARINA") == "CATARINA"

def test_normalize_fuzzy_match(normalizer):
    """Testa matching aproximado"""
    result = normalizer.normalize("JACAREPAGU")  # Faltando letra
    assert result == "JACAREPAGUÁ"

def test_confidence_score(normalizer):
    """Testa score de confiança"""
    normalizer.normalize("JACAREPAGUA")
    assert normalizer.get_confidence("JACAREPAGUA") >= 0.9

def test_normalize_null_value(normalizer):
    """Testa entrada nula"""
    assert normalizer.normalize(None) is None
    assert normalizer.normalize("") is None

def test_normalize_district(normalizer):
    """Testa normalização de distritos"""
    assert normalizer.normalize("1 DIST") == "1º DISTRITO"
    assert normalizer.normalize("3 DISTRITO") == "3º DISTRITO"
Executar testes:

bash


pytest tests/ -v
📊 FLUXO COMPLETO DE EXECUÇÃO
Ordem de Execução dos Scripts
bash


# 1. Análise inicial dos dados
python scripts/analyze_bairros.py

# 2. Gerar template de mapeamento
python scripts/generate_mappings.py

# 3. [MANUAL] Revisar e ajustar o arquivo gerado
# Editar: data/mappings/bairros_normalizacao_template.json
# Salvar como: data/mappings/bairros_normalizacao.json

# 4. Normalizar CSV
python scripts/normalize_csv.py

# 5. Criar tabelas no banco
python modules/database/migrations/001_create_bairros_tables.py

# 6. Carregar dados no banco
python scripts/load_to_database.py

# 7. Executar testes
pytest tests/ -v

# 8. Iniciar API (se aplicável)
uvicorn modules.api.main:app --reload
📝 CHECKLIST DE VALIDAÇÃO
Antes de Finalizar, Verifique:
 Análise gerou relatório (bairros_analysis.json existe)
 Mapeamento foi revisado manualmente (campo normalized está correto)
 CSV normalizado foi gerado com colunas bairro_original e bairro
 Relatório de normalização mostra número correto de alterações
 Casos de baixa confiança foram revisados (se houver)
 Tabelas do banco foram criadas (bairros, bairros_variantes, imoveis_caixa)
 Dados foram carregados sem erros
 Testes unitários passam (pytest)
 API responde corretamente às buscas por variantes
🔍 MONITORAMENTO PÓS-IMPLEMENTAÇÃO
Queries de Validação SQL
sql


-- Total de bairros únicos
SELECT COUNT(*) FROM bairros;

-- Total de variantes cadastradas
SELECT COUNT(*) FROM bairros_variantes;

-- Bairros com mais variantes
SELECT 
    b.nome_normalizado,
    COUNT(bv.id) as total_variantes,
    COUNT(i.id) as total_imoveis
FROM bairros b
LEFT JOIN bairros_variantes bv ON b.id = bv.bairro_id
LEFT JOIN imoveis_caixa i ON b.id = i.bairro_id
GROUP BY b.id
ORDER BY total_variantes DESC
LIMIT 10;

-- Imóveis sem bairro associado (possível problema)
SELECT COUNT(*) 
FROM imoveis_caixa 
WHERE bairro_id IS NULL;
🚨 TRATAMENTO DE ERROS COMUNS
Problema 1: "Arquivo de mapeamento não encontrado"
Solução: Verificar se você executou generate_mappings.py e salvou o arquivo com o nome correto.

Problema 2: "Muitos casos de baixa confiança"
Solução: Ajustar o threshold de similaridade no normalizador ou adicionar mais entradas manuais no mapeamento.

Problema 3: "Duplicatas no banco de dados"
Solução: Executar script de limpeza antes de recarregar:

sql


DELETE FROM bairros_variantes;
DELETE FROM bairros;
DELETE FROM imoveis_caixa;
📚 REFERÊNCIAS E RECURSOS
Fuzzy String Matching: https://github.com/seatgeek/fuzzywuzzy
SQLAlchemy ORM: https://docs.sqlalchemy.org/
Pandas Data Processing: https://pandas.pydata.org/docs/
FastAPI Documentation: https://fastapi.tiangolo.com/
✅ CONCLUSÃO
Esta especificação fornece um sistema completo de normalização de bairros para o Antigravity, com:

✔ Pipeline automatizado de ETL
✔ Normalização inteligente com fuzzy matching
✔ Preservação de dados originais
✔ Busca flexível por variantes
✔ API RESTful documentada
✔ Testes unitários

Próximo passo: Execute o fluxo completo seguindo a ordem dos scripts! 🚀

Documento criado para: Sistema Antigravity
Versão: 1.0.0
Data: 2026-03-11
Autor: Arquiteto Antigravity



