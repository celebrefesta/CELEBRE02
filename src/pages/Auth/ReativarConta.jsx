import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../../firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import logoImage from '../../assets/LOGO_CELEBRE.png';
import './ReativarConta.css';

const PLANOS_PADRAO = [
  {
    id: 'plano_basico',
    nome: 'Básico',
    preco: '49,90',
    limiteAcervo: 150,
    usuarios: 1,
    descricao: 'Ideal para acervos iniciantes e operações enxutas.',
    beneficios: [
      'Até 150 itens no acervo',
      '1 usuário com acesso',
      'Gestão de Clientes & CRM',
      'Gestão de Pedidos & Orçamentos',
      'Controle Financeiro Essencial',
      'Agenda de Locações'
    ]
  },
  {
    id: 'plano_premium',
    nome: 'Premium',
    preco: '99,90',
    limiteAcervo: 500,
    usuarios: 3,
    destaque: true,
    descricao: 'O plano mais escolhido para expandir com máxima eficiência.',
    beneficios: [
      'Até 500 itens no acervo com fotos em HD',
      'Até 3 usuários simultâneos',
      'Catálogo Digital Vitrine Online',
      'Contratos com Assinatura Digital',
      'Etiquetas & Separação por QR Code',
      'Matriz de Disponibilidade Inteligente',
      'Suporte Prioritário VIP no WhatsApp'
    ]
  },
  {
    id: 'plano_plus',
    nome: 'Plus',
    preco: '159,90',
    limiteAcervo: Infinity,
    usuarios: 10,
    descricao: 'Para grandes acervos e empresas com alta rotatividade de festas.',
    beneficios: [
      'Acervo ILIMITADO de produtos e fotos',
      'Até 10 usuários com controle de permissões',
      'Módulo de Moodboard & Projetos Visuais',
      'Logística Avançada & Gestão de Veículos',
      'Dashboard Executivo com BI & Metas',
      'Todas as novidades e atualizações inclusas'
    ]
  }
];

const ATUALIZACOES_SISTEMA = [
  {
    id: 'catalogo',
    icone: 'fas fa-store',
    titulo: 'Catálogo Online Boutique de Luxo',
    descricao: 'Vitrine digital moderna com fotos em alta definição, carrinho flutuante e envio de orçamentos direto para o seu WhatsApp.',
    badge: 'Mais Amado'
  },
  {
    id: 'qrcode',
    icone: 'fas fa-qrcode',
    titulo: 'Separação & Bipagem por QR Code',
    descricao: 'Emissão de etiquetas e Mapa de Separação em PDF com conferência ágil no galpão, eliminando erros de expedição.',
    badge: 'Industrial'
  },
  {
    id: 'disponibilidade',
    icone: 'fas fa-calendar-check',
    titulo: 'Matriz de Disponibilidade Inteligente',
    descricao: 'Calendário visual do acervo em tempo real que impede reservas duplicadas e sobreposição de datas de locação.',
    badge: 'Exclusivo'
  },
  {
    id: 'contratos',
    icone: 'fas fa-file-signature',
    titulo: 'Contratos com Assinatura Digital',
    descricao: 'Geração automática de contratos com envio de link para o cliente assinar na tela do celular, sem papel nem impressora.',
    badge: 'Jurídico'
  },
  {
    id: 'bi',
    icone: 'fas fa-chart-line',
    titulo: 'Novo Dashboard Executivo & BI',
    descricao: 'Termômetro de metas financeiras, ranking de produtos mais rentáveis e métricas de desempenho para alavancar seu negócio.',
    badge: 'Gestão VIP'
  }
];

