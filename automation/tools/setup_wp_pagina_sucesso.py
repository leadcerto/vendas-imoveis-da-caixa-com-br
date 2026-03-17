import os
import requests
from requests.auth import HTTPBasicAuth
import json
from dotenv import load_dotenv

load_dotenv()

WP_URL = os.getenv("WP_URL")
WP_USERNAME = os.getenv("WP_USERNAME")
WP_APP_PASSWORD = os.getenv("WP_APP_PASSWORD")

def criar_pagina_confirmacao():
    url_pages = f"{WP_URL}/wp-json/wp/v2/pages"
    auth = HTTPBasicAuth(WP_USERNAME, WP_APP_PASSWORD)
    
    # 1. Verifica se a página já existe pelo slug
    params = {'slug': 'cadastro-confirmado'}
    resp = requests.get(url_pages, auth=auth, params=params)
    
    if resp.status_code == 200 and len(resp.json()) > 0:
        print("Página '/cadastro-confirmado' já existe!")
        return
        
    # 2. Se não existe, cria com HTML bonito
    html_sucesso = """
    <div style="text-align: center; max-width: 600px; margin: 40px auto; padding: 40px 20px; background: #fff; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
        <div style="width: 80px; height: 80px; background: #e8f5e9; color: #4caf50; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
            <svg viewBox="0 0 24 24" fill="currentColor" width="40" height="40"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        </div>
        <h1 style="color: #005CA9; margin-bottom: 10px;">Solicitação Enviada com Sucesso!</h1>
        <p style="color: #666; font-size: 1.1em; line-height: 1.6;">Nossa equipe já recebeu seus dados. Em breve, enviaremos todos os detalhes do imóvel e os próximos passos para o seu WhatsApp e E-mail.</p>
        <p style="color: #888; font-size: 0.9em; margin-top: 30px;">Dica: Verifique sua caixa de spam caso não receba nosso e-mail de confirmação nos próximos minutos.</p>
        <a href="/" style="display: inline-block; background: #F9B200; color: #fff; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: bold; margin-top: 20px;">Voltar para Início</a>
    </div>
    """
    
    payload = {
        "title": "Cadastro Confirmado",
        "content": html_sucesso,
        "status": "publish",
        "slug": "cadastro-confirmado"
    }
    
    headers = {"Content-Type": "application/json"}
    print("Criando página de sucesso no WordPress...")
    
    res = requests.post(url_pages, auth=auth, headers=headers, json=payload)
    if res.status_code in (200, 201):
        print(f"Página '/cadastro-confirmado' criada com sucesso. ID: {res.json()['id']}")
    else:
        print(f"Erro ao criar página: {res.status_code} - {res.text}")

if __name__ == "__main__":
    criar_pagina_confirmacao()
