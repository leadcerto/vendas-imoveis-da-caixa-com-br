"""
run_automacao.py
================
Automação contínua de postagem de imóveis da Caixa no WordPress.

Estratégia anti-sobrecarga:
  - Posta LOTE_SIZE imóveis por vez
  - Aguarda PAUSA_ENTRE_POSTS segundos entre cada post
  - Aguarda PAUSA_ENTRE_LOTES segundos entre cada lote
  - Para automaticamente se houver ERROS_CONSECUTIVOS_LIMITE erros seguidos
  - Para quando não houver mais imóveis pendentes

Para rodar uma única vez (lote único):
    python tools/run_automacao.py --modo=unico

Para rodar em loop contínuo até zerar a fila:
    python tools/run_automacao.py --modo=loop

No Windows, você pode deixar rodando em background:
    start /B python tools/run_automacao.py --modo=loop
"""

import os
import sys
import time
import argparse
import unicodedata
import re
import requests
from datetime import datetime
from dotenv import load_dotenv
from requests.auth import HTTPBasicAuth
from supabase import create_client, Client

sys.stdout.reconfigure(encoding='utf-8')
load_dotenv()

# ─────────────────────────────────────────────
# Configurações (ajuste conforme necessário)
# ─────────────────────────────────────────────
LOTE_SIZE             = 30    # Posts por lote
PAUSA_ENTRE_POSTS     = 2.0   # segundos entre cada post
PAUSA_ENTRE_LOTES     = 300   # segundos entre lotes (5 minutos)
ERROS_CONSECUTIVOS_LIMITE = 5 # Para se houver X erros seguidos

WP_URL         = os.getenv("WP_URL")
WP_USERNAME    = os.getenv("WP_USERNAME")
WP_APP_PASSWORD = os.getenv("WP_APP_PASSWORD")
SUPABASE_URL   = os.getenv("SUPABASE_URL")
SUPABASE_KEY   = os.getenv("SUPABASE_KEY")


# ─────────────────────────────────────────────
# Funções auxiliares
# ─────────────────────────────────────────────

def log(msg: str):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}")


def slugify(texto: str) -> str:
    texto = unicodedata.normalize("NFD", texto)
    texto = texto.encode("ascii", "ignore").decode("ascii")
    texto = texto.lower()
    texto = re.sub(r"[^a-z0-9\s-]", "", texto)
    texto = re.sub(r"[\s-]+", "-", texto).strip("-")
    return texto


def formatar_real(valor) -> str:
    try:
        return f"R$ {float(valor):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except Exception:
        return "Nao informado"


def inferir_tipo(descricao: str) -> str:
    d = (descricao or "").lower()
    if "apartamento" in d: return "Apartamento"
    if "casa" in d:        return "Casa"
    if "terreno" in d or "lote" in d: return "Terreno"
    if "comercial" in d or "sala" in d or "loja" in d: return "Imovel Comercial"
    if "rural" in d or "chacara" in d or "fazenda" in d: return "Imovel Rural"
    return "Imovel"


def gerar_titulo_seo(imovel: dict) -> str:
    tipo    = inferir_tipo(imovel.get("descricao", ""))
    bairro  = imovel.get("bairro", "") or ""
    cidade  = imovel.get("cidade", "") or ""
    uf      = imovel.get("uf", "") or ""
    numero  = imovel.get("numero_imovel", "")
    return f"\U0001f534{tipo} a Venda \u2013 {bairro} {cidade} {uf} \u2013 {numero}"


def gerar_meta(imovel: dict) -> str:
    tipo   = inferir_tipo(imovel.get("descricao", ""))
    bairro = imovel.get("bairro", "") or ""
    cidade = imovel.get("cidade", "") or ""
    uf     = imovel.get("uf", "") or ""
    numero = imovel.get("numero_imovel", "")
    pct    = int(imovel.get("desconto_percentual", 0) or 0)
    return (
        f"{tipo} a Venda \u2013 {bairro} {cidade} {uf} \u2013 {numero} "
        f"Imoveis CAIXA com mais de {pct}% de desconto \u2013 Saiba Mais"
    )


