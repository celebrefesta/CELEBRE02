import React, { useState, useEffect } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs, doc, getDoc, writeBatch, setDoc, deleteDoc, addDoc } from 'firebase/firestore';

const AbaBackup = ({ tenantId, usuarioLogado, registrarLog }) => {
  const [loadingStats, setLoadingStats] = useState(true);
  const [gerandoBackup, setGerandoBackup] = useState(false);
  const [progresso, setProgresso] = useState('');
  const [estatisticas, setEstatisticas] = useState({
    clientes: 0,
    estoque: 0,
    locacoes: 0,
    financeiro: 0,
    fornecedores: 0,
    equipe: 0,
    compras: 0,
    logs: 0
  });

  // ESTADOS PARA RESTAURAÇÃO DE BACKUP (IMPORTAÇÃO JSON)
  const [modalRestore, setModalRestore] = useState(false);
  const [dadosBackupImportado, setDadosBackupImportado] = useState(null);
  const [nomeArquivoImportado, setNomeArquivoImportado] = useState('');
  const [modoRestore, setModoRestore] = useState('mesclar'); // 'mesclar' ou 'substituir'
  const [restaurando, setRestaurando] = useState(false);
  const [progressoRestore, setProgressoRestore] = useState('');

  useEffect(() => {
    carregarContadores();
  }, [tenantId]);

  const parseCSVString = (csvText) => {
    let text = csvText.replace(/^\uFEFF/, '').trim();
    const lines = text.split(/\r\n|\n|\r/).filter(line => line.trim() !== '');
    if (lines.length === 0) return [];

    const firstLine = lines[0];
    const sep = (firstLine.split(';').length >= firstLine.split(',').length) ? ';' : ',';

    const parseLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === sep && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const rawHeaders = parseLine(lines[0]);
    const headers = rawHeaders.map(h => h.replace(/^"+|"+$/g, '').trim());

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      if (values.length === 0) continue;
      const rowObj = {};
      headers.forEach((header, idx) => {
        let val = values[idx] !== undefined ? values[idx] : '';
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/""/g, '"');
        rowObj[header] = val;
      });
      
      // Normalizar chaves para o Firestore
      const depara = {
        'NOME / RAZÃO SOCIAL': 'nome',
        'CPF / CNPJ': 'cpf',
        'TELEFONE / WHATSAPP': 'celular',
        'E-MAIL': 'email',
        'ENDEREÇO COMPLETO': 'logradouro',
        'ESTADO (UF)': 'uf',
        'Nº CONTRATO / PEDIDO': 'numeroContrato',
        'STATUS DO PEDIDO': 'status',
        'STATUS PAGAMENTO': 'statusPagamento',
        'PREÇO LOCAÇÃO (R$)': 'precoLocacao',
        'PREÇO REPOSIÇÃO (R$)': 'precoReposicao',
        'QTD TOTAL': 'quantidadeTotal',
        'LOCALIZAÇÃO / PRATELEIRA': 'localizacao'
      };

      const docObj = {};
      Object.keys(rowObj).forEach(hk => {
        const v = rowObj[hk];
        if (v === '' || v === undefined || v === null) return;
        const upperH = hk.toUpperCase();
        const finalKey = depara[upperH] || hk.toLowerCase();
        docObj[finalKey] = v;
      });

      if (Object.keys(docObj).length > 0) rows.push(docObj);
    }
    return rows;
  };

  const handleSelecionarArquivoJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const filenameLower = file.name.toLowerCase();

    if (!filenameLower.endsWith('.json') && !filenameLower.endsWith('.csv')) {
      alert("⚠️ Por favor, selecione um arquivo em formato .json ou .csv");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        
        if (filenameLower.endsWith('.csv')) {
          const rows = parseCSVString(text);
          if (rows.length === 0) {
            alert("⚠️ A planilha CSV selecionada não contém linhas de dados.");
            return;
          }

          // Detectar coleção alvo a partir do nome do arquivo ou colunas
          let targetCol = 'clientes';
          if (filenameLower.includes('estoque')) targetCol = 'estoque';
          else if (filenameLower.includes('locac') || filenameLower.includes('contrat')) targetCol = 'locacoes';
          else if (filenameLower.includes('financ')) targetCol = 'financeiro';
          else if (filenameLower.includes('fornec')) targetCol = 'fornecedores';
          else if (filenameLower.includes('equipe')) targetCol = 'equipe';

          const parsed = {
            meta: { sistema: 'Celebre Sistema de Gestão', tipo: 'CSV Import' },
            isCSV: true,
            targetCol: targetCol,
            [targetCol]: rows
          };

          setDadosBackupImportado(parsed);
          setNomeArquivoImportado(file.name);
          setModalRestore(true);
          return;
        }

        // Se for arquivo JSON
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object') {
          alert("⚠️ O arquivo selecionado não contém uma estrutura JSON válida.");
          return;
        }

        const temDados = parsed.clientes || parsed.estoque || parsed.locacoes || parsed.financeiro || parsed.meta;
        if (!temDados) {
          alert("⚠️ O arquivo JSON selecionado não parece ser um backup válido do Celebre.");
          return;
        }

        setDadosBackupImportado(parsed);
        setNomeArquivoImportado(file.name);
        setModalRestore(true);
      } catch (err) {
        console.error("Erro ao ler arquivo:", err);
        alert("⚠️ Erro ao ler o arquivo. Certifique-se de que é um JSON ou CSV válido.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const executarRestauracao = async () => {
    if (!dadosBackupImportado || !tenantId) return;
    setRestaurando(true);
    setProgressoRestore('Iniciando processo de restauração...');

    try {
      const mapaColecoes = [
        { keyInBackup: 'clientes', colName: 'clientes', userField: 'userId' },
        { keyInBackup: 'estoque', colName: 'estoque', userField: 'userId' },
        { keyInBackup: 'locacoes', colName: 'locacoes', userField: 'userId' },
        { keyInBackup: 'financeiro', colName: 'financeiro_lancamentos', userField: 'userId' },
        { keyInBackup: 'fornecedores', colName: 'fornecedores', userField: 'userId' },
        { keyInBackup: 'equipe', colName: 'equipe', userField: 'empresaId' },
        { keyInBackup: 'listaCompras', colName: 'lista_compras', userField: 'userId' },
        { keyInBackup: 'logsAuditoria', colName: 'logs_atividades', userField: 'empresaId' }
      ];

      // Se o modo for 'substituir', apaga primeiro os documentos atuais da empresa
      if (modoRestore === 'substituir') {
        setProgressoRestore('Limpando registros atuais da empresa para substituição...');
        for (const item of mapaColecoes) {
          // Se for importação CSV de um módulo específico, limpa APENAS a coleção importada!
          if (dadosBackupImportado.isCSV && dadosBackupImportado.targetCol && item.keyInBackup !== dadosBackupImportado.targetCol) {
            continue;
          }
          // Nunca limpa logs_atividades (logs de auditoria são históricamente protegidos no Firestore)
          if (item.colName === 'logs_atividades') continue;

          try {
            const q = query(collection(db, item.colName), where(item.userField, '==', tenantId));
            const snap = await getDocs(q);
            if (!snap.empty) {
              let bClean = writeBatch(db);
              let countClean = 0;
              for (const d of snap.docs) {
                bClean.delete(d.ref);
                countClean++;
                if (countClean % 400 === 0) {
                  await bClean.commit();
                  bClean = writeBatch(db);
                }
              }
              if (countClean % 400 !== 0) await bClean.commit();
            }
          } catch (e) {
            // Se falhar por filtro alternativo (ex: empresaId em vez de userId)
            try {
              const altField = item.userField === 'userId' ? 'empresaId' : 'userId';
              const qAlt = query(collection(db, item.colName), where(altField, '==', tenantId));
              const snapAlt = await getDocs(qAlt);
              if (!snapAlt.empty) {
                let bClean = writeBatch(db);
                let countClean = 0;
                for (const d of snapAlt.docs) {
                  bClean.delete(d.ref);
                  countClean++;
                  if (countClean % 400 === 0) {
                    await bClean.commit();
                    bClean = writeBatch(db);
                  }
                }
                if (countClean % 400 !== 0) await bClean.commit();
              }
            } catch (e2) {
              console.warn(`Aviso ao limpar coleção ${item.colName}:`, e2);
            }
          }
        }
      }

      // Restaurar configurações da empresa se existirem
      if (dadosBackupImportado.empresa && Object.keys(dadosBackupImportado.empresa).length > 0) {
        setProgressoRestore('Restaurando Configurações da Empresa...');
        try {
          await setDoc(doc(db, "configuracoes_empresa", tenantId), dadosBackupImportado.empresa, { merge: true });
        } catch (e) {
          console.warn("Erro ao restaurar configurações:", e);
        }
      }

      // Restaurar cada coleção em lotes
      for (const modulo of mapaColecoes) {
        const itens = dadosBackupImportado[modulo.keyInBackup];
        if (!itens || !Array.isArray(itens) || itens.length === 0) continue;

        setProgressoRestore(`Restaurando ${itens.length} registros de ${modulo.colName}...`);

        let batch = writeBatch(db);
        let contador = 0;

        for (const item of itens) {
          const { _id, ...resto } = item;
          const dadosParaSalvar = {
            ...resto,
            [modulo.userField]: tenantId,
            restauradoEm: new Date().toISOString()
          };

          const docRef = _id ? doc(db, modulo.colName, _id) : doc(collection(db, modulo.colName));
          batch.set(docRef, dadosParaSalvar, { merge: true });

          contador++;
          if (contador % 400 === 0) {
            await batch.commit();
            batch = writeBatch(db);
          }
        }

        if (contador % 400 !== 0) {
          await batch.commit();
        }
      }

      if (registrarLog) {
        await registrarLog("RESTAURAÇÃO DE BACKUP", `Restaurou backup do arquivo "${nomeArquivoImportado}" no modo: ${modoRestore.toUpperCase()}.`);
      }

      setProgressoRestore('');
      setModalRestore(false);
      setDadosBackupImportado(null);
      await carregarContadores();
      alert("✅ Restauração concluída com sucesso! Todos os dados foram importados para a sua empresa.");
    } catch (err) {
      console.error("Erro durante a restauração de backup:", err);
      alert("⚠️ Ocorreu um erro durante a restauração. Tente novamente.");
    } finally {
      setRestaurando(false);
      setProgressoRestore('');
    }
  };

  const carregarContadores = async () => {
    if (!tenantId) return;
    setLoadingStats(true);
    try {
      const colecoes = [
        { key: 'clientes', col: 'clientes' },
        { key: 'estoque', col: 'estoque' },
        { key: 'locacoes', col: 'locacoes' },
        { key: 'financeiro', col: 'financeiro_lancamentos' },
        { key: 'fornecedores', col: 'fornecedores' },
        { key: 'equipe', col: 'equipe' },
        { key: 'compras', col: 'lista_compras' },
        { key: 'logs', col: 'logs_atividades' }
      ];

      const contagens = {};

      for (const item of colecoes) {
        try {
          const q = query(collection(db, item.col), where('userId', '==', tenantId));
          const snap = await getDocs(q);
          contagens[item.key] = snap.size;
        } catch (e) {
          try {
            const qAlt = query(collection(db, item.col), where('empresaId', '==', tenantId));
            const snapAlt = await getDocs(qAlt);
            contagens[item.key] = snapAlt.size;
          } catch (e2) {
            contagens[item.key] = 0;
          }
        }
      }

      setEstatisticas(contagens);
    } catch (err) {
      console.error("Erro ao carregar contadores para o backup:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  const buscarColecaoCompleta = async (nomeColecao, campoFiltro = 'userId') => {
    try {
      const q = query(collection(db, nomeColecao), where(campoFiltro, '==', tenantId));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    } catch (e) {
      if (campoFiltro === 'userId') {
        return buscarColecaoCompleta(nomeColecao, 'empresaId');
      }
      return [];
    }
  };

  const gerarBackupCompletoJSON = async () => {
    setGerandoBackup(true);
    setProgresso('Iniciando extração total dos dados...');

    try {
      setProgresso('Extraindo Dados da Empresa...');
      let configEmpresa = {};
      try {
        const confSnap = await getDoc(doc(db, "configuracoes_empresa", tenantId));
        if (confSnap.exists()) configEmpresa = confSnap.data();
      } catch (e) {}

      setProgresso('Extraindo Clientes...');
      const clientes = await buscarColecaoCompleta('clientes');

      setProgresso('Extraindo Estoque...');
      const estoque = await buscarColecaoCompleta('estoque');

      setProgresso('Extraindo Pedidos e Locações...');
      const locacoes = await buscarColecaoCompleta('locacoes');

      setProgresso('Extraindo Lançamentos Financeiros...');
      const financeiro = await buscarColecaoCompleta('financeiro_lancamentos');

      setProgresso('Extraindo Fornecedores...');
      const fornecedores = await buscarColecaoCompleta('fornecedores');

      setProgresso('Extraindo Membros da Equipe...');
      const equipe = await buscarColecaoCompleta('equipe');

      setProgresso('Extraindo Lista de Compras...');
      const compras = await buscarColecaoCompleta('lista_compras');

      setProgresso('Extraindo Logs de Auditoria...');
      const logs = await buscarColecaoCompleta('logs_atividades');

      setProgresso('Compactando arquivo de backup...');

      const backupObjeto = {
        meta: {
          sistema: 'Celebre Sistema de Gestão de Eventos e Locações',
          versao: '2.0 (Enterprise)',
          dataGeracao: new Date().toISOString(),
          tenantId: tenantId,
          geradoPor: usuarioLogado?.email || 'Administrador',
          conformidadeLGPD: 'Art. 18, V - Direito à Portabilidade de Dados'
        },
        empresa: configEmpresa,
        clientes,
        estoque,
        locacoes,
        financeiro,
        fornecedores,
        equipe,
        listaCompras: compras,
        logsAuditoria: logs
      };

      const jsonStr = JSON.stringify(backupObjeto, null, 2);
      const encodedData = "data:application/json;charset=utf-8," + encodeURIComponent(jsonStr);
      const link = document.createElement('a');
      const dataFormatada = new Date().toISOString().split('T')[0];
      link.href = encodedData;
      link.setAttribute('download', `BACKUP_CELEBRE_${configEmpresa.nomeEmpresa || 'EMPRESA'}_${dataFormatada}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (registrarLog) {
        await registrarLog("BACKUP COMPLETO", "Realizou o download do backup completo em formato JSON (LGPD).");
      }

      setProgresso('');
      alert("✅ Backup completo baixado com sucesso!");
    } catch (err) {
      console.error("Erro ao gerar backup completo:", err);
      alert("⚠️ Erro ao gerar o backup. Tente novamente.");
    } finally {
      setGerandoBackup(false);
      setProgresso('');
    }
  };

  const exportarCSVDinamico = (dados, nomeArquivo) => {
    if (!dados || dados.length === 0) {
      alert("Não há dados cadastrados neste módulo para exportar.");
      return;
    }

    // Identificar dinamicamente TODAS as chaves/propriedades existentes em qualquer documento da coleção
    const chavesSet = new Set();
    
    // Garantir que identificadores principais fiquem nas primeiras colunas
    const prioridades = ['id', '_id', 'nome', 'codigo', 'sku', 'numeroContrato', 'clienteNome', 'descricao', 'cpf', 'cnpj', 'email', 'telefone', 'celular', 'categoria', 'tipo', 'valor', 'valorTotal', 'status', 'criadoEm'];
    prioridades.forEach(p => {
      if (dados.some(item => item[p] !== undefined && item[p] !== null)) {
        chavesSet.add(p);
      }
    });

    // Adicionar todas as outras chaves existentes nos objetos
    dados.forEach(item => {
      Object.keys(item).forEach(key => {
        // Ignorar apenas imagens gigantes em base64 se houver, para manter a planilha leve
        if (typeof item[key] === 'string' && item[key].startsWith('data:image/')) return;
        chavesSet.add(key);
      });
    });

    const colunas = Array.from(chavesSet);

    let csvContent = '\uFEFF'; // BOM UTF-8 para o Excel abrir com acentos e colunas perfeitas
    csvContent += colunas.map(col => `"${col.toUpperCase()}"`).join(';') + '\n';

    dados.forEach(item => {
      const linha = colunas.map(col => {
        let val = item[col];
        if (val === undefined || val === null) val = '';
        
        if (typeof val === 'object') {
          if (val.toDate) {
            val = val.toDate().toLocaleString('pt-BR');
          } else if (val.seconds) {
            val = new Date(val.seconds * 1000).toLocaleString('pt-BR');
          } else {
            val = JSON.stringify(val);
          }
        }

        // Limpar quebras de linha para não quebrar a estrutura de linhas do Excel
        val = String(val).replace(/[\r\n]+/g, ' ').replace(/"/g, '""');
        return `"${val}"`;
      }).join(';');
      csvContent += linha + '\n';
    });

    const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
    const link = document.createElement('a');
    link.href = encodedUri;
    link.setAttribute('download', `${nomeArquivo}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportarClientesCSV = async () => {
    setGerandoBackup(true);
    setProgresso('Gerando planilha 100% completa de Clientes...');
    try {
      const dados = await buscarColecaoCompleta('clientes');
      exportarCSVDinamico(dados, 'TODOS_OS_DADOS_CLIENTES');
      if (registrarLog) await registrarLog("EXPORTAÇÃO DADOS", "Exportou planilha CSV completa de Clientes (100% dos campos).");
    } finally {
      setGerandoBackup(false);
      setProgresso('');
    }
  };

  const exportarEstoqueCSV = async () => {
    setGerandoBackup(true);
    setProgresso('Gerando planilha 100% completa de Estoque...');
    try {
      const dados = await buscarColecaoCompleta('estoque');
      exportarCSVDinamico(dados, 'TODOS_OS_DADOS_ESTOQUE');
      if (registrarLog) await registrarLog("EXPORTAÇÃO DADOS", "Exportou planilha CSV completa do Estoque (100% dos campos).");
    } finally {
      setGerandoBackup(false);
      setProgresso('');
    }
  };

  const exportarLocacoesCSV = async () => {
    setGerandoBackup(true);
    setProgresso('Gerando planilha 100% completa de Locações...');
    try {
      const dados = await buscarColecaoCompleta('locacoes');
      exportarCSVDinamico(dados, 'TODOS_OS_DADOS_LOCACOES_CONTRATOS');
      if (registrarLog) await registrarLog("EXPORTAÇÃO DADOS", "Exportou planilha CSV completa de Locações (100% dos campos).");
    } finally {
      setGerandoBackup(false);
      setProgresso('');
    }
  };

  const exportarFinanceiroCSV = async () => {
    setGerandoBackup(true);
    setProgresso('Gerando planilha 100% completa do Financeiro...');
    try {
      const dados = await buscarColecaoCompleta('financeiro_lancamentos');
      exportarCSVDinamico(dados, 'TODOS_OS_DADOS_FINANCEIRO');
      if (registrarLog) await registrarLog("EXPORTAÇÃO DADOS", "Exportou planilha CSV completa do Financeiro (100% dos campos).");
    } finally {
      setGerandoBackup(false);
      setProgresso('');
    }
  };

  const exportarFornecedoresCSV = async () => {
    setGerandoBackup(true);
    setProgresso('Gerando planilha 100% completa de Fornecedores...');
    try {
      const dados = await buscarColecaoCompleta('fornecedores');
      exportarCSVDinamico(dados, 'TODOS_OS_DADOS_FORNECEDORES');
      if (registrarLog) await registrarLog("EXPORTAÇÃO DADOS", "Exportou planilha CSV completa de Fornecedores.");
    } finally {
      setGerandoBackup(false);
      setProgresso('');
    }
  };

  const exportarEquipeCSV = async () => {
    setGerandoBackup(true);
    setProgresso('Gerando planilha 100% completa de Equipe...');
    try {
      const dados = await buscarColecaoCompleta('equipe');
      exportarCSVDinamico(dados, 'TODOS_OS_DADOS_EQUIPE');
      if (registrarLog) await registrarLog("EXPORTAÇÃO DADOS", "Exportou planilha CSV completa da Equipe.");
    } finally {
      setGerandoBackup(false);
      setProgresso('');
    }
  };

  return (
    <div className="backup-container fade-in">
      
      {/* HEADER LGPD & SEGURANÇA */}
      <div className="backup-hero-card">
        <div className="hero-content">
          <div className="hero-badge">
            <i className="fas fa-shield-alt"></i> Conformidade LGPD • Art. 18, V
          </div>
          <h2>Backup Completo e Portabilidade dos Dados</h2>
          <p>
            Baixe a qualquer momento uma cópia integral de 100% da base de dados da sua empresa. 
            Você possui soberania total sobre seus dados de clientes, acervo de estoque, contratos e finanças.
          </p>
        </div>
        <div className="hero-icon-box">
          <i className="fas fa-database"></i>
        </div>
      </div>

      {/* BOTÕES DE BACKUP E RESTAURAÇÃO INTEGRAL */}
      <div className="backup-actions-row">
        <div className="backup-main-action-card">
          <div className="action-info">
            <h3>
              <i className="fas fa-file-archive text-amber"></i> Backup Integral da Conta (JSON)
            </h3>
            <p>
              Gera um arquivo completo com todos os 9 módulos da empresa organizados com data e assinatura digital. 
              Ideal para guardas de segurança em HDs externos ou servidores da empresa.
            </p>
          </div>

          <button 
            className="btn-backup-master" 
            onClick={gerarBackupCompletoJSON} 
            disabled={gerandoBackup || restaurando}
          >
            {gerandoBackup ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> {progresso || 'Processando...'}
              </>
            ) : (
              <>
                <i className="fas fa-download"></i> BAIXAR BACKUP COMPLETO
              </>
            )}
          </button>
        </div>

        <div className="backup-main-action-card restore-card">
          <div className="action-info">
            <h3>
              <i className="fas fa-file-upload text-blue"></i> Restaurar / Importar Backup (JSON ou CSV)
            </h3>
            <p>
              Selecione um arquivo de backup (`.json`) ou uma planilha (`.csv` de Clientes, Estoque ou Finanças) para restaurar ou importar seus dados.
            </p>
          </div>

          <label className="btn-restore-master">
            <i className="fas fa-upload"></i> IMPORTAR ARQUIVO (JSON / CSV)
            <input 
              type="file" 
              accept=".json,.csv" 
              onChange={handleSelecionarArquivoJSON} 
              disabled={gerandoBackup || restaurando}
              style={{ display: 'none' }} 
            />
          </label>
        </div>
      </div>

      {/* PAINEL DE RESUMO DA BASE DE DADOS */}
      <div className="backup-stats-section">
        <h3 className="section-title">
          <i className="fas fa-cubes"></i> Resumo Atual da Base da Sua Empresa
        </h3>
        
        {loadingStats ? (
          <div className="stats-loading">
            <i className="fas fa-spinner fa-spin"></i> Calculando volume da base...
          </div>
        ) : (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon purple"><i className="fas fa-users"></i></div>
              <div className="stat-data">
                <span className="stat-number">{estatisticas.clientes}</span>
                <span className="stat-label">Clientes</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon amber"><i className="fas fa-boxes"></i></div>
              <div className="stat-data">
                <span className="stat-number">{estatisticas.estoque}</span>
                <span className="stat-label">Itens de Estoque</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon blue"><i className="fas fa-file-contract"></i></div>
              <div className="stat-data">
                <span className="stat-number">{estatisticas.locacoes}</span>
                <span className="stat-label">Locações & Pedidos</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon green"><i className="fas fa-dollar-sign"></i></div>
              <div className="stat-data">
                <span className="stat-number">{estatisticas.financeiro}</span>
                <span className="stat-label">Lançamentos Financeiros</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon cyan"><i className="fas fa-truck"></i></div>
              <div className="stat-data">
                <span className="stat-number">{estatisticas.fornecedores}</span>
                <span className="stat-label">Fornecedores</span>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon pink"><i className="fas fa-user-shield"></i></div>
              <div className="stat-data">
                <span className="stat-number">{estatisticas.equipe}</span>
                <span className="stat-label">Membros da Equipe</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* EXPORTAÇÃO ESPECÍFICA EM PLANILHAS (EXCEL / CSV) */}
      <div className="backup-exports-section">
        <h3 className="section-title">
          <i className="fas fa-file-excel text-green"></i> Exportação Rápida para Excel / CSV
        </h3>
        <p className="section-sub">
          Baixe tabelas formatadas em CSV compatíveis com Microsoft Excel, Google Sheets ou Apple Numbers para análises e relatórios.
        </p>

        <div className="exports-grid">
          <div className="export-box">
            <div className="export-header">
              <i className="fas fa-users color-purple"></i>
              <h4>Base de Clientes (100%)</h4>
            </div>
            <p>Exporta 100% dos campos de todos os clientes registrados no sistema.</p>
            <button className="btn-export-small" onClick={exportarClientesCSV} disabled={gerandoBackup}>
              <i className="fas fa-file-csv"></i> Baixar Planilha Clientes (Tudo)
            </button>
          </div>

          <div className="export-box">
            <div className="export-header">
              <i className="fas fa-boxes color-amber"></i>
              <h4>Catálogo e Estoque (100%)</h4>
            </div>
            <p>Exporta 100% das propriedades dos itens, SKUs, valores e categorias.</p>
            <button className="btn-export-small" onClick={exportarEstoqueCSV} disabled={gerandoBackup}>
              <i className="fas fa-file-csv"></i> Baixar Planilha Estoque (Tudo)
            </button>
          </div>

          <div className="export-box">
            <div className="export-header">
              <i className="fas fa-file-contract color-blue"></i>
              <h4>Pedidos & Locações (100%)</h4>
            </div>
            <p>Exporta 100% dos contratos, itens locados, datas e status de entregas.</p>
            <button className="btn-export-small" onClick={exportarLocacoesCSV} disabled={gerandoBackup}>
              <i className="fas fa-file-csv"></i> Baixar Planilha Locações (Tudo)
            </button>
          </div>

          <div className="export-box">
            <div className="export-header">
              <i className="fas fa-wallet color-green"></i>
              <h4>Lançamentos Financeiros (100%)</h4>
            </div>
            <p>Exporta 100% dos lançamentos de receitas, despesas, contas a pagar e receber.</p>
            <button className="btn-export-small" onClick={exportarFinanceiroCSV} disabled={gerandoBackup}>
              <i className="fas fa-file-csv"></i> Baixar Planilha Financeira (Tudo)
            </button>
          </div>

          <div className="export-box">
            <div className="export-header">
              <i className="fas fa-truck color-cyan"></i>
              <h4>Fornecedores (100%)</h4>
            </div>
            <p>Exporta 100% do cadastro de parceiros e fornecedores de materiais.</p>
            <button className="btn-export-small" onClick={exportarFornecedoresCSV} disabled={gerandoBackup}>
              <i className="fas fa-file-csv"></i> Baixar Planilha Fornecedores
            </button>
          </div>

          <div className="export-box">
            <div className="export-header">
              <i className="fas fa-user-shield color-pink"></i>
              <h4>Membros da Equipe (100%)</h4>
            </div>
            <p>Exporta 100% do cadastro de funcionários, cargos e permissões de acesso.</p>
            <button className="btn-export-small" onClick={exportarEquipeCSV} disabled={gerandoBackup}>
              <i className="fas fa-file-csv"></i> Baixar Planilha Equipe
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DE CONFIRMAÇÃO DA RESTAURAÇÃO DE BACKUP */}
      {modalRestore && dadosBackupImportado && (
        <div className="modal-overlay-backup fade-in">
          <div className="modal-card-backup">
            <div className="modal-header-backup">
              <h3>
                <i className="fas fa-file-upload text-blue"></i> Confirmar Restauração de Backup
              </h3>
              <button 
                className="btn-close-modal" 
                onClick={() => setModalRestore(false)}
                disabled={restaurando}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="modal-body-backup">
              <div className="file-info-badge">
                <i className="fas fa-file-code"></i> Arquivo: <strong>{nomeArquivoImportado}</strong>
              </div>

              <div className="backup-summary-box">
                <h4><i className="fas fa-list-check"></i> Conteúdo Identificado no Arquivo:</h4>
                <div className="summary-pills">
                  <div className="pill"><strong>{dadosBackupImportado.clientes?.length || 0}</strong> Clientes</div>
                  <div className="pill"><strong>{dadosBackupImportado.estoque?.length || 0}</strong> Itens de Estoque</div>
                  <div className="pill"><strong>{dadosBackupImportado.locacoes?.length || 0}</strong> Locações / Pedidos</div>
                  <div className="pill"><strong>{dadosBackupImportado.financeiro?.length || 0}</strong> Lançamentos Financeiros</div>
                  <div className="pill"><strong>{dadosBackupImportado.fornecedores?.length || 0}</strong> Fornecedores</div>
                  <div className="pill"><strong>{dadosBackupImportado.equipe?.length || 0}</strong> Membros da Equipe</div>
                </div>
              </div>

              <div className="restore-mode-selector">
                <h4><i className="fas fa-sliders-h"></i> Escolha o Modo de Restauração:</h4>

                <label className={`mode-option ${modoRestore === 'mesclar' ? 'active' : ''}`}>
                  <input 
                    type="radio" 
                    name="modoRestore" 
                    value="mesclar"
                    checked={modoRestore === 'mesclar'} 
                    onChange={() => setModoRestore('mesclar')}
                    disabled={restaurando}
                  />
                  <div>
                    <strong>1. Mesclar / Atualizar (Recomendado)</strong>
                    <p>Adiciona os dados do backup e atualiza os existentes. Não apaga nada do seu cadastro atual.</p>
                  </div>
                </label>

                <label className={`mode-option warning-mode ${modoRestore === 'substituir' ? 'active' : ''}`}>
                  <input 
                    type="radio" 
                    name="modoRestore" 
                    value="substituir"
                    checked={modoRestore === 'substituir'} 
                    onChange={() => setModoRestore('substituir')}
                    disabled={restaurando}
                  />
                  <div>
                    <strong>2. Substituição Completa (Atenção)</strong>
                    <p>Limpa os registros atuais da empresa e restaura exatamente o estado do arquivo de backup.</p>
                  </div>
                </label>
              </div>

              {restaurando && (
                <div className="restore-progress-bar-box">
                  <div className="progress-status-text">
                    <i className="fas fa-spinner fa-spin"></i> {progressoRestore || 'Importando dados para o banco...'}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer-backup">
              <button 
                className="btn-cancel-restore" 
                onClick={() => setModalRestore(false)}
                disabled={restaurando}
              >
                Cancelar
              </button>
              <button 
                className="btn-confirm-restore" 
                onClick={executarRestauracao}
                disabled={restaurando}
              >
                {restaurando ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i> Restaurando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check-circle"></i> CONFIRMAR E RESTAURAR
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AbaBackup;
