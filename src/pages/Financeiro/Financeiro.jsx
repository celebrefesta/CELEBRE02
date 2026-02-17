import React, { useState, useEffect } from "react";
import { db } from "../../firebaseConfig"; 
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, orderBy } from "firebase/firestore";
import "./Financeiro.css";

const Financeiro = () => {
  const [transacoes, setTransacoes] = useState([]);
  const [resumo, setResumo] = useState({ entradas: 0, saidas: 0, saldo: 0 });
  const [modalAberto, setModalAberto] = useState(false);
  
  // Estado para o formulário de novo lançamento
  const [novo, setNovo] = useState({
    descricao: "", 
    valor: "", 
    tipo: "entrada", 
    data: new Date().toISOString().split('T')[0],
    categoria: "Locação de Acervo", 
    formaPagamento: "Pix"
  });

  // --- 1. CONEXÃO COM O FIREBASE (Buscar dados em Tempo Real) ---
  useEffect(() => {
    // Busca A: Compras que já foram realizadas (Status = comprado)
    const qCompras = query(collection(db, "lista_compras"), where("status", "==", "comprado"));
    
    // Busca B: Lançamentos manuais que você salvar (Tabela 'financeiro_lancamentos')
    const qManual = query(collection(db, "financeiro_lancamentos"), orderBy("data", "desc"));

    // Ouve as Compras
    const unsubscribeCompras = onSnapshot(qCompras, (snapCompras) => {
      const listaCompras = snapCompras.docs.map(doc => {
        const d = doc.data();
        // Calcula total (Qtd x Valor)
        const total = (Number(d.quantidade) || 1) * (Number(d.valorEstimado) || 0);
        return {
          id: doc.id,
          descricao: `Compra: ${d.nome}`,
          valor: total,
          tipo: 'saida', // Compra é sempre saída
          data: d.prazo || new Date().toISOString().split('T')[0],
          categoria: 'Material/Acervo',
          formaPagamento: 'Diversos',
          origem: 'compras' // Marca para saber que veio de lá
        };
      });

      // Ouve os Lançamentos Manuais
      onSnapshot(qManual, (snapManual) => {
        const listaManual = snapManual.docs.map(doc => ({
          id: doc.id, 
          ...doc.data(), 
          origem: 'manual'
        }));

        // Junta tudo numa lista só e ordena por data
        const geral = [...listaCompras, ...listaManual].sort((a, b) => new Date(b.data) - new Date(a.data));
        
        setTransacoes(geral);
        calcularTotais(geral);
      });
    });

    return () => unsubscribeCompras();
  }, []);

  // --- 2. CÁLCULO DOS TOTAIS ---
  const calcularTotais = (lista) => {
    let ent = 0, sai = 0;
    lista.forEach(item => {
      const val = Number(item.valor);
      if (item.tipo === 'entrada') {
        ent += val;
      } else {
        sai += val;
      }
    });
    setResumo({ entradas: ent, saidas: sai, saldo: ent - sai });
  };

  // --- 3. SALVAR NO FIREBASE ---
  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!novo.descricao || !novo.valor) return alert("Preencha a descrição e o valor!");

    try {
      // Cria a coleção 'financeiro_lancamentos' automaticamente se não existir
      await addDoc(collection(db, "financeiro_lancamentos"), {
        ...novo, 
        valor: Number(novo.valor), 
        createdAt: serverTimestamp()
      });
      setModalAberto(false);
      // Limpa o formulário
      setNovo({ 
        descricao: "", valor: "", tipo: "entrada", 
        data: new Date().toISOString().split('T')[0], 
        categoria: "Locação de Acervo", 
        formaPagamento: "Pix" 
      });
    } catch (error) { 
      alert("Erro ao salvar no Firebase: " + error.message); 
    }
  };

  // --- 4. EXCLUIR DO FIREBASE ---
  const handleExcluir = async (item) => {
    if (item.origem === 'compras') {
      alert("Este item é automático! Vá na tela de 'Compras' e desmarque o status 'Comprado' para remover.");
      return;
    }
    
    if (window.confirm("Tem certeza que deseja excluir este lançamento?")) {
      await deleteDoc(doc(db, "financeiro_lancamentos", item.id));
    }
  };

  // Listas de Categorias para o Select
  const catsReceita = ["Locação de Acervo", "Decoração Completa", "Venda de Produto", "Sinal / Entrada", "Outros"];
  const catsDespesa = ["Fornecedores", "Material de Consumo", "Manutenção", "Contas Fixas (Luz/Água)", "Marketing", "Pessoal / Diária", "Transporte / Frete"];

  return (
    <div className="financeiro-container">
      <div className="header-fin">
        <div>
          <h1>Financeiro</h1>
          <p>Fluxo de caixa integrado.</p>
        </div>
        <button className="btn-novo" onClick={() => setModalAberto(true)}>+ Novo Lançamento</button>
      </div>

      {/* CARDS DE RESUMO */}
      <div className="cards-grid">
        <div className="card-fin entrada">
          <span className="lbl">RECEITAS</span>
          <h3 className="txt-verde">R$ {resumo.entradas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3>
        </div>
        <div className="card-fin saida">
          <span className="lbl">DESPESAS</span>
          <h3 className="txt-vermelho">R$ {resumo.saidas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3>
        </div>
        <div className="card-fin saldo">
          <span className="lbl">SALDO</span>
          <h3 className={resumo.saldo >= 0 ? 'txt-azul' : 'txt-vermelho'}>
            R$ {resumo.saldo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
          </h3>
        </div>
      </div>

      {/* TABELA DE MOVIMENTAÇÕES */}
      <div className="tabela-container">
        <table>
          <thead>
            <tr>
              <th>DATA</th>
              <th>DESCRIÇÃO</th>
              <th>CATEGORIA</th>
              <th>PAGAMENTO</th>
              <th>VALOR</th>
              <th style={{textAlign: 'center'}}>AÇÃO</th>
            </tr>
          </thead>
          <tbody>
            {transacoes.length === 0 ? (
              <tr><td colSpan="6" style={{textAlign: 'center', padding: 20}}>Nenhum lançamento encontrado.</td></tr>
            ) : (
              transacoes.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.data).toLocaleDateString('pt-BR')}</td>
                  <td>
                    <strong>{item.descricao}</strong>
                    {item.origem === 'compras' && <span className="tag-auto">Auto</span>}
                  </td>
                  <td>{item.categoria}</td>
                  <td>{item.formaPagamento}</td>
                  <td>
                    <span className={`valor-tag ${item.tipo}`}>
                      {item.tipo === 'entrada' ? '+' : '-'} R$ {Number(item.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                    </span>
                  </td>
                  <td style={{textAlign: 'center'}}>
                    <button className="btn-trash" onClick={() => handleExcluir(item)}>🗑️</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* --- MODAL DE CADASTRO --- */}
      {modalAberto && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <h2 style={{ color: novo.tipo === 'entrada' ? '#059669' : '#dc2626' }}>
                {novo.tipo === 'entrada' ? 'Nova Receita 💰' : 'Nova Despesa 💸'}
              </h2>
            </div>
            
            <form onSubmit={handleSalvar}>
              <div className="form-body">
                
                {/* Switch Verde/Vermelho */}
                <div className="tipo-switch">
                  <div 
                    className={`switch-option ${novo.tipo === 'entrada' ? 'active-in' : ''}`} 
                    onClick={() => setNovo({...novo, tipo: 'entrada', categoria: catsReceita[0]})}
                  >
                    ⬆️ RECEITA
                  </div>
                  <div 
                    className={`switch-option ${novo.tipo === 'saida' ? 'active-out' : ''}`} 
                    onClick={() => setNovo({...novo, tipo: 'saida', categoria: catsDespesa[0]})}
                  >
                    ⬇️ DESPESA
                  </div>
                </div>

                <div className="form-group">
                  <label>Descrição</label>
                  <input 
                    type="text" className="form-input" required
                    placeholder={novo.tipo === 'entrada' ? "Ex: Sinal Festa da Ana..." : "Ex: Conta de Luz..."}
                    value={novo.descricao} onChange={e => setNovo({...novo, descricao: e.target.value})} 
                  />
                </div>

                <div className="form-row">
                  <div className="form-half">
                    <label>Valor (R$)</label>
                    <input type="number" className="form-input" required step="0.01" value={novo.valor} onChange={e => setNovo({...novo, valor: e.target.value})} />
                  </div>
                  <div className="form-half">
                    <label>Data</label>
                    <input type="date" className="form-input" value={novo.data} onChange={e => setNovo({...novo, data: e.target.value})} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-half">
                    <label>Categoria</label>
                    <select className="form-input" value={novo.categoria} onChange={e => setNovo({...novo, categoria: e.target.value})}>
                      {novo.tipo === 'entrada' 
                        ? catsReceita.map(c => <option key={c}>{c}</option>)
                        : catsDespesa.map(c => <option key={c}>{c}</option>)
                      }
                    </select>
                  </div>
                  <div className="form-half">
                    <label>Pagamento</label>
                    <select className="form-input" value={novo.formaPagamento} onChange={e => setNovo({...novo, formaPagamento: e.target.value})}>
                      <option>Pix</option>
                      <option>Dinheiro</option>
                      <option>Cartão Crédito</option>
                      <option>Cartão Débito</option>
                      <option>Boleto</option>
                    </select>
                  </div>
                </div>

                <div className="form-footer">
                  <button type="button" className="btn-cancel" onClick={() => setModalAberto(false)}>Cancelar</button>
                  <button type="submit" className={`btn-save ${novo.tipo}`}>
                    {novo.tipo === 'entrada' ? 'Confirmar Receita' : 'Confirmar Despesa'}
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

export default Financeiro;