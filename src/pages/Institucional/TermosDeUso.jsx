import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import logoImage from '../../assets/LOGO_CELEBRE.png';
import './Institucional.css';

const TermosDeUso = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Termos de Uso • Celebre Sistemas";
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
            <i className="fa-solid fa-scale-balanced"></i> Documento Oficial
          </span>
          <h1>Termos de Uso e Condições Gerais</h1>
          <p>
            Estes termos regulam o acesso e a utilização da plataforma Celebre para locadoras de móveis, decoração e eventos.
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
            <strong>Bem-vindo ao Celebre!</strong> Ao cadastrar-se e utilizar nossa plataforma de gestão, você concorda plenamente com as condições e termos aqui descritos. Leia atentamente este documento para conhecer seus direitos e obrigações.
          </div>

          {/* SEÇÃO 1 */}
          <section className="doc-section">
            <h2 className="doc-section-title">
              <span className="doc-section-number">1</span>
              Objeto e Natureza da Plataforma
            </h2>
            <p>
              O <strong>Celebre</strong> é um software como serviço (SaaS - <em>Software as a Service</em>) especializado na gestão operacional, logística, financeira, contratos e catálogo digital para empresas e profissionais do segmento de locação de peças, mobiliário e decoração para festas e eventos.
            </p>
            <p>
              O Celebre não realiza locação direta de itens aos clientes finais nem participa das relações comerciais entre as locadoras assinantes e seus respectivos clientes, atuando exclusivamente como ferramenta de tecnologia e gestão.
            </p>
          </section>

          {/* SEÇÃO 2 */}
          <section className="doc-section">
            <h2 className="doc-section-title">
              <span className="doc-section-number">2</span>
              Cadastro, Acesso e Segurança da Conta
            </h2>
            <p>
              Para utilizar os recursos do Celebre, o usuário deve realizar seu cadastro fornecendo informações verídicas, completas e atualizadas.
            </p>
            <ul>
              <li>O login e senha são de uso pessoal e intransferível, cabendo ao usuário a total responsabilidade pela confidencialidade de suas credenciais.</li>
              <li>O usuário administrador (Owner) tem autonomia para cadastrar colaboradores em sua equipe e definir suas respectivas permissões de acesso aos módulos.</li>
              <li>Qualquer atividade realizada sob a conta do usuário será de sua responsabilidade exclusiva.</li>
            </ul>
          </section>

          {/* SEÇÃO 3 */}
          <section className="doc-section">
            <h2 className="doc-section-title">
              <span className="doc-section-number">3</span>
              Planos, Assinaturas e Pagamentos
            </h2>
            <p>
              O acesso aos recursos da plataforma dá-se mediante assinatura dos planos disponibilizados (ex.: Mensal, Trimestral, Semestral ou Anual).
            </p>
            <ul>
              <li><strong>Processamento de Pagamento:</strong> As transações financeiras e cobranças são processadas com segurança através de parceiros certificados (como Mercado Pago), via PIX ou Cartão de Crédito.</li>
              <li><strong>Renovação Automática:</strong> As assinaturas no cartão de crédito são renovadas automaticamente ao término de cada ciclo, salvo cancelamento prévio pelo usuário.</li>
              <li><strong>Período de Degustação / Teste Grátis:</strong> Quando concedido, o período gratuito permite avaliar os recursos sem cobrança imediata. Ao término, a continuidade do serviço requer a escolha de um plano ativo.</li>
            </ul>
            <div className="doc-highlight-card">
              <i className="fa-solid fa-circle-check"></i>
              <div>
                <strong>Sem fidelidade ou multas rescisórias:</strong> Você tem total liberdade para cancelar sua assinatura a qualquer momento diretamente pelo painel ou via suporte.
              </div>
            </div>
          </section>

          {/* SEÇÃO 4 */}
          <section className="doc-section">
            <h2 className="doc-section-title">
              <span className="doc-section-number">4</span>
              Cancelamento e Reembolso
            </h2>
            <p>
              O usuário pode solicitar o cancelamento de sua assinatura a qualquer momento:
            </p>
            <ul>
              <li>Ao cancelar, o acesso aos recursos do plano continuará disponível até o último dia do ciclo já pago.</li>
              <li>Em conformidade com o Código de Defesa do Consumidor (Art. 49), o usuário tem direito ao arrependimento e reembolso integral no prazo de <strong>7 (sete) dias corridos</strong> após a primeira contratação.</li>
              <li>Não há taxas adicionais, multas de rescisão ou fidelidade contratual oculta.</li>
            </ul>
          </section>

          {/* SEÇÃO 5 */}
          <section className="doc-section">
            <h2 className="doc-section-title">
              <span className="doc-section-number">5</span>
              Propriedade Intelectual e Proteção de Dados
            </h2>
            <p>
              Todos os direitos de propriedade intelectual sobre o software Celebre (códigos, design, logotipos, marcas, algoritmos e funcionalidades) pertencem exclusivamente à <strong>Celebre Tecnologia e Sistemas LTDA</strong>.
            </p>
            <p>
              Os dados cadastrados pelo usuário (seus produtos, clientes, fotos de acervo, contratos e faturamento) são de propriedade exclusiva do próprio usuário. O Celebre não comercializa nem compartilha esses dados com terceiros para fins publicitários.
            </p>
            <div className="doc-highlight-card">
              <i className="fa-solid fa-shield-halved"></i>
              <div>
                <strong>Conformidade com a LGPD:</strong> O tratamento de dados pessoais na plataforma segue rigorosamente a Lei Geral de Proteção de Dados (Lei nº 13.709/2018). Consulte nossa <Link to="/privacidade" style={{ color: '#166534', fontWeight: 'bold' }}>Política de Privacidade</Link>.
              </div>
            </div>
          </section>

          {/* SEÇÃO 6 */}
          <section className="doc-section">
            <h2 className="doc-section-title">
              <span className="doc-section-number">6</span>
              Disponibilidade, Backups e Manutenção
            </h2>
            <p>
              O Celebre emprega infraestrutura de nuvem de alta disponibilidade (Google Cloud / Firebase) e monitoramento contínuo para garantir estabilidade e performance.
            </p>
            <p>
              Eventuais interrupções programadas para melhorias e atualizações serão realizadas preferencialmente em horários de menor tráfego operacional e comunicadas previamente sempre que possível.
            </p>
          </section>

          {/* SEÇÃO 7 */}
          <section className="doc-section">
            <h2 className="doc-section-title">
              <span className="doc-section-number">7</span>
              Suporte e Atendimento
            </h2>
            <p>
              Oferecemos suporte técnico e operacional através de nossos canais oficiais:
            </p>
            <ul>
              <li><strong>WhatsApp Oficial:</strong> (19) 99856-4109 (Segunda a Sexta das 08h às 18h)</li>
              <li><strong>E-mail:</strong> celebrefesta25@gmail.com</li>
            </ul>
          </section>

          {/* SEÇÃO 8 */}
          <section className="doc-section">
            <h2 className="doc-section-title">
              <span className="doc-section-number">8</span>
              Legislação e Foro
            </h2>
            <p>
              Estes Termos de Uso são regidos e interpretados segundo as leis da República Federativa do Brasil. Fica eleito o Foro da Comarca de São Paulo/SP para dirimir quaisquer controvérsias oriundas deste instrumento.
            </p>
          </section>

          {/* RODAPÉ DO DOCUMENTO */}
          <div className="doc-contact-footer">
            <div className="doc-contact-text">
              <h4>Ficou com alguma dúvida sobre estes termos?</h4>
              <p>Nossa equipe jurídica e comercial está à disposição para esclarecer.</p>
            </div>
            <div className="doc-contact-buttons">
              <a 
                href="https://wa.me/5519998564109?text=Olá,%20tenho%20uma%20dúvida%20sobre%20os%20Termos%20de%20Uso%20do%20Celebre." 
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

export default TermosDeUso;
