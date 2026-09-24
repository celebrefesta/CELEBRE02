# 🔒 REGRAMENTO E BLINDAGEM DE LAYOUT DO SISTEMA CELEBRE

## 1. Regra de Ouro: Layout dos Cards KPI no Desktop (1 Única Linha)
- A classe `.clientes-stats-grid` em **TODAS** as páginas (`Locacoes`, `Clientes`, `Estoque`, `Compras`) **DEVE PERMANECER OBRIGATORIAMENTE EM 1 SÓ LINHA HORIZONTAL (`flex-wrap: nowrap !important; display: flex !important;`)** no desktop (`> 900px`).
- **NUNCA** permitir que os cards de KPI dobrem para 2 linhas no desktop (ex.: 4 cards na 1ª linha e 1 card na 2ª linha). Todos os cards (sejam 4 ou 5 cards) devem ajustar-se proporcionalmente lado a lado na mesma linha.

## 2. Regra de Ouro: Layout dos Cards KPI no Celular (2 Colunas)
- A classe `.clientes-stats-grid` em **TODAS** as páginas (`Locacoes`, `Clientes`, `Estoque`, `Compras`) **DEVE PERMANECER OBRIGATORIAMENTE EM 2 COLUNAS** no celular/telas menores (`<= 900px`, `<= 768px`, `<= 480px`).
- **NUNCA** alterar `.clientes-stats-grid` para `grid-template-columns: 1fr` em visualizações mobile.
- A regra global em `src/App.css` e nas páginas específicas utiliza `grid-template-columns: repeat(2, 1fr) !important;`.

## 3. Preservação de CSS e Estilos Visuais
- Arquivos de estilização CSS (`Locacoes.css`, `Clientes.css`, `Estoque.css`, `Compras.css`, `ModalCalendarioDisponibilidade.css`) estão **BLINDADOS**.
- Não alterar classes globais de grid sem verificar o impacto em todas as telas da aplicação.

## 4. Regra de Estruturação e Semântica de Formulários
- **Análise Semântica de Inputs**: Ao gerar ou refatorar formulários, campos de dados curtos e semanticamente relacionados (ex: `CEP` e `Cidade`, `Rua` e `Número`, `Data Retirada` e `Data Devolução`, `Valor` e `Desconto`) devem ser agrupados lado a lado (em 2 colunas) em telas médias e grandes (desktop/tablet).
- **Responsividade Mobile (`<= 768px`)**: Em telas mobile, manter os campos em 1 coluna por padrão para preservar legibilidade e ergonomia de digitação, **exceto** para dados extremamente curtos ou pares complementares objetivos (como `UF` + `Número` ou `CEP` + `Frete`), que podem permanecer em 2 colunas compactas.

## 5. 🔒 Cadeado de Escopo de CSS (Isolamento Total entre Páginas)
- **OBRIGATÓRIO**: Qualquer estilo CSS criado ou editado para uma página ou modal específico **DEVE ESTAR ESCOPADO (ISOLADO)** dentro da classe raiz daquela tela (ex.: `.cadastro-estoque-container .classe`, `.nova-locacao-page .classe`, `.clientes-container .classe`, `.estoque-container .classe`).
- **NUNCA** declarar classes utilitárias ou genéricas (ex.: `.form-group`, `.btn-servico-card`, `.span-2`, `.icon-box`) soltas na raiz do CSS global sem o prefixo da página, para **IMPEDIR 100% O VAZAMENTO DE ESTILOS** de uma tela para outra.

## 6. 🔒 Blindagem Específica do Módulo de Estoque & Acervo (`Estoque.css` e `Estoque.jsx`)
- **Barra de Filtros Mobile (`<= 900px`) — Layout Slim Moderno (12/09/2026)**:
  - **Linha 1 (Busca & Exibição)**: Campo de Busca elegante com ícone e botão `✕` acoplado lado a lado ao alternador de visualização `.view-toggle-group` (`[ 📋 | ▦ ]`), economizando uma linha inteira de tela.
  - **Linha 2 (Seletores e Ações em 2 Colunas Simétricas)**:
    - Par 1: Data (`dd/mm/aaaa`) + Galpão (`Galpão: Todos`).
    - Par 2: Status (`Status: Todos`) + Categoria (`Categoria: Todas`).
    - Par 3: Ordenação `[ ⇅ A - Z ]` + Botão Rápido `[ ✕ Limpar Filtros ]`.
  - Alturas calibradas em 34px-36px, cantos arredondados (9px-10px) e padding reduzido (10px).
