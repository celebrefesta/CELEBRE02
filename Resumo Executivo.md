# Resumo Executivo - Sistema Celebre

O **Celebre** é um sistema SaaS (Software as a Service) de gestão (ERP/CRM) completo, projetado especificamente para empresas de decoração de festas e aluguel de materiais (acervo).

---

## 🚀 Arquitetura e Stack Tecnológica

O sistema é construído sobre uma arquitetura moderna e reativa:
*   **Frontend**: React (v19) com Vite (v7) como bundler rápido, estruturado com rotas dinâmicas pelo `react-router-dom` (v7).
*   **Estilização**: CSS puro/vanilla customizado (`index.css`, `App.css` e CSS por módulo).
*   **Backend & Banco de Dados**: Firebase Suite (projeto `celebre-9f5c9`).
*   **Integrações**: Gateway de pagamento Mercado Pago (via `@mercadopago/sdk-react`) para gestão automatizada de assinaturas SaaS.

---

## ⚙️ Configurações Globais do Sistema

O Celebre possui um sistema de personalização armazenado no navegador do usuário e propagado por todo o DOM:

### 1. Temas (Modo de Cor)
*   **Valores**: `light` (Claro) e `dark` (Escuro).
*   **Mecanismo**: Salvo no LocalStorage sob a chave `theme`.
*   **Aplicação**: Através do atributo `data-theme` no `document.documentElement` (elemento `<html>`), que altera as variáveis CSS customizadas.

### 2. Tamanho da Fonte (Zoom)
*   **Valores**: `padrao` (Normal) e `ampliado` (Zoom).
*   **Mecanismo**: Salvo no LocalStorage sob a chave `fontSize`.
*   **Aplicação**: Através do atributo `data-font-size` no `document.documentElement`, modificando o dimensionamento em rem/em do app.

### 3. Idiomas e Tradução
*   **Valores**: `pt` (Português/Brasil), `en` (Inglês) e `es` (Espanhol).
*   **Mecanismo**: Salvo no LocalStorage sob a chave `language`.
*   **Tradução**: É realizada de forma híbrida e dinâmica através do cookie de tradução do Google Translator (`googtrans` configurado como `/pt/${lang}` para os idiomas adicionais e deletado quando volta para português), além do suporte estrutural do `i18next` e `react-i18next`.

---

## 🗄️ Modelagem do Banco de Dados (Firebase Firestore)

As coleções principais no Firestore estão estruturadas da seguinte forma:

### 1. `configuracoes_empresa`
Guarda os parâmetros administrativos e estruturais da empresa (`tenantId`/`userId`).
*   **Identidade & Redes**: `nomeEmpresa`, `cnpj`, `telefone`, `emailEmpresa`, `endereco`, `instagram`, `logotipo` (armazenado em Base64), `slogan`, `site`, `pixelFacebook` (ID Meta Ads).
*   **Contratos**: `assinatura` (imagem da assinatura digital da empresa em Base64).
*   **Localizações Físicas**: `localizacoes` (array de strings contendo prateleiras/corredores/galpões).
*   **Estrutura do Acervo**:
    *   `categoriasFisicas`: Array de categorias principais do galpão (Ex: `["Móveis", "Painéis"]`).
    *   `subcategoriasFisicas`: Mapa/Objeto ligando categoria física a subcategorias (Ex: `{"Móveis": ["Cilindros", "Mesas"]}`).
    *   `tamanhosPorCategoria`: Mapa/Objeto ligando categoria física/subcategoria a tamanhos disponíveis (Ex: `{"Mesas": ["Grande", "Média"]}`).
*   **Filtros do Catálogo (Vitrine Virtual)**:
    *   `catalogoVitrine`: Estrutura multinível aninhada contendo `Categoria Vitrine -> Subcategoria -> Grupo -> Tema Específico`.

### 2. `usuarios`
Contém as credenciais e estados de faturamento/planos do usuário principal/administrador.
*   **Campos**: `email`, `nomeCompleto`, `sobrenome`, `cpf`, `telefone`, `endereco`.
*   **Campos de Cobrança (MP)**: `assinaturaAtiva` (booleano), `statusAssinatura` (`ativa`, `pendente`), `plano` (`gratuito`, `pago`), `planoId`, `subscriptionId`, `dataFimTeste`.

