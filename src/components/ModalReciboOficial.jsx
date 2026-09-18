import React from 'react';
import './ModalReciboOficial.css';

const formatarMoeda = (val) => {
  if (typeof val === 'number') {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  const str = String(val || '0').replace('.', ',');
  if (!str.includes(',')) return `${str},00`;
  const partes = str.split(',');
  return `${partes[0]},${(partes[1] || '00').padEnd(2, '0').substring(0, 2)}`;
};

const ModalReciboOficial = ({ isOpen, onClose, fatura = {}, isAdmin = false }) => {
  if (!isOpen || !fatura) return null;

  const isCortesia = fatura.status === 'cortesia' || String(fatura.acao || '').toUpperCase().includes('VIP') || String(fatura.metodo || '').includes('Cortesia');
  const isPago = (fatura.status === 'concluido' || fatura.status === 'Concluído') && !isCortesia;
  const isTentativa = fatura.status === 'tentativa' || fatura.tipoEvento === 'tentativa' || String(fatura.acao || '').includes('TENTATIVA');
  const isFalha = fatura.status === 'falha' || fatura.status === 'recusado';

  const codigo = fatura.codigo || 'FAT-' + Math.floor(100000 + Math.random() * 900000);
  const dataPag = fatura.dataPagamento || fatura.dataFormatada || new Date().toLocaleDateString('pt-BR');
  const horaPag = fatura.horaPagamento || fatura.horaFormatada || '10:00';

  const partesPeriodo = String(fatura.periodo || '').split(' a ');
  const periodoInicio = fatura.periodoInicio || partesPeriodo[0] || dataPag;
  
  const cicloNome = fatura.cicloNome || (String(fatura.descricao || '').toLowerCase().includes('anual') ? 'Anual' : 'Mensal');

  let periodoFimCalculado = fatura.periodoFim || (partesPeriodo[1] && partesPeriodo[1] !== partesPeriodo[0] ? partesPeriodo[1] : null);
  if (!periodoFimCalculado && (isPago || isCortesia)) {
    const partesD = String(periodoInicio).split('/');
    if (partesD.length === 3) {
      const d = new Date(parseInt(partesD[2], 10), parseInt(partesD[1], 10) - 1, parseInt(partesD[0], 10));
      if (!isNaN(d.getTime())) {
        if (cicloNome === 'Anual') {
          d.setFullYear(d.getFullYear() + 1);
        } else {
          d.setMonth(d.getMonth() + 1);
        }
        periodoFimCalculado = d.toLocaleDateString('pt-BR');
      }
    }
  }
  const periodoFim = (isPago || isCortesia) ? (periodoFimCalculado || dataPag) : '—';

  const empresaNome = fatura.empresaNome || fatura.nomeCliente || localStorage.getItem('nomeEmpresa') || 'Assinante Celebre';
  const email = fatura.email || 'contato@celebre.com';
  const metodo = isCortesia ? 'Concessão Administrativa (Sem Cobrança)' : (fatura.metodo || 'Cartão de Crédito');

  let itemDescricao = fatura.descricao || fatura.acao || 'Assinatura Premium';
  if (itemDescricao.includes('Carregando...') || itemDescricao === 'Básico (Gratuito)') {
    itemDescricao = `Assinatura ${cicloNome} - Plano Premium`;
  } else if (isCortesia) {
    itemDescricao = `Licença Cortesia VIP (${cicloNome})`;
  } else if (isTentativa) {
    itemDescricao = `Tentativa de Assinatura - ${cicloNome}`;
  }

  const subDetalhes = isCortesia
    ? 'Licença de cortesia concedida pela administração Celebre'
    : isTentativa
    ? 'Tentativa de checkout no Mercado Pago (Não liquidada)'
    : (fatura.detalhes && !fatura.detalhes.includes('Iniciou o processo')) 
    ? fatura.detalhes 
    : 'Licença de Software Celebre • Sistema de Gestão';
  const valorExibido = isCortesia ? 0 : fatura.valor;
  const valorFormatado = formatarMoeda(valorExibido);

  // 🖨️ DISPARADOR DE IMPRESSÃO VIA IFRAME INVISÍVEL (NUNCA ABRE ABA NOVA)
  const dispararImpressao = () => {
    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Recibo Oficial - ${codigo} - Celebre</title>
        <style>
          @page { size: A4; margin: 15mm 20mm; }
          * { box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
            padding: 36px 40px; 
            color: #0f172a; 
            max-width: 740px; 
            margin: 0 auto; 
            background: #ffffff;
            line-height: 1.4;
          }
          .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-start; 
            border-bottom: 2px solid #c5a059; 
            padding-bottom: 18px; 
            margin-bottom: 26px; 
          }
          .brand-title { 
            font-size: 26px; 
            font-weight: 900; 
            color: #0f172a; 
            letter-spacing: 2px; 
            margin: 0;
          }
          .brand-sub { 
            font-size: 12px; 
            color: #64748b; 
            margin-top: 4px; 
            font-weight: 500;
          }
          .badge-status { 
            background: ${isPago ? '#dcfce7' : '#fee2e2'}; 
            color: ${isPago ? '#15803d' : '#991b1b'}; 
            border: 1px solid ${isPago ? '#86efac' : '#fca5a5'};
            padding: 6px 14px; 
            border-radius: 20px; 
            font-weight: 700; 
            font-size: 12px; 
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }
          .grid-info { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 14px; 
            margin-bottom: 26px; 
          }
          .info-box { 
            background: #f8fafc; 
            padding: 13px 16px; 
            border-radius: 8px; 
            border: 1px solid #e2e8f0; 
          }
          .info-box label { 
            font-size: 10.5px; 
            text-transform: uppercase; 
            color: #64748b; 
            font-weight: 700; 
            display: block; 
            margin-bottom: 4px; 
          }
          .info-box p { 
            margin: 0; 
            font-size: 14px; 
            font-weight: 700; 
            color: #0f172a; 
          }
          .info-box .subtext { 
            font-size: 11px; 
            color: #64748b; 
            margin-top: 2px; 
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 24px; 
          }
          th { 
            background: #0f172a; 
            color: #ffffff; 
            padding: 10px 12px; 
            text-align: left; 
            font-size: 11.5px; 
            text-transform: uppercase;
          }
          td { 
            padding: 12px; 
            border-bottom: 1px solid #e2e8f0; 
            font-size: 13px; 
          }
          .total-card {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px 20px;
            margin-bottom: 22px;
          }
          .total-card .valor-total {
            font-size: 26px;
            font-weight: 900;
            color: ${isPago ? '#10b981' : '#ef4444'};
          }
          .auth-banner {
            background: #f1f5f9;
            border-left: 3px solid #c5a059;
            padding: 10px 14px;
            font-size: 11px;
            color: #475569;
            display: flex;
            justify-content: space-between;
            margin-bottom: 26px;
          }
          .footer { 
            text-align: center; 
            margin-top: 30px; 
            font-size: 11.5px; 
            color: #94a3b8; 
            border-top: 1px solid #e2e8f0; 
            padding-top: 18px; 
          }
        </style>
      </head>
      <body>
           <div class="header">
          <div>
            <h1 class="brand-title">CELEBRE</h1>
            <div class="brand-sub">${isAdmin ? 'Auditoria Financeira & Recibo de Assinatura Oficial • Administração' : 'Comprovante Oficial de Assinatura & Recibo de Pagamento'}</div>
          </div>
          <div class="badge-status" style="background: ${isPago ? '#dcfce7' : isCortesia ? '#eff6ff' : '#fef3c7'}; color: ${isPago ? '#15803d' : isCortesia ? '#1d4ed8' : '#b45309'}; border: 1px solid ${isPago ? '#86efac' : isCortesia ? '#bfdbfe' : '#fde68a'};">
            ${isPago ? '✓ PAGAMENTO CONCLUÍDO' : isCortesia ? '✓ CORTESIA VIP (ISENTO)' : '⚠️ TENTATIVA NÃO QUITADA'}
          </div>
        </div>

        <div class="grid-info">
          <div class="info-box">
            <label>Código da Fatura</label>
            <p>${codigo}</p>
            <div class="subtext">Identificador Único da Cobrança</div>
          </div>
          <div class="info-box">
            <label>${isPago ? 'Data & Hora do Pagamento' : isCortesia ? 'Data de Concessão VIP' : 'Data da Tentativa'}</label>
            <p>${dataPag} às ${horaPag}</p>
            <div class="subtext">${isPago ? 'Data de liquidação bancária' : isCortesia ? 'Concessão administrativa' : 'Tentativa registrada (Não liquidada)'}</div>
          </div>
          <div class="info-box">
            <label>Período de Vigência / Cobertura</label>
            <p style="color: #b45309;">${isPago || isCortesia ? `${periodoInicio} a ${periodoFim}` : '—'}</p>
            <div class="subtext">${isPago || isCortesia ? `Plano ${cicloNome} Ativo` : 'Nenhuma vigência concedida'}</div>
          </div>
          <div class="info-box">
            <label>Forma de Processamento</label>
            <p>${metodo}</p>
            <div class="subtext">${isCortesia ? 'Concessão Administrativa' : isPago ? 'Gateway Mercado Pago' : 'Não finalizado no checkout'}</div>
          </div>
          <div class="info-box" style="grid-column: span 2;">
            <label>Sacado / Assinante</label>
            <p>${empresaNome}</p>
            <div class="subtext">${email} ${fatura.telefone ? `• ${fatura.telefone}` : ''}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Item / Descrição</th>
              <th>Data</th>
              <th>Período</th>
              <th>Método</th>
              <th style="text-align: right;">Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>${itemDescricao}</strong>
                <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${subDetalhes}</div>
              </td>
              <td>${dataPag}</td>
              <td>${isPago || isCortesia ? `${periodoInicio} a ${periodoFim}` : '—'}</td>
              <td>${metodo}</td>
              <td style="text-align: right; font-weight: 800; font-size: 14px;">${isCortesia ? 'R$ 0,00' : `R$ ${valorFormatado}`}</td>
            </tr>
          </tbody>
        </table>

        <div class="total-card">
          <div>
            <div style="font-weight: 700; color: ${isPago ? '#16a34a' : isCortesia ? '#2563eb' : '#b45309'};">
              ${isPago ? '✓ Pagamento Confirmado e Quitado' : isCortesia ? '✓ Concessão Especial VIP Ativa' : '⚠️ Tentativa Não Liquidada / Não Concluída'}
            </div>
            <div style="font-size: 12px; color: #64748b; margin-top: 3px;">
              ${isPago ? `Efetivado em <strong>${dataPag} às ${horaPag}</strong>` : isCortesia ? `Ativado em <strong>${dataPag}</strong>` : `Registrado em <strong>${dataPag} às ${horaPag}</strong> (Sem cobrança)`}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">TOTAL ${isPago ? 'PAGO' : isCortesia ? 'ISENTO' : 'LIQUIDADO'}:</div>
            <div class="valor-total" style="color: ${isPago ? '#10b981' : isCortesia ? '#2563eb' : '#64748b'};">
              ${isPago ? `R$ ${valorFormatado}` : 'R$ 0,00'}
            </div>
            ${isTentativa ? `<div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">(Valor da tentativa: R$ ${valorFormatado} - Não cobrado)</div>` : ''}
          </div>
        </div>

        <div class="auth-banner">
          <span>Autenticação: <strong>AUTH-${codigo}-${dataPag.replace(/\//g, '')}</strong></span>
          <span>Emissão: <strong>${new Date().toLocaleDateString('pt-BR')}</strong></span>
        </div>

        <div class="footer">
          Celebre Tecnologia e Gestão de Eventos • CNPJ 00.000.000/0001-00<br>
          ${isPago ? `Este comprovante serve como recibo oficial de quitação da assinatura para o período de ${periodoInicio} a ${periodoFim}.` : isCortesia ? `Licença especial concedida pelo Super Admin da plataforma Celebre.` : `Registro informativo de auditoria. Esta tentativa não quitada não concede vigência nem liberação de módulos.`}
        </div>

        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    iframe.contentWindow.focus();
    setTimeout(() => {
      iframe.contentWindow.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }, 350);
  };

  return (
    <div className="recibo-modal-overlay" onClick={onClose}>
      <div className="recibo-modal-container" onClick={e => e.stopPropagation()}>
        
        {/* BARRA SUPERIOR (HEADER) */}
        <div className="recibo-modal-topbar">
          <div className="topbar-info">
            <span className="topbar-icon">🧾</span>
            <div>
              <h3 className="topbar-title">Comprovante de Assinatura</h3>
              <span className="topbar-code">{codigo}</span>
            </div>
          </div>

          <div className="topbar-actions">
            <button 
              type="button" 
              className="btn-print-recibo-modal" 
              onClick={dispararImpressao}
              title="Imprimir ou Salvar em PDF"
            >
              <i className="fas fa-print"></i> <span>Imprimir / Salvar PDF</span>
            </button>

            <button 
              type="button" 
              className="btn-close-recibo-modal" 
              onClick={onClose}
              title="Fechar Comprovante"
            >
              ✕
            </button>
          </div>
        </div>

        {/* CORPO E FOLHA DO RECIBO (PAPER CARD) */}
        <div className="recibo-modal-body">
          <div className="recibo-paper-card">
            
            {/* CABEÇALHO DA FOLHA */}
            <div className="recibo-paper-header">
              <div>
                <h1 className="recibo-brand-title">CELEBRE</h1>
                <div className="recibo-brand-sub">
                  {isAdmin 
                    ? 'Auditoria Financeira & Recibo de Assinatura Oficial • Administração' 
                    : 'Comprovante Oficial de Assinatura & Recibo de Pagamento'}
                </div>
              </div>

              <div className={`recibo-badge-pago ${isPago ? 'pago' : isCortesia ? 'cortesia' : 'recusado'}`}>
                {isPago ? '✓ PAGAMENTO CONCLUÍDO' : isCortesia ? '✓ CORTESIA VIP (ISENTO)' : '⚠️ TRANSAÇÃO NÃO QUITADA'}
              </div>
            </div>

            {/* GRADE DE INFORMAÇÕES */}
            <div className="recibo-grid-info">
              <div className="recibo-info-box">
                <label>Código da Fatura</label>
                <p className="bold-code">{codigo}</p>
                <div className="subtext">Identificador Único da Cobrança</div>
              </div>

              <div className="recibo-info-box">
                <label>{isPago ? 'Data do Pagamento' : isCortesia ? 'Data de Concessão VIP' : 'Data da Tentativa'}</label>
                <p>{dataPag} às {horaPag}</p>
                <div className="subtext">{isPago ? 'Data de liquidação bancária' : isCortesia ? 'Concessão administrativa' : 'Tentativa registrada (Não liquidado)'}</div>
              </div>

              <div className="recibo-info-box">
                <label>Período de Vigência / Cobertura</label>
                <p className="destaque-ouro">{isPago || isCortesia ? `${periodoInicio} a ${periodoFim}` : '—'}</p>
                <div className="subtext">{isPago || isCortesia ? 'Acesso liberado a todos os módulos' : 'Nenhuma vigência concedida'}</div>
              </div>

              <div className="recibo-info-box">
                <label>Próxima Renovação</label>
                <p>{isPago || isCortesia ? periodoFim : '—'}</p>
                <div className="subtext">{isPago || isCortesia ? `Ciclo ${cicloNome} automático` : 'Aguardando liquidação'}</div>
              </div>

              <div className="recibo-info-box">
                <label>Sacado / Assinante</label>
                <p>{empresaNome}</p>
                <div className="subtext">{email}</div>
              </div>

              <div className="recibo-info-box">
                <label>Forma de Processamento</label>
                <p>{metodo}</p>
                <div className="subtext">{isCortesia ? 'Concessão Administrativa' : isPago ? 'Gateway Mercado Pago Transações' : 'Tentativa de checkout'}</div>
              </div>
            </div>

            {/* TABELA DE ITENS */}
            <div className="recibo-table-wrapper">
              <table className="recibo-paper-table">
                <thead>
                  <tr>
                    <th>Item / Descrição</th>
                    <th>{isPago ? 'Data Pagamento' : 'Data'}</th>
                    <th>Período Coberto</th>
                    <th>Método</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong className="item-title">{itemDescricao}</strong>
                      <div className="item-sub">{subDetalhes}</div>
                    </td>
                    <td><strong>{dataPag}</strong></td>
                    <td>
                      {isPago || isCortesia ? (
                        <>
                          <strong>{periodoInicio} a {periodoFim}</strong>
                          <div className="item-status-pill">Plano {cicloNome} Ativo</div>
                        </>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>— (Não ativado)</span>
                      )}
                    </td>
                    <td>{metodo}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '15px' }}>
                      {isCortesia ? 'R$ 0,00' : `R$ ${valorFormatado}`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* CARD DE TOTAL */}
            <div className="recibo-total-card">
              <div>
                <div className={`status-text ${isPago ? 'pago' : isCortesia ? 'cortesia' : 'recusado'}`}>
                  {isPago ? '✓ Pagamento Confirmado e Quitado' : isCortesia ? '✓ Licença Especial VIP Concedida' : '✕ Tentativa Não Liquidada / Não Concluída'}
                </div>
                <div className="date-text">
                  {isPago ? (
                    <>Efetivado em <strong>{dataPag} às {horaPag}</strong></>
                  ) : isCortesia ? (
                    <>Ativado em <strong>{dataPag}</strong></>
                  ) : (
                    <>Registrado em <strong>{dataPag} às {horaPag}</strong></>
                  )}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="label-total">TOTAL {isPago ? 'PAGO' : isCortesia ? 'ISENTO' : 'LIQUIDADO'}:</div>
                <div className={`valor-total ${isPago ? 'pago' : isCortesia ? 'cortesia' : 'recusado'}`}>
                  {isPago ? `R$ ${valorFormatado}` : 'R$ 0,00'}
                </div>
                {isTentativa && (
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
                    (Valor da tentativa: R$ {valorFormatado} - Não cobrado)
                  </div>
                )}
              </div>
            </div>

            {/* AUTENTICAÇÃO DIGITAL */}
            <div className="recibo-auth-banner">
              <span>Autenticação Digital: <strong>AUTH-{codigo}-{dataPag.replace(/\//g, '')}</strong></span>
              <span>Emissão: <strong>{new Date().toLocaleDateString('pt-BR')}</strong></span>
            </div>

            {/* RODAPÉ DO COMPROVANTE */}
            <div className="recibo-paper-footer">
              <strong>Celebre Tecnologia e Gestão de Eventos</strong> • CNPJ 00.000.000/0001-00<br />
              Este comprovante serve como recibo oficial e termo de quitação da assinatura para o período de <strong>{periodoInicio} a {periodoFim}</strong>.
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default ModalReciboOficial;
