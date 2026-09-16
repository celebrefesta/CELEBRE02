import React, { useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { formatCpfCnpj, formatCEP, formatTelefone, validarCpfCnpj } from '../../utils/mascaras';

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
  salvandoTudo,
  dataCriacaoConta
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
            {(dataCriacaoConta || config?.dataCadastro) && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '6px', background: 'color-mix(in srgb, var(--cor-destaque, #c5a059) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--cor-destaque, #c5a059) 30%, transparent)', padding: '3px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: '500', color: 'var(--texto-principal, #0f172a)' }}>
                <i className="fas fa-calendar-check" style={{ color: 'var(--cor-destaque, #c5a059)' }}></i>
                <span>Data de Criação da Conta: <span style={{ color: 'var(--cor-destaque, #c5a059)', fontWeight: '600' }}>{dataCriacaoConta || config?.dataCadastro}</span></span>
              </div>
            )}
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

        {/* 📧 ALERTA E-MAIL: LOGO */}
        <div style={{
          display: 'flex', gap: '10px', alignItems: 'flex-start',
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--cor-destaque, #c5a059) 10%, transparent) 0%, color-mix(in srgb, var(--cor-destaque, #c5a059) 3%, transparent) 100%)',
          border: '1.5px solid color-mix(in srgb, var(--cor-destaque, #c5a059) 35%, transparent)',
          borderLeft: '4px solid var(--cor-destaque, #c5a059)',
          borderRadius: '10px',
          padding: '11px 13px',
          marginTop: '12px'
        }}>
          <span style={{ fontSize: '1.15rem', lineHeight: 1, marginTop: '2px' }}>📧</span>
          <div>
            <span style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--texto-principal, #0f172a)', display: 'block', marginBottom: '2px', letterSpacing: '-0.1px' }}>
              Importante para os E-mails Automáticos
            </span>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--texto-secundario, #475569)', lineHeight: 1.5 }}>
              O logotipo cadastrado aqui <span style={{ fontWeight: '500', color: 'var(--texto-principal, #0f172a)' }}>aparece no cabeçalho de todos os e-mails</span> enviados automaticamente pelo sistema (lembretes, contratos, cobranças, boas-vindas). Sem logo, o <span style={{ fontWeight: '500', color: 'var(--texto-principal, #0f172a)' }}>nome da empresa</span> será exibido no lugar.
            </p>
          </div>
        </div>

        <div className="f-group" style={{ marginTop: '12px' }}>
          <label><i className="fas fa-building"></i> Razão Social / Nome Fantasia</label>
          <div className="input-with-icon">
            <i className="fas fa-store input-icon"></i>
            <input 
              type="text" 
              value={config.nomeEmpresa || ''} 
              onChange={(e) => handleConfigChange('nomeEmpresa', e.target.value)} 
              onBlur={(e) => salvarConfigTextual('nomeEmpresa', e.target.value)} 
              placeholder="Ex: ÁGAPE DECORAÇÕES" 
            />
          </div>
        </div>

        {/* CNPJ / CPF */}
        <div className="f-group" style={{ marginTop: '12px' }}>
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span><i className="fas fa-id-card"></i> CNPJ / CPF</span>
            {(() => {
              const c = (config.cnpj || '').replace(/\D/g, '');
              if (c.length === 11 || c.length === 14) {
                return validarCpfCnpj(c) ? (
                  <span style={{ color: '#16a34a', fontWeight: '600', fontSize: '0.72rem' }}>✓ Válido</span>
                ) : (
                  <span style={{ color: '#ef4444', fontWeight: '600', fontSize: '0.72rem' }}>✗ Inválido</span>
                );
              }
              return null;
            })()}
          </label>
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
                const limpo = val.replace(/\D/g, '');
                if (limpo && !validarCpfCnpj(limpo)) {
                  alert("⚠️ Documento da Empresa (CNPJ ou CPF) inválido!\n\nOs números informados não conferem com o cálculo oficial da Receita Federal. Verifique o número digitado.");
                }
                salvarConfigTextual('cnpj', val);
              }} 
              placeholder="00.000.000/0001-00 ou 000.000.000-00" 
            />
          </div>
          {/* 📧 ALERTA ANTI-SPAM CNPJ */}
          <div style={{
            display: 'flex', gap: '9px', alignItems: 'flex-start',
            background: 'rgba(239,68,68,0.07)',
            border: '1.5px solid rgba(239,68,68,0.3)',
            borderLeft: '4px solid #ef4444',
            borderRadius: '10px',
            padding: '10px 12px',
            marginTop: '8px'
          }}>
            <span style={{ fontSize: '1.1rem', lineHeight: 1, marginTop: '1px' }}>🛡️</span>
            <div>
              <span style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--texto-principal, #0f172a)', display: 'block', marginBottom: '2px', letterSpacing: '-0.1px' }}>
                Anti-Spam: CNPJ aparece no rodapé dos e-mails
              </span>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--texto-secundario, #475569)', lineHeight: 1.5 }}>
                Provedores de e-mail (Gmail, Hotmail) exigem dados fiscais no rodapé para identificar e-mails <span style={{ fontWeight: '500', color: 'var(--texto-principal, #0f172a)' }}>legítimos</span>. Sem o CNPJ cadastrado, os e-mails têm <span style={{ fontWeight: '500', color: 'var(--texto-principal, #0f172a)' }}>maior risco de cair na pasta de Spam</span> do seu cliente.
              </p>
            </div>
          </div>
        </div>

        <div className="f-group slogan-group" style={{ marginTop: '12px' }}>
          <label><i className="fas fa-comment-alt"></i> Slogan ou Breve Descrição</label>
          <div className="input-with-icon slogan-input-wrapper">
            <i className="fas fa-quote-left input-icon textarea-icon"></i>
            <textarea 
              rows={3}
              className="config-textarea with-icon slogan-textarea"
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
        
        <div className="atendimento-redes-2col">
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
        </div>

        <div className="f-group" style={{ marginTop: '12px' }}>
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
          {/* 📧 ALERTA REPLY-TO */}
          <div style={{
            display: 'flex', gap: '9px', alignItems: 'flex-start',
            background: 'rgba(59,130,246,0.07)',
            border: '1.5px solid rgba(59,130,246,0.3)',
            borderLeft: '4px solid #3b82f6',
            borderRadius: '10px',
            padding: '11px 13px',
            marginTop: '10px'
          }}>
            <span style={{ fontSize: '1.1rem', lineHeight: 1, marginTop: '1px' }}>↩️</span>
            <div>
              <span style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--texto-principal, #0f172a)', display: 'block', marginBottom: '2px', letterSpacing: '-0.1px' }}>
                Este e-mail é o <em style={{ fontStyle: 'normal', color: '#2563eb' }}>Reply-To</em> dos disparos automáticos
              </span>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--texto-secundario, #475569)', lineHeight: 1.5 }}>
                Quando um cliente clicar em <span style={{ fontWeight: '500', color: 'var(--texto-principal, #0f172a)' }}>"Responder"</span> em qualquer e-mail enviado pelo sistema (lembrete, contrato, cobrança...), a resposta <span style={{ fontWeight: '500', color: 'var(--texto-principal, #0f172a)' }}>chegará neste endereço</span>. Mantenha-o sempre atualizado para não perder contato de clientes.
              </p>
            </div>
          </div>
        </div>

        <div className="f-group" style={{ marginTop: '12px' }}>
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

      {/* CARD 3: DADOS FISCAIS E SEDE / ESTOQUE (PONTO DE PARTIDA DO FRETE) */}
      <div className="config-card span-2-col-full">
        <div className="card-top-bar gray-bar"></div>
        <div className="config-card-header">
          <div className="card-header-icon gray">
            <i className="fas fa-warehouse"></i>
          </div>
          <div>
            <h3>Sede, Estoque & Ponto de Origem do Frete</h3>
            <p className="subtext">Endereço de partida para cálculo automático de frete por KM e logística de entregas.</p>
          </div>
        </div>

        {/* 🚚 BANNER EXPLICATIVO: PONTO DE ORIGEM DO FRETE */}
        <div style={{
          background: 'color-mix(in srgb, var(--cor-destaque, #c5a059) 8%, transparent)',
          border: '1.5px solid color-mix(in srgb, var(--cor-destaque, #c5a059) 35%, transparent)',
          borderRadius: '12px',
          padding: '11px 14px',
          marginBottom: '14px',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start'
        }}>
          <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>🚚</span>
          <div>
            <span style={{ color: 'var(--texto-principal, #0f172a)', fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '2px' }}>
              Ponto de Partida Obrigatório para o Cálculo Automático de Frete
            </span>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--texto-secundario, #475569)', lineHeight: 1.5 }}>
              Preencha abaixo o <span style={{ fontWeight: '500', color: 'var(--texto-principal, #0f172a)' }}>endereço onde seu acervo/estoque fica guardado</span> (galpão, loja física ou seu <span style={{ fontWeight: '500', color: 'var(--texto-principal, #0f172a)' }}>endereço residencial</span> caso trabalhe de casa).
              O sistema utiliza este ponto exato como origem para calcular a quilometragem (KM) e estimar os custos de gasolina e transporte até o local da festa dos seus clientes.
            </p>
          </div>
        </div>
        
        {/* TIPO DE LOCAL (3 COLUNAS SEMPRE NA MESMA LINHA) */}
        <div className="f-group" style={{ marginBottom: '12px' }}>
          <label><i className="fas fa-map-marker-alt" style={{ color: '#ef4444' }}></i> Tipo de Local de Origem (Base do Frete)</label>
          <div className="tipo-local-origem-grid">
            {[
              { id: 'empresa', label: 'Empresa', desc: 'Loja / Sede', icon: 'fas fa-building' },
              { id: 'residencia', label: 'Residência', desc: 'Home Office', icon: 'fas fa-home' },
              { id: 'galpao', label: 'Galpão', desc: 'Depósito', icon: 'fas fa-warehouse' }
            ].map(opt => {
              const isSelected = (config.tipoLocalOrigem || 'empresa') === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`btn-tipo-local-origem ${isSelected ? 'ativo active' : ''}`}
                  onClick={() => {
                    handleConfigChange('tipoLocalOrigem', opt.id);
                    salvarConfigTextual('tipoLocalOrigem', opt.id);
                  }}
                >
                  <i className={opt.icon}></i>
                  <span className="local-label">{opt.label}</span>
                  <span className="local-desc">{opt.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 1. LOGRADOURO E NÚMERO NA MESMA LINHA (LOGRADOURO MAIOR QUE NÚMERO) */}
        <div className="endereco-rua-num-row" style={{ marginTop: '12px' }}>
          <div className="f-group">
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

          <div className="f-group">
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
        </div>

        {/* 2. CIDADE E ESTADO NA MESMA LINHA (CIDADE MAIOR QUE ESTADO) */}
        <div className="endereco-cidade-uf-row" style={{ marginTop: '12px' }}>
          <div className="f-group">
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

          <div className="f-group">
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
        </div>

        {/* 3. BAIRRO E CEP NA MESMA LINHA (BAIRRO MAIOR QUE CEP) */}
        <div className="endereco-bairro-cep-row" style={{ marginTop: '12px' }}>
          <div className="f-group">
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

          <div className="f-group">
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
        </div>

        {/* 5. COMPLEMENTO */}
        <div className="f-group" style={{ marginTop: '12px' }}>
          <label><i className="fas fa-info-circle"></i> Complemento</label>
          <div className="input-with-icon">
            <i className="fas fa-door-open input-icon"></i>
            <input 
              type="text" 
              id="empresa-complemento"
              name="complemento"
              autoComplete="address-line2"
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

        {/* PREVIEW DO ENDEREÇO FORMATADO COMPLETO */}
        <div className="endereco-preview-box" style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(241, 245, 249, 0.6)', border: '1px dashed var(--borda)', borderRadius: '10px', fontSize: '12.5px', color: 'var(--texto-secundario)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fas fa-map-marker-alt" style={{ color: '#ef4444', fontSize: '15px' }}></i>
          <span><span style={{ fontWeight: '600', color: 'var(--texto-principal, #0f172a)' }}>Endereço Formatado para Contratos:</span> {config.endereco || 'Preencha os campos acima para gerar o endereço oficial.'}</span>
        </div>
      </div>

      {/* CARD CONTA BANCÁRIA & MEIOS DE RECEBIMENTO */}
      <div className="config-card span-2-col-full">
        <div className="card-top-bar green-bar" style={{ background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)' }}></div>
        <div className="config-card-header">
          <div className="card-header-icon green" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <i className="fas fa-wallet"></i>
          </div>
          <div>
            <h3>Meios de Recebimento da Empresa</h3>
            <p className="subtext">Configure o PIX e o link de pagamento para receber de forma direta e rápida dos seus clientes.</p>
          </div>
        </div>
        
        <div className="form-grid-2-col" style={{ marginTop: '15px' }}>
          {/* 1. CHAVE PIX OFICIAL */}
          <div className="f-group span-1-col">
            <label><i className="fas fa-qrcode" style={{ color: '#10b981' }}></i> Chave PIX Principal da Empresa</label>
            <div className="input-with-icon">
              <i className="fas fa-qrcode input-icon" style={{ color: '#10b981' }}></i>
              <input 
                type="text" 
                id="empresa-chave-pix"
                name="chavePix"
                autoComplete="off"
                value={config.chavePix || ''} 
                onChange={(e) => handleConfigChange('chavePix', e.target.value)} 
                onBlur={(e) => salvarConfigTextual('chavePix', e.target.value)} 
                placeholder="CPF, CNPJ, Celular, E-mail ou Aleatória" 
              />
            </div>
            <small style={{ color: 'var(--texto-secundario)', fontSize: '11.5px', marginTop: '4px', display: 'block' }}>
              Aparece automaticamente nos orçamentos, contratos e cobranças enviadas pelo WhatsApp.
            </small>
          </div>

          {/* 2. LINK DE CARTÃO DE CRÉDITO / PAGAMENTO GERAL */}
          <div className="f-group span-1-col">
            <label><i className="fas fa-credit-card" style={{ color: '#2563eb' }}></i> Link de Pagamento / Cartão de Crédito (Opcional)</label>
            <div className="input-with-icon">
              <i className="fas fa-link input-icon" style={{ color: '#2563eb' }}></i>
              <input 
                type="text" 
                id="empresa-link-pagamento"
                name="linkPagamento"
                autoComplete="off"
                value={config.linkPagamento || config.linkMercadoPago || ''} 
                onChange={(e) => {
                  handleConfigChange('linkPagamento', e.target.value);
                  handleConfigChange('linkMercadoPago', e.target.value);
                }} 
                onBlur={(e) => {
                  salvarConfigTextual('linkPagamento', e.target.value.trim());
                  salvarConfigTextual('linkMercadoPago', e.target.value.trim());
                }} 
                placeholder="Ex: InfinitePay, Ton, PagBank, Mercado Pago, etc." 
              />
            </div>
            <small style={{ color: 'var(--texto-secundario)', fontSize: '11.5px', marginTop: '4px', display: 'block' }}>
              Cole o link fixo da sua maquininha ou operadora para clientes que preferem pagar no cartão.
            </small>
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
        
        <div className="frete-params-container" style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* LINHA 1: PREÇO DO COMBUSTÍVEL E CONSUMO MÉDIO (NA MESMA LINHA) */}
          <div className="frete-params-2col-row">
            {/* PREÇO DO COMBUSTÍVEL */}
            <div className="f-group">
              <label><i className="fas fa-gas-pump" style={{ color: '#ef4444' }}></i> Combustível (R$/L)</label>
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

            {/* CONSUMO EM KM/L */}
            <div className="f-group">
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
          </div>

          {/* LINHA 2: VEÍCULO PADRÃO DA EMPRESA (LARGURA TOTAL / 1 COLUNA) */}
          <div className="f-group" style={{ margin: 0, width: '100%' }}>
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
                style={{ width: '100%', padding: '8px 12px 8px 38px', borderRadius: '8px', border: '1px solid var(--borda, #cbd5e1)', fontSize: '13.5px', background: 'var(--fundo-cinza, #ffffff)', color: 'var(--texto-principal, #0f172a)', fontWeight: '500' }}
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

          {/* LINHA 3: PADRÃO DE TRAJETOS POR LOCAÇÃO (LARGURA TOTAL / 1 COLUNA) */}
          <div className="f-group" style={{ margin: 0, width: '100%' }}>
            <label><i className="fas fa-sync-alt" style={{ color: '#8b5cf6' }}></i> Padrão de Trajetos por Locação</label>
            <div className="input-with-icon">
              <i className="fas fa-arrows-alt-h input-icon" style={{ color: '#8b5cf6' }}></i>
              <select
                value={config.tipoViagemPadrao || '4'}
                onChange={(e) => {
                  handleConfigChange('tipoViagemPadrao', e.target.value);
                  salvarConfigTextual('tipoViagemPadrao', e.target.value);
                }}
                style={{ width: '100%', padding: '8px 12px 8px 38px', borderRadius: '8px', border: '1px solid var(--borda, #cbd5e1)', fontSize: '13.5px', background: 'var(--fundo-cinza, #ffffff)', color: 'var(--texto-principal, #0f172a)', fontWeight: '500' }}
              >
                <option value="4">🔁 4 Percursos (Levar, Voltar, Buscar, Voltar)</option>
                <option value="2">➡️ 2 Percursos (Apenas Entrega / Ida e Volta)</option>
              </select>
            </div>
          </div>

          {/* LINHA 4: DESGASTE VEICULAR E TAXA MÍNIMA (NA MESMA LINHA) */}
          <div className="frete-params-2col-row">
            {/* CUSTO OPERACIONAL / DESGASTE POR KM */}
            <div className="f-group">
              <label><i className="fas fa-tools" style={{ color: '#f59e0b' }}></i> Custo Desgaste (R$/km)</label>
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
            <div className="f-group">
              <label><i className="fas fa-tag" style={{ color: '#06b6d4' }}></i> Taxa Mínima (R$)</label>
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
            <div style={{ marginTop: '14px', padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span style={{ color: '#92400e', fontSize: '13px', fontWeight: '600', display: 'block' }}>
                  <i className="fas fa-calculator" style={{ marginRight: '6px' }}></i> 
                  Simulação da Fórmula (Exemplo para 10 km de distância):
                </span>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#b45309', lineHeight: '1.45' }}>
                  Gasolina: ({kmExemplo}km × {viagens} percursos ÷ {consumo}km/l × R$ {precoGas.toFixed(2)}) = R$ {custoGasExemplo.toFixed(2)} + Desgaste (R$ {(kmExemplo * custoOp).toFixed(2)}) = <span style={{ fontWeight: '600' }}>R$ {freteTotalExemplo.toFixed(2)}</span>.
                </p>
              </div>
              <span style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '5px 10px', borderRadius: '8px', fontWeight: '600', fontSize: '0.80rem' }}>
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
        
        <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {config.assinatura ? (
            <div className="assinatura-trancada ouro-border" style={{ width: '100%', maxWidth: '540px' }}>
              <div className="selo-ok" style={{ fontWeight: '600' }}>
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
              <div className="assinatura-actions-row" style={{ display: 'flex', gap: '15px', marginTop: '15px' }}>
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
      <div className="config-footer-save-card" style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: '12px',
        marginTop: '20px',
        padding: '14px 20px',
        background: 'var(--fundo-card, #ffffff)',
        border: '1px solid var(--borda-card, #e2e8f0)',
        borderRadius: '14px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
      }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--texto-secundario, #64748b)' }}>
            <i className="fas fa-info-circle" style={{ marginRight: '6px', color: '#3b82f6' }}></i>
            Os campos são salvos individualmente ao sair de cada campo. Use este botão para <span style={{ fontWeight: '600', color: 'var(--texto-principal, #0f172a)' }}>confirmar todas as alterações</span> de uma vez.
          </p>
        </div>
        <button
          type="button"
          className="btn-salvar-empresa-destaque"
          onClick={salvarTudo}
          disabled={salvandoTudo}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 22px',
            background: salvandoTudo ? '#94a3b8' : 'linear-gradient(135deg, var(--cor-destaque, #c5a059) 0%, var(--gold-dark, #a38038) 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            fontSize: '13.5px',
            fontWeight: '600',
            cursor: salvandoTudo ? 'not-allowed' : 'pointer',
            boxShadow: salvandoTudo ? 'none' : '0 4px 14px color-mix(in srgb, var(--cor-destaque, #c5a059) 35%, transparent)',
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