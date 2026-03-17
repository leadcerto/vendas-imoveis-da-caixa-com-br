Guia de Arquitetura: Sistema de Banco de Dados - Antigravity Imóveis CAIXA
📋 Visão Geral
Este documento define a arquitetura completa do banco de dados para o sistema Antigravity de gerenciamento de imóveis da CAIXA, incluindo estrutura de tabelas, fluxos de processamento, relacionamentos e regras de negócio.

🎯 Objetivos do Sistema
Ingestão automatizada de arquivos CSV com imóveis da CAIXA
Limpeza e validação de dados conforme regras de negócio
Enriquecimento de dados através de cálculos, referências externas e web scraping
Histórico completo de alterações e atualizações de imóveis
Otimização para buscas e exibição no frontend
🗄️ Estrutura do Banco de Dados
Tabela Principal: imoveis_caixa
Esta é a tabela central que armazena todos os dados dos imóveis após processamento.

Campos Originais (do CSV)
sql


CREATE TABLE imoveis_caixa (
    -- Chave Primária
    numero_imovel BIGINT PRIMARY KEY,
    
    -- Dados Originais do CSV
    data_geracao DATE NOT NULL,
    uf VARCHAR(2) NOT NULL,
    cidade VARCHAR(100) NOT NULL,
    bairro VARCHAR(150) NOT NULL,
    endereco TEXT NOT NULL,
    preco_venda DECIMAL(12, 2) NOT NULL,
    valor_avaliacao DECIMAL(12, 2) NOT NULL,
    desconto_percentual DECIMAL(5, 2) NOT NULL,
    aceita_financiamento BOOLEAN NOT NULL,
    descricao TEXT,
    modalidade_venda VARCHAR(50) NOT NULL,
    link_imovel TEXT NOT NULL,
    
    -- Metadados de Controle
    data_importacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status_processamento VARCHAR(20) DEFAULT 'pendente', -- pendente, processado, erro
    
    -- Índices para performance
    INDEX idx_cidade_uf (cidade, uf),
    INDEX idx_bairro (bairro),
    INDEX idx_desconto (desconto_percentual),
    INDEX idx_financiamento (aceita_financiamento),
    INDEX idx_data_geracao (data_geracao)
);
Campos Calculados - Criação Direta
sql


-- Adicionar campos de cálculo direto
ALTER TABLE imoveis_caixa ADD COLUMN (
    -- Cálculos Diretos
    desconto_reais DECIMAL(12, 2) GENERATED ALWAYS AS (valor_avaliacao - preco_venda) STORED,
    nivel_destaque INT DEFAULT 0, -- 0, 1, 2, 3, ou 4 (super destaque)
    url_imagem TEXT GENERATED ALWAYS AS (
        CONCAT('https://venda-imoveis.caixa.gov.br/fotos/F', numero_imovel, '21.jpg')
    ) STORED,
    cep VARCHAR(9),
    
    -- Campos de Investimento (calculados posteriormente)
    saldo_devedor_atual DECIMAL(12, 2),
    valor_venda_acelerada DECIMAL(12, 2),
    previsao_lucro DECIMAL(12, 2)
);
Campos do Web Scraping
sql


-- Adicionar campos extraídos via scraping
ALTER TABLE imoveis_caixa ADD COLUMN (
    -- Dados do Scraping
    tipo_imovel VARCHAR(50),
    area_privativa DECIMAL(10, 2),
    area_total DECIMAL(10, 2),
    area_terreno DECIMAL(10, 2),
    quartos INT,
    vagas_garagem INT,
    matricula VARCHAR(50),
    comarca VARCHAR(100),
    oficio VARCHAR(10),
    inscricao_imobiliaria VARCHAR(50),
    averbacao_leiloes VARCHAR(50),
    
    -- Formas de Pagamento
    permite_fgts BOOLEAN DEFAULT FALSE,
    permite_financiamento_sbpe BOOLEAN DEFAULT FALSE,
    apenas_vista BOOLEAN DEFAULT FALSE,
    
    -- Observações
    regra_condominio TEXT,
    regra_tributos TEXT,
    anotacoes TEXT,
    
    -- Controle de Scraping
    scraping_realizado BOOLEAN DEFAULT FALSE,
    data_scraping TIMESTAMP,
    tentativas_scraping INT DEFAULT 0
);
Tabela: imoveis_despesas_calculadas
Armazena as despesas calculadas com base na tabela de referência.

