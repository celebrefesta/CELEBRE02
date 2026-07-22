import React from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { formatCpfCnpj, formatCEP, formatTelefone } from '../../utils/mascaras';

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

  const atualizarEnderecoCompleto = (overrideObj = {}) => {
    const r = overrideObj.rua !== undefined ? overrideObj.rua : (config.rua || '');
    const num = overrideObj.numero !== undefined ? overrideObj.numero : (config.numero || '');
    const comp = overrideObj.complemento !== undefined ? overrideObj.complemento : (config.complemento || '');
    const b = overrideObj.bairro !== undefined ? overrideObj.bairro : (config.bairro || '');
    const cid = overrideObj.cidade !== undefined ? overrideObj.cidade : (config.cidade || '');
    const state = overrideObj.uf !== undefined ? overrideObj.uf : (config.uf || '');
    const c = overrideObj.cep !== undefined ? overrideObj.cep : (config.cep || '');

    const partes = [];
    if (r) partes.push(r);
    if (num) partes.push(`nº ${num}`);
    if (comp) partes.push(comp);
    if (b) partes.push(b);
    if (cid && state) partes.push(`${cid}/${state}`);
    else if (cid) partes.push(cid);
    if (c) partes.push(`CEP: ${c}`);

    const completo = partes.join(', ');
    handleConfigChange('endereco', completo);
    salvarConfigTextual('endereco', completo);
  };

  const handleBuscarCep = async (cepInput) => {
    const cepLimpo = cepInput.replace(/\D/g, '');
    if (cepLimpo.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        const data = await res.json();
        if (!data.erro) {
          const novaRua = data.logradouro || config.rua || '';
          const novoBairro = data.bairro || config.bairro || '';
          const novaCidade = data.localidade || config.cidade || '';
          const novaUf = (data.uf || config.uf || '').toUpperCase();

          handleConfigChange('rua', novaRua);
          salvarConfigTextual('rua', novaRua);

          handleConfigChange('bairro', novoBairro);
          salvarConfigTextual('bairro', novoBairro);

          handleConfigChange('cidade', novaCidade);
          salvarConfigTextual('cidade', novaCidade);

          handleConfigChange('uf', novaUf);
          salvarConfigTextual('uf', novaUf);

          atualizarEnderecoCompleto({
            rua: novaRua,
            bairro: novoBairro,
            cidade: novaCidade,
            uf: novaUf,
            cep: cepInput
          });
        }
      } catch (e) {
        console.error("Erro ao buscar CEP:", e);
      }
    }
  };

  return (
    <div className="config-empresa-grid">
      
      {/* CARD 1: IDENTIDADE VISUAL */}
      <div className="config-card">
        <div className="card-top-bar gold-bar"></div>
        <div className="config-card-header">
          <div className="card-header-icon gold">
            <i className="fas fa-magic"></i>
          </div>
          <div>
            <h3>Identidade Visual</h3>
            <p className="subtext">A marca da sua empresa nos catálogos, contratos e orçamentos.</p>
          </div>
        </div>
        
        <div className="empresa-id-wrapper">
          <div className="logo-preview-box">
            {config.logotipo ? (
              <img src={config.logotipo} alt="Logo da Empresa" />
            ) : (
              <div className="logo-placeholder">
                <i className="fas fa-store logo-icon-empty"></i>
                <span>Sem Logo</span>
              </div>
            )}
          </div>
          <div className="logo-actions">
            <label className="btn-outline btn-upload">
              <i className="fas fa-cloud-upload-alt"></i>
              Carregar Logo
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
            </label>
            {config.logotipo && (
              <button type="button" className="btn-danger-outline" onClick={removerLogo}>
                <i className="fas fa-trash-alt"></i> Remover Logo
              </button>
            )}
            <small><i className="fas fa-info-circle"></i> Use arquivos PNG com fundo transparente para melhor resultado.</small>
          </div>
        </div>

        <div className="f-group" style={{ marginTop: '20px' }}>
          <label><i className="fas fa-building"></i> Razão Social / Nome Fantasia</label>
          <div className="input-with-icon">
            <i className="fas fa-store input-icon"></i>
            <input 
              type="text" 
              value={config.nomeEmpresa || ''} 
              onChange={(e) => handleConfigChange('nomeEmpresa', e.target.value)} 
              onBlur={(e) => salvarConfigTextual('nomeEmpresa', e.target.value)} 
              placeholder="Ex: VICHINHSK FESTA" 
            />
          </div>
        </div>

        <div className="f-group" style={{ marginTop: '16px' }}>
          <label><i className="fas fa-comment-alt"></i> Slogan ou Breve Descrição</label>
          <div className="input-with-icon">
            <i className="fas fa-quote-left input-icon"></i>
            <input 
              type="text" 
              value={config.slogan || ''} 
              onChange={(e) => handleConfigChange('slogan', e.target.value)} 
              onBlur={(e) => salvarConfigTextual('slogan', e.target.value)} 
              placeholder="Ex: Transformando sonhos em decorações inesquecíveis!" 
            />
          </div>
        </div>
      </div>

      {/* CARD 2: ATENDIMENTO E REDES */}
      <div className="config-card">
        <div className="card-top-bar blue-bar"></div>
        <div className="config-card-header">
          <div className="card-header-icon blue">
            <i className="fas fa-headset"></i>
          </div>
          <div>
            <h3>Atendimento e Redes</h3>
            <p className="subtext">Canais de contato direto visíveis aos seus clientes.</p>
          </div>
        </div>
        
        <div className="form-grid-2-col">
          <div className="f-group">
            <label><i className="fab fa-whatsapp" style={{ color: '#25D366' }}></i> WhatsApp Comercial</label>
            <div className="input-with-icon">
              <i className="fab fa-whatsapp input-icon" style={{ color: '#25D366' }}></i>
              <input 
                type="text" 
                maxLength="15"
                value={formatTelefone(config.telefone || '')} 
                onChange={(e) => {
                  const val = formatTelefone(e.target.value);
                  handleConfigChange('telefone', val);
                }} 
                onBlur={(e) => {
                  const val = formatTelefone(e.target.value);
                  salvarConfigTextual('telefone', val);
                }} 
                placeholder="(00) 00000-0000" 
              />
            </div>
          </div>

          <div className="f-group">
            <label><i className="fab fa-instagram" style={{ color: '#E1306C' }}></i> Instagram</label>
            <div className="input-with-icon">
              <i className="fab fa-instagram input-icon" style={{ color: '#E1306C' }}></i>
              <input 
                type="text" 
                value={config.instagram || ''} 
                onChange={(e) => handleConfigChange('instagram', e.target.value)} 
                onBlur={(e) => salvarConfigTextual('instagram', e.target.value)} 
                placeholder="@seuinstagram" 
              />
            </div>
          </div>

          <div className="f-group span-2-col">
            <label><i className="fas fa-envelope" style={{ color: '#3b82f6' }}></i> E-mail de Contato</label>
            <div className="input-with-icon">
              <i className="fas fa-envelope input-icon"></i>
              <input 
                type="email" 
                value={config.emailEmpresa || ''} 
                onChange={(e) => handleConfigChange('emailEmpresa', e.target.value)} 
                onBlur={(e) => salvarConfigTextual('emailEmpresa', e.target.value)} 
                placeholder="contato@suaempresa.com.br" 
              />
            </div>
          </div>

          <div className="f-group span-2-col">
            <label><i className="fas fa-globe" style={{ color: '#8b5cf6' }}></i> Site ou LinkTree</label>
            <div className="input-with-icon">
              <i className="fas fa-globe input-icon"></i>
              <input 
                type="text" 
                value={config.site || ''} 
                onChange={(e) => handleConfigChange('site', e.target.value)} 
                onBlur={(e) => salvarConfigTextual('site', e.target.value)} 
                placeholder="https://www.suaempresa.com.br" 
              />
            </div>
          </div>
        </div>
      </div>

      {/* CARD 3: DADOS FISCAIS E SEDE (CAMPOS DE ENDEREÇO SEPARADOS) */}
      <div className="config-card span-2-col-full">
        <div className="card-top-bar gray-bar"></div>
        <div className="config-card-header">
          <div className="card-header-icon gray">
            <i className="fas fa-file-contract"></i>
          </div>
          <div>
            <h3>Dados Fiscais e Sede da Empresa</h3>
            <p className="subtext">Informações cadastrais e endereço detalhado da sede/galpão comercial para geração de contratos.</p>
          </div>
        </div>
        
        <div className="form-grid-3-col">
          {/* CNPJ / CPF */}
          <div className="f-group span-1-col">
            <label><i className="fas fa-id-card"></i> CNPJ / CPF</label>
            <div className="input-with-icon">
              <i className="fas fa-file-invoice input-icon"></i>
              <input 
                type="text" 
                maxLength="18"
                value={formatCpfCnpj(config.cnpj || '')} 
                onChange={(e) => {
                  const val = formatCpfCnpj(e.target.value);
                  handleConfigChange('cnpj', val);
                }} 
                onBlur={(e) => {
                  const val = formatCpfCnpj(e.target.value);
                  salvarConfigTextual('cnpj', val);
                }} 
                placeholder="00.000.000/0001-00 ou 000.000.000-00" 
              />
            </div>
          </div>

          {/* CEP DA SEDE */}
          <div className="f-group span-1-col">
            <label><i className="fas fa-map-pin"></i> CEP da Sede</label>
            <div className="input-with-icon">
              <i className="fas fa-search-location input-icon"></i>
              <input 
                type="text" 
                maxLength="9"
                value={formatCEP(config.cep || '')} 
                onChange={(e) => {
                  const val = formatCEP(e.target.value);
                  handleConfigChange('cep', val);
                  handleBuscarCep(val);
                }} 
                onBlur={(e) => {
                  const val = formatCEP(e.target.value);
                  salvarConfigTextual('cep', val);
                  atualizarEnderecoCompleto({ cep: val });
                }} 
                placeholder="00000-000" 
              />
            </div>
          </div>

          {/* ESTADO (UF) */}
          <div className="f-group span-1-col">
            <label><i className="fas fa-flag"></i> Estado (UF)</label>
            <div className="input-with-icon">
              <i className="fas fa-map-marked input-icon"></i>
              <input 
                type="text" 
                maxLength="2"
                style={{ textTransform: 'uppercase' }}
                value={config.uf || ''} 
                onChange={(e) => handleConfigChange('uf', e.target.value.toUpperCase())} 
                onBlur={(e) => {
                  salvarConfigTextual('uf', e.target.value.toUpperCase());
                  atualizarEnderecoCompleto({ uf: e.target.value.toUpperCase() });
                }} 
                placeholder="EX: SP" 
              />
            </div>
          </div>

          {/* RUA / LOGRADOURO */}
          <div className="f-group span-2-col">
            <label><i className="fas fa-road"></i> Logradouro / Rua</label>
            <div className="input-with-icon">
              <i className="fas fa-map-signs input-icon"></i>
              <input 
                type="text" 
                value={config.rua || ''} 
                onChange={(e) => handleConfigChange('rua', e.target.value)} 
                onBlur={(e) => {
                  salvarConfigTextual('rua', e.target.value);
                  atualizarEnderecoCompleto({ rua: e.target.value });
                }} 
                placeholder="Ex: Avenida Brasil" 
              />
            </div>
          </div>

          {/* NÚMERO */}
          <div className="f-group span-1-col">
            <label><i className="fas fa-hashtag"></i> Número</label>
            <div className="input-with-icon">
              <i className="fas fa-home input-icon"></i>
              <input 
                type="text" 
                value={config.numero || ''} 
                onChange={(e) => handleConfigChange('numero', e.target.value)} 
                onBlur={(e) => {
                  salvarConfigTextual('numero', e.target.value);
                  atualizarEnderecoCompleto({ numero: e.target.value });
                }} 
                placeholder="Ex: 1230 / S/N" 
              />
            </div>
          </div>

          {/* COMPLEMENTO */}
          <div className="f-group span-1-col">
            <label><i className="fas fa-info-circle"></i> Complemento</label>
            <div className="input-with-icon">
              <i className="fas fa-door-open input-icon"></i>
              <input 
                type="text" 
                value={config.complemento || ''} 
                onChange={(e) => handleConfigChange('complemento', e.target.value)} 
                onBlur={(e) => {
                  salvarConfigTextual('complemento', e.target.value);
                  atualizarEnderecoCompleto({ complemento: e.target.value });
                }} 
                placeholder="Ex: Galpão 02 / Sala 101" 
              />
            </div>
          </div>

          {/* BAIRRO */}
          <div className="f-group span-1-col">
            <label><i className="fas fa-city"></i> Bairro</label>
            <div className="input-with-icon">
              <i className="fas fa-draw-polygon input-icon"></i>
              <input 
                type="text" 
                value={config.bairro || ''} 
                onChange={(e) => handleConfigChange('bairro', e.target.value)} 
                onBlur={(e) => {
                  salvarConfigTextual('bairro', e.target.value);
                  atualizarEnderecoCompleto({ bairro: e.target.value });
                }} 
                placeholder="Ex: Industrial" 
              />
            </div>
          </div>

          {/* CIDADE */}
          <div className="f-group span-1-col">
            <label><i className="fas fa-university"></i> Cidade</label>
            <div className="input-with-icon">
              <i className="fas fa-archway input-icon"></i>
              <input 
                type="text" 
                value={config.cidade || ''} 
                onChange={(e) => handleConfigChange('cidade', e.target.value)} 
                onBlur={(e) => {
                  salvarConfigTextual('cidade', e.target.value);
                  atualizarEnderecoCompleto({ cidade: e.target.value });
                }} 
                placeholder="Ex: São Paulo" 
              />
            </div>
          </div>
        </div>

        {/* PREVIEW DO ENDEREÇO FORMATADO COMPLETO */}
        <div className="endereco-preview-box" style={{ marginTop: '20px', padding: '12px 16px', background: 'rgba(241, 245, 249, 0.6)', border: '1px dashed var(--borda)', borderRadius: '10px', fontSize: '13px', color: 'var(--texto-secundario)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fas fa-map-marker-alt" style={{ color: '#ef4444', fontSize: '16px' }}></i>
          <span><strong>Endereço Formatado para Contratos:</strong> {config.endereco || 'Preencha os campos acima para gerar o endereço oficial.'}</span>
        </div>
      </div>

      {/* CARD 4: MARKETING E RASTREAMENTO */}
      <div className="config-card span-2-col-full">
        <div className="card-top-bar blue-bar"></div>
        <div className="config-card-header">
          <div className="card-header-icon blue">
            <i className="fas fa-chart-line"></i>
          </div>
          <div>
            <h3>Marketing e Rastreamento</h3>
            <p className="subtext">Conecte o seu catálogo à inteligência do Instagram/Facebook Ads.</p>
          </div>
        </div>
        
        <div className="form-grid-2-col">
          <div className="f-group span-2-col">
            <label><i className="fab fa-facebook-square" style={{ color: '#1877F2' }}></i> ID do Pixel (Facebook / Meta)</label>
            <div className="input-with-icon">
              <i className="fab fa-facebook-square input-icon" style={{ color: '#1877F2' }}></i>
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
      </div>

      {/* CARD 5: ASSINATURA OFICIAL DA EMPRESA */}
      <div className="config-card span-2-col-full">
        <div className="card-top-bar gold-bar"></div>
        <div className="config-card-header">
          <div className="card-header-icon gold">
            <i className="fas fa-file-signature"></i>
          </div>
          <div>
            <h3>Assinatura Oficial da Empresa</h3>
            <p className="subtext">Assine aqui uma única vez. O sistema vai aplicar esta assinatura automaticamente em todos os novos contratos.</p>
          </div>
        </div>
        
        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {config.assinatura ? (
            <div className="assinatura-trancada ouro-border" style={{ width: '100%', maxWidth: '540px' }}>
              <div className="selo-ok">
                <i className="fas fa-check-circle"></i> ASSINATURA SALVA NO SISTEMA
              </div>
              <img src={config.assinatura} alt="Assinatura Padrão da Empresa" />
              <button type="button" className="btn-danger-outline" onClick={removerAssinaturaGlobal} style={{ marginTop: '15px' }}>
                <i className="fas fa-redo-alt"></i> Remover e Fazer Nova
              </button>
            </div>
          ) : (
            <div style={{ width: '100%', maxWidth: '540px' }}>
              <div className="canvas-border ouro-border">
                <SignatureCanvas 
                  ref={sigGlobal} 
                  penColor="#b48a3c" 
                  canvasProps={{ className: "sigCanvas" }} 
                  backgroundColor="transparent" 
                />
              </div>
              <div style={{ display: 'flex', gap: '15px', marginTop: '15px' }}>
                <button type="button" className="btn-outline" style={{ flex: 1 }} onClick={limparAssinatura}>
                  <i className="fas fa-eraser"></i> Apagar Traço
                </button>
                <button type="button" className="btn-salvar-config" style={{ flex: 2 }} onClick={salvarAssinaturaGlobal}>
                  <i className="fas fa-save"></i> Salvar Assinatura Padrão
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default AbaEmpresa;