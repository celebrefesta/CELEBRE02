import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { db, auth, storage } from "../../firebaseConfig";
import { collection, addDoc, getDocs, query, where, doc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { gerarReciboLancamentoPDF } from "../../utils/gerarReciboLancamentoPDF";
import "./NovoLancamento.css";

const NovoLancamento = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // 🔥 Autenticação e Chave Mestra Multi-Tenant
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const tipoInicial = location.state?.tipo || "entrada";

  const [novo, setNovo] = useState({
    tipo: tipoInicial,
    data: new Date().toISOString().split('T')[0],
    descricao: "",
    valor: "",
    categoria: tipoInicial === "entrada" ? "Locação" : "Compra para Estoque",
    centroCusto: tipoInicial === "entrada" ? "Pegue & Monte" : "Infraestrutura Galpão",
    formaPagto: "Pix",
    status: "pago",
    parcelas: 1,
    acrescimo: "",
    clienteId: "",
    clienteNome: "",
    fornecedorId: "",
    fornecedorNome: "",
    locacaoId: "",
    locacaoNumero: "",
    compraId: "",
    pecaId: "",
    pecaNome: "",
    observacoes: ""
  });

  const [valDisplay, setValDisplay] = useState("");
  const [salvando, setSalvando] = useState(false);

  // 🔁 Lançamento Recorrente
  const [isRecorrente, setIsRecorrente] = useState(false);
  const [mesesRecorrencia, setMesesRecorrencia] = useState(3);

  // 📎 Estados de Arquivo de Comprovante
  const [arquivoComprovante, setArquivoComprovante] = useState(null);
  const [previewComprovante, setPreviewComprovante] = useState(null);
  const [nomeArquivo, setNomeArquivo] = useState("");

  // 📦 Listas para Seleção (Locações, Clientes, Fornecedores, Compras, Acervo)
  const [locacoes, setLocacoes] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [compras, setCompras] = useState([]);
  const [pecasAcervo, setPecasAcervo] = useState([]);
  const [carregandoListas, setCarregandoListas] = useState(true);

  // Modal pós-salvamento (Recibo PDF & WhatsApp)
  const [ultimoLancamentoSalvo, setUltimoLancamentoSalvo] = useState(null);

  // Helper para formatar data BR (DD/MM/AAAA)
  const formatarDataBr = (strData) => {
    if (!strData) return "";
    if (typeof strData === "string" && strData.includes("-")) {
      const parts = strData.split("T")[0].split("-");
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return strData;
  };

  useEffect(() => {
    if (!usuarioLogado) {
      navigate('/login');
      return;
    }

    const carregarDadosAuxiliares = async () => {
      setCarregandoListas(true);

      // 1. Locações da Empresa
      try {
        const qLoc = query(collection(db, "locacoes"), where("userId", "==", tenantId));
        const snapLoc = await getDocs(qLoc);
        setLocacoes(snapLoc.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (errLoc) {
        console.warn("Erro ao carregar locações auxiliares:", errLoc);
      }

      // 2. Clientes da Empresa
      try {
        const qCli = query(collection(db, "clientes"), where("userId", "==", tenantId));
        const snapCli = await getDocs(qCli);
        setClientes(snapCli.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (errCli) {
        console.warn("Erro ao carregar clientes auxiliares:", errCli);
      }

      // 3. Fornecedores da Empresa
      try {
        const qForn = query(collection(db, "fornecedores"), where("userId", "==", tenantId));
        const snapForn = await getDocs(qForn);
        setFornecedores(snapForn.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (errForn) {
        console.warn("Erro ao carregar fornecedores auxiliares:", errForn);
      }

      // 4. Ordens de Compra
      try {
        const qComp = query(collection(db, "compras"), where("userId", "==", tenantId));
        const snapComp = await getDocs(qComp);
        setCompras(snapComp.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (errComp) {
        console.warn("Erro ao carregar compras auxiliares:", errComp);
      }

      // 5. Peças do Acervo / Estoque
      try {
        const qEst = query(collection(db, "estoque"), where("userId", "==", tenantId));
        const snapEst = await getDocs(qEst);
        setPecasAcervo(snapEst.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (errEst) {
        console.warn("Erro ao carregar estoque auxiliar:", errEst);
      }

      setCarregandoListas(false);
    };

    carregarDadosAuxiliares();
  }, [usuarioLogado, tenantId, navigate]);

  // 🎯 AUTO-SELEÇÃO DE PEDIDO / CLIENTE / PEÇA VIA NAVEGAÇÃO DE ATALHO (Agenda / Clientes / Locações / Estoque)
  useEffect(() => {
    if (location.state?.pecaId) {
      setNovo(prev => ({
        ...prev,
        tipo: 'saida',
        categoria: 'Manutenção e Reparos',
        centroCusto: 'Manutenção Acervo',
        pecaId: location.state.pecaId,
        pecaNome: location.state.pecaNome || prev.pecaNome,
        valor: location.state.valor || prev.valor,
        descricao: location.state.descricao || `Manutenção da Peça: ${location.state.pecaNome || ''}`
      }));
      if (location.state.valor) {
        setValDisplay(formatarMoedaInput(location.state.valor));
      }
    } else if (locacoes.length > 0) {
      const targetLocId = location.state?.locacaoId || location.state?.pedidoId;
      if (targetLocId) {
        handleLocacaoSelect(targetLocId);
      } else if (location.state?.clienteId) {
        setNovo(prev => ({
          ...prev,
          clienteId: location.state.clienteId,
          clienteNome: location.state.clienteNome || prev.clienteNome
        }));
      }
    }
  }, [locacoes, location.state]);

  // 💰 FORMATADOR DE MOEDA EM TEMPO REAL (R$)
  const formatarMoedaInput = (valorNumerico) => {
    if (!valorNumerico && valorNumerico !== 0) return "";
    return (Number(valorNumerico)).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  };

  const handleValorChange = (e) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) {
      setValDisplay("");
      setNovo(prev => ({ ...prev, valor: "" }));
      return;
    }
    const num = Number(raw) / 100;
    setNovo(prev => ({ ...prev, valor: num }));
    setValDisplay(formatarMoedaInput(num));
  };

  const adicionarValorRapido = (adicional) => {
    const valorAtual = Number(novo.valor) || 0;
    const novoValor = valorAtual + adicional;
    setNovo(prev => ({ ...prev, valor: novoValor }));
    setValDisplay(formatarMoedaInput(novoValor));
  };

  // 🧮 CALCULADORA DE TAXAS E DESCONTOS
  const aplicarDesconto = (porcentagem) => {
    const valAtual = Number(novo.valor) || 0;
    if (valAtual <= 0) return;
    const novoVal = valAtual * (1 - porcentagem / 100);
    setNovo(prev => ({ ...prev, valor: novoVal }));
    setValDisplay(formatarMoedaInput(novoVal));
  };

  const aplicarTaxa = (porcentagem) => {
    const valAtual = Number(novo.valor) || 0;
    if (valAtual <= 0) return;
    const novoVal = valAtual * (1 + porcentagem / 100);
    setNovo(prev => ({ ...prev, valor: novoVal }));
    setValDisplay(formatarMoedaInput(novoVal));
  };

  // ⚡ PREENCHIMENTO AUTOMÁTICO PELO PEDIDO
  const handleLocacaoSelect = (locId) => {
    if (!locId) {
      setNovo(prev => ({ 
        ...prev, 
        locacaoId: "", 
        locacaoNumero: "", 
        clienteId: "", 
        clienteNome: "" 
      }));
      return;
    }

    const loc = locacoes.find(l => l.id === locId);
    if (loc) {
      const total = Number(loc.valorTotal || loc.total || loc.financeiro?.total || 0);
      const jaPago = Number(loc.valorPago || 0);
      const resta = Math.max(0, total - jaPago);

      const numPed = loc.numeroPedido || loc.numero || (loc.id ? loc.id.slice(0, 6).toUpperCase() : '');
      const cliNome = loc.clienteNome || loc.nomeCliente || "";
      const cliId = loc.clienteId || "";

      const valorSugerido = resta > 0 ? resta : (total > 0 ? total : novo.valor);

      setNovo(prev => ({
        ...prev,
        locacaoId: loc.id,
        locacaoNumero: numPed,
        clienteId: cliId || prev.clienteId,
        clienteNome: cliNome || prev.clienteNome,
        valor: valorSugerido,
        descricao: `Locação Pedido #${numPed}${cliNome ? ' - ' + cliNome : ''}`
      }));

      if (valorSugerido > 0) {
        setValDisplay(formatarMoedaInput(valorSugerido));
      }
    }
  };

  // 🛒 SELEÇÃO E PREENCHIMENTO POR ORDEM DE COMPRA
  const handleCompraSelect = (compId) => {
    if (!compId) {
      setNovo(prev => ({ ...prev, compraId: "" }));
      return;
    }
    const comp = compras.find(c => c.id === compId);
    if (comp) {
      const valComp = Number(comp.valorTotal || comp.valor || 0);
      setNovo(prev => ({
        ...prev,
        compraId: comp.id,
        fornecedorId: comp.fornecedorId || prev.fornecedorId,
        fornecedorNome: comp.fornecedorNome || comp.fornecedor || prev.fornecedorNome,
        valor: valComp > 0 ? valComp : prev.valor,
        descricao: `Pagamento Compra #${comp.numero || comp.id.slice(0,6)} - ${comp.nomeItem || comp.descricao || 'Acervo'}`
      }));
      if (valComp > 0) {
        setValDisplay(formatarMoedaInput(valComp));
      }
    }
  };

  // 🛠️ SELEÇÃO DE PEÇA DO ACERVO
  const handlePecaSelect = (pId) => {
    if (!pId) {
      setNovo(prev => ({ ...prev, pecaId: "", pecaNome: "" }));
      return;
    }
    const p = pecasAcervo.find(item => item.id === pId);
    if (p) {
      setNovo(prev => ({
        ...prev,
        pecaId: p.id,
        pecaNome: p.nome || p.titulo || ""
      }));
    }
  };

  // 📎 SELEÇÃO E UPLOAD DE COMPROVANTE
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("O arquivo excede o limite máximo de 10MB.");
      return;
    }

    setArquivoComprovante(file);
    setNomeArquivo(file.name);

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => setPreviewComprovante(reader.result);
      reader.readAsDataURL(file);
    } else {
      setPreviewComprovante("pdf");
    }
  };

  const removerComprovante = () => {
    setArquivoComprovante(null);
    setPreviewComprovante(null);
    setNomeArquivo("");
  };

  // 🔥 REGISTRO DE AUDITORIA
  const registrarLog = async (acao, detalhes) => {
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

  // 💬 DISPARO DE NOTIFICAÇÃO NO WHATSAPP DO CLIENTE/FORNECEDOR
  const enviarWhatsAppComprovante = (itemSalvo) => {
    let whatsappNum = "";
    if (itemSalvo.clienteId) {
      const cli = clientes.find(c => c.id === itemSalvo.clienteId);
      whatsappNum = cli?.whatsapp || cli?.telefone || "";
    } else if (itemSalvo.fornecedorId) {
      const forn = fornecedores.find(f => f.id === itemSalvo.fornecedorId);
      whatsappNum = forn?.whatsapp || forn?.telefone || "";
    }

    const numLimpo = whatsappNum.replace(/\D/g, "");
    const valorTxt = Number(itemSalvo.valorTotal || itemSalvo.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const isEntrada = itemSalvo.tipo === 'entrada';

    let msg = `🌟 *CONFIRMAÇÃO DE ${isEntrada ? 'RECEBIMENTO' : 'PAGAMENTO'}* 🌟\n\n`;
    msg += `*Descrição:* ${itemSalvo.descricao}\n`;
    msg += `*Valor:* ${valorTxt}\n`;
    msg += `*Data:* ${formatarDataBr(itemSalvo.data)}\n`;
    msg += `*Forma de Pagamento:* ${itemSalvo.formaPagto}\n`;
    if (itemSalvo.locacaoNumero) {
      msg += `*Pedido:* #${itemSalvo.locacaoNumero}\n`;
    }
    msg += `\nAgradecemos a parceria! ✨\n*Celebre Festas & Decorações*`;

    const url = numLimpo 
      ? `https://wa.me/55${numLimpo}?text=${encodeURIComponent(msg)}` 
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    window.open(url, "_blank");
  };

  const categoriasEntrada = [
    "Locação", "Sinal / Reserva", "Frete / Deslocamento",
    "Acréscimo / Multa", "Venda de Produto", "Outros"
  ];

  const categoriasSaida = [
    "Compra para Estoque", "Manutenção / Conserto",
    "Despesas Fixas (Luz, Internet...)", "Logística / Combustível",
    "Fornecedores / Equipe", "Impostos / Taxas", "Outros"
  ];

  const centrosCustoEntrada = [
    "Pegue & Monte", "Decoração Completa", "Venda de Descartáveis", "Serviço de Frete", "Outros"
  ];

  const centrosCustoSaida = [
    "Infraestrutura Galpão", "Logística & Combustível", "Manutenção do Acervo", "Compra de Peças", "Marketing & Anúncios", "Equipe & Mão de Obra", "Impostos"
  ];

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!usuarioLogado) return alert("Erro: Utilizador não identificado.");
    if (!novo.descricao) return alert("Preencha a descrição do lançamento!");
    if (!novo.valor || Number(novo.valor) <= 0) return alert("Informe um valor válido maior que R$ 0,00!");

    setSalvando(true);
    try {
      let comprovanteUrl = null;
      let comprovanteNome = null;

      // 1. Upload do comprovante para o Firebase Storage (se houver)
      if (arquivoComprovante) {
        const fileExt = arquivoComprovante.name.split('.').pop();
        const fileNameStorage = `comprovantes/${tenantId}/${Date.now()}_comprovante.${fileExt}`;
        const storageRef = ref(storage, fileNameStorage);
        await uploadBytes(storageRef, arquivoComprovante);
        comprovanteUrl = await getDownloadURL(storageRef);
        comprovanteNome = arquivoComprovante.name;
      }

      const valorAcrescimo = Number(novo.acrescimo) || 0;
      const valorBase = Number(novo.valor);
      const valorTotalFinal = valorBase + valorAcrescimo;

      const payloadBase = {
        ...novo,
        valor: valorBase,
        acrescimo: valorAcrescimo,
        valorTotal: valorTotalFinal,
        parcelas: Number(novo.parcelas),
        comprovanteUrl: comprovanteUrl || null,
        comprovanteNome: comprovanteNome || null,
        createdAt: serverTimestamp(),
        userId: tenantId // 🔥 CADEADO DE SEGURANÇA MULTI-EMPRESA
      };

      // 2. Gravando no Firestore em financeiro_lancamentos
      if (isRecorrente && Number(mesesRecorrencia) > 1) {
        const numMeses = Number(mesesRecorrencia);
        const dataBase = new Date(novo.data + 'T12:00:00');
        const grupoRecorrenteId = `rec_${Date.now()}`;

        for (let i = 0; i < numMeses; i++) {
          const dataParcela = new Date(dataBase);
          dataParcela.setMonth(dataBase.getMonth() + i);
          const dataIso = dataParcela.toISOString().split('T')[0];

          const payloadParcela = {
            ...payloadBase,
            data: dataIso,
            descricao: `${novo.descricao} (${i + 1}/${numMeses})`,
            status: i === 0 ? novo.status : 'pendente',
            grupoRecorrenteId: grupoRecorrenteId
          };

          await addDoc(collection(db, "financeiro_lancamentos"), payloadParcela);
        }
      } else {
        await addDoc(collection(db, "financeiro_lancamentos"), payloadBase);
      }

      // 🔥 3. ABATE O VALOR NA LOCAÇÃO SE VINCULADA
      if (novo.locacaoId && novo.status === 'pago') {
        try {
          const locRef = doc(db, "locacoes", novo.locacaoId);
          const locAlvo = locacoes.find(l => l.id === novo.locacaoId);
          const valorPagoAntigo = Number(locAlvo?.valorPago || 0);
          const novoValorPagoTotal = valorPagoAntigo + valorTotalFinal;

          const nomeOperador = localStorage.getItem('funcName') || usuarioLogado?.displayName || usuarioLogado?.email || "Equipe";

          await updateDoc(locRef, {
            valorPago: novoValorPagoTotal,
            historicoPagamentos: arrayUnion({
              id: `pag_${Date.now()}`,
              valor: valorTotalFinal,
              data: novo.data,
              forma: novo.formaPagto,
              comprovanteUrl: comprovanteUrl || null,
              descricao: novo.descricao || "Recebimento Financeiro Novo Lançamento",
              registradoPor: nomeOperador,
              criadoEm: new Date().toISOString()
            })
          });
        } catch (errLoc) {
          console.error("Erro ao atualizar pagamento na locação:", errLoc);
        }
      }

      // 🔥 4. DAR BAIXA NA ORDEM DE COMPRA SE VINCULADA
      if (novo.compraId && novo.status === 'pago') {
        try {
          const compRef = doc(db, "compras", novo.compraId);
          await updateDoc(compRef, {
            statusPagamento: "Pago",
            dataPagamento: novo.data,
            formaPagto: novo.formaPagto
          });
        } catch (errComp) {
          console.error("Erro ao atualizar status da ordem de compra:", errComp);
        }
      }

      // 🔥 5. REGISTRA CUSTO DE MANUTENÇÃO NA PEÇA SE VINCULADA
      if (novo.pecaId) {
        try {
          const pecaRef = doc(db, "estoque", novo.pecaId);
          await updateDoc(pecaRef, {
            historicoConsertos: arrayUnion({
              id: `conserto_${Date.now()}`,
              valor: valorTotalFinal,
              data: novo.data,
              descricao: novo.descricao,
              comprovanteUrl: comprovanteUrl || null
            })
          });
        } catch (errPeca) {
          console.error("Erro ao registrar custo na peça do acervo:", errPeca);
        }
      }

      // 6. Registro de auditoria
      const tipoTxt = novo.tipo === 'entrada' ? 'Receita (Entrada)' : 'Despesa (Saída)';
      await registrarLog(
        "NOVO LANÇAMENTO FINANCEIRO",
        `Registrou ${isRecorrente ? mesesRecorrencia + 'x recorrentes de' : 'uma'} ${tipoTxt} de R$ ${valorTotalFinal.toFixed(2)}. Descrição: "${novo.descricao}". Forma: ${novo.formaPagto}.`
      );

      // Exibe Modal com Ações Rápidas (Recibo PDF & WhatsApp)
      setUltimoLancamentoSalvo(payloadBase);

    } catch (error) {
      console.error("Erro ao salvar lançamento:", error);
      alert("❌ Ocorreu um erro ao salvar o lançamento. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  const isEntrada = novo.tipo === 'entrada';

  return (
    <div className="pag-novo-lancamento">
      {/* CABEÇALHO DA PÁGINA */}
      <header className="header-nl">
        <button className="btn-voltar-nl" onClick={() => navigate("/financeiro")}>
          ← Voltar ao Financeiro
        </button>
        <h2>{isEntrada ? '💰 Nova Receita (Entrada)' : '📄 Nova Despesa (Saída)'}</h2>
      </header>

      <div className="nl-container">
        <div className={`nl-card ${isEntrada ? 'card-entrada' : 'card-saida'}`}>

          {/* 🖼️ HEADER DO CARD DINÂMICO COMPACTO */}
          <div className={`nl-card-banner ${isEntrada ? 'banner-entrada' : 'banner-saida'}`}>
            <div className="nl-banner-info">
              <span className={`nl-badge ${isEntrada ? 'badge-entrada' : 'badge-saida'}`}>
                {isEntrada ? '🟢 ENTRADA DE RECURSOS' : '🔴 SAÍDA DE RECURSOS'}
              </span>
              <h3>{isEntrada ? 'Cadastrar Nova Receita' : 'Cadastrar Nova Despesa'}</h3>
            </div>
            <div className="nl-tipo-selector-mini">
              <button
                type="button"
                className={`nl-tipo-btn ${isEntrada ? 'ativo-entrada' : ''}`}
                onClick={() => setNovo(prev => ({ ...prev, tipo: 'entrada', categoria: 'Locação', centroCusto: 'Pegue & Monte' }))}
              >
                🟢 ENTRADA
              </button>
              <button
                type="button"
                className={`nl-tipo-btn ${!isEntrada ? 'ativo-saida' : ''}`}
                onClick={() => setNovo(prev => ({ ...prev, tipo: 'saida', categoria: 'Compra para Estoque', centroCusto: 'Infraestrutura Galpão' }))}
              >
                🔴 SAÍDA
              </button>
            </div>
          </div>

          {/* FORMULÁRIO EM GRADE 2 COLUNAS LADO A LADO */}
          <form onSubmit={handleSalvar} className="nl-form">

            <div className="nl-grid-2col">
              
              {/* 🟢 COLUNA ESQUERDA: VALORES, DESCRIÇÃO, CATEGORIA, COMPRAS E PEÇA DO ACERVO */}
              <div className="nl-col">
                
                {/* VALOR COM MÁSCARA MONETÁRIA */}
                <div className="nl-group nl-group-valor">
                  <label>
                    Valor {novo.tipo === 'saida' && novo.formaPagto === 'Cartão de Crédito' ? 'Base (R$)' : '(R$)'} *
                  </label>
                  <div className="nl-input-valor-wrapper">
                    <input
                      type="text"
                      placeholder="R$ 0,00"
                      required
                      autoFocus
                      className={`nl-input-valor ${isEntrada ? 'entrada' : 'saida'}`}
                      value={valDisplay}
                      onChange={handleValorChange}
                    />
                  </div>

                  {/* 🔘 PÍLULAS DE ADIÇÃO RÁPIDA E 🧮 CALCULADORA DE TAXAS/DESCONTOS */}
                  <div className="nl-pilulas-valor">
                    <span className="pilula-rotulo">+ Rápido:</span>
                    <button type="button" onClick={() => adicionarValorRapido(50)}>+50</button>
                    <button type="button" onClick={() => adicionarValorRapido(100)}>+100</button>
                    <button type="button" onClick={() => adicionarValorRapido(250)}>+250</button>
                    <button type="button" onClick={() => adicionarValorRapido(500)}>+500</button>

                    <span className="pilula-divisor">|</span>

                    {/* CALCULADORA DE TAXAS E DESCONTOS */}
                    <button type="button" className="btn-calc-desc" onClick={() => aplicarDesconto(5)} title="Desconto de 5%">-5%</button>
                    <button type="button" className="btn-calc-desc" onClick={() => aplicarDesconto(10)} title="Desconto de 10%">-10%</button>
                    <button type="button" className="btn-calc-taxa" onClick={() => aplicarTaxa(3.5)} title="Taxa maquininha 3.5%">+3.5%</button>
                    <button type="button" className="btn-calc-taxa" onClick={() => aplicarTaxa(4.9)} title="Taxa maquininha 4.9%">+4.9%</button>
                  </div>
                </div>

                {/* DESCRIÇÃO / TÍTULO */}
                <div className="nl-group">
                  <label>Descrição / Título *</label>
                  <input
                    type="text"
                    placeholder={isEntrada ? "Ex: Pagamento locação Ana Silva..." : "Ex: Compra de Bexigas, Luz..."}
                    required
                    value={novo.descricao}
                    onChange={e => setNovo({ ...novo, descricao: e.target.value })}
                  />
                </div>

                {/* CATEGORIA E FORMA DE PAGAMENTO */}
                <div className="nl-subrow">
                  <div className="nl-group">
                    <label>Categoria *</label>
                    <select 
                      value={novo.categoria} 
                      onChange={e => setNovo({ ...novo, categoria: e.target.value })}
                    >
                      {isEntrada
                        ? categoriasEntrada.map(cat => <option key={cat} value={cat}>{cat}</option>)
                        : categoriasSaida.map(cat => <option key={cat} value={cat}>{cat}</option>)
                      }
                    </select>
                  </div>

                  <div className="nl-group">
                    <label>Forma de Pagto *</label>
                    <select 
                      value={novo.formaPagto} 
                      onChange={e => setNovo({ ...novo, formaPagto: e.target.value })}
                    >
                      <option value="Pix">⚡ PIX Instantâneo</option>
                      <option value="Dinheiro">💵 Dinheiro em Espécie</option>
                      <option value="Cartão de Crédito">💳 Cartão de Crédito</option>
                      <option value="Cartão de Débito">💳 Cartão de Débito</option>
                      <option value="Transferência">🏦 Transferência / TED</option>
                      <option value="Boleto Bancário">📄 Boleto Bancário</option>
                      <option value="A Cobrar">⏳ A Cobrar / Fiado</option>
                    </select>
                  </div>
                </div>

                {/* 🏷️ CENTRO DE CUSTO / TAG DO LANÇAMENTO */}
                <div className="nl-subrow">
                  <div className="nl-group">
                    <label>🏷️ Centro de Custo / Tag *</label>
                    <select 
                      value={novo.centroCusto} 
                      onChange={e => setNovo({ ...novo, centroCusto: e.target.value })}
                    >
                      {isEntrada
                        ? centrosCustoEntrada.map(cc => <option key={cc} value={cc}>{cc}</option>)
                        : centrosCustoSaida.map(cc => <option key={cc} value={cc}>{cc}</option>)
                      }
                    </select>
                  </div>

                  {/* PARCELAMENTO E JUROS SE CARTÃO */}
                  {novo.tipo === 'saida' && novo.formaPagto === 'Cartão de Crédito' && (
                    <div className="nl-group">
                      <label>Parcelas / Juros</label>
                      <div className="nl-input-parcelas-row">
                        <select 
                          value={novo.parcelas} 
                          onChange={e => setNovo({ ...novo, parcelas: e.target.value })}
                        >
                          {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>{n}x</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* 🛒 VÍNCULO COM ORDEM DE COMPRA (SE DESPESA) */}
                {!isEntrada && (
                  <div className="nl-group">
                    <label>🛒 Vincular Ordem de Compra (Dar baixa)</label>
                    <select
                      value={novo.compraId}
                      onChange={e => handleCompraSelect(e.target.value)}
                      disabled={carregandoListas}
                    >
                      <option value="">-- Nenhuma ordem de compra --</option>
                      {compras.map(c => (
                        <option key={c.id} value={c.id}>
                          #{c.numero || c.id.slice(0, 6)} - {c.nomeItem || c.descricao || "Compra"} (R$ {Number(c.valorTotal || c.valor || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 🛠️ VÍNCULO COM PEÇA DO ACERVO / CONSISTÊNCIA MANUTENÇÃO */}
                <div className="nl-group">
                  <label>🛠️ Vincular Peça do Acervo / Conserto (Opcional)</label>
                  <select
                    value={novo.pecaId}
                    onChange={e => handlePecaSelect(e.target.value)}
                    disabled={carregandoListas}
                  >
                    <option value="">-- Nenhuma peça de acervo vinculada --</option>
                    {pecasAcervo.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.sku ? `[${p.sku}] ` : ''}{p.nome || p.titulo || "Peça"} ({p.categoria || "Geral"})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 🔁 OPÇÃO DE LANÇAMENTO RECORRENTE (REPETIR MENSALMENTE) */}
                <div className="nl-group nl-box-recorrente">
                  <label className="nl-recorrente-toggle">
                    <input 
                      type="checkbox" 
                      checked={isRecorrente} 
                      onChange={e => setIsRecorrente(e.target.checked)} 
                    />
                    <span>🔁 Repetir este lançamento nos próximos meses</span>
                  </label>
                  {isRecorrente && (
                    <div className="nl-recorrente-options">
                      <label>Duração:</label>
                      <select 
                        value={mesesRecorrencia} 
                        onChange={e => setMesesRecorrencia(e.target.value)}
                      >
                        <option value={2}>Por 2 meses</option>
                        <option value={3}>Por 3 meses</option>
                        <option value={6}>Por 6 meses</option>
                        <option value={12}>Por 12 meses (1 ano)</option>
                      </select>
                    </div>
                  )}
                </div>

              </div>

              {/* 🔵 COLUNA DIREITA: DATA, VÍNCULOS, SITUAÇÃO, OBSERVAÇÕES E ANEXO */}
              <div className="nl-col">

                {/* DATA */}
                <div className="nl-group">
                  <label>
                    {novo.status === 'pago' 
                      ? (isEntrada ? '📅 Data Recebimento *' : '📅 Data Pagamento *') 
                      : '📅 Data Vencimento *'}
                  </label>
                  <input
                    type="date"
                    required
                    value={novo.data}
                    onChange={e => setNovo({ ...novo, data: e.target.value })}
                  />
                </div>

                {/* ⚡ VÍNCULO PEDIDO / LOCAÇÃO (FORMATADO E CLARO) */}
                <div className="nl-group">
                  <label>⚡ Vincular Pedido (Nome, Data e Saldo Devedor)</label>
                  <select
                    value={novo.locacaoId}
                    onChange={e => handleLocacaoSelect(e.target.value)}
                    disabled={carregandoListas}
                    className="select-pedidos-formatado"
                  >
                    <option value="">-- Nenhum pedido selecionado --</option>
                    {locacoes.map(loc => {
                      const total = Number(loc.valorTotal || loc.total || loc.financeiro?.total || 0);
                      const jaPago = Number(loc.valorPago || 0);
                      const resta = Math.max(0, total - jaPago);
                      
                      const numPed = loc.numeroPedido || loc.numero || (loc.id ? loc.id.slice(0, 6).toUpperCase() : '');
                      const numTxt = numPed ? `Pedido #${numPed}` : 'Pedido';
                      const cliNome = loc.clienteNome || loc.nomeCliente || "Cliente sem nome";
                      const dtEvento = formatarDataBr(loc.dataRetirada || loc.dataEvento || loc.data || "");
                      const dtTxt = dtEvento ? ` (${dtEvento})` : "";
                      const restaTxt = resta > 0 
                        ? `Falta: R$ ${resta.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` 
                        : `(QUITADO)`;

                      return (
                        <option key={loc.id} value={loc.id}>
                          {numTxt} • {cliNome}{dtTxt} • {restaTxt}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* CLIENTE OU FORNECEDOR */}
                <div className="nl-group">
                  <label>
                    {isEntrada ? '👤 Cliente (Opcional)' : '🏭 Fornecedor (Opcional)'}
                  </label>
                  {isEntrada ? (
                    <select
                      value={novo.clienteId}
                      onChange={e => {
                        const id = e.target.value;
                        const cli = clientes.find(c => c.id === id);
                        setNovo(prev => ({
                          ...prev,
                          clienteId: id,
                          clienteNome: cli ? cli.nome : ""
                        }));
                      }}
                      disabled={carregandoListas}
                    >
                      <option value="">-- Selecione o cliente --</option>
                      {clientes.map(cli => (
                        <option key={cli.id} value={cli.id}>
                          {cli.nome}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={novo.fornecedorId}
                      onChange={e => {
                        const id = e.target.value;
                        const forn = fornecedores.find(f => f.id === id);
                        setNovo(prev => ({
                          ...prev,
                          fornecedorId: id,
                          fornecedorNome: forn ? (forn.nomeEmpresa || forn.nome) : ""
                        }));
                      }}
                      disabled={carregandoListas}
                    >
                      <option value="">-- Selecione o fornecedor --</option>
                      {fornecedores.map(forn => (
                        <option key={forn.id} value={forn.id}>
                          {forn.nomeEmpresa || forn.nome || "Fornecedor"}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* SITUAÇÃO DO PAGAMENTO */}
                <div className="nl-group status-group">
                  <label>Situação *</label>
                  <div className="nl-status-options">
                    <label className={`status-radio ${novo.status === 'pago' ? 'selecionado' : ''}`}>
                      <input
                        type="radio"
                        name="status"
                        value="pago"
                        checked={novo.status === 'pago'}
                        onChange={() => setNovo({ ...novo, status: 'pago' })}
                      />
                      {isEntrada ? '✅ Recebido' : '✅ Pago'}
                    </label>
                    <label className={`status-radio pendente ${novo.status === 'pendente' ? 'selecionado' : ''}`}>
                      <input
                        type="radio"
                        name="status"
                        value="pendente"
                        checked={novo.status === 'pendente'}
                        onChange={() => setNovo({ ...novo, status: 'pendente' })}
                      />
                      ⏳ Pendente
                    </label>
                  </div>
                </div>

                {/* 📝 OBSERVAÇÕES / NOTAS INTERNAS */}
                <div className="nl-group">
                  <label>📝 Observações Internas (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: Pago via Pix Nubank pelo marido da cliente..."
                    value={novo.observacoes}
                    onChange={e => setNovo({ ...novo, observacoes: e.target.value })}
                  />
                </div>

                {/* COMPROVANTE COMPACTO */}
                <div className="nl-group nl-comprovante-box-compact">
                  {!arquivoComprovante ? (
                    <div className="nl-upload-dropzone-mini">
                      <input
                        type="file"
                        id="input-comprovante-file"
                        accept="image/*,application/pdf"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                      />
                      <label htmlFor="input-comprovante-file" className="nl-upload-label-mini">
                        <span>📎 Anexar Comprovante / Recibo</span>
                      </label>
                    </div>
                  ) : (
                    <div className="nl-comprovante-preview-mini">
                      <span>📄 {nomeArquivo.length > 25 ? nomeArquivo.slice(0, 22) + '...' : nomeArquivo}</span>
                      <button type="button" className="btn-remover-mini" onClick={removerComprovante}>❌</button>
                    </div>
                  )}
                </div>

              </div>

            </div>

            {/* BOTÕES DE AÇÃO LADO A LADO NO RODAPÉ DO CARD */}
            <div className="nl-actions">
              <button 
                type="button" 
                className="btn-cancelar" 
                onClick={() => navigate("/financeiro")}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className={`btn-salvar-dinamico ${isEntrada ? 'btn-salvar-entrada' : 'btn-salvar-saida'}`}
                disabled={salvando}
              >
                {salvando ? (
                  <span>⏳ Salvando...</span>
                ) : (
                  <span>
                    {isEntrada ? '✔ CONFIRMAR RECEITA' : '✔ CONFIRMAR DESPESA'}
                  </span>
                )}
              </button>
            </div>

          </form>
        </div>
      </div>

      {/* 📄 MODAL DE SUCESSO E AÇÕES RÁPIDAS (RECIBO PDF & WHATSAPP) */}
      {ultimoLancamentoSalvo && (
        <div className="nl-modal-sucesso-overlay">
          <div className="nl-modal-sucesso-card">
            <div className="nl-modal-sucesso-icon">✨</div>
            <h3>Lançamento Registrado com Sucesso!</h3>
            <p>
              O valor de <strong>R$ {Number(ultimoLancamentoSalvo.valorTotal || ultimoLancamentoSalvo.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong> foi gravado no fluxo de caixa.
            </p>

            <div className="nl-modal-sucesso-acoes">
              <button
                type="button"
                className="btn-sucesso-pdf"
                onClick={() => gerarReciboLancamentoPDF(ultimoLancamentoSalvo)}
              >
                📄 Baixar Recibo (PDF)
              </button>

              <button
                type="button"
                className="btn-sucesso-wapp"
                onClick={() => enviarWhatsAppComprovante(ultimoLancamentoSalvo)}
              >
                💬 Enviar no WhatsApp
              </button>

              <button
                type="button"
                className="btn-sucesso-fechar"
                onClick={() => navigate("/financeiro")}
              >
                ✓ Voltar ao Financeiro
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default NovoLancamento;