import React, { useState, useEffect } from "react";
import { db } from "../../firebaseConfig";
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf"; 
import "./Contratos.css";

const Contratos = () => {
  const [contratos, setContratos] = useState([]);
  const [menuAberto, setMenuAberto] = useState(null); // Estado para controlar qual menu está aberto
  const navigate = useNavigate();

  // Fecha o menu se clicar fora dele
  useEffect(() => {
    const fecharMenu = () => setMenuAberto(null);
    window.addEventListener('click', fecharMenu);
    return () => window.removeEventListener('click', fecharMenu);
  }, []);

  // Monitora os contratos em tempo real
  useEffect(() => {
    const q = query(collection(db, "contratos"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setContratos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  // Alterna a visibilidade do menu de um item específico
  const toggleMenu = (e, id) => {
    e.stopPropagation(); // Impede que o evento de clique feche o menu imediatamente
    setMenuAberto(menuAberto === id ? null : id);
  };

  // FUNÇÃO: Enviar Link no WhatsApp
  const enviarNoZap = (contrato) => {
    const urlBase = window.location.origin; 
    const linkAssinatura = `${urlBase}/assinatura/${contrato.id}`;
    
    const texto = `Olá ${contrato.cliente}, tudo bem? 👋\n\nAqui está o link do seu contrato digital da Ágape Decorações.\n\nPor favor, clique para revisar e assinar:\n${linkAssinatura}`;
    
    const linkZap = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(linkZap, '_blank');
    setMenuAberto(null); // Fecha o menu após a ação
  };

  // FUNÇÃO: Gerar PDF Completo (Com Assinaturas)
  const gerarPDF = (item) => {
    const doc = new jsPDF();
    
    const margin = 20;
    let y = 20; 
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    
    // --- CABEÇALHO ---
    doc.setFillColor(241, 245, 249);
    doc.rect(0, 0, pageWidth, 40, 'F'); 
    
    doc.setTextColor(15, 23, 42); 
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("ÁGAPE DECORAÇÕES", 105, 20, null, null, "center");
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Locação de Peças e Decoração de Eventos", 105, 28, null, null, "center");
    
    y = 55;

    // --- DADOS DO CLIENTE ---
    doc.setDrawColor(200); 
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, 45, 170, 45, 3, 3); 
    
    const dataFormatada = item.dataEvento ? item.dataEvento.split('-').reverse().join('/') : "--/--/----";
    const valorFormatado = Number(item.valorTotal || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
    
    // Linha 1
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("LOCATÁRIO(A):", margin + 5, y);
    doc.setFont("helvetica", "normal");
    doc.text((item.cliente || "Consumidor").toUpperCase(), margin + 35, y);
    
    // Linha 2
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text("DATA DO EVENTO:", margin + 5, y);
    doc.text(dataFormatada, margin + 42, y);
    
    doc.text("VALOR TOTAL:", margin + 90, y);
    doc.setTextColor(5, 150, 105); 
    doc.text(valorFormatado, margin + 120, y);
    doc.setTextColor(0); 

    // Linha 3
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.text("ENDEREÇO:", margin + 5, y);
    doc.setFont("helvetica", "normal");
    doc.text(item.endereco || "Local a definir / Retirada", margin + 30, y);
    
    y += 25; 

    // --- CORPO DO TEXTO ---
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("DESCRIÇÃO DOS ITENS E TERMOS DE LOCAÇÃO", 105, y, null, null, "center");
    doc.line(margin, y + 2, 190, y + 2); 
    y += 10;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    
    const textoCompleto = item.descricao || "Nenhuma descrição informada.";
    const linhas = doc.splitTextToSize(textoCompleto, 170);
    
    linhas.forEach(linha => {
        if (y > pageHeight - 50) { 
            doc.addPage(); 
            y = 20; 
            doc.setFontSize(8);
            doc.text(`Contrato - ${item.cliente} (Continuação)`, 105, 10, null, null, "center");
            doc.setFontSize(10);
        }
        doc.text(linha, margin, y);
        y += 5; 
    });
    
    // --- ASSINATURAS (DUPLAS) ---
    if (y > pageHeight - 60) {
        doc.addPage();
        y = 40;
    } else {
        y += 30; 
    }

    // Assinatura Ágape (Esquerda)
    if (item.assinaturaAgape) {
        try {
            doc.addImage(item.assinaturaAgape, 'PNG', margin + 15, y - 15, 50, 15);
        } catch (e) { console.error("Erro img Agape", e); }
    }

    // Assinatura Cliente (Direita)
    if (item.assinaturaCliente) {
        try {
            doc.addImage(item.assinaturaCliente, 'PNG', margin + 105, y - 15, 50, 15);
        } catch (e) { console.error("Erro img Cliente", e); }
    }
    
    // Linhas
    doc.setDrawColor(0);
    doc.line(margin + 10, y, margin + 80, y); 
    doc.line(margin + 100, y, margin + 170, y); 
    
    y += 5;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("ÁGAPE DECORAÇÕES", margin + 20, y);
    doc.text("LOCATÁRIO(A)", margin + 115, y);
    
    y += 10;
    doc.setFont("helvetica", "normal");
    
    // Verifica data
    const dataEmissao = new Date().toLocaleDateString('pt-BR');
    const infoData = item.dataAssinatura 
        ? `Assinado digitalmente em: ${new Date(item.dataAssinatura).toLocaleDateString('pt-BR')}`
        : `Emitido para conferência em: ${dataEmissao}`;

    doc.text(infoData, 105, y, null, null, "center");

    doc.save(`Contrato_${item.cliente}.pdf`);
    setMenuAberto(null); // Fecha o menu após a ação
  };

  return (
    <div className="contratos-container">
      <div className="header-top">
        <div>
          <h1>Gestão de Contratos</h1>
          <p>Documentos profissionais da Ágape Decorações.</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={() => navigate("/modelos-contrato")}>
            📄 Gerenciar Modelos
          </button>
          <button className="btn-primary" onClick={() => navigate("/novo-contrato")}>
            + Criar Novo Contrato
          </button>
        </div>
      </div>

      <div className="lista-container">
        {contratos.length === 0 ? (
          <div className="empty-state-list">
            <p>Nenhum contrato gerado ainda.</p>
          </div>
        ) : (
          <table className="tabela-contratos">
            <thead>
              <tr>
                <th>CLIENTE</th>
                <th>DATA EVENTO</th>
                <th>VALOR</th>
                <th>STATUS</th>
                <th style={{textAlign: 'center', width: '80px'}}>AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {contratos.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.cliente}</strong>
                    <br/><small>{item.tema}</small>
                  </td>
                  <td>{item.dataEvento ? item.dataEvento.split('-').reverse().join('/') : "--/--/----"}</td>
                  <td>{Number(item.valorTotal).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</td>
                  <td>
                    <span className={`status-badge ${item.status?.toLowerCase().replace(" ", "-")}`}>
                      {item.status}
                    </span>
                  </td>
                  
                  {/* Célula de Ações com Menu Dropdown */}
                  <td style={{textAlign: 'center', position: 'relative'}}>
                    <button className="btn-more" onClick={(e) => toggleMenu(e, item.id)}>
                      ⋮
                    </button>

                    {/* Menu Dropdown Condicional */}
                    {menuAberto === item.id && (
                      <div className="dropdown-menu">
                        <button onClick={() => navigate(`/editar-contrato/${item.id}`)}>
                          ✏️ Editar
                        </button>
                        <button onClick={() => enviarNoZap(item)}>
                          📱 WhatsApp
                        </button>
                        <button onClick={() => navigate(`/assinatura/${item.id}`)}>
                          🖋️ Assinar
                        </button>
                        <button onClick={() => gerarPDF(item)}>
                          📄 PDF
                        </button>
                        <hr />
                        <button 
                          className="danger" 
                          onClick={() => {
                            if(window.confirm("Excluir contrato?")) {
                              deleteDoc(doc(db, "contratos", item.id));
                            }
                          }}
                        >
                          🗑️ Excluir
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Contratos;