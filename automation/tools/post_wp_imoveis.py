import os
import sys
import time
import unicodedata
import json
import re
import requests
import urllib.parse
from datetime import datetime
from dotenv import load_dotenv
from requests.auth import HTTPBasicAuth
from supabase import create_client, Client

sys.stdout.reconfigure(encoding='utf-8')
load_dotenv()

WP_URL = os.getenv("WP_URL")
WP_USERNAME = os.getenv("WP_USERNAME")
WP_APP_PASSWORD = os.getenv("WP_APP_PASSWORD")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Numero de imoveis a postar por execucao (evita timeout / banimento)
LOTE_POSTAGEM = 1
# Pausa em segundos entre cada post (respeita o servidor)
PAUSA_ENTRE_POSTS = 1.5
# Caminho da Imagem Destaque
IMAGEM_LOCAL_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ImagemDestaque.jpg")



# ────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────

def slugify(texto: str) -> str:
    """Gera slug SEO-friendly a partir de um texto."""
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


def inferir_tipo_imovel(descricao: str) -> str:
    """Infere tipo de imóvel a partir da descrição."""
    descricao = (descricao or "").lower()
    if "apartamento" in descricao:
        return "Apartamento"
    if "casa" in descricao:
        return "Casa"
    if "terreno" in descricao or "lote" in descricao:
        return "Terreno"
    if "comercial" in descricao or "sala" in descricao or "loja" in descricao:
        return "Imovel Comercial"
    if "rural" in descricao or "chacara" in descricao or "fazenda" in descricao:
        return "Imovel Rural"
    return "Imovel"


def gerar_titulo(imovel: dict) -> str:
    tipo = inferir_tipo_imovel(imovel.get("descricao", ""))
    bairro = imovel.get("bairro") or ""
    cidade = imovel.get("cidade") or ""
    uf = imovel.get("uf") or ""
    numero = imovel.get("numero_imovel") or ""
    return f"Imovel a Venda - {bairro} {cidade} {uf} - {numero}".strip()


def gerar_keyword_seo(imovel: dict) -> str:
    """Gera a palavra chave exata: Tipo do imóvel + Bairro + Cidade + UF + Número"""
    tipo = inferir_tipo_imovel(imovel.get("descricao", ""))
    bairro = imovel.get("bairro") or ""
    cidade = imovel.get("cidade") or ""
    uf = imovel.get("uf") or ""
    numero = imovel.get("numero_imovel") or ""
    return f"{tipo} {bairro} {cidade} {uf} {numero}".strip()

def gerar_titulo_seo(imovel: dict) -> str:
    """Título com emoji para aparecer no Google."""
    return f"🔴 {gerar_keyword_seo(imovel)}".replace("  ", " ")

def gerar_descricao_meta(imovel: dict) -> str:
    """Descricao do post que vai junto ao compartilhamento."""
    keyword = gerar_keyword_seo(imovel).replace("  ", " ")
    desconto_rs = formatar_real(imovel.get("desconto_rs", 0))
    return f"{keyword}. Aproveite o desconto de {desconto_rs}. Clique Aqui para mais informacoes."


