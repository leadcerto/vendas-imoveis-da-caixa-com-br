---
description: Passo a passo para enriquecimento de localização baseado no CEP
---

Este workflow descreve o processo de captura manual ou semiautomática de informações detalhadas de um CEP para popular a tabela `ceps_imovel`.

### Passo 1: Identificação do CEP no Imóvel
1. Acesse a tabela `imoveis` e localize o campo `imovel_caixa_endereco_csv`.
2. Identifique o número do CEP (ex: 21371-020).
3. Verifique se o CEP já existe na tabela `ceps_imovel`.

### Passo 2: Captura de Dados Básicos (Automático)
// turbo
1. Utilize a API do ViaCEP ou BrasilAPI para obter Logradouro, Bairro, Cidade, UF, DDD e Código IBGE.
2. Formate o CEP como numérico (sem hífen) e formatado (com hífen).

### Passo 3: Pesquisa de Perfil e Conveniência (Humano/IA)
1. Utilize uma ferramenta de busca ou IA para coletar informações sobre:
   - **Transporte**: Estações de metrô, BRT e linhas de ônibus.
   - **Acessos**: Vias principais e rodovias próximas.
   - **Serviços**: Supermercados, Shoppings, Saúde e Educação.
   - **Lazer**: Parques e áreas culturais.
2. Consolide estas informações em textos curtos e atrativos.

### Passo 4: Pesquisa de Mercado (Valores m²)
1. Consulte os portais de referência para o CEP em questão:
   - [QuintoAndar](https://www.quintoandar.com.br/)
   - [Loft](https://loft.com.br/)
   - [FipeZAP](https://www.zapimoveis.com.br/blog/fipezap/)
   - [OLX](https://www.olx.com.br/imoveis/)
2. Calcule a média aritmética dos valores encontrados por metro quadrado.

### Passo 5: Registro no Banco de Dados
1. Preencha todos os 22 campos da tabela `ceps_imovel`.
2. Gere o `cep_resumo` (campo JSON) para garantir o carregamento ultra-rápido na página do imóvel.
3. Marque o status como `ativo`.
