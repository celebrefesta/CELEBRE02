import React, { useState } from 'react';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';

const AbaSeguranca = ({ usuarioLogado, registrarLog }) => {
  const [modalSenhaAberto, setModalSenhaAberto] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenhaAtual, setMostrarSenhaAtual] = useState(false);
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  const validarSenha = (senha) => ({
      tamanho: senha.length >= 8,
      maiuscula: /[A-Z]/.test(senha),
      minuscula: /[a-z]/.test(senha),
      numero: /[0-9]/.test(senha),
      especial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(senha)
  });

  const criterios = validarSenha(novaSenha);
  const isSenhaForte = Object.values(criterios).every(Boolean);

  const handleTrocarSenha = async (e) => {
    e.preventDefault();
    setSalvandoSenha(true);
    try {
        if (!senhaAtual || !novaSenha || !confirmarSenha) return alert('⚠️ Preencha todos os campos do cofre de segurança.');
        if (!isSenhaForte) return alert('❌ A nova senha não atende aos critérios mínimos de segurança.');
        if (novaSenha !== confirmarSenha) return alert('❌ As senhas novas não coincidem!');

        const credential = EmailAuthProvider.credential(usuarioLogado.email, senhaAtual);
        try { await reauthenticateWithCredential(usuarioLogado, credential); } 
        catch (authError) { return alert('❌ A Senha Atual está incorreta. Acesso negado.'); }

        await updatePassword(usuarioLogado, novaSenha);
        await registrarLog("ALTERAÇÃO DE SENHA", `A palavra-passe foi alterada com sucesso.`);
        alert('✅ Senha atualizada com sucesso! Seu sistema está seguro.');
        setSenhaAtual(''); setNovaSenha(''); setConfirmarSenha('');
        setModalSenhaAberto(false);
    } catch (error) { alert('Ocorreu um erro inesperado ao alterar a senha.'); } 
    finally { setSalvandoSenha(false); }
  };

  return (
    <>
      <div className="config-empresa-grid">
        <div className="config-card span-2-col-full large-padding" style={{textAlign: 'center'}}>
            <div className="card-top-bar blue-bar"></div>
            <div style={{fontSize: '40px', color: '#3b82f6', marginBottom: '15px'}}><i className="fas fa-shield-alt"></i></div>
            <h3>Segurança da Conta</h3>
            <p className="subtext" style={{maxWidth: '600px', margin: '0 auto 20px'}}>A sua palavra-passe é criptografada de ponta a ponta. Caso suspeite de acessos indevidos ou queira atualizar as suas credenciais, inicie o processo seguro abaixo.</p>
            <button type="button" className="btn-salvar-config" onClick={() => setModalSenhaAberto(true)}><i className="fas fa-lock"></i> Abrir Cofre para Alterar Senha</button>
        </div>
      </div>

      {/* MODAL DE TROCA DE SENHA */}
      {modalSenhaAberto && (
        <div className="modal-overlay-senha" onClick={() => setModalSenhaAberto(false)}>
            <div className="modal-senha-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-senha-header">
                    <div className="icon-cofre"><i className="fas fa-key"></i></div>
                    <h2>Verificação de Segurança</h2>
                    <p>Para alterar a sua palavra-passe, confirme a sua identidade.</p>
                </div>
                <form onSubmit={handleTrocarSenha} className="modal-senha-body">
                    <div className="input-group">
                        <label>PALAVRA-PASSE ATUAL <span style={{color: '#ef4444'}}>*</span></label>
                        <div className="password-wrapper">
                            <input type={mostrarSenhaAtual ? "text" : "password"} value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} placeholder="Digite a sua senha atual" autoFocus />
                            <button type="button" className="btn-toggle-password" onClick={() => setMostrarSenhaAtual(!mostrarSenhaAtual)}><i className={`fas ${mostrarSenhaAtual ? "fa-eye-slash" : "fa-eye"}`}></i></button>
                        </div>
                    </div>
                    <div className="senha-divider"></div>
                    <div className="input-group">
                        <label>NOVA PALAVRA-PASSE</label>
                        <div className="password-wrapper">
                            <input type={mostrarNovaSenha ? "text" : "password"} value={novaSenha} onChange={e => setNovaSenha(e.target.value)} placeholder="Crie uma senha forte" />
                            <button type="button" className="btn-toggle-password" onClick={() => setMostrarNovaSenha(!mostrarNovaSenha)}><i className={`fas ${mostrarNovaSenha ? "fa-eye-slash" : "fa-eye"}`}></i></button>
                        </div>
                        <div className="senha-criterios">
                            <p>Sua senha deve conter:</p>
                            <ul>
                                <li className={criterios.tamanho ? "criterio-ok" : "criterio-falha"}><i className={`fas ${criterios.tamanho ? "fa-check-circle" : "fa-circle"}`}></i> Mínimo de 8 caracteres</li>
                                <li className={criterios.maiuscula && criterios.minuscula ? "criterio-ok" : "criterio-falha"}><i className={`fas ${criterios.maiuscula && criterios.minuscula ? "fa-check-circle" : "fa-circle"}`}></i> Letras maiúsculas e minúsculas</li>
                                <li className={criterios.numero ? "criterio-ok" : "criterio-falha"}><i className={`fas ${criterios.numero ? "fa-check-circle" : "fa-circle"}`}></i> Pelo menos 1 número</li>
                                <li className={criterios.especial ? "criterio-ok" : "criterio-falha"}><i className={`fas ${criterios.especial ? "fa-check-circle" : "fa-circle"}`}></i> Caractere especial (!@#$%&*)</li>
                            </ul>
                        </div>
                    </div>
                    <div className="input-group">
                        <label>CONFIRMAR NOVA PALAVRA-PASSE</label>
                        <div className="password-wrapper">
                            <input type={mostrarConfirmarSenha ? "text" : "password"} value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)} placeholder="Repita a nova senha" />
                            <button type="button" className="btn-toggle-password" onClick={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)}><i className={`fas ${mostrarConfirmarSenha ? "fa-eye-slash" : "fa-eye"}`}></i></button>
                        </div>
                    </div>
                    <div className="modal-senha-footer">
                        <button type="button" className="btn-cancelar-senha" onClick={() => { setModalSenhaAberto(false); setSenhaAtual(''); setNovaSenha(''); setConfirmarSenha(''); }}>Cancelar</button>
                        <button type="submit" className="btn-confirmar-senha" disabled={salvandoSenha || !isSenhaForte}>{salvandoSenha ? 'Autenticando...' : 'Confirmar Alteração'}</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </>
  );
};

export default AbaSeguranca;
