import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, getDocs, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore'; 
import { getAuth } from 'firebase/auth';
import Navbar from '../../components/Navbar'; 
import './Planos.css';

const Planos = () => {
  const [planos, setPlanos] = useState([]);
  const [recursosGlobais, setRecursosGlobais] = useState([]);
  const [loading, setLoading] = useState(true);
  const [faqAberto, setFaqAberto] = useState(null);
  const [mostrarTabelaDetalhada, setMostrarTabelaDetalhada] = useState(true);
  const [planoAtivoIdx, setPlanoAtivoIdx] = useState(1);
  const cardsScrollRef = React.useRef(null);
  const navigate = useNavigate();

  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  // 🔥 SISTEMA DE AUDITORIA (LOG DE INTENÇÃO DE UPGRADE)
  const registrarLog = async (acao, detalhes) => {
    if (!usuarioLogado) return;
    try {
      const nomeEquipa = localStorage.getItem('funcName') || usuarioLogado?.displayName || usuarioLogado?.email || "Equipe";
      await addDoc(collection(db, "logs_atividades"), {
        empresaId: tenantId,
        userId: tenantId,
        funcionarioId: usuarioLogado?.uid,
        nomeFuncionario: nomeEquipa,
        usuarioEmail: usuarioLogado?.email || "Desconhecido",
        acao: acao.toUpperCase(),
        detalhes: detalhes,
        dataHora: new Date().toISOString(),
        criadoEm: serverTimestamp()
      });
    } catch (error) {
      console.error("Erro ao gravar log de assinatura:", error);
    }
  };

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

  // Agrupamento semântico para a matriz comparativa detalhada
  const categoriasRecursos = [
    {
      categoria: "📦 Acervo, Estoque & Projetos",
      itens: ["Variedade Produtos", "Gestão de Estoque", "Emissão de Etiquetas", "Moodboard- Projeto Digital"]
    },
    {
      categoria: "📅 Locações, Atendimento & Clientes",
      itens: ["Gestão Clientes", "Gestão de Pedidos/ Orçamentos", "Agenda", "Catalago Digital"]
    },
    {
      categoria: "📝 Contratos & Jurídico",
      itens: ["Gestão de Contratos", "Assinatura Digital"]
    },
    {
      categoria: "💰 Financeiro, Logística & Suprimentos",
      itens: ["Gestão de Logística", "Gestão de Veículos", "Gestão Fornecedores", "Gestão Financeira", "Gestão de Relatórios"]
    },
    {
      categoria: "👥 Equipe & Colaboração",
      itens: ["Usuários"]
    }
  ];

  const faqs = [
    {
      pergunta: "Posso mudar de plano a qualquer momento?",
      resposta: "Sim! Você pode fazer upgrade ou migrar de plano quando quiser. O valor é ajustado proporcionalmente e seus dados permanecem intactos."
    },
    {
      pergunta: "Quais são as formas de pagamento aceitas?",
      resposta: "Aceitamos Cartão de Crédito em até 12x, PIX com aprovação e liberação imediata da conta, e Boleto Bancário via Mercado Pago."
    },
    {
      pergunta: "O que acontece com os meus dados se o teste expirar?",
      resposta: "Seus dados, fotos do acervo, clientes e contratos permanecem 100% seguros e guardados no sistema. Ao assinar qualquer plano, seu acesso completo é liberado instantaneamente."
    },
    {
      pergunta: "Existe período de fidelidade ou multa por cancelamento?",
      resposta: "Nenhuma fidelidade e nenhuma multa. Você pode cancelar sua assinatura a qualquer momento com apenas 1 clique direto no painel de configurações."
    },
    {
      pergunta: "O Celebre funciona em celular, tablet e computador?",
      resposta: "Sim! O Celebre é um sistema moderno 100% em nuvem. Você pode acessar do notebook, desktop, iPad, tablet ou celular em qualquer lugar, sem precisar instalar nada."
    }
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

        const destaqueIdx = planosData.findIndex(p => String(p.destaque) === "true");
        if (destaqueIdx !== -1) {
          setPlanoAtivoIdx(destaqueIdx);
        } else if (planosData.length > 0) {
          setPlanoAtivoIdx(0);
        }
      } catch (error) {
        console.error("Erro ao buscar planos:", error);
      } finally {
        setLoading(false);
      }
    };
    buscarPlanos();
  }, []);

  useEffect(() => {
    if (!loading && planos.length > 0 && cardsScrollRef.current) {
      const card = cardsScrollRef.current.children[planoAtivoIdx];
      if (card) {
        card.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
      }
    }
  }, [loading]);

  const handleScrollToPlano = (idx) => {
    if (idx < 0 || idx >= planos.length) return;
    setPlanoAtivoIdx(idx);
    if (cardsScrollRef.current) {
      const card = cardsScrollRef.current.children[idx];
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  };

  const handleCardsScroll = (e) => {
    const container = e.target;
    const scrollLeft = container.scrollLeft;
    const firstCard = container.children[0];
    if (firstCard) {
      const cardWidth = firstCard.offsetWidth + 16;
      if (cardWidth > 0) {
        const newIdx = Math.round(scrollLeft / cardWidth);
        if (newIdx >= 0 && newIdx < planos.length && newIdx !== planoAtivoIdx) {
          setPlanoAtivoIdx(newIdx);
        }
      }
    }
  };

  const handleSelecionarPlano = async (planoSelecionado) => {
    if (usuarioLogado) {
      await registrarLog("TENTATIVA DE ASSINATURA", `Iniciou o processo de checkout para o plano: "${planoSelecionado.nome}".`);
      navigate('/checkout', { state: { plano: planoSelecionado } });
    } else {
      navigate(`/cadastro?plano=${planoSelecionado.id}`);
    }
  };

  const toggleFaq = (index) => {
    setFaqAberto(faqAberto === index ? null : index);
  };

  if (loading) {
    return (
      <div className="planos-loading-wrapper">
        <div className="planos-loading-spinner"></div>
        <p>Carregando planos e benefícios do Celebre...</p>
      </div>
    );
  }

  return (
    <>
      {usuarioLogado && <Navbar />}

      <div className={`planos-public-wrapper ${usuarioLogado ? 'com-sidebar' : ''}`}>
        
        {/* HERO SECTION PREMIUM */}
        <header className="planos-hero">
          {usuarioLogado && (
            <button onClick={() => navigate('/dashboard')} className="btn-voltar-painel">
              <i className="fas fa-arrow-left"></i>
              <span>Voltar ao Painel</span>
            </button>
          )}

          <div className="planos-hero-badge">
            <i className="fas fa-crown"></i>
            <span>PLANOS TRANSPARENTES • CANCELE QUANDO QUISER</span>
          </div>

          <h1 className="planos-hero-title">
            Escolha o plano ideal para acelerar o seu acervo
          </h1>
          
          <p className="planos-hero-subtitle">
            Gerencie acervo, contratos digitais, logística, clientes e equipe em uma única plataforma moderna e inteligente.
          </p>

          {/* LETREIRO INTERATIVO ROTATIVO (MARQUEE TICKER) */}
          <div className="planos-letreiro-container" title="Passe o mouse ou toque para pausar">
            <div className="planos-letreiro-track">
              {/* Grupo 1 */}
              <div className="planos-letreiro-group">
                <div className="trust-pill">
                  <i className="fas fa-bolt"></i>
                  <span>Ativação Instantânea</span>
                </div>
                <div className="trust-pill">
                  <i className="fas fa-shield-alt"></i>
                  <span>Pagamento Seguro Mercado Pago</span>
                </div>
                <div className="trust-pill">
                  <i className="fab fa-whatsapp"></i>
                  <span>Suporte Dedicado</span>
                </div>
                <div className="trust-pill">
                  <i className="fas fa-check-double"></i>
                  <span>Sem Fidelidade ou Multas</span>
                </div>
                <div className="trust-pill">
                  <i className="fas fa-cloud"></i>
                  <span>100% em Nuvem</span>
                </div>
                <div className="trust-pill">
                  <i className="fas fa-lock"></i>
                  <span>Dados Criptografados</span>
                </div>
              </div>

              {/* Grupo 2 (Clone idêntico para rolagem infinita contínua sem quebras) */}
              <div className="planos-letreiro-group" aria-hidden="true">
                <div className="trust-pill">
                  <i className="fas fa-bolt"></i>
                  <span>Ativação Instantânea</span>
                </div>
                <div className="trust-pill">
                  <i className="fas fa-shield-alt"></i>
                  <span>Pagamento Seguro Mercado Pago</span>
                </div>
                <div className="trust-pill">
                  <i className="fab fa-whatsapp"></i>
                  <span>Suporte Dedicado</span>
                </div>
                <div className="trust-pill">
                  <i className="fas fa-check-double"></i>
                  <span>Sem Fidelidade ou Multas</span>
                </div>
                <div className="trust-pill">
                  <i className="fas fa-cloud"></i>
                  <span>100% em Nuvem</span>
                </div>
                <div className="trust-pill">
                  <i className="fas fa-lock"></i>
                  <span>Dados Criptografados</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* NAVEGAÇÃO / INDICADORES MOBILE (EM CIMA DO VALOR) */}
        <div className="planos-mobile-nav-bar">
          <button 
            type="button"
            className="btn-arrow-mobile"
            onClick={() => handleScrollToPlano(Math.max(0, planoAtivoIdx - 1))}
            disabled={planoAtivoIdx === 0}
            aria-label="Plano anterior"
          >
            <i className="fas fa-chevron-left"></i>
          </button>

          <div className="mobile-dots-wrapper">
            {planos.map((p, idx) => (
              <button
                key={p.id}
                type="button"
                className={`dot-indicator ${planoAtivoIdx === idx ? 'active' : ''}`}
                onClick={() => handleScrollToPlano(idx)}
                aria-label={`Ver plano ${p.nome}`}
              />
            ))}
          </div>

          <button 
            type="button"
            className="btn-arrow-mobile"
            onClick={() => handleScrollToPlano(Math.min(planos.length - 1, planoAtivoIdx + 1))}
            disabled={planoAtivoIdx === planos.length - 1}
            aria-label="Próximo plano"
          >
            <i className="fas fa-chevron-right"></i>
          </button>
        </div>

        {/* CARDS EM DESTAQUE (HERO CARDS) */}
        <div 
          className="planos-cards-grid"
          ref={cardsScrollRef}
          onScroll={handleCardsScroll}
        >
          {planos.map((p, idx) => {
            const isDestaque = String(p.destaque) === "true";
            const isSelected = planoAtivoIdx === idx;

            return (
              <div 
                key={p.id} 
                className={`plano-card ${isDestaque ? 'is-destaque' : ''} ${isSelected ? 'is-active-mobile' : ''}`}
                onClick={() => setPlanoAtivoIdx(idx)}
              >
                {isDestaque && (
                  <div className="plano-card-ribbon">
                    <i className="fas fa-star"></i> MAIS ESCOLHIDO
                  </div>
                )}

                <div className="plano-card-header">
                  <span className="plano-card-tipo">
                    {isDestaque ? 'Custo-Benefício VIP' : 'Assinatura Mensal'}
                  </span>
                  <h3 className="plano-card-nome">{p.nome}</h3>
                </div>

                <div className="plano-card-preco-box">
                  <span className="moeda">R$</span>
                  <span className="valor">{p.preco}</span>
                  <span className="periodo">/mês</span>
                </div>

                <button 
                  type="button"
                  className={`btn-card-assinar ${isDestaque ? 'btn-destaque' : ''}`}
                  onClick={() => handleSelecionarPlano(p)}
                >
                  <span>{usuarioLogado ? 'Assinar Este Plano' : 'Começar Agora'}</span>
                  <i className="fas fa-arrow-right"></i>
                </button>
              </div>
            );
          })}
        </div>

        {/* ABAIXO: TUDO O QUE ESTÁ INCLUSO NO PLANO SELECIONADO (COERÊNCIA TOTAL NO MOBILE) */}
        {planos[planoAtivoIdx] && (
          <div className="plano-mobile-features-box fade-in">
            <div className="mobile-features-header">
              <span className="features-badge-tipo">
                <i className="fas fa-shield-alt"></i> RECURSOS INCLUSOS
              </span>
              <h4>O que está incluso no <strong>{planos[planoAtivoIdx].nome}</strong>:</h4>
            </div>

            <div className="mobile-features-categories">
              {categoriasRecursos.map((cat, catIdx) => (
                <div key={catIdx} className="mobile-cat-group">
                  <div className="mobile-cat-header">
                    <span>{cat.categoria}</span>
                  </div>

                  <div className="mobile-cat-items-list">
                    {cat.itens.map((rec, itemIdx) => {
                      const numerico = isRecursoNumerico(rec);
                      const planoAtual = planos[planoAtivoIdx];
                      const valorLimite = planoAtual?.limites?.[rec];
                      const incluso = Array.isArray(planoAtual?.beneficios) && planoAtual.beneficios.includes(rec);

                      if (numerico) {
                        return (
                          <div key={itemIdx} className="mobile-feature-row has-limit">
                            <i className="fas fa-check-circle icon-ok"></i>
                            <span className="feature-title">{rec}</span>
                            <span className="feature-limit-tag">{valorLimite || 'Ilimitado'}</span>
                          </div>
                        );
                      }

                      return (
                        <div key={itemIdx} className={`mobile-feature-row ${incluso ? 'is-included' : 'not-included'}`}>
                          {incluso ? (
                            <i className="fas fa-check-circle icon-ok"></i>
                          ) : (
                            <i className="fas fa-minus-circle icon-no"></i>
                          )}
                          <span className="feature-title">{rec}</span>
                          {incluso ? (
                            <span className="feature-status-tag ok">Incluso</span>
                          ) : (
                            <span className="feature-status-tag no">Não incluso</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mobile-features-footer">
              <button 
                type="button" 
                className="btn-mobile-assinar-direto"
                onClick={() => handleSelecionarPlano(planos[planoAtivoIdx])}
              >
                <span>Assinar {planos[planoAtivoIdx].nome} • R$ {planos[planoAtivoIdx].preco}/mês</span>
                <i className="fas fa-arrow-right"></i>
              </button>
            </div>
          </div>
        )}

        {/* BOTÃO TOGGLE PARA VER/OCULTAR MATRIZ DETALHADA */}
        <div className="toggle-matriz-wrapper">
          <button 
            type="button" 
            className="btn-toggle-matriz"
            onClick={() => setMostrarTabelaDetalhada(!mostrarTabelaDetalhada)}
          >
            <i className={`fas ${mostrarTabelaDetalhada ? 'fa-compress-alt' : 'fa-list-check'}`}></i>
            <span>{mostrarTabelaDetalhada ? 'Ocultar Comparativo Detalhado' : 'Ver Comparativo Completo de Todos os Recursos'}</span>
            <i className={`fas fa-chevron-${mostrarTabelaDetalhada ? 'up' : 'down'}`}></i>
          </button>
        </div>

        {/* MATRIZ COMPARATIVA DETALHADA POR CATEGORIA */}
        {mostrarTabelaDetalhada && (
          <div className="matrix-public-container fade-in">
            <div className="matrix-header-info">
              <h3><i className="fas fa-sliders-h"></i> Comparativo Completo de Recursos</h3>
              <p>Confira todos os limites e funcionalidades detalhadas de cada categoria.</p>
            </div>

            <div className="matrix-table-scroll">
              <table className="matrix-public-table">
                <thead>
                  <tr>
                    <th className="th-recursos-public">
                      Funcionalidades por Categoria
                    </th>
                    {planos.map(p => (
                      <th key={p.id} className={`th-plano-public ${String(p.destaque) === "true" ? 'is-destaque' : ''}`}>
                        {String(p.destaque) === "true" && <span className="tag-destaque">MAIS ESCOLHIDO</span>}
                        <h4>{p.nome}</h4>
                        <button 
                          className="btn-tabela-assinar" 
                          onClick={() => handleSelecionarPlano(p)}
                        >
                          Escolher
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {categoriasRecursos.map((cat, catIdx) => {
                    return (
                      <React.Fragment key={catIdx}>
                        {/* Linha separadora de Categoria */}
                        <tr className="tr-categoria-header">
                          <td colSpan={planos.length + 1}>
                            <span className="categoria-titulo">{cat.categoria}</span>
                          </td>
                        </tr>

                        {cat.itens.map((rec, itemIdx) => {
                          const numerico = isRecursoNumerico(rec);

                          return (
                            <tr key={`${catIdx}-${itemIdx}`} className="tr-item-recurso">
                              <td className="td-recurso-nome">
                                <span>{rec}</span>
                              </td>
                              {planos.map(p => {
                                if (numerico) {
                                  const valorBanco = p.limites?.[rec];
                                  const valor = (valorBanco === undefined || valorBanco === "") ? "Ilimitado" : valorBanco;
                                  return (
                                    <td key={p.id} className="td-check-public td-valor-numerico">
                                      {valor}
                                    </td>
                                  );
                                } else {
                                  const tem = Array.isArray(p.beneficios) && p.beneficios.includes(rec);
                                  return (
                                    <td key={p.id} className="td-check-public">
                                      {tem ? (
                                        <span className="badge-check-sim">
                                          <i className="fas fa-check"></i>
                                        </span>
                                      ) : (
                                        <span className="badge-check-nao">
                                          <i className="fas fa-minus"></i>
                                        </span>
                                      )}
                                    </td>
                                  );
                                }
                              })}
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SEÇÃO DE PERGUNTAS FREQUENTES (FAQ ACCORDION) */}
        <section className="planos-faq-section">
          <div className="faq-header">
            <span className="faq-badge">DÚVIDAS FREQUENTES</span>
            <h2>Perguntas frequentes sobre os planos</h2>
            <p>Tudo o que você precisa saber antes de assinar.</p>
          </div>

          <div className="faq-accordion-grid">
            {faqs.map((faq, index) => (
              <div 
                key={index} 
                className={`faq-card ${faqAberto === index ? 'aberto' : ''}`}
                onClick={() => toggleFaq(index)}
              >
                <div className="faq-question">
                  <h4>{faq.pergunta}</h4>
                  <span className="faq-icon">
                    <i className={`fas fa-chevron-${faqAberto === index ? 'up' : 'down'}`}></i>
                  </span>
                </div>
                {faqAberto === index && (
                  <div className="faq-answer fade-in">
                    <p>{faq.resposta}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* BANNER FINAL DE ATENDIMENTO VIP */}
        <section className="planos-cta-banner">
          <div className="cta-banner-content">
            <div className="cta-banner-text">
              <h3>Precisa de um plano customizado para sua empresa?</h3>
              <p>Fale diretamente com nossa equipe de especialistas e monte uma proposta sob medida.</p>
            </div>
            <a 
              href="https://wa.me/5547997816172?text=Ol%C3%A1!%20Gostaria%20de%20tirar%20d%C3%BAvidas%20sobre%20os%20planos%20do%20Celebre." 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn-cta-whatsapp"
            >
              <i className="fab fa-whatsapp"></i>
              <span>Falar no WhatsApp</span>
            </a>
          </div>
        </section>

      </div>
    </>
  );
};

export default Planos;