sql


CREATE TABLE imoveis_despesas_calculadas (
    id BIGSERIAL PRIMARY KEY,
    numero_imovel BIGINT NOT NULL,
    data_calculo TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Despesas Obrigatórias
    valor_entrada DECIMAL(12, 2),
    prestacao_financiamento DECIMAL(12, 2),
    registro_imovel DECIMAL(12, 2),
    
    -- Possíveis Despesas
    condominio_max DECIMAL(12, 2),
    desocupacao_estimada DECIMAL(12, 2),
    iptu_estimado DECIMAL(12, 2), -- Inicialmente NULL
    
    -- Despesas Opcionais
    reforma_basica DECIMAL(12, 2),
    honorarios_despachante DECIMAL(12, 2),
    
    -- Economia de Compra
    economia_leiloeiro DECIMAL(12, 2),
    economia_corretagem DECIMAL(12, 2),
    economia_total DECIMAL(12, 2) GENERATED ALWAYS AS (economia_leiloeiro + economia_corretagem) STORED,
    
    -- Despesas de Investimento
    despesa_manutencao DECIMAL(12, 2),
    prazo_venda_meses INT,
    desconto_aceleracao DECIMAL(12, 2),
    despesa_venda DECIMAL(12, 2),
    total_investimento DECIMAL(12, 2),
    
    FOREIGN KEY (numero_imovel) REFERENCES imoveis_caixa(numero_imovel) ON DELETE CASCADE,
    UNIQUE KEY uk_imovel_data (numero_imovel, data_calculo)
);
Tabela: tabela_referencia_percentuais
Armazena os percentuais usados nos cálculos (importada do arquivo Excel).

sql


CREATE TABLE tabela_referencia_percentuais (
    id SERIAL PRIMARY KEY,
    categoria VARCHAR(50) NOT NULL, -- 'obrigatoria', 'possivel', 'opcional', 'economia', 'investimento'
    campo VARCHAR(100) NOT NULL UNIQUE,
    percentual DECIMAL(6, 4) NOT NULL, -- Ex: 0.3000 para 30%
    base_calculo VARCHAR(20) NOT NULL, -- 'valor_venda' ou 'valor_avaliacao'
    descricao TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_campo (campo)
);

-- Exemplo de dados
INSERT INTO tabela_referencia_percentuais (categoria, campo, percentual, base_calculo, descricao) VALUES
('obrigatoria', 'entrada', 0.2000, 'valor_venda', 'Entrada mínima para financiamento'),
('obrigatoria', 'prestacao', 0.0080, 'valor_venda', 'Prestação mensal aproximada'),
('obrigatoria', 'registro', 0.0350, 'valor_avaliacao', 'Custos de cartório'),
('possivel', 'condominio', 0.1000, 'valor_avaliacao', 'Limite de responsabilidade do comprador'),
('possivel', 'desocupacao', 0.0500, 'valor_avaliacao', 'Custo estimado de desocupação'),
('opcional', 'reforma', 0.1500, 'valor_avaliacao', 'Reforma básica para revenda'),
('opcional', 'despachante', 0.0200, 'valor_avaliacao', 'Honorários de despachante'),
('economia', 'leiloeiro', 0.0500, 'valor_venda', 'Economia com leiloeiro'),
('economia', 'corretagem', 0.0600, 'valor_venda', 'Economia com corretagem'),
('investimento', 'manutencao', 0.0300, 'valor_avaliacao', 'Manutenção mensal'),
('investimento', 'desconto_aceleracao', 0.0500, 'valor_avaliacao', 'Desconto para venda rápida'),
('investimento', 'despesa_venda', 0.0800, 'valor_avaliacao', 'Custos de venda');
Tabela: historico_atualizacoes
Mantém o histórico completo de todas as alterações de cada imóvel.

