import React, { useState, useEffect } from 'react';
import './Clientes.css';
import { db } from '../../firebaseConfig';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';

const Clientes = () => {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  
  // MODAIS
  const [modalAberto, setModalAberto] = useState(false);
  const [modalHistoricoAberto, setModalHistoricoAberto] = useState(false);
  const [clienteEditando, setClienteEditando] = useState(null);
  const [historicoCliente, setHistoricoCliente] = useState([]);
  
  // --- ESTADOS DO FORMULÁRIO COMPLETO ---
  const [tipoPessoa, setTipoPessoa] = useState('fisica'); // 'fisica' ou 'juridica'
  const [fotoBase64, setFotoBase64] = useState('');

  // Dados Pessoais (PF)
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [nascimento, setNascimento] = useState('');
  const [sexo, setSexo] = useState('');

  // Dados Empresariais (PJ)
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [ie, setIe] = useState(''); // Inscrição Estadual
  const [nomeContato, setNomeContato] = useState(''); // Quem responde pela empresa
  const [cargo, setCargo] = useState('');

  // Contato e Marketing
  const [celular, setCelular] = useState(''); // WhatsApp
  const [telefoneFixo, setTelefoneFixo] = useState('');
  const [email, setEmail] = useState('');
  const [origem, setOrigem] = useState('');

  // Endereço
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');

  // Outros
  const [tags, setTags] = useState('');
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => { carregarClientes(); }, []);

  const carregarClientes = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "clientes"));
      const lista = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      lista.sort((a, b) => (a.nome || a.nomeFantasia || '').localeCompare(b.nome || b.nomeFantasia || ''));
      setClientes(lista);
    } catch (error) { console.error("Erro:", error); } finally { setLoading(false); }
  };

  // --- BUSCA CEP AUTOMÁTICA ---
  const buscarCep = async (e) => {
    const cepDigitado = e.target.value.replace(/\D/g, '');
    setCep(cepDigitado);
    if (cepDigitado.length === 8) {
      try {
        const resposta = await fetch(`https://viacep.com.br/ws/${cepDigitado}/json/`);
        const dados = await resposta.json();
        if (!dados.erro) {
          setLogradouro(dados.logradouro);
          setBairro(dados.bairro);
          setCidade(dados.localidade);
          setUf(dados.uf);
          document.getElementById('numeroInput').focus(); // Foca no número
        }
      } catch (error) {
        console.error("Erro ao buscar CEP");
      }
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 800 * 1024) return alert("Imagem muito grande (máx 800kb)");
      const reader = new FileReader();
      reader.onloadend = () => setFotoBase64(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const gerarLinkZap = (numero) => {
    if (!numero) return null;
    return `https://wa.me/55${numero.replace(/\D/g, '')}`;
  };

  const salvarCliente = async (e) => {
    e.preventDefault();
    // Validação básica
    if (tipoPessoa === 'fisica' && !nome) return alert("Nome é obrigatório");
    if (tipoPessoa === 'juridica' && !nomeFantasia) return alert("Nome Fantasia é obrigatório");

    setLoading(true);
    try {
      const dados = {
        tipoPessoa, foto: fotoBase64,
        // PF
        nome, cpf, rg, nascimento, sexo,
        // PJ
        razaoSocial, nomeFantasia, cnpj, ie, nomeContato, cargo,
        // Contato
        celular, telefoneFixo, email, origem,
        // Endereço
        cep, logradouro, numero, complemento, bairro, cidade, uf,
        // Extras
        tags, observacoes,
        atualizadoEm: new Date().toISOString()
      };

      if (clienteEditando) {
        await updateDoc(doc(db, "clientes", clienteEditando.id), dados);
      } else {
        await addDoc(collection(db, "clientes"), { ...dados, criadoEm: new Date().toISOString() });
      }
      setModalAberto(false);
      carregarClientes();
    } catch (error) { alert("Erro ao salvar."); } finally { setLoading(false); }
  };

  const abrirModal = (c = null) => {
    setClienteEditando(c);
    if (c) {
      setTipoPessoa(c.tipoPessoa || 'fisica');
      setFotoBase64(c.foto || '');
      // PF
      setNome(c.nome || ''); setCpf(c.cpf || ''); setRg(c.rg || ''); setNascimento(c.nascimento || ''); setSexo(c.sexo || '');
      // PJ
      setRazaoSocial(c.razaoSocial || ''); setNomeFantasia(c.nomeFantasia || ''); setCnpj(c.cnpj || ''); setIe(c.ie || ''); setNomeContato(c.nomeContato || ''); setCargo(c.cargo || '');
      // Comuns
      setCelular(c.celular || c.telefone || ''); setTelefoneFixo(c.telefoneFixo || ''); setEmail(c.email || ''); setOrigem(c.origem || '');
      setCep(c.cep || ''); setLogradouro(c.logradouro || ''); setNumero(c.numero || ''); setComplemento(c.complemento || ''); setBairro(c.bairro || ''); setCidade(c.cidade || ''); setUf(c.uf || '');
      setTags(c.tags || ''); setObservacoes(c.observacoes || '');
    } else {
      // Limpar tudo para novo
      setTipoPessoa('fisica'); setFotoBase64('');
      setNome(''); setCpf(''); setRg(''); setNascimento(''); setSexo('');
      setRazaoSocial(''); setNomeFantasia(''); setCnpj(''); setIe(''); setNomeContato(''); setCargo('');
      setCelular(''); setTelefoneFixo(''); setEmail(''); setOrigem('');
      setCep(''); setLogradouro(''); setNumero(''); setComplemento(''); setBairro(''); setCidade(''); setUf('');
      setTags(''); setObservacoes('');
    }
    setModalAberto(true);
  };

  const excluirCliente = async (id) => {
    if (confirm("Excluir cliente?")) {
      await deleteDoc(doc(db, "clientes", id));
      carregarClientes();
    }
  };

  // Histórico (Mantido Simples)
  const verHistorico = async (cliente) => { /* ... Lógica igual ao anterior ... */ };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="header-text">
          <h1>CLIENTES</h1>
          <p>Gerencie sua base da Ágape Decorações</p>
        </div>
        <button className="btn-novo-cliente" onClick={() => abrirModal()}>+ Novo Cliente</button>
      </div>

      <div className="main-card">
        <div className="filter-bar">
          <input type="text" placeholder="🔍 Buscar por nome, empresa, CPF/CNPJ..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <table className="custom-table">
          <thead>
            <tr>
              <th width="35%">CLIENTE / EMPRESA</th>
              <th width="30%">CONTATO</th>
              <th width="20%">LOCALIZAÇÃO</th>
              <th width="15%" style={{textAlign:'center'}}>AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {clientes.filter(c => {
              const termo = busca.toLowerCase();
              return (c.nome && c.nome.toLowerCase().includes(termo)) || 
                     (c.nomeFantasia && c.nomeFantasia.toLowerCase().includes(termo));
            }).map(c => (
              <tr key={c.id}>
                <td>
                  <div className="user-info">
                    {c.foto ? <img src={c.foto} className="user-avatar-img" /> : <div className="user-avatar">{(c.nome || c.nomeFantasia || '?').charAt(0).toUpperCase()}</div>}
                    <div className="user-details">
                      <strong>{c.tipoPessoa === 'juridica' ? c.nomeFantasia : c.nome}</strong>
                      <span className="sub-detail">{c.tipoPessoa === 'juridica' ? `CNPJ: ${c.cnpj || '-'}` : `CPF: ${c.cpf || '-'}`}</span>
                      {c.tipoPessoa === 'juridica' && <span className="pj-badge">PJ</span>}
                    </div>
                  </div>
                </td>
                <td>
                  <div className="contact-info">
                    {c.celular ? <a href={gerarLinkZap(c.celular)} target="_blank" className="zap-link">📱 {c.celular}</a> : '-'}
                    <span className="email-text">✉️ {c.email || '-'}</span>
                  </div>
                </td>
                <td><span className="local-text">{c.cidade ? `${c.cidade}/${c.uf}` : '-'}</span></td>
                <td className="actions-cell">
                  <button className="icon-btn edit" onClick={() => abrirModal(c)}>✏️</button>
                  <button className="icon-btn delete" onClick={() => excluirCliente(c.id)}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalAberto && (
        <div className="modal-overlay">
          <div className="modal-card wide-modal">
            <div className="modal-header-tabs">
              <h3 style={{margin:0}}>Novo Cliente</h3>
              <div className="tabs">
                <button className={tipoPessoa === 'fisica' ? 'active' : ''} onClick={() => setTipoPessoa('fisica')}>Pessoa Física</button>
                <button className={tipoPessoa === 'juridica' ? 'active' : ''} onClick={() => setTipoPessoa('juridica')}>Pessoa Jurídica</button>
              </div>
            </div>

            <form onSubmit={salvarCliente} className="form-scroll">
              
              {/* FOTO CENTRALIZADA */}
              <div className="foto-upload-container">
                <label htmlFor="foto-input" className="foto-label">
                  {fotoBase64 ? <img src={fotoBase64} className="foto-preview" /> : <div className="foto-placeholder">📷</div>}
                  <span className="foto-texto">Alterar Foto</span>
                </label>
                <input id="foto-input" type="file" accept="image/*" onChange={handleFileChange} style={{display:'none'}} />
              </div>

              {/* SEÇÃO 1: DADOS PRINCIPAIS (Muda conforme a aba) */}
              <h4 className="section-title">{tipoPessoa === 'fisica' ? 'DADOS PESSOAIS' : 'DADOS DA EMPRESA'}</h4>
              
              {tipoPessoa === 'fisica' ? (
                <>
                  <div className="input-group"><label>Nome Completo *</label><input value={nome} onChange={e => setNome(e.target.value)} required /></div>
                  <div className="form-row three-cols">
                    <div className="input-group"><label>CPF</label><input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00"/></div>
                    <div className="input-group"><label>RG (Opcional)</label><input value={rg} onChange={e => setRg(e.target.value)} /></div>
                    <div className="input-group"><label>Nascimento</label><input type="date" value={nascimento} onChange={e => setNascimento(e.target.value)} /></div>
                  </div>
                  <div className="input-group"><label>Sexo</label>
                    <select value={sexo} onChange={e => setSexo(e.target.value)} className="custom-select">
                      <option value="">Selecione...</option>
                      <option value="Feminino">Feminino</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div className="input-group"><label>Razão Social</label><input value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} /></div>
                  <div className="input-group"><label>Nome Fantasia *</label><input value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)} required /></div>
                  <div className="form-row">
                    <div className="input-group"><label>CNPJ</label><input value={cnpj} onChange={e => setCnpj(e.target.value)} /></div>
                    <div className="input-group"><label>Inscrição Estadual</label><input value={ie} onChange={e => setIe(e.target.value)} /></div>
                  </div>
                  <h4 className="section-title">RESPONSÁVEL / CONTATO</h4>
                  <div className="form-row">
                    <div className="input-group"><label>Nome do Contato</label><input value={nomeContato} onChange={e => setNomeContato(e.target.value)} /></div>
                    <div className="input-group"><label>Cargo / Depto</label><input value={cargo} onChange={e => setCargo(e.target.value)} /></div>
                  </div>
                </>
              )}

              {/* SEÇÃO 2: CONTATO */}
              <h4 className="section-title">CONTATO E MARKETING</h4>
              <div className="form-row three-cols">
                <div className="input-group"><label>Celular / WhatsApp</label><input value={celular} onChange={e => setCelular(e.target.value)} /></div>
                <div className="input-group"><label>Telefone Fixo</label><input value={telefoneFixo} onChange={e => setTelefoneFixo(e.target.value)} /></div>
                <div className="input-group"><label>E-mail</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
              </div>
              <div className="input-group"><label>Como nos conheceu?</label>
                <select value={origem} onChange={e => setOrigem(e.target.value)} className="custom-select">
                  <option value="">Selecione...</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Google">Google</option>
                  <option value="Indicação">Indicação</option>
                </select>
              </div>

              {/* SEÇÃO 3: ENDEREÇO */}
              <h4 className="section-title">ENDEREÇO</h4>
              <div className="form-row">
                <div className="input-group" style={{maxWidth:'150px'}}><label>CEP (Busca Auto)</label><input value={cep} onChange={buscarCep} maxLength={9} placeholder="00000-000"/></div>
                <div className="input-group" style={{flex:1}}><label>Logradouro</label><input value={logradouro} onChange={e => setLogradouro(e.target.value)} /></div>
              </div>
              <div className="form-row three-cols">
                <div className="input-group"><label>Número</label><input id="numeroInput" value={numero} onChange={e => setNumero(e.target.value)} /></div>
                <div className="input-group" style={{flex:2}}><label>Complemento</label><input value={complemento} onChange={e => setComplemento(e.target.value)} /></div>
                <div className="input-group"><label>Bairro</label><input value={bairro} onChange={e => setBairro(e.target.value)} /></div>
              </div>
              <div className="form-row">
                <div className="input-group" style={{flex:3}}><label>Cidade</label><input value={cidade} onChange={e => setCidade(e.target.value)} /></div>
                <div className="input-group" style={{flex:1}}><label>UF</label><input value={uf} onChange={e => setUf(e.target.value)} /></div>
              </div>

              {/* SEÇÃO 4: EXTRAS */}
              <h4 className="section-title">INFORMAÇÕES ADICIONAIS</h4>
              <div className="input-group"><label>Tags (CRM)</label><input value={tags} onChange={e => setTags(e.target.value)} placeholder="Ex: VIP, Problemático, Corporativo" /></div>
              <div className="input-group"><label>Observações Internas</label><textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows="2"></textarea></div>

              <div className="modal-footer sticky-footer">
                <button type="button" className="btn-cancel" onClick={() => setModalAberto(false)}>Cancelar</button>
                <button type="submit" className="btn-save">Salvar Cliente</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default Clientes;