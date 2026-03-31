"""
Pipeline Automático de Ingestão de CSVs da CAIXA
=================================================
Executa automaticamente os 11 passos do cadastramento oficial.
"""

import os
import re
import sys
import time
import json
import pandas as pd
import glob
import unicodedata
import shutil
import requests
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

# ---------------------------------------------------------------------------
# ENCODING
# ---------------------------------------------------------------------------
if sys.version_info >= (3, 7):
    sys.stdin.reconfigure(encoding='utf-8')
    sys.stdout.reconfigure(encoding='utf-8')

# ---------------------------------------------------------------------------
# CONFIGURAÇÃO
# ---------------------------------------------------------------------------
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
CSV_DIR = os.path.join(Path(__file__).parent.parent, "csv-caixa")

# [PASSO 02] Filtros estratégicos conforme documento de cadastramento
DESCONTO_MINIMO = 30.0  # Regra de Negócio: Excluir imóveis com lucro < 30%
MODALIDADES_ACEITAS = ["Venda Online", "Venda Direta Online"]


# Delay entre requisições de scraping (segundos) – para não sobrecarregar a CAIXA
SCRAPING_DELAY = 1.5

# ---------------------------------------------------------------------------
# NORMALIZER DE BAIRROS
# ---------------------------------------------------------------------------
sys.path.insert(0, str(Path(__file__).parent.parent))
try:
    from modules.data_processing.normalizers.bairro_normalizer import BairroNormalizer
    NORMALIZER = BairroNormalizer()
except Exception:
    class SimpleNormalizer:
        def normalize(self, text): return str(text).upper().strip()
    NORMALIZER = SimpleNormalizer()
    print("[AVISO] BairroNormalizer nao encontrado. Usando normalizacao simples.")

# ---------------------------------------------------------------------------
# CLIENTE SUPABASE
# ---------------------------------------------------------------------------
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)





# ---------------------------------------------------------------------------
# UTILITÁRIOS
# ---------------------------------------------------------------------------

def normalize_text(text):
    if not text: return ""
    return "".join(c for c in unicodedata.normalize('NFD', str(text).strip().upper())
                   if unicodedata.category(c) != 'Mn')


def generate_seo_fields(numero, modalidade, uf, cidade, bairro, desconto_moeda, tipo):
    tipo    = str(tipo    or 'Imóvel').replace('None', 'Imóvel')
    bairro  = str(bairro  or '').replace('None', '')
    cidade  = str(cidade  or '').replace('None', '')
    uf      = str(uf      or '').replace('None', '')

    titulo = f"🔴 {tipo} {bairro} {cidade} {uf} {numero} Imóvel CAIXA 🧡💙"

    def fmt_brl(val):
        return f"R$ {float(val):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    descricao = f"Imóvel CAIXA {tipo} {bairro} {cidade} {uf} com desconto de {fmt_brl(desconto_moeda)}. ⚠️ Estamos Online!"
    keyword   = f"{tipo} {bairro} {cidade} {uf}"

    def seo_part(text):
        if not text: return ""
        n = "".join(c for c in unicodedata.normalize('NFD', str(text).strip().lower())
                    if unicodedata.category(c) != 'Mn')
        n = n.replace(" ", "_").replace("-", "_")
        return re.sub(r'[^a-z0-9_]', '', n)

    slug = f"{seo_part(tipo)}-{seo_part(bairro)}-{seo_part(cidade)}-{seo_part(uf)}-{numero}"
    return titulo, slug, descricao, keyword


def parse_brl_numeric(val):
    """Converte strings financeiras (BR e US) para float de forma robusta."""
    if val is None or (hasattr(val, 'isna') and val.isna()) or str(val).lower() in ['nan', 'none', '']:
        return 0.0
    
    s = str(val).replace('R$', '').replace('%', '').strip()
    if not s:
        return 0.0
    
    # 1.234,56 (BR) -> 1234.56
    if ',' in s and '.' in s:
        s = s.replace('.', '').replace(',', '.')
    # 1234,56 (BR simplificado) -> 1234.56
    elif ',' in s:
        s = s.replace(',', '.')
    # 1234.56 (Excel/Python) ou 1.234 (BR sem centavos)
    elif '.' in s:
        parts = s.split('.')
        # Se termina em .XX (ex: .50 ou .5), tratamos como decimal (Python/Excel float)
        if len(parts[-1]) <= 2:
            pass 
        # Se termina em .XXX (ex: .000), tratamos como milhar (Padrão BR)
        elif len(parts[-1]) == 3:
            s = s.replace('.', '')
            
    try:
        return float(s)
    except Exception:
        return 0.0


def extract_features_from_desc(description):
    """Auto-complete dos 13 campos de características a partir da descrição do CSV."""
    if not description:
        return {}
    desc = description.lower()

    def get_num(pattern, text):
        m = re.search(pattern, text)
        if m:
            try: return float(m.group(1).replace(',', '.'))
            except: return 0.0
        return 0.0

    def get_int(pattern, text):
        m = re.search(pattern, text)
        if m:
            try: return int(m.group(1))
            except: return 0
        return 0

    def has(kws):
        return any(kw in desc for kw in kws)

    return {
        "imovel_caixa_descricao_area_total":      get_num(r'([\d\.,]+)\s*de área total', desc),
        "imovel_caixa_descricao_area_privativa":  get_num(r'([\d\.,]+)\s*de área privativa', desc),
        "imovel_caixa_descricao_area_do_terreno": get_num(r'([\d\.,]+)\s*de área do terreno', desc),
        "imovel_caixa_descricao_quartos":         get_int(r'(\d+)\s*qto', desc),
        "imovel_caixa_descricao_garagem":         get_int(r'(\d+)\s*(?:vaga|garagem)', desc),
        "imovel_caixa_descricao_wc_banheiro":     get_int(r'(\d+)\s*wc', desc) or (1 if 'wc' in desc else 0),
        "imovel_caixa_pagamento_condominio":      parse_brl_numeric(row.get(c_desc, '')) if 'débitos de condomínio' in str(row.get(c_desc, '')).lower() else get_num(r'débitos de condomínio no valor de r\$\s*([\d\.,]+)', desc),
        "imovel_caixa_descricao_churrasqueira":   has(['churrasqueira']),
        "imovel_caixa_descricao_cozinha":         has(['cozinha']),
        "imovel_caixa_descricao_piscina":         has(['piscina']),
        "imovel_caixa_descricao_sala":            has(['sala']),
        "imovel_caixa_descricao_terraco":         has(['terraço', 'terraco']),
        "imovel_caixa_descricao_varanda":         has(['varanda']),
        "imovel_caixa_descricao_area_servico":    has(['área de serviço', 'area de servico']),
    }