- **Lista/Tabela de Acervo Mobile (`<= 900px`)**:
  - A tabela `.pro-table` no mobile **DEVE PERMANECER EM FORMATO DE CARDS EMPILHADOS (`display: flex !important; flex-direction: column !important;`)**.
  - O cabeçalho tradicional `thead` no mobile **DEVE PERMANECER OCULTO (`display: none !important;`)** para impedir qualquer esmagamento horizontal de colunas e quebra de palavras.
  - A classe raiz do componente `Estoque.jsx` **DEVE CONTER OBRIGATORIAMENTE `.estoque-container` (`className="estoque-container clientes-container fade-in"`)** para garantir a ancoragem de todas as regras responsivas.
- **BLOQUEIO DE ALTERAÇÃO INDEVIDA**:
  - O arquivo `Estoque.css` está **BLINDADO E CONGELADO**. Nenhuma regra de layout, espaçamento, grid ou responsividade pode ser alterada sem instrução explícita do usuário.

## 7. 🔒 Sistema de Design Lock — `src/styles/design-lock.css`

- **ARQUIVO SAGRADO**: O arquivo `src/styles/design-lock.css` é o **repositório oficial de designs aprovados e congelados** do sistema Celebre.
- **PRIORIDADE MÁXIMA**: Este arquivo é importado **por último** em `App.jsx` (após `App.css` e todos os CSS de páginas), portanto suas regras com `!important` **SEMPRE vencem qualquer outra regra da cascata CSS**.
- **NUNCA EDITAR** este arquivo sem solicitação explícita do usuário. Isso inclui:
  - NÃO remover blocos de páginas já congeladas.
  - NÃO alterar valores de `gap`, `padding`, `grid-template-columns`, `font-size`, `border-radius` de páginas marcadas como `🔒 CONGELADA`.
  - NÃO reordenar os blocos do arquivo.
- **COMO ADICIONAR UMA NOVA PÁGINA**: Quando o usuário pedir para "congelar" ou "travar" o design de uma nova página:
  1. Ler o CSS atual da página para extrair as regras críticas de layout aprovado.
  2. Criar um novo bloco escopado no `design-lock.css` com o comentário de data e status `🔒 CONGELADA`.
  3. Mover o status da página de `🔓 ABERTA` para `🔒 CONGELADA` no rodapé do arquivo.
- **PÁGINAS ATUALMENTE CONGELADAS (SISTEMA 100% TRANCA GERAL)** (04/09/2026):
  - `🔒 Clientes` (`Clientes.css`, `CadastroCliente.css`)
  - `🔒 Locações` (`Locacoes.css`)
  - `🔒 Matriz de Disponibilidade` (`Disponibilidade.css`)
  - `🔒 Nova Locação` (`NovaLocacao.css`)
  - `🔒 Estoque & Acervo` (`Estoque.css`, `CadastroEstoque.css`)
  - `🔒 Compras` (`Compras.css`, `NovaCompra.css`)
  - `🔒 Financeiro` (`Financeiro.css`, `NovoLancamento.css`)
  - `🔒 Dashboard / Início` (`Dashboard.css`)
  - `🔒 Contratos & Novo Contrato` (`Contratos.css`, `NovoContrato.css`)
  - `🔒 Agenda` (`Agenda.css`)
  - `🔒 Logística / Kanban Galpão` (`Logistica.css`)
  - `🔒 Relatórios` (`Relatorios.css`, `PedidosTab.css`, `EstoqueTab.css`, `ClientesTab.css`, `FinanceiroTab.css`)
  - `🔒 Catálogo Boutique de Luxo & Auto-Cadastro` (`Catalago.css`, `AutoCadastro.css`)
  - `🔒 Gerenciar Planos Master` (`AdminPlanos.css`, `AdminPlanos.jsx`)
  - `🔒 Faturas & Auditoria de Pagamentos` (`AbaFaturamentoAdmin.css`, `AbaFaturamentoAdmin.jsx`)
  - `🔒 Sistema Global de Cards KPI` (1 linha desktop / 2 colunas mobile)
  - `🔒 Motor Global de Cores Dinâmicas da Marca` (`src/utils/themeUtils.js` e `design-lock.css`)

