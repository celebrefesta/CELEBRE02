# 🏆 RESUMO EXECUTIVO DO SISTEMA — CELEBRE FESTAS & DECORAÇÕES

> **Sistema SaaS de Gestão Empresarial Multi-Tenant para Empresas de Aluguel, Locação e Decoração de Festas e Eventos**  
> **Tecnologias**: React 19 + Vite 7 · Firebase Firestore & Auth · Mercado Pago SDK · Vanilla CSS Luxury Design System (`#c5a059`, Glassmorphism, Dark/Light Mode)  
> **Data de Referência**: Agosto / 2026  

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

### 🗓️ Sessão: 03/08/2026 — 11h34 às 11h49 (BRT)

**Funcionalidades entregues:**
- ✅ **PDF de Vistoria Premium v3 (`gerarComprovanteCheckinPDF.js`)** — Reformulação completa:
  - **Tabela zebrificada**: Linhas alternando branco/cinza para melhor leitura visual.
  - **Destaque de Avarias em Vermelho**: Linhas avariadas com `fillColor` vermelho suave, texto vermelho escuro e borda lateral 1.5mm. Faltas em laranja suave.
  - **Coluna `Status` com badge colorido**: ✅ OK / 🛠️ AVARIA / ❌ FALTOU em negrito.
  - **Página de Sumário de Irregularidades** (apenas VOLTA): Contadores visuais, tabela de avarias com motivo e custo estimado, tabela de faltas e total de custo de reparos.
  - **Página de Fotos de Vistoria**: Grade 2×3 (máx 6 fotos embutidas em Base64), legenda numerada, aviso se houver mais de 6 fotos.
  - **Paginação no rodapé**: `Pág. X de Y` no canto superior direito de cada página.
  - **Badge IDA/VOLTA**: Verde (saída) / laranja (devolução) no quadro de informações.
- ✅ **Bug Crítico Corrigido — Avarias → Manutenção (`CheckoutPage.jsx`)**:
  - **Causa raiz**: `if (itemAv.enviarManutencao && ...)` nunca era verdadeiro (campo nunca atribuído).
  - **Correção**: Condição removida. Toda peça `statusRetorno === 'avaria'` com ID válido é automaticamente encaminhada ao Firestore com `qtdManutencao`, `statusManutencao`, `motivoManutencao` e `dataEntradaManutencao`.
  - **Campos inline de avaria**: Ao marcar Avaria, o card expande (animação `slideDownFade`) com campo de descrição do dano e custo estimado de reparo.
  - **Mensagem de confirmação**: `alert` informa quantas peças foram para manutenção.
  - **Fotos passadas ao PDF**: `fotosVistoria` incluído nos `dadosAdicionais` do gerador.
- ✅ **CSS `CheckoutPage.css`**: Novos estilos `.avaria-detail-box`, `.avaria-label`, `.avaria-input-text/custo`, `.avaria-manut-info` com dark mode completo.
- ✅ **Build de Produção Verificado**:
  - `npm run build` executado com **0 erros** (`built in 14.07s`, 1140 módulos).

**Pendente para próxima sessão:**
- 🟢 **Landing Page / Catálogo Público**: Melhorias na vitrine comercial para novos clientes.

### 🗓️ Sessão: 01/08/2026 — 12h26 às 15h05 (BRT)

