import React from 'react';
import { useNavigate } from 'react-router-dom';

const AbaAssinaturaUso = ({
  isSuperAdmin,
  assinatura,
  usoPlano,
  cancelando,
  handleCancelarAssinatura
}) => {
  const navigate = useNavigate();

  const porcentagemUso = isSuperAdmin ? 100 : (usoPlano.usado / usoPlano.limite) * 100;
  const corBarraUso = isSuperAdmin ? '#c5a059' : (porcentagemUso >= 100 ? '#ef4444' : (porcentagemUso > 70 ? '#f59e0b' : '#10b981'));

  return (
    <div className="config-empresa-grid">
      <div className="config-card span-2-col-full large-padding">
          <div className="card-top-bar gold-bar"></div>
          <h3><i className="fas fa-crown"></i> Detalhes da Assinatura</h3>
          <p className="subtext">Acompanhe os limites da sua conta e controle a sua assinatura Celebre.</p>
          
          <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '20px', marginTop: '20px' }}>
              <div className="assinatura-limite-header">
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Usuários Cadastrados (Você + Equipe)</span>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: corBarraUso }}>
                      {isSuperAdmin ? 'Acesso Ilimitado' : `${usoPlano.usado} de ${usoPlano.limite} vagas no ${assinatura.planoNome}`}
                  </span>
              </div>
              <div style={{ width: '100%', background: '#e2e8f0', borderRadius: '50px', height: '8px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(porcentagemUso, 100)}%`, background: corBarraUso, height: '100%', borderRadius: '50px', transition: 'width 0.5s ease' }}></div>
              </div>
              {!isSuperAdmin && porcentagemUso >= 100 && (
                  <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#ef4444', fontWeight: 'bold' }}>⚠️ Limite de funcionários atingido. Faça upgrade para adicionar mais.</p>
              )}
          </div>

          <div className="assinatura-card" style={{ background: assinatura.corBg, border: `1px solid ${assinatura.corTexto}40` }}>
              <div className="assinatura-header">
                  <div className="assinatura-titulo">
                      <h4 style={{ color: assinatura.corTexto }}>{assinatura.planoNome}</h4>
                      {!isSuperAdmin && <span className="preco-assinatura" style={{ color: assinatura.corTexto }}>R$ {assinatura.precoMensal} <span>/mês</span></span>}
                  </div>
                  <div className="status-badge" style={{ background: assinatura.corTexto, color: '#fff' }}>{assinatura.status}</div>
              </div>
              <hr style={{ borderColor: `${assinatura.corTexto}20` }} />
              <div className="assinatura-details">
                  <div className="detail-item">
                      <label style={{ color: `${assinatura.corTexto}90` }}>MÉTODO DE PAGAMENTO</label>
                      <p style={{ color: assinatura.corTexto }}><i className={isSuperAdmin ? "fas fa-shield-alt" : "fas fa-credit-card"}></i> {assinatura.metodoPagamento}</p>
                  </div>
                  <div className="detail-item">
                      <label style={{ color: `${assinatura.corTexto}90` }}>E-MAIL DE CONTATO</label>
                      <p style={{ color: assinatura.corTexto }}><i className="fas fa-envelope"></i> {assinatura.emailCobranca}</p>
                  </div>
              </div>
          </div>
          
          <div style={{display:'flex', gap: '15px', marginTop: 20, flexWrap: 'wrap'}}>
            <button type="button" className="btn-salvar-config" onClick={() => navigate('/planos')}>Gerenciar Plano e Pagamentos <i className="fas fa-arrow-right" style={{marginLeft: '8px'}}></i></button>
            {assinatura.isActive && !isSuperAdmin && (
                <button type="button" onClick={handleCancelarAssinatura} disabled={cancelando} style={{ padding: '12px 20px', backgroundColor: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '8px', fontWeight: 'bold', cursor: cancelando ? 'not-allowed' : 'pointer', transition: '0.2s', opacity: cancelando ? 0.6 : 1 }}>
                <i className="fas fa-ban" style={{marginRight: '8px'}}></i> {cancelando ? 'Cancelando...' : 'Cancelar Assinatura'}
                </button>
            )}
          </div>
      </div>
    </div>
  );
};

export default AbaAssinaturaUso;