sql


CREATE TABLE historico_atualizacoes (
    id BIGSERIAL PRIMARY KEY,
    numero_imovel BIGINT NOT NULL,
    data_geracao DATE NOT NULL,
    
    -- Snapshot dos dados na data de geração
    preco_venda DECIMAL(12, 2),
    valor_avaliacao DECIMAL(12, 2),
    desconto_percentual DECIMAL(5, 2),
    aceita_financiamento BOOLEAN,
    modalidade_venda VARCHAR(50),
    
    -- Metadados
    data_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tipo_alteracao VARCHAR(20), -- 'novo', 'atualizacao', 'removido'
    
    FOREIGN KEY (numero_imovel) REFERENCES imoveis_caixa(numero_imovel) ON DELETE CASCADE,
    INDEX idx_imovel_data (numero_imovel, data_geracao)
);
Tabela: localidades_normalizadas
Normaliza UF, Cidade e Bairro para evitar duplicações.

sql


CREATE TABLE localidades_normalizadas (
    id SERIAL PRIMARY KEY,
    uf VARCHAR(2) NOT NULL,
    cidade VARCHAR(100) NOT NULL,
    bairro VARCHAR(150) NOT NULL,
    bairro_normalizado VARCHAR(150) NOT NULL, -- Nome corrigido e padronizado
    complemento_bairro VARCHAR(100), -- Ex: "JACAREPAGUÁ", "CUNHAMBEBE"
    quantidade_imoveis INT DEFAULT 0,
    ativo BOOLEAN DEFAULT TRUE,
    
    UNIQUE KEY uk_localidade (uf, cidade, bairro),
    INDEX idx_normalizado (bairro_normalizado)
);
Tabela: enderecos_normalizados
Armazena endereços limpos e CEPs descobertos.

sql


CREATE TABLE enderecos_normalizados (
    id BIGSERIAL PRIMARY KEY,
    numero_imovel BIGINT NOT NULL,
    endereco_original TEXT NOT NULL,
    endereco_normalizado TEXT NOT NULL,
    cep VARCHAR(9),
    logradouro VARCHAR(200),
    numero VARCHAR(20),
    complemento VARCHAR(100),
    fonte_cep VARCHAR(50), -- 'api_viacep', 'scraping', 'manual'
    confiabilidade INT DEFAULT 0, -- 0-100
    data_normalizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (numero_imovel) REFERENCES imoveis_caixa(numero_imovel) ON DELETE CASCADE,
    UNIQUE KEY uk_imovel (numero_imovel)
);
Tabela: logs_processamento
Registra todas as operações de processamento.

sql


CREATE TABLE logs_processamento (
    id BIGSERIAL PRIMARY KEY,
    tipo_operacao VARCHAR(50) NOT NULL, -- 'importacao_csv', 'calculo_despesas', 'scraping', 'normalizacao'
    data_inicio TIMESTAMP NOT NULL,
    data_fim TIMESTAMP,
    status VARCHAR(20), -- 'iniciado', 'concluido', 'erro', 'parcial'
    registros_processados INT DEFAULT 0,
    registros_erro INT DEFAULT 0,
    arquivo_origem VARCHAR(255),
    mensagem_erro TEXT,
    detalhes JSON,
    
    INDEX idx_tipo_data (tipo_operacao, data_inicio)
);
🔄 Fluxo de Processamento
PASSO 1: Importação e Limpeza do CSV


📂 csv_caixa/
    └── imoveis_YYYY-MM-DD.csv

         ⬇️ [1.1 Leitura do CSV]

    Dados Extraídos:
    - Data de geração
    - Número do imóvel
    - UF, Cidade, Bairro
    - Endereço
    - Preço, Avaliação, Desconto
    - Financiamento
    - Descrição, Modalidade
    - Link

         ⬇️ [1.2 Limpeza/Filtros]

    ❌ EXCLUIR SE:
    - Desconto < 30%
    - Modalidade ≠ "Venda Direta Online" e "Venda Online"

         ⬇️ [1.3 Importação]

    ✅ Inserir em `imoveis_caixa`
    ✅ Registrar em `logs_processamento`
    ✅ Criar entradas em `historico_atualizacoes`

         ⬇️

    🗑️ Deletar arquivo CSV processado
