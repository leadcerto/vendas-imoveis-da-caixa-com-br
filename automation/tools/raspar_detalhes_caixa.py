"""
raspar_detalhes_caixa.py
========================
Raspa os detalhes individuais de cada imóvel no site da Caixa Econômica Federal
e atualiza a tabela imoveis_caixa no Supabase com os campos faltantes.

Campos atualizados:
  - tipo_imovel              : Apartamento, Casa, Terreno, etc.
  - cep                      : CEP do imóvel
  - complemento              : Complemento do endereço (Apto, Bloco, etc.)
  - banheiros                : Número de banheiros
  - aceita_fgts              : Boolean - permite FGTS
  - aceita_recursos_proprios : Boolean - aceita recursos próprios
  - observacoes              : Observações extras (área não averbada, etc.)
  - url_matricula            : Link para o PDF da matrícula
  - raspado_em               : Timestamp da raspagem

Uso:
  python raspar_detalhes_caixa.py             # raspa todos sem dados
  python raspar_detalhes_caixa.py --reraspar  # força re-raspagem
  python raspar_detalhes_caixa.py --lote 50   # processa N por vez
  python raspar_detalhes_caixa.py --numero 8555516298464  # imóvel único
"""

import os
import sys
import re
import time
import logging
import argparse
from datetime import datetime, timezone
from typing import Optional

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from supabase import create_client, Client

# ─── CONFIG ───────────────────────────────────────────────────────────────────

sys.stdout.reconfigure(encoding='utf-8')
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)
log = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

BASE_URL = "https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp"
PAUSA_ENTRE_REQUESTS = 1.5  # Segundos entre requisições
TIMEOUT = 25                 # Timeout por request em segundos
LOTE_PADRAO = 100            # Quantidade a processar por execução

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9",
    "Referer": "https://venda-imoveis.caixa.gov.br/",
}


# ─── PARSER ───────────────────────────────────────────────────────────────────

