import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './NovaLocacao.css'; 
import { db } from '../../firebaseConfig'; 
import { collection, getDocs, doc, getDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore'; 

const EditarLocacao = () => {
  const navigate = useNavigate();
  const { id } = useParams(); 
  const [loading, setLoading] = useState(true);

  const [clientes, setClientes] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [carrinho, setCarrinho] = useState([]);
  
  const [modalAberto, setModalAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('Todos');
  
  const [clienteSelecionado, setClienteSelecionado] = useState('');
  const [temaFesta, setTemaFesta] = useState('');
  const [tipoServico, setTipoServico] = useState('PEGUE E MONTE'); 
  const [datas, setDatas] = useState({ retirada: '', devolucao: '' });
  
  const [logistica, setLogistica] = useState({ 
    tipo: 'entrega', cep: '', rua: '', numero: '', bairro: '', cidade: '', frete: '', obsTransporte: '' 
  });
  const [desconto, setDesconto] = useState(0);
  const [obsInternas, setObsInternas] = useState('');
  
  const [numeroPedido, setNumeroPedido] = useState('');
  const [statusAtual, setStatusAtual] = useState('');
  const [valorJaPago, setValorJaPago] = useState(0); 

  const [modalSinalAberto, setModalSinalAberto] = useState(false);
  const [valorSinal, setValorSinal] = useState('');
  const [formaPagtoSinal, setFormaPagtoSinal] = useState('Pix');
  const [salvandoPedido, setSalvandoPedido] = useState(false);
  const [statusParaSalvar, setStatusParaSalvar] = useState(''); 

  const isFinalizado = statusAtual === 'finalizado' || statusAtual === 'cancelado';

  useEffect(() => {
    const carregarDados = async () => {
      try {
        const [snapCli, snapEst] = await Promise.all([
          getDocs(collection(db, "clientes")),
          getDocs(collection(db, "estoque"))
        ]);
        setClientes(snapCli.docs.map(d => ({ id: d.id, ...d.data() })));
        setEstoque(snapEst.docs.map(d => ({ id: d.id, ...d.data() })));

        if (id) {
          const docRef = doc(db, "locacoes", id);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            
            setNumeroPedido(data.numeroPedido || '');
            setStatusAtual(data.status || 'orcamento'); 
            setClienteSelecionado(data.clienteId || '');
            setTemaFesta(data.temaFesta || data.tema || '');
            setTipoServico(data.tipoServico || 'PEGUE E MONTE');
            setDatas({ retirada: data.dataRetirada || '', devolucao: data.dataDevolucao || '' });
            setValorJaPago(Number(data.valorPago || 0));
            
            const log = data.logistica || {};
            let freteFormatado = '';
            if (log.frete) {
              freteFormatado = Number(log.frete).toFixed(2).replace('.', ',');
            }

            setLogistica({
              tipo: log.tipo || 'entrega',
              cep: log.cep || '',
              rua: log.rua || log.endereco || '',
              numero: log.numero || '',
              bairro: log.bairro || '',
              cidade: log.cidade || '',
              frete: freteFormatado,
              obsTransporte: log.obsTransporte || ''
            });

            const itensFormatados = (data.itens || []).map(item => ({
              ...item,
              preco: Number(item.preco || item.financeiro?.valorAluguel || 0)
            }));
            setCarrinho(itensFormatados);
            
            setDesconto(data.desconto || 0);
            setObsInternas(data.obsInternas || '');
          }
        }
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setLoading(false);
      }
    };
    carregarDados();
  }, [id]);

  const categoriasUnicas = ['Todos', ...new Set(estoque.map(item => item.categoria).filter(Boolean))];

  const addCarrinho = (item) => {
    if (isFinalizado) return; 
    const precoItem = Number(item.financeiro?.valorAluguel || item.preco || 0);
    const existe = carrinho.find(i => i.id === item.id);
    if (existe) {
      setCarrinho(carrinho.map(i => i.id === item.id ? { ...i, qtd: i.qtd + 1 } : i));
    } else {
      // 🔥 AGORA CRIA COM AS MESMAS CHAVES DA LOGÍSTICA 🔥
      setCarrinho([...carrinho, { ...item, qtd: 1, preco: precoItem, checkedSeparacao: false, checkedDevolucao: false, avaria: false, faltou: false }]);
    }
  };

  // 🔥 SINCRONIZAÇÃO COM A LÓGICA DA LOGÍSTICA 🔥
  const marcarIda = (itemId) => {
    if (isFinalizado) return;
    setCarrinho(prev => prev.map(item => {
      if (item.id === itemId) return { ...item, checkedSeparacao: !item.checkedSeparacao };
      return item;
    }));
  };

  const marcarVolta = (itemId, status) => {
    if (isFinalizado) return;
    setCarrinho(prev => prev.map(item => {
      if (item.id === itemId) {
        if (status === 'ok') {
          const jaTavaOk = item.checkedDevolucao && !item.avaria && !item.faltou;
          return { ...item, checkedDevolucao: !jaTavaOk, avaria: false, faltou: false };
        }
        if (status === 'avaria') {
          const jaTavaAvaria = item.avaria;
          return { ...item, checkedDevolucao: !jaTavaAvaria, avaria: !jaTavaAvaria, faltou: false };
        }
        if (status === 'faltou') {
          const jaTavaFaltou = item.faltou;
          return { ...item, checkedDevolucao: !jaTavaFaltou, avaria: false, faltou: !jaTavaFaltou };
        }
      }
      return item;
    }));
  };

  const getFreteNumerico = () => {
    if (!logistica.frete) return 0;
    return Number(logistica.frete.toString().replace(/\./g, "").replace(",", "."));
  };

  const calcularTotal = () => {
    const subtotal = carrinho.reduce((acc, item) => {
      const precoValido = Number(item.preco || item.financeiro?.valorAluguel || 0);
      return acc + (precoValido * (item.qtd || 1));
    }, 0);
    const total = subtotal + getFreteNumerico() - Number(desconto || 0);
    return { subtotal, total: Math.max(0, total) };
  };

  const handleCepChange = async (e) => {
    if (isFinalizado) return;
    let value = e.target.value.replace(/\D/g, "");
    let cepFormatado = value.replace(/^(\d{5})(\d)/, "$1-$2").substring(0, 9);
    setLogistica(prev => ({ ...prev, cep: cepFormatado }));

    if (value.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${value}/json/`);
        const dados = await res.json();
        if (!dados.erro) {
          setLogistica(prev => ({
            ...prev, 
            cep: cepFormatado,
            rua: dados.logradouro || '',
            bairro: dados.bairro || '',
            cidade: `${dados.localidade || ''} - ${dados.uf || ''}`
          }));
          setTimeout(() => document.getElementById('numeroInput').focus(), 100);
        }
      } catch (e) {}
    }
  };

  const handleFreteChange = (e) => {
    if (isFinalizado) return;
    let v = e.target.value.replace(/\D/g, ""); 
    if (!v) { setLogistica({ ...logistica, frete: "" }); return; }
    v = (v / 100).toFixed(2) + ""; 
    v = v.replace(".", ","); 
    v = v.replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,"); 
    v = v.replace(/(\d)(\d{3}),/g, "$1.$2,");
    setLogistica({ ...logistica, frete: v });
  };

  const interceptarSalvamento = (novoStatus) => {
    if (!clienteSelecionado || !datas.retirada) return alert("Preencha cliente e data de retirada!");
    
    if (novoStatus === 'finalizado') {
        const temItemSemVolta = carrinho.some(i => !i.checkedDevolucao);
        if (temItemSemVolta) {
             const confirmacaoExtra = window.confirm("⚠️ ALERTA DE CONFERÊNCIA:\n\nExistem itens no pedido que NÃO foram marcados como devolvidos (📥 VOLTA, ⚠️ AVARIA ou ❌ FALTA).\n\nTem certeza que deseja finalizar este pedido assim mesmo?");
             if (!confirmacaoExtra) return;
        } else {
             const confirmacao = window.confirm("Finalizar o Pedido? Certifique-se que todos os itens foram conferidos no check-in da tela.");
             if (!confirmacao) return;
        }
    }

    const statusFinalDesejado = novoStatus || statusAtual;

    if (statusAtual === 'orcamento' && statusFinalDesejado === 'confirmado') {
        setStatusParaSalvar('confirmado');
        setModalSinalAberto(true);
        return;
    }

    executarSalvamentoFinal(statusFinalDesejado, 0, 0); 
  };

  const executarSalvamentoFinal = async (statusFinal, valorSinalEntrandoNoCaixa = 0, valorSinalNegociado = 0) => {
    setSalvandoPedido(true);
    try {
      const nomeCliente = clientes.find(c => c.id === clienteSelecionado)?.nome || 'Cliente';
      const logisticaParaSalvar = { ...logistica, frete: getFreteNumerico() };
      const novoValorPagoTotal = valorJaPago + valorSinalEntrandoNoCaixa;

      const docRef = doc(db, "locacoes", id);
      await updateDoc(docRef, {
        clienteId: clienteSelecionado,
        clienteNome: nomeCliente,
        temaFesta,
        tipoServico, 
        dataRetirada: datas.retirada,
        dataDevolucao: datas.devolucao,
        itens: carrinho, 
        logistica: logisticaParaSalvar,
        obsInternas,
        desconto: Number(desconto),
        valorTotal: calcularTotal().total,
        valorPago: novoValorPagoTotal,
        sinalNegociado: valorSinalNegociado > 0 ? valorSinalNegociado : null,
        status: statusFinal,
        atualizadoEm: new Date()
      });

      if (valorSinalEntrandoNoCaixa > 0) {
        await addDoc(collection(db, "financeiro_lancamentos"), {
            tipo: 'entrada', 
            categoria: 'Locação', 
            valor: valorSinalEntrandoNoCaixa, 
            formaPagto: formaPagtoSinal,
            data: new Date().toISOString().split('T')[0], 
            status: 'pago', 
            createdAt: serverTimestamp(),
            descricao: `SINAL (Aprovação) - Pedido ${numeroPedido ? `#${numeroPedido}` : ''} - ${nomeCliente}`
        });
        setValorJaPago(novoValorPagoTotal); 
      }
      
      setStatusAtual(statusFinal); 
      
      if (statusFinal && statusFinal !== statusAtual) {
          alert(`✅ Pedido salvo! Avançou para a etapa: ${statusFinal.toUpperCase()}`);
      } else {
          alert(`✅ Alterações salvas com sucesso!`);
      }
      
    } catch (e) { 
      alert("Erro ao atualizar o pedido."); 
    } finally {
      setSalvandoPedido(false);
      setModalSinalAberto(false);
    }
  };

  const salvarSinalRecebido = () => {
      const valorDigitadoNum = Number(valorSinal.replace(/\./g, "").replace(",", ".")) || 0;
      executarSalvamentoFinal('confirmado', valorDigitadoNum, valorDigitadoNum);
  };

  const salvarAguardandoPagamento = () => {
      const valorDigitadoNum = Number(valorSinal.replace(/\./g, "").replace(",", ".")) || 0;
      executarSalvamentoFinal('orcamento', 0, valorDigitadoNum);
  };

  const salvarSemSinal = () => {
      const confirmouSemSinal = window.confirm("⚠️ ALERTA DE RISCO!\n\nVocê deixou o valor de entrada como R$ 0,00.\n\nTem certeza que deseja APROVAR este pedido assumindo o risco de não ter recebido nenhum sinal?");
      if (confirmouSemSinal) {
          executarSalvamentoFinal('confirmado', 0, 0);
      }
  };

  const abrirWhatsAppCobranca = () => {
      const clienteEncontrado = clientes.find(c => String(c.id) === String(clienteSelecionado));
      const nomeClienteVIP = clienteEncontrado ? (clienteEncontrado.nome || clienteEncontrado.nomeCompleto || '') : '';
      const telefoneC = clienteEncontrado?.celular ? clienteEncontrado.celular.replace(/\D/g, '') : '';
      
      const vTotal = calcularTotal().total.toLocaleString('pt-BR', {minimumFractionDigits: 2});
      const vSinalFormatado = valorSinal || '0,00';

      const texto = `Olá, ${nomeClienteVIP}! 🎉\n\nSua locação no valor total de *R$ ${vTotal}* já foi separada em nosso sistema.\n\nPara confirmarmos a reserva das peças para a sua data, aguardamos o pagamento do sinal no valor de *R$ ${vSinalFormatado}*.\n\n💳 *Nossa Chave PIX:* \n(SUA CHAVE AQUI)\n\nAssim que o pagamento for feito, por favor, me envie o comprovante por aqui. Muito obrigada! 🥰`;

      const msgEncoded = encodeURIComponent(texto);
      const url = telefoneC 
            ? `https://wa.me/55${telefoneC}?text=${msgEncoded}` 
            : `https://api.whatsapp.com/send?text=${msgEncoded}`;
            
      window.open(url, '_blank');
  };

  const itensFiltrados = estoque.filter(item => {
    return (item.nome || '').toLowerCase().includes(busca.toLowerCase()) && 
           (filtroCategoria === 'Todos' || item.categoria === filtroCategoria);
  });

  const getBadgeStatus = () => {
    switch(statusAtual) {
      case 'orcamento': return { txt: '📝 ORÇAMENTO', cor: '#64748b' };
      case 'confirmado': return { txt: '✔ PEDIDO CONFIRMADO', cor: '#3b82f6' };
      case 'preparacao': return { txt: '📦 EM SEPARAÇÃO', cor: '#f59e0b' };
      case 'entregue': return { txt: '🚚 ENTREGUE / COM O CLIENTE', cor: '#8b5cf6' };
      case 'finalizado': return { txt: '✅ FINALIZADO (DEVOLVIDO)', cor: '#10b981' };
      case 'cancelado': return { txt: '❌ CANCELADO', cor: '#ef4444' };
      default: return { txt: 'Desconhecido', cor: '#ccc' };
    }
  };

  const maskCurrency = (value) => {
    let v = value.replace(/\D/g, ""); 
    if (!v) return "";
    return (v / 100).toFixed(2).replace(".", ",").replace(/(\d)(\d{3})(\d{3}),/g, "$1.$2.$3,").replace(/(\d)(\d{3}),/g, "$1.$2,");
  };

  const badgeInfo = getBadgeStatus();
  const valorDigitadoNum = Number(valorSinal.replace(/\./g, "").replace(",", ".")) || 0;

  if (loading) return <div className="loading-state">Carregando Pedido...</div>;

  return (
    <div className="locacao-form-container">
      
      <header className="page-header">
        <div style={{display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap'}}>
            <h1 className="page-title">{isFinalizado ? '🔎 Visualizar Pedido' : 'Editar Pedido'} {numeroPedido && <span style={{color: 'var(--dourado)'}}>#{numeroPedido}</span>}</h1>
            <span style={{background: badgeInfo.cor, color: 'white', padding: '6px 14px', borderRadius: '20px', fontWeight: '800', fontSize: '10px', textTransform: 'uppercase'}}>
                {badgeInfo.txt}
            </span>
        </div>
        <button className="btn-voltar-link" onClick={() => navigate('/locacoes')}>← Voltar à Lista</button>
      </header>

      {isFinalizado && (
          <div style={{background: '#f8fafc', borderLeft: '4px solid #94a3b8', padding: '12px 20px', marginBottom: '20px', color: '#475569', fontSize: '13px', borderRadius: '0 8px 8px 0'}}>
              <b>🔒 Modo Somente Leitura:</b> Este pedido já foi {statusAtual}, portanto seus dados e itens não podem mais ser alterados.
          </div>
      )}

      <div className="layout-duas-colunas">
        <div className="coluna-form" style={{opacity: isFinalizado ? 0.8 : 1}}>
          
          <div className="card-secao">
            <h3 className="section-divider">👤 DADOS DO EVENTO</h3>

            <div className="form-group mb-15">
              <label>MODALIDADE DE SERVIÇO *</label>
              <div className="toggle-servico" style={{pointerEvents: isFinalizado ? 'none' : 'auto'}}>
                <button type="button" className={`btn-toggle ${tipoServico === 'PEGUE E MONTE' ? 'active-pegue' : ''}`}
                  onClick={() => { setTipoServico('PEGUE E MONTE'); setLogistica({...logistica, tipo: 'retirada', frete: ''}); }}>
                  📦 PEGUE E MONTE
                </button>
                <button type="button" className={`btn-toggle ${tipoServico === 'DECORACAO COMPLETA' ? 'active-deco' : ''}`}
                  onClick={() => { setTipoServico('DECORACAO COMPLETA'); setLogistica({...logistica, tipo: 'entrega'}); }}>
                  ✨ DECORAÇÃO COMPLETA
                </button>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group flex-2">
                <label>Cliente *</label>
                <select value={clienteSelecionado} onChange={e => setClienteSelecionado(e.target.value)} disabled={isFinalizado}>
                  <option value="">Selecione um cliente cadastrado...</option>
                  <option value={clienteSelecionado} disabled hidden>
                    {clientes.find(c => String(c.id) === String(clienteSelecionado))?.nome || 'Carregando...'}
                  </option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome || c.nomeFantasia}</option>)}
                </select>
              </div>
              <div className="form-group flex-2">
                <label>Tema da Festa</label>
                <input type="text" placeholder="Ex: Safari, Casamento..." value={temaFesta} onChange={e => setTemaFesta(e.target.value)} disabled={isFinalizado}/>
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group flex-1"><label>Data de Retirada / Evento *</label><input type="date" value={datas.retirada} onChange={e => setDatas({...datas, retirada: e.target.value})} disabled={isFinalizado}/></div>
              <div className="form-group flex-1"><label>Data de Devolução</label><input type="date" value={datas.devolucao} onChange={e => setDatas({...datas, devolucao: e.target.value})} disabled={isFinalizado}/></div>
            </div>
          </div>

          <div className="card-secao">
            <div className="header-com-toggle">
              <h3 className="section-divider" style={{margin: 0, border: 'none'}}>🚚 LOGÍSTICA & ENTREGA</h3>
              <div className="toggle-simples" style={{pointerEvents: isFinalizado ? 'none' : 'auto'}}>
                <button type="button" className={logistica.tipo === 'entrega' ? 'active' : ''} onClick={() => setLogistica({...logistica, tipo: 'entrega'})}>Com Frete</button>
                <button type="button" className={logistica.tipo === 'retirada' ? 'active' : ''} onClick={() => setLogistica({...logistica, tipo: 'retirada', frete: ''})}>Retirada na Loja</button>
              </div>
            </div>

            {logistica.tipo === 'entrega' ? (
              <div className="logistica-form mt-15">
                <div className="form-row">
                  <div className="form-group flex-1"><label>CEP</label><input type="text" placeholder="00000-000" maxLength="9" value={logistica.cep} onChange={handleCepChange} disabled={isFinalizado}/></div>
                  <div className="form-group flex-2"><label>Cidade / UF</label><input type="text" placeholder="Ex: Campinas - SP" value={logistica.cidade} onChange={e => setLogistica({...logistica, cidade: e.target.value})} disabled={isFinalizado}/></div>
                  <div className="form-group flex-1"><label>Taxa Frete (R$)</label><input type="text" placeholder="0,00" value={logistica.frete} onChange={handleFreteChange} disabled={isFinalizado}/></div>
                </div>
                <div className="form-row">
                  <div className="form-group flex-2"><label>Logradouro</label><input type="text" placeholder="Av. das Nações..." value={logistica.rua} onChange={e => setLogistica({...logistica, rua: e.target.value})} disabled={isFinalizado}/></div>
                  <div className="form-group-inline flex-2">
                    <div className="form-group flex-1"><label>Número</label><input type="text" id="numeroInput" placeholder="123" value={logistica.numero} onChange={e => setLogistica({...logistica, numero: e.target.value})} disabled={isFinalizado}/></div>
                    <div className="form-group flex-2"><label>Bairro</label><input type="text" placeholder="Centro" value={logistica.bairro} onChange={e => setLogistica({...logistica, bairro: e.target.value})} disabled={isFinalizado}/></div>
                  </div>
                </div>
                <div className="form-group mt-10">
                  <label>Observações de Transporte</label>
                  <textarea rows="2" placeholder="Casa de esquina, deixar com porteiro..." value={logistica.obsTransporte} onChange={e => setLogistica({...logistica, obsTransporte: e.target.value})} disabled={isFinalizado}></textarea>
                </div>
              </div>
            ) : (
              <p className="texto-aviso-logistica mt-15">⚠️ O cliente fará a retirada e devolução dos itens diretamente no local.</p>
            )}
          </div>

          {/* =========================================================================
              🔥 NOVA SEÇÃO: CHECK-IN E CONFERÊNCIA (IDA E VOLTA) 🔥 
              ========================================================================= */}
          {statusAtual !== 'orcamento' && carrinho.length > 0 && (
            <div className="card-secao">
              <h3 className="section-divider" style={{marginTop: 0, border: 'none', marginBottom: '8px'}}>📋 CHECK-IN E CONFERÊNCIA (IDA / VOLTA)</h3>
              <p style={{fontSize: '13px', color: 'var(--texto-secundario)', marginBottom: '15px'}}>
                Marque as peças que saíram e voltaram. Caso marque <b>Avaria</b> ou <b>Falta</b>, o Termo de Ocorrência será habilitado.
              </p>

              <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                {carrinho.map(item => {
                  const temProblema = item.avaria || item.faltou; 
                  const taMarcadoOk = item.checkedDevolucao && !item.avaria && !item.faltou;

                  return (
                  <div key={item.id} style={{display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', background: temProblema ? '#fef2f2' : '#f8fafc', border: `1px solid ${temProblema ? '#fca5a5' : '#e2e8f0'}`, borderRadius: '10px'}}>
                    
                    <div style={{flex: '1 1 200px'}}>
                      <strong style={{color: '#0f172a', fontSize: '14px', display: 'block'}}>{item.nome}</strong>
                      <span style={{fontSize: '11px', color: '#64748b', fontWeight: 'bold'}}>QUANTIDADE: {item.qtd} un.</span>
                    </div>

                    <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                      {/* BOTÃO IDA LENDO checkedSeparacao */}
                      <button 
                         type="button" onClick={() => marcarIda(item.id)} disabled={isFinalizado} 
                         style={{padding: '8px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', border: '1px solid', cursor: isFinalizado ? 'not-allowed' : 'pointer', backgroundColor: item.checkedSeparacao ? '#dcfce7' : '#fff', color: item.checkedSeparacao ? '#166534' : '#64748b', borderColor: item.checkedSeparacao ? '#86efac' : '#cbd5e1', transition: '0.2s'}}>
                        📤 IDA
                      </button>

                      {/* BOTÃO VOLTA LENDO checkedDevolucao */}
                      <button 
                         type="button" onClick={() => marcarVolta(item.id, 'ok')} disabled={isFinalizado} 
                         style={{padding: '8px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', border: '1px solid', cursor: isFinalizado ? 'not-allowed' : 'pointer', backgroundColor: taMarcadoOk ? '#dbeafe' : '#fff', color: taMarcadoOk ? '#1e40af' : '#64748b', borderColor: taMarcadoOk ? '#93c5fd' : '#cbd5e1', transition: '0.2s'}}>
                        📥 VOLTA
                      </button>

                      {/* BOTÃO AVARIA */}
                      <button 
                         type="button" onClick={() => marcarVolta(item.id, 'avaria')} disabled={isFinalizado} 
                         style={{padding: '8px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', border: '1px solid', cursor: isFinalizado ? 'not-allowed' : 'pointer', backgroundColor: item.avaria ? '#fef9c3' : '#fff', color: item.avaria ? '#a16207' : '#64748b', borderColor: item.avaria ? '#fde047' : '#cbd5e1', transition: '0.2s'}}>
                        ⚠️ AVARIA
                      </button>

                      {/* BOTÃO FALTA */}
                      <button 
                         type="button" onClick={() => marcarVolta(item.id, 'faltou')} disabled={isFinalizado} 
                         style={{padding: '8px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', border: '1px solid', cursor: isFinalizado ? 'not-allowed' : 'pointer', backgroundColor: item.faltou ? '#fee2e2' : '#fff', color: item.faltou ? '#b91c1c' : '#64748b', borderColor: item.faltou ? '#fca5a5' : '#cbd5e1', transition: '0.2s'}}>
                        ❌ FALTA
                      </button>
                    </div>

                  </div>
                )})}
              </div>
            </div>
          )}

          <div className="card-secao">
            <div className="header-com-botoes">
              <h3 className="section-divider" style={{margin: 0, border: 'none'}}>📦 ITENS DO PEDIDO</h3>
              {!isFinalizado && (
                  <div className="botoes-acoes-itens">
                    <button type="button" className="btn-primary-outline" onClick={() => setModalAberto(true)}>+ ADC. PEÇAS</button>
                  </div>
              )}
            </div>

            <div className="carrinho-container mt-15">
              {carrinho.length === 0 ? (
                <div className="carrinho-vazio">Nenhuma peça adicionada.</div>
              ) : (
                <table className="tabela-carrinho">
                  <thead><tr><th width="50"></th><th>PRODUTO</th><th className="text-center">QTD</th><th className="text-right">TOTAL</th>{!isFinalizado && <th width="40"></th>}</tr></thead>
                  <tbody>
                    {carrinho.map(item => {
                      const precoExibicao = Number(item.preco || item.financeiro?.valorAluguel || 0);
                      
                      return (
                        <tr key={item.id} className="carrinho-item-card">
                          <td className="carrinho-img">
                            {item.foto ? <img src={item.foto} alt="Peça"/> : <div className="img-placeholder">📷</div>}
                          </td>
                          <td className="carrinho-info">
                            <strong>{item.nome}</strong>
                            <span>R$ {precoExibicao.toFixed(2)} un</span>
                          </td>
                          <td className="text-center">
                            {isFinalizado ? (
                                <div style={{fontWeight: 'bold', fontSize: '14px', background: '#f1f5f9', padding: '4px 12px', borderRadius: '6px', display: 'inline-block'}}>{item.qtd}x</div>
                            ) : (
                                <div className="controle-qtd">
                                  <button type="button" onClick={() => setCarrinho(carrinho.map(i => i.id === item.id ? {...i, qtd: Math.max(1, i.qtd-1)} : i))}>-</button>
                                  <span>{item.qtd}</span>
                                  <button type="button" onClick={() => setCarrinho(carrinho.map(i => i.id === item.id ? {...i, qtd: i.qtd+1} : i))}>+</button>
                                </div>
                            )}
                          </td>
                          <td className="text-right carrinho-total-item">
                            <strong>R$ {(precoExibicao * item.qtd).toFixed(2)}</strong>
                          </td>
                          {!isFinalizado && (
                              <td className="text-center">
                                <button type="button" className="btn-remover-item" onClick={() => setCarrinho(carrinho.filter(i => i.id !== item.id))}>🗑️</button>
                              </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card-secao">
            <h3 className="section-divider">🔒 OBSERVAÇÕES INTERNAS</h3>
            <div className="form-group">
              <textarea rows="2" placeholder="Anotações visíveis apenas para a equipe" value={obsInternas} onChange={e => setObsInternas(e.target.value)} disabled={isFinalizado}></textarea>
            </div>
          </div>

        </div>

        <aside className="coluna-financeiro">
          <div className="card-financeiro-sticky">
            <h3>💰 Financeiro</h3>
            <div className="fin-linha"><span>Subtotal Itens</span> <span>R$ {calcularTotal().subtotal.toFixed(2)}</span></div>
            <div className="fin-linha"><span>Frete</span> <span>+ R$ {getFreteNumerico().toFixed(2)}</span></div>
            <div className="fin-linha desconto-linha">
              <span>Desconto (R$)</span> 
              {isFinalizado ? (
                  <strong>{desconto}</strong>
              ) : (
                  <input type="number" min="0" value={desconto} onChange={e => setDesconto(e.target.value)} />
              )}
            </div>
            
            <div className="fin-total">
              <span>TOTAL</span>
              <strong>R$ {calcularTotal().total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
            </div>

            {valorJaPago > 0 && (
                <div style={{marginTop: '10px', padding: '10px', background: '#f0fdf4', borderRadius: '8px', color: '#166534', fontSize: '13px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold'}}>
                    <span>Já Pago (Sinal):</span>
                    <span>R$ {valorJaPago.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                </div>
            )}
            
            <hr style={{margin: '25px 0', border: 'none', borderTop: '2px dashed var(--borda)'}} />
            
            <h3 className="section-divider" style={{border: 'none', marginBottom: '15px'}}>PRÓXIMO PASSO DO PEDIDO</h3>

            <div className="fin-acoes" style={{marginTop: '0'}}>
                
                {statusAtual === 'orcamento' && (
                <button type="button" className="btn-salvar-form" onClick={() => interceptarSalvamento('confirmado')} style={{backgroundColor: '#3b82f6', marginBottom: '10px'}}>
                    ✔ APROVAR PEDIDO
                </button>
                )}

                {statusAtual === 'confirmado' && (
                <button type="button" className="btn-salvar-form" onClick={() => interceptarSalvamento('preparacao')} style={{backgroundColor: '#f59e0b', marginBottom: '10px'}}>
                    📦 INICIAR SEPARAÇÃO
                </button>
                )}

                {statusAtual === 'preparacao' && (
                <button type="button" className="btn-salvar-form" onClick={() => interceptarSalvamento('entregue')} style={{backgroundColor: '#8b5cf6', marginBottom: '10px'}}>
                    🚚 MARCAR COMO ENTREGUE
                </button>
                )}

                {statusAtual === 'entregue' && (
                <button type="button" className="btn-salvar-form" onClick={() => interceptarSalvamento('finalizado')} style={{backgroundColor: '#10b981', marginBottom: '10px'}}>
                    ✅ RECEBER E FINALIZAR
                </button>
                )}

                {isFinalizado && (
                <div style={{background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', padding: '15px', borderRadius: '8px', textAlign: 'center', fontWeight: '700', marginBottom: '10px', fontSize: '13px'}}>
                    🎉 Ciclo Concluído! Tudo Certo.
                </div>
                )}

                {!isFinalizado && (
                <button type="button" className="btn-voltar-link" style={{width: '100%', justifyContent: 'center'}} onClick={() => interceptarSalvamento()}>
                    💾 Apenas Salvar Alterações
                </button>
                )}
            </div>
          </div>
        </aside>
      </div>

      {/* =========================================================================
          🔥 NOVO MODAL INTELIGENTE DE SINAL (FIXO E UNIFICADO) 🔥 
          ========================================================================= */}
      {modalSinalAberto && (
        <div className="modal-overlay-premium" style={{zIndex: 99999}}>
          <div className="modal-box-premium" style={{maxWidth: '500px', background: '#fff', borderRadius: '16px', overflow: 'hidden'}}>
            
            <div style={{background: '#f8fafc', padding: '25px', borderBottom: '1px solid #e2e8f0', textAlign: 'center'}}>
               <h3 style={{margin: 0, color: '#0f172a', fontSize: '22px'}}>💰 Confirmação e Sinal</h3>
               
               <div style={{marginTop: '20px', padding: '20px', background: '#eff6ff', border: '2px dashed #3b82f6', borderRadius: '12px'}}>
                  <span style={{fontSize: '13px', color: '#1e3a8a', display: 'block', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px'}}>Valor Total do Pedido</span>
                  <strong style={{fontSize: '32px', color: '#1d4ed8'}}>R$ {calcularTotal().total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</strong>
               </div>
            </div>
            
            <form onSubmit={(e) => e.preventDefault()} style={{padding: '25px'}}>
               
               <div style={{display: 'flex', gap: '15px', marginBottom: '20px'}}>
                   <div className="form-group-pag" style={{flex: 1}}>
                     <label style={{fontWeight: 'bold', color: '#334155', fontSize: '13px'}}>Valor da Entrada (R$)</label>
                     <input 
                        type="text" 
                        placeholder="0,00" 
                        autoFocus
                        style={{fontSize: '22px', padding: '15px', textAlign: 'center', borderColor: '#3b82f6', color: '#1e3a8a', backgroundColor: '#fff', fontWeight: 'bold'}}
                        value={valorSinal} 
                        onChange={e => setValorSinal(maskCurrency(e.target.value))} 
                     />
                   </div>

                   <div className="form-group-pag" style={{flex: 1}}>
                     <label style={{fontWeight: 'bold', color: '#334155', fontSize: '13px'}}>Forma de Pagto.</label>
                     <select 
                        value={formaPagtoSinal} 
                        onChange={e => setFormaPagtoSinal(e.target.value)}
                        style={{padding: '15px', fontSize: '16px', height: '100%', borderColor: '#cbd5e1', backgroundColor: '#fff'}}
                     >
                         <option value="Pix">Pix</option>
                         <option value="Dinheiro">Dinheiro</option>
                         <option value="Cartão de Crédito">Cartão de Crédito</option>
                         <option value="Cartão de Débito">Cartão de Débito</option>
                     </select>
                   </div>
               </div>

               <div style={{ marginBottom: '20px' }}>
                  <button
                      type="button"
                      onClick={abrirWhatsAppCobranca}
                      style={{ width: '100%', padding: '14px', backgroundColor: '#22c55e', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '15px', transition: '0.2s', boxShadow: '0 4px 6px rgba(34, 197, 94, 0.2)' }}
                  >
                      <span style={{fontSize: '20px'}}>📱</span> Enviar Cobrança no WhatsApp
                  </button>
              </div>

              <hr style={{border: 'none', borderTop: '1px solid #e2e8f0', margin: '25px 0'}} />

              {/* BOTOES DE AÇÃO */}
              {valorDigitadoNum > 0 ? (
                  <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                     <button type="button" onClick={salvarSinalRecebido} disabled={salvandoPedido} style={{padding: '16px', background: '#0f172a', border: 'none', borderRadius: '10px', color: 'white', fontWeight: 'bold', fontSize: '15px', cursor: salvandoPedido ? 'not-allowed' : 'pointer', transition: '0.2s'}}>
                       {salvandoPedido ? 'Salvando...' : '✅ O cliente JÁ PAGOU (Aprovar Pedido)'}
                     </button>
                     
                     <button type="button" onClick={salvarAguardandoPagamento} disabled={salvandoPedido} style={{padding: '16px', background: '#fffbeb', border: '2px solid #fde68a', borderRadius: '10px', color: '#b45309', fontWeight: 'bold', fontSize: '15px', cursor: salvandoPedido ? 'not-allowed' : 'pointer', transition: '0.2s'}}>
                       {salvandoPedido ? 'Salvando...' : '⏳ AINDA VAI PAGAR (Manter como Orçamento)'}
                     </button>
                  </div>
               ) : (
                  <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                      <button type="button" onClick={salvarSemSinal} disabled={salvandoPedido} style={{padding: '16px', background: '#ef4444', border: 'none', borderRadius: '10px', color: 'white', fontWeight: 'bold', fontSize: '15px', cursor: salvandoPedido ? 'not-allowed' : 'pointer', transition: '0.2s'}}>
                          {salvandoPedido ? 'Salvando...' : '⚠️ Aprovar Pedido SEM RECEBER SINAL'}
                      </button>
                  </div>
               )}

               <button type="button" onClick={() => setModalSinalAberto(false)} style={{marginTop: '20px', width: '100%', padding: '14px', background: 'transparent', border: 'none', color: '#64748b', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline'}}>
                  Cancelar e Voltar
               </button>
            </form>
          </div>
        </div>
      )}

      {/* CATÁLOGO OTIMIZADO */}
      {modalAberto && !isFinalizado && (
        <div className="modal-overlay-premium">
          <div className="modal-box-premium catalogo-modal">
            <div className="modal-header">
              <h3>📦 Catálogo de Peças</h3>
              <button className="btn-fechar" onClick={() => setModalAberto(false)}>X</button>
            </div>
            
            <div className="catalogo-filtros">
              <input type="text" className="search-input-clean" style={{border: '1px solid var(--borda)', padding: '10px', borderRadius: '8px'}} placeholder="🔎 Buscar peça..." value={busca} onChange={e => setBusca(e.target.value)} />
              <div className="chips-categorias">
                {categoriasUnicas.map(cat => (
                  <button key={cat} type="button" className={`chip-cat ${filtroCategoria === cat ? 'active' : ''}`} onClick={() => setFiltroCategoria(cat)}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="catalogo-grid">
              {itensFiltrados.map(item => (
                <div key={item.id} className="peca-card" onClick={() => addCarrinho(item)}>
                  <div className="peca-img">
                      {item.foto ? <img src={item.foto} alt=""/> : '📷'}
                      <button className="btn-add-peca">+</button>
                  </div>
                  <div className="peca-info">
                    <strong>{item.nome}</strong>
                    <span>{item.categoria}</span>
                    <b className="txt-sucesso">R$ {item.financeiro?.valorAluguel || item.preco || 0}</b>
                  </div>
                </div>
              ))}
              {itensFiltrados.length === 0 && <p className="text-center w-100 mt-15" style={{color: 'var(--texto-secundario)'}}>Nenhuma peça encontrada.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditarLocacao;