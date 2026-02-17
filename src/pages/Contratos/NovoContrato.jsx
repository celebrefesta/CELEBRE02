import React, { useState, useEffect } from "react";
import { db } from "../../firebaseConfig";
import { collection, getDocs, query, orderBy, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf"; // Garanta que instalou: npm install jspdf
import "./Contratos.css";

const Contratos = () => {
  const [contratos, setContratos] = useState([]);
  const navigate = useNavigate();

  // Escuta os contratos em tempo real
  useEffect(() => {
    const q = query(collection(db, "contratos"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setContratos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  // --- FUNÇÃO GERAR PDF ---
  const gerarPDF = (contrato) => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.text("CONTRATO DE LOCAÇÃO - ÁGAPE DECORAÇÕES", 105, 20, null, null, "center");
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Cliente: ${contrato.cliente}`, 20, 40);
    doc.text(`Data do Evento: ${contrato.dataEvento || "--/--/----"}`, 20, 50);
    doc.text(`Tema: ${contrato.tema || "Não informado"}`, 20, 60);
    doc.text(`Valor Total: R$ ${Number(contrato.valorTotal).toFixed(2)}`, 20, 70);
    
    doc.text("Descrição dos Itens:", 20, 90);
    const splitItens = doc.splitTextToSize(contrato.descricao || "Sem descrição", 170);
    doc.text(splitItens, 20, 100);

    doc.save(`Contrato_${contrato.cliente}.pdf`);
  };

  return (
    <div className="contratos-container">
      <div className="header-top">
        <div>
          <h1>Gestão de Contratos</h1>
          <p>Visualize e gerencie os documentos da Ágape Decorações.</p>
        </div>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => navigate("/novo-contrato")}>
            + Criar Novo Contrato
          </button>
        </div>
      </div>

      <div className="lista-container">
        <table className="tabela-contratos">
          <thead>
            <tr>
              <th>CLIENTE</th>
              <th>TEMA</th>
              <th>DATA EVENTO</th>
              <th>STATUS</th>
              <th style={{textAlign: 'center'}}>AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {contratos.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.cliente}</strong></td>
                <td>{item.tema || "-"}</td>
                <td>{item.dataEvento}</td>
                <td>
                  <span className={`status-badge ${item.status?.toLowerCase().replace(" ", "-")}`}>
                    {item.status}
                  </span>
                </td>
                <td style={{textAlign: 'center'}}>
                  {/* TROCADO VISUALIZAR POR EDITAR */}
                  <button 
                    className="btn-icon" 
                    onClick={() => navigate(`/editar-contrato/${item.id}`)}
                    title="Editar Contrato"
                  >
                    ✏️
                  </button>
                  
                  {/* BOTÃO GERAR PDF FUNCIONAL */}
                  <button 
                    className="btn-icon pdf" 
                    onClick={() => gerarPDF(item)}
                    title="Gerar PDF"
                  >
                    📄
                  </button>

                  <button 
                    className="btn-icon" 
                    onClick={() => {if(window.confirm("Excluir?")) deleteDoc(doc(db, "contratos", item.id))}}
                  >
                    🗑️
                  </button>
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