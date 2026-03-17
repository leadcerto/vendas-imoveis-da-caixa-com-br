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

payload = {
    "title": "Teste de Modelo Canvas",
    "content": "<h1>Este post não deve ter o header do site!</h1>",
    "status": "publish",
    "template": "elementor_canvas" # Elementor Canvas (sem header/footer) ou elementor_header_footer (Full width)
}

url = f"{WP_URL}/wp-json/wp/v2/posts"
resp = session.post(url, json=payload)

if resp.status_code in (200, 201):
    data = resp.json()
    print(f"Sucesso! URL: {data['link']} | Template salvo: {data.get('template')}")
else:
    print(f"Falha: {resp.status_code} - {resp.text}")
