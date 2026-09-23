# 📋 Resumo Executivo: Painel Minha Vitrine & Catálogo Digital Boutique

**Projeto:** Sistema Celebre — Gestão de Festas, Acervo & Locações  
**Data:** 23 de Setembro de 2026  
**Marco Oficial:** Lançamento do Painel de Controle "Minha Vitrine" e 6 Novas Regras Comerciais do Catálogo  
**Ambiente:** Produção Oficial ([celebrefesta.com.br](https://celebrefesta.com.br))  
**Deploy:** Firebase Hosting + GitHub Sync (`main`)  

---

# 🚨 ATENÇÃO: ROTEIRO PRÁTICO DE HOMOLOGAÇÃO E TESTES

Para validar 100% da última atualização do catálogo, siga o roteiro passo a passo abaixo tanto no computador (Desktop) quanto no smartphone (Mobile):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ROTEIRO DE TESTES — 8 ETAPAS                          │
│                                                                             │
│  [1] Menu Lateral ➔ Minha Vitrine                                           │
│  [2] Aviso de Sinal / Caução ➔ Ver no Carrinho da Vitrine                   │
│  [3] Modo Ocultar Preços ➔ Conferir "Sob Consulta" nos Cards e Resumo        │
│  [4] Cidades Atendidas ➔ Conferir Badge no Topo da Vitrine                  │
│  [5] Mensagem de WhatsApp ➔ Testar Tags Dinâmicas {cliente} {itens}        │
│  [6] Destaques da Vitrine ➔ Marcar Peças com Estrela ⭐ e Ver no Catálogo    │
│  [7] Visibilidade do Acervo ➔ Ocultar Peça e Confirmar que Sumiu na Loja   │
│  [8] Domínio Oficial ➔ Acessar por celebrefesta.com.br                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 🔍 Passo 1: Acessar o Novo Painel "Minha Vitrine"
1. Faça login no sistema Celebre em **`https://celebrefesta.com.br`**.
2. No menu lateral esquerdo, clique no item **Catálogo** (ele agora redireciona diretamente para o novo painel em `/minha-vitrine`).
3. **O que observar:**
   - Cards de KPI no topo: *Status da Vitrine*, *Saúde da Vitrine (Health Score)*, *Peças Publicadas* e *Pedidos Recebidos*.
   - No desktop: todos os 4 cards em **1 linha horizontal única** (`AGENTS.md`).
   - No celular: cards organizados em **2 colunas simétricas**.
   - Barra de navegação com 2 abas: `[ ⚙️ Identidade, Regras & Comunicação ]` e `[ 📦 Gerenciar Peças na Vitrine ]`.

---

### 🔍 Passo 2: Testar o Aviso de Sinal / Caução
1. Na aba **Identidade, Regras & Comunicação**, role até a seção **Políticas Comerciais & Preços**.
2. No campo **Aviso de Sinal / Caução**, clique em um dos atalhos rápidos (ex.: `50% de Sinal` ou `Caução Obrigatória`).
3. Personalize o texto se desejar (ex.: *Exigimos 50% para reserva da data. Caução em cheque ou Pix na entrega.*).
4. Clique em **Salvar Alterações** no canto inferior.
5. Em outra aba, abra o seu Catálogo clicando no botão **👁️ Ver Vitrine como Cliente**.
6. Adicione qualquer peça à lista e abra a gaveta do carrinho.
7. **O que observar:** O aviso aparece destacado dentro do carrinho com ícone de escudo (`🛡️ Condição de Reserva:`), informando a regra com elegância antes do fechamento.

---

### 🔍 Passo 3: Testar o Modo "Ocultar Preços" ("Sob Consulta")
1. No painel **Minha Vitrine**, ative a chave: **Ocultar Preços das Peças (Modo Cotação Sob Consulta)**.
2. Clique em **Salvar Alterações**.
3. Atualize o seu Catálogo (`/catalogo/:tenantId`).
4. **O que observar:**
   - **Nos Cards da Vitrine**: O valor `R$ XX,XX` é substituído pelo texto dourado refinado **`Sob Consulta`**.
   - **No Modal de Detalhes da Peça**: A linha de preço exibe **`Valor da Locação: Sob Consulta`**.
   - **Na Gaveta do Carrinho**: Preços unitários e total exibem **`Sob Consulta`**.
   - **Na Barra Flutuante de Carrinho**: Mostra **`Orçamento Sob Medida`**.
   - **Ao Enviar pelo WhatsApp**: O valor total sai como `Sob Consulta`.
5. *(Opcional)*: Desative a chave novamente e salve caso queira voltar a exibir os valores reais em Reais (`R$`).

---

### 🔍 Passo 4: Testar Cidades & Regiões Atendidas
1. No painel **Minha Vitrine**, localize o campo **Cidades e Regiões Atendidas**.
2. Preencha com sua área de atuação (ex.: *São Paulo, Grande ABC e Alphaville*).
3. Salve as alterações.
4. No Catálogo:
   - **O que observar:** Logo no cabeçalho, abaixo da apresentação da loja, surge o badge:  
     `🚚 Atendemos: São Paulo, Grande ABC e Alphaville`.
   - Na gaveta de carrinho, essa informação também é reforçada no resumo final.

---

### 🔍 Passo 5: Testar a Personalização da Mensagem do WhatsApp
1. No painel **Minha Vitrine**, vá até o bloco **Mensagem Padrão para Orçamentos no WhatsApp**.
2. Note a barra de **Tags Dinâmicas** com botões rápidos:
   - `{cliente}`: Nome do cliente.
   - `{itens}`: Lista estruturada das peças com quantidades.
   - `{data}`: Data do evento.
   - `{total}`: Total do orçamento ou "Sob Consulta".
   - `{empresa}`: Nome da sua empresa.
   - `{condicoes}`: O aviso de sinal/caução configurado.
3. Teste clicar em uma tag para inseri-la onde estiver o cursor.
4. Teste o botão **Restaurar Mensagem Padrão** para ver o modelo oficial do Celebre.
5. Salve as alterações e envie um carrinho de teste no Catálogo para comprovar que o WhatsApp abre com os dados preenchidos perfeitamente.

---

### 🔍 Passo 6: Testar Coleção Especial / Destaques da Vitrine
1. No painel **Minha Vitrine**, no campo **Título da Coleção Especial**, altere para algo atrativo (ex.: *Mais Alugados* ou *Coleção Especial*).
2. Clique na aba superior **`[ 📦 Gerenciar Peças na Vitrine ]`**.
3. Escolha 2 ou 3 peças do acervo e clique no botão **`[ ☆ Marcar Destaque ]`** (ele ficará dourado como `[ ⭐ Destaque ]`).
4. Abra o Catálogo:
   - **O que observar:**
     - No **Menu Lateral Oficial**, a coleção aparece logo no topo com a contagem: `⭐ Mais Alugados (3)`.
     - Nos cards dessas peças, aparece o selo dourado no topo da foto: `⭐ Destaque`.
     - Ao clicar nessa categoria, a vitrine filtra instantaneamente apenas os itens em destaque.

---

### 🔍 Passo 7: Testar Gerenciador de Visibilidade do Acervo
1. Ainda na aba **`[ 📦 Gerenciar Peças na Vitrine ]`**:
   - Use o campo de busca para achar uma peça específica.
   - Use o filtro por status: *Todas*, *Visíveis no Catálogo*, *Ocultas do Catálogo*, *Em Destaque*.
2. Em uma peça qualquer, clique no botão **`[ 👁️ Visível ]`** para alternar para **`[ 🚫 Oculta ]`**.
   - O sistema sincroniza na hora com o Firestore (`visivelCatalogo: false`).
3. Abra a Vitrine pública:
   - Pesquise por essa peça ou filtre pela categoria dela.
   - **O que observar:** A peça não é mais exibida para os clientes, mantendo o controle total do acervo sem precisar excluir a peça do estoque interno!

---

### 🔍 Passo 8: Validação dos Domínios Oficiais
1. Acesse o sistema via **`https://celebrefesta.com.br`**.
2. No painel **Minha Vitrine**, verifique o campo **Endereço Público da sua Vitrine**:
   - O link gerado será: `https://celebrefesta.com.br/catalogo/:seu-id`.
3. Clique em **Copiar Link** e cole no navegador ou teste o botão **📲 Compartilhar no WhatsApp**.
4. Teste acessar `https://celebre-9f5c9.web.app`:
   - O sistema acionará automaticamente a regra de **Canonicalização** e redirecionará para `https://celebrefesta.com.br` preservando o link.

---

## 🔒 Conformidade com as Regras de Blindagem (`AGENTS.md`)

| Regra | Descrição | Status no Teste |
|---|---|:---:|
| **Regra 1** | Cards KPI em 1 linha única contínua no Desktop (`> 900px`) | ✅ Aprovado |
| **Regra 2** | Cards KPI em 2 colunas simétricas no Mobile (`<= 900px`) | ✅ Aprovado |
| **Regra 5** | Isolamento total de CSS escopado sob `.minha-vitrine-container` | ✅ Aprovado |
| **Regra 7** | Arquivo sagrado `design-lock.css` 100% preservado | ✅ Aprovado |
| **Regra 8** | Catálogo Boutique sem barras horizontais duplicadas no topo | ✅ Aprovado |

---

## 🚀 Status da Publicação
* **Código Fonte:** Sincronizado na branch `main` do GitHub.
* **Build de Produção:** Concluído em 15.20s com 0 erros.
* **Hospedagem:** Ativo e operacional em **https://celebrefesta.com.br**.
