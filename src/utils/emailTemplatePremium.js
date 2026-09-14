/**
 * 💎 TEMPLATE TRANSACIONAL PREMIUM — CELEBRE LUXURY
 *
 * Motor central de e-mails profissionais da plataforma.
 * Inclui: Logo da locadora, Botão CTA, Resumo de itens,
 * WhatsApp no rodapé, Reply-To, dados fiscais anti-spam.
 *
 * USO:
 *   import { gerarEmailPremium } from './emailTemplatePremium';
 *   const html = gerarEmailPremium({ tipo: 'lembrete_retirada', dados, dadosLocadora });
 */

// ──────────────────────────────────────────────────────────────────────────────
// 1. GERADOR DO WRAPPER HTML PREMIUM (cabeçalho + corpo + rodapé)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Monta o HTML completo do e-mail transacional premium.
 */
export const gerarHtmlEmailPremium = ({
  assunto = 'Notificação • Celebre',
  badge = '',
  badgeCor = '#f0fdf4',
  badgeTextoCor = '#166534',
  titulo = '',
  corpo = '',
  ctaTexto = '',
  ctaUrl = '',
  ctaCor = '#c5a059',
  ctaTextoCor = '#0f172a',
  tabelaItens = '',
  dadosLocadora = {}
}) => {
  const nomeEmpresa = dadosLocadora.nomeEmpresa || dadosLocadora.nomeFantasia || 'Celebre Festas';
  const logoUrl = dadosLocadora.logoUrl || '';
  const whatsappEmpresa = (dadosLocadora.whatsapp || dadosLocadora.telefone || '19998564109').replace(/\D/g, '');
  const emailContato = dadosLocadora.emailContato || dadosLocadora.email || 'contato@celebrefesta.com.br';
  const cnpj = dadosLocadora.cnpj || '';
  const enderecoRodape = dadosLocadora.enderecoCompleto || dadosLocadora.endereco || 'Campinas - SP, Brasil';
  const whatsappTexto = dadosLocadora.whatsapp || dadosLocadora.telefone || '(19) 99856-4109';
  const siteUrl = dadosLocadora.site || 'https://celebrefesta.com.br';
  const anoAtual = new Date().getFullYear();

  const cabecalhoConteudo = logoUrl
    ? `<img src="${logoUrl}" alt="${nomeEmpresa}" style="max-height:60px;max-width:200px;object-fit:contain;" />`
    : `<h1 style="margin:0;font-size:26px;font-weight:900;letter-spacing:2px;color:#ffffff;">${nomeEmpresa.toUpperCase()}</h1>
       <p style="margin:6px 0 0 0;font-size:11px;color:#c5a059;text-transform:uppercase;letter-spacing:2.5px;font-weight:700;">Locação e Decoração de Festas</p>`;

  const badgeHtml = badge
    ? `<div style="display:inline-block;background-color:${badgeCor};border-radius:20px;padding:5px 14px;margin-bottom:18px;">
         <span style="color:${badgeTextoCor};font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;">${badge}</span>
       </div>`
    : '';

  const ctaHtml = ctaTexto && ctaUrl
    ? `<div style="text-align:center;margin:32px 0 20px 0;">
         <a href="${ctaUrl}" style="background:${ctaCor};color:${ctaTextoCor};text-decoration:none;padding:16px 42px;border-radius:12px;font-weight:900;font-size:15px;display:inline-block;box-shadow:0 6px 20px rgba(0,0,0,0.2);text-transform:uppercase;letter-spacing:0.5px;">${ctaTexto}</a>
       </div>`
    : '';

  const tabelaHtml = tabelaItens
    ? `<div style="margin:24px 0;">
         <strong style="font-size:13px;color:#0f172a;display:block;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">📋 Resumo das Peças / Itens da Locação:</strong>
         ${tabelaItens}
       </div>`
    : '';

  const dadosFiscaisHtml = cnpj
    ? `<p style="margin:4px 0 0 0;font-size:10px;color:#94a3b8;">CNPJ: ${cnpj} — ${enderecoRodape}</p>`
    : `<p style="margin:4px 0 0 0;font-size:10px;color:#94a3b8;">${enderecoRodape}</p>`;

  const whatsappMsg = encodeURIComponent('Olá, vim pelo e-mail de notificação e preciso de ajuda.');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${assunto}</title>
</head>
<body style="margin:0;padding:0;background-color:#0b0f19;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#334155;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0b0f19;padding:32px 12px;">
    <tr><td align="center">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.6);">
        <!-- CABEÇALHO -->
        <tr>
          <td style="background:linear-gradient(135deg,#090d16 0%,#0f172a 60%,#1a2236 100%);padding:32px 30px;text-align:center;border-bottom:3px solid #c5a059;">
            ${cabecalhoConteudo}
          </td>
        </tr>
        <!-- CORPO -->
        <tr>
          <td style="padding:36px 32px;background-color:#ffffff;">
            ${badgeHtml}
            ${titulo ? `<h2 style="margin:0 0 16px 0;font-size:22px;font-weight:800;color:#0f172a;line-height:1.35;">${titulo}</h2>` : ''}
            <div style="font-size:14.5px;line-height:1.7;color:#475569;">${corpo}</div>
            ${tabelaHtml}
            ${ctaHtml}
            <!-- CANAL WHATSAPP -->
            <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 18px;margin-top:28px;text-align:center;">
              <p style="margin:0;font-size:13px;color:#166534;line-height:1.5;">
                💬 Dúvidas? Fale diretamente com nossa equipe:<br/>
                <a href="https://wa.me/55${whatsappEmpresa}?text=${whatsappMsg}" style="color:#16a34a;font-weight:800;text-decoration:underline;font-size:14px;">📱 WhatsApp: ${whatsappTexto}</a>
              </p>
            </div>
          </td>
        </tr>
        <!-- RODAPÉ ANTI-SPAM -->
        <tr>
          <td style="background-color:#f8fafc;padding:20px 28px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;color:#64748b;">${nomeEmpresa}</p>
            <p style="margin:0;font-size:11px;color:#94a3b8;">
              Você recebeu este e-mail porque possui uma locação ativa conosco. Dúvidas ou descadastro:
              <a href="mailto:${emailContato}" style="color:#c5a059;text-decoration:none;">${emailContato}</a>
            </p>
            ${dadosFiscaisHtml}
            <p style="margin:10px 0 0 0;font-size:10px;color:#cbd5e1;">
              © ${anoAtual} ${nomeEmpresa} — Todos os direitos reservados.
              <a href="${siteUrl}" style="color:#c5a059;text-decoration:none;">Visite nosso site</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

