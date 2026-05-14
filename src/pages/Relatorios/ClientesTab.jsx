import React, { useState, useEffect } from "react";
import { db } from "../../firebaseConfig";
import { collection, getDocs, doc, getDoc, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth"; 
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; 
import './ClientesTab.css'; 

const ClientesTab = () => {
  // 🔥 Autenticação
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;

  const [loading, setLoading] = useState(true);
  const [metricas, setMetricas] = useState({ 
    total: 0, 
    novosMes: 0, 
    inativos: 0, 
    ticketMedio: 0,
    clientesFieis: 0,
    taxaRetorno: 0 
  });
  const [rankingCidades, setRankingCidades] = useState([]);
  const [topClientes, setTopClientes] = useState([]);
  const [todosClientesData, setTodosClientesData] = useState([]);
  
  const [dadosEmpresa, setDadosEmpresa] = useState({
    nomeEmpresa: 'Ágape Decorações',
    logotipo: ''
  });

  // 🔥 SISTEMA DE AUDITORIA (ESPIÃO DE CLIENTES)
  const registrarLog = async (acao, detalhes) => {
    if (!usuarioLogado) return;
    try {
      const nomeEquipa = usuarioLogado?.displayName || usuarioLogado?.email || "Equipa";
      await addDoc(collection(db, "logs_atividades"), {
        data: new Date(),
        criadoEm: serverTimestamp(),
        funcionario: nomeEquipa,
        usuarioNome: nomeEquipa,
        usuarioEmail: usuarioLogado?.email || "Desconhecido",
        acao: acao.toUpperCase(),
        detalhes: detalhes,
        userId: usuarioLogado?.uid
      });
    } catch (error) {
      console.error("Erro ao gravar log da auditoria de clientes:", error);
    }
  };

  useEffect(() => {
    if (!usuarioLogado) return;

    const buscarDadosClientesEConfigs = async () => {
      try {
        // 🔥 BLINDAGEM MULTI-EMPRESA: Filtra clientes e locações pela sua conta
        const qClientes = query(collection(db, "clientes"), where("userId", "==", usuarioLogado.uid));
        const qLocacoes = query(collection(db, "locacoes"), where("userId", "==", usuarioLogado.uid));

        const [snapClientes, snapLocacoes, snapConfig] = await Promise.all([
          getDocs(qClientes),
          getDocs(qLocacoes),
          getDoc(doc(db, "sistema", "parametros"))
        ]);

        if (snapConfig.exists()) {
          const configData = snapConfig.data();
          setDadosEmpresa({
            nomeEmpresa: configData.nomeEmpresa || 'Ágape Decorações',
            logotipo: configData.logotipo || ''
          });
        }

        const clientes = snapClientes.docs.map(d => ({ id: d.id, ...d.data() }));
        const locacoes = snapLocacoes.docs.map(d => ({ id: d.id, ...d.data() }));

        const totalClientes = clientes.length;
        const hoje = new Date();
        const novosMes = clientes.filter(c => {
          if (!c.criadoEm) return false;
          const d = c.criadoEm.toDate ? c.criadoEm.toDate() : new Date(c.criadoEm);
          return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
        }).length;

        let somaTotal = 0;
        const cidadesCount = {};
        const clientesStats = {}; 

        locacoes.forEach(loc => {
          const valor = Number(loc.valorTotal) || 0;
          somaTotal += valor;
          const cidade = loc.logistica?.cidade || "Retirada na Loja";
          cidadesCount[cidade] = (cidadesCount[cidade] || 0) + 1;

          const cid = loc.clienteId;
          if (cid) {
            if (!clientesStats[cid]) {
              clientesStats[cid] = { nome: loc.clienteNome, qtdLocacoes: 0, gastoTotal: 0, ultimaLocacao: new Date(0) };
            }
            clientesStats[cid].qtdLocacoes += 1;
            clientesStats[cid].gastoTotal += valor;
            let dataLoc = loc.dataRetirada ? new Date(loc.dataRetirada) : (loc.criadoEm?.toDate ? loc.criadoEm.toDate() : new Date(0));
    
            if (dataLoc > clientesStats[cid].ultimaLocacao) clientesStats[cid].ultimaLocacao = dataLoc;
          }
        });
        
        const ticketMedio = locacoes.length > 0 ? (somaTotal / locacoes.length) : 0;
        const seisMesesAtras = new Date();
        seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);
        
        const listaStats = Object.values(clientesStats);
        const clientesFieis = listaStats.filter(c => c.qtdLocacoes > 1).length;
        const taxaRetorno = totalClientes > 0 ? (clientesFieis / totalClientes) * 100 : 0;

        let inativosCount = 0;
        const clientesFormatadosRelatorio = clientes.map(c => {
          const stat = clientesStats[c.id] || { qtdLocacoes: 0, gastoTotal: 0, ultimaLocacao: null };
          let isInativo = false;
          if (!stat.ultimaLocacao) {
            const criacao = c.criadoEm?.toDate ? c.criadoEm.toDate() : new Date(c.criadoEm || 0);
            if (criacao < seisMesesAtras) isInativo = true;
          } else if (stat.ultimaLocacao < seisMesesAtras) {
            isInativo = true;
          }
          if (isInativo) inativosCount++;

          return {
            nome: c.nome || c.nomeFantasia || "Sem Nome",
            cidade: c.cidade || "Não inf.",
            festas: stat.qtdLocacoes,
            totalGasto: stat.gastoTotal,
            status: isInativo ? "Inativo" : "Ativo"
          };
        });
        
        setMetricas({ 
          total: totalClientes, 
          novosMes, 
          inativos: inativosCount, 
          ticketMedio,
          clientesFieis,
          taxaRetorno
        });
        
        setRankingCidades(Object.entries(cidadesCount).sort((a, b) => b[1] - a[1]).slice(0, 5));
        setTopClientes(listaStats.sort((a, b) => b.gastoTotal - a.gastoTotal).slice(0, 8));
        setTodosClientesData(clientesFormatadosRelatorio);

      } catch (error) { 
        console.error(error);
      } finally { 
        setLoading(false); 
      }
    };
    
    buscarDadosClientesEConfigs();
  }, [usuarioLogado]);
  
  const exportarRelatorioGeral = async () => {
    try {
      const docPDF = new jsPDF();
      let startY = 25; 

      if (dadosEmpresa.logotipo) {
        docPDF.addImage(dadosEmpresa.logotipo, 'PNG', 14, 10, 30, 30);
        docPDF.setFontSize(20);
        docPDF.setTextColor(15, 23, 42);
        docPDF.text(dadosEmpresa.nomeEmpresa, 48, 22);
        docPDF.setFontSize(12);
        docPDF.setTextColor(100, 116, 139);
        docPDF.text("Relatório Geral de Clientes", 48, 30);
        startY = 45;
      } else {
        docPDF.setFontSize(18);
        docPDF.setTextColor(15, 23, 42);
        docPDF.text(`Relatório de Clientes - ${dadosEmpresa.nomeEmpresa}`, 14, 22);
      }

      autoTable(docPDF, {
        head: [["Nome do Cliente", "Cidade", "Festas", "Gasto Total (R$)", "Status"]],
        body: todosClientesData.sort((a,b) => b.totalGasto - a.totalGasto).map(c => [
          c.nome, 
          c.cidade, 
          c.festas, 
          `R$ ${c.totalGasto.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
          c.status
        ]),
        startY: startY,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42] }
      });
      
      docPDF.save(`Relatorio_Clientes_${dadosEmpresa.nomeEmpresa.replace(/\s+/g, '_')}.pdf`);

      // 🔥 Aciona o espião de exportação
      await registrarLog("EXPORTAÇÃO DE RELATÓRIO DE CLIENTES", `Fez o download do relatório VIP e geral de clientes em PDF.`);

    } catch (e) { 
      alert("Erro ao gerar PDF"); 
      console.error(e);
    }
  };

  if (loading) return <div className="loading-v3">Analisando carteira de clientes...</div>;

  return (
    <div className="fade-in">
      <div className="kpi-grid">
        <div className="kpi-card card-destaque">
          <span>CLIENTES TOTAIS</span>
          <h2>{metricas.total}</h2>
          <small className="text-verde">+{metricas.novosMes} novos este mês</small>
        </div>
        <div className="kpi-card card-verde">
          <span>TICKET MÉDIO (LTV)</span>
          <h2>R$ {metricas.ticketMedio.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h2>
          <small>Valor por contrato</small>
        </div>
        <div className="kpi-card card-vermelho">
          <span>CLIENTES INATIVOS</span>
          <h2>{metricas.inativos}</h2>
          <small>Sem alugar há +6 meses</small>
        </div>
      </div>

      <div className="clientes-layout-split mt-20">
        <div className="col-esquerda">
          <div className="main-card-premium">
            <div className="card-header-flex">
              <h3>📍 Concentração Regional</h3>
            </div>
            <div className="ranking-visual-container">
              {rankingCidades.map(([cidade, total], i) => (
                <div key={i} className="rank-item-v4">
                  <div className="rank-info-v4">
                    <strong>{cidade}</strong>
                    <span>{total} locações</span>
                  </div>
                  <div className="rank-bar-bg-v4">
                    <div 
                      className="rank-bar-fill-v4" 
                      style={{ width: `${(total/rankingCidades[0][1])*100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="main-card-premium card-fidelidade-v6 mt-20">
            <div className="card-header-flex">
              <h3>✨ Fidelização {dadosEmpresa.nomeEmpresa.split(' ')[0]}</h3>
            </div>
            <div className="fidelidade-content-v6">
              <div className="fid-item-v6">
                <div className="fid-icon-v6">👥</div>
                <div className="fid-txt-v6">
                  <label>Clientes Recorrentes</label>
                  <strong>{metricas.clientesFieis} clientes</strong>
                </div>
              </div>

              <div className="fid-item-v6">
                <div className="fid-icon-v6">🔄</div>
                <div className="fid-txt-v6">
                  <label>Taxa de Retorno</label>
                  <div className="fid-progress-wrapper-v6">
                    <span className="fid-percentage-v6">{metricas.taxaRetorno.toFixed(0)}%</span>
                    <div className="fid-bar-bg-v6">
                      <div 
                        className="fid-bar-fill-v6" 
                        style={{ width: `${metricas.taxaRetorno}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="main-card-premium col-tabela">
          <div className="card-header-flex">
            <h3>🏆 Clientes VIP (Top 8)</h3>
            <button className="btn-export-pdf-clientes" onClick={exportarRelatorioGeral}>📄 Baixar Relatório Completo</button>
          </div>
          <table className="table-vip-v4">
            <thead>
              <tr><th width="40%">CLIENTE</th><th width="20%" className="centro">FESTAS</th><th width="20%" className="centro">TICKET MÉDIO</th><th width="20%" className="direita">TOTAL GASTO</th></tr>
            </thead>
            <tbody>
              {topClientes.map((c, i) => {
                const ticketMedioVip = c.gastoTotal / (c.qtdLocacoes || 1);
                return (
                  <tr key={i}>
                    <td>
                      <div className="vip-cell">
                        <span className={`vip-rank rank-${i+1}`}>{i+1}</span>
                        <span className="vip-name">{c.nome}</span>
                      </div>
                    </td>
                    <td className="centro bold" style={{ color: 'var(--texto-secundario)' }}>{c.qtdLocacoes}x</td>
                    <td className="centro" style={{ color: '#64748b', fontSize: '13px', fontWeight: '600' }}>R$ {ticketMedioVip.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                    <td className="direita bold text-verde">R$ {c.gastoTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ClientesTab;