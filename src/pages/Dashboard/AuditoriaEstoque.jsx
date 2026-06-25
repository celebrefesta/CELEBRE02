import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import './AuditoriaEstoque.css';

const AuditoriaEstoque = () => {
  const navigate = useNavigate();

  // 🔥 Autenticação e Chave Mestra
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [pedidosComProblema, setPedidosComProblema] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (!usuarioLogado) return;

    const realizarAuditoriaUnificada = async () => {
      try {
        const tzoffset = (new Date()).getTimezoneOffset() * 60000;
        const hoje = (new Date(Date.now() - tzoffset)).toISOString().split('T')[0];

        const q = query(collection(db, "locacoes"), where("userId", "==", tenantId));
        const snap = await getDocs(q);
        
        const anomalias = [];

        snap.docs.forEach(docSnap => {
          const item = { id: docSnap.id, ...docSnap.data() };
          const statusStr = (item.status || '').toLowerCase();
          
          if (statusStr === 'cancelado') return;

          const isOrcamento = statusStr.includes('orcam');
          if (isOrcamento && item.dataRetirada && item.dataRetirada < hoje) return; 

          let alertas = [];
          let permiteAcaoRapida = false;

          if (['confirmado', 'preparacao'].includes(statusStr) && item.dataRetirada && item.dataRetirada < hoje) {
            alertas.push({ tipo: 'estoque', texto: 'Estoque Travado (Data Passou)' });
            permiteAcaoRapida = true; 
          }
          else if (['confirmado', 'preparacao'].includes(statusStr) && item.dataRetirada === hoje) {
            alertas.push({ tipo: 'entrega', texto: 'Separar / Entregar Hoje!' });
          }

          if (statusStr === 'entregue' && item.dataDevolucao && item.dataDevolucao < hoje) {
            alertas.push({ tipo: 'devolucao', texto: 'Devolução Atrasada' });
          }

          const saldoDevedor = Number(item.valorTotal || 0) - Number(item.valorPago || 0);
          if (saldoDevedor > 0 && !isOrcamento && item.dataDevolucao && item.dataDevolucao <= hoje) {
            alertas.push({ tipo: 'financeiro', texto: `Pagamento Pendente (R$ ${saldoDevedor.toFixed(2)})` });
            permiteAcaoRapida = false; 
          }

          const temAvaria = item.itens?.some(i => i.avaria);
          const temFalta = item.itens?.some(i => i.faltou);
          
          if (temAvaria) { 
              alertas.push({ tipo: 'avaria', texto: 'Peça Avariada' });
              permiteAcaoRapida = false;
          }
          if (temFalta) { 
              alertas.push({ tipo: 'falta', texto: 'Peça Faltando' });
              permiteAcaoRapida = false; 
          }

          if (statusStr === 'finalizado' && !temAvaria && !temFalta && saldoDevedor <= 0) return;

          if (alertas.length > 0) {
            anomalias.push({ ...item, alertas, permiteAcaoRapida });
          }
        });

        if (anomalias.length > 0) {
          setPedidosComProblema(anomalias);
          setVisivel(true);
        }
      } catch (error) {
        console.error("Erro na auditoria unificada:", error);
      } finally {
        setLoading(false);
      }
    };

    realizarAuditoriaUnificada();
  }, [usuarioLogado, tenantId]);

  const handleResolverRapido = async (id, novoStatus) => {
    try {
      await updateDoc(doc(db, "locacoes", id), { status: novoStatus });
      const novaLista = pedidosComProblema.filter(p => p.id !== id);
      setPedidosComProblema(novaLista);
      if (novaLista.length === 0) setVisivel(false);
    } catch (e) {
      alert("Erro ao atualizar pedido.");
    }
  };

  if (!visivel || loading) return null;

  return (
    <div className="auditoria-overlay">
      <div className="auditoria-modal" style={{maxWidth: '850px'}}>
        
        <div className="auditoria-header">
          {/* 🔥 BOTÃO X AGORA DENTRO DO HEADER PARA NÃO QUEBRAR O ALINHAMENTO */}
          <button 
              className="btn-fechar-modal" 
              onClick={() => setVisivel(false)}
              title="Fechar diagnóstico"
          >
              <i className="fas fa-times"></i>
          </button>

          <div className="auditoria-icone">🚨</div>
          <h2>Atenção! Diagnóstico do Sistema</h2>
          <p>
            O sistema detectou <strong>{pedidosComProblema.length} anomalias</strong> na sua operação (Estoques travados, pagamentos pendentes ou avarias). Resolva para limpar esta lista:
          </p>
        </div>

        <div className="auditoria-corpo">
          {pedidosComProblema.map(pedido => (
            <div key={pedido.id} className="auditoria-card">
              <div className="auditoria-info">
                <h3>{pedido.clienteNome || 'Cliente não informado'} <span className="pedido-id">#{pedido.id.slice(-4)}</span></h3>
        
                <div className="auditoria-detalhes">
                    <span className="badge-data">📅 Data: {pedido.dataRetirada?.split('-').reverse().join('/') || 'S/D'}</span>
                    <span className="badge-status">Status: {pedido.status?.toUpperCase()}</span>
                </div>

                <div className="auditoria-tags-erro">
                    {pedido.alertas.map((alerta, idx) => (
                      <span key={idx} className={`tag-erro ${alerta.tipo}`}>
                            {alerta.texto}
                        </span>
                    ))}
                </div>
              </div>
              
              <div className="auditoria-btns">
                {pedido.permiteAcaoRapida ? (
                    <>
                        <button className="btn-auditoria-cancel" onClick={() => handleResolverRapido(pedido.id, 'CANCELADO')} title="A festa não aconteceu.">
                        ✕ Cancelado
                        </button>
                        <button className="btn-auditoria-check" onClick={() => handleResolverRapido(pedido.id, 'FINALIZADO')} title="A festa aconteceu e as peças voltaram.">
                        ✓ Finalizado
                        </button>
                    </>
                ) : (
                    <button className="btn-auditoria-abrir" onClick={() => navigate(`/locacoes/editar/${pedido.id}`)}>
                        Abrir Pedido ➔
                    </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AuditoriaEstoque;