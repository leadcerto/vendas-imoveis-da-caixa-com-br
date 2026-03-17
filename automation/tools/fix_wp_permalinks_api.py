import os
import requests
from dotenv import load_dotenv
from requests.auth import HTTPBasicAuth

load_dotenv()

WP_URL = os.getenv("WP_URL")
WP_USERNAME = os.getenv("WP_USERNAME")
WP_APP_PASSWORD = os.getenv("WP_APP_PASSWORD")

session = requests.Session()
session.auth = HTTPBasicAuth(WP_USERNAME, WP_APP_PASSWORD)
session.headers.update({"Content-Type": "application/json"})

print(f"Buscando as configurações atuais do WP em: {WP_URL}/wp-json/wp/v2/settings")
r_get = session.get(f"{WP_URL}/wp-json/wp/v2/settings")

if r_get.status_code == 200:
    print("Sucesso ao ler Settings.")
    print(r_get.json())
else:
    print(f"Falha na leitura. Status: {r_get.status_code} - {r_get.text}")

print("\nTentando forçar alteração estrutural no permalink...")
payload_settings = {
    "permalink_structure": "/%postname%/"
}

r_post = session.post(f"{WP_URL}/wp-json/wp/v2/settings", json=payload_settings)
if r_post.status_code == 200:
    print("SUCESSO: Permalink alterado pelo endpoint nativo da REST API do Settings!")
else:
    print(f"Não foi possível gravar o permalink_structure diretamente. HTTP Status: {r_post.status_code}")
    print(r_post.text)
