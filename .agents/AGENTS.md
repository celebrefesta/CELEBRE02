# 🔒 REGRAMENTO E BLINDAGEM DE LAYOUT DO SISTEMA CELEBRE

## 1. Regra de Ouro: Layout dos Cards KPI no Celular
- A classe `.clientes-stats-grid` em **TODAS** as páginas (`Locacoes`, `Clientes`, `Estoque`, `Compras`) **DEVE PERMANECER OBRIGATORIAMENTE EM 2 COLUNAS** no celular/telas menores (`<= 900px`, `<= 768px`, `<= 480px`).
- **NUNCA** alterar `.clientes-stats-grid` para `grid-template-columns: 1fr` em visualizações mobile.
- A regra global em `src/App.css` e nas páginas específicas utiliza `grid-template-columns: repeat(2, 1fr) !important;`.

## 2. Preservação de CSS e Estilos Visuais
- Arquivos de estilização CSS (`Locacoes.css`, `Clientes.css`, `Estoque.css`, `Compras.css`, `ModalCalendarioDisponibilidade.css`) estão **BLINDADOS**.
- Não alterar classes globais de grid sem verificar o impacto em todas as telas da aplicação.
