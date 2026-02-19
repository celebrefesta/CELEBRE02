import React, { useState, useEffect } from "react";
import { db } from "../../firebaseConfig"; 
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from "firebase/firestore";
import "./Financeiro.css";

const Financeiro = () => {
  const [transacoes, setTransacoes] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [novo, setNovo] = useState({ descricao: "", valor: "", tipo: "entrada", data: new Date().toISOString().split('T')[0] });

  useEffect(() => {
    const q = query(collection(db, "financeiro_lancamentos"), orderBy("data", "desc"));
    return onSnapshot(q, (snap) => setTransacoes(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!novo.descricao || !novo.valor) return alert("Preencha todos os campos!");
    await addDoc(collection(db, "financeiro_lancamentos"), { 
      ...novo, 
      valor: Number(novo.valor), 
      createdAt: serverTimestamp() 
    });
    setModalAberto(false);
    setNovo({ descricao: "", valor: "", tipo: "entrada", data: new Date().toISOString().split('T')[0] });
  };

  const saldo = transacoes.reduce((acc, t) => acc + (t.tipo === 'entrada' ? Number(t.valor) : -Number(t.valor)), 0);

  return (
    <div className="financeiro-container">
      <header className="header-fin">
        <h1>Fluxo de Caixa</h1>
        <button className="btn-novo" onClick={() => setModalAberto(true)}>+ Novo Lançamento</button>
      </header>
      
      <div className="card-fin saldo">
        <span>SALDO TOTAL EM CAIXA</span>
        <h3 className={saldo >= 0 ? "txt-verde" : "txt-vermelho"}>
          {saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </h3>
      </div>

      <div className="tabela-container">
        <table>
          <thead><tr><th>Data</th><th>Descrição</th><th>Valor</th><th>Ação</th></tr></thead>
          <tbody>
            {transacoes.map(t => (
              <tr key={t.id}>
                <td>{new Date(t.data + "T12:00").toLocaleDateString('pt-BR')}</td>
                <td>{t.descricao}</td>
                <td className={t.tipo === 'entrada' ? 'txt-verde' : 'txt-vermelho'}>
                  {t.tipo === 'entrada' ? '+' : '-'} {Number(t.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td><button onClick={async () => await deleteDoc(doc(db, "financeiro_lancamentos", t.id))}>🗑️</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalAberto && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Novo Lançamento</h3>
            <form onSubmit={handleSalvar}>
              <input type="text" placeholder="Descrição" value={novo.descricao} onChange={e => setNovo({...novo, descricao: e.target.value})} required />
              <input type="number" placeholder="Valor" value={novo.valor} onChange={e => setNovo({...novo, valor: e.target.value})} required />
              <select value={novo.tipo} onChange={e => setNovo({...novo, tipo: e.target.value})}>
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
              </select>
              <div className="modal-actions">
                <button type="button" onClick={() => setModalAberto(false)} className="btn-cancel">Cancelar</button>
                <button type="submit" className="btn-confirm">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Financeiro;