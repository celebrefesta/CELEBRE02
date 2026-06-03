import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './GestaoASO.css';
import { db } from '../firebaseConfig'; 
import { collection, getDocs, doc, query, where, updateDoc, serverTimestamp, addDoc, deleteDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const GestaoASO = () => {
  const navigate = useNavigate();
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [loading, setLoading] = useState(true);
  const [equipe, setEquipe] = useState([]);
  const [clinicas, setClinicas] = useState([]); 
  
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [membroEditando, setMembroEditando] = useState(null);
  const [arquivoParaUpload, setArquivoParaUpload] = useState(null);

  const [membroImprimir, setMembroImprimir] = useState(null);
  const [numeroAsoAtual, setNumeroAsoAtual] = useState('');

  const [modalClinicaAberto, setModalClinicaAberto] = useState(false);
  const [clinicaEditandoId, setClinicaEditandoId] = useState(null);
  
  const [novaClinica, setNovaClinica] = useState({
      nome: '', endereco: '', telefone: '', 
      diasFuncionamento: 'Segunda a Sexta', horaAbertura: '08:00', horaFechamento: '18:00', 
      temAlmoco: false, horaAlmocoInicio: '12:00', horaAlmocoFim: '13:00', medicos: [] 
  });

  const [medicoInput, setMedicoInput] = useState({ nome: '', crm: '' });
  
  const listaRiscosDisponiveis = [
      'Ausência de Risco', 'Físico (Ruído, Calor, Frio)', 'Químico (Poeira, Produtos)',
      'Biológico (Vírus, Bactérias)', 'Ergonómico (Postura, Peso)', 'Acidentes (Máquinas, Quedas)'
  ];

  const [asoForm, setAsoForm] = useState({
    asoStatus: 'Pendente', asoTipo: 'Admissional', asoDataExame: '', asoValidade: '', dataAdmissao: '', 
    asoMedico: '', asoCRM: '', asoClinica: '', asoRiscos: [], asoObservacoes: '', asoArquivoNome: '', asoArquivoUrl: '',
    asoHistorico: []
  });

  const medicosSugestoesHist = [...new Set(equipe.map(m => m.asoMedico).filter(Boolean))];

  const registrarLog = async (acao, detalhes) => {
    try {
      const nomeLogado = localStorage.getItem('funcName') || usuarioLogado?.displayName || "Admin";
      await addDoc(collection(db, "logs_atividades"), {
        data: new Date(), criadoEm: serverTimestamp(), funcionario: nomeLogado, usuarioEmail: usuarioLogado?.email || "Desconhecido",
        acao: acao.toUpperCase(), detalhes: detalhes, userId: tenantId, empresaId: tenantId
      });
    } catch (error) { console.error("Erro ao gravar log:", error); }
  };

  useEffect(() => {
    if (!usuarioLogado) { navigate('/login'); return; }
    carregarDados();
  }, [usuarioLogado, navigate, tenantId]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const qEquipe = query(collection(db, "equipe"), where("empresaId", "==", tenantId));
      const snapEquipe = await getDocs(qEquipe);
      setEquipe(snapEquipe.docs.map(d => ({ id: d.id, ...d.data() })));

      const qClinicas = query(collection(db, "clinicas_aso"), where("empresaId", "==", tenantId));
      const snapClinicas = await getDocs(qClinicas);
      const clinicasLidas = snapClinicas.docs.map(d => {
          const data = d.data();
          const medicosNormalizados = Array.isArray(data.medicos) 
              ? data.medicos.map(m => typeof m === 'string' ? { nome: m, crm: '' } : m) : [];
          return { id: d.id, ...data, medicos: medicosNormalizados };
      });
      setClinicas(clinicasLidas);
    } catch (error) {
      console.error("Erro ao carregar Fichas de ASO:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusReal = (membro) => {
      if (!membro.asoValidade) return membro.asoStatus || 'Pendente';
      if (membro.asoTipo === 'Demissional' && membro.asoDataExame) return membro.asoStatus || 'Apto';
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
      const dataValidade = new Date(membro.asoValidade + "T00:00:00");
      if (dataValidade < hoje) return 'Vencido';
      return membro.asoStatus || 'Pendente';
  };

  const calcularTempoServico = (admissao, demissao) => {
      if (!admissao || !demissao) return 'Preencha as duas datas para calcular';
      const d1 = new Date(admissao + "T12:00:00");
      const d2 = new Date(demissao + "T12:00:00");
      if (d2 < d1) return 'Data de demissão é menor que a admissão';
      let anos = d2.getFullYear() - d1.getFullYear();
      let meses = d2.getMonth() - d1.getMonth();
      let dias = d2.getDate() - d1.getDate();
      if (dias < 0) { meses -= 1; const ultimoDiaMesAnterior = new Date(d2.getFullYear(), d2.getMonth(), 0).getDate(); dias += ultimoDiaMesAnterior; }
      if (meses < 0) { anos -= 1; meses += 12; }
      let partes = [];
      if (anos > 0) partes.push(`${anos} ano${anos > 1 ? 's' : ''}`);
      if (meses > 0) partes.push(`${meses} mês${meses > 1 ? 'es' : ''}`);
      if (dias > 0) partes.push(`${dias} dia${dias > 1 ? 's' : ''}`);
      return partes.length > 0 ? partes.join(', ') : 'Menos de 1 dia';
  };

  const totalFuncionarios = equipe.length;
  const totalAptos = equipe.filter(m => getStatusReal(m) === 'Apto').length;
  const totalAlertas = equipe.filter(m => ['Pendente', 'Inapto', 'Vencido'].includes(getStatusReal(m))).length;

  // 🔥 PROTEÇÃO ANTI-FALHAS AO ABRIR EDIÇÃO DO ASO 🔥
  const abrirModalAso = (membro) => {
    setMembroEditando(membro);
    setArquivoParaUpload(null); 
    
    let riscosSeguros = [];
    if (membro.asoRiscos) {
        if (typeof membro.asoRiscos === 'string') {
            riscosSeguros = membro.asoRiscos.split(', ').filter(r => r.trim() !== '');
        } else if (Array.isArray(membro.asoRiscos)) {
            riscosSeguros = membro.asoRiscos;
        }
    }

    setAsoForm({
      asoStatus: membro.asoStatus || 'Pendente',
      asoTipo: membro.asoTipo || 'Admissional',
      asoDataExame: membro.asoDataExame || '',
      asoValidade: membro.asoValidade || '',
      dataAdmissao: membro.dataAdmissao || '',
      asoMedico: membro.asoMedico || '',
      asoCRM: membro.asoCRM || '',
      asoClinica: membro.asoClinica || '',
      asoRiscos: riscosSeguros, 
      asoObservacoes: membro.asoObservacoes || '',
      asoArquivoNome: membro.asoArquivoNome || '',
      asoArquivoUrl: membro.asoArquivoUrl || '',
      asoHistorico: membro.asoHistorico || [] 
    });
    setModalAberto(true);
  };

  const arquivarAsoAtual = () => {
      if (!asoForm.asoArquivoUrl && !asoForm.asoDataExame) {
          alert("Não existem dados ou arquivo suficiente para arquivar."); return;
      }
      if (window.confirm("Deseja arquivar os dados e o PDF atual no histórico e limpar o topo para um novo ASO?")) {
          const itemHistorico = {
              id: Date.now().toString(),
              tipo: asoForm.asoTipo || 'Não informado',
              dataExame: asoForm.asoDataExame || '',
              validade: asoForm.asoValidade || '',
              clinica: asoForm.asoClinica || '',
              medico: asoForm.asoMedico || '',
              url: asoForm.asoArquivoUrl || '',
              nomeArquivo: asoForm.asoArquivoNome || ''
          };
          
          setAsoForm(prev => ({
              ...prev,
              asoHistorico: [itemHistorico, ...(prev.asoHistorico || [])],
              asoTipo: 'Periódico',
              asoDataExame: '',
              asoValidade: '',
              asoArquivoUrl: '',
              asoArquivoNome: '',
              asoStatus: 'Pendente'
          }));
          setArquivoParaUpload(null);
      }
  };

  const removerDoHistorico = (idHistorico) => {
      if (window.confirm("Apagar este ASO do histórico? Esta ação é irreversível.")) {
          setAsoForm(prev => ({
              ...prev,
              asoHistorico: prev.asoHistorico.filter(h => h.id !== idHistorico)
          }));
      }
  };

  const abrirImpressaoASO = (membro) => {
      const dataHoje = new Date();
      const ano = dataHoje.getFullYear();
      const mes = String(dataHoje.getMonth() + 1).padStart(2, '0');
      const dia = String(dataHoje.getDate()).padStart(2, '0');
      const idCurto = membro.id.substring(0, 5).toUpperCase();

      setNumeroAsoAtual(`ASO-${ano}${mes}${dia}-${idCurto}`);
      setMembroImprimir(membro);
  };

  const imprimirFicha = () => window.print();

  const formatarCRM = (valor) => {
      let rawText = valor.toUpperCase().replace(/[^0-9A-Z]/g, '');
      let numeros = rawText.replace(/[A-Z]/g, '').slice(0, 8); 
      let letras = rawText.replace(/[0-9]/g, '').slice(0, 2);  
      let formatoFinal = numeros;
      if (letras.length > 0) formatoFinal += '-' + letras;
      return formatoFinal;
  };

  const handleCRMChangeFicha = (e) => setAsoForm({ ...asoForm, asoCRM: formatarCRM(e.target.value) });
  const handleCRMChangeTag = (e) => setMedicoInput({ ...medicoInput, crm: formatarCRM(e.target.value) });

  const handleTelefoneClinica = (e) => {
      let valor = e.target.value.replace(/\D/g, "");
      if (valor.length <= 10) {
          valor = valor.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
      } else {
          valor = valor.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3");
      }
      setNovaClinica({ ...novaClinica, telefone: valor });
  };

  const toggleRisco = (riscoSelecionado) => {
      setAsoForm(prev => {
          let novosRiscos = [...prev.asoRiscos];
          if (riscoSelecionado === 'Ausência de Risco') {
              novosRiscos = novosRiscos.includes('Ausência de Risco') ? [] : ['Ausência de Risco'];
          } else {
              novosRiscos = novosRiscos.filter(r => r !== 'Ausência de Risco');
              if (novosRiscos.includes(riscoSelecionado)) {
                  novosRiscos = novosRiscos.filter(r => r !== riscoSelecionado);
              } else {
                  novosRiscos.push(riscoSelecionado);
              }
          }
          return { ...prev, asoRiscos: novosRiscos };
      });
  };

  const handleFileUpload = (e) => {
      const file = e.target.files[0];
      if(file) {
          setArquivoParaUpload(file);
          setAsoForm({...asoForm, asoArquivoNome: file.name}); 
      }
  };

  const adicionarMedicoLista = () => {
      const nomeLimpo = medicoInput.nome.trim();
      const crmLimpo = medicoInput.crm.trim();
      if (!nomeLimpo) return;
      if (novaClinica.medicos.some(m => m.nome === nomeLimpo)) { setMedicoInput({ nome: '', crm: '' }); return; }
      setNovaClinica(prev => ({ ...prev, medicos: [...prev.medicos, { nome: nomeLimpo, crm: crmLimpo }] }));
      setMedicoInput({ nome: '', crm: '' }); 
  };

  const removerMedicoLista = (indexParaRemover) => {
      setNovaClinica(prev => ({ ...prev, medicos: prev.medicos.filter((_, index) => index !== indexParaRemover) }));
  };

  const handleKeyDownMedico = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); adicionarMedicoLista(); }
  };

  const abrirModalNovaClinica = () => {
      setClinicaEditandoId(null);
      setNovaClinica({ 
          nome: '', endereco: '', telefone: '', 
          diasFuncionamento: 'Segunda a Sexta', horaAbertura: '08:00', horaFechamento: '18:00', 
          temAlmoco: false, horaAlmocoInicio: '12:00', horaAlmocoFim: '13:00', medicos: [] 
      });
      setMedicoInput({ nome: '', crm: '' });
      setModalClinicaAberto(true);
  };

  // 🔥 PROTEÇÃO ANTI-FALHAS AO ABRIR EDIÇÃO DA CLÍNICA 🔥
  const abrirModalEditarClinica = () => {
      if (!asoForm.asoClinica) {
          alert("Por favor, selecione uma clínica na lista antes de clicar em Editar.");
          return;
      }
      const clinicaData = clinicas.find(c => c.nome === asoForm.asoClinica);
      if (clinicaData) {
          setClinicaEditandoId(clinicaData.id);
          setNovaClinica({
              nome: clinicaData.nome || '', endereco: clinicaData.endereco || '', telefone: clinicaData.telefone || '',
              diasFuncionamento: clinicaData.diasFuncionamento || 'Segunda a Sexta', horaAbertura: clinicaData.horaAbertura || '08:00',
              horaFechamento: clinicaData.horaFechamento || '18:00', temAlmoco: clinicaData.temAlmoco || false,
              horaAlmocoInicio: clinicaData.horaAlmocoInicio || '12:00', horaAlmocoFim: clinicaData.horaAlmocoFim || '13:00',
              medicos: clinicaData.medicos || []
          });
          setMedicoInput({ nome: '', crm: '' });
          setModalClinicaAberto(true);
      }
  };

  const salvarClinica = async () => {
      if (!novaClinica.nome.trim()) { alert("O nome da clínica é obrigatório."); return; }
      try {
          let horarioFormatado = `${novaClinica.diasFuncionamento}, ${novaClinica.horaAbertura} às ${novaClinica.horaFechamento}`;
          if (novaClinica.temAlmoco) {
              horarioFormatado = `${novaClinica.diasFuncionamento}, ${novaClinica.horaAbertura} às ${novaClinica.horaAlmocoInicio} e ${novaClinica.horaAlmocoFim} às ${novaClinica.horaFechamento}`;
          }

          const dadosClinica = {
              nome: novaClinica.nome, endereco: novaClinica.endereco, telefone: novaClinica.telefone, horario: horarioFormatado,
              diasFuncionamento: novaClinica.diasFuncionamento, horaAbertura: novaClinica.horaAbertura, horaFechamento: novaClinica.horaFechamento,
              temAlmoco: novaClinica.temAlmoco, horaAlmocoInicio: novaClinica.horaAlmocoInicio, horaAlmocoFim: novaClinica.horaAlmocoFim,
              medicos: novaClinica.medicos, empresaId: tenantId
          };

          if (clinicaEditandoId) {
              await updateDoc(doc(db, "clinicas_aso", clinicaEditandoId), dadosClinica);
              await registrarLog("EDIÇÃO DE CLÍNICA", `Atualizou os dados da clínica ${novaClinica.nome}.`);
          } else {
              dadosClinica.criadoEm = serverTimestamp();
              await addDoc(collection(db, "clinicas_aso"), dadosClinica);
              await registrarLog("CADASTRO DE CLÍNICA", `Adicionou a clínica ${novaClinica.nome} ao sistema.`);
          }
          
          carregarDados(); 
          setAsoForm({ ...asoForm, asoClinica: novaClinica.nome });
          setModalClinicaAberto(false);
      } catch (error) {
          console.error(error); alert("Erro ao salvar clínica.");
      }
  };

  const excluirClinica = async () => {
      if (window.confirm(`Tem certeza que deseja excluir a clínica "${novaClinica.nome}" permanentemente do seu sistema?`)) {
          try {
              await deleteDoc(doc(db, "clinicas_aso", clinicaEditandoId));
              await registrarLog("EXCLUSÃO DE CLÍNICA", `Removeu a clínica ${novaClinica.nome}.`);
              setAsoForm({ ...asoForm, asoClinica: '' }); 
              carregarDados();
              setModalClinicaAberto(false);
          } catch (error) { console.error(error); alert("Erro ao excluir clínica."); }
      }
  };

  const clinicaSelecionadaData = clinicas.find(c => c.nome === asoForm.asoClinica);
  
  const handleMedicoSelectFicha = (e) => {
      const nomeSelecionado = e.target.value;
      let crmEncontrado = asoForm.asoCRM; 
      if (clinicaSelecionadaData && clinicaSelecionadaData.medicos) {
          const medicoObj = clinicaSelecionadaData.medicos.find(m => m.nome === nomeSelecionado);
          if (medicoObj && medicoObj.crm) { crmEncontrado = medicoObj.crm; }
      }
      setAsoForm({ ...asoForm, asoMedico: nomeSelecionado, asoCRM: crmEncontrado });
  };

  const salvarAso = async (e) => {
    e.preventDefault();
    setSalvando(true);
    try {
        let urlArquivo = asoForm.asoArquivoUrl || '';
        let nomeArquivo = asoForm.asoArquivoNome || '';

        if (arquivoParaUpload) {
            const storage = getStorage();
            const nomeSeguro = arquivoParaUpload.name.replace(/[^a-zA-Z0-9.]/g, '_');
            const arquivoPath = `aso_pdfs/${tenantId}/${membroEditando.id}_${Date.now()}_${nomeSeguro}`;
            const storageRef = ref(storage, arquivoPath);

            const uploadPromise = uploadBytes(storageRef, arquivoParaUpload);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error("TIMEOUT_STORAGE")), 15000);
            });

            await Promise.race([uploadPromise, timeoutPromise]);

            urlArquivo = await getDownloadURL(storageRef); 
            nomeArquivo = arquivoParaUpload.name;
        }

        const dadosSalvar = {
            asoStatus: asoForm.asoStatus || 'Pendente',
            asoTipo: asoForm.asoTipo || 'Admissional',
            asoDataExame: asoForm.asoDataExame || '',
            asoValidade: asoForm.asoTipo === 'Demissional' ? '' : (asoForm.asoValidade || ''), 
            dataAdmissao: asoForm.dataAdmissao || '',
            asoMedico: asoForm.asoMedico || '',
            asoCRM: asoForm.asoCRM || '',
            asoClinica: asoForm.asoClinica || '',
            asoRiscos: asoForm.asoRiscos ? (Array.isArray(asoForm.asoRiscos) ? asoForm.asoRiscos.join(', ') : asoForm.asoRiscos) : '', 
            asoObservacoes: asoForm.asoObservacoes || '',
            asoArquivoNome: nomeArquivo || '',
            asoArquivoUrl: urlArquivo || '',
            asoHistorico: asoForm.asoHistorico || [] 
        };

        await updateDoc(doc(db, "equipe", membroEditando.id), dadosSalvar);

        await registrarLog("ATUALIZAÇÃO DE ASO", `Atualizou a ficha médica completa de ${membroEditando.nome}.`);
        setModalAberto(false);
        carregarDados(); 
    } catch (error) {
        console.error("Erro fatal ao salvar ASO na Nuvem:", error);
        if (error.message === "TIMEOUT_STORAGE") {
            alert("O envio do PDF demorou muito e o sistema travou.\n\nVERIFIQUE:\n1. Se o serviço 'Storage' está ativado no seu Firebase Console.\n2. Se o 'storageBucket' está correto no seu firebaseConfig.js.");
        } else {
            alert(`Erro de conexão com o banco de dados. \nDetalhe: ${error.message}`);
        }
    } finally {
        setSalvando(false);
    }
  };

  if (loading) return <div style={{ padding: '50px', textAlign: 'center', color: '#64748b' }}>Buscando dados de Saúde Ocupacional...</div>;

  return (
    <div className="aso-page-wrapper">
      
      <div className="header-top">
        <div className="titulo-bloco">
          <h1>Gestão de ASOs</h1>
          <p>Acompanhe a Saúde Ocupacional e o vencimento dos atestados médicos da sua equipe.</p>
        </div>
        <div className="header-botoes">
            <button onClick={() => navigate('/usuarios')} className="btn-voltar">
                <i className="fas fa-arrow-left"></i> Voltar para Equipe
            </button>
        </div>
      </div>

      <div className="dashboard-asos">
          <div className="dash-card total">
              <div className="dash-icon"><i className="fas fa-users"></i></div>
              <div className="dash-info">
                  <h3>Total da Equipe</h3>
                  <h2>{totalFuncionarios}</h2>
              </div>
          </div>
          <div className="dash-card aptos">
              <div className="dash-icon"><i className="fas fa-heartbeat"></i></div>
              <div className="dash-info">
                  <h3>Exames em Dia (Aptos)</h3>
                  <h2>{totalAptos}</h2>
              </div>
          </div>
          <div className="dash-card alertas">
              <div className="dash-icon"><i className="fas fa-exclamation-triangle"></i></div>
              <div className="dash-info">
                  <h3>Pendências / Vencidos</h3>
                  <h2>{totalAlertas}</h2>
              </div>
          </div>
      </div>

      <div className="table-container">
        <table className="table-pro">
          <thead>
            <tr>
              <th>COLABORADOR E CLÍNICA</th>
              <th>STATUS DA SAÚDE</th>
              <th>TIPO E DATAS</th>
              <th style={{ textAlign: 'right' }}>AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {equipe.map(membro => {
              const statusReal = getStatusReal(membro);
              let badgeClass = 'pendente'; let icone = 'fa-clock';
              if (statusReal === 'Apto') { badgeClass = 'apto'; icone = 'fa-check-circle'; }
              else if (statusReal === 'Inapto') { badgeClass = 'inapto'; icone = 'fa-times-circle'; }
              else if (statusReal === 'Vencido') { badgeClass = 'vencido'; icone = 'fa-exclamation-circle'; }

              return (
              <tr key={membro.id} className="table-row-hover">
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ width: '42px', height: '42px', backgroundColor: '#f8fafc', color: '#0f172a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '16px', border: '1px solid #e2e8f0' }}>
                      {membro.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <strong style={{ color: '#0f172a', display: 'block', fontSize: '15px' }}>{membro.nome}</strong>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{membro.cargo || 'Cargo não definido'}</span>
                      {membro.asoClinica && (
                         <span style={{ fontSize: '11px', color: '#3b82f6', display: 'block', marginTop: '2px' }}><i className="fas fa-hospital-alt"></i> {membro.asoClinica}</span>
                      )}
                    </div>
                  </div>
                </td>
                
                <td>
                    <span className={`badge-aso ${badgeClass}`}><i className={`fas ${icone}`}></i> {statusReal}</span>
                    {membro.asoRiscos && (
                        <span className="info-sub" style={{ color: '#b91c1c' }}><i className="fas fa-biohazard"></i> Riscos: {membro.asoRiscos}</span>
                    )}
                </td>
                
                <td>
                    <strong style={{ color: '#334155', fontSize: '13px', display: 'block' }}>{membro.asoTipo || 'Não informado'}</strong>
                    {membro.asoTipo === 'Demissional' && membro.dataAdmissao && membro.asoDataExame ? (
                        <>
                            <span className="info-sub"><i className="far fa-calendar-check"></i> Admissão: <strong>{membro.dataAdmissao.split('-').reverse().join('/')}</strong></span>
                            <span className="info-sub"><i className="far fa-calendar-times"></i> Demissão: <strong style={{ color: '#ef4444' }}>{membro.asoDataExame.split('-').reverse().join('/')}</strong></span>
                            <span className="info-sub" style={{ color: '#3b82f6', background: '#eff6ff', padding: '4px 8px', borderRadius: '4px', marginTop: '6px', display: 'inline-flex' }}>
                                <i className="fas fa-history"></i> Tempo: <strong>{calcularTempoServico(membro.dataAdmissao, membro.asoDataExame)}</strong>
                            </span>
                        </>
                    ) : (
                        <>
                            <span className="info-sub"><i className="far fa-calendar-check"></i> Realizado: <strong>{membro.asoDataExame ? membro.asoDataExame.split('-').reverse().join('/') : '--'}</strong></span>
                            <span className="info-sub"><i className="far fa-calendar-times"></i> Validade: <strong style={{ color: statusReal === 'Vencido' ? '#ef4444' : '#0f172a' }}>{membro.asoValidade ? membro.asoValidade.split('-').reverse().join('/') : '--'}</strong></span>
                        </>
                    )}
                </td>
                
                <td>
                  <div className="acoes-tabela">
                    <button onClick={() => abrirImpressaoASO(membro)} className="btn-action" style={{ background: '#fefce8', color: '#a16207', borderColor: '#fde047' }}>
                        <i className="fas fa-print"></i> Gerar Ficha
                    </button>
                    {membro.asoArquivoUrl && (
                        <button onClick={() => window.open(membro.asoArquivoUrl, '_blank')} className="btn-anexo-min" title="Baixar ou Visualizar Atestado (PDF)">
                            <i className="fas fa-file-pdf" style={{ color: '#ef4444' }}></i>
                        </button>
                    )}
                    <button onClick={() => abrirModalAso(membro)} className="btn-action"><i className="fas fa-edit"></i> Editar Ficha</button>
                  </div>
                </td>
              </tr>
            )})}
            {equipe.length === 0 && (
                <tr><td colSpan="4" style={{ textAlign: 'center', color: '#64748b', padding: '40px' }}>Nenhum funcionário cadastrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL DE FICHA MÉDICA COMPLETA */}
      {modalAberto && (
          <div className="modal-overlay-blur">
              <div className="modal-card-aso">
                  <div className="modal-header">
                      <div>
                          <h3 style={{ margin: 0, color: '#0f172a', fontSize: '20px', fontWeight: '900', letterSpacing: '-0.5px' }}>Ficha Médica Ocupacional</h3>
                          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>Atualizando prontuário de: <strong>{membroEditando?.nome}</strong></p>
                      </div>
                      <button onClick={() => setModalAberto(false)} style={{ background: 'none', border: 'none', fontSize: '28px', cursor: 'pointer', color: '#94a3b8' }}>×</button>
                  </div>

                  <form onSubmit={salvarAso} className="modal-body">
                      
                      <div className="modal-section-box">
                          <h4 className="section-title-aso"><i className="fas fa-stethoscope" style={{ color: '#3b82f6' }}></i> Diagnóstico e Datas</h4>
                          <div className="flex-row-responsivo">
                              <div style={{ flex: 1 }}>
                                  <label className="input-label">STATUS DO EXAME MÉDICO</label>
                                  <select value={asoForm.asoStatus} onChange={e => setAsoForm({...asoForm, asoStatus: e.target.value})} className="input-field" style={{ background: asoForm.asoStatus === 'Apto' ? '#f0fdf4' : asoForm.asoStatus === 'Inapto' ? '#fef2f2' : '#fff' }}>
                                      <option value="Pendente">Pendente</option>
                                      <option value="Apto">Apto</option>
                                      <option value="Inapto">Inapto</option>
                                  </select>
                              </div>
                              <div style={{ flex: 1 }}>
                                  <label className="input-label">TIPO DE EXAME</label>
                                  <select value={asoForm.asoTipo} onChange={e => setAsoForm({...asoForm, asoTipo: e.target.value})} className="input-field">
                                      <option value="Admissional">Admissional</option>
                                      <option value="Periódico">Periódico</option>
                                      <option value="Mudança de Função">Mudança de Função</option>
                                      <option value="Retorno ao Trabalho">Retorno ao Trabalho</option>
                                      <option value="Demissional">Demissional</option>
                                  </select>
                              </div>
                          </div>

                          {asoForm.asoTipo === 'Demissional' ? (
                              <>
                                  <div className="flex-row-responsivo" style={{ marginBottom: 0 }}>
                                      <div style={{ flex: 1 }}><label className="input-label">DATA DE ADMISSÃO</label><input type="date" value={asoForm.dataAdmissao} onChange={e => setAsoForm({...asoForm, dataAdmissao: e.target.value})} className="input-field" /></div>
                                      <div style={{ flex: 1 }}><label className="input-label">DATA DA DEMISSÃO (EXAME)</label><input type="date" value={asoForm.asoDataExame} onChange={e => setAsoForm({...asoForm, asoDataExame: e.target.value})} className="input-field" /></div>
                                  </div>
                                  <div style={{ marginTop: '15px', padding: '12px', background: '#eff6ff', border: '1px dashed #93c5fd', borderRadius: '8px', color: '#1e3a8a', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <i className="fas fa-history"></i><strong>Tempo de Serviço:</strong> {calcularTempoServico(asoForm.dataAdmissao, asoForm.asoDataExame)}
                                  </div>
                              </>
                          ) : (
                              <div className="flex-row-responsivo" style={{ marginBottom: 0 }}>
                                  <div style={{ flex: 1 }}><label className="input-label">DATA DO EXAME REALIZADO</label><input type="date" value={asoForm.asoDataExame} onChange={e => setAsoForm({...asoForm, asoDataExame: e.target.value})} className="input-field" /></div>
                                  <div style={{ flex: 1 }}><label className="input-label">DATA DE VALIDADE DO EXAME</label><input type="date" value={asoForm.asoValidade} onChange={e => setAsoForm({...asoForm, asoValidade: e.target.value})} className="input-field" /></div>
                              </div>
                          )}
                      </div>

                      <div className="modal-section-box">
                          <h4 className="section-title-aso"><i className="fas fa-hospital-user" style={{ color: '#10b981' }}></i> Profissional e Clínica</h4>
                          <div style={{ marginBottom: '15px' }}>
                              <label className="input-label">CLÍNICA VINCULADA (LOCAL DO EXAME)</label>
                              <div style={{ display: 'flex', gap: '10px' }}>
                                  <select value={asoForm.asoClinica} onChange={e => setAsoForm({...asoForm, asoClinica: e.target.value, asoMedico: '', asoCRM: ''})} className="input-field">
                                      <option value="">Selecione uma clínica cadastrada...</option>
                                      {clinicas.map(c => (
                                          <option key={c.id} value={c.nome}>{c.nome}</option>
                                      ))}
                                  </select>
                                  <button type="button" onClick={abrirModalNovaClinica} className="btn-add-mini" title="Cadastrar Nova Clínica"><i className="fas fa-plus"></i> Nova</button>
                                  {asoForm.asoClinica && (
                                      <button type="button" onClick={abrirModalEditarClinica} className="btn-edit-mini" title="Editar dados desta Clínica"><i className="fas fa-pen"></i> Editar</button>
                                  )}
                              </div>
                          </div>

                          <div className="flex-row-responsivo" style={{ marginBottom: 0 }}>
                              <div style={{ flex: 1.5 }}>
                                  <label className="input-label">MÉDICO EXAMINADOR / COORDENADOR</label>
                                  {clinicaSelecionadaData && clinicaSelecionadaData.medicos && clinicaSelecionadaData.medicos.length > 0 ? (
                                      <select value={asoForm.asoMedico} onChange={handleMedicoSelectFicha} className="input-field">
                                          <option value="">Selecione um médico da clínica...</option>
                                          {clinicaSelecionadaData.medicos.map((m, i) => (
                                              <option key={i} value={m.nome}>{m.nome}</option>
                                          ))}
                                      </select>
                                  ) : (
                                      <>
                                          <input list="lista-medicos-hist" type="text" placeholder="Ex: Dr. Carlos Silva" value={asoForm.asoMedico} onChange={e => setAsoForm({...asoForm, asoMedico: e.target.value})} className="input-field" />
                                          <datalist id="lista-medicos-hist">
                                              {medicosSugestoesHist.map((m, i) => <option key={i} value={m}>{m}</option>)}
                                          </datalist>
                                      </>
                                  )}
                              </div>
                              <div style={{ flex: 1 }}>
                                  <label className="input-label">CRM</label>
                                  <input type="text" placeholder="Ex: 123456-SP" value={asoForm.asoCRM} onChange={handleCRMChangeFicha} maxLength="11" className="input-field" />
                              </div>
                          </div>
                      </div>

                      <div className="modal-section-box">
                          <h4 className="section-title-aso"><i className="fas fa-exclamation-triangle" style={{ color: '#f59e0b' }}></i> Riscos e Condições</h4>
                          <label className="input-label">RISCOS OCUPACIONAIS IDENTIFICADOS</label>
                          <div className="riscos-grid">
                              {listaRiscosDisponiveis.map(risco => {
                                  const estaAtivo = Array.isArray(asoForm.asoRiscos) ? asoForm.asoRiscos.includes(risco) : false;
                                  const classeAtivo = estaAtivo ? (risco === 'Ausência de Risco' ? 'ativo-ausente' : 'ativo') : '';
                                  return (
                                      <label key={risco} className={`risco-label ${classeAtivo}`}>
                                          <input type="checkbox" checked={estaAtivo} onChange={() => toggleRisco(risco)} />
                                          {risco}
                                      </label>
                                  );
                              })}
                          </div>
                          <div>
                              <label className="input-label">OBSERVAÇÕES MÉDICAS (RESTRIÇÕES)</label>
                              <textarea value={asoForm.asoObservacoes} onChange={e => setAsoForm({...asoForm, asoObservacoes: e.target.value})} placeholder="Restrições de peso, alergias informadas, uso de EPI obrigatório..." rows="2" className="input-field" style={{ resize: 'none' }}></textarea>
                          </div>
                      </div>

                      {/* UPLOAD ATUAL */}
                      <div className="modal-section-box">
                          <h4 className="section-title-aso"><i className="fas fa-paperclip" style={{ color: '#64748b' }}></i> Documento Anexo (Prontuário Preenchido)</h4>
                          <div className="upload-box">
                              <input type="file" className="upload-input-hidden" accept=".pdf, .jpg, .jpeg, .png" onChange={handleFileUpload} />
                              <i className="fas fa-cloud-upload-alt"></i>
                              {asoForm.asoArquivoNome ? (
                                  <><p style={{ color: '#10b981' }}>{asoForm.asoArquivoNome}</p><span>Clique para substituir o arquivo preenchido</span></>
                              ) : (
                                  <><p>Clique ou arraste o ASO digitalizado após assinado</p><span>Tamanho máximo: 5MB</span></>
                              )}
                          </div>

                          {/* 🔥 BOTÃO DE RENOVAÇÃO / ARQUIVAMENTO 🔥 */}
                          {(asoForm.asoArquivoUrl || asoForm.asoDataExame) && (
                              <button type="button" onClick={arquivarAsoAtual} className="btn-arquivar">
                                  <i className="fas fa-history"></i> Renovar ASO (Arquivar documento atual e iniciar novo)
                              </button>
                          )}
                      </div>

                      {/* 🔥 LISTA DO HISTÓRICO 🔥 */}
                      {asoForm.asoHistorico && asoForm.asoHistorico.length > 0 && (
                          <div className="historico-section">
                              <h4 className="section-title-aso" style={{ fontSize: '12px', color: '#64748b', borderBottom: 'none', marginBottom: '10px' }}>
                                  <i className="fas fa-archive"></i> Histórico de Arquivos Anteriores
                              </h4>
                              <div className="historico-lista">
                                  {asoForm.asoHistorico.map(hist => (
                                      <div key={hist.id} className="historico-item">
                                          <div className="historico-info">
                                              <strong>{hist.tipo} - {hist.dataExame ? hist.dataExame.split('-').reverse().join('/') : 'Sem data'}</strong>
                                              <span>{hist.clinica || 'Clínica não informada'} | Validade: {hist.validade ? hist.validade.split('-').reverse().join('/') : 'N/A'}</span>
                                          </div>
                                          <div style={{ display: 'flex', gap: '8px' }}>
                                              {hist.url && (
                                                  <button type="button" onClick={() => window.open(hist.url, '_blank')} className="btn-anexo-min" title="Baixar ASO Arquivado">
                                                      <i className="fas fa-download" style={{ color: '#3b82f6' }}></i>
                                                  </button>
                                              )}
                                              <button type="button" onClick={() => removerDoHistorico(hist.id)} className="btn-anexo-min" title="Excluir do Histórico">
                                                  <i className="fas fa-trash-alt" style={{ color: '#ef4444' }}></i>
                                              </button>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}

                      <div className="modal-acoes-footer">
                          <button type="button" onClick={() => setModalAberto(false)} className="btn-cancel">Cancelar</button>
                          <button type="submit" disabled={salvando} className="btn-submit">{salvando ? 'Salvando na Nuvem...' : 'Gravar Ficha Médica'}</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* MODAL ROBUSTO DE EDIÇÃO / NOVA CLÍNICA */}
      {modalClinicaAberto && (
          <div className="modal-overlay-blur" style={{ zIndex: 10000 }}>
              <div className="modal-card-aso modal-mini">
                  <div className="modal-header">
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#0f172a' }}>
                          {clinicaEditandoId ? 'Editar Clínica' : 'Vincular Nova Clínica'}
                      </h3>
                      <button onClick={() => setModalClinicaAberto(false)} style={{ background: 'none', border: 'none', fontSize: '28px', cursor: 'pointer', color: '#94a3b8' }}>×</button>
                  </div>
                  
                  <div className="modal-body">
                      <div>
                          <label className="input-label">NOME DA CLÍNICA OU LABORATÓRIO *</label>
                          <input type="text" placeholder="Ex: Medicina do Trabalho XYZ" value={novaClinica.nome} onChange={e => setNovaClinica({...novaClinica, nome: e.target.value})} className="input-field" autoFocus />
                      </div>
                      
                      <div>
                          <label className="input-label">ENDEREÇO COMPLETO</label>
                          <input type="text" placeholder="Rua, Número, Bairro, Cidade" value={novaClinica.endereco} onChange={e => setNovaClinica({...novaClinica, endereco: e.target.value})} className="input-field" />
                      </div>

                      <div className="flex-row-responsivo" style={{ marginBottom: 0 }}>
                          <div style={{ flex: 1 }}>
                              <label className="input-label">TELEFONE DE CONTACTO</label>
                              <input type="text" placeholder="(00) 00000-0000" value={novaClinica.telefone} onChange={handleTelefoneClinica} maxLength="15" className="input-field" />
                          </div>
                          <div style={{ flex: 1 }}>
                              <label className="input-label">DIAS DE FUNCIONAMENTO</label>
                              <select value={novaClinica.diasFuncionamento} onChange={e => setNovaClinica({...novaClinica, diasFuncionamento: e.target.value})} className="input-field">
                                  <option value="Segunda a Sexta">Segunda a Sexta</option>
                                  <option value="Segunda a Sábado">Segunda a Sábado</option>
                                  <option value="Todos os dias">Todos os dias</option>
                              </select>
                          </div>
                      </div>

                      <div className="flex-row-responsivo" style={{ marginBottom: 0 }}>
                          <div style={{ flex: 1 }}>
                              <label className="input-label">HORÁRIO DE ABERTURA</label>
                              <input type="time" value={novaClinica.horaAbertura} onChange={e => setNovaClinica({...novaClinica, horaAbertura: e.target.value})} className="input-field" />
                          </div>
                          <div style={{ flex: 1 }}>
                              <label className="input-label">HORÁRIO DE FECHO</label>
                              <input type="time" value={novaClinica.horaFechamento} onChange={e => setNovaClinica({...novaClinica, horaFechamento: e.target.value})} className="input-field" />
                          </div>
                      </div>

                      <div style={{ marginTop: '10px', marginBottom: '15px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '10px', background: novaClinica.temAlmoco ? '#f0fdf4' : '#f8fafc', border: '1px solid', borderColor: novaClinica.temAlmoco ? '#bbf7d0' : '#e2e8f0', borderRadius: '8px', marginBottom: novaClinica.temAlmoco ? '15px' : '0', transition: '0.2s' }}>
                              <input type="checkbox" checked={novaClinica.temAlmoco} onChange={e => setNovaClinica({...novaClinica, temAlmoco: e.target.checked})} style={{ width: '16px', height: '16px', accentColor: '#10b981', cursor: 'pointer' }} />
                              <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: '700' }}>Possui intervalo de almoço</span>
                          </label>

                          {novaClinica.temAlmoco && (
                              <div className="flex-row-responsivo" style={{ marginBottom: 0 }}>
                                  <div style={{ flex: 1 }}>
                                      <label className="input-label">INÍCIO DO ALMOÇO</label>
                                      <input type="time" value={novaClinica.horaAlmocoInicio} onChange={e => setNovaClinica({...novaClinica, horaAlmocoInicio: e.target.value})} className="input-field" />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                      <label className="input-label">FIM DO ALMOÇO</label>
                                      <input type="time" value={novaClinica.horaAlmocoFim} onChange={e => setNovaClinica({...novaClinica, horaAlmocoFim: e.target.value})} className="input-field" />
                                  </div>
                              </div>
                          )}
                      </div>

                      <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '5px' }}>
                          <label className="input-label" style={{ color: '#3b82f6' }}><i className="fas fa-user-md"></i> MÉDICOS DISPONÍVEIS NA CLÍNICA</label>
                          
                          <div className="medicos-input-group">
                              <input type="text" placeholder="Nome do Médico" value={medicoInput.nome} onChange={(e) => setMedicoInput({ ...medicoInput, nome: e.target.value })} onKeyDown={handleKeyDownMedico} className="input-field" />
                              <input type="text" placeholder="CRM (Opcional)" value={medicoInput.crm} onChange={handleCRMChangeTag} maxLength="11" className="input-field" style={{ maxWidth: '180px' }} />
                              <button type="button" onClick={adicionarMedicoLista} className="btn-add-medico">Adicionar</button>
                          </div>

                          <div className="medicos-tags-container">
                              {novaClinica.medicos.length === 0 && ( <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '4px' }}>Nenhum médico associado ainda.</span> )}
                              {novaClinica.medicos.map((medicoObj, index) => (
                                  <div key={index} className="medico-tag">
                                      {medicoObj.nome} {medicoObj.crm ? `(${medicoObj.crm})` : ''}
                                      <button type="button" onClick={() => removerMedicoLista(index)} title="Remover médico">&times;</button>
                                  </div>
                              ))}
                          </div>
                      </div>

                      <div className="modal-acoes-footer" style={{ border: 'none', paddingTop: '10px', marginTop: '0', flexDirection: 'column' }}>
                          <button type="button" onClick={salvarClinica} className="btn-submit" style={{ width: '100%', maxWidth: 'none', padding: '14px' }}>
                              {clinicaEditandoId ? 'Atualizar Clínica' : 'Salvar Clínica no Banco'}
                          </button>
                          {clinicaEditandoId && (
                              <button type="button" onClick={excluirClinica} className="btn-delete-clinica">
                                  <i className="fas fa-trash-alt"></i> Excluir Clínica Definitivamente
                              </button>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* MÓDULO DE IMPRESSÃO A4 AUTOMÁTICO */}
      {membroImprimir && (
          <div className="print-overlay">
              <div className="print-toolbar">
                  <div>
                      <h3>Pré-visualização do Documento</h3>
                      <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Imprima em formato A4, retrato.</p>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => setMembroImprimir(null)} className="btn-cancel" style={{ padding: '10px 20px', height: '42px' }}>Fechar</button>
                      <button onClick={imprimirFicha} className="btn-imprimir-real"><i className="fas fa-print"></i> Imprimir ASO</button>
                  </div>
              </div>

              <div className="a4-page">
                  <div className="a4-header">
                      <h1>Atestado de Saúde Ocupacional - ASO</h1>
                      <p>Em conformidade com a Norma Regulamentadora Nº 07 (NR-7)</p>
                  </div>

                  <div className="a4-row-dupla">
                      <span><strong>Nº de Controle:</strong> {numeroAsoAtual}</span>
                      <span><strong>Data de Emissão:</strong> {new Date().toLocaleDateString('pt-BR')}</span>
                  </div>

                  <div className="a4-section">
                      <h2>1. Identificação do Colaborador</h2>
                      <div className="a4-linha"><strong>Nome Completo:</strong> <div className="a4-tracejado" style={{ borderBottomStyle: 'solid' }}>{membroImprimir.nome}</div></div>
                      <div className="a4-linha"><strong>Função / Cargo:</strong> <div className="a4-tracejado" style={{ borderBottomStyle: 'solid' }}>{membroImprimir.cargo || 'Não informado'}</div></div>
                      <div className="a4-linha">
                          <strong>Tipo de Exame:</strong>
                          <div className="a4-checkboxes" style={{ display: 'flex', gap: '15px', marginLeft: '10px', alignItems: 'center' }}>
                              <span><div className="a4-quadradinho"></div> Admissional</span>
                              <span><div className="a4-quadradinho"></div> Periódico</span>
                              <span><div className="a4-quadradinho"></div> Demissional</span>
                              <span><div className="a4-quadradinho"></div> Retorno</span>
                          </div>
                      </div>
                  </div>

                  <div className="a4-section">
                      <h2>2. Triagem e Sinais Vitais (Uso Médico)</h2>
                      <div className="a4-grid-sinais">
                          <div className="a4-box"><span>Pressão Arterial (PA)</span><div className="a4-box-linha"></div></div>
                          <div className="a4-box"><span>Peso (Kg)</span><div className="a4-box-linha"></div></div>
                          <div className="a4-box"><span>Altura (m)</span><div className="a4-box-linha"></div></div>
                          <div className="a4-box"><span>Frequência Cardíaca (BPM)</span><div className="a4-box-linha"></div></div>
                          <div className="a4-box"><span>Temperatura (°C)</span><div className="a4-box-linha"></div></div>
                          <div className="a4-box"><span>Saturação O2 (%)</span><div className="a4-box-linha"></div></div>
                      </div>
                  </div>

                  <div className="a4-section">
                      <h2>3. Comorbidades e Anamnese</h2>
                      <div className="a4-checkbox-grid">
                          <div className="a4-check-item"><div className="a4-quadradinho"></div> Diabetes</div>
                          <div className="a4-check-item"><div className="a4-quadradinho"></div> Hipertensão</div>
                          <div className="a4-check-item"><div className="a4-quadradinho"></div> Cardiopatia</div>
                          <div className="a4-check-item"><div className="a4-quadradinho"></div> Asma/Bronquite</div>
                          <div className="a4-check-item"><div className="a4-quadradinho"></div> Doença Ocular</div>
                          <div className="a4-check-item"><div className="a4-quadradinho"></div> Lesão Ortopédica</div>
                      </div>
                      <div className="a4-linha" style={{ marginTop: '15px' }}><strong>Outras observações / Alergias:</strong> <div className="a4-tracejado"></div></div>
                      <div className="a4-linha"><div className="a4-tracejado"></div></div>
                  </div>

                  <div className="a4-section">
                      <h2>4. Conclusão e Parecer Médico</h2>
                      <p style={{ fontSize: '12px', marginBottom: '15px' }}>Após avaliação clínica, declaro que o colaborador acima identificado encontra-se:</p>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', fontSize: '14px', fontWeight: 'bold' }}>
                          <div className="a4-check-item"><div className="a4-quadradinho" style={{ width: '18px', height: '18px' }}></div> APTO PARA A FUNÇÃO</div>
                          <div className="a4-check-item"><div className="a4-quadradinho" style={{ width: '18px', height: '18px' }}></div> APTO COM RESTRIÇÕES</div>
                          <div className="a4-check-item"><div className="a4-quadradinho" style={{ width: '18px', height: '18px' }}></div> INAPTO PARA A FUNÇÃO</div>
                      </div>
                  </div>

                  <div className="a4-assinaturas">
                      <div className="a4-ass-bloco">
                          <strong>Assinatura do Colaborador</strong>
                          <br /><br />Data: ____/____/20___
                      </div>
                      <div className="a4-ass-bloco">
                          <strong>Carimbo e Assinatura do Médico</strong>
                          <br /><br />CRM: 
                      </div>
                  </div>

              </div>
          </div>
      )}

    </div>
  );
};

export default GestaoASO;