Lógica de Atualização:
python


# Pseudocódigo
para cada linha do CSV:
    se numero_imovel JÁ EXISTE no banco:
        se data_geracao > data_atualizacao_atual:
            # Registrar histórico ANTES de atualizar
            inserir em historico_atualizacoes (snapshot dos dados antigos)
            atualizar imoveis_caixa com novos dados
            marcar tipo_alteracao = 'atualizacao'
    senão:
        inserir novo registro em imoveis_caixa
        inserir em historico_atualizacoes com tipo_alteracao = 'novo'
PASSO 2.1: Criação de Despesas (Criação Indireta)


📊 tabela_referencia_percentuais
         +
🏠 imoveis_caixa (novos/atualizados)

         ⬇️ [Cálculo de Despesas]

    Para cada imóvel sem despesas calculadas:
    
    ✅ Buscar percentuais da tabela_referencia_percentuais
    ✅ Calcular cada despesa:
        - valor_entrada = percentual × base_calculo
        - prestacao_financiamento = percentual × base_calculo
        - etc...
    
         ⬇️
    
    💾 Inserir em `imoveis_despesas_calculadas`
SQL de Exemplo para Cálculo:
sql


-- Inserir despesas calculadas para imóveis sem cálculo
INSERT INTO imoveis_despesas_calculadas (
    numero_imovel,
    valor_entrada,
    prestacao_financiamento,
    registro_imovel,
    condominio_max,
    desocupacao_estimada,
    reforma_basica,
    honorarios_despachante,
    economia_leiloeiro,
    economia_corretagem,
    despesa_manutencao,
    desconto_aceleracao,
    despesa_venda
)
SELECT 
    ic.numero_imovel,
    ic.preco_venda * (SELECT percentual FROM tabela_referencia_percentuais WHERE campo = 'entrada'),
    ic.preco_venda * (SELECT percentual FROM tabela_referencia_percentuais WHERE campo = 'prestacao'),
    ic.valor_avaliacao * (SELECT percentual FROM tabela_referencia_percentuais WHERE campo = 'registro'),
    ic.valor_avaliacao * (SELECT percentual FROM tabela_referencia_percentuais WHERE campo = 'condominio'),
    ic.valor_avaliacao * (SELECT percentual FROM tabela_referencia_percentuais WHERE campo = 'desocupacao'),
    ic.valor_avaliacao * (SELECT percentual FROM tabela_referencia_percentuais WHERE campo = 'reforma'),
    ic.valor_avaliacao * (SELECT percentual FROM tabela_referencia_percentuais WHERE campo = 'despachante'),
    ic.preco_venda * (SELECT percentual FROM tabela_referencia_percentuais WHERE campo = 'leiloeiro'),
    ic.preco_venda * (SELECT percentual FROM tabela_referencia_percentuais WHERE campo = 'corretagem'),
    ic.valor_avaliacao * (SELECT percentual FROM tabela_referencia_percentuais WHERE campo = 'manutencao'),
    ic.valor_avaliacao * (SELECT percentual FROM tabela_referencia_percentuais WHERE campo = 'desconto_aceleracao'),
    ic.valor_avaliacao * (SELECT percentual FROM tabela_referencia_percentuais WHERE campo = 'despesa_venda')
FROM imoveis_caixa ic
LEFT JOIN imoveis_despesas_calculadas idc ON ic.numero_imovel = idc.numero_imovel
WHERE idc.numero_imovel IS NULL;
PASSO 2.2: Criação Direta (Campos Calculados)


