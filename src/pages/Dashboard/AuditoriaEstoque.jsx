import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import './AuditoriaEstoque.css';

const AuditoriaEstoque = () => {
  const [pedidosAtrasados, setPedidosAtrasados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const realizarAuditoria = async () => {
      try {
        const hoje = new Date().toISOString().split('T')[0];
        // Busca pedidos confirmados ou em separação cuja data já passou
        const q = query(
          collection(db, "locacoes"),
          where("dataRetirada", "<", hoje),
          where("status", "in", ["CONFIRMADO", "SEPARACAO"])
        );

        const snap = await getDocs(q);
        const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (lista.length > 0) {
          setPedidosAtrasados(lista);
          setVisivel(true);
        }
      } catch (error) {
        console.error("Erro na auditoria:", error);
      } finally {
        setLoading(false);
      }
    };

    realizarAuditoria();
  }, []);

  const handleResolver = async (id, novoStatus) => {
    try {
      await updateDoc(doc(db, "locacoes", id), { status: novoStatus });
      const novaLista = pedidosAtrasados.filter(p => p.id !== id);
      setPedidosAtrasados(novaLista);
      if (novaLista.length === 0) setVisivel(false);
    } catch (e) {
      alert("Erro ao atualizar pedido.");
    }
  };

  if (!visivel || loading) return null;

  return (
    <div className="auditoria-overlay">
      <div className="auditoria-modal">
        <div className="auditoria-header">
          <h2>🚨 Auditoria de Estoque: Pedidos Atrasados!</h2>
          <p>As datas dos eventos abaixo já passaram, mas o sistema diz que ainda não saíram da loja. 
             <strong> Isso está bloqueando e mentindo sobre a disponibilidade das suas peças!</strong></p>
        </div>

        <div className="auditoria-corpo">
          {pedidosAtrasados.map(pedido => (
            <div key={pedido.id} className="auditoria-card">
              <div className="auditoria-info">
                <h3>{pedido.clienteNome} <small>#{pedido.id.slice(-4)}</small></h3>
                <p>Data da Festa: <span className="data-atrasada">{pedido.dataRetirada}</span> | Status: {pedido.status}</p>
              </div>
              <div className="auditoria-btns">
                <button className="btn-auditoria-cancel" onClick={() => handleResolver(pedido.id, 'CANCELADO')}>
                  ✕ Cancelou a festa
                </button>
                <button className="btn-auditoria-check" onClick={() => handleResolver(pedido.id, 'FINALIZADO')}>
                  ✓ Já levou e devolveu
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="auditoria-footer">
          <button className="btn-auditoria-ignore" onClick={() => setVisivel(false)}>
            Ignorar e corrigir depois (Não recomendado)
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuditoriaEstoque;