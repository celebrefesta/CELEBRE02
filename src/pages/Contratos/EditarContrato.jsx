import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import "./NovoContrato.css"; // Reaproveita o estilo elegante que já criamos

const EditarContrato = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);

  useEffect(() => {
    const carregarDados = async () => {
      const docRef = doc(db, "contratos", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setForm(docSnap.data());
      } else {
        alert("Contrato não encontrado!");
        navigate("/contratos");
      }
    };
    carregarDados();
  }, [id, navigate]);

  const handleSalvar = async (e) => {
    e.preventDefault();
    try {
      const docRef = doc(db, "contratos", id);
      await updateDoc(docRef, {
        ...form,
        valorTotal: Number(form.valorTotal)
      });
      alert("Contrato atualizado com sucesso!");
      navigate("/contratos");
    } catch (err) {
      alert("Erro ao atualizar: " + err.message);
    }
  };

  if (!form) return <div className="loading">Carregando dados...</div>;

  return (
    <div className="novo-contrato-layout">
      <div className="container-form">
        <header className="form-header">
          <button className="btn-voltar-link" onClick={() => navigate("/contratos")}>← Cancelar Edição</button>
          <h1>Editar Contrato ✏️</h1>
        </header>

        <form onSubmit={handleSalvar} className="main-form">
          <section className="form-section-card">
            <div className="grid-inputs">
              <div className="input-field full">
                <label>NOME DO CLIENTE</label>
                <input value={form.cliente} onChange={e => setForm({...form, cliente: e.target.value})} required />
              </div>
              <div className="input-field">
                <label>TEMA DA FESTA</label>
                <input value={form.tema} onChange={e => setForm({...form, tema: e.target.value})} />
              </div>
              <div className="input-field">
                <label>DATA DO EVENTO</label>
                <input type="date" value={form.dataEvento} onChange={e => setForm({...form, dataEvento: e.target.value})} />
              </div>
            </div>
            <div className="input-field full" style={{marginTop: '20px'}}>
              <label>DESCRIÇÃO / ITENS</label>
              <textarea rows="5" value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} />
            </div>
            <div className="input-field" style={{marginTop: '20px'}}>
              <label>VALOR TOTAL (R$)</label>
              <input type="number" step="0.01" value={form.valorTotal} onChange={e => setForm({...form, valorTotal: e.target.value})} required />
            </div>
          </section>
          <button type="submit" className="btn-finalizar-tudo">SALVAR ALTERAÇÕES</button>
        </form>
      </div>
    </div>
  );
};

export default EditarContrato;