**Funcionalidades entregues:**
- ✅ **Repaginação Visual & Funcional do Módulo de Estoque e Acervo (`Estoque.jsx` / `Estoque.css`)**:
  - **Dashboard de KPIs em Fila Única (5 Colunas)**: 5 cards alinhados no desktop (`repeat(5, 1fr)`): *Total de Itens*, *Valor do Acervo (R$)*, *Valor Reposição (R$)*, *Em Manutenção* e *Visível no Catálogo (100%)*, com dimensões e proporções 100% simétricas.
  - **Cards Luxury com Galeria & Zoom**: Exibição em grade com hover 3D suave, badges de status (*Disponível*, *Alugado*, *Em Reparo*, *S/ Estoque*), diferenciação visual (*Kit*, *Peça do Kit*, *Decoração*) e botão de lupa `🔍` para ampliação em alta resolução.
  - **Barra Flutuante de Seleção em Lote**: Aparição com animação ao marcar itens, exclusão em massa e desmarcação em 1 clique.
  - **Dark Mode Completo no Estoque & Cadastro**: Implementados blocos de regras CSS `[data-theme='dark']` abrangendo cards, formulários, modais de manutenção, seletor de pedidos e leitor QR Code em `Estoque.css` e `CadastroEstoque.css`.
- ✅ **Correção Definitiva de Responsividade e Vazamento Mobile (DevTools 900px Fix)**:
  - **Eliminação do Vazamento de 900px**: Identificada causa raiz no inspector DevTools (subtítulo de localização sem quebra de palavra forçando 900px). Aplicadas regras de `word-break: break-all`, `overflow-wrap: anywhere` e `min-width: 0` nos containers.
  - **Fix do Seletor `≡ Lista ⊞ Cards`**: Travada estrutura horizontal (`white-space: nowrap`), impedindo que os botões de alternância se empilhassem em duas linhas.
  - **Alinhamento dos Valores na Tabela Mobile**: Corrigidos flexbox de `Categoria:`, `Valor Locação:`, `Estoque Disp.:` e `Status:`, retornando todos os valores para a área visível do card mobile.
- ✅ **Correção de Linter CSS**:
  - Adicionada propriedade padrão `line-clamp: 2;` no `Estoque.css` ao lado de `-webkit-line-clamp: 2;`, eliminando alertas da IDE.
- ✅ **Build de Produção Verificado**:
  - `npx vite build` executado com **0 erros** (`built in 12.44s`).

### 🗓️ Sessão: 31/07/2026 — 14h30 (BRT)

**Funcionalidades entregues:**
- ✅ **Auditoria de `style={{}}` inline — CheckinPage.jsx** — Removido inline style `{ touchAction: 'none', width: '100%', height: '100%' }` do `<SignatureCanvas>` (coberto pelo CSS `.sig-canvas-std`); removido `style={{ marginTop: '12px' }}` e substituído pela classe `.form-group-margin-top`
- ✅ **Auditoria de `style={{}}` inline — CheckoutPage.jsx** — Confirmado que os únicos inline styles restantes (`style={{ display:'none' }}` e `style={{ width: progressoPct }}`) são corretos e necessários
- ✅ **Dark mode CheckoutPage — Cobertura completa** — Adicionados overrides para todos os elementos exclusivos da página que não eram cobertos pelo CheckinPage.css: `.checkout-page-container`, `.btn-voltar-checkout`, `.header-badge-modo.volta`, `.checkout-alert-box`, `.alert-badge`, `.checkout-resumo-banner-vip`, `.obs-col-field`, `.input-std-text/select/textarea`, `.sig-wrapper-std`, `.sig-canvas-element`, `.sig-hint-txt`, `.sig-preview-box`, `.msg-bip-toast`, `.camera-scanner-wrapper`, `.checkout-loading-screen`, `.checkout-footer-fixed`
- ✅ **PDF de Check-out corrigido** — `handleGerarPDF()` no CheckoutPage agora chama `gerarComprovanteCheckinPDF(locacao, 'VOLTA', itensState, dadosAdicionais, dadosEmpresa)` com a assinatura e responsável corretamente passados como `dadosAdicionais` (correto como no CheckinPage)
- ✅ **Salvar conferência no Firestore (CheckoutPage)** — `handleSalvarCheckout()` agora contém a lógica de envio de peças avariadas para manutenção no estoque (incrementa `qtdManutencao`, seta `statusManutencao: 'em_manutencao'`), espelhando o CheckinPage
- ✅ **Build verificado** — `npm run build` com **0 erros** após todas as mudanças

