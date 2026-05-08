import React, { useState, useEffect } from 'react';
import './Logistica.css';
import { db } from '../../firebaseConfig';
import { collection, getDocs, doc, updateDoc, getDoc, query, where, addDoc, serverTimestamp } from 'firebase/firestore'; 
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';

const Logistica = () => {
  const navigate = useNavigate();

  // 🔥 Autenticação
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;

  const [locacoes, setLocacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroTempo, setFiltroTempo] = useState('mes_atual');
  
  const [checklistModalId, setChecklistModalId] = useState(null);
  const [relatorioModalLoc, setRelatorioModalLoc] = useState(null);

  const [vistaAtual, setVistaAtual] = useState('kanban');
  const [parametros, setParametros] = useState(null);
  
  const [textoRelatorio, setTextoRelatorio] = useState('');

  // 🔥 SISTEMA DE AUDITORIA (ESPIÃO)
  const registrarLog = async (acao, detalhes, pedidoId = "S/N", numeroPedido = "S/N") => {
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
        pedidoId: pedidoId,
        numeroPedido: numeroPedido,
        userId: usuarioLogado?.uid
      });
    } catch (error) {
      console.error("Erro ao gravar log da auditoria:", error);
    }
  };

  const carregarDados = async () => {
    setLoading(true);
    try {
      // 🔥 BLINDAGEM MULTI-EMPRESA
      const qLocacoes = query(collection(db, "locacoes"), where("userId", "==", usuarioLogado.uid));
      const snap = await getDocs(qLocacoes);
      const dados = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const ordenados = dados.sort((a, b) => (a.dataRetirada || '').localeCompare(b.dataRetirada || ''));
      setLocacoes(ordenados);

      const docRef = doc(db, "configuracoes_empresa", usuarioLogado.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setParametros(docSnap.data());
      }

      const contratoRef = doc(db, "relatorio_avarias", usuarioLogado.uid);
      const contratoSnap = await getDoc(contratoRef);
      if (contratoSnap.exists()) {
        setTextoRelatorio(contratoSnap.data().conteudo || contratoSnap.data().texto || '');
      }

    } catch (e) {
      console.error("Erro ao carregar logística:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }

    carregarDados();
    if (window.innerWidth <= 800) {
      setVistaAtual('lista');
    }
  }, [usuarioLogado, navigate]);

  const moverCard = async (id, novoStatus) => {
    const locacaoAlvo = locacoes.find(l => l.id === id);
    const hojeStr = new Date().toISOString().split('T')[0];

    if (novoStatus === 'finalizado') {
        if (locacaoAlvo.dataRetirada > hojeStr) {
            alert(`🚫 BLOQUEADO:\nA data do evento é ${locacaoAlvo.dataRetirada.split('-').reverse().join('/')}. Você não pode receber peças de volta de uma festa que ainda nem aconteceu!`);
            return; 
        }
        if (locacaoAlvo.dataDevolucao && locacaoAlvo.dataDevolucao > hojeStr) {
            const confAntecipada = window.confirm(`⚠️ DEVOLUÇÃO ANTECIPADA:\nA devolução estava marcada para ${locacaoAlvo.dataDevolucao.split('-').reverse().join('/')}, mas o cliente devolveu hoje. Confirmar o recebimento no galpão?`);
            if (!confAntecipada) return;
        } else {
            const confirmacao = window.confirm('O material chegou no galpão? Ele irá para a coluna de Devolvidos para conferência final.');
            if (!confirmacao) return;
        }
    }

    try {
      const statusAntigo = (locacaoAlvo.status || 'indefinido').toUpperCase();
      await updateDoc(doc(db, "locacoes", id), { status: novoStatus });
      setLocacoes(prev => prev.map(loc => loc.id === id ? { ...loc, status: novoStatus } : loc));
      
      // 🔥 Auditoria de movimento
      await registrarLog(
        "MOVIMENTAÇÃO DE ESTEIRA", 
        `Avançou o pedido #${locacaoAlvo.numeroPedido} de ${statusAntigo} para ${novoStatus.toUpperCase()}.`,
        id,
        locacaoAlvo.numeroPedido
      );

    } catch (e) {
      alert("Erro ao atualizar o status.");
    }
  };

  const toggleItemChecklist = async (locId, itemIndex, tipo) => {
    const locacao = locacoes.find(l => l.id === locId);
    if (!locacao || !locacao.itens) return;

    const itemAlvo = locacao.itens[itemIndex];
    const novosItens = locacao.itens.map((item, idx) => {
      if (idx === itemIndex) return { ...item, [tipo]: !item[tipo] };
      return item;
    });

    setLocacoes(prev => prev.map(loc => loc.id === locId ? { ...loc, itens: novosItens } : loc));
    
    try { 
      await updateDoc(doc(db, "locacoes", locId), { itens: novosItens });
      
      // 🔥 Auditoria de separação
      if (tipo === 'checkedSeparacao') {
        const acao = !itemAlvo.checkedSeparacao ? "ITEM SEPARADO" : "ITEM PENDENTE";
        registrarLog(acao, `Checklist de Saída: Marcou "${itemAlvo.nome}" como ${!itemAlvo.checkedSeparacao ? 'CONFERIDO' : 'NÃO CONFERIDO'}.`, locId, locacao.numeroPedido);
      }
    } catch (e) {}
  };

  const registrarRetornoItem = async (locId, itemIndex, status) => {
    const locacao = locacoes.find(l => l.id === locId);
    if (!locacao || !locacao.itens) return;

    const itemAlvo = locacao.itens[itemIndex];
    const novosItens = locacao.itens.map((item, idx) => {
      if (idx === itemIndex) {
        if (status === 'ok') return { ...item, checkedDevolucao: true, avaria: false, faltou: false };
        if (status === 'avaria') return { ...item, checkedDevolucao: true, avaria: true, faltou: false };
        if (status === 'faltou') return { ...item, checkedDevolucao: true, avaria: false, faltou: true };
        if (status === 'desmarcar') return { ...item, checkedDevolucao: false, avaria: false, faltou: false };
      }
      return item;
    });

    setLocacoes(prev => prev.map(loc => loc.id === locId ? { ...loc, itens: novosItens } : loc));
    
    try { 
      await updateDoc(doc(db, "locacoes", locId), { itens: novosItens }); 
      
      // 🔥 Auditoria de retorno
      let txtStatus = status === 'ok' ? 'DEVOLVIDO OK' : status === 'avaria' ? 'COM AVARIA' : status === 'faltou' ? 'FALTANDO/EXTRAVIO' : 'DESMARCADO';
      registrarLog("CONFERÊNCIA DE RETORNO", `Marcou o item "${itemAlvo.nome}" como ${txtStatus}.`, locId, locacao.numeroPedido);
    } catch (e) {}
  };

  const hojeStr = new Date().toISOString().split('T')[0];
  const mesAtual = hojeStr.substring(0, 7);
  const locacoesFiltradas = locacoes.filter(loc => {
    if (!loc.dataRetirada) return false;
    const st = String(loc.status || '').toLowerCase().trim();
    if (loc.dataRetirada < hojeStr) {
        if (st.includes('orcam') || st.includes('confirmado') || st.includes('preparacao')) return false; 
    }
    if (filtroTempo === 'hoje') return loc.dataRetirada === hojeStr;
    if (filtroTempo === 'mes_atual') return loc.dataRetirada.startsWith(mesAtual);
    return true; 
  });

  const colunas = {
    orcamento: locacoesFiltradas.filter(l => l.status === 'orcamento'),
    confirmado: locacoesFiltradas.filter(l => l.status === 'confirmado'),
    preparacao: locacoesFiltradas.filter(l => l.status === 'preparacao'),
    entregue: locacoesFiltradas.filter(l => l.status === 'entregue'),
    finalizado: locacoesFiltradas.filter(l => l.status === 'finalizado'),
  };

  const locacaoModalAtiva = locacoes.find(l => l.id === checklistModalId);

  if (loading) return <div className="carregando-kanban">Atualizando esteira...</div>;

  return (
    <div className={`kanban-container fade-in ${vistaAtual === 'lista' ? 'modo-lista-ativa' : ''}`}>
      <header className="kanban-header-top">
        <div className="kanban-titles">
          <h1>📦 Logística & Fluxo</h1>
          <p>Acompanhe e movimente a esteira de pedidos da sua empresa.</p>
        </div>
        <div className="kanban-top-actions">
          <div className="view-switcher-log">
            <button className={vistaAtual === 'kanban' ? 'ativo' : ''} onClick={() => setVistaAtual('kanban')}>🖥️ Kanban</button>
            <button className={vistaAtual === 'lista' ? 'ativo' : ''} onClick={() => setVistaAtual('lista')}>📱 Lista</button>
          </div>
          <div className="kanban-filters">
            <button className={filtroTempo === 'hoje' ? 'ativo' : ''} onClick={() => setFiltroTempo('hoje')}>Hoje</button>
            <button className={filtroTempo === 'mes_atual' ? 'ativo' : ''} onClick={() => setFiltroTempo('mes_atual')}>Mês</button>
            <button className={filtroTempo === 'tudo' ? 'ativo' : ''} onClick={() => setFiltroTempo('tudo')}>Tudo</button>
          </div>
        </div>
      </header>

      <div className={`kanban-board ${vistaAtual === 'lista' ? 'board-lista' : 'board-colunas'}`}>
        <div className="kanban-col">
          <div className="col-header"><span className="dot" style={{background: '#64748b'}}></span><h3>1. Orçamentos</h3><span className="badge-count">{colunas.orcamento.length}</span></div>
          <div className="col-body">{colunas.orcamento.map(loc => <CartaoKanban key={loc.id} loc={loc} navigate={navigate} onAvancar={() => moverCard(loc.id, 'confirmado')} btnTxt="Aprovar ➔" btnCor="#3b82f6" onAbrirChecklist={() => setChecklistModalId(loc.id)} onAbrirRelatorio={() => setRelatorioModalLoc(loc)} isModoLista={vistaAtual === 'lista'} />)}</div>
        </div>
        <div className="kanban-col">
          <div className="col-header"><span className="dot" style={{background: '#3b82f6'}}></span><h3>2. Confirmados</h3><span className="badge-count">{colunas.confirmado.length}</span></div>
          <div className="col-body">{colunas.confirmado.map(loc => <CartaoKanban key={loc.id} loc={loc} navigate={navigate} onAvancar={() => moverCard(loc.id, 'preparacao')} btnTxt="Separar ➔" btnCor="#f59e0b" onAbrirChecklist={() => setChecklistModalId(loc.id)} onAbrirRelatorio={() => setRelatorioModalLoc(loc)} isModoLista={vistaAtual === 'lista'} />)}</div>
        </div>
        <div className="kanban-col">
          <div className="col-header"><span className="dot" style={{background: '#f59e0b'}}></span><h3>3. Em Separação</h3><span className="badge-count">{colunas.preparacao.length}</span></div>
          <div className="col-body">{colunas.preparacao.map(loc => <CartaoKanban key={loc.id} loc={loc} navigate={navigate} onAvancar={() => moverCard(loc.id, 'entregue')} btnTxt="Enviar ➔" btnCor="#8b5cf6" onAbrirChecklist={() => setChecklistModalId(loc.id)} onAbrirRelatorio={() => setRelatorioModalLoc(loc)} isModoLista={vistaAtual === 'lista'} />)}</div>
        </div>
        <div className="kanban-col">
          <div className="col-header"><span className="dot" style={{background: '#8b5cf6'}}></span><h3>4. Na Rua / Evento</h3><span className="badge-count">{colunas.entregue.length}</span></div>
          <div className="col-body">{colunas.entregue.map(loc => <CartaoKanban key={loc.id} loc={loc} navigate={navigate} onAvancar={() => moverCard(loc.id, 'finalizado')} btnTxt="Receber ➔" btnCor="#10b981" onAbrirChecklist={() => setChecklistModalId(loc.id)} onAbrirRelatorio={() => setRelatorioModalLoc(loc)} isModoLista={vistaAtual === 'lista'} />)}</div>
        </div>
        <div className="kanban-col">
          <div className="col-header"><span className="dot" style={{background: '#10b981'}}></span><h3>5. Devolvidos</h3><span className="badge-count">{colunas.finalizado.length}</span></div>
          <div className="col-body">
            {colunas.finalizado.slice(0, 15).map(loc => <CartaoKanban key={loc.id} loc={loc} navigate={navigate} isFinal={true} onVoltar={() => moverCard(loc.id, 'entregue')} onAbrirChecklist={() => setChecklistModalId(loc.id)} onAbrirRelatorio={() => setRelatorioModalLoc(loc)} isModoLista={vistaAtual === 'lista'} />)}
            {colunas.finalizado.length > 15 && <p className="limite-aviso">+ {colunas.finalizado.length - 15} arquivados...</p>}
          </div>
        </div>
      </div>

      {locacaoModalAtiva && (
        <ModalChecklist loc={locacaoModalAtiva} onClose={() => setChecklistModalId(null)} onToggleChecklist={toggleItemChecklist} onRegistrarRetorno={registrarRetornoItem} />
      )}

      {relatorioModalLoc && (
        <ModalRelatorioAvarias 
          loc={relatorioModalLoc} 
          parametros={parametros} 
          textoBase={textoRelatorio} 
          onClose={() => setRelatorioModalLoc(null)} 
          usuarioLogadoId={usuarioLogado.uid}
          registrarLog={registrarLog}
        />
      )}
    </div>
  );
};

