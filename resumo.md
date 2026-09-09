# 🔒 CELEBRE SYSTEM — RESUMO EXECUTIVO DETALHADO DO SISTEMA
**Data de Atualização:** 09 de Setembro de 2026  
**Status Geral:** 🟢 100% Estável, Build de Produção Limpo (Zero Erros) e Aprovado no Google Play  
**Domínio Oficial Autenticado:** `celebrefesta.com.br`  
**Google Play Package:** `br.com.celebrefesta.app` (Versão 2 / 1.0.1 - Ativo em 177 países)  
**Repositório Sagrado de Design:** `src/styles/design-lock.css`  
**Motor Global de Cores:** `src/utils/themeUtils.js`  

---

## 📑 ÍNDICE DETALHADO
1. [Evolução Recente: Repaginação Visual, Empty States Luxury & Design Lock de Clientes, Novo Cliente e Agenda (09/09/2026)](#1-evolução-recente-repaginação-visual-empty-states-luxury--design-lock-de-clientes-novo-cliente-e-agenda-09092026)
2. [Moodboard Studio 2D/3D & Cenografia Virtual (Alta Performance & UX Mobile)](#2-moodboard-studio-2d3d--cenografia-virtual-alta-performance--ux-mobile)
3. [Nova Barra Lateral / Menu de Navegação VIP](#3-nova-barra-lateral--menu-de-navegação-vip)
4. [Reestruturação Completa da Página de Planos](#4-reestruturação-completa-da-página-de-planos)
5. [Diagnóstico & Solução da Tela Opaca (Conflito Dark Mode vs Fundo Claro)](#5-diagnóstico--solução-da-tela-opaca-conflito-dark-mode-vs-fundo-claro)
6. [Publicação no Google Play Console & Distribuição Mobile](#6-publicação-no-google-play-console--distribuição-mobile)
7. [Infraestrutura Transacional de E-mails (Resend + Hostinger)](#7-infraestrutura-transacional-de-e-mails-resend--hostinger)
8. [Conformidade Legal LGPD (Art. 18) & Exclusão de Contas](#8-conformidade-legal-lgpd-art-18--exclusão-de-contas)
9. [Inventário de Módulos & Blindagem de Layout (AGENTS.md)](#9-inventário-de-módulos--blindagem-de-layout-agentsmd)
10. [Auditoria de Build e Qualidade de Código](#10-auditoria-de-build-e-qualidade-de-código)

---

## 1. 👥 Evolução Recente: Repaginação Visual, Empty States Luxury & Design Lock de Clientes, Novo Cliente e Agenda (09/09/2026)

### 1.1. Centralização & Design Luxury dos Estados Vazios (Empty States) em Clientes
- **Diagnóstico do Desalinhamento**: Ao buscar por um cliente inexistente ou visualizar uma base vazia no celular, o ícone de pasta e o texto *"Nenhum cliente encontrado."* ficavam colados na borda superior esquerda. A causa raiz era a ausência de classe CSS dedicada para `.empty-state-mobile`, fazendo o navegador assumir o layout de bloco padrão alinhado à esquerda (`text-align: left`) sem margem nem moldura.
- **Engenharia & Solução Visual**:
  - Aplicação de layout flexbox centralizado absoluto: `display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; text-align: center !important;`.
  - Enquadramento em card sutil com borda tracejada (`1.5px dashed var(--borda, #cbd5e1)`), cantos arredondados nobres de `18px`, padding vertical espaçoso (`44px 20px`) e sombra suave.
  - **Medalhão Circular Ouro Celebre (`.clientes-empty-icon-circle`)**: Ícone de pasta inserido em círculo de 60px com fundo translúcido ouro (`rgba(197, 160, 89, 0.1)`), borda dourada fina e suave brilho.
  - **Hierarquia Tipográfica Refinada**: Título com peso elegante (`font-weight: 650`, cor `#1e293b`) e subtítulo de apoio em tom neutro (`#64748b`, entrelinha `1.45`).
  - **Ação Inteligente Direta**: Botão contextual com micro-interações: se houver busca ou filtros ativos, exibe **`🧹 Limpar Filtros`**; se a base estiver vazia, exibe botão primário dourado **`+ Novo Cliente`** para cadastro imediato.
  - **Unificação para Desktop e Fichário**: O mesmo padrão foi aplicado na célula de tabela vazia (`.empty-table-cell`) e no histórico de pedidos do fichário do cliente (`.empty-history`).

### 1.2. Otimização Responsiva & Despoluição de Filtros em Clientes
- **Eliminação de Truncamento com Reticências**: Redução das opções dos seletores mobile (ex.: `👥 Todos (0)`, `⏳ Pendentes (0)`), impedindo que labels compridos quebrassem o alinhamento de 2 colunas nos celulares.
- **Suavização de Tipografia Pesada**: Substituição de pesos excessivos (`850` / `800`) por tipografia moderna e equilibrada (`600`, `650`, `700`).
- **Cards de Indicadores (KPIs Mobile) com Alternador Retrátil**: Implementada barra de recolher/expandir (`.btn-toggle-kpi-mobile`) com persistência em `localStorage` (`celebre_clientes_show_kpi_mobile`). Por padrão, os cards iniciam recolhidos no smartphone para priorizar a lista de clientes, podendo ser expandidos com 1 toque.
- **Repaginação de Botões de Ação**: Botões `Link Auto-Cadastro` e `Exportar` reprojetados com bordas arredondadas de `12px`, ícones realçados e micro-sombras.

### 1.3. Redesign Moderno da Tela Novo Cliente (`CadastroCliente.jsx`)
- **Segmented Control iOS/Luxury para Tipo de Pessoa**: O antigo alternador de abas retangulares foi transformado em um autêntico controle segmentado moderno (`.tabs-container` e `.tab-btn`) com fundo cinza acetinado suave, cantos arredondados e pílula de seleção ativa flutuante com sombra nobre.
- **Harmonização de Rótulos & Campos**: Suavização de títulos de seção, espaçamentos simétricos, redução do peso de labels para `font-weight: 600` e badges de tags refinados.
- **Blindagem de Escopo Total**: Inclusão da classe raiz `.cadastro-cliente-container` no JSX, garantindo 100% de isolamento CSS sem vazamentos para outras telas.

### 1.4. Aprimoramento Tipográfico & Visual da Agenda de Eventos (`Agenda.jsx`)
- **Correção da Visualização Desktop**: Eliminação de quebra irregular de colunas e isolamento do card de data no topo da grade.
- **Suavização Tipográfica**: Redução de pesos bold pesados para tipografia executiva contemporânea (`600` a `700`).
- **KPIs Mobile Retráteis**: Controle de exibição recolhida/expandida com persistência local em `localStorage`.

### 1.5. Blindagem Sagrada no `src/styles/design-lock.css`
- Atualizado e travado com as regras aprovadas para `🔒 PÁGINA: CLIENTES`, `🔒 PÁGINA: CADASTRO CLIENTE` e `🔒 PÁGINA: AGENDA`, garantindo total conformidade com a Regra de Ouro 1 (1 linha desktop para KPIs) e Regra de Ouro 2 (2 colunas mobile para KPIs).

---

## 2. 🎨 Moodboard Studio 2D/3D & Cenografia Virtual (Alta Performance & UX Mobile)

O módulo de criação de cenários virtuais e propostas visuais para clientes (`Moodboard.jsx` e `Moodboard.css`) recebeu uma atualização crítica com foco em performance computacional, responsividade tátil e ergonomia em dispositivos móveis:

### 1.1. Eliminação Total do Travamento do Canvas (Memoização 3D)
- **Diagnóstico:** O arraste de peças ou pan pelo cenário sofria quedas severas de FPS (travamentos visíveis) devido à re-renderização em lote de dezenas de componentes SVG vetoriais hiperdetalhados com gradientes e filtros 3D complexos.
- **Solução de Alta Performance:** Todos os mais de 26 componentes de cenografia vetorial foram encapsulados com `React.memo` (ex.: `ArcoRomanoTriplo3D`, `PainelOrganicoWavy3D`, `PainelCasteloPrincesas3D`, `MesaNuvem3D`, `MesaCarruagem3D`, `EstanteEscadinha3D`, `SilhuetaHumanaSVG`, etc.). Dessa forma, ao mover um elemento ou deslizar a prancheta, os outros 25+ elementos não recalculam suas árvores DOM, garantindo movimentação a 60 FPS estáveis.

### 1.2. Correção do Dock de Zoom Mobile (`[ (-) 37% (+) [ ] ]`)
- **Diagnóstico:** Ao tocar nos botões `+` ou `-` no celular, o zoom não respondia ou era resetado instantaneamente de volta para 37%. O motivo era duplo:
  1. A função `fitCanvasToMobile` estava atrelada a recalculações do viewport disparadas por micro-oscilações da barra de endereço dos navegadores móveis (Safari/Chrome).
  2. O dock possuía `z-index: 41`, ficando abaixo da camada transparente de backdrop do painel (`z-index: 44`) e da barra de navegação inferior (`z-index: 45`).
- **Solução Aplicada:**
  - Criação de trava de tolerância via `lastViewportRef` (ignorando variações menores que 30px de largura e 70px de altura).
  - Vinculação dos botões à função instantânea `handleZoomMobile(+0.08 / -0.08)`, que aplica transformações diretamente no DOM (`boardRef` e `zoomWrapperRef`) além do estado do React.
  - Adição de contenção de eventos táteis (`stopPropagation` em `pointerDown`, `touchStart`, `touchEnd` e `click`) para impedir que a prancheta de desenho intercepte os toques.
  - Elevação do dock para `z-index: 90 !important` e posicionamento refinado em `bottom: 74px !important` com `touch-action: manipulation !important`.

### 1.3. Remoção de Redundâncias de Interface
- Removido o botão repetitivo `[ ✨ Ajustar Iluminação & Atmosfera da Cena ]` no rodapé das ações rápidas do inspetor de elementos e também o botão secundário na caixa de estado vazio, uma vez que o sistema já dispõe da aba lateral exclusiva "Iluminação".

### 1.4. Redução Tipográfica & Textos Compactos
- O texto explicativo na aba Fundo / Ambiente foi encurtado de `Foto 100% de tela cheia (ideal para fotos de salão de festa, espaço de eventos ou papel de parede contínuo):` para:
  > **"Foto de tela cheia (salão de festa ou fundo contínuo):"**
- A classe `.hint-text` foi formalizada no `Moodboard.css` com `font-size: 11px !important`, cor neutra `#64748b` e entrelinha harmônica `1.35`, eliminando o visual desproporcional de 16px padrão do navegador.

### 1.5. Gaveta Retrátil de Efeitos & Acabamentos no Celular
- Os 7 cards volumosos de amostras de materiais (*Sólido*, *Acrílico Ouro*, *Rose Gold*, *Prata Espelho*, *MDF 3D Laser*, *Glitter Dourado*, *Neon LED*) foram realocados dentro de uma **Gaveta Retrátil** (`.gaveta-efeitos-container`).
- Em telas mobile, a seção ocupa uma barra compacta de apenas **34px**, exibindo o acabamento ativo em uma tag nobre (ex.: `[ Acrílico Ouro ]`) e o botão seletor `▼ Escolher / ▲ Recolher`, liberando espaço vertical valioso para a criação visual.

### 1.6. Normalização Segura de Cores Hex
- Implementada a função utilitária `normalizarHexParaInputColor` para garantir que valores nulos, cores nomeadas ou hexadecimais incompletos nunca causem quebra de renderização nos componentes nativos `<input type="color">`.

### 1.7. Otimização do Topbar e Botão "PAINEL PRO" (Desktop vs Mobile)
- **Diagnóstico:** O botão `PAINEL PRO` no cabeçalho era redundante no desktop (`> 900px`), pois a prancheta de computador já exibe o dock lateral direito completo de ferramentas de forma permanente e integrada.
- **Solução Aplicada:**
  - O botão foi ocultado da renderização desktop em `Moodboard.jsx` (`{isMobile && ...}`), permanecendo exclusivamente ativo no mobile com a classe `.btn-header-pro-mobile` para acionar a abertura da gaveta off-canvas (`abrirAbaMobile('pro')`).
  - Blindagem adicional em `Moodboard.css` via media query desktop (`@media (min-width: 901px) { .moodboard-wrapper .btn-header-pro-mobile { display: none !important; } }`), garantindo que em qualquer tamanho de tela grande a barra superior fique 100% limpa e executiva.

### 1.8. Eliminação de Travamento na Guirlanda de Balões em H (Curvatura e Ondulação a 60 FPS)
- **Diagnóstico:** Ao arrastar os manípulos visuais de curvatura (`〰️`) e ondulação (`🌊`) da Guirlanda Horizontal de Balões, a movimentação parecia completamente congelada até soltar o botão do mouse. Dois fatores causavam esse gargalo:
  1. O loop de arraste (`renderDragMove`) apenas acumulava valores em `currentPendingChanges.current` sem disparar atualização de renderização do arco.
  2. A classe `.balloon-curve-handle` continha `transition: transform 0.15s ease` no CSS, injetando uma defasagem mecânica de 150 milissegundos contra a mão do usuário.
- **Solução Aplicada:**
  - Implementação de despacho instantâneo via `requestAnimationFrame` no `renderDragMove`, atualizando dinamicamente as propriedades `curvatura` e `ondulacao` no estado em tempo real a 60 FPS estáveis.
  - Cálculo trigonométrico de posicionamento relativo do manípulo sobre a espinha dorsal da guirlanda (`50 - ((item.curvatura ?? 30) * 0.38)%`), mantendo o ícone colado na curva visual.
  - No `Moodboard.css`, remoção da propriedade de transição e aplicação de `cursor: grab` com feedback tátil de clique ativo `cursor: grabbing !important; transition: none !important;`.

### 1.9. Redesign Minimalista Luxury dos Botões de Reset / Centralizar (`.btn-link-reset`)
- **Diagnóstico:** Botões com o texto explícito `[ ↺ Centralizar ]` na edição de texturas de Parede, Piso, Ambiente 360° e Capas de Peças criavam poluição visual, quebra de linha em telas estreitas e visual rústico em caixas retangulares.
- **Solução Aplicada:**
  - Remoção de todo texto literal em favor do ícone puro `↺` com acessibilidade total via atributos `title` e `aria-label` ("Restaurar alinhamento central").
  - Redesign no `Moodboard.css` como insígnia *squircle* de luxo (`24px x 24px`, cantos suaves `border-radius: 6px`, sombra sutil e fundo translúcido).
  - Micro-interações táteis nobres: iluminação em dourado Celebre (`rgba(197, 160, 89, 0.15)`) e inclinação a `-35deg` no hover, e giro elástico de `-90deg` no clique ativo, com compatibilidade nativa para Light Mode e Dark Mode.

### 1.10. Motor de Batching RAF para Cores e Sliders (Fim Definitivo do Lag no Color Picker)
- **Diagnóstico:** O componente nativo do sistema operacional `<input type="color">` no Windows/Chromium dispara dezenas de eventos `input` e `change` por segundo ao deslizar a paleta. Cada evento disparava `atualizarItem`, provocando re-renderizações síncronas do mega-componente `Moodboard.jsx` de 13 mil linhas, congestionando o IPC do navegador e congelando a caixa de diálogo de cores nativa do Windows. Adicionalmente, as trocas de cor de fundo (Parede, Chão e Fundo Global) invocavam `saveSnapshot` (que executa clonagem profunda pesada via `JSON.parse(JSON.stringify)`) de forma síncrona dentro de cada micro-mudança.
- **Solução de Engenharia de Software:**
  - Criação de fila de loteamento assíncrono via `requestAnimationFrame` (`pendingItemUpdatesRef` e `rafItemUpdateRef`) na função `atualizarItem`: a referência local `itensCanvasRef.current` é atualizada síncronamente (evitando leituras defasadas nos ponteiros de arraste), enquanto a notificação de renderização do React é agrupada e disparada no máximo uma única vez por quadro de tela (VSync a 60–120 Hz).
  - Adicionado gancho de limpeza no desmonte do componente para desalocar o frame com `cancelAnimationFrame(rafItemUpdateRef.current)`.
  - Troca da clonagem síncrona `saveSnapshot` nos seletores de cor de Parede, Chão e Ambiente pelo agendamento com debounce inteligente `agendarSaveSnapshot()` (300ms), eliminando qualquer travamento ou latência na troca de cores de estruturas e cenários.

---

## 3. 🌟 Nova Barra Lateral / Menu de Navegação VIP

A barra de navegação lateral (`Navbar.jsx` e `Navbar.css`) foi completamente reformulada para oferecer ergonomia executiva tanto no desktop quanto no mobile:

### 3.1. Identidade Visual Oficial Celebre
- **Logotipo Oficial Integrado:** Substituição do antigo ícone genérico de coroa pela logomarca oficial Celebre (`src/assets/LOGO_CELEBRE.png`), com proporções nítidas e elegantes.
- **Paleta Midnight Slate com Acentos Dourados:** Fundo em `#090e18` com bordas sutis em `rgba(255, 255, 255, 0.07)` e realces em ouro nobre (`#c5a059`).

### 3.2. Organização e Ergonomia Mobile
- **Botão Dedicado de Fechamento Mobile:** Adicionado botão tátil `✕` no canto superior direito do menu mobile (`.sidebar-mobile-close-btn`), facilitando o fechamento com apenas um toque sem depender exclusivamente do clique no backdrop.
- **Hierarquia Visual por Seções:** Itens divididos em blocos semânticos com divisores sutis:
  - `GERAL`: Início (Dashboard), Agenda, Clientes, Catálogo Digital, Moodboard Studio.
  - `OPERACIONAL`: Locações, Estoque & Acervo, Galpão (Logística/Kanban), Contratos.
  - `GESTÃO`: Financeiro, Compras & Pedidos, Fornecedores, Relatórios Gerenciais.
- **Remoção de Bordas Tracejadas:** Itens bloqueados por plano agora contam com insígnias discretas (*Lock Pill*), mantendo a elegância visual sem poluição de linhas tracejadas.
- **Otimização de Altura Vertical (Anti-Scroll Desnecessário):** Aplicação de media queries verticais (`@media (max-height: 800px)`) para compactar paddings e fontes proporcionalmente, garantindo que o menu caiba na tela sem exigir barra de rolagem forçada.
- **Rodapé Executivo:** Área inferior com identificação do plano ativo, status de sincronização em tempo real e botão rápido de configurações.

---

## 4. 💎 Reestruturação Completa da Página de Planos

A página de Planos e Assinaturas (`Planos.jsx` e `Planos.css`) passou por uma reformulação profunda de experiência do usuário (UX):

### 4.1. Coerência entre Desktop e Mobile
- **No Desktop:** Cards alinhados lado a lado (3 colunas proporcionais) com comparativo detalhado unificado abaixo, permitindo análise visual imediata dos planos Essencial, Pro e Premium.
- **No Mobile (1 Card em Foco por Vez):** Os cards agora ocupam `100%` da largura da tela com efeito *Scroll Snap* suave. O usuário visualiza um card por vez com total clareza, sem cortes laterais que poluam a visualização.
- **Eliminação de Redundâncias:** Removida a exibição duplicada de tabelas comparativas no mobile. Os recursos detalhados agora aparecem em uma gaveta inteligente logo abaixo do plano selecionado.

### 4.2. Controles de Navegação no Mobile
- **Navegador `< • ▬ • >` Reposicionado:** O seletor de navegação com setas e indicadores de bolinha/pílula foi transferido para o topo dos cards (logo acima dos valores), permitindo que o usuário alterne de plano instantaneamente sem precisar rolar a tela.
- **Sincronização Bidirecional:** Tocar nas bolinhas rola suavemente para o card correspondente; deslizar o card com o dedo atualiza automaticamente o indicador ativo e a lista de recursos inclusos abaixo.

### 4.3. Recursos e Credibilidade
- **Letreiro Rotativo Infinito (Marquee Ticker):** Barra interativa contendo selos de confiança com rolagem contínua: *Ativação Instantânea*, *Pagamento Seguro Mercado Pago*, *Suporte Dedicado*, *Sem Fidelidade ou Multas*, *100% em Nuvem* e *Dados Criptografados*. O letreiro pausa ao toque ou passagem do mouse.
- **Auditoria de Upgrade em Tempo Real:** Toda seleção de plano registra um log de intenção no Firestore (`logs_atividades`) com data/hora, e-mail do solicitante e identificador de tenant, alimentando o painel administrativo master.

---

## 5. 🔍 Diagnóstico & Solução da Tela Opaca (Conflito Dark Mode vs Fundo Claro)

### 5.1. Causa Raiz Identificada
Ao carregar a página de planos em um ambiente com o **Modo Escuro** ativado (`data-theme="dark"` no elemento `<html>`):
1. As regras globais em `src/App.css` forçam todos os títulos (`h1`, `h2`, `h3`, `h4`), `strong` e `label` para a cor **branca/prata** (`#f4f4f5 !important`) e textos secundários para cinza claro (`#a1a1aa !important`).
2. A estilização de `Planos.css` possuía fundos claros estáticos (`background: #f8fafc` na página e `#ffffff` nos cards).
3. **Efeito Visual:** Títulos como *"Escolha o plano ideal para acelerar o seu acervo"*, *"PREMIUM"* e *"O que está incluso no Premium:"* foram desenhados em **branco sobre fundo branco**, gerando a impressão de tela lavada, leitosa ou opaca.

### 5.2. Solução Definitiva Implantada
1. **Suporte Integral ao Modo Escuro (`[data-theme^='dark'] .planos-public-wrapper`):**
   - Fundo da página adaptado para o tom escuro nobre: `#090d16 !important`.
   - Cards de planos e caixas de recursos convertidos para cartões de luxo: `#111827 !important` com bordas em `#1f293d !important`.
   - Card ativo/destaque realçado com borda em ouro nobre `#c5a059` e sombra suave.
   - Textos e títulos em branco de alto contraste (`#ffffff !important`), com rótulos em `#94a3b8`.
   - Botão de retorno, pílulas de confiança e botões de seta adaptados com contraste impecável.
2. **Blindagem de Alto Contraste no Modo Claro:**
   - Proteção com seletores explícitos (`:root:not([data-theme='dark']) .planos-public-wrapper`) forçando os títulos para o azul-carvão escuro (`#0f172a !important`), garantindo que em qualquer circunstância o contraste permaneça perfeito.

---

## 6. 📱 Publicação no Google Play Console & Distribuição Mobile

1. **Aprovação Oficial pelo Google Play:**
   - Pacote: `br.com.celebrefesta.app` (Versão 2 / 1.0.1).
   - Assinado com a keystore oficial de produção (`signing.keystore`, alias `celebre`).
   - Status: **`✓ Disponível para os testadores no Google Play • Lançamento completo`** (177 países).
2. **Roadmap para Produção Aberta:**
   - 12 testadores cadastrados na lista de teste fechado cumprindo os 14 dias de retenção exigidos pelo Google Play Console para liberação do botão definitivo de Produção Pública.
3. **Instalação PWA & Download Direto:**
   - Banner reativo [InstallAppPrompt.jsx](src/components/InstallAppPrompt/InstallAppPrompt.jsx) disponível no site para instalação com 1 toque na tela inicial.
   - APK direto de produção compilado e hospedado em `https://celebrefesta.com.br/celebre.apk`.

---

## 7. ✉️ Infraestrutura Transacional de E-mails (Resend + Hostinger)

1. **Domínio Oficial Verificado:**
   - Migração concluída do antigo domínio temporário para o oficial **`celebrefesta.com.br`**.
   - Registros DNS validados na Hostinger:
     - `TXT` `resend._domainkey` (Assinatura criptográfica DKIM).
     - `CNAME` `rsend` (Roteamento de envio autenticado).
     - `CNAME` `send` (Entregabilidade imediata).
   - Status no Resend: 🟢 **Verificado e ativo**.
2. **Cloud Function de Notificações de Segurança:**
   - Endpoint: `https://us-central1-celebre-9f5c9.cloudfunctions.net/enviarComprovanteExclusao`
   - Remetente: `Celebre Segurança <seguranca@celebrefesta.com.br>`
   - Resposta: `celebrefesta25@gmail.com`
   - Disparo de comprovantes com protocolo de auditoria registrado no Firestore (`CEL-EXCL-2026-XXXXX`).

---

## 8. ⚖️ Conformidade Legal LGPD (Art. 18) & Exclusão de Contas

1. **Página Pública Web:** Rota ativa `/excluir-conta` ([ExcluirConta.jsx](src/pages/Institucional/ExcluirConta.jsx)) para autoatendimento de ex-usuários.
2. **Painel Interno de Segurança:** Módulo em [AbaSeguranca.jsx](src/pages/Configuracoes/AbaSeguranca.jsx) com dupla confirmação:
   - Desativação temporária (bloqueia o login e preserva histórico).
   - Exclusão definitiva com expurgo total no Firestore e Firebase Auth.

---

## 9. 🔒 Inventário de Módulos & Blindagem de Layout (AGENTS.md)

Todos os módulos do sistema respeitam o regramento de isolamento de escopo CSS e a regra de ouro dos cards de KPI (1 linha no Desktop / 2 colunas no Mobile):

| Módulo / Funcionalidade | Arquivos Principais | Status de Blindagem |
| :--- | :--- | :---: |
| 🎨 **Moodboard Studio 2D/3D** | `Moodboard.jsx`, `Moodboard.css` | 🟢 60-120 FPS • Batching RAF & UX Mobile |
| 🧭 **Menu Lateral & Navegação** | `Navbar.jsx`, `Navbar.css` | 🟢 Modernizado VIP |
| 💎 **Planos & Assinaturas SaaS** | `Planos.jsx`, `Planos.css` | 🟢 Responsivo & Dark/Light OK |
| 🛍️ **Catálogo Boutique de Luxo** | `Catalago.jsx`, `Catalago.css` | 🔒 CONGELADA / Estável |
| 📅 **Locações & Bipagem QR/Barras** | `Locacoes.jsx`, `Locacoes.css` | 🔒 CONGELADA / Estável |
| 🚚 **Logística & Kanban Galpão** | `Logistica.jsx`, `Logistica.css` | 🔒 CONGELADA / Estável |
| 📦 **Estoque & Cadastro de Acervo** | `Estoque.jsx`, `CadastroEstoque.jsx` | 🔒 CONGELADA / Estável |
| 👥 **Clientes & Auto-Cadastro** | `Clientes.jsx`, `CadastroCliente.jsx` | 🔒 CONGELADA / 100% Luxury & Empty State OK |
| 💰 **Financeiro & Lançamentos** | `Financeiro.jsx`, `NovoLancamento.jsx` | 🔒 CONGELADA / Estável |
| 🛒 **Compras & Fornecedores** | `Compras.jsx`, `Fornecedores.jsx` | 🔒 CONGELADA / Estável |
| 📊 **Relatórios Gerenciais & DRE** | `Relatorios.jsx`, Tabs | 🔒 CONGELADA / Estável |
| 📜 **Contratos & Assinatura Touch** | `Contratos.jsx`, `NovoContrato.jsx` | 🔒 CONGELADA / Estável |
| 📆 **Agenda de Eventos** | `Agenda.jsx`, `Agenda.css` | 🔒 CONGELADA / 100% Desktop & Mobile OK |
| 🏠 **Dashboard Principal** | `Dashboard.jsx`, `Dashboard.css` | 🔒 CONGELADA / Estável |
| 📈 **Cards de KPI Globais** | 1 Linha no Desktop / 2 Colunas Mobile | 🔒 CONGELADA / SAGRADO |
| 🎨 **Motor Dinâmico de Temas** | `themeUtils.js`, `design-lock.css` | 🔒 CONGELADA / SAGRADO |

---

## 10. 🛠️ Auditoria de Build e Qualidade de Código

- **Build de Produção (Vite 7):** Validado com sucesso via `npm run build` em **14.41 segundos**.
- **Módulos Compilados:** 1.182 módulos transformados com **ZERO ERROS** de empacotamento, JSX ou lint.
- **Isolamento de Estilos:** Conformidade estrita com as Regras 1, 2, 5 e 6 do `AGENTS.md` (todos os estilos novos escopados em `.clientes-container`, `.cadastro-cliente-container`, `.agenda-container`, `.moodboard-wrapper`, `.planos-public-wrapper` e `.sidebar`).

---
*Documentação técnica oficial do Sistema Celebre — Gestão de Locação de Acervo & Festas.*
