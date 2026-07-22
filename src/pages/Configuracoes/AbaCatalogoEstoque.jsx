import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../../firebaseConfig';
import { collection, doc, updateDoc, arrayUnion, arrayRemove, query, getDocs, where, writeBatch } from 'firebase/firestore';

const AbaCatalogoEstoque = ({
  config,
  setConfig,
  carregarConfiguracoesGerais,
  tenantId,
  usuarioLogado
}) => {
  const [catFisicaSelecionada, setCatFisicaSelecionada] = useState('');
  const [subCatFisicaSelecionada, setSubCatFisicaSelecionada] = useState('');
  const [catVitrineSelecionada, setCatVitrineSelecionada] = useState('');
  const [subCatVitrineSelecionada, setSubCatVitrineSelecionada] = useState('');
  const [grupoVitrineSelecionado, setGrupoVitrineSelecionado] = useState('');
  const [temaVitrineSelecionado, setTemaVitrineSelecionado] = useState('');

  const [inputCatFisica, setInputCatFisica] = useState(''); 
  const [inputSubCatFisica, setInputSubCatFisica] = useState('');
  const [inputCatVitrine, setInputCatVitrine] = useState('');
  const [inputSubCatVitrine, setInputSubCatVitrine] = useState('');
  const [inputGrupoVitrine, setInputGrupoVitrine] = useState('');
  const [inputTemaVitrine, setInputTemaVitrine] = useState('');
  const [inputLoc, setInputLoc] = useState('');
  const [inputTam, setInputTam] = useState('');

  const [mostrarGuia, setMostrarGuia] = useState(true);

  // 📊 ESTADOS DOS KPIS DO GALPÃO & CATÁLOGO
  const [kpiStats, setKpiStats] = useState({
    totalPrateleiras: 0,
    totalItensComLocal: 0,
    totalItensSemLocal: 0,
    totalTemasVitrine: 0,
    contagemPorPrateleira: {}
  });
  const [carregandoKpis, setCarregandoKpis] = useState(true);

  // 🏷️ ESTADOS DO GERADOR DE ETIQUETAS
  const [modalEtiquetaAberto, setModalEtiquetaAberto] = useState(false);
  const [localizacaoEtiquetaAlvo, setLocalizacaoEtiquetaAlvo] = useState('TODAS');
  const [layoutEtiqueta, setLayoutEtiqueta] = useState('6'); // '6' = 6 por A4, '12' = 12 por A4, '1' = Individual/Térmica
  const [itensEstoquePorLocalizacao, setItensEstoquePorLocalizacao] = useState({});
  const [carregandoEtiquetas, setCarregandoEtiquetas] = useState(false);

  // 📦 HELPER PARA PEGAR PRATELEIRAS DO ITEM (MULTILOCALIZAÇÃO)
  const obterLocalizacoesDoItem = (d) => {
    if (Array.isArray(d.localizacoes) && d.localizacoes.length > 0) {
      return d.localizacoes;
    }
    if (d.localizacao && typeof d.localizacao === 'string') {
      return d.localizacao.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
  };

  const carregarKpis = async () => {
    if (!tenantId) return;
    setCarregandoKpis(true);
    try {
      const q = query(collection(db, "estoque"), where("userId", "==", tenantId));
      const snap = await getDocs(q);
      
      let comLocal = 0;
      let semLocal = 0;
      const contagemLoc = {};

      snap.forEach(docSnap => {
        const d = docSnap.data();
        const locs = obterLocalizacoesDoItem(d);
        if (locs.length > 0) {
          comLocal++;
          locs.forEach(l => {
            contagemLoc[l] = (contagemLoc[l] || 0) + 1;
          });
        } else {
          semLocal++;
        }
      });

      let totalTemas = 0;
      const vitrine = config.catalogoVitrine || {};
      Object.keys(vitrine).forEach(cat => {
        Object.keys(vitrine[cat] || {}).forEach(sub => {
          Object.keys(vitrine[cat][sub] || {}).forEach(grupo => {
            const arr = vitrine[cat][sub][grupo] || [];
            totalTemas += arr.length;
          });
        });
      });

      setKpiStats({
        totalPrateleiras: config.localizacoes?.length || 0,
        totalItensComLocal: comLocal,
        totalItensSemLocal: semLocal,
        totalTemasVitrine: totalTemas,
        contagemPorPrateleira: contagemLoc
      });
    } catch (e) {
      console.error("Erro ao carregar KPIs do galpão:", e);
    } finally {
      setCarregandoKpis(false);
    }
  };

  useEffect(() => {
    carregarKpis();
  }, [tenantId, config]);

  // 📊 GERAR MAPA DO GALPÃO EM PDF
  const gerarPdfMapaGalpao = async () => {
    const nomeEmpresa = config.nomeEmpresa || 'CELEBRE SISTEMA DE GESTÃO';
    const prateleiras = config.localizacoes || [];

    let agrupado = itensEstoquePorLocalizacao;
    if (Object.keys(agrupado).length === 0) {
      const q = query(collection(db, "estoque"), where("userId", "==", tenantId));
      const snap = await getDocs(q);
      agrupado = {};
      snap.forEach(docSnap => {
        const d = docSnap.data();
        const locs = obterLocalizacoesDoItem(d);
        const itemObj = {
          nome: d.nome || 'Item sem nome',
          quantidadeTotal: d.quantidadeTotal || d.quantidade || 1,
          categoria: d.categoriaFisica || d.categoria || 'Geral'
        };
        if (locs.length === 0) {
          if (!agrupado['Sem Prateleira']) agrupado['Sem Prateleira'] = [];
          agrupado['Sem Prateleira'].push(itemObj);
        } else {
          locs.forEach(l => {
            if (!agrupado[l]) agrupado[l] = [];
            agrupado[l].push(itemObj);
          });
        }
      });
    }

    const prateleirasHtml = prateleiras.map(locNome => {
      const itens = agrupado[locNome] || [];
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(locNome)}`;
      
      const itensTabela = itens.length === 0 
        ? `<tr><td colspan="3" style="text-align:center; padding:10px; color:#94a3b8; font-style:italic;">Nenhuma peça vinculada nesta prateleira.</td></tr>`
        : itens.map((item, idx) => `
            <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom:1px solid #e2e8f0;">
              <td style="padding:8px 12px; font-weight:600; color:#0f172a;">${item.nome}</td>
              <td style="padding:8px 12px; color:#64748b;">${item.categoria}</td>
              <td style="padding:8px 12px; font-weight:800; color:#2563eb; text-align:right;">Qtd: ${item.quantidadeTotal}</td>
            </tr>
          `).join('');

      return `
        <div style="margin-bottom: 24px; border: 2px solid #000000; border-radius: 10px; padding: 16px; page-break-inside: avoid; background: #ffffff;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #000000; padding-bottom:10px; margin-bottom:12px;">
            <div>
              <span style="font-size:10px; font-weight:800; color:#64748b; text-transform:uppercase;">LOCAL DE ARMAZENAGEM</span>
              <h3 style="margin:2px 0 0 0; font-size:18px; font-weight:900; color:#000000;">📍 ${locNome}</h3>
              <span style="font-size:11px; color:#2563eb; font-weight:700;">Total de Peças: ${itens.length} tipo(s)</span>
            </div>
            <div style="width:55px; height:55px; border:1px solid #cbd5e1; padding:2px; border-radius:6px;">
              <img src="${qrUrl}" style="width:100%; height:100%; object-fit:contain;" alt="QR Code" />
            </div>
          </div>

          <table style="width:100%; border-collapse:collapse; font-size:12px;">
            <thead>
              <tr style="background:#f1f5f9; border-bottom:1.5px solid #cbd5e1; text-align:left;">
                <th style="padding:8px 12px; font-weight:800; color:#334155;">Nome da Peça</th>
                <th style="padding:8px 12px; font-weight:800; color:#334155;">Categoria</th>
                <th style="padding:8px 12px; font-weight:800; color:#334155; text-align:right;">Quantidade</th>
              </tr>
            </thead>
            <tbody>
              ${itensTabela}
            </tbody>
          </table>
        </div>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Mapa Geral de Armazenagem do Galpão - ${nomeEmpresa}</title>
          <meta charset="utf-8" />
          <style>
            @page { margin: 12mm; size: A4; }
            body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; color: #000000; background: #ffffff; }
            .header-relatorio { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; }
            @media print { .no-print-btn { display: none !important; } body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="no-print-btn" style="margin-bottom: 20px; text-align: right;">
            <button onclick="window.print()" style="background: #2563eb; color: white; border: none; padding: 12px 24px; font-weight: bold; border-radius: 8px; cursor: pointer; font-size: 14px; box-shadow:0 4px 12px rgba(37,99,235,0.3);">
              🖨️ IMPRIMIR / SALVAR PDF DO MAPA
            </button>
          </div>

          <div class="header-relatorio">
            <div>
              <span style="font-size:11px; font-weight:800; color:#475569; text-transform:uppercase;">${nomeEmpresa}</span>
              <h2 style="margin:2px 0 0 0; font-size:22px; font-weight:900; color:#0f172a;">🗺️ MAPA DE ENDEREÇAMENTO E PRATELEIRAS DO GALPÃO</h2>
            </div>
            <div style="text-align:right; font-size:11px; color:#64748b;">
              <strong>Emissão:</strong> ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}<br/>
              <strong>Total Prateleiras:</strong> ${prateleiras.length}
            </div>
          </div>

          ${prateleirasHtml}
        </body>
      </html>
    `;

    const printWin = window.open('', '_blank', 'width=900,height=750');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(htmlContent);
      printWin.document.close();
      setTimeout(() => { printWin.print(); }, 400);
    }
  };

  // 📦 ESTADOS DO VINCULADOR DE PEÇAS À PRATELEIRA
  const [modalVincularAberto, setModalVincularAberto] = useState(false);
  const [prateleiraVincular, setPrateleiraVincular] = useState('');
  const [todosItensEstoque, setTodosItensEstoque] = useState([]);
  const [itensSelecionadosLoc, setItensSelecionadosLoc] = useState({}); // { itemId: true/false }
  const [buscaItemVincular, setBuscaItemVincular] = useState('');
  const [catFiltroVincular, setCatFiltroVincular] = useState('');
  const [salvandoVinculo, setSalvandoVinculo] = useState(false);
  const [carregandoItensVincular, setCarregandoItensVincular] = useState(false);

  const abrirVincularPecas = async (prateleiraNome) => {
    setPrateleiraVincular(prateleiraNome);
    setModalVincularAberto(true);
    setBuscaItemVincular('');
    setCatFiltroVincular('');
    setCarregandoItensVincular(true);
    try {
      const q = query(collection(db, "estoque"), where("userId", "==", tenantId));
      const snap = await getDocs(q);
      const lista = [];
      const mapaMarcados = {};

      snap.forEach(docSnap => {
        const d = docSnap.data();
        const locsItem = obterLocalizacoesDoItem(d);
        const itemObj = {
          id: docSnap.id,
          nome: d.nome || 'Item sem nome',
          localizacoes: locsItem,
          localizacao: locsItem.join(', '),
          categoriaFisica: d.categoriaFisica || d.categoria || 'Geral',
          subcategoriaFisica: d.subcategoriaFisica || d.subCategoria || '',
          quantidadeTotal: d.quantidadeTotal || d.quantidade || 1
        };
        lista.push(itemObj);
        if (locsItem.includes(prateleiraNome)) {
          mapaMarcados[docSnap.id] = true;
        }
      });

      setTodosItensEstoque(lista);
      setItensSelecionadosLoc(mapaMarcados);
    } catch (e) {
      console.error("Erro ao carregar estoque para vincular:", e);
    } finally {
      setCarregandoItensVincular(false);
    }
  };

  const toggleItemVinculo = (itemId) => {
    setItensSelecionadosLoc(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const salvarVinculoPrateleira = async () => {
    if (!prateleiraVincular || !usuarioLogado) return;
    setSalvandoVinculo(true);
    try {
      const batch = writeBatch(db);
      todosItensEstoque.forEach(item => {
        const estaMarcado = !!itensSelecionadosLoc[item.id];
        let locsAtuais = [...(item.localizacoes || [])];
        const contemEstaPrateleira = locsAtuais.includes(prateleiraVincular);
        const eUnico = (item.quantidadeTotal || 1) <= 1;

        if (eUnico) {
          // SE FOR PEÇA ÚNICA (Qtd: 1), ELA SÓ PODE FICAR EM UMA PRATELEIRA POR VEZ
          if (estaMarcado) {
            locsAtuais = [prateleiraVincular];
          } else if (contemEstaPrateleira) {
            locsAtuais = [];
          }
        } else {
          // SE FOR PEÇA COM QUANTIDADE > 1, PERMITE DISTRIBUIR EM VÁRIAS PRATELEIRAS
          if (estaMarcado && !contemEstaPrateleira) {
            locsAtuais.push(prateleiraVincular);
          } else if (!estaMarcado && contemEstaPrateleira) {
            locsAtuais = locsAtuais.filter(l => l !== prateleiraVincular);
          }
        }

        const docRef = doc(db, "estoque", item.id);
        const novaLocStr = locsAtuais.join(', ');
        batch.update(docRef, { 
          localizacoes: locsAtuais,
          localizacao: novaLocStr 
        });
      });

      await batch.commit();
      alert(`✅ Peças salvas com sucesso para "${prateleiraVincular}"!`);
      setModalVincularAberto(false);
      carregarConfiguracoesGerais();
    } catch (e) {
      console.error("Erro ao salvar vínculo de peças:", e);
      alert("Erro ao salvar alocação de peças.");
    } finally {
      setSalvandoVinculo(false);
    }
  };

  const abrirGeradorEtiquetas = async (localAlvo = 'TODAS') => {
    setLocalizacaoEtiquetaAlvo(localAlvo);
    setModalEtiquetaAberto(true);
    setCarregandoEtiquetas(true);
    try {
      const q = query(collection(db, "estoque"), where("userId", "==", tenantId));
      const snap = await getDocs(q);
      const agrupado = {};
      snap.forEach(docSnap => {
        const d = docSnap.data();
        const locsItem = obterLocalizacoesDoItem(d);
        const itemObj = {
          id: docSnap.id,
          nome: d.nome || 'Item sem nome',
          quantidadeTotal: d.quantidadeTotal || d.quantidade || 1,
          categoria: d.categoriaFisica || d.categoria || ''
        };

        if (locsItem.length === 0) {
          if (!agrupado['Sem Prateleira']) agrupado['Sem Prateleira'] = [];
          agrupado['Sem Prateleira'].push(itemObj);
        } else {
          locsItem.forEach(loc => {
            if (!agrupado[loc]) agrupado[loc] = [];
            agrupado[loc].push(itemObj);
          });
        }
      });
      setItensEstoquePorLocalizacao(agrupado);
    } catch (e) {
      console.error("Erro ao carregar estoque para etiquetas:", e);
    } finally {
      setCarregandoEtiquetas(false);
    }
  };

  // 🖨️ IMPRESSÃO EM JANELA LIMPA ISOLADA (100% GARANTIDO EM QUALQUER NAVEGADOR)
  const imprimirEtiquetasEmNovaJanela = () => {
    const listaLocs = localizacaoEtiquetaAlvo === 'TODAS' ? (config.localizacoes || []) : [localizacaoEtiquetaAlvo];
    const nomeEmpresa = config.nomeEmpresa || 'CELEBRE SISTEMA DE GESTÃO';

    let gridCols = 'repeat(2, 1fr)';
    if (layoutEtiqueta === '12') gridCols = 'repeat(3, 1fr)';
    if (layoutEtiqueta === '1') gridCols = '1fr';

    const cardsHtml = listaLocs.map(locNome => {
      const itensNoLocal = itensEstoquePorLocalizacao[locNome] || [];
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(locNome)}`;
      const maxItens = layoutEtiqueta === '12' ? 4 : 8;
      const itensExibidos = itensNoLocal.slice(0, maxItens);
      const restantes = itensNoLocal.length - maxItens;

      const itensHtml = itensNoLocal.length === 0
        ? `<div style="font-size:11px; color:#64748b; font-style:italic; padding:6px; background:#f8fafc; border-radius:6px; text-align:center;">Nenhuma peça alocada neste local.</div>`
        : `<ul style="margin:0; padding:0; list-style:none; display:flex; flex-direction:column; gap:4px;">
            ${itensExibidos.map(item => `
              <li style="display:flex; justify-content:space-between; align-items:center; font-size:11.5px; padding:4px 8px; background:#f8fafc; border-radius:6px; border:1px solid #e2e8f0; color:#1e293b;">
                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:600;">${item.nome}</span>
                <span style="font-weight:800; color:#2563eb; background:#dbeafe; padding:2px 6px; border-radius:4px; font-size:10.5px; margin-left:auto;">Qtd: ${item.quantidadeTotal}</span>
              </li>
            `).join('')}
            ${restantes > 0 ? `<li style="font-size:10px; color:#64748b; text-align:center; font-weight:700; padding-top:2px;">+ ${restantes} outros itens...</li>` : ''}
           </ul>`;

      return `
        <div style="border: 2px solid #000000; border-radius: 12px; padding: 16px; background: #ffffff; page-break-inside: avoid; break-inside: avoid; display: flex; flex-direction: column; gap: 10px; min-height: 200px; box-sizing: border-box;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #000000; padding-bottom: 8px;">
            <div>
              <div style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px;">${nomeEmpresa}</div>
              <h4 style="font-size: 17px; font-weight: 900; color: #000000; margin: 3px 0 0 0; text-transform: uppercase;">📍 ${locNome}</h4>
            </div>
            <div style="width: 60px; height: 60px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 2px; background: #ffffff;">
              <img src="${qrUrl}" style="width: 100%; height: 100%; object-fit: contain;" alt="QR Code" />
            </div>
          </div>

          <div style="flex: 1; margin-top: 8px;">
            <span style="font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">
              📦 Peças Cadastradas (${itensNoLocal.length}):
            </span>
            ${itensHtml}
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 6px; margin-top: auto;">
            <span>Celebre • Gestão de Galpão</span>
            <span>Emissão: ${new Date().toLocaleDateString('pt-BR')}</span>
          </div>
        </div>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Imprimir Etiquetas - ${nomeEmpresa}</title>
          <meta charset="utf-8" />
          <style>
            @page { margin: 10mm; size: auto; }
            body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 15px; background: #ffffff; color: #000000; }
            .grid-container { display: grid; grid-template-columns: ${gridCols}; gap: 10mm; width: 100%; box-sizing: border-box; }
            @media print {
              body { padding: 0; }
              .no-print-btn { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="no-print-btn" style="margin-bottom: 20px; text-align: right;">
            <button onclick="window.print()" style="background: #10b981; color: white; border: none; padding: 12px 24px; font-weight: bold; border-radius: 8px; cursor: pointer; font-size: 15px; box-shadow: 0 4px 12px rgba(16,185,129,0.3);">
              🖨️ IMPRIMIR / SALVAR PDF AGORA
            </button>
          </div>
          <div class="grid-container">
            ${cardsHtml}
          </div>
        </body>
      </html>
    `;

    const printWin = window.open('', '_blank', 'width=900,height=700');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(htmlContent);
      printWin.document.close();
      setTimeout(() => {
        printWin.print();
      }, 400);
    } else {
      alert("Por favor, permita pop-ups no seu navegador para abrir a janela de impressão.");
    }
  };

  const getDocConfigRef = () => doc(db, "configuracoes_empresa", tenantId);

  const verificarUsoNoEstoque = async (nomeDoCampoDeBusca, valorProcurado) => {
      if (!usuarioLogado) return 0;
      const q = query(collection(db, "estoque"), where("userId", "==", tenantId), where(nomeDoCampoDeBusca, "==", valorProcurado));
      const snap = await getDocs(q);
      return snap.size; 
  };

  const atualizarNomeNoEstoqueEmLote = async (campoBanco, valorAntigo, valorNovo) => {
      if (!campoBanco || !usuarioLogado) return;
      try {
          const q = query(collection(db, "estoque"), where("userId", "==", tenantId), where(campoBanco, "==", valorAntigo));
          const snap = await getDocs(q);
          if (snap.empty) return; 
          const batch = writeBatch(db);
          snap.forEach(docSnap => { batch.update(docSnap.ref, { [campoBanco]: valorNovo }); });
          await batch.commit(); 
      } catch(e) { console.error("Erro ao atualizar lote de estoque:", e); }
  };

  const adicionarVitrine = async (nivel, valor) => {
      if (!valor.trim() || !usuarioLogado) return;
      const docRef = getDocConfigRef();
      let novaVitrine = JSON.parse(JSON.stringify(config.catalogoVitrine || {}));
      try {
          if (nivel === 1) { 
              if (novaVitrine[valor.trim()]) { alert("Esta Categoria já existe!"); return; }
              novaVitrine[valor.trim()] = {};
              setInputCatVitrine('');
          } else if (nivel === 2) { 
              if (!catVitrineSelecionada) { alert("Selecione uma Categoria primeiro!"); return; }
              if (novaVitrine[catVitrineSelecionada][valor.trim()]) { alert("Esta Subcategoria já existe!"); return; }
              novaVitrine[catVitrineSelecionada][valor.trim()] = {};
              setInputSubCatVitrine('');
          } else if (nivel === 3) { 
              if (!subCatVitrineSelecionada) { alert("Selecione uma Subcategoria primeiro!"); return; }
              if (novaVitrine[catVitrineSelecionada][subCatVitrineSelecionada][valor.trim()]) { alert("Este Grupo já existe!"); return; }
              novaVitrine[catVitrineSelecionada][subCatVitrineSelecionada][valor.trim()] = [];
              setInputGrupoVitrine('');
          } else if (nivel === 4) { 
              if (!grupoVitrineSelecionado) { alert("Selecione um Grupo primeiro!"); return; }
              if (novaVitrine[catVitrineSelecionada][subCatVitrineSelecionada][grupoVitrineSelecionado].includes(valor.trim())) { alert("Este Tema já existe!"); return; }
              novaVitrine[catVitrineSelecionada][subCatVitrineSelecionada][grupoVitrineSelecionado].push(valor.trim());
              setInputTemaVitrine('');
          }
          await updateDoc(docRef, { catalogoVitrine: novaVitrine });
          setConfig(prev => ({...prev, catalogoVitrine: novaVitrine}));
      } catch(e) { alert("Erro ao salvar."); }
  };

  const removerVitrine = async (nivel, valor) => {
      let campoBanco = '';
      if (nivel === 1) campoBanco = 'categoriaTema';
      if (nivel === 2) campoBanco = 'subcategoriaTema';
      if (nivel === 3) campoBanco = 'grupoTema';
      if (nivel === 4) campoBanco = 'tema';

      if (campoBanco) {
          const emUso = await verificarUsoNoEstoque(campoBanco, valor);
          if (emUso > 0) { 
              alert(`⛔ AÇÃO BLOQUEADA!\n\nExistem ${emUso} peça(s) no Acervo usando "${valor}". Mude as peças antes de excluir.`);
              return; 
          }
      }
      if (!window.confirm(`Tem certeza que deseja apagar "${valor}"?`)) return;
      const docRef = getDocConfigRef();
      let novaVitrine = JSON.parse(JSON.stringify(config.catalogoVitrine || {}));
      try {
          if (nivel === 1) {
              delete novaVitrine[valor];
              setCatVitrineSelecionada(''); setSubCatVitrineSelecionada(''); setGrupoVitrineSelecionado(''); setTemaVitrineSelecionado('');
          } else if (nivel === 2) {
              delete novaVitrine[catVitrineSelecionada][valor];
              setSubCatVitrineSelecionada(''); setGrupoVitrineSelecionado(''); setTemaVitrineSelecionado('');
          } else if (nivel === 3) {
              delete novaVitrine[catVitrineSelecionada][subCatVitrineSelecionada][valor];
              setGrupoVitrineSelecionado(''); setTemaVitrineSelecionado('');
          } else if (nivel === 4) {
              let listaTemas = novaVitrine[catVitrineSelecionada][subCatVitrineSelecionada][grupoVitrineSelecionado];
              novaVitrine[catVitrineSelecionada][subCatVitrineSelecionada][grupoVitrineSelecionado] = listaTemas.filter(t => t !== valor);
              if (temaVitrineSelecionado === valor) setTemaVitrineSelecionado('');
          }
          await updateDoc(docRef, { catalogoVitrine: novaVitrine });
          setConfig(prev => ({...prev, catalogoVitrine: novaVitrine}));
      } catch(e) { alert("Erro ao excluir."); }
  };

  const editarVitrine = async (nivel, valorAntigo) => {
      const valorNovo = window.prompt(`Renomear "${valorAntigo}" para:`, valorAntigo);
      if (!valorNovo || valorNovo.trim() === valorAntigo) return;
      const novoTrim = valorNovo.trim();

      let campoBanco = '';
      if (nivel === 1) campoBanco = 'categoriaTema';
      if (nivel === 2) campoBanco = 'subcategoriaTema';
      if (nivel === 3) campoBanco = 'grupoTema';
      if (nivel === 4) campoBanco = 'tema';

      const docRef = getDocConfigRef();
      let novaVitrine = JSON.parse(JSON.stringify(config.catalogoVitrine || {}));
      try {
          if (nivel === 1) {
              if(novaVitrine[novoTrim]) { alert("Este nome já existe!"); return; }
              novaVitrine[novoTrim] = novaVitrine[valorAntigo]; delete novaVitrine[valorAntigo];
              if(catVitrineSelecionada === valorAntigo) setCatVitrineSelecionada(novoTrim);
          } else if (nivel === 2) {
              if(novaVitrine[catVitrineSelecionada][novoTrim]) { alert("Este nome já existe!"); return; }
              novaVitrine[catVitrineSelecionada][novoTrim] = novaVitrine[catVitrineSelecionada][valorAntigo]; delete novaVitrine[catVitrineSelecionada][valorAntigo];
              if(subCatVitrineSelecionada === valorAntigo) setSubCatVitrineSelecionada(novoTrim);
          } else if (nivel === 3) {
              if(novaVitrine[catVitrineSelecionada][subCatVitrineSelecionada][novoTrim]) { alert("Este nome já existe!"); return; }
              novaVitrine[catVitrineSelecionada][subCatVitrineSelecionada][novoTrim] = novaVitrine[catVitrineSelecionada][subCatVitrineSelecionada][valorAntigo]; delete novaVitrine[catVitrineSelecionada][subCatVitrineSelecionada][valorAntigo];
              if(grupoVitrineSelecionado === valorAntigo) setGrupoVitrineSelecionado(novoTrim);
          } else if (nivel === 4) {
              let listaTemas = novaVitrine[catVitrineSelecionada][subCatVitrineSelecionada][grupoVitrineSelecionado];
              if(listaTemas.includes(novoTrim)) { alert("Este nome já existe!"); return; }
              novaVitrine[catVitrineSelecionada][subCatVitrineSelecionada][grupoVitrineSelecionado] = listaTemas.map(t => t === valorAntigo ? novoTrim : t);
          }
          await updateDoc(docRef, { catalogoVitrine: novaVitrine });
          setConfig(prev => ({...prev, catalogoVitrine: novaVitrine}));
          await atualizarNomeNoEstoqueEmLote(campoBanco, valorAntigo, novoTrim);
      } catch(e) { alert("Erro ao editar."); console.error(e); }
  };

  const adicionarFisicoOuTamanho = async (campoArr, campoObj, chavePai, valor) => {
    if (!valor.trim() || !usuarioLogado) return;
    const docRef = getDocConfigRef();
    try {
      if (campoArr) {
        if (config[campoArr]?.includes(valor.trim())) { alert("Este item já existe!"); return; }
        await updateDoc(docRef, { [campoArr]: arrayUnion(valor.trim()) });
      } else if (campoObj && chavePai) {
        let objetoAtual = config[campoObj] || {};
        let listaAtual = objetoAtual[chavePai] || [];
        if (listaAtual.includes(valor.trim())) { alert("Este item já existe!"); return; }
        objetoAtual[chavePai] = [...listaAtual, valor.trim()];
        await updateDoc(docRef, { [campoObj]: objetoAtual });
      }
      carregarConfiguracoesGerais();
      if (campoArr === 'categoriasFisicas') setInputCatFisica('');
      if (campoObj === 'subcategoriasFisicas') setInputSubCatFisica('');
      if (campoObj === 'tamanhosPorCategoria') setInputTam('');
    } catch (e) { alert("Erro ao salvar."); console.error(e); }
  };

  const removerFisicoOuTamanho = async (campoArr, campoObj, chavePai, valor) => {
    let campoBanco = '';
    if (campoArr === 'categoriasFisicas') campoBanco = 'categoriaFisica';
    if (campoObj === 'subcategoriasFisicas') campoBanco = 'subcategoriaFisica';
    if (campoObj === 'tamanhosPorCategoria') campoBanco = 'tamanho';

    if (campoBanco) {
        const quantidadeEmUso = await verificarUsoNoEstoque(campoBanco, valor);
        if (quantidadeEmUso > 0) {
            alert(`⛔ AÇÃO BLOQUEADA!\n\nExistem ${quantidadeEmUso} peça(s) no seu Estoque cadastradas com "${valor}".`);
            return;
        }
    }
    if (!window.confirm(`Tem certeza que deseja apagar "${valor}"?`)) return;
    const docRef = getDocConfigRef();
    try {
      if (campoArr) {
        await updateDoc(docRef, { [campoArr]: arrayRemove(valor) });
      } else if (campoObj && chavePai) {
        let objetoAtual = config[campoObj] || {};
        let listaAtual = objetoAtual[chavePai] || [];
        objetoAtual[chavePai] = listaAtual.filter(i => i !== valor);
        await updateDoc(docRef, { [campoObj]: objetoAtual });
      }
      carregarConfiguracoesGerais();
    } catch (e) { alert("Erro ao excluir."); console.error(e); }
  };

  const editarFisicoOuTamanho = async (campoArr, campoObj, chavePai, valorAntigo) => {
      const valorNovo = window.prompt(`Renomear "${valorAntigo}" para:`, valorAntigo);
      if (!valorNovo || valorNovo.trim() === valorAntigo) return;
      const novoTrim = valorNovo.trim();

      let campoBanco = '';
      if (campoArr === 'categoriasFisicas') campoBanco = 'categoriaFisica';
      if (campoObj === 'subcategoriasFisicas') campoBanco = 'subcategoriaFisica';
      if (campoObj === 'tamanhosPorCategoria') campoBanco = 'tamanho';

      const docRef = getDocConfigRef();
      try {
          if (campoArr) {
              if (config[campoArr]?.includes(novoTrim)) { alert("Este nome já existe!"); return; }
              await updateDoc(docRef, { [campoArr]: arrayRemove(valorAntigo) });
              await updateDoc(docRef, { [campoArr]: arrayUnion(novoTrim) });
              if(catFisicaSelecionada === valorAntigo) setCatFisicaSelecionada(novoTrim);
          } else if (campoObj && chavePai) {
              let objetoAtual = config[campoObj] || {};
              let listaAtual = objetoAtual[chavePai] || [];
              if (listaAtual.includes(novoTrim)) { alert("Este nome já existe!"); return; }
              objetoAtual[chavePai] = listaAtual.map(item => item === valorAntigo ? novoTrim : item);
              await updateDoc(docRef, { [campoObj]: objetoAtual });
              if(subCatFisicaSelecionada === valorAntigo) setSubCatFisicaSelecionada(novoTrim);
          }
          carregarConfiguracoesGerais();
          await atualizarNomeNoEstoqueEmLote(campoBanco, valorAntigo, novoTrim);
      } catch (e) { alert("Erro ao editar."); console.error(e); }
  };

  const adicionarLocalizacao = async (valor) => {
    if (!valor.trim() || !usuarioLogado) return;
    if (config.localizacoes?.includes(valor.trim())) { alert("Esta localização já existe!"); return; }
    try { 
        await updateDoc(getDocConfigRef(), { localizacoes: arrayUnion(valor.trim()) }); 
        carregarConfiguracoesGerais(); 
        setInputLoc(''); 
    }
    catch (e) { alert("Erro ao adicionar."); }
  };

  const removerLocalizacao = async (valor) => {
    const quantidadeEmUso = await verificarUsoNoEstoque('localizacao', valor);
    if (quantidadeEmUso > 0) { alert(`⛔ AÇÃO BLOQUEADA!\n\nExistem ${quantidadeEmUso} peça(s) guardadas em "${valor}".`); return; }
    if (!window.confirm(`Remover prateleira/local "${valor}"?`)) return;
    try { await updateDoc(getDocConfigRef(), { localizacoes: arrayRemove(valor) }); carregarConfiguracoesGerais(); } 
    catch (e) { alert("Erro ao remover."); }
  };

  const editarLocalizacao = async (valorAntigo) => {
      const valorNovo = window.prompt(`Renomear "${valorAntigo}" para:`, valorAntigo);
      if (!valorNovo || valorNovo.trim() === valorAntigo) return;
      const novoTrim = valorNovo.trim();
      if(config.localizacoes.includes(novoTrim)) { alert("Esta localização já existe!"); return; }
      try {
          await updateDoc(getDocConfigRef(), { localizacoes: arrayRemove(valorAntigo) });
          await updateDoc(getDocConfigRef(), { localizacoes: arrayUnion(novoTrim) });
          carregarConfiguracoesGerais();
          await atualizarNomeNoEstoqueEmLote('localizacao', valorAntigo, novoTrim);
      } catch (e) { alert("Erro ao editar localização."); }
  };

  const categoriasVitrineArr = Object.keys(config.catalogoVitrine || {});
  const subcategoriasVitrineArr = catVitrineSelecionada ? Object.keys(config.catalogoVitrine[catVitrineSelecionada] || {}) : [];
  const gruposVitrineArr = (catVitrineSelecionada && subCatVitrineSelecionada) ? Object.keys(config.catalogoVitrine[catVitrineSelecionada][subCatVitrineSelecionada] || {}) : [];
  const temasVitrineArr = (catVitrineSelecionada && subCatVitrineSelecionada && grupoVitrineSelecionado) ? (config.catalogoVitrine[catVitrineSelecionada][subCatVitrineSelecionada][grupoVitrineSelecionado] || []) : [];

  return (
    <div className="aba-listas-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
      
      {/* 📊 PAINEL EXECUTIVO DE INDICADORES (KPIS) */}
      <div className="kpi-galpao-grid">
        <div className="kpi-galpao-card">
          <div className="kpi-galpao-icon blue">
            <i className="fas fa-cubes"></i>
          </div>
          <div>
            <div className="kpi-galpao-val">{kpiStats.totalPrateleiras}</div>
            <div className="kpi-galpao-title">Prateleiras Mapeadas</div>
          </div>
        </div>

        <div className="kpi-galpao-card">
          <div className="kpi-galpao-icon green">
            <i className="fas fa-boxes"></i>
          </div>
          <div>
            <div className="kpi-galpao-val">{kpiStats.totalItensComLocal}</div>
            <div className="kpi-galpao-title">Peças Mapeadas</div>
          </div>
        </div>

        <div 
          className="kpi-galpao-card" 
          onClick={() => abrirVincularPecas('Sem Prateleira')}
          style={{ cursor: 'pointer' }}
          title="Clique para organizar as peças sem localização"
        >
          <div className="kpi-galpao-icon amber">
            <i className="fas fa-exclamation-triangle"></i>
          </div>
          <div>
            <div className="kpi-galpao-val" style={{ color: kpiStats.totalItensSemLocal > 0 ? '#d97706' : 'inherit' }}>
              {kpiStats.totalItensSemLocal}
            </div>
            <div className="kpi-galpao-title" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              Sem Prateleira <i className="fas fa-arrow-right" style={{ fontSize: '10px' }}></i>
            </div>
          </div>
        </div>
      </div>

      {/* BANNER GUIA EXPLICATIVO INTERATIVO */}
      <div className="ajuda-cat-banner">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>💡</span>
            <div>
              <strong style={{ fontSize: '15px' }}>Como Funciona a Organização do Galpão e do Catálogo</strong>
              <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', opacity: 0.9 }}>
                Entenda a separação simples entre o seu Galpão Físico e as Categorias do seu Site.
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={() => setMostrarGuia(!mostrarGuia)}
            style={{ background: 'transparent', border: '1px solid currentColor', borderRadius: '8px', padding: '5px 12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', color: 'inherit' }}
          >
            {mostrarGuia ? 'Esconder Exemplo ▲' : 'Ver Exemplo ▼'}
          </button>
        </div>

        {mostrarGuia && (
          <div className="ajuda-cards-grid">
            <div className="ajuda-mini-card">
              <strong style={{ color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="fas fa-boxes"></i> 1. PRATELEIRAS DO GALPÃO (Físico)
              </strong>
              <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: 'var(--texto-secundario)', lineHeight: '1.45' }}>
                Onde você cadastra suas <strong>prateleiras reais</strong>, escolhe em <strong>"📦 Selecionar Peças"</strong> o que guarda em cada uma e gera as <strong>🏷️ Etiquetas com QR Code</strong>.
              </p>
            </div>

            <div className="ajuda-mini-card">
              <strong style={{ color: '#b48a3c', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="fas fa-globe"></i> 2. CATÁLOGO ONLINE & FESTAS (Estoque e Site)
              </strong>
              <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: 'var(--texto-secundario)', lineHeight: '1.45' }}>
                Onde você organiza os Temas de Festas em 4 passos <em>(Infantil ➔ Meninos ➔ Heróis ➔ Homem Aranha)</em> para seus clientes navegarem e montarem orçamentos no site.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* SEÇÃO 1: PRATELEIRAS DO GALPÃO & SELEÇÃO DE PEÇAS (FÍSICO) */}
      <div>
        <div className="step-title-badge">
          <span className="step-num blue">1</span>
          <span>🏬 Prateleiras & Endereçamento do Galpão (Seu Espaço Físico)</span>
        </div>
        <p className="subtext" style={{ marginBottom: '15px' }}>
          Cadastre suas prateleiras, selecione quais peças do acervo estão guardadas em cada uma e imprima as etiquetas.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
            <div className="config-card" style={{ margin: 0 }}>
              <div className="card-top-bar blue-bar"></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
                <h3 style={{ margin: 0 }}><i className="fas fa-map-marker-alt" style={{ color: '#3b82f6' }}></i> Prateleiras e Locais de Armazenagem</h3>
                
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {kpiStats.totalItensSemLocal > 0 && (
                    <button 
                      type="button" 
                      onClick={() => abrirVincularPecas('Sem Prateleira')}
                      style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <i className="fas fa-exclamation-triangle"></i> ⚠️ Peças Sem Local ({kpiStats.totalItensSemLocal})
                    </button>
                  )}

                  <button 
                    type="button" 
                    onClick={gerarPdfMapaGalpao}
                    style={{ background: '#f8fafc', color: '#0f172a', border: '1px solid #cbd5e1', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <i className="fas fa-file-pdf" style={{ color: '#ef4444' }}></i> 📊 Mapa em PDF
                  </button>

                  <button 
                    type="button" 
                    onClick={() => abrirGeradorEtiquetas('TODAS')}
                    style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <i className="fas fa-print"></i> 🖨️ Etiquetas do Galpão
                  </button>
                </div>
              </div>
              <p className="subtext" style={{ fontSize: '12px', marginBottom: '10px' }}>Ex: Corredor A - Prateleira 2, Caixotão 05</p>

              <div className="add-item-box">
                <input 
                  type="text" 
                  placeholder="Ex: Corredor A, Prateleira 2..." 
                  value={inputLoc} 
                  onChange={(e) => setInputLoc(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && adicionarLocalizacao(inputLoc)} 
                />
                <button className="btn-add" onClick={() => adicionarLocalizacao(inputLoc)}>+ Add Prateleira</button>
              </div>

              <ul className="config-list" style={{ maxHeight: '250px' }}>
                {config.localizacoes?.map(loc => {
                  const qtdNaPrateleira = kpiStats.contagemPorPrateleira[loc] || 0;
                  return (
                    <li key={loc} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <strong style={{ fontSize: '14px', color: '#0f172a' }}>{loc}</strong>
                        <span style={{ fontSize: '11px', color: '#2563eb', background: '#dbeafe', padding: '2px 8px', borderRadius: '12px', fontWeight: 800 }}>
                          📦 {qtdNaPrateleira} peça(s)
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => abrirVincularPecas(loc)}
                            title="Selecionar quais peças do estoque ficam nesta prateleira"
                            style={{
                              cursor: 'pointer',
                              fontSize: '11.5px',
                              background: '#eff6ff',
                              color: '#2563eb',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontWeight: '700',
                              border: '1px solid #bfdbfe',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <i className="fas fa-boxes"></i> 📦 Selecionar Peças
                          </button>
                          <span 
                            style={{ cursor: 'pointer', fontSize: '11.5px', background: '#f8fafc', color: '#0f172a', padding: '4px 10px', borderRadius: '6px', fontWeight: '700', border: '1px solid #cbd5e1' }} 
                            onClick={() => abrirGeradorEtiquetas(loc)} 
                            title="Gerar Etiqueta desta prateleira"
                          >
                            🏷️ Etiqueta
                          </span>
                          <span style={{ cursor: 'pointer', fontSize: '13px' }} onClick={() => editarLocalizacao(loc)} title="Editar Nome">✏️</span>
                          <span className="del-icon" onClick={() => removerLocalizacao(loc)} title="Excluir">✕</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
        </div>
      </div>

      {/* SEÇÃO 2: ÁRVORE DO CATÁLOGO PÚBLICO & ESTOQUE */}
      <div>
        <div className="step-title-badge">
          <span className="step-num gold">2</span>
          <span>🌐 Árvore do Catálogo Público & Estoque (Organização da Vitrine e Orçamentos)</span>
        </div>
        <p className="subtext" style={{ marginBottom: '15px' }}>
          Estrutura em 4 passos para organizar os temas no catálogo online onde seus clientes navegam e montam orçamentos.
        </p>

        {/* TRILHA DE NAVEGAÇÃO ATIVA */}
        <div className="caminho-ativo-bar">
            <i className="fas fa-sitemap" style={{ color: 'var(--dourado)', fontSize: '15px' }}></i>
            <span>Caminho Selecionado:</span>
            <span style={{ color: catVitrineSelecionada ? 'var(--dourado)' : '#94a3b8' }}>
              {catVitrineSelecionada || '[1. Ocasião]'}
            </span>
            <span>➔</span>
            <span style={{ color: subCatVitrineSelecionada ? 'var(--dourado)' : '#94a3b8' }}>
              {subCatVitrineSelecionada || '[2. Público]'}
            </span>
            <span>➔</span>
            <span style={{ color: grupoVitrineSelecionado ? 'var(--dourado)' : '#94a3b8' }}>
              {grupoVitrineSelecionado || '[3. Coleção]'}
            </span>
            <span>➔</span>
            <span style={{ color: temaVitrineSelecionado ? 'var(--dourado)' : '#94a3b8' }}>
              {temaVitrineSelecionado || '[4. Tema]'}
            </span>
          </div>

          {/* STEPPER EM 4 COLUNAS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              
              {/* PASSO 1 */}
              <div className="config-card" style={{ margin: 0 }}>
                <div className="card-top-bar gold-bar"></div>
                <h3>1. Tipo de Festa</h3>
                <p className="subtext" style={{ fontSize: '11.5px', marginBottom: '10px' }}>Ex: Infantil, 15 Anos, Casamento</p>

                <div className="add-item-box">
                  <input 
                    type="text" 
                    placeholder="+ Ex: Infantil..." 
                    value={inputCatVitrine} 
                    onChange={(e) => setInputCatVitrine(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && adicionarVitrine(1, inputCatVitrine)} 
                  />
                  <button className="btn-add" onClick={() => adicionarVitrine(1, inputCatVitrine)}>+ Add</button>
                </div>

                <ul className="config-list">
                  {categoriasVitrineArr.map(cat => (
                    <li key={cat} onClick={() => { setCatVitrineSelecionada(cat); setSubCatVitrineSelecionada(''); setGrupoVitrineSelecionado(''); setTemaVitrineSelecionado(''); }} className={catVitrineSelecionada === cat ? 'active-gold' : ''}>
                       <span>{cat}</span> 
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ cursor: 'pointer', fontSize: '13px' }} onClick={(e) => { e.stopPropagation(); editarVitrine(1, cat) }} title="Editar Nome">✏️</span>
                          <span className="del-icon" onClick={(e) => { e.stopPropagation(); removerVitrine(1, cat) }} title="Excluir">✕</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* PASSO 2 */}
              <div className="config-card" style={{ margin: 0 }}>
                <div className="card-top-bar gold-bar"></div>
                <h3>2. Público / Estilo</h3>
                <p className="subtext" style={{ fontSize: '11.5px', marginBottom: '10px' }}>Ex: Meninos, Meninas, Adulto</p>

                {!catVitrineSelecionada ? (
                  <div className="empty-state">
                    <i className="fas fa-arrow-left" style={{ color: 'var(--dourado)', display: 'block', marginBottom: '6px' }}></i>
                    Selecione um item no Passo 1.
                  </div>
                ) : (
                  <>
                    <div className="add-item-box">
                      <input 
                        type="text" 
                        placeholder="+ Ex: Meninos..." 
                        value={inputSubCatVitrine} 
                        onChange={(e) => setInputSubCatVitrine(e.target.value)} 
                        onKeyDown={(e) => e.key === 'Enter' && adicionarVitrine(2, inputSubCatVitrine)} 
                      />
                      <button className="btn-add" onClick={() => adicionarVitrine(2, inputSubCatVitrine)}>+ Add</button>
                    </div>
                    <ul className="config-list">
                      {subcategoriasVitrineArr.map(sub => (
                        <li key={sub} onClick={() => { setSubCatVitrineSelecionada(sub); setGrupoVitrineSelecionado(''); setTemaVitrineSelecionado(''); }} className={subCatVitrineSelecionada === sub ? 'active-gold' : ''}>
                          <span>{sub}</span> 
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ cursor: 'pointer', fontSize: '13px' }} onClick={(e) => { e.stopPropagation(); editarVitrine(2, sub) }} title="Editar Nome">✏️</span>
                              <span className="del-icon" onClick={(e) => { e.stopPropagation(); removerVitrine(2, sub); }} title="Excluir">✕</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              {/* PASSO 3 */}
              <div className="config-card" style={{ margin: 0 }}>
                <div className="card-top-bar gold-bar"></div>
                <h3>3. Coleção / Grupo</h3>
                <p className="subtext" style={{ fontSize: '11.5px', marginBottom: '10px' }}>Ex: Heróis, Princesas, Safári</p>

                {!subCatVitrineSelecionada ? (
                  <div className="empty-state">
                    <i className="fas fa-arrow-left" style={{ color: 'var(--dourado)', display: 'block', marginBottom: '6px' }}></i>
                    Selecione um item no Passo 2.
                  </div>
                ) : (
                  <>
                    <div className="add-item-box">
                      <input 
                        type="text" 
                        placeholder="+ Ex: Heróis..." 
                        value={inputGrupoVitrine} 
                        onChange={(e) => setInputGrupoVitrine(e.target.value)} 
                        onKeyDown={(e) => e.key === 'Enter' && adicionarVitrine(3, inputGrupoVitrine)} 
                      />
                      <button className="btn-add" onClick={() => adicionarVitrine(3, inputGrupoVitrine)}>+ Add</button>
                    </div>
                    <ul className="config-list">
                      {gruposVitrineArr.map(grupo => (
                        <li key={grupo} onClick={() => { setGrupoVitrineSelecionado(grupo); setTemaVitrineSelecionado(''); }} className={grupoVitrineSelecionado === grupo ? 'active-gold' : ''}>
                          <span>{grupo}</span> 
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ cursor: 'pointer', fontSize: '13px' }} onClick={(e) => { e.stopPropagation(); editarVitrine(3, grupo) }} title="Editar Nome">✏️</span>
                              <span className="del-icon" onClick={(e) => { e.stopPropagation(); removerVitrine(3, grupo); }} title="Excluir">✕</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              {/* PASSO 4 */}
              <div className="config-card" style={{ margin: 0 }}>
                <div className="card-top-bar gold-bar"></div>
                <h3>4. Tema Específico</h3>
                <p className="subtext" style={{ fontSize: '11.5px', marginBottom: '10px' }}>Ex: Homem Aranha, Frozen</p>

                {!grupoVitrineSelecionado ? (
                  <div className="empty-state">
                    <i className="fas fa-arrow-left" style={{ color: 'var(--dourado)', display: 'block', marginBottom: '6px' }}></i>
                    Selecione um item no Passo 3.
                  </div>
                ) : (
                  <>
                    <div className="add-item-box">
                      <input 
                        type="text" 
                        placeholder="+ Ex: Homem Aranha..." 
                        value={inputTemaVitrine} 
                        onChange={(e) => setInputTemaVitrine(e.target.value)} 
                        onKeyDown={(e) => e.key === 'Enter' && adicionarVitrine(4, inputTemaVitrine)} 
                      />
                      <button className="btn-add" onClick={() => adicionarVitrine(4, inputTemaVitrine)}>+ Add</button>
                    </div>
                    <ul className="config-list">
                      {temasVitrineArr.map(tema => (
                        <li key={tema} onClick={() => setTemaVitrineSelecionado(tema)} className={temaVitrineSelecionado === tema ? 'active-gold' : ''}>
                          <span>{tema}</span> 
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ cursor: 'pointer', fontSize: '13px' }} onClick={(e) => { e.stopPropagation(); editarVitrine(4, tema) }} title="Editar Nome">✏️</span>
                              <span className="del-icon" onClick={(e) => { e.stopPropagation(); removerVitrine(4, tema); }} title="Excluir">✕</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
          </div>
        </div>
      </div>

      {/* MODAL IMPRESSOR DE ETIQUETAS DA PRATELEIRA (Portal no body) */}
      {modalEtiquetaAberto && createPortal(
        <div className="modal-etiquetas-overlay" onClick={() => setModalEtiquetaAberto(false)}>
          <div className="modal-etiquetas-card" onClick={(e) => e.stopPropagation()}>
            
            {/* CABEÇALHO DO MODAL */}
            <div className="modal-etiquetas-header no-print">
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <i className="fas fa-print" style={{ color: '#2563eb' }}></i> Central de Impressão de Etiquetas do Galpão
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--texto-secundario)' }}>
                  Imprima etiquetas de prateleira com QR Code e lista de itens guardados.
                </p>
              </div>
              <button 
                type="button" 
                className="btn-danger-outline btn-fechar-etiqueta" 
                onClick={() => setModalEtiquetaAberto(false)}
                style={{ fontSize: '14px', padding: '6px 14px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
              >
                ✕ Fechar
              </button>
            </div>

            {/* BARRA DE CONTROLES DO MODAL (FORMATOS E SELEÇÃO) */}
            <div className="modal-etiquetas-controls no-print" style={{ padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid var(--borda)', display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--texto-secundario)' }}>📍 Prateleira Alvo:</label>
                <select 
                  value={localizacaoEtiquetaAlvo} 
                  onChange={(e) => setLocalizacaoEtiquetaAlvo(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--borda)', fontSize: '13.5px', fontWeight: 600 }}
                >
                  <option value="TODAS">🌟 Todas as Prateleiras ({config.localizacoes?.length || 0})</option>
                  {config.localizacoes?.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--texto-secundario)' }}>📄 Formato de Impressão:</label>
                <select 
                  value={layoutEtiqueta} 
                  onChange={(e) => setLayoutEtiqueta(e.target.value)}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--borda)', fontSize: '13.5px', fontWeight: 600 }}
                >
                  <option value="6">🏷️ Cartela A4 (6 Etiquetas Médias por Folha - 2 Colunas)</option>
                  <option value="12">🏷️ Cartela A4 (12 Etiquetas Pequenas por Folha - 3 Colunas)</option>
                  <option value="1">🏷️ Grande Individual / Impressora Térmica (1 por Folha)</option>
                </select>
              </div>

              <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
                <button 
                  type="button" 
                  onClick={imprimirEtiquetasEmNovaJanela}
                  style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', padding: '10px 20px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', boxShadow: '0 4px 12px rgba(16,185,129,0.2)' }}
                >
                  <i className="fas fa-print"></i> IMPRIMIR ETIQUETAS
                </button>
              </div>
            </div>

            {/* ÁREA DE PREVIEW DA IMPRESSÃO */}
            <div className="modal-etiquetas-body">
              {carregandoEtiquetas ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--texto-secundario)' }}>
                  <i className="fas fa-spinner fa-spin" style={{ fontSize: '24px', marginBottom: '10px' }}></i>
                  <p>Lendo dados do estoque para montar as etiquetas...</p>
                </div>
              ) : (
                <div className={`grid-etiquetas-container grid-${layoutEtiqueta}`}>
                  {(localizacaoEtiquetaAlvo === 'TODAS' ? (config.localizacoes || []) : [localizacaoEtiquetaAlvo]).map((locNome) => {
                    const itensNoLocal = itensEstoquePorLocalizacao[locNome] || [];
                    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(locNome)}`;

                    return (
                      <div key={locNome} className="etiqueta-prateleira-card">
                        
                        {/* CABEÇALHO DA ETIQUETA */}
                        <div className="etiqueta-header-top">
                          <div>
                            <div className="etiqueta-empresa-nome">
                              {config.nomeEmpresa || 'CELEBRE SISTEMA DE GESTÃO'}
                            </div>
                            <h4 className="etiqueta-loc-titulo">
                              📍 {locNome}
                            </h4>
                          </div>
                          <div className="etiqueta-qr-box" title="QR Code da Prateleira">
                            <img src={qrUrl} alt={`QR Code ${locNome}`} />
                          </div>
                        </div>

                        {/* LISTA DE ITENS GUARDADOS */}
                        <div style={{ flex: 1, marginTop: '8px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>
                            📦 Peças Cadastradas nesta Prateleira ({itensNoLocal.length}):
                          </span>

                          {itensNoLocal.length === 0 ? (
                            <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', padding: '6px', background: '#f8fafc', borderRadius: '6px', textAlign: 'center' }}>
                              Nenhuma peça alocada neste local no momento.
                            </div>
                          ) : (
                            <ul className="etiqueta-lista-itens">
                              {itensNoLocal.slice(0, layoutEtiqueta === '12' ? 4 : 8).map((item) => (
                                <li key={item.id} className="etiqueta-item-row">
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nome}</span>
                                  <span className="etiqueta-item-qtd">Qtd: {item.quantidadeTotal}</span>
                                </li>
                              ))}
                              {itensNoLocal.length > (layoutEtiqueta === '12' ? 4 : 8) && (
                                <li style={{ fontSize: '10px', color: '#64748b', textAlign: 'center', fontWeight: 700, paddingTop: '2px' }}>
                                  + {itensNoLocal.length - (layoutEtiqueta === '12' ? 4 : 8)} outros itens...
                                </li>
                              )}
                            </ul>
                          )}
                        </div>

                        {/* RODAPÉ DA ETIQUETA */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '9px', color: '#94a3b8', borderTop: '1px dashed #cbd5e1', paddingTop: '6px', marginTop: 'auto' }}>
                          <span>Celebre • Gestão de Galpão</span>
                          <span>Emissão: {new Date().toLocaleDateString('pt-BR')}</span>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* MODAL VINCULADOR DE PEÇAS À PRATELEIRA */}
      {modalVincularAberto && createPortal(
        <div className="modal-vincular-overlay" onClick={() => setModalVincularAberto(false)}>
          <div className="modal-vincular-card" onClick={(e) => e.stopPropagation()}>
            
            {/* CABEÇALHO DO MODAL */}
            <div className="modal-vincular-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <i className="fas fa-boxes" style={{ color: '#2563eb' }}></i> Organizar Peças em "{prateleiraVincular}"
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--texto-secundario)' }}>
                  Marque abaixo quais peças do seu estoque estão guardadas nesta prateleira.
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setModalVincularAberto(false)}
                style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '8px', padding: '6px 14px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}
              >
                ✕ Fechar
              </button>
            </div>

            {/* CONTROLES E BARRA DE BUSCA */}
            <div style={{ padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid var(--borda)', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <input 
                  type="text" 
                  placeholder="🔍 Pesquisar peça pelo nome..." 
                  value={buscaItemVincular} 
                  onChange={(e) => setBuscaItemVincular(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--borda)', fontSize: '13px' }}
                />
              </div>

              <div style={{ minWidth: '160px' }}>
                <select 
                  value={catFiltroVincular} 
                  onChange={(e) => setCatFiltroVincular(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--borda)', fontSize: '13px' }}
                >
                  <option value="">Todas as Categorias</option>
                  {config.categoriasFisicas?.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div style={{ fontSize: '12px', fontWeight: 800, color: '#2563eb', background: '#dbeafe', padding: '6px 12px', borderRadius: '8px' }}>
                Selecionadas: {Object.values(itensSelecionadosLoc).filter(Boolean).length} peça(s)
              </div>
            </div>

            {/* LISTA DE ITENS DO ESTOQUE COM CHECKBOXES */}
            <div className="modal-vincular-body">
              {carregandoItensVincular ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--texto-secundario)' }}>
                  <i className="fas fa-spinner fa-spin" style={{ fontSize: '24px', marginBottom: '8px' }}></i>
                  <p>Buscando itens do estoque...</p>
                </div>
              ) : (
                (() => {
                  const filtrados = todosItensEstoque.filter(item => {
                    const matchBusca = !buscaItemVincular || item.nome.toLowerCase().includes(buscaItemVincular.toLowerCase());
                    const matchCat = !catFiltroVincular || item.categoriaFisica === catFiltroVincular;
                    return matchBusca && matchCat;
                  });

                  if (filtrados.length === 0) {
                    return (
                      <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontStyle: 'italic' }}>
                        Nenhum item encontrado com esses filtros no seu estoque.
                      </div>
                    );
                  }

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {filtrados.map(item => {
                        const estaSelecionado = !!itensSelecionadosLoc[item.id];
                        const outrasLocs = (item.localizacoes || []).filter(l => l !== prateleiraVincular);

                        return (
                          <div 
                            key={item.id} 
                            onClick={() => toggleItemVinculo(item.id)}
                            className={`item-vinculo-row ${estaSelecionado ? 'selected' : ''}`}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <input 
                                type="checkbox" 
                                checked={estaSelecionado} 
                                onChange={() => {}} 
                                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#2563eb' }}
                              />
                              <div>
                                <strong style={{ fontSize: '14px', color: 'var(--texto-principal)', display: 'block' }}>
                                  {item.nome}
                                </strong>
                                <span style={{ fontSize: '12px', color: 'var(--texto-secundario)' }}>
                                  🏷️ {item.categoriaFisica} {item.subcategoriaFisica ? `• ${item.subcategoriaFisica}` : ''} • Qtd: <strong>{item.quantidadeTotal}</strong>
                                </span>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              {(() => {
                                const eUnico = (item.quantidadeTotal || 1) <= 1;
                                if (eUnico) {
                                  if (estaSelecionado) {
                                    if (outrasLocs.length > 0) {
                                      return (
                                        <span style={{ fontSize: '11px', color: '#1e40af', background: '#dbeafe', border: '1px solid #93c5fd', padding: '3px 8px', borderRadius: '6px', fontWeight: 800 }}>
                                          🔄 Transferindo de "{outrasLocs.join(', ')}" para esta prateleira
                                        </span>
                                      );
                                    }
                                    return (
                                      <span style={{ fontSize: '11px', color: '#047857', background: '#d1fae5', padding: '3px 8px', borderRadius: '6px', fontWeight: 800 }}>
                                        ✓ Alocado nesta prateleira
                                      </span>
                                    );
                                  }
                                  if (outrasLocs.length > 0) {
                                    return (
                                      <span style={{ fontSize: '11px', color: '#475569', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                                        📍 Atualmente em: {outrasLocs.join(', ')}
                                      </span>
                                    );
                                  }
                                } else {
                                  return (
                                    <>
                                      {outrasLocs.length > 0 && (
                                        <span style={{ fontSize: '11px', color: '#475569', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: '6px', fontWeight: 600 }}>
                                          📍 Também em: {outrasLocs.join(', ')}
                                        </span>
                                      )}
                                      {estaSelecionado && (
                                        <span style={{ fontSize: '11px', color: '#047857', background: '#d1fae5', padding: '3px 8px', borderRadius: '6px', fontWeight: 800 }}>
                                          ✓ Alocado nesta prateleira
                                        </span>
                                      )}
                                    </>
                                  );
                                }
                              })()}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>

            {/* RODAPÉ DO MODAL COM BOTÃO SALVAR */}
            <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid var(--borda)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                type="button" 
                onClick={() => setModalVincularAberto(false)}
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', color: '#475569' }}
              >
                Cancelar
              </button>

              <button 
                type="button" 
                onClick={salvarVinculoPrateleira}
                disabled={salvandoVinculo}
                style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(37,99,235,0.2)' }}
              >
                {salvandoVinculo ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                SALVAR E GUARDAR NA PRATELEIRA
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

export default AbaCatalogoEstoque;
