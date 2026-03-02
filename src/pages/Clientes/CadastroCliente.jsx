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
        razaoSocial: clienteEditando.razaoSocial || '', nomeFantasia: clienteEditando.nomeFantasia || '', cnpj: clienteEditando.cnpj || '', inscricaoEstadual: clienteEditando.inscricaoEstadual || '',
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

  // --- LÓGICA DE ARRASTAR CORRIGIDA (MOUSE + TOUCH) ---
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
    <div className="form-page-container">
      <div className="form-page-header">
        <div className="header-text">
          <h1 className="form-page-title">{clienteEditando ? 'EDITAR CLIENTE' : 'NOVO CLIENTE'}</h1>
          <p className="form-page-subtitle">Preencha os dados de contato e faturamento</p>
        </div>
      </div>

      <div className="form-widescreen">
        <form onSubmit={salvarCliente} className="estoque-form-layout">
          
          {/* FOTO CENTRALIZADA */}
          <div className="left-photo-col centralizado">
            <h3 className="section-divider" style={{marginTop: 0}}>FOTO / LOGO</h3>
            
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
              <div className="form-group span-2"><label>E-MAIL</label><input type="email" name="email" value={formData.email} onChange={handleChange} /></div>
              <div className="form-group span-2"><label>COMO NOS CONHECEU?</label>
                <select name="origem" value={formData.origem} onChange={handleChange}>
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
              <div className="form-group span-2"><label>CEP (BUSCA AUTO)</label><input type="text" name="cep" placeholder="00000-000" maxLength="9" value={formData.cep} onChange={buscarCep} /></div>
              <div className="form-group span-2"><label>LOGRADOURO</label><input type="text" name="logradouro" value={formData.logradouro} onChange={handleChange} /></div>
              
              <div className="form-group-row span-4">
                <div className="form-group flex-1">
                  <label>NÚMERO</label>
                  <input type="text" id="numeroInput" name="numero" value={formData.numero} onChange={handleChange} />
                </div>
                <div className="form-group flex-small">
                  <label>UF</label>
                  <input type="text" name="uf" value={formData.uf} onChange={handleChange} />
                </div>
              </div>

              <div className="form-group span-2"><label>BAIRRO</label><input type="text" name="bairro" value={formData.bairro} onChange={handleChange} /></div>
              <div className="form-group span-2"><label>CIDADE</label><input type="text" name="cidade" value={formData.cidade} onChange={handleChange} /></div>
            </div>

            <h3 className="section-divider mt-compact">INFORMAÇÕES ADICIONAIS</h3>
            <div className="form-grid-4">
              
              {/* 🔥 AQUI ENTRA A MÁGICA DO PENDENTE E AS CORES 🔥 */}
              <div className="form-group span-1">
                <label style={{ 
                  color: formData.situacaoFinanceira === 'inadimplente' ? '#ef4444' : 
                         formData.situacaoFinanceira === 'pendente' ? '#d97706' : '#10b981', 
                  fontWeight: '800' 
                }}>
                  SITUAÇÃO FINANCEIRA
                </label>
                <select 
                  name="situacaoFinanceira" 
                  value={formData.situacaoFinanceira} 
                  onChange={(e) => setFormData({...formData, situacaoFinanceira: e.target.value})}
                  className={`status-select ${formData.situacaoFinanceira}`}
                  style={{
                    backgroundColor: formData.situacaoFinanceira === 'pendente' ? '#fef3c7' : 
                                     formData.situacaoFinanceira === 'inadimplente' ? '#fef2f2' : '#f0fdf4',
                    color: formData.situacaoFinanceira === 'pendente' ? '#d97706' : 
                           formData.situacaoFinanceira === 'inadimplente' ? '#ef4444' : '#10b981',
                    border: formData.situacaoFinanceira === 'pendente' ? '1px solid #fcd34d' : '1px solid transparent'
                  }}
                >
                  <option value="adimplente">✅ Adimplente (Liberado)</option>
                  <option value="pendente">⏳ Pendente (Site)</option>
                  <option value="inadimplente">⚠️ Inadimplente</option>
                </select>
              </div>

              <div className="form-group span-3"><label>TAGS (CRM)</label><input type="text" name="tags" placeholder="Ex: VIP, Problemático" value={formData.tags} onChange={handleChange} /></div>
              <div className="form-group span-4"><label>OBSERVAÇÕES INTERNAS</label><textarea name="observacoes" rows="2" value={formData.observacoes} onChange={handleChange}></textarea></div>
            </div>

            <div className="form-actions mt-compact">
              <Link to="/clientes" className="btn-voltar-link">Cancelar</Link>
              <button type="submit" className="btn-salvar-form" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar Cliente'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CadastroCliente;