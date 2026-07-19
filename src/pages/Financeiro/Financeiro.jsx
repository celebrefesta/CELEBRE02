import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; 
import { db } from "../../firebaseConfig";
import { collection, query, onSnapshot, deleteDoc, doc, where, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import "./Financeiro.css";

const Financeiro = () => {
  const navigate = useNavigate();
  
  // 🔥 Autenticação e Chave Mestra
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [transacoes, setTransacoes] = useState([]);

  // 🔥 SISTEMA DE AUDITORIA (ESPIÃO VINCULADO À EMPRESA)
  const registrarLog = async (acao, detalhes) => {
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
      console.error("Erro ao gravar log da auditoria financeira:", error);
    }
  };

  useEffect(() => {
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }

    // 🔥 BLINDAGEM MULTI-EMPRESA: Puxa APENAS as transações da sua empresa 
    const q = query(collection(db, "financeiro_lancamentos"), where("userId", "==", tenantId));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      let lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Ordenação segura [cite: 9, 10]
      lista.sort((a, b) => {
         const dataA = a.data ? new Date(a.data).getTime() : 0;
         const dataB = b.data ? new Date(b.data).getTime() : 0;
         if (dataB === dataA) {
             const criacaoA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
             const criacaoB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
             return criacaoB - criacaoA;
         }
         return dataB - dataA;
      });

      setTransacoes(lista);
    });

    return () => unsubscribe();
  }, [usuarioLogado, navigate, tenantId]);

  // Cálculos dos Cards
  const totalEntradas = transacoes.filter(t => t.tipo === 'entrada').reduce((acc, t) => acc + Number(t.valor), 0);
  const totalSaidas = transacoes.filter(t => t.tipo === 'saida').reduce((acc, t) => acc + Number(t.valor), 0);
  const saldoLiquido = totalEntradas - totalSaidas;

  const handleExcluirLancamento = async (transacao) => {
    const confirmacao = window.confirm(`⚠️ CUIDADO: Tem certeza que deseja excluir "${transacao.descricao}"? Esta ação é irreversível.`);
    if (confirmacao) {
      try {
        const valorFormatado = Number(transacao.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const detalhesLog = `Excluiu um lançamento de ${transacao.tipo.toUpperCase()} no valor de ${valorFormatado}. Descrição: ${transacao.descricao}`;
        
        // 🔥 Primeiro regista o log [cite: 16]
        await registrarLog("EXCLUSÃO FINANCEIRA", detalhesLog);
        
        // Depois apaga o documento [cite: 17]
        await deleteDoc(doc(db, "financeiro_lancamentos", transacao.id));
        
        alert("Lançamento removido com sucesso!");
      } catch (error) {
        console.error("Erro ao excluir:", error);
        alert("Erro ao excluir lançamento.");
      }
    }
  };

  return (
    <div className="pag-financeiro-main">
      <div className="financeiro-content">
        
       {/* CABEÇALHO */}
        <header className="fin-header-modern">
          <div className="fin-title-area">
            <h1>Financeiro</h1>
            <p>Controle completo de fluxo de caixa da empresa</p>
          </div>
  
          <div className="fin-action-buttons">
            <button className="btn-novo-lancamento-unico" onClick={() => navigate('/financeiro/novo')}>
              + Novo Lançamento
            </button>
          </div>
        </header>

        {/* CARDS DE RESUMO (KPIs) */}
        <div className="fin-kpi-grid">
     
          <div className="kpi-card card-entradas">
            <div className="kpi-header">
              <span>ENTRADAS (RECEBIDO)</span>
              <div className="kpi-icon">💰</div>
            </div>
            <h2>{totalEntradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h2>
          </div>

          <div className="kpi-card card-saidas">
            <div className="kpi-header">
              <span>SAÍDAS (PAGO)</span>
              <div className="kpi-icon">📄</div>
            </div>
            <h2>{totalSaidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h2>
          </div>

          <div className="kpi-card card-saldo">
            <div className="kpi-header">
              <span>SALDO LÍQUIDO</span>
              <div className="kpi-icon">🏦</div>
            </div>
            <h2>{saldoLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h2>
            <p className="kpi-subtitle">Disponível em caixa</p>
          </div>
      
        </div>

        {/* TABELA DE TRANSAÇÕES */}
        <div className="fin-table-container">
          <table className="fin-table-modern">
            <thead>
              <tr>
                <th>DATA</th>
                <th>CATEGORIA</th>
                <th>DESCRIÇÃO</th>
                <th>FORMA PAGTO</th>
                <th className="direita">VALOR (R$)</th>
                <th className="centro">SITUAÇÃO</th>
                <th className="centro">AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {transacoes.length === 0 ? (
                <tr>
                  <td colSpan="7" className="fin-empty">Nenhuma transação registrada.</td>
                </tr>
              ) : (
                transacoes.map(t => (
                  <tr key={t.id}>
                    <td className="col-data">{new Date(t.data + "T12:00").toLocaleDateString('pt-BR')}</td>
                    
                    <td>
                      <span className={`badge-categoria ${t.tipo}`}>
                        {t.categoria || (t.tipo === 'entrada' ? 'Receita' : 'Despesa')}
                      </span>
                    </td>
                    
                    <td className="col-desc"><strong>{t.descricao}</strong></td>
                    
                    <td style={{ color: '#64748b', fontSize: '13px' }}>
                      {t.formaPagto || '---'}
                    </td>

                    <td className={`direita col-valor ${t.tipo === 'entrada' ? 'txt-verde' : 'txt-vermelho'}`}>
                      {t.tipo === 'entrada' ? '+ ' : '- '}
                      {Number(t.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>

                    <td className="centro">
                      <span style={{
                        padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase',
                        backgroundColor: t.status === 'pendente' ? '#fefce8' : '#ecfdf5',
                        color: t.status === 'pendente' ? '#a16207' : '#15803d',
                        border: `1px solid ${t.status === 'pendente' ? '#fde047' : '#86efac'}`
                      }}>
                        {t.status === 'pendente' ? 'Pendente' : 'Pago'}
                      </span>
                    </td>

                    <td className="centro">
                      <button className="btn-icon-excluir" title="Excluir" onClick={() => handleExcluirLancamento(t)}>
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
};

export default Financeiro;