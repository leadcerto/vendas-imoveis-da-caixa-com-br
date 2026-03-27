import os
import re
import sys
import pandas as pd
import glob
import unicodedata
import shutil
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client
from pathlib import Path

# Configuração de encoding para evitar erros de leitura
if sys.version_info >= (3, 7):
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

# Cliente Supabase global
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Configurações de Filtro
DESCONTO_MINIMO = 0.0
MODALIDADES_ACEITAS = ["Venda Online", "Venda Direta Online", "Leilão SFI", "Licitação Aberta", "Licitação Fechada", "Venda Direta", "Leilão"]

def normalize_text(text):
    if not text: return ""
    return "".join(c for c in unicodedata.normalize('NFD', str(text).strip().upper())
                  if unicodedata.category(c) != 'Mn')

def slugify(text):
    if not text: return ""
    text = unicodedata.normalize('NFKD', str(text)).encode('ascii', 'ignore').decode('ascii')
    text = re.sub(r'[^\w\s-]', '', text).lower().strip()
    return re.sub(r'[-\s]+', '-', text)

def format_currency(value):
    try:
        return f"{float(value):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except:
        return "0,00"

def generate_seo_fields(numero, modalidade, uf, cidade, bairro, desconto_moeda, tipo):
    # Sanitização para evitar 'None' nos textos
    tipo = str(tipo or 'Imóvel').replace('None', 'Imóvel')
    bairro = str(bairro or '').replace('None', '')
    cidade = str(cidade or '').replace('None', '')
    uf = str(uf or '').replace('None', '')

    # Regras solicitadas pelo usuário (🔴, 🧡💙, ⚠️)
    # imovel_caixa_post_titulo: 🔴 [tipo] [bairro] [cidade] [uf] [numero] Imóvel CAIXA 🧡💙
    titulo = f"🔴 {tipo} {bairro} {cidade} {uf} {numero} Imóvel CAIXA 🧡💙"
    
    # imovel_caixa_post_descricao: Imóvel CAIXA [tipo] [bairro] [cidade] [uf] com desconto de [valor]. ⚠️ Estamos Online!
    def format_currency_br(val):
        return f"R$ {float(val):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    
    desconto_fmt = format_currency_br(desconto_moeda)
    descricao = f"Imóvel CAIXA {tipo} {bairro} {cidade} {uf} com desconto de {desconto_fmt}. ⚠️ Estamos Online!"
    
    # imovel_caixa_post_palavra_chave: [tipo] [bairro] [cidade] [uf]
    keyword = f"{tipo} {bairro} {cidade} {uf}"
    
    # imovel_caixa_post_link_permanente: [tipo]-[bairro]-[cidade]-[uf]-[numero]
    def normalize_seo_part(text):
        if not text: return ""
        # Remove acentos e mantém minúsculo
        n = "".join(c for c in unicodedata.normalize('NFD', str(text).strip().lower())
                    if unicodedata.category(c) != 'Mn')
        # Espaços e hifens internos viram underscore para componentes
        # Componentes serão separados por hifens na string final
        import re
        n = n.replace(" ", "_").replace("-", "_")
        n = re.sub(r'[^a-z0-9_]', '', n)
        return n

    t_s = normalize_seo_part(tipo)
    b_s = normalize_seo_part(bairro)
    c_s = normalize_seo_part(cidade)
    u_s = normalize_seo_part(uf)
    
    slug = f"{t_s}-{b_s}-{c_s}-{u_s}-{numero}"
    
    return titulo, slug, descricao, keyword

