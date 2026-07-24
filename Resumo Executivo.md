# 🏆 RESUMO EXECUTIVO DO SISTEMA — CELEBRE FESTAS & DECORAÇÕES

> **Sistema de Gestão Empresarial Multi-Tenant para Empresas de Aluguel e Decoração de Festas**  
> **Tecnologias**: React 18 + Vite 7 · Firebase Firestore · Firebase Auth · Mercado Pago SDK · Vanilla CSS Luxury Design System  
> **Última Atualização**: 24/07/2026  

---

## 📦 1. ARQUITETURA DE TECNOLOGIA

| Camada | Tecnologia & Padrões |
|---|---|
| **Frontend** | React 18 (Hooks, Context API) + Vite 7 |
| **Banco de Dados** | Firebase Firestore (Multi-tenant blindado por `userId` / `tenantId`) |
| **Autenticação** | Firebase Auth (Email/Senha, Controle de Permissões) |
| **Pagamentos & Pix** | Mercado Pago Preferences API + Gateway Multi-Tenant Configurável |
| **Logística & CEP** | Integração em tempo real ViaCEP API |
| **Estilização** | Vanilla CSS com Design System Dourado Celebre (`#c5a059`, `#0f172a`, Glassmorphism) |
| **Auditoria & Logs** | Firestore Audit Ledger (`logs_atividades`) para rastreamento de ações |

---

## 🗂️ 2. MÓDULOS E PÁGINAS DO SISTEMA

### 🔐 2.1. AUTENTICAÇÃO E SEGURANÇA (`/src/pages/Auth/`)
- **`Login.jsx`**: Acesso multi-tenant por e-mail/senha com controle de sessão.
- **`Cadastro.jsx`**: Registro inicial de empresa com criação automática de workspace.
- **`RedefinirSenha.jsx` & `ConfirmarEmail.jsx`**: Recuperação de senha segura via Firebase Auth.
- **`RotaProtegida.jsx` & `TravaSeguranca.jsx`**: Proteção de rotas e privilégios de funcionários.

---

### 📊 2.2. DASHBOARD E AUDITORIA (`/src/pages/Dashboard/`)
- **`Dashboard.jsx`**: Painel gerencial com KPIs financeiros, contratos mensais e aniversariantes do mês.
- **`AuditoriaEstoque.jsx`**: Raio-X operacional de peças alugadas, devoluções pendentes e avarias.

---

### 👥 2.3. GESTÃO DE CLIENTES (`/src/pages/Clientes/`)
- **`Clientes.jsx`**: Cadastro completo de clientes, histórico de locações e atalho para WhatsApp.
- **Navegação Corrigida**: Redirecionamento automático de criação de clientes diretamente para a Gestão de Clientes.

---

### 📦 2.4. ACERVO & ESTOQUE (`/src/pages/Estoque/`)
- **`Estoque.jsx`**: Controle físico e financeiro de peças, categorias, histórico e status de conservação.
- **Disponibilidade Inteligente**: Cálculo em tempo real que ignora pedidos arquivados, cancelados ou orçamentos, evitando falsas reservas.

---

### 📑 2.5. LOCAÇÕES & CONTRATOS (`/src/pages/Locacoes/`)
- **`NovaLocacao.jsx` & `EditarLocacao.jsx`**:
  - **Modalidade Pegue e Monte**: Trava automática que bloqueia opções de frete/logística de entrega para garantir exclusivamente a retirada no balcão.
  - **Desconto Flexível**: Alternância dinâmica em pílula entre valor em Reais (**`R$`**) e Porcentagem (**`%`**).
  - **Catálogo de Peças (Modal Luxury Grid)**: Vitrine e-commerce com fotos estrictamente travadas em `140px` (`object-fit: cover`) e adição em 1 clique.
  - **Botão `🛒 Faltou algo? (Comprar)`**: Redirecionamento contextual para a criação de nova compra em aba paralela.
  - **Modal de Confirmação & Sinal**: Atalhos rápidos de 50% e 100%, gerador de cobranças editável e envio automático de mensagem formatada no WhatsApp.

---

### 💵 2.6. FINANCEIRO & COMPROVANTES (`/src/pages/Financeiro/`)
- **`Financeiro.jsx`**: Controle de caixa, lançamentos de entradas/saídas e relatórios financeiros.
- **Nova Aba "Comprovantes Received"**: Central dedicada para upload, visualização e armazenamento de comprovantes de pagamento e Pix dos clientes.

---

### 🛒 2.7. COMPRAS & FORNECEDORES (`/src/pages/Compras/`)
- **`Compras.jsx` & `NovaCompra.jsx`**: Gestão de pedidos de aquisição de novas peças com seleção visual de fornecedores e contratos.

---

### ⚙️ 2.8. CONFIGURAÇÕES & DADOS DA EMPRESA (`/src/pages/Configuracoes/`)
- **`AbaEmpresa.jsx`**:
  - Dados cadastrais, upload de logo e assinatura digital oficial para contratos.
  - **Novo Card de Recebimento de Pagamentos**: Configuração do **Mercado Pago Access Token (`mpAccessToken`)**, **Chave PIX Oficial** e **Link do Mercado Pago da Empresa**, garantindo que 100% dos pagamentos caiam diretamente na conta bancária do usuário.

---

## 🧪 3. VALIDAÇÃO DE QUALIDADE E PERFORMANCES

- **Build de Produção**: `npm run build` executado com **0 erros (tempo médio 8.16s)**.
- **Status Git / Workspace**: Totalmente limpo e estruturado.

---

## 🎯 4. PRÓXIMOS PASSOS RECOMENDADOS

1. Acessar a aba **Configurações -> Empresa** para inserir o seu `mpAccessToken` do Mercado Pago ou sua Chave PIX oficial.
2. Realizar testes de ponta a ponta na criação de orçamentos e locações na rotina diária da Celebre Decorações.