## 8. 🔒 Blindagem Específica do Catálogo Online Boutique de Luxo (`Catalago.css` e `Catalago.jsx`)
- **Menu Lateral Oficial (`.cat-sidebar`)**:
  - Todo o acervo, modalidades (*Pegue & Monte*, *Decorações Completas*) e categorias reais do estoque **DEVEM PERMANECER OBRIGATORIAMENTE CONSOLIDADOS NO MENU LATERAL**.
- **PROIBIÇÃO ESTRITA DE BARRAS HORIZONTAIS DUPLICADAS NO TOPO**:
  - **NUNCA** reintroduzir barras horizontais de categorias, pílulas de temas ou carrosséis repetitivos no topo da vitrine (`.cat-modalidades-tabs-bar`).
  - A área principal da vitrine **DEVE INICIAR DIRETAMENTE NA BARRA DE CONTROLES** (Busca 🔍, Data de Disponibilidade 📅 e Ordenação 🔀).
- **Unificação Total sob o Padrão "Categorias"**:
  - Todos os botões mobile (`.btn-trigger-mobile-filter`, `.btn-mobile-filtros-fab`), cabeçalho da gaveta lateral e botões de ação devem manter a nomenclatura padronizada **"Categorias"**.
- **Barra Flutuante de Carrinho (`.cat-floating-cart-pill`)**:
  - Permanece obrigatoriamente fixada na base inferior da tela (`position: fixed !important;`) com animação suave e acionamento da gaveta lateral de checkout.
- **BLOQUEIO DE ALTERAÇÃO INDEVIDA**:
  - O arquivo `Catalago.css` está **BLINDADO E CONGELADO**. Nenhuma regra de layout, responsividade ou posicionamento pode ser alterada sem autorização expressa do usuário.

## 9. 🔒 Blindagem Específica do Dashboard (`Dashboard.css`, `Dashboard.jsx`, `design-lock.css`)
- **Cards de KPI Executivos (`.stats-wide-row`)**:
  - **Desktop (`> 900px`)**: Grid de **6 Colunas em 1 Linha Única Horizontal** (`grid-template-columns: repeat(6, 1fr) !important;`).
  - **Mobile (`<= 900px`)**: Grid de **2 Colunas Simétricas** (`grid-template-columns: repeat(2, 1fr) !important;`) com 3 linhas de 2 cards cada, sem nenhum card isolado embaixo.
  - Cada card opera estritamente em **Estrutura Vertical de 3 Linhas**:
    1. **Linha 1 (Topo):** Título em largura total (`.stat-title`), sem quebra de linha (`white-space: nowrap !important;`).
    2. **Linha 2 (Meio):** Ícone compacto (`28px` desktop / `22px` mobile) + Valor em destaque com formatação fina de moeda (`.stat-cur` para `R$`).
    3. **Linha 3 (Base):** Subtítulo em formato de micro-badge translúcido com bordas suaves (`.stat-sub`), calibrado para nunca cortar texto com reticências.
- **Termômetro de Meta Financeira (`.dash-meta-card`)**:
  - Medallion com ícone de 40px, badge pill dourada, botão de meta e track de progresso de 8px blindados.
- **BI por Categoria (`.bi-chips-grid`)**:
  - Grid simétrico de **3 Colunas x 2 Linhas** (6 categorias) com porcentagem alinhada ao valor.