🏠 imoveis_caixa (com dados básicos)

         ⬇️ [Cálculos Diretos]

    ✅ desconto_reais = valor_avaliacao - preco_venda
    
    ✅ nivel_destaque:
        SE desconto_reais >= 100.000 → nivel = 1
        SE desconto_percentual >= 50 → nivel = 2
        SE desconto_percentual >= 70 → nivel = 3
        SE desconto_percentual >= 70 E aceita_financiamento → nivel = 4 (SUPER)
    
    ✅ url_imagem = 'https://venda-imoveis.caixa.gov.br/fotos/F{numero_imovel}21.jpg'
    
    ✅ saldo_devedor_atual (se financiamento ativo):
        = preco_venda - (valor_entrada + (prestacoes_pagas × amortizacao))
    
    ✅ valor_venda_acelerada:
        = valor_avaliacao - desconto_aceleracao
    
    ✅ previsao_lucro:
        = valor_venda_acelerada - (saldo_devedor + total_investimento)

         ⬇️

    💾 Atualizar campos em `imoveis_caixa`
Lógica para Nível de Destaque:
python


def calcular_nivel_destaque(imovel):
    nivel = 0
    
    # Regra 1: Desconto em reais
    if imovel.desconto_reais >= 100000:
        nivel = max(nivel, 1)
    
    # Regra 2: Desconto percentual >= 50%
    if imovel.desconto_percentual >= 50:
        nivel = max(nivel, 2)
    
    # Regra 3: Desconto percentual >= 70%
    if imovel.desconto_percentual >= 70:
        nivel = max(nivel, 3)
    
    # Regra 4: Super Destaque
    if imovel.desconto_percentual >= 70 and imovel.aceita_financiamento:
        nivel = 4  # SUPER DESTAQUE
    
    return nivel
PASSO 2.3: Web Scraping


🏠 imoveis_caixa (com scraping_realizado = FALSE)

         ⬇️ [Fila de Scraping]

    Para cada imóvel pendente:
        URL = link_imovel (coluna do banco)
        
         ⬇️ [Acessar Página]
    
    🌐 https://venda-imoveis.caixa.gov.br/sistema/detalhe-imovel.asp?hdnimovel={numero}

         ⬇️ [Extrair Dados]

    📊 DADOS A EXTRAIR:
    ✅ Tipo de imóvel
    ✅ Área privativa, total, terreno
    ✅ Quartos, Garagem
    ✅ Matrícula, Comarca, Ofício
    ✅ Inscrição Imobiliária
    ✅ Averbação dos leilões
    
    💰 FORMAS DE PAGAMENTO:
    ✅ Identificar padrão de texto:
        - "Exclusivamente à vista" → apenas_vista = TRUE
        - "Permite utilização de FGTS" → permite_fgts = TRUE
        - "Permite financiamento – somente SBPE" → permite_financiamento_sbpe = TRUE
    
    📝 REGRAS E OBSERVAÇÕES:
    ✅ Extrair texto sobre CONDOMÍNIO
    ✅ Extrair texto sobre TRIBUTOS
    ✅ Extrair ANOTAÇÕES

         ⬇️ [Atualizar Banco]

    💾 UPDATE imoveis_caixa SET
        tipo_imovel = ...,
        area_privativa = ...,
        scraping_realizado = TRUE,
        data_scraping = NOW()
    WHERE numero_imovel = ...

         ⬇️ [Controle de Erros]

    ❌ SE ERRO:
        tentativas_scraping += 1
        registrar em logs_processamento
        SE tentativas_scraping >= 3:
            marcar como "scraping_falhou"
Seletores para Web Scraping:
python


# Pseudocódigo dos seletores
SELETORES = {
    'tipo_imovel': 'div.caracteristicas span:contains("Tipo")',
    'area_privativa': 'div.caracteristicas span:contains("Área privativa")',
    'area_total': 'div.caracteristicas span:contains("Área total")',
    'quartos': 'div.caracteristicas span:contains("Quartos")',
    'garagem': 'div.caracteristicas span:contains("Garagem")',
    'matricula': 'div.informacoes-legais span:contains("Matrícula")',
    'formas_pagamento': 'div.formas-pagamento p',
    'regras': 'div.observacoes-importantes',
}
Normalização de Localidades e Endereços


