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
