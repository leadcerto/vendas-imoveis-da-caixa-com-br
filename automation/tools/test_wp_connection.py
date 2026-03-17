import os
import sys
import requests
from dotenv import load_dotenv
from requests.auth import HTTPBasicAuth

# Forca saida UTF-8 para terminal Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Carrega variaveis do .env
load_dotenv()

WP_URL = os.getenv("WP_URL")
WP_USERNAME = os.getenv("WP_USERNAME")
WP_APP_PASSWORD = os.getenv("WP_APP_PASSWORD")


def test_wp_connection():
    if not all([WP_URL, WP_USERNAME, WP_APP_PASSWORD]):
        print("ERRO: Variaveis do WordPress nao encontradas no .env")
        return

    api_url = f"{WP_URL}/wp-json/wp/v2/users/me"

    print(f"Testando conexao com: {api_url}")
    print(f"Usuario: {WP_USERNAME}")

    try:
        response = requests.get(
            api_url,
            auth=HTTPBasicAuth(WP_USERNAME, WP_APP_PASSWORD),
            timeout=10
        )

        if response.status_code == 200:
            user_data = response.json()
            print("\n[OK] Conexao bem-sucedida!")
            print(f"  Nome: {user_data.get('name')}")
            print(f"  ID: {user_data.get('id')}")
            print("  WordPress esta aceitando a autenticacao corretamente.")

        elif response.status_code == 401:
            print("\n[ERRO 401] Nao autorizado.")
            print("  A senha no .env e a senha de LOGIN, nao uma Senha de Aplicativo.")
            print("  Para gerar a senha correta:")
            print(f"    1. Acesse: {WP_URL}/wp-admin/profile.php")
            print("    2. Role ate 'Senhas de Aplicativo'")
            print("    3. Crie uma com o nome 'antigravity' e copie a chave gerada")
            print("    4. Atualize WP_APP_PASSWORD no .env com essa nova chave")

        else:
            print(f"\n[ERRO] Codigo de Status: {response.status_code}")
            print(f"Resposta: {response.text[:500]}")

    except requests.exceptions.ConnectionError:
        print("\n[ERRO] Nao foi possivel conectar ao servidor. Verifique a URL.")
    except Exception as e:
        print(f"\n[ERRO] Falha inesperada: {str(e)}")


if __name__ == "__main__":
    test_wp_connection()