### 3. `equipe`
Armazena os funcionários da empresa (`tenantId`).
*   **Campos**: `nome`, `email`, `telefone`, `cpf`, `empresaId` (o `tenantId` da empresa), `permissoes` (array ou mapa contendo as permissões de acesso aos módulos: `Estoque`, `Clientes`, `Locacoes`, `Agenda`, `Logistica`, `Contratos`, `Moodboard`).
*   **Ficha Médica**: `asoStatus` (Apto/Inapto), `asoTipo` (Admissional/Demissional/Periódico), `asoDataExame`, `asoValidade`, `asoObservacoes`.

### 4. `estoque`
Materiais e peças físicas cadastrados no galpão.
*   **Campos Chave**: `userId` (ID da empresa), `categoria`, `subCategoria`, `especificacoes.tamanho`, `localizacao` (vinculada à prateleira física), `quantidade`, `nome`, `descricao`, `imagem`.

### 5. `logs_atividades`
Auditoria de ações realizadas por funcionários.
*   **Campos**: `data`, `criadoEm`, `funcionario` (nome exibido), `usuarioEmail`, `acao` (tipo de ação em caixa alta, ex: `ALTERAÇÃO DE SENHA`), `detalhes`, `empresaId`, `funcionarioId`.

---

## 🛡️ Segurança e Níveis de Acesso

O sistema possui uma estrutura rígida de proteção de rotas através do componente `TravaSeguranca` no arquivo `App.jsx`, que atua em dois níveis:
1.  **Bloqueio por Assinatura (Cadeado Vermelho)**: Verifica se a conta da empresa (`tenantId`) possui o plano ativo (via teste gratuito ou assinatura paga do Mercado Pago) que contenha o recurso exigido pela rota.
2.  **Bloqueio por Cargo/Colaborador (Cadeado Branco)**: Garante que os funcionários da equipe tenham a permissão específica em sua ficha RH para acessar determinado módulo (por exemplo, bloqueando expressamente áreas confidenciais como Financeiro e Relatórios para colaboradores comuns).

---

## 📦 Módulos Principais do Sistema

1.  **Dashboard**: Centraliza gráficos e métricas de desempenho (faturamento, pedidos, limites de conta).
2.  **Estoque (Acervo) & Galpão**: Cadastro de itens com controle de dimensões, cores, quantidade, categorias físicas de prateleira e localizações (corredores/galpão).
3.  **Locações**: Criação, edição e acompanhamento de locações de materiais para eventos, com seletor de peças direto do acervo e cálculo automático.
4.  **Contratos & Assinaturas Digitais**: Modelos de contrato customizáveis, geração automática de contratos com assinatura oficial salva da empresa e portal de assinatura digital do cliente (`/assinatura/:id`).
5.  **Financeiro & Compras**: Lançamento de receitas, despesas, gestão de fornecedores e controle de compras de insumos.
6.  **Operacional (Agenda & Logística)**: Cronograma de eventos e logística de entrega, montagem, desmontagem e devolução de decorações.
7.  **Equipe & RH (ASO)**: Gestão de colaboradores com controle de ASO (Atestado de Saúde Ocupacional) e logs de auditoria das atividades (`logs_atividades`).
8.  **Vitrine Virtual (Catálogo do Cliente)**: Filtros multinível que alimentam o catálogo web público da empresa (`/catalogo/:idEmpresa`) para visualização de temas e peças pelos clientes.
9.  **Moodboard**: Tela interativa e artística para planejamento visual e montagem de projetos de decoração para apresentação comercial.

---

## 🛠️ Últimas Atualizações Realizadas

