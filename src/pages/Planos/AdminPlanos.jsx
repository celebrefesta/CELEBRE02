import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import './AdminPlanos.css';

const AdminPlanos = () => {
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [recursos, setRecursos] = useState([]);
  const [planoAtivoMobileIdx, setPlanoAtivoMobileIdx] = useState(0);
  const navigate = useNavigate();

  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const registrarLog = async (acao, detalhes) => {
    if (!usuarioLogado) return;
    try {
      const nomeEquipa = localStorage.getItem('funcName') || usuarioLogado?.displayName || usuarioLogado?.email || "Administrador Master";
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
      console.error("Erro ao gravar log da matriz de planos:", error);
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

  const categoriasRecursosDefinidas = [
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

  const carregarDados = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "planos"), orderBy("ordem", "asc"));
      const snap = await getDocs(q);
      const planosCarregados = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const recursosEncontrados = new Set(recursosPadrao);

      planosCarregados.forEach(p => {
        if (Array.isArray(p.beneficios)) {
          p.beneficios.forEach(b => recursosEncontrados.add(b));
        }
        if (p.limites) {
          Object.keys(p.limites).forEach(l => recursosEncontrados.add(l));
        }
      });

      setRecursos(Array.from(recursosEncontrados));
      setPlanos(planosCarregados);
      const destaqueIdx = planosCarregados.findIndex(p => String(p.destaque) === "true");
      if (destaqueIdx !== -1) {
        setPlanoAtivoMobileIdx(destaqueIdx);
      } else if (planosCarregados.length > 0) {
        setPlanoAtivoMobileIdx(0);
      }
    } catch (error) {
      console.error("Erro ao carregar matriz de planos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const mudarOrdem = (planoId, novaOrdem) => {
    setPlanos(planosAtuais => {
      const planoAlterado = planosAtuais.find(p => p.id === planoId);
      const ordemAntiga = Number(planoAlterado.ordem);

      return planosAtuais.map(p => {
        if (p.id === planoId) return { ...p, ordem: novaOrdem };
        if (Number(p.ordem) === novaOrdem) return { ...p, ordem: ordemAntiga };
        return p;
      });
    });
  };

  const updateLocalPlano = (id, campo, valor) => {
    setPlanos(planos.map(p => p.id === id ? { ...p, [campo]: valor } : p));
  };

  const toggleBeneficio = (planoId, recursoNome) => {
    setPlanos(planos.map(p => {
      if (p.id === planoId) {
        const beneficiosArray = Array.isArray(p.beneficios) ? p.beneficios : [];
        const existe = beneficiosArray.includes(recursoNome);
        const novosBen = existe
          ? beneficiosArray.filter(b => b !== recursoNome)
          : [...beneficiosArray, recursoNome];
        return { ...p, beneficios: novosBen };
      }
      return p;
    }));
  };

  const atualizarLimite = (planoId, recursoNome, valor) => {
    setPlanos(planos.map(p => {
      if (p.id === planoId) {
        const novosLimites = { ...(p.limites || {}) };
        novosLimites[recursoNome] = valor;
        return { ...p, limites: novosLimites };
      }
      return p;
    }));
  };

  const atualizarNomeRecurso = (oldName, newName) => {
    const nomeLimpo = newName.trim();
    if (oldName === nomeLimpo || nomeLimpo === '') return;

    if (recursos.includes(nomeLimpo)) {
      alert("Esta funcionalidade já existe na matriz.");
      return;
    }

    setRecursos(recursos.map(r => r === oldName ? nomeLimpo : r));

    setPlanos(planos.map(p => {
      const novoPlano = { ...p };
      if (Array.isArray(novoPlano.beneficios)) {
        novoPlano.beneficios = novoPlano.beneficios.map(b => b === oldName ? nomeLimpo : b);
      }
      if (novoPlano.limites && novoPlano.limites[oldName] !== undefined) {
        novoPlano.limites[nomeLimpo] = novoPlano.limites[oldName];
        delete novoPlano.limites[oldName];
      }
      return novoPlano;
    }));
  };

  const adicionarPlano = async () => {
    const novo = {
      nome: "Novo Plano",
      preco: "0,00",
      descricao: "",
      ordem: planos.length + 1,
      destaque: false,
      beneficios: [],
      limites: {}
    };

    try {
      const docRef = await addDoc(collection(db, "planos"), novo);
      await registrarLog("NOVO PLANO CRIADO", `Adicionou um novo plano à matriz.`);
      setPlanos([...planos, { id: docRef.id, ...novo }]);
    } catch (e) {
      alert("Erro ao adicionar plano: " + e.message);
    }
  };

  const deletarPlano = async (id) => {
    const planoParaDeletar = planos.find(p => p.id === id);
    const nomePlano = planoParaDeletar ? planoParaDeletar.nome : "Desconhecido";

    if (window.confirm(`Atenção: Excluir permanentemente o plano "${nomePlano}"?`)) {
      try {
        await deleteDoc(doc(db, "planos", id));
        await registrarLog("EXCLUSÃO DE PLANO", `Excluiu o plano "${nomePlano}".`);
        setPlanos(planos.filter(p => p.id !== id));
      } catch (e) {
        alert("Erro ao excluir plano: " + e.message);
      }
    }
  };

  const adicionarRecurso = () => {
    const nome = prompt("Digite o nome da nova funcionalidade:");
    if (!nome || !nome.trim()) return;
    const nomeLimpo = nome.trim();
    if (!recursos.includes(nomeLimpo)) {
      setRecursos([...recursos, nomeLimpo]);
    } else {
      alert("Esta funcionalidade já existe.");
    }
  };

  const deletarRecurso = (recursoNome) => {
    if (window.confirm(`Remover a funcionalidade "${recursoNome}" da matriz?`)) {
      setRecursos(recursos.filter(r => r !== recursoNome));
      setPlanos(planos.map(p => {
        const novoPlano = { ...p };
        if (Array.isArray(novoPlano.beneficios)) {
          novoPlano.beneficios = novoPlano.beneficios.filter(b => b !== recursoNome);
        }
        if (novoPlano.limites) {
          delete novoPlano.limites[recursoNome];
        }
        return novoPlano;
      }));
    }
  };

  const salvarTudo = async () => {
    setSalvando(true);
    try {
      for (const plano of planos) {
        const { id, ...dados } = plano;
        await updateDoc(doc(db, "planos", id), {
          ...dados,
          ordem: Number(dados.ordem),
          destaque: String(dados.destaque) === "true",
          limites: dados.limites || {}
        });
      }

      await registrarLog("ATUALIZAÇÃO DE MATRIZ DE PLANOS", `Salvou alterações nos preços, limites ou recursos dos planos.`);
      alert("✅ Matriz de Planos atualizada com sucesso! Os novos valores e recursos já estão ativos na página pública de planos e no checkout.");
    } catch (e) {
      console.error("Erro ao salvar:", e);
      alert("Erro ao salvar matriz: " + e.message);
    } finally {
      setSalvando(false);
    }
  };

  // Organiza categorias semânticas para a matriz
  const categoriasOrganizadas = categoriasRecursosDefinidas.map(cat => ({
    categoria: cat.categoria,
    itens: cat.itens.filter(item => recursos.includes(item))
  }));

  // Itens extras que foram adicionados manualmente
  const itensDefinidos = new Set(categoriasRecursosDefinidas.flatMap(c => c.itens));
  const itensExtras = recursos.filter(r => !itensDefinidos.has(r));
  if (itensExtras.length > 0) {
    categoriasOrganizadas.push({
      categoria: "✨ Recursos Adicionais Personalizados",
      itens: itensExtras
    });
  }

  if (loading) {
    return (
      <div className="admin-planos-loading">
        <div className="admin-planos-spinner"></div>
        <p>Carregando matriz de planos do Celebre Master...</p>
      </div>
    );
  }

  return (
    <div className="admin-planos-wrapper">
        
        {/* HERO SECTION DE EDIÇÃO */}
        <header className="admin-planos-hero">
          <div className="admin-hero-top-nav">
            <button onClick={() => navigate('/gestao-usuarios')} className="btn-voltar-master">
              <i className="fas fa-arrow-left"></i>
              <span>Painel Master</span>
            </button>

            <div className="admin-hero-badge">
              <i className="fas fa-crown"></i>
              <span>PAINEL MASTER • EDITOR DE PLANOS</span>
            </div>

            <button onClick={() => navigate('/planos')} className="btn-ver-publico">
              <i className="fas fa-external-link-alt"></i>
              <span>Ver Vitrine Pública</span>
            </button>
          </div>

          <h1 className="admin-hero-title">
            Gestão da Matriz de Planos & Preços
          </h1>
          
          <p className="admin-hero-subtitle">
            Edite os nomes, valores, limites e recursos dos planos. As alterações são sincronizadas em tempo real com a vitrine pública e o checkout.
          </p>

          <div className="admin-hero-actions">
            <button className="btn-action-add" onClick={adicionarPlano}>
              <i className="fas fa-plus"></i>
              <span>+ Novo Plano</span>
            </button>
            <button className="btn-action-add-rec" onClick={adicionarRecurso}>
              <i className="fas fa-layer-group"></i>
              <span>+ Nova Funcionalidade</span>
            </button>
            <button className="btn-action-save" onClick={salvarTudo} disabled={salvando}>
              <i className={`fas ${salvando ? 'fa-spinner fa-spin' : 'fa-cloud-upload-alt'}`}></i>
              <span>{salvando ? 'Salvando...' : 'SALVAR MATRIZ NA NUVEM'}</span>
            </button>
          </div>
        </header>

        {/* CARDS EM DESTAQUE EDITÁVEIS (PADRÃO LUXURY PLANOS) */}
        <div className="admin-cards-grid">
          {planos.map(p => {
            const isDestaque = String(p.destaque) === "true";
            const numBeneficios = Array.isArray(p.beneficios) ? p.beneficios.length : 0;

            return (
              <div 
                key={p.id} 
                className={`admin-card ${isDestaque ? 'is-destaque' : ''}`}
              >
                {isDestaque && (
                  <div className="admin-card-ribbon">
                    <i className="fas fa-star"></i> MAIS ESCOLHIDO
                  </div>
                )}

                {/* BARRA SUPERIOR DE CONTROLE DO PLANO */}
                <div className="admin-card-top-control">
                  <div className="pos-badge">
                    <span className="ctrl-tag-label">ORDEM:</span>
                    <select 
                      value={p.ordem} 
                      onChange={(e) => mudarOrdem(p.id, Number(e.target.value))}
                      title="Posição de exibição do plano"
                    >
                      {planos.map((_, i) => (
                        <option key={i + 1} value={i + 1}>{i + 1}º</option>
                      ))}
                    </select>
                  </div>

                  <div className="destaque-selector">
                    <i className="fas fa-star" style={{ color: isDestaque ? '#c5a059' : '#cbd5e1' }}></i>
                    <select 
                      value={String(p.destaque)} 
                      onChange={(e) => updateLocalPlano(p.id, 'destaque', e.target.value === 'true')}
                      title="Destacar como plano mais escolhido"
                    >
                      <option value="false">Padrão</option>
                      <option value="true">Destaque</option>
                    </select>
                  </div>

                  <button 
                    className="btn-trash-plano" 
                    title="Excluir este plano"
                    onClick={() => deletarPlano(p.id)}
                  >
                    <i className="fas fa-trash-alt"></i>
                  </button>
                </div>

                {/* TÍTULO EDITÁVEL LIMPO */}
                <div className="admin-card-header">
                  <span className="admin-card-tipo">
                    {isDestaque ? 'Custo-Benefício VIP' : 'Assinatura Mensal'}
                  </span>
                  <div className="admin-input-nome-wrapper">
                    <input 
                      className="admin-input-nome"
                      value={p.nome} 
                      onChange={(e) => updateLocalPlano(p.id, 'nome', e.target.value)}
                      placeholder="Nome do Plano"
                      title="Clique para editar o nome"
                    />
                  </div>
                </div>

                {/* PREÇO EDITÁVEL LIMPO */}
                <div className="admin-card-preco-box">
                  <span className="moeda">R$</span>
                  <input 
                    className="admin-input-preco"
                    style={{ width: `${Math.max(5, String(p.preco || '').length) * 26 + 6}px` }}
                    value={p.preco} 
                    onChange={(e) => updateLocalPlano(p.id, 'preco', e.target.value)}
                    placeholder="0,00"
                    title="Clique para alterar o valor mensal"
                  />
                  <span className="periodo">/mês</span>
                </div>

                {/* FAIXA DE METADADOS ELEGANTE */}
                <div className="admin-card-footer-strip">
                  <span className="admin-card-features-tag">
                    <i className="fas fa-check"></i> {numBeneficios} recursos
                  </span>
                  <span className="admin-card-status-tag">
                    <i className="fas fa-circle"></i> Mercado Pago
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* MATRIZ COMPARATIVA DETALHADA E EDITÁVEL */}
        <div className="admin-matrix-container">
          <div className="admin-matrix-header-info">
            <div className="admin-matrix-header-text">
              <h3><i className="fas fa-sliders-h"></i> Editor de Recursos e Limites por Categoria</h3>
              <p>Clique sobre os nomes para editar. Alterne os ícones para habilitar/desabilitar permissões.</p>
            </div>
            <div className="admin-matrix-header-actions">
              <button className="btn-add-func-inline" onClick={adicionarRecurso}>
                <i className="fas fa-plus"></i> + Nova Funcionalidade
              </button>
              <button className="btn-action-save-table" onClick={salvarTudo} disabled={salvando}>
                <i className={`fas ${salvando ? 'fa-spinner fa-spin' : 'fa-cloud-upload-alt'}`}></i>
                <span>{salvando ? 'Salvando...' : 'Salvar Alterações'}</span>
              </button>
            </div>
          </div>

          <div className="admin-matrix-table-scroll">
            <table className="admin-matrix-table">
              <thead>
                <tr>
                  <th className="th-recursos-admin">
                    <div className="th-recursos-title-box">
                      <span>Funcionalidades por Categoria</span>
                      <span className="th-recursos-total-badge">{recursos.length} itens</span>
                    </div>
                  </th>
                  {planos.map(p => (
                    <th key={p.id} className={`th-plano-admin ${String(p.destaque) === "true" ? 'is-destaque' : ''}`}>
                      {String(p.destaque) === "true" && <span className="tag-destaque-admin">★ MAIS ESCOLHIDO</span>}
                      <h4>{p.nome}</h4>
                      <div className="th-preco-mini-admin">
                        <span>R$</span> <strong>{p.preco}</strong><span>/mês</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {categoriasOrganizadas.map((cat, catIdx) => (
                  <React.Fragment key={catIdx}>
                    {/* Cabeçalho de Categoria */}
                    <tr className="tr-categoria-admin">
                      <td colSpan={planos.length + 1}>
                        <span className="categoria-titulo-admin">{cat.categoria}</span>
                      </td>
                    </tr>

                    {cat.itens.map((rec, itemIdx) => {
                      const numerico = isRecursoNumerico(rec);

                      return (
                        <tr key={`${catIdx}-${itemIdx}`} className="tr-item-admin">
                          <td className="td-recurso-admin">
                            <div className="recurso-edit-row">
                              <input 
                                className="recurso-nome-edit-input"
                                defaultValue={rec}
                                onBlur={(e) => atualizarNomeRecurso(rec, e.target.value)}
                                placeholder="Nome do Recurso"
                              />
                              <button 
                                className="btn-remover-recurso" 
                                title="Remover da matriz"
                                onClick={() => deletarRecurso(rec)}
                              >
                                <i className="fas fa-times"></i>
                              </button>
                            </div>
                          </td>

                          {planos.map(p => {
                            if (numerico) {
                              const valorLimite = p.limites?.[rec] || '';
                              return (
                                <td key={p.id} className="td-check-admin td-numerico-admin">
                                  <input 
                                    type="text" 
                                    className="input-limite-admin"
                                    placeholder="Ilimitado"
                                    value={valorLimite}
                                    title={valorLimite || "Ilimitado"}
                                    onChange={(e) => atualizarLimite(p.id, rec, e.target.value)}
                                  />
                                </td>
                              );
                            } else {
                              const tem = Array.isArray(p.beneficios) && p.beneficios.includes(rec);
                              return (
                                <td 
                                  key={p.id} 
                                  className="td-check-admin td-toggle-admin" 
                                  onClick={() => toggleBeneficio(p.id, rec)}
                                  title={`Clique para ${tem ? 'desativar' : 'ativar'} no plano ${p.nome}`}
                                >
                                  {tem ? (
                                    <span className="badge-check-sim-admin">
                                      <i className="fas fa-check"></i>
                                    </span>
                                  ) : (
                                    <span className="badge-check-nao-admin">
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
                ))}
              </tbody>
            </table>
          </div>

          {/* ============================================================== */}
          {/* 📱 SELETOR POR ABAS EXCLUSIVO PARA O CELULAR (100% LARGURA)   */}
          {/* ============================================================== */}
          <div className="admin-mobile-tabs-container">
            {/* Pílulas de Navegação dos Planos */}
            <div className="admin-mobile-plan-pills">
              {planos.map((p, idx) => {
                const isSelected = planoAtivoMobileIdx === idx;
                const isDestaque = String(p.destaque) === "true";
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`admin-mobile-plan-pill ${isSelected ? 'active' : ''} ${isDestaque ? 'is-destaque' : ''}`}
                    onClick={() => setPlanoAtivoMobileIdx(idx)}
                  >
                    {isDestaque && <span className="pill-star">★</span>}
                    <span className="pill-name">{p.nome}</span>
                    <span className="pill-price">R$ {p.preco}</span>
                  </button>
                );
              })}
            </div>

            {/* Conteúdo do Plano Ativo */}
            {planos[planoAtivoMobileIdx] && (() => {
              const planoAtual = planos[planoAtivoMobileIdx];
              return (
                <div className="admin-mobile-plan-panel">
                  {/* Cartão de Resumo do Plano Selecionado */}
                  <div className="admin-mobile-plan-banner">
                    <div className="banner-left">
                      <span className="banner-subtitle">Editando Recursos de:</span>
                      <h4 className="banner-title">{planoAtual.nome}</h4>
                    </div>
                    <div className="banner-right">
                      <span className="banner-currency">R$</span>
                      <strong className="banner-price">{planoAtual.preco}</strong>
                      <span className="banner-period">/mês</span>
                    </div>
                  </div>

                  {/* Categorias e Recursos em 100% da Largura da Tela */}
                  <div className="admin-mobile-categories-stack">
                    {categoriasOrganizadas.map((cat, catIdx) => (
                      <div key={catIdx} className="admin-mobile-cat-block">
                        <div className="admin-mobile-cat-banner">
                          <span>{cat.categoria}</span>
                        </div>

                        <div className="admin-mobile-features-group">
                          {cat.itens.map((rec, itemIdx) => {
                            const numerico = isRecursoNumerico(rec);
                            const temBeneficio = Array.isArray(planoAtual.beneficios) && planoAtual.beneficios.includes(rec);
                            const valorLimite = planoAtual.limites?.[rec] || '';

                            return (
                              <div key={`${catIdx}-${itemIdx}`} className={`admin-mobile-feature-card ${temBeneficio ? 'is-active-item' : ''}`}>
                                <div className="mobile-feature-header-row">
                                  <input 
                                    className="mobile-feature-name-field"
                                    defaultValue={rec}
                                    onBlur={(e) => atualizarNomeRecurso(rec, e.target.value)}
                                    placeholder="Nome do Recurso"
                                  />
                                  <button 
                                    type="button"
                                    className="btn-delete-feature-mobile" 
                                    title="Remover recurso"
                                    onClick={() => deletarRecurso(rec)}
                                  >
                                    <i className="fas fa-trash-alt"></i>
                                  </button>
                                </div>

                                <div className="mobile-feature-body-row">
                                  {numerico ? (
                                    <div className="mobile-limit-input-group">
                                      <span className="mobile-limit-tag">Limite:</span>
                                      <input 
                                        type="text" 
                                        className="mobile-limit-text-input"
                                        placeholder="Ex: Ilimitado, 1.000, 3 modelos..."
                                        value={valorLimite}
                                        title={valorLimite || "Ilimitado"}
                                        onChange={(e) => atualizarLimite(planoAtual.id, rec, e.target.value)}
                                      />
                                    </div>
                                  ) : (
                                    <button 
                                      type="button"
                                      className={`mobile-switch-button ${temBeneficio ? 'status-enabled' : 'status-disabled'}`}
                                      onClick={() => toggleBeneficio(planoAtual.id, rec)}
                                    >
                                      <span className="switch-dot">
                                        <i className={`fas ${temBeneficio ? 'fa-check' : 'fa-times'}`}></i>
                                      </span>
                                      <span className="switch-text">
                                        {temBeneficio ? 'Incluso no Plano' : 'Não Incluso'}
                                      </span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Ações Rápidas no Rodapé Mobile */}
                  <div className="admin-mobile-actions-dock">
                    <button type="button" className="btn-add-feature-dock" onClick={adicionarRecurso}>
                      <i className="fas fa-plus"></i> Nova Funcionalidade
                    </button>
                    <button type="button" className="btn-save-dock" onClick={salvarTudo} disabled={salvando}>
                      <i className={`fas ${salvando ? 'fa-spinner fa-spin' : 'fa-cloud-upload-alt'}`}></i>
                      <span>{salvando ? 'Salvando...' : 'Salvar Alterações'}</span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

      </div>
  );
};

export default AdminPlanos;