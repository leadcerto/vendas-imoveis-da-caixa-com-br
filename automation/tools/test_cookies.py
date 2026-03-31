import json
import requests
import os
from pathlib import Path

def test_caixa_cookies():
    cookie_path = Path(r"c:\Users\PICHAU\Desktop\antigravity\venda-imoveis-caixa\automation\tools\cookies.json")
    if not cookie_path.exists():
        print("Cookies file not found.")
        return

    with open(cookie_path, "r") as f:
        cookies_dict = json.load(f)
    
    session = requests.Session()
    for name, value in cookies_dict.items():
        session.cookies.set(name, value, domain='.caixa.gov.br')

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://venda-imoveis.caixa.gov.br/sistema/busca-imovel.asp'
    }
    
    # Test with a known property URL or just the main search page
    test_url = "https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnOrigem=index&hdnIdImovel=1774801849731"
    
    try:
        response = session.get(test_url, headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        if "bot" in response.text.lower() or "captcha" in response.text.lower() or response.status_code == 403:
            print("Blocked or CAPTCHA detected.")
        else:
            print("Successfully accessed property page.")
            # Check for property title or something specific
            if "detalhe" in response.text.lower():
                print("Found 'detalhe' in page content.")
            else:
                print("Could not verify content.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_caixa_cookies()
