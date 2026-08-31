import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { db, auth, storage } from "../../firebaseConfig";
import { collection, addDoc, getDocs, query, where, doc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { gerarReciboLancamentoPDF } from "../../utils/gerarReciboLancamentoPDF";
import "./Novolancamento.css";

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

      // 4. Compras da Empresa
      try {
        const qComp = query(collection(db, "lista_compras"), where("userId", "==", tenantId));
        const snapComp = await getDocs(qComp);
        setCompras(snapComp.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (errComp) {
        console.warn("Erro ao carregar ordens de compra:", errComp);
      }

      // 5. Peças do Acervo
      try {
        const qPecas = query(collection(db, "estoque"), where("userId", "==", tenantId));
        const snapPecas = await getDocs(qPecas);
        setPecasAcervo(snapPecas.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (errPecas) {
        console.warn("Erro ao carregar peças do acervo:", errPecas);
      }

      setCarregandoListas(false);
    };

    carregarDadosAuxiliares();
  }, [usuarioLogado, navigate, tenantId]);

  // Sistema de Auditoria de Logs
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
    } catch (errLog) {
      console.warn("Erro ao gravar log de auditoria:", errLog);
    }
  };

  // Máscara monetária do input de valor
  const handleValorChange = (e) => {
    let digits = e.target.value.replace(/\D/g, "");
    if (!digits) {
      setValDisplay("");
      setNovo(prev => ({ ...prev, valor: "" }));
      return;
    }
    const num = Number(digits) / 100;
    setValDisplay(num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
    setNovo(prev => ({ ...prev, valor: num }));
  };

  const adicionarValorRapido = (adicional) => {
    const valAtual = Number(novo.valor) || 0;
    const novoValor = valAtual + adicional;
    setNovo(prev => ({ ...prev, valor: novoValor }));
    setValDisplay(novoValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
  };

  const aplicarDesconto = (percentual) => {
    const valAtual = Number(novo.valor) || 0;
    if (valAtual <= 0) return;
    const novoValor = Math.max(0, valAtual * (1 - percentual / 100));
    setNovo(prev => ({ ...prev, valor: novoValor }));
    setValDisplay(novoValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
  };

  const aplicarTaxa = (percentual) => {
    const valAtual = Number(novo.valor) || 0;
    if (valAtual <= 0) return;
    const novoValor = valAtual * (1 + percentual / 100);
    setNovo(prev => ({ ...prev, valor: novoValor }));
    setValDisplay(novoValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
  };

  // Seleção Inteligente de Locação
  const handleLocacaoSelect = (locId) => {
    if (!locId) {
      setNovo(prev => ({ ...prev, locacaoId: "", locacaoNumero: "" }));
      return;
    }
    const locAlvo = locacoes.find(l => l.id === locId);
    if (!locAlvo) return;

    const total = Number(locAlvo.valorTotal || locAlvo.total || locAlvo.financeiro?.total || 0);
    const jaPago = Number(locAlvo.valorPago || 0);
    const saldoDevedor = Math.max(0, total - jaPago);

    const cliId = locAlvo.clienteId || locAlvo.cliente?.id || "";
    const cliNome = locAlvo.clienteNome || locAlvo.nomeCliente || locAlvo.cliente?.nome || "";

    const numPedido = locAlvo.numeroPedido || locAlvo.numero || locAlvo.id.slice(0, 6).toUpperCase();

    setNovo(prev => ({
      ...prev,
      locacaoId: locId,
      locacaoNumero: numPedido,
      clienteId: cliId || prev.clienteId,
      clienteNome: cliNome || prev.clienteNome,
      descricao: prev.descricao ? prev.descricao : `Locação #${numPedido} - ${cliNome}`,
      valor: prev.valor ? prev.valor : saldoDevedor
    }));

    if (!valDisplay && saldoDevedor > 0) {
      setValDisplay(saldoDevedor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
    }
  };

  // Seleção de Compra
  const handleCompraSelect = (compId) => {
    if (!compId) {
      setNovo(prev => ({ ...prev, compraId: "" }));
      return;
    }
    const compAlvo = compras.find(c => c.id === compId);
    if (!compAlvo) return;

    const vCompra = Number(compAlvo.valorTotal || compAlvo.valor || 0);
    const descCompra = compAlvo.nomeItem || compAlvo.descricao || "Compra de Materiais";

    setNovo(prev => ({
      ...prev,
      compraId: compId,
      fornecedorNome: compAlvo.fornecedor || prev.fornecedorNome,
      descricao: prev.descricao ? prev.descricao : `Pagamento Compra #${compAlvo.numero || compAlvo.id.slice(0, 6)}: ${descCompra}`,
      valor: prev.valor ? prev.valor : vCompra
    }));

    if (!valDisplay && vCompra > 0) {
      setValDisplay(vCompra.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
    }
  };

  // Seleção de Peça de Acervo
  const handlePecaSelect = (pecaId) => {
    if (!pecaId) {
      setNovo(prev => ({ ...prev, pecaId: "", pecaNome: "" }));
      return;
    }
    const pecaAlvo = pecasAcervo.find(p => p.id === pecaId);
    if (!pecaAlvo) return;

    setNovo(prev => ({
      ...prev,
      pecaId: pecaId,
      pecaNome: pecaAlvo.nome || pecaAlvo.titulo || "Peça",
      descricao: prev.descricao ? prev.descricao : `Manutenção / Conserto da Peça: ${pecaAlvo.nome || pecaAlvo.titulo}`
    }));
  };

  // Manipulação de Arquivo de Comprovante
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("O arquivo é muito grande! Tamanho máximo: 10MB.");
      return;
    }

    setArquivoComprovante(file);
    setNomeArquivo(file.name);

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => setPreviewComprovante(event.target.result);
      reader.readAsDataURL(file);
    } else {
      setPreviewComprovante(null);
    }
  };

  const removerComprovante = () => {
    setArquivoComprovante(null);
    setPreviewComprovante(null);
    setNomeArquivo("");
  };

  const enviarWhatsAppComprovante = (itemSalvo) => {
    let numLimpo = "";
    if (itemSalvo.clienteId) {
      const cli = clientes.find(c => c.id === itemSalvo.clienteId);
      if (cli?.telefone || cli?.celular || cli?.whatsapp) {
        numLimpo = (cli.whatsapp || cli.celular || cli.telefone).replace(/\D/g, "");
      }
    }

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
          const compRef = doc(db, "lista_compras", novo.compraId);
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
    <div className="pag-novo-lancamento form-page-container fade-in">

      {/* ===== HERO CABEÇALHO & BREADCRUMB (PADRÃO CLIENTES & COMPRAS) ===== */}
      <div className="cadastro-hero-header">
        <div className="cadastro-hero-left">
          <div className="breadcrumb-nav">
            <Link to="/financeiro"><i className="fas fa-coins"></i> Financeiro</Link>
            <span className="separator">/</span>
            <span className="current-page">{isEntrada ? 'Nova Receita' : 'Nova Despesa'}</span>
          </div>
          <div className="hero-title-group">
            <div className="header-icon-badge">
              <i className={isEntrada ? "fas fa-arrow-trend-up" : "fas fa-arrow-trend-down"}></i>
            </div>
            <div>
              <h1 className="form-page-title">{isEntrada ? 'Cadastrar Nova Receita' : 'Cadastrar Nova Despesa'}</h1>
              <p className="form-page-subtitle">Registre recebimentos de locações, vendas ou pagamentos e despesas operacionais.</p>
            </div>
          </div>
        </div>
        <div className="cadastro-hero-right-actions">
          <button type="button" className="btn-secondary-celebre" onClick={() => navigate('/financeiro')}>
            <i className="fas fa-arrow-left"></i>
            <span>Voltar ao Financeiro</span>
          </button>
        </div>
      </div>

      {/* ===== FORMULÁRIO WIDESCREEN & CARTÃO UNIFICADO ===== */}
      <div className="form-widescreen">
        <form onSubmit={handleSalvar}>
          <div className="form-section-card unified-sheet-card">

            {/* SEÇÃO 1: TIPO DE RECURSO (RECEITA VS DESPESA) */}
            <div className="unified-section-header">
              <span className="section-header-icon">
                <i className="fas fa-money-bill-transfer"></i>
              </span>
              <div>
                <h3>NATUREZA DO LANÇAMENTO</h3>
                <p>Escolha se este lançamento é uma entrada ou saída de caixa</p>
              </div>
            </div>

            <div className="toggle-servico-vip nl-tipo-grid">
              <button
                type="button"
                className={`btn-servico-card ${isEntrada ? 'active' : ''}`}
                onClick={() => setNovo(prev => ({ ...prev, tipo: 'entrada', categoria: 'Locação', centroCusto: 'Pegue & Monte' }))}
                title="Entrada de dinheiro no caixa"
              >
                <div className="servico-icon-box">
                  <i className="fas fa-circle-arrow-up" style={{ color: isEntrada ? '#ffffff' : '#16a34a' }}></i>
                </div>
                <div className="servico-info">
                  <strong>🟢 Receita / Entrada</strong>
                  <small>Locações, vendas, fretes e entradas de recursos</small>
                </div>
                <div className="servico-check-badge">
                  {isEntrada && <span className="check-mark">✓</span>}
                </div>
              </button>

              <button
                type="button"
                className={`btn-servico-card ${!isEntrada ? 'active' : ''}`}
                onClick={() => setNovo(prev => ({ ...prev, tipo: 'saida', categoria: 'Compra para Estoque', centroCusto: 'Infraestrutura Galpão' }))}
                title="Saída de dinheiro do caixa"
              >
                <div className="servico-icon-box">
                  <i className="fas fa-circle-arrow-down" style={{ color: !isEntrada ? '#ffffff' : '#dc2626' }}></i>
                </div>
                <div className="servico-info">
                  <strong>🔴 Despesa / Saída</strong>
                  <small>Compras, manutenção, taxas, luz, equipe e despesas</small>
                </div>
                <div className="servico-check-badge">
                  {!isEntrada && <span className="check-mark">✓</span>}
                </div>
              </button>
            </div>

            {/* SEÇÃO 2: VALORES E DETALHES PRINCIPAIS */}
            <div className="form-section-divider"></div>

            <div className="unified-section-header">
              <span className="section-header-icon">
                <i className="fas fa-sack-dollar"></i>
              </span>
              <div>
                <h3>VALOR E IDENTIFICAÇÃO</h3>
                <p>Informe o valor, data de liquidação, descrição e classificação</p>
              </div>
            </div>

            <div className="form-grid-4">

              {/* LINHA 1: VALOR (Largo) + DATA DO LANÇAMENTO (Compacto) NA MESMA LINHA */}
              <div className="nc-row-nome-qtd span-4">
                <div className="form-group nc-field-nome">
                  <label htmlFor="nl-valor">
                    VALOR {novo.tipo === 'saida' && novo.formaPagto === 'Cartão de Crédito' ? 'BASE (R$)' : '(R$)'} *
                  </label>
                  <div className="input-icon-wrapper">
                    <span className="input-left-icon">
                      <strong style={{ fontSize: '0.75rem', color: isEntrada ? '#16a34a' : '#dc2626' }}>R$</strong>
                    </span>
                    <input
                      id="nl-valor"
                      type="text"
                      placeholder="R$ 0,00"
                      required
                      autoFocus
                      className="nl-input-valor-celebre"
                      value={valDisplay}
                      onChange={handleValorChange}
                    />
                  </div>

                  {/* Pílulas de adição rápida e cálculo */}
                  <div className="nl-pilulas-bar">
                    <span className="pilula-lbl">+ Rápido:</span>
                    <button type="button" className="btn-pilula" onClick={() => adicionarValorRapido(50)}>+50</button>
                    <button type="button" className="btn-pilula" onClick={() => adicionarValorRapido(100)}>+100</button>
                    <button type="button" className="btn-pilula" onClick={() => adicionarValorRapido(250)}>+250</button>
                    <button type="button" className="btn-pilula" onClick={() => adicionarValorRapido(500)}>+500</button>
                    <span className="pilula-div">|</span>
                    <button type="button" className="btn-pilula-taxa" onClick={() => aplicarDesconto(5)} title="Desconto 5%">-5%</button>
                    <button type="button" className="btn-pilula-taxa" onClick={() => aplicarDesconto(10)} title="Desconto 10%">-10%</button>
                    <button type="button" className="btn-pilula-taxa" onClick={() => aplicarTaxa(3.5)} title="Taxa 3.5%">+3.5%</button>
                  </div>
                </div>

                <div className="form-group nc-field-qtd">
                  <label htmlFor="nl-data">
                    {novo.status === 'pago' 
                      ? (isEntrada ? 'RECEBIMENTO *' : 'PAGAMENTO *') 
                      : 'VENCIMENTO *'}
                  </label>
                  <input
                    id="nl-data"
                    type="date"
                    required
                    value={novo.data}
                    onChange={e => setNovo({ ...novo, data: e.target.value })}
                  />
                </div>
              </div>

              {/* LINHA 2: DESCRIÇÃO / TÍTULO + SITUAÇÃO DO PAGAMENTO */}
              <div className="form-group span-3">
                <label htmlFor="nl-desc">DESCRIÇÃO / TÍTULO *</label>
                <div className="input-icon-wrapper">
                  <span className="input-left-icon"><i className="fas fa-file-lines"></i></span>
                  <input
                    id="nl-desc"
                    type="text"
                    placeholder={isEntrada ? "Ex: Pagamento locação Ana Silva..." : "Ex: Compra de Bexigas, Luz..."}
                    required
                    value={novo.descricao}
                    onChange={e => setNovo({ ...novo, descricao: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group span-1 col-mobile-half">
                <label htmlFor="nl-status">SITUAÇÃO *</label>
                <select
                  id="nl-status"
                  value={novo.status}
                  onChange={e => setNovo({ ...novo, status: e.target.value })}
                  className={novo.status === 'pago' ? 'select-status-pago' : 'select-status-pendente'}
                >
                  <option value="pago">{isEntrada ? '✅ Recebido' : '✅ Pago'}</option>
                  <option value="pendente">⏳ Pendente</option>
                </select>
              </div>

              {/* LINHA 3: CATEGORIA + FORMA DE PAGAMENTO + CENTRO DE CUSTO */}
              <div className="form-group span-2 col-mobile-half">
                <label htmlFor="nl-cat">CATEGORIA *</label>
                <select 
                  id="nl-cat"
                  value={novo.categoria} 
                  onChange={e => setNovo({ ...novo, categoria: e.target.value })}
                >
                  {isEntrada
                    ? categoriasEntrada.map(cat => <option key={cat} value={cat}>{cat}</option>)
                    : categoriasSaida.map(cat => <option key={cat} value={cat}>{cat}</option>)
                  }
                </select>
              </div>

              <div className="form-group span-2 col-mobile-half">
                <label htmlFor="nl-forma">FORMA DE PAGAMENTO *</label>
                <select 
                  id="nl-forma"
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

              <div className={`form-group ${novo.tipo === 'saida' && novo.formaPagto === 'Cartão de Crédito' ? 'span-2 col-mobile-half' : 'span-4'}`}>
                <label htmlFor="nl-centro">🏷️ CENTRO DE CUSTO / TAG *</label>
                <select 
                  id="nl-centro"
                  value={novo.centroCusto} 
                  onChange={e => setNovo({ ...novo, centroCusto: e.target.value })}
                >
                  {isEntrada
                    ? centrosCustoEntrada.map(cc => <option key={cc} value={cc}>{cc}</option>)
                    : centrosCustoSaida.map(cc => <option key={cc} value={cc}>{cc}</option>)
                  }
                </select>
              </div>

              {novo.tipo === 'saida' && novo.formaPagto === 'Cartão de Crédito' && (
                <div className="form-group span-2 col-mobile-half">
                  <label htmlFor="nl-parcelas">PARCELAS NO CARTÃO</label>
                  <select 
                    id="nl-parcelas"
                    value={novo.parcelas} 
                    onChange={e => setNovo({ ...novo, parcelas: e.target.value })}
                  >
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>{n}x</option>)}
                  </select>
                </div>
              )}

            </div>

            {/* SEÇÃO 3: VÍNCULOS AUXILIARES (PEDIDO, CLIENTE, FORNECEDOR, ACERVO) */}
            <div className="form-section-divider"></div>

            <div className="unified-section-header">
              <span className="section-header-icon">
                <i className="fas fa-link"></i>
              </span>
              <div>
                <h3>VÍNCULOS E INTEGRAÇÃO</h3>
                <p>Vincule a uma locação, cliente, fornecedor ou peça do acervo</p>
              </div>
            </div>

            <div className="form-grid-4">

              {/* VÍNCULO PEDIDO / LOCAÇÃO */}
              <div className="form-group span-2 col-mobile-half">
                <label htmlFor="nl-locacao">⚡ VINCULAR PEDIDO / LOCAÇÃO</label>
                <select
                  id="nl-locacao"
                  value={novo.locacaoId}
                  onChange={e => handleLocacaoSelect(e.target.value)}
                  disabled={carregandoListas}
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
              <div className="form-group span-2 col-mobile-half">
                <label htmlFor="nl-clifor">
                  {isEntrada ? '👤 CLIENTE VINCULADO' : '🏭 FORNECEDOR VINCULADO'}
                </label>
                {isEntrada ? (
                  <select
                    id="nl-clifor"
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
                    id="nl-clifor"
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

              {/* SE DESPESA: ORDEM DE COMPRA E PEÇA DO ACERVO */}
              {!isEntrada && (
                <>
                  <div className="form-group span-2 col-mobile-half">
                    <label htmlFor="nl-compra">🛒 VINCULAR ORDEM DE COMPRA (DAR BAIXA)</label>
                    <select
                      id="nl-compra"
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

                  <div className="form-group span-2 col-mobile-half">
                    <label htmlFor="nl-peca">🛠️ VINCULAR PEÇA DO ACERVO / CONSERTO</label>
                    <select
                      id="nl-peca"
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
                </>
              )}

              {/* OBSERVAÇÕES INTERNAS */}
              <div className="form-group span-4">
                <label htmlFor="nl-obs">OBSERVAÇÕES INTERNAS / NOTAS</label>
                <textarea
                  id="nl-obs"
                  rows="2"
                  placeholder="Ex: Pago via Pix Nubank pelo marido da cliente..."
                  value={novo.observacoes}
                  onChange={e => setNovo({ ...novo, observacoes: e.target.value })}
                ></textarea>
              </div>

              {/* RECORRÊNCIA E COMPROVANTE */}
              <div className="form-group span-2 col-mobile-half">
                <label>🔁 LANÇAMENTO RECORRENTE</label>
                <div className="nl-recorrente-box">
                  <label className="nl-recorrente-toggle">
                    <input 
                      type="checkbox" 
                      checked={isRecorrente} 
                      onChange={e => setIsRecorrente(e.target.checked)} 
                    />
                    <span>Repetir nos próximos meses</span>
                  </label>
                  {isRecorrente && (
                    <select 
                      value={mesesRecorrencia} 
                      onChange={e => setMesesRecorrencia(e.target.value)}
                      className="select-meses-rec"
                    >
                      <option value={2}>Por 2 meses</option>
                      <option value={3}>Por 3 meses</option>
                      <option value={6}>Por 6 meses</option>
                      <option value={12}>Por 12 meses (1 ano)</option>
                    </select>
                  )}
                </div>
              </div>

              <div className="form-group span-2 col-mobile-half">
                <label>📎 COMPROVANTE / RECIBO</label>
                {!arquivoComprovante ? (
                  <div className="nl-upload-dropzone">
                    <input
                      type="file"
                      id="input-comprovante-file"
                      accept="image/*,application/pdf"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="input-comprovante-file" className="nl-upload-label">
                      <i className="fas fa-paperclip"></i>
                      <span>Clique para Anexar Comprovante / PDF</span>
                    </label>
                  </div>
                ) : (
                  <div className="nl-comprovante-preview">
                    <span>📄 {nomeArquivo.length > 25 ? nomeArquivo.slice(0, 22) + '...' : nomeArquivo}</span>
                    <button type="button" className="btn-remover-comprovante" onClick={removerComprovante} title="Remover anexo">✕</button>
                  </div>
                )}
              </div>

            </div>

            {/* BARRA DE AÇÕES NO RODAPÉ DO CARTÃO UNIFICADO */}
            <div className="unified-card-actions-bar">
              <button type="button" className="btn-cancelar-celebre" onClick={() => navigate('/financeiro')}>
                <i className="fas fa-times"></i> Cancelar
              </button>
              <button
                type="submit"
                className={`btn-salvar-celebre-gold ${isEntrada ? 'btn-receita-gold' : 'btn-despesa-gold'}`}
                disabled={salvando}
              >
                {salvando ? (
                  <><i className="fas fa-spinner fa-spin"></i> Salvando...</>
                ) : isEntrada ? (
                  <><i className="fas fa-check"></i> Confirmar Receita</>
                ) : (
                  <><i className="fas fa-check"></i> Confirmar Despesa</>
                )}
              </button>
            </div>

          </div>
        </form>
      </div>

      {/* 📄 MODAL DE SUCESSO E AÇÕES RÁPIDAS (RECIBO PDF & WHATSAPP) */}
      {ultimoLancamentoSalvo && (
        <div className="modal-overlay-premium" onClick={() => navigate("/financeiro")}>
          <div className="modal-box-pedido" onClick={e => e.stopPropagation()}>
            <div className="modal-header-pedido">
              <div className="modal-header-left">
                <div className="modal-header-icon-badge">
                  <i className="fas fa-circle-check" style={{ color: '#16a34a' }}></i>
                </div>
                <div>
                  <h3>Lançamento Registrado com Sucesso!</h3>
                  <p>
                    O valor de <strong>R$ {Number(ultimoLancamentoSalvo.valorTotal || ultimoLancamentoSalvo.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> foi gravado no caixa.
                  </p>
                </div>
              </div>
              <button type="button" className="btn-fechar-modal" onClick={() => navigate("/financeiro")} title="Fechar">✕</button>
            </div>

            <div className="modal-lista-pedidos" style={{ gap: '10px', padding: '20px' }}>
              <button
                type="button"
                className="card-pedido-select"
                style={{ justifyContent: 'center', gap: '8px', padding: '12px', background: 'rgba(197, 160, 89, 0.1)', borderColor: '#c5a059', color: '#c5a059', fontWeight: 800 }}
                onClick={() => gerarReciboLancamentoPDF(ultimoLancamentoSalvo)}
              >
                <i className="fas fa-file-pdf"></i> Baixar Recibo em PDF
              </button>

              <button
                type="button"
                className="card-pedido-select"
                style={{ justifyContent: 'center', gap: '8px', padding: '12px', background: 'rgba(37, 211, 102, 0.1)', borderColor: '#25d366', color: '#16a34a', fontWeight: 800 }}
                onClick={() => enviarWhatsAppComprovante(ultimoLancamentoSalvo)}
              >
                <i className="fab fa-whatsapp"></i> Enviar Comprovante no WhatsApp
              </button>

              <button
                type="button"
                className="btn-secondary-celebre"
                style={{ width: '100%', justifyContent: 'center', marginTop: '6px' }}
                onClick={() => navigate("/financeiro")}
              >
                <i className="fas fa-arrow-left"></i> Voltar ao Fluxo de Caixa
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default NovoLancamento;