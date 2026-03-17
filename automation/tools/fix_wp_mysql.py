import os
import mysql.connector
import json
from dotenv import load_dotenv

load_dotenv()

# Credenciais do .env
WP_DB_NAME = os.getenv("WP_DB_NAME")
WP_DB_USER = os.getenv("WP_DB_USER")
WP_DB_PASSWORD = os.getenv("WP_DB_PASSWORD")
WP_DB_HOST = "213.190.4.156" # IP da Hostinger extraído das conexoes antigas ou default para remoto

print(f"Tentando conectar ao MySQL: {WP_DB_USER}@{WP_DB_HOST} na base {WP_DB_NAME}...")

try:
    conn = mysql.connector.connect(
        host=WP_DB_HOST,
        user=WP_DB_USER,
        password=WP_DB_PASSWORD,
        database=WP_DB_NAME,
        connection_timeout=10
    )
    cursor = conn.cursor()
    
    # Busca os plugins ativos na wp_options
    cursor.execute("SELECT option_value FROM wp_options WHERE option_name = 'active_plugins'")
    result = cursor.fetchone()
    
    if result:
        # A string retornada é um array PHP serializado. Vamos primeiro ver como está:
        print("Plugins ativos atuais (Serializado):")
        print(result[0])
    
    conn.close()
    
except Exception as e:
    print(f"Erro de Conexão MySQL: {e}")