def gerar_conteudo_html(imovel: dict, titulo_seo: str) -> str:
    """Gera o HTML completo da página do imóvel."""
    numero = imovel.get("numero_imovel", "")
    uf = imovel.get("uf", "")
    cidade = imovel.get("cidade", "")
    bairro = imovel.get("bairro", "")
    endereco = imovel.get("endereco", "")
    endereco_completo = f"{endereco}, {bairro}, {cidade} - {uf}"
    preco = formatar_real(imovel.get("preco_venda", 0))
    avaliacao = formatar_real(imovel.get("valor_avaliacao", 0))
    desconto_pct = imovel.get("desconto_percentual", 0)
    desconto_rs = formatar_real(imovel.get("desconto_rs", 0))
    descricao = imovel.get("descricao") or "Nao informado"
    modalidade = imovel.get("modalidade_venda") or "Nao informado"
    link_caixa = imovel.get("link_acesso") or f"https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnimovel={numero}"
    imagem = imovel.get("imagem_padrao") or f"https://venda-imoveis.caixa.gov.br/fotos/F{numero}21.jpg"
    financiamento = "Sim" if imovel.get("aceita_financiamento") else "Nao"
    tipo = inferir_tipo_imovel(descricao)

    whatsapp_number = "5521997882950"
    msg_whatsapp = f". 📌 Olá! Tenho interesse no imóvel da Caixa *{numero}* localizado em *{bairro}* - *{cidade}-{uf}*"
    link_whatsapp = f"https://api.whatsapp.com/send?phone={whatsapp_number}&text={urllib.parse.quote(msg_whatsapp)}"
    img_banner = f"{WP_URL}/wp-content/plugins/imoveis-caixa-layout/assets/FaleComigo-WhatsApp.png"

    # H2: Tipo do imóvel + Bairro + Cidade + UF + Número do imóvel sendo vendido com (valor do desconto em reais). Saiba Mais
    h2_desc = f"{tipo} {bairro} {cidade} {uf} {numero} sendo vendido com {desconto_rs} de desconto. Saiba Mais".replace("  ", " ")
    
    # Gerar os caminhos das imagens da galeria (Bloco 2)
    slug = slugify(gerar_keyword_seo(imovel))
    base_img_path = f"https://imoveisdacaixa.com.br/antigravity/imagens/imoveis/{slug}/{slug}"

    html = f"""
<div class="caixa-single-container" style="display: flex; flex-wrap: wrap; gap: 30px; align-items: flex-start;">
    
    <!-- ESQUERDA: Conteúdo Principal -->
    <div class="caixa-single-main-content" style="flex: 1 1 60%; min-width: 300px;">
        <!-- BLOCO 1: Título -->
        <div class="caixa-single-title-box" style="text-align: left; margin-bottom: 20px;">
            <h1 style="font-size: 2.2em; margin: 0; color: var(--caixa-blue); font-weight: bold; line-height: 1.2;">
                {titulo_seo}
            </h1>
            <h2 style="font-size: 1.4em; margin: 10px 0 0 0; color: #555; font-weight: normal; line-height: 1.4;">
                {h2_desc}
            </h2>
        </div>

        <!-- BLOCO 2: Imagem Principal e Galeria -->
        <div class="caixa-single-gallery" style="width: 100%; display: flex; flex-direction: column; gap: 10px;">
            <div class="caixa-single-header-img" style="width: 100%; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                <img src="{base_img_path}.jpg" onerror="this.src='{imagem}'" alt="{titulo_seo}" style="width: 100%; display: block; object-fit: cover; max-height: 500px;" />
            </div>
            <!-- Thumbnails da Galeria (Opcionais) -->
            <div class="caixa-gallery-thumbs" style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 5px;">
                <img src="{base_img_path}-2.jpg" onerror="this.style.display='none'" alt="{titulo_seo} - Foto 2" style="height: 80px; border-radius: 6px; cursor: pointer; border: 1px solid #ddd;" />
                <img src="{base_img_path}-3.jpg" onerror="this.style.display='none'" alt="{titulo_seo} - Foto 3" style="height: 80px; border-radius: 6px; cursor: pointer; border: 1px solid #ddd;" />
                <img src="{base_img_path}-4.jpg" onerror="this.style.display='none'" alt="{titulo_seo} - Foto 4" style="height: 80px; border-radius: 6px; cursor: pointer; border: 1px solid #ddd;" />
            </div>
        </div>

        <!-- BLOCO 4: Atualização + Título + Endereço -->
        <div class="caixa-single-info-lines" style="margin-top: 20px; font-size: 1.05em; color: #444; line-height: 1.6;">
            <h2 style="display:none;">ATUALIZAÇÃO</h2>
            <p style="margin: 0;">Ultima atualização: {datetime.now().strftime('%d/%m/%Y %H:%M')}</p>
            <p style="margin: 0; text-transform: capitalize;">{tipo} em {bairro}, {cidade} - {uf}</p>
            <p style="margin: 0; color: #666; text-transform: lowercase;">{endereco}, {bairro} - cep: {imovel.get('cep', 'Nao informado')}, {cidade} - {uf}</p>
        </div>

        <!-- BLOCO 5: Sobre o Imóvel (H2) -->
        <div class="caixa-single-section" style="margin-top: 30px; background: #fff; border: 1px solid #e0e0e0; padding: 25px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
            <h2 style="display:none;">SOBRE O IMÓVEL</h2>
            <h3 style="color: var(--caixa-blue); border-bottom: 2px solid #F9B200; padding-bottom: 10px; margin-bottom: 20px; font-size: 1.5em; margin-top:0;">Sobre o Imóvel</h3>
            <table class="caixa-data-table" style="width: 100%; border-collapse: collapse; font-size: 1.05em; color: #444;">
                <tbody>
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 12px 0; font-weight: bold; width: 35%;">Modalidade de Venda:</td>
                        <td style="padding: 12px 0;">{modalidade}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 12px 0; font-weight: bold;">Tipo do imóvel / Quartos / Áreas:</td>
                        <td style="padding: 12px 0;">{tipo} | Quartos: {imovel.get('quartos', 'N/A')} | Área Privativa: {imovel.get('area_privativa', 'N/A')} m² | Área Total: {imovel.get('area_terreno', 'N/A')} m²</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 12px 0; font-weight: bold;">Descrição:</td>
                        <td style="padding: 12px 0; font-size: 0.95em; line-height: 1.6;">{descricao}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 12px 0; font-weight: bold;">Regras de Pagamento:</td>
                        <td style="padding: 12px 0; line-height: 1.6;">
                            Financiamento: <strong>{financiamento}</strong><br>
                            FGTS: <strong>{financiamento}</strong><br>
                            Consórcio: <strong>NÃO</strong>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 0; font-weight: bold;">Números do Imóvel:</td>
                        <td style="padding: 12px 0; font-size: 0.9em; line-height: 1.6;">
                            Número: <strong>{numero}</strong><br>
                            Matrícula: {imovel.get('matricula', 'N/A')}<br>
                            Inscrição imobiliária: {imovel.get('inscricao_imobiliaria', 'N/A')}<br>
                            Comarca: {imovel.get('comarca', 'N/A')} | Ofício: {imovel.get('oficio', 'N/A')}<br>
                            Averbação dos leilões negativos: {imovel.get('leiloes_negativos', 'N/A')}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- BLOCO 6: Investidores (Área Restrita / App no Plugin) -->
        <div id="caixa-investidores-app" data-imovel="{numero}">
            <!-- O Plugin imoveis-caixa-layout irá renderizar o botão e o formulário de captura aqui -->
        </div>

        <!-- BLOCO 7: Pagamentos (H2) -->
        <div class="caixa-single-section" style="margin-top: 30px; background: #fff; border: 1px solid #e0e0e0; padding: 25px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
            <h2 style="display:none;">PAGAMENTOS</h2>
            <h3 style="color: var(--caixa-blue); border-bottom: 2px solid #F9B200; padding-bottom: 10px; margin-bottom: 15px; font-size: 1.3em; margin-top:0;">Formas de Pagamento Aceitas</h3>
            <p style="margin: 0; color: #444; line-height: 1.6;">Recursos próprios. Permite financiamento - somente SBPE. Consulte condições antes de efetuar a proposta.</p>
        </div>

        <!-- BLOCO 8: Despesas (H2) -->
        <div class="caixa-single-section" style="margin-top: 30px; background: #fff; border: 1px solid #e0e0e0; padding: 25px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
            <h2 style="display:none;">DESPESAS</h2>
            <h3 style="color: var(--caixa-blue); border-bottom: 2px solid #F9B200; padding-bottom: 10px; margin-bottom: 15px; font-size: 1.3em; margin-top:0;">Regras para Pagamento das Despesas</h3>
            <span style="font-size: 0.85em; color: #888; display: block; margin-bottom: 10px;">(Caso existam)</span>
            <ul style="margin: 0; padding-left: 20px; color: #444; line-height: 1.6;">
                <li style="margin-bottom: 10px;"><strong>Condomínio:</strong> Sob responsabilidade do comprador, até o limite de 10% em relação ao valor de avaliação do imóvel. A CAIXA realizará o pagamento apenas do valor que exceder o limite de 10% do valor de avaliação.</li>
                <li><strong>Tributos:</strong> Sob responsabilidade do comprador.</li>
            </ul>
        </div>

        <!-- BLOCO 9: Adicionais (H2) -->
        <div class="caixa-single-section" style="margin-top: 30px; background: #fff; border: 1px solid #e0e0e0; padding: 25px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
            <h2 style="display:none;">ADICIONAIS</h2>
            <h3 style="color: var(--caixa-blue); border-bottom: 2px solid #F9B200; padding-bottom: 10px; margin-bottom: 15px; font-size: 1.3em; margin-top:0;">Informações Adicionais</h3>
            <p style="margin: 0; color: #444; line-height: 1.6;">Imóvel com gravame/penhora/indisponibilidade averbada na matrícula. Regularização por conta do adquirente.</p>
        </div>

        <!-- BLOCO 10: Dúvidas Frequentes (H2 - Sanfona) -->
        <div class="caixa-single-section" style="margin-top: 40px; background: #fff; border: 1px solid #e0e0e0; padding: 25px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
            <h2 style="color: var(--caixa-blue, #005CA9); text-align: left; margin-top: 0; margin-bottom: 25px; font-size: 1.5em; border-bottom: 2px solid #F9B200; padding-bottom: 10px;">Dúvidas Frequentes</h2>
            
            <div class="caixa-faq-accordion" style="display: flex; flex-direction: column; gap: 10px;">
                <!-- Dúvida 1 -->
                <details style="background: #fafafa; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; transition: all 0.3s ease;">
                    <summary style="padding: 15px 20px; font-weight: bold; color: #333; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid var(--caixa-orange, #F9B200);">
                        <span>O segredo para ser barato</span>
                    </summary>
                    <div style="padding: 15px 20px; background: #fff; color: #555; line-height: 1.6; border-top: 1px solid #eee; font-size: 0.95em;">
                        <strong>Qual o segredo para os Imóveis da Caixa serem tão baratos?</strong><br>
                        Os imóveis da caixa já estiveram na posse de quem fez a compra financiada, mas quem sempre teve a propriedade do imóvel foi a Caixa. O imóvel só é do comprador depois que o financiamento é quitado. Como alguém já pagou parte do preço deste imóvel e o banco não tem o interesse de ficar com este patrimônio, o banco vende este imóvel com preços e condições muito atraentes.<br>
                        Estes imóveis um dia já foram vendidos para pessoas que já pagaram uma parte do valor desse imóvel, pagaram uma entrada e algumas prestações, só não pagaram todas as prestações até o final; Por algum motivo deixaram de pagar o financiamento, por isso a CAIXA precisou retomar este imóvel para poder recuperar o valor da dívida deixada pelo comprador. Esse procedimento é realizado de acordo com a lei de alienação fiduciária e não está vinculado a nenhum processo judicial, aqui estamos falando em leilão extrajudicial e por isso é muito mais simples, prático e direto que os leilões judiciais.
                    </div>
                </details>

                <!-- Dúvida 2 -->
                <details style="background: #fafafa; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                    <summary style="padding: 15px 20px; font-weight: bold; color: #333; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid var(--caixa-orange, #F9B200);">
                        <span>Imóveis Adjudicados</span>
                    </summary>
                    <div style="padding: 15px 20px; background: #fff; color: #555; line-height: 1.6; border-top: 1px solid #eee; font-size: 0.95em;">
                        <strong>Porque os Imóveis da Caixa são chamados de imóveis adjudicados?</strong><br>
                        Os imóveis que não foram vendidos no leilão, são adjudicados, ou seja, é decidido judicialmente que o imóvel pertence a Caixa e por isso estes imóveis são vendidos pelas modalidades de venda que a CAIXA preferir, cada modalidade tem suas características e por isso devemos prestar atenção em cada detalhe da modalidade escolhida para a venda do imóvel que você deseja comprar.<br>
                        A origem dos imóveis da caixa está na cobrança da dívida de um financiamento imobiliário que não foi pago por quem realizou o financiamento bancário. Este procedimento é regulado pela lei de alienação fiduciária o que facilita todo o processo de venda e de tomada de posse.
                    </div>
                </details>

                <!-- Dúvida 3 -->
                <details style="background: #fafafa; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                    <summary style="padding: 15px 20px; font-weight: bold; color: #333; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid var(--caixa-orange, #F9B200);">
                        <span>Diversos benefícios e Ofertas Exclusivas</span>
                    </summary>
                    <div style="padding: 15px 20px; background: #fff; color: #555; line-height: 1.6; border-top: 1px solid #eee; font-size: 0.95em;">
                        <strong>Porque os Imóveis da Caixa tem tantos benefícios?</strong><br>
                        O banco prefere ter o dinheiro livre para fazer empréstimos e outras aplicações do que ficar com o dinheiro aplicado em imóveis, por isso ele oferece descontos agressivos para realizar a venda. A comercialização desses imóveis, mesmo com tantos descontos, é que garantem uma taxa de juros mais baixa nos financiamentos imobiliários, uma vez que o imóvel é a garantia do banco em receber o dinheiro emprestado.<br>
                        <strong>Ofertas Exclusivas:</strong> Somente os Imóveis da Caixa podem ser vendidos com as condições que a CAIXA oferece; Destacam-se os 5% de entrada, descontos extraordinários que chegam em até 94%; e o pagamento integral das dívidas em muitos imóveis disponíveis para venda. 
                    </div>
                </details>

                <!-- Dúvida 4 -->
                <details style="background: #fafafa; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                    <summary style="padding: 15px 20px; font-weight: bold; color: #333; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid var(--caixa-orange, #F9B200);">
                        <span>Comissão de venda</span>
                    </summary>
                    <div style="padding: 15px 20px; background: #fff; color: #555; line-height: 1.6; border-top: 1px solid #eee; font-size: 0.95em;">
                        <strong>Quanto é a comissão de venda dos Imóveis da Caixa?</strong><br>
                        Para a venda direta você não paga nenhuma comissão de venda. A Caixa fornece um serviço gratuito de assessoramento. A comissão da imobiliária credenciada é paga integralmente pela própria CAIXA, ou seja, suporte profissional com custo zero para o comprador final na intermediação.
                    </div>
                </details>

                <!-- Dúvida 5 -->
                <details style="background: #fafafa; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                    <summary style="padding: 15px 20px; font-weight: bold; color: #333; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid var(--caixa-orange, #F9B200);">
                        <span>Formas de Pagamento</span>
                    </summary>
                    <div style="padding: 15px 20px; background: #fff; color: #555; line-height: 1.6; border-top: 1px solid #eee; font-size: 0.95em;">
                        <strong>À Vista:</strong> Pagamento total do Preço de Venda através de boleto bancário da Caixa, em até 3 dias úteis.<br>
                        <strong>Com utilização de FGTS:</strong> O Comprador deve informar o valor do saque na Proposta de Compra, pagando o valor restante via boleto (mínimo de 5% garantidos em dinheiro).<br>
                        <strong>Com Financiamento (Somente SBPE):</strong> Se o imóvel permitir o financiamento, pode-se financiar parte do valor. Exige o pagamento de sinal mínimo (5% do preço alvo) em 3 dias via boleto bancário. A contratação do financiamento requer aprovação prévia de crédito nas agências da Caixa.
                    </div>
                </details>

                <!-- Dúvida 6 -->
                <details style="background: #fafafa; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                    <summary style="padding: 15px 20px; font-weight: bold; color: #333; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid var(--caixa-orange, #F9B200);">
                        <span>Condomínio e IPTU atrasados</span>
                    </summary>
                    <div style="padding: 15px 20px; background: #fff; color: #555; line-height: 1.6; border-top: 1px solid #eee; font-size: 0.95em;">
                        Na ampla maioria das modalidades, a CAIXA quitará integralmente as pendências anteriores de IPTU ou Tributos após o registro do imóvel pelo adquirente.<br>
                        <strong>Condomínio:</strong> Nos editais de venda online, a responsabilidade do comprador limita-se em assumir pendências até 10% do valor de avaliação do bem. Caso existam dívidas que superem o percentual, a CAIXA assegura e arca com a diferença superior aos 10%. Recomendável sempre verificar o edital de concorrência ou consultar nosso despachante.
                    </div>
                </details>
            </div>
        </div>


        <!-- BLOCO 11: Localização (H2 em 2 Colunas) -->
        <div class="caixa-single-section" style="margin-top: 40px; background: #fff; border: 1px solid #e0e0e0; padding: 25px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
            <h2 style="color: var(--caixa-blue, #005CA9); text-align: left; margin-top: 0; margin-bottom: 25px; font-size: 1.5em; border-bottom: 2px solid #F9B200; padding-bottom: 10px;">Localização</h2>
            
            <div style="display: flex; flex-wrap: wrap; gap: 20px;">
                <!-- Coluna Esquerda: Dados do Endereço -->
                <div style="flex: 1 1 45%; min-width: 250px;">
                    <strong style="color: #666; font-size: 0.9em; text-transform: uppercase;">Endereço:</strong><br>
                    <span style="color: #333; font-size: 1.1em; margin-bottom: 15px; display: block;">{endereco_completo}</span>
                    
                    <strong style="color: #666; font-size: 0.9em; text-transform: uppercase;">Bairro:</strong><br>
                    <span style="color: #333; font-size: 1.1em; margin-bottom: 15px; display: block; text-transform: capitalize;">{bairro}</span>
                    
                    <div style="display: flex; gap: 20px; margin-bottom: 20px;">
                        <div>
                            <strong style="color: #666; font-size: 0.9em; text-transform: uppercase;">Cidade:</strong><br>
                            <span style="color: #333; font-size: 1.1em; text-transform: capitalize;">{cidade}</span>
                        </div>
                        <div>
                            <strong style="color: #666; font-size: 0.9em; text-transform: uppercase;">Estado:</strong><br>
                            <span style="color: #333; font-size: 1.1em; text-transform: uppercase;">{uf}</span>
                        </div>
                    </div>

                    <a href="https://www.google.com/maps/search/?api=1&query={urllib.parse.quote(endereco_completo)}" target="_blank" rel="noopener" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: #d32f2f; color: #fff; padding: 12px 25px; border-radius: 8px; font-weight: bold; text-decoration: none; font-size: 1em; transition: background 0.3s;">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                        Ver no Google Maps
                    </a>
                </div>

                <!-- Coluna Direita: Mapa / Imagem Linkada -->
                <div style="flex: 1 1 45%; min-width: 250px; display: flex; align-items: center; justify-content: center;">
                    <a href="https://www.google.com/maps/search/?api=1&query={urllib.parse.quote(endereco_completo)}" target="_blank" rel="noopener" style="display: block; width: 100%;">
                        <!-- O usuário irá fornecer a imagem em /wp-content/uploads/mapa-placeholder.jpg depois, ou podemos definir um banner centralizado aqui -->
                        <div style="background: url('https://achaimoveis.net/padrao/mapa-caixa-placeholder.jpg') center/cover no-repeat; width: 100%; height: 250px; border-radius: 12px; border: 2px solid #e0e0e0; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                            <div style="background: rgba(255,255,255,0.9); padding: 10px 20px; border-radius: 30px; font-weight: bold; color: #005CA9; box-shadow: 0 4px 10px rgba(0,0,0,0.1); display: flex; align-items: center; gap: 8px;">
                                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                                Clique para abrir o GPS
                            </div>
                        </div>
                    </a>
                </div>
            </div>
        </div>

        <!-- BLOCO 12: Formulário de Contato (H2) -->
        <div class="caixa-single-section" style="margin-top: 40px; background: #fff; border: 1px solid #e0e0e0; padding: 25px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.03);" id="contato-form">
            <h2 style="color: var(--caixa-blue, #005CA9); text-align: left; margin-top: 0; margin-bottom: 5px; font-size: 1.5em;">Fale com um Especialista</h2>
            <p style="color: #666; margin-bottom: 25px; font-size: 0.95em;">Preencha os dados abaixo e entraremos em contato o mais rápido possível sobre este imóvel.</p>
            
            <form id="caixa-form-contato" onsubmit="event.preventDefault(); enviarContatoCaixa(this);" data-imovel="{numero}" style="display: flex; flex-direction: column; gap: 15px;">
                <input type="text" name="nome" placeholder="Nome Completo*" required style="padding: 12px; border: 1px solid #ccc; border-radius: 6px; width: 100%; box-sizing: border-box; font-family: inherit;">
                
                <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                    <input type="email" name="email" placeholder="E-mail*" required style="flex: 1 1 45%; padding: 12px; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box; font-family: inherit;">
                    <input type="tel" name="whatsapp" placeholder="WhatsApp / Telefone*" required style="flex: 1 1 45%; padding: 12px; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box; font-family: inherit;">
                </div>
                
                <textarea name="mensagem" placeholder="Sua Mensagem" rows="4" style="padding: 12px; border: 1px solid #ccc; border-radius: 6px; width: 100%; box-sizing: border-box; font-family: inherit; resize: vertical;">Olá, gostaria de mais informações sobre o imóvel {tipo} em {bairro}, {cidade}.</textarea>
                
                <button type="submit" id="btn-enviar-contato" style="background: var(--caixa-orange, #F9B200); color: #fff; border: none; padding: 15px; font-size: 1.1em; font-weight: bold; border-radius: 6px; cursor: pointer; transition: background 0.3s; margin-top: 10px;">Enviar Mensagem</button>
                <p id="contato-msg-erro" style="color: #d32f2f; display: none; margin: 0; font-size: 0.9em; font-weight: bold;"></p>
            </form>
            
            <script>
            function enviarContatoCaixa(form) {{
                var btn = form.querySelector('#btn-enviar-contato');
                var erro = form.querySelector('#contato-msg-erro');
                btn.innerText = 'Enviando...';
                btn.disabled = true;
                erro.style.display = 'none';
                
                var data = {{
                    nome: form.nome.value,
                    email: form.email.value,
                    whatsapp: form.whatsapp.value,
                    mensagem: form.mensagem.value,
                    imovel_id: "{numero}",
                    post_id: window.location.href
                }};
                
                fetch('/wp-json/imoveis-caixa/v1/contatar', {{
                    method: 'POST',
                    headers: {{'Content-Type': 'application/json'}},
                    body: JSON.stringify(data)
                }})
                .then(r => r.json())
                .then(res => {{
                    if(res.success) {{
                        window.location.href = '/cadastro-confirmado/';
                    }} else {{
                        erro.innerText = 'Erro ao enviar. Tente novamente mais tarde.';
                        erro.style.display = 'block';
                        btn.innerText = 'Enviar Mensagem';
                        btn.disabled = false;
                    }}
                }})
                .catch(e => {{
                    erro.innerText = 'Erro de conexão. Verifique sua internet.';
                    erro.style.display = 'block';
                    btn.innerText = 'Enviar Mensagem';
                    btn.disabled = false;
                }});
            }}
            </script>
        </div>

        <!-- BLOCO 13: Imóveis Semelhantes (H2) -->
        <div class="caixa-single-section" style="margin-top: 50px;">
            <h2 style="color: var(--caixa-blue, #005CA9); text-align: left; margin-top: 0; margin-bottom: 25px; font-size: 1.5em; border-bottom: 2px solid #F9B200; padding-bottom: 10px;">Imóveis Semelhantes na Região</h2>
            [imoveis_caixa_semelhantes tipo="{tipo}" bairro="{bairro}" preco="{preco}"]
        </div>

        <!-- BLOCO 14: Histórico de Evolução de Preços / Condições (H2) -->
        <div class="caixa-single-section" style="margin-top: 50px;">
            <h2 style="color: var(--caixa-blue, #005CA9); text-align: left; margin-top: 0; margin-bottom: 25px; font-size: 1.5em; border-bottom: 2px solid #F9B200; padding-bottom: 10px;">Histórico do Imóvel</h2>
            [imoveis_caixa_historico]
        </div>

        <!-- Botao / Banner WhatsApp com tracking nativo WP -->
        <div style="margin-top: 40px;">
            <a href="{link_whatsapp}" target="_blank" rel="noopener" class="banner-whatsapp-tracking">
                <img src="{img_banner}" alt="Fale com nosso consultor" style="width:100%; max-width:600px; display:block; margin: 20px auto; border-radius:12px; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'"/>
            </a>
        </div>
    </div> <!-- /ESQUERDA -->

    <!-- DIREITA: Sidebar / Quadro de Informações -->
    <div class="caixa-single-sidebar" style="flex: 1 1 30%; min-width: 300px; position: sticky; top: 20px;">
        <div class="caixa-info-box" style="background: #fff; border: 1px solid #e0e0e0; border-radius: 12px; padding: 25px; box-shadow: 0 8px 20px rgba(0,0,0,0.05);">
            
            <h2 style="display:none;">LUCRO</h2> <!-- Marcador invisível para hierarquia de conteúdo -->
            
            <!-- Lucro Imobiliário (Destaque Máximo) -->
            <div style="text-align: center; background: #e8f5e9; border: 2px dashed #4caf50; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="margin: 0; font-size: 1.1em; font-weight: bold; color: #2e7d32; text-transform: uppercase; letter-spacing: 1px;">💰 Lucro Imobiliário</h3>
                <p style="margin: 5px 0 0 0; font-size: 1.8em; font-weight: 900; color: #1b5e20;">{desconto_rs}</p>
            </div>

            <!-- Valores -->
            <div style="margin-bottom: 25px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px dotted #ccc; padding-bottom: 8px;">
                    <h3 style="margin: 0; color: #666; font-size: 1em; font-weight: normal;">Valor da avaliação:</h3>
                    <span style="font-weight: bold; color: #333; text-decoration: line-through;">{avaliacao}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px dotted #ccc; padding-bottom: 8px;">
                    <h3 style="margin: 0; color: #666; font-size: 1em; font-weight: normal;">Valor mínimo:</h3>
                    <span style="font-weight: bold; color: var(--caixa-blue, #005CA9); font-size: 1.2em;">{preco}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 5px;">
                    <h3 style="margin: 0; color: #666; font-size: 1em; font-weight: normal;">Desconto de:</h3>
                    <span style="font-weight: bold; color: #e53935; font-size: 1.1em;">{desconto_pct}%</span>
                </div>
            </div>

            <!-- Botões de Ação -->
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <!-- Tenho Interesse (Scroll para form ou âncora) -->
                <a href="#contato-form" style="display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--caixa-orange, #F9B200); color: #fff; padding: 14px; border-radius: 8px; font-weight: bold; text-decoration: none; font-size: 1.1em; transition: background 0.3s; text-align: center;">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                    Tenho interesse
                </a>
                
                <!-- Compartilhar -->
                <button onclick="if(navigator.share){{ navigator.share({{title: document.title, url: window.location.href}}); }} else {{ prompt('Copie o link abaixo e compartilhe:', window.location.href); }}" style="display: flex; align-items: center; justify-content: center; gap: 8px; background: #f0f0f0; color: #333; padding: 12px; border-radius: 8px; font-weight: bold; border: 1px solid #ddd; cursor: pointer; font-size: 1em; width: 100%; transition: background 0.3s;">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>
                    Compartilhar
                </button>
                
                <!-- WhatsApp -->
                <a href="{link_whatsapp}" target="_blank" rel="noopener" style="display: flex; align-items: center; justify-content: center; gap: 8px; background: #25D366; color: #fff; padding: 12px; border-radius: 8px; font-weight: bold; text-decoration: none; font-size: 1.1em; transition: background 0.3s; text-align: center;">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.274.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824z"/></svg>
                    WhatsApp
                </a>
            </div>
        </div>
    </div> <!-- /DIREITA -->
</div> <!-- /CONTAINER -->
"""
    return html.strip()


