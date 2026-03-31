import sys
import os
import json
import time
from collections import Counter
from dotenv import load_dotenv
from supabase import create_client, Client

# Optional: pip install google-generativeai
try:
    import google.generativeai as genai
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
env_path = os.path.join(ROOT_DIR, "web", ".env")
load_dotenv(env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ ERRO: SUPABASE_URL ou SUPABASE_KEY não encontrados.")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

if HAS_GENAI and GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    # Recomenda-se gemini-1.5-flash para tarefas rapidas json
    model = genai.GenerativeModel('gemini-1.5-flash', generation_config={"response_mime_type": "application/json"})
else:
    model = None

def get_active_prompt():
    """ Busca o prompt ativo no banco. Se não houver, usa um padrao. """
    try:
        res = supabase.table("prompts_ia").select("conteudo_prompt").eq("is_ativo", True).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]["conteudo_prompt"]
    except Exception as e:
        print(f"Aviso: Tabela prompts_ia não lida corretamente ou não existe: {e}")
        
    return """
Faça uma análise hiperlocal de vendas do endereço do imóvel retornado na pesquisa, destacando o custo-benefício. Retorne estritamente o json e o texto de venda em HTML com "descricao_bairro" e "custo_beneficio".
"""

def constroi_prompt(cep, logradouro, bairro, cidade, uf, template_base):
    return f"""
Atue como um especialista em inteligência de mercado imobiliário e análise hiperlocal focada em regiões brasileiras.
{template_base}

Por favor, analise a seguinte localização:
CEP: {cep}
Logradouro: {logradouro}
Bairro: {bairro}
Cidade: {cidade}
Estado: {uf}

Você deve retornar EXCLUSIVAMENTE os dados em formato JSON, seguindo EXATAMENTE esta estrutura sem adicionar markdown ou texto extra:
{{
  "logradouro_oficial": "nome do logradouro",
  "bairro_oficial": "nome do bairro",
  "cidade_oficial": "nome da cidade",
  "estado_oficial": "UF",
  "regiao": "região geocartografica",
  "descricao_bairro": "Texto de 3 a 5 parágrafos (máx 1500 caracteres) destacando o perfil do bairro estruturado usando strong ou tags HTML simples para visual bonito.",
  "custo_beneficio": "Breve avaliação de custo benefício médio da região."
}}
Retorno 100% JSON validado.
"""

def enriquecer_cep(cep_id, cep_numerico, logradouro, bairro, cidade, uf, template_base):
    """ Chama IA para enriquecer o CEP e grava na tabela. """
    if not model:
        print(f"⚠️ IA indisponível. Simulando enriquecimento vazio para o CEP {cep_numerico}.")
        payload_simulado = {
            "logradouro_oficial": logradouro,
            "bairro_oficial": bairro,
            "cidade_oficial": cidade,
            "estado_oficial": uf,
            "regiao": "Regional",
            "descricao_bairro": "Análise pendente. IA não configurada.",
            "custo_beneficio": "Pendente"
        }
        texto_gerado = json.dumps(payload_simulado, ensure_ascii=False)
        supabase.table("ceps_imovel").update({"enriquecimento_texto": texto_gerado, "enriquecimento_json": payload_simulado}).eq("id", cep_id).execute()
        return payload_simulado

    try:
        prompt = constroi_prompt(cep_numerico, logradouro, bairro, cidade, uf, template_base)
        response = model.generate_content(prompt)
        text_resp = response.text.strip()
        
        # Pode conter blocks ```json
        if text_resp.startswith("```json"):
            text_resp = text_resp[7:]
        if text_resp.endswith("```"):
            text_resp = text_resp[:-3]
            
        json_resp = json.loads(text_resp.strip())
        
        supabase.table("ceps_imovel").update({
            "enriquecimento_texto": response.text,
            "enriquecimento_json": json_resp
        }).eq("id", cep_id).execute()
        
        return json_resp
    except Exception as e:
        print(f"❌ Erro na API do Gemini para CEP {cep_numerico}: {e}")
        return None

