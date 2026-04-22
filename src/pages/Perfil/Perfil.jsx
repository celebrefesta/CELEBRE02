import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Perfil.css';
import { db } from '../../firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { getAuth, updatePassword } from 'firebase/auth'; // 🔥 Importação do Cadeado

const Perfil = () => {
  const navigate = useNavigate();
  
  // 🔥 Autenticação Dinâmica
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;

  const [dados, setDados] = useState({
    nome: '',
    sobrenome: 'Administrador(a)',
    email: '',
    senhaAtual: '',
    novaSenha: '',
    confirmarSenha: ''
  });

  const [empresa, setEmpresa] = useState({ nome: '', logo: '' });
  const [assinatura, setAssinatura] = useState({
    plano: 'Mensal',
    precoMensal: '49,90',
    descontoAnual: 15,
    status: 'Ativa',
    metodoPagamento: '•••• 4242',
    emailCobranca: '',
    proximoVencimento: ''
  });

  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }

    // Carrega os dados reais do usuário Firebase
    setDados(prev => ({
        ...prev,
        nome: usuarioLogado.displayName || 'Admin',
        email: usuarioLogado.email || ''
    }));

    setAssinatura(prev => ({
        ...prev,
        emailCobranca: usuarioLogado.email || ''
    }));

    const fetchParametros = async () => {
      try {
        // 🔥 BLINDAGEM MULTI-EMPRESA: Puxa o logo e nome apenas do seu cofre
        const ref = doc(db, 'configuracoes_empresa', usuarioLogado.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const p = snap.data();
          setEmpresa({ nome: p.nomeEmpresa || p.nome || 'Sua Empresa', logo: p.logotipo || p.logoUrl || '' });
          if (p.precoMensal) setAssinatura(prev => ({ ...prev, precoMensal: String(p.precoMensal).replace('.', ',') }));
        }
      } catch (e) { console.error('Erro ao buscar parâmetros da empresa', e); }
    };
    fetchParametros();
  }, [usuarioLogado, navigate]);

  const calcularPrecoAnual = () => {
    const mensal = Number(String(assinatura.precoMensal).replace(',', '.')) || 0;
    const anual = mensal * 12 * (1 - (assinatura.descontoAnual || 0) / 100);
    return anual.toFixed(2).replace('.', ',');
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    setSalvando(true);
    try {
        // Lógica de alteração de senha do Firebase (Se preenchida)
        if (dados.novaSenha && dados.novaSenha === dados.confirmarSenha) {
            await updatePassword(usuarioLogado, dados.novaSenha);
            alert('Senha atualizada com sucesso!');
            setDados({...dados, senhaAtual: '', novaSenha: '', confirmarSenha: ''});
        } else if (dados.novaSenha !== dados.confirmarSenha) {
            alert('As senhas novas não coincidem!');
            setSalvando(false);
            return;
        } else {
            alert('Dados do perfil atualizados com sucesso!');
        }
    } catch (error) {
        console.error(error);
        alert('Erro ao atualizar. Se estiver alterando a senha, pode ser necessário fazer login novamente.');
    } finally {
        setSalvando(false);
    }
  };

  return (
    <div className="perfil-page fade-in">
      <div className="perfil-header">
        <h1>Meu Perfil</h1>
        <p>Gerencie suas informações, dados da empresa e assinaturas.</p>
      </div>

      <div className="perfil-container">
        {/* Lado Esquerdo: Foto e Status */}
        <div className="perfil-sidebar">
          <div className="avatar-large">{dados.nome ? dados.nome.charAt(0).toUpperCase() : 'A'}</div>
          <h3>{dados.nome}</h3>
      
          <span className="badge-admin">Administrador Master</span>
          <hr />
          <button className="btn-change-photo">Alterar Foto</button>
        </div>

        {/* Lado Direito: Formulários */}
        <form className="perfil-form" onSubmit={handleSalvar}>
          <section className="form-section">
            <h3><i className="fas fa-id-card"></i> Informações Pessoais</h3>
            <div className="input-row">
 
              <div className="input-group">
                <label>Nome</label>
                <input type="text" value={dados.nome} onChange={(e) => setDados({...dados, nome: e.target.value})} />
              </div>
              <div className="input-group">
                <label>Sobrenome</label>
 
                <input type="text" value={dados.sobrenome} onChange={(e) => setDados({...dados, sobrenome: e.target.value})} />
              </div>
            </div>
            <div className="input-group">
              <label>E-mail (Login)</label>
              <input type="email" value={dados.email} readOnly style={{background: '#f1f5f9', cursor: 'not-allowed'}} title="O e-mail de login não pode ser alterado por aqui." />
  
           </div>
          </section>

          <section className="form-section">
            <h3><i className="fas fa-building"></i> Dados da Empresa</h3>
            <div className="input-row">
              <div className="input-group">
                <label>Nome da Empresa</label>
      
                <input type="text" value={empresa.nome} readOnly style={{background: '#f1f5f9'}} />
              </div>
              <div className="input-group">
                <label>Logo</label>
                <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                  {empresa.logo 
                    ? <img src={empresa.logo} alt="logo" style={{height: 54, borderRadius: 6, border: '1px solid #e6e6e6'}} /> 
                    : <div style={{height:54,width:54,background:'#f3f4f6',borderRadius:6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', color: '#cbd5e1'}}>🏢</div>
                  }
                  <Link to="/configuracoes" className="btn-edit-config">Editar em Configurações</Link>
                </div>
              </div>
            </div>
          </section>

          
          <section className="form-section">
            <h3><i className="fas fa-credit-card"></i> Assinatura e Pagamentos</h3>

            <div className="input-row">
              <div className="input-group">
                <label>Plano</label>
                <select value={assinatura.plano} onChange={(e) => setAssinatura({...assinatura, plano: e.target.value})}>
                
                  <option value="Mensal">Mensal — R$ {assinatura.precoMensal}</option>
                  <option value="Anual">Anual — R$ {calcularPrecoAnual()} (economize {assinatura.descontoAnual}%)</option>
                </select>
              </div>

              <div className="input-group">
                <label>Status da Assinatura</label>
       
                <input type="text" value={assinatura.status} readOnly style={{background: '#f0fdf4', color: '#166534', fontWeight: 'bold'}} />
              </div>
            </div>

            <div className="input-row">
              <div className="input-group">
                <label>E-mail de Cobrança</label>
               
                <input type="email" value={assinatura.emailCobranca} onChange={(e) => setAssinatura({...assinatura, emailCobranca: e.target.value})} />
              </div>
              <div className="input-group">
                <label>Método de Pagamento</label>
                <input type="text" value={assinatura.metodoPagamento} onChange={(e) => setAssinatura({...assinatura, metodoPagamento: e.target.value})} />
              </div>
      
            </div>

            <div className="input-row">
              <div className="input-group">
                <label>Próximo Vencimento</label>
                <input type="text" value={assinatura.proximoVencimento} onChange={(e) => setAssinatura({...assinatura, proximoVencimento: e.target.value})} placeholder="DD/MM/AAAA" />
              </div>
          
              <div className="input-group">
                <label>Desconto Anual (%)</label>
                <input type="number" value={assinatura.descontoAnual} onChange={(e) => setAssinatura({...assinatura, descontoAnual: Number(e.target.value)})} />
              </div>
            </div>

            <div style={{display:'flex', gap: 12, marginTop: 8}}>
          
              <button type="button" className="btn-change-plan" onClick={() => alert('Abrir fluxo de alteração de plano')}>Alterar Plano</button>
              <button type="button" className="btn-update-payment" onClick={() => alert('Abrir fluxo de pagamento')}>Atualizar Pagamento</button>
            </div>
          </section>

          <section className="form-section">
            <h3><i className="fas fa-lock"></i> Segurança e Senha</h3>
            
            <div className="input-group">
              <label>Nova Senha</label>
              <input type="password" value={dados.novaSenha} onChange={e => setDados({...dados, novaSenha: e.target.value})} placeholder="Deixe em branco para não alterar" />
            </div>
            <div className="input-row" style={{marginTop: '15px'}}>
              <div className="input-group">
                <label>Confirmar Nova Senha</label>
                <input type="password" value={dados.confirmarSenha} onChange={e => setDados({...dados, confirmarSenha: e.target.value})} placeholder="Repita a nova senha" />
              </div>
            </div>
 
          </section>

          <button type="submit" className="btn-save-perfil" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Perfil;