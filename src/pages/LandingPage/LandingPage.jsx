import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import './LandingPage.css';

// 🔥 Importação das imagens oficiais
import logoImage from '../../assets/LOGO_CELEBRE.png'; 
import dashboardReal from '../../assets/landingpage.png'; 

const LandingPage = () => {
  const [modalContatoAberto, setModalContatoAberto] = useState(false);
  
  // 🔥 ESTADOS PARA PUXAR OS PLANOS DO FIREBASE
  const [planos, setPlanos] = useState([]);
  const [recursosGlobais, setRecursosGlobais] = useState([]);
  const [loadingPlanos, setLoadingPlanos] = useState(true);

  const isRecursoNumerico = (nome) => {
      const n = nome.toLowerCase();
      return n.includes('usuário') || n.includes('variedade') || n.includes('qtd') || n.includes('contrato');
  };

  const recursosPadrao = [
      "Usuários",
      "Variedade Produtos",
      "Gestão Clientes",
      "Gestão de Estoque",
      "Gestão de Pedidos/ Orçamentos",
      "Gestão de Logística",
      "Gestão de Contratos",
      "Gestão Fornecedores",
      "Gestão Financeira",
      "Gestão de Relatórios",
      "Gestão de Veículos",
      "Assinatura Digital",
      "Emissão de Etiquetas",
      "Agenda",
      "Catalago Digital",
      "Moodboard- Projeto Digital"
  ];

  useEffect(() => {
    const buscarPlanos = async () => {
      try {
        const q = query(collection(db, "planos"), orderBy("ordem", "asc"));
        const snap = await getDocs(q);
        const planosData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const recursosSet = new Set(recursosPadrao); 
        planosData.forEach(p => {
            if (Array.isArray(p.beneficios)) {
                p.beneficios.forEach(b => recursosSet.add(b));
            }
            if (p.limites) {
                Object.keys(p.limites).forEach(l => recursosSet.add(l));
            }
        });
        
        setRecursosGlobais(Array.from(recursosSet));
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

      {/* HERO SECTION (Lado a Lado) */}
      <section className="hero-section">
        <div className="hero-grid">
          
          <div className="hero-content-left">
            <div className="hero-badge">✨ O fim do desespero com a agenda</div>
            <h1>O controlo absoluto do seu acervo de <span className="text-highlight">decorações.</span></h1>
            <p className="hero-subtitle">
              Diga adeus ao medo de alugar a mesma peça duas vezes.
              O Celebre organiza seu estoque, avisa sobre conflitos de data e gera contratos em PDF num clique.
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
            
            <div className="hero-users">
              <div className="avatars">
                <div className="avatar">👩🏻</div>
                <div className="avatar">👨🏽</div>
                <div className="avatar">👩🏼‍🦱</div>
              </div>
              <span>A escolha inteligente de <strong>+500 decoradoras</strong></span>
            </div>
          </div>
          
          <div className="hero-image-right">
             <div className="dashboard-wrapper">
                <img 
                  src={dashboardReal} 
                  alt="Painel Real do Celebre" 
                  className="dashboard-img"
                  style={{ 
                    border: '8px solid #ffffff', 
                    boxShadow: '0 20px 40px rgba(0,0,0,0.1)' 
                  }} 
                />
                
                <div className="float-card float-1">
                  <div className="float-icon">📆</div>
                  <div>
                    <strong>Fim de Semana</strong>
                    <span className="float-value">Sem Overbooking</span>
                  </div>
                </div>
                <div className="float-card float-2">
                  <div className="float-icon">💰</div>
                  <div>
                    <strong>Contratos Fechados</strong>
                    <span className="float-value">R$ 4.250,00</span>
                  </div>
                </div>
             </div>
          </div>

        </div>
      </section>

      {/* PROVA SOCIAL - CASE REAL */}
      <section className="social-proof">
        <p>DESENVOLVIDO E VALIDADO NA PRÁTICA POR QUEM VIVE DE EVENTOS</p>
        <div className="logos-grid" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', opacity: '1' }}>
          
          <div className="real-logo-destaque" style={{ textAlign: 'center', padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: '800', color: '#0f172a', display: 'block' }}>
              Ágape Decorações
            </span>
            <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '600' }}>
              Case de Sucesso & Cliente Zero
            </span>
          </div>

          <p style={{ maxWidth: '600px', fontSize: '0.95rem', color: '#475569', marginTop: '15px', lineHeight: '1.6', textTransform: 'none', fontWeight: '500' }}>
            "O Celebre nasceu da nossa própria necessidade de organizar o acervo de Pegue e Monte. 
            O que antes era controlado em planilhas, hoje é uma máquina de aluguel automatizada."
          </p>

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

      {/* 🔥 PLANOS E PREÇOS DINÂMICOS DO FIREBASE 🔥 */}
      <section id="planos" className="pricing-section">
        <div className="pricing-header">
          <h2>O investimento certo para o seu crescimento</h2>
          <p>Todos os planos incluem <strong>7 dias de teste gratuito</strong>. Cancele quando quiser.</p>
        </div>

        <div className="pricing-cards">
          {loadingPlanos ? (
            <div style={{ textAlign: 'center', width: '100%', padding: '40px', color: '#64748b' }}>
              Carregando planos...
            </div>
          ) : (
            planos.map(p => (
              <div key={p.id} className={`pricing-card ${String(p.destaque) === "true" ? 'popular' : ''}`}>
                
                {String(p.destaque) === "true" && <div className="popular-badge">Mais escolhido</div>}
                
                <div className="card-header">
                    <h3>{p.nome}</h3>
                    <p className="pricing-desc">O plano ideal para a sua estrutura.</p>
                </div>
                
                <div className="price">R$ {p.preco}<span>/mês</span></div>
                
                <ul className="pricing-features">
                  {recursosGlobais.map((rec, idx) => {
                    const numerico = isRecursoNumerico(rec);

                    if (numerico) {
                        const valorBanco = p.limites?.[rec];
                        const valor = (valorBanco === undefined || valorBanco === "") ? "Ilimitado" : String(valorBanco);
                        
                        // 🛠️ MÁGICA VISUAL: Formatação de texto premium para SaaS
                        if (rec === "Gestão de Contratos") {
                            return <li key={idx}>✔️ <strong>{valor}</strong> de Contratos</li>;
                        }
                        if (rec === "Usuários") {
                            const textoUsuario = valor === "1" ? "Usuário" : "Usuários";
                            return <li key={idx}>✔️ <strong>{valor}</strong> {textoUsuario}</li>;
                        }
                        if (rec === "Variedade Produtos") {
                            return <li key={idx}>✔️ <strong>{valor}</strong> Produtos no Acervo</li>;
                        }

                        // Formatação padrão para novos itens numéricos que você criar
                        return (
                          <li key={idx}>✔️ <strong>{valor}</strong> {rec}</li>
                        );
                    } else {
                        const tem = Array.isArray(p.beneficios) && p.beneficios.includes(rec);
                        if (tem) {
                          return <li key={idx}>✔️ {rec}</li>;
                        } else {
                          return <li key={idx} className="disabled">❌ {rec}</li>;
                        }
                    }
                  })}
                </ul>
                
                <Link 
                  to={`/cadastro?plano=${p.id}`} 
                  className={String(p.destaque) === "true" ? "btn-pricing-solid" : "btn-pricing-outline"}
                >
                  Testar 7 Dias Grátis
                </Link>
              </div>
            ))
          )}
        </div>
      </section>

      {/* DÚVIDAS FREQUENTES */}
      <section id="faq" className="faq-section">
        <div className="faq-header">
          <h2>Dúvidas Frequentes</h2>
          <p>Tudo o que você precisa saber antes de começar.</p>
        </div>
        <div className="faq-grid">
          <div className="faq-item">
            <h4>Preciso de cartão de crédito para testar?</h4>
            <p>Não! Os 7 dias grátis são totalmente sem compromisso. Você só escolhe um plano e insere o pagamento se decidir continuar usando após o teste.</p>
          </div>
          <div className="faq-item">
            <h4>Consigo acessar pelo celular?</h4>
            <p>Sim. O Celebre é 100% online e responsivo, o que significa que você pode gerenciar seu estoque e contratos direto do navegador do seu celular, de onde estiver.</p>
          </div>
          <div className="faq-item">
            <h4>Como funciona o Catálogo Online?</h4>
            <p>O sistema gera um link exclusivo com a sua vitrine de peças. A sua cliente acessa, escolhe os itens, e o orçamento chega pronto no seu WhatsApp para você aprovar.</p>
          </div>
          <div className="faq-item">
            <h4>E se eu tiver dúvidas durante o uso?</h4>
            <p>Temos suporte humanizado via WhatsApp para os planos Profissional e Enterprise, além de vídeo tutoriais ensinando a configurar tudo passo a passo.</p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="footer-content">
          
          <div className="footer-col brand-col">
            <div className="landing-logo footer-logo">
              <img src={logoImage} alt="Logótipo Celebre" className="footer-logo-img" />
              <span>Celebre</span>
            </div>
            <p>O sistema definitivo para locadoras de artigos de festa e decoradoras. Automatize o seu negócio e acelere os seus lucros.</p>
          </div>

          <div className="footer-col">
            <h4>Plataforma</h4>
            <a href="#recursos" className="footer-link">Funcionalidades</a>
            <a href="#planos" className="footer-link">Planos e Preços</a>
            <Link to="/cadastro" className="footer-link">Criar Conta Grátis</Link>
            <Link to="/login" className="footer-link">Entrar no Sistema</Link>
          </div>

          <div className="footer-col">
            <h4>Ajuda e Legal</h4>
            <a href="#faq" className="footer-link">Dúvidas Frequentes (FAQ)</a>
            <button className="footer-link footer-link-btn" onClick={() => setModalContatoAberto(true)}>
              Contato
            </button>
            <Link to="/termos" className="footer-link">Termos de Uso</Link>
            <Link to="/privacidade" className="footer-link">Privacidade e Segurança</Link>
          </div>

          <div className="footer-col">
            <h4>Siga o Celebre</h4>
            <a href="https://instagram.com/celebre" target="_blank" rel="noreferrer" className="footer-link social-link">
              📱 Instagram
            </a>
            <a href="https://facebook.com/celebre" target="_blank" rel="noreferrer" className="footer-link social-link">
              💻 Facebook
            </a>
            <button className="footer-link footer-link-btn social-link" onClick={() => setModalContatoAberto(true)}>
              💬 Suporte
            </button>
          </div>

        </div>
        
        <div className="footer-bottom">
          <p>© 2026 Celebre Sistemas. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* 🔥 MODAL DE CONTATO 🔥 */}
      {modalContatoAberto && (
        <div className="modal-overlay" onClick={() => setModalContatoAberto(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setModalContatoAberto(false)}>×</button>
            <h3>Como prefere falar com a gente?</h3>
            <p>Escolha o canal de sua preferência. Nossa equipe comercial está pronta para ajudar a sua locadora!</p>
            
            <div className="modal-buttons">
              <a href="https://wa.me/5519998564109?text=Olá,%20gostaria%20de%20saber%20mais%20sobre%20o%20Celebre!" target="_blank" rel="noreferrer" className="btn-whatsapp">
                📱 Chamar no WhatsApp
              </a>
              <a href="mailto:celebrefesta25@gmail.com" className="btn-email">
                ✉️ Enviar um E-mail
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default LandingPage;