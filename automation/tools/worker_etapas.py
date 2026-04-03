import os
import sys
import subprocess
import time
import logging
import psutil
from dotenv import load_dotenv
from supabase import create_client, Client

# Forçar UTF-8 no console Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_path = os.path.join(ROOT_DIR, "..", "web", ".env")
load_dotenv(env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("❌ ERRO: SUPABASE_URL ou SUPABASE_KEY não encontrados.")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
TEMP_DIR = os.path.join(os.path.dirname(__file__), "temp_downloads")
os.makedirs(TEMP_DIR, exist_ok=True)

SCRIPTS = {
    "etapa1": "etapa1_cadastro_basico.py",
    "etapa2": "etapa2_seo_grupos.py",
    "etapa3": "etapa3_scraping.py",
    "etapa4": "etapa4_enriquecimento.py"
}

def is_script_running(script_name):
    """Verifica se um script python já está rodando no sistema."""
    for proc in psutil.process_iter(['cmdline']):
        try:
            cmdline = proc.info.get('cmdline') or []
            if any(script_name in s for s in cmdline):
                return True
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return False

def run_script_sync(script_name, args=[]):
    """Executa script de forma síncrona (bloqueante)."""
    cmd = ["python", script_name] + args
    logger.info(f"🚀 [SYNC] Rodando {script_name}...")
    try:
        process = subprocess.run(cmd, capture_output=True, text=True, errors='replace')
        return process.returncode == 0, process.stdout if process.returncode == 0 else process.stderr
    except Exception as e:
        return False, str(e)

def run_script_async(script_name):
    """Inicia script em background se não estiver rodando."""
    if is_script_running(script_name):
        return
    logger.info(f"🛰️ [ASYNC] Iniciando {script_name} em background...")
    subprocess.Popen(["python", script_name], shell=True)

def download_file(storage_path):
    local_path = os.path.join(TEMP_DIR, os.path.basename(storage_path))
    try:
        res = supabase.storage.from_("csv-caixa").download(storage_path)
        with open(local_path, "wb") as f:
            f.write(res)
        return local_path
    except Exception as e:
        logger.error(f"❌ Erro download: {e}")
        return None

def process_new_uploads():
    """Etapas 1 e 2: Novos arquivos detectados."""
    try:
        res = supabase.table("logs_ingestao").select("*").eq("total_lidos", 0).order("created_at").limit(1).execute()
        if not res.data: return False
        
        log = res.data[0]
        log_id = log["id"]
        meta = log.get("motivos_rejeicao") or {}
        if isinstance(meta, str):
            import json
            try: meta = json.loads(meta)
            except: meta = {}
            
        storage_path = meta.get("storage_path")
        if not storage_path:
            supabase.table("logs_ingestao").update({"total_lidos": -1}).eq("id", log_id).execute()
            return False

        local_file = download_file(storage_path)
        if local_file:
            success1, out1 = run_script_sync(SCRIPTS["etapa1"], [local_file])
            if success1:
                # Update status para indicar que Etapa 1 passou (9000 para RJ)
                supabase.table("logs_ingestao").update({"total_lidos": 9000, "total_aceitos": 9000}).eq("id", log_id).execute()
                run_script_sync(SCRIPTS["etapa2"])
                try: os.remove(local_file)
                except: pass
                return True
    except Exception as e:
        logger.error(f"Erro process_new_uploads: {e}")
    return False

def check_background_stages():
    """Gerencia as Etapas 3 e 4 de forma assíncrona."""
    try:
        # Etapa 3 (Scraping)
        c2 = supabase.table("imoveis").select("imoveis_id", count="exact").eq("etapa_processamento", 2).limit(1).execute()
        if c2.count and c2.count > 0:
            run_script_async(SCRIPTS["etapa3"])
            
        # Etapa 4 (IA)
        c3 = supabase.table("imoveis").select("imoveis_id", count="exact").eq("etapa_processamento", 3).limit(1).execute()
        if c3.count and c3.count > 0:
            run_script_async(SCRIPTS["etapa4"])
    except Exception as e:
        logger.error(f"Erro background_stages: {e}")

def main():
    logger.info("🤖 Master Worker (RELOADED) - Orquestração Total Ativa.")
    while True:
        try:
            logger.info("🔍 Ciclo de monitoramento...")
            # 1. Processar novos arquivos primeiro (prioridade)
            found_new = process_new_uploads()
            
            # 2. Garantir que as esteiras de background estão rodando
            check_background_stages()
            
            logger.info("💤 Monitorando... Próximo ciclo em 60s.")
        except Exception as e:
            logger.error(f"💥 Erro Master: {e}")
        time.sleep(60)

if __name__ == "__main__":
    main()
