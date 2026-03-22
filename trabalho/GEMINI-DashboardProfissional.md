# 🏗️ PROJETO: Dashboard Profissional

## 🎭 PAPEL DO AGENTE
Você é agora um **Especialista em Dashboards Profissionais**, com expertise em:
- Design de interfaces de dados complexos
- UX/UI para análise de informações
- Otimização de queries em grandes volumes de dados
- Visualizações interativas e responsivas
- Performance em aplicações data-intensive

---

## 🎯 OBJETIVO DO PROJETO
Criar um dashboard profissional completo para visualização e busca de imóveis cadastrados no Supabase, com interface moderna, animações fluidas e capacidades avançadas de filtragem.

---

## 🏛️ ARQUITETURA DO MÓDULO

### 📁 Estrutura de Pastas Proposta:
src/ ├── pages/ │ └── dashboard/ │ ├── index.jsx # Página principal do dashboard │ ├── Dashboard.module.css # Estilos do dashboard │ └── components/ # Componentes específicos do dashboard │ ├── SearchBar/ │ │ ├── SearchBar.jsx # Barra de busca principal │ │ ├── SearchBar.module.css │ │ └── AdvancedFilters.jsx # Filtros avançados expansíveis │ ├── PropertyGrid/ │ │ ├── PropertyGrid.jsx # Grid de cards de imóveis │ │ ├── PropertyCard.jsx # Card individual do imóvel │ │ └── PropertyGrid.module.css │ ├── DataTable/ │ │ ├── DataTable.jsx # Tabela detalhada (view alternativa) │ │ ├── TableRow.jsx # Linha customizada │ │ └── DataTable.module.css │ ├── Statistics/ │ │ ├── StatsPanel.jsx # Painel de estatísticas │ │ ├── ChartCard.jsx # Cards com gráficos │ │ └── Statistics.module.css │ └── ViewToggle/ │ └── ViewToggle.jsx # Alternar entre grid/table/map │ ├── services/ │ └── dashboard/ │ ├── propertyService.js # Serviço de comunicação com Supabase │ ├── filterService.js # Lógica de filtros e busca │ └── analyticsService.js # Cálculos e agregações │ ├── hooks/ │ └── dashboard/ │ ├── usePropertyData.js # Hook para carregar dados │ ├── useFilters.js # Hook para gerenciar filtros │ ├── usePagination.js # Hook para paginação │ └── useDebounce.js # Hook para otimizar buscas │ ├── utils/ │ └── dashboard/ │ ├── formatters.js # Formatação de valores (preço, área, etc) │ ├── validators.js # Validação de filtros │ └── exportHelpers.js # Exportar dados (CSV, PDF) │ └── api/ └── dashboard/ └── properties/ ├── route.js # Endpoint Node.js (se necessário) └── analytics.py # Script Python para análises pesadas




---

## 🔌 CONTRATOS DE INTERFACE

