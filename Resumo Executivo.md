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
- **Módulo Avançado de Manutenção & Rastreabilidade de Kit/Decoração**:
  - **Validação de Conflito Manutenção x Locação**: Rastreia se peças avulsas ou **peças embutidas em receitas de Kits e Decorações Completas** possuem reservas ativas no período do conserto.
  - **Bloqueio e Ajuste Automático de Segurança**: Alerta o usuário se a manutenção deixar o estoque livre zerado para o cliente, oferecendo limitar o reparo à quantidade livre segura.
  - **Ação em Lote de Manutenção**: Botão `✅ Concluir Reparo dos Selecionados` na barra de seleção em massa do estoque para dar baixa e liberar múltiplas peças reformadas de uma só vez.
  - **Insígnia de Conflito em Tempo Real**: Tarja vermelha na tabela de acervo identificando o pedido e cliente afetados pelo atraso do reparo.

---

### 📑 4.5. Locações, Orçamentos e Matriz de Disponibilidade (`/src/pages/Locacoes/`)
- **Nova Locação / Editar (`NovaLocacao.jsx`, `EditarLocacao.jsx`)**:
  - **Modalidade Pegue e Monte**: Seleção rápida que ajusta regras operacionais e desabilita campos de frete/entregas.
  - **Desconto Flexível**: Alternância entre valor em Reais (**`R$`**) e Porcentagem (**`%`**).
  - **Catálogo Modal Luxury**: Modal visual estilo e-commerce para seleção e adição de peças ao pedido com 1 clique.
- **Matriz de Disponibilidade & Timeline Gantt (`ModalCalendarioDisponibilidade.jsx`)**:
  - **Visão Quinzena de 2 Linhas no Mobile**: Organização do mês em 1ª Quinzena (1-15) e 2ª Quinzena (16-fim), dobrando a largura e clareza visual dos dias em telas pequenas.
  - **Seletor Compacto de Reservas (`📌 RESERVAS (X)`)**: Dropdown que agrupa clientes e pedidos do mês sob o card da peça sem poluir a interface.
  - **Navegação Direta 1-Click**: Botão `🔗 Abrir Pedido ➔` no submodal para saltar direto para a edição da locação sem buscas manuais.
  - **Filtro de Peças em Reforma**: Atalho `🛠️ Filtrar Peças em Reforma` para isolar itens sob reparo.
  - **Sugestão de Substitutos**: Botão `🔄 Sugerir Peça Substituta Livre` que encontra itens disponíveis da mesma categoria na data do conflito.
- **Alertas Operacionais Inteligentes na Tabela de Locações (`Locacoes.jsx`)**:
  - Sobrescreve o status de separação por **Vermelho Alerta de Emergência**: `🚨 REPARO PENDENTE! (NomePeça até DD/MM)` caso haja item em reparo sem prontidão a tempo.

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

### 🛒 4.8. Compras, Aquisições & Fornecedores (`/src/pages/Compras/`, `/Fornecedores/`)
- **Gestão de Fornecedores (`Fornecedores.jsx`)**: Cadastro de parceiros, fabricantes e contatos.
- **Ordens de Compra (`Compras.jsx`, `NovaCompra.jsx`)**:
  - **Ordenação Inteligente**: Reordena automaticamente os itens com status `No Acervo` / `Chegou` / `Concluído` para o **rodapé da tabela**, mantendo os itens pendentes e a caminho em destaque no topo.
  - **Estilo Transparente / Esmaecido**: Aplica opacidade de 45% (`opacity: 0.45`), texto riscado (`line-through`) e fundo discreto nos itens já finalizados.
  - **Cards KPI & Abas Enterprise Luxury**: Cards de estatísticas e abas estilizadas com gradientes pastéis, contornos dourados e sombras 3D elevadas.

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
4. **Segurança Operacional**: Prevenção de duplicidade de aluguel no acervo, controle rigoroso de acessos de funcionários e rastreamento automático de itens em manutenção.

---

## 🚀 6. STATUS ATUAL E ESTABILIDADE

- **Compilação / Build**: Verificado e aprovado via `npm run build` com **0 erros** (`✓ built in 12.57s - 13.68s`).
- **Pronto para Escala**: Estrutura modular preparada para receber novos tenants e suportar a operação diária com estabilidade e elegância visual.

---

## 📅 7. HISTÓRICO DE SESSÕES DE DESENVOLVIMENTO

### 🗓️ Sessão: 11/08/2026 — 13h56 às 14h20 (BRT)

