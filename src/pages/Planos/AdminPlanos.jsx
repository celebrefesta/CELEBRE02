import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import Navbar from '../../components/Navbar';
import './AdminPlanos.css';

const AdminPlanos = () => {
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [recursos, setRecursos] = useState([]);
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
    <>
      <Navbar />

      <div className="admin-planos-wrapper com-sidebar">
        
        {/* HERO SECTION DE EDIÇÃO */}
        <header className="admin-planos-hero">
          <div className="admin-hero-top-nav">
            <button onClick={() => navigate('/gestao-usuarios')} className="btn-voltar-master">
              <i className="fas fa-arrow-left"></i>
              <span>Painel Master</span>
            </button>

            <button onClick={() => navigate('/planos')} className="btn-ver-publico">
              <i className="fas fa-external-link-alt"></i>
              <span>Ver Página Pública</span>
            </button>
          </div>

          <div className="admin-hero-badge">
            <i className="fas fa-tools"></i>
            <span>PAINEL MASTER • EDITOR DE PLANOS & ASSINATURAS</span>
          </div>

          <h1 className="admin-hero-title">
            Gestão da Matriz de Planos & Preços
          </h1>
          
          <p className="admin-hero-subtitle">
            Edite os nomes, valores, limites e funcionalidades dos planos. As alterações são sincronizadas em tempo real com a página de planos e com o checkout de pagamento.
          </p>

          <div className="admin-hero-actions">
            <button className="btn-action-add" onClick={adicionarPlano}>
              <i className="fas fa-plus-circle"></i> + Novo Plano
            </button>
            <button className="btn-action-add-rec" onClick={adicionarRecurso}>
              <i className="fas fa-list-ul"></i> + Nova Funcionalidade
            </button>
            <button className="btn-action-save" onClick={salvarTudo} disabled={salvando}>
              <i className={`fas ${salvando ? 'fa-spinner fa-spin' : 'fa-save'}`}></i>
              <span>{salvando ? 'A Salvar...' : 'SALVAR MATRIZ NA NUVEM'}</span>
            </button>
          </div>
        </header>

        {/* CARDS EM DESTAQUE EDITÁVEIS (MESMO LAYOUT DE PLANOS.JSX) */}
        <div className="admin-cards-grid">
          {planos.map(p => {
            const isDestaque = String(p.destaque) === "true";

            return (
              <div 
                key={p.id} 
                className={`admin-card ${isDestaque ? 'is-destaque' : ''}`}
              >
                {/* BARRA SUPERIOR DE CONTROLE DO PLANO */}
                <div className="admin-card-top-control">
                  <div className="pos-badge">
                    <span>ORDEM:</span>
                    <select 
                      value={p.ordem} 
                      onChange={(e) => mudarOrdem(p.id, Number(e.target.value))}
                    >
                      {planos.map((_, i) => (
                        <option key={i + 1} value={i + 1}>{i + 1}º</option>
                      ))}
                    </select>
                  </div>

                  <div className="destaque-selector">
                    <label>
                      <i className="fas fa-star" style={{ color: isDestaque ? '#c5a059' : '#94a3b8' }}></i>
                    </label>
                    <select 
                      value={String(p.destaque)} 
                      onChange={(e) => updateLocalPlano(p.id, 'destaque', e.target.value === 'true')}
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

                {isDestaque && (
                  <div className="admin-card-ribbon">
                    <i className="fas fa-star"></i> MAIS ESCOLHIDO
                  </div>
                )}

                {/* TÍTULO EDITÁVEL */}
                <div className="admin-card-header">
                  <span className="admin-card-tipo">
                    {isDestaque ? 'Custo-Benefício VIP' : 'Assinatura Mensal'}
                  </span>
                  <input 
                    className="admin-input-nome"
                    value={p.nome} 
                    onChange={(e) => updateLocalPlano(p.id, 'nome', e.target.value)}
                    placeholder="Nome do Plano"
                  />
                </div>

                {/* PREÇO EDITÁVEL */}
                <div className="admin-card-preco-box">
                  <span className="moeda">R$</span>
                  <input 
                    className="admin-input-preco"
                    value={p.preco} 
                    onChange={(e) => updateLocalPlano(p.id, 'preco', e.target.value)}
                    placeholder="0,00"
                  />
                  <span className="periodo">/mês</span>
                </div>

                {/* BADGE DE VÍNCULO */}
                <div className="admin-card-badge-status">
                  <i className="fas fa-check-circle"></i>
                  <span>Ativo • Vinculado ao Mercado Pago</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* MATRIZ COMPARATIVA DETALHADA E EDITÁVEL */}
        <div className="admin-matrix-container">
          <div className="admin-matrix-header-info">
            <div>
              <h3><i className="fas fa-sliders-h"></i> Editor de Recursos e Limites por Categoria</h3>
              <p>Clique sobre os nomes para editar. Alterne os ícones para habilitar/desabilitar permissões.</p>
            </div>
            <button className="btn-add-func-inline" onClick={adicionarRecurso}>
              + Nova Funcionalidade
            </button>
          </div>

          <div className="admin-matrix-table-scroll">
            <table className="admin-matrix-table">
              <thead>
                <tr>
                  <th className="th-recursos-admin">
                    Funcionalidades por Categoria
                  </th>
                  {planos.map(p => (
                    <th key={p.id} className={`th-plano-admin ${String(p.destaque) === "true" ? 'is-destaque' : ''}`}>
                      {String(p.destaque) === "true" && <span className="tag-destaque-admin">MAIS ESCOLHIDO</span>}
                      <h4>{p.nome}</h4>
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
        </div>

        {/* BARRA FLUTUANTE DE SALVAMENTO */}
        <div className="admin-bottom-bar">
          <div className="bottom-bar-content">
            <div className="bottom-bar-text">
              <i className="fas fa-cloud-upload-alt"></i>
              <span>Todas as alterações salvas aqui serão refletidas instantaneamente na página de planos e no checkout.</span>
            </div>
            <div className="bottom-bar-buttons">
              <button className="btn-bottom-add" onClick={adicionarPlano}>
                + Novo Plano
              </button>
              <button className="btn-bottom-save" onClick={salvarTudo} disabled={salvando}>
                <i className={`fas ${salvando ? 'fa-spinner fa-spin' : 'fa-save'}`}></i>
                <span>{salvando ? 'A Salvar...' : 'SALVAR MATRIZ NA NUVEM'}</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </>
  );
};

export default AdminPlanos;