def gerar_html(imovel: dict) -> str:
    numero   = imovel.get("numero_imovel", "")
    uf       = imovel.get("uf", "")
    cidade   = imovel.get("cidade", "")
    bairro   = imovel.get("bairro", "")
    endereco = imovel.get("endereco", "")
    preco    = formatar_real(imovel.get("preco_venda", 0))
    aval     = formatar_real(imovel.get("valor_avaliacao", 0))
    desc_pct = imovel.get("desconto_percentual", 0)
    desc_rs  = formatar_real(imovel.get("desconto_rs", 0))
    descricao = imovel.get("descricao") or "Nao informado"
    modalidade = imovel.get("modalidade_venda") or "Nao informado"
    link_caixa = imovel.get("link_acesso") or f"https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnimovel={numero}"
    imagem   = imovel.get("imagem_padrao") or f"https://venda-imoveis.caixa.gov.br/fotos/F{numero}21.jpg"
    financ   = "Sim" if imovel.get("aceita_financiamento") else "Nao"
    tipo     = inferir_tipo(descricao)

    whatsapp_number = "5521997882950"
    msg_whatsapp = f"Ola! Tenho interesse no imóvel da Caixa *{numero}* localizado em *{bairro}* - *{cidade}-{uf}*."
    import urllib.parse
    link_whatsapp = f"https://api.whatsapp.com/send?phone={whatsapp_number}&text={urllib.parse.quote(msg_whatsapp)}"
    img_banner = "https://imoveisdacaixa.com.br/wp-content/webp-express/webp-images/uploads/2024/09/ICAIXA-TiraDuvidas-LeoLeao.png.webp"

    html = f"""
<div class="caixa-single-container" style="display: flex; flex-direction: column; gap: 20px; max-width: 800px; margin: 0 auto;">
    
    <!-- BLOCO 1: Título -->
    <div class="caixa-single-title-box" style="text-align: left; margin-bottom: 5px;">
        <h2 style="font-size: 2.2em; margin: 0; color: var(--caixa-blue); font-weight: bold; line-height: 1.2;">
            {tipo} em {bairro}, {cidade} - {uf}
        </h2>
    </div>

    <!-- BLOCO 2: Imagem Principal -->
    <div class="caixa-single-header-img" style="width: 100%; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
        <img src="{imagem}" alt="{tipo} a venda em {bairro} {cidade} {uf} - {numero}" style="width: 100%; display: block; object-fit: cover; max-height: 500px;" />
    </div>

    <!-- BLOCO 3: Quadro de Informações / Lucro Imobiliário -->
    <div class="caixa-info-box" style="background: #fff; border: 1px solid #e0e0e0; border-radius: 12px; padding: 25px; box-shadow: 0 8px 20px rgba(0,0,0,0.05); margin-top: 10px;">
        <!-- Lucro Imobiliário (Destaque Máximo) -->
        <div style="text-align: center; background: #e8f5e9; border: 2px dashed #4caf50; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 0.9em; font-weight: bold; color: #2e7d32; text-transform: uppercase; letter-spacing: 1px;">💰 Lucro Imobiliário</p>
            <p style="margin: 5px 0 0 0; font-size: 1.8em; font-weight: 900; color: #1b5e20;">{desc_rs}</p>
        </div>

        <!-- Valores -->
        <div style="margin-bottom: 25px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px dotted #ccc; padding-bottom: 5px;">
                <span style="color: #666; font-size: 0.95em;">Valor da avaliação:</span>
                <span style="font-weight: bold; color: #333; text-decoration: line-through;">{aval}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px dotted #ccc; padding-bottom: 5px;">
                <span style="color: #666; font-size: 0.95em;">Valor mínimo:</span>
                <span style="font-weight: bold; color: var(--caixa-blue); font-size: 1.2em;">{preco}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding-top: 5px;">
                <span style="color: #666; font-size: 0.95em;">Desconto de:</span>
                <span style="font-weight: bold; color: #e53935; font-size: 1.1em;">{desc_pct}%</span>
            </div>
        </div>

        <!-- Botões de Ação -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
            <!-- Tenho Interesse -->
            <a href="#contato-form" style="display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--caixa-orange, #F9B200); color: #fff; padding: 14px; border-radius: 8px; font-weight: bold; text-decoration: none; font-size: 1.05em; transition: background 0.3s; text-align: center;">
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                Tenho interesse
            </a>
            
            <!-- WhatsApp -->
            <a href="{link_whatsapp}" target="_blank" rel="noopener" style="display: flex; align-items: center; justify-content: center; gap: 8px; background: #25D366; color: #fff; padding: 14px; border-radius: 8px; font-weight: bold; text-decoration: none; font-size: 1.05em; transition: background 0.3s; text-align: center;">
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824z"/></svg>
                WhatsApp
            </a>

            <!-- Compartilhar -->
            <button onclick="if(navigator.share){{ navigator.share({{title: document.title, url: window.location.href}}); }} else {{ prompt('Copie o link abaixo:', window.location.href); }}" style="display: flex; align-items: center; justify-content: center; gap: 8px; background: #f0f0f0; color: #333; padding: 14px; border-radius: 8px; font-weight: bold; border: 1px solid #ddd; cursor: pointer; font-size: 1.05em; transition: background 0.3s;">
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
                Compartilhar
            </button>
        </div>
    </div>

    <!-- BLOCO 4: Atualização + Título + Endereço -->
    <div class="caixa-single-info-lines" style="font-size: 1.05em; color: #444; line-height: 1.6; padding: 10px 0; border-top: 1px solid #eee;">
        <p style="margin: 0;">Ultima atualização: {datetime.now().strftime('%d/%m/%Y %H:%M')}</p>
        <p style="margin: 0;">{tipo} em {bairro}, {cidade} - {uf}</p>
        <p style="margin: 0; color: #666;">{endereco}, {bairro} - cep: {imovel.get('cep', 'Nao informado')}, {cidade} - {uf}</p>
    </div>

    <!-- BLOCO 5: Tabela de Detalhes -->
    <div class="caixa-single-section" style="margin-top: 10px;">
        <h3 style="color: var(--caixa-blue); border-bottom: 2px solid #F9B200; padding-bottom: 10px; margin-bottom: 20px;">Detalhes e Características</h3>
        <table class="caixa-data-table" style="width: 100%; border-collapse: collapse;">
            <tbody>
                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; font-weight: bold; color: #555; width: 40%;">Modalidade de Venda:</td><td style="padding: 10px 0;">{modalidade}</td></tr>
                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; font-weight: bold; color: #555;">Tipo de imóvel:</td><td style="padding: 10px 0;">{tipo}</td></tr>
                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; font-weight: bold; color: #555;">Área Privativa:</td><td style="padding: 10px 0;">{imovel.get('area_privativa', 'N/A')} m²</td></tr>
                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; font-weight: bold; color: #555;">Área Total / Área do Terreno:</td><td style="padding: 10px 0;">{imovel.get('area_terreno', 'N/A')} m²</td></tr>
                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; font-weight: bold; color: #555;">Descrição:</td><td style="padding: 10px 0; font-size: 0.95em;">{descricao}</td></tr>
                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; font-weight: bold; color: #555;">Regras de Pagamento:</td><td style="padding: 10px 0;">
                    Financiamento: <strong>{financ}</strong><br>
                    FGTS: <strong>{financ}</strong><br>
                    Consórcio: <strong>NÃO</strong>
                </td></tr>
                <tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 0; font-weight: bold; color: #555;">Número do imóvel:</td><td style="padding: 10px 0;">{numero}</td></tr>
            </tbody>
        </table>
    </div>

    <!-- BLOCO 6: Descrição -->
    <div class="caixa-single-section" style="margin-top: 10px;">
        <h3 style="color: var(--caixa-blue); border-bottom: 2px solid #F9B200; padding-bottom: 10px; margin-bottom: 20px;">Descricao do Imovel</h3>
        <p style="line-height: 1.6; color: #444;">{descricao}</p>
    </div>

    <!-- Botao / Banner WhatsApp com tracking nativo WP -->
    <div style="margin-top: 20px;">
        <a href="{link_whatsapp}" target="_blank" rel="noopener" class="banner-whatsapp-tracking">
            <img src="{img_banner}" alt="Fale com nosso consultor" style="width:100%; max-width:600px; display:block; margin: 20px auto; border-radius:12px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'"/>
        </a>
    </div>

    <!-- Rodapé Emporesa -->
    <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; text-align: center; font-size: 0.8em; color: #888;">
        <p style="margin: 2px 0;"><strong>Imóveis da Caixa LTDA</strong></p>
        <p style="margin: 2px 0;">CNPJ: 50.563.863/0001-45 | CRECI-PJ: 10.234/RJ</p>
    </div>

</div> <!-- /CONTAINER -->
"""
    return html.strip()