# ────────────────────────────────────────────────────────────────
# WordPress API
# ────────────────────────────────────────────────────────────────

CATEGORIAS_CACHE = {}

def obter_ou_criar_categoria(session: requests.Session, nome: str):
    if not nome:
        return None
    if nome in CATEGORIAS_CACHE:
        return CATEGORIAS_CACHE[nome]
    
    url = f"{WP_URL}/wp-json/wp/v2/categories"
    try:
        r_list = session.get(f"{url}?search={urllib.parse.quote(nome)}")
        if r_list.status_code == 200:
            cats = r_list.json()
            for c in cats:
                if c.get("name", "").lower() == nome.lower():
                    CATEGORIAS_CACHE[nome] = c["id"]
                    return c["id"]
        
        r_post = session.post(url, json={"name": nome})
        if r_post.status_code in (200, 201):
            novo_id = r_post.json()["id"]
            CATEGORIAS_CACHE[nome] = novo_id
            return novo_id
    except Exception as e:
        print(f"Erro ao tratar categoria {nome}: {e}")
    return None

def upload_media_wp(session: requests.Session, filepath: str, filename: str) -> int:
    """Faz upload de uma imagem pro WP e retorna o id do media."""
    endpoint = f"{WP_URL}/wp-json/wp/v2/media"
    
    try:
        with open(filepath, "rb") as f:
            file_data = f.read()

        headers = {
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Type": "image/jpeg"
        }
        
        # Cria uma nova session temporária para não mandar `Content-Type: application/json`
        s = requests.Session()
        s.auth = session.auth
        
        res = s.post(endpoint, headers=headers, data=file_data, timeout=30)
        if res.status_code in (200, 201):
            return res.json().get("id")
        else:
            print(f"[ERRO WP MEDIA] {res.text[:150]}")
            return None
    except Exception as e:
        print(f"[ERRO UPLOAD] {e}")
        return None

