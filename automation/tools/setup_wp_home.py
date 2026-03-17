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

# Verifica se a página "Início" já existe
search_endpoint = f"{WP_URL}/wp-json/wp/v2/pages?search=Início"
resp = session.get(search_endpoint)
pages = resp.json()

page_id = None
for p in pages:
    if p['title']['rendered'] == "Início":
        page_id = p['id']
        break

content = """
<!-- wp:heading {"textAlign":"center"} -->
<h2 class="wp-block-heading has-text-align-center">Mais de 2.000 Imóveis da Caixa Retomados no Rio de Janeiro e Região</h2>
<!-- /wp:heading -->

<!-- wp:shortcode -->
[imoveis_caixa_grid]
<!-- /wp:shortcode -->
"""

if page_id:
    # Atualiza
    print(f"Atualizando página Início ID {page_id}")
    payload = {"content": content, "status": "publish"}
    session.post(f"{WP_URL}/wp-json/wp/v2/pages/{page_id}", json=payload)
else:
    # Cria
    print("Criando página Início")
    payload = {
        "title": "Início",
        "content": content,
        "status": "publish"
    }
    r = session.post(f"{WP_URL}/wp-json/wp/v2/pages", json=payload)
    if r.status_code in (200, 201):
        page_id = r.json()['id']

if page_id:
    # Setar para front page via wp_options ou wp-json (depende do suporte da REST API)
    # A REST API tem acesso às configurações (settings)
    settings_endpoint = f"{WP_URL}/wp-json/wp/v2/settings"
    settings_payload = {
        "show_on_front": "page",
        "page_on_front": page_id
    }
    r_settings = session.post(settings_endpoint, json=settings_payload)
    if r_settings.status_code == 200:
        print("Página Início configurada como Home com sucesso!")
    else:
        print(f"Página Início criada, mas falha ao configurar nas Settings: {r_settings.text}")
else:
    print("Falha ao criar/atualizar a página inicial.")
