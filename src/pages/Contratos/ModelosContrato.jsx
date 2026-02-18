import React, { useState, useEffect } from "react";
import { db } from "../../firebaseConfig";
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./ModelosContrato.css";

const ModelosContrato = () => {
  const [modelos, setModelos] = useState([]);
  const [novo, setNovo] = useState({ titulo: "", texto: "" });
  const [editandoId, setEditandoId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, "modelosContrato"));
    const unsub = onSnapshot(q, (snap) => {
      setModelos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // --- TEXTOS PADRÃO (A MÁGICA ACONTECE AQUI) ---
  const templates = {
    pegueMonte: {
      titulo: "CONTRATO PEGUE E MONTE",
      texto: `CLÁUSULAS - PEGUE E MONTE:

1. DO TRANSPORTE: O LOCATÁRIO é totalmente responsável pelo transporte das peças, devendo garantir veículo adequado para que não haja danos.
2. DA MONTAGEM: A ÁGAPE DECORAÇÕES não realiza montagem neste modelo. O cliente retira, monta e devolve.
3. DA DEVOLUÇÃO: As peças devem ser devolvidas limpas e embaladas da mesma forma que foram entregues.
4. DANOS E AVARIAS: Em caso de quebra, rasgo ou mancha, será cobrado o valor de reposição da peça (preço de mercado) no ato da devolução.
5. ATRASOS: A não devolução na data estipulada gera multa de 20% do valor do contrato por dia de atraso.`
    },
    decoracao: {
      titulo: "CONTRATO DE DECORAÇÃO COMPLETA",
      texto: `CLÁUSULAS - DECORAÇÃO COMPLETA:

1. DA PRESTAÇÃO DE SERVIÇO: A ÁGAPE DECORAÇÕES se compromete a realizar a montagem e desmontagem completa do cenário contratado.
2. DO ACESSO: O local deve estar liberado para a equipe de montagem pelo menos 2 horas antes do início do evento.
3. DA ESTRUTURA: A contratada não se responsabiliza por falhas na estrutura do local (tomadas, goteiras, piso irregular) que impeçam a montagem.
4. ALTERAÇÕES: Mudanças no layout só poderão ser feitas se solicitadas com 7 dias de antecedência.
5. SEGURANÇA: O LOCATÁRIO é responsável pela integridade das peças durante o evento.`
    },
    pecas: {
      titulo: "CONTRATO DE PEÇAS AVULSAS",
      texto: `CLÁUSULAS - LOCAÇÃO DE PEÇAS INDIVIDUAIS:

1. OBJETO: Locação apenas dos itens descritos, sem serviços de frete ou montagem inclusos.
2. CONFERÊNCIA: O cliente deve conferir as peças no ato da retirada. Reclamações posteriores não serão aceitas.
3. REPOSIÇÃO: Peças de cerâmica, vidro ou tecido que forem danificadas deverão ser pagas integralmente na devolução.
4. LIMPEZA: As peças devem retornar higienizadas, sob pena de cobrança de taxa de limpeza de R$ 50,00.`
    }
  };

  const carregarTemplate = (tipo) => {
    setNovo(templates[tipo]);
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    try {
      if (editandoId) {
        await updateDoc(doc(db, "modelosContrato", editandoId), novo);
        setEditandoId(null);
      } else {
        await addDoc(collection(db, "modelosContrato"), { ...novo, createdAt: serverTimestamp() });
      }
      setNovo({ titulo: "", texto: "" });
      alert("Modelo salvo com sucesso!");
    } catch (err) { alert("Erro: " + err.message); }
  };

  const prepararEdicao = (m) => {
    setEditandoId(m.id);
    setNovo({ titulo: m.titulo, texto: m.texto });
  };

  return (
    <div className="modelos-page-container">
      <header className="modelos-header">
        <button className="btn-back" onClick={() => navigate("/contratos")}>← Voltar para Contratos</button>
        <h1>Modelos de Contrato 📝</h1>
        <p>Crie ou escolha um padrão para usar nos seus documentos.</p>
      </header>

      <div className="modelos-grid">
        {/* LADO ESQUERDO: FORMULÁRIO */}
        <div className="modelo-form-card">
          <h3>{editandoId ? "Editando Modelo" : "Criar Novo Modelo"}</h3>
          
          {/* BOTÕES DE ATALHO */}
          {!editandoId && (
            <div className="atalhos-templates">
              <p>Preencher rápido com:</p>
              <div className="btn-group-templates">
                <button type="button" onClick={() => carregarTemplate('pegueMonte')}>📦 Pegue e Monte</button>
                <button type="button" onClick={() => carregarTemplate('decoracao')}>✨ Decoração</button>
                <button type="button" onClick={() => carregarTemplate('pecas')}>🧩 Peças Avulsas</button>
              </div>
            </div>
          )}

          <form onSubmit={handleSalvar}>
            <div className="form-group">
              <label>TÍTULO DO MODELO</label>
              <input 
                className="form-input" 
                placeholder="Ex: Contrato Padrão 2026"
                value={novo.titulo} 
                onChange={e => setNovo({...novo, titulo: e.target.value})} 
                required 
              />
            </div>
            <div className="form-group">
              <label>CLÁUSULAS E TERMOS</label>
              <textarea 
                className="form-input area" 
                rows="15" 
                placeholder="O texto do contrato aparecerá aqui..."
                value={novo.texto}
                onChange={e => setNovo({...novo, texto: e.target.value})}
                required
              ></textarea>
            </div>
            <button type="submit" className="btn-save-modelo">
              {editandoId ? "ATUALIZAR MODELO" : "SALVAR MODELO NO BANCO"}
            </button>
            {editandoId && <button type="button" className="btn-cancel-edit" onClick={() => {setEditandoId(null); setNovo({titulo:"", texto:""})}}>Cancelar Edição</button>}
          </form>
        </div>

        {/* LADO DIREITO: LISTA */}
        <div className="modelos-lista">
          <h3>Modelos Salvos</h3>
          {modelos.length === 0 ? (
            <div className="empty-models">
              <p>Nenhum modelo cadastrado.</p>
              <small>Use os botões ao lado para criar os primeiros!</small>
            </div>
          ) : (
            modelos.map(m => (
              <div key={m.id} className="modelo-item-card">
                <div className="modelo-info">
                  <h4>{m.titulo}</h4>
                  <p>{m.texto.substring(0, 80)}...</p>
                </div>
                <div className="modelo-actions">
                  <button className="btn-icon-small" onClick={() => prepararEdicao(m)} title="Editar">✏️</button>
                  <button className="btn-icon-small delete" onClick={() => deleteDoc(doc(db, "modelosContrato", m.id))} title="Excluir">🗑️</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ModelosContrato;