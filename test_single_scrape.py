
import requests
import re

def test_scrape(numero):
    url = f"https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnOrigem=index&hdnimovel={numero}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    }
    
    print(f"Testando: {url}")
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        html = resp.text
        print(f"Status: {resp.status_code}")
        print(f"Tamanho HTML: {len(html)}")
        
        if "Matrícula" in html:
            print("Encontrou 'Matrícula' no texto!")
        else:
            print("NÃO encontrou 'Matrícula' no texto.")
            # Salva o HTML para inspeção
            with open("failed_page.html", "w", encoding="utf-8") as f:
                f.write(html)
            print("HTML salvo em failed_page.html")
            
        m_matr = re.search(r'Matr[íi]cula\(s\).*?<[^>]+>([^<]+)<', html)
        if m_matr:
            print(f"Matrícula extraída: {m_matr.group(1)}")
        else:
            print("Falha na regex da Matrícula")

    except Exception as e:
        print(f"Erro: {e}")

if __name__ == "__main__":
    # Propriedade que deu 'sem dados extraído' no log anterior: 106380 (truncado no log, deve ser o final do numero)
    # Vamos pegar um número completo do Excel: 1444408529752
    test_scrape("1444408529752")
