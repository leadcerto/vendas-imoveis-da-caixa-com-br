import os
import sys
import glob
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv
from pathlib import Path
from supabase import create_client, Client


sys.stdout.reconfigure(encoding='utf-8')
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
CSV_DIR = "csv-caixa" # Corrigido para bater com a estrutura real

# Importa normalizador de bairros
sys.path.insert(0, str(Path(__file__).parent.parent))
from modules.data_processing.normalizers.bairro_normalizer import BairroNormalizer
NORMALIZER = BairroNormalizer(mapping_path=os.path.join(CSV_DIR, "bairros_normalizacao.json"))



# Modalidades aceitas (conforme gemini.md)
MODALIDADES_ACEITAS = {"Venda Direta Online", "Venda Online"}
# Desconto mínimo em % para aceitar o imóvel
DESCONTO_MINIMO = 30.0


def calcular_tags(desconto_pct: float, desconto_rs: float, financiamento: bool) -> list:
    tags = []
    if desconto_rs > 100_000:
        tags.append("desconto_acima_100k")
    if desconto_pct > 70 and financiamento:
        tags.append("super_destaque")
    elif desconto_pct > 70:
        tags.append("desconto_acima_70pct")
    elif desconto_pct > 50:
        tags.append("desconto_acima_50pct")
    return tags


def parse_valor(valor_raw) -> float:
    """Converte string de valor brasileiro para float."""
    if pd.isna(valor_raw) or str(valor_raw).strip() in ("", "-"):
        return 0.0
    s = str(valor_raw).strip()
    # Remove R$, pontos de milhar e substitui vírgula por ponto
    s = s.replace("R$", "").replace(".", "").replace(",", ".").strip()
    try:
        return float(s)
    except ValueError:
        return 0.0


def parse_desconto(valor_raw) -> float:
    """Converte string de desconto (ex: '35%' ou '35,00') para float."""
    if pd.isna(valor_raw) or str(valor_raw).strip() in ("", "-"):
        return 0.0
    s = str(valor_raw).replace("%", "").replace(",", ".").strip()
    try:
        return float(s)
    except ValueError:
        return 0.0


