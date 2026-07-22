import React, { useState, useEffect } from 'react';
import { 
  sendPasswordResetEmail, 
  verifyBeforeUpdateEmail,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { db, auth } from '../../firebaseConfig';
import { collection, query, where, getDocs, orderBy, limit, doc, updateDoc } from 'firebase/firestore';

const AbaSeguranca = ({ usuarioLogado, registrarLog }) => {
  const [enviandoReset, setEnviandoReset] = useState(false);
  const [resetEnviadoComSucesso, setResetEnviadoComSucesso] = useState(false);

  // ✉️ ESTADOS DO MODAL DE TROCA DE EMAIL VIA LINK DE EMAIL
  const [modalEmailAberto, setModalEmailAberto] = useState(false);
  const [novoEmail, setNovoEmail] = useState('');
  const [senhaConfirmar, setSenhaConfirmar] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [enviandoEmailTroca, setEnviandoEmailTroca] = useState(false);
  const [emailTrocaSucesso, setEmailTrocaSucesso] = useState(false);

  // 📜 LOGS DE AUDITORIA
  const [logsAuditoria, setLogsAuditoria] = useState([]);
  const [carregandoLogs, setCarregandoLogs] = useState(true);

  // Carregar histórico de logs da empresa
  const carregarLogsAuditoria = async () => {
    if (!usuarioLogado) return;
    setCarregandoLogs(true);
    try {
      const tenantId = localStorage.getItem('tenantId') || usuarioLogado.uid;
      const q = query(
        collection(db, "logs_atividades"),
        where("empresaId", "==", tenantId),
        limit(50)
      );
      const snap = await getDocs(q);
      const lista = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        const acaoUpper = (data.acao || '').toUpperCase();
        // 🚫 Ignora registros de LOGIN e LOGOUT (pois já possuem módulo de monitoramento próprio)
        if (acaoUpper !== 'LOGIN' && acaoUpper !== 'LOGOUT') {
          lista.push({ id: docSnap.id, ...data });
        }
      });
      lista.sort((a, b) => new Date(b.criadoEm || b.dataHora || 0) - new Date(a.criadoEm || a.dataHora || 0));
      setLogsAuditoria(lista.slice(0, 8));
    } catch (e) {
      console.error("Erro ao carregar logs de auditoria:", e);
    } finally {
      setCarregandoLogs(false);
    }
  };

  useEffect(() => {
    carregarLogsAuditoria();
  }, [usuarioLogado]);

  // 🔑 SOLICITAR REDEFINIÇÃO DE SENHA VIA EMAIL SEGURO
  const handleSolicitarResetSenha = async () => {
    if (!usuarioLogado?.email) return;
    setEnviandoReset(true);
    setResetEnviadoComSucesso(false);
    try {
      auth.languageCode = 'pt-BR';
      const actionCodeSettings = {
        url: window.location.origin + '/redefinir-senha',
        handleCodeInApp: true
      };

      await sendPasswordResetEmail(auth, usuarioLogado.email, actionCodeSettings);
      
      if (registrarLog) {
        await registrarLog("REDEFINIÇÃO DE SENHA POR EMAIL", `Link de redefinição enviado para ${usuarioLogado.email}`);
      }
      
      setResetEnviadoComSucesso(true);
      carregarLogsAuditoria();
    } catch (e) {
      console.error("Erro ao enviar e-mail de redefinição com URL própria, usando padrão:", e);
      try {
        await sendPasswordResetEmail(auth, usuarioLogado.email);
        setResetEnviadoComSucesso(true);
      } catch (errFallback) {
        alert("❌ Ocorreu um erro ao enviar o e-mail: " + (errFallback.message || "Tente novamente."));
      }
    } finally {
      setEnviandoReset(false);
    }
  };

  // ✉️ SOLICITAR ALTERAÇÃO DE EMAIL VIA EMAIL SEGURO
  const handleSolicitarAlteracaoEmail = async (e) => {
    e.preventDefault();
    if (!novoEmail || !novoEmail.trim()) {
      return alert("⚠️ Por favor, digite o novo e-mail de acesso.");
    }
    if (!senhaConfirmar) {
      return alert("⚠️ Digite sua senha atual para autorizar o envio do e-mail.");
    }

    if (novoEmail.trim().toLowerCase() === (usuarioLogado?.email || '').toLowerCase()) {
      return alert("⚠️ O novo e-mail informado é idêntico ao e-mail atual.");
    }

    setEnviandoEmailTroca(true);
    setEmailTrocaSucesso(false);
    try {
      // 1. Reautenticar por segurança para o Firebase liberar o envio
      const credential = EmailAuthProvider.credential(usuarioLogado.email, senhaConfirmar);
      try {
        await reauthenticateWithCredential(usuarioLogado, credential);
      } catch (authErr) {
        setEnviandoEmailTroca(false);
        return alert("❌ Senha atual incorreta. A solicitação foi cancelada.");
      }

      auth.languageCode = 'pt-BR';
      const actionCodeSettings = {
        url: window.location.origin + '/confirmar-email',
        handleCodeInApp: true
      };

      // 2. Disparar e-mail de verificação para o NOVO e-mail
      await verifyBeforeUpdateEmail(usuarioLogado, novoEmail.trim(), actionCodeSettings);

      const userRef = doc(db, "usuarios", usuarioLogado.uid);
      await updateDoc(userRef, { emailPendente: novoEmail.trim() });

      if (registrarLog) {
        await registrarLog("SOLICITAÇÃO DE ALTERAÇÃO DE EMAIL", `Link enviado para ${novoEmail.trim()}`);
      }

      setEmailTrocaSucesso(true);
      carregarLogsAuditoria();
    } catch (e) {
      console.error("Erro ao enviar e-mail de alteração de e-mail:", e);
      if (e.code === 'auth/email-already-in-use') {
        alert("❌ Este e-mail já está sendo utilizado em outra conta.");
      } else if (e.code === 'auth/wrong-password') {
        alert("❌ Senha atual incorreta.");
      } else {
        alert("Erro ao enviar e-mail: " + (e.message || "Tente novamente mais tarde."));
      }
    } finally {
      setEnviandoEmailTroca(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>

      {/* BANNER DE INFORMAÇÃO DE SEGURANÇA */}
      <div className="config-card" style={{ margin: 0 }}>
        <div className="card-top-bar blue-bar"></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>
              <i className="fas fa-shield-alt"></i>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--texto-principal)' }}>
                  Central de Segurança & Credenciais
                </h3>
                <span style={{ fontSize: '11px', background: '#d1fae5', color: '#047857', border: '1px solid #6ee7b7', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>
                  ✓ CONTA PROTEGIDA
                </span>
              </div>
              <p className="subtext" style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
                Gerencie a redefinição de senha e alteração de e-mail da sua conta via e-mail seguro.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* GRID DE CARDS PRINCIPAIS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '25px' }}>

        {/* CARD 1: TROCAR SENHA POR E-MAIL SEGURO */}
        <div className="config-card" style={{ margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="card-top-bar blue-bar"></div>
            <div className="config-card-header" style={{ marginBottom: '16px' }}>
              <div className="card-header-icon blue">
                <i className="fas fa-key"></i>
              </div>
              <div>
                <h3>Trocar / Redefinir Senha</h3>
                <p className="subtext">Receba um e-mail seguro com o link direto para redefinir sua senha.</p>
              </div>
            </div>

            <div style={{ background: 'var(--fundo-cinza)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '14px', marginBottom: '20px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--texto-secundario)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                E-MAIL DESTINO DA REDEFINIÇÃO:
              </span>
              <strong style={{ fontSize: '14px', color: 'var(--texto-principal)', wordBreak: 'break-all' }}>
                📧 {usuarioLogado?.email}
              </strong>
            </div>

            {resetEnviadoComSucesso && (
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1.5px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', padding: '14px', marginBottom: '20px' }}>
                <strong style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                  <i className="fas fa-paper-plane"></i> E-mail enviado com sucesso!
                </strong>
                <p style={{ margin: '6px 0 0 0', fontSize: '12.5px', color: '#10b981', lineHeight: '1.45' }}>
                  Enviamos o link seguro para <strong>{usuarioLogado?.email}</strong>.<br/>
                  Verifique a <strong>Caixa de Entrada</strong> e a pasta de <strong>Spam</strong>.
                </p>
              </div>
            )}
          </div>

          <button 
            type="button" 
            onClick={handleSolicitarResetSenha}
            disabled={enviandoReset}
            style={{
              width: '100%',
              background: 'var(--dourado)',
              color: 'white',
              border: 'none',
              padding: '14px',
              borderRadius: '10px',
              fontWeight: 800,
              fontSize: '13.5px',
              cursor: enviandoReset ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
          >
            {enviandoReset ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-envelope"></i>}
            {enviandoReset ? 'ENVIANDO LINK SEGURO...' : 'ENVIAR LINK PARA TROCAR SENHA POR E-MAIL'}
          </button>
        </div>

        {/* CARD 2: ALTERAR E-MAIL VIA E-MAIL SEGURO */}
        <div className="config-card" style={{ margin: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="card-top-bar purple-bar"></div>
            <div className="config-card-header" style={{ marginBottom: '16px' }}>
              <div className="card-header-icon purple">
                <i className="fas fa-at"></i>
              </div>
              <div>
                <h3>Alterar E-mail de Login</h3>
                <p className="subtext">Receba um e-mail de confirmação no novo endereço para aprovar a troca.</p>
              </div>
            </div>

            <div style={{ background: 'var(--fundo-cinza)', border: '1px solid var(--borda)', borderRadius: '10px', padding: '14px', marginBottom: '20px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--texto-secundario)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                E-MAIL ATUAL DE ACESSO:
              </span>
              <strong style={{ fontSize: '14px', color: 'var(--texto-principal)', wordBreak: 'break-all' }}>
                👤 {usuarioLogado?.email}
              </strong>
            </div>

            <p style={{ fontSize: '12.5px', color: 'var(--texto-secundario)', margin: '0 0 20px 0', lineHeight: '1.45' }}>
              Ao solicitar a troca, enviaremos um e-mail com o link de confirmação para o novo endereço.
            </p>
          </div>

          <button 
            type="button" 
            onClick={() => { setNovoEmail(''); setSenhaConfirmar(''); setEmailTrocaSucesso(false); setModalEmailAberto(true); }}
            style={{
              width: '100%',
              background: 'var(--fundo-cinza)',
              color: 'var(--texto-principal)',
              border: '1.5px solid var(--borda)',
              padding: '14px',
              borderRadius: '10px',
              fontWeight: 800,
              fontSize: '13.5px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            <i className="fas fa-paper-plane"></i> SOLICITAR TROCA DE E-MAIL POR E-MAIL
          </button>
        </div>

        {/* CARD 3: HISTÓRICO DE AUDITORIA */}
        <div className="config-card" style={{ margin: 0 }}>
          <div className="card-top-bar gold-bar"></div>
          <div className="config-card-header" style={{ marginBottom: '15px' }}>
            <div className="card-header-icon gold">
              <i className="fas fa-history"></i>
            </div>
            <div>
              <h3>Histórico de Segurança</h3>
              <p className="subtext">Registro em tempo real de solicitações.</p>
            </div>
          </div>

          {carregandoLogs ? (
            <div style={{ textAlign: 'center', padding: '25px', color: 'var(--texto-secundario)' }}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: '18px', marginBottom: '6px', display: 'block' }}></i>
              Carregando histórico...
            </div>
          ) : logsAuditoria.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '25px', color: 'var(--texto-secundario)', fontStyle: 'italic', fontSize: '12.5px' }}>
              Nenhuma atividade registrada ainda.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
              {logsAuditoria.map(log => {
                const dataFormatada = log.dataHora ? new Date(log.dataHora).toLocaleString('pt-BR') : 'Data n/a';
                return (
                  <div key={log.id} style={{ background: 'var(--fundo-cinza)', border: '1px solid var(--borda)', padding: '8px 12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '11.5px', color: 'var(--texto-principal)', display: 'block' }}>
                        {log.acao || 'AÇÃO'}
                      </strong>
                      <span style={{ fontSize: '11px', color: 'var(--texto-secundario)' }}>
                        {log.detalhes || log.nomeFuncionario || 'Operação no sistema'}
                      </span>
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--texto-secundario)', fontWeight: 600, flexShrink: 0, marginLeft: '8px' }}>
                      🕒 {dataFormatada}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* MODAL DE SOLICITAÇÃO DE ALTERAÇÃO DE E-MAIL VIA LINK */}
      {modalEmailAberto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }} onClick={() => setModalEmailAberto(false)}>
          <div style={{ background: 'var(--branco)', color: 'var(--texto-principal)', borderRadius: '16px', maxWidth: '460px', width: '100%', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', border: '1px solid var(--borda)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(147, 51, 234, 0.15)', color: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                <i className="fas fa-envelope-open-text"></i>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--texto-principal)' }}>Alterar E-mail de Login por E-mail</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: 'var(--texto-secundario)' }}>Autorize o envio do e-mail de confirmação para o novo endereço.</p>
              </div>
            </div>

            {emailTrocaSucesso ? (
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1.5px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '16px', marginBottom: '16px', color: '#10b981' }}>
                  <i className="fas fa-paper-plane" style={{ fontSize: '32px', marginBottom: '8px', display: 'block', color: '#10b981' }}></i>
                  <strong style={{ fontSize: '15px' }}>E-mail de Confirmação Enviado!</strong>
                  <p style={{ margin: '6px 0 0 0', fontSize: '12.5px', lineHeight: '1.45' }}>
                    Enviamos o link de autorização para o novo endereço (<strong>{novoEmail}</strong>).<br/>
                    Abra a caixa de entrada do novo e-mail e clique no link para ele se tornar o e-mail principal da sua conta.
                  </p>
                </div>
                <button 
                  type="button" 
                  onClick={() => setModalEmailAberto(false)}
                  style={{ width: '100%', background: 'var(--dourado)', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Entendi
                </button>
              </div>
            ) : (
              <form onSubmit={handleSolicitarAlteracaoEmail} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--texto-secundario)', display: 'block', marginBottom: '4px' }}>
                    E-MAIL ATUAL
                  </label>
                  <input 
                    type="text" 
                    disabled 
                    value={usuarioLogado?.email || ''} 
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--borda)', background: 'var(--fundo-cinza)', color: 'var(--texto-secundario)', fontSize: '13.5px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--texto-secundario)', display: 'block', marginBottom: '4px' }}>
                    DIGITE O NOVO E-MAIL DE ACESSO <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input 
                    type="email" 
                    required
                    value={novoEmail} 
                    onChange={e => setNovoEmail(e.target.value)} 
                    placeholder="exemplo@novoemail.com.br"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid var(--borda)', background: 'var(--fundo-cinza)', color: 'var(--texto-principal)', fontSize: '13.5px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 800, color: 'var(--texto-secundario)', display: 'block', marginBottom: '4px' }}>
                    CONFIRMAR SUA SENHA ATUAL <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type={mostrarSenha ? "text" : "password"} 
                      required
                      value={senhaConfirmar} 
                      onChange={e => setSenhaConfirmar(e.target.value)} 
                      placeholder="Senha atual para liberar o envio do e-mail"
                      style={{ width: '100%', padding: '10px 36px 10px 12px', borderRadius: '8px', border: '1.5px solid var(--borda)', background: 'var(--fundo-cinza)', color: 'var(--texto-principal)', fontSize: '13.5px', boxSizing: 'border-box' }}
                    />
                    <button 
                      type="button" 
                      onClick={() => setMostrarSenha(!mostrarSenha)}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--texto-secundario)', cursor: 'pointer' }}
                    >
                      <i className={`fas ${mostrarSenha ? "fa-eye-slash" : "fa-eye"}`}></i>
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button 
                    type="button" 
                    onClick={() => setModalEmailAberto(false)}
                    style={{ background: 'var(--fundo-cinza)', border: '1px solid var(--borda)', padding: '9px 16px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', color: 'var(--texto-secundario)', fontSize: '13px' }}
                  >
                    Cancelar
                  </button>

                  <button 
                    type="submit" 
                    disabled={enviandoEmailTroca}
                    style={{ background: 'var(--dourado)', color: 'white', border: 'none', padding: '9px 20px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {enviandoEmailTroca ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
                    {enviandoEmailTroca ? 'ENVIANDO...' : 'ENVIAR LINK POR E-MAIL'}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
};

export default AbaSeguranca;
