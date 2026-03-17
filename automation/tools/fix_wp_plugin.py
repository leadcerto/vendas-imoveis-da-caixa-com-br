import os
import requests
from dotenv import load_dotenv
from requests.auth import HTTPBasicAuth

load_dotenv()

WP_URL = os.getenv("WP_URL")
WP_USERNAME = os.getenv("WP_USERNAME")
WP_APP_PASSWORD = os.getenv("WP_APP_PASSWORD")

if not all([WP_URL, WP_USERNAME, WP_APP_PASSWORD]):
    print("Credenciais ausentes no .env")
    exit()

session = requests.Session()
session.auth = HTTPBasicAuth(WP_USERNAME, WP_APP_PASSWORD)
session.headers.update({"Content-Type": "application/json"})

plugin_path = "imoveis-caixa-layout/imoveis-caixa-layout.php"
endpoint = f"{WP_URL}/wp-json/wp/v2/plugins/{plugin_path}"

print(f"Tentando deletar o plugin no caminho: {plugin_path}")
response = session.delete(endpoint)

if response.status_code == 200:
    print("Plugin deletado com sucesso pelo endpoint REST API!")
else:
    print(f"Falha na exclusao. Status: {response.status_code}")
    print(response.text)

# Listando os plugins atuais para verificar
print("\nVerificando plugins instalados...")
resp_list = session.get(f"{WP_URL}/wp-json/wp/v2/plugins")
if resp_list.status_code == 200:
    plugins = resp_list.json()
    for p in plugins:
        if "imovel" in p.get("name", "").lower() or "caixa" in p.get("name", "").lower():
            print(f"- Encontrou: {p['name']} | Status: {p['status']} | Caminho: {p['plugin']}")
else:
    print("Nao foi possivel listar os plugins via REST API.")
