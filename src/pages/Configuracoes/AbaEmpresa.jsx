import React, { useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { formatCpfCnpj, formatCEP, formatTelefone } from '../../utils/mascaras';
import { testarChaveGoogleMaps } from '../../utils/googleMapsService';

const AbaEmpresa = ({ 
  config, 
  handleConfigChange, 
  salvarConfigTextual, 
  handleLogoUpload, 
  removerLogo,
  sigGlobal,
  limparAssinatura,
  salvarAssinaturaGlobal,
  removerAssinaturaGlobal,
  salvarTudo,
  salvandoTudo
}) => {
  const [testandoGoogle, setTestandoGoogle] = useState(false);
  const [resultadoTesteGoogle, setResultadoTesteGoogle] = useState(null);

  const handleTestarGoogleMaps = async () => {
    const key = (config.googleMapsApiKey || '').trim();
    if (!key) {
      alert("Por favor, cole a sua Chave de API do Google Maps primeiro.");
      return;
    }
    setTestandoGoogle(true);
    setResultadoTesteGoogle(null);
    try {
      const res = await testarChaveGoogleMaps(key);
      setResultadoTesteGoogle({
        sucesso: true,
        mensagem: `🟢 Conexão com Google Maps Oficial 100% ativa! Trajeto teste: ${res.km} km (${res.duracaoTexto}).`
      });
    } catch (err) {
      setResultadoTesteGoogle({
        sucesso: false,
        mensagem: `🔴 Erro no teste: ${err.message || 'Verifique se a chave está correta e se a Distance Matrix API e Maps JavaScript API estão ativadas no Google Cloud Console.'}`
      });
    } finally {
      setTestandoGoogle(false);
    }
  };

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

      {/* CARD 3: DADOS FISCAIS E SEDE / ESTOQUE (PONTO DE PARTIDA DO FRETE) */}
      <div className="config-card span-2-col-full">
        <div className="card-top-bar gray-bar"></div>
        <div className="config-card-header">
          <div className="card-header-icon gray">
            <i className="fas fa-warehouse"></i>
          </div>
          <div>
            <h3>Sede, Estoque & Dados Fiscais da Empresa</h3>
            <p className="subtext">Endereço de onde saem as mercadorias para cálculo de frete por KM e geração de contratos.</p>
          </div>
        </div>

        {/* 🚚 BANNER EXPLICATIVO: PONTO DE ORIGEM DO FRETE */}
        <div style={{
          background: 'rgba(197, 160, 89, 0.08)',
          border: '1.5px solid rgba(197, 160, 89, 0.35)',
          borderRadius: '12px',
          padding: '14px 16px',
          marginBottom: '20px',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start'
        }}>
          <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>🚚</span>
          <div>
            <strong style={{ color: 'var(--texto-principal, #0f172a)', fontSize: '0.88rem', display: 'block', marginBottom: '3px' }}>
              Ponto de Partida Obrigatório para o Cálculo Automático de Frete
            </strong>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--texto-secundario, #475569)', lineHeight: 1.5 }}>
              Preencha abaixo o <strong>endereço onde seu acervo/estoque fica guardado</strong> (galpão, loja física ou seu <strong>endereço residencial</strong> caso trabalhe de casa).
              O sistema utiliza este ponto exato como origem para calcular a quilometragem (KM) e estimar os custos de gasolina e transporte até o local da festa dos seus clientes.
            </p>
          </div>
        </div>
        
        <div className="form-grid-3-col">
          {/* TIPO DE LOCAL */}
          <div className="f-group span-3-col" style={{ marginBottom: '4px' }}>
            <label><i className="fas fa-map-marker-alt" style={{ color: '#ef4444' }}></i> Tipo de Local de Origem (Base do Frete)</label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }}>
              {[
                { val: 'empresa', label: '🏢 Empresa / Loja', desc: 'Ponto comercial' },
                { val: 'residencia', label: '🏠 Residência', desc: 'Trabalho de casa' },
                { val: 'galpao', label: '🏭 Galpão / Depósito', desc: 'Armazém próprio' }
              ].map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => { handleConfigChange('tipoLocalOrigem', opt.val); salvarConfigTextual('tipoLocalOrigem', opt.val); }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: `2px solid ${(config.tipoLocalOrigem || 'residencia') === opt.val ? '#c5a059' : 'var(--borda, #e2e8f0)'}`,
                    background: (config.tipoLocalOrigem || 'residencia') === opt.val ? 'rgba(197,160,89,0.12)' : 'var(--fundo-card, #fff)',
                    color: (config.tipoLocalOrigem || 'residencia') === opt.val ? '#926f2d' : 'var(--texto-secundario, #64748b)',
                    fontWeight: '800',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                >
                  <span>{opt.label}</span>
                  <span style={{ fontSize: '0.68rem', opacity: 0.7, fontWeight: 600 }}>{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>

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

      {/* CARD: GOOGLE MAPS API OFICIAL (CÁLCULO DE FRETE 100% EXATO) */}
      <div className="config-card span-2-col-full" style={{ border: config.googleMapsApiKey ? '2px solid rgba(197, 160, 89, 0.5)' : undefined }}>
        <div className="card-top-bar gold-bar"></div>
        <div className="config-card-header">
          <div className="card-header-icon gold">
            <i className="fas fa-map-marked-alt"></i>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0 }}>Google Maps API Oficial (Cálculo de Frete 100% Certeiro)</h3>
              {config.googleMapsApiKey && (
                <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: '800' }}>
                  ✓ ATIVO NO SISTEMA
                </span>
              )}
            </div>
            <p className="subtext">
              Integração oficial com a base de dados de trânsito, ruas e numerações do Google Maps para calcular o KM exato porta a porta sem margem de erro.
            </p>
          </div>
        </div>

        {/* BANNER EXPLICATIVO */}
        <div style={{
          background: 'rgba(197, 160, 89, 0.08)',
          border: '1.5px solid rgba(197, 160, 89, 0.3)',
          borderRadius: '12px',
          padding: '14px 16px',
          marginBottom: '16px',
          fontSize: '0.80rem',
          color: 'var(--texto-secundario, #475569)',
          lineHeight: 1.55
        }}>
          <strong style={{ color: 'var(--texto-principal, #0f172a)', display: 'block', marginBottom: '4px', fontSize: '0.86rem' }}>
            🎁 O Google Maps oferece US$ 200 de crédito gratuito todo mês (Mais de 40.000 cálculos grátis/mês)
          </strong>
          Com a sua chave de API inserida, o Celebre Sistema consulta diretamente os servidores da Google na hora de gerar propostas e locações, garantindo a quilometragem exata com trânsito real e sem perda financeira de combustível.
        </div>

        <div className="form-grid-2-col">
          <div className="f-group span-2-col">
            <label><i className="fas fa-key" style={{ color: '#c5a059' }}></i> Chave de API do Google Maps (Google Maps API Key)</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div className="input-with-icon" style={{ flex: 1 }}>
                <i className="fas fa-lock input-icon"></i>
                <input 
                  type="password" 
                  value={config.googleMapsApiKey || ''} 
                  onChange={(e) => handleConfigChange('googleMapsApiKey', e.target.value)} 
                  onBlur={(e) => salvarConfigTextual('googleMapsApiKey', e.target.value.trim())} 
                  placeholder="Ex: AIzaSyD..." 
                  style={{ fontFamily: 'monospace', letterSpacing: '1px' }}
                />
              </div>

              <button
                type="button"
                onClick={handleTestarGoogleMaps}
                disabled={testandoGoogle || !config.googleMapsApiKey}
                style={{
                  background: '#c5a059',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 18px',
                  fontWeight: '800',
                  fontSize: '0.82rem',
                  cursor: testandoGoogle || !config.googleMapsApiKey ? 'not-allowed' : 'pointer',
                  opacity: testandoGoogle || !config.googleMapsApiKey ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 6px rgba(197, 160, 89, 0.3)'
                }}
              >
                {testandoGoogle ? (
                  <><i className="fas fa-spinner fa-spin"></i> Testando...</>
                ) : (
                  <><i className="fas fa-vial"></i> Testar Conexão</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* FEEDBACK DO TESTE */}
        {resultadoTesteGoogle && (
          <div style={{
            marginTop: '12px',
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '0.80rem',
            fontWeight: '700',
            background: resultadoTesteGoogle.sucesso ? '#f0fdf4' : '#fef2f2',
            border: `1.5px solid ${resultadoTesteGoogle.sucesso ? '#bbf7d0' : '#fecaca'}`,
            color: resultadoTesteGoogle.sucesso ? '#166534' : '#991b1b',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>{resultadoTesteGoogle.mensagem}</span>
          </div>
        )}

        {/* TUTORIAL PASSO A PASSO EM 3 ETAPAS */}
        <details style={{ marginTop: '16px', background: 'var(--fundo-app, #f8fafc)', borderRadius: '10px', padding: '10px 14px', border: '1px solid var(--borda, #e2e8f0)', cursor: 'pointer' }}>
          <summary style={{ fontWeight: '800', fontSize: '0.80rem', color: '#926f2d', outline: 'none' }}>
            📖 Como criar minha chave gratuita no Google Cloud (Passo a Passo Rápido)
          </summary>
          <div style={{ marginTop: '12px', fontSize: '0.78rem', color: 'var(--texto-secundario, #475569)', lineHeight: 1.6 }}>
            <ol style={{ paddingLeft: '18px', margin: 0 }}>
              <li style={{ marginBottom: '6px' }}>
                Acesse o <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', fontWeight: '700', textDecoration: 'underline' }}>Google Cloud Console</a> e crie um projeto gratuito (ex: "Celebre Locações").
              </li>
              <li style={{ marginBottom: '6px' }}>
                No menu <strong>APIs e Serviços &gt; Biblioteca</strong>, pesquise e <strong>Ative</strong> estas 2 APIs:
                <ul style={{ marginTop: '3px' }}>
                  <li><strong>Distance Matrix API</strong> (calcula a distância e tempo)</li>
                  <li><strong>Maps JavaScript API</strong> (permite chamadas seguras pelo sistema)</li>
                </ul>
              </li>
              <li style={{ marginBottom: '6px' }}>
                Acesse <strong>Credenciais &gt; Criar Credenciais &gt; Chave de API</strong>.
              </li>
              <li>
                Copie a chave gerada (inicia com <code>AIzaSy...</code>) e cole no campo acima!
              </li>
            </ol>
          </div>
        </details>
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

      {/* CARD CONTA BANCÁRIA E MERCADO PAGO DA EMPRESA */}
      <div className="config-card span-2-col-full">
        <div className="card-top-bar blue-bar" style={{ background: 'linear-gradient(90deg, #009ee3 0%, #0072bb 100%)' }}></div>
        <div className="config-card-header">
          <div className="card-header-icon blue" style={{ background: 'rgba(0, 158, 227, 0.1)', color: '#009ee3' }}>
            <i className="fas fa-university"></i>
          </div>
          <div>
            <h3>Recebimento de Pagamentos da Empresa</h3>
            <p className="subtext">Configure os dados da SUA conta para que os pagamentos dos clientes caiam direto para você.</p>
          </div>
        </div>
        
        <div className="form-grid-2-col" style={{ marginTop: '15px' }}>
          <div className="f-group span-2-col">
            <label><i className="fas fa-key" style={{ color: '#009ee3' }}></i> Mercado Pago Access Token da SUA Empresa</label>
            <div className="input-with-icon">
              <i className="fas fa-key input-icon" style={{ color: '#009ee3' }}></i>
              <input 
                type="text" 
                value={config.mpAccessToken || ''} 
                onChange={(e) => handleConfigChange('mpAccessToken', e.target.value)} 
                onBlur={(e) => salvarConfigTextual('mpAccessToken', e.target.value)} 
                placeholder="Ex: APP_USR-1234567890..." 
              />
            </div>
            <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Obtenha no painel do Mercado Pago -&gt; Desenvolvedores -&gt; Suas Aplicações -&gt; Credenciais de Produção.</span>
          </div>

          <div className="f-group span-1-col">
            <label><i className="fas fa-qrcode" style={{ color: '#10b981' }}></i> Chave PIX Oficial da Empresa</label>
            <div className="input-with-icon">
              <i className="fas fa-qrcode input-icon" style={{ color: '#10b981' }}></i>
              <input 
                type="text" 
                value={config.chavePix || ''} 
                onChange={(e) => handleConfigChange('chavePix', e.target.value)} 
                onBlur={(e) => salvarConfigTextual('chavePix', e.target.value)} 
                placeholder="CPF, CNPJ, E-mail ou Celular" 
              />
            </div>
          </div>

          <div className="f-group span-1-col">
            <label><i className="fas fa-link" style={{ color: '#009ee3' }}></i> Link Mercado Pago Fixo (Opção)</label>
            <div className="input-with-icon">
              <i className="fas fa-link input-icon" style={{ color: '#009ee3' }}></i>
              <input 
                type="text" 
                value={config.linkMercadoPago || ''} 
                onChange={(e) => handleConfigChange('linkMercadoPago', e.target.value)} 
                onBlur={(e) => salvarConfigTextual('linkMercadoPago', e.target.value)} 
                placeholder="Ex: https://link.mercadopago.com.br/celebresistema" 
              />
            </div>
          </div>
        </div>
      </div>

      {/* CARD: PARÂMETROS DE FRETE & LOGÍSTICA POR KM */}
      <div className="config-card span-2-col-full">
        <div className="card-top-bar gold-bar" style={{ background: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)' }}></div>
        <div className="config-card-header">
          <div className="card-header-icon gold" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#d97706' }}>
            <i className="fas fa-truck-moving"></i>
          </div>
          <div>
            <h3>Parâmetros de Frete & Logística por KM</h3>
            <p className="subtext">Configure o preço do combustível, tipo de veículo e percursos para calcular o frete justo e automático.</p>
          </div>
        </div>
        
        <div className="form-grid-3-col">
          {/* PREÇO DO COMBUSTÍVEL */}
          <div className="f-group span-1-col">
            <label><i className="fas fa-gas-pump" style={{ color: '#ef4444' }}></i> Preço do Combustível (R$/Litro)</label>
            <div className="input-with-icon">
              <i className="fas fa-dollar-sign input-icon" style={{ color: '#ef4444' }}></i>
              <input 
                type="number" 
                step="0.01"
                min="0"
                value={config.precoGasolina !== undefined ? config.precoGasolina : '5.90'} 
                onChange={(e) => handleConfigChange('precoGasolina', e.target.value)} 
                onBlur={(e) => salvarConfigTextual('precoGasolina', e.target.value)} 
                placeholder="Ex: 5.90" 
              />
            </div>
          </div>

          {/* TIPO DE VEÍCULO PADRÃO */}
          <div className="f-group span-1-col">
            <label><i className="fas fa-car-side" style={{ color: '#3b82f6' }}></i> Veículo Padrão da Empresa</label>
            <div className="input-with-icon">
              <i className="fas fa-truck input-icon" style={{ color: '#3b82f6' }}></i>
              <select
                value={config.veiculoPadrao || '1.0'}
                onChange={(e) => {
                  const v = e.target.value;
                  handleConfigChange('veiculoPadrao', v);
                  salvarConfigTextual('veiculoPadrao', v);
                  const consumos = { '1.0': '12.0', '1.6': '9.5', '2.0': '7.5', 'fiorino': '6.5', 'caminhao': '4.5' };
                  if (consumos[v]) {
                    handleConfigChange('consumoKmL', consumos[v]);
                    salvarConfigTextual('consumoKmL', consumos[v]);
                  }
                }}
                style={{ width: '100%', padding: '10px 10px 10px 40px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#ffffff', color: '#0f172a', fontWeight: '700' }}
              >
                <option value="1.0">🚗 Carro 1.0 (~12 km/l)</option>
                <option value="1.6">🚗 Carro 1.4 / 1.6 (~9.5 km/l)</option>
                <option value="2.0">🚙 Carro 2.0 / SUV (~7.5 km/l)</option>
                <option value="fiorino">🚐 Fiorino / Van / Utilitário (~6.5 km/l)</option>
                <option value="caminhao">🚛 Caminhão de Carga (~4.5 km/l)</option>
                <option value="personalizado">⚙️ Personalizado</option>
              </select>
            </div>
          </div>

          {/* CONSUMO EM KM/L */}
          <div className="f-group span-1-col">
            <label><i className="fas fa-tachometer-alt" style={{ color: '#10b981' }}></i> Consumo Médio (km/l)</label>
            <div className="input-with-icon">
              <i className="fas fa-route input-icon" style={{ color: '#10b981' }}></i>
              <input 
                type="number" 
                step="0.1"
                min="1"
                value={config.consumoKmL !== undefined ? config.consumoKmL : '12.0'} 
                onChange={(e) => handleConfigChange('consumoKmL', e.target.value)} 
                onBlur={(e) => salvarConfigTextual('consumoKmL', e.target.value)} 
                placeholder="Ex: 12.0" 
              />
            </div>
          </div>

          {/* PADRÃO DE VIAGENS PARA EVENTOS */}
          <div className="f-group span-1-col">
            <label><i className="fas fa-sync-alt" style={{ color: '#8b5cf6' }}></i> Padrão de Trajetos por Locação</label>
            <div className="input-with-icon">
              <i className="fas fa-arrows-alt-h input-icon" style={{ color: '#8b5cf6' }}></i>
              <select
                value={config.tipoViagemPadrao || '4'}
                onChange={(e) => {
                  handleConfigChange('tipoViagemPadrao', e.target.value);
                  salvarConfigTextual('tipoViagemPadrao', e.target.value);
                }}
                style={{ width: '100%', padding: '10px 10px 10px 40px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#ffffff', color: '#0f172a', fontWeight: '700' }}
              >
                <option value="4">🔁 4 Percursos (Levar, Voltar, Buscar, Voltar)</option>
                <option value="2">➡️ 2 Percursos (Apenas Entrega / Ida e Volta)</option>
              </select>
            </div>
          </div>

          {/* CUSTO OPERACIONAL / DESGASTE POR KM */}
          <div className="f-group span-1-col">
            <label><i className="fas fa-tools" style={{ color: '#f59e0b' }}></i> Desgaste Veicular / Custo Op. (R$/km)</label>
            <div className="input-with-icon">
              <i className="fas fa-wrench input-icon" style={{ color: '#f59e0b' }}></i>
              <input 
                type="number" 
                step="0.10"
                min="0"
                value={config.custoAdicionalKm !== undefined ? config.custoAdicionalKm : '1.50'} 
                onChange={(e) => handleConfigChange('custoAdicionalKm', e.target.value)} 
                onBlur={(e) => salvarConfigTextual('custoAdicionalKm', e.target.value)} 
                placeholder="Ex: 1.50" 
              />
            </div>
          </div>

          {/* TAXA MÍNIMA DE FRETE */}
          <div className="f-group span-1-col">
            <label><i className="fas fa-tag" style={{ color: '#06b6d4' }}></i> Taxa Mínima de Frete (R$)</label>
            <div className="input-with-icon">
              <i className="fas fa-coins input-icon" style={{ color: '#06b6d4' }}></i>
              <input 
                type="number" 
                step="1"
                min="0"
                value={config.taxaMinimaFrete !== undefined ? config.taxaMinimaFrete : '25.00'} 
                onChange={(e) => handleConfigChange('taxaMinimaFrete', e.target.value)} 
                onBlur={(e) => salvarConfigTextual('taxaMinimaFrete', e.target.value)} 
                placeholder="Ex: 25.00" 
              />
            </div>
          </div>
        </div>

        {/* PRÉVIA DA FÓRMULA DE FRETE COM MEMÓRIA DE CÁLCULO */}
        {(() => {
          const precoGas = Number(config.precoGasolina !== undefined ? config.precoGasolina : 5.90) || 5.90;
          const consumo = Number(config.consumoKmL !== undefined ? config.consumoKmL : 12.0) || 12.0;
          const viagens = Number(config.tipoViagemPadrao !== undefined ? config.tipoViagemPadrao : 4) || 4;
          const custoOp = Number(config.custoAdicionalKm !== undefined ? config.custoAdicionalKm : 1.50) || 0;
          const minFrete = Number(config.taxaMinimaFrete !== undefined ? config.taxaMinimaFrete : 25.00) || 0;

          const kmExemplo = 10;
          const custoGasExemplo = ((kmExemplo * viagens) / consumo) * precoGas;
          const freteTotalExemplo = Math.max(minFrete, custoGasExemplo + (kmExemplo * custoOp));
          const taxaEfetivaKm = (freteTotalExemplo / kmExemplo).toFixed(2);

          return (
            <div style={{ marginTop: '18px', padding: '14px 18px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <strong style={{ color: '#92400e', fontSize: '0.88rem' }}>
                  <i className="fas fa-calculator" style={{ marginRight: '6px' }}></i> 
                  Simulação da Fórmula (Exemplo para 10 km de distância):
                </strong>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#b45309', lineHeight: '1.4' }}>
                  Gasolina: ({kmExemplo}km × {viagens} percursos ÷ {consumo}km/l × R$ {precoGas.toFixed(2)}) = R$ {custoGasExemplo.toFixed(2)} + Desgaste (R$ {(kmExemplo * custoOp).toFixed(2)}) = <strong>R$ {freteTotalExemplo.toFixed(2)}</strong>.
                </p>
              </div>
              <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '6px 12px', borderRadius: '8px', fontWeight: '900', fontSize: '0.85rem' }}>
                Taxa Média Base: ~R$ {taxaEfetivaKm}/km
              </span>
            </div>
          );
        })()}
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

      {/* ── BOTÃO SALVAR EMPRESA ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: '12px',
        marginTop: '32px',
        padding: '20px 24px',
        background: 'var(--fundo-card, #ffffff)',
        border: '1px solid var(--borda-card, #e2e8f0)',
        borderRadius: '16px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
      }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            <i className="fas fa-info-circle" style={{ marginRight: '6px', color: '#3b82f6' }}></i>
            Os campos são salvos individualmente ao sair de cada campo. Use este botão para <strong>confirmar todas as alterações</strong> de uma vez.
          </p>
        </div>
        <button
          type="button"
          onClick={salvarTudo}
          disabled={salvandoTudo}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 28px',
            background: salvandoTudo ? '#94a3b8' : 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '700',
            cursor: salvandoTudo ? 'not-allowed' : 'pointer',
            boxShadow: salvandoTudo ? 'none' : '0 4px 14px rgba(15,23,42,0.35)',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap'
          }}
        >
          {salvandoTudo
            ? <><i className="fas fa-spinner fa-spin"></i> Salvando...</>
            : <><i className="fas fa-save"></i> Salvar Dados da Empresa</>
          }
        </button>
      </div>

    </div>
  );
};

export default AbaEmpresa;