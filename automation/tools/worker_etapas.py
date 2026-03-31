import os
import time
import subprocess
import logging
from dotenv import load_dotenv

load_dotenv("../../web/.env")

# Configurar logs
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("WORKER")

# Caminhos dos scripts relativos a este worker (mesma pasta)
SCRIPT_ETAPA_3 = "etapa3_scraping.py"
SCRIPT_ETAPA_4 = "etapa4_enriquecimento.py"

def run_script(script_name):
    """Executa um script python via subprocess."""
    logger.info(f"🚀 Iniciando {script_name}...")
    try:
        # Usa python em sistema Windows/Linux padronizado
        process = subprocess.run(["python", script_name], capture_output=True, text=True)
        if process.returncode == 0:
            logger.info(f"✅ {script_name} finalizado com sucesso.")
            # Opcional: print(process.stdout) para ver o log do filho
        else:
            logger.error(f"❌ Erro ao rodar {script_name}:\n{process.stderr}")
    except Exception as e:
        logger.error(f"⚠️ Falha de sistema ao tentar rodar {script_name}: {e}")

def start_worker():
    logger.info("🤖 Iniciando Worker de Background (Etapas 3 e 4). Pressione Ctrl+C para parar.")
    
    intervalo_segundos = 60 # Verifica a fila a cada 1 minuto (Aumente se necessário)

    while True:
        try:
            logger.info("🔍 Checando se há tarefas pendentes...")
            
            # Aqui no Worker Master, nós tentamos rodar a Etapa 3. 
            # A própria Etapa 3 tem a lógica que checa SE há imóveis ("WHERE etapa_processamento = 2").
            # Se não tiver, o script encerra rápido (em milisegundos).
            run_script(SCRIPT_ETAPA_3)
            
            # Espera 5 segundos de fôlego pro BD após scraping
            time.sleep(5)
            
            # Executa a inteligência artificial para imóveis "WHERE etapa_processamento = 3"
            run_script(SCRIPT_ETAPA_4)

        except KeyboardInterrupt:
            logger.info("🛑 Worker parado pelo usuário.")
            break
        except Exception as e:
            logger.error(f"Erro no loop do Worker: {e}")
        
        logger.info(f"💤 Sem tarefas pesadas ou processo encerrado, dormindo por {intervalo_segundos}s...")
        time.sleep(intervalo_segundos)

if __name__ == "__main__":
    start_worker()