def ingerir_csv(caminho_csv: str, supabase: Client):
    nome_arquivo = os.path.basename(caminho_csv)

    # Extrai data do nome do arquivo (formato: DD-MM-YYYY-Nome.csv)
    try:
        partes = nome_arquivo.split("-")
        data_geracao = datetime(int(partes[2]), int(partes[1]), int(partes[0])).date()
    except Exception:
        data_geracao = datetime.today().date()
        print(f"[AVISO] Nao foi possivel extrair data do arquivo. Usando hoje: {data_geracao}")

    print(f"\n--- Processando: {nome_arquivo} ---")
    print(f"Data de geracao: {data_geracao}")

    # Lê CSV pulando as duas primeiras linhas (header do relatório Caixa está na 3ª linha)
    df = pd.read_csv(caminho_csv, sep=";", encoding="latin1", header=2)

    total_lidos = len(df)
    print(f"Total de linhas lidas: {total_lidos}")

    # Renomeia colunas para nomes padronizados (mais robusto)
    df.columns = [c.strip() for c in df.columns]
    print(f"Colunas lidas do CSV: {list(df.columns)}")
    
    # Mapeamento flexível (remove espaços e caracteres especiais comuns)
    col_map = {
        "N° do imóvel": "numero_imovel",
        "UF": "uf",
        "Cidade": "cidade",
        "Bairro": "bairro",
        "Endereço": "endereco",
        "Preço": "preco_venda",
        "Valor de avaliação": "valor_avaliacao",
        "Desconto": "desconto_pct",
        "Financiamento": "financiamento",
        "Descrição": "descricao",
        "Modalidade de venda": "modalidade_venda",
        "Link de acesso": "link_acesso",
    }
    
    # Tenta mapear mesmo se houver espaços extras nas colunas do CSV
    actual_map = {}
    for col in df.columns:
        stripped_col = str(col).strip()
        for target, mapped in col_map.items():
            if target.lower() in stripped_col.lower() or stripped_col.lower() in target.lower():
                actual_map[col] = mapped
    
    df = df.rename(columns=actual_map)
    
    # Backup por posicao se o nome falhar (Caixa costuma manter ordem)

    if "numero_imovel" not in df.columns and len(df.columns) > 0:
        df = df.rename(columns={df.columns[0]: "numero_imovel"})
    if "uf" not in df.columns and len(df.columns) > 1:
        df = df.rename(columns={df.columns[1]: "uf"})
    if "cidade" not in df.columns and len(df.columns) > 2:
        df = df.rename(columns={df.columns[2]: "cidade"})
    if "bairro" not in df.columns and len(df.columns) > 3:
        df = df.rename(columns={df.columns[3]: "bairro"})
    if "endereco" not in df.columns and len(df.columns) > 4:
        df = df.rename(columns={df.columns[4]: "endereco"})
    if "preco_venda" not in df.columns and len(df.columns) > 5:
        df = df.rename(columns={df.columns[5]: "preco_venda"})
    if "valor_avaliacao" not in df.columns and len(df.columns) > 6:
        df = df.rename(columns={df.columns[6]: "valor_avaliacao"})
    if "desconto_pct" not in df.columns and len(df.columns) > 7:
        df = df.rename(columns={df.columns[7]: "desconto_pct"})
    if "financiamento" not in df.columns and len(df.columns) > 8:
        df = df.rename(columns={df.columns[8]: "financiamento"})


    # Verifica se coluna Modalidade existe; se não, tenta detectar
    if "modalidade_venda" not in df.columns:
        # Se nao mapeou pelo nome, tenta a coluna 10 ou 11
        for idx in [10, 11, 12]:
            if len(df.columns) > idx:
                df = df.rename(columns={df.columns[idx]: "modalidade_venda"})
                break

    aceitos = 0
    rejeitados = 0
    motivos = {"desconto_baixo": 0, "modalidade_invalida": 0, "numero_invalido": 0, "erro_insercao": 0}
    lote = []

    for _, row in df.iterrows():
        numero_raw = row.get("numero_imovel")
        if pd.isna(numero_raw):
            rejeitados += 1
            motivos["numero_invalido"] += 1
            continue
            
        try:
            s_numero = str(numero_raw).strip().split('.')[0]
            if not s_numero.isdigit():
                raise ValueError
            numero = s_numero
        except:
            rejeitados += 1
            motivos["numero_invalido"] += 1
            continue


        modalidade = str(row.get("modalidade_venda", "")).strip()
        if modalidade not in MODALIDADES_ACEITAS:
            rejeitados += 1
            motivos["modalidade_invalida"] += 1
            continue

        desconto_pct = parse_desconto(row.get("desconto_pct", 0))
        if desconto_pct < DESCONTO_MINIMO:
            rejeitados += 1
            motivos["desconto_baixo"] += 1
            continue

        preco_venda = parse_valor(row.get("preco_venda", 0))
        valor_avaliacao = parse_valor(row.get("valor_avaliacao", 0))
        desconto_rs = max(0, valor_avaliacao - preco_venda)
        financiamento = str(row.get("financiamento", "")).strip().lower() in ("sim", "yes", "s", "true", "1")
        tags = calcular_tags(desconto_pct, desconto_rs, financiamento)

        registro = {
            "numero_imovel": numero,
            "data_geracao": str(data_geracao),
            "uf": str(row.get("uf", "")).strip() or None,
            "cidade": str(row.get("cidade", "")).strip() or None,
            "bairro": NORMALIZER.normalize(row.get("bairro", "")) or None,
            "endereco": str(row.get("endereco", "")).strip() or None,
            "preco_venda": preco_venda,
            "valor_avaliacao": valor_avaliacao,
            "desconto_percentual": desconto_pct,
            "aceita_financiamento": financiamento,
            "descricao": str(row.get("descricao", "")).strip() or None,
            "modalidade_venda": modalidade,
            "link_imovel": (str(row.get("link_acesso", "")).strip() or "https://venda-imoveis.caixa.gov.br/"),
            "nivel_destaque": len(tags),
            # O usuario solicitou que a data de geracao seja a data de atualizacao
            "data_atualizacao": str(data_geracao),
            "atualizado_em": datetime.now().isoformat(), # Tracking de quando o script rodou
        }

        lote.append(registro)
        aceitos += 1

    # Insere em lotes de 100
    erros_insercao = 0
    LOTE_SIZE = 100
    for i in range(0, len(lote), LOTE_SIZE):
        bloco = lote[i : i + LOTE_SIZE]
        try:
            # on_conflict ajustado para numero_imovel (PK confirmada)
            supabase.table("imoveis_caixa").upsert(
                bloco, on_conflict="numero_imovel"
            ).execute()

            print(f"  [OK] Lote {i // LOTE_SIZE + 1}: {len(bloco)} registros inseridos/atualizados.")
        except Exception as e:
            print(f"  [ERRO] Lote {i // LOTE_SIZE + 1} FALHOU CRITICAMENTE: {e}")
            if hasattr(e, 'message'): print(f"    Mensagem: {e.message}")
            if hasattr(e, 'details'): print(f"    Detalhes: {e.details}")
            erros_insercao += len(bloco)
            aceitos -= len(bloco)



    motivos["erro_insercao"] = erros_insercao

    # Grava log da ingestão
    try:
        supabase.table("logs_ingestao").insert({
            "arquivo_csv": nome_arquivo,
            "data_geracao": str(data_geracao),
            "total_lidos": total_lidos,
            "total_aceitos": aceitos,
            "total_rejeitados": rejeitados,
            "motivos_rejeicao": motivos,
        }).execute()
    except Exception as e:
        print(f"[AVISO] Nao foi possivel gravar log: {e}")

    print(f"\n[RESUMO] {nome_arquivo}")
    print(f"  Total lidos    : {total_lidos}")
    print(f"  Aceitos        : {aceitos}")
    print(f"  Rejeitados     : {rejeitados}")
    print(f"    - Desconto baixo     : {motivos['desconto_baixo']}")
    print(f"    - Modalidade invalida: {motivos['modalidade_invalida']}")
    print(f"    - Numero invalido    : {motivos['numero_invalido']}")
    print(f"    - Erros de insercao  : {motivos['erro_insercao']}")

    return nome_arquivo, aceitos


def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[ERRO] SUPABASE_URL ou SUPABASE_KEY nao encontrados no .env")
        return

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("[OK] Conexao com Supabase estabelecida.")

    csvs = glob.glob(os.path.join(CSV_DIR, "*.csv"))
    if not csvs:
        print(f"[AVISO] Nenhum arquivo .csv encontrado em '{CSV_DIR}/'")
        return

    print(f"Arquivos encontrados: {len(csvs)}")

    for csv_path in csvs:
        ingerir_csv(csv_path, supabase)

    print("\n[CONCLUIDO] Todos os CSVs foram processados.")
    print("Nota: Os arquivos CSV NAO foram deletados. Delete manualmente apos verificar os dados.")


if __name__ == "__main__":
    main()