def parse_address(raw_address):
    """Separa o endereço CSV em logradouro, número e complemento."""
    if not raw_address:
        return "", "", ""

    raw = str(raw_address).strip()

    # Padrões comuns: "Rua Fulano, 123, Apto 45"
    # Tenta dividir por vírgulas
    parts = [p.strip() for p in raw.split(',')]

    logradouro   = parts[0] if len(parts) > 0 else raw
    numero       = ""
    complemento  = ""

    if len(parts) >= 2:
        # Verifica se segunda parte é número
        if re.match(r'^\d+', parts[1].strip()):
            numero = parts[1].strip()
            complemento = ", ".join(parts[2:]) if len(parts) > 2 else ""
        else:
            complemento = ", ".join(parts[1:])

    # Remove duplicidade do logradouro (ex: "Rua X Rua X" → "Rua X")
    logradouro = re.sub(r'(\b\w+\b)( \1)+', r'\1', logradouro, flags=re.IGNORECASE)

    return logradouro.strip(), numero.strip(), complemento.strip()


# ---------------------------------------------------------------------------
# RESOLVERS DE DADOS MESTRES
# ---------------------------------------------------------------------------

class MasterDataLoader:
    """Carrega e mantém em memória todos os dados mestres necessários."""

    def __init__(self, sb: Client):
        self.sb = sb
        self.estados   = {}   # {sigla_norm: id}
        self.cidades   = {}   # {(id_uf, nome_norm): id}
        self.bairros   = {}   # {(id_cidade, nome_norm): id}
        self.grupos    = []   # [{id, valor_minimo, valor_maximo, ...}]
        self.tipos     = {}   # {nome_norm: id}
        self.naturezas = {}   # {tipo_norm: id}
        self.storage_cache = set() # {filename}
        self._load()

    def _load_storage_cache(self):
        """Pre-carrega a lista de arquivos no bucket imoveis-destaque."""
        print("[INFO] Sincronizando cache de imagens (Supabase Storage)...")
        try:
            # Lista arquivos do bucket (máximo 1000 por padrão, mas podemos paginar se necessário)
            # Para simplificar, vamos carregar os primeiros 10.000 (o que deve ser suficiente por agora)
            res = self.sb.storage.from_("imoveis-destaque").list(path="", options={"limit": 10000})
            if res:
                self.storage_cache = {o["name"] for o in res if "name" in o}
            print(f"   ✅ {len(self.storage_cache)} imagens encontradas no Storage.")
        except Exception as e:
            print(f"   [AVISO] Falha ao carregar cache de imagens: {e}")

    def _paginate(self, table, select, page_size=1000):
        all_rows, page = [], 0
        while True:
            res = self.sb.table(table).select(select).range(page * page_size, (page + 1) * page_size - 1).execute()
            if not res.data: break
            all_rows.extend(res.data)
            page += 1
        return all_rows

    def _load(self):
        print("[INFO] Carregando dados mestres...")

        for r in self.sb.table("estados").select("id, sigla").execute().data:
            self.estados[normalize_text(r['sigla'])] = r['id']

        for r in self._paginate("cidades", "id, id_uf, nome"):
            self.cidades[(r['id_uf'], normalize_text(r['nome']))] = r['id']

        for r in self._paginate("bairros", "id, id_cidade, nome"):
            self.bairros[(r['id_cidade'], normalize_text(r['nome']))] = r['id']

        grupos_raw = self.sb.table("grupos_imovel").select(
            "id, valor_minimo, valor_maximo, compra_financiamento_entrada_caixa, compra_financiamento_prestacao"
        ).order("valor_minimo").execute().data
        self.grupos = grupos_raw or []

        for r in self.sb.table("tipos_imovel").select("id, nome").execute().data:
            self.tipos[normalize_text(r['nome'])] = r['id']

        for r in self.sb.table("naturezas_imovel").select("natureza_imovel_id, natureza_imovel_tipo").execute().data:
            self.naturezas[normalize_text(r['natureza_imovel_tipo'])] = r['natureza_imovel_id']

        print(f"[INFO] Dados mestres: {len(self.estados)} UFs | {len(self.cidades)} Cidades | "
              f"{len(self.bairros)} Bairros | {len(self.grupos)} Grupos | "
              f"{len(self.tipos)} Tipos | {len(self.naturezas)} Naturezas")
        
        self._load_storage_cache()

    def resolve_location(self, uf_sigla, cidade_nome, bairro_nome, default_uf=None):
        sigla = uf_sigla or default_uf
        uf_id = self.estados.get(normalize_text(sigla))
        cidade_id = bairro_id = None
        requer_revisao = False

        if uf_id:
            cidade_id = self.cidades.get((uf_id, normalize_text(cidade_nome)))
            if cidade_id:
                bnorm = normalize_text(NORMALIZER.normalize(bairro_nome))
                bairro_id = self.bairros.get((cidade_id, bnorm))
                if not bairro_id:
                    requer_revisao = True
            else:
                requer_revisao = True
        else:
            requer_revisao = True

        return uf_id, cidade_id, bairro_id, requer_revisao, sigla

    def resolve_group(self, preco):
        """Retorna o id do grupo e os parâmetros financeiros conforme o preço de venda."""
        for g in self.grupos:
            vmin = float(g.get('valor_minimo') or 0)
            vmax = float(g.get('valor_maximo') or 0)
            if vmin <= float(preco) <= vmax:
                return g
        return None

    def resolve_tipo(self, tipo_nome):
        return self.tipos.get(normalize_text(tipo_nome))

    def resolve_natureza(self, descricao_csv):
        """Infere natureza do imóvel pelo conteúdo da descrição."""
        if not descricao_csv:
            return None
        desc = descricao_csv.lower()
        keywords_map = {
            "RESIDENCIAL":  ["apartamento", "casa", "residencial", "quarto"],
            "COMERCIAL":    ["loja", "sala comercial", "galpão", "galpao", "sala"],
            "TERRENO":      ["terreno", "lote"],
            "RURAL":        ["rural", "sítio", "sitio", "fazenda", "chácara"],
        }
        for natureza, kws in keywords_map.items():
            if any(kw in desc for kw in kws):
                return self.naturezas.get(normalize_text(natureza))
        return None


