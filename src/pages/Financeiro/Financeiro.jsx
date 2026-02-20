import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; // <-- IMPORTANTE: Navegação adicionada
import { db } from "../../firebaseConfig"; 
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import "./Financeiro.css";

const Financeiro = () => {
  const navigate = useNavigate(); // <-- Habilita a troca de página
  const [transacoes, setTransacoes] = useState([]);

  // Busca as transações do banco de dados em tempo real
  useEffect(() => {
    const q = query(collection(db, "financeiro_lancamentos"), orderBy("data", "desc"));
    return onSnapshot(q, (snap) => setTransacoes(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  // Cálculos dos Cards
  const totalEntradas = transacoes.filter(t => t.tipo === 'entrada').reduce((acc, t) => acc + Number(t.valor), 0);
  const totalSaidas = transacoes.filter(t => t.tipo === 'saida').reduce((acc, t) => acc + Number(t.valor), 0);
  const saldoLiquido = totalEntradas - totalSaidas;

  return (
    <div className="pag-financeiro-main">
      <div className="financeiro-content">
        
       {/* CABEÇALHO */}
        <header className="fin-header-modern">
          <div className="fin-title-area">
            <h1>Financeiro</h1>
            <p>Controle completo de fluxo de caixa da Ágape Decorações</p>
          </div>
          <div className="fin-action-buttons">
            {/* Botão Único de Novo Lançamento */}
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

        {/* TABELA DE TRANSAÇÕES ATUALIZADA */}
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
                      <button className="btn-icon-excluir" title="Excluir" onClick={async () => {
                        if(window.confirm(`Tem certeza que deseja excluir "${t.descricao}"?`)) {
                          await deleteDoc(doc(db, "financeiro_lancamentos", t.id));
                        }
                      }}>
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