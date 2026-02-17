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

  // Busca os modelos do banco de dados Ágape
  useEffect(() => {
    const q = query(collection(db, "modelosContrato"));
    const unsub = onSnapshot(q, (snap) => {
      setModelos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

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
    } catch (err) { alert("Erro ao salvar: " + err.message); }
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
        <p>Configure as cláusulas padrão da Ágape Decorações.</p>
      </header>

      <div className="modelos-grid">
        <div className="modelo-form-card">
          <h3>{editandoId ? "Editar Modelo" : "Criar Novo Modelo"}</h3>
          <form onSubmit={handleSalvar}>
            <div className="form-group">
              <label>TÍTULO (Ex: Pegue e Monte)</label>
              <input 
                className="form-input" 
                value={novo.titulo} 
                onChange={e => setNovo({...novo, titulo: e.target.value})} 
                required 
              />
            </div>
            <div className="form-group">
              <label>CONTEÚDO DO CONTRATO</label>
              <textarea 
                className="form-input area" 
                rows="12" 
                value={novo.texto}
                onChange={e => setNovo({...novo, texto: e.target.value})}
                required
              ></textarea>
            </div>
            <button type="submit" className="btn-save-modelo">
              {editandoId ? "ATUALIZAR MODELO" : "SALVAR MODELO"}
            </button>
          </form>
        </div>

        <div className="modelos-lista">
          <h3>Modelos Salvos</h3>
          {modelos.length === 0 ? <p>Nenhum modelo cadastrado.</p> : 
            modelos.map(m => (
              <div key={m.id} className="modelo-item-card">
                <div className="modelo-info">
                  <h4>{m.titulo}</h4>
                  <p>{m.texto.substring(0, 60)}...</p>
                </div>
                <div className="modelo-actions">
                  <button onClick={() => prepararEdicao(m)}>✏️</button>
                  <button onClick={() => deleteDoc(doc(db, "modelosContrato", m.id))}>🗑️</button>
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
};

export default ModelosContrato;