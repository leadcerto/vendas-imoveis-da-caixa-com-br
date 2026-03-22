import os
import asyncio
import random
import logging
import json
import argparse
import re
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
from supabase import create_client, Client
from dotenv import load_dotenv

# Configuração de Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)
# Silenciar logs excessivos do httpx (usado pelo supabase-py)
logging.getLogger("httpx").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)

# Carregar variáveis de ambiente
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("SUPABASE_URL ou SUPABASE_KEY não configurados no .env")
    exit(1)

# Cliente Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def extract_data_from_soup(soup: BeautifulSoup, property_num: str) -> Dict[str, Any]:
    """Extrai os 26 campos do HTML usando BeautifulSoup."""
    data: Dict[str, Any] = {}
    
    def get_val(label_text: str) -> Optional[str]:
        # Procura um span que contenha o texto do label
        for span in soup.find_all("span"):
            if label_text in span.get_text():
                # Tenta pegar o strong dentro dele
                strong = span.find("strong")
                if strong:
                    return strong.get_text(strip=True)
                # Fallback: remove o label do texto do span
                text = span.get_text(strip=True)
                # Remove o label (case insensitive) e o sinal de :
                clean = re.sub(rf'^{re.escape(label_text)}\s*:?', '', text, flags=re.IGNORECASE).strip()
                return clean if clean else None
        return None

    # 1. Cartório
    data['imovel_caixa_cartorio_matricula'] = get_val("Matrícula(s):")
    data['imovel_caixa_cartorio_comarca'] = get_val("Comarca:")
    data['imovel_caixa_cartorio_oficio'] = get_val("Ofício:")
    data['imovel_caixa_cartorio_inscricao_imobiliaria'] = get_val("Inscrição imobiliária:")
    data['imovel_caixa_cartorio_averbacao'] = get_val("Averbação dos leilões negativos:")

    # 2. Financeiro
    data['imovel_caixa_valor_avaliacao'] = get_val("Valor de avaliação:")
    # Tenta pegar valor de venda se não veio antes
    venda = get_val("Valor mínimo de venda:")
    if venda:
        data['imovel_caixa_valor_venda'] = venda
    
    # 3. Descrição
    data['imovel_caixa_descricao_csv'] = get_val("Descrição:")
    
    # 4. Status e Venda
    data['imovel_caixa_venda_tipo_oficial'] = get_val("Forma de venda:")
    if not data['imovel_caixa_venda_tipo_oficial']:
         data['imovel_caixa_venda_tipo_oficial'] = get_val("Modalidade de venda:")
         
    data['imovel_caixa_venda_vendedor'] = get_val("Vendedor:")
    data['imovel_caixa_venda_timer'] = get_val("Cronômetro:")
    
    # 5. Regras de Pagamento
    data['imovel_caixa_regra_condominio'] = "Os débitos de Condomínio são de responsabilidade do Comprador até 10% do valor de avaliação. O que exceder será pago pela CAIXA."
    data['imovel_caixa_regra_iptu'] = "Débitos de IPTU e taxas de lixo são de inteira responsabilidade do Comprador."
    
    # 6. Matrícula Link (Lógica de Padrão)
    # Tenta extrair o link real se existir
    matricula_a = soup.find("a", string=re.compile(r"Baixar matrícula", re.I))
    if matricula_a and matricula_a.has_attr("href"):
        href = matricula_a["href"]
        if href and not href.startswith("#") and "baixarMatricula" not in href:
            if not href.startswith("http"):
                href = "https://venda-imoveis.caixa.gov.br" + href
            data['imovel_caixa_link_matricula'] = href
    
    # Se ainda estiver vazio ou for #, e soubermos o número do imóvel e UF
    if not data.get('imovel_caixa_link_matricula') or data.get('imovel_caixa_link_matricula') == "#":
        uf = ""
        # Tenta pegar UF da comarca ou descrição
        if data.get('imovel_caixa_cartorio_comarca'):
            parts = data['imovel_caixa_cartorio_comarca'].split("-")
            if len(parts) > 1:
                uf = parts[-1].strip().upper()
        
        if not uf and data.get('imovel_caixa_descricao_csv'):
            match = re.search(r',\s*([A-Z]{2})\b', data['imovel_caixa_descricao_csv'])
            if match:
                uf = match.group(1)
        
        if uf and property_num:
            data['imovel_caixa_link_matricula'] = f"https://venda-imoveis.caixa.gov.br/editais/matricula/{uf}/{property_num}.pdf"

    # 7. Galeria de Fotos
    images = soup.find_all("img", alt=re.compile(r"Foto do imóvel", re.I))
    image_urls = []
    for img in images:
        src = img.get("src")
        if src:
            if not src.startswith("http"):
                src = "https://venda-imoveis.caixa.gov.br" + src
            # Evita duplicatas (as vezes o site repete o src no carrossel)
            if src not in image_urls:
                image_urls.append(src)
    if image_urls:
        data['imovel_caixa_galeria_fotos'] = image_urls

    return data

