import os
import time
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Mapeamento manual baseado em palavras-chave comuns
KEYWORD_MAPPING = {
    "apartamento": 1,
    "apto": 1,
    "apt": 1,
    "casa": 2,
    "terreno": 3,
    "lote": 3,
    "área": 3,
    "cobertura": 4,
    "loja": 5,
    "comercial": 14,
    "sala": 6,
    "office": 6,
    "escritório": 6,
    "galpão": 11,
    "armazem": 11,
    "depósito": 11,
    "prédio": 12,
    "edifício": 12,
    "sítio": 13,
    "chácara": 13,
    "fazenda": 13,
    "rural": 15
}

def fix_types():
    print("Iniciando correção de tipos NULL com heurística avançada...")
    outros_id = 16
    
    while True:
        res = supabase.table("imoveis").select("imoveis_id, imovel_caixa_endereco_csv, imovel_caixa_descricao_csv") \
            .is_("id_tipo_imovel_caixa", "null") \
            .limit(100).execute()
        
        if not res.data:
            print("Nenhum registro NULL restante.")
            break
            
        print(f"Processando lote de {len(res.data)} registros...")
        for item in res.data:
            # Junta endereço e descrição para busca
            text = f"{(item.get('imovel_caixa_descricao_csv') or '')} {(item.get('imovel_caixa_endereco_csv') or '')}".lower()
            
            found_id = None
            # Tenta encontrar por palavras-chave
            for kw, t_id in KEYWORD_MAPPING.items():
                if kw in text:
                    found_id = t_id
                    break
            
            target_id = found_id if found_id else outros_id
            
            try:
                supabase.table("imoveis").update({"id_tipo_imovel_caixa": target_id}) \
                    .eq("imoveis_id", item["imoveis_id"]).execute()
            except Exception as e:
                print(f"Erro ao atualizar {item['imoveis_id']}: {e}")
                time.sleep(1)

        print("Pausa curta...")
        time.sleep(0.5)

if __name__ == "__main__":
    fix_types()
