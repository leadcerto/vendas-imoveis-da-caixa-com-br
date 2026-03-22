import os
import re
import sys
import pandas as pd
import glob
import unicodedata
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client
from pathlib import Path

# Configuração de encoding para evitar erros de leitura
sys.stdin.reconfigure(encoding='utf-8')
sys.stdout.reconfigure(encoding='utf-8')

# Carrega variáveis de ambiente
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
CSV_DIR = os.path.join(Path(__file__).parent.parent, "csv-caixa")

# Importa normalizador de bairros
sys.path.insert(0, str(Path(__file__).parent.parent))
try:
    from modules.data_processing.normalizers.bairro_normalizer import BairroNormalizer
    NORMALIZER = BairroNormalizer()
except:
    print("[AVISO] BairroNormalizer nao encontrado. Usando normalizacao simples.")
    class SimpleNormalizer:
        def normalize(self, text): return str(text).upper().strip()
    NORMALIZER = SimpleNormalizer()

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Configurações de Filtro (Conforme solicitado pelo usuário)
DESCONTO_MINIMO = 30.0
MODALIDADES_ACEITAS = ["Venda Online", "Venda Direta Online"]

import unicodedata

def normalize_text(text):
    if not text: return ""
    # Normaliza para NFD (separa acentos), converte para upper e remove caracteres de acentuação (Mn)
    return "".join(c for c in unicodedata.normalize('NFD', str(text).strip().upper())
                  if unicodedata.category(c) != 'Mn')

class LocationResolver:
    def __init__(self, supabase_client):
        self.sb = supabase_client
        self.estados = {}  # sigla -> id
        self.cidades = {}  # (uf_id, nome_norm) -> id
        self.bairros = {}  # (cidade_id, nome_norm) -> id
        self._load_master_data()

    def _load_master_data(self):
        print("[INFO] Carregando dados mestres de localizacao...")
        
        # Estados
        res = self.sb.table("estados").select("id, sigla").execute()
        self.estados = {normalize_text(r['sigla']): r['id'] for r in res.data}
        
        # Cidades (Paginado)
        all_cities = []
        page = 0
        while True:
            res = self.sb.table("cidades").select("id, id_uf, nome").range(page*1000, (page+1)*1000 - 1).execute()
            if not res.data: break
            all_cities.extend(res.data)
            page += 1
            
        for r in all_cities:
            key = (r['id_uf'], normalize_text(r['nome']))
            self.cidades[key] = r['id']
            
        # Bairros (Paginado)
        all_bairros = []
        page = 0
        while True:
            res = self.sb.table("bairros").select("id, id_cidade, nome").range(page*1000, (page+1)*1000 - 1).execute()
            if not res.data: break
            all_bairros.extend(res.data)
            page += 1

        for r in all_bairros:
            key = (r['id_cidade'], normalize_text(r['nome']))
            self.bairros[key] = r['id']
            
        print(f"[INFO] Localizacao carregada: {len(self.estados)} UFs, {len(self.cidades)} Cidades, {len(self.bairros)} Bairros.")

    def resolve(self, uf_sigla, cidade_nome, bairro_nome):
        uf_id = self.estados.get(normalize_text(uf_sigla))
        cidade_id = None
        bairro_id = None
        requer_revisao = False

        if uf_id:
            cidade_norm = normalize_text(cidade_nome)
            cidade_id = self.cidades.get((uf_id, cidade_norm))
            if cidade_id:
                bairro_norm = normalize_text(bairro_nome)
                bairro_id = self.bairros.get((cidade_id, bairro_norm))
                if not bairro_id:
                    requer_revisao = True
            else:
                requer_revisao = True
        else:
            requer_revisao = True
            
        return uf_id, cidade_id, bairro_id, requer_revisao

RESOLVER = None

def parse_valor(valor):
    if pd.isna(valor): return 0.0
    s_valor = str(valor).replace("R$", "").replace(".", "").replace(",", ".").strip()
    try:
        return float(s_valor)
    except:
        return 0.0

def parse_desconto(valor):
    if pd.isna(valor): return 0.0
    s_valor = str(valor).replace("%", "").replace(",", ".").strip()
    try:
        return float(s_valor)
    except:
        return 0.0

