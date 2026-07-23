# 🏆 RESUMO EXECUTIVO DO SISTEMA — CELEBRE DECORAÇÕES

> **Sistema de Gestão Completo para Empresa de Locação de Decoração de Festas**
> Tech Stack: React + Vite · Firebase Firestore · Firebase Auth · Firebase Storage
> Atualizado em: 23/07/2026

---

## 📦 ARQUITETURA GERAL

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Vite 7 |
| Banco de Dados | Firebase Firestore (Multi-tenant por `userId`) |
| Autenticação | Firebase Auth (Email/Senha) |
| Armazenamento | Firebase Storage (fotos de clientes, produtos) |
| Roteamento | React Router v6 |
| Ícones | Font Awesome 6 |
| CSS | Vanilla CSS com variáveis de tema dinâmico |

---

## 🗂️ MÓDULOS DO SISTEMA (21 Páginas + Componentes)

### 🔐 AUTENTICAÇÃO (`/src/pages/Auth/`)
- **Login.jsx** — Tela de login com email/senha, recuperação de senha
- **Cadastro.jsx** — Cadastro de nova empresa com plano inicial
- **RedefinirSenha.jsx** — Redefinição de senha via Firebase Auth
- Multi-tenant: cada empresa tem seu próprio `userId`/`tenantId` isolando dados no Firestore

---

### 📊 DASHBOARD (`/src/pages/Dashboard/`)
- **Dashboard.jsx** — Painel principal com:
  - KPIs financeiros: Receita mensal, contratos ativos, receita a receber, taxa de inadimplência
  - Gráficos de contratos por mês
  - **🎂 Aniversariantes do Mês** com botões de envio por Email e/ou WhatsApp
  - Acesso rápido às auditorias
- **AuditoriaEstoque.jsx** — Central de Auditoria Operacional e Raio-X:
  - Header escuro luxuoso com ícone pulsante `🚨 CENTRAL DE AUDITORIA`
  - Filtros por categoria: Estoque Travado, Devolução Atrasada, Saldo Pendente, Avarias/Faltas
  - Preview de peças afetadas por aluguel
  - Raio-X Financeiro: Total, Pago, Saldo em aberto
  - Botão WhatsApp direto de cobrança
  - Botões de resolução rápida `✓ Finalizar` e `✕ Cancelar`

---

### 👥 CLIENTES (`/src/pages/Clientes/`)
- **Clientes.jsx** — Gestão completa da carteira de clientes:
  - **4 Cards de KPI** em 1 linha horizontal: Total, Aguardando Aprovação, Adimplentes, Com Pendências
  - **Filtros por pílula**: Todos, Aguardando Aprovação, Adimplentes, Pendências, Aniversariantes, VIPs
  - **Filtro por Tag CRM** dropdown (VIP, Recorrente, Exigente, Novo, etc.)
  - **Ranking dos Melhores Clientes** (⭐ Selos de Frequência TOP1 / TOP2 / TOP3)
  - **Banner de Alerta** de cadastros pendentes de aprovação
  - **Botão `✓ Aprovar`** de 1 clique na linha da tabela para auto-cadastros
  - Badge `⏳ AGUARDANDO APROVAÇÃO` na coluna de situação
  - Coluna de ÚLTIMA LOCAÇÃO com data e tema da festa
  - Tabela responsiva com avatar inicial colorido por nome
  - Busca por Nome, CPF, CNPJ, E-mail
  - **Modal WhatsApp com modelos de mensagem e upload de foto**
  - **Modal de Cobrança** com saldo em aberto e mensagem pré-formatada
  - **Aba de ANIVERSARIANTES DO MÊS** com link "Visualizar Todos"

- **CadastroCliente.jsx** — Perfil completo do cliente:
  - Header premium com badge de ícone + título + breadcrumb + ações rápidas (Voltar, WhatsApp, Nova Locação, Salvar)
  - Abas: Dados Pessoais, Histórico de Locações, Documentos, Notas
  - Upload de foto de perfil
  - Seleção de Tags CRM
  - Histórico financeiro e de locações

- **AutoCadastro.jsx** — Formulário público para clientes se cadastrarem via link:
  - Design dark luxury com logo e branding da empresa
  - Toggle PF/PJ com inputs e máscaras dinâmicas
  - Preview de carrinho com itens selecionados no catálogo
  - Busca de CEP automática via ViaCEP
  - Botão CTA dourado `🚀 FINALIZAR E ENVIAR SOLICITAÇÃO`
  - Salva com `statusAprovacao: 'pendente'` e `situacaoFinanceira: 'pendente'`
  - **Tela de Confirmação de Sucesso** (sem redirecionar abruptamente):
    - Botão `🟢 Falar no WhatsApp da Loja`
    - Botão `🛍️ Ir para o Catálogo de Peças`
    - Botão `Fazer novo cadastro`

