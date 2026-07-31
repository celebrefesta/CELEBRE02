# 🏆 RESUMO EXECUTIVO DO SISTEMA — CELEBRE FESTAS & DECORAÇÕES

> **Sistema SaaS de Gestão Empresarial Multi-Tenant para Empresas de Aluguel, Locação e Decoração de Festas e Eventos**  
> **Tecnologias**: React 19 + Vite 7 · Firebase Firestore & Auth · Mercado Pago SDK · Vanilla CSS Luxury Design System (`#c5a059`, Glassmorphism, Dark/Light Mode)  
> **Data de Referência**: Julho / 2026  

---

## 🎯 1. VISÃO GERAL E PROPÓSITO DO NEGÓCIO

O **Celebre Festas & Decorações** é uma plataforma SaaS (Software as a Service) de alta performance desenvolvida sob medida para atender acervos de festas, decoradores, locadoras de itens para eventos e empresas no modelo **Pegue e Monte** ou **Eventos Completos**.

O sistema centraliza todo o ciclo operacional de uma empresa de decoração: desde a prospecção de clientes e disponibilização de catálogo digital online, passando pela checagem inteligente de disponibilidade de peças no acervo, geração de orçamentos e locações, até a emissão de contratos com assinatura digital, controle financeiro, gestão logística de entregas e acompanhamento de equipe.

---

## 📦 2. ARQUITETURA DE TECNOLOGIA E SEGURANÇA

| Camada | Tecnologia & Padrões | Descrição / Papel no Sistema |
|---|---|---|
| **Frontend** | React 19 + Vite 7 | Interface SPA ultra rápida com React Router v7 e suporte a temas dinâmicos |
| **Backend (BaaS)** | Firebase Firestore | Banco NoSQL em tempo real blindado por regras de segurança e isolamento por `tenantId` |
| **Autenticação** | Firebase Auth | Autenticação por E-mail/Senha com controle de sessões e hierarquia de acesso |
| **Pagamentos & Pix** | Mercado Pago SDK + Pix | Gateway multi-tenant permitindo integração direta da conta do cliente via Access Token |
| **Assinatura Digital** | React Signature Canvas | Coleta de assinatura digital na tela (Touch/Mouse) vinculada ao contrato |
| **Relatórios & PDF** | jsPDF + AutoTable + Chart.js / Recharts | Emissão de comprovantes, relatórios financeiros em PDF e dashboards visuais |
| **Estilização** | Vanilla CSS Luxury Design System | Paleta sofisticada Dourado Celebre (`#c5a059`), Glassmorphism, Light e Dark Modes |
| **Auditoria & Logs** | Firestore Audit Ledger | Registro centralizado (`logs_atividades`) para rastreamento de ações críticas |

---

## 🛡️ 3. MODELO DE SEGURANÇA E CONTROLE DE ACESSO (RBAC)

- **Isolamento Multi-Tenant**: Cada empresa possui um workspace isolado. Todos os registros (clientes, peças, locações, lançamentos) possuem o identificador `tenantId`.
- **Trava de Segurança em Tempo Real (`TravaSeguranca.jsx`)**:
  1. **Validação de Plano / Trial**: Verifica se a empresa possui assinatura ativa ou se está no período de avaliação de 7 dias. Bloqueia acessos indevidos caso o plano tenha expirado.
  2. **Permissões de Funcionário**: Restringe rotas com base nos privilégios concedidos ao usuário da equipe (ex.: bloqueia Financeiro, Relatórios e Equipe para perfis operacionais).
- **Super Admin**: Painel exclusivo (`celebrefesta25@gmail.com`) para gestão global de planos, tenants e liberação de acessos.

---

## 🗂️ 4. DETALHAMENTO DOS MÓDULOS DO SISTEMA

### 🔐 4.1. Vitrine Comercial & Autenticação (`/src/pages/Auth/`, `/LandingPage/`)
- **Landing Page Comercial (`/`)**: Apresentação dos recursos do sistema, planos e formulário de conversão.
- **Login e Cadastro (`/login`, `/cadastro`)**: Registro instantâneo de novas empresas com provisionamento automático de tenant.
- **Recuperação e Confirmação (`/redefinir-senha`, `/confirmar-email`)**: Fluxo seguro de gestão de credenciais via Firebase Auth.
- **Catálogo Digital Público (`/catalogo/:idEmpresa`)**: Vitrine online onde os clientes finais da locadora podem navegar pelas peças e temas da empresa.
- **Auto-Cadastro de Clientes (`/autocadastro/:idEmpresa`)**: Link compartilhável para que os próprios clientes preencham seus dados cadastrais.

