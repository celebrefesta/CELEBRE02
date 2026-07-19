import React, { useState, useEffect } from "react";
import { db } from "../../firebaseConfig";
import { collection, query, onSnapshot, deleteDoc, doc, where, getDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth"; 
import jsPDF from "jspdf"; 
import "./Contratos.css";

const Contratos = () => {
  const [contratos, setContratos] = useState([]);
  const [menuAberto, setMenuAberto] = useState(null);
  const [dadosEmpresa, setDadosEmpresa] = useState({ nomeEmpresa: 'Sua Empresa' });
  const navigate = useNavigate();

  // 🔥 Autenticação e Chave Mestra
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  // 🔥 SISTEMA DE AUDITORIA (ESPIÃO DE CONTRATOS VINCULADO À EMPRESA)
  const registrarLog = async (acao, detalhes) => {
    if (!usuarioLogado) return;
    try {
      const nomeEquipa = localStorage.getItem('funcName') || usuarioLogado?.displayName || usuarioLogado?.email || "Equipe";
      await addDoc(collection(db, "logs_atividades"), {
        empresaId: tenantId,
        userId: tenantId,
        funcionarioId: usuarioLogado?.uid,
        nomeFuncionario: nomeEquipa,
        usuarioEmail: usuarioLogado?.email || "Desconhecido",
        acao: acao.toUpperCase(),
        detalhes: detalhes,
        dataHora: new Date().toISOString(),
        criadoEm: serverTimestamp()
      });
    } catch (error) {
      console.error("Erro ao gravar log de contratos:", error);
    }
  };

  // Fecha o menu se clicar fora dele
  useEffect(() => {
    const fecharMenu = () => setMenuAberto(null);
    window.addEventListener('click', fecharMenu);
    return () => window.removeEventListener('click', fecharMenu);
  }, []);

  // Monitora os contratos e busca os dados da empresa
  useEffect(() => {
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }

    // 1. Busca as configurações da empresa para o PDF usando o tenantId
    const fetchConfig = async () => {
        try {
            const snap = await getDoc(doc(db, "configuracoes_empresa", tenantId));
            if (snap.exists()) {
                setDadosEmpresa({ nomeEmpresa: snap.data().nomeEmpresa || snap.data().nome || 'Sua Empresa' });
            }
        } catch (e) { console.error("Erro ao buscar dados da empresa", e); }
    };
    fetchConfig();

    // 2. 🔥 BLINDAGEM MULTI-EMPRESA: Busca APENAS os contratos da empresa
    const q = query(collection(db, "contratos"), where("userId", "==", tenantId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let lista = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Ordenação em memória para evitar erros de Índice no Firebase
      lista.sort((a, b) => {
         const dataA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
         const dataB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
         return dataB - dataA;
      });
      
      setContratos(lista);
    });

    return () => unsubscribe();
  }, [usuarioLogado, navigate, tenantId]);

  // Alterna a visibilidade do menu de um item específico
  const toggleMenu = (e, id) => {
    e.stopPropagation();
    setMenuAberto(menuAberto === id ? null : id);
  };

  const handleExcluir = async (id, clienteNome) => {
    if(window.confirm("ATENÇÃO: Deseja realmente excluir este contrato?")) {
      try {
        await deleteDoc(doc(db, "contratos", id));
        await registrarLog("EXCLUSÃO DE CONTRATO", `Excluiu permanentemente o contrato do cliente: ${clienteNome}.`);
      } catch (error) {
        console.error("Erro ao excluir contrato", error);
        alert("Erro ao excluir o contrato.");
      }
    }
  };

  // FUNÇÃO: Gerar PDF Completo (Com Assinaturas)
  const gerarPDF = async (item) => {
    const docPdf = new jsPDF();
    const margin = 20;
    let y = 20; 
    const pageHeight = docPdf.internal.pageSize.height;
    const pageWidth = docPdf.internal.pageSize.width;

    // --- CABEÇALHO ---
    docPdf.setFillColor(241, 245, 249);
    docPdf.rect(0, 0, pageWidth, 40, 'F'); 
    
    docPdf.setTextColor(15, 23, 42); 
    docPdf.setFontSize(22);
    docPdf.setFont("helvetica", "bold");
    
    // 🔥 PDF DINÂMICO: Usa o nome da sua empresa configurada
    docPdf.text(dadosEmpresa.nomeEmpresa.toUpperCase(), 105, 20, null, null, "center");
    
    docPdf.setFontSize(10);
    docPdf.setFont("helvetica", "normal");
    docPdf.text("Locação de Peças e Decoração de Eventos", 105, 28, null, null, "center");
    
    y = 55;

    // --- DADOS DO CLIENTE ---
    docPdf.setDrawColor(200); 
    docPdf.setFillColor(255, 255, 255);
    docPdf.roundedRect(margin, 45, 170, 45, 3, 3);

    const dataFormatada = item.dataEvento ? item.dataEvento.split('-').reverse().join('/') : "--/--/----";
    const valorFormatado = Number(item.valorTotal || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});

    // Linha 1
    docPdf.setFontSize(10);
    docPdf.setFont("helvetica", "bold");
    docPdf.text("LOCATÁRIO(A):", margin + 5, y);
    docPdf.setFont("helvetica", "normal");
    docPdf.text((item.cliente || "Consumidor").toUpperCase(), margin + 35, y);
    
    // Linha 2
    y += 10;
    docPdf.setFont("helvetica", "bold");
    docPdf.text("DATA DO EVENTO:", margin + 5, y);
    docPdf.text(dataFormatada, margin + 42, y);
    
    docPdf.text("VALOR TOTAL:", margin + 90, y);
    docPdf.setTextColor(5, 150, 105); 
    docPdf.text(valorFormatado, margin + 120, y);
    docPdf.setTextColor(0); 

    // Linha 3
    y += 10;
    docPdf.setFont("helvetica", "bold");
    docPdf.text("ENDEREÇO:", margin + 5, y);
    docPdf.setFont("helvetica", "normal");
    docPdf.text(item.endereco || "Local a definir / Retirada", margin + 30, y);
    y += 25; 

    // --- CORPO DO TEXTO ---
    docPdf.setFontSize(12);
    docPdf.setFont("helvetica", "bold");
    docPdf.text("DESCRIÇÃO DOS ITENS E TERMOS DE LOCAÇÃO", 105, y, null, null, "center");
    docPdf.line(margin, y + 2, 190, y + 2);
    y += 10;
    
    docPdf.setFont("helvetica", "normal");
    docPdf.setFontSize(10);
    
    const textoCompleto = item.descricao || "Nenhuma descrição informada.";
    const linhas = docPdf.splitTextToSize(textoCompleto, 170);

    linhas.forEach(linha => {
        if (y > pageHeight - 50) { 
            docPdf.addPage(); 
            y = 20; 
            docPdf.setFontSize(8);
            docPdf.text(`Contrato - ${item.cliente} (Continuação)`, 105, 10, null, null, "center");
            docPdf.setFontSize(10);
        }
        docPdf.text(linha, margin, y);
        y += 5; 
    });

    // --- ASSINATURAS (DUPLAS) ---
    if (y > pageHeight - 60) {
        docPdf.addPage();
        y = 40;
    } else {
        y += 30;
    }

    // Assinatura Ágape/Empresa (Esquerda)
    if (item.assinaturaAgape) {
        try {
            docPdf.addImage(item.assinaturaAgape, 'PNG', margin + 15, y - 15, 50, 15);
        } catch (e) { console.error("Erro img Empresa", e); }
    }

    // Assinatura Cliente (Direita)
    if (item.assinaturaCliente) {
        try {
            docPdf.addImage(item.assinaturaCliente, 'PNG', margin + 105, y - 15, 50, 15);
        } catch (e) { console.error("Erro img Cliente", e); }
    }
    
    // Linhas
    docPdf.setDrawColor(0);
    docPdf.line(margin + 10, y, margin + 80, y); 
    docPdf.line(margin + 100, y, margin + 170, y); 
    
    y += 5;
    docPdf.setFontSize(9);
    docPdf.setFont("helvetica", "bold");
    
    // 🔥 PDF DINÂMICO
    docPdf.text(dadosEmpresa.nomeEmpresa.toUpperCase(), margin + 20, y);
    docPdf.text("LOCATÁRIO(A)", margin + 115, y);
    y += 10;
    docPdf.setFont("helvetica", "normal");

    // Verifica data
    const dataEmissao = new Date().toLocaleDateString('pt-BR');
    const infoData = item.dataAssinatura 
        ? `Assinado digitalmente em: ${new Date(item.dataAssinatura).toLocaleDateString('pt-BR')}`
        : `Emitido para conferência em: ${dataEmissao}`;
    docPdf.text(infoData, 105, y, null, null, "center");

    const nomeArquivoSeguro = dadosEmpresa.nomeEmpresa.replace(/[^a-z0-9]/gi, '_');
    docPdf.save(`Contrato_${nomeArquivoSeguro}_${item.cliente}.pdf`);
    
    // 🔥 REGISTRA NO ESPIÃO
    await registrarLog("EXPORTAÇÃO DE CONTRATO", `Gerou o PDF do contrato do cliente: ${item.cliente}.`);
    
    setMenuAberto(null); // Fecha o menu após a ação
  };

  return (
    <div className="contratos-container">
      <div className="header-top">
        <div>
          <h1>Gestão de Contratos</h1>
          <p>Documentos profissionais da {dadosEmpresa.nomeEmpresa}.</p>
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
                        
                        <button onClick={() => navigate(`/visualizar/${item.id}`)}>
                          👁️ Visualizar
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
                          onClick={() => handleExcluir(item.id, item.cliente)}
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