*   **Separação da Aba de Catálogo e Estoque**:
    *   Extraímos todo o conteúdo da aba "Catálogo e Estoque" de dentro do arquivo gigante `Configuracoes.jsx` para seu próprio componente [AbaCatalogoEstoque.jsx](file:///c:/Users/camil/Desktop/APLICATIVOS%20SISTEMAS/CELEBRE02/src/pages/Configuracoes/AbaCatalogoEstoque.jsx).
    *   Melhoramos a modularização e reduzimos a complexidade da página de Configurações.
*   **Separação da Aba de Assinatura e Uso**:
    *   Extraímos o painel de limites de equipe e cartão de assinatura do Mercado Pago para o componente [AbaAssinaturaUso.jsx](file:///c:/Users/camil/Desktop/APLICATIVOS%20SISTEMAS/CELEBRE02/src/pages/Configuracoes/AbaAssinaturaUso.jsx).
*   **Separação das Abas de Segurança e Aparência**:
    *   Desacoplamos a aba de cofre de senha para o componente [AbaSeguranca.jsx](file:///c:/Users/camil/Desktop/APLICATIVOS%20SISTEMAS/CELEBRE02/src/pages/Configuracoes/AbaSeguranca.jsx) e a aba de visualização (cor de tema, fonte e idioma) para o componente [AbaAparencia.jsx](file:///c:/Users/camil/Desktop/APLICATIVOS%20SISTEMAS/CELEBRE02/src/pages/Configuracoes/AbaAparencia.jsx).
    *   O arquivo principal [Configuracoes.jsx](file:///c:/Users/camil/Desktop/APLICATIVOS%20SISTEMAS/CELEBRE02/src/pages/Configuracoes/Configuracoes.jsx) foi reduzido de 62 KB para apenas **14 KB** (cerca de **220 linhas**), focado unicamente na orquestração dos dados.
*   **Correção de Responsividade Móvel & Menu de Abas em Grade**:
    *   Reestruturamos as grades de "Meu Perfil" e "Empresa" para colapsarem verticalmente em telas menores, evitando transbordamentos.
    *   Configuramos o menu de abas superior para se organizar em um **Grid Simétrico de 2 colunas no celular**, mantendo todas as 6 opções visíveis simultaneamente ("a olho nu") e com alturas uniformes (`min-height: 52px`) para evitar assimetria.
    *   Isolamos o design de cartões de assinatura e limites de usuários para se adaptarem aos celulares.
    *   Restringimos o espaçamento compacto aos cards do catálogo de temas, devolvendo o espaçamento premium aos formulários de dados e empresa.
*   **Correção de Regras de Segurança do Firestore & Firebase CLI**:
    *   Ajustamos o arquivo [firestore.rules](file:///c:/Users/camil/Desktop/APLICATIVOS%20SISTEMAS/CELEBRE02/firestore.rules) para liberar o acesso de leitura/escrita a novas coleções ativas.
    *   Otimizamos a consulta da coleção `equipe` para evitar que a validação de existência recursiva do Firestore lance erros de permissão insuficiente para proprietários.
    *   Corrigimos o arquivo [.firebaserc](file:///c:/Users/camil/Desktop/APLICATIVOS%20SISTEMAS/CELEBRE02/.firebaserc) de `myspacee` para o ID do projeto real `celebre-9f5c9`, alinhando os ambientes de deploy e de execução do frontend.
*   **Redesign Premium Completo das Configurações**:
    *   Implementamos a tipografia premium `'Plus Jakarta Sans'` do Google Fonts em todo o painel.
    *   Aprimoramos o menu de abas superior para um layout estilo "Pill" segmentado com contraste escuro e dourado.
    *   Introduzimos efeitos de elevação suave (Hover Lift) em todos os cartões e bordas de foco douradas com brilho radial nos inputs e textareas.
    *   Substituímos o redimensionamento dinâmico automático por um **Grid Simétrico de 2 colunas fixas (50% / 50%) no desktop** para as abas Empresa e Aparência, eliminando lacunas vazias do lado direito e cobrindo toda a largura horizontal útil.
    *   Adicionamos colapso automático responsivo para 1 coluna abaixo de `900px`.
    *   Sincronizamos a grade de exibição corrigindo a classe de largura total `.span-2-col-full` para seções grandes.
*   **Fichas de Inteligência no Perfil do Usuário**:
    *   Exibição do **Painel de Permissões de Acesso** dinâmico (somente leitura para colaboradores, e controle ilimitado para Proprietários). A edição das permissões continua centralizada de forma segura exclusivamente no painel de Equipe (`/usuarios`) sob gerência do Administrador.
    *   Removemos o feed individual de "Atividades Recentes" do perfil para unificar toda a auditoria no painel gerencial de monitoramento da empresa.
*   **Correção e Aprimoramento do Monitoramento de Atividades**:
    *   Corrigimos a listagem de membros in `Monitoramento.jsx` para consultar `equipe` em vez de `usuarios_equipe`, e ajustamos o redirecionamento do botão de voltar para `/usuarios`.
    *   Atualizamos as regras do Firestore (`firestore.rules`) permitindo que a listagem de auditoria no monitoramento passasse limpa pelo validador do Firebase, sendo index-safe.
    *   **Registro de Login**: Adicionamos o log automático da ação `LOGIN` em `Login.jsx` ao entrar no Celebre.
    *   **Padronização Global**: Revisamos e padronizamos todas as gravações de log em mais de 30 arquivos da aplicação (Clientes, Estoque, Locações, Agenda, Contratos, etc.) para garantir o envio correto de `empresaId`, `userId`, `funcionarioId`, `nomeFuncionario` e `dataHora` (em ISOString unificada para ordenação perfeita).
    *   Validamos o build de produção (`vite build`) com sucesso e sem avisos de chaves duplicadas.
*   **Redesenho Premium e Responsivo do Menu Lateral**:
    *   Modernizamos a barra de navegação lateral (`Navbar.jsx`/`Navbar.css`) com a fonte elegante `'Plus Jakarta Sans'`.
    *   Aplicamos um degradê metálico dourado no logotipo "CELEBRE" e adicionamos o subtexto elegante "Sistema Integrado".
    *   Substituímos o fundo azul plano por um degradê escuro refinado (`#0b0f19` a `#05070c`) e uma borda direita sutil.
    *   Redesenhamos o item ativo com uma barra dourada lateral no padrão moderno e implementamos efeitos de micro-deslocamento (hover glide) nos links.
    *   Implementamos media queries de altura (`max-height: 780px` e `640px`) que adaptam fontes, margens e paddings proporcionalmente para notebooks e telas pequenas, eliminando quebras de layout.
    *   **Correção de Vazamento CSS (Mobile)**: Escopamos todos os seletores `.menu-item` em `Agenda.css` sob `.agenda-sidebar`, eliminando o conflito global que tornava os botões do menu lateral brancos e desconfigurados em celulares.
*   **Responsividade Mobile do Monitoramento**:
    *   Criamos o arquivo `Monitoramento.css` para a tela de log de auditoria da equipe.
    *   **Dupla Renderização Otimizada**: Adicionamos lógica no React (`Monitoramento.jsx`) para renderizar a tabela clássica no computador (`.desktop-only-table`) e uma lista fluida de cartões no celular (`.mobile-only-list`), usando a tag `div` para cada elemento. Isso evita que o navegador tente forçar a estrutura rígida de tabelas (`tr`, `td`) a se comportar como blocos, eliminando de vez qualquer bug de desalinhamento ou sobreposição.
    *   **Estilo Flexbox & Quebra de Linha Nativa**: Cada atividade no celular foi estilizada com Flexbox puro e propriedade `word-break: break-word` nas tags de nome (`.mobile-username`) e detalhes (`.mobile-card-details`). Nomes gigantes como *"Thiago Donizetti Domingos Vitoriano"* agora quebram de linha de forma elegante, mantendo o card alinhado, legível e muito compacto (visualização de 5 a 6 logs por tela).
    *   Adicionamos recuo inferior de segurança de `80px` para evitar qualquer sobreposição com o botão flutuante de suporte técnico.
*   **Correção do Filtro de Auditoria no Monitoramento**:
    *   **Inclusão do Administrador**: Buscamos as informações do proprietário direto na coleção `usuarios` para adicioná-lo de forma automática no topo do select do filtro como `[Nome do Admin] (Admin)`.
    *   **Unificação de Filtros por E-mail**: Substituímos as chaves de filtragem que usavam o ID do Firestore (incompatível com o UID dos logs) pelo e-mail do usuário (comum a todas as coleções), normalizando ambos em caixa baixa (`.toLowerCase()`). Isso possibilita filtrar as atividades individualmente de cada colaborador e administrador sem falhas.