---

### 📋 CONTRATOS (`/src/pages/Contratos/`)
- **Contratos.jsx** — Lista de todos os contratos
- **NovoContrato.jsx** — Criação de contrato com seleção de cliente e itens do estoque
- **EditarContrato.jsx** — Edição de contratos existentes
- **VisualizarContrato.jsx** — Visualização do contrato para impressão/assinatura
- **AssinaturaContrato.jsx** — Tela de assinatura digital
- **ModelosContrato.jsx** — Gestão de modelos/templates de contrato

---

### 📦 ESTOQUE (`/src/pages/Estoque/`)
- **Estoque.jsx** — Catálogo de peças com filtros e status de disponibilidade
- **CadastroEstoque.jsx** — Cadastro e edição de itens do estoque com upload de foto, preço, categoria e quantidade

---

### 🛒 LOCAÇÕES (`/src/pages/Locacoes/`)
- **Locacoes.jsx** — Lista de todas as locações com status e filtros
- **NovaLocacao.jsx** — Criação de nova locação: seleção de cliente, itens, datas, valores
- **EditarLocacao.jsx** — Edição de locações existentes

---

### 💰 FINANCEIRO (`/src/pages/Financeiro/`)
- **Financeiro.jsx** — Painel financeiro com entradas e saídas, saldo, filtros por período
- **NovoLancamento.jsx** — Cadastro de lançamentos financeiros

---

### 🏪 FORNECEDORES (`/src/pages/Fornecedores/`)
- **Fornecedores.jsx** — Cadastro e lista de fornecedores
- **NovoFornecedor.jsx** — Formulário de cadastro de fornecedor

---

### 🛍️ CATÁLOGO PÚBLICO (`/src/pages/Catalago/`)
- **Catalago.jsx** — Catálogo público de peças por empresa via URL `/catalogo/:userId`
- Exibe itens disponíveis com fotos, preços e botão de adicionar ao carrinho
- Carrinho local com navegação para AutoCadastro

---

### 📅 AGENDA (`/src/pages/Agenda/`)
- **Agenda.jsx** — Calendário visual de eventos e locações por data

---

### 🚚 LOGÍSTICA (`/src/pages/Logistica/`)
- **Logistica.jsx** — Controle de retirada e devolução de peças por locação

---

### 🖼️ MOODBOARD (`/src/pages/Moodboard/`)
- **Moodboard.jsx** — Painel visual de inspiração / montagem de tema de festa para clientes

---

### 🧾 COMPRAS (`/src/pages/Compras/`)
- **Compras.jsx** — Lista de compras/pedidos de reposição
- **NovaCompra.jsx** — Criação de ordem de compra de itens para estoque

---

### 📈 RELATÓRIOS (`/src/pages/Relatorios/`)
- **Relatorios.jsx** — Hub de relatórios com abas:
  - **ClientesTab.jsx** — Relatório por clientes
  - **FinanceiroTab.jsx** — Relatório financeiro
  - **PedidosTab.jsx** — Relatório de pedidos/locações
  - **EstoqueTab.jsx** — Relatório de inventário e giro

---

### 🔔 NOTIFICAÇÕES (`/src/pages/Notificacoes/`)
- **Notificacoes.jsx** — Caixa de entrada unificada:
  - Novos cadastros de auto-cadastro pendentes de aprovação
  - Novos orçamentos vindos do catálogo público
  - Botões: **Revisar**, **Recusar**, **✓ Aprovar**
  - **Aprovação correta**: Atualiza `situacaoFinanceira: 'adimplente'` E `statusAprovacao: 'aprovado'` simultaneamente

---

### ⚙️ CONFIGURAÇÕES (`/src/pages/Configuracoes/`)
- **Configuracoes.jsx** — Hub de configurações com abas:
  - **AbaMeuPerfil.jsx** — Dados do usuário logado
  - **AbaEmpresa.jsx** — Dados da empresa (nome, WhatsApp, logo)
  - **AbaCatalogoEstoque.jsx** — Configurações do catálogo público
  - **AbaSeguranca.jsx** — Segurança e autenticação
  - **AbaAssinaturaUso.jsx** — Plano ativo e uso do sistema
  - **AbaBackup.jsx** — Exportação e backup de dados (LGPD)

---

### 👤 PERFIL (`/src/pages/Perfil/`)
- **Perfil.jsx** — Perfil do usuário autenticado, foto e dados

---

### 💳 CHECKOUT (`/src/pages/Checkout/`)
- **Checkout.jsx** — Fluxo de pagamento/checkout de assinatura de plano

---