def postar(imovel: dict, session: requests.Session) -> dict:
    numero = imovel.get("numero_imovel", "")
    slug   = slugify(f"imovel-caixa-{imovel.get('cidade','')}-{imovel.get('uf','')}-{numero}")
    
    payload = {
        "title":   gerar_titulo_seo(imovel),
        "content": gerar_html(imovel),
        "slug":    slug,
        "status":  "publish",
        "excerpt": gerar_meta(imovel),
        "meta": {
            "caixa_preco_venda": formatar_real(imovel.get("preco_venda", 0)),
            "caixa_valor_avaliacao": formatar_real(imovel.get("valor_avaliacao", 0)),
            "caixa_desconto_pct": str(imovel.get("desconto_percentual", 0)),
            "caixa_cidade": imovel.get("cidade", ""),
            "caixa_uf": imovel.get("uf", ""),
            "caixa_bairro": imovel.get("bairro", ""),
            "caixa_modalidade": imovel.get("modalidade_venda", ""),
        }
    }
    resp = session.post(f"{WP_URL}/wp-json/wp/v2/posts", json=payload, timeout=20)
    if resp.status_code in (200, 201):
        d = resp.json()
        return {"sucesso": True, "id": d["id"], "url": d["link"]}
    return {"sucesso": False, "erro": resp.text[:250]}