const ReativarConta = () => {
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(true);
  const [usuario, setUsuario] = useState(null);
  const [dadosConta, setDadosConta] = useState(null);

  const [totalEstoque, setTotalEstoque] = useState(0);
  const [totalClientes, setTotalClientes] = useState(0);
  const [totalLocacoes, setTotalLocacoes] = useState(0);

  const [planos, setPlanos] = useState(PLANOS_PADRAO);
  const [planoSelecionado, setPlanoSelecionado] = useState(PLANOS_PADRAO[1]); // Premium por padrão
  const [planoRecomendadoId, setPlanoRecomendadoId] = useState('plano_premium');

  // Controle dos 3 Modos de Aparência (Claro, Grafite, Midnight)
  const [temaMenuAberto, setTemaMenuAberto] = useState(false);
  const [temaAtual, setTemaAtual] = useState(localStorage.getItem('theme') || 'light');
  const [darkStyleState, setDarkStyleState] = useState(localStorage.getItem('darkStyle') || 'gray');
  const temaRef = useRef(null);

  useEffect(() => {
    const atualizarTemaState = () => {
      const savedTheme = localStorage.getItem('theme') || 'light';
      const savedStyle = localStorage.getItem('darkStyle') || 'gray';
      setTemaAtual(savedTheme);
      setDarkStyleState(savedStyle);
    };

    atualizarTemaState();
    window.addEventListener('theme-change', atualizarTemaState);
    window.addEventListener('storage', atualizarTemaState);
    return () => {
      window.removeEventListener('theme-change', atualizarTemaState);
      window.removeEventListener('storage', atualizarTemaState);
    };
  }, []);

  useEffect(() => {
    const handleClickFora = (event) => {
      if (temaRef.current && !temaRef.current.contains(event.target)) {
        setTemaMenuAberto(false);
      }
    };
    document.addEventListener("mousedown", handleClickFora);
    return () => document.removeEventListener("mousedown", handleClickFora);
  }, []);

  const selecionarTemaDireto = (modo) => {
    let effectiveTheme = 'light';
    let darkStyle = 'none';

    if (modo === 'light') {
      effectiveTheme = 'light';
      darkStyle = 'none';
    } else if (modo === 'dark-gray') {
      effectiveTheme = 'dark';
      darkStyle = 'gray';
    } else if (modo === 'dark-midnight') {
      effectiveTheme = 'dark';
      darkStyle = 'midnight';
    }

    setTemaAtual(modo);
    setDarkStyleState(darkStyle);
    localStorage.setItem('theme', modo);
    localStorage.setItem('darkStyle', darkStyle);

    document.documentElement.setAttribute('data-theme', effectiveTheme);
    document.documentElement.setAttribute('data-dark-style', darkStyle);

    window.dispatchEvent(new Event('theme-change'));
    setTemaMenuAberto(false);
  };

  const getTemaInfo = () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const style = document.documentElement.getAttribute('data-dark-style') || darkStyleState;

    if (!isDark || temaAtual === 'light') {
      return { icone: '☀️', rotulo: 'Claro' };
    }
    if (style === 'gray' || temaAtual === 'dark-gray') {
      return { icone: '🪨', rotulo: 'Grafite' };
    }
    return { icone: '🌙', rotulo: 'Midnight' };
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Reativação do seu Acesso • Celebre";

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        navigate('/conta-suspensa');
        return;
      }

      setUsuario(currentUser);

      try {
        // 1. Carrega dados cadastrais da conta
        let tenantId = currentUser.uid;
        const userDocRef = doc(db, 'usuarios', currentUser.uid);
        const userSnap = await getDoc(userDocRef);

        let uData = {};
        if (userSnap.exists()) {
          uData = userSnap.data();
          setDadosConta(uData);
          if (uData.tenantId) {
            tenantId = uData.tenantId;
          }
        }

        // 2. Busca contagem real do acervo, clientes e locações preservados
        const [snapEstoque, snapClientes, snapLocacoes] = await Promise.all([
          getDocs(query(collection(db, 'estoque'), where('userId', '==', tenantId))).catch(() => ({ docs: [] })),
          getDocs(query(collection(db, 'clientes'), where('userId', '==', tenantId))).catch(() => ({ docs: [] })),
          getDocs(query(collection(db, 'locacoes'), where('userId', '==', tenantId))).catch(() => ({ docs: [] }))
        ]);

        const qtdEstoque = snapEstoque.docs.length;
        const qtdClientes = snapClientes.docs.length;
        const qtdLocacoes = snapLocacoes.docs.length;

        setTotalEstoque(qtdEstoque);
        setTotalClientes(qtdClientes);
        setTotalLocacoes(qtdLocacoes);

        // 3. Busca planos cadastrados no banco ou usa lista padrão calibrada
        try {
          const snapPlanos = await getDocs(collection(db, 'planos'));
          if (!snapPlanos.empty) {
            const planosDb = snapPlanos.docs.map(d => {
              const data = d.data();
              const nome = data.nome || 'Plano';
              let limite = Infinity;
              if (data.limites && data.limites['Variedade Produtos']) {
                const parsed = parseInt(data.limites['Variedade Produtos'], 10);
                if (!isNaN(parsed) && parsed > 0) limite = parsed;
              } else if (nome.toLowerCase().includes('básico') || nome.toLowerCase().includes('basico')) {
                limite = 150;
              } else if (nome.toLowerCase().includes('premium')) {
                limite = 500;
              }

              return {
                id: d.id,
                nome,
                preco: data.preco || '99,90',
                limiteAcervo: limite,
                usuarios: data.limites?.['Usuários'] || 3,
                destaque: String(data.destaque) === 'true',
                descricao: data.descricao || 'Assinatura mensal completa Celebre.',
                beneficios: data.beneficios || []
              };
            });

            if (planosDb.length > 0) {
              setPlanos(planosDb);
            }
          }
        } catch (errPlanos) {
          console.warn("Aviso ao carregar planos do banco:", errPlanos);
        }

        // 4. Calcula o plano recomendado para NÃO haver perda de dados
        let recId = 'plano_basico';
        if (qtdEstoque > 500) {
          recId = 'plano_plus';
        } else if (qtdEstoque > 150) {
          recId = 'plano_premium';
        } else {
          // Se já era Premium antes, prioriza manter o Premium
          if (uData.planoId === 'plano_premium' || uData.plano === 'premium') {
            recId = 'plano_premium';
          } else if (uData.planoId === 'plano_plus') {
            recId = 'plano_plus';
          }
        }

        setPlanoRecomendadoId(recId);
        const planoInicial = planos.find(p => p.id === recId) || planos[1] || planos[0];
        setPlanoSelecionado(planoInicial);

      } catch (err) {
        console.error("Erro ao carregar dados para reativação:", err);
      } finally {
        setCarregando(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      setCarregando(true);
      await signOut(auth);
    } catch (e) {
      console.error("Erro no logout:", e);
    } finally {
      localStorage.removeItem('tenantId');
      localStorage.removeItem('funcName');
      localStorage.removeItem('userRole');
      navigate('/login', { replace: true });
    }
  };

  const handleProsseguirCheckout = () => {
    if (!planoSelecionado) return;
    navigate('/checkout', {
      state: {
        plano: planoSelecionado,
        isReativacao: true
      }
    });
  };

  if (carregando) {
    return (
      <div className="rc-loading-screen">
        <div className="rc-loading-spinner"></div>
        <p>Preparando seu raio-x de dados preservados...</p>
      </div>
    );
  }

  const nomeExibicao = dadosConta?.nomeExibicao || dadosConta?.nomeCompleto || usuario?.displayName || usuario?.email?.split('@')[0] || 'Cliente';
  const emailExibicao = dadosConta?.email || usuario?.email || '';

  // Análise de capacidade do plano selecionado
  const limiteDoPlano = planoSelecionado?.limiteAcervo ?? Infinity;
  const temExcesso = limiteDoPlano < totalEstoque;
  const qtdExcedente = temExcesso ? (totalEstoque - limiteDoPlano) : 0;

  return (
    <div className="rc-wrapper fade-in">
      <div className="rc-background-glow"></div>

      <div className="rc-container">
        
        {/* HEADER BRAND */}
        <header className="rc-header">
          <div className="rc-header-brand">
            <img src={logoImage} alt="Celebre Logo" className="rc-logo" />
            <div className="rc-brand-text">
              <h2>CELEBRE</h2>
              <span>Gestão Inteligente de Festas & Acervo</span>
            </div>
          </div>

          <div className="rc-header-actions">
            {/* SELETOR DOS 3 MODOS DE APARÊNCIA */}
            <div className="rc-theme-dropdown-wrap" ref={temaRef}>
              <button 
                type="button" 
                className="rc-btn-theme-toggle"
                onClick={() => setTemaMenuAberto(!temaMenuAberto)}
                title="Alternar Modo de Aparência (Claro, Grafite, Midnight)"
              >
                <span>{getTemaInfo().icone}</span>
                <span className="rc-theme-label">{getTemaInfo().rotulo}</span>
                <i className="fas fa-chevron-down"></i>
              </button>

              {temaMenuAberto && (
                <div className="rc-theme-menu fade-in">
                  <div className="rc-theme-menu-title">Aparência do Celebre</div>
                  <button 
                    type="button" 
                    className={`rc-theme-opt ${temaAtual === 'light' ? 'active' : ''}`}
                    onClick={() => selecionarTemaDireto('light')}
                  >
                    <span>☀️ Modo Claro (Clean Light)</span>
                    {temaAtual === 'light' && <i className="fas fa-check"></i>}
                  </button>
                  <button 
                    type="button" 
                    className={`rc-theme-opt ${(temaAtual === 'dark-gray' || (temaAtual === 'dark' && darkStyleState === 'gray')) ? 'active' : ''}`}
                    onClick={() => selecionarTemaDireto('dark-gray')}
                  >
                    <span>🪨 Escuro Cinza Grafite</span>
                    {(temaAtual === 'dark-gray' || (temaAtual === 'dark' && darkStyleState === 'gray')) && <i className="fas fa-check"></i>}
                  </button>
                  <button 
                    type="button" 
                    className={`rc-theme-opt ${(temaAtual === 'dark-midnight' || (temaAtual === 'dark' && darkStyleState === 'midnight')) ? 'active' : ''}`}
                    onClick={() => selecionarTemaDireto('dark-midnight')}
                  >
                    <span>🌙 Escuro Azul Midnight</span>
                    {(temaAtual === 'dark-midnight' || (temaAtual === 'dark' && darkStyleState === 'midnight')) && <i className="fas fa-check"></i>}
                  </button>
                </div>
              )}
            </div>

            <button type="button" className="rc-btn-logout-subtle" onClick={handleLogout}>
              <i className="fas fa-sign-out-alt"></i> Sair / Trocar Conta
            </button>
          </div>
        </header>

        {/* HERO BANNER DE BOAS-VINDAS */}
        <section className="rc-hero-card">
          <div className="rc-badge-welcome">
            <i className="fas fa-heart"></i> Bem-vindo(a) de volta!
          </div>

          <h1 className="rc-hero-title">
            Olá, <strong>{nomeExibicao}</strong>! Seus dados continuam intactos.
          </h1>

          <p className="rc-hero-subtitle">
            Conta associada: <span>{emailExibicao}</span>. Durante o período de inatividade, preservamos todo o acervo, clientes e histórico do seu negócio nos nossos servidores seguros.
          </p>

          {/* 📊 RAIO-X DOS DADOS PRESERVADOS (1 LINHA NO DESKTOP / 3 COLUNAS NO MOBILE) */}
          <div className="rc-preservation-kpis-grid">
            <div className="rc-kpi-item acervo">
              <div className="rc-kpi-icon">
                <i className="fas fa-boxes"></i>
              </div>
              <div className="rc-kpi-info">
                <span className="rc-kpi-value">{totalEstoque}</span>
                <span className="rc-kpi-label">Itens no Acervo com Fotos</span>
              </div>
            </div>

            <div className="rc-kpi-item clientes">
              <div className="rc-kpi-icon">
                <i className="fas fa-users"></i>
              </div>
              <div className="rc-kpi-info">
                <span className="rc-kpi-value">{totalClientes}</span>
                <span className="rc-kpi-label">Clientes Cadastrados</span>
              </div>
            </div>

            <div className="rc-kpi-item locacoes">
              <div className="rc-kpi-icon">
                <i className="fas fa-calendar-check"></i>
              </div>
              <div className="rc-kpi-info">
                <span className="rc-kpi-value">{totalLocacoes}</span>
                <span className="rc-kpi-label">Locações & Histórico</span>
              </div>
            </div>
          </div>

          <div className="rc-preservation-banner">
            <i className="fas fa-shield-alt"></i>
            <span>Seus cadastros, contratos e fotos permanecem guardados. Reative sua assinatura para desbloquear o painel instantaneamente.</span>
          </div>
        </section>

        {/* 🚀 O QUE HÁ DE NOVO NO CELEBRE (VITRINE DE REENGAJAMENTO) */}
        <section className="rc-news-section">
          <div className="rc-section-header">
            <span className="rc-section-tag">
              <i className="fas fa-sparkles"></i> Evolução da Plataforma
            </span>
            <h2>O que preparamos para você enquanto esteve fora</h2>
            <p>O Celebre foi atualizado com ferramentas de alto nível para tornar sua operação de festas ainda mais lucrativa:</p>
          </div>

          <div className="rc-news-grid">
            {ATUALIZACOES_SISTEMA.map((item) => (
              <div key={item.id} className="rc-news-card">
                <div className="rc-news-header">
                  <div className="rc-news-icon-wrap">
                    <i className={item.icone}></i>
                  </div>
                  <span className="rc-news-badge">{item.badge}</span>
                </div>
                <h3>{item.titulo}</h3>
                <p>{item.descricao}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 💎 SELEÇÃO DE PLANO & ANÁLISE DE CAPACIDADE DO ACERVO */}
        <section className="rc-plans-section">
          <div className="rc-section-header">
            <span className="rc-section-tag gold">
              <i className="fas fa-crown"></i> Escolha do Plano
            </span>
            <h2>Selecione o plano ideal para reativar seu negócio</h2>
            <p>Seus dados são preservados. Escolha o plano que melhor atende à quantidade atual do seu acervo:</p>
          </div>

          {/* GRID DE PLANOS */}
          <div className="rc-plans-grid">
            {planos.map((plano) => {
              const isSelected = planoSelecionado?.id === plano.id;
              const isRecomendado = plano.id === planoRecomendadoId;
              const comportaTotal = plano.limiteAcervo >= totalEstoque;

              return (
                <div 
                  key={plano.id}
                  className={`rc-plan-card ${isSelected ? 'selected' : ''} ${isRecomendado ? 'recommended' : ''}`}
                  onClick={() => setPlanoSelecionado(plano)}
                >
                  {isRecomendado && (
                    <div className="rc-ribbon-recommended">
                      <i className="fas fa-star"></i> RECOMENDADO PARA SEUS DADOS
                    </div>
                  )}

                  <div className="rc-plan-card-header">
                    <span className="rc-plan-category">Assinatura Mensal</span>
                    <h3 className="rc-plan-name">{plano.nome}</h3>
                    <p className="rc-plan-desc">{plano.descricao}</p>
                  </div>

                  <div className="rc-plan-price-box">
                    <span className="rc-price-cur">R$</span>
                    <span className="rc-price-val">{plano.preco}</span>
                    <span className="rc-price-period">/mês</span>
                  </div>

                  {/* STATUS DE COMPATIBILIDADE DE ACERVO */}
                  <div className={`rc-plan-capacity-pill ${comportaTotal ? 'ok' : 'warn'}`}>
                    {comportaTotal ? (
                      <><i className="fas fa-check-circle"></i> Comporta 100% do seu acervo ({totalEstoque} itens)</>
                    ) : (
                      <><i className="fas fa-exclamation-triangle"></i> Limite de {plano.limiteAcervo} itens (Você tem {totalEstoque})</>
                    )}
                  </div>

                  <ul className="rc-plan-features-list">
                    {plano.beneficios.map((b, bIdx) => (
                      <li key={bIdx}>
                        <i className="fas fa-check"></i>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>

                  <button 
                    type="button" 
                    className={`rc-btn-select-plan ${isSelected ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlanoSelecionado(plano);
                    }}
                  >
                    {isSelected ? (
                      <><i className="fas fa-check-circle"></i> Plano Selecionado</>
                    ) : (
                      'Escolher Este Plano'
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* ⚠️ ALERTA INTELIGENTE DE CAPACIDADE DE EXCESSO */}
          {temExcesso ? (
            <div className="rc-warning-surplus-box fade-in">
              <div className="rc-surplus-icon">
                <i className="fas fa-exclamation-triangle"></i>
              </div>
              <div className="rc-surplus-content">
                <h4>Atenção ao escolher o Plano {planoSelecionado.nome}:</h4>
                <p>
                  Seu acervo cadastrado possui <strong>{totalEstoque} itens</strong>, mas o Plano {planoSelecionado.nome} comporta até <strong>{planoSelecionado.limiteAcervo} itens</strong>.
                </p>
                <p className="rc-surplus-detail">
                  Ao reativar com este plano menor, você poderá movimentar e alugar normalmente os <strong>{planoSelecionado.limiteAcervo} primeiros itens</strong>. Os <strong>{qtdExcedente} itens excedentes</strong> não serão excluídos, mas permanecerão congelados/invisíveis no sistema até a contratação de um plano superior.
                </p>
                <div className="rc-surplus-action">
                  <button 
                    type="button" 
                    className="rc-btn-upgrade-recom"
                    onClick={() => {
                      const rec = planos.find(p => p.id === planoRecomendadoId) || planos[1];
                      setPlanoSelecionado(rec);
                    }}
                  >
                    <i className="fas fa-crown"></i> Trocar para o plano recomendado e manter 100% liberado
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rc-success-capacity-box fade-in">
              <i className="fas fa-check-circle"></i>
              <span>
                <strong>Excelente escolha!</strong> O Plano {planoSelecionado?.nome} libera integralmente todos os seus <strong>{totalEstoque} itens do acervo</strong>, contratos e clientes sem qualquer limitação.
              </span>
            </div>
          )}

          {/* 🚀 CALL TO ACTION PRINCIPAL: PROSSEGUIR PARA CHECKOUT */}
          <div className="rc-cta-container">
            <button 
              type="button" 
              className="rc-btn-proceed-checkout"
              onClick={handleProsseguirCheckout}
            >
              <span>
                <i className="fas fa-lock"></i> Reativar Acesso no Plano {planoSelecionado?.nome} (R$ {planoSelecionado?.preco}/mês)
              </span>
              <i className="fas fa-arrow-right"></i>
            </button>

            <p className="rc-cta-guarantee">
              <i className="fas fa-shield-alt"></i> Pagamento 100% seguro via Mercado Pago • Ativação imediata no PIX ou Cartão • Cancele quando quiser.
            </p>

            <div className="rc-support-channel">
              Dúvidas na escolha do plano? 
              <a 
                href={`https://wa.me/5519998564109?text=${encodeURIComponent(`Olá! Minha conta (${emailExibicao}) estava suspensa e gostaria de ajuda para escolher o melhor plano de reativação.`)}`}
                target="_blank" 
                rel="noopener noreferrer"
              >
                <i className="fab fa-whatsapp"></i> Falar com Suporte no WhatsApp
              </a>
            </div>
          </div>

        </section>

      </div>
    </div>
  );
};

export default ReativarConta;
