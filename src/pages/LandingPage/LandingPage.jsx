import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import './LandingPage.css';

// Importação das imagens oficiais
import logoImage from '../../assets/LOGO_CELEBRE.png';
import dashboardReal from '../../assets/landingpage.png'; 

const LandingPage = () => {
  const [modalContatoAberto, setModalContatoAberto] = useState(false);
  const [planos, setPlanos] = useState([]);
  const [loadingPlanos, setLoadingPlanos] = useState(true);

  useEffect(() => {
    const buscarPlanos = async () => {
      try {
        const q = query(collection(db, "planos"), orderBy("ordem", "asc"));
        const snap = await getDocs(q);
        const planosData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPlanos(planosData);
      } catch (error) {
        console.error("Erro ao buscar planos:", error);
      } finally {
        setLoadingPlanos(false);
      }
    };
    buscarPlanos();
  }, []);

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
          <a href="#faq" className="nav-link">Dúvidas</a>
          <Link to="/login" className="nav-link">Entrar</Link>
          <Link to="/cadastro" className="nav-btn-destaque">Teste Grátis</Link>
        </nav>
      </header>

      {/* HERO SECTION (A Mágica Acontece Aqui) */}
      <section className="hero-section">
        <div className="hero-grid">
          <div className="hero-content-left">
            <div className="hero-badge">✨ O fim do desespero com a agenda</div>
            <h1>O controlo absoluto do seu acervo de <span className="text-highlight">decorações.</span></h1>
            <p className="hero-subtitle">
              Diga adeus ao medo de alugar a mesma peça duas vezes.
              O Celebre organiza o seu stock, avisa sobre conflitos de data e gera contratos em PDF num clique.
              Feito para quem vive de festa.
            </p>
            
            <ul className="hero-benefits">
              <li><span className="check-icon">✓</span> Bloqueio automático de peças reservadas</li>
              <li><span className="check-icon">✓</span> Assinatura digital de contratos via WhatsApp</li>
              <li><span className="check-icon">✓</span> Catálogo online para a sua cliente escolher</li>
            </ul>

            <div className="hero-buttons">
              <Link to="/cadastro" className="btn-primary-large">Testar Grátis por 7 Dias</Link>
              <span className="hero-disclaimer">Comece agora. Não exige cartão de crédito.</span>
            </div>
          </div>
          
          <div className="hero-image-right">
             <div className="dashboard-wrapper">
                <img 
                  src={dashboardReal} 
                  alt="Painel Real do Celebre" 
                  className="dashboard-img"
                />
                
                {/* 4 CARDS DE MÉTRICAS FLUTUANTES (Estratégia de Valor Imediato) */}
                <div className="float-card" style={{ bottom: '-20px', left: '-30px', animation: 'float 6s ease-in-out infinite', animationDelay: '0s' }}>
                  <div className="float-icon">💰</div>
                  <div><strong>A Faturar (Mês)</strong><span className="float-value">R$ 12.450</span></div>
                </div>
                
                <div className="float-card" style={{ top: '40px', right: '-20px', animation: 'float 6s ease-in-out infinite', animationDelay: '2s' }}>
                  <div className="float-icon">📝</div>
                  <div><strong>Orçamentos</strong><span className="float-value">8 Pendentes</span></div>
                </div>

                <div className="float-card" style={{ bottom: '80px', right: '-40px', animation: 'float 6s ease-in-out infinite', animationDelay: '4s' }}>
                  <div className="float-icon">🚚</div>
                  <div><strong>Locações Hoje</strong><span className="float-value">5 Ativas</span></div>
                </div>

                <div className="float-card" style={{ top: '-20px', left: '40px', animation: 'float 6s ease-in-out infinite', animationDelay: '1s' }}>
                  <div className="float-icon">📦</div>
                  <div><strong>Estoque Parado</strong><span className="float-value">Apenas 12%</span></div>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* PROVA SOCIAL */}
      <section className="social-proof">
        <p>CONFIADO PELAS MELHORES DECORADORAS DO BRASIL</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', opacity: 0.6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '24px', fontWeight: 'bold' }}>Ágape Decorações</span>
            <span style={{ fontSize: '24px', fontWeight: 'bold' }}>Festiva Eventos</span>
            <span style={{ fontSize: '24px', fontWeight: 'bold' }}>Lumière Locações</span>
        </div>
      </section>

      {/* RECURSOS RESUMIDOS */}
      <section id="recursos" className="features-section">
        <div className="features-header">
          <h2>Tudo o que a sua empresa precisa</h2>
          <p style={{ color: 'var(--texto-claro)' }}>Uma plataforma única para substituir cadernos, planilhas e dezenas de apps.</p>
        </div>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">📦</div>
            <h3 style={{ color: 'var(--azul-naval)' }}>Gestão de Estoque</h3>
            <p style={{ color: '#475569', lineHeight: 1.6 }}>Saiba exatamente onde está cada peça. Controle de avarias, manutenções e histórico completo de locações.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📝</div>
            <h3 style={{ color: 'var(--azul-naval)' }}>Orçamentos e Contratos</h3>
            <p style={{ color: '#475569', lineHeight: 1.6 }}>Gere PDFs profissionais em segundos e envie para assinatura digital via WhatsApp de forma totalmente automatizada.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">✨</div>
            <h3 style={{ color: 'var(--azul-naval)' }}>Moodboard Interativo</h3>
            <p style={{ color: '#475569', lineHeight: 1.6 }}>Encante a sua cliente criando projetos 2D incríveis utilizando o seu próprio acervo de peças e texturas exclusivas.</p>
          </div>
        </div>
      </section>

      {/* PLANOS (Sem a tabela gigante, apenas os Cards de Conversão) */}
      <section id="planos" className="pricing-section">
        <div className="pricing-header">
          <h2>Planos Simples e Transparentes</h2>
          <p>Escolha o tamanho ideal para o momento da sua empresa. Sem taxas ocultas.</p>
        </div>
        
        {loadingPlanos ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--texto-claro)' }}>A carregar planos...</div>
        ) : (
          <div className="pricing-cards">
            {planos.map((p) => {
               const isDestaque = String(p.destaque) === "true";
               return (
                 <div key={p.id} className={`pricing-card ${isDestaque ? 'popular' : ''}`}>
                   {isDestaque && <div className="popular-badge">Mais Escolhido</div>}
                   <div className="card-header">
                     <h3>{p.nome}</h3>
                     <p className="pricing-desc">{p.descricao || 'Perfeito para o seu negócio.'}</p>
                   </div>
                   <div className="price">
                     <span>R$</span> {p.preco} <span>/mês</span>
                   </div>
                   <ul className="pricing-features">
                     {p.beneficios && p.beneficios.slice(0, 6).map((ben, i) => (
                       <li key={i}>✓ {ben}</li>
                     ))}
                     {p.limites && Object.entries(p.limites).slice(0, 3).map(([chave, valor], i) => (
                       <li key={`lim-${i}`}>✓ <strong>{valor}</strong> {chave}</li>
                     ))}
                   </ul>
                   <Link to={`/cadastro?plano=${p.id}`} className={isDestaque ? 'btn-pricing-solid' : 'btn-pricing-outline'}>
                     {isDestaque ? 'Assinar Premium' : 'Começar Agora'}
                   </Link>
                 </div>
               )
            })}
          </div>
        )}
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-col brand-col">
            <div className="landing-logo footer-logo">
              <img src={logoImage} alt="Logótipo Celebre" className="footer-logo-img" />
              <span>Celebre</span>
            </div>
            <p>O software definitivo para locadoras de artigos de festa e decoradoras que querem escalar as suas vendas com organização.</p>
          </div>
          
          <div className="footer-col">
            <h4>Produto</h4>
            <a href="#recursos" className="footer-link">Recursos</a>
            <a href="#planos" className="footer-link">Planos e Preços</a>
            <Link to="/cadastro" className="footer-link">Teste Grátis</Link>
          </div>
          
          <div className="footer-col">
            <h4>Empresa</h4>
            <button className="footer-link footer-link-btn" onClick={() => setModalContatoAberto(true)}>Fale Connosco</button>
            <a href="#termos" className="footer-link">Termos de Uso</a>
            <a href="#privacidade" className="footer-link">Privacidade</a>
          </div>

          <div className="footer-col">
            <h4>Redes Sociais</h4>
            <a href="https://instagram.com" target="_blank" rel="noreferrer" className="footer-link social-link">
              📷 Instagram
            </a>
            <button className="footer-link footer-link-btn social-link" onClick={() => setModalContatoAberto(true)}>
              💬 Suporte WhatsApp
            </button>
          </div>
        </div>
        
        <div className="footer-bottom">
          <p>© 2026 Celebre Sistemas. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* MODAL DE CONTATO */}
      {modalContatoAberto && (
        <div className="modal-overlay" onClick={() => setModalContatoAberto(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setModalContatoAberto(false)}>×</button>
            <h3>Como prefere falar com a equipa?</h3>
            <p>Escolha o canal da sua preferência. A nossa equipa comercial está pronta para ajudar a sua locadora!</p>
            
            <div className="modal-buttons">
              <a href="https://wa.me/5519998564109?text=Olá,%20gostaria%20de%20saber%20mais%20sobre%20o%20Celebre!" target="_blank" rel="noreferrer" className="btn-whatsapp">
                📱 Chamar no WhatsApp
              </a>
              <a href="mailto:celebrefesta25@gmail.com" className="btn-email">
                ✉️ Enviar E-mail
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;