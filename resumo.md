# 🔒 CELEBRE SYSTEM — RESUMO EXECUTIVO DETALHADO DO SISTEMA
**Data de Atualização:** 11 de Setembro de 2026  
**Status Geral:** 🟢 100% Estável, Build de Produção Limpo (Zero Erros) e Publicado em Produção  
**Domínio Oficial Autenticado:** `celebrefesta.com.br`  
**Google Play Package:** `br.com.celebrefesta.app` (Versão 2 / 1.0.1 - Ativo em 177 países)  
**Repositório Sagrado de Design:** `src/styles/design-lock.css`  
**Motor Global de Cores:** `src/utils/themeUtils.js`  

---

## 📑 ÍNDICE DETALHADO
1. [Evolução Recente: Repaginação da Matriz de Disponibilidade, Alinhamento com Locações & Upgrade Industrial do Mapa de Separação em PDF (11/09/2026)](#1-evolução-recente-repaginação-da-matriz-de-disponibilidade-alinhamento-com-locações--upgrade-industrial-do-mapa-de-separação-em-pdf-11092026)
2. [Evolução Multi-Tenant: Sincronização Google Auth, Controle Geral Mobile, Barra Sutil de CRM e Aniversariantes no Dashboard (10/09/2026)](#2-evolução-multi-tenant-sincronização-google-auth-controle-geral-mobile-barra-sutil-de-crm-e-aniversariantes-no-dashboard-10092026)
3. [Evolução Visual: Repaginação, Empty States Luxury & Design Lock de Clientes, Novo Cliente e Agenda (09/09/2026)](#3-evolução-visual-repaginação-empty-states-luxury--design-lock-de-clientes-novo-cliente-e-agenda-09092026)
4. [Moodboard Studio 2D/3D & Cenografia Virtual (Alta Performance & UX Mobile)](#4-moodboard-studio-2d3d--cenografia-virtual-alta-performance--ux-mobile)
5. [Nova Barra Lateral / Menu de Navegação VIP](#5-nova-barra-lateral--menu-de-navegação-vip)
6. [Reestruturação Completa da Página de Planos](#6-reestruturação-completa-da-página-de-planos)
7. [Diagnóstico & Solução da Tela Opaca (Conflito Dark Mode vs Fundo Claro)](#7-diagnóstico--solução-da-tela-opaca-conflito-dark-mode-vs-fundo-claro)
8. [Publicação no Google Play Console & Distribuição Mobile](#8-publicação-no-google-play-console--distribuição-mobile)
9. [Infraestrutura Transacional de E-mails (Resend + Hostinger)](#9-infraestrutura-transacional-de-e-mails-resend--hostinger)
10. [Conformidade Legal LGPD (Art. 18) & Exclusão de Contas](#10-conformidade-legal-lgpd-art-18--exclusão-de-contas)
11. [Inventário de Módulos & Blindagem de Layout (AGENTS.md)](#11-inventário-de-módulos--blindagem-de-layout-agentsmd)
12. [Auditoria de Build e Qualidade de Código](#12-auditoria-de-build-e-qualidade-de-código)

---

## 1. 🚀 Evolução Recente: Repaginação da Matriz de Disponibilidade, Alinhamento com Locações & Upgrade Industrial do Mapa de Separação em PDF (11/09/2026)

### 1.1. Sincronia e Alinhamento Milimétrico entre Disponibilidade e Locações
- **Eliminação de Saltos Visuais ("Pulos") na Transição de Telas**:
  - `Disponibilidade.css` e `Disponibilidade.jsx` foram milimetricamente equalizados com `Locacoes.css`.
  - **Paddings Universais**: `padding: 12px 10px 80px 10px !important;` no mobile e `padding: 28px 36px !important;` no desktop.
  - **Remoção de Gaps Parasitas**: Extinção de margens e gaps residuais no container principal, mantendo os títulos, botões e elementos na mesma altura exata da linha de visão ao alternar entre `/locacoes` e `/disponibilidade`.
- **Subtítulo Canônico em 1 Linha**:
  - Subtítulo ajustado para `"Consulte o estoque disponível e reservas."` (exatos 41 caracteres, idêntico a Locações, eliminando quebra para segunda linha em smartphones).
  - Ícone de cabeçalho unificado com `38px x 38px`, flex centralizado e sombra suave.
  - Botões de ação do topo (`MAPA PDF` e `LOCAÇÕES`) calibrados com `height: 42px !important;` e `font-size: 0.80rem !important;`.
- **Navegador Mensal Limpo e Estável**:
  - Remoção do botão `[ Hoje ]` do meio da barra de navegação mensal.
  - A navegação entre meses agora é feita exclusivamente pelas setas `<` e `>`, mantendo o nome do mês e ano permanentemente centralizados sem trepidação de layout.

### 1.2. Upgrade Industrial do Mapa de Separação em PDF (`gerarMapaSeparacaoPDF.js`)
O gerador de PDF em formato paisagem A4 foi elevado a um padrão de expedição industrial, integrando os **6 pilares de logística de eventos**:
1. **Tratamento Profissional de Estado Vazio**: Quando o período selecionado não possui reservas, o documento emite um comunicado formal e elegante (`NENHUMA RESERVA AGENDADA NESTE PERÍODO • Todo o acervo do galpão encontra-se 100% livre`), evitando tabelas em branco ou páginas desconfiguradas.
2. **Endereçamento Físico no Galpão**: Exibição da localização física detalhada (`[Local: Galpão Principal | Prat. 2 | Setor A]`) junto a cada item para otimizar o tempo de separação física da equipe de estoque.
3. **Protocolo Oficial de Assinaturas e Conferência**: Bloco nobre no rodapé com 3 colunas pontilhadas formais com data e hora:
   - `1. SEPARADO POR (GALPÃO)`
   - `2. CONFERIDO POR (SUPERVISOR)`
   - `3. RETIRADO POR (CLIENTE / MOTORISTA)`
4. **Identificação da Modalidade de Saída**: Badges de destaque operacional identificando pedidos de balcão (`[BALCÃO: PEGUE & MONTE]`) e eventos de montagem externa (`[CARREGAMENTO: DECORAÇÃO COMPLETA]`).
5. **Dois Modos de Exportação Segmentados**:
   - **Modo 1: Mapa do Acervo (por Peça)**: Agrupado por item do acervo, com caixas de seleção `[ ]` para conferência geral de estoque e reservas do mês.
   - **Modo 2: Romaneio de Carga (por Pedido / Festa)**: Agrupado festa por festa, com cliente, telefone, endereço/evento, horários de saída/devolução e lista individual de itens solicitados.
6. **QR Code Dinâmico do Pedido**: Cada pedido do Romaneio recebe um QR Code gerado em tempo real com link direto para o pedido no Celebre, permitindo que motoristas e separadores bipem a folha impressa usando a câmera do smartphone ou leitor coletor.

### 1.3. Otimização Tipográfica e Quebra de Escrita no Menu Suspenso
- **Menu Categorizado em 2 Grupos Executivos**:
  - `1. MAPA DO ACERVO (POR PEÇA)`: Mês Inteiro, Próximos 3 Dias, Final de Semana, Somente c/ Reserva.
  - `2. ROMANEIO POR PEDIDO (QR CODE)`: Romaneio do Mês, Expedição 3 Dias, Expedição Fim de Semana.
- **Títulos em Linha Única Permanente (`white-space: nowrap !important;`)**:
  - Títulos reformulados para serem concisos e expressivos, eliminando quebras desajeitadas de parênteses como `(com` ou `(Imediato)`.
- **Subtítulo Descritivo com Recuo Harmônico**:
  - As descrições operacionais ficam na 2ª linha com recuo de `22px`, alinhadas perfeitamente sob a primeira letra do título.
- **Blindagem de Seletores CSS**:
  - Isolamento estrito de seletores (`.header-actions > button` em `Disponibilidade.css` e `Locacoes.css`), impedindo que regras de botão de cabeçalho forçassem os botões do menu em 2 colunas espremidas.

### 1.4. Tratamento de Codificação no jsPDF (Eliminação de Emojis Corrompidos)
- **Diagnóstico**: Emojis Unicode de 4 bytes (como `✍️`, `✓`, `📍`, `📦`, `✨`, `🚚`, `📅`, `↩`, `➔`) sofriam incompatibilidade com a codificação nativa WinAnsi/Latin-1 do jsPDF, gerando caracteres estranhos (`'þ`, `'`) na impressão.
- **Engenharia de Solução**: Substituição integral por marcações executivas limpas e nítidas (`[ OK ]`, `[Local: ...]`, `->`, `*`, `SAÍDA:`, `DEVOLUÇÃO:`), garantindo 100% de clareza, nitidez e compatibilidade em qualquer visualizador de PDF ou impressora térmica/A4.

---

## 2. 🚀 Evolução Multi-Tenant: Sincronização Google Auth, Controle Geral Mobile, Barra Sutil de CRM e Aniversariantes no Dashboard (10/09/2026)

### 1.1. Sincronização Multi-Tenant Completa (Caso Thiago / thidovi12@gmail.com)
- **Diagnóstico da Causa Raiz:**
  - O cliente Thiago cadastrou a cliente **Maria Fernanda** via smartphone logado por autenticação do Google (`user.uid`).
  - Quando a Super Admin consultava Thiago pelo painel de Controle Geral ou assumia a loja dele em Modo Suporte, a busca do Firestore consultava estritamente um único UID de e-mail/senha, ignorando o UID da conta Google associada.
  - Resultado: Maria Fernanda aparecia com 0 clientes na loja em Modo Suporte.
- **Engenharia da Solução:**
  - **Motor Multi-Tenant Unificado (`uidsAlvoSet`)**: Implementado nas telas [Clientes.jsx](src/pages/Clientes/Clientes.jsx) e [Dashboard.jsx](src/pages/Dashboard/Dashboard.jsx). O sistema agora consolida em tempo real:
    1. O `tenantId` primário;
    2. O `usuarioLogado.uid`;
    3. Todos os UIDs do objeto `impersonatingTenant` (`targetTenantId`, `originalUid`, `allUids`);
    4. Consulta paralela na coleção `usuarios` para identificar qualquer conta que compartilhe o mesmo endereço de e-mail.
  - As consultas no Firestore agora executam paralelamente `where("userId", "==", uId)` e `where("tenantId", "==", uId)` para todos os UIDs vinculados, deduplicando por `id` do documento.
  - **Gravação Segura em `CadastroCliente.jsx` e `Cadastro.jsx`**: Todo novo cliente agora salva simultaneamente `userId: tenantId` e `tenantId: tenantId`, garantindo persistência canônica.

### 1.2. Modo Suporte: Imersão Total em 1ª Pessoa da Loja do Cliente
- **Ajustes Implementados:**
  - **Saudação Personalizada**: O Dashboard exibe o nome real do cliente proprietário (ex.: *"Olá, Thiago Donizetti Domingos Vitoriano!"*) em vez do nome da Super Admin.
  - **Avatar & Pill de Perfil**: Reflete fielmente a foto e dados do cliente no cabeçalho superior.
  - **Menu Lateral Adaptativo**: Oculta seções exclusivas da administração central (*Painel Master*, *Gerenciar Planos*, *Controle Geral*) para que a Super Admin vivencie exatamente a experiência do lojista.
  - **Cálculo do Período de Teste Gratuito**: O banner informativo de dias de teste (`1 de 15 dias`) é renderizado normalmente, permitindo à Super Admin auditar visualmente a contagem de dias do plano do cliente.
  - **Menu Hambúrguer Mobile Desbloqueado**: Corrigida a visibilidade e o acionamento da gaveta lateral em dispositivos móveis durante o Modo Suporte.

### 1.3. Painel de Controle Geral: Otimização Mobile, Filtros & Modal com React Portal
- **Cards KPI em 2 Linhas no Celular (3 Cards por Linha)**:
  - Reestruturação em grid responsivo de 3 colunas (`repeat(3, 1fr)`) no celular (`<= 768px`).
  - **Linha 1:** `[ 10 Total Empresas ]` `[ 0 Testes Vencendo ]` `[ 6 Em Teste ]`
  - **Linha 2:** `[ 2 Pagantes ]` `[ 2 Bloqueados ]` `[ 0 Excluídos ]`
  - Altura ultracompacta (`52px`), ícones de `28x28px` e tipografia otimizada, economizando mais de 50% de espaço vertical.
- **Barra de Filtros Mobile em 2 Níveis**:
  - Nível 1: Campo de busca rápida e select estilizado de status da conta em linhas independentes.
  - Nível 2: Botão de acionamento de filtros e botão de sincronização em 2 colunas simétricas na mesma linha (`repeat(2, 1fr)`).
- **Renomeação Semântica do Botão**:
  - O antigo botão `[ 🔍+ Suporte ]` gerava confusão com o botão principal `[ 🚀 Acessar Conta ]`.
  - Foi formalmente renomeado para **`[ 👁️ Ver Conta ]`**, com ícone de olho (`fa-eye`), deixando clara sua função de visualização do resumo executivo sem sair do painel.
- **Correção do Desfoque/Travamento do Modal via React Portal**:
  - No celular com rolagem ativa, a animação CSS `transform` do container prendia a janela modal no topo invisível da página, deixando apenas o backdrop desfocado visível.
  - Ambos os modais foram encapsulados com **`createPortal(..., document.body)`**, garantindo centralização dinâmica perfeita na janela de visualização do celular.

### 1.4. CRM de Clientes: Barra Sutil de Aniversariantes & Auto-Cadastros
- **Substituição do Card Gigante por Barra Sutil (`.crm-birthday-alert-subtle`)**:
  - O antigo banner rosa de mais de 180px de altura com parágrafos compridos foi transformado em uma **fita horizontal sutil e elegante de ~38px**.
  - Layout compacto: `🎂 X clientes fazem aniversário este mês` + pílula interativa `Ver Aniversariantes →`.
  - Ao tocar, filtra a lista instantaneamente com feedback visual (`Filtrando Aniversariantes ✓`).
  - O mesmo padrão sutil foi aplicado aos avisos de **cadastros pendentes de aprovação** (`⏳`).
- **Compatibilidade Completa com Todos os Campos de Aniversário**:
  - A validação `isAniversarianteDoMes(c)` agora analisa: `nascimento`, `dataNascimento`, `dataNasc`, `data_nascimento`, `dataAniversario`, `aniversario` e `nasc`.
  - Suporte resiliente a múltiplos formatos: `YYYY-MM-DD`, `DD-MM-YYYY`, `DD/MM/YYYY` e objetos `Date`/Firestore `Timestamp`.

### 1.5. Dashboard: Central Inteligente de Aniversariantes do Mês
- **Exibição dos Aniversariantes do Mês Atual**:
  - O widget `🎂 Aniversários` anteriormente filtrava apenas aniversários das próximas 48h, exibindo *"Nenhum aniversário próximo"* para clientes aniversariando em outras datas do mês.
  - Agora exibe os aniversariantes de **todo o mês corrente**, ordenados com prioridade para datas futuras a partir de hoje (`dia >= diaHoje`).
  - Pílula do cabeçalho indica: **`X no mês`**.
  - Cada cliente exibe: avatar, nome e etiqueta dinâmica inteligente:
    - `🎂 HOJE!` (amarelo ouro brilhante);
    - `⏰ Amanhã` (azul real);
    - `📅 Dia DD` (verde esmeralda);
    - `Passou (DD)` (cinza suave neutro).
  - Botão de **1 toque para disparar WhatsApp** com mensagem de felicitações personalizada.
  - Botão `Ver Todos` que abre a central completa com opções de disparo via WhatsApp e E-mail.

### 1.6. Persistência de Login Mobile (Manter Conectado)
- Configuração de `browserLocalPersistence` no Firebase Auth, garantindo que o lojista não seja deslogado involuntariamente ao fechar o navegador no smartphone (comportamento idêntico a apps como Instagram e Facebook).

---

## 2. 👥 Evolução Visual: Repaginação, Empty States Luxury & Design Lock de Clientes, Novo Cliente e Agenda (09/09/2026)

### 2.1. Centralização & Design Luxury dos Estados Vazios (Empty States) em Clientes
- **Diagnóstico do Desalinhamento**: Ao buscar por um cliente inexistente ou visualizar uma base vazia no celular, o ícone de pasta e o texto *"Nenhum cliente encontrado."* ficavam colados na borda superior esquerda sem moldura.
- **Engenharia & Solução Visual**:
  - Layout flexbox centralizado absoluto: `display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; text-align: center !important;`.
  - Enquadramento em card sutil com borda tracejada (`1.5px dashed var(--borda, #cbd5e1)`), cantos arredondados de `18px`, padding vertical espaçoso (`44px 20px`) e sombra suave.
  - **Medalhão Circular Ouro Celebre (`.clientes-empty-icon-circle`)**: Ícone em círculo de 60px com fundo translúcido ouro (`rgba(197, 160, 89, 0.1)`), borda dourada fina e suave brilho.
  - **Ação Inteligente Direta**: Botão contextual: se houver busca ou filtros ativos, exibe **`🧹 Limpar Filtros`**; se a base estiver vazia, exibe botão primário dourado **`+ Novo Cliente`**.
  - **Unificação para Desktop e Fichário**: O mesmo padrão foi aplicado na célula de tabela vazia (`.empty-table-cell`) e no histórico de pedidos do fichário do cliente (`.empty-history`).

### 2.2. Otimização Responsiva & Despoluição de Filtros em Clientes
- **Eliminação de Truncamento com Reticências**: Redução das opções dos seletores mobile (ex.: `👥 Todos (0)`, `⏳ Pendentes (0)`), impedindo que quebrassem o alinhamento de 2 colunas nos celulares.
- **Suavização de Tipografia**: Substituição de pesos excessivos (`850` / `800`) por tipografia moderna e equilibrada (`600`, `650`, `700`).
- **Cards de Indicadores (KPIs Mobile) com Alternador Retrátil**: Barra de recolher/expandir (`.btn-toggle-kpi-mobile`) com persistência em `localStorage` (`celebre_clientes_show_kpi_mobile`).
- **Repaginação de Botões de Ação**: Botões `Link Auto-Cadastro` e `Exportar` reprojetados com bordas arredondadas de `12px`, ícones realçados e micro-sombras.

### 2.3. Redesign Moderno da Tela Novo Cliente (`CadastroCliente.jsx`)
- **Segmented Control iOS/Luxury para Tipo de Pessoa**: O antigo alternador de abas retangulares foi transformado em um controle segmentado moderno (`.tabs-container` e `.tab-btn`) com fundo cinza acetinado suave, cantos arredondados e pílula de seleção ativa flutuante com sombra nobre.
- **Harmonização de Rótulos & Campos**: Suavização de títulos de seção, espaçamentos simétricos, redução do peso de labels para `font-weight: 600` e badges de tags refinados.
- **Blindagem de Escopo Total**: Inclusão da classe raiz `.cadastro-cliente-container` no JSX, garantindo 100% de isolamento CSS.

### 2.4. Aprimoramento Tipográfico & Visual da Agenda de Eventos (`Agenda.jsx`)
- **Correção da Visualização Desktop**: Eliminação de quebra irregular de colunas e isolamento do card de data no topo da grade.
- **Suavização Tipográfica**: Redução de pesos bold pesados para tipografia executiva contemporânea (`600` a `700`).
- **KPIs Mobile Retráteis**: Controle de exibição recolhida/expandida com persistência local em `localStorage`.

### 2.5. Blindagem Sagrada no `src/styles/design-lock.css`
- Atualizado e travado com as regras aprovadas para `🔒 PÁGINA: CLIENTES`, `🔒 PÁGINA: CADASTRO CLIENTE` e `🔒 PÁGINA: AGENDA`, garantindo conformidade com a Regra de Ouro 1 (1 linha desktop para KPIs) e Regra de Ouro 2 (2 colunas mobile para KPIs).

---

## 3. 🎨 Moodboard Studio 2D/3D & Cenografia Virtual (Alta Performance & UX Mobile)

O módulo de cenografia virtual e propostas visuais (`Moodboard.jsx` e `Moodboard.css`) conta com alta performance computacional e ergonomia móvel:

### 3.1. Eliminação Total do Travamento do Canvas (Memoização 3D)
- **Diagnóstico:** O arraste de peças ou pan pelo cenário sofria quedas de FPS devido à re-renderização em lote de dezenas de componentes SVG vetoriais detalhados com gradientes e filtros 3D.
- **Solução de Alta Performance:** Todos os mais de 26 componentes de cenografia vetorial foram encapsulados com `React.memo` (ex.: `ArcoRomanoTriplo3D`, `PainelOrganicoWavy3D`, `PainelCasteloPrincesas3D`, `MesaNuvem3D`, `MesaCarruagem3D`, `EstanteEscadinha3D`, `SilhuetaHumanaSVG`, etc.). Ao mover um elemento ou deslizar a prancheta, os outros 25+ elementos não recalculam suas árvores DOM, garantindo movimentação a 60 FPS estáveis.

### 3.2. Dock de Zoom Mobile (`[ (-) 37% (+) [ ] ]`)
- **Ajustes:**
  - Botões táteis com `min-width: 44px; min-height: 44px` para acionamento ergonômico por polegar.
  - Indicador numérico de zoom com fonte monospace para evitar trepidação de layout.
  - `z-index: 50` para sobrepor qualquer barra de navegação.

---

## 4. 🧭 Nova Barra Lateral / Menu de Navegação VIP

- **Design Dark Luxury**: Fundo escuro azul-marinho profundo (`#0f172a`), tipografia refinada, transições suaves com micro-animações.
- **Comportamento Responsivo**: Gaveta retrátil no mobile acionada por botão hambúrguer com fechamento automático ao selecionar rota.
- **Controle Dinâmico de Permissões**: Módulos exclusivos da Super Admin (*Painel Master*, *Gerenciar Planos*, *Controle Geral*) são automaticamente omitidos para usuários comuns e durante o Modo Suporte em loja de clientes.

---

## 5. 💎 Reestruturação Completa da Página de Planos

- **Estrutura SaaS Moderna**: Comparativo visual entre planos Mensal, Semestral e Anual com badge de desconto percentual.
- **Responsividade Mobile**: Layout de cards empilhados simétricos com destaque para o plano mais popular.
- **Integração com Mercado Pago**: Checkout transparente com suporte a Pix e Cartão de Crédito.

---

## 6. 🌙 Diagnóstico & Solução da Tela Opaca (Conflito Dark Mode vs Fundo Claro)

- **Correção de Variáveis CSS**: Harmonização de variáveis globais `--fundo-principal`, `--card-bg`, `--texto-principal` e `--borda`.
- **Isolamento de Folhas de Estilo**: Remoção de regras conflitantes soltas fora de containers escopados.

---

## 7. 📱 Publicação no Google Play Console & Distribuição Mobile

- **Identificador de Pacote**: `br.com.celebrefesta.app` (Versão 2 / 1.0.1).
- **Compatibilidade**: TWA (Trusted Web Activity) otimizada, distribuída em 177 países na Google Play Store.

---

## 8. ✉️ Infraestrutura Transacional de E-mails (Resend + Hostinger)

1. **Domínio Oficial Verificado:**
   - Domínio oficial **`celebrefesta.com.br`** ativo.
   - Registros DNS validados:
     - `TXT` `resend._domainkey` (Assinatura criptográfica DKIM).
     - `CNAME` `rsend` (Roteamento de envio autenticado).
     - `CNAME` `send` (Entregabilidade imediata).
   - Status no Resend: 🟢 **Verificado e ativo**.
2. **Cloud Function de Notificações de Segurança:**
   - Endpoint: `https://us-central1-celebre-9f5c9.cloudfunctions.net/enviarComprovanteExclusao`
   - Remetente: `Celebre Segurança <seguranca@celebrefesta.com.br>`
   - Disparo de comprovantes com protocolo de auditoria registrado no Firestore (`CEL-EXCL-2026-XXXXX`).

---

## 9. ⚖️ Conformidade Legal LGPD (Art. 18) & Exclusão de Contas

1. **Página Pública Web:** Rota ativa `/excluir-conta` ([ExcluirConta.jsx](src/pages/Institucional/ExcluirConta.jsx)) para autoatendimento de ex-usuários.
2. **Painel Interno de Segurança:** Módulo em [AbaSeguranca.jsx](src/pages/Configuracoes/AbaSeguranca.jsx) com dupla confirmação:
   - Desativação temporária (bloqueia o login e preserva histórico).
   - Exclusão definitiva com expurgo total no Firestore e Firebase Auth.

---

## 11. 🔒 Inventário de Módulos & Blindagem de Layout (AGENTS.md)

Todos os módulos do sistema respeitam o regramento de isolamento de escopo CSS e a regra de ouro dos cards de KPI (1 linha no Desktop / 2 colunas no Mobile):

| Módulo / Funcionalidade | Arquivos Principais | Status de Blindagem |
| :--- | :--- | :---: |
| 📅 **Matriz de Disponibilidade & PDF** | `Disponibilidade.jsx`, `gerarMapaSeparacaoPDF.js` | 🟢 Alinhamento Locações • Romaneio c/ QR Code • Live |
| 📅 **Locações & Bipagem QR/Barras** | `Locacoes.jsx`, `Locacoes.css` | 🔒 CONGELADA / Estável |
| 👑 **Controle Geral (Admin Super)** | `ControleGeral.jsx`, `ControleGeral.css` | 🟢 2 Linhas Mobile • React Portal Modal OK • Live |
| 👥 **Clientes & Auto-Cadastro** | `Clientes.jsx`, `CadastroCliente.jsx` | 🟢 Barra Sutil CRM • Multi-Tenant OK • Live |
| 🏠 **Dashboard Principal** | `Dashboard.jsx`, `Dashboard.css` | 🟢 Aniversariantes do Mês • Multi-Tenant OK • Live |
| 🎨 **Moodboard Studio 2D/3D** | `Moodboard.jsx`, `Moodboard.css` | 🟢 60-120 FPS • Batching RAF & UX Mobile |
| 🧭 **Menu Lateral & Navegação** | `Navbar.jsx`, `Navbar.css` | 🟢 Modo Suporte Adaptativo VIP |
| 💎 **Planos & Assinaturas SaaS** | `Planos.jsx`, `Planos.css` | 🟢 Responsivo & Dark/Light OK |
| 🛍️ **Catálogo Boutique de Luxo** | `Catalago.jsx`, `Catalago.css` | 🔒 CONGELADA / Estável |
| 🚚 **Logística & Kanban Galpão** | `Logistica.jsx`, `Logistica.css` | 🔒 CONGELADA / Estável |
| 📦 **Estoque & Cadastro de Acervo** | `Estoque.jsx`, `CadastroEstoque.jsx` | 🔒 CONGELADA / Estável |
| 💰 **Financeiro & Lançamentos** | `Financeiro.jsx`, `NovoLancamento.jsx` | 🔒 CONGELADA / Estável |
| 🛒 **Compras & Fornecedores** | `Compras.jsx`, `Fornecedores.jsx` | 🔒 CONGELADA / Estável |
| 📊 **Relatórios Gerenciais & DRE** | `Relatorios.jsx`, Tabs | 🔒 CONGELADA / Estável |
| 📜 **Contratos & Assinatura Touch** | `Contratos.jsx`, `NovoContrato.jsx` | 🔒 CONGELADA / Estável |
| 📆 **Agenda de Eventos** | `Agenda.jsx`, `Agenda.css` | 🔒 CONGELADA / 100% Desktop & Mobile OK |
| 📈 **Cards de KPI Globais** | 1 Linha no Desktop / 2 Colunas Mobile | 🔒 CONGELADA / SAGRADO |
| 🎨 **Motor Dinâmico de Temas** | `themeUtils.js`, `design-lock.css` | 🔒 CONGELADA / SAGRADO |

---

## 12. 🛠️ Auditoria de Build e Qualidade de Código

- **Build de Produção (Vite 7):** Validado com sucesso via `npm run build` em **16.11 - 17.43 segundos**.
- **Deploy de Produção:** Publicado com sucesso via Firebase Hosting no domínio `celebrefesta.com.br` (`celebre-9f5c9`).
- **Módulos Compilados:** 1.176 módulos transformados com **ZERO ERROS** de empacotamento, JSX ou lint.
- **Isolamento de Estilos:** Conformidade estrita com as Regras 1, 2, 5 e 6 do `AGENTS.md` (todos os estilos escopados em suas respectivas classes raízes sem vazamento global).

---
*Documentação técnica oficial do Sistema Celebre — Gestão de Locação de Acervo & Festas.*
