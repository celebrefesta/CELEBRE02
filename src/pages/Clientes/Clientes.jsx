import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './Clientes.css';
import { db } from '../../firebaseConfig';
import { collection, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';

const Clientes = () => {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const navigate = useNavigate();

  useEffect(() => { 
    carregarClientes(); 
  }, []);

  const carregarClientes = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "clientes"));
      const lista = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      lista.sort((a, b) => (a.nome || a.nomeFantasia || '').localeCompare(b.nome || b.nomeFantasia || ''));
      setClientes(lista);
    } catch (error) { 
      console.error("Erro ao carregar clientes:", error); 
    } finally { 
      setLoading(false); 
    }
  };

  const excluirCliente = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir este cliente definitivamente?")) {
      try {
        await deleteDoc(doc(db, "clientes", id));
        carregarClientes(); 
      } catch (error) {
        alert("Erro ao excluir o cliente.");
      }
    }
  };

  const gerarLinkZap = (numero) => {
    if (!numero) return null;
    return `https://wa.me/55${numero.replace(/\D/g, '')}`;
  };

  const editarCliente = (cliente) => {
    navigate('/cadastro-cliente', { state: { clienteEditando: cliente } });
  };

  // Função rápida para mudar a situação direto da tabela
  const alternarSituacaoFinanceira = async (cliente) => {
    const novaSituacao = cliente.situacaoFinanceira === 'inadimplente' ? 'adimplente' : 'inadimplente';
    if (window.confirm(`Mudar a situação deste cliente para ${novaSituacao.toUpperCase()}?`)) {
      try {
        await updateDoc(doc(db, "clientes", cliente.id), { situacaoFinanceira: novaSituacao });
        carregarClientes();
      } catch (error) {
        alert("Erro ao atualizar situação.");
      }
    }
  };

  // --- INTELIGÊNCIA DOS CARDS (NOVOS E ANIVERSARIANTES) ---
  const dataAtual = new Date();
  const mesAtual = dataAtual.getMonth();
  const anoAtual = dataAtual.getFullYear();
  const mesAtualStr = String(mesAtual + 1).padStart(2, '0');

  const clientesNovosMes = clientes.filter(c => {
    if (!c.criadoEm) return false;
    const dataCriacao = new Date(c.criadoEm);
    return dataCriacao.getMonth() === mesAtual && dataCriacao.getFullYear() === anoAtual;
  }).length;

  const aniversariantesMes = clientes.filter(c => {
    if (!c.nascimento) return false;
    const mesNasc = c.nascimento.split('-')[1]; 
    return mesNasc === mesAtualStr;
  }).length;

  return (
    <div className="dashboard-container">
      
      {/* --- CABEÇALHO --- */}
      <div className="dashboard-header">
        <div className="header-text">
          <h1>MEUS CLIENTES</h1>
          <p>Gerencie sua carteira de clientes e contatos.</p>
        </div>
        <Link to="/cadastro-cliente" className="btn-novo-cliente">
          + Novo Cliente
        </Link>
      </div>

      {/* --- CARDS DE ESTATÍSTICAS --- */}
      <div className="stats-row">
        <div className="card-stat">
          <span className="label-stat">TOTAL DE CLIENTES</span>
          <div className="value-stat">{clientes.length}</div>
          <div className="icon-stat">👥</div>
        </div>
        
        <div className="card-stat">
          <span className="label-stat">NOVOS (ESTE MÊS)</span>
          <div className="value-stat" style={{color: '#3b82f6'}}>{clientesNovosMes}</div>
          <div className="icon-stat">🌟</div>
        </div>

        <div className="card-stat">
          <span className="label-stat">ANIVERSARIANTES (MÊS)</span>
          <div className="value-stat" style={{color: '#d946ef'}}>{aniversariantesMes}</div>
          <div className="icon-stat">🎂</div>
        </div>
        
        <div className="card-stat">
          <span className="label-stat">COM WHATSAPP</span>
          <div className="value-stat text-green">{clientes.filter(c => c.celular && c.celular.length > 8).length}</div>
          <div className="icon-stat">📱</div>
        </div>
      </div>

      <div className="main-card">
        
        {/* --- BARRA DE BUSCA PREMIUM --- */}
        <div className="filter-wrapper">
          <input 
            className="search-input" 
            placeholder="Buscar por nome, empresa, CPF/CNPJ..." 
            value={busca} 
            onChange={e => setBusca(e.target.value)} 
          />
          <div className="filter-controls">
            <button className="btn-filter">🔍 Filtrar</button>
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontWeight: 'bold' }}>Carregando clientes...</p>
        ) : (
          <div className="table-container">
            <table className="custom-table table-pro">
              <thead>
                <tr>
                  <th width="35%">CLIENTE / EMPRESA</th>
                  <th>CONTATO</th>
                  {/* INVERTIDO AQUI: LOCALIZAÇÃO VEM ANTES DA SITUAÇÃO */}
                  <th>LOCALIZAÇÃO</th>
                  <th style={{ textAlign: 'center' }}>SITUAÇÃO</th>
                  <th style={{ textAlign: 'right' }}>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {clientes.filter(c => {
                  const termo = busca.toLowerCase();
                  return (c.nome && c.nome.toLowerCase().includes(termo)) || 
                         (c.nomeFantasia && c.nomeFantasia.toLowerCase().includes(termo)) ||
                         (c.cpf && c.cpf.includes(termo)) ||
                         (c.cnpj && c.cnpj.includes(termo));
                }).map(c => {
                  
                  // Lógica para definir a situação (se não tiver, é adimplente por padrão)
                  const isAdimplente = c.situacaoFinanceira !== 'inadimplente';

                  return (
                  <tr key={c.id}>
                    
                    {/* COLUNA 1: FOTO E NOME */}
                    <td className="user-info">
                      {c.foto ? (
                        <img src={c.foto} alt="Avatar" className="user-avatar-img" style={{ objectPosition: c.posicaoFoto ? `${c.posicaoFoto.x}% ${c.posicaoFoto.y}%` : '50% 50%' }} />
                      ) : (
                        <div className="user-avatar">
                          {(c.nome || c.nomeFantasia || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="user-details">
                        <strong>
                          {c.tipoPessoa === 'juridica' ? c.nomeFantasia : c.nome}
                          {/* Coloca um icone discreto de prédio se for PJ */}
                          {c.tipoPessoa === 'juridica' && <span style={{fontSize:'12px', marginLeft:'5px'}} title="Empresa">🏢</span>}
                        </strong>
                        <span className="sub-detail" style={{color: '#64748b', fontSize: '11px', marginTop: '2px'}}>
                          {c.tipoPessoa === 'juridica' ? `CNPJ: ${c.cnpj || '-'}` : `CPF: ${c.cpf || '-'}`}
                        </span>
                      </div>
                    </td>

                    {/* COLUNA 2: CONTATOS */}
                    <td className="contact-info">
                      <div style={{fontWeight: 'bold', color: '#0f172a'}}>
                        {c.celular ? <a href={gerarLinkZap(c.celular)} target="_blank" rel="noreferrer" style={{color: '#10b981', textDecoration: 'none'}}>📱 {c.celular}</a> : '-'}
                      </div>
                      <div className="email-text" style={{fontSize: '12px', color: '#64748b', marginTop: '4px'}}>
                        ✉️ {c.email || 'Sem e-mail'}
                      </div>
                    </td>

                    {/* COLUNA 3: LOCALIZAÇÃO (MOVIDA PARA CÁ) */}
                    <td className="local-text" style={{color: '#475569', fontSize: '13px', fontWeight: '500'}}>
                      📍 {c.cidade ? `${c.cidade}/${c.uf}` : 'Não informada'}
                    </td>

                    {/* COLUNA 4: SITUAÇÃO FINANCEIRA (MOVIDA PARA CÁ) */}
                    <td style={{ textAlign: 'center' }}>
                      <span 
                        onClick={() => alternarSituacaoFinanceira(c)}
                        style={{
                          cursor: 'pointer',
                          display: 'inline-block',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: '800',
                          letterSpacing: '0.5px',
                          backgroundColor: isAdimplente ? '#dcfce7' : '#fee2e2',
                          color: isAdimplente ? '#166534' : '#991b1b',
                          transition: 'all 0.2s',
                          border: isAdimplente ? '1px solid #bbf7d0' : '1px solid #fecaca'
                        }}
                        title="Clique para alterar a situação"
                      >
                        {isAdimplente ? '✅ ADIMPLENTE' : '⚠️ INADIMPLENTE'}
                      </span>
                    </td>

                    {/* COLUNA 5: AÇÕES */}
                    <td style={{ textAlign: 'right' }}>
                      <button onClick={() => editarCliente(c)} className="action-icon" title="Editar">✏️</button>
                      <button onClick={() => excluirCliente(c.id)} className="action-icon delete" title="Excluir">🗑️</button>
                    </td>

                  </tr>
                )})}
                {clientes.length === 0 && !loading && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Clientes;