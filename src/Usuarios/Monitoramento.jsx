import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore'; 
import { db } from '../firebaseConfig';
import { useNavigate } from 'react-router-dom';

const Monitoramento = () => {
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const navigate = useNavigate();

  // 🔥 CHAVE MESTRA: Pega o ID da empresa no navegador ou o do próprio usuário
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

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
  }, [usuarioLogado, navigate, tenantId]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // 1. Busca a lista de funcionários para montar o filtro (Select) vinculado à empresa
      const qEquipe = query(collection(db, "usuarios_equipe"), where("empresaId", "==", tenantId));
      const snapEquipe = await getDocs(qEquipe);
      const listaEquipe = snapEquipe.docs.map(doc => ({ id: doc.id, nome: doc.data().nome }));
      setEquipe(listaEquipe);

      // 2. 🔥 BUSCA INTELIGENTE: Puxa tanto por empresaId como por userId no cofre da empresa
      const qAtividadesEmpresa = query(collection(db, "logs_atividades"), where("empresaId", "==", tenantId));
      const qAtividadesUser = query(collection(db, "logs_atividades"), where("userId", "==", tenantId));
      const [snapEmpresa, snapUser] = await Promise.all([getDocs(qAtividadesEmpresa), getDocs(qAtividadesUser)]);
      
      // Usamos um Map para juntar as duas buscas e evitar que o mesmo log apareça duplicado
      const mapaAtividades = new Map();

      const processarDocs = (snap) => {
          snap.docs.forEach(doc => {
              const dataOriginal = doc.data();
              
              // 🔥 NORMALIZAÇÃO DE DATAS: Transforma qualquer data do espião no formato legível
              let dataHoraAjustada = dataOriginal.dataHora;
              
              if (!dataHoraAjustada) {
                  if (dataOriginal.data && typeof dataOriginal.data.toDate === 'function') {
                      dataHoraAjustada = dataOriginal.data.toDate().toISOString();
                  } else if (dataOriginal.criadoEm && typeof dataOriginal.criadoEm.toDate === 'function') {
                      dataHoraAjustada = dataOriginal.criadoEm.toDate().toISOString();
                  } else if (dataOriginal.data) {
                      dataHoraAjustada = new Date(dataOriginal.data).toISOString();
                  } else {
                      dataHoraAjustada = new Date().toISOString();
                  }
              }

              mapaAtividades.set(doc.id, {
                  id: doc.id,
                  ...dataOriginal,
                  dataHora: dataHoraAjustada,
                  // Tenta extrair o nome de todas as formas possíveis
                  nomeFuncionario: dataOriginal.nomeFuncionario || dataOriginal.funcionario || dataOriginal.usuarioNome || "Equipe",
                  acao: dataOriginal.acao || "AÇÃO DESCONHECIDA"
              });
          });
      };

      processarDocs(snapEmpresa);
      processarDocs(snapUser);

      // Converte o mapa de volta para uma lista
      const listaAtividades = Array.from(mapaAtividades.values());

      // 🔥 A MÁGICA: Ordenamos a lista do mais novo pro mais velho com a data correta
      listaAtividades.sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora));
      setAtividades(listaAtividades);

    } catch (error) {
      console.error("Erro ao carregar monitoramento:", error);
    } finally {
      setLoading(false);
    }
  };

  // Função para formatar a data e hora bonitinha, com blindagem a erros
  const formatarDataHora = (isoString) => {
    try {
        const data = new Date(isoString);
        if(isNaN(data.getTime())) return "Data Inválida";
        return data.toLocaleDateString('pt-BR') + ' às ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch(e) {
        return "Data Desconhecida";
    }
  };

  // Filtro
  const atividadesFiltradas = filtroFuncionario === 'Todos' 
    ? atividades 
    : atividades.filter(ativ => ativ.funcionarioId === filtroFuncionario);

  // Função centralizada para dar cores aos "Emblemas" (Badges) com base no texto da ação
  const obterEstiloBadge = (acao, tipo) => {
      const acaoUpper = String(acao).toUpperCase();
      if (tipo === 'LOGIN' || acaoUpper.includes('LOGIN')) return { bg: '#dbeafe', color: '#1e40af' }; // Azul
      if (tipo === 'EXCLUSAO' || acaoUpper.includes('EXCLU') || acaoUpper.includes('CANCEL')) return { bg: '#fee2e2', color: '#991b1b' }; // Vermelho
      if (tipo === 'EDICAO' || acaoUpper.includes('EDIÇÃO') || acaoUpper.includes('ATUALIZ')) return { bg: '#fef3c7', color: '#92400e' }; // Amarelo
      if (acaoUpper.includes('NOVA LOCAÇÃO') || acaoUpper.includes('PEDIDO') || acaoUpper.includes('ORÇAMENTO') || acaoUpper.includes('ESTOQUE')) return { bg: '#dcfce7', color: '#166534' }; // Verde Sucesso
      if (acaoUpper.includes('PAGAMENTO') || acaoUpper.includes('SINAL') || acaoUpper.includes('FINANCEIRO')) return { bg: '#cffafe', color: '#0891b2' }; // Ciano Dinheiro
      
      return { bg: '#f1f5f9', color: '#475569' }; // Cinza (Padrão)
  };

  if (loading) return <div style={{ padding: '50px', textAlign: 'center', color: '#64748b' }}>Buscando registros de atividades...</div>;

  return (
    <div className="estoque-premium">
      <div className="header-top">
        <div className="titulo-bloco">
          <h1>Monitoramento de Atividades</h1>
          <p>Acompanhe em tempo real as ações da sua equipe no sistema.</p>
        </div>
        
        <div className="acoes-top" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <button 
            onClick={() => navigate('/perfil')}
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
              atividadesFiltradas.map(atividade => {
                const estilos = obterEstiloBadge(atividade.acao, atividade.tipo);
                const inicial = atividade.nomeFuncionario ? atividade.nomeFuncionario.charAt(0).toUpperCase() : 'E';

                return (
                <tr key={atividade.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '15px 20px', fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
                    {formatarDataHora(atividade.dataHora)}
                  </td>
                  <td style={{ padding: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '28px', height: '28px', backgroundColor: '#e2e8f0', color: '#475569', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '11px' }}>
                        {inicial}
                      </div>
                      <strong style={{ color: '#0f172a', fontSize: '13px' }}>{atividade.nomeFuncionario}</strong>
                    </div>
                  </td>
                  <td style={{ padding: '15px' }}>
                    <span style={{ 
                      background: estilos.bg, 
                      color: estilos.color, 
                      padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' 
                    }}>
                      {atividade.acao}
                    </span>
                  </td>
                  <td style={{ padding: '15px', fontSize: '13px', color: '#334155' }}>
                    {atividade.detalhes}
                  </td>
                </tr>
              )})
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Monitoramento;