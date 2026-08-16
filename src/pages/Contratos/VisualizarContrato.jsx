import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../firebaseConfig";
import { doc, getDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import logoCelebrePadrao from "../../assets/LOGO_CELEBRE.png";
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
          
          // Registra visualização
          await registrarLog("VISUALIZAÇÃO DE CONTRATO", `Acessou o documento oficial do contrato de "${data.cliente}".`);
        } else {
          alert("Contrato não encontrado!");
          navigate("/contratos");
          return;
        }

        // 🔥 BLINDAGEM: Busca os dados completos da Empresa
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
    await registrarLog("IMPRESSÃO DE CONTRATO", `Gerou a impressão ou salvou o PDF do contrato de "${contrato?.cliente}".`);
    window.print();
  };

  if (carregando) return <div className="loading-screen">Gerando documento oficial...</div>;
  if (!contrato) return null;

  // 🔥 DADOS DA EMPRESA FORMATADOS
  const nomeEmpresa = empresa?.nomeEmpresa || empresa?.nomeFantasia || empresa?.nome || "CELEBRE FESTAS & EVENTOS";
  const cnpjEmpresa = empresa?.cnpj ? `CNPJ: ${empresa.cnpj}` : "";
  const telEmpresa = empresa?.telefone || empresa?.celular || empresa?.whatsapp || "";
  const emailEmpresa = empresa?.emailEmpresa || empresa?.email || "";
  const enderecoEmpresa = empresa?.endereco || [
    empresa?.rua, 
    empresa?.numero ? `nº ${empresa.numero}` : '', 
    empresa?.bairro, 
    empresa?.cidade ? `${empresa.cidade}/${empresa.uf || ''}` : ''
  ].filter(Boolean).join(' - ');
  const logoEmpresa = empresa?.logotipo || logoCelebrePadrao;

  // 🔥 DATAS E ENDEREÇO DO EVENTO
  const dtEvento = contrato.dataEvento ? contrato.dataEvento.split('-').reverse().join('/') : "--/--/----";
  const dtRetirada = contrato.dataRetirada ? contrato.dataRetirada.split('-').reverse().join('/') : dtEvento;
  const dtDevolucao = contrato.dataDevolucao ? contrato.dataDevolucao.split('-').reverse().join('/') : dtEvento;
  const enderecoEvento = contrato.endereco || "Endereço acordado na reserva";

  return (
    <div className="visualizar-container">
      <div className="acoes-flutuantes">
        <button className="btn-voltar" onClick={() => navigate("/contratos")}>← Voltar</button>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-imprimir" onClick={handleImprimir}>
            🖨️ Imprimir / Salvar PDF (2 Folhas - Frente e Verso)
          </button>
        </div>
      </div>

      {/* A FOLHA A4 VIRTUAL COM DESIGN CORPORATIVO */}
      <div className="documento-a4">
        
        {/* CABEÇALHO COM LOGO E DADOS DA EMPRESA */}
        <header className="doc-header-luxury">
          <div className="doc-empresa-info">
            <h2 className="doc-empresa-nome">{nomeEmpresa.toUpperCase()}</h2>
            <div className="doc-empresa-metas">
              {cnpjEmpresa && <span>{cnpjEmpresa}</span>}
              {telEmpresa && <span> • Tel/WhatsApp: {telEmpresa}</span>}
              {emailEmpresa && <span> • {emailEmpresa}</span>}
            </div>
            {enderecoEmpresa && (
              <p className="doc-empresa-endereco">📍 {enderecoEmpresa}</p>
            )}
          </div>

          <div className="doc-logo-box">
            <img src={logoEmpresa} alt="Logo da Empresa" className="doc-logo-img" />
          </div>
        </header>

        <div className="doc-faixa-dourada"></div>

        <h1 className="doc-titulo-principal">
          INSTRUMENTO PARTICULAR DE LOCAÇÃO DE BENS MÓVEIS E ACERVO PARA EVENTOS
        </h1>

        {/* RESUMO EXECUTIVO DO EVENTO E CLIENTE */}
        <div className="doc-resumo-grid">
          <div className="doc-resumo-item full">
            <span className="doc-label">LOCATÁRIO(A):</span>
            <span className="doc-valor"><strong>{contrato.cliente || "Não informado"}</strong> {contrato.cpf ? `(CPF/CNPJ: ${contrato.cpf})` : ""}</span>
          </div>

          <div className="doc-resumo-item">
            <span className="doc-label">WHATSAPP / CONTATO:</span>
            <span className="doc-valor">{contrato.telefone || "Não informado"}</span>
          </div>

          <div className="doc-resumo-item">
            <span className="doc-label">TEMA DA CELEBRAÇÃO:</span>
            <span className="doc-valor">{contrato.tema || "Celebração Geral"}</span>
          </div>

          <div className="doc-resumo-item">
            <span className="doc-label">DATA DO EVENTO:</span>
            <span className="doc-valor"><strong>{dtEvento}</strong></span>
          </div>

          <div className="doc-resumo-item">
            <span className="doc-label">RETIRADA &amp; DEVOLUÇÃO:</span>
            <span className="doc-valor">{dtRetirada} ➔ {dtDevolucao} {contrato.horario ? `(${contrato.horario})` : ''}</span>
          </div>

          <div className="doc-resumo-item full">
            <span className="doc-label">ENDEREÇO DO EVENTO:</span>
            <span className="doc-valor">{enderecoEvento}</span>
          </div>

          <div className="doc-resumo-item full doc-valor-destaque-box">
            <span className="doc-label">VALOR TOTAL DA LOCAÇÃO:</span>
            <span className="doc-valor-moeda">
              R$ {Number(contrato.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* CORPO DO CONTRATO / MINUTA E CLÁUSULAS */}
        <div className="doc-clausulas-texto">
          {contrato.descricao ? contrato.descricao : "Relação de itens e cláusulas contratuais conforme termo firmado."}
        </div>

        {/* ÁREA DE ASSINATURAS NO FINAL */}
        <div className="doc-assinaturas-area">
          <div className="box-assinatura">
            {contrato.assinaturaCliente ? (
              <img src={contrato.assinaturaCliente} alt="Assinatura Locatário" className="img-assinatura" />
            ) : (
              <div className="linha-em-branco"></div>
            )}
            <p className="nome-signatario"><strong>{contrato.cliente}</strong></p>
            <span className="cargo-signatario">LOCATÁRIO(A)</span>
            {contrato.cpf && <span className="doc-signatario">Doc: {contrato.cpf}</span>}
          </div>

          <div className="box-assinatura">
            {contrato.assinaturaAgape || empresa?.assinatura ? (
              <img src={contrato.assinaturaAgape || empresa?.assinatura} alt="Assinatura Locadora" className="img-assinatura" />
            ) : (
              <div className="linha-em-branco"></div>
            )}
            <p className="nome-signatario"><strong>{nomeEmpresa}</strong></p>
            <span className="cargo-signatario">LOCADORA</span>
            {empresa?.cnpj && <span className="doc-signatario">{empresa.cnpj}</span>}
          </div>
        </div>

      </div>
    </div>
  );
};

export default VisualizarContrato;