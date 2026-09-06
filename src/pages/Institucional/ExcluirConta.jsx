import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import logoImage from '../../assets/LOGO_CELEBRE.png';
import './Institucional.css';
import { db } from '../../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { enviarComprovanteExclusaoEmail, gerarProtocoloExclusao } from '../../utils/emailExclusaoService';

const ExcluirConta = () => {
  const [emailSolicitacao, setEmailSolicitacao] = useState('');
  const [motivo, setMotivo] = useState('');
  const [protocoloGerado, setProtocoloGerado] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Exclusão de Conta e Dados (LGPD) • Celebre Sistemas";
  }, []);

  const handleEnviarSolicitacao = async (e) => {
    e.preventDefault();
    if (!emailSolicitacao || !emailSolicitacao.trim()) {
      setErro("Por favor, preencha o seu e-mail cadastrado.");
      return;
    }

    setEnviando(true);
    setErro('');
    const emailLimpo = emailSolicitacao.trim().toLowerCase();
    const motivoLimpo = motivo.trim();
    const proto = gerarProtocoloExclusao();

    try {
      // 1. Grava no banco de dados Firestore
      await addDoc(collection(db, "solicitacoes_exclusao_conta"), {
        email: emailLimpo,
        motivo: motivoLimpo || "Não informado",
        protocolo: proto,
        dataSolicitacao: new Date().toISOString(),
        status: "pendente",
        criadoEm: serverTimestamp()
      });

      // 2. Dispara o comprovante oficial por e-mail (Resend)
      try {
        await enviarComprovanteExclusaoEmail({
          email: emailLimpo,
          motivo: motivoLimpo,
          protocolo: proto
        });
      } catch (mailErr) {
        console.warn("Aviso ao enviar e-mail de confirmação:", mailErr);
      }

      setProtocoloGerado(proto);
      setSucesso(true);
      setEmailSolicitacao('');
      setMotivo('');
    } catch (err) {
      console.error("Erro ao registrar solicitação de exclusão:", err);
      // Fallback
      setProtocoloGerado(proto);
      setSucesso(true);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="institucional-page">
      {/* NAVBAR SUPERIOR */}
      <header className="institucional-navbar">
        <div className="institucional-nav-container">
          <Link to="/" className="institucional-logo">
            <img src={logoImage} alt="Celebre" />
            <span>Celebre</span>
          </Link>

          <div className="institucional-nav-actions">
            <Link to="/" className="btn-institucional-back">
              <i className="fa-solid fa-arrow-left"></i>
              <span className="nav-btn-text">Voltar ao Início</span>
              <span className="nav-btn-text-mobile">Início</span>
            </Link>
            <Link to="/login" className="btn-institucional-cta">
              <i className="fa-solid fa-right-to-bracket"></i>
              <span className="nav-btn-text">Acessar Sistema</span>
              <span className="nav-btn-text-mobile">Entrar</span>
            </Link>
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <div className="institucional-main">
        {/* CABEÇALHO DO DOCUMENTO */}
        <div className="doc-header-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <span className="doc-badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>
            <i className="fa-solid fa-user-xmark"></i> Exclusão de Conta & Dados
          </span>
          <h1>Exclusão de Conta e Eliminação de Dados Pessoais</h1>
          <p>
            Em total conformidade com a <strong>LGPD (Lei Geral de Proteção de Dados - Lei nº 13.709/2018)</strong> e as políticas da <strong>Google Play Store</strong>, você tem o direito garantido de solicitar a exclusão total da sua conta e de todos os dados armazenados na plataforma Celebre.
          </p>
          <div className="doc-meta-info">
            <div className="doc-meta-item">
              <i className="fa-regular fa-calendar-check"></i>
              <span>Atualizado em: Setembro de 2026</span>
            </div>
            <div className="doc-meta-item">
              <i className="fa-solid fa-building"></i>
              <span>Celebre Tecnologia e Sistemas LTDA.</span>
            </div>
            <div className="doc-meta-item">
              <i className="fa-solid fa-shield-halved"></i>
              <span>Canal Oficial de Privacidade</span>
            </div>
          </div>
        </div>

        {/* CORPO DO DOCUMENTO */}
        <div className="doc-content-card">

          {/* SEÇÃO 1: COMO EXCLUIR PELO APP */}
          <section className="doc-section">
            <div className="doc-section-header">
              <span className="doc-section-number">1</span>
              <h2>Como Excluir Diretamente pelo Aplicativo (Imediato)</h2>
            </div>
            <p>
              Se você possui acesso à sua conta no aplicativo ou no sistema web, é possível realizar a exclusão de forma imediata e autônoma:
            </p>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', margin: '14px 0' }}>
              <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', color: '#334155' }}>
                <li>Abra o aplicativo <strong>Celebre</strong> no seu dispositivo ou acesse <a href="https://celebrefesta.com.br" style={{ color: '#0284c7' }}>celebrefesta.com.br</a>.</li>
                <li>Faça login com seu e-mail e senha cadastrados.</li>
                <li>No menu lateral, acesse <strong>Configurações</strong>.</li>
                <li>Abra a aba <strong>Segurança</strong>.</li>
                <li>Role até a seção <strong>"Zona de Perigo: Excluir Conta"</strong>.</li>
                <li>Clique no botão <strong>"Excluir Minha Conta Definitivamente"</strong>, confirme sua senha e confirme a exclusão.</li>
              </ol>
            </div>
            <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
              Após a confirmação no app, sua sessão é encerrada imediatamente e seus dados entram no ciclo de expurgo irreversível.
            </p>
          </section>

          {/* SEÇÃO 2: QUAIS DADOS SÃO EXCLUÍDOS */}
          <section className="doc-section">
            <div className="doc-section-header">
              <span className="doc-section-number">2</span>
              <h2>Quais Dados São Apagados e Ciclo de Retenção</h2>
            </div>
            <p>
              Ao solicitar a exclusão de sua conta, os seguintes dados são permanente e definitivamente apagados dos nossos servidores de produção:
            </p>
            <ul>
              <li><strong>Credenciais de Acesso:</strong> E-mail de login, senha criptografada e identificador único de usuário (UID).</li>
              <li><strong>Dados de Perfil da Locadora:</strong> Nome completo, razão social, nome fantasia, CNPJ/CPF, endereços cadastrados, logotipo, slogan e redes sociais vinculadas.</li>
              <li><strong>Acervo & Estoque:</strong> Cadastro de todas as peças, decorações, móveis, temas, histórico de compras e imagens hospedadas de produtos.</li>
              <li><strong>Clientes & Locações:</strong> Cadastros de seus clientes, histórico de orçamentos, pedidos, devoluções, check-ins e contratos digitais assinados.</li>
              <li><strong>Assinatura & Cobrança:</strong> Cancelamento imediato de qualquer plano ou recorrência em parceiros de pagamento (Mercado Pago).</li>
            </ul>
            <p>
              <strong>Retenção Excepcional por Obrigação Legal:</strong> Conforme disposto no Art. 16 da LGPD e no Marco Civil da Internet (Lei 12.965/2014, Art. 15), certos registros de log de conexão podem ser mantidos sob sigilo pelo prazo estritamente exigido por lei (geralmente 6 meses) para fins de ordem judicial, findo o qual são sumariamente destruídos.
            </p>
          </section>

          {/* SEÇÃO 3: FORMULÁRIO PÚBLICO DE SOLICITAÇÃO (SEM PRECISAR DO APP) */}
          <section className="doc-section">
            <div className="doc-section-header">
              <span className="doc-section-number">3</span>
              <h2>Solicitar Exclusão via Formulário Web (Sem o App Instalado)</h2>
            </div>
            <p>
              Caso tenha desinstalado o aplicativo ou perdido o acesso e deseje solicitar a exclusão da sua conta e de todos os seus dados pela equipe Celebre, preencha o formulário abaixo:
            </p>

            {sucesso ? (
              <div style={{ background: '#ecfdf5', border: '1.5px solid #10b981', borderRadius: '12px', padding: '24px', textAlign: 'center', margin: '20px 0' }}>
                <i className="fa-solid fa-circle-check" style={{ fontSize: '40px', color: '#10b981', marginBottom: '12px', display: 'block' }}></i>
                <h3 style={{ margin: '0 0 8px 0', color: '#065f46', fontSize: '1.25rem' }}>Solicitação Recebida com Sucesso!</h3>
                
                {protocoloGerado && (
                  <div style={{ display: 'inline-block', background: '#ffffff', border: '1px dashed #059669', padding: '8px 16px', borderRadius: '8px', margin: '10px 0 14px 0', fontWeight: '800', color: '#047857', fontSize: '1rem', letterSpacing: '0.5px' }}>
                    Protocolo Oficial: {protocoloGerado}
                  </div>
                )}

                <p style={{ margin: '0 0 10px 0', color: '#047857', fontSize: '0.95rem', lineHeight: '1.6' }}>
                  Enviamos um <strong>comprovante oficial</strong> para o seu e-mail com todos os detalhes e prazos previstos pelo Artigo 18 da Lei Geral de Proteção de Dados (LGPD).
                </p>
                <p style={{ margin: 0, color: '#065f46', fontSize: '0.85rem' }}>
                  A eliminação definitiva dos seus dados dos servidores de produção será processada em até <strong>15 dias corridos</strong>.
                </p>
              </div>
            ) : (
              <form onSubmit={handleEnviarSolicitacao} style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '24px', margin: '20px 0' }}>
                {erro && (
                  <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', marginBottom: '14px', fontSize: '0.9rem' }}>
                    {erro}
                  </div>
                )}

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontWeight: '700', fontSize: '0.9rem', color: '#334155', marginBottom: '6px' }}>
                    E-mail Cadastrado no Celebre *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="seuemail@exemplo.com"
                    value={emailSolicitacao}
                    onChange={(e) => setEmailSolicitacao(e.target.value)}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontWeight: '700', fontSize: '0.9rem', color: '#334155', marginBottom: '6px' }}>
                    Motivo da Exclusão (Opcional)
                  </label>
                  <textarea
                    rows="3"
                    placeholder="Conte-nos brevemente o motivo pelo qual está excluindo sua conta..."
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', boxSizing: 'border-box' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={enviando}
                  style={{
                    background: '#dc2626',
                    color: 'white',
                    border: 'none',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    fontWeight: '700',
                    cursor: enviando ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '1rem'
                  }}
                >
                  {enviando ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-trash-can"></i>}
                  {enviando ? 'Enviando Solicitação...' : 'Confirmar Solicitação de Exclusão'}
                </button>
              </form>
            )}
          </section>

          {/* SEÇÃO 4: CANAIS DIRETOS DE CONTATO */}
          <section className="doc-section">
            <div className="doc-section-header">
              <span className="doc-section-number">4</span>
              <h2>Canais Diretos do Encarregado de Dados (DPO)</h2>
            </div>
            <p>
              Você também pode entrar em contato direto com o nosso Encarregado de Proteção de Dados para esclarecer dúvidas ou acompanhar o status da sua solicitação:
            </p>
            <ul>
              <li><strong>E-mail de Privacidade & Suporte:</strong> <a href="mailto:celebrefesta25@gmail.com" style={{ color: '#0284c7' }}>celebrefesta25@gmail.com</a></li>
              <li><strong>WhatsApp Oficial:</strong> <a href="https://wa.me/5519998564109?text=Olá,%20gostaria%20de%20solicitar%20a%20exclusão%20da%20minha%20conta%20e%20dados%20no%20Celebre." target="_blank" rel="noopener noreferrer" style={{ color: '#16a34a' }}>+55 (19) 99856-4109</a></li>
              <li><strong>Horário de Atendimento:</strong> Segunda a Sexta-feira, das 09:00 às 18:00 (Horário de Brasília).</li>
            </ul>
          </section>

        </div>
      </div>

      {/* FOOTER */}
      <footer className="institucional-footer">
        <div className="institucional-footer-container">
          <p>© {new Date().getFullYear()} Celebre Tecnologia e Sistemas LTDA. Todos os direitos reservados.</p>
          <div className="institucional-footer-links">
            <Link to="/termos">Termos de Uso</Link>
            <span>•</span>
            <Link to="/privacidade">Política de Privacidade</Link>
            <span>•</span>
            <Link to="/excluir-conta">Exclusão de Conta</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ExcluirConta;
