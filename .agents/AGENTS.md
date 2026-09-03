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
- **Barra de Filtros Mobile (`<= 900px`)**:
  - A classe `.estoque-container .table-filter-bar` opera obrigatoriamente em **Grid de 2 Colunas Simétricas**.
  - O alternador de visualização `.view-toggle-group` (`[ 📋 Lista | ▦ Cards ]`) **DEVE PERMANECER EM LINHA ÚNICA EXCLUSIVA SEPARADA (`grid-column: 1 / -1 !important; width: 100% !important;`)**.
  - O botão de ordenação `.btn-ordem-estoque` ocupa a base em 100% da largura (`grid-column: 1 / -1 !important;`).
  - Os filtros de Data, Galpão, Status e Categoria permanecem agrupados em pares de 2 colunas simétricas (`repeat(2, 1fr)`).
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
- **PÁGINAS ATUALMENTE CONGELADAS (SISTEMA 100% TRANCA GERAL)** (03/09/2026):
  - `🔒 Clientes` (`Clientes.css`, `CadastroCliente.css`)
  - `🔒 Locações` (`Locacoes.css`)
  - `🔒 Nova Locação` (`NovaLocacao.css`)
  - `🔒 Estoque & Acervo` (`Estoque.css`, `CadastroEstoque.css`)
  - `🔒 Compras` (`Compras.css`, `NovaCompra.css`)
  - `🔒 Financeiro` (`Financeiro.css`, `NovoLancamento.css`)
  - `🔒 Dashboard / Início` (`Dashboard.css`)
  - `🔒 Contratos & Novo Contrato` (`Contratos.css`, `NovoContrato.css`)
  - `🔒 Agenda` (`Agenda.css`)
  - `🔒 Logística / Kanban Galpão` (`Logistica.css`)
  - `🔒 Relatórios` (`Relatorios.css`, `PedidosTab.css`, `EstoqueTab.css`, `ClientesTab.css`, `FinanceiroTab.css`)
  - `🔒 Catálogo & Auto-Cadastro` (`Catalago.css`, `AutoCadastro.css`)
  - `🔒 Sistema Global de Cards KPI` (1 linha desktop / 2 colunas mobile)
  - `🔒 Motor Global de Cores Dinâmicas da Marca` (`src/utils/themeUtils.js` e `design-lock.css`)
