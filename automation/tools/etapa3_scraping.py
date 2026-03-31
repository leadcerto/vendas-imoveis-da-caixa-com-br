import sys
import os
import re
import json
import time
import requests
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
env_path = os.path.join(ROOT_DIR, "web", ".env")
load_dotenv(env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ ERRO: SUPABASE_URL ou SUPABASE_KEY não encontrados.")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
_scraping_session = None

def get_scraping_session():
    global _scraping_session
    if _scraping_session is None:
        _scraping_session = requests.Session()
        cookies_path = os.path.join(os.path.dirname(__file__), "cookies.json")
        if os.path.exists(cookies_path):
            try:
                with open(cookies_path, "r", encoding="utf-8") as f:
                    captured_cookies = json.load(f)
                    _scraping_session.cookies.update(captured_cookies)
            except Exception as e:
                pass
                
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

def parse_address(raw_address):
    if not raw_address: return "", "", ""
    raw = str(raw_address).strip()
    parts = [p.strip() for p in raw.split(',')]
    logradouro = parts[0] if len(parts) > 0 else raw
    numero = ""
    complemento = ""
    if len(parts) >= 2:
        if re.match(r'^\d+', parts[1].strip()):
            numero = parts[1].strip()
            complemento = ", ".join(parts[2:]) if len(parts) > 2 else ""
        else:
            complemento = ", ".join(parts[1:])
    logradouro = re.sub(r'(\b\w+\b)( \1)+', r'\1', logradouro, flags=re.IGNORECASE)
    return logradouro.strip(), numero.strip(), complemento.strip()

def scrape_imovel(numero, link_direto):
    try:
        session = get_scraping_session()
        resp = session.get(link_direto, timeout=20)
        resp.encoding = 'utf-8'
        if resp.status_code != 200:
            return None

        html = resp.text
        raw_data = {"html_length": len(html), "url": link_direto, "scraped_at": datetime.now().isoformat()}
        result = {"imovel_caixa_detalhes_scraping": json.dumps(raw_data, ensure_ascii=False)}

        def extract(pattern, default=""):
            m = re.search(pattern, html, re.IGNORECASE | re.DOTALL)
            return m.group(1).strip() if m else default

        result["imovel_caixa_cartorio_matricula"] = extract(r'Matr[íi]cula\(s\).*?<[^>]+>([^<]+)<')
        result["imovel_caixa_cartorio_oficio"] = extract(r'Of[íi]cio.*?<[^>]+>([^<]+)<')
        result["imovel_caixa_cartorio_comarca"] = extract(r'Comarca.*?<[^>]+>([^<]+)<')
        result["imovel_caixa_cartorio_inscricao_imobiliaria"] = extract(r'Inscri[çc][aã]o imobili[aá]ria.*?<[^>]+>([^<]+)<')
        result["imovel_caixa_cartorio_averbacao"] = extract(r'Averba[çc][aã]o.*?<[^>]+>([^<]+)<')

        fgts_text = extract(r'FGTS.*?(<span[^>]*>[^<]*</span>|<td[^>]*>[^<]*</td>)', '')
        result["imovel_caixa_pagamento_fgts"] = 'sim' in fgts_text.lower() or 'aceita' in fgts_text.lower()

        result["imovel_caixa_pagamento_condominio_regra"] = extract(r'cond.*?regra.*?</?\w+>([^<]{10,})<')
        result["imovel_caixa_pagamento_tributos"] = extract(r'[Ii][Pp][Tt][Uu].*?</?\w+>([^<]{10,})<')
        result["imovel_caixa_pagamento_anotacoes"] = extract(r'anota[çc][oõ][eê]s.*?</?\w+>([^<]{10,})<')

        endereco_scraped = extract(r'Endere[çc]o.*?<[^>]+>([^<]{10,})<')
        if endereco_scraped:
            logradouro, numero_end, complemento = parse_address(endereco_scraped)
            result["imovel_caixa_endereco_logradouro"] = logradouro
            result["imovel_caixa_endereco_numero"] = numero_end
            result["imovel_caixa_endereco_complemento"] = complemento
            cep_match = re.search(r'(\d{5}-?\d{3})', endereco_scraped)
            if cep_match:
                result["_cep_extraido"] = cep_match.group(1).replace('-', '')
        return result
    except Exception as e:
        return None

def extract_features(description):
    if not description: return {}
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

    def has(kws): return any(kw in desc for kw in kws)

    return {
        "imovel_caixa_descricao_area_total": get_num(r'([\d\.,]+)\s*de \w*área total', desc) or get_num(r'([\d\.,]+)\s*de area total', desc),
        "imovel_caixa_descricao_area_privativa": get_num(r'([\d\.,]+)\s*de \w*área privativa', desc) or get_num(r'([\d\.,]+)\s*de area privativa', desc),
        "imovel_caixa_descricao_area_do_terreno": get_num(r'([\d\.,]+)\s*de \w*área do terreno', desc) or get_num(r'([\d\.,]+)\s*de area do terreno', desc),
        "imovel_caixa_descricao_quartos": get_int(r'(\d+)\s*qto', desc),
        "imovel_caixa_descricao_garagem": get_int(r'(\d+)\s*(?:vaga|garagem)', desc),
        "imovel_caixa_descricao_wc_banheiro": get_int(r'(\d+)\s*wc', desc) or (1 if 'wc' in desc else 0),
        "imovel_caixa_descricao_churrasqueira": has(['churrasqueira']),
        "imovel_caixa_descricao_cozinha": has(['cozinha']),
        "imovel_caixa_descricao_piscina": has(['piscina']),
        "imovel_caixa_descricao_sala": has(['sala']),
        "imovel_caixa_descricao_terraco": has(['terraço', 'terraco']),
        "imovel_caixa_descricao_varanda": has(['varanda']),
        "imovel_caixa_descricao_area_servico": has(['área de serviço', 'area de servico']),
        "_condominio": get_num(r'débitos de condomínio\s*.*?r\$\s*([\d\.,]+)', desc)
    }

def main():
    print("📥 Etapa 3 - Scraping e Enriquecimento Base")
    
    resp_imoveis = supabase.table("imoveis").select("imoveis_id, imovel_caixa_numero, imovel_caixa_link_acesso_direto, imovel_caixa_descricao_csv").eq("etapa_processamento", 2).execute()
    
    imoveis = resp_imoveis.data
    if not imoveis:
        print("✅ Nenhum imóvel pendente na Etapa 2 processamento.")
        sys.exit(0)
        
    print(f"📊 Encontrados {len(imoveis)} imóveis pendentes para processar (Etapa 2 -> Etapa 3).")
    
    sucessos = 0
    erros = 0
    
    for imv in imoveis:
        try:
            imoveis_id = imv["imoveis_id"]
            numero = imv["imovel_caixa_numero"]
            link = imv["imovel_caixa_link_acesso_direto"]
            desc_csv = imv.get("imovel_caixa_descricao_csv", "")
            
            # 1. Parsing da descrição CSV
            features = extract_features(desc_csv)
            condominio_valor = features.pop("_condominio", 0)
            
            # 2. Scraping da CAIXA
            scraped = scrape_imovel(numero, link) or {}
            
            # 3. Separar atributos (Imovel vs Atualizacao)
            pags_fields = ["imovel_caixa_pagamento_fgts", "imovel_caixa_pagamento_condominio_regra", 
                           "imovel_caixa_pagamento_tributos", "imovel_caixa_pagamento_anotacoes"]
                           
            cep_extraido = scraped.pop("_cep_extraido", None)
            
            payload_imovel = {**features}
            payload_imovel["etapa_processamento"] = 3
            
            payload_atualizacao = {
                "imovel_caixa_pagamento_condominio": condominio_valor
            }
            
            for k, v in scraped.items():
                if v:
                    if k in pags_fields:
                        payload_atualizacao[k] = v
                    else:
                        payload_imovel[k] = v
                        
            # Resolver CEP em ceps_imovel
            if cep_extraido:
                res_cep = supabase.table("ceps_imovel").select("id").eq("cep_numerico", cep_extraido).execute()
                if res_cep.data:
                    payload_imovel["id_cep_imovel_caixa"] = res_cep.data[0]["id"]
                else:
                    # Tentar inserir um novo CEP basico se nao existir
                    try:
                        ins_cep = supabase.table("ceps_imovel").insert({"cep_numerico": cep_extraido}).execute()
                        if ins_cep.data:
                            payload_imovel["id_cep_imovel_caixa"] = ins_cep.data[0]["id"]
                    except Exception as e:
                        print(f"⚠️ Erro ao inserir novo CEP {cep_extraido}: {e}")
                        
            # Updates
            supabase.table("imoveis").update(payload_imovel).eq("imoveis_id", imoveis_id).execute()
            
            if payload_atualizacao:
                # Encontrar a atualização correta
                h_res = supabase.table("atualizacoes_imovel").select("id").eq("imovel_id", imoveis_id).order("id", desc=True).limit(1).execute()
                if h_res.data:
                    supabase.table("atualizacoes_imovel").update(payload_atualizacao).eq("id", h_res.data[0]["id"]).execute()
            
            sucessos += 1
            if sucessos % 10 == 0:
                print(f"⏳ Processados {sucessos}/{len(imoveis)} imóveis scraped...")
                
            time.sleep(1) # delay para n bloquear o IP
                
        except Exception as e:
            print(f"❌ Erro no imóvel {imv.get('imovel_caixa_numero')}: {e}")
            erros += 1

    print("=====================================================")
    print(f"✅ ETAPA 3 CONCLUÍDA")
    print(f"✅ Scraping e Features gravados: {sucessos}")
    print(f"⚠️ Erros/Ignorados: {erros}")
    print("=====================================================")

if __name__ == "__main__":
    main()