def extract_features_from_desc(description):
    if not description:
        return {}
    
    desc = description.lower()
    
    def get_num(pattern, text):
        match = re.search(pattern, text)
        if match:
            try:
                val = match.group(1).replace(',', '.')
                return float(val)
            except:
                return 0.0
        return 0.0

    def get_int(pattern, text):
        match = re.search(pattern, text)
        if match:
            try:
                return int(match.group(1))
            except:
                return 1
        return 0

    features = {
        "imovel_caixa_descricao_area_total": get_num(r'([\d\.,]+)\s*de área total', desc),
        "imovel_caixa_descricao_area_privativa": get_num(r'([\d\.,]+)\s*de área privativa', desc),
        "imovel_caixa_descricao_area_do_terreno": get_num(r'([\d\.,]+)\s*de área do terreno', desc),
        "imovel_caixa_descricao_quartos": get_int(r'(\d+)\s*qto', desc),
        "imovel_caixa_descricao_garagem": get_int(r'(\d+)\s*(?:vaga|garagem)', desc),
        "imovel_caixa_descricao_wc_banheiro": get_int(r'(\d+)\s*wc', desc) or (1 if 'wc' in desc else 0),
        "imovel_caixa_descricao_area_servico": 'a.serv' in desc or 'área de serviço' in desc,
        "imovel_caixa_descricao_churrasqueira": 'churrasqueira' in desc,
        "imovel_caixa_descricao_cozinha": 'cozinha' in desc,
        "imovel_caixa_descricao_piscina": 'piscina' in desc,
        "imovel_caixa_descricao_sala": 'sala' in desc,
        "imovel_caixa_descricao_terraco": 'terraço' in desc or 'terraco' in desc,
        "imovel_caixa_descricao_varanda": 'varanda' in desc
    }
    
    return features

def slugify(text):
    if not text: return ""
    # Normalize unicode characters to remove accents
    text = unicodedata.normalize('NFKD', str(text)).encode('ascii', 'ignore').decode('ascii')
    # Convert to lowercase and replace non-alphanumeric with hyphens
    text = re.sub(r'[^\w\s-]', '', text).lower().strip()
    return re.sub(r'[-\s]+', '-', text)

def format_currency(value):
    try:
        return f"{float(value):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except:
        return "0,00"

TIPOS_MAP = None