async def scrape_property(browser_context, property_url, property_id, property_num):
    """Raspa os detalhes de um único imóvel."""
    page = await browser_context.new_page()
    try:
        logger.info(f"Acessando url: {property_url}")
        await page.goto(property_url, timeout=90000, wait_until="domcontentloaded")
        
        # Espera o conteúdo JS renderizar
        await asyncio.sleep(6)
        
        html_content = await page.content()
        soup = BeautifulSoup(html_content, "html.parser")
        
        data = extract_data_from_soup(soup, str(property_num))
        
        # Backup e Timestamp
        data['imovel_caixa_detalhes_scraping'] = data.copy()
        data['updated_at'] = datetime.now(timezone.utc).isoformat()

        return data

    except Exception as e:
        logger.error(f"Erro ao raspar imóvel {property_id}: {e}")
        return None
    finally:
        await page.close()

async def main():
    parser = argparse.ArgumentParser(description="Raspador Compreensivo - Imóveis Caixa")
    parser.add_argument("--numero", type=str, help="Raspa um único imóvel pelo número_imovel")
    parser.add_argument("--lote", type=int, default=50, help="Número de imóveis a processar")
    args = parser.parse_args()

    # 1. Buscar imóveis
    query = supabase.table("imoveis").select("imoveis_id, imovel_caixa_link_acesso, imovel_caixa_numero")
    
    if args.numero:
        logger.info(f"Buscando imóvel nº {args.numero}")
        query = query.eq("imovel_caixa_numero", int(args.numero))
    else:
        query = query.is_("imovel_caixa_detalhes_scraping", "null").limit(args.lote)
    
    response = query.execute()
    properties_to_scrape = response.data
    
    if not properties_to_scrape:
        logger.info("Nenhum imóvel pendente de raspagem.")
        return

    logger.info(f"Iniciando raspagem de {len(properties_to_scrape)} imóveis.")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800}
        )
        
        for prop in properties_to_scrape:
            prop_id = prop['imoveis_id']
            url = prop['imovel_caixa_link_acesso']
            num = prop.get('imovel_caixa_numero', 'N/A')
            
            if not url:
                logger.warning(f"Imóvel {prop_id} (nº {num}) sem link de acesso. Pulando.")
                continue
                
            logger.info(f"Processando imóvel {prop_id} (nº {num})...")
            scraped_data = await scrape_property(context, url, prop_id, num)
            
            if scraped_data:
                try:
                    # Filtra None e atualiza
                    update_payload = {k: v for k, v in scraped_data.items() if v is not None}
                    supabase.table("imoveis").update(update_payload).eq("imoveis_id", prop_id).execute()
                    logger.info(f"✅ Imóvel {prop_id} (nº {num}) atualizado.")
                except Exception as e:
                    logger.error(f"❌ Erro ao salvar dados do imóvel {prop_id}: {e}")
            
            if len(properties_to_scrape) > 1:
                delay = random.uniform(5, 12)
                logger.info(f"Aguardando {delay:.2f} segundos...")
                await asyncio.sleep(delay)
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