- **BLOQUEIO DE ALTERAÇÃO INDEVIDA**:
  - Os arquivos `Dashboard.css` e seu bloco em `design-lock.css` estão **BLINDADOS E CONGELADOS**. Nenhuma regra de layout, espaçamento, proporção ou tipografia pode ser alterada sem instrução explícita do usuário.

## 10. 🔒 Blindagem Específica da Matriz de Disponibilidade (`Disponibilidade.css`, `Disponibilidade.jsx`, `design-lock.css`)
- **Cards de KPI**:
  - **Desktop (`> 900px`)**: 4 cards em **1 Linha Única Horizontal** (`display: flex !important; flex-wrap: nowrap !important;`).
  - **Mobile (`<= 900px`)**: Grid de **2 Colunas Simétricas** (`grid-template-columns: repeat(2, 1fr) !important;`) com controle de expansão/recolhimento.
- **Cabeçalho Mobile (`<= 900px`)**:
  - Botões de Ação (`.header-actions`) em **2 Colunas Simétricas** (`grid-template-columns: repeat(2, 1fr) !important;`): `[ 📄 MAPA PDF ▾ ]` e `[ ← LOCAÇÕES ]` lado a lado na mesma linha (40px).
- **Barra de Filtros**:
  - **Desktop (`> 900px`)**: 2 linhas limpas. Linha 1: Busca (`flex: 1`) + Chips Operacionais (`OCUPADOS`, `REFORMA`, `LIVRES`). Linha 2: Navegador de Mês + Seletores de Categoria e Ordenação.
  - **Mobile (`<= 900px`)**: Busca 100%, Chips em 3 Colunas (`repeat(3, 1fr)`), Mês em linha dedicada, Seletores em 2 Colunas (`repeat(2, 1fr)`).
- **Legenda Estática Removida**: Proibida a reintrodução de legenda estática duplicada (`.disp-legend-strip`).
- **Modo Escuro**:
  - Botão secundário (`← LOCAÇÕES`), barra de toggle e chips calibrados sob o Charcoal Luxury (`#18181b`, `#3f3f46`, `#f4f4f5`), sem nenhum fundo branco vazando.
- **BLOQUEIO DE ALTERAÇÃO INDEVIDA**:
  - Os arquivos `Disponibilidade.css`, `Disponibilidade.jsx` e seu bloco em `design-lock.css` estão **BLINDADOS E CONGELADOS**. Nenhuma alteração pode ser realizada sem autorização expressa do usuário.

## 11. 🔒 Blindagem Específica de Gerenciar Planos Master (`AdminPlanos.css`, `AdminPlanos.jsx`, `design-lock.css`)
- **Layout Desktop (`> 768px`)**:
  - Grid de cards de planos em **3 Colunas** (`grid-template-columns: repeat(3, 1fr) !important;`) ocupando 100% da largura.
  - Tipografia de preços com alinhamento na linha de base (`align-items: flex-end; margin-bottom: 7px;`).
  - Tabela comparativa completa com rolagem horizontal livre.
  - O editor por abas mobile permanece obrigatoriamente oculto (`.admin-mobile-tabs-container { display: none !important; }`).
- **Layout Mobile (`<= 768px`) — Seletor por Abas 100% de Largura**:
  - A tabela horizontal e colunas estáticas ficam **estritamente ocultas** (`.admin-matrix-table-scroll { display: none !important; }`).
  - O seletor de abas por plano é exibido obrigatoriamente (`.admin-mobile-tabs-container { display: block !important; }`).
  - Pílulas de seleção no topo (`.admin-mobile-plan-pills`) para alternar instantaneamente entre Básico, Premium e Pro.
  - Todas as categorias e recursos ocupam 100% da largura da tela sem cortes ou reticências (`word-break: break-word`).
  - Botões de ação (`+ Nova Funcionalidade` e `Salvar Alterações`) acoplados na base.
- **BLOQUEIO DE ALTERAÇÃO INDEVIDA**:
  - Os arquivos `AdminPlanos.css`, `AdminPlanos.jsx` e seu bloco em `design-lock.css` estão **BLINDADOS E CONGELADOS**. Nenhuma alteração de layout, proporção ou responsividade pode ser feita sem instrução expressa do usuário.