### Input Esperado (Supabase):
```typescript
// Estrutura da tabela 'properties' esperada:
interface Property {
  id: string;
  created_at: timestamp;
  title: string;
  description: text;
  price: decimal;
  area_size: decimal;
  bedrooms: integer;
  bathrooms: integer;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  property_type: enum ['casa', 'apartamento', 'terreno', 'comercial'];
  status: enum ['disponivel', 'vendido', 'reservado'];
  images: array<string>;
  features: jsonb;
  latitude: decimal;
  longitude: decimal;
  owner_id: uuid;
}
Output de Filtros:
typescript


interface FilterParams {
  search: string;              // Busca textual geral
  priceRange: [min, max];      // Faixa de preço
  areaRange: [min, max];       // Faixa de área
  bedrooms: number[];          // Array de qtd de quartos
  bathrooms: number[];         // Array de qtd de banheiros
  propertyTypes: string[];     // Tipos de imóvel
  status: string[];            // Status do imóvel
  cities: string[];            // Cidades
  features: string[];          // Características (piscina, garagem, etc)
  sortBy: string;              // Campo de ordenação
  sortOrder: 'asc' | 'desc';   // Direção da ordenação
  page: number;                // Página atual
  limit: number;               // Itens por página
}
🎨 ESPECIFICAÇÕES DE DESIGN
Componentes Obrigatórios:
Header do Dashboard
Logo/título
Estatísticas rápidas (total de imóveis, valor médio, etc)
Ações globais (exportar, adicionar novo)
Barra de Busca Inteligente
Search input com autocomplete
Sugestões em tempo real
Filtros rápidos (chips clicáveis)
Botão para filtros avançados
Painel de Filtros Avançados
Sidebar ou modal colapsável
Range sliders para preço e área
Checkboxes para múltiplas seleções
Mapa de calor para localização (se possível)
Botão "Limpar filtros"
Visualização dos Dados
Grid View: Cards com imagens e info resumida
Table View: Tabela completa com todas colunas
Map View: Mapa com pins dos imóveis (opcional)
Cards de Imóvel
Imagem principal (carousel nas demais)
Título e preço destacados
Ícones com info rápida (quartos, banheiros, área)
Badge de status
Botões de ação (ver detalhes, favoritar)
Hover effects com animações suaves
Paginação/Scroll Infinito
Escolher entre paginação tradicional ou infinite scroll
Indicador de loading durante carregamento
🎭 ANIMAÇÕES E INTERATIVIDADE (React)
Bibliotecas Sugeridas:
json


{
  "framer-motion": "^11.x",          // Animações fluidas
  "react-spring": "^9.x",            // Animações baseadas em física
  "@tanstack/react-table": "^8.x",   // Tabela poderosa
  "recharts": "^2.x",                // Gráficos para estatísticas
  "react-map-gl": "^7.x",            // Mapa (se usar)
  "react-select": "^5.x",            // Selects avançados
  "react-range": "^1.x"              // Range sliders
}
Animações Obrigatórias:
✨ Fade-in ao carregar cards (stagger animation)
🔄 Skeleton loaders durante carregamento
🎯 Smooth scroll ao navegar
💫 Hover effects nos cards (scale, shadow)
🌊 Transições suaves entre views
🎨 Loading states animados
⚡ Micro-interações em botões e filtros
🔧 GESTÃO DE ESTADO
Estado Global (Context ou Zustand):
javascript


// dashboardStore.js
{
  properties: [],           // Lista de imóveis
  filters: FilterParams,    // Filtros ativos
  viewMode: 'grid',        // grid | table | map
  isLoading: boolean,      // Estado de carregamento
  error: string | null,    // Erros
  pagination: {
    page: number,
    totalPages: number,
    totalItems: number
  },
  statistics: {
    total: number,
    avgPrice: number,
    avgArea: number,
    byType: object
  }
}
Estado Local (useState):
Estados de UI temporários (modals, tooltips)
Estados de formulários
Estados de animação
🚀 LÓGICA DE ORQUESTRAÇÃO
Fluxo Principal:
Inicialização


useEffect → carregar dados iniciais do Supabase
→ calcular estatísticas
→ renderizar com skeleton
Aplicação de Filtros


Usuário altera filtro
→ useDebounce (300ms)
→ construir query Supabase
→ executar busca com .select() + .filter()
→ atualizar estado
→ animar transição
Busca Textual


Input de busca
→ debounce
→ .textSearch() ou .ilike() no Supabase
→ destacar termos encontrados
Paginação


Usuário muda página
→ calcular .range(from, to)
→ fetch nova página
→ scroll to top suave
🛡️ RESILIÊNCIA E ERROR HANDLING
Tratamento de Erros:
javascript


// Camadas de erro:
try {
  // 1. Validação de filtros
  validateFilters(filters);
  
  // 2. Query Supabase
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .filter(/* ... */);
  
  if (error) throw error;
  
  // 3. Validação de resposta
  if (!data || data.length === 0) {
    return showEmptyState();
  }
  
  return data;
  
} catch (error) {
  // Logging
  console.error('[Dashboard Error]:', error);
  
  // Fallback UI
  showErrorToast('Erro ao carregar imóveis. Tente novamente.');
  
  // Retry mechanism (opcional)
  if (retryCount < 3) {
    setTimeout(() => fetchProperties(), 2000);
  }
}
Estados de Loading:
Initial Load: Skeleton screens
Filter Change: Overlay transparente + spinner
Pagination: Loading na parte inferior
Error State: Mensagem amigável + botão retry
🎯 DEPENDÊNCIAS DO MÓDULO
Backend (Supabase):
✅ Tabela properties com campos especificados
✅ Row Level Security (RLS) configurado
✅ Índices em campos frequentemente filtrados (city, price, status)
✅ Storage bucket para imagens dos imóveis
Frontend (React):
✅ Node.js >= 18.x
✅ React >= 18.x
✅ Supabase JS Client configurado
✅ CSS Modules ou Styled Components
Python (Opcional - Analytics):
✅ Script para gerar relatórios pesados
✅ Integração via API ou jobs agendados
📊 FEATURES AVANÇADAS (Nice to Have)
🔖 Salvar filtros favoritos (localStorage)
📥 Exportar resultados (CSV, PDF)
📊 Gráficos de análise (preço médio por cidade, etc)
🗺️ Visualização em mapa com clustering
❤️ Sistema de favoritos
📱 Responsividade completa (mobile-first)
🌙 Dark mode
📈 Comparador de imóveis (lado a lado)
✅ CHECKLIST DE IMPLEMENTAÇÃO
Fase 1 - Estrutura Base:
 Criar estrutura de pastas
 Configurar página /dashboard
 Conectar com Supabase
 Implementar fetch básico de dados
Fase 2 - Visualização:
 Criar PropertyCard component
 Implementar Grid layout
 Adicionar skeleton loaders
 Implementar paginação
Fase 3 - Filtros:
 SearchBar component
 Filtros avançados (sidebar)
 Lógica de filtragem no Supabase
 Debounce para otimização
Fase 4 - Animações:
 Integrar Framer Motion
 Animações de entrada dos cards
 Transições entre views
 Micro-interações
Fase 5 - Estatísticas:
 Calcular métricas
 Criar StatsPanel
 Adicionar gráficos (opcional)
Fase 6 - Polimento:
 Responsividade mobile
 Testes de performance
 Error handling robusto
 Documentação de código
🎓 EXEMPLO DE CÓDIGO INICIAL
usePropertyData.js (Hook Principal):
javascript


import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export const usePropertyData = (filters) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    fetchProperties();
  }, [filters]); // Re-fetch quando filtros mudarem
  
  const fetchProperties = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('properties')
        .select('*', { count: 'exact' });
      
      // Aplicar filtros dinamicamente
      if (filters.search) {
        query = query.ilike('title', `%${filters.search}%`);
      }
      
      if (filters.priceRange) {
        query = query
          .gte('price', filters.priceRange[0])
          .lte('price', filters.priceRange[1]);
      }
      
      // ... demais filtros
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      setData(data);
      setTotalCount(count);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return { data, loading, error, refetch: fetchProperties };
};
🚀 COMANDO PARA INICIAR
"Antigravity, implemente o Dashboard de Imóveis seguindo esta arquitetura. Comece pela Fase 1 e me apresente o código de cada componente conforme avançamos. Priorize organização em pequenos arquivos e muitos comentários explicativos."




---

## 📌 Observações Finais

Leonardo, este prompt está estruturado para:

1. ✅ **Modularidade Total**: Cada componente em seu arquivo, facilitando manutenção
2. ✅ **Contratos Claros**: Interfaces TypeScript definidas para entrada/saída
3. ✅ **Estado Gerenciado**: Arquitetura de estado previsível
4. ✅ **Resiliência**: Tratamento de erros em múltiplas camadas
5. ✅ **Performance**: Debounce, paginação e queries otimizadas
6. ✅ **UX Premium**: Animações, loading states e feedback visual

Quer que eu ajuste alguma parte específica do prompt ou adicione mais detalhes em alguma seção? 🎯


como faço para criar este .md para enviar para o Antigravity?
Claude Sonnet 4.5
📝 Como Criar o Arquivo .md para o Antigravity
Leonardo, vou te mostrar o passo a passo completo:

🎯 OPÇÃO 1: Criar Diretamente no Projeto (Recomendado)
Passo 1: Abra seu terminal/prompt
bash


# Navegue até a pasta raiz do seu projeto Antigravity
cd caminho/do/seu/projeto/antigravity
Passo 2: Crie a pasta de documentação (se não existir)
bash


# Criar pasta para armazenar prompts
mkdir -p docs/prompts

# ou no Windows
mkdir docs\prompts
Passo 3: Crie o arquivo
bash


# Linux/Mac
nano docs/prompts/dashboard-imoveis.md

# ou use seu editor favorito
code docs/prompts/dashboard-imoveis.md  # VS Code
vim docs/prompts/dashboard-imoveis.md   # Vim
Passo 4: Cole todo o conteúdo do prompt
Copie todo o texto que enviei anteriormente (desde # 🏗️ PROJETO: Dashboard Profissional de Imóveis até o final) e cole no arquivo.

Passo 5: Salve o arquivo
No nano: Ctrl + O (salvar), Enter, Ctrl + X (sair)
No VS Code: Ctrl + S
No Vim: :wq
🎯 OPÇÃO 2: Criar Usando VS Code (Mais Visual)
Passo 1: Abra o VS Code
bash


code .
Passo 2: No explorer lateral
Clique com botão direito na pasta raiz
Selecione "Nova Pasta" → digite docs/prompts
Clique com botão direito em prompts
Selecione "Novo Arquivo" → digite dashboard-imoveis.md
Passo 3: Cole o conteúdo
Cole todo o prompt que forneci anteriormente

Passo 4: Salve
Ctrl + S ou Cmd + S

🎯 OPÇÃO 3: Criar no Windows (Bloco de Notas)
Passo 1: Abra o Bloco de Notas
Win + R → digite notepad → Enter

Passo 2: Cole o conteúdo
Cole todo o prompt

Passo 3: Salvar como
Arquivo → Salvar Como
Navegue até a pasta do projeto
Em "Nome do arquivo" digite: dashboard-imoveis.md
Em "Tipo" selecione: Todos os arquivos (.)
Em "Codificação" selecione: UTF-8
Clique em Salvar
🎯 OPÇÃO 4: Copiar Direto (Mais Rápido)
Se o Antigravity aceita entrada de texto direta:

Método A: Copiar e Colar
Selecione todo o texto do prompt que enviei
Ctrl + C para copiar
Cole diretamente na interface do Antigravity
Envie
Método B: Usar o arquivo que vou gerar abaixo
📦 ARQUIVO PRONTO PARA DOWNLOAD
Vou criar o conteúdo completo aqui para você copiar:

markdown


# 🏗️ PROJETO: Dashboard Profissional de Imóveis

## 🎭 PAPEL DO AGENTE
Você é agora um **Especialista em Dashboards Profissionais**, com expertise em:
- Design de interfaces de dados complexos
- UX/UI para análise de informações
- Otimização de queries em grandes volumes de dados
- Visualizações interativas e responsivas
- Performance em aplicações data-intensive

---

## 🎯 OBJETIVO DO PROJETO
Criar um dashboard profissional completo para visualização e busca de imóveis cadastrados no Supabase, com interface moderna, animações fluidas e capacidades avançadas de filtragem.

---

## 🏛️ ARQUITETURA DO MÓDULO

### 📁 Estrutura de Pastas Proposta:
src/ ├── pages/ │ └── dashboard/ │ ├── index.jsx # Página principal do dashboard │ ├── Dashboard.module.css # Estilos do dashboard │ └── components/ # Componentes específicos do dashboard │ ├── SearchBar/ │ │ ├── SearchBar.jsx # Barra de busca principal │ │ ├── SearchBar.module.css │ │ └── AdvancedFilters.jsx # Filtros avançados expansíveis │ ├── PropertyGrid/ │ │ ├── PropertyGrid.jsx # Grid de cards de imóveis │ │ ├── PropertyCard.jsx # Card individual do imóvel │ │ └── PropertyGrid.module.css │ ├── DataTable/ │ │ ├── DataTable.jsx # Tabela detalhada (view alternativa) │ │ ├── TableRow.jsx # Linha customizada │ │ └── DataTable.module.css │ ├── Statistics/ │ │ ├── StatsPanel.jsx # Painel de estatísticas │ │ ├── ChartCard.jsx # Cards com gráficos │ │ └── Statistics.module.css │ └── ViewToggle/ │ └── ViewToggle.jsx # Alternar entre grid/table/map │ ├── services/ │ └── dashboard/ │ ├── propertyService.js # Serviço de comunicação com Supabase │ ├── filterService.js # Lógica de filtros e busca │ └── analyticsService.js # Cálculos e agregações │ ├── hooks/ │ └── dashboard/ │ ├── usePropertyData.js # Hook para carregar dados │ ├── useFilters.js # Hook para gerenciar filtros │ ├── usePagination.js # Hook para paginação │ └── useDebounce.js # Hook para otimizar buscas │ ├── utils/ │ └── dashboard/ │ ├── formatters.js # Formatação de valores (preço, área, etc) │ ├── validators.js # Validação de filtros │ └── exportHelpers.js # Exportar dados (CSV, PDF) │ └── api/ └── dashboard/ └── properties/ ├── route.js # Endpoint Node.js (se necessário) └── analytics.py # Script Python para análises pesadas




---

## 🔌 CONTRATOS DE INTERFACE

### Input Esperado (Supabase):
```typescript
// Estrutura da tabela 'properties' esperada:
interface Property {
  id: string;
  created_at: timestamp;
  title: string;
  description: text;
  price: decimal;
  area_size: decimal;
  bedrooms: integer;
  bathrooms: integer;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  property_type: enum ['casa', 'apartamento', 'terreno', 'comercial'];
  status: enum ['disponivel', 'vendido', 'reservado'];
  images: array<string>;
  features: jsonb;
  latitude: decimal;
  longitude: decimal;
  owner_id: uuid;
}
Output de Filtros:
typescript


