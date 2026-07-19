import React from 'react';
import SignatureCanvas from 'react-signature-canvas';

const AbaEmpresa = ({ 
  config, 
  handleConfigChange, 
  salvarConfigTextual, 
  handleLogoUpload, 
  removerLogo,
  sigGlobal,
  limparAssinatura,
  salvarAssinaturaGlobal,
  removerAssinaturaGlobal
}) => {
  return (
    <div className="config-empresa-grid">
      <div className="config-card">
        <div className="card-top-bar gold-bar"></div>
        <h3>✨ Identidade Visual</h3>
        <p className="subtext">A marca da sua empresa nos catálogos e orçamentos.</p>
        
        <div className="empresa-id-wrapper">
          <div className="logo-preview-box">
            {config.logotipo ? <img src={config.logotipo} alt="Logo" /> : <span style={{fontSize: '30px', opacity: 0.3}}>📷</span>}
          </div>
          <div className="logo-actions">
            <label className="btn-outline">
              Carregar Nova Logo
              <input type="file" accept="image/*" style={{display: 'none'}} onChange={handleLogoUpload} />
            </label>
            {config.logotipo && <button className="btn-danger-outline" onClick={removerLogo}>Remover Logo</button>}
            <small>Use PNG com fundo transparente.</small>
          </div>
        </div>

        <div className="f-group" style={{marginTop: '15px'}}>
          <label>Razão Social / Nome Fantasia</label>
          <input type="text" value={config.nomeEmpresa || ''} onChange={(e) => handleConfigChange('nomeEmpresa', e.target.value)} onBlur={(e) => salvarConfigTextual('nomeEmpresa', e.target.value)} placeholder="Ex: VICHINHSK FESTA" />
        </div>
        <div className="f-group" style={{marginTop: '15px'}}>
          <label>Slogan ou Breve Descrição</label>
          <input type="text" value={config.slogan || ''} onChange={(e) => handleConfigChange('slogan', e.target.value)} onBlur={(e) => salvarConfigTextual('slogan', e.target.value)} placeholder="Ex: Transformando sonhos em decorações inesquecíveis!" />
        </div>
      </div>

      <div className="config-card">
        <div className="card-top-bar blue-bar"></div>
        <h3>📱 Atendimento e Redes</h3>
        <p className="subtext">Canais de contato direto com o cliente.</p>
        
        <div className="form-grid-2-col">
          <div className="f-group">
            <label>WhatsApp Comercial</label>
            <input type="text" value={config.telefone || ''} onChange={(e) => handleConfigChange('telefone', e.target.value)} onBlur={(e) => salvarConfigTextual('telefone', e.target.value)} placeholder="(00) 00000-0000" />
          </div>
          <div className="f-group">
            <label>Instagram</label>
            <input type="text" value={config.instagram || ''} onChange={(e) => handleConfigChange('instagram', e.target.value)} onBlur={(e) => salvarConfigTextual('instagram', e.target.value)} placeholder="@seuinstagram" />
          </div>
          <div className="f-group span-2-col">
            <label>E-mail de Contato</label>
            <input type="email" value={config.emailEmpresa || ''} onChange={(e) => handleConfigChange('emailEmpresa', e.target.value)} onBlur={(e) => salvarConfigTextual('emailEmpresa', e.target.value)} placeholder="contato@suaempresa.com.br" />
          </div>
          <div className="f-group span-2-col">
            <label>Site ou LinkTree</label>
            <input type="text" value={config.site || ''} onChange={(e) => handleConfigChange('site', e.target.value)} onBlur={(e) => salvarConfigTextual('site', e.target.value)} placeholder="https://www.suaempresa.com.br" />
          </div>
        </div>
      </div>

      <div className="config-card span-2-col-full">
        <div className="card-top-bar gray-bar"></div>
        <h3>🏢 Dados Fiscais e Sede</h3>
        <p className="subtext">Informações legais para a geração de contratos.</p>
        
        <div className="form-grid-2-col">
          <div className="f-group">
            <label>CNPJ / CPF</label>
            <input type="text" value={config.cnpj || ''} onChange={(e) => handleConfigChange('cnpj', e.target.value)} onBlur={(e) => salvarConfigTextual('cnpj', e.target.value)} placeholder="00.000.000/0001-00" />
          </div>
          <div className="f-group">
            <label>Endereço Completo (Sede / Galpão)</label>
            <textarea 
              rows="3" 
              value={config.endereco || ''} 
              onChange={(e) => handleConfigChange('endereco', e.target.value)} 
              onBlur={(e) => salvarConfigTextual('endereco', e.target.value)} 
              placeholder="Rua, Número, Complemento, Bairro - Cidade/UF"
              className="config-textarea"
            />
          </div>
        </div>
      </div>

      <div className="config-card span-2-col-full">
        <div className="card-top-bar blue-bar"></div>
        <h3>📈 Marketing e Rastreamento</h3>
        <p className="subtext">Conecte o seu catálogo à inteligência do Instagram/Facebook Ads.</p>
        
        <div className="form-grid-2-col">
          <div className="f-group span-2-col">
            <label>ID do Pixel (Facebook / Meta)</label>
            <input 
              type="text" 
              value={config.pixelFacebook || ''} 
              onChange={(e) => handleConfigChange('pixelFacebook', e.target.value)} 
              onBlur={(e) => salvarConfigTextual('pixelFacebook', e.target.value)} 
              placeholder="Ex: 123456789012345 (Apenas números)" 
            />
          </div>
        </div>
      </div>

      <div className="config-card span-2-col-full">
        <div className="card-top-bar gold-bar"></div>
        <h3>✍️ Assinatura Oficial da Empresa</h3>
        <p className="subtext">Assine aqui uma única vez. O sistema vai aplicar esta assinatura automaticamente em todos os novos contratos.</p>
        
        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {config.assinatura ? (
            <div className="assinatura-trancada ouro-border" style={{width: '100%', maxWidth: '500px'}}>
              <div className="selo-ok">✅ ASSINATURA SALVA NO SISTEMA</div>
              <img src={config.assinatura} alt="Assinatura Padrão" />
              <button className="btn-danger-outline" onClick={removerAssinaturaGlobal} style={{marginTop: '15px'}}>Remover e Fazer Nova</button>
            </div>
          ) : (
            <div style={{width: '100%', maxWidth: '500px'}}>
              <div className="canvas-border ouro-border">
                <SignatureCanvas ref={sigGlobal} penColor="#b48a3c" canvasProps={{ className: "sigCanvas" }} backgroundColor="transparent" />
              </div>
              <div style={{display: 'flex', gap: '15px', marginTop: '15px'}}>
                <button className="btn-outline" style={{flex: 1}} onClick={limparAssinatura}>Apagar Traço</button>
                <button className="btn-salvar-config" style={{flex: 2}} onClick={salvarAssinaturaGlobal}>Salvar Assinatura Padrão</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AbaEmpresa;