# ---------------------------------------------------------------------------
# PASSO 04 — SCRAPING
# ---------------------------------------------------------------------------

SCRAPING_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept-Language": "pt-BR,pt;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
}

_scraping_session = None

def get_scraping_session():
    global _scraping_session
    if _scraping_session is None:
        _scraping_session = requests.Session()
        # Tenta carregar cookies de um arquivo local para bypass de CAPTCHA
        cookies_path = os.path.join(os.path.dirname(__file__), "cookies.json")
        if os.path.exists(cookies_path):
            try:
                with open(cookies_path, "r", encoding="utf-8") as f:
                    captured_cookies = json.load(f)
                    _scraping_session.cookies.update(captured_cookies)
                print(f"  [SESSION] {len(captured_cookies)} cookies carregados de cookies.json")
            except Exception as e:
                print(f"  [WARNING] Erro ao carregar cookies.json: {e}")
                
        _scraping_session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Cache-Control": "max-age=0"
        })
    return _scraping_session

def scrape_imovel(numero, uf_sigla, link_direto):
    """
    Acessa a página do imóvel na CAIXA e extrai todos os dados disponíveis.
    Retorna um dicionário com os campos a serem atualizados.
    """
    try:
        session = get_scraping_session()
        resp = session.get(link_direto, timeout=20)
        resp.encoding = 'utf-8'
        if resp.status_code != 200:
            print(f"  [SCRAPING] {numero}: HTTP {resp.status_code}")
            return None

        html = resp.text

        # Salva o HTML bruto como JSON para auditoria
        raw_data = {"html_length": len(html), "url": link_direto, "scraped_at": datetime.now().isoformat()}

        result = {"imovel_caixa_detalhes_scraping": json.dumps(raw_data, ensure_ascii=False)}

        def extract(pattern, default=""):
            m = re.search(pattern, html, re.IGNORECASE | re.DOTALL)
            return m.group(1).strip() if m else default

        # Dados de cartório
        result["imovel_caixa_cartorio_matricula"]            = extract(r'Matr[íi]cula\(s\).*?<[^>]+>([^<]+)<')
        result["imovel_caixa_cartorio_oficio"]               = extract(r'Of[íi]cio.*?<[^>]+>([^<]+)<')
        result["imovel_caixa_cartorio_comarca"]              = extract(r'Comarca.*?<[^>]+>([^<]+)<')
        result["imovel_caixa_cartorio_inscricao_imobiliaria"]= extract(r'Inscri[çc][aã]o imobili[aá]ria.*?<[^>]+>([^<]+)<')
        result["imovel_caixa_cartorio_averbacao"]            = extract(r'Averba[çc][aã]o.*?<[^>]+>([^<]+)<')

        # FGTS
        fgts_text = extract(r'FGTS.*?(<span[^>]*>[^<]*</span>|<td[^>]*>[^<]*</td>)', '')
        result["imovel_caixa_pagamento_fgts"] = 'sim' in fgts_text.lower() or 'aceita' in fgts_text.lower()

        # Regras de pagamento (texto livre)
        result["imovel_caixa_pagamento_condominio_regra"] = extract(r'cond.*?regra.*?</?\w+>([^<]{10,})<')
        result["imovel_caixa_pagamento_tributos"]         = extract(r'[Ii][Pp][Tt][Uu].*?</?\w+>([^<]{10,})<')
        result["imovel_caixa_pagamento_anotacoes"]        = extract(r'anota[çc][oõ][eê]s.*?</?\w+>([^<]{10,})<')

        # Endereço e CEP do scraping
        endereco_scraped = extract(r'Endere[çc]o.*?<[^>]+>([^<]{10,})<')
        if endereco_scraped:
            logradouro, numero_end, complemento = parse_address(endereco_scraped)
            result["imovel_caixa_endereco_logradouro"]  = logradouro
            result["imovel_caixa_endereco_numero"]      = numero_end
            result["imovel_caixa_endereco_complemento"] = complemento

            cep_match = re.search(r'(\d{5}-?\d{3})', endereco_scraped)
            if cep_match:
                result["_cep_extraido"] = cep_match.group(1).replace('-', '')

        # Extração do Tipo de Imóvel (🔴 PASSO 05)
        # Tenta pegar no título ou descrição do scraping
        tipo_match = extract(r'<h4[^>]*>([^<]+)</h4>') # Geralmente o tipo está no H4
        if tipo_match:
            result["_tipo_extraido"] = tipo_match.split('-')[0].strip()

        return result

    except requests.exceptions.RequestException as e:
        print(f"  [SCRAPING ERRO] {numero}: {e}")
        return None


