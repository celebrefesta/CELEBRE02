# 🚀 SISTEMA CELEBRE — RESUMO EXECUTIVO (EXECUTIVE SUMMARY)

> **Plataforma SaaS Especializada em Gestão de Locação de Acervo, Decoração e Pegue & Monte**  
> *Visão geral estratégica, tecnológica e operacional para tomada de decisão e auditoria de software.*

---

## 📊 1. VISÃO GERAL DO PRODUTO

O **Sistema Celebre** é uma plataforma SaaS multitenant projetada sob medida para empresas de locação de acervos decorativos, galpões de festas e decoradoras de eventos ("Pegue e Monte"). A plataforma resolve o desafio crítico de conflito de datas de acervo (overbooking), controle financeiro de cauções, romaneio de expedição/devolução e gestão de compras e fornecedores.

### 💰 Proposta de Valor & Diferenciais Competitivos
- **Zero Conflito de Estoque**: Verificação em tempo real por intervalo de datas (retirada, evento, devolução).
- **Checkout & Checkin de Galpão**: Romaneio com conferência por código de barras/QR e registro visual de avarias com fotos.
- **Workflow de Compras & Logística**: Módulo de aquisição com simulador dinâmico de prazos de entrega (Mercado Livre Full, Sedex, Shopee e Compras Locais).
- **Assinatura Digital de Contratos**: Link direto via WhatsApp para o cliente assinar no celular, com validade jurídica e geração instantânea de PDF.
- **Design System SaaS Premium**: Interface escura/dourada ("Dashboard SaaS Dark Hero") inspirada nas melhores plataformas globais.

---

## 🛠️ 2. ARQUITETURA TÉCNICA & ARSENAL TECNOLÓGICO

```
[ Frontend: React 18 + Vite ] ──► [ React Router v6 ] ──► [ Vanilla CSS Design System ]
                                       │
                                       ▼
                     [ BaaS: Firebase (Firestore, Auth, Storage) ]
                                       │
                                       ▼
                   [ Multitenancy: Isolamento por tenantId ]
```

| Camada | Tecnologia | Função / Objetivo |
| :--- | :--- | :--- |
| **Core Frontend** | React 18.x + Vite 7.x | Single Page Application (SPA) ultra-responsiva com build rápido |
| **BaaS / Data Layer** | Firebase Firestore | Banco NoSQL em tempo real com consultas otimizadas |
| **Autenticação** | Firebase Auth | Autenticação por e-mail/senha com controle de sessão atenta |
| **Arquivos & Mídia** | Firebase Storage | Armazenamento de fotos de produtos, avarias e comprovantes |
| **Gráficos & BI** | Recharts | Dashboards analíticos com curva ABC, DRE e métricas de conversão |
| **Exportação** | Canvas / PDF Engine | Romaneios, orçamentos, contratos e listas de compras em PDF/WhatsApp |

---

## 🏛️ 3. MODELO DE DADOS & SEGURANÇA MULTITENANT

O sistema implementa **Multitenancy Estrito** em todas as operações de banco de dados. Cada empresa registrada possui um identificador único (`tenantId`).

### Coleções Principais:
1. `locacoes` — Contratos, orçamentos, itens reservados, cauções e status de entrega/devolução.
2. `estoque` — Catálogo de peças, kits, categorias, valores de locação e reposição, fotos e status.
3. `clientes` — Base de clientes com histórico de locações, hábitos de consumo e contatos.
4. `compras` — Ordens de compra com vinculação a fornecedores, prazos de entrega e canal (Online/Presencial).
5. `fornecedores` — Cadastro de parceiros comerciais, e-commerces, marceneiros e freteiros.
6. `financeiro` — Entradas e saídas operacionais, fluxo de caixa, DRE e controle de inadimplência.
7. `equipe` / `logs_atividades` — Controle de permissões granulares por cargo e auditoria completa de ações.

---

## ⭐️ 4. DESTAQUES DE MÓDULOS E REVOLUÇÃO RECENTE DE UI/UX

### 🛒 Módulo de Nova Compra (`/compras/nova`) — Redesign SaaS Premium
- **Estrutura Reordenada Sequencialmente**:
  1. `🎯 Para quem é esta compra?` — Alternância clara entre *Reposição de Acervo* (Estoque Geral) e *Pedido Específico* (Vínculo direto com evento do cliente e validação automática de prazo).
  2. `📦 O que será comprado?` — Nome, quantidade, categoria, formato (Unidade vs Kit) e visualização de valores.
  3. `🚚 Onde e como comprar?` — Toggle *Online vs Presencial*, loja/e-commerce e modalidade de frete.
- **Grids Adaptativos & Blindagem Responsiva**:
  - Campos financeiros (`Custo Unitário` + `Aluguel`) alinhados lado a lado em 2 colunas horizontais limpas.
  - Logística adaptativa com classe `.nc-grid-logistica` garantindo visualização impecável em telas mobile sem overflow horizontal.
  - **Modal de Fornecedores Cadastrados** com busca em tempo real e atalhos rápidos (*Mercado Livre*, *Shopee*, *Festas e Chocolate*, *Armarinho Fernando*).

### 📋 Módulo de Estoque e Galpão (`/estoque`)
- KPI Grid Blindado em 1 linha no desktop e 2 colunas simétricas no celular.
- Filtro inteligente por disponibilidade de data, categoria e busca instantânea.
- Controle de avarias e fotos de avaria registradas no devolução.

### 📑 Módulo de Locações (`/locacoes`)
- Tabela e cards organizados por status: *Orçamento*, *Confirmado*, *Em Preparação*, *Em Trânsito*, *Concluído*, *Cancelado*.
- Impressão de Romaneio Térmico / A4 para equipe de carregamento de caminhão.

---

## 🔒 5. REGRAS DE BLINDAGEM DE LAYOUT & COMPLIANCE (AGENTS.MD)

O projeto possui regras de layout ativas para garantir estabilidade visual contínua:
1. **Cards KPI no Desktop (`> 900px`)**: A classe `.clientes-stats-grid` em todas as telas mantém obrigatoriamente **1 única linha horizontal (`flex-wrap: nowrap !important; display: flex !important;`)**.
2. **Cards KPI no Celular (`<= 900px`)**: A classe `.clientes-stats-grid` mantém obrigatoriamente **2 colunas (`grid-template-columns: repeat(2, 1fr) !important;`)**.
3. **Prevenção de Horizontal Overflow**: Todos os inputs, grids e containers contêm `min-width: 0` e `box-sizing: border-box` ativado.

---

## 📈 6. PRÓXIMOS PASOS & ROADMAP ESTRATÉGICO

1. **Integração WhatsApp Business API**: Envio de confirmação e lembrete automático de devolução via API oficial.
2. **Gateway de Pagamento PIX Nativo**: Baixa automática de pagamentos no módulo financeiro assim que o cliente paga o PIX.
3. **App Mobile PWA de Galpão**: Leitor de QR Code para conferência acelerada na entrada e saída do caminhão.

---
*Resumo Executivo atualizado e validado para a versão de produção do Sistema Celebre.*