def extract_features_from_desc(description):
    if not description: return {}
    desc = description.lower()
    
    def get_num(pattern, text):
        match = re.search(pattern, text)
        if match:
            try:
                return float(match.group(1).replace(',', '.'))
            except: return 0.0
        return 0.0

    def get_int(pattern, text):
        match = re.search(pattern, text)
        if match:
            try: return int(match.group(1))
            except: return 0
        return 0

    return {
        "imovel_caixa_descricao_area_total": get_num(r'([\d\.,]+)\s*de área total', desc),
        "imovel_caixa_descricao_area_privativa": get_num(r'([\d\.,]+)\s*de área privativa', desc),
        "imovel_caixa_descricao_area_do_terreno": get_num(r'([\d\.,]+)\s*de área do terreno', desc),
        "imovel_caixa_descricao_quartos": get_int(r'(\d+)\s*qto', desc),
        "imovel_caixa_descricao_garagem": get_int(r'(\d+)\s*(?:vaga|garagem)', desc),
        "imovel_caixa_descricao_wc_banheiro": get_int(r'(\d+)\s*wc', desc) or (1 if 'wc' in desc else 0),
        "imovel_caixa_pagamento_condominio": get_num(r'débitos de condomínio no valor de r\$\s*([\d\.,]+)', desc),
    }

class LocationResolver:
    def __init__(self, supabase_client):
        self.sb = supabase_client
        self.estados = {}
        self.cidades = {}
        self.bairros = {}
        self._load_master_data()

    def _load_master_data(self):
        print("[INFO] Carregando dados mestres de localizacao...")
        res_uf = self.sb.table("estados").select("id, sigla").execute()
        self.estados = {normalize_text(r['sigla']): r['id'] for r in res_uf.data}
        
        all_cities = []
        page = 0
        while True:
            res = self.sb.table("cidades").select("id, id_uf, nome").range(page*1000, (page+1)*1000 - 1).execute()
            if not res.data: break
            all_cities.extend(res.data)
            page += 1
        for r in all_cities:
            self.cidades[(r['id_uf'], normalize_text(r['nome']))] = r['id']
            
        all_bairros = []
        page = 0
        while True:
            res = self.sb.table("bairros").select("id, id_cidade, nome").range(page*1000, (page+1)*1000 - 1).execute()
            if not res.data: break
            all_bairros.extend(res.data)
            page += 1
        for r in all_bairros:
            self.bairros[(r['id_cidade'], normalize_text(r['nome']))] = r['id']

        print(f"[INFO] Localizacao carregada: {len(self.estados)} UFs, {len(self.cidades)} Cidades, {len(self.bairros)} Bairros.")

    def resolve(self, uf_sigla, cidade_nome, bairro_nome, default_uf=None):
        sigla_to_use = uf_sigla if uf_sigla else default_uf
        uf_id = self.estados.get(normalize_text(sigla_to_use))
        cidade_id = None
        bairro_id = None
        requer_revisao = False

        if uf_id:
            cidade_id = self.cidades.get((uf_id, normalize_text(cidade_nome)))
            if cidade_id:
                bnorm = normalize_text(NORMALIZER.normalize(bairro_nome))
                key_b = (cidade_id, bnorm)
                if key_b in self.bairros:
                    bairro_id = self.bairros[key_b]
                else:
                    requer_revisao = True
            else: requer_revisao = True
        else: requer_revisao = True
            
        return uf_id, cidade_id, bairro_id, requer_revisao, sigla_to_use

RESOLVER = None

