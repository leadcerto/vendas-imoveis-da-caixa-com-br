"""Script de diagnóstico para entender a estrutura da página da Caixa."""
import os, sys, requests, re
sys.stdout.reconfigure(encoding='utf-8')
from dotenv import load_dotenv
load_dotenv()

numero = '8555516298464'
url = 'https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp'
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
    'Accept-Language': 'pt-BR,pt;q=0.9',
    'Content-Type': 'application/x-www-form-urlencoded',
    'Referer': 'https://venda-imoveis.caixa.gov.br/sistema/index.asp',
}
data = {'hdnOrigem': 'index', 'hdnimovel': numero}

print("=== Tentando POST ===")
rp = requests.post(url, headers=headers, data=data, timeout=25)
print(f"POST STATUS: {rp.status_code} BYTES: {len(rp.content)}")

text = rp.text

# Buscar variáveis JS
print("\n=== Variáveis JS encontradas ===")
for m in re.finditer(r'var\s+(\w+)\s*=\s*["\']([^"\']{1,100})', text):
    print(f"  {m.group(1)} = {m.group(2)}")

# Buscar padrões de tipo de imóvel
print("\n=== Tipo do imóvel na página ===")
for pat in ['Apartamento', 'Apartamen', 'Casa', 'Terreno', 'tipo', 'imovel']:
    matches = [(m.start(), text[max(0,m.start()-20):m.start()+60]) for m in re.finditer(pat, text, re.IGNORECASE)]
    if matches:
        print(f"  '{pat}': {matches[0][1]}")

# Buscar CEP
print("\n=== CEP na página ===")
for m in re.finditer(r'\d{5}[-.]?\d{3}', text):
    print(f"  CEP: {m.group(0)} | contexto: {text[max(0,m.start()-30):m.start()+30]}")

# Mostrar primeiros 2000 chars do HTML
print("\n=== HTML (2000 chars) ===")
print(text[:2000])
