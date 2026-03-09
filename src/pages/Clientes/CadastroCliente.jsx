import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './CadastroCliente.css'; 
import { db } from '../../firebaseConfig';
import { collection, addDoc, updateDoc, doc, query, getDocs } from 'firebase/firestore';

// 🔥 MÁQUINA DE LAVAR PALAVRAS 🔥
const formatarNomeCapitalizado = (nomeBruto) => {
  if (!nomeBruto) return '';
  
  const partes = nomeBruto.toLowerCase().split(' ');
  const conectores = ['da', 'de', 'di', 'do', 'du', 'das', 'dos', 'e'];
  
  return partes.map((palavra, index) => {
      if (palavra === '') return ''; 
      if (index > 0 && conectores.includes(palavra)) {
          return palavra;
      }
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
  }).join(' ');
};

// 🔥 AS CORES VIBRANTES AGORA ESTÃO NO CADASTRO TAMBÉM 🔥
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

// 🔥 LISTA DE TAGS EXCLUSIVAS 🔥
const TAGS_PERFIL = [
  'NOVO', 
  'RECORRENTE', 
  'VIP', 
  'ECONÔMICO', 
  'PECHINCHA',
  'INDECISO', 
  'EXIGENTE', 
  'ORGANIZADO', 
  'ÚLTIMA HORA',
  'BÁSICO', 
  'PROBLEMÁTICO'
];

