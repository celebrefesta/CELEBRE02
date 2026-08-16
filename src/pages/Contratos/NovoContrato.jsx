import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../firebaseConfig";
import { collection, addDoc, serverTimestamp, getDocs, query, where } from "firebase/firestore";
import { useNavigate, useLocation } from "react-router-dom";
import { getAuth } from "firebase/auth"; 
import "./NovoContrato.css";

const NovoContrato = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // 🔥 Autenticação e Chave Mestra
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  // Estados para dados e controle visual
  const [listaPedidos, setListaPedidos] = useState([]);
  const [listaClientes, setListaClientes] = useState([]);
  const [pedidoIdVinculado, setPedidoIdVinculado] = useState("");
  const [carregandoPedidos, setCarregandoPedidos] = useState(false);
  const [meusModelos, setMeusModelos] = useState([]);
  const [salvando, setSalvando] = useState(false);

  // Helper para verificar se é orçamento
  const verificarSeEhOrcamento = (p) => {
    const st = String(p.status || p.statusFinal || p.tipo || '').toLowerCase();
    return st.includes('orcam') || p.isOrcamento === true || st === 'orcamento' || st === 'proposta';
  };

  // Helper para identificar orçamentos ou locações confirmadas ativas (exclui devolvidos, cancelados e eventos que já passaram)
  const verificarSeEhOrcamentoOuAtivo = (p) => {
    const s = String(p.status || p.statusFinal || '').toLowerCase().trim();
    const excluidos = ['devolvido', 'devolucao', 'cancelado', 'estornado', 'cancelada', 'finalizado', 'concluido', 'fechado', 'historico'];
    if (excluidos.some(f => s.includes(f))) return false;

    // Se for locação confirmada/em aberto (não é orçamento), a data da celebração ainda não pode ter passado
    if (!verificarSeEhOrcamento(p)) {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const dataRef = p.dataDevolucao || p.dataEvento || p.dataRetirada;
      if (dataRef) {
        const dataLimite = new Date(dataRef + 'T23:59:59');
        if (!isNaN(dataLimite.getTime()) && dataLimite < hoje) {
          return false; // Festa já passou!
        }
      }
    }

    return true;
  };

  // Estado do formulário
  const [form, setForm] = useState({
    cliente: "", 
    cpf: "",
    telefone: "",
    tema: "", 
    dataEvento: "", 
    horario: "",
    endereco: "", 
    descricao: "", 
    valorTotal: "", 
    status: "Em Aberto",
    dataRetirada: "", 
    dataDevolucao: ""
  });

  // Carrega pedido importado se passado via state
  useEffect(() => {
    if (location.state?.pedidoImportado) {
      const pedido = location.state.pedidoImportado;
      importarDados(pedido);
    }
  }, [location.state]);

  // 🔥 SISTEMA DE AUDITORIA (ESPIÃO JURÍDICO VINCULADO À EMPRESA)
  const registrarLog = async (acao, detalhes) => {
    const currentTenant = localStorage.getItem('tenantId') || auth.currentUser?.uid;
    if (!currentTenant) return;
    try {
      const nomeEquipa = localStorage.getItem('funcName') || auth.currentUser?.displayName || auth.currentUser?.email || "Equipe";
      await addDoc(collection(db, "logs_atividades"), {
        empresaId: currentTenant,
        userId: currentTenant,
        funcionarioId: auth.currentUser?.uid,
        nomeFuncionario: nomeEquipa,
        usuarioEmail: auth.currentUser?.email || "Desconhecido",
        acao: acao.toUpperCase(),
        detalhes: detalhes,
        dataHora: new Date().toISOString(),
        criadoEm: serverTimestamp()
      });
    } catch (error) {
      console.error("Erro ao gravar log da auditoria de contratos:", error);
    }
  };

  // 1. Carrega Pedidos Elegíveis, Clientes e Modelos ao abrir a página
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      const activeTenant = localStorage.getItem('tenantId') || user?.uid;
      if (!user && !activeTenant) {
        navigate('/login');
        return;
      }
      if (!activeTenant) return;

      setCarregandoPedidos(true);
      try {
        // 🔥 1. Busca Clientes da empresa primeiro para mapear IDs e Nomes
        const qClientes = query(collection(db, "clientes"), where("userId", "==", activeTenant));
        const snapClientes = await getDocs(qClientes);
        const listaC = snapClientes.docs.map(d => ({ id: d.id, ...d.data() }));
        setListaClientes(listaC);

        const mapaClientes = {};
        listaC.forEach(c => {
          mapaClientes[c.id] = c.nome || c.nomeFantasia || c.nomeCompleto || c.razaoSocial || "Cliente";
        });

        // 🔥 2. Busca Locações e Orçamentos da empresa com nome do cliente resolvido
        const qLocacoes = query(collection(db, "locacoes"), where("userId", "==", activeTenant));
        const snapPedidos = await getDocs(qLocacoes);
        const listaP = snapPedidos.docs
          .map(d => {
            const data = d.data();
            const nomeResolvido = data.clienteNome || data.cliente || mapaClientes[data.clienteId] || mapaClientes[data.clienteUid] || "Cliente";
            return {
              id: d.id,
              ...data,
              clienteNome: nomeResolvido
            };
          })
          .filter(verificarSeEhOrcamentoOuAtivo);
        listaP.sort((a, b) => new Date(b.dataEvento || b.dataRetirada || 0) - new Date(a.dataEvento || a.dataRetirada || 0));
        setListaPedidos(listaP);

        // 🔥 3. Busca Modelos de Contrato da empresa
        const qModelos = query(collection(db, "modelosContrato"), where("userId", "==", activeTenant));
        const snapModelos = await getDocs(qModelos);
        const mods = snapModelos.docs.map(d => ({ id: d.id, ...d.data() }));
        setMeusModelos(mods);

        // Se houver um modelo padrão da empresa e o formulário ainda estiver vazio, carrega-o
        const modeloPadrao = mods.find(m => m.isDefault);
        if (modeloPadrao && !form.descricao) {
          setForm(prev => prev.descricao ? prev : ({ ...prev, descricao: modeloPadrao.texto }));
        }
      } catch (err) { 
        console.error("Erro ao carregar dados:", err); 
      } finally {
        setCarregandoPedidos(false);
      }
    });

    return () => unsubAuth();
  }, [navigate]);

  // 📜 GERADOR DE MINUTA JURÍDICA PROFISSIONAL COMPLETA
  const gerarMinutaContratoProfissional = (dadosForm, pedidoOriginal = null) => {
    const nomeCliente = dadosForm.cliente || "_________________________";
    const docCliente = dadosForm.cpf ? `CPF/CNPJ nº ${dadosForm.cpf}` : "CPF/CNPJ nº _________________________";
    const telCliente = dadosForm.telefone || "_________________________";
    const endCliente = dadosForm.endereco || "_________________________";
    const temaEvento = dadosForm.tema || "Celebração";
    const dtEvFormatada = dadosForm.dataEvento ? dadosForm.dataEvento.split('-').reverse().join('/') : "__/__/____";
    const dtRetFormatada = dadosForm.dataRetirada ? dadosForm.dataRetirada.split('-').reverse().join('/') : dtEvFormatada;
    const dtDevFormatada = dadosForm.dataDevolucao ? dadosForm.dataDevolucao.split('-').reverse().join('/') : dtEvFormatada;
    const horario = dadosForm.horario || "Horário Comercial";
    const vlrTotal = Number(dadosForm.valorTotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    let listaItensFormatada = "• [Conforme itens descritos na locação]";
    if (pedidoOriginal) {
      const itensOriginais = pedidoOriginal.itens || pedidoOriginal.carrinho || [];
      if (itensOriginais.length > 0) {
        listaItensFormatada = itensOriginais.map((it, idx) => {
          const qtd = it.qtd || it.quantidade || 1;
          const nome = it.nome || it.produto || it.nomeProduto || "Item de Acervo";
          return `${idx + 1}. ${qtd}x ${nome}`;
        }).join('\n');
      }
    } else if (dadosForm.descricao && dadosForm.descricao.includes("x ")) {
      listaItensFormatada = dadosForm.descricao.trim();
    }

    return `INSTRUMENTO PARTICULAR DE LOCAÇÃO DE BENS MÓVEIS E ACERVO PARA EVENTOS

======================================================================
1. QUALIFICAÇÃO DAS PARTES
======================================================================
• LOCATÁRIO(A): ${nomeCliente}, ${docCliente}
  WhatsApp/Telefone: ${telCliente}
  Endereço: ${endCliente}

• LOCADORA: Celebre Festas & Eventos (Plataforma Celebre Locações)

======================================================================
2. OBJETO DO CONTRATO & RELAÇÃO DO ACERVO
======================================================================
O presente contrato tem por objeto a locação temporária dos itens e peças decorativas descritos a seguir, destinados à realização do evento tema "${temaEvento}":

${listaItensFormatada}

======================================================================
3. PRAZOS, LOGÍSTICA & LOCAL DO EVENTO
======================================================================
• Data da Celebração / Evento: ${dtEvFormatada}
• Data e Horário de Retirada/Saída: ${dtRetFormatada} às ${horario}
• Data e Horário Limite de Devolução: ${dtDevFormatada} às ${horario}
• Endereço do Evento: ${endCliente}

======================================================================
4. CONDIÇÕES FINANCEIRAS
======================================================================
O valor total da presente locação é de ${vlrTotal}, a ser liquidado conforme as condições e prazos comerciais acordados entre as partes.

======================================================================
5. CLÁUSULAS JURÍDICAS DE PROTEÇÃO & REPOSIÇÃO
======================================================================
CLÁUSULA 1ª – DO ESTADO DE CONSERVAÇÃO E CONFERÊNCIA:
O(A) LOCATÁRIO(A) declara que recebe todas as peças em perfeito estado de uso, limpeza, funcionamento e conservação, obrigando-se a conferir cada item no ato do recebimento/retirada.

CLÁUSULA 2ª – DA DEVOLUÇÃO, LIMPEZA E MULTA POR ATRASO:
Todos os bens deverão ser restituídos na data e horário avençados, devidamente higienizados e acondicionados em suas embalagens, caixas ou capas protetoras originais.
Parágrafo Único: O atraso não acordado na devolução implicará na cobrança de multa diária correspondente a 20% (vinte por cento) do valor total da locação por dia de atraso, sem prejuízo de eventuais perdas e danos decorrentes de reservas subsequentes.

CLÁUSULA 3ª – DE AVARIAS, DANOS, MANCHAS E EXTRAVIOS (REPOSIÇÃO):
Em caso de quebra, trincas, queima, rasgos, manchas irreversíveis em tecidos, danos a componentes elétricos/eletrônicos ou extravio de qualquer peça, acessório ou embalagem retornável, o(a) LOCATÁRIO(A) se obriga a indenizar a LOCADORA pelo valor de reposição de mercado atualizado do bem no prazo improrrogável de até 48 (quarenta e oito) horas após a conferência de devolução.

CLÁUSULA 4ª – DA HIGIENIZAÇÃO E CUIDADOS ESPECIAIS:
É expressamente proibido o uso de fitas adesivas, pregos, cola quente, grampos ou produtos abrasivos diretamente sobre as peças, painéis e móveis. A devolução de itens com resíduos de adesivos ou sujeira excessiva acarretará taxa de higienização de R$ 50,00 por peça.

CLÁUSULA 5ª – DA VALIDADE JURÍDICA E ASSINATURA ELETRÔNICA:
As partes contratantes reconhecem a plena validade jurídica deste contrato formalizado e/ou assinado por meio eletrônico e digital, nos termos da Lei Federal nº 14.063/2020 e Art. 10, § 2º da Medida Provisória nº 2.200-2/2001.`;
  };

  // 2. Importa os dados do Pedido / Orçamento selecionado (Preenche Cliente + Pedido + Valores + Minuta)
  const importarDados = (pedido) => {
    if (!pedido) return;
    if (pedido.id) setPedidoIdVinculado(pedido.id);

    const clienteEncontrado = listaClientes.find(c => 
      (pedido.clienteId && String(c.id) === String(pedido.clienteId)) ||
      (pedido.clienteUid && String(c.id) === String(pedido.clienteUid)) ||
      (c.nome && pedido.clienteNome && c.nome.toLowerCase().trim() === pedido.clienteNome.toLowerCase().trim()) ||
      (c.nomeFantasia && pedido.clienteNome && c.nomeFantasia.toLowerCase().trim() === pedido.clienteNome.toLowerCase().trim())
    );

    const cpfFinal = clienteEncontrado?.cpf || clienteEncontrado?.cnpj || clienteEncontrado?.documento || pedido.clienteCpf || pedido.cpf || "";
    const telFinal = clienteEncontrado?.celular || clienteEncontrado?.telefone || clienteEncontrado?.whatsapp || pedido.clienteCelular || pedido.celular || pedido.telefone || "";
    const endFinal = clienteEncontrado?.endereco || clienteEncontrado?.enderecoCompleto || pedido.enderecoCompleto || pedido.endereco || (pedido.logistica?.endereco) || "";
    const nomeFinal = clienteEncontrado?.nome || clienteEncontrado?.nomeFantasia || pedido.clienteNome || pedido.cliente || "Cliente";

    const novosDados = {
      cliente: nomeFinal,
      cpf: cpfFinal,
      telefone: telFinal,
      tema: pedido.temaFesta || pedido.tema || "Celebração",
      dataEvento: pedido.dataRetirada || pedido.dataEvento || "",
      dataRetirada: pedido.dataRetirada || pedido.dataEvento || "",
      dataDevolucao: pedido.dataDevolucao || pedido.dataEvento || "",
      valorTotal: pedido.valorTotal || pedido.total || pedido.valor || 0,
      endereco: endFinal,
      horario: pedido.horarioRetirada || pedido.horario || "Horário Comercial"
    };

    const minutaGerada = gerarMinutaContratoProfissional(novosDados, pedido);

    setForm(prev => ({
      ...prev,
      ...novosDados,
      descricao: minutaGerada
    }));
  };

  // 3. Aplica o Modelo de Contrato escolhido
  const aplicarModelo = (e) => {
    const idModelo = e.target.value;
    if (!idModelo) return;

    if (idModelo === 'GERAR_COMPLETO') {
      const minuta = gerarMinutaContratoProfissional(form);
      setForm(prev => ({ ...prev, descricao: minuta }));
      return;
    }

    const modelo = meusModelos.find(m => m.id === idModelo);
    if (modelo) {
      const PatternDeSeparacao = "\n\n--------------------------------\nTERMOS E CONDIÇÕES:\n";
      const atual = form.descricao || "";
      setForm({ 
        ...form, 
        descricao: atual + (atual ? PatternDeSeparacao : "") + modelo.texto 
      });
    }
  };

  // 4. Salva o contrato no Firebase
  const handleSalvar = async (e) => {
    e.preventDefault();
    const activeTenant = localStorage.getItem('tenantId') || auth.currentUser?.uid;
    if (!activeTenant) {
      alert("Sessão expirada. Faça login novamente.");
      navigate('/login');
      return;
    }

    setSalvando(true);
    try {
      // 🔥 BLINDAGEM MULTI-EMPRESA: Salva o contrato com a chave da empresa
      await addDoc(collection(db, "contratos"), { 
        ...form, 
        valorTotal: Number(form.valorTotal), 
        createdAt: serverTimestamp(),
        userId: activeTenant // 🔥 CADEADO DE SEGURANÇA CORPORATIVO
      });

      // 🔥 AUDITORIA
      await registrarLog("NOVO CONTRATO", `Gerou um novo contrato para o cliente: "${form.cliente}". Valor: R$ ${Number(form.valorTotal).toFixed(2)}.`);
      
      alert("Contrato formalizado e salvo com sucesso! 🎉");
      navigate("/contratos");
    } catch (err) { 
      alert("Erro ao salvar contrato: " + err.message); 
    } finally {
      setSalvando(false);
    }
  };

  // 🔍 Handler para seleção de cliente (auto-preenche dados cadastrais e vincula orçamento ativo se houver)
  const handleSelecionarCliente = (nomeClienteSelecionado) => {
    if (!nomeClienteSelecionado) {
      setForm(prev => ({ ...prev, cliente: "", tema: "", valorTotal: "", dataEvento: "", dataRetirada: "", dataDevolucao: "", horario: "", endereco: "", cpf: "", telefone: "" }));
      setPedidoIdVinculado("");
      return;
    }

    // 1. Localiza o cliente na lista de clientes cadastrados
    const clienteAchado = listaClientes.find(c => 
      String(c.id) === String(nomeClienteSelecionado) ||
      (c.nome && c.nome.toLowerCase().trim() === String(nomeClienteSelecionado).toLowerCase().trim()) ||
      (c.nomeFantasia && c.nomeFantasia.toLowerCase().trim() === String(nomeClienteSelecionado).toLowerCase().trim()) ||
      (c.nomeCompleto && c.nomeCompleto.toLowerCase().trim() === String(nomeClienteSelecionado).toLowerCase().trim())
    );

    const nomeFinal = clienteAchado?.nome || clienteAchado?.nomeFantasia || clienteAchado?.nomeCompleto || nomeClienteSelecionado;
    const cpfFinal = clienteAchado?.cpf || clienteAchado?.cnpj || clienteAchado?.documento || "";
    const telFinal = clienteAchado?.celular || clienteAchado?.telefone || clienteAchado?.whatsapp || "";
    const endFinal = clienteAchado?.endereco || clienteAchado?.enderecoCompleto || (clienteAchado?.rua ? `${clienteAchado.rua}, ${clienteAchado.numero || ''} - ${clienteAchado.bairro || ''} ${clienteAchado.cidade || ''}` : "");

    // 2. Procura orçamentos ou locações ativas vinculadas a ESTE CLIENTE ESPECÍFICO
    const nBusca = nomeFinal.toLowerCase().trim();
    const cId = clienteAchado?.id;

    const pedidosDesteCliente = listaPedidos.filter(p => {
      if (cId && (String(p.clienteId) === String(cId) || String(p.clienteUid) === String(cId))) return true;
      const pNome = (p.clienteNome || p.cliente || '').toLowerCase().trim();
      if (!pNome) return false;
      return pNome === nBusca || (pNome.length > 3 && nBusca.includes(pNome)) || (nBusca.length > 3 && pNome.includes(nBusca));
    });

    // 3. Se o cliente tiver orçamento ativo, auto-preenche tudo na hora
    if (pedidosDesteCliente.length > 0) {
      const pedidoMaisRecente = pedidosDesteCliente[0];
      setPedidoIdVinculado(pedidoMaisRecente.id);
      importarDados(pedidoMaisRecente);
    } else {
      setPedidoIdVinculado("");
      setForm(prev => {
        const atualizado = {
          ...prev,
          cliente: nomeFinal,
          cpf: cpfFinal || prev.cpf,
          telefone: telFinal || prev.telefone,
          endereco: endFinal || prev.endereco,
          tema: "",
          dataEvento: "",
          dataRetirada: "",
          dataDevolucao: "",
          horario: "",
          valorTotal: ""
        };
        return {
          ...atualizado,
          descricao: gerarMinutaContratoProfissional(atualizado)
        };
      });
    }
  };

  // 🎯 Lista dinâmica de pedidos a exibir no Seletor 2:
  // Se o cliente estiver selecionado, filtra APENAS os orçamentos/locações DAQUELE cliente.
  // Se nenhum cliente estiver selecionado, exibe TODOS os orçamentos/locações ativas da empresa.
  const pedidosExibidosNoSeletor = useMemo(() => {
    if (!form.cliente) {
      return listaPedidos;
    }
    const nomeClienteNorm = form.cliente.toLowerCase().trim();
    const clienteObj = listaClientes.find(c => 
      (c.nome && c.nome.toLowerCase().trim() === nomeClienteNorm) ||
      (c.nomeFantasia && c.nomeFantasia.toLowerCase().trim() === nomeClienteNorm) ||
      (c.nomeCompleto && c.nomeCompleto.toLowerCase().trim() === nomeClienteNorm)
    );
    const cId = clienteObj?.id;

    return listaPedidos.filter(p => {
      if (cId && (String(p.clienteId) === String(cId) || String(p.clienteUid) === String(cId))) return true;
      const pNome = (p.clienteNome || p.cliente || '').toLowerCase().trim();
      if (!pNome) return false;
      return pNome === nomeClienteNorm || (pNome.length > 3 && nomeClienteNorm.includes(pNome)) || (nomeClienteNorm.length > 3 && pNome.includes(nomeClienteNorm));
    });
  }, [form.cliente, listaPedidos, listaClientes]);

  return (
    <div className="novo-contrato-layout fade-in">
      <div className="container-form-luxury">
        
        {/* CABEÇALHO EXECUTIVO LIMPO */}
        <header className="form-header-luxury">
          <button 
            className="btn-voltar-luxury" 
            type="button" 
            onClick={() => navigate("/contratos")}
          >
            ← Voltar para Contratos
          </button>
          
          <div className="header-title-row-luxury">
            <div>
              <div className="badge-minuta-head">
                <span>📜 MINUTA &amp; FORMALIZAÇÃO JURÍDICA</span>
              </div>
              <h1 className="title-novo-contrato">Novo Contrato de Locação</h1>
              <p className="subtitle-novo-contrato">
                Selecione o cliente ou o pedido/orçamento para preencher todos os dados automaticamente.
              </p>
            </div>
          </div>
        </header>

        <form onSubmit={handleSalvar} className="main-form-luxury">
          <div className="grid-duas-colunas-contrato">
            
            {/* COLUNA ESQUERDA: DADOS, LOGÍSTICA E VALORES */}
            <div className="coluna-formulario-esquerda">
              
              {/* SEÇÃO 1: DADOS DO CONTRATANTE & FESTA */}
              <section className="form-section-card-luxury">
                <div className="section-header-card">
                  <div className="section-icon-box icon-purple">
                    <i className="fas fa-user-tie"></i>
                  </div>
                  <div>
                    <h3 className="section-title-luxury">1. Dados do Contratante &amp; Evento</h3>
                    <span className="section-sub-luxury">Selecione o cliente ou pedido para auto-preencher</span>
                  </div>
                </div>

                <div className="grid-inputs-luxury">
                  
                  {/* CAMPO 1: CLIENTE / LOCATÁRIO (SELETOR ÚNICO) */}
                  <div className="input-field-luxury full">
                    <label>👤 Selecionar Cliente *</label>
                    <select 
                      className="select-celebre"
                      value={form.cliente}
                      onChange={e => handleSelecionarCliente(e.target.value)}
                    >
                      <option value="">Selecione um cliente cadastrado...</option>
                      {listaClientes.map(c => {
                        const nomeC = c.nome || c.nomeFantasia || c.nomeCompleto;
                        const docC = c.cpf || c.cnpj ? `(${c.cpf || c.cnpj})` : '';
                        return (
                          <option key={c.id} value={nomeC}>
                            👤 {nomeC} {docC}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* CAMPO 2: ORÇAMENTO / PEDIDO DE LOCAÇÃO (FILTRADO POR CLIENTE OU GERAL) */}
                  <div className="input-field-luxury full">
                    <label>
                      ⚡ Selecionar Orçamento / Pedido de Locação {form.cliente ? `(Filtrado para ${form.cliente})` : '(Geral / Todos da Empresa)'} *
                    </label>
                    <select 
                      className="select-celebre"
                      style={{ 
                        borderColor: pedidoIdVinculado ? '#c5a059' : '#cbd5e1', 
                        background: pedidoIdVinculado ? '#fefdf8' : '#ffffff',
                        fontWeight: pedidoIdVinculado ? '700' : 'normal'
                      }}
                      value={pedidoIdVinculado}
                      onChange={e => {
                        const idPed = e.target.value;
                        setPedidoIdVinculado(idPed);
                        if (!idPed) return;
                        const ped = listaPedidos.find(p => p.id === idPed);
                        if (ped) importarDados(ped);
                      }}
                    >
                      <option value="">
                        {!form.cliente 
                          ? "Selecione um orçamento ou pedido para preencher tudo..." 
                          : pedidosExibidosNoSeletor.length > 0 
                            ? `Selecione um orçamento deste cliente (${pedidosExibidosNoSeletor.length} em aberto)...` 
                            : `Nenhum orçamento ativo para ${form.cliente} (Preenchimento manual)`}
                      </option>
                      {pedidosExibidosNoSeletor.map(p => {
                        const isOrc = verificarSeEhOrcamento(p);
                        const numPed = p.numeroPedido ? `#${p.numeroPedido}` : `#${p.id.slice(0, 5).toUpperCase()}`;
                        const nomePedCliente = p.clienteNome || p.cliente || 'Cliente';
                        const temaPed = p.temaFesta || p.tema || 'Festa';
                        const vlr = Number(p.valorTotal || p.total || p.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                        const dt = p.dataRetirada ? p.dataRetirada.split('-').reverse().join('/') : (p.dataEvento ? p.dataEvento.split('-').reverse().join('/') : 'S/D');

                        return (
                          <option key={p.id} value={p.id}>
                            {isOrc ? '📝 [Orçamento]' : '⚡ [Locação]'} {numPed} — {nomePedCliente} — {vlr} ({dt} - {temaPed})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* STATUS / CONFIRMAÇÃO DO PEDIDO VINCULADO */}
                  {pedidoIdVinculado && (
                    <div className="banner-pedido-sugerido-contrato" style={{ gridColumn: '1 / -1', marginTop: '2px' }}>
                      <span className="banner-pedido-texto">
                        <i className="fas fa-check-circle" style={{ color: '#16a34a', fontSize: '1.2rem' }}></i>
                        <span>
                          Pedido Vinculado: <strong>"{form.tema || 'Celebração'}"</strong> — Valor: <strong style={{ color: '#15803d' }}>R$ {Number(form.valorTotal || 0).toFixed(2)}</strong> — Data: <strong>{form.dataEvento ? form.dataEvento.split('-').reverse().join('/') : '--/--/----'}</strong>
                        </span>
                      </span>
                      <button 
                        type="button" 
                        className="btn-puxar-pedido-sugerido"
                        onClick={() => {
                          const ped = listaPedidos.find(p => p.id === pedidoIdVinculado);
                          if (ped) importarDados(ped);
                        }}
                      >
                        🔄 Recarregar Dados ➔
                      </button>
                    </div>
                  )}

                  <div className="input-field-luxury">
                    <label>CPF ou CNPJ do Cliente</label>
                    <input 
                      type="text" 
                      value={form.cpf} 
                      onChange={e => setForm({...form, cpf: e.target.value})} 
                      placeholder="000.000.000-00" 
                      className="input-celebre"
                    />
                  </div>

                  <div className="input-field-luxury">
                    <label>WhatsApp / Telefone</label>
                    <input 
                      type="text" 
                      value={form.telefone} 
                      onChange={e => setForm({...form, telefone: e.target.value})} 
                      placeholder="(00) 00000-0000" 
                      className="input-celebre"
                    />
                  </div>

                  <div className="input-field-luxury full">
                    <label>Tema ou Nome da Celebração</label>
                    <input 
                      type="text" 
                      value={form.tema} 
                      onChange={e => setForm({...form, tema: e.target.value})} 
                      placeholder="Ex: Aniversário Infantil, Casamento Rústico, Pegue e Monte" 
                      className="input-celebre"
                    />
                  </div>
                </div>
              </section>

              {/* SEÇÃO 2: LOGÍSTICA & PRAZOS */}
              <section className="form-section-card-luxury">
                <div className="section-header-card">
                  <div className="section-icon-box icon-blue">
                    <i className="fas fa-calendar-alt"></i>
                  </div>
                  <div>
                    <h3 className="section-title-luxury">2. Prazos, Datas &amp; Logística</h3>
                    <span className="section-sub-luxury">Período de locação e endereço do evento</span>
                  </div>
                </div>

                <div className="grid-inputs-luxury">
                  <div className="input-field-luxury">
                    <label>Data do Evento *</label>
                    <input 
                      type="date" 
                      value={form.dataEvento} 
                      onChange={e => setForm({...form, dataEvento: e.target.value})} 
                      required 
                      className="input-celebre"
                    />
                  </div>

                  <div className="input-field-luxury">
                    <label>Data de Retirada / Saída</label>
                    <input 
                      type="date" 
                      value={form.dataRetirada} 
                      onChange={e => setForm({...form, dataRetirada: e.target.value})} 
                      className="input-celebre"
                    />
                  </div>

                  <div className="input-field-luxury">
                    <label>Data Limite de Devolução</label>
                    <input 
                      type="date" 
                      value={form.dataDevolucao} 
                      onChange={e => setForm({...form, dataDevolucao: e.target.value})} 
                      className="input-celebre"
                    />
                  </div>

                  <div className="input-field-luxury">
                    <label>Horário (Saída/Retorno)</label>
                    <input 
                      type="text" 
                      value={form.horario} 
                      onChange={e => setForm({...form, horario: e.target.value})} 
                      placeholder="Ex: 14:00h às 18:00h" 
                      className="input-celebre"
                    />
                  </div>

                  <div className="input-field-luxury full">
                    <label>Endereço Completo do Evento / Entrega</label>
                    <input 
                      type="text" 
                      value={form.endereco} 
                      onChange={e => setForm({...form, endereco: e.target.value})} 
                      placeholder="Rua, Número, Bairro, Cidade e Ponto de Referência" 
                      className="input-celebre"
                    />
                  </div>
                </div>
              </section>

              {/* SEÇÃO 3: VALORES E STATUS */}
              <section className="form-section-card-luxury">
                <div className="section-header-card">
                  <div className="section-icon-box icon-green">
                    <i className="fas fa-dollar-sign"></i>
                  </div>
                  <div>
                    <h3 className="section-title-luxury">3. Condições Financeiras &amp; Status</h3>
                    <span className="section-sub-luxury">Valor total da locação e estado da assinatura</span>
                  </div>
                </div>

                <div className="grid-inputs-luxury">
                  <div className="input-field-luxury">
                    <label>Valor Total da Locação (R$) *</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={form.valorTotal} 
                      onChange={e => setForm({...form, valorTotal: e.target.value})} 
                      required 
                      placeholder="0.00" 
                      className="input-celebre input-valor-destaque"
                    />
                  </div>

                  <div className="input-field-luxury">
                    <label>Status do Documento</label>
                    <select 
                      value={form.status} 
                      onChange={e => setForm({...form, status: e.target.value})}
                      className="select-celebre"
                    >
                      <option value="Em Aberto">⏳ Em Aberto (Aguardando Assinatura)</option>
                      <option value="Assinado">✍️ Assinado Digitalmente</option>
                      <option value="Finalizado">✅ Finalizado / Concluído</option>
                      <option value="Cancelado">❌ Cancelado</option>
                    </select>
                  </div>
                </div>
              </section>

            </div>

            {/* COLUNA DIREITA: MINUTA, MODELOS E AÇÕES */}
            <div className="coluna-formulario-direita">
              
              <section className="form-section-card-luxury card-minuta-full">
                <div className="header-section-modelos-luxury">
                  <div className="section-header-card" style={{ marginBottom: 0 }}>
                    <div className="section-icon-box icon-amber">
                      <i className="fas fa-file-contract"></i>
                    </div>
                    <div>
                      <h3 className="section-title-luxury">4. Minuta, Cláusulas &amp; Acervo</h3>
                      <span className="section-sub-luxury">Contrato jurídico completo com dados do cliente e acervo</span>
                    </div>
                  </div>

                  {/* TOOLBAR COM GERADOR E SELETOR DE MODELOS */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <button 
                      type="button" 
                      className="btn-puxar-pedido-sugerido"
                      style={{ background: '#c5a059', color: '#0f172a', fontWeight: '850', fontSize: '0.74rem' }}
                      onClick={() => {
                        const minuta = gerarMinutaContratoProfissional(form);
                        setForm(prev => ({ ...prev, descricao: minuta }));
                      }}
                    >
                      <i className="fas fa-file-signature"></i> 📜 Gerar Minuta Profissional (1 Clique)
                    </button>

                    <div className="seletor-modelos-box">
                      <select onChange={aplicarModelo} className="select-modelo-luxury" defaultValue="">
                        <option value="" disabled>📄 Inserir Cláusulas de Modelo...</option>
                        <option value="GERAR_COMPLETO">✨ Modelo Padrão Completo (Com todas as cláusulas)</option>
                        {meusModelos.map(m => (
                          <option key={m.id} value={m.id}>📋 {m.titulo}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="input-field-luxury full textarea-container-flex">
                  <textarea 
                    value={form.descricao} 
                    onChange={e => setForm({...form, descricao: e.target.value})} 
                    placeholder="Selecione o cliente ou o pedido acima para puxar os dados e itens do acervo..." 
                    className="textarea-celebre textarea-full-height"
                  />
                </div>

                {/* RODAPÉ DE AÇÕES INTEGRADO NA COLUNA */}
                <div className="form-footer-actions-luxury" style={{ margin: '16px 0 0 0' }}>
                  <button 
                    type="button" 
                    className="btn-cancelar-form-luxury"
                    onClick={() => navigate("/contratos")}
                  >
                    Cancelar
                  </button>

                  <button 
                    type="submit" 
                    className="btn-submit-contrato-luxury"
                    disabled={salvando}
                  >
                    {salvando ? (
                      <span><i className="fas fa-spinner fa-spin"></i> Salvando...</span>
                    ) : (
                      <span>💾 Salvar e Gerar Contrato ➔</span>
                    )}
                  </button>
                </div>

              </section>

            </div>

          </div>
        </form>

      </div>
    </div>
  );
};

export default NovoContrato;