🏠 imoveis_caixa (dados brutos)

         ⬇️ [Normalização de Localidades]

    Para cada combinação única (UF, Cidade, Bairro):
    
    ✅ Corrigir ortografia
    ✅ Padronizar capitalização: "PRAIA DA RIBEIRA" → "Praia da Ribeira"
    ✅ Identificar complementos: "FREGUESIA (JACAREPAGUÁ)" 
        → bairro_normalizado = "Freguesia"
        → complemento = "Jacarepaguá"
    
    💾 Inserir/Atualizar `localidades_normalizadas`

         ⬇️ [Normalização de Endereços]

    Para cada endereço:
    
    ✅ Limpar formato: "RUA TRES DE MAIO, N. SN, QD 60 LT 21"
        → "Rua Três de Maio, N. SN, Qd 60 Lt 21"
    ✅ Remover redundâncias
    ✅ Corrigir ortografia
    
         ⬇️ [Buscar CEP]

    🔍 API ViaCEP ou similar:
        INPUT: {logradouro, cidade, uf}
        OUTPUT: {cep, logradouro_completo}
    
    💾 Inserir em `enderecos_normalizados`
    💾 Atualizar `imoveis_caixa.cep`
🎨 Regras de Exibição (Frontend)
Etiquetas/Badges de Destaque
javascript


// Lógica para exibir badges
function getBadges(imovel) {
    const badges = [];
    
    // Badge de Destaque
    if (imovel.nivel_destaque === 4) {
        badges.push({
            text: '🔥 SUPER DESTAQUE',
            color: 'red',
            priority: 1
        });
    } else if (imovel.nivel_destaque === 3) {
        badges.push({
            text: '⭐ DESTAQUE PREMIUM',
            color: 'gold',
            priority: 2
        });
    } else if (imovel.nivel_destaque >= 1) {
        badges.push({
            text: '✨ DESTAQUE',
            color: 'blue',
            priority: 3
        });
    }
    
    // Badge de Financiamento
    if (imovel.aceita_financiamento) {
        badges.push({
            text: '💳 Aceita Financiamento',
            color: 'green',
            priority: 4
        });
    }
    
    // Badge de FGTS
    if (imovel.permite_fgts) {
        badges.push({
            text: '🏦 FGTS',
            color: 'blue',
            priority: 5
        });
    }
    
    return badges.sort((a, b) => a.priority - b.priority);
}
Ordenação de Resultados
sql


-- Query para busca com ordenação por destaque
SELECT * FROM imoveis_caixa
WHERE uf = :uf 
  AND cidade = :cidade
  AND desconto_percentual >= 30
ORDER BY 
    nivel_destaque DESC,           -- Super Destaque primeiro
    desconto_percentual DESC,      -- Maior desconto
    aceita_financiamento DESC,     -- Aceita financiamento
    preco_venda ASC               -- Menor preço
LIMIT 50;
🔧 Manutenção e Atualizações
Atualização da Tabela de Referência
python


# Quando tabela_referencia.xlsx é atualizado

1. Importar novo arquivo Excel
2. Validar percentuais (0 < valor < 1)
3. Atualizar tabela_referencia_percentuais
4. Marcar todos os registros de imoveis_despesas_calculadas como "desatualizados"
5. Recalcular despesas para todos os imóveis
6. Registrar em logs_processamento
Limpeza de Dados Antigos
sql


-- Remover imóveis que não aparecem há mais de 90 dias
DELETE FROM imoveis_caixa
WHERE data_atualizacao < NOW() - INTERVAL 90 DAY
  AND numero_imovel NOT IN (
      SELECT DISTINCT numero_imovel 
      FROM historico_atualizacoes 
      WHERE data_geracao > NOW() - INTERVAL 90 DAY
  );

-- Manter histórico por 2 anos
DELETE FROM historico_atualizacoes
WHERE data_geracao < NOW() - INTERVAL 2 YEAR;
📊 Views Úteis
View: vw_imoveis_completos
sql


CREATE VIEW vw_imoveis_completos AS
SELECT 
    ic.*,
    idc.valor_entrada,
    idc.prestacao_financiamento,
    idc.registro_imovel,
    idc.economia_total,
    idc.total_investimento,
    idc.previsao_lucro,
    ln.bairro_normalizado,
    ln.complemento_bairro,
    en.cep,
    en.endereco_normalizado