const CadastroCliente = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const clienteEditando = location.state?.clienteEditando || null;

  const [tipoPessoa, setTipoPessoa] = useState('fisica');
  const [salvando, setSalvando] = useState(false);

  const [podeSerPendente, setPodeSerPendente] = useState(false);
  const [calculandoFinancas, setCalculandoFinancas] = useState(!!clienteEditando);

  const [fotoBase64, setFotoBase64] = useState('');
  const [posicaoFoto, setPosicaoFoto] = useState({ x: 50, y: 50 });
  const [dragging, setDragging] = useState(false);
  const [startMouse, setStartMouse] = useState({ x: 0, y: 0 });

  const [formData, setFormData] = useState({
    nome: '', cpf: '', rg: '', nascimento: '', sexo: '',
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
    if (clienteEditando) {
      setTipoPessoa(clienteEditando.tipoPessoa || 'fisica');
      setFotoBase64(clienteEditando.foto || '');
      setPosicaoFoto(clienteEditando.posicaoFoto || { x: 50, y: 50 });
      
      const eraPendenteAntigo = clienteEditando.situacaoFinanceira === 'pendente';
      const statusReal = clienteEditando.statusCadastro ? clienteEditando.statusCadastro : (eraPendenteAntigo ? 'pendente' : 'aprovado');
      
      setFormData({
        nome: formatarNomeCapitalizado(clienteEditando.nome || ''), 
        cpf: clienteEditando.cpf || '', rg: clienteEditando.rg || '', nascimento: clienteEditando.nascimento || '', sexo: clienteEditando.sexo || '',
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
  }, [clienteEditando]);

  useEffect(() => {
    const verificarInadimplencia = async () => {
      if (!clienteEditando?.id) return; 
      
      try {
        const qLocacoes = query(collection(db, "locacoes"));
        const snap = await getDocs(qLocacoes);
        
        let temDividaVencida = false;
        const hoje = new Date();
        hoje.setHours(0,0,0,0); 

        snap.docs.forEach(docSnap => {
          const loc = docSnap.data();
          
          if (loc.clienteId === clienteEditando.id || loc.cliente?.id === clienteEditando.id) {
            const statusLoc = (loc.status || '').toLowerCase();
            if (statusLoc === 'cancelado' || statusLoc.includes('orcam')) return;

            const dataStr = loc.dataRetirada || loc.dataEvento || loc.dataDevolucao;
            if (dataStr) {
              const dataEvento = new Date(dataStr + 'T00:00:00');
              const pagStatus = (loc.statusPagamento || '').toLowerCase();
              
              const vTotal = Number(loc.valorTotal || loc.total || 0);
              const vPago = Number(loc.valorPago || 0);
              const saldoDevedor = vTotal - vPago;

              if (dataEvento < hoje && saldoDevedor > 0.01 && pagStatus !== 'pago' && pagStatus !== 'quitado') {
                temDividaVencida = true;
              }
            }
          }
        });

        setFormData(prev => ({
          ...prev,
          situacaoFinanceira: temDividaVencida ? 'inadimplente' : 'adimplente'
        }));

      } catch(e) {
        console.error("Erro ao verificar inadimplência automática:", e);
      } finally {
        setCalculandoFinancas(false);
      }
    };

    verificarInadimplencia();
  }, [clienteEditando]);

  const maskCPF = (v) => {
    v = v.replace(/\D/g, ""); 
    v = v.replace(/(\d{3})(\d)/, "$1.$2"); 
    v = v.replace(/(\d{3})(\d)/, "$1.$2"); 
    v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2"); 
    return v.substring(0, 14);
  };

  const maskCNPJ = (v) => {
    v = v.replace(/\D/g, "");
    v = v.replace(/^(\d{2})(\d)/, "$1.$2");
    v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
    v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
    v = v.replace(/(\d{4})(\d)/, "$1-$2");
    return v.substring(0, 18);
  };

  const maskPhone = (v) => {
    v = v.replace(/\D/g, "");
    v = v.replace(/^(\d{2})(\d)/g, "($1) $2"); 
    v = v.replace(/(\d)(\d{4})$/, "$1-$2");    
    return v.substring(0, 15);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let newValue = value;

    if (name === 'cpf') newValue = maskCPF(value);
    else if (name === 'cnpj') newValue = maskCNPJ(value);
    else if (name === 'celular' || name === 'telefoneFixo') newValue = maskPhone(value);
    else if (name === 'email') newValue = value.toLowerCase();
    else if (name === 'uf') newValue = value.toUpperCase().substring(0, 2);
    else {
      const camposCapitalizados = ['nome', 'razaoSocial', 'nomeFantasia', 'nomeContato', 'cargo', 'logradouro', 'complemento', 'bairro', 'cidade'];
      if (camposCapitalizados.includes(name)) {
        newValue = formatarNomeCapitalizado(value);
      }
    }
    
    setFormData({ ...formData, [name]: newValue });
  };

  const selecionarTag = (tagEscolhida) => {
    setFormData({ ...formData, tags: tagEscolhida });
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
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          setFotoBase64(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStart = (clientX, clientY) => {
    setDragging(true);
    setStartMouse({ x: clientX, y: clientY });
  };

  const handleMove = (clientX, clientY) => {
    if (!dragging) return;
    const deltaX = clientX - startMouse.x;
    const deltaY = clientY - startMouse.y;
    setStartMouse({ x: clientX, y: clientY });
    setPosicaoFoto(prev => ({
      x: Math.max(0, Math.min(100, prev.x - (deltaX * 0.4))),
      y: Math.max(0, Math.min(100, prev.y - (deltaY * 0.4)))
    }));
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
            ...prev, 
            cep: cepMascarado, 
            logradouro: formatarNomeCapitalizado(dados.logradouro), 
            bairro: formatarNomeCapitalizado(dados.bairro), 
            cidade: formatarNomeCapitalizado(dados.localidade), 
            uf: dados.uf.toUpperCase() 
          }));
          document.getElementById('numeroInput').focus();
        }
      } catch (error) { console.error("Erro ao buscar CEP"); }
    }
  };

  const verificarDuplicidade = async () => {
      const qClientes = query(collection(db, "clientes"));
      const snap = await getDocs(qClientes);
      const todosClientes = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const meuCelular = formData.celular ? formData.celular.replace(/\D/g, '') : '';
      const meuCpf = formData.cpf ? formData.cpf.replace(/\D/g, '') : '';
      const meuCnpj = formData.cnpj ? formData.cnpj.replace(/\D/g, '') : '';
      const meuNome = (formData.nome || formData.nomeFantasia || '').trim().toLowerCase();
      const meuNascimento = formData.nascimento || '';

      for (let c of todosClientes) {
          if (clienteEditando && c.id === clienteEditando.id) continue;

          const bancoCelular = c.celular ? c.celular.replace(/\D/g, '') : '';
          const bancoCpf = c.cpf ? c.cpf.replace(/\D/g, '') : '';
          const bancoCnpj = c.cnpj ? c.cnpj.replace(/\D/g, '') : '';
          const bancoNome = (c.nome || c.nomeFantasia || '').trim().toLowerCase();
          const bancoNascimento = c.nascimento || '';

          if (tipoPessoa === 'fisica' && meuCpf.length === 11 && meuCpf === bancoCpf) {
              alert(`⚠️ AÇÃO BLOQUEADA: Já existe um cliente com este mesmo CPF!\n\nNome na agenda: ${c.nome || c.nomeFantasia}`);
              return true; 
          }
          
          if (tipoPessoa === 'juridica' && meuCnpj.length === 14 && meuCnpj === bancoCnpj) {
              alert(`⚠️ AÇÃO BLOQUEADA: Já existe uma empresa com este mesmo CNPJ!\n\nNome na agenda: ${c.nomeFantasia || c.razaoSocial}`);
              return true; 
          }

          if (meuNome && meuNome === bancoNome && meuCelular.length > 8 && meuCelular === bancoCelular) {
              alert(`⚠️ AÇÃO BLOQUEADA: Já existe um cliente com o exato mesmo NOME e CELULAR!\n\nVerifique o histórico da cliente antes de recadastrar.`);
              return true;
          }

          if (meuNome && meuNome === bancoNome && meuNascimento && meuNascimento === bancoNascimento) {
              alert(`⚠️ AÇÃO BLOQUEADA: Já existe um cliente com o exato mesmo NOME e DATA DE NASCIMENTO!\n\nVerifique o histórico da cliente antes de recadastrar.`);
              return true;
          }
      }

      return false; 
  };

  const salvarCliente = async (e) => {
    e.preventDefault();
    
    if (tipoPessoa === 'fisica' && !formData.nome) return alert("O Nome é obrigatório!");
    if (tipoPessoa === 'juridica' && !formData.nomeFantasia) return alert("O Nome Fantasia é obrigatório!");
    
    setSalvando(true);
    try {
      const temDuplicidade = await verificarDuplicidade();
      
      if (temDuplicidade) {
          setSalvando(false);
          return;
      }

      const dadosLimpos = {
        ...formData,
        nome: formData.nome.trim(),
        razaoSocial: formData.razaoSocial.trim(),
        nomeFantasia: formData.nomeFantasia.trim()
      };

      const dadosParaSalvar = { ...dadosLimpos, tipoPessoa, foto: fotoBase64, posicaoFoto, atualizadoEm: new Date().toISOString() };
      
      if (clienteEditando) {
        await updateDoc(doc(db, "clientes", clienteEditando.id), dadosParaSalvar);
        alert("Cliente atualizado com sucesso!");
      } else {
        await addDoc(collection(db, "clientes"), { ...dadosParaSalvar, criadoEm: new Date().toISOString() });
        alert("Novo cliente cadastrado com sucesso!");
      }
      navigate('/clientes');
    } catch (error) { 
      alert("Erro ao salvar cliente."); 
    } finally { 
      setSalvando(false); 
    }
  };

  // 🔥 AQUI ESTÁ A CORREÇÃO: MOSTRA APENAS AS TAGS OFICIAIS (Fantasmas não viram botão!) 🔥
  const tagsParaExibir = TAGS_PERFIL;
  
  // 🔥 VERIFICA SE O CLIENTE TEM UMA TAG QUE NÃO É OFICIAL (FANTASMA)
  const ehTagAntiga = formData.tags && !TAGS_PERFIL.includes(formData.tags);

  return (
    <div className="form-page-container">
      <div className="form-page-header">
        <div className="header-text">
          <h1 className="form-page-title">{clienteEditando ? 'EDITAR CLIENTE' : 'NOVO CLIENTE'}</h1>
          <p className="form-page-subtitle">Preencha os dados de contato e faturamento</p>
        </div>
      </div>

      <div className="form-widescreen">
        <form onSubmit={salvarCliente} className="estoque-form-layout" autoComplete="on">
          
          <div className="left-photo-col">
            <h3 className="section-divider" style={{marginTop: 0, textAlign: 'center', width: '100%'}}>PERFIL DO CLIENTE</h3>
            
            <div className="main-photo-display">
              {fotoBase64 ? (
                <>
                  <img 
                    src={fotoBase64} 
                    className="main-photo-preview" 
                    alt="Preview"
                    style={{ 
                      objectPosition: `${posicaoFoto.x}% ${posicaoFoto.y}%`,
                      cursor: dragging ? 'grabbing' : 'grab',
                      touchAction: 'none'
                    }}
                    onMouseDown={(e) => { e.preventDefault(); handleStart(e.clientX, e.clientY); }}
                    onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
                    onMouseUp={handleEnd}
                    onMouseLeave={handleEnd}
                    onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
                    onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY)}
                    onTouchEnd={handleEnd}
                  />
                  <div className="drag-hint">
                    <span>Arrastar para enquadrar</span>
                  </div>
                </>
              ) : (
                <label htmlFor="foto-upload" className="photo-upload-label">
                  <span className="photo-icon">👤</span>
                  <span className="photo-text">Adicionar Foto</span>
                  <input id="foto-upload" type="file" accept="image/*" onChange={handleFileChange} style={{display:'none'}} />
                </label>
              )}
            </div>
            
            {fotoBase64 && (
              <div className="photo-actions">
                <label htmlFor="foto-upload" className="btn-action-photo">Trocar</label>
                <button type="button" onClick={removerFoto} className="btn-action-photo btn-remove">Remover</button>
                <input id="foto-upload" type="file" accept="image/*" onChange={handleFileChange} style={{display:'none'}} />
              </div>
            )}

            <div className="painel-resumo-lateral">
              <div className="resumo-badges">
                <span className={`badge-status ${formData.statusCadastro}`}>
                  {formData.statusCadastro === 'pendente' ? '⏳ Cadastro Pendente' : formData.statusCadastro === 'bloqueado' ? '🚫 Bloqueado' : '✅ Cadastro Aprovado'}
                </span>

                <span className="badge-financeiro" style={{
                    backgroundColor: calculandoFinancas ? '#f1f5f9' : formData.situacaoFinanceira === 'inadimplente' ? '#fef2f2' : '#f0fdf4',
                    color: calculandoFinancas ? '#475569' : formData.situacaoFinanceira === 'inadimplente' ? '#ef4444' : '#10b981',
                    border: calculandoFinancas ? '1px solid #cbd5e1' : formData.situacaoFinanceira === 'inadimplente' ? '1px solid #fca5a5' : '1px solid #86efac'
                }}>
                  {calculandoFinancas ? '⏳ Calculando...' : (formData.situacaoFinanceira === 'inadimplente' ? '🔴 Inadimplente' : '🟢 Adimplente')}
                </span>
              </div>

              <div className="resumo-info">
                <h4>{tipoPessoa === 'fisica' ? (formData.nome || 'Novo Cliente') : (formData.nomeFantasia || 'Nova Empresa')}</h4>
                <p>{tipoPessoa === 'fisica' ? (formData.cpf || 'CPF não informado') : (formData.cnpj || 'CNPJ não informado')}</p>
              </div>

              {formData.celular && (
                <a 
                  href={`https://wa.me/55${formData.celular.replace(/\D/g, '')}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="btn-whatsapp-resumo"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="18" height="18" fill="currentColor"><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7 .9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/></svg>
                  Chamar no WhatsApp
                </a>
              )}

              <div className="resumo-footer">
                <small>📅 Criado em: {clienteEditando?.criadoEm ? new Date(clienteEditando.criadoEm).toLocaleDateString('pt-BR') : 'Hoje'}</small>
              </div>
            </div>
            
          </div>

          <div className="right-data-col">
            <div className="tabs-container">
              <button 
                type="button" 
                className={`tab-btn ${tipoPessoa === 'fisica' ? 'active' : ''}`}
                onClick={() => setTipoPessoa('fisica')}
              >
                👤 Pessoa Física
              </button>
              <button 
                type="button" 
                className={`tab-btn ${tipoPessoa === 'juridica' ? 'active' : ''}`}
                onClick={() => setTipoPessoa('juridica')}
              >
                🏢 Pessoa Jurídica
              </button>
            </div>

            {tipoPessoa === 'fisica' ? (
              <>
                <h3 className="section-divider" style={{marginTop: 0}}>DADOS PESSOAIS</h3>
                <div className="form-grid-4">
                  <div className="form-group span-2"><label htmlFor="nome">NOME COMPLETO *</label><input id="nome" type="text" name="nome" autoComplete="name" value={formData.nome} onChange={handleChange} required /></div>
                  <div className="form-group span-1"><label htmlFor="cpf">CPF</label><input id="cpf" type="text" name="cpf" autoComplete="off" placeholder="000.000.000-00" value={formData.cpf} onChange={handleChange} /></div>
                  <div className="form-group span-1"><label htmlFor="rg">RG (OPCIONAL)</label><input id="rg" type="text" name="rg" autoComplete="off" placeholder="00.000.000-0" value={formData.rg} onChange={handleChange} /></div>
                  <div className="form-group span-1"><label htmlFor="nascimento">NASCIMENTO</label><input id="nascimento" type="date" name="nascimento" autoComplete="bday" value={formData.nascimento} onChange={handleChange} /></div>
                  <div className="form-group span-1"><label htmlFor="sexo">SEXO</label>
                    <select id="sexo" name="sexo" autoComplete="sex" value={formData.sexo} onChange={handleChange}>
                      <option value="">Selecione...</option><option value="Feminino">Feminino</option><option value="Masculino">Masculino</option>
                    </select>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h3 className="section-divider" style={{marginTop: 0}}>DADOS DA EMPRESA</h3>
                <div className="form-grid-4">
                  <div className="form-group span-2"><label htmlFor="razaoSocial">RAZÃO SOCIAL</label><input id="razaoSocial" type="text" name="razaoSocial" autoComplete="organization" value={formData.razaoSocial} onChange={handleChange} /></div>
                  <div className="form-group span-2"><label htmlFor="nomeFantasia">NOME FANTASIA *</label><input id="nomeFantasia" type="text" name="nomeFantasia" autoComplete="organization" value={formData.nomeFantasia} onChange={handleChange} required /></div>
                  <div className="form-group span-1"><label htmlFor="cnpj">CNPJ</label><input id="cnpj" type="text" name="cnpj" autoComplete="off" placeholder="00.000.000/0000-00" value={formData.cnpj} onChange={handleChange} /></div>
                  <div className="form-group span-1"><label htmlFor="inscricaoEstadual">INSCRIÇÃO ESTADUAL</label><input id="inscricaoEstadual" type="text" name="inscricaoEstadual" autoComplete="off" value={formData.inscricaoEstadual} onChange={handleChange} /></div>
                  <div className="form-group span-1"><label htmlFor="nomeContato">NOME DO CONTATO</label><input id="nomeContato" type="text" name="nomeContato" autoComplete="name" value={formData.nomeContato} onChange={handleChange} /></div>
                  <div className="form-group span-1"><label htmlFor="cargo">CARGO / DEPTO</label><input id="cargo" type="text" name="cargo" autoComplete="organization-title" value={formData.cargo} onChange={handleChange} /></div>
                </div>
              </>
            )}

            <h3 className="section-divider mt-compact">CONTATO E MARKETING</h3>
            <div className="form-grid-4">
              <div className="form-group span-1"><label htmlFor="celular">CELULAR / WHATSAPP</label><input id="celular" type="tel" name="celular" autoComplete="tel" placeholder="(00) 00000-0000" value={formData.celular} onChange={handleChange} /></div>
              <div className="form-group span-1"><label htmlFor="telefoneFixo">TELEFONE FIXO</label><input id="telefoneFixo" type="tel" name="telefoneFixo" autoComplete="tel" placeholder="(00) 0000-0000" value={formData.telefoneFixo} onChange={handleChange} /></div>
              <div className="form-group span-2"><label htmlFor="email">E-MAIL</label><input id="email" type="email" name="email" autoComplete="email" placeholder="nome@email.com" value={formData.email} onChange={handleChange} /></div>
              <div className="form-group span-2"><label htmlFor="origem">COMO NOS CONHECEU?</label>
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

            <h3 className="section-divider mt-compact">ENDEREÇO</h3>
            <div className="form-grid-4">
              <div className="form-group span-2"><label htmlFor="cep">CEP (BUSCA AUTO)</label><input id="cep" type="text" name="cep" autoComplete="postal-code" placeholder="00000-000" maxLength="9" value={formData.cep} onChange={buscarCep} /></div>
              <div className="form-group span-2"><label htmlFor="logradouro">LOGRADOURO</label><input id="logradouro" type="text" name="logradouro" autoComplete="address-line1" value={formData.logradouro} onChange={handleChange} /></div>
              
              <div className="form-group-row span-4">
                <div className="form-group flex-1">
                  <label htmlFor="numeroInput">NÚMERO</label>
                  <input id="numeroInput" type="text" name="numero" autoComplete="address-line2" value={formData.numero} onChange={handleChange} />
                </div>
                <div className="form-group flex-small">
                  <label htmlFor="uf">UF</label>
                  <input id="uf" type="text" name="uf" autoComplete="address-level1" placeholder="EX: SP" value={formData.uf} onChange={handleChange} />
                </div>
              </div>

              <div className="form-group span-2"><label htmlFor="bairro">BAIRRO</label><input id="bairro" type="text" name="bairro" autoComplete="address-level3" value={formData.bairro} onChange={handleChange} /></div>
              <div className="form-group span-2"><label htmlFor="cidade">CIDADE</label><input id="cidade" type="text" name="cidade" autoComplete="address-level2" value={formData.cidade} onChange={handleChange} /></div>
            </div>

            <h3 className="section-divider mt-compact">CONTROLE DE SISTEMA</h3>
            <div className="form-grid-4">
              
              <div className="form-group span-2">
                <label htmlFor="statusCadastro" style={{ color: formData.statusCadastro === 'pendente' ? '#d97706' : formData.statusCadastro === 'bloqueado' ? '#ef4444' : '#10b981', fontWeight: '800' }}>
                  STATUS DO CADASTRO
                </label>
                <select 
                  id="statusCadastro"
                  name="statusCadastro" 
                  autoComplete="off"
                  value={formData.statusCadastro} 
                  onChange={handleChange}
                  className="status-select"
                  style={{
                    backgroundColor: formData.statusCadastro === 'pendente' ? '#fef3c7' : formData.statusCadastro === 'bloqueado' ? '#fef2f2' : '#f0fdf4',
                    color: formData.statusCadastro === 'pendente' ? '#d97706' : formData.statusCadastro === 'bloqueado' ? '#ef4444' : '#10b981',
                    border: formData.statusCadastro === 'pendente' ? '1px solid #fcd34d' : formData.statusCadastro === 'bloqueado' ? '1px solid #fca5a5' : '1px solid #86efac'
                  }}
                >
                  {podeSerPendente && (
                    <option value="pendente">⏳ Pendente (Aguardando Aprovação)</option>
                  )}
                  <option value="aprovado">✔️ Cadastro Aprovado</option>
                  <option value="bloqueado">🚫 Cadastro Bloqueado</option>
                </select>
              </div>

              <div className="form-group span-2">
                <label htmlFor="situacaoFinanceira" style={{ color: calculandoFinancas ? '#64748b' : formData.situacaoFinanceira === 'inadimplente' ? '#ef4444' : '#10b981', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  SITUAÇÃO FINANCEIRA <span title="Este campo é automático e não pode ser alterado manualmente">🔒</span>
                </label>
                <select 
                  id="situacaoFinanceira"
                  name="situacaoFinanceira" 
                  autoComplete="off"
                  value={calculandoFinancas ? 'calculando' : formData.situacaoFinanceira} 
                  disabled={true}
                  className="status-select"
                  style={{
                    backgroundColor: calculandoFinancas ? '#f1f5f9' : formData.situacaoFinanceira === 'inadimplente' ? '#fef2f2' : '#f0fdf4',
                    color: calculandoFinancas ? '#475569' : formData.situacaoFinanceira === 'inadimplente' ? '#ef4444' : '#10b981',
                    border: calculandoFinancas ? '1px solid #cbd5e1' : formData.situacaoFinanceira === 'inadimplente' ? '1px solid #fca5a5' : '1px solid #86efac',
                    cursor: 'not-allowed',
                    opacity: 0.9
                  }}
                >
                  <option value="calculando">⏳ Calculando...</option>
                  <option value="adimplente">✅ Nome Limpo (Adimplente)</option>
                  <option value="inadimplente">⚠️ Devendo (Inadimplente)</option>
                </select>
                <small style={{fontSize: '10px', color: '#64748b', marginTop: '4px', display: 'block'}}>
                  * Atualizado automaticamente pelo módulo de locações.
                </small>
              </div>

              {/* 🔥 BOTÕES DE TAG COM CORES PERMANENTES E SEM ENGROSSAR A BORDA 🔥 */}
              <div className="form-group span-4">
                <label>PERFIL DO CLIENTE (TAG ÚNICA)</label>
                <div className="tags-selector-chips">
                  {tagsParaExibir.map(tag => {
                    const estaSelecionada = formData.tags === tag;
                    const tagEstilo = getTagStyle(tag); 
                    
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
                           // 🔥 O SEGREDO PRA NÃO CORTAR A BORDA É MANTER A ESPESSURA PADRÃO E USAR A SOMBRA! 🔥
                           boxShadow: `0 0 0 1px ${tagEstilo.color}, 0 4px 8px rgba(0,0,0,0.1)` 
                        } : {
                           backgroundColor: tagEstilo.bg,
                           color: tagEstilo.color,
                           borderColor: tagEstilo.border,
                        }}
                      >
                        {tag} {estaSelecionada && '✓'}
                      </button>
                    )
                  })}
                </div>
                {/* 🔥 AVISO DE FANTASMA PARA DEIXAR O SISTEMA LIMPO 🔥 */}
                {ehTagAntiga && (
                   <span style={{fontSize: '0.75rem', color: '#ef4444', display: 'block', marginTop: '8px', fontWeight: '600'}}>
                     👻 Tag Antiga detectada: "{formData.tags}". Clique em uma das opções acima para atualizar.
                   </span>
                )}
              </div>

              <div className="form-group span-4"><label htmlFor="observacoes">OBSERVAÇÕES INTERNAS</label><textarea id="observacoes" name="observacoes" autoComplete="off" rows="2" value={formData.observacoes} onChange={handleChange}></textarea></div>
            </div>

            <div className="form-actions mt-compact">
              <Link to="/clientes" className="btn-voltar-link">Cancelar</Link>
              <button type="submit" className="btn-salvar-form" disabled={salvando}>{salvando ? 'Aguarde...' : 'Salvar Cliente'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CadastroCliente;