---

### 📊 4.2. Dashboard & Auditoria de Estoque (`/src/pages/Dashboard/`)
- **Painel Gerencial (`Dashboard.jsx`)**:
  - KPIs em tempo real: Faturamento mensal, ticket médio, locações ativas e entregas pendentes.
  - Alertas de aniversariantes do mês e gráficos financeiros interativos.
- **Auditoria de Estoque (`AuditoriaEstoque.jsx`)**:
  - Raio-X operacional do acervo: peças alugadas em trânsito, devoluções pendentes, itens em higienização e avarias registradas.

---

### 👥 4.3. Gestão de Clientes (`/src/pages/Clientes/`)
- **Cadastro Completo (`Clientes.jsx`, `CadastroCliente.jsx`)**: Dados pessoais, endereço com busca automática por CEP (ViaCEP), contato e observações.
- **Histórico de Locações**: Visualização rápida de todos os contratos e orçamentos atrelados ao cliente.
- **Integração WhatsApp**: Envio direto de mensagens formatadas, orçamentos e links de cobrança em 1 clique.

---

### 📦 4.4. Controle de Acervo, Estoque & Manutenção (`/src/pages/Estoque/`)
- **Gestão de Peças e Kits (`Estoque.jsx`, `CadastroEstoque.jsx`)**:
  - Organização por categorias, valor de locação, valor de reposição e estado de conservação (Excelente, Bom, Avariado).
- **Cálculo de Disponibilidade Inteligente**:
  - Algoritmo que cruza o período desejado com as locações confirmadas, desconsiderando pedidos cancelados ou orçamentos expirados para evitar reservas duplicadas.
- **Módulo Avançado de Manutenção & Reparabilidade**:
  - **Validação de Conflito Manutenção x Locação**: Impede o envio de peças alugadas para manutenção sem prazo hábil de retorno. Quando um item entra em reparo hoje, o sistema calcula a data limite de prontidão (1 dia antes da saída para a festa) e bloqueia prazos que comprometam o pedido do cliente.
  - **Baixa Rápida de Conserto**: Botão integrado `✅ Reparo Concluído (Liberar)` no rodapé do controle de manutenção para retornar peças instantaneamente ao estoque disponível.
  - **Painel & Calendário de Avarias (`ModalCalendarioDisponibilidade.jsx`)**: Indicador `🛠️ N` na grade de dias, detalhamento de peças sob reparo (fotos, motivo, custo e prontidão) e alertas visuais de conflito operacional.

---

### 📑 4.5. Locações, Orçamentos e Pedidos (`/src/pages/Locacoes/`)
- **Nova Locação / Editar (`NovaLocacao.jsx`, `EditarLocacao.jsx`)**:
  - **Modalidade Pegue e Monte**: Seleção rápida que ajusta regras operacionais e desabilita campos de frete/entregas.
  - **Desconto Flexível**: Alternância entre valor em Reais (**`R$`**) e Porcentagem (**`%`**).
  - **Catálogo Modal Luxury**: Modal visual estilo e-commerce para seleção e adição de peças ao pedido com 1 clique.
  - **Botão "🛒 Faltou algo? (Comprar)"**: Atalho para registro imediato de nova compra de itens faltantes.
  - **Sinal e Condições de Pagamento**: Opções rápidas de sinal (50% / 100%), cálculo de saldo restante e geração de recibos.

---

### 📝 4.6. Contratos e Assinatura Digital (`/src/pages/Contratos/`)
- **Modelos Customizáveis (`ModelosContrato.jsx`)**: Criação de cláusulas e modelos padronizados de locação.
- **Geração de Contratos (`NovoContrato.jsx`, `EditarContrato.jsx`)**: Vinculação automática dos dados do cliente, itens da locação e valores.
- **Visualização Web / PDF (`VisualizarContrato.jsx`)**: Link direto para leitura do contrato pelo cliente.
- **Assinatura Digital (`AssinaturaContrato.jsx`)**: Coleta da assinatura do cliente na tela do celular ou computador com armazenamento no sistema.

---

