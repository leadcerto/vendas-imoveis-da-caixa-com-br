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

# Sufixos a serem removidos
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
    '1 DISTRITO DESTE MUN': '1º DISTRITO',
    '1° SUBDISTRITO': '1º SUBDISTRITO',
    '1º DISTRITO': '1º DISTRITO',
    '2 DISTRITO': '2º DISTRITO',
    '3 DISTRITO': '3º DISTRITO',
    '3º DISTRITO': '3º DISTRITO',
    '3º DISTRITO ZONA URB': '3º DISTRITO',
    '5 DISTRITO': '5º DISTRITO',
    '6 DISTRITO': '6º DISTRITO',
}