def ingest_csv(file_path):
    global RESOLVER
    if RESOLVER is None:
        RESOLVER = LocationResolver(supabase)

    nome_arquivo = os.path.basename(file_path)
    try:
        partes = nome_arquivo.split("-")
        data_geracao = datetime(int(partes[2]), int(partes[1]), int(partes[0])).date()
    except:
        data_geracao = datetime.today().date()

    print(f"\n--- Processando: {nome_arquivo} ---")
    
    # Inferir UF do nome do arquivo (fallback)
    default_uf = None
    if "_RJ" in nome_arquivo.upper(): default_uf = "RJ"
    elif "_SP" in nome_arquivo.upper(): default_uf = "SP"
    elif "_MG" in nome_arquivo.upper(): default_uf = "MG"
    elif "_RS" in nome_arquivo.upper(): default_uf = "RS"
    elif "_ES" in nome_arquivo.upper(): default_uf = "ES"
    elif "LISTA_IMOVEIS_RJ" in nome_arquivo.upper(): default_uf = "RJ"
    
    print(f"  [INFO] UF Padrao inferida: {default_uf}")
    try:
        header_idx = 0
        with open(file_path, 'r', encoding='latin1') as f:
            for i, line in enumerate(f):
                if i > 150: break
                clean_line = line.strip().lower()
                if len([k for k in ["imóvel", "cidade", "bairro", "desconto"] if k in clean_line]) >= 3:
                    header_idx = i
                    print(f"  [HEADER] Linha {i}")
                    break
        df = pd.read_csv(file_path, sep=';', encoding='latin1', skiprows=header_idx, on_bad_lines='skip', dtype=str)
        df.columns = [str(c).strip() for c in df.columns]
    except Exception as e:
        print(f"[ERRO] Leitura: {e}")
        return nome_arquivo, {"total_lidos": 0, "aceitos": 0}

    total_lidos = 0
    aceitos = 0
    rejeitados = 0
    motivos = {"desconto_baixo": 0, "modalidade_invalida": 0, "numero_invalido": 0}

    # Mapeamento de colunas
    def get_col(df, frags):
        for c in df.columns:
            if any(f.lower() in c.lower() for f in frags): return c
        return None

    c_numero = get_col(df, ['N° do imóvel', 'Nº do imóvel', 'numero'])
    c_uf = get_col(df, ['UF'])
    c_cidade = get_col(df, ['Cidade'])
    c_bairro = get_col(df, ['Bairro'])
    c_endereco = get_col(df, ['Endereço', 'endereco'])
    c_preco = get_col(df, ['Preço', 'venda'])
    c_avaliacao = get_col(df, ['avaliação', 'Preço de avaliação'])
    c_desconto = get_col(df, ['Desconto'])
    c_modalidade = get_col(df, ['Modalidade'])
    c_fgts = get_col(df, ['FGTS'])
    c_financiamento = get_col(df, ['Financiamento'])

    batch_imoveis = []
    batch_historico = []
    rejeitados_mod = 0
    rejeitados_desc = 0
    rejeitados_db = 0

    for i, row in df.iterrows():
        total_lidos += 1
        num_raw = row.get(c_numero)
        if pd.isna(num_raw): continue
            
        try:
            s_num = str(num_raw).strip()
            # Se for notação científica (contém E+), tenta extrair o número correto do link
            if "E+" in s_num.upper() or "," in s_num:
                link_raw = str(row.get(c_link if 'c_link' in locals() else get_col(df, ['link']), ''))
                match_num = re.search(r'nimovel=(\d+)', link_raw)
                if match_num:
                    numero = int(match_num.group(1))
                else:
                    # Tenta converter o s_num tratando a vírgula como decimal se necessário
                    s_num_fixed = s_num.replace(',', '.')
                    numero = int(float(s_num_fixed))
            else:
                numero = int(float(s_num))
        except: continue
            
        try:
            preco = float(str(row.get(c_preco, '0')).replace('.', '').replace(',', '.').replace('R$', '').strip())
            avaliacao = float(str(row.get(c_avaliacao, '0')).replace('.', '').replace(',', '.').replace('R$', '').strip())
            desconto = float(str(row.get(c_desconto, '0')).replace('%', '').replace(',', '.').strip())
        except:
            preco, avaliacao, desconto = 0.0, 0.0, 0.0
            
        mod_raw = str(row.get(c_modalidade, '')).strip()
        if mod_raw not in MODALIDADES_ACEITAS:
            rejeitados_mod += 1
            continue
            
        if float(desconto) < DESCONTO_MINIMO:
            rejeitados_desc += 1
            continue

        uf_raw = str(row.get(c_uf, '')).strip() if c_uf else ''
        cidade_raw = str(row.get(c_cidade, '')).strip() if c_cidade else ''
        bairro_raw = str(row.get(c_bairro, '')).strip() if c_bairro else ''
        
        id_uf, id_cidade, id_bairro, requer_revisao, uf_final = RESOLVER.resolve(uf_raw, cidade_raw, bairro_raw, default_uf)
        
        tipo_raw = str(row.get(get_col(df, ['Tipo de imóvel', 'Tipo']), 'Imóvel')).strip()
        val_moeda = max(0.0, avaliacao - preco)
        
        titulo, link, desc_seo, keyword = generate_seo_fields(int(numero), mod_raw, uf_final, cidade_raw, bairro_raw, val_moeda, tipo_raw)
        
        # Caminho da imagem de destaque
        img_name = f"{link}.jpg"
        img_path_rel = f"/imagens-destaque/{img_name}"
        
        # Lógica de clonagem de imagem
        BASE_DIR_INGEST = Path(__file__).parent.parent.parent
        TEMPLATE_IMG_INGEST = BASE_DIR_INGEST / "imagens" / "imagem-destaque" / "ImagemDestaque.jpg"
        DEST_DIR_INGEST = BASE_DIR_INGEST / "web" / "public" / "imagens-destaque"
        
        if TEMPLATE_IMG_INGEST.exists():
            dest_file = DEST_DIR_INGEST / img_name
            if not dest_file.exists():
                try:
                    shutil.copy2(TEMPLATE_IMG_INGEST, dest_file)
                except:
                    pass

        batch_imoveis.append({
            "imovel_caixa_numero": int(numero),
            "id_cidade_imovel_caixa": int(id_cidade) if id_cidade else None,
            "id_bairro_imovel_caixa": int(id_bairro) if id_bairro else None,
            "id_uf_imovel_caixa": int(id_uf) if id_uf else None,
            "imovel_caixa_endereco_csv": str(row.get(c_endereco, '')).strip(),
            "imovel_caixa_modalidade": mod_raw,
            "imovel_caixa_post_titulo": titulo,
            "imovel_caixa_post_link_permanente": link,
            "imovel_caixa_post_descricao": desc_seo,
            "imovel_caixa_post_palavra_chave": keyword,
            "imovel_caixa_post_imagem_destaque": img_path_rel,
            "requer_revisao_localizacao": bool(requer_revisao),
            "updated_at": datetime.now().isoformat()
        })
        
        batch_historico.append({
            "numero": int(numero),
            "imovel_caixa_modalidade": mod_raw,
            "imovel_caixa_valor_venda": float(preco),
            "imovel_caixa_valor_avaliacao": float(avaliacao),
            "imovel_caixa_valor_desconto_percentual": float(desconto),
            "imovel_caixa_valor_desconto_moeda": float(max(0.0, avaliacao - preco)),
            "created_at": datetime.now().isoformat()
        })

        if len(batch_imoveis) >= 50:
            try:
                success_count = enviar_batch_com_historico(batch_imoveis, batch_historico)
                aceitos += (success_count or 0)
                rejeitados_db += (len(batch_imoveis) - (success_count or 0))
            except:
                rejeitados_db += len(batch_imoveis)
            batch_imoveis, batch_historico = [], []

    if batch_imoveis:
        try:
            success_count = enviar_batch_com_historico(batch_imoveis, batch_historico)
            aceitos += (success_count or 0)
            rejeitados_db += (len(batch_imoveis) - (success_count or 0))
        except:
            rejeitados_db += len(batch_imoveis)

    rejeitados = total_lidos - aceitos
    stats = {
        "total_lidos": total_lidos, 
        "aceitos": aceitos, 
        "rejeitados": rejeitados,
        "detalhe": {
            "modalidade": rejeitados_mod,
            "desconto": rejeitados_desc,
            "banco_dados": rejeitados_db
        }
    }
    return nome_arquivo, stats

def enviar_batch_com_historico(batch_imoveis, batch_historico):
    try:
        res = supabase.table("imoveis").upsert(batch_imoveis, on_conflict="imovel_caixa_numero").execute()
        if res.data:
            # Upsert counts only successful operations. In Supabase, this returns the rows affected.
            map_ids = {item['imovel_caixa_numero']: item['imoveis_id'] for item in res.data}
            final_hist = []
            for h in batch_historico:
                real_id = map_ids.get(h.pop("numero"))
                if real_id:
                    h["imovel_id"] = real_id
                    final_hist.append(h)
            if final_hist:
                supabase.table("atualizacoes_imovel").insert(final_hist).execute()
            return len(res.data)
        return 0
    except Exception as e:
        print(f"  [ERRO CRÍTICO BATCH]: {e}")
        raise e # Re-raise to stop the process and signal error in logs

if __name__ == "__main__":
    csv_files = glob.glob(os.path.join(CSV_DIR, "*.csv"))
    for f in csv_files: ingest_csv(f)
