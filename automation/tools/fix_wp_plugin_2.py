import os
import requests
from dotenv import load_dotenv
from requests.auth import HTTPBasicAuth

load_dotenv()

WP_URL = os.getenv("WP_URL")
WP_USERNAME = os.getenv("WP_USERNAME")
WP_APP_PASSWORD = os.getenv("WP_APP_PASSWORD")

# O WordPress REST API tem suporte para desativar plugins se enviarmos 'status': 'inactive'
session = requests.Session()
session.auth = HTTPBasicAuth(WP_USERNAME, WP_APP_PASSWORD)
session.headers.update({"Content-Type": "application/json"})

# Caminho padrão do plugin no WordPress (pasta/arquivo.php)
plugin_path = "imoveis-caixa-layout/imoveis-caixa-layout.php"
endpoint = f"{WP_URL}/wp-json/wp/v2/plugins/{plugin_path}"

# 1. Tentar desativar
print(f"Tentando desativar o plugin {plugin_path}...")
payload = {"status": "inactive"}
resp = session.post(endpoint, json=payload)

if resp.status_code == 200:
    print("Plugin desativado com sucesso!")
else:
    print(f"Falha ao desativar. HTTP {resp.status_code}")
    print(resp.text)

# 2. Tentar deletar
print(f"\nTentando deletar o plugin {plugin_path}...")
resp_del = session.delete(endpoint)
if resp_del.status_code == 200:
    print("Plugin deletado com sucesso do servidor!")
else:
    print(f"Falha ao deletar. HTTP {resp_del.status_code}")
    print(resp_del.text)