**Funcionalidades & Refatorações Entregues:**
- ✅ **📱 Refatoração Definitiva da Responsividade Mobile (`Locacoes.jsx` & `Locacoes.css`)**:
  - **Alinhamento Simétrico dos Botões do Topo**: Os botões `+ NOVA LOCAÇÃO` e `📅 DISPONIBILIDADE` foram alinhados em **2 colunas de 50% de largura cada (`repeat(2, 1fr)`)**, resolvendo discrepâncias de largura e garantindo simetria perfeita.
  - **Igualdade Rigorosa de Altura nos Cards KPI**: Reescrita da estrutura com CSS Grid (`align-items: stretch`) e `height: 100%` nos cards `.stat-card-pro` para que todos os 4 cards assumam exatamente a mesma altura independente do texto interno.
  - **Padronização de Padding e Border-Radius**: Card padding unificado em `16px 18px` (desktop) e `12px 10px` (mobile) com `border-radius: 16px`/`14px`.
  - **Chips Operacionais Compactos**: Rótulos `🚚 SAEM`, `📦 ENTRAM` e `⚠️ ATRASADOS` otimizados para encaixe impecável na grade de 3 colunas em qualquer aparelho celular.
- ✅ **Build de Produção Verificado**: `npm run build` executado e aprovado com **0 erros** (`built in 15.38s`).

### 🗓️ Sessão: 11/08/2026 — 08h43 às 11h37 (BRT)

**Funcionalidades & Refatorações Entregues:**
- ✅ **💎 Refinamento de Excelência no Painel de Filtros Mobile (`Locacoes.css`)**:
  - **Zero Espaço em Branco**: Eliminados todos os `margins` e `paddings` invisíveis que empurravam a busca para o meio do card, deixando a caixa de pesquisa encostada no topo com altura ultra-compacta (`42px`).
  - **Grade de 3 Colunas dos Chips Operacionais**: `🚚 SAEM HOJE (0)`, `📦 ENTRAM HOJE (0)` e `⚠️ ATRASADOS (0)` agora se alinham em **1 única linha horizontal sem nenhum vazamento ou corte lateral** na tela do smartphone.
  - **Pílulas de Status em 2 Colunas Limpas**: Os botões de status (`Em Processo`, `Orçamentos`, `Confirmados`, `Arquivados`) organizam-se simetricamente em **2 colunas de 50% de largura**, criando um visual de aplicativo premium.
- ✅ **🚨 Barra de Filtros Rápidos de Operação do Dia**:
  - Chips dinâmicos com contagem automática de pedidos e alerta em tempo real.
- ✅ **📋 Modal de Romaneio de Separação & Checklist de Galpão (`ModalRomaneioSeparacao.jsx` & `.css`)**:
  - Opção no menu de 3 pontinhos `⋮` com checklist interativo, barra de progresso, impressão de folha A4/térmica de galpão e envio formatado via WhatsApp.
- ✅ **Build de Produção Verificado**: `npm run build` executado e aprovado com **0 erros** (`built in 14.19s`).

### 🗓️ Sessão: 10/08/2026 — 10h30 às 10h37 (BRT)

**Funcionalidades & Refatorações Entregues:**
- ✅ **💵 Lançamento Automático de Ressarcimento no Módulo Financeiro (`CheckoutPage.jsx`)**:
  - Integração da devolução com `financeiro_lancamentos` e `logs_atividades`.
  - Quando a devolução registra `totalRessarcimento > 0`, é criado automaticamente um lançamento pendente com categoria `Ressarcimento / Avarias`, forma de pagamento `A Cobrar`, vinculado ao número do pedido e cliente.
  - Gravação dos totais de avaria e faltas no documento Firestore da locação.
- ✅ **📄 Exportação PDF do Mapa de Separação em Formato Paisagem (`gerarMapaSeparacaoPDF.js` & `ModalCalendarioDisponibilidade.jsx`)**:
  - Criado o gerador de PDF profissional Landscape A4 com o Celebre Luxury Design System.
  - Botão **`📄 Exportar Mapa de Separação (PDF)`** no cabeçalho da Matriz de Disponibilidade.
  - Inclui cabeçalho com marca d'água, dados institucionais, KPIs de festas/ocupação e tabela zebrificada com detalhamento de reservas por data, pedido e cliente.
- ✅ **Build de Produção Verificado**: `npm run build` executado e aprovado com **0 erros** (`built in 16.91s`).

### 🗓️ Sessão: 09/08/2026 — 17h30 às 20h18 (BRT)

**Funcionalidades & Refatorações Entregues:**
- ✅ **Timeline Gantt Responsiva & 2 Quinzena no Mobile (`ModalCalendarioDisponibilidade.jsx`)**:
  - Cards de peças com divisão de dias em **1ª Quinzena (1 a 15)** e **2ª Quinzena (16 a 31)**. Dobrou o tamanho útil de toque e leitura no celular.
  - Dropdown compacto **`📌 RESERVAS (X)`** substituindo pílulas extensas, evitando sobrecarga visual do card.