### 🗓️ Sessão: 03/08/2026 — 16h18 às 18h42 (BRT)

**Funcionalidades e Refatorações entregues:**
- ✅ **Redesign Completo UI/UX da Página de Devolução (`CheckoutPage.jsx` / `CheckoutPage.css`)**:
  - **Eliminação Total de Vazamentos e Estouros de Tela**: Aplicado sistema de design com prefixo único `co-*`, resolvendo conflitos de CSS com a página de check-in.
  - **Banner de Resumo KPI em 2 Colunas Perfeitas**: Corrigida a contenção de texto com `min-width: 0`, `overflow: hidden` e `text-overflow: ellipsis`, permitindo que clientes com nomes extensos não quebrem o grid.
  - **Cards de Itens Reestruturados**: Hierarquia limpa dividida em topo (imagem 44x44, tags de `Cód`, `Categoria` e `Localização` em linha horizontal contínua), stepper compacto e botões de status em 3 colunas simétricas (`🟢 OK`, `🛠️ Avaria`, `❌ Faltou`).
  - **Limpeza Visual do Painel Mestre**: Botão `⤢ Expandir` reposicionado ao lado do seletor de Categoria, count badge `(1/1)` sem cortes, e fim do "card sobre card" na busca.
- ✅ **⚡ Ação Rápida "Devolver Tudo Inteiro (1-Click)"**:
  - Botão no painel de ferramentas que marca todas as peças do pedido como devolvidas em perfeito estado instantaneamente.
- ✅ **💰 Cálculo Automático de Taxa de Ressarcimento (Avarias & Faltas)**:
  - Painel executivo que soma em tempo real os custos de reparos/avarias e reposição de itens faltantes, exibindo a cobrança total estimada.
- ✅ **💬 Disparo Automático de Comprovante via WhatsApp**:
  - Integração com WhatsApp Web/App que gera e envia mensagem formatada com o resumo da vistoria de devolução em 1 clique.
- ✅ **📜 Histórico Comparativo de Vistorias (Saída vs Volta)**:
  - Painel expansível que compara lado a lado os dados e fotos da entrega (Check-in/Ida) com a devolução (Check-out/Volta).
- ✅ **🛡️ Regra Inteligente de Retenção de Fotos (Lifecycle Policy)**:
  - Devoluções sem irregularidades: Fotos temporárias com expiração automática em 15 dias pós-devolução (`expirarFotosEm`).
  - Devoluções com Avaria/Falta: Fotos retidas permanentemente no sistema (`fotosManterPermanente: true`).
- ✅ **🏰 Estações Finais Reordenadas & Rodapé Full-Width**:
  - Ordem das estações atualizada (1. Responsável & Obs, 2. Fotos da Vistoria, 3. Assinatura do Cliente por último).
  - Botão `🛬 Finalizar Devolução` configurado em **100% de largura total** no rodapé fixo.
- ✅ **Build de Produção Verificado**:
  - `npm run build` executado e aprovado com **0 erros** (`built in 13.88s ~ 16.13s`).

---

## 🔮 8. PRÓXIMOS PASSOS A SEGUIR

1. **📱 Validação em Dispositivos Móveis Reais**:
   - Testar o fluxo de conferência de devolução em smartphones no galpão para validar a facilidade de clique e captura de fotos pela câmera do celular.
2. **🧹 Módulo de Limpeza Automática de Mídia (Cron / Function)**:
   - Executar a rotina de limpeza para remover Base64 das fotos cuja data `expirarFotosEm` seja anterior a hoje e `!fotosManterPermanente`.
3. **💬 Modelos de Notificação Financeira**:
   - Integrar o valor do Painel de Ressarcimento diretamente como lançamento de receita/cobrança no Módulo Financeiro.

---

> **⏱️ Última atualização:** 03/08/2026 às 18:42 (BRT)  
> **✍️ Atualizado por:** Antigravity AI — Sessão CELEBRE02

