import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { gerarRelatorioFaturamentoAdminPDF } from '../../utils/gerarRelatorioFaturamentoAdminPDF';
import './ModalRelatorioMensalAdmin.css';

const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const ModalRelatorioMensalAdmin = ({
  isOpen,
  onClose,
  faturas = [],
  clientes = []
}) => {
  if (!isOpen) return null;

  const dataAtual = new Date();
  const [mesSelecionado, setMesSelecionado] = useState(String(dataAtual.getMonth() + 1));
  const [anoSelecionado, setAnoSelecionado] = useState(String(dataAtual.getFullYear()));
  const [somenteQuitadas, setSomenteQuitadas] = useState(false);
  const [gerando, setGerando] = useState(false);

  // 🔍 Filtra as faturas de acordo com o mês/ano selecionado
  const faturasDoPeriodo = useMemo(() => {
    return faturas.filter(f => {
      if (!f.dataObj) return false;
      const d = f.dataObj;
      const mesF = d.getMonth() + 1;
      const anoF = d.getFullYear();

      if (mesSelecionado !== 'todos' && mesF !== Number(mesSelecionado)) {
        return false;
      }
      if (anoSelecionado !== 'todos' && anoF !== Number(anoSelecionado)) {
        return false;
      }
      if (somenteQuitadas && f.status !== 'concluido' && f.status !== 'cortesia') {
        return false;
      }
      return true;
    });
  }, [faturas, mesSelecionado, anoSelecionado, somenteQuitadas]);

  // Cálculos rápidos de prévia
  const previaMetricas = useMemo(() => {
    let receita = 0;
    let quitadas = 0;
    let falhas = 0;
    let cortesias = 0;

    faturasDoPeriodo.forEach(f => {
      if (f.status === 'concluido') {
        receita += Number(f.valor) || 0;
        quitadas++;
      } else if (f.status === 'falha') {
        falhas++;
      } else if (f.status === 'cortesia') {
        cortesias++;
      }
    });

    return {
      receita,
      quitadas,
      falhas,
      cortesias,
      total: faturasDoPeriodo.length
    };
  }, [faturasDoPeriodo]);

  const nomeMesExtenso = mesSelecionado === 'todos' 
    ? 'Ano Completo' 
    : NOMES_MESES[Number(mesSelecionado) - 1];

  const periodoRotulo = mesSelecionado === 'todos'
    ? `Ano ${anoSelecionado}`
    : `${nomeMesExtenso} / ${anoSelecionado}`;

  const executarEmissao = (modo = 'download') => {
    setGerando(true);
    try {
      gerarRelatorioFaturamentoAdminPDF({
        faturas: faturasDoPeriodo,
        clientes,
        periodoRotulo,
        mesNome: nomeMesExtenso,
        ano: anoSelecionado,
        somenteQuitadas,
        modo
      });
      if (modo === 'download') {
        onClose();
      }
    } catch (err) {
      console.error("Erro ao gerar relatório em PDF:", err);
      alert("Não foi possível emitir o relatório em PDF. Verifique os dados.");
    } finally {
      setGerando(false);
    }
  };

  return createPortal(
    <div className="modal-relatorio-backdrop" onClick={onClose}>
      <div className="modal-relatorio-card" onClick={e => e.stopPropagation()}>
        
        {/* Cabeçalho do Modal */}
        <div className="modal-relatorio-header">
          <div className="modal-relatorio-header-icon">
            <i className="fas fa-file-pdf"></i>
          </div>
          <div className="modal-relatorio-header-info">
            <h3>Relatório Mensal em PDF • Auditoria</h3>
            <p>Emita o extrato consolidado e analítico de faturamento para controle gerencial</p>
          </div>
          <button type="button" className="btn-modal-relatorio-close" onClick={onClose} title="Fechar">
            ✕
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="modal-relatorio-body">
          
          {/* Linha de Parâmetros: Mês e Ano */}
          <div className="relatorio-params-grid">
            
            <div className="relatorio-form-group">
              <label><i className="fas fa-calendar-alt"></i> Mês de Referência</label>
              <select 
                value={mesSelecionado} 
                onChange={e => setMesSelecionado(e.target.value)}
                className="relatorio-select"
              >
                {NOMES_MESES.map((m, idx) => (
                  <option key={idx + 1} value={String(idx + 1)}>
                    {m}
                  </option>
                ))}
                <option value="todos">Todo o Ano (Consolidado)</option>
              </select>
            </div>

            <div className="relatorio-form-group">
              <label><i className="fas fa-history"></i> Ano</label>
              <select 
                value={anoSelecionado} 
                onChange={e => setAnoSelecionado(e.target.value)}
                className="relatorio-select"
              >
                <option value="2026">2026</option>
                <option value="2025">2025</option>
                <option value="todos">Todos os Anos</option>
              </select>
            </div>

          </div>

          {/* Opção de Filtro Estrito */}
          <div className="relatorio-checkbox-wrapper">
            <label className="relatorio-checkbox-label">
              <input 
                type="checkbox" 
                checked={somenteQuitadas} 
                onChange={e => setSomenteQuitadas(e.target.checked)}
                className="relatorio-checkbox"
              />
              <span>Incluir apenas <strong>Faturas Quitadas</strong> (ocultar recusas e tentativas não pagas)</span>
            </label>
          </div>

          {/* Card de Prévia Executiva */}
          <div className="relatorio-previa-card">
            <div className="previa-header">
              <span className="previa-title">
                <i className="fas fa-chart-pie"></i> Prévia do Relatório ({periodoRotulo})
              </span>
              <span className="previa-badge">
                {previaMetricas.total} {previaMetricas.total === 1 ? 'registro' : 'registros'}
              </span>
            </div>

            <div className="previa-grid">
              <div className="previa-item destaque-receita">
                <span className="previa-label">Receita Liquidada</span>
                <strong className="previa-val">R$ {previaMetricas.receita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                <small className="previa-sub">{previaMetricas.quitadas} quitados</small>
              </div>

              <div className="previa-item">
                <span className="previa-label">Faturas Concluídas</span>
                <strong className="previa-val verde">{previaMetricas.quitadas}</strong>
                <small className="previa-sub">100% compensadas</small>
              </div>

              <div className="previa-item">
                <span className="previa-label">Falhas / Recusas</span>
                <strong className="previa-val vermelho">{previaMetricas.falhas}</strong>
                <small className="previa-sub">Cartões rejeitados</small>
              </div>

              <div className="previa-item">
                <span className="previa-label">Cortesias VIP</span>
                <strong className="previa-val azul">{previaMetricas.cortesias}</strong>
                <small className="previa-sub">Licenças ativas</small>
              </div>
            </div>

            {previaMetricas.total === 0 && (
              <div className="previa-aviso-vazio">
                <i className="fas fa-info-circle"></i> Não foram encontrados registros de faturamento para {periodoRotulo}. O PDF será gerado com o resumo cadastral da base.
              </div>
            )}
          </div>

        </div>

        {/* Rodapé de Ações */}
        <div className="modal-relatorio-footer">
          <button 
            type="button" 
            className="btn-relatorio-cancelar" 
            onClick={onClose}
          >
            Cancelar
          </button>

          <div className="modal-relatorio-actions-group">
            <button 
              type="button" 
              className="btn-relatorio-preview"
              onClick={() => executarEmissao('preview')}
              disabled={gerando}
              title="Abrir pré-visualização para impressão"
            >
              <i className="fas fa-eye"></i> Visualizar / Imprimir
            </button>

            <button 
              type="button" 
              className="btn-relatorio-download"
              onClick={() => executarEmissao('download')}
              disabled={gerando}
              title="Baixar arquivo PDF completo"
            >
              <i className={`fas ${gerando ? 'fa-spinner fa-spin' : 'fa-file-pdf'}`}></i>
              {gerando ? 'Gerando Relatório...' : 'Baixar PDF Completo'}
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};

export default ModalRelatorioMensalAdmin;
