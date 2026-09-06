import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import logoImage from '../../assets/LOGO_CELEBRE.png';
import './Institucional.css';

const PoliticaPrivacidade = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Política de Privacidade (LGPD) • Celebre Sistemas";
  }, []);

  return (
    <div className="institucional-page">
      {/* NAVBAR SUPERIOR */}
      <header className="institucional-navbar">
        <div className="institucional-nav-container">
          <Link to="/" className="institucional-logo">
            <img src={logoImage} alt="Celebre" />
            <span>Celebre</span>
          </Link>

          <div className="institucional-nav-actions">
            <Link to="/" className="btn-institucional-back">
              <i className="fa-solid fa-arrow-left"></i>
              <span className="nav-btn-text">Voltar ao Início</span>
              <span className="nav-btn-text-mobile">Início</span>
            </Link>
            <Link to="/login" className="btn-institucional-cta">
              <i className="fa-solid fa-right-to-bracket"></i>
              <span className="nav-btn-text">Acessar Sistema</span>
              <span className="nav-btn-text-mobile">Entrar</span>
            </Link>
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <div className="institucional-main">
        {/* CABEÇALHO DO DOCUMENTO */}
        <div className="doc-header-card">
          <span className="doc-badge">
            <i className="fa-solid fa-shield-halved"></i> Conformidade LGPD
          </span>
          <h1>Política de Privacidade e Proteção de Dados</h1>
          <p>
            Transparência, respeito e rigor no tratamento de seus dados e das informações da sua locadora de acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
          </p>
          <div className="doc-meta-info">
            <div className="doc-meta-item">
              <i className="fa-regular fa-calendar-check"></i>
              <span>Última atualização: Fevereiro de 2026</span>
            </div>
            <div className="doc-meta-item">
              <i className="fa-solid fa-building"></i>
              <span>Celebre Tecnologia e Sistemas LTDA.</span>
            </div>
            <div className="doc-meta-item">
              <i className="fa-solid fa-id-card"></i>
              <span>CNPJ: 54.839.293/0001-42</span>
            </div>
          </div>
        </div>

        {/* CORPO DO DOCUMENTO */}
        <div className="doc-body-card">
          <div className="doc-intro-box">
            A <strong>Celebre Tecnologia e Sistemas LTDA</strong> está comprometida em resguardar a privacidade e proteger os dados pessoais de todos os usuários de sua plataforma. Este documento descreve de forma clara e transparente como tratamos, armazenamos e protegemos as suas informações.
          </div>

          {/* SEÇÃO 1 */}
          <section className="doc-section">
            <h2 className="doc-section-title">
              <span className="doc-section-number">1</span>
              Informações e Dados que Coletamos
            </h2>
            <p>
              Para o funcionamento pleno do sistema e prestação dos serviços contratados, tratamos as seguintes categorias de dados:
            </p>
            <ul>
              <li><strong>Dados de Cadastro da Conta:</strong> Nome completo, e-mail corporativo/pessoal, telefone/WhatsApp, nome fantasia da locadora, CPF ou CNPJ e endereço comercial.</li>
              <li><strong>Dados Operacionais Inseridos pelo Usuário:</strong> Informações de estoque, fotos de acervo, orçamentos, contratos de locação, valores de faturamento e dados dos clientes finais cadastrados pela sua locadora para fins de emissão de contratos e logística.</li>
              <li><strong>Dados Financeiros e de Cobrança:</strong> As transações de assinatura são processadas de forma criptografada por intermediadores de pagamento (como Mercado Pago). O Celebre não armazena dados sensíveis completos de cartões de crédito em seus servidores.</li>
              <li><strong>Dados Técnicos e de Conexão:</strong> Endereço IP, tipo de navegador, sistema operacional e registros de autenticação (logs) para garantia de segurança e prevenção a fraudes.</li>
            </ul>
          </section>

          {/* SEÇÃO 2 */}
          <section className="doc-section">
            <h2 className="doc-section-title">
              <span className="doc-section-number">2</span>
              Finalidade do Tratamento de Dados
            </h2>
            <p>
              Os dados coletados têm finalidades estritamente operacionais e contratuais:
            </p>
            <ul>
              <li>Permitir o acesso autenticado e a utilização de todos os módulos de gestão do Celebre;</li>
              <li>Emitir contratos digitais, relatórios financeiros, inventários e catálogos online para seus clientes;</li>
              <li>Processar pagamentos de planos e renovação de assinaturas;</li>
              <li>Prestar suporte técnico, atendimento humanizado e assistência operacional;</li>
              <li>Cumprir obrigações legais, regulatórias e fiscais aplicáveis no Brasil.</li>
            </ul>
            <div className="doc-highlight-card">
              <i className="fa-solid fa-lock"></i>
              <div>
                <strong>Seus dados não são mercadoria:</strong> O Celebre jamais comercializa, aluga ou cede dados pessoais ou comerciais para terceiros ou corretoras de dados.
              </div>
            </div>
          </section>

          {/* SEÇÃO 3 */}
          <section className="doc-section">
            <h2 className="doc-section-title">
              <span className="doc-section-number">3</span>
              Compartilhamento com Provedores Essenciais
            </h2>
            <p>
              O compartilhamento de informações restringe-se exclusivamente aos provedores essenciais para a operação tecnológica do software, que operam sob rigorosos padrões internacionais de segurança:
            </p>
            <ul>
              <li><strong>Infraestrutura de Nuvem e Banco de Dados:</strong> Google Cloud Platform / Firebase (servidores com certificações ISO 27001 e SOC 2/3);</li>
              <li><strong>Processamento de Pagamentos:</strong> Mercado Pago e intermediadores bancários credenciados pelo Banco Central do Brasil;</li>
              <li><strong>Comunicações Transacionais:</strong> Provedores de envio de e-mails transacionais (verificação de conta, redefinição de senha e alertas).</li>
            </ul>
          </section>

          {/* SEÇÃO 4 */}
          <section className="doc-section">
            <h2 className="doc-section-title">
              <span className="doc-section-number">4</span>
              Segurança e Armazenamento dos Dados
            </h2>
            <p>
              Implementamos avançadas medidas técnicas e administrativas para proteger suas informações contra acessos não autorizados, destruição, perda ou alteração:
            </p>
            <ul>
              <li>Criptografia de ponta a ponta em trânsito através de protocolos SSL/TLS (HTTPS);</li>
              <li>Controle rigoroso de permissões e isolamento multitenant no banco de dados Firestore (cada locadora acessa unicamente os seus próprios dados);</li>
              <li>Backups automáticos e monitoramento contínuo de integridade da infraestrutura;</li>
              <li>Bloqueio inteligente de sessões e proteção contra ataques de força bruta.</li>
            </ul>
          </section>

          {/* SEÇÃO 5 */}
          <section className="doc-section">
            <h2 className="doc-section-title">
              <span className="doc-section-number">5</span>
              Seus Direitos como Titular dos Dados (LGPD)
            </h2>
            <p>
              Em cumprimento ao Artigo 18 da Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você tem o direito de, a qualquer momento e mediante requisição:
            </p>
            <ul>
              <li><strong>Confirmação e Acesso:</strong> Confirmar a existência de tratamento e acessar seus dados pessoais cadastrados;</li>
              <li><strong>Correção:</strong> Solicitar a retificação de dados incompletos, inexatos ou desatualizados;</li>
              <li><strong>Portabilidade:</strong> Exportar relatórios de seus clientes, locações e produtos em formatos abertos (PDF, planilhas);</li>
              <li><strong>Eliminação e Revogação:</strong> Solicitar a exclusão definitiva de seus dados cadastrais ao encerrar a conta, ressalvadas as obrigações legais de guarda fiscal.</li>
            </ul>
          </section>

          {/* SEÇÃO 6 */}
          <section className="doc-section">
            <h2 className="doc-section-title">
              <span className="doc-section-number">6</span>
              Uso de Cookies e Tecnologias de Sessão
            </h2>
            <p>
              Utilizamos apenas cookies e armazenamento local (<em>localStorage / sessionStorage</em>) estritamente necessários para:
            </p>
            <ul>
              <li>Manter o usuário conectado com segurança durante sua sessão de trabalho;</li>
              <li>Salvar preferências visuais de navegação (como modo escuro/claro e tamanho de fonte);</li>
              <li>Garantir a navegação fluida sem necessidade de login a cada troca de página.</li>
            </ul>
          </section>

          {/* SEÇÃO 7 */}
          <section className="doc-section">
            <h2 className="doc-section-title">
              <span className="doc-section-number">7</span>
              Encarregado de Dados (DPO) e Contato
            </h2>
            <p>
              Para exercer qualquer um dos seus direitos de privacidade ou tirar dúvidas sobre esta política, entre em contato diretamente com o nosso Encarregado de Proteção de Dados:
            </p>
            <ul>
              <li><strong>E-mail de Privacidade:</strong> celebrefesta25@gmail.com</li>
              <li><strong>Atendimento ao Titular:</strong> (19) 99856-4109</li>
              <li><strong>Endereço:</strong> São Paulo - SP, Brasil</li>
            </ul>
          </section>

          {/* SEÇÃO 8 */}
          <section className="doc-section">
            <h2 className="doc-section-title">
              <span className="doc-section-number">8</span>
              Exclusão de Conta e Eliminação de Dados (Google Play & LGPD)
            </h2>
            <p>
              Em cumprimento ao Art. 18 da LGPD e aos requisitos de segurança do Google Play, qualquer usuário cadastrado pode solicitar ou efetuar a exclusão integral de sua conta e dos dados vinculados:
            </p>
            <ul>
              <li><strong>Pelo Aplicativo:</strong> Acesse <em>Configurações &gt; Segurança &gt; Excluir Minha Conta Definitivamente</em>.</li>
              <li><strong>Pela Web / Sem o Aplicativo:</strong> Acesse nossa página pública de <Link to="/excluir-conta" style={{ color: '#0284c7', fontWeight: 'bold' }}>Exclusão de Conta e Dados</Link> para registrar sua solicitação direta online.</li>
            </ul>
          </section>

          {/* RODAPÉ DO DOCUMENTO */}
          <div className="doc-contact-footer">
            <div className="doc-contact-text">
              <h4>Dúvidas sobre o tratamento de dados?</h4>
              <p>Nossa equipe de privacidade e segurança responderá com agilidade.</p>
            </div>
            <div className="doc-contact-buttons">
              <a 
                href="https://wa.me/5519998564109?text=Olá,%20gostaria%20de%20falar%20com%20o%20Encarregado%20de%20Privacidade%20do%20Celebre." 
                target="_blank" 
                rel="noreferrer" 
                className="btn-doc-whatsapp"
              >
                <i className="fab fa-whatsapp"></i> WhatsApp
              </a>
              <a href="mailto:celebrefesta25@gmail.com" className="btn-doc-email">
                <i className="fa-solid fa-envelope"></i> E-mail
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PoliticaPrivacidade;
