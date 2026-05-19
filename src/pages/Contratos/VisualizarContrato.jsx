import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../firebaseConfig";
import { doc, getDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import "./VisualizarContrato.css";

const VisualizarContrato = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // 🔥 Autenticação e Chave Mestra
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [contrato, setContrato] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const [carregando, setCarregando] = useState(true);

  // 🔥 SISTEMA DE AUDITORIA (ESPIÃO VINCULADO À EMPRESA)
  const registrarLog = async (acao, detalhes) => {
    if (!usuarioLogado) return;
    try {
      const nomeEquipa = localStorage.getItem('funcName') || usuarioLogado?.displayName || usuarioLogado?.email || "Equipa";
      await addDoc(collection(db, "logs_atividades"), {
        data: new Date(),
        criadoEm: serverTimestamp(),
        funcionario: nomeEquipa,
        usuarioNome: nomeEquipa,
        usuarioEmail: usuarioLogado?.email || "Desconhecido",
        acao: acao.toUpperCase(),
        detalhes: detalhes,
        userId: tenantId, // 🎯 SALVA VINCULADO À EMPRESA
        empresaId: tenantId,
        funcionarioId: usuarioLogado?.uid
      });
    } catch (error) {
      console.error("Erro ao gravar log da auditoria:", error);
    }
  };

  useEffect(() => {
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }

    const buscarDados = async () => {
      try {
        // Busca o Contrato
        const docSnap = await getDoc(doc(db, "contratos", id));
        if (docSnap.exists()) {
          const data = docSnap.data();

          // 🔥 BLINDAGEM: Verifica se o contrato pertence à sua empresa
          if (data.userId && data.userId !== tenantId) {
              alert("Acesso negado: Este contrato pertence a outra empresa.");
              navigate('/contratos');
              return;
          }

          setContrato(data);
          
          // Regista que o documento oficial foi aberto para visualização/impressão
          await registrarLog("VISUALIZAÇÃO DE CONTRATO", `Acessou o documento oficial do contrato de "${data.cliente}".`);

        } else {
          alert("Contrato não encontrado!");
          navigate("/contratos");
          return;
        }

        // 🔥 BLINDAGEM: Busca os dados da Empresa (Logo, CNPJ, etc) no cofre principal
        const configSnap = await getDoc(doc(db, "configuracoes_empresa", tenantId));
        if (configSnap.exists()) {
            setEmpresa(configSnap.data());
        }
      } catch (err) {
        console.error("Erro ao carregar documento:", err);
      } finally {
        setCarregando(false);
      }
    };
    
    buscarDados();
  }, [id, navigate, usuarioLogado, tenantId]);

  const handleImprimir = async () => {
    await registrarLog("IMPRESSÃO DE CONTRATO", `Gerou a impressão ou salvou o PDF via navegador do contrato de "${contrato?.cliente}".`);
    window.print();
  };

  if (carregando) return <div className="loading-screen">Gerando documento...</div>;

  // 🔥 NOME DINÂMICO DA EMPRESA
  const nomeEmpresaDinamico = empresa?.nomeEmpresa || empresa?.nome || "Sua Empresa";

  return (
    <div className="visualizar-container">
      <div className="acoes-flutuantes">
        <button className="btn-voltar" onClick={() => navigate("/contratos")}>← Voltar</button>
        <button className="btn-imprimir" onClick={handleImprimir}>🖨️ Imprimir / Salvar PDF</button>
      </div>

      {/* A FOLHA A4 VIRTUAL */}
      <div className="documento-a4">
        
        {/* CABEÇALHO DO DOCUMENTO */}
        <header className="doc-header">
          <div className="doc-empresa-info">
            <h2>{nomeEmpresaDinamico.toUpperCase()}</h2>
            <p>{empresa?.cnpj ? `CNPJ: ${empresa.cnpj}` : ""}</p>
            <p>{empresa?.telefone ? `WhatsApp: ${empresa.telefone}` : ""}</p>
            <p>{empresa?.endereco || ""}</p>
          </div>
          {empresa?.logotipo && (
            <div className="doc-logo">
              <img src={empresa.logotipo} alt="Logo Empresa" />
            </div>
          )}
        </header>

        <hr className="doc-divisor" />

        <h1 className="doc-titulo">CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h1>

        {/* RESUMO DO EVENTO */}
        <div className="doc-resumo-caixa">
          <p><strong>CONTRATANTE:</strong> {contrato.cliente}</p>
          <p><strong>EVENTO / TEMA:</strong> {contrato.tema || "Não informado"}</p>
          <p><strong>DATA DO EVENTO:</strong> {contrato.dataEvento ? contrato.dataEvento.split('-').reverse().join('/') : "--/--/----"}</p>
          <p><strong>LOCAL:</strong> {contrato.endereco || "Não informado"}</p>
          <p><strong>VALOR TOTAL:</strong> R$ {Number(contrato.valorTotal || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
        </div>

        {/* CLÁUSULAS */}
        <div className="doc-clausulas">
          {contrato.descricao ? contrato.descricao : "Nenhum termo ou cláusula adicionada a este contrato."}
        </div>

        {/* ÁREA DE ASSINATURAS */}
        <div className="doc-assinaturas-area">
          <div className="box-assinatura">
            {contrato.assinaturaCliente ? (
              <img src={contrato.assinaturaCliente} alt="Assinatura Cliente" className="img-assinatura" />
            ) : (
              <div className="linha-em-branco"></div>
            )}
            <p><strong>{contrato.cliente}</strong></p>
            <span>Contratante</span>
          </div>

          <div className="box-assinatura">
            {contrato.assinaturaAgape ? (
              <img src={contrato.assinaturaAgape} alt="Assinatura Empresa" className="img-assinatura" />
            ) : (
              <div className="linha-em-branco"></div>
            )}
            <p><strong>{nomeEmpresaDinamico}</strong></p>
            <span>Contratada</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default VisualizarContrato;