import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../../firebaseConfig';
// Importamos o 'where' para filtrar apenas quem paga
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import './LandingPage.css';

import logoImage from '../../assets/LOGO_CELEBRE.png';
import dashboardReal from '../../assets/landingpage.png'; 

const LandingPage = () => {
  const [modalContatoAberto, setModalContatoAberto] = useState(false);
  const [planos, setPlanos] = useState([]);
  const [loadingPlanos, setLoadingPlanos] = useState(true);
  
  // Estado que guarda as empresas. Começa vazio!
  const [empresasParceiras, setEmpresasParceiras] = useState([]);

  useEffect(() => {
    // 1. Busca os Planos
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

    // 2. Busca as Empresas (DO MEU PERFIL) dos clientes PAGANTES
    const buscarEmpresasParceiras = async () => {
      try {
        /*
          ========================================================================
          🔥 PASSO 1: ONDE ESTÃO OS DADOS?
          Troque "usuarios" pelo nome da coleção onde fica salvo o "Meu Perfil".
          
          🔥 PASSO 2: COMO SABER SE ELE PAGA?
          Descomente a linha do 'where' abaixo e troque "statusAssinatura" 
          pelo campo que você usa para saber se o cliente pagou (ex: "planoAtivo").
          ========================================================================
        */
        const q = query(
          collection(db, "usuarios"), 
          // where("statusAssinatura", "==", "ativo"), <-- DESCOMENTE QUANDO TIVER O SISTEMA DE PAGAMENTO
          limit(5)
        );
        
        const snap = await getDocs(q);
        const empresasData = [];
        
        snap.forEach(doc => {
          const data = doc.data();
          /*
            ========================================================================
            🔥 PASSO 3: O NOME DO CAMPO
            Quando a pessoa digita lá naquele campo "NOME DA EMPRESA" da sua foto, 
            com que nome isso salva no Firebase? 
            Se for "nomeEmpresa", troque data.empresa por data.nomeEmpresa
            ========================================================================
          */
          const nomeDaEmpresa = data.empresa; // <-- AJUSTE AQUI SE NECESSÁRIO
          
          if (nomeDaEmpresa && nomeDaEmpresa.trim() !== "") { 
            empresasData.push(nomeDaEmpresa);
          }
        });

        // Atualiza a tela APENAS com os nomes que vieram do banco
        setEmpresasParceiras(empresasData); 

      } catch (error) {
        console.error("Erro ao buscar empresas do Meu Perfil:", error);
        setEmpresasParceiras([]); 
      }
    };

    buscarPlanos();
    buscarEmpresasParceiras();
  }, []);

  const depoimentos = [
    {
      id: 1,
      nome: "Juliana Martins",
      empresa: "Ju Festas & Decor",
      foto: "https://ui-avatars.com/api/?name=Juliana+Martins&background=c5a059&color=fff", 
      texto: "Antes do Celebre eu tinha pavor de fechar dois eventos no mesmo dia e faltar peça. Agora o sistema bloqueia automático. Salvou a minha operação!"
    },
    {
      id: 2,
      nome: "Roberta Silva",
      empresa: "Locações Criativas",
      foto: "https://ui-avatars.com/api/?name=Roberta+Silva&background=0f172a&color=fff", 
      texto: "Gerar o contrato em PDF com um clique e mandar pro WhatsApp da cliente diminuiu a minha burocracia em 80%. Recomendo de olhos fechados."
    },
    {
      id: 3,
      nome: "Camila Barros",
      empresa: "Acervo Festeiro",
      foto: "https://ui-avatars.com/api/?name=Camila+Barros&background=e2e8f0&color=0f172a", 
      texto: "O catálogo online deixou o meu atendimento muito mais profissional e prático. As minhas clientes amam poder escolher as peças sozinhas."
    }
  ];

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

      {/* HERO SECTION ESCURO */}
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
              <Link to="/cadastro" className="btn-primary-large">Começar Teste de 7 Dias</Link>
              <span className="hero-disclaimer">Não exige cartão de crédito para começar.</span>
            </div>
          </div>
          
          <div className="hero-image-right">
             <div className="dashboard-wrapper">
                <img 
                  src={dashboardReal} 
                  alt="Painel Real do Celebre" 
                  className="dashboard-img"
                />
                
                <div className="float-card float-1" style={{ animation: 'float 6s ease-in-out infinite', animationDelay: '0s' }}>
                  <div className="float-icon">💰</div>
                  <div><strong>A Faturar (Mês)</strong><span className="float-value">R$ 12.450</span></div>
                </div>
                
                <div className="float-card float-2" style={{ animation: 'float 6s ease-in-out infinite', animationDelay: '2s' }}>
                  <div className="float-icon">📝</div>
                  <div><strong>Orçamentos</strong><span className="float-value">8 Pendentes</span></div>
                </div>

                <div className="float-card float-3" style={{ animation: 'float 6s ease-in-out infinite', animationDelay: '4s' }}>
                  <div className="float-icon">🚚</div>
                  <div><strong>Locações Hoje</strong><span className="float-value">5 Ativas</span></div>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* 🔥 MARCAS PARCEIRAS DINÂMICAS (INVISÍVEL SE NÃO TIVER NENHUMA) 🔥 */}
      {empresasParceiras.length > 0 && (
        <section className="brands-banner">
          <p>EMPRESAS QUE CONFIAM NO NOSSO TRABALHO</p>
          <div className="brands-row">
              {empresasParceiras.map((empresa, index) => (
                 <span key={index}>{empresa}</span>
              ))}
          </div>
        </section>
      )}

      {/* RECURSOS */}
      <section id="recursos" className="features-section">
        <div className="features-header">
          <h2>Tudo o que a sua empresa precisa</h2>
          <p>Uma plataforma única para substituir cadernos, planilhas e dezenas de apps genéricos.</p>
        </div>
        
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">📦</div>
            <h3>Gestão de Estoque</h3>
            <p>Saiba exatamente onde está cada peça. Controle avarias, manutenções e o histórico completo de locações.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📝</div>
            <h3>Contratos em 1 Clique</h3>
            <p>Gere PDFs profissionais e envie para assinatura digital via WhatsApp de forma totalmente automatizada.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🛍️</div>
            <h3>Catálogo Online</h3>
            <p>Uma vitrine digital do seu acervo para a cliente escolher as peças, gerando orçamentos automáticos no seu painel.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🚚</div>
            <h3>Painel de Logística</h3>
            <p>Organize as rotas do fim de semana. Saiba exatamente o que precisa ser entregue e recolhido em cada endereço.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">💰</div>
            <h3>Radar Financeiro</h3>
            <p>Acompanhe os pagamentos pendentes, o faturamento do mês e evite que clientes fiquem a dever após a festa.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">✨</div>
            <h3>Moodboard 2D</h3>
            <p>Encante a sua cliente criando projetos visuais incríveis utilizando fotos do seu próprio acervo de peças.</p>
          </div>
        </div>

        <div className="features-more-indicator">
          <p>✨ <strong>E isso é só o começo!</strong> O sistema Celebre possui dezenas de outras ferramentas exclusivas prontas para organizar a sua locadora de ponta a ponta.</p>
        </div>
      </section>

      {/* PROVA SOCIAL / DEPOIMENTOS */}
      <section className="testimonials-section">
        <div className="social-header">
          <h2>Quem vive de festa, usa Celebre.</h2>
          <p>Conheça as decoradoras que já transformaram a sua operação com o nosso sistema.</p>
        </div>
        <div className="testimonials-grid">
          {depoimentos.map((dep) => (
            <div key={dep.id} className="testimonial-card">
              <div className="quote-icon">"</div>
              <p className="testimonial-text">{dep.texto}</p>
              <div className="testimonial-author">
                <img src={dep.foto} alt={dep.nome} className="testimonial-avatar" />
                <div className="author-info">
                  <h4>{dep.nome}</h4>
                  <span>{dep.empresa}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" className="pricing-section">
        <div className="pricing-header">
          <h2>Planos Simples e Transparentes</h2>
          <p>Escolha o tamanho ideal para o momento da sua empresa. Sem taxas ocultas.</p>
        </div>
        
        {loadingPlanos ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#cbd5e1' }}>A carregar planos...</div>
        ) : (
          <div className="pricing-cards">
            {planos.map((p) => {
               const isDestaque = String(p.destaque) === "true";
               
               let nomePlanoFormatado = p.nome;
               if(nomePlanoFormatado.toLowerCase().includes('plus')) nomePlanoFormatado = 'Pro';

               const isBasico = nomePlanoFormatado.toLowerCase().includes('básico') || nomePlanoFormatado.toLowerCase().includes('basico');
               const isPremium = nomePlanoFormatado.toLowerCase().includes('premium');
               
               return (
                 <div key={p.id} className={`pricing-card ${isDestaque ? 'popular' : ''}`}>
                   {isDestaque && <div className="popular-badge">Mais Escolhido</div>}
                   <div className="card-header">
                     <h3>{nomePlanoFormatado}</h3>
                     <p className="pricing-desc">
                        {isBasico ? 'O essencial para organizar o seu acervo.' : 
                         isPremium ? 'Para quem já precisa controlar o financeiro.' : 
                         'Poder absoluto para locadoras de grande porte.'}
                     </p>
                   </div>
                   <div className="price">
                     <span>R$</span> {p.preco} <span>/mês</span>
                   </div>
                   
                   <ul className="pricing-features">
                     <li><span className="check-icon">✓</span> Gestão de Clientes</li>
                     <li><span className="check-icon">✓</span> Gestão de Estoque</li>
                     <li><span className="check-icon">✓</span> Gestão de Pedidos/Orçamentos</li>
                     <li><span className="check-icon">✓</span> Gestão de Logística</li>
                     <li><span className="check-icon">✓</span> Gestão de Fornecedores</li>
                     <li><span className="check-icon">✓</span> Agenda</li>
                     
                     {isBasico ? (
                        <li style={{ color: '#94a3b8', textDecoration: 'line-through' }}>
                          <span style={{ color: '#ef4444', fontWeight: 'bold', marginRight: '5px' }}>✕</span> Gestão Financeira
                        </li>
                     ) : (
                        <li><span className="check-icon">✓</span> Gestão Financeira</li>
                     )}

                     <li><span className="check-icon">✓</span> <strong>{isBasico ? '1' : isPremium ? '3' : '5+'}</strong> Usuário(s)</li>
                     <li><span className="check-icon">✓</span> <strong>{isBasico ? '1' : isPremium ? '3' : 'Múltiplos'}</strong> Modelo(s) de Contrato</li>
                     <li><span className="check-icon">✓</span> <strong>{isBasico ? '1.000' : isPremium ? '5.000' : '10.000'}</strong> Produtos no Acervo</li>
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

      {/* DÚVIDAS FREQUENTES */}
      <section id="faq" className="faq-section">
        <div className="faq-header">
          <h2>Dúvidas Frequentes</h2>
          <p>Tudo o que você precisa saber antes de começar.</p>
        </div>
        <div className="faq-grid">
          <div className="faq-item">
            <h4>O Celebre cobra comissão por locação?</h4>
            <p>Não! Você paga apenas a mensalidade fixa do seu plano. Todo o valor das locações é 100% da sua empresa.</p>
          </div>
          <div className="faq-item">
            <h4>Posso cancelar a qualquer momento?</h4>
            <p>Sim, não temos fidelidade. Você pode cancelar sua assinatura quando quiser diretamente no painel.</p>
          </div>
          <div className="faq-item">
            <h4>Como funciona o catálogo online?</h4>
            <p>O sistema gera um link exclusivo com o seu acervo. A sua cliente acessa, escolhe as peças, e o orçamento cai direto no seu sistema Celebre.</p>
          </div>
          <div className="faq-item">
            <h4>Preciso de cartão de crédito para testar?</h4>
            <p>Não. Os 7 dias de teste são totalmente gratuitos e não exigem cadastro de cartão ou compromisso.</p>
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
            <a href="https://instagram.com" target="_blank" rel="noreferrer" className="footer-link social-link">📷 Instagram</a>
            <button className="footer-link footer-link-btn social-link" onClick={() => setModalContatoAberto(true)}>💬 Suporte WhatsApp</button>
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
              <a href="https://wa.me/5519998564109?text=Olá,%20gostaria%20de%20saber%20mais%20sobre%20o%20Celebre!" target="_blank" rel="noreferrer" className="btn-whatsapp">📱 Chamar no WhatsApp</a>
              <a href="mailto:celebrefesta25@gmail.com" className="btn-email">✉️ Enviar E-mail</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;