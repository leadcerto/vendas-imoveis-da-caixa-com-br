import requests
from requests.auth import HTTPBasicAuth

# Variáveis (Forçando a URL principal, mantendo a senha atual para teste)
WP_URL_PRINCIPAL = "https://imoveisdacaixa.com.br"
WP_USERNAME = "icaixa@gmail.com"
WP_APP_PASSWORD = "v9Qg qUgF TDwK HZa2 lQib 8ulv"

session = requests.Session()
session.auth = HTTPBasicAuth(WP_USERNAME, WP_APP_PASSWORD)
session.headers.update({"Content-Type": "application/json"})

print(f"Testando conexao REST API na raiz do site: {WP_URL_PRINCIPAL}")

# Endpoint simples para ver quem sou eu
url_me = f"{WP_URL_PRINCIPAL}/wp-json/wp/v2/users/me"

try:
    resposta = session.get(url_me, timeout=10)
    print(f"Status HTTP: {resposta.status_code}")
    
    if resposta.status_code == 200:
        dados = resposta.json()
        print(f"BINGO! Conexão autenticada autorizada no domínio principal.")
        print(f"Usuario logado: {dados.get('name')} (ID: {dados.get('id')})")
    else:
        print(f"Falha na autenticação. A senha do /antigravity/ não vale para a raiz.")
        print(f"Detalhes: {resposta.text}")
        
except Exception as e:
    print(f"Erro de conexão: {e}")