def run_scraping_phase(novos_ids: list, master: MasterDataLoader):
    """
    PASSO 04 — Percorre os imóveis recém-inseridos/atualizados
    e faz o scraping da página de cada um.
    """
    if not novos_ids:
        print("\n[PASSO 04] Nenhum imóvel novo para scraping.")
        return

    print(f"\n[PASSO 04] Iniciando scraping de {len(novos_ids)} imóvel(is)...")

    # Busca os dados necessários para o scraping
    for i in range(0, len(novos_ids), 100):
        chunk = novos_ids[i:i+100]
        res = supabase.table("imoveis").select(
            "imoveis_id, imovel_caixa_numero, imovel_caixa_link_acesso_direto, id_uf_imovel_caixa"
        ).in_("imoveis_id", chunk).execute()

        if not res.data:
            continue

        # Mapa inverso: id_uf → sigla
        uf_id_to_sigla = {v: k for k, v in master.estados.items()}

        for row in res.data:
            numero      = row.get("imovel_caixa_numero")
            link_direto = row.get("imovel_caixa_link_acesso_direto")
            uf_id       = row.get("id_uf_imovel_caixa")
            uf_sigla    = uf_id_to_sigla.get(uf_id, "")
            imovel_id   = row["imoveis_id"]

            if not link_direto:
                continue

            print(f"  [SCRAPING] Imóvel {numero}...", end=" ", flush=True)
            scraped = scrape_imovel(numero, uf_sigla, link_direto)

            if scraped:
                cep_extraido = scraped.pop("_cep_extraido", None)
                tipo_extraido = scraped.pop("_tipo_extraido", None)
                # Separa campos que vão para a tabela principal dos que vão para o histórico
                pags_fields = ["imovel_caixa_pagamento_fgts", "imovel_caixa_pagamento_condominio_regra", 
                               "imovel_caixa_pagamento_tributos", "imovel_caixa_pagamento_anotacoes"]
                
                update_payload = {k: v for k, v in scraped.items() if v and k not in pags_fields}
                hist_update_payload = {k: v for k, v in scraped.items() if v and k in pags_fields}

                # Resolve CEP (PASSO 05)
                if cep_extraido:
                    res_cep = supabase.table("ceps_imovel").select("id").eq("cep_numerico", cep_extraido).execute()
                    if res_cep.data:
                        update_payload["id_cep_imovel_caixa"] = res_cep.data[0]["id"]

                # Resolve Tipo (PASSO 05)
                if tipo_extraido:
                    t_id = master.resolve_tipo(tipo_extraido)
                    if t_id:
                        update_payload["id_tipo_imovel_caixa"] = t_id

                if update_payload:
                    supabase.table("imoveis").update(update_payload).eq("imoveis_id", imovel_id).execute()
                
                if hist_update_payload:
                    # Encontra o registro de histórico mais recente para este imóvel
                    h_res = supabase.table("atualizacoes_imovel").select("id").eq("imovel_id", imovel_id).order("id", desc=True).limit(1).execute()
                    if h_res.data:
                        supabase.table("atualizacoes_imovel").update(hist_update_payload).eq("id", h_res.data[0]["id"]).execute()
                
                # 🔴 PASSO 11 — GERAÇÃO DE SEO E IMAGEM LOCAL (FINALIZAÇÃO)
                finalizar_imovel_seo(imovel_id, master)
                print("✅")
            else:
                print("❌")

            time.sleep(SCRAPING_DELAY)

    print("[PASSO 04-11] Processamento e Finalização concluídos.")


def finalizar_imovel_seo(imovel_id, master):
    """
    🔴 PASSO 11 — Constroi o SEO final e salva a imagem localmente.
    Usa os dados já enriquecidos no banco para garantir link perfeito.
    """
    try:
        # Busca dados finais do banco
        res = supabase.table("imoveis").select(
            "imoveis_id, imovel_caixa_numero, id_tipo_imovel_caixa, id_cidade_imovel_caixa, id_uf_imovel_caixa, id_bairro_imovel_caixa"
        ).eq("imoveis_id", imovel_id).single().execute()
        
        if not res.data: return

        row = res.data
        numero = row['imovel_caixa_numero']
        
        # Resolve nomes para o slug
        uf_sigla = {v: k for k, v in master.estados.items()}.get(row['id_uf_imovel_caixa'], "")
        cidade_nome = ""
        for k, v in master.cidades.items():
            if v == row['id_cidade_imovel_caixa']:
                cidade_nome = k[1]
                break
        
        bairro_nome = ""
        for k, v in master.bairros.items():
            if v == row['id_bairro_imovel_caixa']:
                bairro_nome = k[1]
                break
        
        tipo_nome = "Imovel"
        for k, v in master.tipos.items():
            if v == row['id_tipo_imovel_caixa']:
                tipo_nome = k
                break

        # Busca valor de desconto para o SEO
        fin = supabase.table("atualizacoes_imovel").select("imovel_caixa_valor_desconto_moeda").eq("imovel_id", imovel_id).order("id", desc=True).limit(1).execute()
        val_moeda = fin.data[0]['imovel_caixa_valor_desconto_moeda'] if fin.data else 0

        titulo, slug, descricao, keywords = generate_seo_fields(
            numero, "", uf_sigla, cidade_nome, bairro_nome, val_moeda, tipo_nome
        )

        # 1. Atualiza SEO no Banco
        update_seo = {
            "imovel_caixa_post_titulo": titulo,
            "imovel_caixa_post_link_permanente": slug,
            "imovel_caixa_post_descricao": descricao,
            "imovel_caixa_post_palavra_chave": keywords,
            "imovel_caixa_post_imagem_destaque": f"{slug}.jpg",
            # "imovel_caixa_post_status": "publicado" # Coluna removida pois não existe no schema atual
        }
        supabase.table("imoveis").update(update_seo).eq("imoveis_id", imovel_id).execute()

        # 2. Cópia e Renomeação da Imagem (🔴 PASSO 11.169)
        ORIGEM_IMG = Path(r"c:\Users\PICHAU\Desktop\antigravity\venda-imoveis-caixa\imagens\imagem-destaque\ImagemDestaque.jpg")
        DESTINO_DIR = Path(r"c:\Users\PICHAU\Desktop\antigravity\venda-imoveis-caixa\web\public\imagens-destaque")
        
        if not DESTINO_DIR.exists(): DESTINO_DIR.mkdir(parents=True)
        if ORIGEM_IMG.exists():
            shutil.copy2(ORIGEM_IMG, DESTINO_DIR / f"{slug}.jpg")
            
    except Exception as e:
        print(f"  [ERRO SEO] {imovel_id}: {e}")