def main():
    print("📥 Etapa 4 - Enriquecimento Avançado de CEPs")
    
    resp_imoveis = supabase.table("imoveis").select(
        "imoveis_id, imovel_caixa_numero, id_cep_imovel_caixa, imovel_caixa_endereco_logradouro, imovel_caixa_endereco_bairro, imovel_caixa_endereco_cidade, imovel_caixa_endereco_uf"
    ).eq("etapa_processamento", 3).execute()
    
    imoveis = resp_imoveis.data
    if not imoveis:
        print("✅ Nenhum imóvel pendente na Etapa 3 processamento.")
        sys.exit(0)
        
    print(f"📊 Encontrados {len(imoveis)} imóveis pendentes para processar (Etapa 3 -> Etapa 4).")
    
    # Agrumar por CEP e contar frequencia para priorizar
    # Cria uma lista de dicionarios para mapear os dados do imovel base ao CEP
    ceps_counter = Counter([imv.get("id_cep_imovel_caixa") for imv in imoveis if imv.get("id_cep_imovel_caixa")])
    
    # Ordem decrescente (Os CEPs com MAIS imoveis processarão primeiro)
    ceps_priorizados = [cep_id for cep_id, count in ceps_counter.most_common()]
    
    print(f"🔥 Ordenados {len(ceps_priorizados)} ceps únicos por volume de relevância.")

    template_ativo = get_active_prompt()
    print(f"📝 Template IA Ativo carregado: {template_ativo[:50]}...")

    sucessos = 0
    erros = 0
    
    for cep_id in ceps_priorizados:
        # Pega as informacoes do primeiro imovel que tem esse cep_id para passar como contexto
        imovel_contexto = next((i for i in imoveis if i.get("id_cep_imovel_caixa") == cep_id), None)
        if not imovel_contexto:
            continue
            
        try:
            # Buscar info do CEP
            resp_ceps = supabase.table("ceps_imovel").select("cep_numerico, enriquecimento_json").eq("id", cep_id).execute()
            if not resp_ceps.data:
                # Marca todos desse cep como 4 para nao travar fila
                print(f"⚠️ CEP não existe na base. Pulando imóveis deste CEP ID: {cep_id}.")
                supabase.table("imoveis").update({"etapa_processamento": 4}).eq("id_cep_imovel_caixa", cep_id).execute()
                continue
                
            cep_data = resp_ceps.data[0]
            if cep_data.get("enriquecimento_json"):
                # Já foi enriquecido, avança a esteira para os imoveis
                supabase.table("imoveis").update({"etapa_processamento": 4}).eq("id_cep_imovel_caixa", cep_id).execute()
                sucessos += ceps_counter[cep_id]
                continue
                
            # Chamar Enriquecimento
            print(f"🔍 Enriquecendo CEP PRIORITY: {cep_data['cep_numerico']} (Possui {ceps_counter[cep_id]} Imóveis na Região)...")
            
            res_json = enriquecer_cep(
                cep_id, 
                cep_data['cep_numerico'], 
                imovel_contexto.get("imovel_caixa_endereco_logradouro", ""),
                imovel_contexto.get("imovel_caixa_endereco_bairro", ""),
                imovel_contexto.get("imovel_caixa_endereco_cidade", ""),
                imovel_contexto.get("imovel_caixa_endereco_uf", ""),
                template_ativo
            )
            
            if res_json:
                # Marca todos imovel vinculados a esse cep como conluidos em batch (Lote)
                supabase.table("imoveis").update({"etapa_processamento": 4}).eq("id_cep_imovel_caixa", cep_id).execute()
                sucessos += ceps_counter[cep_id]
                time.sleep(2) # Delay entre apis
            else:
                erros += ceps_counter[cep_id]
                # Avança etapa mesmo com erro para nao travar o loop para sempre? Neste caso nao, se for problema de limit, vai tentar repetidamente no proximo worker.
                
        except Exception as e:
            print(f"❌ Erro geral ao processar CEP ID {cep_id}: {e}")
            erros += 1

    print("=====================================================")
    print(f"✅ ETAPA 4 CONCLUÍDA")
    print(f"✅ Imóveis Finalizados (Avançados para 4): {sucessos}")
    print(f"⚠️ Imóveis Retidos por Falha: {erros}")
    print("=====================================================")

if __name__ == "__main__":
    main()
