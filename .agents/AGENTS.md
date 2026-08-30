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
- **OBRIGATÓRIO**: Qualquer estilo CSS criado ou editado para uma página ou modal específico **DEVE ESTAR ESCOFADO (ISOLADO)** dentro da classe raiz daquela tela (ex.: `.cadastro-estoque-container .classe`, `.nova-locacao-page .classe`, `.clientes-container .classe`).
- **NUNCA** declarar classes utilitárias ou genéricas (ex.: `.form-group`, `.btn-servico-card`, `.span-2`, `.icon-box`) soltas na raiz do CSS global sem o prefixo da página, para **IMEDIR 100% O VAZAMENTO DE ESTILOS** de uma tela para outra.