def _enviar_batch(batch_imoveis, batch_historico, supabase, master):
    """Auxiliar para enviar lotes ao banco e lidar com imagens em paralelo."""
    try:
        # 1. Upload de imagens em paralelo (apenas para os que não estão no cache)
        to_upload = []
        for imv in batch_imoveis:
            s_path = imv.get("_storage_path")
            if s_path and s_path not in master.storage_cache:
                to_upload.append(s_path)
        
        if to_upload:
            TEMPLATE = Path(__file__).parent.parent / "web" / "public" / "imagens" / "imagem-destaque" / "imagem-destaque.jpg"
            if not TEMPLATE.exists():
                # Tenta path alternativo conforme estrutura atual
                TEMPLATE = Path(__file__).parent.parent / "imagens" / "imagem-destaque" / "ImagemDestaque.jpg"

            if TEMPLATE.exists():
                with open(TEMPLATE, "rb") as f:
                    img_bytes = f.read()

                def upload_one(path):
                    try:
                        supabase.storage.from_("imoveis-destaque").upload(
                            path=path,
                            file=img_bytes,
                            file_options={"content-type": "image/jpeg", "upsert": "true"}
                        )
                        return True
                    except: return False

                with ThreadPoolExecutor(max_workers=15) as executor:
                    results = list(executor.map(upload_one, to_upload))
                
                # Adiciona ao cache os que tiveram sucesso
                for path, success in zip(to_upload, results):
                    if success: master.storage_cache.add(path)

        # 2. Insere/Upsert imoveis
        # Remove campo auxiliar antes de enviar
        for imv in batch_imoveis: imv.pop("_storage_path", None)
        
        res = supabase.table("imoveis").upsert(batch_imoveis, on_conflict="imovel_caixa_numero").execute()

        if not res.data:
            return 0, []

        map_ids = {item['imovel_caixa_numero']: item['imoveis_id'] for item in res.data}
        new_ids = list(map_ids.values())

        final_hist = []
        for h in batch_historico:
            real_id = map_ids.get(h.pop("numero"))
            if real_id:
                h["imovel_id"] = real_id
                final_hist.append(h)

        if final_hist:
            supabase.table("atualizacoes_imovel").insert(final_hist).execute()

        return len(res.data), new_ids

    except Exception as e:
        print(f"  [ERRO BATCH]: {e}")
        return 0, []


# ---------------------------------------------------------------------------
# PASSO 01–03 — INGESTÃO DO CSV
# ---------------------------------------------------------------------------

def get_col(df, frags):
    # Primeiro tenta busca exata (case insensitive)
    for c in df.columns:
        if any(f.lower() == c.lower() for f in frags):
            return c
    # Se não encontrar, tenta busca por fragmento, mas ignora colunas de valor para campos categóricos
    for c in df.columns:
        if any(f.lower() in c.lower() for f in frags):
            # Proteção especial: se estamos procurando modalidade/venda, não pegamos colunas que contenham 'valor' ou 'preço'
            is_categorical = any(x in [f.lower() for f in frags] for x in ['modalidade', 'venda', 'tipo'])
            if is_categorical and any(x in c.lower() for x in ['valor', 'preco', 'preço', 'avaliacao', 'avaliação']):
                continue
            return c
    return None


