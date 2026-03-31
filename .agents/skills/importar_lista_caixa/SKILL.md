---
name: importar_lista_caixa
description: >
  Processa e ingere uma lista de imóveis da CAIXA (Excel) no banco de dados Supabase em
  4 etapas modularizadas: 1) Cadastro Básico do Excel, 2) Resolução Financeira, Grupos e SEO,
  3) Raspagem no Site da CAIXA (FGTS, Cartório e Extrato de Características), e 4) Enriquecimento 
  Avançado de CEP com IA. O sistema mantém atualizações em tabelas relacionais.
---

# Skill: Importar Lista da CAIXA (Novo Pipeline 4 Etapas)

## Visão Geral

Este documento descreve como o sistema e o agente processam arquivos Excel fornecidos pelo usuário contendo imóveis filtrados da CAIXA.
A arquitetura monolítica foi abandonada em favor de um **pipeline modular de 4 scripts sequenciais**, garantindo estabilidade, fácil manutenção e isolamento de falhas.

O status do imóvel é trilhado pela coluna `etapa_processamento` na tabela `imoveis`.

### Scripts do Pipeline

Todos localizados em: `automation/tools/`

1. **`etapa1_cadastro_basico.py`**
2. **`etapa2_seo_grupos.py`**
3. **`etapa3_scraping.py`**
4. **`etapa4_enriquecimento.py`**

---

## Estrutura de Tabelas

| Tabela | Propósito |
|---|---|
| `imoveis` | Propriedades imobiliárias base. Chave primária: `imoveis_id`. Único: `imovel_caixa_numero` |
| `atualizacoes_imovel` | Histórico de valores, regras e condições de compra para um `imovel_id` num momento |
| `ceps_imovel` | Dicionário geográfico de CEPs enriquecidos via IA. Relacionado por `id_cep_imovel_caixa` |
| `grupos_imovel` | Regras de percentual mínimo de entrada/prestação de acordo com o valor |

### Principais Colunas Modificadas/Adicionadas

Na tabela `imoveis`:
- `etapa_processamento` (INT): Rastreia onde o imóvel está no pipeline (1 a 4).
- `imovel_caixa_endereco_uf`, `cidade` e `bairro` (TEXT): Permite receber o texto cru do Excel rapidamente antes de qualquer lookup complexo.

Na tabela `ceps_imovel`:
- `enriquecimento_texto` (TEXT): A resposta crua da inteligência artificial sobre a análise regional do CEP.
- `enriquecimento_json` (JSONB): Os mesmos dados mas em formato estruturado.

---

## 🏗️ Etapa 1: Cadastro Básico

**Arquivo**: `etapa1_cadastro_basico.py <caminho.xlsx>`
**Objetivo**: Realizar a importação ágil e rápida do DataFrame `.xlsx` direto para os bancos `imoveis` e `atualizacoes_imovel`.

### Regras:
- Não aplicar filtros lógicos de negócio (o Excel já vem formatado pelo cliente com `Desconto >= 30%` e apenas `Venda Online / Direta Online`).
- Executa Inserção Diária ("Upsert") verificando conflito em `imovel_caixa_numero`.
- Se conflito, define `etapa_processamento = 1` e atualiza strings crúas.
- Sempre insere uma nova linha em `atualizacoes_imovel` com dados flutuantes monetários (Valor venda, Avaliação, Desconto, etc.) da data corrente.
- Marca como **`etapa_processamento = 1`**.

---

## 📈 Etapa 2: Identificação de Grupo e SEO

**Arquivo**: `etapa2_seo_grupos.py`
**Objetivo**: Enriquecer strings, organizar formatação para o site e enquadrar regras financeiras da CAIXA.

