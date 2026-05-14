import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { db } from "../../firebaseConfig";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
// 🔥 Importação do Cadeado de Segurança
import "./NovoLancamento.css";

const NovoLancamento = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // 🔥 Autenticação
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tipoInicial = location.state?.tipo || "entrada";

  const [novo, setNovo] = useState({
    tipo: tipoInicial,
    data: new Date().toISOString().split('T')[0],
    descricao: "",
    valor: "",
    categoria: tipoInicial === "entrada" ? "Locação" : "Compra para Estoque",
    formaPagto: "Pix",
    status: "pago",
    parcelas: 1,       // Quantidade de parcelas
    acrescimo: ""      // Valor dos juros
  });
  const [salvando, setSalvando] = useState(false);

  // 🔥 SISTEMA DE AUDITORIA (ESPIÃO DE LANÇAMENTOS)
  const registrarLog = async (acao, detalhes) => {
    try {
      const nomeEquipa = usuarioLogado?.displayName || usuarioLogado?.email || "Equipa";
      await addDoc(collection(db, "logs_atividades"), {
        data: new Date(),
        criadoEm: serverTimestamp(),
        funcionario: nomeEquipa,
        usuarioNome: nomeEquipa,
        usuarioEmail: usuarioLogado?.email || "Desconhecido",
        acao: acao.toUpperCase(),
        detalhes: detalhes,
        userId: usuarioLogado?.uid
      });
    } catch (error) {
      console.error("Erro ao gravar log da auditoria de lançamentos:", error);
    }
  };

  useEffect(() => {
    if (!usuarioLogado) {
        navigate('/login');
    }
  }, [usuarioLogado, navigate]);

  const categoriasEntrada = [
    "Locação",
    "Sinal / Reserva",
    "Frete / Deslocamento",
    "Acréscimo / Multa",
    "Venda de Produto",
    "Outros"
  ];

  const categoriasSaida = [
    "Compra para Estoque",
    "Manutenção / Conserto",
    "Despesas Fixas (Luz, Internet...)",
    "Logística / Combustível",
    "Fornecedores / Equipe",
    "Impostos / Taxas",
    "Outros"
  ];

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!usuarioLogado) return alert("Erro: Utilizador não identificado.");
    if (!novo.descricao || !novo.valor) return alert("Preencha descrição e valor!");

    setSalvando(true);
    try {
      // Se tiver acréscimo de juros, converte para número, senão é 0
      const valorAcrescimo = Number(novo.acrescimo) || 0;
      const valorBase = Number(novo.valor);
      const valorTotalFinal = valorBase + valorAcrescimo;
      
      // 🔥 BLINDAGEM MULTI-EMPRESA: Salva o lançamento com o userId
      await addDoc(collection(db, "financeiro_lancamentos"), {
        ...novo,
        valor: valorBase,
        acrescimo: valorAcrescimo,
        valorTotal: valorTotalFinal, // Salva o valor base + juros
        parcelas: Number(novo.parcelas),
        createdAt: serverTimestamp(),
        userId: usuarioLogado.uid // 🔥 CADEADO DE SEGURANÇA
      });

      // 🔥 REGISTA AUDITORIA
      const tipoTxt = novo.tipo === 'entrada' ? 'Receita (Entrada)' : 'Despesa (Saída)';
      await registrarLog("NOVO LANÇAMENTO FINANCEIRO", `Registrou uma ${tipoTxt} manual de R$ ${valorTotalFinal.toFixed(2)}. Descrição: "${novo.descricao}".`);

      alert("Lançamento salvo com sucesso!");
      navigate("/financeiro");
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="pag-novo-lancamento">
      <header className="header-nl">
        <button className="btn-voltar-nl" onClick={() => navigate("/financeiro")}>← Voltar</button>
        <h2>{novo.tipo === 'entrada' ? '💰 Nova Receita (Entrada)' : '📄 Nova Despesa (Saída)'}</h2>
      </header>

      <div className="nl-container">
        <div className="nl-card">
          
          <div className="nl-tipo-selector">
           
            <button 
              type="button" 
              className={`nl-tipo-btn ${novo.tipo === 'entrada' ? 'ativo-entrada' : ''}`}
              onClick={() => setNovo({...novo, tipo: 'entrada', categoria: 'Locação'})}
            >
              🟢 ENTRADA
            </button>
   
            <button 
              type="button" 
              className={`nl-tipo-btn ${novo.tipo === 'saida' ? 'ativo-saida' : ''}`}
              onClick={() => setNovo({...novo, tipo: 'saida', categoria: 'Compra para Estoque'})}
            >
              🔴 SAÍDA
            </button>
          </div>

          <form onSubmit={handleSalvar} className="nl-form">
            
            <div className="nl-row">
              <div className="nl-group">
                <label>Valor {novo.tipo === 'saida' && novo.formaPagto === 'Cartão de Crédito' ? 'Base (R$)' : '(R$)'}</label>
                <input 
                  type="number" step="0.01" placeholder="0,00" required autoFocus
                  className={`nl-input-valor ${novo.tipo}`}
                  value={novo.valor} onChange={e => setNovo({...novo, valor: e.target.value})} 
                />
              </div>
              <div className="nl-group">
                <label>Data</label>
                <input 
                  type="date" required 
                  value={novo.data} onChange={e => setNovo({...novo, data: e.target.value})} 
                />
              </div>
            </div>

            <div className="nl-group">
              <label>Descrição / Título</label>
              <input 
                type="text" placeholder="Ex: Pagamento Ana, Compra de Bexigas..." required 
                value={novo.descricao} onChange={e => setNovo({...novo, descricao: e.target.value})} 
              />
            </div>

            <div className="nl-row">
              <div className="nl-group">
                <label>Categoria</label>
                <select value={novo.categoria} onChange={e => setNovo({...novo, categoria: e.target.value})}>
                  {novo.tipo === 'entrada' 
                    ? categoriasEntrada.map(cat => <option key={cat} value={cat}>{cat}</option>)
                    : categoriasSaida.map(cat => <option key={cat} value={cat}>{cat}</option>)
                  }
                </select>
              </div>
              
              <div className="nl-group">
                <label>Forma de Pagto</label>
                <select value={novo.formaPagto} onChange={e => setNovo({...novo, formaPagto: e.target.value})}>
                  <option value="Pix">PIX</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                  <option value="Cartão de Débito">Cartão de Débito</option>
                  <option value="Transferência">Transferência / TED</option>
                </select>
              </div>
            </div>

            {/* --- BLOCO CONDICIONAL: SÓ APARECE EM SAÍDAS COM CARTÃO DE CRÉDITO --- */}
            {novo.tipo === 'saida' && novo.formaPagto === 'Cartão de Crédito' && (
              <div className="nl-row" style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div className="nl-group">
                  <label>Parcelamento</label>
                  <select value={novo.parcelas} onChange={e => setNovo({...novo, parcelas: e.target.value})}>
                    <option value="1">À vista (1x)</option>
                    <option value="2">2x</option>
                    <option value="3">3x</option>
                    <option value="4">4x</option>
                    <option value="5">5x</option>
                    <option value="6">6x</option>
                    <option value="7">7x</option>
                    <option value="8">8x</option>
                    <option value="9">9x</option>
                    <option value="10">10x</option>
                    <option value="11">11x</option>
                    <option value="12">12x</option>
                  </select>
                </div>
                <div className="nl-group">
                  <label>Acréscimo / Juros (R$)</label>
                  <input 
                    type="number" step="0.01" placeholder="0,00"
                    value={novo.acrescimo} onChange={e => setNovo({...novo, acrescimo: e.target.value})} 
                  />
                </div>
              </div>
            )}

            <div className="nl-group status-group">
              <label>Situação do Pagamento</label>
              <div className="nl-status-options">
                <label className={`status-radio ${novo.status === 'pago' ? 'selecionado' : ''}`}>
                  <input type="radio" name="status" value="pago" checked={novo.status === 'pago'} onChange={() => setNovo({...novo, status: 'pago'})} />
                  ✅ {novo.tipo === 'entrada' ? 'Recebido' : 'Pago'}
                </label>
                <label className={`status-radio pendente ${novo.status === 'pendente' ? 'selecionado' : ''}`}>
                  <input type="radio" name="status" value="pendente" checked={novo.status === 'pendente'} onChange={() => setNovo({...novo, status: 'pendente'})} />
                  ⏳ Pendente
                </label>
              </div>
            </div>

            <div className="nl-actions">
              <button type="button" className="btn-cancelar" onClick={() => navigate("/financeiro")}>Cancelar</button>
              <button type="submit" className={`btn-salvar ${novo.tipo}`} disabled={salvando}>
                {salvando ? "Salvando..." : "✔ Confirmar Lançamento"}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};

export default NovoLancamento;