def ingest_csv(file_path, master: MasterDataLoader):
    nome_arquivo = os.path.basename(file_path)

    # Data de geração a partir do nome do arquivo (DD-MM-AAAA)
    try:
        partes = nome_arquivo.split("-")
        data_geracao = datetime(int(partes[2]), int(partes[1]), int(partes[0])).date()
    except Exception:
        data_geracao = datetime.today().date()

    # UF padrão pelo nome do arquivo (fallback)
    default_uf = None
    nome_upper = nome_arquivo.upper()
    for uf in ["RJ", "SP", "MG", "RS", "ES", "BA", "PR", "SC", "GO", "DF", "CE", "PE", "AM"]:
        if f"_{uf}" in nome_upper or f"-{uf}" in nome_upper or nome_upper.startswith(uf):
            default_uf = uf
            break

    print(f"\n{'='*60}")
    print(f"[PASSO 01] Processando: {nome_arquivo} | UF padrão: {default_uf}")
    print(f"{'='*60}")

    # Detecta formato e lê o arquivo
    try:
        is_excel = file_path.lower().endswith(('.xlsx', '.xls'))
        
        if is_excel:
            print(f"  [INFO] Lendo formato Excel (.xlsx)...")
            df = pd.read_excel(file_path, dtype=str)
        else:
            header_idx = 0
            with open(file_path, 'r', encoding='latin1') as f:
                for i, line in enumerate(f):
                    l = line.lower()
                    if len([k for k in ["imovel", "imóvel", "cidade", "bairro", "desconto", "modalidade"] if k in l]) >= 3:
                        header_idx = i
                        break
            df = pd.read_csv(file_path, sep=';', encoding='latin1', skiprows=header_idx, on_bad_lines='skip', dtype=str)
        
        df.columns = [str(c).strip() for c in df.columns]
        print(f"  [DEBUG] Colunas encontradas: {list(df.columns)}")
    except Exception as e:
        print(f"[ERRO] Falha ao ler {nome_arquivo}: {e}")
        return nome_arquivo, {"total_lidos": 0, "aceitos": 0}, []

    # Mapeamento ultra-flexível (Priorizando os novos cabeçalhos do cliente)
    c_data       = get_col(df, ['data', 'Data', 'DATA', 'data de geração'])
    c_numero     = get_col(df, ['imovel', 'imóvel', 'IMÓVEL', 'Imóvel', 'N° do imóvel', 'Nº do imóvel', 'numero', 'n_imovel'])
    c_uf         = get_col(df, ['uf', 'UF', 'Estado', 'ESTADO'])
    c_cidade     = get_col(df, ['cidade', 'Cidade', 'CIDADE', 'Município', 'MUNICÍPIO'])
    c_bairro     = get_col(df, ['bairro', 'Bairro', 'BAIRRO'])
    c_endereco   = get_col(df, ['endereco', 'Endereço', 'ENDEREÇO', 'endereço', 'Endereco', 'Logradouro'])
    c_preco      = get_col(df, ['preco', 'Preço', 'PREÇO', 'preço', 'Preco', 'venda', 'venda_caixa'])
    c_avaliacao  = get_col(df, ['avaliacao', 'Avaliação', 'AVALIAÇÃO', 'avaliação', 'Avaliaçao', 'Avaliacao', 'Preço de avaliação'])
    c_desconto   = get_col(df, ['desconto', 'Desconto', 'DESCONTO'])
    c_modalidade = get_col(df, ['modalidade', 'Modalidade', 'MODALIDADE', 'Venda', 'venda'])
    c_financ     = get_col(df, ['financiamento', 'Financiamento', 'FINANCIAMENTO', 'Financiam', 'Admite Financiamento', 'Admite financiamento?'])
    c_desc       = get_col(df, ['descricao', 'Descrição', 'DESCRIÇÃO', 'descrição', 'Descricao', 'Descriçao', 'Tipo'])
    c_link_csv   = get_col(df, ['link', 'Link', 'LINK', 'URL', 'acesso'])
    c_tipo       = get_col(df, ['tipo', 'Tipo de imóvel', 'TIPO DE IMÓVEL', 'Tipo', 'TIPO'])

    total_lidos = aceitos = rej_mod = rej_desc = rej_db = 0

    batch_imoveis   = []
    batch_historico = []
    ids_novos       = []


    print(f"[PASSO 02] Aplicando filtros: Desconto >= {DESCONTO_MINIMO}% | Modalidades: {MODALIDADES_ACEITAS}")

    for idx, row in df.iterrows():
        total_lidos += 1

        # --- Número do imóvel ---
        num_raw = row.get(c_numero) if c_numero else None
        if pd.isna(num_raw) if num_raw is not None else True:
            continue

        try:
            s_num = str(num_raw).strip()
            if "E+" in s_num.upper() or "," in s_num:
                link_raw = str(row.get(c_link_csv, '')) if c_link_csv else ''
                m = re.search(r'nimovel=(\d+)', link_raw)
                numero = int(m.group(1)) if m else int(float(s_num.replace(',', '.')))
            else:
                numero = int(float(s_num))
        except Exception:
            continue
        # --- Valores financeiros ---
        preco     = parse_brl_numeric(row.get(c_preco, '0'))
        avaliacao = parse_brl_numeric(row.get(c_avaliacao, '0'))
        desconto  = parse_brl_numeric(row.get(c_desconto, '0'))
        
        # Ajuste para formato decimal do Excel (0.45 -> 45%)
        if 0 < desconto < 1.0:
            desconto *= 100

        # --- [PASSO 02] FILTROS ---
        modalidade = str(row.get(c_modalidade, '')).strip() if c_modalidade else ''
        if modalidade.lower() not in [m.lower() for m in MODALIDADES_ACEITAS]:
            if rej_mod < 5: print(f"  [DEBUG] Rejeitado Mod: '{modalidade}'")
            rej_mod += 1
            continue

        if desconto < DESCONTO_MINIMO:
            if rej_desc < 5: print(f"  [DEBUG] Rejeitado Desc: {desconto}%")
            rej_desc += 1
            continue

        # --- [PASSO 06] CÁLCULOS FINANCEIROS ---
        valor_desconto_moeda = max(0.0, avaliacao - preco)
        
        # Busca parâmetros do grupo para financiamento
        params_grupo = master.resolve_group(preco)
        entrada = prestacao = 0.0
        id_grupo = None
        
        if params_grupo:
            id_grupo = params_grupo['id']
            percent_entrada = float(params_grupo.get('compra_financiamento_entrada_caixa') or 0.05)
            percent_prest   = float(params_grupo.get('compra_financiamento_prestacao') or 0.006)
            
            entrada   = preco * percent_entrada
            prestacao = preco * percent_prest

        # --- Localização ---
        uf_raw     = str(row.get(c_uf, '')).strip()     if c_uf     else ''
        cidade_raw = str(row.get(c_cidade, '')).strip() if c_cidade else ''

        bairro_raw = str(row.get(c_bairro, '')).strip() if c_bairro else ''

        uf_id, cidade_id, bairro_id, requer_revisao, uf_final = master.resolve_location(
            uf_raw, cidade_raw, bairro_raw, default_uf
        )

        # --- Tipo e Natureza ---
        tipo_raw  = str(row.get(c_tipo, 'Imóvel')).strip() if c_tipo else 'Imóvel'
        tipo_id   = master.resolve_tipo(tipo_raw)
        descricao_csv = str(row.get(c_desc, '')).strip() if c_desc else ''
        natureza_id = master.resolve_natureza(descricao_csv)

        # --- Grupo do imóvel (pela faixa de preço de venda) ---
        grupo = master.resolve_group(preco)
        grupo_id = grupo['id'] if grupo else None

        # --- URLs geradas automaticamente ---
        val_moeda = max(0.0, avaliacao - preco)
        link_imagem    = f"https://venda-imoveis.caixa.gov.br/fotos/F{numero}21.jpg"
        link_matricula = f"https://venda-imoveis.caixa.gov.br/editais/matricula/{uf_final}/{numero}.pdf"
        link_direto    = f"https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnOrigem=index&hdnimovel={numero}"
        link_csv       = str(row.get(c_link_csv, '')).strip() if c_link_csv else ''

        # --- SEO ---
        titulo, slug, desc_seo, keyword = generate_seo_fields(
            numero, modalidade, uf_final, cidade_raw, bairro_raw, val_moeda, tipo_raw
        )

        # --- Imagem de destaque → Supabase Storage ---
        # --- Imagem de destaque PARA SEO ---
        storage_path = f"{slug}.jpg"
        # URL pública antecipada (Supabase Storage)
        img_storage_url = supabase.storage.from_("imoveis-destaque").get_public_url(storage_path)


        # --- Auto-complete da descrição ---
        features = extract_features_from_desc(descricao_csv)
        features.pop("imovel_caixa_pagamento_condominio", None)  # vai para atualizacoes

        # --- Separação do endereço ---
        logradouro, num_end, complemento = parse_address(
            str(row.get(c_endereco, '')).strip() if c_endereco else ''
        )

        # --- Data de criação ---
        data_criacao = data_geracao
        if c_data:
            try:
                d_raw = str(row.get(c_data, '')).strip()
                if d_raw and d_raw != 'nan':
                    data_criacao = pd.to_datetime(d_raw, dayfirst=True).date()
            except Exception:
                pass

        # --- Monta registro da tabela imoveis ---
        imovel_record = {
            "imovel_caixa_numero":            int(numero),
            "id_uf_imovel_caixa":             int(uf_id)      if uf_id      else None,
            "id_cidade_imovel_caixa":         int(cidade_id)  if cidade_id  else None,
            "id_bairro_imovel_caixa":         int(bairro_id)  if bairro_id  else None,
            "id_tipo_imovel_caixa":           int(tipo_id)    if tipo_id    else None,
            "id_grupo_imovel_caixa":          int(grupo_id)   if grupo_id   else None,
            "natureza_imovel_id":             int(natureza_id) if natureza_id else None,
            "imovel_caixa_endereco_csv":      str(row.get(c_endereco, '')).strip() if c_endereco else '',
            "imovel_caixa_endereco_logradouro": logradouro,
            "imovel_caixa_endereco_numero":   num_end,
            "imovel_caixa_endereco_complemento": complemento,
            "imovel_caixa_descricao_csv":     descricao_csv,
            "imovel_caixa_descricao_tipo":    tipo_raw,
            "imovel_caixa_link_imagem":       link_imagem,
            "imovel_caixa_link_matricula":    link_matricula,
            "imovel_caixa_link_acesso_direto": link_direto,
            "imovel_caixa_post_titulo":       titulo,
            "imovel_caixa_post_link_permanente": slug,
            "imovel_caixa_post_descricao":    desc_seo,
            "imovel_caixa_post_palavra_chave": keyword,
            "imovel_caixa_post_imagem_destaque": img_storage_url,
            "updated_at":                     datetime.now().isoformat(),
            **features,
            "_storage_path":                  storage_path, # campo temporário para o batch
        }

        # --- Monta registro de atualizacoes_imovel ---
        aceita_financiamento = False
        if c_financ:
            fin_val = str(row.get(c_financ, '')).strip().lower()
            aceita_financiamento = fin_val in ('sim', 's', 'true', '1', 'aceita')

        # Calcula entrada e prestação se aceita financiamento e grupo foi identificado
        entrada_calc  = None
        prestacao_calc = None
        if aceita_financiamento and grupo:
            entrada_perc   = float(grupo.get('compra_financiamento_entrada_caixa') or 0)
            prestacao_perc = float(grupo.get('compra_financiamento_prestacao') or 0)
            if entrada_perc:   entrada_calc   = round(preco * entrada_perc, 2)
            if prestacao_perc: prestacao_calc = round(preco * prestacao_perc, 2)

        hist_record = {
            "numero":                                 int(numero),
            "imovel_caixa_modalidade":                modalidade,
            "imovel_caixa_data_criacao":              str(data_criacao),
            "imovel_caixa_valor_venda":               float(preco),
            "imovel_caixa_valor_avaliacao":           float(avaliacao),
            "imovel_caixa_valor_desconto_percentual": float(desconto),
            "imovel_caixa_valor_desconto_moeda":      float(val_moeda),
            "imovel_caixa_pagamento_financiamento":   aceita_financiamento,
            "imovel_caixa_pagamento_fgts":            False,
            "imovel_caixa_pagamento_financiamento_entrada":  entrada_calc,
            "imovel_caixa_pagamento_financiamento_prestacao": prestacao_calc,
            "created_at":                             datetime.now().isoformat(),
        }

        batch_imoveis.append(imovel_record)
        batch_historico.append(hist_record)


        # Envio em lotes de 50
        if len(batch_imoveis) >= 50:
            print(f"  [INFO] Enviando lote de 50 imóveis ({total_lidos}/{len(df)} lidos)...")
            count, new_ids = _enviar_batch(batch_imoveis, batch_historico, supabase, master)
            aceitos  += count
            rej_db   += (len(batch_imoveis) - count)
            ids_novos.extend(new_ids)
            batch_imoveis, batch_historico = [], []


    # Lote final
    if batch_imoveis:
        count, new_ids = _enviar_batch(batch_imoveis, batch_historico, supabase, master)
        aceitos  += count
        rej_db   += (len(batch_imoveis) - count)
        ids_novos.extend(new_ids)

    stats = {
        "total_lidos": total_lidos,
        "aceitos":     aceitos,
        "rejeitados":  total_lidos - aceitos,
        "detalhe":     {"modalidade": rej_mod, "desconto": rej_desc, "banco_dados": rej_db},
    }

    print(f"\n[PASSO 03] Resultado: {aceitos} aceitos | {total_lidos - aceitos} rejeitados "
          f"(mod:{rej_mod} | desc:{rej_desc} | db:{rej_db})")

    return nome_arquivo, stats, ids_novos