// ──────────────────────────────────────────────────────────────────────────────
// 2. GERADOR DE TABELA DE ITENS DA LOCAÇÃO
// ──────────────────────────────────────────────────────────────────────────────

export const gerarTabelaItens = (itens = [], valorTotal = null) => {
  if (!itens || itens.length === 0) return '';

  const linhas = itens.map(item => {
    const desc = item.descricao || item.nome || item.produto || 'Item';
    const qtd = item.quantidade || item.qtd || 1;
    const valorUn = item.valorUnitario || item.valor || item.preco || null;
    const valorUnFmt = valorUn !== null ? `R$ ${Number(valorUn).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-';
    const subtotal = valorUn !== null ? `R$ ${(Number(valorUn) * Number(qtd)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-';
    return `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13.5px;color:#334155;">${desc}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13.5px;color:#334155;text-align:center;">${qtd}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13.5px;color:#334155;text-align:right;">${valorUnFmt}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13.5px;color:#334155;text-align:right;font-weight:700;">${subtotal}</td>
    </tr>`;
  }).join('');

  const totalHtml = valorTotal
    ? `<tr>
        <td colspan="3" style="padding:12px;font-weight:800;color:#0f172a;text-align:right;font-size:14px;border-top:2px solid #c5a059;">TOTAL DA LOCAÇÃO:</td>
        <td style="padding:12px;font-weight:900;color:#c5a059;text-align:right;font-size:15px;border-top:2px solid #c5a059;">R$ ${typeof valorTotal === 'number' ? valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : valorTotal}</td>
      </tr>`
    : '';

  return `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #e2e8f0;width:100%;border-radius:10px;overflow:hidden;">
    <thead>
      <tr style="background:linear-gradient(135deg,#0f172a,#1e293b);">
        <th style="padding:11px 12px;font-size:11.5px;font-weight:800;color:#c5a059;text-align:left;text-transform:uppercase;">Item / Peça</th>
        <th style="padding:11px 12px;font-size:11.5px;font-weight:800;color:#c5a059;text-align:center;text-transform:uppercase;">Qtd</th>
        <th style="padding:11px 12px;font-size:11.5px;font-weight:800;color:#c5a059;text-align:right;text-transform:uppercase;">Unit.</th>
        <th style="padding:11px 12px;font-size:11.5px;font-weight:800;color:#c5a059;text-align:right;text-transform:uppercase;">Subtotal</th>
      </tr>
    </thead>
    <tbody>${linhas}</tbody>
    ${totalHtml ? `<tfoot>${totalHtml}</tfoot>` : ''}
  </table>`;
};

// ──────────────────────────────────────────────────────────────────────────────
// 3. FÁBRICA DE TEMPLATES POR TIPO DE EVENTO
// ──────────────────────────────────────────────────────────────────────────────

export const gerarEmailPremium = (tipo, dados = {}, dadosLocadora = {}) => {
  const nomeCliente = dados.nomeCliente || dados.nome || 'Cliente';
  const numeroPedido = dados.numeroPedido || dados.idPedido || '';
  const nomeEmpresa = dadosLocadora.nomeEmpresa || dadosLocadora.nomeFantasia || dados.nomeEmpresa || 'Celebre Festas';
  const telefoneEmpresa = dadosLocadora.whatsapp || dadosLocadora.telefone || dados.telefoneEmpresa || '(19) 99856-4109';
  const enderecoGalpao = dadosLocadora.enderecoCompleto || dados.enderecoGalpao || 'Galpão Principal';
  const chavePix = dadosLocadora.chavePix || dados.chavePix || '';
  const linkContrato = dados.linkContrato || '';
  const dataRetirada = dados.dataRetirada || '';
  const dataDevolucao = dados.dataDevolucao || '';
  const horarioRetirada = dados.horarioRetirada || '09h00 às 17h00';
  const horarioDevolucao = dados.horarioDevolucao || '18h00';
  const dataEvento = dados.dataEvento || '';
  const valorTotal = dados.valorTotal;
  const itens = dados.itens || [];
  const tabelaItens = gerarTabelaItens(itens, valorTotal);
  const telLimpo = telefoneEmpresa.replace(/\D/g, '');

  const pedidoTag = numeroPedido
    ? `<span style="background:#fef9ec;border:1px solid #fde68a;border-radius:6px;padding:2px 10px;font-size:12px;font-weight:700;color:#92400e;margin-left:8px;">Pedido #${numeroPedido}</span>`
    : '';

  const locadoraOpts = { ...dadosLocadora, nomeEmpresa, telefone: telefoneEmpresa };

  switch (tipo) {

    case 'lembrete_retirada':
      return gerarHtmlEmailPremium({
        assunto: `🎉 Lembrete: A retirada do seu acervo é amanhã! • ${nomeEmpresa}`,
        badge: '📦 Lembrete de Retirada — Amanhã',
        badgeCor: '#fffbeb', badgeTextoCor: '#92400e',
        titulo: `Olá, ${nomeCliente}! A retirada é amanhã ✨`,
        corpo: `
          <p>Estamos preparando tudo com carinho para o seu evento! Confira os detalhes:</p>
          <div style="background:#f8fafc;border-left:4px solid #c5a059;border-radius:0 10px 10px 0;padding:18px 20px;margin:20px 0;">
            <p style="margin:0 0 10px 0;"><strong>📅 Data de Retirada:</strong> <span style="color:#c5a059;font-weight:700;">${dataRetirada}</span></p>
            <p style="margin:0 0 10px 0;"><strong>⏰ Horário:</strong> ${horarioRetirada}</p>
            <p style="margin:0;"><strong>📍 Local (Galpão):</strong> ${enderecoGalpao}</p>
          </div>
          <p>Lembre-se de trazer um documento de identificação${numeroPedido ? ` e informar o <strong>Pedido #${numeroPedido}</strong>` : ''} para agilizar a retirada. Nossa equipe estará pronta!</p>
        `,
        ctaTexto: '📍 Ver Localização do Galpão',
        ctaUrl: `https://maps.google.com/?q=${encodeURIComponent(enderecoGalpao)}`,
        ctaCor: '#c5a059', ctaTextoCor: '#0f172a',
        tabelaItens, dadosLocadora: locadoraOpts
      });

    case 'lembrete_devolucao':
      return gerarHtmlEmailPremium({
        assunto: `📦 Lembrete de Devolução do Acervo • ${nomeEmpresa}`,
        badge: '📦 Devolução — Hoje',
        badgeCor: '#eff6ff', badgeTextoCor: '#1d4ed8',
        titulo: `${nomeCliente}, esperamos que sua festa foi incrível! 🎉`,
        corpo: `
          <p>Chegou a hora de cuidar da devolução do seu acervo. Confira os detalhes:</p>
          <div style="background:#f8fafc;border-left:4px solid #3b82f6;border-radius:0 10px 10px 0;padding:18px 20px;margin:20px 0;">
            <p style="margin:0 0 10px 0;"><strong>📅 Data de Devolução:</strong> <span style="color:#3b82f6;font-weight:700;">${dataDevolucao}</span></p>
            <p style="margin:0 0 10px 0;"><strong>⏰ Horário Limite:</strong> ${horarioDevolucao}</p>
            <p style="margin:0;"><strong>📍 Endereço do Galpão:</strong> ${enderecoGalpao}</p>
          </div>
          <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:14px 18px;margin:20px 0;">
            <p style="margin:0;font-size:13.5px;color:#991b1b;">⚠️ <strong>Atenção:</strong> Devolva as peças limpas e acomodadas nas embalagens originais para evitar cobranças adicionais de avaria.</p>
          </div>
          <p>Muito obrigado pela confiança! Esperamos vê-lo(a) em breve. 🥂</p>
        `,
        ctaTexto: '📍 Ver Endereço para Devolução',
        ctaUrl: `https://maps.google.com/?q=${encodeURIComponent(enderecoGalpao)}`,
        ctaCor: '#3b82f6', ctaTextoCor: '#ffffff',
        tabelaItens, dadosLocadora: locadoraOpts
      });

    case 'alerta_atraso':
      return gerarHtmlEmailPremium({
        assunto: `⚠️ Aviso Urgente: Atraso na Devolução de Peças • ${nomeEmpresa}`,
        badge: '⚠️ Ação Necessária — Devolução em Atraso',
        badgeCor: '#fef2f2', badgeTextoCor: '#b91c1c',
        titulo: `${nomeCliente}, identificamos um atraso na devolução ${pedidoTag}`,
        corpo: `
          <p>Nossa equipe identificou que as peças referentes à sua locação ainda não deram entrada em nosso galpão, após a data prevista de <strong style="color:#ef4444;">${dataDevolucao}</strong>.</p>
          <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:0 10px 10px 0;padding:18px 20px;margin:20px 0;">
            <p style="margin:0 0 8px 0;font-weight:700;color:#7f1d1d;">📋 Situação Atual:</p>
            <p style="margin:0 0 6px 0;">• Devolução prevista: <strong>${dataDevolucao}</strong></p>
            <p style="margin:0;">• Status: <span style="color:#ef4444;font-weight:700;">⏰ Material não localizado no galpão</span></p>
          </div>
          <p>Por favor, entre em contato com nossa equipe <strong>imediatamente</strong> para alinhar a devolução e evitar a cobrança de diárias adicionais.</p>
        `,
        ctaTexto: '📱 Entrar em Contato Agora',
        ctaUrl: `https://wa.me/55${telLimpo}?text=${encodeURIComponent(`Olá, ${nomeEmpresa}! Recebi o aviso de atraso do Pedido #${numeroPedido} e gostaria de resolver.`)}`,
        ctaCor: '#ef4444', ctaTextoCor: '#ffffff',
        tabelaItens, dadosLocadora: locadoraOpts
      });

    case 'contrato_assinatura':
      return gerarHtmlEmailPremium({
        assunto: `📜 Seu Contrato de Locação está Pronto para Assinatura • ${nomeEmpresa}`,
        badge: '✍️ Contrato Digital Disponível',
        badgeCor: '#f0fdf4', badgeTextoCor: '#166534',
        titulo: `${nomeCliente}, seu contrato aguarda sua assinatura! ${pedidoTag}`,
        corpo: `
          <p>O contrato de locação para seu evento foi gerado com sucesso e está pronto para <strong>assinatura digital</strong> diretamente do seu celular ou computador — rápido, seguro e sem impressão.</p>
          <div style="background:#f0fdf4;border-left:4px solid #10b981;border-radius:0 10px 10px 0;padding:18px 20px;margin:20px 0;">
            ${numeroPedido ? `<p style="margin:0 0 6px 0;"><strong>📋 Pedido:</strong> #${numeroPedido}</p>` : ''}
            ${dataEvento ? `<p style="margin:0 0 6px 0;"><strong>🎉 Data do Evento:</strong> ${dataEvento}</p>` : ''}
            ${dataRetirada ? `<p style="margin:0;"><strong>📦 Retirada:</strong> ${dataRetirada} — ${horarioRetirada}</p>` : ''}
          </div>
          <p>Ao assinar, sua reserva de acervo estará <strong>100% garantida</strong>!</p>
        `,
        ctaTexto: '✍️ Assinar Contrato Agora',
        ctaUrl: linkContrato || 'https://celebrefesta.com.br',
        ctaCor: '#10b981', ctaTextoCor: '#ffffff',
        tabelaItens, dadosLocadora: locadoraOpts
      });

    case 'cobranca_avaria': {
      const valorFmt = typeof valorTotal === 'number'
        ? valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
        : (valorTotal || '0,00');
      return gerarHtmlEmailPremium({
        assunto: `🛠️ Demonstrativo de Vistoria e Regularização • ${nomeEmpresa}`,
        badge: '🛠️ Vistoria Concluída — Pendência Financeira',
        badgeCor: '#fffbeb', badgeTextoCor: '#92400e',
        titulo: `${nomeCliente}, sua vistoria foi concluída ${pedidoTag}`,
        corpo: `
          <p>Concluímos a conferência de entrada do acervo. Durante a vistoria, identificamos itens com avarias ou que necessitam de reposição.</p>
          <div style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 10px 10px 0;padding:18px 20px;margin:20px 0;">
            <p style="margin:0 0 8px 0;font-weight:700;color:#78350f;">💰 Resumo Financeiro:</p>
            <p style="margin:0 0 6px 0;">• <strong>Valor de Regularização:</strong> <span style="color:#f59e0b;font-weight:800;font-size:16px;">R$ ${valorFmt}</span></p>
            ${chavePix ? `<p style="margin:0;">• <strong>Chave Pix:</strong> <code style="background:#0f172a;color:#f5d061;padding:2px 8px;border-radius:6px;">${chavePix}</code></p>` : ''}
          </div>
          ${chavePix ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 18px;margin:20px 0;text-align:center;">
            <p style="margin:0 0 4px 0;font-size:12px;color:#166534;font-weight:700;">🔑 Chave Pix para Pagamento:</p>
            <p style="margin:0;font-size:18px;font-weight:900;color:#0f172a;letter-spacing:1px;">${chavePix}</p>
          </div>` : ''}
          <p>Para ver o relatório fotográfico ou discutir o demonstrativo, entre em contato. Agradecemos sua compreensão!</p>
        `,
        ctaTexto: chavePix ? '💳 Confirmar Pagamento via WhatsApp' : '📞 Entrar em Contato',
        ctaUrl: `https://wa.me/55${telLimpo}?text=${encodeURIComponent(`Olá! Recebi o demonstrativo de avaria do Pedido #${numeroPedido} e gostaria de confirmar o pagamento.`)}`,
        ctaCor: '#f59e0b', ctaTextoCor: '#0f172a',
        tabelaItens, dadosLocadora: locadoraOpts
      });
    }

    case 'boas_vindas_catalogo':
      return gerarHtmlEmailPremium({
        assunto: `🎉 Recebemos sua solicitação! • ${nomeEmpresa}`,
        badge: '🎉 Solicitação Recebida com Sucesso',
        badgeCor: '#faf5ff', badgeTextoCor: '#6d28d9',
        titulo: `${nomeCliente}, que alegria receber você! ✨`,
        corpo: `
          <p>Recebemos com muito carinho sua solicitação através da nossa vitrine digital! Nossa equipe já está analisando a disponibilidade das peças para o seu evento.</p>
          <div style="background:#faf5ff;border-left:4px solid #8b5cf6;border-radius:0 10px 10px 0;padding:18px 20px;margin:20px 0;">
            <p style="margin:0 0 8px 0;font-weight:700;color:#4c1d95;">📋 O que acontece agora?</p>
            <p style="margin:0 0 6px 0;">✅ Verificação de disponibilidade em andamento</p>
            ${dataEvento ? `<p style="margin:0 0 6px 0;">📅 Evento em: <strong>${dataEvento}</strong></p>` : ''}
            <p style="margin:0;">📞 Em breve nossa equipe entrará em contato com sua proposta personalizada!</p>
          </div>
          <p>Mal podemos esperar para tornar sua celebração inesquecível! 🥂</p>
        `,
        ctaTexto: '🛍️ Ver Mais Peças no Catálogo',
        ctaUrl: 'https://celebrefesta.com.br/catalogo',
        ctaCor: '#8b5cf6', ctaTextoCor: '#ffffff',
        tabelaItens, dadosLocadora: locadoraOpts
      });

    default:
      return gerarHtmlEmailPremium({
        assunto: `Notificação • ${nomeEmpresa}`,
        badge: '🔔 Notificação do Sistema',
        badgeCor: '#f8fafc', badgeTextoCor: '#475569',
        titulo: `Olá, ${nomeCliente}!`,
        corpo: `<p>Você tem uma nova notificação da <strong>${nomeEmpresa}</strong>. Para mais informações, entre em contato com nossa equipe.</p>`,
        ctaTexto: '📱 Falar com a Equipe',
        ctaUrl: `https://wa.me/55${telLimpo}`,
        ctaCor: '#c5a059', ctaTextoCor: '#0f172a',
        dadosLocadora: locadoraOpts
      });
  }
};
