import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './Clientes.css';
import { db } from '../../firebaseConfig';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const HistoricoCliente = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // 🔥 Autenticação e Chave Mestra
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [cliente, setCliente] = useState(null);
  const [locacoes, setLocacoes] = useState([]);
  const [resumo, setResumo] = useState({ totalGasto: 0, contratosEmDia: 0, pendencias: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }

    const buscarDados = async () => {
      try {
        // 🔥 BLINDAGEM MULTI-EMPRESA: Busca o cliente (verificando permissão)
        const docRef = doc(db, "clientes", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().userId === tenantId) {
            setCliente({ id: docSnap.id, ...docSnap.data() });
        } else {
            alert("Cliente não encontrado ou acesso negado.");
            navigate('/clientes');
            return;
        }

        // 🔥 Busca as locações no cofre da empresa para este cliente
        const qLoc = query(collection(db, "locacoes"), where("userId", "==", tenantId));
        const snapLoc = await getDocs(qLoc);

        let locsCliente = [];
        let tGasto = 0;
        let cEmDia = 0;
        let tPendencias = 0;
        const hoje = new Date();
        hoje.setHours(0,0,0,0);

        snapLoc.docs.forEach(docSnapshot => {
            const loc = docSnapshot.data();
            if (loc.clienteId === id || loc?.cliente?.id === id) {
                locsCliente.push({ id: docSnapshot.id, ...loc });

                const status = String(loc.status || '').toLowerCase();
                if (!status.includes('cancelado') && !status.includes('orcam')) {
                    const vTotal = Number(loc.valorTotal || loc.total || 0);
                    const vPago = Number(loc.valorPago || 0);
                    tGasto += vTotal;

                    const dataStr = loc.dataRetirada || loc.dataEvento || loc.dataDevolucao;
                    const pagStatus = (loc.statusPagamento || '').toLowerCase();

                    if (dataStr) {
                        const dataEvento = new Date(dataStr + 'T00:00:00');
                        if (dataEvento < hoje && (vTotal - vPago) > 0.01 && !pagStatus.includes('pago') && !pagStatus.includes('quitado')) {
                            tPendencias += (vTotal - vPago);
                        } else {
                            cEmDia++;
                        }
                    } else {
                        cEmDia++;
                    }
                }
            }
        });

        locsCliente.sort((a, b) => {
            const dataA = a.dataRetirada ? new Date(a.dataRetirada).getTime() : 0;
            const dataB = b.dataRetirada ? new Date(b.dataRetirada).getTime() : 0;
            return dataB - dataA;
        });

        setLocacoes(locsCliente);
        setResumo({ totalGasto: tGasto, contratosEmDia: cEmDia, pendencias: tPendencias });
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    buscarDados();
  }, [id, usuarioLogado, navigate, tenantId]);

  if (loading) return <div className="loading-state" style={{padding: '30px', textAlign: 'center'}}>Buscando histórico financeiro...</div>;
  if (!cliente) return null;

  return (
    <div className="clientes-container dashboard-container">
      {/* Cabeçalho com botão Voltar */}
      <div className="dashboard-header">
        <div className="welcome-text">
          <h1>HISTÓRICO FINANCEIRO</h1>
          <p>Cliente: <strong>{cliente.nome || cliente.nomeFantasia}</strong></p>
        </div>
        <button 
          onClick={() => navigate('/clientes')} 
          className="btn-novo" 
          style={{background:'#64748b', cursor:'pointer'}}
        >
          ⬅ Voltar
        </button>
      </div>

      {/* Cartões de Resumo */}
      <div className="dashboard-cards" style={{marginBottom: '30px'}}>
            <div className="dash-card neutral">
                <div className="dash-info">
                  <h3 style={{color:'#64748b'}}>Total Gasto (LTV)</h3>
                  <h2 style={{color:'#0f233a'}}>R$ {resumo.totalGasto.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h2>
                </div>
            </div>
            
            <div className="dash-card success">
                <div className="dash-info">
                  <h3 style={{color:'#166534'}}>Em Dia / Concluídos</h3>
                  <h2 style={{color:'#15803d'}}>{resumo.contratosEmDia} Contratos</h2>
                </div>
            </div>
            
            <div className="dash-card danger">
                <div className="dash-info">
                  <h3 style={{color:'#991b1b'}}>Pendências / Dívidas</h3>
                  <h2 style={{color:'#dc2626'}}>R$ {resumo.pendencias.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h2>
                </div>
            </div>
      </div>

      <div className="table-responsive">
        {locacoes.length === 0 ? (
            <div style={{textAlign: 'center', padding: '40px', color: '#94a3b8', borderTop: '1px solid #f1f5f9'}}>
              <p style={{fontSize: '1.1rem'}}>📂 Nenhuma locação registrada.</p>
              <p style={{fontSize: '0.9rem'}}>As locações aparecerão aqui automaticamente quando você criar um contrato para este cliente.</p>
            </div>
        ) : (
            <table className="custom-table">
                <thead>
                    <tr>
                        <th>PEDIDO</th>
                        <th>DATA DO EVENTO</th>
                        <th>STATUS</th>
                        <th className="text-right">VALOR TOTAL</th>
                    </tr>
                </thead>
                <tbody>
                    {locacoes.map(loc => {
                        const st = String(loc.status || 'S/S').toLowerCase().replace(' ', '');
                        const isCancelado = st.includes('cancelado');
                        return (
                            <tr key={loc.id} onClick={() => navigate(`/locacoes/editar/${loc.id}`)} style={{cursor: 'pointer'}} className="table-row-hover">
                                <td style={{fontWeight: 'bold', color: '#0f172a'}}>#{loc.numeroPedido || loc.id.substring(0,6).toUpperCase()}</td>
                                <td style={{color: '#475569'}}>{loc.dataRetirada ? new Date(loc.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR') : 'Sem data'}</td>
                                <td><span className={`badge-status ${st}`}>{loc.status?.toUpperCase() || 'S/S'}</span></td>
                                <td className="text-right" style={{textDecoration: isCancelado ? 'line-through' : 'none', color: isCancelado ? '#94a3b8' : '#0f172a', fontWeight: 'bold'}}>
                                    R$ {Number(loc.valorTotal || loc.total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        )}
      </div>
    </div>
  );
};

export default HistoricoCliente;