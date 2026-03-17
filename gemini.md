# Constituição do Projeto: app-imoveis-caixa

## 1. Visão Geral e Estrela Guia
O resultado desejado é um aplicativo gerador de páginas web totalmente responsivas (no WordPress), criadas para apresentar oportunidades de imóveis à venda (dados originados da Caixa Econômica Federal). 
**Foco principal de conversão:**
- Clique no botão flutuante/fixo de WhatsApp, informando ao atendente o *Número do Imóvel*.
- Formulário de contato como alternativa (também capturando o *Número do Imóvel*).
- Máxima otimização SEO para rankeamento orgânico.

## 2. Esquemas de Dados (Data Schema)

### 2.1 Fonte da Verdade (Entrada)
A fonte primária é um upload de arquivo `.csv` localizado na pasta `csv_caixa`. *Nota: o arquivo deve ser deletado após processado.*
**Campos do CSV esperado:**
- Data de geração
- Número do imóvel (Chave Secundária/Identificador Único por Imóvel, porém o histórico deve mapear por Data de Geração + Número do Imóvel)
- UF, Cidade, Bairro, Endereço
- Preço (Valor de Venda)
- Valor de avaliação
- Desconto
- Financiamento
- Descrição
- Modalidade de venda
- Link de acesso

### 2.2 Estrutura do Banco de Dados (Supabase)
O Supabase atuará como o banco central (`imoveis_caixa`).

**Limpeza Inicial (Regras de Ingestão):**
- Descartar se `Desconto < 30%`.
- Descartar se `Modalidade de venda` for diferente de `Venda Direta Online` e `Venda Online`.

**Campos Calculados/Criados Diretamente (Enriquecimento):**
- `Desconto_R$` = `Valor_de_Avaliacao` - `Preco_de_Venda`
- `Tags_Destaque` (Regras de Negócio):
  - +1 Selo: Valor de Desconto em R$ > 100.000,00
  - +2 Selos: Desconto > 50%
  - +3 Selos: Desconto > 70%
  - Super Destaque: Desconto > 70% E aceita financiamento
- `Imagem_Padrao`: `https://venda-imoveis.caixa.gov.br/fotos/F[NUMERO_DO_IMOVEL]21.jpg`
- `Saldo_Devedor_Atualizado`, `Valor_Venda_Acelerada`, `Previsao_Lucro` (baseados em cálculos de entrada e amortização)

**Criação Indireta (Tabela de Referência `.xlsx` do Supabase):**
Cruzamento com uma tabela base para calcular estimativas:
- **Obrigatórias:** Valor de Entrada, Prestação, Registro do Imóvel.
- **Possíveis:** Condomínio, Desocupação, IPTU.
- **Opcionais:** Reforma, Despachante.
- **Economia:** Leiloeiro, Corretagem.
- **Investimento:** Manutenção, Prazo de venda, Desconto Aceleração, Despesa Venda.

### 2.3 Payload de Entrega (Saída)
- Criação e postagem de páginas dinâmicas no WordPress (através de integrações) seguindo regras de conteúdo e Snippets H1, H2, H3 (detalhados no orientacoes_iniciais.txt).
- Imagens padronizadas com NOME baseado no título para rankeamento no Google Images.
- Dashboard administrativo com os rastreamentos e logs processados.

## 3. Rastreadores e Analíticos (Eventos)
O sistema deve integrar-se com *Google Analytics* / GTM para capturar:
- Pageviews (Visitas em cada página e ranking de mais visitadas).
- Cliques no botão "Busque seu Imóvel".
- Envio de Formulários (Submit) e visualização da "Página de Confirmação".
- Cliques no botão WhatsApp.

## 4. Integrações Requeridas
As integrações listadas pelo usuário (algumas requerem geração de chave):
1. WordPress (API / Plugin de postagem)
2. WhatsApp (Link wa.me gerado na página)
3. Supabase (Banco de dados e Autenticação)
4. Google Search Console & Google Analytics (Para Inserção via GTM no WordPress/Métricas)
5. Google Ads (Tag/Pixel de conversão)
*(Sem Slack ou Shopify)*

## 5. Invariantes Arquiteturais e Restrições
- Arquitetura de 3 camadas A.N.T. (Arquitetura, Navegação, Tools).
- Respeitar estritamente as regras de Ingestão de CSV (rejeitar itens fora do padrão).
- Lógica de negócios escrita deterministicamente fora do LLM (nos scripts de ferramentas).
- Nenhum script em `tools/` modificado antes do Arquivo POP (`architecture/`) ser revisto.
