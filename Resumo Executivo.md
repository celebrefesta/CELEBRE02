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

### 📅 20/07/2026
*   **Refatoração e Correção de Textos PT-PT para PT-BR**:
    *   Corrigidos termos em português europeu no ecossistema público e privado: `controlo` ➜ `controle`, `stock` ➜ `estoque`, `equipa` ➜ `equipe`, `contacto` ➜ `contato`, `faturação` ➜ `faturamento`, `palavra-passe` ➜ `senha` e `registo` ➜ `cadastro` nos arquivos [LandingPage.jsx](file:///c:/Users/camil/Desktop/APLICATIVOS%20SISTEMAS/CELEBRE02/src/pages/LandingPage/LandingPage.jsx), [CadastroCliente.jsx](file:///c:/Users/camil/Desktop/APLICATIVOS%20SISTEMAS/CELEBRE02/src/pages/Clientes/CadastroCliente.jsx), [Cadastro.jsx](file:///c:/Users/camil/Desktop/APLICATIVOS%20SISTEMAS/CELEBRE02/src/pages/Auth/Cadastro.jsx), [Login.jsx](file:///c:/Users/camil/Desktop/APLICATIVOS%20SISTEMAS/CELEBRE02/src/pages/Auth/Login.jsx), [AbaSeguranca.jsx](file:///c:/Users/camil/Desktop/APLICATIVOS%20SISTEMAS/CELEBRE02/src/pages/Configuracoes/AbaSeguranca.jsx) e [Perfil.jsx](file:///c:/Users/camil/Desktop/APLICATIVOS%20SISTEMAS/CELEBRE02/src/pages/Perfil/Perfil.jsx).
*   **Modernização Premium do Rodapé e Landing Page**:
    *   Reestruturado o rodapé corporativo com colunas de navegação limpas contendo dados de Razão Social, CNPJ (`54.839.293/0001-42`), endereço sede `São Paulo - SP`, e ícones oficiais de redes sociais via FontAwesome.
    *   Cabeçalho agora conta com efeito *glassmorphism* (`backdrop-filter`), degradê dourado metálico no Hero e transições de elevação suave em todos os cartões.
    *   Unificada a chamada de ação para "Começar Agora" nos planos de preços.
    *   Substituída a opção "Suporte WhatsApp" do rodapé por "Suporte" geral, utilizando um ícone de headset.
*   **Controle de Duplicidade de Teste Grátis (CPF/CNPJ)**:
    *   Criada a coleção `registros_documentos` onde vinculamos o CPF/CNPJ limpo ao UID do usuário criador. A verificação impede que um mesmo documento realize múltiplos testes gratuitos no sistema.
    *   Atualizadas e publicadas as regras de segurança no Firestore (`firestore.rules`) para autorizar a validação e liberação de envio na fila da coleção `mail`.
*   **E-mail de Boas-Vindas Premium**:
    *   Desenvolvido template de e-mail em HTML altamente profissional com a paleta oficial da marca Celebre (azul-escuro e dourado), contendo instruções de acesso ao painel de teste grátis.
*   **Redesign Premium e Alinhamento do Dashboard**:
    *   Reestruturado o layout do painel com flexbox para redimensionamento nativo e eliminadas as barras de rolagem verticais indesejadas nos cartões de KPI e gráficos com `overflow: hidden`.
    *   Implementado estilo premium nos cards (bordas ardósia, hover com escala suave e brilho dourado).
    *   Removidas as bordas coloridas de alerta (vermelha e amarela) dos cartões para manter um visual limpo e uniforme quando não houver problemas ou para contas novas.
    *   Caixas de feeds arredondadas com contraste e gráfico de faturamento em degradê dourado oficial.
    *   Substituída a legenda de status pesada por texto limpo, economizando altura útil e evitando qualquer quebra.
*   **Responsividade e Requisitos de Senha Obrigatórios**:
    *   Ajustado layout de cartão flutuante em celulares para evitar que o formulário de cadastro ocupe toda a tela edge-to-edge sem bordas.
    *   Inclusão de título com destaque em vermelho confirmando a obrigatoriedade de todos os critérios mínimos de senha.
*   **Correção Crítica: Página de Estoque Bloqueada no Teste Grátis**:
    *   A página `Estoque.jsx` possuía uma verificação interna de acesso que só aceitava planos pagos, ignorando o período de teste de 7 dias. Usuários em teste viam a tela de "Recurso Exclusivo" mesmo com acesso liberado pela `TravaSeguranca`.
    *   Adicionada verificação de `dataFimTeste` e `dataCadastro` (cálculo de 7 dias) seguindo o mesmo padrão do `RotaProtegida.jsx`, liberando acesso total com limite de 10.000 itens durante o teste gratuito.
*   **Nova Página e Ações do Controle Geral (Painel Master)**:
    *   Criada e implementada a página de [Controle Geral](file:///c:/Users/camil/Desktop/APLICATIVOS%20SISTEMAS/CELEBRE02/src/pages/Admin/ControleGeral.jsx) e seu respectivo estilo [ControleGeral.css](file:///c:/Users/camil/Desktop/APLICATIVOS%20SISTEMAS/CELEBRE02/src/pages/Admin/ControleGeral.css).
    *   A página exibe uma listagem completa e detalhada de todas as empresas clientes cadastradas (com busca, filtros por status, plano ativo, data de cadastro e progresso visual dos dias restantes de teste grátis).
    *   **Nova Ação: Visualizador de Dados de Suporte (Inspeção de Conta)**: Substituído o sistema de simulação de acesso (impersonação) por um modal robusto de suporte (ícone de lupa). Ao clicar, o painel do ADM Master abre uma janela com abas para inspecionar os dados reais daquela empresa no banco de dados sem alterar a sessão de login (Resumo da conta, itens no acervo, locações/pedidos efetuados, e listagem de clientes do usuário), garantindo a estabilidade e segurança.
    *   **Ajuste Fino de Design**: Corrigido bug de estilo no arquivo `ControleGeral.css` onde o botão de lupa de suporte herdava comportamento esticado de formulário por falta da classe atualizada no seletor de botões de ações, alinhando-o perfeitamente com os demais botões da linha.
    *   **Redesenho da Tela de Agenda (Estilo Premium)**:
        *   **Sidebar à Direita (Sem Choque Visual)**: Para evitar o conflito visual de "dois menus escuros colados um do lado do outro", movemos a sub-barra de filtros e controle da agenda para o **lado direito do monitor** (`flex-direction: row-reverse`). O visual ficou balanceado e moderno (Menu Principal à esquerda, Calendário no centro e Filtros à direita).
        *   **Ícones Sempre Coloridos**: Substituição de marcadores simples por ícones FontAwesome com cores de destaque exclusivas por categoria ativas por padrão, resolvendo a falta de cores no menu.
        *   **Itens Ativos Remodelados**: Itens selecionados ganham fundos translúcidos elegantes e bordas esquerdas acentuadas na cor correspondente.
        *   **Ajuste de Altura e Grid (Sem Transbordo)**: Configurada restrição de altura flexível (`min-height: 0` e `overflow: hidden`) no wrapper principal, no contêiner do calendário e nas células diárias. O calendário agora redimensiona dinamicamente para caber 100% na altura da tela do monitor, eliminando barras de rolagem desnecessárias no navegador.
        *   **Correção de Permissão no Console**: Corrigido erro de permissão `FirebaseError: Missing or insufficient permissions` que aparecia no console ao carregar a página. A consulta de parâmetros de logotipo agora é feita diretamente no documento `configuracoes_empresa` com o `tenantId` do usuário ativo, em vez de ler o documento genérico global `sistema/parametros`.
        *   **Responsividade Mobile Otimizada (Gaveta Deslizante e Tela Cheia)**: No celular (telas < 1024px), toda a barra lateral vertical de filtros foi ocultada e transformada em um **menu suspenso deslizante (sliding drawer) que entra pela direita** ao clicar no botão "Filtros" no cabeçalho. Com isso, o calendário ganhou espaço total e passou a ocupar **100% da tela**. O grid de dias foi otimizado para ajustar e caber perfeitamente na altura vertical da tela do celular, exibindo todos os dias do mês sem cortes e sem necessidade de rolagem.
        *   **Ajuste no Seletor de Períodos (Lista)**: Corrigido corte de texto no switcher secundário (Ano/Mês/Semana/Dia) no modo Lista em celulares. Os seletores agora empilham verticalmente ocupando toda a largura útil da tela de forma harmônica, sem qualquer transbordo lateral.
    *   **Segurança Máxima: Bloqueio de Usuários Fantasmas**: Criada verificação de integridade de conta em tempo real no `App.jsx`. Se um usuário logado tiver seu cadastro deletado do banco de dados (Firestore) mas sua sessão de autenticação continuar ativa no navegador, ele é detectado, desconectado automaticamente (`signOut`) e redirecionado para a tela de registro com aviso explicativo.
    *   **Redesenho Premium da Tela de Clientes (Estilo Dashboard)**:
        *   **Cards KPI no Estilo Dashboard**: Substituímos os cartões de resumo originais pelo mesmo visual dos cartões informativos do Dashboard principal. Agora eles não possuem ícone interno, exibem o rótulo em caixa alta no topo, o número destacado abaixo e fundo gradiente degradê em cores temáticas com bordas coloridas correspondentes (roxo para total, verde para adimplentes e vermelho para inadimplentes).
        *   **Limpeza Geral de Código (Inline Styles)**: Removemos 100% das estilizações inline (`style={{...}}`) do arquivo `Clientes.jsx` (cabeçalho, barra de filtros, tabela e modal), movendo toda a gerência de design para classes semânticas no CSS.
        *   **Tabela como Grade de Cards Independentes**: Afastamos as linhas da tabela (`border-spacing: 0 12px`) criando o efeito de cartões individuais que flutuam (`translateY(-2px)`) e projetam sombra elegante no hover.
        *   **Modal Fichário de Clientes Refinado**: Layout split limpo com desfoque de fundo (backdrop-filter blur), medalha de avatar dourada e abas temáticas.
        *   **Prevenção de Conflitos CSS Globais**: Renomeamos a classe da linha de estatísticas na página de clientes de `.stats-wide-row` para `.clientes-stats-row`, isolando os estilos de 3 colunas e mantendo a grade original de 5 colunas do Dashboard 100% perfeita. Adicionalmente, escopamos as classes `.stat-card-wide` e as bordas coloridas sob o prefixo `.clientes-container` em `Clientes.css`, restaurando os estilos e degradês originais de cor dourada (`border-gold` para Acervo) e azul (`border-blue` para Locações Ativas) que estavam sendo sobrescritas e apareciam apagadas no Dashboard.

### 📅 Histórico de Atualizações Anteriores
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
    *   Corrigimos a listagem de membros em `Monitoramento.jsx` para consultar `equipe` em vez de `usuarios_equipe`, e ajustamos o redirecionamento do botão de voltar para `/usuarios`.
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