### 💵 4.7. Gestão Financeira & Comprovantes (`/src/pages/Financeiro/`)
- **Fluxo de Caixa (`Financeiro.jsx`, `NovoLancamento.jsx`)**:
  - Lançamento de receitas, despesas operacionais, classificação por categorias e DRE simplificado.
- **Aba "Comprovantes Recebidos"**:
  - Central exclusiva para upload, armazenamento e visualização de comprovantes Pix e transferências bancárias anexados às locações.

---

### 🛒 4.8. Compras & Fornecedores (`/src/pages/Compras/`, `/Fornecedores/`)
- **Gestão de Fornecedores (`Fornecedores.jsx`)**: Cadastro de parceiros, fabricantes e contatos.
- **Ordens de Compra (`Compras.jsx`, `NovaCompra.jsx`)**: Registro de aquisição de novas peças para reposição ou expansão do acervo, integrando os custos diretamente ao financeiro.

---

### 🚚 4.9. Logística & Agenda de Eventos (`/src/pages/Logistica/`, `/Agenda/`)
- **Agenda de Eventos (`Agenda.jsx`)**: Calendário mensal/semanal com todas as saídas, eventos e devoluções programadas.
- **Painel de Logística (`Logistica.jsx`)**: Roteirização de entregas, montagens, retiradas no balcão e status de transporte.

---

### 🎨 4.10. Moodboard & Projetos Visuais (`/src/pages/Moodboard/`)
- **Criador de Moodboard (`Moodboard.jsx`)**: Ferramenta visual para composição de paletas de cores, temas e inspirações para apresentar propostas visuais encantadoras aos clientes.

---

### 👥 4.11. Gestão de Equipe & RH (`/src/Usuarios/`)
- **Controle de Usuários (`Usuarios.jsx`)**: Cadastro de colaboradores e atribuição de cargos.
- **Gestão ASO (`GestaoASO.jsx`)**: Controle de Atestados de Saúde Ocupacional da equipe.
- **Monitoramento (`Monitoramento.jsx`)**: Rastreamento de atividades operacionais.

---

### ⚙️ 4.12. Configurações & Personalização Multi-Tenant (`/src/pages/Configuracoes/`)
- **Perfil da Empresa (`AbaEmpresa.jsx`)**: Dados cadastrais, upload de logomarca e assinatura oficial do representante.
- **Configuração de Pagamento**:
  - Inserção do **Mercado Pago Access Token (`mpAccessToken`)** próprio da empresa.
  - Cadastro da **Chave PIX Oficial** e link externo de pagamento.
- **Customização de Tema**: Escolha entre Modo Claro, Escuro (Midnight / Gray), nível de contraste e alteração da cor primária da marca (`--dourado`).

---

### 💎 4.13. Gestão de Planos & Assinaturas SaaS (`/src/pages/Planos/`, `/Admin/`)
- **Matriz de Planos (`Planos.jsx`, `PaginaUpgrade.jsx`)**: Apresentação de planos (Gratuito / Teste, Starter, Pro, Enterprise) e upgrade.
- **Painel de Controle Geral (`ControleGeral.jsx`, `AdminPlanos.jsx`)**: Gestão administrativa master para acompanhamento de empresas cadastradas, status de pagamentos e liberação de recursos.

---

## 📈 5. DIFERENCIAIS COMPETITIVOS E VALOR AGREGADO

1. **Foco Total no Segmento de Festas**: Atende especificamente os modelos *Pegue e Monte* e *Eventos Completos*, resolvendo dores reais de estoque fracionado e disponibilidade por data.
2. **Autonomia de Recebimento**: Os valores das locações caem diretamente na conta bancária do cliente via integração própria do Mercado Pago ou Pix direto.
3. **Agilidade no Fechamento**: Catálogo digital visual, orçamento instantâneo, envio por WhatsApp em 1 clique e assinatura digital de contratos aceleram o ciclo de vendas.
4. **Segurança Operacional**: Prevenção de duplicidade de aluguel no acervo e controle rigoroso de acessos de funcionários.

---

## 🚀 6. STATUS ATUAL E ESTABILIDADE

- **Compilação / Build**: Verificado e aprovado via `npm run build` com **0 erros**.
- **Pronto para Escala**: Estrutura modular preparada para receber novos tenants e suportar a operação diária com estabilidade e elegância visual.
- **Próximos Passos**: Acessar a aba **Configurações -> Empresa** para inserir o seu `mpAccessToken` do Mercado Pago ou sua Chave PIX oficial.
- **Testes**: Realizar testes de ponta a ponta na criação de orçamentos e locações na rotina diária da Celebre Decorações.