def obter_post_existente(slug: str, session: requests.Session) -> dict:
    """Consulta a API do WP para verificar se já existe um post com esse slug e retorna os dados dele."""
    url = f"{WP_URL}/wp-json/wp/v2/posts?slug={slug}&_fields=id,meta"
    try:
        res = session.get(url, timeout=15)
        if res.status_code == 200:
            posts = res.json()
            if len(posts) > 0:
                p = posts[0]
                return {
                    "id": p.get("id"),
                    "historico_str": p.get("meta", {}).get("caixa_log_historico", "")
                }
    except Exception as e:
        print(f"[ERRO BUSCA GET WP] {e}")
    return None


def post_para_wp(imovel: dict, session: requests.Session) -> dict:
    """Cria ou atualiza uma página/post no WordPress e retorna {id, url}."""
    titulo_seo = gerar_titulo_seo(imovel)
    numero = imovel.get("numero_imovel", "")
    data_geracao = imovel.get("data_geracao", str(datetime.today().date()))
    
    # Extrair informacoes para as keywords e tags
    tipo = inferir_tipo_imovel(imovel.get("descricao", ""))
    bairro = imovel.get("bairro") or ""
    cidade = imovel.get("cidade") or ""
    
    # Criar um slug limpo para o link permanente (bairro-cidade-uf-numero)
    keyword_base_slug = slugify(gerar_keyword_seo(imovel))
    slug = keyword_base_slug
    
    # Gerar HTML e Meta Description
    conteudo = gerar_conteudo_html(imovel, titulo_seo)
    meta_desc = gerar_descricao_meta(imovel)

    # Calcular o lucro (desconto) para mandar no meta
    preco_v = float(imovel.get("preco_venda", 0))
    aval_v = float(imovel.get("valor_avaliacao", 0))
    desconto_valor = max(0.0, aval_v - preco_v)
    lucro_rs = formatar_real(desconto_valor)

    # Lógica de Upload da Imagem Destaque
    media_id = None
    if os.path.exists(IMAGEM_LOCAL_PATH):
        media_filename = f"{keyword_base_slug}.jpg"
        media_id = upload_media_wp(session, IMAGEM_LOCAL_PATH, media_filename)

    # ---------------- HISTÓRICO DE VALORES ----------------
    # Verificar a existência do POST para atualizar ou criar
    post_existente = obter_post_existente(slug, session)
    
    # Monta a Fotografia Limpa (a linha do tempo de Hoje)
    financiamento_str = "SIM" if imovel.get("aceita_financiamento") else "NÃO"
    
    # Duelo do FGTS: A API Caixa ou CSV pode não mandar sempre explícito. O default nas regras é tentar usar recursos
    # No CSV "recursos proprios. FGTS". Vamos extrair da descrição ou padronizar baseado no texto
    desc_f = str(imovel.get("descricao", "")).upper()
    fgts_str = "SIM" if "FGTS" in desc_f or "NÃO ACEITA FGTS" not in desc_f else "NÃO"

    linha_atual = {
        "data": data_geracao,
        "valor": str(preco_v),
        "financiamento": financiamento_str,
        "fgts": fgts_str,
        "desconto": str(desconto_valor)
    }

    historico = []
    if post_existente and post_existente.get("historico_str"):
        try:
            historico = json.loads(post_existente["historico_str"])
        except:
            historico = []
            
    # Adicionar a linha atual SOMENTE se o histórico está vazio ou se houveram MUDANÇAS de Relevância
    adicionar_linha = False
    if not historico:
        adicionar_linha = True
    else:
        # Pega a linha mais recente
        ultima_linha = historico[0]
        # Se os dados financeiros divergirem minimamente, é uma nova atualização digna do histórico!
        if (str(ultima_linha.get('valor')) != linha_atual['valor'] or 
            ultima_linha.get('financiamento') != linha_atual['financiamento'] or 
            ultima_linha.get('fgts') != linha_atual['fgts'] or 
            str(ultima_linha.get('desconto')) != linha_atual['desconto']):
            # Bateu diferença? Checa se não foi no mesmo dia só pra não duplicar logs
            if ultima_linha.get('data') != linha_atual['data']:
                adicionar_linha = True

    if adicionar_linha:
        historico.insert(0, linha_atual) # Adiciona no topo da lista (mais recente primeiro)
        # Limita o histórico as últimas 10 alterações para não pesar o DB com lixo
        historico = historico[:10]

    historico_json = json.dumps(historico, ensure_ascii=False)

    # ---------------- CATEGORIAS DE IMOVEIS ----------------
    cat_tipo_id = obter_ou_criar_categoria(session, tipo)
    cat_root_id = obter_ou_criar_categoria(session, "Imóveis Retomados")
    cats = [c for c in [cat_tipo_id, cat_root_id] if c is not None]

    payload = {
        "title": titulo_seo,
        "content": conteudo,
        "slug": slug,
        "status": "publish",
        "excerpt": meta_desc,
        "categories": cats,
        "meta": {
            "caixa_preco_venda": formatar_real(preco_v),
            "caixa_preco_venda_val": str(preco_v),
            "caixa_valor_avaliacao": formatar_real(aval_v),
            "caixa_valor_avaliacao_val": str(aval_v),
            "caixa_desconto_pct": str(imovel.get("desconto_percentual", 0)),
            "caixa_lucro_rs": lucro_rs,
            "caixa_cidade": cidade,
            "caixa_uf": imovel.get("uf", ""),
            "caixa_bairro": bairro,
            "caixa_modalidade": imovel.get("modalidade_venda", ""),
            "caixa_financiamento": "Sim" if imovel.get("aceita_financiamento") else "Não",
            "caixa_tipo": tipo,
            "caixa_quartos": str(imovel.get("quartos", "")),
            "caixa_log_historico": historico_json,
            "rank_math_title": titulo_seo,
            "rank_math_description": meta_desc,
            "rank_math_focus_keyword": f"{tipo} à venda {bairro} {cidade}",
        },
    }
    
    if media_id:
        payload["featured_media"] = media_id

    # POST vs DUALITY (Update)
    # Se existir, aponta para a rota com ID
    endpoint = f"{WP_URL}/wp-json/wp/v2/posts"
    if post_existente and post_existente.get("id"):
        endpoint = f"{WP_URL}/wp-json/wp/v2/posts/{post_existente['id']}"

    response = session.post(endpoint, json=payload, timeout=20)

    if response.status_code in (200, 201):
        data = response.json()
        return {"id": data["id"], "url": data["link"], "sucesso": True}
    else:
        return {"id": None, "url": None, "sucesso": False, "erro": response.text[:300]}

