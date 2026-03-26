# Instruções para Cadastro e SEO de Imóveis

Este documento descreve as automações implementadas para garantir que cada imóvel cadastrado possua informações de SEO otimizadas e uma imagem de destaque padronizada.

## 1. Automação de Campos SEO
Ao realizar a ingestão de novos imóveis via `ingest_caixa_csv.py`, o sistema agora gera automaticamente os seguintes campos:

- **Título H1**: `🔴 [Tipo] [Bairro] [Cidade] [UF] [Número] Imóvel CAIXA 🧡💙`
- **Descrição**: `Imóvel CAIXA [Tipo] [Bairro] [Cidade] [UF] com desconto de R$ [Valor]. ⚠️ Estamos Online!`
- **Link Permanente (Slug)**: `/[tipo]-[bairro]-[cidade]-[uf]-[numero]`
- **Palavra-Chave**: `[Tipo] [Bairro] [Cidade] [UF]`

## 2. Geração de Imagem de Destaque
O sistema clona automaticamente a imagem padrão localizada em `automation/imagens/imagem-destaque/ImagemDestaque.jpg` para a pasta pública do site:
`web/public/imagens-destaque/[slug].jpg`

> [!IMPORTANT]
> Certifique-se de que a imagem `ImagemDestaque.jpg` esteja sempre atualizada na pasta de automação, pois ela servirá de base para todos os novos cadastros.

## 3. Visualização no Painel SEO
No painel interno da página do imóvel, a imagem é exibida em formato **quadrado (aspect-square)**, ideal para visualização rápida de como a imagem aparecerá em compartilhamentos sociais e buscadores.

---
*Documentação gerada automaticamente para o processo de cadastro.*