### Regras:
- Filtra `WHERE etapa_processamento = 1`.
- Calcula o `desconto_moeda` subtraindo Valor Avaliação de Valor Venda (buscado do histórico).
- Encontra em qual `grupos_imovel` a faixa de valor se encaixa e calcula os limites `imovel_caixa_pagamento_financiamento_entrada` e `prestacao` injetando no registro da atualização recém criado na Etapa 1.
- Cria os Metadados: Title, Description, Permanent Link (Slug), Palavra Chave.
- Sorteia 10 Hashtags estrategicamente separadas por Público, Investimento e Localidade combinando com UF, Cidade, Bairro e Tipo.
- Cria, Recorta (opcional) e Faz envio para o Supabase Storage `imoveis-destaque/{slug}.jpg` (Copiando `ImagemDestaque.jpg` local).
- Atualiza tabelas.
- Marca como **`etapa_processamento = 2`**.

---

## 🕷️ Etapa 3: Scraping e Data Extract

**Arquivo**: `etapa3_scraping.py`
**Objetivo**: Visitar a página oficial do imóvel, capturar HTML e formatar os dados detalhados da residência, características ou dados jurídicos.

### Regras:
- Filtra `WHERE etapa_processamento = 2`.
- Utiliza a biblioteca `requests` para requisição direta à URL com bypasser base de Headers e eventual `cookies.json`.
- Expressoes Regulares:
  - Analisa descritivo interno cru (`imovel_caixa_descricao_csv`) buscando as quantidades numéricas de áreas, quartos, wc, salas, varandas, etc e definindo com valor Float ou Int nas properties.
  - Verifica no HTML extraído os dados de Cartório: Matrícula, Ofício, Inscrição, etc.
  - Verifica débitos Condomínio, Regras tributárias via expressão regular.
  - Extrai o `CEP` contido na linha do endereço oficial do scraping.
- Salva dados textuais da matrícula na base `imoveis`. Dados mutáveis (uso exigido de FGTS, etc) vai para a `atualizacoes_imovel`.
- Tenta Localizar ou Inserir um novo `ceps_imovel` usando o CEP raspado e associa enviando `id_cep_imovel_caixa` do imovel recém alterado.
- Marca como **`etapa_processamento = 3`**.

---

## 🌍 Etapa 4: Enriquecimento de CEP (IA Hiperlocal)

**Arquivo**: `etapa4_enriquecimento.py`
**Objetivo**: Construção e enriquecimento focado no endereço extraido na Etapa 3 para análise de mercado usando Google Gemini ou OpenAI (LLM Agents).

### Regras:
- Filtra `WHERE etapa_processamento = 3` e possui `id_cep_imovel_caixa` relacional.
- Agrupa imóveis com o mesmo CEP e verifica se na tabela dicionário `ceps_imovel` a flag (ou campo) `enriquecimento_texto` está nula.
- Se o campo for nulo (CEP Novo), utiliza a IA Gen AI:
  - Envia prompt estruturado solicitando visão de mercado: `mobilidade, infraestrutura, praças, parques comerciais, vias de acesso`.
  - Força retorno obrigatório puro em JSON, incluindo o descritivo denso de "texto de venda/apreço" e o balanço "Custo-Benefício".
- Recebe a resposta e grava na raiz de `ceps_imovel` permitindo que todos imóveis desta região herdem essa análise sem custo de re-processar prompt.
- Marca o(s) imóvel(is) processado(s) como **`etapa_processamento = 4`** (Finalizado e Pronto para Site).

---

## Instruções de Uso

Para rodar o processo inteiro com log, o ambiente pode executar:

```bash
cd automation/tools
python etapa1_cadastro_basico.py "03-27-Lista_imoveis_RJ.xlsx"
python etapa2_seo_grupos.py
python etapa3_scraping.py
python etapa4_enriquecimento.py
```
Esse design confere robustez e permite que, em caso de erro no Supabase ou CAIXA fora do ar na etapa 3, os imóveis já cadastrados e "SEO'Tizados" fiquem intocados até repetição manual das etapas!