# ────────────────────────────────────────────────────────────────
# Main
# ────────────────────────────────────────────────────────────────

def main():
    if not all([WP_URL, WP_USERNAME, WP_APP_PASSWORD, SUPABASE_URL, SUPABASE_KEY]):
        print("[ERRO] Variaveis de ambiente incompletas no .env")
        return

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("[OK] Conexao com Supabase estabelecida.")

    # Sessao HTTP autenticada para o WordPress e cache de conexao
    session = requests.Session()
    session.auth = HTTPBasicAuth(WP_USERNAME, WP_APP_PASSWORD)
    session.headers.update({"Content-Type": "application/json"})

    while True:
        # Busca imóveis ainda não postados
        resultado = (
            supabase.table("imoveis_caixa")
            .select("*")
            .eq("wp_publicado", False)
            .is_("wp_post_id", "null")
            .limit(LOTE_POSTAGEM)
            .execute()
        )

        imoveis = resultado.data
        if not imoveis:
            print("[INFO] Nenhum imovel pendente de postagem encontrado. Banco zerado e atualizado!")
            break

        print(f"\n[NOVO LOTE] {len(imoveis)} imoveis puxados para postagem.")

        ok = 0
        erros = 0

        for idx, imovel in enumerate(imoveis, 1):
            numero = imovel.get("numero_imovel", "?")
            try:
                res = post_para_wp(imovel, session)
                
                if res["sucesso"]:
                    supabase.table("imoveis_caixa").update({
                        "wp_post_id":  res["id"],
                        "wp_post_url": res["url"],
                        "wp_publicado": True,
                    }).eq("id", imovel["id"]).execute()

                    print(f"  [{idx:04d}] [OK] {numero} -> {res['url']}")
                    ok += 1
                else:
                    print(f"  [{idx:04d}] [ERRO] {numero}: {res.get('erro', '?')}")
                    erros += 1

            except Exception as e:
                print(f"  [{idx:04d}] [EXCECAO] {numero}: {str(e)[:150]}")
                erros += 1

            time.sleep(PAUSA_ENTRE_POSTS)
            
        print(f"> Lote concluido: Sucessos = {ok} | Erros = {erros}")
        print("Finalizando piloto unitário a pedido do usuário...")
        break

if __name__ == "__main__":
    main()
