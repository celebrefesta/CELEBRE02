import React, { useRef, useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom"; 
import { db } from "../../firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import SignatureCanvas from "react-signature-canvas";
import "./AssinaturaContrato.css";

const AssinaturaContrato = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [searchParams] = useSearchParams();
  const isExternal = searchParams.get("external") === "true"; 
  
  // 🔥 CORREÇÃO 1: Inicializando as referências como "null" para evitar o curto-circuito
  const sigCliente = useRef(null);
  const sigAgape = useRef(null);
  
  const [contrato, setContrato] = useState(null);
  const [assinaturaGlobal, setAssinaturaGlobal] = useState(null); 
  const [carregando, setCarregando] = useState(true);
  const [status, setStatus] = useState("pronto"); 

  useEffect(() => {
    const buscarDados = async () => {
      try {
        const docSnap = await getDoc(doc(db, "contratos", id));
        if (docSnap.exists()) {
          setContrato(docSnap.data());
        } else {
          alert("Contrato não encontrado");
          navigate("/contratos");
          return;
        }

        const configRef = doc(db, "sistema", "parametros");
        const configSnap = await getDoc(configRef);
        
        if (configSnap.exists()) {
            const dadosConfig = configSnap.data();
            if (dadosConfig.assinatura) {
                setAssinaturaGlobal(dadosConfig.assinatura);
            }
        }

      } catch (err) { console.error("Erro ao buscar dados:", err); } 
      finally { setCarregando(false); }
    };
    buscarDados();
  }, [id, navigate]);

  const enviarWhatsapp = () => {
    const linkAssinatura = `${window.location.origin}/assinatura/${id}?external=true`;
    const textoBruto = `Olá ${contrato.cliente}! ✨\n\nAqui está o link para a assinatura digital do seu contrato da *Ágape Decorações*:\n\n👉 ${linkAssinatura}\n\nÉ só clicar, desenhar sua assinatura na tela e salvar!`;
    const mensagem = encodeURIComponent(textoBruto);
    const fone = contrato.telefone ? String(contrato.telefone).replace(/\D/g, "") : "";
    
    let urlZap;
    if (fone.length >= 10) {
        urlZap = `https://api.whatsapp.com/send?phone=55${fone}&text=${mensagem}`;
    } else {
        urlZap = `https://api.whatsapp.com/send?text=${mensagem}`;
    }

    window.open(urlZap, "_blank");
  };

  // 🔥 CORREÇÃO 2: Verificações seguras para limpar o quadro
  const limparCliente = () => { 
      if(sigCliente.current && typeof sigCliente.current.clear === 'function') sigCliente.current.clear(); 
  };
  const limparAgape = () => { 
      if(sigAgape.current && typeof sigAgape.current.clear === 'function') sigAgape.current.clear(); 
  };

  const salvarAssinaturas = async () => {
    let novaAssinaturaCliente = null;
    let novaAssinaturaAgape = null;

    // 🔥 CORREÇÃO 3: O PULO DO GATO. Só verifica se está vazio SE o quadro existir de fato na tela!
    if (sigCliente.current && typeof sigCliente.current.isEmpty === 'function' && !sigCliente.current.isEmpty()) {
        novaAssinaturaCliente = sigCliente.current.getCanvas().toDataURL("image/png");
    }

    if (sigAgape.current && typeof sigAgape.current.isEmpty === 'function' && !sigAgape.current.isEmpty()) {
        novaAssinaturaAgape = sigAgape.current.getCanvas().toDataURL("image/png");
    }

    if (!novaAssinaturaCliente && !novaAssinaturaAgape) {
        alert("⚠️ Faça sua assinatura antes de salvar!");
        return;
    }

    setStatus("salvando");

    try {
      const docRef = doc(db, "contratos", id);
      const atualizacao = {};

      if (novaAssinaturaCliente) atualizacao.assinaturaCliente = novaAssinaturaCliente;
      if (novaAssinaturaAgape) atualizacao.assinaturaAgape = novaAssinaturaAgape;

      if (!contrato.assinaturaAgape && assinaturaGlobal) {
          atualizacao.assinaturaAgape = assinaturaGlobal;
      }

      const temCliente = contrato.assinaturaCliente || novaAssinaturaCliente;
      const temAgape = contrato.assinaturaAgape || novaAssinaturaAgape || assinaturaGlobal;

      if (temCliente && temAgape) {
          atualizacao.status = "Assinado";
          atualizacao.dataAssinatura = new Date().toISOString();
      }

      await updateDoc(docRef, atualizacao);

      setStatus("sucesso");
      setTimeout(() => {
        alert("✅ Assinatura salva com sucesso!");
        window.location.reload(); 
      }, 500);

    } catch (error) {
      console.error(error);
      setStatus("erro");
      alert("❌ Erro ao salvar.");
    }
  };

  if (carregando) return <div className="loading-screen">Carregando dados...</div>;

  const imagemAgape = contrato?.assinaturaAgape || assinaturaGlobal;

  return (
    <div className="assinatura-container">
      <div className="assinatura-card">
        
        {!isExternal && (
          <div className="topo-card-acoes">
            <button className="btn-voltar-assinatura" onClick={() => navigate("/contratos")}>
              ← Voltar
            </button>
            
            {(imagemAgape && !contrato?.assinaturaCliente) && (
              <button className="btn-whatsapp-direto" onClick={enviarWhatsapp}>
                <span>Enviar Link</span> <i style={{fontStyle: 'normal'}}>📱</i>
              </button>
            )}
          </div>
        )}

        <header className="assinatura-header">
          <h1>Assinatura Digital 🖋️</h1>
          <p>Contrato de <strong>{contrato?.cliente}</strong></p>
        </header>

        <div className="resumo-contrato">
          <p><strong>Evento:</strong> {contrato?.tema || "---"}</p>
          <p><strong>Data:</strong> {contrato?.dataEvento ? contrato.dataEvento.split('-').reverse().join('/') : "--/--/----"}</p>
          <p><strong>Total:</strong> R$ {Number(contrato?.valorTotal || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
        </div>

        <div className="canvas-wrapper">
          <label className="label-assinatura">✍️ ASSINATURA DO CLIENTE ({contrato?.cliente}):</label>
          {contrato?.assinaturaCliente ? (
             <div className="assinatura-trancada">
                 <div className="selo-ok">✅ ASSINADO E TRAVADO</div>
                 <img src={contrato.assinaturaCliente} alt="Assinatura Cliente" />
             </div>
          ) : (
            <>
              <div className="canvas-border">
                <SignatureCanvas ref={sigCliente} penColor="#0f172a" canvasProps={{ className: "sigCanvas" }} backgroundColor="transparent" />
              </div>
              <button className="btn-limpar" onClick={limparCliente}>Limpar / Refazer</button>
            </>
          )}
        </div>

        <div className="canvas-wrapper agape-wrapper">
          <label className="label-assinatura ouro">✍️ ASSINATURA ÁGAPE DECORAÇÕES:</label>
          {imagemAgape ? (
             <div className="assinatura-trancada ouro-border">
                 <div className="selo-ok">✅ ASSINATURA PADRÃO</div>
                 <img src={imagemAgape} alt="Assinatura Ágape" />
             </div>
          ) : (
            <>
              <div className="canvas-border ouro-border">
                <SignatureCanvas ref={sigAgape} penColor="#b48a3c" canvasProps={{ className: "sigCanvas" }} backgroundColor="transparent" />
              </div>
              <button className="btn-limpar" onClick={limparAgape}>Limpar / Refazer</button>
            </>
          )}
        </div>

        {!contrato?.assinaturaCliente ? (
            <button 
              className="btn-confirmar-assinatura" 
              onClick={salvarAssinaturas}
              disabled={status !== "pronto" && status !== "erro"}
              style={{ backgroundColor: status === "sucesso" ? "#22c55e" : "#0f172a", opacity: status === "salvando" ? 0.7 : 1 }}
            >
              {status === "pronto" && "SALVAR ASSINATURA DO CLIENTE"}
              {status === "salvando" && "⏳ SALVANDO..."}
              {status === "sucesso" && "✅ SUCESSO!"}
              {status === "erro" && "ERRO - TENTE NOVAMENTE"}
            </button>
        ) : (
            <div className="contrato-finalizado-alerta">🎉 Contrato 100% Finalizado e Assinado!</div>
        )}
      </div>
    </div>
  );
};

export default AssinaturaContrato;