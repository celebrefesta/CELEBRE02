import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './CadastroCliente.css'; 
import { db } from '../../firebaseConfig';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';

const CadastroCliente = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const clienteEditando = location.state?.clienteEditando || null;

  const [tipoPessoa, setTipoPessoa] = useState('fisica');
  const [salvando, setSalvando] = useState(false);

  // --- FOTO COM ARRASTO (DRAG) ---
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
    tags: '', observacoes: '',
    situacaoFinanceira: 'adimplente' 
  });

  useEffect(() => {
    if (clienteEditando) {
      setTipoPessoa(clienteEditando.tipoPessoa || 'fisica');
      setFotoBase64(clienteEditando.foto || '');
      setPosicaoFoto(clienteEditando.posicaoFoto || { x: 50, y: 50 });
      setFormData({
        nome: clienteEditando.nome || '', cpf: clienteEditando.cpf || '', rg: clienteEditando.rg || '', nascimento: clienteEditando.nascimento || '', sexo: clienteEditando.sexo || '',
        razaoSocial: clienteEditando.razaoSocial || '', nomeFantasia: clienteEditando.nomeFantasia || '', cnpj: clienteEditando.cnpj || '', inscricaoEstadual: clienteEditando.ie || clienteEditando.inscricaoEstadual || '',
        nomeContato: clienteEditando.nomeContato || '', cargo: clienteEditando.cargo || '',
        celular: clienteEditando.celular || '', telefoneFixo: clienteEditando.telefoneFixo || '', email: clienteEditando.email || '', origem: clienteEditando.origem || '',
        cep: clienteEditando.cep || '', logradouro: clienteEditando.logradouro || '', numero: clienteEditando.numero || '', complemento: clienteEditando.complemento || '', bairro: clienteEditando.bairro || '', cidade: clienteEditando.cidade || '', uf: clienteEditando.uf || '',
        tags: clienteEditando.tags || '', observacoes: clienteEditando.observacoes || '',
        situacaoFinanceira: clienteEditando.situacaoFinanceira || 'adimplente' 
      });
    }
  }, [clienteEditando]);

  // --- FUNÇÕES DE MÁSCARA AUTOMÁTICA ---
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
    else {
      const camposIgnorados = ['email', 'rg', 'inscricaoEstadual', 'numero'];
      if (!camposIgnorados.includes(name)) {
        newValue = value.replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase());
      } else if (name === 'email') {
        newValue = value.toLowerCase(); 
      }
    }

    setFormData({ ...formData, [name]: newValue });
  };

  // --- UPLOAD E COMPRESSÃO DA FOTO ---
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

  // --- LÓGICA DE ARRASTAR A IMAGEM ---
  const handleMouseDown = (e) => {
    setDragging(true);
    setStartMouse({ x: e.clientX, y: e.clientY });
    e.preventDefault(); 
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    const deltaX = e.clientX - startMouse.x;
    const deltaY = e.clientY - startMouse.y;
    setStartMouse({ x: e.clientX, y: e.clientY });

    setPosicaoFoto(prev => ({
      x: Math.max(0, Math.min(100, prev.x - (deltaX * 0.4))),
      y: Math.max(0, Math.min(100, prev.y - (deltaY * 0.4)))
    }));
  };

  const handleMouseUp = () => setDragging(false);
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
          const formatar = (str) => str ? str.replace(/(^\w{1})|(\s+\w{1})/g, l => l.toUpperCase()) : '';
          setFormData(prev => ({ 
            ...prev, cep: cepMascarado, logradouro: formatar(dados.logradouro), 
            bairro: formatar(dados.bairro), cidade: formatar(dados.localidade), uf: dados.uf.toUpperCase() 
          }));
          document.getElementById('numeroInput').focus();
        }
      } catch (error) { console.error("Erro ao buscar CEP"); }
    }
  };

  const salvarCliente = async (e) => {
    e.preventDefault();
    if (tipoPessoa === 'fisica' && !formData.nome) return alert("O Nome é obrigatório!");
    if (tipoPessoa === 'juridica' && !formData.nomeFantasia) return alert("O Nome Fantasia é obrigatório!");
    setSalvando(true);
    try {
      const dadosParaSalvar = { ...formData, tipoPessoa, foto: fotoBase64, posicaoFoto, atualizadoEm: new Date().toISOString() };
      if (clienteEditando) {
        await updateDoc(doc(db, "clientes", clienteEditando.id), dadosParaSalvar);
        alert("Cliente atualizado com sucesso!");
      } else {
        await addDoc(collection(db, "clientes"), { ...dadosParaSalvar, criadoEm: new Date().toISOString() });
        alert("Novo cliente cadastrado com sucesso!");
      }
      navigate('/clientes');
    } catch (error) { alert("Erro ao salvar cliente."); } 
    finally { setSalvando(false); }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="header-text">
          <h1 className="page-title">{clienteEditando ? 'EDITAR CLIENTE' : 'NOVO CLIENTE'}</h1>
          <p style={{ color: '#64748b', marginTop: '5px' }}>Preencha os dados de contato e faturamento</p>
        </div>
      </div>

      <div className="form-widescreen">
        <form onSubmit={salvarCliente} className="estoque-form-layout">
          
          {/* COLUNA ESQUERDA: FOTO */}
          <div className="left-photo-col">
            <h3 className="section-divider" style={{marginTop: 0}}>FOTO / LOGO</h3>
            
            <div className="main-photo-display" style={{position: 'relative', overflow: 'hidden', borderRadius: '12px'}}>
              {fotoBase64 ? (
                <>
                  <img 
                    src={fotoBase64} 
                    className="main-photo-preview" 
                    style={{ 
                      objectPosition: `${posicaoFoto.x}% ${posicaoFoto.y}%`,
                      cursor: dragging ? 'grabbing' : 'grab'
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  />
                  <div style={{position: 'absolute', bottom: '10px', width: '100%', textAlign: 'center', pointerEvents: 'none'}}>
                    <span style={{background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: '10px', padding: '4px 8px', borderRadius: '12px'}}>Arrastar para enquadrar</span>
                  </div>
                </>
              ) : (
                <label htmlFor="foto-upload" style={{cursor: 'pointer', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
                  <span style={{fontSize:'40px', opacity:0.3}}>👤</span>
                  <span className="photo-text" style={{marginTop: '10px', color: '#94a3b8', fontWeight: 'bold'}}>Adicionar Foto</span>
                  <input id="foto-upload" type="file" accept="image/*" onChange={handleFileChange} style={{display:'none'}} />
                </label>
              )}
            </div>
            
            {fotoBase64 && (
              <div style={{display: 'flex', gap: '10px', marginTop: '15px'}}>
                <label htmlFor="foto-upload" className="btn-voltar" style={{flex: 1, textAlign: 'center', cursor: 'pointer', padding: '8px'}}>Trocar</label>
                <button type="button" onClick={removerFoto} className="btn-voltar" style={{flex: 1, color: '#ef4444', borderColor: '#fee2e2', background: '#fef2f2'}}>Remover</button>
                <input id="foto-upload" type="file" accept="image/*" onChange={handleFileChange} style={{display:'none'}} />
              </div>
            )}
          </div>

          {/* COLUNA DIREITA: DADOS */}
          <div className="right-data-col">
            
            <div className="tabs-container" style={{marginBottom: '20px', display: 'flex', gap: '15px', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px'}}>
              <button 
                type="button" 
                style={{background: 'none', border: 'none', fontSize: '15px', fontWeight: 'bold', padding: '5px 10px', cursor: 'pointer', color: tipoPessoa === 'fisica' ? '#0f172a' : '#94a3b8', borderBottom: tipoPessoa === 'fisica' ? '3px solid #c5a059' : '3px solid transparent', transition: 'all 0.2s'}}
                onClick={() => setTipoPessoa('fisica')}
              >
                👤 Pessoa Física
              </button>
              <button 
                type="button" 
                style={{background: 'none', border: 'none', fontSize: '15px', fontWeight: 'bold', padding: '5px 10px', cursor: 'pointer', color: tipoPessoa === 'juridica' ? '#0f172a' : '#94a3b8', borderBottom: tipoPessoa === 'juridica' ? '3px solid #c5a059' : '3px solid transparent', transition: 'all 0.2s'}}
                onClick={() => setTipoPessoa('juridica')}
              >
                🏢 Pessoa Jurídica
              </button>
            </div>

            {tipoPessoa === 'fisica' ? (
              <>
                <h3 className="section-divider" style={{marginTop: 0}}>DADOS PESSOAIS</h3>
                <div className="form-grid-4">
                  <div className="form-group span-2"><label>NOME COMPLETO *</label><input type="text" name="nome" value={formData.nome} onChange={handleChange} required /></div>
                  <div className="form-group span-1"><label>CPF</label><input type="text" name="cpf" placeholder="000.000.000-00" value={formData.cpf} onChange={handleChange} /></div>
                  <div className="form-group span-1"><label>RG (OPCIONAL)</label><input type="text" name="rg" placeholder="00.000.000-0" value={formData.rg} onChange={handleChange} /></div>
                  <div className="form-group span-1"><label>NASCIMENTO</label><input type="date" name="nascimento" value={formData.nascimento} onChange={handleChange} /></div>
                  <div className="form-group span-1"><label>SEXO</label>
                    <select name="sexo" value={formData.sexo} onChange={handleChange}>
                      <option value="">Selecione...</option><option value="Feminino">Feminino</option><option value="Masculino">Masculino</option>
                    </select>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h3 className="section-divider" style={{marginTop: 0}}>DADOS DA EMPRESA</h3>
                <div className="form-grid-4">
                  <div className="form-group span-2"><label>RAZÃO SOCIAL</label><input type="text" name="razaoSocial" value={formData.razaoSocial} onChange={handleChange} /></div>
                  <div className="form-group span-2"><label>NOME FANTASIA *</label><input type="text" name="nomeFantasia" value={formData.nomeFantasia} onChange={handleChange} required /></div>
                  <div className="form-group span-1"><label>CNPJ</label><input type="text" name="cnpj" placeholder="00.000.000/0000-00" value={formData.cnpj} onChange={handleChange} /></div>
                  <div className="form-group span-1"><label>INSCRIÇÃO ESTADUAL</label><input type="text" name="inscricaoEstadual" value={formData.inscricaoEstadual} onChange={handleChange} /></div>
                  <div className="form-group span-1"><label>NOME DO CONTATO</label><input type="text" name="nomeContato" value={formData.nomeContato} onChange={handleChange} /></div>
                  <div className="form-group span-1"><label>CARGO / DEPTO</label><input type="text" name="cargo" value={formData.cargo} onChange={handleChange} /></div>
                </div>
              </>
            )}

            <h3 className="section-divider mt-compact">CONTATO E MARKETING</h3>
            <div className="form-grid-4">
              <div className="form-group span-1"><label>CELULAR / WHATSAPP</label><input type="tel" name="celular" placeholder="(00) 00000-0000" value={formData.celular} onChange={handleChange} /></div>
              <div className="form-group span-1"><label>TELEFONE FIXO</label><input type="tel" name="telefoneFixo" placeholder="(00) 0000-0000" value={formData.telefoneFixo} onChange={handleChange} /></div>
              <div className="form-group span-1"><label>E-MAIL</label><input type="email" name="email" value={formData.email} onChange={handleChange} /></div>
              <div className="form-group span-1"><label>COMO NOS CONHECEU?</label>
                <select name="origem" value={formData.origem} onChange={handleChange}>
                  <option value="">Selecione...</option>
                  <option value="Instagram">Instagram</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Pesquisa Google">Pesquisa no Google</option>
                  <option value="Indicação">Indicação</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
            </div>

            <h3 className="section-divider mt-compact">ENDEREÇO</h3>
            <div className="form-grid-4">
              <div className="form-group span-1"><label>CEP (BUSCA AUTO)</label><input type="text" name="cep" placeholder="00000-000" maxLength="9" value={formData.cep} onChange={buscarCep} /></div>
              <div className="form-group span-2"><label>LOGRADOURO</label><input type="text" name="logradouro" value={formData.logradouro} onChange={handleChange} /></div>
              <div className="form-group span-1"><label>NÚMERO</label><input type="text" id="numeroInput" name="numero" value={formData.numero} onChange={handleChange} /></div>
              <div className="form-group span-1"><label>BAIRRO</label><input type="text" name="bairro" value={formData.bairro} onChange={handleChange} /></div>
              <div className="form-group span-1"><label>CIDADE</label><input type="text" name="cidade" value={formData.cidade} onChange={handleChange} /></div>
              <div className="form-group span-1"><label>UF</label><input type="text" name="uf" value={formData.uf} onChange={handleChange} /></div>
            </div>

            <h3 className="section-divider mt-compact">INFORMAÇÕES ADICIONAIS</h3>
            <div className="form-grid-4">
              
              {/* CAMPO SITUAÇÃO FINANCEIRA CORRIGIDO */}
              <div className="form-group span-1">
                <label style={{ color: formData.situacaoFinanceira === 'inadimplente' ? '#ef4444' : '#10b981', fontWeight: '800' }}>
                  SITUAÇÃO FINANCEIRA
                </label>
                <select 
                  name="situacaoFinanceira" 
                  value={formData.situacaoFinanceira} 
                  onChange={(e) => setFormData({...formData, situacaoFinanceira: e.target.value})}
                  style={{
                    borderColor: formData.situacaoFinanceira === 'inadimplente' ? '#ef4444' : '#10b981',
                    backgroundColor: formData.situacaoFinanceira === 'inadimplente' ? '#fef2f2' : '#f0fdf4',
                    color: formData.situacaoFinanceira === 'inadimplente' ? '#991b1b' : '#166534',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  <option value="adimplente">✅ Adimplente</option>
                  <option value="inadimplente">⚠️ Inadimplente</option>
                </select>
              </div>

              <div className="form-group span-3"><label>TAGS (CRM)</label><input type="text" name="tags" placeholder="Ex: VIP, Problemático" value={formData.tags} onChange={handleChange} /></div>
              <div className="form-group span-4"><label>OBSERVAÇÕES INTERNAS</label><textarea name="observacoes" rows="2" value={formData.observacoes} onChange={handleChange}></textarea></div>
            </div>

            <div className="form-actions mt-compact">
              <Link to="/clientes" className="btn-voltar">Cancelar</Link>
              <button type="submit" className="btn-salvar" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar Cliente'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CadastroCliente;