---

## 📅 7. HISTÓRICO DE SESSÕES DE DESENVOLVIMENTO

### 🗓️ Sessão: 31/07/2026 — 14h30 (BRT)

**Funcionalidades entregues:**
- ✅ **Auditoria de `style={{}}` inline — CheckinPage.jsx** — Removido inline style `{ touchAction: 'none', width: '100%', height: '100%' }` do `<SignatureCanvas>` (coberto pelo CSS `.sig-canvas-std`); removido `style={{ marginTop: '12px' }}` e substituído pela classe `.form-group-margin-top`
- ✅ **Auditoria de `style={{}}` inline — CheckoutPage.jsx** — Confirmado que os únicos inline styles restantes (`style={{ display:'none' }}` e `style={{ width: progressoPct }}`) são corretos e necessários
- ✅ **Dark mode CheckoutPage — Cobertura completa** — Adicionados overrides para todos os elementos exclusivos da página que não eram cobertos pelo CheckinPage.css: `.checkout-page-container`, `.btn-voltar-checkout`, `.header-badge-modo.volta`, `.checkout-alert-box`, `.alert-badge`, `.checkout-resumo-banner-vip`, `.obs-col-field`, `.input-std-text/select/textarea`, `.sig-wrapper-std`, `.sig-canvas-element`, `.sig-hint-txt`, `.sig-preview-box`, `.msg-bip-toast`, `.camera-scanner-wrapper`, `.checkout-loading-screen`, `.checkout-footer-fixed`
- ✅ **PDF de Check-out corrigido** — `handleGerarPDF()` no CheckoutPage agora chama `gerarComprovanteCheckinPDF(locacao, 'VOLTA', itensState, dadosAdicionais, dadosEmpresa)` com a assinatura e responsável corretamente passados como `dadosAdicionais` (correto como no CheckinPage)
- ✅ **Salvar conferência no Firestore (CheckoutPage)** — `handleSalvarCheckout()` agora contém a lógica de envio de peças avariadas para manutenção no estoque (incrementa `qtdManutencao`, seta `statusManutencao: 'em_manutencao'`), espelhando o CheckinPage
- ✅ **Build verificado** — `npm run build` com **0 erros** após todas as mudanças

**Pendente para próxima sessão:**
- 🟢 PDF de Check-in — revisar e melhorar layout (tabela de itens, fotos incorporadas no PDF, avarias em destaque vermelho)
- 🟢 PDF de Check-out — idem, garantir que avarias e faltas fiquem destacadas na tabela
- 🟡 Testar fluxo completo de Check-out com avaria → verificar se o item foi para Manutenção no Estoque

### 🗓️ Sessão: 30/07/2026 — 14h00 às 18h04 (BRT)

**Funcionalidades entregues:**
- ✅ **CheckinPage** — lista de peças expandida, cards alinhados, mobile 100% corrigido
- ✅ **Modal de conferência** — altura dinâmica (auto → 90vh) conforme quantidade de peças
- ✅ **CheckoutPage** (NOVA) — página dedicada de devolução/vistoria em `/checkout/:id`
  - Classificação por item: 🟢 OK · 🛠️ Avaria · ❌ Faltou
  - Banner de progresso, alerta de avarias, fotos e assinatura de devolução
- ✅ **Header do Check-in** — removido botão de "Mudar para Devolução" e WhatsApp
- ✅ **Sistema de temas** — todos os botões primários usam `var(--cor-destaque)` dinamicamente (Dourado / Azul / Roxo / Verde respondem em tempo real)
- ✅ **Dark mode** — overrides abrangentes: pills, filtros, modais, cards de itens, toasts, assinatura, avarias e mais ~30 grupos de elementos

**Pendente para próxima sessão:**
- 🔴 Auditoria de `style={{}}` inline no `CheckinPage.jsx` e `CheckoutPage.jsx` (texto apagado em dark mode vem de estilos inline que CSS não consegue sobrescrever)
- 🟡 CheckoutPage — verificar dark mode nos elementos próprios da página de devolução
- 🟢 PDF de Check-in e Check-out (lógica de geração)
- 🟢 Salvar conferência no Firestore

---

> **⏱️ Última atualização:** 30/07/2026 às 18:04 (BRT)  
> **✍️ Atualizado por:** Antigravity AI — Sessão CELEBRE02