def _enviar_batch(batch_imoveis, batch_historico, supabase, master):
    """Auxiliar para enviar lotes ao banco e lidar com imagens em paralelo."""
    try:
        # 1. Upload de imagens em paralelo (apenas para os que não estão no cache)
        to_upload = []
        for imv in batch_imoveis:
            s_path = imv.get("_storage_path")
            if s_path and s_path not in master.storage_cache:
                to_upload.append(s_path)
        
        if to_upload:
            # Tenta encontrar o template de imagem
            TEMPLATE = Path(__file__).parent.parent / "web" / "public" / "imagens" / "imagem-destaque" / "imagem-destaque.jpg"
            if not TEMPLATE.exists():
                TEMPLATE = Path(__file__).parent.parent / "imagens" / "imagem-destaque" / "ImagemDestaque.jpg"

            if TEMPLATE.exists():
                with open(TEMPLATE, "rb") as f:
                    img_bytes = f.read()

                def upload_one(path):
                    try:
                        supabase.storage.from_("imoveis-destaque").upload(
                            path=path,
                            file=img_bytes,
                            file_options={"content-type": "image/jpeg", "upsert": "true"}
                        )
                        return True
                    except: return False

                with ThreadPoolExecutor(max_workers=15) as executor:
                    results = list(executor.map(upload_one, to_upload))
                
                # Adiciona ao cache os que tiveram sucesso
                for path, success in zip(to_upload, results):
                    if success: master.storage_cache.add(path)

        # 2. Insere/Upsert imoveis
        # Remove campo auxiliar antes de enviar
        for imv in batch_imoveis: imv.pop("_storage_path", None)
        
        res = supabase.table("imoveis").upsert(batch_imoveis, on_conflict="imovel_caixa_numero").execute()

        if not res.data:
            return 0, []

        map_ids = {item['imovel_caixa_numero']: item['imoveis_id'] for item in res.data}
        new_ids = list(map_ids.values())

        final_hist = []
        for h in batch_historico:
            real_id = map_ids.get(h.pop("numero"))
            if real_id:
                h["imovel_id"] = real_id
                final_hist.append(h)

        if final_hist:
            supabase.table("atualizacoes_imovel").insert(final_hist).execute()

        return len(res.data), new_ids

    except Exception as e:
        print(f"  [ERRO BATCH]: {e}")
        return 0, []


