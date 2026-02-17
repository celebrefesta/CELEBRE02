import React, { useState, useEffect } from 'react';
import './Logistica.css';
import { db } from '../../firebaseConfig';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';

const Logistica = () => {
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroData, setFiltroData] = useState('tudo');
  const [itemVisivel, setItemVisivel] = useState(null);

  const buscarLogistica = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "locacoes"));
      const dados = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const apenasConfirmados = dados.filter(item => item.status === 'confirmado');
      const ordenados = apenasConfirmados.sort((a, b) => 
        (a.dataRetirada || '').localeCompare(b.dataRetirada || '')
      );
      setAgendamentos(ordenados);
    } catch (error) {
      console.error("Erro ao carregar logística:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { buscarLogistica(); }, []);

  const mudarStatusLogistica = async (id, novoStatus) => {
    try {
      const docRef = doc(db, "locacoes", id);
      const agendamentoAtual = agendamentos.find(a => a.id === id);
      const logisticaAtualizada = {
        ...(agendamentoAtual.logistica || {}),
        statusEntrega: novoStatus
      };
      await updateDoc(docRef, { logistica: logisticaAtualizada });
      setAgendamentos(prev => prev.map(a => 
        a.id === id ? { ...a, logistica: logisticaAtualizada } : a
      ));
    } catch (e) {
      alert("Erro ao salvar no Firebase.");
    }
  };

  const rotasFiltradas = agendamentos.filter(rota => {
    if (filtroData === 'tudo') return true;
    const hoje = new Date().toISOString().split('T')[0];
    const amanhaData = new Date();
    amanhaData.setDate(amanhaData.getDate() + 1);
    const amanha = amanhaData.toISOString().split('T')[0];
    if (filtroData === 'hoje') return rota.dataRetirada === hoje;
    if (filtroData === 'amanha') return rota.dataRetirada === amanha;
    return true;
  });

  // LÓGICA DO CONTADOR
  const totalSaidas = rotasFiltradas.filter(r => (r.logistica?.statusEntrega || 'pendente') === 'pendente').length;
  const totalRua = rotasFiltradas.filter(r => r.logistica?.statusEntrega === 'saiu').length;

  return (
    <div className="pagina-logistica">
      <header className="cabecalho-logistica">
        <div className="titulos">
          <h1><span>🚚</span> Logística & Fluxo</h1>
          <p>Ágape Decorações - Controle de Materiais</p>
        </div>
        
        {/* CONTADORES NO TOPO */}
        <div className="resumo-logistica">
          <div className="card-mini-status saidas">
            <span className="valor">{totalSaidas}</span>
            <span className="legenda">Saídas Pendentes</span>
          </div>
          <div className="card-mini-status rua">
            <span className="valor">{totalRua}</span>
            <span className="legenda">Na Rua / Devolver</span>
          </div>
        </div>

        <div className="filtros-periodo">
          <button className={filtroData === 'hoje' ? 'ativo' : ''} onClick={() => setFiltroData('hoje')}>Hoje</button>
          <button className={filtroData === 'amanha' ? 'ativo' : ''} onClick={() => setFiltroData('amanha')}>Amanhã</button>
          <button className={filtroData === 'tudo' ? 'ativo' : ''} onClick={() => setFiltroData('tudo')}>Ver Tudo</button>
        </div>
      </header>

      <div className="grid-logistica">
        {loading ? (
          <div className="carregando">Sincronizando...</div>
        ) : rotasFiltradas.map(rota => {
          const statusLog = rota.logistica?.statusEntrega || 'pendente';
          return (
            <div key={rota.id} className={`card-rota ${statusLog}`}>
              <div className="info-data">
                <span className="dia">
                  {rota.dataRetirada ? new Date(rota.dataRetirada + 'T00:00').toLocaleDateString('pt-BR', {day: '2-digit', month: 'short'}) : '??'}
                </span>
                <span className="tipo-tag">{rota.logistica?.tipo === 'entrega' ? 'ENTREGA' : 'RETIRADA'}</span>
              </div>

              <div className="info-cliente">
                <h3>{rota.clienteNome || 'Cliente'}</h3>
                <p className="pedido-n">Pedido #{rota.numeroPedido || '---'}</p>
                <p className="local">
                   {rota.logistica?.tipo === 'entrega' ? `📍 ${rota.logistica?.endereco}` : '🏢 Retirada na Loja'}
                </p>
                
                <button className="btn-ver-itens" onClick={() => setItemVisivel(itemVisivel === rota.id ? null : rota.id)}>
                  {itemVisivel === rota.id ? '🔼 Esconder Peças' : '🔽 Ver Peças do Pedido'}
                </button>
                
                {itemVisivel === rota.id && (
                  <ul className="lista-conferencia">
                    {rota.itens?.map((it, idx) => (
                      <li key={idx}>✅ {it.qtd}x {it.nome}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="acoes-fluxo">
                {statusLog === 'pendente' && (
                  <button className="btn-fase entrega" onClick={() => mudarStatusLogistica(rota.id, 'saiu')}>📦 CONFIRMAR ENTREGA</button>
                )}
                
                {statusLog === 'saiu' && (
                  <div className="grupo-acoes">
                    <button className="btn-fase devolucao" onClick={() => mudarStatusLogistica(rota.id, 'concluido')}>⏪ CONFIRMAR DEVOLUÇÃO</button>
                    <button className="btn-voltar" onClick={() => mudarStatusLogistica(rota.id, 'pendente')}>🔄 Corrigir p/ Entrega</button>
                  </div>
                )}
                
                {statusLog === 'concluido' && (
                  <div className="grupo-acoes">
                    <span className="tag-finalizado">✨ FINALIZADO</span>
                    <button className="btn-voltar" onClick={() => mudarStatusLogistica(rota.id, 'saiu')}>🔄 Reabrir Devolução</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Logistica;