interface FilterParams {
  search: string;              // Busca textual geral
  priceRange: [min, max];      // Faixa de preço
  areaRange: [min, max];       // Faixa de área
  bedrooms: number[];          // Array de qtd de quartos
  bathrooms: number[];         // Array de qtd de banheiros
  propertyTypes: string[];     // Tipos de imóvel
  status: string[];            // Status do imóvel
  cities: string[];            // Cidades
  features: string[];          // Características (piscina, garagem, etc)
  sortBy: string;              // Campo de ordenação
  sortOrder: 'asc' | 'desc';   // Direção da ordenação
  page: number;                // Página atual
  limit: number;               // Itens por página
}
🎨 ESPECIFICAÇÕES DE DESIGN
Componentes Obrigatórios:
Header do Dashboard
Logo/título
Estatísticas rápidas (total de imóveis, valor médio, etc)
Ações globais (exportar, adicionar novo)
Barra de Busca Inteligente
Search input com autocomplete
Sugestões em tempo real
Filtros rápidos (chips clicáveis)
Botão para filtros avançados
Painel de Filtros Avançados
Sidebar ou modal colapsável
Range sliders para preço e área
Checkboxes para múltiplas seleções
Mapa de calor para localização (se possível)
Botão "Limpar filtros"
Visualização dos Dados
Grid View: Cards com imagens e info resumida
Table View: Tabela completa com todas colunas
Map View: Mapa com pins dos imóveis (opcional)
Cards de Imóvel
Imagem principal (carousel nas demais)
Título e preço destacados
Ícones com info rápida (quartos, banheiros, área)
Badge de status
Botões de ação (ver detalhes, favoritar)
Hover effects com animações suaves
Paginação/Scroll Infinito
Escolher entre paginação tradicional ou infinite scroll
Indicador de loading durante carregamento
🎭 ANIMAÇÕES E INTERATIVIDADE (React)
Bibliotecas Sugeridas:
json


{
  "framer-motion": "^11.x",          // Animações fluidas
  "react-spring": "^9.x",            // Animações baseadas em física
  "@tanstack/react-table": "^8.x",   // Tabela poderosa
  "recharts": "^2.x",                // Gráficos para estatísticas
  "react-map-gl": "^7.x",            // Mapa (se usar)
  "react-select": "^5.x",            // Selects avançados
  "react-range": "^1.x"              // Range sliders
}
Animações Obrigatórias:
✨ Fade-in ao carregar cards (stagger animation)
🔄 Skeleton loaders durante carregamento
🎯 Smooth scroll ao navegar
💫 Hover effects nos cards (scale, shadow)
🌊 Transições suaves entre views
🎨 Loading states animados
⚡ Micro-interações em botões e filtros
🔧 GESTÃO DE ESTADO
Estado Global (Context ou Zustand):
javascript


// dashboardStore.js
{
  properties: [],           // Lista de imóveis
  filters: FilterParams,    // Filtros ativos
  viewMode: 'grid',        // grid | table | map
  isLoading: boolean,      // Estado de carregamento
  error: string | null,    // Erros
  pagination: {
    page: number,
    totalPages: number,
    totalItems: number
  },
  statistics: {
    total: number,
    avgPrice: number,
    avgArea: number,
    byType: object
  }
}
Estado Local (useState):
Estados de UI temporários (modals, tooltips)
Estados de formulários
Estados de animação
🚀 LÓGICA DE ORQUESTRAÇÃO
Fluxo Principal:
Inicialização


