import os
import mysql.connector
from dotenv import load_dotenv

load_dotenv()

WP_DB_NAME = os.getenv("WP_DB_NAME")
WP_DB_USER = os.getenv("WP_DB_USER")
WP_DB_PASSWORD = os.getenv("WP_DB_PASSWORD")
WP_DB_HOST = "213.190.4.156"

print(f"Limpando as URLs e ativando Permalinks SEO em: {WP_DB_USER}@{WP_DB_HOST} na base {WP_DB_NAME}...")

try:
    conn = mysql.connector.connect(
        host=WP_DB_HOST,
        user=WP_DB_USER,
        password=WP_DB_PASSWORD,
        database=WP_DB_NAME,
        connection_timeout=10
    )
    cursor = conn.cursor()
    
    # 1. Definir a estrutura de Permalink para apenas o nome do post
    cursor.execute("UPDATE wp_options SET option_value = '/%postname%/' WHERE option_name = 'permalink_structure'")
    print("✓ permalink_structure alterado para /%postname%/")
    
    # 2. Forçar o Flush (WP vai reconstruir as regras no proximo acesso de página)
    cursor.execute("UPDATE wp_options SET option_value = '' WHERE option_name = 'rewrite_rules'")
    print("✓ rewrite_rules resetado para forçar atualização")

    conn.commit()
    conn.close()
    
    print("\nSUCESSO: O WordPress agora usa links diretos para os posts!")
    
except Exception as e:
    print(f"Erro de Conexão MySQL: {e}")