const CartaoKanban = ({ loc, navigate, onAvancar, onVoltar, btnTxt, btnCor, isFinal, onAbrirChecklist, onAbrirRelatorio, isModoLista }) => {
  const isEntrega = loc.logistica?.tipo === 'entrega';
  const dataBr = loc.dataRetirada ? loc.dataRetirada.split('-').reverse().join('/') : '--/--/----';

  const getAlertaUrgencia = () => {
    if (!loc.dataRetirada || isFinal || loc.status === 'orcamento') return null;
    const hojeDate = new Date(); hojeDate.setHours(0,0,0,0);
    const locDate = new Date(loc.dataRetirada + 'T00:00:00'); 
    const diffTime = locDate.getTime() - hojeDate.getTime();
    const diffDias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDias < 0 && loc.status !== 'entregue') return <div className="alerta-urgente atrasado">🔥 ATRASADO!</div>;
    if (diffDias <= 0 && loc.status === 'entregue' && loc.dataDevolucao) {
       const devolucaoDate = new Date(loc.dataDevolucao + 'T00:00:00');
       const diffDev = Math.ceil((devolucaoDate.getTime() - hojeDate.getTime()) / (1000 * 60 * 60 * 24));
       if (diffDev < 0) return <div className="alerta-urgente devolver">🚨 DEVOLUÇÃO ATRASADA</div>;
       if (diffDev === 0) return <div className="alerta-urgente devolver">⚠️ BUSCAR HOJE!</div>;
    }
    if (diffDias === 0 && loc.status !== 'entregue') return <div className="alerta-urgente hoje">🚨 ENTREGAR HOJE!</div>;
    if (diffDias === 1 && loc.status !== 'entregue') return <div className="alerta-urgente amanha">⚠️ FESTA É AMANHÃ!</div>;
    return null;
  };

  const isFaseSeparacao = loc.status === 'preparacao';
  const isFaseDevolucao = loc.status === 'finalizado'; 
  const hasItens = loc.itens && loc.itens.length > 0;
  let totalItens = hasItens ? loc.itens.length : 0;
  let itensCheckados = 0;
  let checklistBloqueiaBotao = false;
  let temAvaria = false;
  let temFalta = false;

  if (hasItens) {
    temAvaria = loc.itens.some(i => i.avaria === true);
    temFalta = loc.itens.some(i => i.faltou === true);
    if (isFaseSeparacao) {
      itensCheckados = loc.itens.filter(i => i.checkedSeparacao).length;
      checklistBloqueiaBotao = itensCheckados < totalItens;
    } else if (isFaseDevolucao) {
      itensCheckados = loc.itens.filter(i => i.checkedDevolucao).length;
    }
  }

  const handleAvancarClick = () => {
    if (checklistBloqueiaBotao) {
      onAbrirChecklist();
      alert(`⚠️ Você precisa conferir as peças no checklist antes de avançar.`);
    } else {
      onAvancar();
    }
  };

  let btnChecklistTxt = 'Ver Peças';
  if (isFaseSeparacao) btnChecklistTxt = `Checklist (${itensCheckados}/${totalItens})`;
  if (isFaseDevolucao) btnChecklistTxt = `Conferir Retorno (${itensCheckados}/${totalItens})`;

  return (
    <div className={`k-card ${temAvaria ? 'card-com-avaria' : ''} ${temFalta ? 'card-com-falta' : ''} ${isModoLista ? 'card-modo-lista' : ''}`}>
      {getAlertaUrgencia()}
      {temFalta && <div className="alerta-urgente falta-badge">❌ FALTAM PEÇAS</div>}
      {temAvaria && !temFalta && <div className="alerta-urgente avaria-badge">⚠️ AVARIAS</div>}

      <div className="k-card-header">
        <div className="k-card-cliente">
          <strong>{loc.clienteNome || 'Cliente'}</strong>
          <span className="k-card-pedido">{loc.numeroPedido ? `#${loc.numeroPedido}` : ''}</span>
        </div>
        <span className={`k-tag ${isEntrega ? 'tag-entrega' : 'tag-loja'}`}>{isEntrega ? '🚚 Entrega' : '🏬 Loja'}</span>
      </div>

      <div className={`k-card-info ${isModoLista ? 'info-modo-lista' : ''}`}>
        <div className="info-linha"><span>Data:</span> <strong>{dataBr}</strong></div>
        <div className="info-linha"><span>Local:</span> <strong>{isEntrega ? loc.logistica?.cidade || 'Endereço' : 'Retirada'}</strong></div>
      </div>

      <div className={`k-card-actions-wrapper ${isModoLista ? 'actions-modo-lista' : ''}`}>
        <button className={`k-btn-itens-toggle ${(isFaseSeparacao || (isFaseDevolucao && itensCheckados < totalItens)) ? 'pulse-btn' : ''}`} onClick={onAbrirChecklist}>
          📝 {btnChecklistTxt}
        </button>

        <div className="k-card-actions">
          <button className="k-btn-view" onClick={() => navigate(`/locacoes/editar/${loc.id}`)}>Editar</button>
          
          {!isFinal ? (
            <button className={`k-btn-move ${checklistBloqueiaBotao ? 'btn-bloqueado' : ''}`} style={{ backgroundColor: checklistBloqueiaBotao ? '#cbd5e1' : btnCor, color: checklistBloqueiaBotao ? '#64748b' : 'white' }} onClick={handleAvancarClick}>
              {checklistBloqueiaBotao ? `🔒 Faça o Checklist` : btnTxt}
            </button>
          ) : (
            <button className="k-btn-view" onClick={onVoltar} style={{ color: '#ef4444', borderColor: '#fca5a5' }}>⏪ Voltar</button>
          )}
        </div>

        {(temAvaria || temFalta) && (
          <button className="k-btn-view" onClick={onAbrirRelatorio} style={{ width: '100%', marginTop: '6px', backgroundColor: '#fef2f2', color: '#dc2626', borderColor: '#fca5a5', fontWeight: 'bold' }}>
            📄 Gerar Relatório (PDF)
          </button>
        )}
      </div>
    </div>
  );
};

