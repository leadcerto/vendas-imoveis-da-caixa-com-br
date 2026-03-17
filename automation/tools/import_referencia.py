import os
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

def import_referencia():
    url: str = os.environ.get("SUPABASE_URL")
    key: str = os.environ.get("SUPABASE_KEY")
    supabase: Client = create_client(url, key)

    excel_path = "supabase/tabela_referencia.xlsx"
    if not os.path.exists(excel_path):
        print(f"❌ ERRO: Arquivo {excel_path} não encontrado.")
        return False

    print("📄 Lendo planilha...")
    # Lendo o arquivo sem cabeçalho e transpondo/processando conforme necessário
    df = pd.read_excel(excel_path, header=None)
    
    # A tabela costuma ter 2 colunas: Descrição / Chave e o Valor.
    # Vamos armazenar TUDO na tabela_referencia do supabase.
    # Exemplo: df[0] chave, df[1] valor.
    
    sucessos = 0
    erros = 0
    
    for index, row in df.iterrows():
        chave_crua = str(row[0]).strip()
        valor_cru = row[1]
        
        if pd.isna(chave_crua) or ("Unnamed" in chave_crua):
            continue
            
        try:
            # limpar valor nulo de numero
            val = float(valor_cru) if not pd.isna(valor_cru) else 0.0
            
            # Upsert para não duplicar se rodar duas vezes (baseado na chave)
            data = {
                "chave": chave_crua,
                "valor": val,
                "descricao": "Importado do Excel automaticamente"
            }
            supabase.table("tabela_referencia").upsert(data, on_conflict="chave").execute()
            sucessos += 1
        except Exception as e:
            print(f"⚠️ Erro ao inserir {chave_crua}: {e}")
            erros += 1

    print(f"✅ Importação finalizada! Sucesso: {sucessos} | Erros: {erros}")
    return True

if __name__ == "__main__":
    import_referencia()