def _texto_bruto(html: str) -> str:
    """Extrai texto limpo do HTML, removendo scripts e estilos."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    texto = soup.get_text(separator=" ")
    return re.sub(r'[ \t]+', ' ', texto)


def parse_pagina_caixa(html: str, numero_imovel: str) -> dict:
    """
    Extrai campos da página de detalhe da Caixa usando regex.
    O site renderiza parte do conteúdo via JS, por isso trabalhamos
    com o texto bruto retornado pelo servidor.
    """
    texto = _texto_bruto(html)
    tu = texto.upper()  # Versão maiúscula para comparações
    soup = BeautifulSoup(html, "html.parser")
    dados: dict = {}

    # ── Tipo do Imóvel ────────────────────────────────────────────────────────
    tipo_map = [
        ("APARTAMENTO", "Apartamento"),
        ("CASA ", "Casa"),
        ("TERRENO", "Terreno"),
        ("LOTE ", "Terreno"),
        ("SALA COMERCIAL", "Imóvel Comercial"),
        ("LOJA ", "Imóvel Comercial"),
        ("GALPÃO", "Imóvel Comercial"),
        ("GALPAO", "Imóvel Comercial"),
        ("RURAL", "Imóvel Rural"),
        ("CHÁCARA", "Imóvel Rural"),
        ("FAZENDA", "Imóvel Rural"),
        ("SÍTIO", "Imóvel Rural"),
    ]
    dados["tipo_imovel"] = "Imóvel"
    for chave, valor in tipo_map:
        if chave in tu:
            dados["tipo_imovel"] = valor
            break

    # ── CEP ───────────────────────────────────────────────────────────────────
    cep_match = re.search(r'\b(\d{5})[-\s]?(\d{3})\b', texto)
    if cep_match:
        dados["cep"] = f"{cep_match.group(1)}-{cep_match.group(2)}"

    # ── Complemento do endereço ───────────────────────────────────────────────
    comp_match = re.search(
        r'\b(APTO\.?\s*\d+|APT\.?\s*\d+|APARTAMENTO\s*\d+|BLOCO\s+[\w]+|BLC\s+[\w]+|CASA\s+\d+)',
        tu
    )
    if comp_match:
        dados["complemento"] = comp_match.group(1).title()

    # ── Banheiros ─────────────────────────────────────────────────────────────
    ban_match = re.search(r'(\d+)\s*(?:BANHEIRO|WC|W\.C|SANITÁRIO|LAVABO)', tu)
    if ban_match:
        dados["banheiros"] = int(ban_match.group(1))

    # ── FGTS ─────────────────────────────────────────────────────────────────
    if re.search(r'NÃO\s+(?:PERMITE|ACEITA)\s+FGTS|SEM\s+FGTS|FGTS\s*:\s*NÃO', tu):
        dados["aceita_fgts"] = False
    elif "FGTS" in tu:
        dados["aceita_fgts"] = True

    # ── Recursos Próprios ─────────────────────────────────────────────────────
    if re.search(r'RECURSOS?\s+PR[ÓO]PRIOS?', tu):
        dados["aceita_recursos_proprios"] = True

    # ── Observações ───────────────────────────────────────────────────────────
    obs_parts = []
    if re.search(r'[ÁA]REA\s+N[ÃA]O\s+AVERBADA', tu):
        obs_parts.append("Existe área não averbada")
    if "GRAVAME" in tu:
        obs_parts.append("Possui gravame")
    if "PENHORA" in tu:
        obs_parts.append("Possui penhora")
    if "INDISPONIBILIDADE" in tu:
        obs_parts.append("Possui indisponibilidade")
    if "EM TRATAMENTO" in tu:
        obs_parts.append("Averbação de leilões em tratamento")
    if obs_parts:
        dados["observacoes"] = " | ".join(obs_parts)

    # ── URL da Matrícula ──────────────────────────────────────────────────────
    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        link_text = a.get_text(strip=True).lower()
        if any(kw in link_text for kw in ["matrícula", "matricula", "certidão", "certidao"]) \
                or ".pdf" in href.lower():
            if href.startswith("http"):
                dados["url_matricula"] = href
            elif href.startswith("/"):
                dados["url_matricula"] = f"https://venda-imoveis.caixa.gov.br{href}"
            break

    # ── Timestamp ─────────────────────────────────────────────────────────────
    dados["raspado_em"] = datetime.now(timezone.utc).isoformat()

    return dados


# ─── RASPAGEM HTTP ─────────────────────────────────────────────────────────────

def raspar_imovel(session: requests.Session, numero_imovel: str) -> Optional[dict]:
    """Faz o request e retorna os dados parseados, ou None em caso de erro."""
    url = f"{BASE_URL}?hdnOrigem=index&hdnimovel={numero_imovel}"
    try:
        resp = session.get(url, timeout=TIMEOUT)
        if resp.status_code != 200:
            log.warning(f"[{numero_imovel}] HTTP {resp.status_code}")
            return None

        # Força UTF-8 pois o servidor às vezes retorna charset errado
        resp.encoding = resp.apparent_encoding or "utf-8"

        # Verifica se a página retornou conteúdo válido
        if len(resp.text) < 1000:
            log.warning(f"[{numero_imovel}] Página muito curta ({len(resp.text)} chars) - possível imóvel inativo")
            return None

        dados = parse_pagina_caixa(resp.text, numero_imovel)
        return dados

    except requests.exceptions.Timeout:
        log.warning(f"[{numero_imovel}] Timeout na requisição.")
        return None
    except Exception as e:
        log.error(f"[{numero_imovel}] Erro inesperado: {e}")
        return None


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Raspador de detalhes - Imóveis Caixa")
    parser.add_argument("--reraspar", action="store_true",
                        help="Re-raspa mesmo os já processados (atualiza todos)")
    parser.add_argument("--lote", type=int, default=LOTE_PADRAO,
                        help=f"Número de imóveis a processar (padrão: {LOTE_PADRAO})")
    parser.add_argument("--numero", type=str,
                        help="Raspa um único imóvel pelo número_imovel")
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        log.error("SUPABASE_URL e SUPABASE_KEY não encontrados no .env")
        sys.exit(1)

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    log.info("✅ Conectado ao Supabase.")

    session = requests.Session()
    session.headers.update(HEADERS)

    # ── Buscar imóveis ─────────────────────────────────────────────────────────
    try:
        query = supabase.table("imoveis_caixa").select("id, numero_imovel")

        if args.numero:
            query = query.eq("numero_imovel", args.numero)
        elif args.reraspar:
            query = query.order("atualizado_em", desc=True).limit(args.lote)
        else:
            # Prioriza imóveis com destaque que ainda não foram raspados
            query = (
                query
                .is_("raspado_em", "null")
                .order("tags_destaque", desc=True)
                .limit(args.lote)
            )

        resultado = query.execute()
        imoveis = resultado.data

    except Exception as e:
        log.error(f"Erro ao buscar imóveis do Supabase: {e}")
        sys.exit(1)

    if not imoveis:
        log.info("Nenhum imóvel para processar. Tudo atualizado!")
        return

    total = len(imoveis)
    log.info(f"📦 {total} imóveis para raspar. Iniciando...")
    sucesso = erros = 0

    for idx, imovel in enumerate(imoveis, 1):
        numero = imovel["numero_imovel"]
        imovel_id = imovel["id"]

        log.info(f"[{idx:04d}/{total}] Raspando nº {numero}...")

        dados = raspar_imovel(session, numero)

        if dados:
            try:
                supabase.table("imoveis_caixa").update(dados).eq("id", imovel_id).execute()
                log.info(
                    f"  ✅ {numero} | tipo: {dados.get('tipo_imovel', '-')} | "
                    f"fgts: {dados.get('aceita_fgts', '-')} | "
                    f"cep: {dados.get('cep', '-')} | "
                    f"banheiros: {dados.get('banheiros', '-')}"
                )
                sucesso += 1
            except Exception as e:
                log.error(f"  ❌ Erro ao salvar {numero}: {e}")
                erros += 1
        else:
            log.warning(f"  ⚠️  {numero} — falha na raspagem, pulando.")
            erros += 1

        # Pausa para não sobrecarregar o servidor da Caixa
        if idx < total:
            time.sleep(PAUSA_ENTRE_REQUESTS)

    log.info(f"\n{'='*50}")
    log.info(f"✅ Concluído — Sucesso: {sucesso} | Erros: {erros} | Total: {total}")
    log.info(f"{'='*50}")


if __name__ == "__main__":
    main()