const ModalRelatorioAvarias = ({ loc, parametros, textoBase, onClose, usuarioLogadoId, registrarLog }) => {
  const [itensProblema, setItensProblema] = useState([]);
  const [carregandoValores, setCarregandoValores] = useState(true);

  useEffect(() => {
    const buscarValoresNoEstoque = async () => {
      try {
        const qEstoque = query(collection(db, "estoque"), where("userId", "==", usuarioLogadoId));
        const estoqueSnap = await getDocs(qEstoque);
        const estoqueData = estoqueSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const itensBase = loc.itens.filter(i => i.avaria || i.faltou);

        const itensComValorNovo = itensBase.map((item) => {
          let precoEncontrado = 0;
          const nomePecaLimpo = (item.nome || '').trim().toUpperCase();
          let pecaNoEstoque = estoqueData.find(e => e.id === item.id || e.id === item.produtoId || e.id === item.pecaId);

          if (!pecaNoEstoque) {
            pecaNoEstoque = estoqueData.find(e => {
              const nomeEstoqueLimpo = (e.nome || e.titulo || '').trim().toUpperCase();
              return nomeEstoqueLimpo === nomePecaLimpo;
            });
          }

          if (pecaNoEstoque) {
            const valorBruto = pecaNoEstoque.financeiro?.valorReposicao || pecaNoEstoque.valorReposicao || 0;
            let valorString = String(valorBruto).replace(/[R$\s]/g, '');
            if (valorString.includes('.') && valorString.includes(',')) valorString = valorString.replace(/\./g, '');
            valorString = valorString.replace(',', '.'); 
            precoEncontrado = parseFloat(valorString);
          }

          const valorFinalValido = (!precoEncontrado || isNaN(precoEncontrado)) ? 0 : precoEncontrado;
          return {
            ...item,
            valorBaseEstoque: valorFinalValido, 
            valorCobrado: valorFinalValido > 0 ? valorFinalValido.toFixed(2) : '' 
          };
        });

        setItensProblema(itensComValorNovo);
        setCarregandoValores(false);
      } catch (erro) {
        console.error("Erro na busca inteligente de estoque:", erro);
        setCarregandoValores(false);
      }
    };
    buscarValoresNoEstoque();
  }, [loc, usuarioLogadoId]);

  const handleValorChange = (index, value) => {
    const novosItens = [...itensProblema];
    novosItens[index].valorCobrado = value;
    setItensProblema(novosItens);
  };

  const totalCobrar = itensProblema.reduce((acc, item) => acc + (parseFloat(item.valorCobrado || 0) * item.qtd), 0);
  const formatarMoeda = (valor) => parseFloat(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const gerarTermoPDF = () => {
    const nomeEmpresa = parametros?.nomeEmpresa || parametros?.nomeFantasia || parametros?.nome || 'NOME DA EMPRESA NÃO CONFIGURADO';
    const logoEmpresa = parametros?.logotipo || parametros?.logo || parametros?.logoUrl || parametros?.foto || null;
    const telefoneEmpresa = parametros?.telefone || parametros?.whatsapp || parametros?.contato || '';

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Termo de Ocorrência - ${loc.clienteNome}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e293b; padding-bottom: 20px; margin-bottom: 30px; }
            .empresa-info { text-align: left; }
            .empresa-info img { max-height: 80px; object-fit: contain; margin-bottom: 8px; display: block; }
            .empresa-info h2 { margin: 0; font-size: 20px; color: #0f172a; font-weight: 900; text-transform: uppercase;}
            .empresa-info p { margin: 4px 0 0; font-size: 13px; color: #64748b; font-weight: bold; }
            .doc-titulo { text-align: right; }
            .doc-titulo h1 { margin: 0; font-size: 22px; color: #0f172a; text-transform: uppercase; letter-spacing: 1px;}
            .doc-titulo p { margin: 5px 0 0; color: #dc2626; font-size: 13px; font-weight: bold;}
            .info-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; margin-bottom: 30px; line-height: 1.8; }
            .table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            .table th, .table td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 14px; }
            .table th { background: #e2e8f0; color: #0f172a; font-weight: bold; }
            .valor-td { text-align: right !important; }
            .total-box { text-align: right; font-size: 18px; font-weight: bold; color: #0f172a; padding: 15px; background: #f1f5f9; border: 1px solid #cbd5e1; border-top: none; margin-bottom: 30px; border-radius: 0 0 8px 8px;}
            .total-box span { color: #dc2626; font-size: 22px; margin-left: 10px;}
            .assinaturas { margin-top: 80px; display: flex; justify-content: space-between; gap: 40px; }
            .assinaturas div { border-top: 1px solid #0f172a; flex: 1; text-align: center; padding-top: 10px; font-weight: bold; color: #0f172a;}
            .aviso-legal { font-size: 14px; color: #475569; line-height: 1.6; text-align: justify; margin-bottom: 50px; white-space: pre-wrap;}
          </style>
        </head>
        <body>
          <div class="header">
            <div class="empresa-info">
              ${logoEmpresa ? `<img src="${logoEmpresa}" alt="Logo Empresa" />` : ''}
              <h2>${nomeEmpresa}</h2>
              <p>Locação de Peças e Mobiliário ${telefoneEmpresa ? `| ${telefoneEmpresa}` : ''}</p>
            </div>
            <div class="doc-titulo">
              <h1>TERMO DE OCORRÊNCIA</h1>
              <p>Relatório de Avaria e/ou Extravio</p>
            </div>
          </div>
          <table class="table">
            <thead>
              <tr><th width="8%">Qtd</th><th width="35%">Produto</th><th width="27%">Ocorrência</th><th width="15%" class="valor-td">Valor Unit.</th><th width="15%" class="valor-td">Subtotal</th></tr>
            </thead>
            <tbody>
              ${itensProblema.map(i => `
                <tr>
                  <td>${i.qtd}x</td>
                  <td>${i.nome}</td>
                  <td>${i.avaria ? '⚠️ AVARIA' : '❌ EXTRAVIO'}</td>
                  <td class="valor-td">${formatarMoeda(i.valorCobrado)}</td>
                  <td class="valor-td" style="font-weight: bold;">${formatarMoeda(parseFloat(i.valorCobrado || 0) * i.qtd)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="total-box"> VALOR TOTAL A PAGAR: <span>${formatarMoeda(totalCobrar)}</span> </div>
          <div class="aviso-legal">${textoBase || 'Declaramos que os itens listados acima apresentaram avarias.\nNossa equipe entrará em contato.'}</div>
          <div class="assinaturas"><div>Equipe de Logística</div><div>Ciente: ${loc.clienteNome}</div></div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 800);
    
    // 🔥 Auditoria de geração de relatório
    registrarLog("RELATÓRIO GERADO", `Gerou PDF de Ocorrências (Total: ${formatarMoeda(totalCobrar)}) para o cliente ${loc.clienteNome}.`, loc.id, loc.numeroPedido);
    
    onClose(); 
  };

  return (
    <div className="modal-overlay-v3" onClick={onClose}>
      <div className="modal-content-v3" style={{maxWidth: '750px', width: '95vw', padding: '0'}} onClick={e => e.stopPropagation()}>
        <div style={{padding: '20px 25px', borderBottom: '1px solid #e2e8f0', background: '#fef2f2', borderRadius: '12px 12px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <h2 style={{margin: 0, color: '#dc2626'}}>🚨 Laudo de Ocorrências</h2>
          <button onClick={onClose} style={{background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#dc2626'}}>✖</button>
        </div>
        <div style={{padding: '20px 25px', maxHeight: '50vh', overflowY: 'auto'}}>
          {carregandoValores ? ( <div style={{textAlign: 'center', padding: '30px'}}> 🔄 Buscando valores... </div> ) : (
            itensProblema.map((it, idx) => (
              <div key={idx} className="config-valor-row">
                <div className="config-item-info">
                   <strong>{it.qtd}x {it.nome}</strong>
                   <span style={{fontSize: '0.8rem', color: '#64748b'}}> Base estoque: <strong style={{color: '#d97706'}}>{formatarMoeda(it.valorBaseEstoque)}</strong></span>
                </div>
                <div className="config-item-input">
                   <label>Cobrar (R$):</label>
                   <input type="number" step="0.01" value={it.valorCobrado} onChange={(e) => handleValorChange(idx, e.target.value)} />
                </div>
              </div>
            ))
          )}
        </div>
        <div style={{padding: '20px 25px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
           <div style={{fontWeight: 'bold'}}> Total: <span style={{color: '#dc2626', fontSize: '1.4rem'}}>{formatarMoeda(totalCobrar)}</span> </div>
           <button onClick={gerarTermoPDF} disabled={carregandoValores} style={{background: '#dc2626', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer'}}> 🖨️ Imprimir Laudo </button>
        </div>
      </div>
    </div>
  );
};

const ModalChecklist = ({ loc, onClose, onToggleChecklist, onRegistrarRetorno }) => {
  const isFaseSeparacao = loc.status === 'preparacao';
  const isFaseDevolucao = loc.status === 'finalizado'; 
  
  return (
    <div className="modal-overlay-v3" onClick={onClose}>
      <div className="modal-content-v3 modal-checklist-large" onClick={e => e.stopPropagation()}>
        <div className="modal-header-v3">
          <div>
            <h3 style={{marginBottom: '5px'}}>📝 Checklist de Conferência</h3>
            <p style={{fontSize: '0.85rem', color: '#64748b', margin: 0}}>{loc.clienteNome} • {loc.status.toUpperCase()}</p>
          </div>
          <button onClick={onClose} style={{fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8'}}>✖</button>
        </div>
        <div className="modal-checklist-body">
          {loc.itens && loc.itens.length > 0 ? (
            loc.itens.map((it, idx) => {
              if (isFaseSeparacao) {
                return (
                  <div key={idx} className={`checklist-row ${it.checkedSeparacao ? 'checked' : ''}`} onClick={() => onToggleChecklist(loc.id, idx, 'checkedSeparacao')}>
                    <input type="checkbox" checked={!!it.checkedSeparacao} readOnly className="chk-large" />
                    {it.foto ? <img src={it.foto} alt="" className="chk-foto" /> : <div className="chk-foto vazio">📷</div>}
                    <span className="chk-nome"><strong>{it.qtd}x</strong> {it.nome}</span>
                  </div>
                )
              }
              if (isFaseDevolucao) {
                return (
                  <div key={idx} className={`checklist-row dev-row ${it.avaria ? 'avaria' : ''} ${it.faltou ? 'faltou' : ''} ${it.checkedDevolucao && !it.avaria && !it.faltou ? 'checked' : ''}`}>
                    {it.foto ? <img src={it.foto} alt="" className="chk-foto" /> : <div className="chk-foto vazio">📷</div>}
                    <span className="chk-nome"><strong>{it.qtd}x</strong> {it.nome}</span>
                    <div className="chk-botoes-volta">
                       <button className={`btn-volta ok ${it.checkedDevolucao && !it.avaria && !it.faltou ? 'ativo' : ''}`} onClick={(e) => { e.stopPropagation(); onRegistrarRetorno(loc.id, idx, (it.checkedDevolucao && !it.avaria && !it.faltou) ? 'desmarcar' : 'ok'); }}>✔️ OK</button>
                       <button className={`btn-volta bad ${it.avaria ? 'ativo' : ''}`} onClick={(e) => { e.stopPropagation(); onRegistrarRetorno(loc.id, idx, it.avaria ? 'desmarcar' : 'avaria'); }}>⚠️ AVARIA</button>
                       <button className={`btn-volta lost ${it.faltou ? 'ativo' : ''}`} onClick={(e) => { e.stopPropagation(); onRegistrarRetorno(loc.id, idx, it.faltou ? 'desmarcar' : 'faltou'); }}>❌ SUMIU</button>
                    </div>
                  </div>
                )
              }
              return (
                <div key={idx} className="checklist-row">
                  {it.foto ? <img src={it.foto} alt="" className="chk-foto" /> : <div className="chk-foto vazio">📷</div>}
                  <span className="chk-nome"><strong>{it.qtd}x</strong> {it.nome}</span>
                </div>
              )
            })
          ) : (<p style={{textAlign: 'center', padding: '30px', color: '#94a3b8'}}>Nenhuma peça neste pedido.</p>)}
        </div>
        <div style={{padding: '20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end'}}>
           <button onClick={onClose} style={{background: '#0f172a', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer'}}>Concluído</button>
        </div>
      </div>
    </div>
  );
};

export default Logistica;