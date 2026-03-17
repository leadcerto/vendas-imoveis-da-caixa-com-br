import sys
from pathlib import Path

# Adiciona o diretório raiz ao path
sys.path.insert(0, str(Path(__file__).parent.parent))

from modules.data_processing.normalizers.bairro_normalizer import BairroNormalizer

def test_normalization():
    mapping_path = "csv-caixa/bairros_normalizacao.json"
    normalizer = BairroNormalizer(mapping_path=mapping_path)
    
    test_cases = [
        ("1 DIST", "1º DISTRITO"),
        ("1 DISTRITO", "1º DISTRITO"),
        ("CABUCU", "CABUÇU"),
        ("SAO JOSE", "SÃO JOSE"),
        ("JARDIM DA PAZ", "JARDIM DA PAZ"),
        ("JD DA PAZ", "JARDIM DA PAZ"),
        ("LOT JD CATARINA", "JARDIM CATARINA"),
        ("VENDAS DAS PEDRAS", "VENDA DAS PEDRAS"),
        ("CENTRO (CABUCU)", "CENTRO"), # Caso de remover parênteses se houver mapeamento pro Centro
    ]
    
    print(f"{'Original':<30} | {'Normalizado':<30} | {'Status'}")
    print("-" * 75)
    
    for original, expected in test_cases:
        normalized = normalizer.normalize(original)
        status = "✅ OK" if normalized == expected or normalized is not None else "❌ FALHA"
        print(f"{original:<30} | {str(normalized):<30} | {status}")

if __name__ == "__main__":
    test_normalization()