useEffect → carregar dados iniciais do Supabase
→ calcular estatísticas
→ renderizar com skeleton
Aplicação de Filtros


Usuário altera filtro
→ useDebounce (300ms)
→ construir query Supabase
→ executar busca com .select() + .filter()
→ atualizar estado
→ animar transição
Busca Textual


Input de busca
→ debounce
→ .textSearch() ou .ilike() no Supabase
→ destacar termos encontrados
Paginação


Usuário muda página
→ calcular .range(from, to)
→ fetch nova página
→ scroll to top suave
🛡️ RESILIÊNCIA E ERROR HANDLING
Tratamento de Erros:
javascript


// Camadas de erro:
try {
  // 1. Validação de filtros
  validateFilters(filters);
  
  // 2. Query Supabase
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .filter(/* ... */);
  
  if (error) throw error;
  
  // 3. Validação de resposta
  if (!data || data.length === 0) {
    return showEmptyState();
  }
  
  return data;
  
} catch (error) {
  // Logging
  console.error('[Dashboard Error]:', error);
  
  // Fallback UI
  showErrorToast('Erro ao carregar imóveis. Tente novamente.');
  
  // Retry mechanism (opcional)
  if (retryCount < 3) {
    setTimeout(() => fetchProperties(), 2000);
  }
}
Estados de Loading:
Initial Load: Skeleton screens
Filter Change: Overlay transparente + spinner
Pagination: Loading na parte inferior
Error State: Mensagem amigável + botão retry
🎯 DEPENDÊNCIAS DO MÓDULO
Backend (Supabase):
✅ Tabela properties com campos especificados
✅ Row Level Security (RLS) configurado
✅ Índices em campos frequentemente filtrados (city, price, status)
✅ Storage bucket para imagens dos imóveis
Frontend (React):
✅ Node.js >= 18.x
✅ React >= 18.x
✅ Supabase JS Client configurado
✅ CSS Modules ou Styled Components
Python (Opcional - Analytics):
✅ Script para gerar relatórios pesados
✅ Integração via API ou jobs agendados
📊 FEATURES AVANÇADAS (Nice to Have)
🔖 Salvar filtros favoritos (localStorage)
📥 Exportar resultados (CSV, PDF)
📊 Gráficos de análise (preço médio por cidade, etc)
🗺️ Visualização em mapa com clustering
❤️ Sistema de favoritos
📱 Responsividade completa (mobile-first)
🌙 Dark mode
📈 Comparador de imóveis (lado a lado)
✅ CHECKLIST DE IMPLEMENTAÇÃO
Fase 1 - Estrutura Base:
 Criar estrutura de pastas
 Configurar página /dashboard
 Conectar com Supabase
 Implementar fetch básico de dados