def ingest_csv(file_path):
    global RESOLVER, TIPOS_MAP
    if RESOLVER is None:
        RESOLVER = LocationResolver(supabase)
    
    if TIPOS_MAP is None:
        res_tipos = supabase.table("tipos_imovel").select("id, nome").execute()
        TIPOS_MAP = {row['id']: row['nome'] for row in res_tipos.data}

    nome_arquivo = os.path.basename(file_path)
    
    # Extrai data do nome do arquivo (formato: DD-MM-YYYY-Nome.csv)
    try:
        partes = nome_arquivo.split("-")
        data_geracao = datetime(int(partes[2]), int(partes[1]), int(partes[0])).date()
    except Exception:
        data_geracao = datetime.today().date()
        print(f"[AVISO] Nao foi possivel extrair data do arquivo. Usando hoje: {data_geracao}")

    print(f"\n--- Processando: {nome_arquivo} ---")
    
    try:
        # Detecta onde começam os dados reais
        header_idx = 0
        with open(file_path, 'r', encoding='latin1') as f:
            for i, line in enumerate(f):
                if i > 100: break
                clean_line = line.lower().strip()
                # Se encontrar a linha de cabeçalho padrão
                if "uf;cidade;bairro" in clean_line:
                    header_idx = i
                    print(f"[INFO] Cabecalho localizado na linha {i}")
                    break
                # Ou se encontrar uma linha que parece dados (Começa com número longo e tem muitos ;)
                parts = clean_line.split(';')
                if len(parts) > 5 and parts[0].strip().isdigit() and len(parts[0].strip()) >= 10:
                    header_idx = i - 1 if i > 0 else 0
                    print(f"[INFO] Dados detectados a partir da linha {i}. Usando header_idx {header_idx}")
                    break
        
        # Lê o CSV pulando o ruído inicial
        df = pd.read_csv(file_path, sep=';', encoding='latin1', skiprows=header_idx, on_bad_lines='skip')
        df.columns = [str(c).strip() for c in df.columns]
    except Exception as e:
        print(f"[ERRO] Falha ao ler arquivo: {e}")
        return nome_arquivo, 0

    total_lidos = len(df)
    print(f"Total de linhas lidas: {total_lidos}")

    # Mapeamento flexivel
    def get_col(df, fragments):
        for col in df.columns:
            if any(f.lower() in col.lower() for f in fragments):
                return col
        return None

    c_numero = get_col(df, ['N° do imóvel', 'Nº do imóvel', 'numero'])
    c_uf = get_col(df, ['UF'])
    c_cidade = get_col(df, ['Cidade'])
    c_bairro = get_col(df, ['Bairro'])
    c_endereco = get_col(df, ['Endereço', 'endereco'])
    c_preco = get_col(df, ['Preço', 'venda'])
    c_avaliacao = get_col(df, ['avaliação', 'Preço de avaliação'])
    c_desconto = get_col(df, ['Desconto'])
    c_fgts = get_col(df, ['FGTS'])
    c_financiamento = get_col(df, ['Financiamento'])
    c_descricao = get_col(df, ['Descrição', 'descricao'])
    c_modalidade = get_col(df, ['Modalidade'])

    aceitos = 0
    rejeitados = 0
    motivos = {"desconto_baixo": 0, "modalidade_invalida": 0, "numero_invalido": 0, "erro_db": 0}

    batch_imoveis = []
    batch_historico = []

    for _, row in df.iterrows():
        # 1. Validação de Número
        num_raw = row.get(c_numero) if c_numero else None
        if pd.isna(num_raw):
            rejeitados += 1
            motivos["numero_invalido"] += 1
            continue
            
        try:
            numero_str = str(num_raw).strip().split('.')[0]
            if not numero_str.isdigit():
                raise ValueError
            numero = int(numero_str)
        except:
            rejeitados += 1
            motivos["numero_invalido"] += 1
            continue

        # 2. FILTRO DE MODALIDADE
        modalidade = str(row.get(c_modalidade, '')).strip() if c_modalidade else ''
        if modalidade not in MODALIDADES_ACEITAS:
            rejeitados += 1
            motivos["modalidade_invalida"] += 1
            continue

        # 3. FILTRO DE DESCONTO (>30%)
        desconto_pct = parse_desconto(row.get(c_desconto, 0)) if c_desconto else 0.0
        if desconto_pct < DESCONTO_MINIMO:
            rejeitados += 1
            motivos["desconto_baixo"] += 1
            continue

        # Processamento de Valores
        valor_venda = parse_valor(row.get(c_preco, 0)) if c_preco else 0.0
        valor_avaliacao = parse_valor(row.get(c_avaliacao, 0)) if c_avaliacao else 0.0
        financiamento = str(row.get(c_financiamento, '')).strip().lower() == 'sim' if c_financiamento else False
        pagamento_fgts = str(row.get(c_fgts, '')).strip().lower() == 'sim' if c_fgts else False
        desconto_moeda = max(0.0, float(valor_avaliacao - valor_venda))
        
        # Resolvendo Localização Mestre
        uf_raw = str(row.get(c_uf, '')).strip()
        cidade_raw = str(row.get(c_cidade, '')).strip()
        bairro_raw = str(row.get(c_bairro, '')).strip()
        
        id_uf, id_cidade, id_bairro, requer_revisao = RESOLVER.resolve(uf_raw, cidade_raw, bairro_raw)

        # Resolução de Tipo de Imóvel
        desc_raw = str(row.get(c_descricao, '')).strip() if c_descricao else ''
        id_tipo = 16  # Padrao: Outros
        tipo_nome = "Imovel"
        if desc_raw and TIPOS_MAP:
            first_part = desc_raw.split(',')[0].strip().lower()
            for tid, tname in TIPOS_MAP.items():
                if tname.lower() in first_part:
                    id_tipo = tid
                    tipo_nome = tname
                    break

        # Extração de características da descrição
        desc_features = extract_features_from_desc(desc_raw)

        # Geração de Campos SEO
        bairro_seo = bairro_raw if bairro_raw else "bairro"
        cidade_seo = cidade_raw if cidade_raw else "cidade"
        uf_seo = uf_raw if uf_raw else "uf"
        
        slug_base = f"{tipo_nome}-{bairro_seo}-{cidade_seo}-{uf_seo}-{numero}"
        slug = slugify(slug_base)
        desc_seo = f"{tipo_nome} {bairro_seo} {cidade_seo} {uf_seo} {numero}. Aproveite o desconto de R$ {format_currency(desconto_moeda)}. Clique Aqui para mais informações."
        keyword = f"{tipo_nome} {bairro_seo} {cidade_seo} {uf_seo} {numero}"
        titulo_seo = f"{tipo_nome} em {bairro_seo}, {cidade_seo} - {uf_seo} ({numero})"
        
        # Featured Image (Social Sharing) - Naming coincides with the post title as requested
        image_filename = f"{titulo_seo}.jpg"
        image_url_destaque = f"/images/destaque/{image_filename}"
        
        # Novo Selo de Oportunidade
        if desconto_pct >= 80:
            selo = "&#129351; Ouro"
        elif desconto_pct >= 75:
            selo = "&#129352; Prata"
        elif desconto_pct >= 70:
            selo = "&#129353; Bronze"
        else:
            selo = "&#128077; Aprovado"

        # Registro Mestre
        registro_master = {
            "imovel_caixa_numero": numero,
            "imovel_caixa_criacao": str(data_geracao),
            "imovel_caixa_endereco_uf_sigla": uf_raw,
            "imovel_caixa_endereco_cidade": cidade_raw,
            "imovel_caixa_endereco_bairro": bairro_raw,
            "imovel_caixa_endereco_csv": str(row.get(c_endereco, '')).strip() if c_endereco else '',
            "imovel_caixa_valor_venda": valor_venda,
            "imovel_caixa_valor_avaliacao": valor_avaliacao,
            "imovel_caixa_valor_desconto_percentual": desconto_pct,
            "imovel_caixa_pagamento_financiamento": financiamento,
            "imovel_caixa_pagamento_fgts": pagamento_fgts,
            "imovel_caixa_descricao_csv": desc_raw,
            "imovel_caixa_modalidade": modalidade,
            "imovel_caixa_link_imagem": f"https://venda-imoveis.caixa.gov.br/fotos/F{numero}.jpg",
            "imovel_caixa_link_matricula": f"https://venda-imoveis.caixa.gov.br/editais/matricula/{uf_raw.upper()}/{numero}.pdf",
            "imovel_caixa_link_acesso": f"https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnOrigem=index&hdnimovel={numero}",
            "id_uf_imovel_caixa": id_uf,
            "id_cidade_imovel_caixa": id_cidade,
            "id_bairro_imovel_caixa": id_bairro,
            "id_tipo_imovel_caixa": id_tipo,
            "imovel_caixa_post_link_permanente": slug,
            "imovel_caixa_post_descricao": desc_seo,
            "imovel_caixa_post_palavra_chave": keyword,
            "imovel_caixa_post_titulo": titulo_seo,
            "imovel_caixa_post_selo_oportunidade": selo,
            "imovel_caixa_post_imagem_destaque": image_url_destaque,
            "requer_revisao_localizacao": requer_revisao,
            "updated_at": datetime.now().isoformat(),
            **desc_features
        }
        batch_imoveis.append(registro_master)

        # Processamento em batches
        if len(batch_imoveis) >= 50:
            enviar_batch(batch_imoveis, modalidade, data_geracao, row, c_numero)
            aceitos += len(batch_imoveis)
            batch_imoveis = []

    # Processa último parcial
    if batch_imoveis:
        enviar_batch(batch_imoveis, modalidade, data_geracao, None, None)
        aceitos += len(batch_imoveis)

    print(f"\n[RESUMO] {nome_arquivo}")
    print(f"  Total lidos    : {total_lidos}")
    print(f"  Aceitos        : {aceitos}")
    print(f"  Rejeitados     : {rejeitados}")
    return nome_arquivo, aceitos

