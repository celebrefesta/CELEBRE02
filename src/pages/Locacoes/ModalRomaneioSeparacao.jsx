import React, { useState } from 'react';
import './ModalRomaneioSeparacao.css';

export default function ModalRomaneioSeparacao({ pedido, onClose }) {
  if (!pedido) return null;

  // Extrai lista de itens com segurança
  const listaItens = pedido.itens || pedido.itensContratados || pedido.carrinho || [];
  
  // Estado para armazenar itens conferidos
  const [checkedMap, setCheckedMap] = useState({});

  const toggleCheck = (idx) => {
    setCheckedMap(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  // Estatísticas de conferência
  const totalItens = listaItens.length;
  const conferidosCount = Object.values(checkedMap).filter(Boolean).length;
  const porcentagem = totalItens > 0 ? Math.round((conferidosCount / totalItens) * 100) : 0;

  // Formatação de datas
  const dataRetiradaFmt = pedido.dataRetirada 
    ? new Date(pedido.dataRetirada + 'T12:00:00').toLocaleDateString('pt-BR') 
    : '-';
  const dataDevolucaoFmt = pedido.dataDevolucao 
    ? new Date(pedido.dataDevolucao + 'T12:00:00').toLocaleDateString('pt-BR') 
    : '-';

  // Enviar checklist formatado via WhatsApp
  const enviarWhatsAppChecklist = () => {
    let msg = `*📋 ROMANEIO DE SEPARAÇÃO - CELEBRE FESTAS*\n`;
    msg += `*Pedido:* #${pedido.numeroPedido || pedido.id?.substring(0,6)}\n`;
    msg += `*Cliente:* ${pedido.clienteNome || 'Cliente'}\n`;
    msg += `*Data Retirada:* ${dataRetiradaFmt}\n`;
    msg += `*Data Devolução:* ${dataDevolucaoFmt}\n`;
    msg += `*Modalidade:* ${pedido.tipoServicoFormatado || 'Locação'}\n\n`;
    msg += `*ITENS DO ACERVO (${conferidosCount}/${totalItens} conferidos):*\n`;

    listaItens.forEach((item, idx) => {
      const isConferido = !!checkedMap[idx];
      const statusIcon = isConferido ? '✅' : '⏳';
      const qtd = item.quantidade || item.qtd || 1;
      const nome = item.nome || item.titulo || item.nomePeca || 'Peça sem nome';
      msg += `${statusIcon} ${qtd}x ${nome}\n`;
    });

    if (pedido.observacoes) {
      msg += `\n*Observações:* ${pedido.observacoes}\n`;
    }

    const foneClean = pedido.clienteTelefone ? pedido.clienteTelefone.replace(/\D/g, '') : '';
    const numFinal = foneClean.startsWith('55') ? foneClean : `55${foneClean}`;
    const url = `https://api.whatsapp.com/send?phone=${numFinal}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay-romaneio animate-fade-in" onClick={onClose}>
      <div className="modal-box-romaneio" onClick={(e) => e.stopPropagation()}>
        
        {/* CABEÇALHO DO MODAL */}
        <div className="romaneio-header">
          <div className="romaneio-header-title">
            <span className="romaneio-icon-badge">📋</span>
            <div>
              <h2>Romaneio & Checklist de Galpão</h2>
              <p>Conferência de separação e embarque do acervo</p>
            </div>
          </div>
          <button className="romaneio-btn-fechar" onClick={onClose} title="Fechar modal">✕</button>
        </div>

        {/* CARTÃO DE RESUMO DO PEDIDO */}
        <div className="romaneio-pedido-summary">
          <div className="summary-col">
            <span className="summary-label">PEDIDO</span>
            <strong className="summary-val gold">
              #{pedido.numeroPedido || (pedido.id ? pedido.id.substring(0,6).toUpperCase() : 'S/N')}
            </strong>
          </div>

          <div className="summary-col">
            <span className="summary-label">CLIENTE</span>
            <strong className="summary-val">{pedido.clienteNome || 'Cliente não identificado'}</strong>
          </div>

          <div className="summary-col">
            <span className="summary-label">SAÍDA / RETIRADA</span>
            <strong className="summary-val">📅 {dataRetiradaFmt}</strong>
          </div>

          <div className="summary-col">
            <span className="summary-label">DEVOLUÇÃO</span>
            <strong className="summary-val">📦 {dataDevolucaoFmt}</strong>
          </div>

          <div className="summary-col">
            <span className="summary-label">MODALIDADE</span>
            <span className="badge-modalidade">
              {pedido.tipoServicoFormatado || 'PEGUE E MONTE'}
            </span>
          </div>
        </div>

        {/* BARRA DE PROGRESSO DA SEPARAÇÃO */}
        <div className="romaneio-progresso-bar-container">
          <div className="progresso-text-row">
            <span>Progresso da Separação</span>
            <strong>{conferidosCount} de {totalItens} itens ({porcentagem}%)</strong>
          </div>
          <div className="progresso-track">
            <div 
              className="progresso-fill" 
              style={{ width: `${porcentagem}%` }}
            />
          </div>
        </div>

        {/* LISTA DE PEÇAS / CHECKLIST */}
        <div className="romaneio-lista-container">
          {listaItens.length === 0 ? (
            <div className="romaneio-vazio">
              <span>📦 Nenhum item listado neste pedido.</span>
            </div>
          ) : (
            <div className="romaneio-items-grid">
              {listaItens.map((item, idx) => {
                const isChecked = !!checkedMap[idx];
                const qtd = item.quantidade || item.qtd || 1;
                const nome = item.nome || item.titulo || item.nomePeca || 'Peça sem nome';
                const categoria = item.categoria || item.subcategoria || 'Acervo';
                const foto = item.foto || item.imagem || item.fotoUrl;

                return (
                  <div 
                    key={idx} 
                    className={`romaneio-item-card ${isChecked ? 'checked' : ''}`}
                    onClick={() => toggleCheck(idx)}
                  >
                    <div className="checkbox-custom">
                      <input 
                        type="checkbox" 
                        checked={isChecked} 
                        onChange={() => {}} // controlado pelo onClick da div
                      />
                      <span className="checkmark"></span>
                    </div>

                    {foto ? (
                      <img src={foto} alt={nome} className="item-foto-thumb" />
                    ) : (
                      <div className="item-foto-placeholder">📦</div>
                    )}

                    <div className="item-details">
                      <div className="item-name-row">
                        <strong>{nome}</strong>
                        <span className="item-qtd-badge">x{qtd}</span>
                      </div>
                      <span className="item-categoria-text">🏷️ {categoria}</span>
                    </div>

                    <div className="item-status-icon">
                      {isChecked ? '✅ OK' : '⏳ Pendente'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ÁREA IMPRESSÃO (VISÍVEL APENAS NA IMPRESSÃO A4/TÉRMICA) */}
        <div className="romaneio-print-sheet">
          <div className="print-header">
            <h2>CELEBRE FESTAS - ROMANEIO DE SEPARAÇÃO</h2>
            <p>Data de emissão: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
          </div>
          <table className="print-table">
            <thead>
              <tr>
                <th>[ ]</th>
                <th>QTD</th>
                <th>PEÇA / DESCRIÇÃO</th>
                <th>CATEGORIA</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {listaItens.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ textalign: 'center' }}>[ &nbsp; ]</td>
                  <td style={{ fontWeight: 'bold' }}>{item.quantidade || item.qtd || 1}x</td>
                  <td style={{ fontWeight: 'bold' }}>{item.nome || item.titulo || 'Peça'}</td>
                  <td>{item.categoria || '-'}</td>
                  <td>Conferido por: ________________</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="print-footer">
            <p>Assinatura Responsável Separação: _________________________________________</p>
            <p>Assinatura Cliente / Motorista: _________________________________________</p>
          </div>
        </div>

        {/* RODAPÉ E BOTOES DE AÇÃO */}
        <div className="romaneio-footer-actions">
          <button 
            type="button" 
            className="btn-romaneio-secundario"
            onClick={enviarWhatsAppChecklist}
            title="Enviar lista por WhatsApp"
          >
            💬 Enviar WhatsApp
          </button>

          <button 
            type="button" 
            className="btn-romaneio-secundario"
            onClick={handlePrint}
            title="Imprimir folha de separação para galpão"
          >
            🖨️ Imprimir Romaneio
          </button>

          <button 
            type="button" 
            className="btn-romaneio-concluir"
            onClick={onClose}
          >
            ✓ Concluir Conferência
          </button>
        </div>

      </div>
    </div>
  );
}
