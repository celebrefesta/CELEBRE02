# 👑 SISTEMA CELEBRE — MANUAL TÉCNICO & RESUMO DETALHADO DO SISTEMA

> **Celebre - Sistema Especializado em Gestão de Festas, Eventos e Locação de Acervo**  
> *Documento técnico e operacional definitivo cobrindo 100% dos módulos, páginas, abas, fluxos e componentes do sistema.*

---

## 📑 SUMÁRIO EXECUTIVO

1. [Visão Geral e Arquitetura Tecnológica](#1-visão-geral-e-arquitetura-tecnológica)
2. [Modelagem de Dados & Coleções Firestore](#2-modelagem-de-dados--coleções-firestore)
3. [Navegação e Layout Base](#3-navegação-e-layout-base)
4. [Detalhamento de Módulos e Páginas](#4-detalhamento-de-módulos-e-páginas)
   - [4.1 Dashboard Principal (`/dashboard`)](#41-dashboard-principal-dashboard)
   - [4.2 Gestão de Locações (`/locacoes`)](#42-gestão-de-locações-locacoes)
   - [4.3 Gestão de Clientes (`/clientes`)](#43-gestão-de-clientes-clientes)
   - [4.4 Estoque e Acervo (`/estoque`)](#44-estoque-e-acervo-estoque)
   - [4.5 Financeiro & Fluxo de Caixa (`/financeiro`)](#45-financeiro--fluxo-de-caixa-financeiro)
   - [4.6 Compras e Reposições (`/compras`)](#46-compras-e-reposições-compras)
   - [4.7 Fornecedores (`/fornecedores`)](#47-fornecedores-fornecedores)
   - [4.8 Agenda de Eventos (`/agenda`)](#48-agenda-de-eventos-agenda)
   - [4.9 Logística & Carregamento (`/logistica`)](#49-logística--carregamento-logistica)
   - [4.10 Contratos Digitais & Assinatura (`/contratos`)](#410-contratos-digitais--assinatura-contratos)
   - [4.11 Moodboard & Projetos Visuais (`/moodboard`)](#411-moodboard--projetos-visuais-moodboard)
   - [4.12 Catálogo Virtual & Vitrine (`/catalogo`)](#412-catálogo-virtual--vitrine-catalogo)
   - [4.13 Relatórios & Inteligência de Negócio (`/relatorios`)](#413-relatórios--inteligência-de-negócio-relatorios)
   - [4.14 Configurações do Sistema (`/configuracoes`)](#414-configurações-do-sistema-configuracoes)
   - [4.15 Central de Notificações (`/notificacoes`)](#415-central-de-notificações-notificacoes)
   - [4.16 Equipe & Controle ASO (`/Usuarios`)](#416-equipe--controle-aso-usuarios)
   - [4.17 Planos, Assinaturas & Painel Admin (`/planos` / `/admin`)](#417-planos-assinaturas--painel-admin-planos--admin)
5. [Workflows Operacionais Integrados](#5-workflows-operacionais-integrados)
6. [Regramento de Blindagem de Layout & UI/UX](#6-regramento-de-blindagem-de-layout--uiux)

---

## 1. VISÃO GERAL E ARQUITETURA TECNOLÓGICA

O **Sistema Celebre** foi desenvolvido para resolver as dores operacionais diárias de decoradoras de festas, galpões de locação de acervos e empresas do segmento "Pegue e Monte".

### 🛠️ Stack Tecnológica:
- **Core Frontend**: React 18+ impulsionado por **Vite** para compilação ultrarrápida.
- **Roteamento**: `react-router-dom` v6 com rotas dinâmicas, controle de estado de navegação e guardas de segurança.
- **Backend as a Service (BaaS)**: **Firebase**
  - *Firestore Database*: Banco de dados NoSQL em tempo real.
  - *Firebase Authentication*: Autenticação via e-mail/senha.
  - *Firebase Storage*: Armazenamento de imagens de produtos, fotos de avarias, comprovantes e contratos.
- **Visualização de Dados**: `recharts` (Gráficos de Área, Barras e Donut responsivos).
- **Estilização**: Vanilla CSS 3 modularizado com CSS Variables (Design System Enterprise com suporte nativo a responsividade mobile e dark/light tokens).
- **Geração de Documentos**: HTML5 Canvas e utilitários para impressão térmica e exportação em PDF.

### 🛡️ Arquitetura de Segurança & Multitenancy:
- **Isolamento de Dados (Multitenancy)**: Todos os documentos gravados nas coleções contêm a chave `tenantId`. Consultas Firestore utilizam obrigatoriamente `where('tenantId', '==', tenantId)`, garantindo isolamento total entre diferentes empresas.
- **Guardiões de Rota (`App.jsx`)**:
  - `RotaPrivada`: Exige autenticação de usuário ativo.
  - `RotaAdmin`: Restringe acesso a funções exclusivas do Super Admin.
  - `TravaSeguranca`: Componente de validação dupla que checa permissões por módulo (`Financeiro`, `Relatorios`, `Equipe`) para perfis de funcionários.

---

## 2. MODELAGEM DE DADOS & COLEÇÕES FIRESTORE

O sistema opera sobre um ecossistema NoSQL organizado nas seguintes coleções principais:

1. `locacoes`: Armazena dados de contratos, orçamentos, cliente associado, intervalo de datas (retirada, evento, devolução), tipo de serviço (Pegue e Monte vs. Decoração), lista de itens locados, valores (frete, desconto, sinal, caução, total), status e controle de devolução/avarias.
2. `clientes`: Registro de clientes com nome, CPF/CNPJ, WhatsApp, e-mail, endereço completo com CEP e notas de relacionamento.
3. `estoque`: Catálogo do acervo. Guarda SKU, nome, categoria, quantidade total, quantidade disponível, valor de locação, valor de reposição, dimensões, cor, estado e galeria de fotos.
4. `financeiro`: Registros de entradas (locações, vendas) e saídas (aluguel do galpão, pessoal, manutenção, compras), data de vencimento, data de pagamento, categoria e anexo.
5. `compras`: Aquisições de peças de acervo e insumos (balões, fitas, embalagens) com vinculação a fornecedores.
6. `fornecedores`: Parceiros comerciais, artesãos, marceneiros e freteiros.
7. `contratos`: Minutas de contratos e instâncias de contratos assinados digitalmente.
8. `equipe`: Cadastro de colaboradores da empresa, seus cargos e mapa de permissões granulares por módulo.
9. `configuracoes`: Parâmetros da empresa (logo, chave PIX, endereço, margem de bloqueio de estoque).
10. `notificacoes`: Alertas do sistema referentes a atrasos e tarefas do dia.

---

## 3. NAVEGAÇÃO E LAYOUT BASE

O layout é composto por três estruturas globais:

- **`Navbar.jsx` (Menu Lateral / Drawer Mobile)**:
  - Navegação expansível com ícones para todos os módulos.
  - Exibição do plano ativo da empresa.
  - Badges de notificações em tempo real.
- **`Topbar.jsx` (Barra Superior)**:
  - Identificação da empresa e do usuário logado.
  - Atalho rápido de busca e central de notificações (`SininhoNotificacoes.jsx`).
  - Botão de logout seguro.
- **`SininhoNotificacoes.jsx`**:
  - Popover inteligente com alertas de locações a saírem hoje, devoluções vencendo ou atrasadas.

---

## 4. DETALHAMENTO DE MÓDULOS E PÁGINAS

---

### 4.1 Dashboard Principal (`/dashboard`)
Página central de inteligência e controle de fluxo do negócio.

- **KPIs do Topo**:
  - *Faturamento do Mês*: Soma das receitas confirmadas no período.
  - *Total a Receber*: Saldo pendente em aberto de contratos em andamento.
  - *Pedidos no Mês*: Quantidade total de locações criadas.
  - *Taxa de Conversão*: Percentual de orçamentos convertidos em contratos fechados.
- **Gráficos Analíticos**:
  - *Evolução do Faturamento*: Gráfico de Área comparativo mensal.
  - *Status dos Pedidos*: Gráfico Donut (Em Processo, Confirmados, Orçamentos, Concluídos).
  - *Tipos de Serviço*: Comparativo gráfico entre Pegue e Monte e Decoração Completa.
- **Componente de Auditoria (`AuditoriaEstoque.jsx`)**:
  - Painel secundário que identifica itens com alta taxa de quebra, peças sem giro e necessidade de reposição de acervo.

---

### 4.2 Gestão de Locações (`/locacoes`)
O coração operacional do sistema Celebre.

#### A. Painel Principal de Locações (`Locacoes.jsx`)
- **KPIs Operacionais**:
  - *Locações Ativas*, *Orçamentos Futuros*, *Total a Receber*, *Confirmados/Contratados*.
- **⚡ Chips Rápidos de Operação do Dia**:
  - 🚚 **`SAEM HOJE`**: Filtra em 1 clique pedidos com saída/retirada agendada para o dia atual.
  - 📦 **`ENTRAM HOJE`**: Filtra pedidos com devolução prevista para hoje.
  - ⚠️ **`ATRASADOS`**: Alerta vermelho de devoluções vencidas não realizadas.
- **Pílulas de Status**:
  - *Em Processo*, *Orçamentos*, *Confirmados*, *Arquivados*, *Lixeira / Perdidos*.
- **Sub-filtros**:
  - Seletor de Data Específica do Evento, Período (Hoje, Fim de Semana, Este Mês), Tipo de Serviço (Pegue e Monte vs. Decoração) e Ordenação (Mais Recente, Valor).
- **Tabela de Locações**:
  - Exibe ID do Pedido, Nome do Cliente, Data do Evento, Tipo de Serviço, Valor Total, Saldo Pendente e Badge de Status.
  - **Ações Contextuais**: *Ver Detalhes*, *Editar*, *Romaneio*, *Checkout (Entrega)*, *Checkin (Devolução)*, *WhatsApp* e *Excluir*.

#### B. Nova Locação (`/locacoes/nova` - `NovaLocacao.jsx`)
- Workflow em 4 etapas:
  1. **Dados do Cliente & Evento**: Seleção de cliente cadastrado ou gatilho de Auto-Cadastro, definição de data/hora de retirada, data do evento e data/hora de devolução.
  2. **Seleção de Acervo & Checagem de Disponibilidade**: Seleção de peças com verificador automático de saldo de estoque para as datas escolhidas (impede reserva duplicada).
  3. **Precificação e Condições**: Definição de frete, aplicação de desconto, valor de caução, valor de sinal e parcelamento.
  4. **Emissão da Proposta**: Geração de proposta comercial em PDF ou formato otimizado para WhatsApp.

#### C. Editar Locação (`/locacoes/editar/:id` - `EditarLocacao.jsx`)
- Permite alterar itens locados, ajustar datas, registrar recebimentos parciais e atualizar o status do pedido.

#### D. Matriz de Disponibilidade (`ModalCalendarioDisponibilidade.jsx`)
- Grade visual em formato de calendário que exibe dia a dia a ocupação e reservas de cada item do acervo.

#### E. Romaneio de Separação de Galpão (`ModalRomaneioSeparacao.jsx`)
- Gerador de lista de conferência para a equipe de galpão e montagem:
  - Suporte a Impressão Térmica 80mm e Impressão A4.
  - Envio do romaneio formatado no WhatsApp com checkboxes `✅` e `⏳`.
  - Assinaturas de conferência de saída.

#### F. Processos de Checkout e Checkin (`CheckoutPage.jsx` & `CheckinPage.jsx` / `ModalCheckinLocacao.jsx`)
- **Checkout (Saída)**: Registro da saída do produto com fotos e termo de entrega.
- **Check-in (Devolução)**: Conferência no retorno das peças. Registro de itens avariados ou faltantes, cálculo automático de cobrança por avaria baseado no valor de reposição e liberação do saldo de caução.

---

### 4.3 Gestão de Clientes (`/clientes`)

- **Painel de Clientes (`Clientes.jsx`)**:
  - Cards com Total de Clientes, Novos no Mês, Clientes VIP e Taxa de Adimplência.
  - Tabela completa com pesquisa em tempo real por Nome, CPF/CNPJ, WhatsApp ou Cidade.
- **Cadastro de Cliente (`CadastroCliente.jsx`)**:
  - Formulário completo com consulta de CEP automática, redes sociais, preferências de festas e notas internas.
- **Histórico do Cliente (`HistoricoCliente.jsx`)**:
  - Ficha individual mostrando todo o histórico de aluguéis do cliente, valor total transacionado e nível de fidelidade.
- **Auto-Cadastro Público (`AutoCadastro.jsx`)**:
  - Link externo que pode ser enviado pelo WhatsApp para o cliente preencher seus próprios dados cadastrais.

---

### 4.4 Estoque e Acervo (`/estoque`)

- **Painel de Estoque (`Estoque.jsx`)**:
  - KPIs: Total de Itens, Valor Total do Acervo (R$), Peças em Manutenção e Total de Categorias.
  - Alternância de Visualização: **Grade Visual com Fotos das Peças** vs. **Tabela Detalhada**.
  - Filtros por Categorias (Móveis, Painéis, Louças, Suportes, Iluminação, etc.) e Status (Disponível, Em Manutenção, Avariado).
- **Cadastro & Edição de Estoque (`CadastroEstoque.jsx`)**:
  - Upload de galeria de fotos do produto.
  - Dados: Código SKU/Interno, Nome, Categoria, Quantidade Total no Galpão.
  - Precificação: Valor de Locação (R$) e Valor de Reposição/Quebra (R$).
  - Especificações: Dimensões (AxLxP), Cor, Material, Peso e Cuidados Especiais.

---

### 4.5 Financeiro & Fluxo de Caixa (`/financeiro`)

- **Painel Financeiro (`Financeiro.jsx`)**:
  - KPIs: Saldo Atual em Caixa, Receitas do Mês, Despesas do Mês e Lucro Líquido.
  - Gráficos de Fluxo de Caixa (Entradas vs. Saídas).
  - Tabela de Lançamentos com busca e filtros por status (Pago, Pendente, Atrasado), categoria e centro de custo.
  - Liquidação de lançamentos em 1 clique.
- **Novo Lançamento (`NovoLancamento.jsx` / `Novolancamento.css`)**:
  - Registro de receitas operacionais ou despesas (aluguel, energia, pessoal, frete) com anexo de comprovantes.

---

### 4.6 Compras e Reposições (`/compras`)

- **Gestão de Compras (`Compras.jsx`)**:
  - Registro de compras de reposição de acervo avariado, investimento em novos temas e aquisição de descartáveis/insumos.
- **Nova Compra (`NovaCompra.jsx`)**:
  - Lançamento de nota/pedido de compra vinculado ao fornecedor, forma de pagamento e impacto automático no caixa financeiro.

---

### 4.7 Fornecedores (`/fornecedores`)

- **Painel de Fornecedores (`Fornecedores.jsx`)**:
  - Cadastro de parceiros, marceneiros, pintores, freteiros, fornecedores de louças e balões.
- **Novo Fornecedor (`NovoFornecedor.jsx`)**:
  - Formulário com razão social, contato do vendedor, condições de pagamento e especialidade.

---

### 4.8 Agenda de Eventos (`/agenda`)

- **Calendário da Decora (`Agenda.jsx`)**:
  - Calendário interativo com modos Mês, Semana e Dia.
  - Marcadores coloridos diferenciando:
    - 🚚 *Data de Retirada/Entrega*
    - 🎉 *Data da Festa/Evento*
    - 📦 *Data de Devolução/Recolhe*
  - Filtro rápido por tipo de serviço (Pegue e Monte vs. Decoração).

---

### 4.9 Logística & Carregamento (`/logistica`)

- **Painel Logístico (`Logistica.jsx`)**:
  - Organização diária das rotas de entrega e recolhimento.
  - Divisão entre *Entregas da Equipe* vs. *Retiradas de Clientes no Galpão*.
  - Atribuição de motorista e veículos para cada rota.
  - Emissão da Lista de Carregamento do Caminhão.

---

### 4.10 Contratos Digitais & Assinatura (`/contratos`)

- **Gerenciador de Contratos (`Contratos.jsx`)**:
  - Painel de contratos gerados, assinados e pendentes de assinatura.
- **Modelos de Contrato (`ModelosContrato.jsx`)**:
  - Criador e editor de minutas padrão com substituição dinâmica de tags:
    - `{NOME_CLIENTE}`, `{CPF_CLIENTE}`, `{VALOR_TOTAL}`, `{DATA_EVENTO}`, `{LISTA_ITENS}`, `{VALOR_CAUCAO}`.
- **Assinatura Digital (`AssinaturaContrato.jsx`)**:
  - Interface touch/mouse para o cliente assinar o contrato digitalmente via celular ou tablet.
- **Visualizador (`VisualizarContrato.jsx`)**:
  - Exibição e exportação do documento final assinado em PDF.

---

### 4.11 Moodboard & Projetos Visuais (`/moodboard`)

- **Mural Criativo de Projetos (`Moodboard.jsx`)**:
  - Tela interativa estilo "canvas" para decoradoras combinarem peças do acervo, móveis, arranjos e balões.
  - Definição da paleta de cores do evento.
  - Exportação da prancha visual do projeto para envio junto com a proposta comercial.

---

### 4.12 Catálogo Virtual & Vitrine (`/catalogo`)

- **Vitrine Virtual (`Catalago.jsx` & `catalogoDeTemas.js`)**:
  - Galeria de acervos e temas prontos organizada para clientes navegarem.
  - Botão de "Adicionar ao Orçamento" que gera o carrinho e direciona a solicitação para o WhatsApp da empresa.

---

### 4.13 Relatórios & Inteligência de Negócio (`/relatorios`)

Dividido em 4 abas analíticas avançadas:

1. **Aba Pedidos (`PedidosTab.jsx`)**: Taxa de conversão de orçamentos, ticket médio por contrato e volume por período.
2. **Aba Estoque (`EstoqueTab.jsx`)**: Curva ABC de peças mais rentáveis, índice de peças ociosas sem locação e histórico de quebras.
3. **Aba Financeiro (`FinanceiroTab.jsx`)**: DRE simplificado, demonstrativo de entradas por meio de pagamento (PIX, Cartão, Dinheiro) e controle de inadimplência.
4. **Aba Clientes (`ClientesTab.jsx`)**: Ranking dos maiores clientes, taxa de recompra e origem dos contatos (Instagram, Google, Indicação).

---

### 4.14 Configurações do Sistema (`/configuracoes`)

- **Aba Empresa (`AbaEmpresa.jsx`)**: Razão social, CNPJ, WhatsApp comercial, Upload do Logo, Chave PIX padrão e endereço do galpão.
- **Aba Meu Perfil (`AbaMeuPerfil.jsx`)**: Dados do usuário, e-mail e redefinição de senha.
- **Aba Catálogo & Estoque (`AbaCatalogoEstoque.jsx`)**: Personalização de categorias e definição de dias de margem para bloqueio de acervo.
- **Aba Aparência (`AbaAparencia.jsx`)**: Ajustes de tema e identidade visual da plataforma.
- **Aba Equipe & Segurança (`AbaSeguranca.jsx`)**: Cadastro de colaboradores e gestão de permissões granulares por módulo.
- **Aba Assinatura & Uso (`AbaAssinaturaUso.jsx`)**: Informações sobre o plano ativo do Celebre.
- **Aba Backup (`AbaBackup.jsx`)**: Exportação e cópia de segurança dos dados da conta.

---

### 4.15 Central de Notificações (`/notificacoes`)

- **Notificações (`Notificacoes.jsx`)**: Central de alertas do sistema sobre devoluções atrasadas, cobranças pendentes e lembretes de estoque.

---

### 4.16 Equipe & Controle ASO (`/Usuarios`)

- **Gestão de Usuários (`Usuarios.jsx`)**: Gerenciamento de acessos da equipe de galpão e atendimento.
- **Monitoramento de Ações (`Monitoramento.jsx`)**: Log de auditoria de alterações realizadas por colaboradores no sistema.
- **Gestão ASO (`GestaoASO.jsx`)**: Controle de atestados e exames ocupacionais da equipe.

---

### 4.17 Planos, Assinaturas & Painel Admin (`/planos` / `/admin`)

- **Planos & Upgrades (`Planos.jsx` & `PaginaUpgrade.jsx`)**: Apresentação dos planos SaaS do Celebre (Básico, Pro, Enterprise).
- **Admin Planos (`AdminPlanos.jsx`)**: Gestão de planos e benefícios.
- **Controle Geral Super Admin (`ControleGeral.jsx`)**: Painel do administrador do sistema para gestão de tenants e assinaturas ativas.

---

## 5. WORKFLOWS OPERACIONAIS INTEGRADOS

O fluxo padrão de atendimento no Celebre obedece ao seguinte ciclo:

```mermaid
graph TD
    A[Atendimento Inicial / Catálogo Virtual] --> B[Geração de Orçamento em Nova Locação]
    B --> C[Checagem Automática de Disponibilidade de Estoque]
    C --> D[Envio da Proposta Comercial via WhatsApp/PDF]
    D --> E[Aprovação do Cliente & Assinatura do Contrato Digital]
    E --> F[Locação Confirmada & Reserva de Estoque Efetuada]
    F --> G[Geração do Romaneio de Separação de Galpão]
    G --> H[Checkout / Registro de Saída das Peças]
    H --> I[Realização do Evento]
    I --> J[Checkin / Confeferência de Retorno das Peças]
    J -->|Sem Avarias| K[Devolução de Caução & Finalização]
    J -->|Com Avarias| L[Lançamento de Taxa de Reposição & Fechamento]
```

---

## 6. REGRAMENTO DE BLINDAGEM DE LAYOUT & UI/UX

1. **Regra de Ouro dos Cards KPI no Celular**:
   - A classe `.clientes-stats-grid` em todas as páginas (`Locacoes`, `Clientes`, `Estoque`, `Compras`) mantém obrigatoriamente **2 colunas simétricas no mobile (`repeat(2, 1fr) !important`)**, prevenindo quebras em 1 coluna.
2. **Harmonia de Espaçamento e Respiro**:
   - Containers e botões utilizam paddings e gaps proporcionais para garantir clareza visual sem poluição de tela.
3. **Identidade Visual Celebre**:
   - Paleta de cores baseada em Dourado Premium (`#c5a059`), Cinza Slate (`#0f172a`), com acentos de status em Esmeralda, Âmbar e Rosa.

---

*Manual técnico gerado e atualizado para o repositório Celebre.*