def enviar_batch(batch, modalidade, data_geracao, row_example, c_num_example):
    try:
        res = supabase.table("imoveis").upsert(batch, on_conflict="imovel_caixa_numero").execute()
        if res.data:
            hist_batch = []
            for item in res.data:
                valor_venda = item['imovel_caixa_valor_venda']
                valor_avaliacao = item['imovel_caixa_valor_avaliacao']
                desconto_pct = item['imovel_caixa_valor_desconto_percentual'] or 0.0
                selo = item['imovel_caixa_post_selo_oportunidade']

                hist_batch.append({
                    "imovel_id": item['imoveis_id'],
                    "imovel_caixa_modalidade": item['imovel_caixa_modalidade'],
                    "imovel_caixa_criacao": item['imovel_caixa_criacao'],
                    "imovel_caixa_valor_venda": valor_venda,
                    "imovel_caixa_valor_avaliacao": valor_avaliacao,
                    "imovel_caixa_valor_desconto_percentual": desconto_pct,
                    "imovel_caixa_valor_desconto_moeda": max(0.0, float(valor_avaliacao - valor_venda)),
                    "imovel_caixa_pagamento_financiamento": item['imovel_caixa_pagamento_financiamento'],
                    "imovel_caixa_pagamento_fgts": item['imovel_caixa_pagamento_fgts'],
                    "etiqueta_oportunidade": selo,
                    "created_at": datetime.now().isoformat()
                })
            if hist_batch:
                supabase.table("atualizacoes_imovel").insert(hist_batch).execute()
    except Exception as e:
        print(f"  [ERRO BATCH]: {e}")


def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[ERRO] Variáveis de ambiente SUPABASE_URL ou SUPABASE_KEY não configuradas.")
        return

    csv_files = glob.glob(os.path.join(CSV_DIR, "*.csv"))
    if not csv_files:
        print(f"[AVISO] Nenhum arquivo CSV encontrado em: {CSV_DIR}")
        return

    print(f"Iniciando processamento de {len(csv_files)} arquivos.")
    
    for f in csv_files:
        ingest_csv(f)

    print("\n[FIM] Processamento concluído. Verifique o banco de dados e o histórico.")

if __name__ == "__main__":
    main()
