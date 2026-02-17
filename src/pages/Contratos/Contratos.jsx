import React, { useState, useEffect } from "react";
import { db } from "../../firebaseConfig";
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf"; 
import "./Contratos.css";

const Contratos = () => {
  const [contratos, setContratos] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, "contratos"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setContratos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  const gerarPDF = (item) => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.text("CONTRATO DE LOCAÇÃO - ÁGAPE DECORAÇÕES", 105, 20, null, null, "center");
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Cliente: ${item.cliente || "Não informado"}`, 20, 40);
    doc.text(`Data: ${item.dataEvento || "--/--/----"}`, 20, 50);
    doc.text(`Valor: R$ ${Number(item.valorTotal || 0).toFixed(2)}`, 20, 60);
    
    doc.text("Itens:", 20, 80);
    const desc = doc.splitTextToSize(item.descricao || "Sem descrição", 170);
    doc.text(desc, 20, 90);

    doc.save(`Contrato_${item.cliente}.pdf`);
  };

  return (
    <div className="contratos-container">
      <div className="header-top">
        <div>
          <h1>Gestão de Contratos</h1>
          <p>Gerencie os documentos da Ágape Decorações.</p>
        </div>
        <div className="header-actions">
          {/* NOVO BOTÃO DE MODELOS */}
          <button className="btn-secondary" onClick={() => navigate("/modelos-contrato")}>
            📄 Ver Modelos
          </button>
          
          <button className="btn-primary" onClick={() => navigate("/novo-contrato")}>
            + Criar Novo Contrato
          </button>
        </div>
      </div>

      <div className="lista-container">
        {/* ... restante da tabela permanece igual ... */}
        <table className="tabela-contratos">
          <thead>
            <tr>
              <th>CLIENTE</th>
              <th>DATA EVENTO</th>
              <th>VALOR</th>
              <th>STATUS</th>
              <th style={{textAlign: 'center'}}>AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {contratos.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.cliente}</strong></td>
                <td>{item.dataEvento}</td>
                <td>R$ {Number(item.valorTotal).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                <td>
                  <span className={`status-badge ${item.status?.toLowerCase().replace(" ", "-")}`}>
                    {item.status}
                  </span>
                </td>
                <td style={{textAlign: 'center'}}>
                  <button className="btn-icon" onClick={() => navigate(`/editar-contrato/${item.id}`)}>✏️</button>
                  <button className="btn-icon pdf" onClick={() => gerarPDF(item)}>📄</button>
                  <button className="btn-icon" onClick={() => {if(window.confirm("Excluir?")) deleteDoc(doc(db, "contratos", item.id))}}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Contratos;