def cleanup_invalid_modalities(supabase: Client):
    """
    Remove do banco todos os imóveis que possuem modalidades não aceitas.
    Garante que o banco de dados esteja sempre sincronizado com o PASSO 02.
    Utiliza deleção direta para evitar limites de select.
    """
    print(f"\n[PASSO 05] Limpeza estratégica: removendo modalidades não aceitas...")
    try:
        # Pega as modalidades no banco que NÃO estão no grupo permitido
        # Como o Postgrest 'not.in' é sensível e as modalidades podem variar em espaços/case,
        # vamos fazer uma query que remove os conhecidos indesejados (Licitação Aberta)
        # ou melhor, remove tudo que não for 'Venda Online' ou 'Venda Direta Online'
        
        # Filtro: imovel_caixa_modalidade não está em ['Venda Online', 'Venda Direta Online']
        res = supabase.table("imoveis").delete().not_.in_(
            "imovel_caixa_modalidade", MODALIDADES_ACEITAS
        ).execute()
        
        removidos = len(res.data) if res.data else 0
        if removidos > 0:
            print(f"   ✅ Removidos {removidos} imóveis com modalidades inválidas.")
        else:
            print("   ✅ Nenhum imóvel com modalidade inválida para remover.")
            
    except Exception as e:
        print(f"   [ERRO NA LIMPEZA]: {e}")


# ---------------------------------------------------------------------------
# MAIN — Pipeline completo automático
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("🚀 Pipeline de Ingestão da CAIXA — Iniciando...")
    print(f"   Filtros: Desconto >= {DESCONTO_MINIMO}% | Modalidades: {MODALIDADES_ACEITAS}")

    master = MasterDataLoader(supabase)

    if len(sys.argv) > 1:
        # Se passarmos um arquivo via argumento, processamos só ele
        csv_files = [sys.argv[1]]
    else:
        csv_files = glob.glob(os.path.join(CSV_DIR, "*.csv"))
        
    if not csv_files:
        print(f"[AVISO] Nenhum arquivo .csv encontrado.")
        sys.exit(0)


    print(f"\n[INFO] {len(csv_files)} arquivo(s) CSV encontrado(s).")

    todos_ids_novos = []
    resumo_geral    = []

    for f in csv_files:
        nome, stats, ids_novos = ingest_csv(f, master)
        todos_ids_novos.extend(ids_novos)
        resumo_geral.append((nome, stats))

    # -----------------------------------------------------------------------
    # PASSO 04 — Scraping automático de todos os imóveis processados
    # -----------------------------------------------------------------------
    run_scraping_phase(todos_ids_novos, master)

    # -----------------------------------------------------------------------
    # PASSO 05 — Limpeza estratégica de modalidades não permitidas
    # -----------------------------------------------------------------------
    cleanup_invalid_modalities(supabase)

    # -----------------------------------------------------------------------
    # RESUMO FINAL
    # -----------------------------------------------------------------------
    print("\n" + "="*60)
    print("📊 RESUMO FINAL")
    print("="*60)
    total_aceitos = 0
    total_lidos   = 0
    for nome, stats in resumo_geral:
        print(f"  📄 {nome}: {stats['aceitos']}/{stats['total_lidos']} aceitos")
        total_aceitos += stats['aceitos']
        total_lidos   += stats['total_lidos']
    
    print(f"\n  ✅ Total: {total_aceitos} imóveis gravados de {total_lidos} lidos")
    print(f"  🔍 Scraping: {len(todos_ids_novos)} imóveis processados")
    print(f"  ✨ Limpeza de modalidades executada.")
    print("="*60)
    print("🏁 PIPELINE CONCLUÍDO COM SUCESSO!\n")
