import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../pages/Estoque/Estoque.css';
import { db } from '../firebaseConfig'; 
import { collection, getDocs, doc, query, where, getDoc, setDoc, updateDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const Usuarios = () => {
  const navigate = useNavigate();
  
  // 🔥 Autenticação e Chave Mestra
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [loading, setLoading] = useState(true);
  const [temAcesso, setTemAcesso] = useState(false);
  const [limiteUsuarios, setLimiteUsuarios] = useState(1);
  const [equipe, setEquipe] = useState([]);
  
  const [isPro, setIsPro] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  
  // NOVO ESTADO: Controla se estamos editando alguém existente
  const [editandoId, setEditandoId] = useState(null);
  
  const [novoUsuario, setNovoUsuario] = useState({
    nome: '',
    cpf: '',
    telefone: '',
    cargo: '',
    email: '',
    senhaTemp: '',
    monitorarAtividade: true, 
    permissoes: {
      agenda: false,
      clientes: false,
      locacoes: false,
      estoque: false,
      compras: false,
      logistica: false,
      contratos: false,
      moodboard: false,
      catalogo: false
    }
  });

  // 🔥 SISTEMA DE AUDITORIA (ESPIÃO CORPORATIVO DE RH)
  const registrarLog = async (acao, detalhes) => {
    try {
      const nomeEquipe = localStorage.getItem('funcName') || usuarioLogado?.displayName || usuarioLogado?.email || "Admin";
      
      await addDoc(collection(db, "logs_atividades"), {
        data: new Date(),
        criadoEm: serverTimestamp(),
        funcionario: nomeEquipe,
        usuarioNome: nomeEquipe,
        usuarioEmail: usuarioLogado?.email || "Desconhecido",
        acao: acao.toUpperCase(),
        detalhes: detalhes,
        userId: tenantId, // 🎯 SALVA VINCULADO À EMPRESA
        empresaId: tenantId,
        funcionarioId: usuarioLogado?.uid
      });
    } catch (error) {
      console.error("Erro ao gravar log de usuários:", error);
    }
  };

  useEffect(() => {
    if (!usuarioLogado) {
      navigate('/login');
      return;
    }
    carregarDadosDaConta();
  }, [usuarioLogado, navigate, tenantId]);

  const carregarDadosDaConta = async () => {
    setLoading(true);
    try {
      // 🔥 Puxa os dados do plano da EMPRESA (tenantId) e não de quem está logado
      const userRef = doc(db, 'usuarios', tenantId);
      const userSnap = await getDoc(userRef);
      
      let acessoLiberado = false;
      let limite = 1;
      let planoEhPro = false;
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        
        if (userData.plano === 'pago' || userData.statusPagamentoVulso === 'pago' || userData.statusAssinatura === 'ativa') {
          if (userData.planoId) {
            const planoSnap = await getDoc(doc(db, "planos", userData.planoId));
            
            if (planoSnap.exists()) {
              const nomePlano = planoSnap.data().nome?.toLowerCase() || '';
              
              if (nomePlano.includes('premium')) {
                limite = 3;
                acessoLiberado = true;
                planoEhPro = false;
              } else if (nomePlano.includes('pro')) {
                limite = 5;
                acessoLiberado = true;
                planoEhPro = true;
              }
            }
          }
        }
      }

      setTemAcesso(acessoLiberado);
      setLimiteUsuarios(limite);
      setIsPro(planoEhPro);

      if (acessoLiberado) {
        // 🔥 Puxa a equipe vinculada à EMPRESA (tenantId)
        const qEquipe = query(collection(db, "equipe"), where("empresaId", "==", tenantId));
        const snapEquipe = await getDocs(qEquipe);
        const listaEquipe = snapEquipe.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setEquipe(listaEquipe);
      }

    } catch (error) {
      console.error("Erro ao carregar equipe:", error);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 MÁSCARA AUTOMÁTICA DE NOME (Primeira letra maiúscula)
  const handleNomeChange = (e) => {
    const valor = e.target.value;
    const formatado = valor.split(' ').map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1)).join(' ');
    setNovoUsuario({ ...novoUsuario, nome: formatado });
  };

  // 🔥 MÁSCARA AUTOMÁTICA DE CPF
  const handleCpfChange = (e) => {
    let valor = e.target.value.replace(/\D/g, ""); // Remove tudo que não for número
    if (valor.length <= 11) {
      valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
      valor = valor.replace(/(\d{3})(\d)/, "$1.$2");
      valor = valor.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    }
    setNovoUsuario({ ...novoUsuario, cpf: valor });
  };

  const handleCheckbox = (campo) => {
    setNovoUsuario(prev => ({
      ...prev,
      permissoes: {
        ...prev.permissoes,
        [campo]: !prev.permissoes[campo]
      }
    }));
  };

  // 🔥 FUNÇÃO PARA ABRIR O MODAL NO MODO CRIAÇÃO
  const abrirModalCriacao = () => {
    setEditandoId(null);
    setNovoUsuario({
      nome: '', 
      cpf: '', 
      telefone: '', 
      cargo: '', 
      email: '', 
      senhaTemp: '', 
      monitorarAtividade: true, 
      permissoes: { 
          agenda: false, 
          clientes: false, 
          locacoes: false, 
          estoque: false, 
          compras: false, 
          logistica: false, 
          contratos: false, 
          moodboard: false, 
          catalogo: false 
      }
    });
    setModalAberto(true);
  };

  // 🔥 FUNÇÃO PARA ABRIR O MODAL NO MODO EDIÇÃO
  const abrirModalEdicao = (membro) => {
    setEditandoId(membro.id);
    setNovoUsuario({
      nome: membro.nome || '',
      cpf: membro.cpf || '',
      telefone: membro.telefone || '',
      cargo: membro.cargo || '',
      email: membro.email || '',
      senhaTemp: membro.senhaTemporaria || '', // Mostra a senha temporária se ele ainda não tiver ativado a conta
      monitorarAtividade: membro.monitorarAtividade ?? true,
      permissoes: membro.permissoes || { 
          agenda: false, 
          clientes: false, 
          locacoes: false, 
          estoque: false, 
          compras: false, 
          logistica: false, 
          contratos: false, 
          moodboard: false, 
          catalogo: false 
      }
    });
    setModalAberto(true);
  };

  const salvarNovoUsuario = async (e) => {
    e.preventDefault();
    
    if (!novoUsuario.nome || !novoUsuario.email || (!novoUsuario.senhaTemp && !editandoId)) {
      alert("Nome, E-mail e Senha são obrigatórios!");
      return;
    }

    setSalvando(true);
    try {
      if (editandoId) {
        // --- MODO EDIÇÃO ---
        await updateDoc(doc(db, "equipe", editandoId), {
          nome: novoUsuario.nome,
          cpf: novoUsuario.cpf,
          telefone: novoUsuario.telefone,
          cargo: novoUsuario.cargo || "Funcionário",
          email: novoUsuario.email,
          senhaTemporaria: novoUsuario.senhaTemp,
          monitorarAtividade: novoUsuario.monitorarAtividade, 
          permissoes: novoUsuario.permissoes
        });
        
        await registrarLog("EDIÇÃO DE FUNCIONÁRIO", `Editou os dados ou permissões de ${novoUsuario.nome}.`);
        alert("Funcionário atualizado com sucesso!");
        
      } else {
        // --- MODO CRIAÇÃO ---
        if (equipe.length + 1 >= limiteUsuarios) {
            alert(`Limite atingido! Seu plano permite ${limiteUsuarios} usuários no total.`);
            setSalvando(false);
            return;
        }
        
        const novoId = doc(collection(db, "equipe")).id;
        
        await setDoc(doc(db, "equipe", novoId), {
          nome: novoUsuario.nome,
          cpf: novoUsuario.cpf,
          telefone: novoUsuario.telefone,
          cargo: novoUsuario.cargo || "Funcionário",
          email: novoUsuario.email,
          senhaTemporaria: novoUsuario.senhaTemp, 
          monitorarAtividade: novoUsuario.monitorarAtividade, 
          permissoes: novoUsuario.permissoes,
          empresaId: tenantId, // 🔥 CADEADO CORPORATIVO DA EMPRESA
          criadoEm: new Date().toISOString()
        });
        
        await registrarLog("NOVO FUNCIONÁRIO", `Cadastrou ${novoUsuario.nome} (${novoUsuario.email}) com o cargo de ${novoUsuario.cargo || "Não definido"}.`);
        alert("Funcionário adicionado com sucesso!");
      }

      setModalAberto(false);
      setEditandoId(null);
      carregarDadosDaConta();
    } catch (error) {
      console.error("Erro ao salvar usuário:", error);
      alert("Erro ao salvar os dados do usuário.");
    } finally {
      setSalvando(false);
    }
  };

  const removerUsuario = async (id, nome) => {
    if (window.confirm(`Tem certeza que deseja remover permanentemente o acesso de ${nome}?`)) {
      await deleteDoc(doc(db, "equipe", id));
      await registrarLog("REMOÇÃO DE FUNCIONÁRIO", `Removeu o acesso do funcionário(a) ${nome}.`);
      carregarDadosDaConta();
    }
  };

  if (loading) return <div style={{ padding: '50px', textAlign: 'center', color: '#64748b' }}>Verificando permissões...</div>;

  if (!temAcesso) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', backgroundColor: '#f8fafc', minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', padding: '40px', borderRadius: '16px', border: '1px solid #e2e8f0', maxWidth: '500px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '48px', marginBottom: '15px' }}>👥</div>
          <h2 style={{ color: '#0f172a', marginBottom: '15px' }}>Gestão de Equipe Exclusiva</h2>
          <p style={{ color: '#64748b', lineHeight: '1.6', marginBottom: '25px' }}>
            O Plano Básico é ideal para empresas de 1 pessoa. Para convidar funcionários e delegar funções, faça um upgrade para o <strong>Premium</strong> ou <strong>Pro</strong>.
          </p>
          <button 
            onClick={() => navigate('/planos')} 
            style={{ background: '#0f172a', color: '#fff', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', border: 'none' }}
          >
            Fazer Upgrade Agora
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="estoque-premium">
      <div className="header-top">
        <div className="titulo-bloco">
          <h1>Equipe e Acessos</h1>
          <p>
            Gerencie o acesso e a jornada da sua equipe. 
            <strong style={{ color: (equipe.length + 1) >= limiteUsuarios ? '#ef4444' : '#10b981' }}>
              (Uso: {equipe.length + 1} de {limiteUsuarios} vagas)
            </strong>
          </p>
        </div>
        
        <div className="acoes-top" style={{ display: 'flex', gap: '15px' }}>
          <button 
            onClick={() => navigate('/monitoramento')}
            style={{ 
                background: '#f8fafc', 
                color: '#0f172a', 
                border: '1px solid #cbd5e1', 
                padding: '0 20px', 
                borderRadius: '8px', 
                fontWeight: 'bold', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                transition: 'all 0.2s' 
            }}
          >
            <i className="fas fa-desktop" style={{ color: '#c5a059' }}></i> Ver Monitoramento
          </button>

          <button 
            className="btn-dark-blue" 
            onClick={abrirModalCriacao}
            style={{ opacity: (equipe.length + 1) >= limiteUsuarios ? 0.6 : 1 }}
          >
            + Novo Funcionário
          </button>
        </div>
      </div>

      <div className="table-container" style={{ marginTop: '20px' }}>
        <table className="table-pro" style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
              <th style={{ padding: '15px 20px', textAlign: 'left' }}>COLABORADOR</th>
              <th style={{ padding: '15px', textAlign: 'left' }}>CARGO / FUNÇÃO</th>
              <th style={{ padding: '15px', textAlign: 'left', width: '35%' }}>PERMISSÕES ATIVAS</th>
              <th style={{ padding: '15px', textAlign: 'right' }}>AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {/* LINHA DO ADMINISTRADOR MASTER */}
            <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
              <td style={{ padding: '15px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ width: '40px', height: '40px', backgroundColor: '#c5a059', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                    AD
                  </div>
                  <div>
                    <strong style={{ color: '#0f172a', display: 'block' }}>Você (Admin)</strong>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>{usuarioLogado.email}</span>
                  </div>
                </div>
              </td>
              <td style={{ padding: '15px', fontSize: '13px', color: '#334155', fontWeight: 'bold' }}>
                Administração Geral
              </td>
              <td style={{ padding: '15px', color: '#10b981', fontWeight: 'bold', fontSize: '12px' }}>
                Acesso Total + Financeiro
              </td>
              <td style={{ padding: '15px', textAlign: 'right' }}>
                  <span style={{color: '#94a3b8', fontSize: '12px'}}>Inalterável</span>
              </td>
            </tr>

            {/* LISTAGEM DA EQUIPE */}
            {equipe.map(membro => {
              const semAcesso = !membro.permissoes?.agenda && !membro.permissoes?.clientes && !membro.permissoes?.estoque && !membro.permissoes?.locacoes && !membro.permissoes?.compras && !membro.permissoes?.logistica && !membro.permissoes?.contratos && !membro.permissoes?.catalogo && !(membro.permissoes?.moodboard && isPro);
              
              return (
              <tr key={membro.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '15px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ width: '40px', height: '40px', backgroundColor: '#e2e8f0', color: '#475569', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                      {membro.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <strong style={{ color: '#0f172a', display: 'block' }}>{membro.nome}</strong>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>{membro.email}</span>
                    </div>
                  </div>
                </td>
                
                <td style={{ padding: '15px', fontSize: '13px', color: '#475569' }}>
                    {membro.cargo || "Não definido"}
                    {membro.monitorarAtividade && (
                        <span style={{ display: 'block', fontSize: '10px', color: '#10b981', marginTop: '4px' }}>
                            <i className="fas fa-desktop"></i> Atividades Monitoradas
                        </span>
                    )}
                </td>
                
                <td style={{ padding: '15px' }}>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                        {membro.permissoes?.agenda && <span style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '10px', padding: '3px 6px', borderRadius: '4px'}}>Agenda</span>}
                        {membro.permissoes?.clientes && <span style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '10px', padding: '3px 6px', borderRadius: '4px'}}>Clientes</span>}
                        {membro.permissoes?.locacoes && <span style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '10px', padding: '3px 6px', borderRadius: '4px'}}>Locações</span>}
                        {membro.permissoes?.estoque && <span style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '10px', padding: '3px 6px', borderRadius: '4px'}}>Estoque</span>}
                        {membro.permissoes?.compras && <span style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '10px', padding: '3px 6px', borderRadius: '4px'}}>Compras</span>}
                        {membro.permissoes?.logistica && <span style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '10px', padding: '3px 6px', borderRadius: '4px'}}>Logística</span>}
                        {membro.permissoes?.contratos && <span style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '10px', padding: '3px 6px', borderRadius: '4px'}}>Contratos</span>}
                        {membro.permissoes?.catalogo && <span style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '10px', padding: '3px 6px', borderRadius: '4px'}}>Catálogo</span>}
                        {membro.permissoes?.moodboard && isPro && <span style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '10px', padding: '3px 6px', borderRadius: '4px'}}>Moodboard</span>}
                        {semAcesso && <span style={{ color: '#ef4444', fontSize: '11px' }}>Nenhum acesso</span>}
                    </div>
                </td>
                
                <td style={{ padding: '15px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button 
                      onClick={() => abrirModalEdicao(membro)}
                      style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                    >
                      Editar
                    </button>
                    <button 
                      onClick={() => removerUsuario(membro.id, membro.nome)}
                      style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                    >
                      Remover
                    </button>
                  </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      {/* MODAL DE CRIAÇÃO / EDIÇÃO */}
      {modalAberto && (
        <div className="modal-overlay-blur" style={{ zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.6)', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
          <div className="modal-maintenance-card" style={{ width: '100%', maxWidth: '850px', background: '#fff', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
            
            <div className="modal-maintenance-header" style={{ padding: '20px 25px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: '18px' }}>
                  {editandoId ? 'Editar Funcionário' : 'Ficha do Funcionário'}
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    Cadastre os dados, jornada de trabalho e defina o que ele pode acessar.
                </p>
              </div>
              <button 
                onClick={() => setModalAberto(false)} 
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#94a3b8' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={salvarNovoUsuario} style={{ padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                
                {/* LADO ESQUERDO: DADOS PESSOAIS */}
                <div>
                  <h4 style={{ fontSize: '13px', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #f1f5f9', paddingBottom: '8px', marginBottom: '15px' }}>
                    <i className="fas fa-id-card" style={{ marginRight: '8px', color: '#c5a059' }}></i> Dados Pessoais
                  </h4>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '5px' }}>NOME COMPLETO *</label>
                    <input 
                        required 
                        type="text" 
                        placeholder="Ex: João da Silva" 
                        value={novoUsuario.nome} 
                        onChange={handleNomeChange} 
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '5px' }}>CPF</label>
                      <input 
                        type="text" 
                        placeholder="000.000.000-00" 
                        value={novoUsuario.cpf} 
                        onChange={handleCpfChange} 
                        maxLength="14" 
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
                      />
                    </div>
          
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '5px' }}>TELEFONE / WHATSAPP</label>
                      <input 
                        type="text" 
                        placeholder="(00) 00000-0000" 
                        value={novoUsuario.telefone} 
                        onChange={e => setNovoUsuario({...novoUsuario, telefone: e.target.value})} 
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
                      />
                    </div>
                  </div>

                  <h4 style={{ fontSize: '13px', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #f1f5f9', paddingBottom: '8px', marginBottom: '15px', marginTop: '25px' }}>
                    <i className="fas fa-sign-in-alt" style={{ marginRight: '8px', color: '#c5a059' }}></i> Acesso ao Sistema
                  </h4>

                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '5px' }}>E-MAIL DO FUNCIONÁRIO (Login) *</label>
                    <input 
                        required 
                        type="email" 
                        placeholder="joao@suaempresa.com" 
                        value={novoUsuario.email} 
                        onChange={e => setNovoUsuario({...novoUsuario, email: e.target.value})} 
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '5px' }}>
                        {editandoId ? "SENHA INICIAL (Pode deixar em branco se não quiser alterar)" : "SENHA INICIAL *"}
                    </label>
                    <input 
                        required={!editandoId} 
                        type="text" 
                        placeholder="Crie uma senha provisória" 
                        value={novoUsuario.senhaTemp} 
                        onChange={e => setNovoUsuario({...novoUsuario, senhaTemp: e.target.value})} 
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
                    />
                  </div>
                </div>

                {/* LADO DIREITO: CARGO, MONITORAMENTO E PERMISSÕES */}
                <div>
                  <h4 style={{ fontSize: '13px', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #f1f5f9', paddingBottom: '8px', marginBottom: '15px' }}>
                    <i className="fas fa-briefcase" style={{ marginRight: '8px', color: '#c5a059' }}></i> RH & Atividades
                  </h4>

                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '5px' }}>CARGO / FUNÇÃO</label>
                    <input 
                        type="text" 
                        placeholder="Ex: Vendedor, Estoquista, Gerente..." 
                        value={novoUsuario.cargo} 
                        onChange={e => setNovoUsuario({...novoUsuario, cargo: e.target.value})} 
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} 
                    />
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '15px', marginBottom: '25px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={novoUsuario.monitorarAtividade} 
                        onChange={e => setNovoUsuario({...novoUsuario, monitorarAtividade: e.target.checked})} 
                        style={{ width: '18px', height: '18px', accentColor: '#0f172a' }} 
                      />
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a' }}>Ativar Monitoramento de Atividades</span>
                    </label>
                    <p style={{ margin: '8px 0 0 28px', fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
                      O sistema registrará automaticamente a hora de login, logout e todas as ações feitas por este usuário (edição de estoque, cadastro de clientes, etc).
                    </p>
                  </div>

                  <h4 style={{ fontSize: '13px', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #f1f5f9', paddingBottom: '8px', marginBottom: '15px' }}>
                    <i className="fas fa-lock" style={{ marginRight: '8px', color: '#c5a059' }}></i> Permissões de Acesso
                  </h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '15px' }}>
                    
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={novoUsuario.permissoes.agenda} onChange={() => handleCheckbox('agenda')} style={{ width: '16px', height: '16px' }} />
                      <span style={{ fontSize: '12px', color: '#334155' }}>Agenda</span>
                    </label>
                    
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={novoUsuario.permissoes.clientes} onChange={() => handleCheckbox('clientes')} style={{ width: '16px', height: '16px' }} />
                      <span style={{ fontSize: '12px', color: '#334155' }}>Clientes</span>
                    </label>
                  
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={novoUsuario.permissoes.locacoes} onChange={() => handleCheckbox('locacoes')} style={{ width: '16px', height: '16px' }} />
                      <span style={{ fontSize: '12px', color: '#334155' }}>Locações</span>
                    </label>
      
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={novoUsuario.permissoes.estoque} onChange={() => handleCheckbox('estoque')} style={{ width: '16px', height: '16px' }} />
                      <span style={{ fontSize: '12px', color: '#334155' }}>Estoque</span>
                    </label>
                    
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={novoUsuario.permissoes.compras} onChange={() => handleCheckbox('compras')} style={{ width: '16px', height: '16px' }} />
                      <span style={{ fontSize: '12px', color: '#334155' }}>Compras</span>
                    </label>
                    
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={novoUsuario.permissoes.logistica} onChange={() => handleCheckbox('logistica')} style={{ width: '16px', height: '16px' }} />
                      <span style={{ fontSize: '12px', color: '#334155' }}>Logística</span>
                    </label>
                    
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={novoUsuario.permissoes.contratos} onChange={() => handleCheckbox('contratos')} style={{ width: '16px', height: '16px' }} />
                      <span style={{ fontSize: '12px', color: '#334155' }}>Contratos</span>
                    </label>
                    
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={novoUsuario.permissoes.catalogo} onChange={() => handleCheckbox('catalogo')} style={{ width: '16px', height: '16px' }} />
                      <span style={{ fontSize: '12px', color: '#334155' }}>Catálogo</span>
                    </label>
                    
                    {isPro && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={novoUsuario.permissoes.moodboard} onChange={() => handleCheckbox('moodboard')} style={{ width: '16px', height: '16px' }} />
                        <span style={{ fontSize: '12px', color: '#334155' }}>Moodboard</span>
                      </label>
                    )}
                  </div>
                </div>

              </div>

              <div style={{ marginTop: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#fef2f2', padding: '10px 15px', borderRadius: '8px', width: '60%' }}>
                  <i className="fas fa-shield-alt" style={{ color: '#ef4444', fontSize: '18px' }}></i>
                  <p style={{ margin: 0, fontSize: '11px', color: '#b91c1c', lineHeight: '1.4' }}>
                    <strong>Acesso Restrito:</strong> Financeiro, Relatórios e Configurações da Empresa são bloqueados automaticamente para proteger os seus dados sigilosos.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', width: '35%' }}>
                  <button 
                    type="button" 
                    onClick={() => setModalAberto(false)} 
                    style={{ flex: 1, padding: '12px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', color: '#475569' }}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={salvando} 
                    style={{ flex: 1, padding: '12px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    {salvando ? 'Salvando...' : (editandoId ? 'Salvar Edição' : 'Cadastrar')}
                  </button>
                </div>

              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Usuarios;