## 12. 🔒 Blindagem Específica de Nova Locação — Atalhos de Datas (`NovaLocacao.css`, `design-lock.css`)
- **Atalhos Rápidos de Datas no Desktop (`> 900px`)**:
  - A barra `.grupo-botoes-atalhos-datas` **DEVE MANTER OBRIGATORIAMENTE OS 5 BOTÕES EM 1 SÓ LINHA HORIZONTAL (`grid-template-columns: repeat(5, minmax(0, 1fr)) !important;`)**.
  - **NUNCA** permitir que o 5º botão dobre para a 2ª linha sozinho no desktop.
- **Atalhos Rápidos de Datas no Mobile (`<= 680px`)**:
  - Layout simétrico em 2 colunas (`repeat(2, 1fr)`), com o 5º botão ocupando a largura total centralizado (`grid-column: 1 / -1 !important;`).

## 13. 🔒 Blindagem Específica de Compras — Barra de Filtros (`Compras.css`, `Compras.jsx`, `design-lock.css`)
- **Desktop (`> 900px`)**:
  - A barra `.table-filter-bar` e o trio de seletores `.compras-filter-trio-row` **DEVEM PERMANECER EM 1 SÓ LINHA HORIZONTAL (`flex-wrap: nowrap !important;`)** com Busca elástica (`flex: 1`), Tipo, Status, Ordenação e Limpar Filtros lado a lado.
- **Mobile (`<= 900px`) — Layout Simétrico em 2 Colunas**:
  - Linha 1: Campo de Busca 100% de largura.
  - Linha 2 (Par 1): `Tipo: Todos` + `Status: Todos` (2 colunas simétricas).
  - Linha 3 (Par 2): `Mais Recentes` + `Limpar Filtros` (2 colunas simétricas).
  - **PROIBIDO**: Deixar qualquer botão de ordenação ou filtro isolado ocupando uma linha inteira sozinho.

## 14. 🔒 Blindagem Específica de Faturas & Auditoria de Pagamentos (`AbaFaturamentoAdmin.css`, `AbaFaturamentoAdmin.jsx`, `design-lock.css`)
- **Cards de KPI no Desktop (`> 900px`)**:
  - Grid de **6 Colunas em 1 Linha Única Horizontal** (`grid-template-columns: repeat(6, 1fr) !important;`).
  - Estrutura vertical limpa de 3 linhas (título em caixa alta, valor com ícone compacto e micro-badge subtítulo).
- **Cards de KPI no Mobile (`<= 900px`)**:
  - Grid de **3 Colunas x 2 Linhas** (`grid-template-columns: repeat(3, 1fr) !important;`) com padding e tipografia calibrados.
- **Barra de Filtros & Gaveta Mobile (`<= 900px`)**:
  - Busca 100% no topo.
  - Ações em 2 colunas simétricas (`[ 🔄 Atualizar ]` e `[ 📥 Exportar CSV ]`) + botão largo de destaque `[ 📄 Relatório PDF ]` em largura total.
  - Gaveta inline expansível acoplada ao trigger `.cg-fat-btn-trigger-gaveta` para alternar entre status sem poluir o topo.
- **Visualização de Dados no Mobile**:
  - Tabela tradicional desktop estritamente oculta (`display: none !important;`).
  - Cards mobile elegantes com borda indicativa de status, dados de contato da empresa, badge de saúde da assinatura (`[🔴 Em Risco]`, `[⏸️ Suspenso]`, `[⏳ Teste Vencendo]`, `[🔒 Bloqueado]`), detalhes da transação e botões de ação rápidos.
- **BLOQUEIO DE ALTERAÇÃO INDEVIDA**:
  - Os arquivos `AbaFaturamentoAdmin.css`, `AbaFaturamentoAdmin.jsx` e seu bloco em `design-lock.css` estão **BLINDADOS E CONGELADOS**. Nenhuma alteração pode ser realizada sem autorização expressa do usuário.





