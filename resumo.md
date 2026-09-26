# 📋 Resumo Executivo: Gestão da Matriz de Planos & Preços (Admin Planos)
**Módulo:** SuperAdmin Master / Planos (`/admin-planos`)  
**Arquivos de Escopo:** [AdminPlanos.jsx](file:///c:/Users/camil/Desktop/APLICATIVOS%20SISTEMAS/CELEBRE02/src/pages/Planos/AdminPlanos.jsx), [AdminPlanos.css](file:///c:/Users/camil/Desktop/APLICATIVOS%20SISTEMAS/CELEBRE02/src/pages/Planos/AdminPlanos.css), [design-lock.css](file:///c:/Users/camil/Desktop/APLICATIVOS%20SISTEMAS/CELEBRE02/src/styles/design-lock.css)  
**Data:** 26/09/2026  
**Status do Módulo:** 🔒 CONGELADA / BLINDADA (Regra 11 - AGENTS.md)

---

## 1. Contexto e Objetivo da Demanda
A tela de **Gestão da Matriz de Planos & Preços** (`AdminPlanos`) é o centro de controle do SuperAdmin Master, onde valores, nomes, destaques e a matriz de permissões/limites do sistema são definidos. 

No celular, os 3 cards de planos (Básico, Premium e Pro) estavam sendo exibidos empilhados verticalmente um sobre o outro. Isso resultava em uma rolagem excessivamente longa (>1000px de altura), sobrecarga visual e dificuldade para acessar o editor de recursos e matriz que fica posicionado abaixo dos cards.

**Solicitação do Usuário:**  
Eliminar o empilhamento vertical e implementar **flechas indicativas laterais** com carrossel moderno, no mesmo padrão de excelência de [AbaAssinaturaUso.jsx](file:///c:/Users/camil/Desktop/APLICATIVOS%20SISTEMAS/CELEBRE02/src/pages/Configuracoes/AbaAssinaturaUso.jsx) / `Configuracoes.css`, exibindo um card por vez de forma limpa, com navegação rápida por abas e setas laterais.

---

## 2. Principais Entregas e Refinamentos Aplicados

### A. Carrossel Luxury Mobile com Flechas Indicativas Laterais (`<= 768px`)
1. **Flechas Indicativas Laterais no Card (`‹` e `›`)**:
   - Botões circulares flutuantes posicionados nas laterais do card (`left: 4px` e `right: 4px`), centralizados na altura do conteúdo (`top: 48%`).
   - Acabamento fino com borda dourada suave (`color-mix`), fundo de card translúcido com *backdrop-filter (blur)* e microinterações de escala no toque.
2. **Trilho Superior de Abas Rápidas com Flechas (`admin-carousel-nav-wrapper`)**:
   - Barra de navegação horizontal no topo com botões `[ ‹ ]` e `[ › ]` e pílulas para cada plano: `[ • BÁSICO | • PREMIUM ★ | • PRO ]`.
   - Permite troca instantânea clicando diretamente na pílula ou nas flechas.
3. **Exibição Focada (1 Card por Vez)**:
   - Os cards inativos recebem `display: none !important;` no mobile. O card ativo recebe `display: flex !important;` com animação suave `fadeInCard`.
4. **Gesto Touch-Swipe (Deslizar o Dedo)**:
   - Handlers nativos `onTouchStart`, `onTouchMove` e `onTouchEnd` integrados ao container para permitir que o usuário arraste horizontalmente para alternar entre os planos.
5. **Sincronização Bidirecional**:
   - O estado `planoAtivoMobileIdx` unifica a exibição do card no topo com o **Editor de Recursos da Matriz** logo abaixo.

---

### B. Padronização do Cabeçalho e Barra de Ferramentas
1. **Hero Header Luxury Executive Celebre**:
   - Substituição da antiga barra genérica pelo padrão oficial: medalhão dourado com coroa (`fas fa-crown`), título H1 em tipografia executiva e subtítulo explicativo.
   - Pílulas de ação simétricas no topo: `[ ← PAINEL MASTER ]` e `[ ↗ VER VITRINE ]`.
2. **Toolbar de Ações Operacionais**:
   - Separação clara entre ações de criação e persistência:
     - Linha 1 Mobile: `[ + Novo Plano ]` e `[ ☷ Nova Funcionalidade ]` em 2 colunas simétricas.
     - Linha 2 Mobile: Botão de destaque `[ ☁️ SALVAR MATRIZ NA NUVEM ]` em largura total dourada.

---

### C. Blindagem do Layout Desktop (`> 768px`) — Regra 11 AGENTS.md
- **Grid de 3 Colunas Horizontal**:
  - No desktop, a classe `.admin-cards-grid` mantém estritamente `grid-template-columns: repeat(3, 1fr) !important;` e todos os cards permanecem visíveis lado a lado.
- **Ocultação de Controles Mobile**:
  - As flechas laterais (`.carousel-arrow-btn`), o trilho superior (`.admin-carousel-nav-wrapper`) e o seletor por abas mobile ficam estritamente ocultos (`display: none !important;`).
- **Tabela Completa de Matriz**:
  - A visualização em tabela horizontal completa com colunas de todos os planos permanece ativa e liberada para edição no desktop.

---

## 3. Arquitetura de Arquivos e Isolamento CSS

| Arquivo | Função | Alterações Realizadas |
| :--- | :--- | :--- |
| [AdminPlanos.jsx](file:///c:/Users/camil/Desktop/APLICATIVOS%20SISTEMAS/CELEBRE02/src/pages/Planos/AdminPlanos.jsx) | Componente React Master | Implementação do trilho superior de abas, flechas laterais flutuantes, eventos touch-swipe e sincronização de estado `planoAtivoMobileIdx`. |
| [AdminPlanos.css](file:///c:/Users/camil/Desktop/APLICATIVOS%20SISTEMAS/CELEBRE02/src/pages/Planos/AdminPlanos.css) | Estilos específicos escopados | Definição das classes `.admin-carousel-nav-wrapper`, `.carousel-arrow-btn`, `.admin-carousel-pills-track` e regras mobile/desktop escopadas sob `.admin-planos-wrapper`. |
| [design-lock.css](file:///c:/Users/camil/Desktop/APLICATIVOS%20SISTEMAS/CELEBRE02/src/styles/design-lock.css) | Repositório Sagrado de Blindagem | Atualização do bloco `🔒 GERENCIAR PLANOS & PREÇOS` garantindo prioridade máxima com regras `!important` para desktop e mobile. |

---

## 4. Testes e Validação Técnica
- **Compilação Vite:** Executado `npm run build` com sucesso absoluto (`✓ built in 13.19s`, 0 erros, 0 alertas de sintaxe).
- **Responsividade:** Verificada a transição fluida entre visualização desktop (3 colunas) e mobile (1 card com carrossel e setas laterais).
- **Semântica e Acessibilidade:** Botões de navegação contêm `aria-label`, `title` e estados visuais `:disabled` quando no limite inicial ou final da lista.
