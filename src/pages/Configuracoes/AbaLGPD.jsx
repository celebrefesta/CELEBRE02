import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  addDoc
} from 'firebase/firestore';
import { formatarDataExibicao } from '../../utils/periodoTesteUtils';

const AbaLGPD = ({ tenantId, usuarioLogado, registrarLog, configEmpresa = {} }) => {
  const isSuperAdmin = usuarioLogado?.email === 'celebrefesta25@gmail.com';

  // 🛡️ ESTADOS DO DPO / ENCARREGADO DE DADOS
  const [dpoNome, setDpoNome] = useState(configEmpresa.dpoNome || '');
  const [dpoEmail, setDpoEmail] = useState(configEmpresa.dpoEmail || '');
  const [dpoTelefone, setDpoTelefone] = useState(configEmpresa.dpoTelefone || '');
  const [dpoPrazo, setDpoPrazo] = useState(configEmpresa.dpoPrazo || '15');
  const [salvandoDPO, setSalvandoDPO] = useState(false);
  const [salvoFeedback, setSalvoFeedback] = useState(false);
  const [dpoSalvo, setDpoSalvo] = useState(false);

  // 👥 LISTAGEM DE CLIENTES PARA OPERAÇÕES LGPD
  const [clientes, setClientes] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(false);

  // 📄 ESTADOS DO DOSSIÊ DO TITULAR (PORTABILIDADE - ART. 18, V)
  const [modalDossie, setModalDossie] = useState(false);
  const [clienteSelecionadoDossie, setClienteSelecionadoDossie] = useState('');
  const [filtroEmpresaDossie, setFiltroEmpresaDossie] = useState('todas');
  const [dadosDossie, setDadosDossie] = useState(null);
  const [carregandoDossie, setCarregandoDossie] = useState(false);

  // 🛡️ ESTADOS DE ANONIMIZAÇÃO (DIREITO AO ESQUECIMENTO - ART. 18, VI)
  const [modalAnonimizar, setModalAnonimizar] = useState(false);
  const [clienteSelecionadoAnon, setClienteSelecionadoAnon] = useState('');
  const [filtroEmpresaAnon, setFiltroEmpresaAnon] = useState('todas');
  const [motivoAnonimizacao, setMotivoAnonimizacao] = useState('Solicitação formal do titular (Art. 18, VI da LGPD)');
  const [confirmacaoTexto, setConfirmacaoTexto] = useState('');
  const [anonimizando, setAnonimizando] = useState(false);

  // 📋 LIVRO DE PROTOCOLOS LGPD (HISTÓRICO AUDITÁVEL)
  const [protocolos, setProtocolos] = useState([]);
  const [loadingProtocolos, setLoadingProtocolos] = useState(true);

  // 📑 MODAL DE POLÍTICA DE PRIVACIDADE DA EMPRESA
  const [modalPoliticaEmpresa, setModalPoliticaEmpresa] = useState(false);

  // 📋 FEEDBACK DE COPIAR CLÁUSULA
  const [copiadoClausula, setCopiadoClausula] = useState(false);

  useEffect(() => {
    carregarClientes();
    carregarProtocolos();
    carregarConfigDPO();
  }, [tenantId, usuarioLogado]);

  const carregarConfigDPO = async () => {
    try {
      const targetId = tenantId || localStorage.getItem('tenantId') || usuarioLogado?.uid;
      if (!targetId) return;
      const confRef = doc(db, 'configuracoes_empresa', targetId);
      const snap = await getDoc(confRef);
      if (snap.exists()) {
        const d = snap.data();
        if (d.dpoNome) setDpoNome(d.dpoNome);
        if (d.dpoEmail) setDpoEmail(d.dpoEmail);
        if (d.dpoTelefone) setDpoTelefone(d.dpoTelefone);
        if (d.dpoPrazo) setDpoPrazo(d.dpoPrazo);
        if (d.dpoNome?.trim() && d.dpoEmail?.trim() && d.dpoTelefone?.trim()) {
          setDpoSalvo(true);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar dados do DPO:", err);
    }
  };

  const carregarClientes = async () => {
    setLoadingClientes(true);
    try {
      const targetId = tenantId || localStorage.getItem('tenantId') || usuarioLogado?.uid;
      let list = [];

      // Mapeamento de empresas para Super Admin saber de quem é cada cliente
      const mapEmpresas = {};
      if (isSuperAdmin) {
        try {
          const [empSnap, usersSnap] = await Promise.all([
            getDocs(collection(db, 'configuracoes_empresa')),
            getDocs(collection(db, 'usuarios'))
          ]);
          usersSnap.docs.forEach(d => {
            const u = d.data();
            mapEmpresas[d.id] = {
              nome: u.nomeExibicao || u.nomeCompleto || u.displayName || u.email || 'Empresa Sem Nome',
              doc: u.documento || ''
            };
          });
          empSnap.docs.forEach(d => {
            const e = d.data();
            mapEmpresas[d.id] = {
              nome: e.nomeEmpresa || e.nomeFantasia || e.razaoSocial || mapEmpresas[d.id]?.nome || 'Empresa Sem Nome',
              doc: e.documentoEmpresa || e.cnpj || mapEmpresas[d.id]?.doc || ''
            };
          });
        } catch (eEmp) {
          console.warn("Aviso ao carregar mapeamento de empresas para LGPD:", eEmp);
        }
      }

      if (targetId) {
        const q = query(collection(db, 'clientes'), where('userId', '==', targetId));
        const snap = await getDocs(q);
        list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (list.length === 0) {
          try {
            const qT = query(collection(db, 'clientes'), where('tenantId', '==', targetId));
            const snapT = await getDocs(qT);
            list = snapT.docs.map(d => ({ id: d.id, ...d.data() }));
          } catch {}
        }
      }

      // Se ainda for 0 e for a conta Master do Celebre, busca clientes cadastrados para testes e demonstração
      if (list.length === 0 && isSuperAdmin) {
        try {
          const snapAll = await getDocs(collection(db, 'clientes'));
          list = snapAll.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch {}
      }

      // Atribui nome da empresa de origem a cada cliente
      list.forEach(item => {
        const parentId = item.userId || item.tenantId;
        if (parentId && mapEmpresas[parentId]) {
          item.nomeEmpresaOrigem = mapEmpresas[parentId].nome;
          item.docEmpresaOrigem = mapEmpresas[parentId].doc;
        } else {
          item.nomeEmpresaOrigem = configEmpresa?.nomeEmpresa || 'Celebre Festas (Matriz)';
          item.docEmpresaOrigem = configEmpresa?.documentoEmpresa || '';
        }
      });

      // Deduplicação inteligente por Documento (CPF/CNPJ) e Nome para não duplicar na lista
      const map = new Map();
      list.forEach(item => {
        const docLimpo = (item.cpf || item.cnpj || '').replace(/\D/g, '');
        const chave = docLimpo ? docLimpo : `${(item.nome || '').trim().toLowerCase()}_${item.id}`;
        if (!map.has(chave)) {
          map.set(chave, item);
        }
      });
      const finalList = Array.from(map.values());
      finalList.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
      setClientes(finalList);
    } catch (err) {
      console.error("Erro ao listar clientes para LGPD:", err);
    } finally {
      setLoadingClientes(false);
    }
  };

  const carregarProtocolos = async () => {
    setLoadingProtocolos(true);
    try {
      const targetId = tenantId || localStorage.getItem('tenantId') || usuarioLogado?.uid;
      let q = targetId 
        ? query(collection(db, 'solicitacoes_lgpd'), where('tenantId', '==', targetId))
        : collection(db, 'solicitacoes_lgpd');

      if (usuarioLogado?.email === 'celebrefesta25@gmail.com') {
        q = collection(db, 'solicitacoes_lgpd');
      }

      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0));
      setProtocolos(list);
    } catch (err) {
      console.error("Erro ao carregar protocolos LGPD:", err);
    } finally {
      setLoadingProtocolos(false);
    }
  };

  const salvarDPO = async (e) => {
    if (e) e.preventDefault();
    if (!dpoNome?.trim()) {
      alert("⚠️ Campo Obrigatório!\nPor favor, preencha o Nome do Encarregado / Responsável.");
      return;
    }
    if (!dpoEmail?.trim() || !dpoEmail.includes('@')) {
      alert("⚠️ E-mail Inválido!\nPor favor, informe um E-mail Oficial de Privacidade válido (com @).");
      return;
    }
    const telLimpo = (dpoTelefone || '').replace(/\D/g, '');
    if (!dpoTelefone?.trim() || telLimpo.length < 8) {
      alert("⚠️ Telefone Obrigatório!\nPor favor, informe um Telefone / WhatsApp com DDD para contato de privacidade.");
      return;
    }

    setSalvandoDPO(true);
    try {
      const targetId = tenantId || localStorage.getItem('tenantId') || usuarioLogado?.uid;
      if (!targetId) throw new Error("ID da empresa não identificado.");

      const confRef = doc(db, 'configuracoes_empresa', targetId);
      await setDoc(confRef, {
        dpoNome: dpoNome.trim(),
        dpoEmail: dpoEmail.trim(),
        dpoTelefone: dpoTelefone.trim(),
        dpoPrazo: dpoPrazo.trim(),
        dpoAtualizadoEm: new Date().toISOString()
      }, { merge: true });

      if (registrarLog) {
        await registrarLog("LGPD / DPO", `Atualizou os dados do Encarregado de Proteção de Dados: ${dpoNome.trim()}`);
      }

      setDpoSalvo(true);
      setSalvoFeedback(true);
      setTimeout(() => setSalvoFeedback(false), 4000);
      alert("✅ Informações do Encarregado (DPO) salvas com sucesso!\n\nO Passo 2 (Ferramentas de Atendimento aos Titulares) foi desbloqueado.");
    } catch (err) {
      console.error("Erro ao salvar DPO:", err);
      alert("Erro ao salvar configurações do Encarregado.");
    } finally {
      setSalvandoDPO(false);
    }
  };

  // 📄 GERAR DOSSIÊ DO TITULAR (PORTABILIDADE)
  const handleGerarDossie = async () => {
    if (!clienteSelecionadoDossie) {
      alert("Por favor, selecione um cliente para gerar o Dossiê de Portabilidade.");
      return;
    }
    setCarregandoDossie(true);
    try {
      const targetId = tenantId || localStorage.getItem('tenantId') || usuarioLogado?.uid;
      const cliente = clientes.find(c => c.id === clienteSelecionadoDossie);
      if (!cliente) return;

      // Buscar locações e contratos do cliente
      let locacoes = [];
      try {
        const qLoc = query(
          collection(db, 'locacoes'),
          where('clienteId', '==', cliente.id)
        );
        const snapLoc = await getDocs(qLoc);
        locacoes = snapLoc.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (eLoc) {
        console.warn("Aviso ao buscar locações do cliente:", eLoc);
      }

      const protocolo = `LGPD-DOS-${Date.now().toString().slice(-6)}`;
      const empresaNomeTitular = cliente.nomeEmpresaOrigem || nomeEmpresaExibida;
      const empresaDocTitular = cliente.docEmpresaOrigem || docEmpresaExibido;

      const dossieObj = {
        protocolo,
        geradoEm: new Date().toISOString(),
        geradoPor: usuarioLogado?.email || 'Administrador',
        cliente,
        empresaControladora: empresaNomeTitular,
        empresaDocumento: empresaDocTitular,
        totalLocacoes: locacoes.length,
        locacoes: locacoes.map(l => ({
          numeroContrato: l.numeroContrato || l.id,
          dataEvento: l.dataEvento || l.dataRetirada || '—',
          status: l.status || '—',
          valorTotal: l.valorTotal || l.valor || 0
        }))
      };

      setDadosDossie(dossieObj);

      // Registrar protocolo no histórico
      await addDoc(collection(db, 'solicitacoes_lgpd'), {
        tenantId: targetId,
        protocolo,
        tipo: 'Portabilidade / Dossiê (Art. 18, V)',
        titularNome: cliente.nome || 'Cliente',
        titularDocumento: cliente.cpf || cliente.cnpj || '—',
        titularEmail: cliente.email || '—',
        status: 'Concluído',
        criadoEm: new Date().toISOString(),
        criadoPor: usuarioLogado?.email || 'Sistema',
        detalhes: `Dossiê de portabilidade emitido com ${locacoes.length} registros contratuais.`
      });

      if (registrarLog) {
        await registrarLog("LGPD / DOSSIÊ", `Emitiu Dossiê de Portabilidade para o titular: ${cliente.nome} (Protocolo: ${protocolo})`);
      }

      carregarProtocolos();
    } catch (err) {
      console.error("Erro ao gerar dossiê do titular:", err);
      alert("Erro ao reunir dados do titular para o dossiê.");
    } finally {
      setCarregandoDossie(false);
    }
  };

  // 🛡️ EXECUTAR ANONIMIZAÇÃO SEGURA (DIREITO AO ESQUECIMENTO COM SALVAGUARDA FISCAL)
  const handleExecutarAnonimizacao = async () => {
    if (!clienteSelecionadoAnon) {
      alert("Selecione um cliente para anonimizar.");
      return;
    }
    const cliente = clientes.find(c => c.id === clienteSelecionadoAnon);
    if (!cliente) return;

    if (confirmacaoTexto.trim().toUpperCase() !== 'ANONIMIZAR') {
      alert("Por favor, digite a palavra ANONIMIZAR para confirmar esta ação definitiva.");
      return;
    }

    setAnonimizando(true);
    try {
      const protocolo = `LGPD-DEL-${Date.now().toString().slice(-6)}`;
      const docRef = doc(db, 'clientes', cliente.id);

      // Substituição irreversível de dados identificáveis, preservando ID e integridade contábil
      const payloadAnonimo = {
        nome: `Titular Anonimizado (${protocolo})`,
        nomeFantasia: '',
        cpf: '000.000.000-00',
        cnpj: '',
        rg: '',
        email: `anonimizado_${Date.now()}@lgpd.invalid`,
        celular: '',
        telefone: '',
        whatsapp: '',
        endereco: 'Endereço suprimido a pedido do titular (Art. 18, VI LGPD)',
        bairro: '',
        cidade: cliente.cidade || '',
        uf: cliente.uf || '',
        cep: '',
        complemento: '',
        observacoes: `[REGISTRO LGPD]: Dados pessoais anonimizados em ${new Date().toLocaleDateString('pt-BR')} sob protocolo ${protocolo}. Motivo: ${motivoAnonimizacao}. Salvaguarda fiscal de contratos mantida conforme Art. 16, I da Lei 13.709/2018.`,
        isAnonimizado: true,
        protocoloAnonimizacao: protocolo,
        anonimizadoEm: new Date().toISOString(),
        anonimizadoPor: usuarioLogado?.email || 'Admin'
      };

      await updateDoc(docRef, payloadAnonimo);

      const targetId = tenantId || localStorage.getItem('tenantId') || usuarioLogado?.uid;

      // Registrar protocolo no Livro LGPD
      await addDoc(collection(db, 'solicitacoes_lgpd'), {
        tenantId: targetId,
        protocolo,
        tipo: 'Anonimização / Eliminação (Art. 18, VI)',
        titularNome: `Titular Anterior: ${cliente.nome}`,
        titularDocumento: cliente.cpf || cliente.cnpj || '—',
        titularEmail: cliente.email || '—',
        status: 'Concluído (Anonimizado)',
        criadoEm: new Date().toISOString(),
        criadoPor: usuarioLogado?.email || 'Sistema',
        detalhes: `Dados pessoais anonimizados permanentemente com resguardo dos lançamentos contábeis. Motivo: ${motivoAnonimizacao}`
      });

      if (registrarLog) {
        await registrarLog("LGPD / ANONIMIZAÇÃO", `Anonimizou dados pessoais do cliente ${cliente.nome} (Protocolo: ${protocolo})`);
      }

      alert(`✅ Titular anonimizado com sucesso!\n\nProtocolo Oficial: ${protocolo}\nOs dados pessoais foram eliminados com segurança jurídica e salvaguarda fiscal.`);
      setModalAnonimizar(false);
      setClienteSelecionadoAnon('');
      setConfirmacaoTexto('');
      carregarClientes();
      carregarProtocolos();
    } catch (err) {
      console.error("Erro ao anonimizar titular:", err);
      alert("Erro ao executar anonimização do titular.");
    } finally {
      setAnonimizando(false);
    }
  };

  const copiarClausulaContrato = () => {
    const texto = `CLÁUSULA DE PROTEÇÃO DE DADOS (LGPD - LEI Nº 13.709/2018):
O(A) LOCATÁRIO(A) declara estar ciente e concorda expressamente que a LOCADORA coletará e tratará seus dados pessoais (nome, documento de identificação, endereço, telefone e dados de contato) exclusivamente para as finalidades essenciais de: (a) qualificação das partes e formalização deste instrumento contratual; (b) execução da logística de entrega, montagem, desmontagem e recolhimento das peças e materiais de acervo locados; (c) cumprimento de obrigações legais, fiscais e tributárias decorrentes da operação comercial; e (d) comunicações operacionais a respeito do evento contratado. A LOCADORA compromete-se a adotar medidas técnicas e administrativas de segurança aptas a proteger os dados pessoais contra acessos não autorizados ou tratamentos ilícitos, não compartilhando dados com terceiros para fins publicitários ou comerciais alheios a este contrato, ressalvado o cumprimento de determinação legal ou de autoridade competente. Nos termos do Art. 18 da Lei 13.709/2018, o titular poderá requerer à LOCADORA, a qualquer momento, confirmação de tratamento, acesso, correção ou eliminação dos dados, respeitado o prazo legal de retenção para resguardo de direitos e guarda fiscal.`;

    navigator.clipboard.writeText(texto).then(() => {
      setCopiadoClausula(true);
      setTimeout(() => setCopiadoClausula(false), 3000);
    });
  };

  const imprimirDossie = () => {
    window.print();
  };

  const nomeEmpresaExibida = configEmpresa.nomeEmpresa || 'Celebre Festas & Decorações';
  const docEmpresaExibido = configEmpresa.documentoEmpresa || 'CNPJ / CPF da Empresa';

  // 🔒 REGRA DE OURO: Passo 2 só é liberado se Passo 1 (DPO) estiver preenchido e salvo
  const passo1Concluido = Boolean(dpoSalvo && dpoNome?.trim() && dpoEmail?.trim() && dpoTelefone?.trim());

  // Ações condicionadas ao Passo 1
  const handleAbrirDossie = () => {
    if (!passo1Concluido) {
      alert("🔒 Etapa Bloqueada!\n\nVocê precisa preencher e salvar todos os dados do Encarregado (DPO) no Passo 1 acima antes de poder gerar Dossiês de titulares.");
      return;
    }
    setDadosDossie(null);
    setClienteSelecionadoDossie('');
    setModalDossie(true);
  };

  const handleAbrirAnonimizacao = () => {
    if (!passo1Concluido) {
      alert("🔒 Etapa Bloqueada!\n\nVocê precisa preencher e salvar todos os dados do Encarregado (DPO) no Passo 1 acima antes de poder realizar anonimizações.");
      return;
    }
    setClienteSelecionadoAnon('');
    setConfirmacaoTexto('');
    setModalAnonimizar(true);
  };

  const handleAbrirPolitica = () => {
    if (!passo1Concluido) {
      alert("🔒 Etapa Bloqueada!\n\nPreencha e salve os dados do Encarregado (DPO) no Passo 1 para que o documento oficial da Política contenha os contatos do responsável.");
      return;
    }
    setModalPoliticaEmpresa(true);
  };

  // 🏢 Lista de empresas únicas encontradas para filtro do Super Admin
  const listaEmpresasUnicas = useMemo(() => {
    const setEmp = new Set();
    clientes.forEach(c => {
      if (c.nomeEmpresaOrigem) setEmp.add(c.nomeEmpresaOrigem);
    });
    return Array.from(setEmp).sort();
  }, [clientes]);

  // Filtros aplicados por empresa
  const clientesExibidosDossie = useMemo(() => {
    if (filtroEmpresaDossie === 'todas') return clientes;
    return clientes.filter(c => c.nomeEmpresaOrigem === filtroEmpresaDossie);
  }, [clientes, filtroEmpresaDossie]);

  const clientesExibidosAnon = useMemo(() => {
    const naoAnonimizados = clientes.filter(c => !c.isAnonimizado);
    if (filtroEmpresaAnon === 'todas') return naoAnonimizados;
    return naoAnonimizados.filter(c => c.nomeEmpresaOrigem === filtroEmpresaAnon);
  }, [clientes, filtroEmpresaAnon]);

  return (
    <div className="lgpd-container fade-in">
      
      {/* 🌟 HERO BANNER LGPD */}
      <div className="lgpd-hero-banner">
        <div className="lgpd-hero-text">
          <div className="lgpd-badge-pill">
            <i className="fas fa-scale-balanced"></i> Conformidade Jurídica • Lei Geral de Proteção de Dados (Lei 13.709/2018)
          </div>
          <h2>Central de Governança & Privacidade de Dados</h2>
          <p>
            Módulo prático para resguardar a sua empresa perante a ANPD e garantir a soberania 
            e o cumprimento rigoroso de todos os direitos dos seus clientes e titulares de dados.
          </p>
        </div>
        <div className="lgpd-hero-icon">
          <i className="fas fa-shield-halved"></i>
        </div>
      </div>

      {/* 📊 PAINEL DE STATUS DE CONFORMIDADE */}
      <div className="lgpd-status-grid">
        <div className="lgpd-status-card">
          <div className="status-indicator">
            <span className={`status-dot ${passo1Concluido ? 'active' : 'warn'}`}></span>
            <strong>Encarregado (DPO)</strong>
          </div>
          <span className="status-val">{passo1Concluido ? 'Ativo & Salvo' : 'Pendente (Passo 1)'}</span>
          <small>{passo1Concluido ? dpoEmail : 'Preencha os campos abaixo'}</small>
        </div>

        <div className="lgpd-status-card">
          <div className="status-indicator">
            <span className="status-dot active"></span>
            <strong>Art. 18, V (Portabilidade)</strong>
          </div>
          <span className="status-val">Dossiê Prontos</span>
          <small>Emissão em 1 clique por titular</small>
        </div>

        <div className="lgpd-status-card">
          <div className="status-indicator">
            <span className="status-dot active"></span>
            <strong>Art. 18, VI (Esquecimento)</strong>
          </div>
          <span className="status-val">Anonimização Fiscal</span>
          <small>Proteção civil e tributária (5 anos)</small>
        </div>

        <div className="lgpd-status-card">
          <div className="status-indicator">
            <span className="status-dot active"></span>
            <strong>Protocolos Registrados</strong>
          </div>
          <span className="status-val">{protocolos.length} Ações</span>
          <small>Histórico auditável registrado</small>
        </div>
      </div>

      {/* 🛡️ SEÇÃO 1: CONFIGURAÇÃO DO ENCARREGADO DE DADOS (DPO) */}
      <div className="lgpd-card-box">
        <div className="lgpd-card-header">
          <div className="icon-badge amber">
            <i className="fas fa-user-shield"></i>
          </div>
          <div>
            <h3>1. Encarregado pelo Tratamento de Dados Pessoais (DPO)</h3>
            <p>
              Em conformidade com o <strong>Art. 41 da LGPD</strong>, identifique quem é o responsável 
              na sua locadora para atender eventuais dúvidas ou solicitações de titulares.
            </p>
          </div>
        </div>

        <form onSubmit={salvarDPO} className="lgpd-form-dpo">
          <div className="lgpd-form-row">
            <div className="lgpd-form-group">
              <label>Nome do Encarregado / Responsável <span style={{ color: '#ef4444' }}>*</span></label>
              <input 
                type="text" 
                placeholder="Ex: Camila Vichinhsk ou Nome do Sócio" 
                value={dpoNome} 
                onChange={e => {
                  setDpoNome(e.target.value);
                  setDpoSalvo(false);
                }} 
                required
              />
              <small>Pode ser o próprio proprietário ou gestor da empresa.</small>
            </div>

            <div className="lgpd-form-group">
              <label>E-mail Oficial de Privacidade <span style={{ color: '#ef4444' }}>*</span></label>
              <input 
                type="email" 
                placeholder="Ex: privacidade@suaempresa.com.br ou email corporativo" 
                value={dpoEmail} 
                onChange={e => {
                  setDpoEmail(e.target.value);
                  setDpoSalvo(false);
                }} 
                required
              />
              <small>Endereço onde clientes podem enviar dúvidas ou solicitações.</small>
            </div>
          </div>

          <div className="lgpd-form-row">
            <div className="lgpd-form-group">
              <label>Telefone / WhatsApp para Privacidade <span style={{ color: '#ef4444' }}>*</span></label>
              <input 
                type="text" 
                placeholder="(00) 00000-0000" 
                value={dpoTelefone} 
                onChange={e => {
                  setDpoTelefone(e.target.value);
                  setDpoSalvo(false);
                }} 
                required
              />
            </div>

            <div className="lgpd-form-group">
              <label>Prazo Legal Máximo para Resposta</label>
              <select value={dpoPrazo} onChange={e => {
                setDpoPrazo(e.target.value);
                setDpoSalvo(false);
              }}>
                <option value="15">15 dias corridos (Padrão legal Art. 19, II)</option>
                <option value="5">5 dias úteis (Atendimento Express)</option>
                <option value="7">7 dias úteis</option>
              </select>
            </div>
          </div>

          <div className="lgpd-btn-actions-row">
            <button type="submit" className="btn-lgpd-save" disabled={salvandoDPO}>
              {salvandoDPO ? (
                <><i className="fas fa-spinner fa-spin"></i> Salvando...</>
              ) : (
                <><i className="fas fa-check-circle"></i> Salvar Informações do DPO</>
              )}
            </button>
            {salvoFeedback && (
              <span className="lgpd-success-tag">
                <i className="fas fa-check"></i> Dados do Encarregado salvos com sucesso! Passo 2 liberado.
              </span>
            )}
            {!passo1Concluido && !salvoFeedback && (
              <small style={{ color: '#b45309', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <i className="fas fa-circle-exclamation"></i> Clique em "Salvar Informações do DPO" para desbloquear o Passo 2.
              </small>
            )}
          </div>
        </form>
      </div>

      {/* ⚖️ SEÇÃO 2: ATENDIMENTO PRÁTICO AOS DIREITOS DO TITULAR (ART. 18) */}
      <div className="lgpd-card-box">
        <div className="lgpd-card-header" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            <div className={`icon-badge ${passo1Concluido ? 'blue' : 'gray'}`} style={!passo1Concluido ? { background: '#e2e8f0', color: '#64748b' } : {}}>
              <i className={passo1Concluido ? "fas fa-fingerprint" : "fas fa-lock"}></i>
            </div>
            <div>
              <h3>2. Ferramentas Práticas de Atendimento aos Titulares</h3>
              <p>
                Quando um cliente (pessoa física) solicitar acesso, exportação ou exclusão de suas informações, 
                utilize as ferramentas seguras abaixo para cumprir a lei sem perder o controle da sua empresa.
              </p>
            </div>
          </div>

          <div>
            {passo1Concluido ? (
              <span className="step-badge-unlocked">
                <i className="fas fa-check-circle"></i> Passo 1 Concluído • Liberado
              </span>
            ) : (
              <span className="step-badge-locked">
                <i className="fas fa-lock"></i> Passo 1 Obrigatório Pendente
              </span>
            )}
          </div>
        </div>

        {/* Banner de Bloqueio se o Passo 1 não estiver preenchido e salvo */}
        {!passo1Concluido && (
          <div className="lgpd-step-lock-banner">
            <i className="fas fa-lock"></i>
            <div>
              <strong>🔒 Etapa Bloqueada: Conclua o Passo 1 Primeiro</strong>
              <p>
                Para emitir Dossiês oficiais ou anonimizar clientes com validade jurídica perante a ANPD, 
                é obrigatório preencher e salvar o <strong>Nome</strong>, <strong>E-mail</strong> e <strong>Telefone</strong> do Encarregado de Proteção de Dados (DPO) no Passo 1 acima.
              </p>
            </div>
          </div>
        )}

        <div className="lgpd-tools-grid">
          
          {/* FERRAMENTA A: DOSSIÊ DO TITULAR */}
          <div className={`lgpd-tool-card ${!passo1Concluido ? 'locked' : ''}`}>
            <div className="tool-icon purple">
              <i className="fas fa-file-invoice"></i>
            </div>
            <h4>Dossiê de Portabilidade do Titular</h4>
            <span className="article-tag">Art. 18, V • Portabilidade</span>
            <p>
              Emita na hora um relatório completo contendo todos os dados cadastrais, contratos 
              e histórico que a sua empresa armazena sobre aquele cliente específico.
            </p>
            <button 
              type="button" 
              className="btn-tool-action purple-btn" 
              onClick={handleAbrirDossie}
              disabled={!passo1Concluido}
            >
              <i className={passo1Concluido ? "fas fa-folder-open" : "fas fa-lock"}></i> 
              {passo1Concluido ? "Gerar Dossiê do Titular" : "Bloqueado (Requer Passo 1)"}
            </button>
          </div>

          {/* FERRAMENTA B: ANONIMIZAÇÃO FISCAL */}
          <div className={`lgpd-tool-card ${!passo1Concluido ? 'locked' : ''}`}>
            <div className="tool-icon red">
              <i className="fas fa-user-slash"></i>
            </div>
            <h4>Anonimização & Direito ao Esquecimento</h4>
            <span className="article-tag">Art. 18, VI c/c Art. 16, I</span>
            <p>
              Exclua permanentemente os dados pessoais de um cliente (CPF, telefone, endereço) 
              mantendo os registros financeiros e datas intactos para cumprir a lei fiscal por 5 anos.
            </p>
            <button 
              type="button" 
              className="btn-tool-action red-btn" 
              onClick={handleAbrirAnonimizacao}
              disabled={!passo1Concluido}
            >
              <i className={passo1Concluido ? "fas fa-shield-virus" : "fas fa-lock"}></i> 
              {passo1Concluido ? "Anonimizar Dados de Cliente" : "Bloqueado (Requer Passo 1)"}
            </button>
          </div>

          {/* FERRAMENTA C: POLÍTICA PERSONALIZADA */}
          <div className={`lgpd-tool-card ${!passo1Concluido ? 'locked' : ''}`}>
            <div className="tool-icon green">
              <i className="fas fa-file-contract"></i>
            </div>
            <h4>Política de Privacidade da Sua Empresa</h4>
            <span className="article-tag">Transparência • Art. 9º</span>
            <p>
              Gere e imprima um documento oficial da sua própria locadora com seus dados, 
              explicando aos clientes finais como a sua empresa protege e cuida das informações deles.
            </p>
            <button 
              type="button" 
              className="btn-tool-action green-btn" 
              onClick={handleAbrirPolitica}
              disabled={!passo1Concluido}
            >
              <i className={passo1Concluido ? "fas fa-eye" : "fas fa-lock"}></i> 
              {passo1Concluido ? "Visualizar Política da Empresa" : "Bloqueado (Requer Passo 1)"}
            </button>
          </div>

        </div>
      </div>

      {/* 📝 SEÇÃO 3: CLÁUSULA PADRÃO DE LGPD PARA CONTRATOS */}
      <div className="lgpd-card-box">
        <div className="lgpd-card-header">
          <div className="icon-badge indigo">
            <i className="fas fa-file-signature"></i>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3>3. Cláusula Jurídica de LGPD para seus Contratos</h3>
                <p>
                  Inclua esta cláusula nos seus contratos de locação. Ela autoriza o uso dos dados para entrega, 
                  faturamento e contato, blindando a sua locadora contra questionamentos jurídicos.
                </p>
              </div>
              <button 
                type="button" 
                className={`btn-copy-clause ${copiadoClausula ? 'copied' : ''}`}
                onClick={copiarClausulaContrato}
              >
                {copiadoClausula ? (
                  <><i className="fas fa-check"></i> Cláusula Copiada!</>
                ) : (
                  <><i className="fas fa-copy"></i> Copiar Cláusula Completa</>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="lgpd-clause-box">
          <p>
            <strong>CLÁUSULA DE PROTEÇÃO DE DADOS (LGPD - LEI Nº 13.709/2018):</strong><br />
            O(A) LOCATÁRIO(A) declara estar ciente e concorda expressamente que a LOCADORA coletará e tratará 
            seus dados pessoais (nome, documento de identificação, endereço, telefone e dados de contato) exclusivamente 
            para as finalidades essenciais de: <strong>(a)</strong> qualificação das partes e formalização deste instrumento contratual; 
            <strong>(b)</strong> execução da logística de entrega, montagem, desmontagem e recolhimento das peças e materiais de acervo locados; 
            <strong>(c)</strong> cumprimento de obrigações legais, fiscais e tributárias decorrentes da operação comercial; e 
            <strong>(d)</strong> comunicações operacionais a respeito do evento contratado. A LOCADORA compromete-se a adotar 
            medidas técnicas e administrativas de segurança aptas a proteger os dados pessoais contra acessos não autorizados, 
            não comercializando nem compartilhando tais informações com terceiros para fins alheios a este contrato.
          </p>
        </div>
      </div>

      {/* 📋 SEÇÃO 4: LIVRO DE PROTOCOLOS AUDITÁVEL (PROVA PERANTE A ANPD) */}
      <div className="lgpd-card-box">
        <div className="lgpd-card-header">
          <div className="icon-badge cyan">
            <i className="fas fa-clipboard-check"></i>
          </div>
          <div>
            <h3>4. Livro de Protocolos & Solicitações de Titulares</h3>
            <p>
              Registro auditável com data, hora e código de protocolo de todos os dossiês emitidos 
              e anonimizações executadas. Esta lista serve de prova documental perante autoridades e auditorias.
            </p>
          </div>
        </div>

        {loadingProtocolos ? (
          <div className="lgpd-loading">
            <i className="fas fa-spinner fa-spin"></i> Carregando registros de conformidade...
          </div>
        ) : protocolos.length === 0 ? (
          <div className="lgpd-empty-box">
            <i className="fas fa-shield-cat"></i>
            <h4>Nenhuma solicitação de titular registrada ainda</h4>
            <p>
              Quando um cliente solicitar a emissão de um Dossiê de Portabilidade ou a anonimização de dados, 
              o sistema gerará automaticamente o registro oficial e o protocolo numerado nesta tabela.
            </p>
          </div>
        ) : (
          <div className="lgpd-table-container">
            <table className="lgpd-table">
              <thead>
                <tr>
                  <th>Protocolo</th>
                  <th>Data / Hora</th>
                  <th>Tipo de Solicitação</th>
                  <th>Titular</th>
                  <th>Documento</th>
                  <th>Status</th>
                  <th>Responsável</th>
                </tr>
              </thead>
              <tbody>
                {protocolos.map(p => (
                  <tr key={p.id}>
                    <td><strong className="protocolo-code">{p.protocolo}</strong></td>
                    <td>{formatarDataExibicao(p.criadoEm)}</td>
                    <td>
                      <span className={`pill-tipo ${p.tipo.includes('Anonim') ? 'red' : 'purple'}`}>
                        {p.tipo}
                      </span>
                    </td>
                    <td>{p.titularNome}</td>
                    <td>{p.titularDocumento}</td>
                    <td>
                      <span className="badge-status-concluido">
                        <i className="fas fa-check"></i> {p.status}
                      </span>
                    </td>
                    <td><small>{p.criadoPor}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 📄 MODAL: EMISSÃO DE DOSSIÊ DO TITULAR (PORTABILIDADE)   */}
      {/* ======================================================== */}
      {modalDossie && (
        <div className="modal-overlay-lgpd fade-in">
          <div className="modal-card-lgpd modal-dossie">
            <div className="modal-header-lgpd">
              <h3>
                <i className="fas fa-file-invoice text-purple"></i> Dossiê de Portabilidade do Titular (Art. 18, V)
              </h3>
              <button className="btn-close-modal" onClick={() => setModalDossie(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="modal-body-lgpd">
              {!dadosDossie ? (
                <div className="dossie-selector-step">
                  <p>
                    Selecione o cliente que requisitou o relatório de seus dados pessoais:
                  </p>

                  {/* 🏢 Filtro por Empresa para Super Admin (Camila / Dona do Celebre) */}
                  {isSuperAdmin && listaEmpresasUnicas.length > 0 && (
                    <div className="form-group-dossie" style={{ marginBottom: '14px', background: '#f1f5f9', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                      <label style={{ color: '#4f46e5', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="fas fa-building"></i> Filtrar por Empresa / Locadora (Visão Super Admin):
                      </label>
                      <select 
                        value={filtroEmpresaDossie} 
                        onChange={e => {
                          setFiltroEmpresaDossie(e.target.value);
                          setClienteSelecionadoDossie('');
                        }}
                        style={{ marginTop: '5px', width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #94a3b8' }}
                      >
                        <option value="todas">-- Todas as Empresas / Locadoras ({clientes.length} clientes totais) --</option>
                        {listaEmpresasUnicas.map(emp => (
                          <option key={emp} value={emp}>
                            🏢 {emp} ({clientes.filter(c => c.nomeEmpresaOrigem === emp).length} clientes)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="form-group-dossie">
                    <label>Cliente Cadastrado:</label>
                    <select 
                      value={clienteSelecionadoDossie} 
                      onChange={e => setClienteSelecionadoDossie(e.target.value)}
                    >
                      <option value="">-- Selecione o cliente na lista ({clientesExibidosDossie.length} disponíveis) --</option>
                      {clientesExibidosDossie.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.nome} {c.cpf ? `(CPF: ${c.cpf})` : ''} {isSuperAdmin && c.nomeEmpresaOrigem ? `— 🏢 [${c.nomeEmpresaOrigem}]` : (c.celular ? `• ${c.celular}` : '')}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="dossie-info-notice">
                    <i className="fas fa-info-circle"></i>
                    <span>
                      O dossiê reúne dados cadastrais, contratos de locação vinculados, finalidade de tratamento 
                      e gera um protocolo oficial numerado para entrega ao cliente.
                    </span>
                  </div>

                  <button 
                    type="button" 
                    className="btn-exec-dossie" 
                    onClick={handleGerarDossie} 
                    disabled={!clienteSelecionadoDossie || carregandoDossie}
                  >
                    {carregandoDossie ? (
                      <><i className="fas fa-spinner fa-spin"></i> Compilando registros...</>
                    ) : (
                      <><i className="fas fa-file-export"></i> Gerar Dossiê Oficial</>
                    )}
                  </button>
                </div>
              ) : (
                <div className="dossie-sheet-view print-area">
                  <div className="dossie-sheet-header">
                    <div>
                      <h2>DOSSIÊ DE DADOS DO TITULAR (LGPD)</h2>
                      <span className="dossie-sub">Em cumprimento ao Art. 18 da Lei Federal nº 13.709/2018</span>
                    </div>
                    <div className="dossie-stamp">
                      <span>PROTOCOLO OFICIAL</span>
                      <strong>{dadosDossie.protocolo}</strong>
                    </div>
                  </div>

                  <div className="dossie-grid-info">
                    <div className="dossie-sec">
                      <h4>1. Identificação do Controlador (Empresa)</h4>
                      <p><strong>Razão Social / Nome:</strong> {dadosDossie.empresaControladora || nomeEmpresaExibida}</p>
                      <p><strong>Documento:</strong> {dadosDossie.empresaDocumento || docEmpresaExibido}</p>
                      <p><strong>Encarregado (DPO):</strong> {dpoNome || 'Diretoria Geral'} ({dpoEmail || configEmpresa.emailContato || 'privacidade'})</p>
                    </div>

                    <div className="dossie-sec">
                      <h4>2. Dados Pessoais Armazenados do Titular</h4>
                      <p><strong>Nome Completo:</strong> {dadosDossie.cliente.nome || '—'}</p>
                      <p><strong>CPF / Documento:</strong> {dadosDossie.cliente.cpf || dadosDossie.cliente.cnpj || '—'}</p>
                      <p><strong>Telefone / WhatsApp:</strong> {dadosDossie.cliente.celular || dadosDossie.cliente.telefone || '—'}</p>
                      <p><strong>E-mail:</strong> {dadosDossie.cliente.email || '—'}</p>
                      <p><strong>Endereço:</strong> {dadosDossie.cliente.endereco || '—'} {dadosDossie.cliente.cidade ? `- ${dadosDossie.cliente.cidade}/${dadosDossie.cliente.uf}` : ''}</p>
                    </div>
                  </div>

                  <div className="dossie-sec" style={{ marginTop: '16px' }}>
                    <h4>3. Bases Legais e Finalidade do Tratamento</h4>
                    <ul style={{ margin: '6px 0', paddingLeft: '20px', fontSize: '13px', color: '#334155' }}>
                      <li><strong>Execução de Contrato (Art. 7º, V):</strong> Necessário para entrega e recolhimento de materiais locados.</li>
                      <li><strong>Cumprimento de Obrigação Legal/Fiscal (Art. 7º, II):</strong> Emissão e guarda de notas/comprovantes fiscais.</li>
                    </ul>
                  </div>

                  <div className="dossie-sec" style={{ marginTop: '16px' }}>
                    <h4>4. Histórico de Locações & Contratos Vinculados ({dadosDossie.totalLocacoes})</h4>
                    {dadosDossie.locacoes.length === 0 ? (
                      <p style={{ fontSize: '13px', color: '#64748b' }}>Nenhum contrato formal registrado para este titular.</p>
                    ) : (
                      <table className="dossie-mini-table">
                        <thead>
                          <tr>
                            <th>Contrato / Pedido</th>
                            <th>Data</th>
                            <th>Status</th>
                            <th>Valor Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dadosDossie.locacoes.map((loc, idx) => (
                            <tr key={idx}>
                              <td>{loc.numeroContrato}</td>
                              <td>{loc.dataEvento}</td>
                              <td>{loc.status}</td>
                              <td>R$ {Number(loc.valorTotal).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="dossie-sheet-footer">
                    <small>Relatório gerado em {new Date(dadosDossie.geradoEm).toLocaleString('pt-BR')} sob protocolo oficial {dadosDossie.protocolo}.</small>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer-lgpd">
              {dadosDossie ? (
                <>
                  <button type="button" className="btn-modal-sec" onClick={() => setDadosDossie(null)}>
                    <i className="fas fa-arrow-left"></i> Voltar à Seleção
                  </button>
                  <button type="button" className="btn-modal-pri" onClick={imprimirDossie}>
                    <i className="fas fa-print"></i> Imprimir / Salvar PDF
                  </button>
                </>
              ) : (
                <button type="button" className="btn-modal-sec" onClick={() => setModalDossie(false)}>
                  Fechar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 🛡️ MODAL: ANONIMIZAÇÃO SEGURA (DIREITO AO ESQUECIMENTO / ART. 18, VI)   */}
      {/* ======================================================================= */}
      {modalAnonimizar && (
        <div className="modal-overlay-lgpd fade-in">
          <div className="modal-card-lgpd modal-danger">
            <div className="modal-header-lgpd danger-header">
              <h3>
                <i className="fas fa-user-shield"></i> Anonimização de Dados do Titular (Art. 18, VI)
              </h3>
              <button className="btn-close-modal" onClick={() => setModalAnonimizar(false)} disabled={anonimizando}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="modal-body-lgpd">
              <div className="lgpd-danger-warning-box">
                <i className="fas fa-triangle-exclamation"></i>
                <div>
                  <strong>Atenção: Ação Definitiva e Irreversível!</strong>
                  <p>
                    A anonimização desassocia permanentemente os dados pessoais do titular. 
                    CPF, nome, e-mail, telefone e endereço residencial serão eliminados do sistema.
                  </p>
                </div>
              </div>

              {/* 🏢 Filtro por Empresa para Super Admin (Anonimização) */}
              {isSuperAdmin && listaEmpresasUnicas.length > 0 && (
                <div className="form-group-dossie" style={{ marginBottom: '14px', background: '#fef2f2', padding: '10px 14px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  <label style={{ color: '#dc2626', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fas fa-building"></i> Filtrar por Empresa / Locadora (Visão Super Admin):
                  </label>
                  <select 
                    value={filtroEmpresaAnon} 
                    onChange={e => {
                      setFiltroEmpresaAnon(e.target.value);
                      setClienteSelecionadoAnon('');
                    }}
                    disabled={anonimizando}
                    style={{ marginTop: '5px', width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #f87171' }}
                  >
                    <option value="todas">-- Todas as Empresas / Locadoras --</option>
                    {listaEmpresasUnicas.map(emp => (
                      <option key={emp} value={emp}>
                        🏢 {emp}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group-dossie" style={{ marginTop: '16px' }}>
                <label>Selecione o Cliente que Requisitou a Exclusão:</label>
                <select 
                  value={clienteSelecionadoAnon} 
                  onChange={e => setClienteSelecionadoAnon(e.target.value)}
                  disabled={anonimizando}
                >
                  <option value="">-- Selecione o cliente para anonimizar ({clientesExibidosAnon.length} disponíveis) --</option>
                  {clientesExibidosAnon.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nome} {c.cpf ? `(CPF: ${c.cpf})` : ''} {isSuperAdmin && c.nomeEmpresaOrigem ? `— 🏢 [${c.nomeEmpresaOrigem}]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group-dossie" style={{ marginTop: '12px' }}>
                <label>Motivo ou Protocolo da Solicitação:</label>
                <input 
                  type="text" 
                  value={motivoAnonimizacao} 
                  onChange={e => setMotivoAnonimizacao(e.target.value)}
                  disabled={anonimizando}
                />
              </div>

              <div className="fiscal-safeguard-notice">
                <i className="fas fa-file-invoice-dollar"></i>
                <div>
                  <strong>Salvaguarda Fiscal Mantida (Art. 16, I da LGPD):</strong>
                  <p>
                    Os registros numéricos de locações e faturamentos fiscais continuarão no sistema 
                    com o rótulo <em>"Titular Anonimizado"</em> para resguardo da sua empresa em caso de fiscalização da Receita Federal.
                  </p>
                </div>
              </div>

              <div className="confirm-type-box" style={{ marginTop: '16px' }}>
                <label>Para confirmar, digite <strong>ANONIMIZAR</strong> no campo abaixo:</label>
                <input 
                  type="text" 
                  placeholder="ANONIMIZAR" 
                  value={confirmacaoTexto} 
                  onChange={e => setConfirmacaoTexto(e.target.value)}
                  disabled={anonimizando}
                />
              </div>
            </div>

            <div className="modal-footer-lgpd">
              <button 
                type="button" 
                className="btn-modal-sec" 
                onClick={() => setModalAnonimizar(false)} 
                disabled={anonimizando}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                className="btn-modal-danger" 
                onClick={handleExecutarAnonimizacao}
                disabled={!clienteSelecionadoAnon || confirmacaoTexto.trim().toUpperCase() !== 'ANONIMIZAR' || anonimizando}
              >
                {anonimizando ? (
                  <><i className="fas fa-spinner fa-spin"></i> Anonimizando...</>
                ) : (
                  <><i className="fas fa-user-slash"></i> Executar Anonimização Definitiva</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 📑 MODAL: POLÍTICA DE PRIVACIDADE DA LOCADORA (PERSONALIZADA)            */}
      {/* ======================================================================= */}
      {modalPoliticaEmpresa && (
        <div className="modal-overlay-lgpd fade-in">
          <div className="modal-card-lgpd modal-policy-view">
            <div className="modal-header-lgpd">
              <h3>
                <i className="fas fa-file-shield text-green"></i> Política de Privacidade de {nomeEmpresaExibida}
              </h3>
              <button className="btn-close-modal" onClick={() => setModalPoliticaEmpresa(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="modal-body-lgpd print-area">
              <div className="policy-sheet-content">
                <h2>POLÍTICA DE PRIVACIDADE E PROTEÇÃO DE DADOS</h2>
                <span className="policy-company-tag">{nomeEmpresaExibida} • {docEmpresaExibido}</span>
                <hr style={{ margin: '14px 0', borderColor: '#e2e8f0' }} />

                <p>
                  A <strong>{nomeEmpresaExibida}</strong> preza pela segurança, privacidade e transparência 
                  no tratamento dos dados pessoais de seus clientes e contratantes, em estrito cumprimento à 
                  Lei Geral de Proteção de Dados Pessoais (Lei Federal nº 13.709/2018).
                </p>

                <h4>1. Dados Coletados</h4>
                <p>
                  Para a realização de orçamentos, emissão de contratos de locação de acervo e entrega de materiais, 
                  coletamos: Nome completo, CPF/CNPJ, telefone/WhatsApp, endereço de entrega e e-mail.
                </p>

                <h4>2. Finalidade e Base Legal</h4>
                <p>
                  Os dados são tratados com base na <strong>Execução de Contrato (Art. 7º, V)</strong> e 
                  <strong>Cumprimento de Obrigação Legal e Fiscal (Art. 7º, II)</strong>, exclusivamente para:
                  formalizar o pedido de locação, agendar transporte e montagem do acervo e emitir comprovantes fiscais.
                </p>

                <h4>3. Não Compartilhamento Comercial</h4>
                <p>
                  Seus dados <strong>nunca serão vendidos, alugados ou cedidos a terceiros</strong> para finalidades publicitárias.
                </p>

                <h4>4. Encarregado pelo Tratamento de Dados (DPO)</h4>
                <p>
                  Para dúvidas, retificações ou solicitações de titulares, entre em contato com nosso Encarregado de Dados:
                  <br />
                  <strong>Responsável:</strong> {dpoNome || 'Diretoria de Atendimento'}
                  <br />
                  <strong>E-mail de Contato:</strong> {dpoEmail || configEmpresa.emailContato || 'contato@locadora.com'}
                  {dpoTelefone && <><br /><strong>Telefone / WhatsApp:</strong> {dpoTelefone}</>}
                </p>
              </div>
            </div>

            <div className="modal-footer-lgpd">
              <button type="button" className="btn-modal-sec" onClick={() => setModalPoliticaEmpresa(false)}>
                Fechar
              </button>
              <button type="button" className="btn-modal-pri" onClick={imprimirDossie}>
                <i className="fas fa-print"></i> Imprimir Política da Empresa
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AbaLGPD;
