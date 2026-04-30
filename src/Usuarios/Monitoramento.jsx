import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useNavigate } from 'react-router-dom';

const Monitoramento = () => {
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const navigate = useNavigate();

  const [atividades, setAtividades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroFuncionario, setFiltroFuncionario] = useState('Todos');
  const [equipe, setEquipe] = useState([]);

  useEffect(() => {
    if (!usuarioLogado) {
      navigate('/login');
      return;
    }
    carregarDados();
  }, [usuarioLogado, navigate]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // 1. Busca a lista de funcionários para montar o filtro (Select)
      const qEquipe = query(collection(db, "equipe"), where("empresaId", "==", usuarioLogado.uid));
      const snapEquipe = await getDocs(qEquipe);
      const listaEquipe = snapEquipe.docs.map(doc => ({ id: doc.id, nome: doc.data().nome }));
      setEquipe(listaEquipe);

      // 2. Busca todas as atividades registradas no banco de dados para esta empresa
      const qAtividades = query(
        collection(db, "logs_atividades"), 
        where("empresaId", "==", usuarioLogado.uid),
        orderBy("dataHora", "desc") // Do mais recente para o mais antigo
      );
      
      const snapAtividades = await getDocs(qAtividades);
      const listaAtividades = snapAtividades.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAtividades(listaAtividades);

    } catch (error) {
      console.error("Erro ao carregar monitoramento:", error);
    } finally {
      setLoading(false);
    }
  };

  // Função para formatar a data e hora bonitinha
  const formatarDataHora = (isoString) => {
    const data = new Date(isoString);
    return data.toLocaleDateString('pt-BR') + ' às ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  // Aplica o filtro na lista caso a dona queira ver apenas as ações do "João", por exemplo
  const atividadesFiltradas = filtroFuncionario === 'Todos' 
    ? atividades 
    : atividades.filter(ativ => ativ.funcionarioId === filtroFuncionario);

  if (loading) return <div style={{ padding: '50px', textAlign: 'center', color: '#64748b' }}>Buscando registros de atividades...</div>;

  return (
    <div className="estoque-premium">
      <div className="header-top">
        <div className="titulo-bloco">
          <h1>Monitoramento de Atividades</h1>
          <p>Acompanhe em tempo real as ações da sua equipe no sistema.</p>
        </div>
        
        {/* 🔥 BOTÃO DE VOLTAR ADICIONADO AQUI 🔥 */}
        <div className="acoes-top" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          
          <button 
            onClick={() => navigate('/usuarios')}
            style={{ background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', padding: '10px 15px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}
          >
            <i className="fas fa-arrow-left"></i> Voltar para Equipe
          </button>

          <select 
            value={filtroFuncionario} 
            onChange={(e) => setFiltroFuncionario(e.target.value)}
            style={{ padding: '10px 15px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', cursor: 'pointer', background: '#fff', color: '#0f172a', fontWeight: 'bold' }}
          >
            <option value="Todos">Todos os Funcionários</option>
            {equipe.map(func => (
              <option key={func.id} value={func.id}>{func.nome}</option>
            ))}
          </select>

        </div>
      </div>

      <div className="table-container" style={{ marginTop: '20px' }}>
        <table className="table-pro" style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', borderRadius: '8px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
              <th style={{ padding: '15px 20px', textAlign: 'left', width: '20%' }}>DATA E HORA</th>
              <th style={{ padding: '15px', textAlign: 'left', width: '25%' }}>FUNCIONÁRIO</th>
              <th style={{ padding: '15px', textAlign: 'left', width: '15%' }}>AÇÃO</th>
              <th style={{ padding: '15px', textAlign: 'left', width: '40%' }}>DETALHES</th>
            </tr>
          </thead>
          <tbody>
            {atividadesFiltradas.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                  <i className="fas fa-search" style={{ fontSize: '24px', marginBottom: '10px', display: 'block' }}></i>
                  Nenhuma atividade registrada ainda.
                </td>
              </tr>
            ) : (
              atividadesFiltradas.map(atividade => (
                <tr key={atividade.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '15px 20px', fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
                    {formatarDataHora(atividade.dataHora)}
                  </td>
                  <td style={{ padding: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '28px', height: '28px', backgroundColor: '#e2e8f0', color: '#475569', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '11px' }}>
                        {atividade.nomeFuncionario.charAt(0).toUpperCase()}
                      </div>
                      <strong style={{ color: '#0f172a', fontSize: '13px' }}>{atividade.nomeFuncionario}</strong>
                    </div>
                  </td>
                  <td style={{ padding: '15px' }}>
                    <span style={{ 
                      background: atividade.tipo === 'LOGIN' ? '#dbeafe' : atividade.tipo === 'EDICAO' ? '#fef3c7' : atividade.tipo === 'EXCLUSAO' ? '#fee2e2' : '#f1f5f9', 
                      color: atividade.tipo === 'LOGIN' ? '#1e40af' : atividade.tipo === 'EDICAO' ? '#92400e' : atividade.tipo === 'EXCLUSAO' ? '#991b1b' : '#475569', 
                      padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' 
                    }}>
                      {atividade.acao}
                    </span>
                  </td>
                  <td style={{ padding: '15px', fontSize: '13px', color: '#334155' }}>
                    {atividade.detalhes}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Monitoramento;