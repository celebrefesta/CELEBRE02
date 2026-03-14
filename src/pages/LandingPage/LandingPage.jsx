import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

// 🔥 O seu logótipo oficial! 🔥
import logoImage from '../../assets/LOGO_CELEBRE.png'; 

const LandingPage = () => {
  return (
    <div className="landing-container">
      
      {/* CABEÇALHO */}
      <header className="landing-header">
        <div className="landing-logo">
          <img src={logoImage} alt="Logótipo Celebre" className="header-logo-img" />
          <span>Celebre</span>
        </div>
        <nav className="landing-nav">
          <a href="#recursos" className="nav-link">Recursos</a>
          <a href="#planos" className="nav-link">Planos</a>
          <Link to="/login" className="nav-link">Entrar</Link>
          {/* 🔥 Botão do menu atualizado */}
          <Link to="/cadastro" className="nav-btn-destaque">Teste Grátis</Link>
        </nav>
      </header>

      {/* HERO SECTION (Lado a Lado) */}
      <section className="hero-section">
        <div className="hero-grid">
          
          <div className="hero-content-left">
            <div className="hero-badge">✨ O sistema definitivo para o seu acervo</div>
            <h1>Acelere os lucros da sua locadora em <span className="text-highlight">tempo real.</span></h1>
            <p className="hero-subtitle">
              Abandone as planilhas desatualizadas. O Celebre centraliza todo o seu 
              estoque, contratos, clientes e financeiro numa plataforma única, segura e fácil de usar.
            </p>
            
            <ul className="hero-benefits">
              <li><span className="check-icon">✓</span> Controlo exato de onde está cada peça</li>
              <li><span className="check-icon">✓</span> Assinatura digital de contratos via WhatsApp</li>
              <li><span className="check-icon">✓</span> Catálogo online para os seus clientes</li>
            </ul>

            <div className="hero-buttons">
              {/* 🔥 Botão principal focado nos 7 dias! */}
              <Link to="/cadastro" className="btn-primary-large">Testar Grátis por 7 Dias</Link>
              <span className="hero-disclaimer">Sem compromisso. Não exige cartão de crédito.</span>
            </div>
            
            <div className="hero-users">
              <div className="avatars">
                <div className="avatar">👩🏻</div>
                <div className="avatar">👨🏽</div>
                <div className="avatar">👩🏼‍🦱</div>
              </div>
              <span>Junte-se a <strong>+500 locadoras</strong> no Brasil</span>
            </div>
          </div>
          
          <div className="hero-image-right">
             <div className="dashboard-wrapper">
                <img 
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop" 
                  alt="Painel do Celebre" 
                  className="dashboard-img"
                />
                
                <div className="float-card float-1">
                  <div className="float-icon">💰</div>
                  <div>
                    <strong>Faturação Mensal</strong>
                    <span className="float-value">R$ 14.500,00</span>
                  </div>
                </div>
                <div className="float-card float-2">
                  <div className="float-icon">📦</div>
                  <div>
                    <strong>Estoque Atualizado</strong>
                    <span className="float-value">Zero falhas</span>
                  </div>
                </div>
             </div>
          </div>

        </div>
      </section>

      {/* LOGOS EMPRESAS */}
      <section className="social-proof">
        <p>A ESCOLHA DAS EMPRESAS QUE MOVIMENTAM O MERCADO DE EVENTOS</p>
        <div className="logos-grid">
          <div className="fake-logo">Festança Locações</div>
          <div className="fake-logo">Decor&Arte</div>
          <div className="fake-logo">Studio Eventos</div>
          <div className="fake-logo">Acervo Premium</div>
        </div>
      </section>

      {/* RECURSOS */}
      <section id="recursos" className="features-section">
        <div className="features-header">
          <h2>Tudo o que precisa para escalar</h2>
          <p>Feito por quem entende de eventos, para quem vive de eventos.</p>
        </div>
        
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">📦</div>
            <h3>Gestão de Estoque</h3>
            <p>Saiba exatamente onde está cada peça do seu acervo. Evite falhas de locação, overbooking e perdas com um inventário sempre atualizado.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📝</div>
            <h3>Contratos Digitais</h3>
            <p>Gere, envie e recolha assinaturas de contratos pelo WhatsApp em segundos. Adeus papelada, olá agilidade jurídica.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">💰</div>
            <h3>Controlo Financeiro</h3>
            <p>Acompanhe pagamentos, pendências e o lucro real de cada evento fechado. Tenha previsibilidade no seu caixa.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🎨</div>
            <h3>Catálogo Online</h3>
            <p>Um portal exclusivo para os seus clientes montarem o próprio orçamento e enviarem direto para o seu WhatsApp.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🚚</div>
            <h3>Logística Inteligente</h3>
            <p>Roteirize entregas e recolhas de forma eficiente. Saiba quais os motoristas que estão com quais pedidos a qualquer momento.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Relatórios Precisos</h3>
            <p>Descubra quais as peças que dão mais lucro, quais estão paradas e tome decisões baseadas em dados reais da sua locadora.</p>
          </div>
        </div>
      </section>

      {/* PLANOS E PREÇOS */}
      <section id="planos" className="pricing-section">
        <div className="pricing-header">
          <h2>O investimento certo para o seu crescimento</h2>
          {/* 🔥 Aviso sobre os 7 dias grátis em todos os planos */}
          <p>Todos os planos incluem <strong>7 dias de teste gratuito</strong>. Cancele quando quiser.</p>
        </div>

        <div className="pricing-cards">
          
          {/* Plano Iniciante */}
          <div className="pricing-card">
            <div className="card-header">
                <h3>Iniciante</h3>
                <p className="pricing-desc">Para quem está a começar a organizar.</p>
            </div>
            <div className="price">R$ 49<span>/mês</span></div>
            <ul className="pricing-features">
              <li>✔️ Até 200 peças no acervo</li>
              <li>✔️ Gestão de Clientes</li>
              <li>✔️ Até 30 locações por mês</li>
              <li>✔️ Geração de Contratos PDF</li>
              <li>✔️ Suporte por E-mail</li>
              <li className="disabled">❌ Catálogo Online</li>
            </ul>
            {/* 🔥 Botões focados no teste grátis */}
            <Link to="/cadastro" className="btn-pricing-outline">Testar 7 Dias Grátis</Link>
          </div>

          {/* Plano Profissional (Destaque) */}
          <div className="pricing-card popular">
            <div className="popular-badge">Mais escolhido</div>
            <div className="card-header">
                <h3>Profissional</h3>
                <p className="pricing-desc">Para locadoras em pleno crescimento.</p>
            </div>
            <div className="price">R$ 99<span>/mês</span></div>
            <ul className="pricing-features">
              <li>✔️ Peças ilimitadas</li>
              <li>✔️ Gestão de Clientes ilimitada</li>
              <li>✔️ Locações ilimitadas</li>
              <li>✔️ Assinatura Digital de Contratos</li>
              <li>✔️ Catálogo Online Exclusivo</li>
              <li>✔️ Suporte por WhatsApp</li>
            </ul>
            <Link to="/cadastro" className="btn-pricing-solid">Testar 7 Dias Grátis</Link>
          </div>

          {/* Plano Enterprise */}
          <div className="pricing-card">
            <div className="card-header">
                <h3>Enterprise</h3>
                <p className="pricing-desc">Para operações complexas e múltiplas.</p>
            </div>
            <div className="price">R$ 199<span>/mês</span></div>
            <ul className="pricing-features">
              <li>✔️ Tudo do Profissional</li>
              <li>✔️ Múltiplas Filiais/Contas</li>
              <li>✔️ API para Integrações</li>
              <li>✔️ Relatórios Customizados</li>
              <li>✔️ Gestor de Conta Dedicado</li>
              <li>✔️ Suporte VIP 24h</li>
            </ul>
            <Link to="/cadastro" className="btn-pricing-outline">Testar 7 Dias Grátis</Link>
          </div>

        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="landing-logo footer-logo">
              <img src={logoImage} alt="Logótipo Celebre" className="footer-logo-img" />
              <span>Celebre</span>
            </div>
            <p>A transformar a gestão de locações e eventos no Brasil.</p>
          </div>
          <div className="footer-bottom">
            <p>© 2026 Celebre Sistemas. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;