# ─────────────────────────────────────────────
# Lógica de lote
# ─────────────────────────────────────────────

def rodar_lote(supabase: Client, session: requests.Session) -> dict:
    """Roda um lote de LOTE_SIZE posts. Retorna estatísticas."""
    resultado = (
        supabase.table("imoveis_caixa")
        .select("*")
        .eq("wp_publicado", False)
        .is_("wp_post_id", "null")
        .limit(LOTE_SIZE)
        .execute()
    )
    imoveis = resultado.data

    if not imoveis:
        return {"pendentes": 0, "ok": 0, "erros": 0}

    ok = 0
    erros = 0
    erros_consecutivos = 0

    for imovel in imoveis:
        numero = imovel.get("numero_imovel", "?")
        try:
            res = postar(imovel, session)
            if res["sucesso"]:
                supabase.table("imoveis_caixa").update({
                    "wp_post_id":  res["id"],
                    "wp_post_url": res["url"],
                    "wp_publicado": True,
                }).eq("id", imovel["id"]).execute()
                log(f"  [OK] {numero} -> {res['url']}")
                ok += 1
                erros_consecutivos = 0
            else:
                log(f"  [ERRO] {numero}: {res.get('erro','?')}")
                erros += 1
                erros_consecutivos += 1
        except Exception as e:
            log(f"  [EXCECAO] {numero}: {str(e)[:120]}")
            erros += 1
            erros_consecutivos += 1

        if erros_consecutivos >= ERROS_CONSECUTIVOS_LIMITE:
            log(f"[ALERTA] {ERROS_CONSECUTIVOS_LIMITE} erros consecutivos. Pausando para evitar banimento.")
            break

        time.sleep(PAUSA_ENTRE_POSTS)

    return {"pendentes": len(imoveis), "ok": ok, "erros": erros, "stop": erros_consecutivos >= ERROS_CONSECUTIVOS_LIMITE}


# ─────────────────────────────────────────────
# Entry-point
# ─────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Automatizacao de postagem de imoveis no WordPress")
    parser.add_argument("--modo", choices=["unico", "loop"], default="loop",
                        help="'unico' = 1 lote e para | 'loop' = continua até zerar a fila")
    args = parser.parse_args()

    if not all([WP_URL, WP_USERNAME, WP_APP_PASSWORD, SUPABASE_URL, SUPABASE_KEY]):
        log("[ERRO] Variaveis de ambiente incompletas no .env")
        return

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    session = requests.Session()
    session.auth = HTTPBasicAuth(WP_USERNAME, WP_APP_PASSWORD)
    session.headers.update({"Content-Type": "application/json"})

    log(f"Iniciando automacao no modo [{args.modo.upper()}]")
    log(f"Configuracao: {LOTE_SIZE} posts/lote | {PAUSA_ENTRE_POSTS}s entre posts | {PAUSA_ENTRE_LOTES}s entre lotes")

    lote_num = 0

    while True:
        lote_num += 1
        log(f"--- LOTE {lote_num} ---")

        stats = rodar_lote(supabase, session)

        if stats.get("pendentes", 0) == 0:
            log("[CONCLUIDO] Todos os imoveis ja foram postados! Encerrando.")
            break

        log(f"Lote {lote_num}: OK={stats['ok']} | Erros={stats['erros']}")

        if stats.get("stop"):
            log("[PARADA DE SEGURANCA] Muitos erros consecutivos. Verifique o servidor e tente novamente.")
            break

        if args.modo == "unico":
            log("[MODO UNICO] Lote concluido. Para continuar, rode novamente.")
            break

        # Período de descanso entre lotes
        pendentes_restantes = (
            supabase.table("imoveis_caixa")
            .select("id", count="exact")
            .eq("wp_publicado", False)
            .execute()
        ).count or 0

        log(f"Proxima rodada em {PAUSA_ENTRE_LOTES // 60} min | Pendentes restantes: {pendentes_restantes}")
        time.sleep(PAUSA_ENTRE_LOTES)


if __name__ == "__main__":
    main()