FROM imoveis_caixa ic
LEFT JOIN imoveis_despesas_calculadas idc ON ic.numero_imovel = idc.numero_imovel
LEFT JOIN localidades_normalizadas ln ON 
    ic.uf = ln.uf AND 
    ic.cidade = ln.cidade AND 
    ic.bairro = ln.bairro
LEFT JOIN enderecos_normalizados en ON ic.numero_imovel = en.numero_imovel
WHERE ic.status_processamento = 'processado';
View: vw_relatorio_historico
sql


CREATE VIEW vw_relatorio_historico AS
SELECT 
    ha.numero_imovel,
    ic.endereco,
    ic.cidade,
    ic.uf,
    ha.data_geracao,
    ha.preco_venda,
    ha.valor_avaliacao,
    ha.desconto_percentual,
    ha.aceita_financiamento,
    ha.tipo_alteracao,
    (ha.valor_avaliacao - ha.preco_venda) AS desconto_reais
FROM historico_atualizacoes ha
JOIN imoveis_caixa ic ON ha.numero_imovel = ic.numero_imovel
ORDER BY ha.numero_imovel, ha.data_geracao DESC;
🚀 Ordem de Implementação Recomendada
Fase 1: Estrutura Base
✅ Criar tabela imoveis_caixa (campos originais)
✅ Criar tabela logs_processamento
✅ Criar tabela historico_atualizacoes
✅ Implementar módulo de importação CSV
✅ Implementar filtros de limpeza (desconto >= 30%, modalidades válidas)
Fase 2: Enriquecimento de Dados
✅ Criar tabela tabela_referencia_percentuais
✅ Importar dados do Excel de referência
✅ Criar tabela imoveis_despesas_calculadas
✅ Implementar cálculos de despesas (Criação Indireta)
✅ Implementar cálculos diretos (desconto_reais, nivel_destaque, url_imagem)
Fase 3: Normalização
✅ Criar tabela localidades_normalizadas
✅ Criar tabela enderecos_normalizados
✅ Implementar normalização de localidades
✅ Implementar busca de CEP (integração com API)
Fase 4: Web Scraping
✅ Adicionar campos de scraping em imoveis_caixa
✅ Implementar scraper para página de detalhes
✅ Implementar fila de scraping com controle de tentativas
✅ Implementar tratamento de erros e retry
Fase 5: Otimização e Views
✅ Criar views para consultas complexas
✅ Implementar índices adicionais conforme necessidade
✅ Criar jobs de limpeza automática
✅ Implementar monitoramento e alertas
📝 Notas Importantes
Integridade de Dados
numero_imovel é a chave primária e nunca se repete
Todo CSV importado deve ter uma data_geracao única
Sempre registrar em historico_atualizacoes ANTES de atualizar dados
Performance
Índices são CRÍTICOS para campos de busca (cidade, uf, bairro, desconto)
Considerar particionamento de historico_atualizacoes por ano se volume crescer muito
Cache de consultas frequentes (lista de cidades, bairros)
SEO e Imagens
URLs de imagem apontam para servidor da CAIXA (não hospedar localmente)
Link de imagem segue padrão: F{numero_imovel}21.jpg
Manter link_imovel original para backlinks e SEO
Extensibilidade
Campos JSON em logs_processamento.detalhes permitem logs flexíveis
status_processamento permite implementar filas de processamento
Views podem ser expandidas sem alterar estrutura de tabelas
🎯 Checklist de Validação
Antes de considerar o banco de dados completo, validar:

 Importação de CSV funciona e limpa dados corretamente
 Histórico é registrado antes de cada atualização
 Cálculos de despesas estão corretos (conferir manualmente 5 imóveis)
 Web scraping extrai todos os campos necessários
 Normalização de endereços funciona e encontra CEP
 Queries de busca retornam em < 500ms
 Sistema de destaque identifica corretamente os níveis
 Logs registram todas as operações
 Limpeza automática não remove dados importantes
 Views retornam dados consistentes
Última Atualização: 2026-03-10
Versão do Documento: 1.0
Mantenedor: Arquiteto Antigravity



Pergunte qualquer coisa