Fase 2 - Visualização:
 Criar PropertyCard component
 Implementar Grid layout
 Adicionar skeleton loaders
 Implementar paginação
Fase 3 - Filtros:
 SearchBar component
 Filtros avançados (sidebar)
 Lógica de filtragem no Supabase
 Debounce para otimização
Fase 4 - Animações:
 Integrar Framer Motion
 Animações de entrada dos cards
 Transições entre views
 Micro-interações
Fase 5 - Estatísticas:
 Calcular métricas
 Criar StatsPanel
 Adicionar gráficos (opcional)
Fase 6 - Polimento:
 Responsividade mobile
 Testes de performance
 Error handling robusto
 Documentação de código
🎓 EXEMPLO DE CÓDIGO INICIAL
usePropertyData.js (Hook Principal):
javascript


import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export const usePropertyData = (filters) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    fetchProperties();
  }, [filters]); // Re-fetch quando filtros mudarem
  
  const fetchProperties = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('properties')
        .select('*', { count: 'exact' });
      
      // Aplicar filtros dinamicamente
      if (filters.search) {
        query = query.ilike('title', `%${filters.search}%`);
      }
      
      if (filters.priceRange) {
        query = query
          .gte('price', filters.priceRange[0])
          .lte('price', filters.priceRange[1]);
      }
      
      // ... demais filtros
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      setData(data);
      setTotalCount(count);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return { data, loading, error, refetch: fetchProperties };
};
🚀 COMANDO PARA INICIAR
"Antigravity, implemente o Dashboard de Imóveis seguindo esta arquitetura. Comece pela Fase 1 e me apresente o código de cada componente conforme avançamos. Priorize organização em pequenos arquivos e muitos comentários explicativos."




---