### 🏗️ USUÁRIOS E EQUIPE (`/src/Usuarios/`)
- **Usuarios.jsx** — Gestão de usuários/funcionários da empresa com permissões
- **GestaoASO.jsx** — Gestão de exames médicos/ASO da equipe
- **Monitoramento.jsx** — Monitoramento em tempo real de sessões ativas

---

### 🏠 LANDING PAGE (`/src/pages/LandingPage/`)
- **LandingPage.jsx** — Página inicial pública de apresentação do sistema

---

### 📐 PLANOS (`/src/pages/Planos/`)
- **Planos.jsx** — Listagem e comparação de planos disponíveis
- **PaginaUpgrade.jsx** — Tela de upgrade de plano
- **AdminPlanos.jsx** — Painel admin para gerenciar planos

---

### 🛡️ ADMIN (`/src/pages/Admin/`)
- **ControleGeral.jsx** — Painel de controle geral do super-admin do sistema

---

## 🧩 COMPONENTES GLOBAIS (`/src/components/`)
| Componente | Descrição |
|---|---|
| `Navbar.jsx` | Barra de navegação lateral com todos os módulos e ícones |
| `Topbar.jsx` | Barra superior com seletor de tema (☀️ CLARO / 🪨 GRAFITE / 🌙 MIDNIGHT), sininho de notificações e menu do usuário |
| `SininhoNotificacoes.jsx` | Componente do sino com contador de notificações em tempo real |
| `RotaPrivada.jsx` | HOC para proteger rotas autenticadas |

---

## 🎨 SISTEMA DE TEMAS (`index.css`)
- **3 temas dinâmicos** via variáveis CSS:
  - ☀️ **CLARO** — Fundo branco/cinza suave, default
  - 🪨 **GRAFITE** — Tons escuros de cinza
  - 🌙 **MIDNIGHT** — Tema dark completo
- Seletor de tema na Topbar com persistência no `localStorage`
- Variáveis CSS: `--fundo-principal`, `--fundo-card`, `--texto-principal`, `--borda`, etc.

---

## 🔄 FLUXO DE AUTO-CADASTRO (Completo)
```
Cliente acessa link público → /autocadastro/:userId
↓
Preenche formulário (PF/PJ) + seleciona itens do catálogo
↓
Salva no Firestore com statusAprovacao: 'pendente' + situacaoFinanceira: 'pendente'
↓
Vê TELA DE SUCESSO (não redireciona mais para catálogo)
↓
EMPRESA recebe notificação no 🔔 Sininho
↓
Pode aprovar via:
  - Caixa de Entrada (Notificacoes.jsx) → botão ✓ Aprovar
  - Tela de Clientes → badge ⏳ + botão ✓ Aprovar na linha
↓
Aprovação: statusAprovacao → 'aprovado' + situacaoFinanceira → 'adimplente'
↓
Cliente aparece como ADIMPLENTE na carteira
```

---

## 🐛 BUGS CORRIGIDOS NESTA SESSÃO
| Problema | Causa | Correção |
|---|---|---|
| Aprovação no sininho não refletia em Clientes | `Notificacoes.jsx` só atualizava `situacaoFinanceira`, não `statusAprovacao` | Adicionado `statusAprovacao: 'aprovado'` no `updateDoc` |
| `ReferenceError: updateDoc is not defined` em Clientes | `updateDoc` não estava importado em `Clientes.jsx` | Adicionado `updateDoc` na lista de imports |
| 4 cards de KPI em 2 linhas | `grid-template-columns: repeat(3, 1fr)` | Mudado para `repeat(4, 1fr)` + media queries responsivas |
| Auto-cadastro redirecionava para catálogo abruptamente | `navigate('/catalogo/...')` direto após submit | Substituído por tela de sucesso elegante com botões opcionais |

---

## 📁 ESTRUTURA DE COLEÇÕES NO FIRESTORE
| Coleção | Campos Principais |
|---|---|
| `clientes` | `userId`, `nome`, `cpf`, `celular`, `email`, `situacaoFinanceira`, `statusAprovacao`, `tags`, `dataNascimento` |
| `locacoes` | `userId`, `clienteId`, `clienteNome`, `status`, `dataRetirada`, `dataDevolucao`, `valorTotal`, `origem` |
| `estoque` | `userId`, `nome`, `categoria`, `quantidade`, `preco`, `fotoUrl` |
| `contratos` | `userId`, `clienteId`, `numero`, `dataAssinatura`, `status` |
| `lancamentos` | `userId`, `tipo`, `valor`, `descricao`, `data` |
| `logs_atividades` | `userId`, `funcionarioId`, `acao`, `detalhes`, `dataHora` |
| `fornecedores` | `userId`, `nome`, `contato`, `cnpj` |
| `compras` | `userId`, `fornecedorId`, `itens`, `valorTotal`, `status` |

---

*Resumo Executivo atualizado em 23/07/2026. Celebre Sistema de Gestão — v2.0*