- ✅ **Rastreabilidade de Composição de Kits/Decorações em Manutenção (`Estoque.jsx`)**:
  - `verificarConflitoManutencaoLocacao` atualizada para verificar peças embutidas em receitas de Kits e Decorações.
  - Validação inteligente com bloqueio de excessos e opção de ajuste automático para a quantidade livre segura.
  - Insígnia vermelha de conflito no acervo: `🚨 CONFLITO DE LOCAÇÃO: Pedido #2026-004 (Kaua Vitoriano)`.
- ✅ **Alertas de Emergência na Tabela de Locações (`Locacoes.jsx`)**:
  - Sobrescrita de status para `🚨 REPARO PENDENTE! (Display bale até 11/08)` quando houver item em manutenção sem prontidão a tempo.
- ✅ **Interatividade & Sugestão de Substitutos**:
  - Botão `🔗 Abrir Pedido ➔` no submodal para navegação 1-click até a locação.
  - Atalho `🛠️ Filtrar Peças em Reforma` no topo do calendário.
  - Modal `🔄 Sugerir Peça Substituta Livre` listando itens da mesma categoria no dia do conflito.
  - Botão `✅ Concluir Reparo dos Selecionados` na barra de lote do estoque.
- ✅ **Redesign & Ordenação no Módulo de Compras (`Compras.jsx` / `Compras.css`)**:
  - Reordenação de itens `No Acervo` para o **rodapé da tabela** com **opacidade de 45%** e texto riscado.
  - Cards KPI e Abas estilizados com gradientes pastéis, contornos dourados e sombras 3D elevadas.
- ✅ **Build de Produção Verificado**: `npm run build` executado e aprovado com **0 erros** (`built in 12.57s - 13.68s`).

### 🗓️ Sessão: 08/08/2026 — 18h00 às 19h35 (BRT)

**Funcionalidades entregues:**
- ✅ **🎨 Padronização Visual & Redesign do Cadastro de Acervo (`CadastroEstoque.jsx` & `CadastroEstoque.css`)**:
  - Removidos banners escuros topo dos cards (`#0f172a`), substituídos por `.ce-card-header-clean` e pílulas douradas `.ce-badge-gold` em conformidade com o Celebre Luxury Design System.
  - Ajuste de tipografia suave: `letter-spacing: 0.2px` / `0.3px` positivo e `word-spacing: 0.05rem` para evitar letras espremidas ou palavras grudadas.
  - Alinhamento simétrico de inputs: Trava de `26px` de altura nos rótulos de `NOME DO PRODUTO` e `SKU` para alinhamento pixel-perfect das caixas na mesma linha horizontal.
- ✅ **⚡ Gerador de SKU Automático & Correção de Erro de Execução**:
  - Resolvido o erro de referência (`ReferenceError: atualizarSKU is not defined`) que travava a geração ao alternar entre Peça Avulsa, Kit e Decoração.
  - Sequenciador automático robusto: `DEC-001`, `DEC-002`... para Decoração Completa, `KIT-001`, `KIT-002`... para Kits (gerando `KIT-001-P1`, `KIT-001-P2` nas sub-peças) e `PEC-001` / iniciais para peças avulsas.
- ✅ **✨ Refatoração Operacional da Decoração Completa & Pegue e Monte**:
  - **Foto Principal Única no Catálogo**: O Card 1 define a foto oficial do cenário por completo, sendo a única exibida na capa do produto no catálogo público (`Catalago.jsx`).
  - **Vitrine de Peças Inclusas com Fotos**: Exibição elegante com fotos em miniatura, valores avulsos e seletores de quantidade para as peças que compõem o cenário (capas, cilindros, mesas, vasos).
  - **Regras Comerciais das Modalidades**:
    - **`📦 Pegue e Monte`**: O cliente pode retirar na loja ou optar por solicitar o serviço de frete/montagem da Celebre (somando a taxa ao pedido no carrinho/PDV).
    - **`✨ Decoração`**: Cenários montados exclusivos da loja, blindados para nunca virarem Pegue e Monte.
- ✅ **Build de Produção Verificado**:
  - `npm run build` executado and aprovado com **0 erros** (`built in 14.41s`).

---

## 🔮 8. PRÓXIMOS PASSOS A SEGUIR

1. **🧹 Módulo de Limpeza Automática de Mídia (Cron / Function)**:
   - Executar a rotina de limpeza para remover fotos temporárias cuja data `expirarFotosEm` seja anterior a hoje e `!fotosManterPermanente`.
2. **💬 Notificação Financeira Integrada**:
   - Adicionar atalho 1-click no Módulo Financeiro para envio de cobrança via WhatsApp de lançamentos pendentes de ressarcimento.
3. **🔔 Lembretes de Retirada/Devolução via WhatsApp**:
   - Disparo automático de alertas para os clientes 24h antes da data de retirada ou devolução do acervo.

---

> **⏱️ Última atualização:** 11/08/2026 às 08:49 (BRT)  
> **✍️ Atualizado por:** Antigravity AI — Sessão CELEBRE02

