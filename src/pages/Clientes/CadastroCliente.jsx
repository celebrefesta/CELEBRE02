import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './CadastroCliente.css';
import { db } from '../../firebaseConfig';
import { collection, addDoc, updateDoc, doc, query, getDocs, getDoc, where, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const formatarNomeCapitalizado = (nomeBruto) => {
  if (!nomeBruto) return '';
  const partes = nomeBruto.toLowerCase().split(' ');
  const conectores = ['da', 'de', 'di', 'do', 'du', 'das', 'dos', 'e'];
  return partes.map((palavra, index) => {
      if (palavra === '') return ''; 
      if (index > 0 && conectores.includes(palavra)) return palavra;
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
  }).join(' ');
};

const getTagIcon = (tag) => {
  if (!tag) return '🏷️';
  const t = tag.toUpperCase().trim();
  if (t === 'VIP') return '👑';
  if (t === 'RECORRENTE') return '🔄';
  if (t === 'NOVO') return '✨';
  if (t === 'ECONÔMICO' || t === 'ECONOMICO') return '💡';
  if (t === 'PECHINCHA') return '🏷️';
  if (t === 'INDECISO') return '🤔';
  if (t === 'EXIGENTE') return '💎';
  if (t === 'ORGANIZADO') return '📋';
  if (t.includes('HORA')) return '⚡';
  if (t === 'BÁSICO' || t === 'BASICO') return '🔹';
  if (t === 'PROBLEMÁTICO' || t === 'PROBLEMATICO') return '⚠️';
  return '🏷️';
};

const getTagStyle = (tag) => {
  if (!tag) return { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
  const normalizedTag = tag.toUpperCase().trim();
  const styles = {
    'NOVO': { bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' }, 
    'VIP': { bg: '#fef08a', color: '#854d0e', border: '#fde047' }, 
    'PROBLEMÁTICO': { bg: '#fecaca', color: '#991b1b', border: '#fca5a5' }, 
    'RECORRENTE': { bg: '#bbf7d0', color: '#166534', border: '#86efac' }, 
    'PECHINCHA': { bg: '#fed7aa', color: '#9a3412', border: '#fdba74' }, 
    'ECONÔMICO': { bg: '#e9d5ff', color: '#6b21a8', border: '#d8b4fe' }, 
    'INDECISO': { bg: '#fbcfe8', color: '#9d174d', border: '#f9a8d4' }, 
    'EXIGENTE': { bg: '#bfdbfe', color: '#1e40af', border: '#93c5fd' }, 
    'ORGANIZADO': { bg: '#a7f3d0', color: '#065f46', border: '#6ee7b7' }, 
    'ÚLTIMA HORA': { bg: '#fecdd3', color: '#be123c', border: '#fda4af' }, 
    'ULTIMA HORA': { bg: '#fecdd3', color: '#be123c', border: '#fda4af' }, 
    'BÁSICO': { bg: '#e5e7eb', color: '#374151', border: '#d1d5db' }, 
    'FAMÍLIA': { bg: '#c7d2fe', color: '#3730a3', border: '#a5b4fc' }, 
    'FAMILIA': { bg: '#c7d2fe', color: '#3730a3', border: '#a5b4fc' }, 
  };
  return styles[normalizedTag] || { bg: '#f3e8ff', color: '#7e22ce', border: '#e9d5ff' }; 
};

const TAGS_PERFIL = [
  'NOVO', 'RECORRENTE', 'VIP', 'ECONÔMICO', 'PECHINCHA',
  'INDECISO', 'EXIGENTE', 'ORGANIZADO', 'ÚLTIMA HORA',
  'BÁSICO', 'PROBLEMÁTICO'
];

const calcularTagAutomaticaPorHistorico = (qtdLocacoes, somaGastoTotal) => {
  if (somaGastoTotal >= 5000 || qtdLocacoes >= 5) {
    return 'VIP';
  }
  if (qtdLocacoes >= 2) {
    return 'RECORRENTE';
  }
  return 'NOVO';
};

const calcularDiasAteAniversario = (dataNascStr) => {
  if (!dataNascStr) return null;
  const hoje = new Date();
  hoje.setHours(0,0,0,0);
  
  const partes = dataNascStr.split('-'); // YYYY-MM-DD
  if (partes.length !== 3) return null;

  const mesNasc = parseInt(partes[1]) - 1;
  const diaNasc = parseInt(partes[2]);

  let proxAniversario = new Date(hoje.getFullYear(), mesNasc, diaNasc);
  if (proxAniversario < hoje) {
    proxAniversario.setFullYear(hoje.getFullYear() + 1);
  }

  const diffTime = proxAniversario.getTime() - hoje.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return { dias: diffDays, dataFmt: `${String(diaNasc).padStart(2,'0')}/${String(mesNasc+1).padStart(2,'0')}` };
};

const gerarMensagemDatasFamilia = (nomeCli, nomeLoja) => {
  const nomeFormatado = (nomeCli || 'Cliente').trim().split(' ')[0];
  const loja = (nomeLoja || 'Nossa Empresa').trim();

  return (
    `Ol\u00e1, *${nomeFormatado}*! Tudo bem? \u2728\u{1F388}\n\n` +
    `Aqui \u00e9 da equipe *${loja}*! Passando com muito carinho para atualizar as datas especiais da sua fam\u00edlia! \u{1F381}\n\n` +
    `Para prepararmos *mimos exclusivos, descontos de anivers\u00e1rio* e prioridade nas suas festas, conta aqui pra gente:\n\n` +
    `\u{1F382} *Anivers\u00e1rio dos filhos / crian\u00e7as:*\n` +
    `\u{1F48D} *Casamento / Bodas:*\n` +
    `\u{1F389} *Outras datas importantes:*\n\n` +
    `Assim garantimos vantagens especiais e preparamos tudo com muito amor para os seus eventos! \u{1F970}\u2728`
  );
};

const gerarMensagemBoasVindasNovoCliente = (nomeCli, nomeLoja) => {
  const nomeFormatado = (nomeCli || 'Cliente').trim().split(' ')[0];
  const loja = (nomeLoja || 'Nossa Empresa').trim();

  return (
    `Ol\u00e1, *${nomeFormatado}*! Tudo bem? \u2728\u{1F388}\n\n` +
    `Que alegria ter voc\u00ea com a gente na *${loja}*! \u{1F389}\n\n` +
    `Para que possamos preparar *mimos especiais, descontos de anivers\u00e1rio* e te avisar com anteced\u00eancia para voc\u00ea nunca ser pego(a) de surpresa nas datas importantes, conta aqui pra gente:\n\n` +
    `\u{1F382} *Anivers\u00e1rio dos filhos / crian\u00e7as:*\n` +
    `\u{1F48D} *Casamento / Bodas:*\n` +
    `\u{1F381} *Outras comemora\u00e7\u00f5es importantes:*\n\n` +
    `Assim garantimos vantagens exclusivas e prioridade na sua reserva em todas as suas festas! \u{1F970}\u2728`
  );
};

const obterNomeEmpresaTenant = (config) => {
  return config?.nomeEmpresa || config?.nomeFantasia || config?.razaoSocial || localStorage.getItem('nomeEmpresa') || 'Nossa Empresa';
};

const CadastroCliente = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const clienteEditando = location.state?.clienteEditando || null;

  // Autenticação e Chave Mestra
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [tipoPessoa, setTipoPessoa] = useState('fisica');
  const [salvando, setSalvando] = useState(false);
  const [podeSerPendente, setPodeSerPendente] = useState(false);
  const [calculandoFinancas, setCalculandoFinancas] = useState(!!clienteEditando);
  const [historicoLocacoes, setHistoricoLocacoes] = useState([]);
  const [totalGasto, setTotalGasto] = useState(0);
  const [tagSugeridaAuto, setTagSugeridaAuto] = useState('NOVO');
  const [buscandoCnpj, setBuscandoCnpj] = useState(false);
  const [fotoBase64, setFotoBase64] = useState('');
  const [posicaoFoto, setPosicaoFoto] = useState({ x: 50, y: 50 });
  const [dragging, setDragging] = useState(false);
  const [startMouse, setStartMouse] = useState({ x: 0, y: 0 });

  const [configEmpresa, setConfigEmpresa] = useState(() => {
    const salvo = localStorage.getItem('nomeEmpresa');
    return salvo ? { nomeEmpresa: salvo, nomeFantasia: salvo } : null;
  });
  const [modalBoasVindasZap, setModalBoasVindasZap] = useState(null);

  useEffect(() => {
    const carregarConfigEmpresa = async () => {
      if (!tenantId) return;
      try {
        const snapConf = await getDoc(doc(db, "configuracoes_empresa", tenantId));
        if (snapConf.exists()) {
          const dados = snapConf.data();
          setConfigEmpresa(dados);
          const nomeReal = dados.nomeEmpresa || dados.nomeFantasia || dados.razaoSocial;
          if (nomeReal) localStorage.setItem('nomeEmpresa', nomeReal);
        }
      } catch (e) {
        console.error("Erro ao carregar dados da empresa:", e);
      }
    };
    carregarConfigEmpresa();
  }, [tenantId]);

  const [formData, setFormData] = useState({
    nome: '', cpf: '', rg: '', nascimento: '', sexo: '', datasComemorativas: '',
    razaoSocial: '', nomeFantasia: '', cnpj: '', inscricaoEstadual: '',
    nomeContato: '', cargo: '',
    celular: '', telefoneFixo: '', email: '', origem: '',
    cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
    tags: 'NOVO', 
    observacoes: '',
    situacaoFinanceira: 'adimplente', 
    statusCadastro: 'aprovado' 
  });

  useEffect(() => {
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }

    if (clienteEditando) {
      setTipoPessoa(clienteEditando.tipoPessoa || 'fisica');
      setFotoBase64(clienteEditando.foto || '');
      setPosicaoFoto(clienteEditando.posicaoFoto || { x: 50, y: 50 });

      const eraPendenteAntigo = clienteEditando.situacaoFinanceira === 'pendente';
      const statusReal = clienteEditando.statusCadastro ? clienteEditando.statusCadastro : (eraPendenteAntigo ? 'pendente' : 'aprovado');
   
      setFormData({
        nome: formatarNomeCapitalizado(clienteEditando.nome || ''), 
        cpf: clienteEditando.cpf || '', rg: clienteEditando.rg || '', nascimento: clienteEditando.nascimento || '', sexo: clienteEditando.sexo || '',
        datasComemorativas: clienteEditando.datasComemorativas || '',
        razaoSocial: formatarNomeCapitalizado(clienteEditando.razaoSocial || ''), 
        nomeFantasia: formatarNomeCapitalizado(clienteEditando.nomeFantasia || ''), 
        cnpj: clienteEditando.cnpj || '', inscricaoEstadual: clienteEditando.inscricaoEstadual || '',
        nomeContato: formatarNomeCapitalizado(clienteEditando.nomeContato || ''), 
        cargo: formatarNomeCapitalizado(clienteEditando.cargo || ''),
        celular: clienteEditando.celular || '', telefoneFixo: clienteEditando.telefoneFixo || '', 
        email: (clienteEditando.email || '').toLowerCase(), 
        origem: clienteEditando.origem || '',
        cep: clienteEditando.cep || '', 
        logradouro: formatarNomeCapitalizado(clienteEditando.logradouro || ''), 
        numero: clienteEditando.numero || '', complemento: formatarNomeCapitalizado(clienteEditando.complemento || ''), 
        bairro: formatarNomeCapitalizado(clienteEditando.bairro || ''), 
        cidade: formatarNomeCapitalizado(clienteEditando.cidade || ''), 
        uf: (clienteEditando.uf || '').toUpperCase(),
        tags: clienteEditando.tags || 'NOVO', 
        observacoes: clienteEditando.observacoes || '',
        situacaoFinanceira: clienteEditando.situacaoFinanceira || 'adimplente',
        statusCadastro: statusReal
      });

      if (statusReal === 'pendente') {
          setPodeSerPendente(true);
      } else {
          setPodeSerPendente(false);
      }

    } else {
      setFormData(prev => ({...prev, statusCadastro: 'aprovado', situacaoFinanceira: 'adimplente', tags: 'NOVO'}));
      setPodeSerPendente(false); 
      setCalculandoFinancas(false);
    }
  }, [clienteEditando, usuarioLogado, navigate]);

  useEffect(() => {
    const verificarInadimplenciaEHistorico = async () => {
      if (!clienteEditando?.id || !usuarioLogado) return; 
      
      try {
        const qLocacoes = query(collection(db, "locacoes"), where("userId", "==", tenantId));
        const snap = await getDocs(qLocacoes);
        
        let temDividaVencida = false;
        let locsDoCliente = [];
        let somaGasto = 0;

        const hoje = new Date();
        hoje.setHours(0,0,0,0); 

        snap.docs.forEach(docSnap => {
          const loc = docSnap.data();
          
          if (loc.clienteId === clienteEditando.id || loc.cliente?.id === clienteEditando.id) {
            locsDoCliente.push({ id: docSnap.id, ...loc });

            const statusLoc = String(loc.status || '').toLowerCase();
            const valorTotalLoc = Number(loc.valorTotal || loc.total || 0);

            if (!statusLoc.includes('cancelado') && !statusLoc.includes('orcam')) {
                somaGasto += valorTotalLoc;
            }

            if (!statusLoc.includes('cancelado') && !statusLoc.includes('orcam')) {
              const dataStr = loc.dataRetirada || loc.dataEvento || loc.dataDevolucao;
              if (dataStr) {
                const dataEvento = new Date(dataStr + 'T00:00:00');
                const pagStatus = (loc.statusPagamento || '').toLowerCase();
                const vPago = Number(loc.valorPago || 0);
                const saldoDevedor = valorTotalLoc - vPago;

                if (dataEvento < hoje && saldoDevedor > 0.01 && !pagStatus.includes('pago') && !pagStatus.includes('quitado')) {
                  temDividaVencida = true;
                }
              }
            }
          }
        });

        locsDoCliente.sort((a, b) => {
            const dataA = a.dataRetirada ? new Date(a.dataRetirada).getTime() : 0;
            const dataB = b.dataRetirada ? new Date(b.dataRetirada).getTime() : 0;
            return dataB - dataA;
        });

        setHistoricoLocacoes(locsDoCliente);
        setTotalGasto(somaGasto);

        const autoTag = calcularTagAutomaticaPorHistorico(locsDoCliente.length, somaGasto);
        setTagSugeridaAuto(autoTag);

        if (!clienteEditando.tags || clienteEditando.tags === 'NOVO') {
          if (autoTag !== 'NOVO') {
            setFormData(prev => ({ ...prev, tags: autoTag }));
          }
        }

        setFormData(prev => ({
          ...prev,
          situacaoFinanceira: temDividaVencida ? 'inadimplente' : 'adimplente'
        }));

      } catch(e) {
        console.error("Erro ao montar histórico:", e);
      } finally {
        setCalculandoFinancas(false);
      }
    };

    verificarInadimplenciaEHistorico();
  }, [clienteEditando, usuarioLogado, tenantId]);

  const maskCPF = (v) => { v = v.replace(/\D/g, ""); v = v.replace(/(\d{3})(\d)/, "$1.$2"); v = v.replace(/(\d{3})(\d)/, "$1.$2"); v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2"); return v.substring(0, 14); };
  const maskCNPJ = (v) => { v = v.replace(/\D/g, ""); v = v.replace(/^(\d{2})(\d)/, "$1.$2"); v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3"); v = v.replace(/\.(\d{3})(\d)/, ".$1/$2"); v = v.replace(/(\d{4})(\d)/, "$1-$2"); return v.substring(0, 18); };
  const maskPhone = (v) => { v = v.replace(/\D/g, ""); v = v.replace(/^(\d{2})(\d)/g, "($1) $2"); v = v.replace(/(\d)(\d{4})$/, "$1-$2"); return v.substring(0, 15); };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let newValue = value;

    if (name === 'cpf') newValue = maskCPF(value);
    else if (name === 'cnpj') newValue = maskCNPJ(value);
    else if (name === 'celular' || name === 'telefoneFixo') newValue = maskPhone(value);
    else if (name === 'email') newValue = value.toLowerCase();
    else if (name === 'uf') newValue = value.toUpperCase().substring(0, 2);
    else {
      if (['nome', 'razaoSocial', 'nomeFantasia', 'nomeContato', 'cargo', 'logradouro', 'complemento', 'bairro', 'cidade'].includes(name)) {
        newValue = formatarNomeCapitalizado(value);
      }
    }
    setFormData({ ...formData, [name]: newValue });
  };

  const consultarCnpjNaReceita = async (cnpjEntrada) => {
    const cnpjLimpo = String(cnpjEntrada || '').replace(/\D/g, '');
    if (cnpjLimpo.length !== 14) return;

    setBuscandoCnpj(true);
    let dados = null;

    try {
      try {
        const resp1 = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
        if (resp1.ok) {
          dados = await resp1.json();
        }
      } catch (err1) {}

      if (!dados) {
        try {
          const resp2 = await fetch(`https://minhareceita.org/${cnpjLimpo}`);
          if (resp2.ok) {
            dados = await resp2.json();
          }
        } catch (err2) {}
      }

      if (!dados) {
        try {
          const resp3 = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjLimpo}`);
          if (resp3.ok) {
            const res3 = await resp3.json();
            dados = {
              razao_social: res3.razao_social,
              nome_fantasia: res3.estabelecimento?.nome_fantasia || res3.razao_social,
              logradouro: res3.estabelecimento?.logradouro,
              numero: res3.estabelecimento?.numero,
              bairro: res3.estabelecimento?.bairro,
              municipio: res3.estabelecimento?.cidade?.nome,
              uf: res3.estabelecimento?.estado?.sigla,
              cep: res3.estabelecimento?.cep,
              ddd_telefone_1: (res3.estabelecimento?.ddd1 || '') + (res3.estabelecimento?.telefone1 || ''),
              email: res3.estabelecimento?.email
            };
          }
        } catch (err3) {}
      }

      if (dados) {
        const rawRSocial = dados.razao_social || dados.nome_razao_social || '';
        const rawNFantasia = dados.nome_fantasia || rawRSocial;

        const rSocial = formatarNomeCapitalizado(rawRSocial);
        let nFantasiaLimpo = rawNFantasia.replace(/^[\d\.\/-]+\s*/, '').trim();
        const nFantasia = formatarNomeCapitalizado(nFantasiaLimpo || rawRSocial);

        const logr = formatarNomeCapitalizado(dados.logradouro || '');
        const num = dados.numero || '';
        const brm = formatarNomeCapitalizado(dados.bairro || '');
        const cid = formatarNomeCapitalizado(dados.municipio || dados.localidade || '');
        const ufSigla = (dados.uf || '').toUpperCase();
        const cepFmt = dados.cep ? dados.cep.replace(/\D/g, '').replace(/^(\d{5})(\d)/, "$1-$2").substring(0, 9) : '';
        const telFmt = dados.ddd_telefone_1 ? maskPhone(dados.ddd_telefone_1) : (dados.telefone ? maskPhone(dados.telefone) : '');
        const emailFmt = (dados.email || '').toLowerCase();
        
        const nomeProprietarioContato = formatarNomeCapitalizado(rawRSocial.replace(/^[\d\.\/-]+\s*/, '').trim());

        setFormData(prev => ({
          ...prev,
          cnpj: maskCNPJ(cnpjLimpo),
          razaoSocial: rSocial || prev.razaoSocial,
          nomeFantasia: nFantasia || prev.nomeFantasia,
          nomeContato: prev.nomeContato || nomeProprietarioContato,
          logradouro: logr || prev.logradouro,
          numero: num || prev.numero,
          bairro: brm || prev.bairro,
          cidade: cid || prev.cidade,
          uf: ufSigla || prev.uf,
          cep: cepFmt || prev.cep,
          celular: prev.celular || telFmt,
          email: prev.email || emailFmt
        }));
      } else {
        alert("⚠️ CNPJ não localizado nas consultas públicas da Receita Federal. Verifique se os números foram digitados corretamente.");
      }
    } catch (err) {
      console.error("Erro na busca de CNPJ:", err);
      alert("⚠️ Falha de conexão ao consultar a Receita Federal.");
    } finally {
      setBuscandoCnpj(false);
    }
  };

  const buscarCnpjAuto = (e) => {
    const rawVal = e.target.value;
    const cnpjMascarado = maskCNPJ(rawVal);
    const cnpjLimpo = rawVal.replace(/\D/g, '');

    setFormData(prev => ({ ...prev, cnpj: cnpjMascarado }));

    if (cnpjLimpo.length === 14) {
      consultarCnpjNaReceita(cnpjLimpo);
    }
  };

  const selecionarTag = (tagEscolhida) => {
    setFormData({ ...formData, tags: tagEscolhida });
  };

  const aplicarTagAutomatica = () => {
    setFormData({ ...formData, tags: tagSugeridaAuto });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 600; 
          const MAX_HEIGHT = 600;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          } else {
            if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          setFotoBase64(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStart = (clientX, clientY) => { setDragging(true); setStartMouse({ x: clientX, y: clientY }); };
  const handleMove = (clientX, clientY) => {
    if (!dragging) return;
    const deltaX = clientX - startMouse.x;
    const deltaY = clientY - startMouse.y;
    setStartMouse({ x: clientX, y: clientY });
    setPosicaoFoto(prev => ({ x: Math.max(0, Math.min(100, prev.x - (deltaX * 0.4))), y: Math.max(0, Math.min(100, prev.y - (deltaY * 0.4))) }));
  };
  const handleEnd = () => setDragging(false);
  const removerFoto = () => { setFotoBase64(''); setPosicaoFoto({x: 50, y: 50}); };

  const buscarCep = async (e) => {
    let cepDigitado = e.target.value.replace(/\D/g, '');
    let cepMascarado = cepDigitado.replace(/^(\d{5})(\d)/, "$1-$2").substring(0, 9);
    setFormData(prev => ({ ...prev, cep: cepMascarado }));
    if (cepDigitado.length === 8) {
      try {
        const resposta = await fetch(`https://viacep.com.br/ws/${cepDigitado}/json/`);
        const dados = await resposta.json();
        if (!dados.erro) {
          setFormData(prev => ({ 
            ...prev, cep: cepMascarado, logradouro: formatarNomeCapitalizado(dados.logradouro), 
            bairro: formatarNomeCapitalizado(dados.bairro), cidade: formatarNomeCapitalizado(dados.localidade), uf: dados.uf.toUpperCase() 
          }));
          document.getElementById('numeroInput').focus();
        }
      } catch (error) {}
    }
  };

  const verificarDuplicidade = async () => {
      if (!usuarioLogado) return false;
      const qClientes = query(collection(db, "clientes"), where("userId", "==", tenantId));
      const snap = await getDocs(qClientes);
      const todosClientes = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const meuCelular = formData.celular ? formData.celular.replace(/\D/g, '') : '';
      const meuCpf = formData.cpf ? formData.cpf.replace(/\D/g, '') : '';
      const meuCnpj = formData.cnpj ? formData.cnpj.replace(/\D/g, '') : '';
      const meuNome = (formData.nome || formData.nomeFantasia || '').trim().toLowerCase();

      for (let c of todosClientes) {
          if (clienteEditando && c.id === clienteEditando.id) continue;
          
          const bancoCelular = c.celular ? c.celular.replace(/\D/g, '') : '';
          const bancoCpf = c.cpf ? c.cpf.replace(/\D/g, '') : '';
          const bancoCnpj = c.cnpj ? c.cnpj.replace(/\D/g, '') : '';
          const bancoNome = (c.nome || c.nomeFantasia || '').trim().toLowerCase();

          if (tipoPessoa === 'fisica' && meuCpf.length === 11 && meuCpf === bancoCpf) {
              alert(`⚠️ AÇÃO BLOQUEADA: Já existe um cliente com este mesmo CPF!\n\nNome: ${c.nome || c.nomeFantasia}`);
              return true; 
          }
          if (tipoPessoa === 'juridica' && meuCnpj.length === 14 && meuCnpj === bancoCnpj) {
              alert(`⚠️ AÇÃO BLOQUEADA: Já existe uma empresa com este mesmo CNPJ!\n\nNome: ${c.nomeFantasia || c.razaoSocial}`);
              return true; 
          }
          if (meuNome && meuNome === bancoNome && meuCelular.length > 8 && meuCelular === bancoCelular) {
              alert(`⚠️ AÇÃO BLOQUEADA: Já existe um cliente com o exato mesmo NOME e CELULAR!`);
              return true; 
          }
      }
      return false; 
  };

  const salvarCliente = async (e) => {
    e.preventDefault();
    if (!usuarioLogado) return alert("Sessão expirada. Faça login novamente.");
    if (tipoPessoa === 'fisica' && !formData.nome) return alert("O Nome é obrigatório!");
    if (tipoPessoa === 'juridica' && !formData.nomeFantasia) return alert("O Nome Fantasia é obrigatório!");
    
    setSalvando(true);
    try {
      if (await verificarDuplicidade()) { setSalvando(false); return; }

      const dadosLimpos = {
        ...formData,
        nome: formData.nome.trim(),
        razaoSocial: formData.razaoSocial.trim(),
        nomeFantasia: formData.nomeFantasia.trim()
      };

      const dadosParaSalvar = { 
          ...dadosLimpos, 
          dataNascimento: formData.nascimento,
          dataNasc: formData.nascimento,
          tipoPessoa, 
          foto: fotoBase64, 
          posicaoFoto, 
          atualizadoEm: new Date().toISOString(),
          userId: tenantId 
      };

      if (clienteEditando) {
        await updateDoc(doc(db, "clientes", clienteEditando.id), dadosParaSalvar);
        alert("✅ Cliente atualizado com sucesso!");
      } else {
        const docRef = await addDoc(collection(db, "clientes"), { ...dadosParaSalvar, criadoEm: new Date().toISOString() });
        
        const nomePrimeiro = tipoPessoa === 'fisica' ? dadosParaSalvar.nome.split(' ')[0] : dadosParaSalvar.nomeFantasia.split(' ')[0];
        const nomeEmpresa = obterNomeEmpresaTenant(configEmpresa);

        if (dadosParaSalvar.email) {
          await addDoc(collection(db, 'mail'), {
            to: dadosParaSalvar.email,
            message: {
              subject: `Sua ficha foi criada com sucesso! 🎉`,
              html: `
                <div style="font-family: sans-serif; color: #333; max-width: 600px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin: 0 auto;">
                  <div style="background-color: #0f172a; padding: 25px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">Ficha de Cliente</h1>
                  </div>
                  <div style="padding: 30px;">
                    <h2 style="color: #0f172a; font-size: 20px;">Olá, ${nomePrimeiro}!</h2>
                    <p style="font-size: 16px; line-height: 1.5;">Seu cadastro foi criado e atualizado em nosso sistema com sucesso.</p>
                    <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 15px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                      <p style="margin: 0; font-weight: bold; color: #1e40af;">📝 O que acontece agora?</p>
                      <p style="margin: 8px 0 0 0; font-size: 15px; color: #1e3a8a;">Seu perfil já está seguro com a nossa equipe. Em breve entraremos em contato para enviar seu orçamento ou alinhar os próximos detalhes do seu evento!</p>
                    </div>
                    <p style="font-size: 16px; line-height: 1.5;">Se tiver qualquer dúvida, basta nos chamar no WhatsApp.</p>
                    <p style="margin-top: 30px; font-size: 16px;">Com carinho,<br><strong>${nomeEmpresa}</strong></p>
                  </div>
                </div>
              `
            }
          });
        }

        const celLimpo = (dadosParaSalvar.celular || dadosParaSalvar.telefoneFixo || '').replace(/\D/g, '');
        if (celLimpo) {
          const msgWhatsApp = gerarMensagemBoasVindasNovoCliente(nomePrimeiro, nomeEmpresa);
          
          setModalBoasVindasZap({
            clienteId: docRef.id,
            clienteObj: { ...dadosParaSalvar, id: docRef.id },
            nomeCliente: nomePrimeiro,
            celular: celLimpo,
            mensagem: msgWhatsApp,
            nomeEmpresa
          });
        } else {
          alert("✅ Novo cliente cadastrado com sucesso!");
          navigate('/clientes');
        }
      }

      try {
        let detalhesAcao = "";

        if (clienteEditando) {
          const mudancas = [];
          
          const camposVigiados = [
            { id: 'nome', nomeAmigavel: 'Nome' }, 
            { id: 'nomeFantasia', nomeAmigavel: 'Nome Fantasia' },
            { id: 'celular', nomeAmigavel: 'Celular' }, 
            { id: 'email', nomeAmigavel: 'E-mail' },
            { id: 'statusCadastro', nomeAmigavel: 'Status do Cadastro' }, 
            { id: 'tags', nomeAmigavel: 'Tag/Perfil' },
            { id: 'observacoes', nomeAmigavel: 'Observações' }
          ];

          camposVigiados.forEach(campo => {
            const valorAntigo = String(clienteEditando[campo.id] || '').trim();
            const valorNovo = String(dadosLimpos[campo.id] || '').trim();
            
            if (valorAntigo !== valorNovo) {
              mudancas.push(`${campo.nomeAmigavel} (de '${valorAntigo || 'Vazio'}' para '${valorNovo || 'Vazio'}')`);
            }
          });

          const nomeExibicao = dadosLimpos.nome || dadosLimpos.nomeFantasia || 'Cliente';
          
          if (mudancas.length > 0) {
            detalhesAcao = `Editou o cliente ${nomeExibicao}. Alterações: ${mudancas.join(' | ')}`;
          } else {
            detalhesAcao = `Acessou e salvou o cliente ${nomeExibicao} sem fazer alterações nos dados principais.`;
          }
        } else {
          detalhesAcao = `Cadastrou o novo cliente: ${dadosLimpos.nome || dadosLimpos.nomeFantasia}`;
        }

        await addDoc(collection(db, "logs_atividades"), {
          empresaId: tenantId, 
          userId: tenantId,
          funcionarioId: usuarioLogado.uid,
          nomeFuncionario: usuarioLogado.displayName || usuarioLogado.email || "Equipe",
          acao: clienteEditando ? "EDIÇÃO DE CLIENTE" : "NOVO CLIENTE",
          tipo: clienteEditando ? "EDICAO" : "CRIACAO",
          detalhes: detalhesAcao,
          dataHora: new Date().toISOString(),
          criadoEm: serverTimestamp()
        });
      } catch (errorEspiao) {
        console.error("Falha ao registrar auditoria:", errorEspiao);
      }

      navigate('/clientes');
    } catch (error) { 
      console.error(error);
      alert("Erro ao salvar cliente.");
    } finally { 
      setSalvando(false); 
    }
  };

  const tagsParaExibir = [...new Set([...TAGS_PERFIL, formData.tags])].filter(Boolean);
  const ehTagAntiga = formData.tags && !TAGS_PERFIL.includes(formData.tags);
  const tagColorida = formData.tags ? getTagStyle(formData.tags) : null;
  const tagIcon = formData.tags ? getTagIcon(formData.tags) : '🏷️';
  const infoAniversario = calcularDiasAteAniversario(formData.nascimento);

  return (
    <div className="form-page-container fade-in">
      
      {/* HERO ENTERPRISE REPAGINADO */}
      <header className="cadastro-hero-header">
        <div className="cadastro-hero-left">
          <div className="breadcrumb-nav">
            <Link to="/clientes"><i className="fas fa-users"></i> Clientes</Link>
            <span className="separator">/</span>
            <span className="current-page">{clienteEditando ? 'Perfil do Cliente' : 'Novo Cadastro'}</span>
          </div>

          <div className="hero-title-group">
            <span className="header-icon-badge">
              <i className={clienteEditando ? "fas fa-user-edit" : "fas fa-user-plus"}></i>
            </span>
            <div className="header-text">
              <h1 className="form-page-title">{clienteEditando ? 'PERFIL DO CLIENTE' : 'NOVO CLIENTE'}</h1>
              <p className="form-page-subtitle">
                {clienteEditando ? 'Edite as informações cadastrais, acompanhe a saúde financeira e o histórico de locações.' : 'Preencha os dados abaixo para cadastrar um novo cliente na carteira.'}
              </p>
            </div>
          </div>
        </div>

        <div className="cadastro-hero-right-actions">
          <button type="button" onClick={() => navigate('/clientes')} className="btn-secondary-celebre">
            <i className="fas fa-arrow-left"></i> Voltar à Lista
          </button>
          
          {clienteEditando && formData.celular && (
            <a 
              href={`https://wa.me/55${formData.celular.replace(/\D/g, '')}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn-secondary-celebre btn-hero-zap"
              title="Abrir conversa no WhatsApp"
            >
              <i className="fab fa-whatsapp"></i> WhatsApp
            </a>
          )}

          {clienteEditando && (
            <button 
              type="button" 
              onClick={() => navigate('/locacoes/nova', { state: { clienteSelecionado: clienteEditando } })}
              className="btn-secondary-celebre"
              title="Criar nova locação para este cliente"
            >
              <i className="fas fa-shopping-cart"></i> Nova Locação
            </button>
          )}
        </div>
      </header>

      <div className="form-widescreen">
        <form id="cliente-form-main" onSubmit={salvarCliente} className="estoque-form-layout" autoComplete="on">
          
          {/* COLUNA ESQUERDA: CARD EXECUTIVE PROFILE */}
          <div className={`left-photo-col ${!clienteEditando ? 'is-novo-cadastro' : 'is-edicao'}`}>
            <div className="profile-card-banner"></div>
            
            {/* AVATAR COM ANEL DE DEGRADÊ DOURADO */}
            <div className="avatar-circle-wrapper">
              {fotoBase64 ? (
                <div className="avatar-photo-box">
                  <img 
                    src={fotoBase64} 
                    className="avatar-photo-img" 
                    alt="Foto do cliente"
                    style={{ objectPosition: `${posicaoFoto.x}% ${posicaoFoto.y}%`, cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }}
                    onMouseDown={(e) => { e.preventDefault(); handleStart(e.clientX, e.clientY); }}
                    onMouseMove={(e) => handleMove(e.clientX, e.clientY)} 
                    onMouseUp={handleEnd} 
                    onMouseLeave={handleEnd}
                    onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)} 
                    onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY)} 
                    onTouchEnd={handleEnd}
                  />
                  <div className="drag-hint-overlay"><span><i className="fas fa-arrows-alt"></i> Arraste</span></div>
                </div>
              ) : (
                <label htmlFor="foto-upload" className="avatar-empty-label" title="Clique para adicionar foto">
                  <i className="fas fa-camera avatar-camera-icon"></i>
                  <span>+ Adicionar Foto</span>
                  <input id="foto-upload" type="file" accept="image/*" onChange={handleFileChange} style={{display:'none'}} />
                </label>
              )}
            </div>

            {fotoBase64 && (
              <div className="avatar-actions-row">
                <label htmlFor="foto-upload" className="btn-avatar-mini" title="Trocar foto">
                  <i className="fas fa-sync"></i> Trocar
                </label>
                <button type="button" onClick={removerFoto} className="btn-avatar-mini remove" title="Remover foto">
                  <i className="fas fa-trash-alt"></i> Remover
                </button>
                <input id="foto-upload" type="file" accept="image/*" onChange={handleFileChange} style={{display:'none'}} />
              </div>
            )}

            {/* INFORMACÕES DO CLIENTE */}
            <div className="profile-identity-box">
              <h3 className="profile-client-name">
                {tipoPessoa === 'fisica' ? (formData.nome || 'Novo Cliente') : (formData.nomeFantasia || 'Nova Empresa')}
              </h3>
              
              <div className="profile-document-pill">
                <i className="far fa-id-card"></i> 
                <span>{tipoPessoa === 'fisica' ? (formData.cpf || 'CPF não informado') : (formData.cnpj || 'CNPJ não informado')}</span>
              </div>

              {tagColorida && (
                <div className="profile-tag-pill" style={{ backgroundColor: tagColorida.bg, color: tagColorida.color, border: `1px solid ${tagColorida.border}` }}>
                  <span>{tagIcon} {formData.tags}</span>
                </div>
              )}
            </div>

            {/* BANNER DE ANIVERSÁRIO DE RETENÇÃO (CRM) */}
            {infoAniversario && infoAniversario.dias <= 30 && (
              <div className="profile-birthday-banner">
                <div className="birthday-header">
                  <i className="fas fa-birthday-cake"></i> 
                  <span>{infoAniversario.dias === 0 ? '🎂 HOJE É O ANIVERSÁRIO!' : `🎁 Aniversário em ${infoAniversario.dias} dias (${infoAniversario.dataFmt})`}</span>
                </div>
                {formData.celular && (
                  <a 
                    href={`https://wa.me/55${formData.celular.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá, ${(formData.nome || formData.nomeFantasia || '').trim().split(' ')[0]}! 🎉\n\nVimos que seu aniversário está chegando (${infoAniversario.dataFmt}) e preparamos um presente especial para celebrar essa data! 🎁\n\nQue tal um desconto exclusivo nos móveis para o seu evento? Conte conosco!`)}`}
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn-birthday-whatsapp"
                  >
                    <i className="fab fa-whatsapp"></i> Parabenizar no Whats
                  </a>
                )}
              </div>
            )}

            {/* STATUS BADGES GRID */}
            <div className="profile-status-cards">
              <div className={`status-mini-card ${formData.statusCadastro}`}>
                <span className="status-label">STATUS CADASTRO</span>
                <strong className="status-val">
                  {formData.statusCadastro === 'pendente' ? '⏳ Pendente' : formData.statusCadastro === 'bloqueado' ? '🚫 Bloqueado' : '✅ Aprovado'}
                </strong>
              </div>

              <div className={`status-mini-card ${calculandoFinancas ? 'calculando' : formData.situacaoFinanceira}`}>
                <span className="status-label">SAÚDE FINANCEIRA</span>
                <strong className="status-val">
                  {calculandoFinancas ? '⏳ Calculando...' : (formData.situacaoFinanceira === 'inadimplente' ? '🔴 Inadimplente' : '🟢 Adimplente')}
                </strong>
              </div>
            </div>

            {/* METRICA LTV DE CONSUMO */}
            {clienteEditando && (
              <div className="profile-ltv-banner">
                <div className="ltv-title"><i className="fas fa-coins"></i> Total em Locações (LTV)</div>
                <div className="ltv-amount">R$ {totalGasto.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
              </div>
            )}

            {/* BOTÃO WHATSAPP DIRECT */}
            {formData.celular && (
              <a 
                href={`https://wa.me/55${formData.celular.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá, ${(formData.nome || formData.nomeFantasia || '').trim().split(' ')[0]}! Tudo bem? Entro em contato pela Celebre Festas.`)}`} 
                target="_blank" 
                rel="noreferrer" 
                className="btn-whatsapp-executive"
              >
                <i className="fab fa-whatsapp"></i> Chamar no WhatsApp
              </a>
            )}

            {/* DATA DE CADASTRO */}
            <div className="profile-since-footer">
              <i className="far fa-calendar-alt"></i> Cliente desde: {clienteEditando?.criadoEm ? new Date(clienteEditando.criadoEm).toLocaleDateString('pt-BR') : 'Hoje'}
            </div>

          </div>

          {/* COLUNA DIREITA: FORMULÁRIO WIDESCREEN ALINHADO */}
          <div className="right-data-col">
            
            {/* SELETOR PESSOA FÍSICA / JURÍDICA */}
            <div className="tabs-container">
              <button 
                type="button" 
                className={`tab-btn ${tipoPessoa === 'fisica' ? 'active' : ''}`} 
                onClick={() => setTipoPessoa('fisica')}
              >
                <i className="fas fa-user"></i> Pessoa Física
              </button>
              <button 
                type="button" 
                className={`tab-btn ${tipoPessoa === 'juridica' ? 'active' : ''}`} 
                onClick={() => setTipoPessoa('juridica')}
              >
                <i className="fas fa-building"></i> Pessoa Jurídica
              </button>
            </div>

            {/* CARTÃO UNIFICADO DE CADASTRO DO CLIENTE */}
            <div className="form-section-card unified-sheet-card">
              
              {/* SEÇÃO 1: DADOS PESSOAIS / EMPRESA */}
              <div className="unified-section-header">
                <span className="section-header-icon">
                  <i className={tipoPessoa === 'fisica' ? "fas fa-id-card-alt" : "fas fa-building"}></i>
                </span>
                <div>
                  <h3>{tipoPessoa === 'fisica' ? 'DADOS PESSOAIS' : 'DADOS DA EMPRESA'}</h3>
                  <p>Informações principais de identificação do cliente</p>
                </div>
              </div>

              {tipoPessoa === 'fisica' ? (
                <div className="form-grid-4">
                  <div className="form-group span-4">
                    <label htmlFor="nome">NOME COMPLETO *</label>
                    <div className="input-icon-wrapper">
                      <span className="input-left-icon"><i className="far fa-user"></i></span>
                      <input id="nome" type="text" name="nome" autoComplete="name" value={formData.nome} onChange={handleChange} required placeholder="Ex: Rosa Maria Vichinhsk" />
                    </div>
                  </div>
                  <div className="form-group span-2 col-mobile-half">
                    <label htmlFor="cpf">CPF</label>
                    <div className="input-icon-wrapper">
                      <span className="input-left-icon"><i className="far fa-id-badge"></i></span>
                      <input id="cpf" type="text" name="cpf" autoComplete="off" placeholder="000.000.000-00" value={formData.cpf} onChange={handleChange} />
                    </div>
                  </div>
                  <div className="form-group span-2 col-mobile-half">
                    <label htmlFor="rg">RG (OPCIONAL)</label>
                    <input id="rg" type="text" name="rg" autoComplete="off" placeholder="00.000.000-0" value={formData.rg} onChange={handleChange} />
                  </div>
                  <div className="form-group span-2 col-mobile-half">
                    <label htmlFor="nascimento">ANIVERSÁRIO 🎂</label>
                    <input id="nascimento" type="date" name="nascimento" autoComplete="bday" value={formData.nascimento} onChange={handleChange} />
                  </div>
                  <div className="form-group span-2 col-mobile-half">
                    <label htmlFor="sexo">SEXO</label>
                    <select id="sexo" name="sexo" autoComplete="sex" value={formData.sexo} onChange={handleChange}>
                      <option value="">Selecione...</option>
                      <option value="Feminino">Feminino</option>
                      <option value="Masculino">Masculino</option>
                    </select>
                  </div>
                  <div className="form-group span-4">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                      <label htmlFor="datasComemorativas" style={{ margin: 0 }}>DATAS FESTIVAS DA FAMÍLIA 🎁</label>
                      {formData.celular && (
                        <button
                          type="button"
                          className="btn-pedir-datas-inline"
                          onClick={() => {
                            const tel = (formData.celular || '').replace(/\D/g, '');
                            const nomeCli = (formData.nome || formData.nomeFantasia || 'Cliente').split(' ')[0];
                            const nomeLoja = obterNomeEmpresaTenant(configEmpresa);
                            const msg = gerarMensagemDatasFamilia(nomeCli, nomeLoja);
                            window.open(`https://api.whatsapp.com/send?phone=55${tel}&text=${encodeURIComponent(msg)}`, '_blank');
                          }}
                          title="Enviar mensagem no WhatsApp solicitando as datas comemorativas da família"
                        >
                          <i className="fab fa-whatsapp"></i> Pedir Datas via WhatsApp
                        </button>
                      )}
                    </div>
                    <div className="input-icon-wrapper">
                      <span className="input-left-icon"><i className="fas fa-gift" style={{color:'#c5a059'}}></i></span>
                      <input id="datasComemorativas" type="text" name="datasComemorativas" autoComplete="off" value={formData.datasComemorativas} onChange={handleChange} placeholder="Ex: Filha Maria (15/09), Casamento (10/12)" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="form-grid-4">
                  <div className="form-group span-2">
                    <label htmlFor="cnpj">
                      CNPJ {buscandoCnpj ? <span style={{color: '#c5a059', fontWeight: 'bold', fontSize: '0.68rem', marginLeft: '6px'}}>⏳ Buscando na Receita Federal...</span> : null}
                    </label>
                    <div className="input-icon-wrapper">
                      <span className="input-left-icon"><i className="fas fa-building"></i></span>
                      <input 
                        id="cnpj" 
                        type="text" 
                        name="cnpj" 
                        autoComplete="off" 
                        placeholder="00.000.000/0000-00" 
                        maxLength="18"
                        value={formData.cnpj} 
                        onChange={buscarCnpjAuto} 
                      />
                      <button 
                        type="button" 
                        className="badge-viacep-auto btn-cnpj-clickable"
                        onClick={() => consultarCnpjNaReceita(formData.cnpj)}
                        disabled={buscandoCnpj}
                        title="Clique para consultar os dados da empresa na Receita Federal"
                      >
                        {buscandoCnpj ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-search"></i> Buscar CNPJ</>}
                      </button>
                    </div>
                  </div>
                  <div className="form-group span-2">
                    <label htmlFor="nomeFantasia">NOME FANTASIA *</label>
                    <input id="nomeFantasia" type="text" name="nomeFantasia" autoComplete="organization" value={formData.nomeFantasia} onChange={handleChange} required placeholder="Nome de exibição da empresa" />
                  </div>
                  <div className="form-group span-2">
                    <label htmlFor="razaoSocial">RAZÃO SOCIAL</label>
                    <input id="razaoSocial" type="text" name="razaoSocial" autoComplete="organization" value={formData.razaoSocial} onChange={handleChange} placeholder="Razão Social completa" />
                  </div>
                  <div className="form-group span-2">
                    <label htmlFor="inscricaoEstadual">INSCRIÇÃO ESTADUAL</label>
                    <input id="inscricaoEstadual" type="text" name="inscricaoEstadual" autoComplete="off" value={formData.inscricaoEstadual} onChange={handleChange} placeholder="Inscrição Estadual ou Isento" />
                  </div>
                  <div className="form-group span-2">
                    <label htmlFor="nomeContato">NOME DO CONTATO</label>
                    <input id="nomeContato" type="text" name="nomeContato" autoComplete="name" value={formData.nomeContato} onChange={handleChange} placeholder="Pessoa de contato" />
                  </div>
                  <div className="form-group span-2">
                    <label htmlFor="cargo">CARGO / DEPTO</label>
                    <input id="cargo" type="text" name="cargo" autoComplete="organization-title" value={formData.cargo} onChange={handleChange} placeholder="Ex: Gerente de Eventos" />
                  </div>
                  <div className="form-group span-4">
                    <label htmlFor="datasComemorativas">🎁 EVENTOS ANUAIS / DATAS COMEMORATIVAS DA EMPRESA</label>
                    <div className="input-icon-wrapper">
                      <span className="input-left-icon"><i className="fas fa-gift" style={{color:'#c5a059'}}></i></span>
                      <input id="datasComemorativas" type="text" name="datasComemorativas" autoComplete="off" value={formData.datasComemorativas} onChange={handleChange} placeholder="Ex: Festa de Fim de Ano (Dezembro), Aniversário da Empresa (14/05)" />
                    </div>
                  </div>
                </div>
              )}

              {/* SEÇÃO 2: CONTATO E MARKETING */}
              <div className="form-section-divider"></div>
              
              <div className="unified-section-header">
                <span className="section-header-icon"><i className="fas fa-phone-alt"></i></span>
                <div>
                  <h3>CONTATO E MARKETING</h3>
                  <p>Canais diretos para atendimento e orçamentos</p>
                </div>
              </div>

              <div className="form-grid-4">
                <div className="form-group span-2 col-mobile-half">
                  <label htmlFor="celular">CELULAR / WHATSAPP *</label>
                  <div className="input-icon-wrapper">
                    <span className="input-left-icon"><i className="fab fa-whatsapp color-green"></i></span>
                    <input id="celular" type="tel" name="celular" autoComplete="tel" placeholder="(00) 00000-0000" value={formData.celular} onChange={handleChange} />
                  </div>
                </div>
                <div className="form-group span-2 col-mobile-half">
                  <label htmlFor="telefoneFixo">TELEFONE FIXO</label>
                  <div className="input-icon-wrapper">
                    <span className="input-left-icon"><i className="fas fa-phone-square-alt"></i></span>
                    <input id="telefoneFixo" type="tel" name="telefoneFixo" autoComplete="tel" placeholder="(00) 0000-0000" value={formData.telefoneFixo} onChange={handleChange} />
                  </div>
                </div>
                <div className="form-group span-4">
                  <label htmlFor="email">E-MAIL</label>
                  <div className="input-icon-wrapper">
                    <span className="input-left-icon"><i className="far fa-envelope"></i></span>
                    <input id="email" type="email" name="email" autoComplete="email" placeholder="nome@email.com" value={formData.email} onChange={handleChange} />
                  </div>
                </div>
                <div className="form-group span-4">
                  <label htmlFor="origem">COMO NOS CONHECEU?</label>
                  <div className="input-icon-wrapper">
                    <span className="input-left-icon"><i className="fas fa-bullhorn"></i></span>
                    <select id="origem" name="origem" autoComplete="off" value={formData.origem} onChange={handleChange}>
                      <option value="">Selecione...</option>
                      <option value="Instagram">Instagram</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Facebook">Facebook</option>
                      <option value="Pesquisa Google">Pesquisa no Google</option>
                      <option value="Indicação">Indicação</option>
                      <option value="Auto-Cadastro (Site)">Auto-Cadastro (Site)</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SEÇÃO 3: ENDEREÇO DA RESIDÊNCIA / ENTREGA */}
              <div className="form-section-divider"></div>
              
              <div className="unified-section-header">
                <span className="section-header-icon"><i className="fas fa-map-marked-alt"></i></span>
                <div>
                  <h3>ENDEREÇO DA RESIDÊNCIA / ENTREGA</h3>
                  <p>Localização para frete, entrega e elaboração de contrato</p>
                </div>
              </div>

              <div className="form-grid-4">
                <div className="form-group span-4">
                  <label htmlFor="cep">CEP (BUSCA AUTOMÁTICA)</label>
                  <div className="input-icon-wrapper">
                    <span className="input-left-icon"><i className="fas fa-search-location"></i></span>
                    <input id="cep" type="text" name="cep" autoComplete="postal-code" placeholder="00000-000" maxLength="9" value={formData.cep} onChange={buscarCep} />
                    <span className="badge-viacep-auto"><i className="fas fa-magic"></i> ViaCEP Auto</span>
                  </div>
                </div>
                <div className="form-group span-4">
                  <label htmlFor="logradouro">LOGRADOURO / RUA</label>
                  <div className="input-icon-wrapper">
                    <span className="input-left-icon"><i className="fas fa-road"></i></span>
                    <input id="logradouro" type="text" name="logradouro" autoComplete="address-line1" value={formData.logradouro} onChange={handleChange} placeholder="Rua, Avenida, Alameda..." />
                  </div>
                </div>
                <div className="form-group span-2 col-mobile-half">
                  <label htmlFor="numeroInput">NÚMERO</label>
                  <input id="numeroInput" type="text" name="numero" autoComplete="address-line2" value={formData.numero} onChange={handleChange} placeholder="Ex: 123" />
                </div>
                <div className="form-group span-2 col-mobile-half">
                  <label htmlFor="uf">UF</label>
                  <input id="uf" type="text" name="uf" autoComplete="address-level1" placeholder="SP" value={formData.uf} onChange={handleChange} />
                </div>
                <div className="form-group span-2 col-mobile-half">
                  <label htmlFor="bairro">BAIRRO</label>
                  <input id="bairro" type="text" name="bairro" autoComplete="address-level3" value={formData.bairro} onChange={handleChange} placeholder="Nome do Bairro" />
                </div>
                <div className="form-group span-2 col-mobile-half">
                  <label htmlFor="cidade">CIDADE</label>
                  <input id="cidade" type="text" name="cidade" autoComplete="address-level2" value={formData.cidade} onChange={handleChange} placeholder="Cidade" />
                </div>
              </div>

              {/* SEÇÃO 4: EXCLUSIVO DE CONTROLE E CLASSIFICAÇÃO CRM */}
              <div className="form-section-divider"></div>
              
              <div className="unified-section-header">
                <span className="section-header-icon"><i className="fas fa-sliders-h"></i></span>
                <div>
                  <h3 style={{ margin: 0 }}>CONTROLE E CLASSIFICAÇÃO CRM</h3>
                  <p style={{ margin: '2px 0 0 0' }}>Classificação estratégica e tags para automação de atendimento</p>
                </div>
              </div>
              
              <div className="form-grid-4">
                {/* STATUS DO CADASTRO */}
                <div className="form-group span-2">
                  <label htmlFor="statusCadastro">
                    STATUS DO CADASTRO
                  </label>
                  <div className="custom-select-wrapper">
                    <select 
                      id="statusCadastro" 
                      name="statusCadastro" 
                      autoComplete="off" 
                      value={formData.statusCadastro} 
                      onChange={handleChange} 
                      className={`status-select-pro ${formData.statusCadastro}`}
                    >
                      {podeSerPendente && <option value="pendente">⏳ Pendente (Aguardando Aprovação)</option>}
                      <option value="aprovado">✔️ Cadastro Aprovado</option>
                      <option value="bloqueado">🚫 Cadastro Bloqueado</option>
                    </select>
                  </div>
                </div>

                {/* SITUAÇÃO FINANCEIRA */}
                <div className="form-group span-2">
                  <label htmlFor="situacaoFinanceira">
                    SITUAÇÃO FINANCEIRA <i className="fas fa-lock lock-icon" title="Cálculo automático de locações passadas"></i>
                  </label>
                  <div className="custom-select-wrapper">
                    <select 
                      id="situacaoFinanceira" 
                      name="situacaoFinanceira" 
                      autoComplete="off" 
                      value={calculandoFinancas ? 'calculando' : formData.situacaoFinanceira} 
                      disabled={true} 
                      className={`status-select-pro ${calculandoFinancas ? 'calculando' : formData.situacaoFinanceira}`}
                    >
                      <option value="calculando">⏳ Calculando...</option>
                      <option value="adimplente">🟢 Adimplente (Sem pendências)</option>
                      <option value="inadimplente">🔴 Inadimplente (Com pendências)</option>
                    </select>
                  </div>
                </div>

                {/* ETIQUETAS E TAGS CRM LUXURY COM BOTÃO DE CLASSIFICAÇÃO AUTOMÁTICA */}
                <div className="form-group span-4">
                  <div className="tag-header-row">
                    <label className="label-tag-title">
                      ETIQUETA DO CLIENTE (TAG CRM)
                    </label>
                    <button 
                      type="button" 
                      className="btn-auto-tag-suggest" 
                      onClick={aplicarTagAutomatica}
                      title="Clique para aplicar a sugestão automática calculada com base no histórico"
                    >
                      <i className="fas fa-robot"></i> Classificar Automático: <strong>{tagSugeridaAuto}</strong>
                    </button>
                  </div>

                  <div className="tags-selector-chips">
                    {tagsParaExibir.map(tag => {
                      const estaSelecionada = formData.tags === tag;
                      const tagEstilo = getTagStyle(tag); 
                      const icon = getTagIcon(tag);
                      return (
                        <button 
                          key={tag} 
                          type="button" 
                          className={`tag-chip-btn ${estaSelecionada ? 'selected' : ''}`} 
                          onClick={() => selecionarTag(tag)}
                          style={estaSelecionada ? { 
                            backgroundColor: tagEstilo.bg, 
                            color: tagEstilo.color, 
                            borderColor: tagEstilo.color,
                            boxShadow: `0 4px 14px rgba(0,0,0,0.12)`
                          } : { 
                            backgroundColor: tagEstilo.bg, 
                            color: tagEstilo.color, 
                            borderColor: tagEstilo.border 
                          }}
                        >
                          <span className="tag-icon-emoji">{icon}</span> {tag} {estaSelecionada && <i className="fas fa-check check-icon"></i>}
                        </button>
                      )
                    })}
                  </div>
                  {ehTagAntiga && (
                    <span className="tag-warning-text">
                      <i className="fas fa-exclamation-triangle"></i> Tag Antiga detectada: "{formData.tags}". Clique em uma opção acima para atualizar.
                    </span>
                  )}
                </div>

                {/* OBSERVAÇÕES INTERNAS DE ATENDIMENTO */}
                <div className="form-group span-4">
                  <label htmlFor="observacoes">
                    <i className="far fa-sticky-note"></i> OBSERVAÇÕES INTERNAS GERAIS
                  </label>
                  <textarea 
                    id="observacoes" 
                    name="observacoes" 
                    autoComplete="off" 
                    rows="2" 
                    className="observacoes-textarea"
                    value={formData.observacoes} 
                    onChange={handleChange} 
                    placeholder="Preferências do cliente, restrições ou notas de atendimento gerais..."
                  />
                </div>
              </div>

              {/* RODAPÉ DE AÇÕES INTEGRADO AO CARTÃO */}
              <div className="unified-card-actions-bar">
                <Link to="/clientes" className="btn-cancelar-celebre">
                  Cancelar
                </Link>
                <button type="submit" className="btn-salvar-celebre-gold" disabled={salvando}>
                  <i className="fas fa-save"></i> {salvando ? 'Aguarde, salvando...' : clienteEditando ? 'Salvar Alterações' : 'Salvar Cliente'}
                </button>
              </div>

            </div>

            {/* HISTÓRICO DE LOCAÇÕES E CONTRATOS */}
            {clienteEditando && historicoLocacoes.length > 0 && (
              <div style={{gridColumn: '1 / -1', width: '100%', marginTop: '14px'}}>
                <div className="form-section-card">
                  <div className="form-section-header">
                    <span className="section-header-icon"><i className="fas fa-history"></i></span>
                    <div>
                      <h3 style={{ margin: 0 }}>HISTÓRICO DE LOCAÇÕES E CONTRATOS</h3>
                      <p style={{ margin: '2px 0 0 0' }}>{historicoLocacoes.length} pedidos vinculados a este cliente</p>
                    </div>
                  </div>

                  <div className="historico-grid">
                    {historicoLocacoes.map(loc => {
                      const st = String(loc.status || 'S/S').toLowerCase().replace(' ', '');
                      const isCancelado = st.includes('cancelado');
                      return (
                        <div key={loc.id} className="historico-card" onClick={() => navigate(`/locacoes/editar/${loc.id}`)}>
                          <div className="h-info">
                            <span className="h-title">
                              Pedido {loc.numeroPedido ? `#${loc.numeroPedido}` : `#${loc.id.substring(0,6).toUpperCase()}`}
                            </span>
                            <span className="h-date">
                              📅 Evento: {loc.dataRetirada ? new Date(loc.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR') : 'Sem data'}
                            </span>
                          </div>
                          <div className="h-status-valor">
                            <span className={`h-badge ${st}`}>
                              {loc.status?.toUpperCase() || 'S/S'}
                            </span>
                            <span className="h-value" style={{textDecoration: isCancelado ? 'line-through' : 'none', color: isCancelado ? '#94a3b8' : '#0f172a'}}>
                              R$ {Number(loc.valorTotal || loc.total || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

          </div>
        </form>
      </div>

      {/* 🎉 MODAL DE BOAS-VINDAS E SOLICITAÇÃO DE DATAS FESTIVAS VIA WHATSAPP */}
      {modalBoasVindasZap && (
        <div className="modal-boas-vindas-overlay animate-fade-in" onClick={() => {}}>
          <div className="modal-boas-vindas-card animate-pop" onClick={e => e.stopPropagation()}>
            <div className="modal-bv-header">
              <div className="modal-bv-icon">🎉</div>
              <div className="modal-bv-titles">
                <h3>Cliente Cadastrado com Sucesso!</h3>
                <p>
                  Deseja enviar as boas-vindas da <strong>{modalBoasVindasZap.nomeEmpresa}</strong> e solicitar as datas festivas da família para <strong>{modalBoasVindasZap.nomeCliente}</strong>?
                </p>
              </div>
            </div>

            <div className="modal-bv-body">
              <label className="modal-bv-label">
                <i className="fab fa-whatsapp" style={{ color: '#25D366' }}></i> Mensagem de Boas-Vindas & CRM:
              </label>
              <textarea
                className="modal-bv-textarea"
                rows={6}
                value={modalBoasVindasZap.mensagem}
                onChange={e => setModalBoasVindasZap({ ...modalBoasVindasZap, mensagem: e.target.value })}
              />
              <span className="modal-bv-tip">
                💡 Ao clicar em Enviar, o WhatsApp abrirá com essa mensagem personalizada pronta.
              </span>
            </div>

            <div className="modal-bv-actions">
              <button
                type="button"
                className="btn-bv-zap-enviar"
                onClick={() => {
                  const url = `https://api.whatsapp.com/send?phone=55${modalBoasVindasZap.celular}&text=${encodeURIComponent(modalBoasVindasZap.mensagem)}`;
                  window.open(url, '_blank');
                  setModalBoasVindasZap(null);
                  navigate('/clientes');
                }}
              >
                <i className="fab fa-whatsapp"></i> Enviar WhatsApp para {modalBoasVindasZap.nomeCliente}
              </button>

              <button
                type="button"
                className="btn-bv-criar-locacao"
                onClick={() => {
                  const cli = modalBoasVindasZap.clienteObj;
                  setModalBoasVindasZap(null);
                  navigate('/locacoes/nova', { state: { clienteSelecionado: cli } });
                }}
              >
                <i className="fas fa-shopping-cart"></i> Criar Nova Locação
              </button>

              <button
                type="button"
                className="btn-bv-concluir"
                onClick={() => {
                  setModalBoasVindasZap(null);
                  navigate('/clientes');
                }}
              >
                Concluir sem Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CadastroCliente;