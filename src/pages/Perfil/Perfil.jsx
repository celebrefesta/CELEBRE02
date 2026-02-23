import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Perfil.css';
import { db } from '../../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

const Perfil = () => {
  const [dados, setDados] = useState({
    nome: 'Camila',
    sobrenome: 'Administradora',
    email: 'camila@agape.decoracoes.com',
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
    emailCobranca: 'camila@agape.decoracoes.com',
    proximoVencimento: ''
  });

  useEffect(() => {
    const fetchParametros = async () => {
      try {
        const ref = doc(db, 'sistema', 'parametros');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const p = snap.data();
          setEmpresa({ nome: p.nomeEmpresa || p.nome || '', logo: p.logoUrl || p.logo || '' });
          if (p.precoMensal) setAssinatura(prev => ({ ...prev, precoMensal: String(p.precoMensal).replace('.', ',') }));
        }
      } catch (e) { console.error('Erro ao buscar parâmetros do sistema', e); }
    };
    fetchParametros();
  }, []);

  const calcularPrecoAnual = () => {
    const mensal = Number(String(assinatura.precoMensal).replace(',', '.')) || 0;
    const anual = mensal * 12 * (1 - (assinatura.descontoAnual || 0) / 100);
    return anual.toFixed(2).replace('.', ',');
  };

  const handleSalvar = (e) => {
    e.preventDefault();
    alert('Dados do perfil atualizados com sucesso!');
  };

  return (
    <div className="perfil-page">
      <div className="perfil-header">
        <h1>Meu Perfil</h1>
        <p>Gerencie suas informações, dados da empresa e assinaturas.</p>
      </div>

      <div className="perfil-container">
        {/* Lado Esquerdo: Foto e Status */}
        <div className="perfil-sidebar">
          <div className="avatar-large">C</div>
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
              <label>E-mail</label>
              <input type="email" value={dados.email} onChange={(e) => setDados({...dados, email: e.target.value})} />
            </div>
          </section>

          <section className="form-section">
            <h3><i className="fas fa-building"></i> Dados da Empresa</h3>
            <div className="input-row">
              <div className="input-group">
                <label>Nome da Empresa</label>
                <input type="text" value={empresa.nome} readOnly />
              </div>
              <div className="input-group">
                <label>Logo</label>
                <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                  {empresa.logo ? <img src={empresa.logo} alt="logo" style={{height: 54, borderRadius: 6, border: '1px solid #e6e6e6'}} /> : <div style={{height:54,width:54,background:'#f3f4f6',borderRadius:6}} />}
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
                <input type="text" value={assinatura.status} readOnly />
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
              <label>Senha Atual</label>
              <input type="password" placeholder="********" />
            </div>
            <div className="input-row">
              <div className="input-group">
                <label>Nova Senha</label>
                <input type="password" />
              </div>
              <div className="input-group">
                <label>Confirmar Nova Senha</label>
                <input type="password" />
              </div>
            </div>
          </section>

          <button type="submit" className="btn-save-perfil">Salvar Alterações</button>
        </form>
      </div>
    </div>
  );
};

export default Perfil;
