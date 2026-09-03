/**
 * 🎨 Celebre Theme & Dynamic Accent Color Engine
 * Gerencia a aplicação instantânea e global da Cor de Destaque da Marca
 * em todas as 16 páginas do sistema Celebre.
 */

export const escurecerHex = (hex, percent = 18) => {
  try {
    let c = (hex || '#c5a059').replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    let r = Math.max(0, (num >> 16) - Math.round(255 * (percent / 100)));
    let g = Math.max(0, ((num >> 8) & 0x00FF) - Math.round(255 * (percent / 100)));
    let b = Math.max(0, (num & 0x0000FF) - Math.round(255 * (percent / 100)));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  } catch (e) {
    return hex;
  }
};

export const aplicarCorDestaqueGlobal = (accentColorParam) => {
  const accentColor = accentColorParam || localStorage.getItem('accentColor') || '#c5a059';
  const darkerAccent = escurecerHex(accentColor, 18);

  // 1. Variáveis no elemento <html>
  document.documentElement.style.setProperty('--dourado', accentColor, 'important');
  document.documentElement.style.setProperty('--cor-destaque', accentColor, 'important');
  document.documentElement.style.setProperty('--primary-color', accentColor, 'important');
  document.documentElement.style.setProperty('--gold-primary', accentColor, 'important');
  document.documentElement.style.setProperty('--gold-dark', darkerAccent, 'important');
  document.documentElement.style.setProperty('--accent-color', accentColor, 'important');

  // 2. Injeção/Atualização da tag <style id="celebre-dynamic-theme-style"> no <head>
  // Esta tag fica no final do <head> e com !important VENCE qualquer regra hardcoded do CSS!
  let styleTag = document.getElementById('celebre-dynamic-theme-style');
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'celebre-dynamic-theme-style';
    document.head.appendChild(styleTag);
  }

  styleTag.textContent = `
    :root {
      --dourado: ${accentColor} !important;
      --cor-destaque: ${accentColor} !important;
      --primary-color: ${accentColor} !important;
      --gold-primary: ${accentColor} !important;
      --gold-dark: ${darkerAccent} !important;
      --accent-color: ${accentColor} !important;
    }

    /* ══════════════════════════════════════════════════════════════════════
       🎯 BOTÕES PRIMÁRIOS E DE AÇÃO — TODAS AS 16 PÁGINAS DO SISTEMA
       ══════════════════════════════════════════════════════════════════════ */
    .btn-primary,
    .btn-primary-celebre,
    .btn-novo,
    .btn-salvar,
    .btn-salvar-form,
    .btn-salvar-premium,
    .btn-salvar-cliente,
    .btn-salvar-produto,
    .btn-salvar-peca,
    .btn-salvar-solicitacao,
    .btn-salvar-lancamento,
    .btn-salvar-contrato,
    .btn-gerar-contrato,
    .btn-gerar-minuta,
    .btn-novo-cliente,
    .btn-dash-quick-action,
    .dash-quick-actions-grid button,
    .btn-ajustar-meta-dash,
    .btn-quick-action,
    .btn-header-action,
    .btn-exportar,
    .btn-novo-lancamento-unico,
    .btn-adicionar,
    .btn-add,
    .btn-cadastrar,
    .btn-confirmar,
    .btn-aplicar-frete,
    .btn-destaque-adc-pecas,
    .btn-add-cliente-luxo,
    .btn-banner-action,
    .btn-action-primary,
    .rel-btn-action-primary,
    .btn-salvar-modal,
    .btn-submit,
    .btn-log-primary,
    .btn-solicitar-orcamento,
    .btn-catalogo-primary,
    .btn-finalizar-locacao,
    .btn-salvar-orcamento,
    .btn-lancar-lote-contas {
      background: linear-gradient(135deg, ${accentColor} 0%, ${darkerAccent} 100%) !important;
      border-color: ${accentColor} !important;
      color: #ffffff !important;
      box-shadow: 0 4px 14px ${accentColor}40 !important;
    }

    .btn-primary:hover,
    .btn-primary-celebre:hover,
    .btn-novo:hover,
    .btn-salvar:hover,
    .btn-salvar-form:hover,
    .btn-novo-cliente:hover,
    .btn-dash-quick-action:hover,
    .dash-quick-actions-grid button:hover,
    .btn-log-primary:hover {
      filter: brightness(1.08) !important;
      box-shadow: 0 6px 18px ${accentColor}55 !important;
    }

    /* ══════════════════════════════════════════════════════════════════════
       🎯 ABAS ATIVAS E FILTROS EM DESTAQUE — TODAS AS 16 PÁGINAS
       ══════════════════════════════════════════════════════════════════════ */
    .tab-btn-celebre.active,
    [data-theme^='dark'] .tab-btn-celebre.active,
    [data-theme^='dark'] .financeiro-container .tab-btn-celebre.active,
    .fin-tab.active,
    .relatorio-tab.active,
    .tabs-relatorios-compacto button.active,
    .view-btn.active,
    .sub-btn.active,
    .view-switcher-btn.active,
    .view-toggle-btn.active,
    .btn-toggle.active,
    .chip-btn.active,
    .agenda-sidebar .menu-item.highlight.ativo,
    .active-deco,
    .sidebar-list li.destak,
    .mobile-etapa-btn.ativa,
    .kanban-filters button.ativo,
    .btn-chip-data.active,
    .rel-subtab-btn.active,
    .btn-tipo-toggle.active,
    .tipo-desconto-toggle button.active,
    .btn-servico-card.ativo .servico-check-badge,
    .btn-servico-card.ativo .servico-icon-box {
      background: linear-gradient(135deg, ${accentColor} 0%, ${darkerAccent} 100%) !important;
      border-color: transparent !important;
      color: #ffffff !important;
    }

    .tab-btn-celebre.active *,
    [data-theme^='dark'] .tab-btn-celebre.active *,
    [data-theme^='dark'] .financeiro-container .tab-btn-celebre.active *,
    .tabs-relatorios-compacto button.active * {
      color: #ffffff !important;
    }

    /* ══════════════════════════════════════════════════════════════════════
       🎯 CRONS E BADGES DE CABEÇALHO COM ÍCONE EM TODAS AS PÁGINAS
       ══════════════════════════════════════════════════════════════════════ */
    .header-icon-badge,
    .locacoes-hero-header .header-icon-badge,
    .clientes-hero-header .header-icon-badge,
    .financeiro-container .header-icon-badge,
    .estoque-hero-header .header-icon-badge,
    .compras-hero-header .header-icon-badge,
    .kanban-header .header-icon-badge,
    .contratos-hero-header .header-icon-badge,
    .relatorios-header-ajuste .header-icon-badge,
    .romaneio-icon-badge,
    .modal-checkin-header.header-ida {
      background: linear-gradient(135deg, ${accentColor} 0%, ${darkerAccent} 100%) !important;
      color: #ffffff !important;
      box-shadow: 0 4px 14px ${accentColor}40 !important;
    }

    /* ══════════════════════════════════════════════════════════════════════
       🎯 BORDAS ATIVAS, CARDS SELECIONADOS E FOCOS
       ══════════════════════════════════════════════════════════════════════ */
    .btn-servico-card.ativo,
    .btn-toggle-veiculo.ativo {
      border-color: ${accentColor} !important;
    }

    .header-titles strong,
    .origem-frete-tag,
    .icon-gold,
    .gold-text {
      color: ${accentColor} !important;
    }

    /* ══════════════════════════════════════════════════════════════════════
       🎯 LINKS E ÍCONES ATIVOS NA BARRA LATERAL (NAVBAR)
       ══════════════════════════════════════════════════════════════════════ */
    .menu-item.active {
      border-left: 3px solid ${accentColor} !important;
    }

    .menu-item.active i:not(.lock-icon),
    .menu-item:hover i:not(.lock-icon) {
      color: ${accentColor} !important;
    }

    /* ══════════════════════════════════════════════════════════════════════
       🎯 FOCO EM CAMPOS DE FORMULÁRIOS DE TODAS AS TELAS
       ══════════════════════════════════════════════════════════════════════ */
    input:focus,
    select:focus,
    textarea:focus,
    .search-input-field:focus,
    .search-input-wrapper input:focus,
    .search-box-acervo-compact:focus-within {
      border-color: ${accentColor} !important;
      outline-color: ${accentColor} !important;
    }

    /* ══════════════════════════════════════════════════════════════════════
       🎯 CHECKBOXES E BARRAS DE PROGRESSO
       ══════════════════════════════════════════════════════════════════════ */
    input[type="checkbox"]:checked,
    input[type="radio"]:checked {
      accent-color: ${accentColor} !important;
    }

    .progresso-fill,
    .progress-fill.fill-ida {
      background: linear-gradient(90deg, ${accentColor} 0%, ${darkerAccent} 100%) !important;
    }
  `;
};
