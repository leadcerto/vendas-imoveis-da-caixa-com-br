import os
import requests
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

load_dotenv()

WP_URL = os.getenv("WP_URL")
WP_USERNAME = os.getenv("WP_USERNAME")
WP_APP_PASSWORD = os.getenv("WP_APP_PASSWORD")

session = requests.Session()
session.auth = HTTPBasicAuth(WP_USERNAME, WP_APP_PASSWORD)
session.headers.update({"Content-Type": "application/json"})

print("Buscando Temas/Modelos de Página Disponíveis no WordPress via API REST...")

url = f"{WP_URL}/wp-json/wp/v2/templates"
resp = session.get(url)

if resp.status_code == 200:
    templates = resp.json()
    print(f"\\nForam encontrados {len(templates)} modelos.")
    for t in templates:
         print(f" ID/Slug: {t.get('slug')} | Título: {t.get('title', {}).get('rendered', '')}")
else:
    print(f"Falha ao ler os modelos. Status: {resp.status_code} | Detalhes: {resp.text}")
