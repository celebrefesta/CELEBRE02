import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc, setDoc, addDoc, query, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import './ControleGeral.css';

const GRUPOS_CORES = [
  { id: 'todos', label: 'Todas' },
  { id: 'metalicos', label: '🌟 Metálicos & Cromados' },
  { id: 'especiais', label: '✨ Holográfico & Neon' },
  { id: 'neutros', label: '⚪ Neutros & Terrosos' },
  { id: 'azuis', label: '🔵 Azuis' },
  { id: 'rosas', label: '🌸 Rosas & Vinho' },
  { id: 'verdes', label: '🌿 Verdes' },
  { id: 'amarelos', label: '☀️ Amarelos & Laranjas' },
  { id: 'roxos', label: '💜 Roxos & Lilases' }
];

const PALETA_CORES_MOODBOARD = [
  { id: 'todas', label: 'Todas as Cores', grupo: 'todos', cor: 'linear-gradient(135deg, #ef4444, #3b82f6, #10b981, #f59e0b)' },
  
  // ✨ Efeitos Especiais, Holográficos & Neon
  { id: 'holografico', label: 'Holográfico / Furta-cor / Perolado', grupo: 'especiais', cor: 'linear-gradient(135deg, #a5f3fc 0%, #fbcfe8 35%, #fef08a 70%, #c084fc 100%)' },
  { id: 'neon', label: 'Neon / Fluorescente', grupo: 'especiais', cor: 'linear-gradient(135deg, #22c55e 0%, #38bdf8 33%, #ec4899 66%, #eab308 100%)' },

  // 🌟 Metálicos & Cromados
  { id: 'dourado', label: 'Dourado / Ouro', grupo: 'metalicos', cor: '#eab308' },
  { id: 'rose_gold', label: 'Rose Gold', grupo: 'metalicos', cor: '#e0a899' },
  { id: 'prata', label: 'Prata / Cromado', grupo: 'metalicos', cor: '#94a3b8' },
  { id: 'cobre', label: 'Cobre / Bronze', grupo: 'metalicos', cor: '#b45309' },

  // ⚪ Neutros & Terrosos
  { id: 'branco', label: 'Branco / Off-White', grupo: 'neutros', cor: '#ffffff', borda: '#cbd5e1' },
  { id: 'cinza_grafite', label: 'Cinza / Grafite / Prata Fosco', grupo: 'neutros', cor: '#64748b' },
  { id: 'preto', label: 'Preto', grupo: 'neutros', cor: '#0f172a' },
  { id: 'nude', label: 'Nude / Bege / Areia', grupo: 'neutros', cor: '#d7b899' },
  { id: 'marrom', label: 'Marrom / Chocolate', grupo: 'neutros', cor: '#78350f' },
  { id: 'terracota', label: 'Terracota / Telha', grupo: 'neutros', cor: '#c2410c' },

  // 🔵 Azuis
  { id: 'azul_bebe', label: 'Azul Bebê / Pastel', grupo: 'azuis', cor: '#93c5fd' },
  { id: 'azul_royal', label: 'Azul Royal', grupo: 'azuis', cor: '#2563eb' },
  { id: 'azul_marinho', label: 'Azul Marinho', grupo: 'azuis', cor: '#1e3a8a' },
  { id: 'azul_tiffany', label: 'Azul Tiffany / Turquesa', grupo: 'azuis', cor: '#2dd4bf' },

  // 🌸 Rosas & Vermelhos
  { id: 'rosa_bebe', label: 'Rosa Claro / Bebê', grupo: 'rosas', cor: '#fbcfe8' },
  { id: 'rosa_pink', label: 'Rosa Pink / Chiclete', grupo: 'rosas', cor: '#ec4899' },
  { id: 'vermelho', label: 'Vermelho Vivo', grupo: 'rosas', cor: '#ef4444' },
  { id: 'vinho', label: 'Vinho / Marsala / Bordô', grupo: 'rosas', cor: '#881337' },

  // 🌿 Verdes
  { id: 'verde_safari', label: 'Verde Safari / Folhagem', grupo: 'verdes', cor: '#15803d' },
  { id: 'verde_oliva', label: 'Verde Oliva / Militar', grupo: 'verdes', cor: '#4d7c0f' },
  { id: 'verde_menta', label: 'Verde Menta / Eucalipto', grupo: 'verdes', cor: '#6ee7b7' },
  { id: 'verde_lima', label: 'Verde Lima / Limão', grupo: 'verdes', cor: '#84cc16' },

  // ☀️ Amarelos & Laranjas
  { id: 'mostarda', label: 'Mostarda / Ocre', grupo: 'amarelos', cor: '#ca8a04' },
  { id: 'amarelo_bebe', label: 'Amarelo Bebê / Pastel', grupo: 'amarelos', cor: '#fef08a' },
  { id: 'amarelo', label: 'Amarelo Ouro / Canário', grupo: 'amarelos', cor: '#facc15' },
  { id: 'laranja', label: 'Laranja / Cenoura', grupo: 'amarelos', cor: '#f97316' },
  { id: 'salmao', label: 'Salmão / Pêssego', grupo: 'amarelos', cor: '#fb923c' },

  // 💜 Roxos & Lilases
  { id: 'lilas', label: 'Lilás / Lavanda', grupo: 'roxos', cor: '#c084fc' },
  { id: 'roxo', label: 'Roxo / Uva', grupo: 'roxos', cor: '#7e22ce' },
];

const STATUS_MOODBOARD_FILTROS = [
  { id: 'todos', label: 'Todos os Itens', icon: 'fas fa-border-all' },
  { id: 'globais', label: '👑 Oficiais Globais', icon: 'fas fa-crown' },
  { id: 'sugestoes', label: '⭐ Sugestões de Clientes', icon: 'fas fa-star' }
];

const CATEGORIAS_CENOGRAFIA = [
  { id: 'todas', label: '📁 Todas as Categorias' },
  { id: 'Parede', label: '🧱 Paredes' },
  { id: 'Piso', label: '🪵 Pisos & Tablados' },
  { id: 'Ambiente', label: '🏞️ Ambientes Inteiros / Salões' },
  { id: 'Baloes', label: '🎈 Balões & Arcos' },
  { id: 'Paineis', label: '🏛️ Painéis & Estruturas' },
  { id: 'Texturas', label: '🪵 Texturas & Materiais' },
  { id: 'Flores', label: '🌸 Flores & Folhagens' },
  { id: 'Moveis', label: '🛋️ Móveis & Mesas' },
  { id: 'Letreiros', label: '✨ LED & Letreiros' },
  { id: 'Outros', label: '📦 Outros Acessórios' },
];

// 🏷️ SUBTIPOS RÁPIDOS POR CATEGORIA
const SUBTIPOS_PAREDE = [
  { label: '🎨 Cor Lisa', tag: 'Cor Lisa' },
  { label: '🪵 Textura / Ripado', tag: 'Ripado' },
  { label: '🧱 Tijolo / Rústico', tag: 'Tijolinho' },
  { label: '🖼️ Parede com Janela', tag: 'Janela' },
  { label: '🏛️ Boiserie / Moldura', tag: 'Boiserie' },
  { label: '🌿 Parede Viva / Folhagens', tag: 'Folhagem' },
  { label: '🌫️ Cimento Queimado', tag: 'Cimento' },
  { label: '☀️ Ao Ar Livre', tag: 'Ar Livre' },
  { label: '✨ Cortina / Tecido', tag: 'Cortina' }
];

const SUBTIPOS_PISO = [
  { label: '🪵 Madeira / Tablado', tag: 'Madeira' },
  { label: '✨ Piso / Porcelanato', tag: 'Piso' },
  { label: '🌫️ Concreto / Cimento', tag: 'Concreto' },
  { label: '🌱 Grama / Jardim', tag: 'Grama' },
  { label: '🏛️ Mármore / Granito', tag: 'Mármore' },
  { label: '🎉 Salão de Festa', tag: 'Salão' },
  { label: '🧶 Carpete / Tapete', tag: 'Carpete' }
];

const SUBTIPOS_AMBIENTE = [
  { label: '🎉 Salão de Festa / Buffet', tag: 'Salão de Festa' },
  { label: '🌳 Ao Ar Livre / Jardim', tag: 'Ar Livre' },
  { label: '🏖️ Praia / Campo', tag: 'Praia Campo' },
  { label: '🛖 Espaço Rústico', tag: 'Rústico' },
  { label: '📸 Estúdio Fotográfico', tag: 'Estúdio' },
  { label: '⛪ Igreja / Templo', tag: 'Igreja' }
];

// 🎨 COMPONENTE: SELETOR DE CORES COM BUSCA E FAMÍLIAS (PARA PEÇAS PNG)
const SeletorCoresModal = ({ coresSelecionadas = [], onToggleCor, onLimpar }) => {
  const [aberto, setAberto] = useState(false);
  const [grupoAtivo, setGrupoAtivo] = useState('todos');
  const [buscaCor, setBuscaCor] = useState('');

  const coresFiltradas = PALETA_CORES_MOODBOARD.filter(c => c.id !== 'todas').filter(c => {
    if (grupoAtivo !== 'todos' && c.grupo !== grupoAtivo) return false;
    if (buscaCor && !c.label.toLowerCase().includes(buscaCor.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="cg-color-selector-wrapper">
      <div className="cg-color-selector-header">
        <label className="cg-form-label" style={{ marginBottom: 0 }}>
          <i className="fas fa-palette"></i> Paleta / Cores do Elemento:
        </label>
        <button 
          type="button" 
          className={`cg-btn-toggle-drawer ${aberto ? 'active' : ''}`}
          onClick={() => setAberto(!aberto)}
        >
          {aberto ? (
            <><i className="fas fa-chevron-up"></i> Recolher Paleta</>
          ) : (
            <><i className="fas fa-sliders-h"></i> {coresSelecionadas.length > 0 ? `${coresSelecionadas.length} marcadas (Editar)` : '+ Abrir Paleta (26 opções)'}</>
          )}
        </button>
      </div>

      {/* Barra de Cores Selecionadas */}
      <div className="cg-color-selected-chips-bar">
        {coresSelecionadas.length === 0 ? (
          <span className="cg-no-colors-txt" onClick={() => setAberto(true)}>
            Nenhuma cor específica associada. <span style={{ textDecoration: 'underline', cursor: 'pointer', fontWeight: '700' }}>Clique aqui para selecionar</span>
          </span>
        ) : (
          coresSelecionadas.map(corId => {
            const cObj = PALETA_CORES_MOODBOARD.find(c => c.id === corId) || { label: corId, cor: '#cbd5e1' };
            return (
              <span key={corId} className="cg-chip-selected-tag">
                <span className="cg-dot-small" style={{ background: cObj.cor, border: cObj.borda ? `1px solid ${cObj.borda}` : 'none' }}></span>
                {cObj.label}
                <button type="button" onClick={() => onToggleCor(corId)} title="Remover cor">✕</button>
              </span>
            );
          })
        )}
        {coresSelecionadas.length > 0 && (
          <button type="button" className="cg-btn-clear-tags" onClick={onLimpar}>Limpar</button>
        )}
      </div>

      {/* Painel Expansível */}
      {aberto && (
        <div className="cg-color-drawer-panel">
          <div className="cg-drawer-filter-bar">
            <div className="cg-drawer-search">
              <i className="fas fa-search"></i>
              <input 
                type="text" 
                placeholder="Filtrar cor (ex: rosa, safari, ouro...)" 
                value={buscaCor} 
                onChange={e => setBuscaCor(e.target.value)} 
              />
              {buscaCor && <button type="button" className="cg-search-clear-mini" onClick={() => setBuscaCor('')}>✕</button>}
            </div>

            <div className="cg-drawer-group-tabs">
              {GRUPOS_CORES.map(g => (
                <button
                  key={g.id}
                  type="button"
                  className={`cg-drawer-tab ${grupoAtivo === g.id ? 'active' : ''}`}
                  onClick={() => setGrupoAtivo(g.id)}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="cg-drawer-grid">
            {coresFiltradas.length === 0 ? (
              <div className="cg-drawer-empty">Nenhuma cor encontrada com "{buscaCor}".</div>
            ) : (
              coresFiltradas.map(c => {
                const selecionada = coresSelecionadas.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`cg-color-grid-btn ${selecionada ? 'active' : ''}`}
                    onClick={() => onToggleCor(c.id)}
                  >
                    <span className="cg-color-bubble" style={{ background: c.cor, border: c.borda ? `1px solid ${c.borda}` : 'none' }}>
                      {selecionada && <i className="fas fa-check" style={{ color: c.id === 'branco' ? '#000' : '#fff' }}></i>}
                    </span>
                    <span className="cg-color-grid-name">{c.label}</span>
                  </button>
                );
              })
            )}
          </div>

          <div className="cg-drawer-footer">
            <small>{coresSelecionadas.length} de {PALETA_CORES_MOODBOARD.length - 1} cores selecionadas</small>
            <button type="button" className="cg-btn-drawer-done" onClick={() => setAberto(false)}>
              ✓ Concluir Seleção
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const ControleGeral = () => {
  const [abaPrincipal, setAbaPrincipal] = useState('clientes'); // 'clientes' | 'moodboard'
  const [clientes, setClientes] = useState([]);
  const [planos, setPlanos] = useState({});
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  // 🎨 Controle do Acervo Global do Moodboard
  const [itensMoodboard, setItensMoodboard] = useState([]);
  const [loadingMoodboard, setLoadingMoodboard] = useState(false);
  const [filtroStatusMoodboard, setFiltroStatusMoodboard] = useState('todos'); // 'todos' | 'globais' | 'sugestoes'
  const [filtroCatMoodboard, setFiltroCatMoodboard] = useState('todas'); // 'todas' | 'Parede' | 'Piso' | 'Ambiente' | ...
  const [filtroSubtipoMoodboard, setFiltroSubtipoMoodboard] = useState('todos');
  const [filtroCorMoodboard, setFiltroCorMoodboard] = useState('todas');
  const [buscaMoodboard, setBuscaMoodboard] = useState('');
  const [ordenacaoMoodboard, setOrdenacaoMoodboard] = useState('recentes'); // 'recentes' | 'nome' | 'antigos'
  const [paletaPopoverAberto, setPaletaPopoverAberto] = useState(false);

  // 🌟 Modais de Elementos
  const [modalNovoItemAberto, setModalNovoItemAberto] = useState(false);
  const [novoItemForm, setNovoItemForm] = useState({ nome: '', categoria: 'Parede', imagemUrl: '', tag: 'Ripado', cores: [] });
  const [salvandoItemMoodboard, setSalvandoItemMoodboard] = useState(false);

  // ✏️ Quick Edit de Elemento do Moodboard
  const [modalEdicaoItemAberto, setModalEdicaoItemAberto] = useState(false);
  const [itemEmEdicao, setItemEmEdicao] = useState(null);
  const [salvandoEdicaoItem, setSalvandoEdicaoItem] = useState(false);

  // Controle de Modais de Edição/Exclusão de Clientes
  const [membroEdicao, setMembroEdicao] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Controle do Visualizador de Suporte
  const [membroSuporte, setMembroSuporte] = useState(null);
  const [modalSuporteAberto, setModalSuporteAberto] = useState(false);
  const [tabSuporteActive, setTabSuporteActive] = useState('resumo');
  const [loadingSuporte, setLoadingSuporte] = useState(false);
  const [dadosSuporte, setDadosSuporte] = useState({ estoque: [], locacoes: [], clientes: [] });

  const navigate = useNavigate();
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;

  useEffect(() => {
    if (!usuarioLogado || usuarioLogado.email !== "celebrefesta25@gmail.com") {
      navigate('/dashboard');
      return;
    }
    carregarDados();
  }, [usuarioLogado]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // 1. Carregar Planos
      const planosSnap = await getDocs(collection(db, "planos"));
      const planosMap = {};
      planosSnap.docs.forEach(docSnap => {
        planosMap[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
      });
      setPlanos(planosMap);

      // 2. Carregar Usuários e Equipe simultaneamente
      const [usersSnap, equipeSnap] = await Promise.all([
        getDocs(collection(db, "usuarios")),
        getDocs(collection(db, "equipe"))
      ]);

      const hoje = new Date();

      const equipeMap = {};
      equipeSnap.docs.forEach(docSnap => {
        const d = docSnap.data();
        if (d.email) {
          equipeMap[d.email.toLowerCase().trim()] = d;
        }
      });

      const userDocsMap = {};
      usersSnap.docs.forEach(docSnap => {
        userDocsMap[docSnap.id] = docSnap.data();
      });

      const listaClientes = usersSnap.docs.map(docSnap => {
        const data = docSnap.data();
        const uid = docSnap.id;

        const regEquipe = equipeMap[data.email ? data.email.toLowerCase().trim() : ''];
        const idEmpresaPatrao = (data.role && data.role !== 'owner' && data.tenantId && data.tenantId !== uid) 
          ? data.tenantId 
          : (regEquipe ? regEquipe.empresaId : null);

        const isFuncionarioVinculado = Boolean(idEmpresaPatrao && idEmpresaPatrao !== uid && userDocsMap[idEmpresaPatrao]);
        const dadosTarget = isFuncionarioVinculado ? userDocsMap[idEmpresaPatrao] : data;

        let status = 'bloqueado';
        let diasRestantes = 0;
        let diasTeste = 0;

        if (dadosTarget.dataFimTeste) {
          const dataFim = new Date(dadosTarget.dataFimTeste);
          const diffMs = dataFim.getTime() - hoje.getTime();
          diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          
          if (diasRestantes > 0) {
            status = 'teste';
            diasTeste = 7 - diasRestantes;
          }
        } else if (dadosTarget.dataCadastro) {
          let dataCad = dadosTarget.dataCadastro;
          if (dataCad.toDate) dataCad = dataCad.toDate();
          const diffTime = hoje.getTime() - new Date(dataCad).getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
          
          if (diffDays <= 7) {
            status = 'teste';
            diasRestantes = 7 - diffDays;
            diasTeste = diffDays;
          }
        }

        const pagou = dadosTarget.assinaturaAtiva === true || 
                      dadosTarget.statusAssinatura === 'ativa' ||
                      dadosTarget.plano === 'pago' || 
                      dadosTarget.statusPagamentoVulso === 'pago';

        if (pagou) {
          status = 'ativo';
        }

        if (status === 'bloqueado' && dadosTarget.dataCadastro) {
          let dataCad = dadosTarget.dataCadastro;
          if (dataCad.toDate) dataCad = dataCad.toDate();
          const diffTime = hoje.getTime() - new Date(dataCad).getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays > 180) {
            status = 'excluido';
          }
        }

        if (data.email === "celebrefesta25@gmail.com") {
          status = 'admin';
        }

        let nomePlano = dadosTarget.planoId && planosMap[dadosTarget.planoId] 
          ? planosMap[dadosTarget.planoId].nome 
          : (pagou ? 'Plano Pago' : 'Sem plano');

        if (isFuncionarioVinculado) {
          const nomePatrao = dadosTarget.nomeExibicao || dadosTarget.nomeCompleto || 'Empresa';
          nomePlano = `${nomePlano} (Equipe ${nomePatrao})`;
        }

        let dataCadastroFormatada = '—';
        const rawDateView = dadosTarget.dataCadastro || data.dataCadastro;
        if (rawDateView) {
          let dc = rawDateView;
          if (dc.toDate) dc = dc.toDate();
          try {
            dataCadastroFormatada = new Date(dc).toLocaleDateString('pt-BR');
          } catch {
            dataCadastroFormatada = String(dc).split('T')[0] || '—';
          }
        }

        return {
          uid,
          nomeCompleto: data.nomeCompleto || data.nomeExibicao || data.displayName || '—',
          nomeExibicao: data.nomeExibicao || data.nomeCompleto || '—',
          email: data.email || '—',
          documento: data.documento || '—',
          tipoPessoa: data.tipoPessoa || '—',
          dataCadastro: data.dataCadastro ? (data.dataCadastro.toDate ? data.dataCadastro.toDate().toISOString() : data.dataCadastro) : null,
          dataCadastroExibida: dataCadastroFormatada,
          dataFimTeste: data.dataFimTeste ? (data.dataFimTeste.toDate ? data.dataFimTeste.toDate().toISOString().split('T')[0] : data.dataFimTeste.split('T')[0]) : '',
          status,
          diasRestantes: status === 'teste' ? diasRestantes : 0,
          diasTeste,
          nomePlano,
          planoId: data.planoId || dadosTarget.planoId || 'plano_basico',
          role: data.role || (isFuncionarioVinculado ? 'funcionario' : 'owner'),
          isFuncionarioVinculado,
          idEmpresaPatrao,
          assinaturaAtiva: dadosTarget.assinaturaAtiva || false,
          statusPagamentoVulso: dadosTarget.statusPagamentoVulso || '',
          plano: dadosTarget.plano || '',
          statusAssinatura: dadosTarget.statusAssinatura || ''
        };
      });

      const ordemStatus = { admin: 0, teste: 1, ativo: 2, bloqueado: 3, excluido: 4 };
      listaClientes.sort((a, b) => (ordemStatus[a.status] || 5) - (ordemStatus[b.status] || 5));

      setClientes(listaClientes);
    } catch (error) {
      console.error("Erro ao carregar dados do Controle Geral:", error);
    } finally {
      setLoading(false);
    }
  };

  const abrirEdicao = (cliente) => {
    setMembroEdicao({ ...cliente });
    setModalAberto(true);
  };

  const salvarEdicao = async (e) => {
    e.preventDefault();
    setSalvando(true);
    try {
      const userRef = doc(db, 'usuarios', membroEdicao.uid);
      const isVip = membroEdicao.assinaturaAtiva === true || membroEdicao.assinaturaAtiva === 'true';

      const payload = {
        nomeExibicao: membroEdicao.nomeExibicao || '',
        nomeCompleto: membroEdicao.nomeCompleto || '',
        email: membroEdicao.email || '',
        documento: membroEdicao.documento || '',
        planoId: isVip ? (membroEdicao.planoId || 'plano_basico') : '',
        plano: isVip ? (membroEdicao.plano || 'pago') : '',
        statusPagamentoVulso: isVip ? (membroEdicao.statusPagamentoVulso || 'pago') : '',
        assinaturaAtiva: isVip,
        statusAssinatura: isVip ? (membroEdicao.statusAssinatura || 'ativa') : 'inativa',
        dataCadastro: membroEdicao.dataCadastro ? new Date(membroEdicao.dataCadastro).toISOString() : null,
        dataFimTeste: membroEdicao.dataFimTeste ? new Date(membroEdicao.dataFimTeste).toISOString() : null
      };

      await updateDoc(userRef, payload);

      const configRef = doc(db, 'configuracoes_empresa', membroEdicao.uid);
      await updateDoc(configRef, {
        nomeEmpresa: membroEdicao.nomeExibicao,
        emailContato: membroEdicao.email,
        documentoEmpresa: membroEdicao.documento
      }).catch(() => {});

      if (membroEdicao.documento) {
        const docLimpo = membroEdicao.documento.replace(/\D/g, '');
        if (docLimpo) {
          await setDoc(doc(db, 'registros_documentos', docLimpo), {
            ownerUid: membroEdicao.uid,
            atualizadoEm: new Date().toISOString()
          }, { merge: true }).catch(() => {});
        }
      }

      alert("Cadastro atualizado com sucesso!");
      setModalAberto(false);
      carregarDados();
    } catch (err) {
      console.error("Erro ao salvar cadastro:", err);
      alert("Erro ao salvar dados do cliente.");
    } finally {
      setSalvando(false);
    }
  };

  const confirmarExclusao = (uid, nome) => {
    if (window.confirm(`⚠️ ATENÇÃO: Tem certeza que deseja EXCLUIR permanentemente a empresa "${nome}" do sistema?\n\nEsta ação apagará o cadastro do usuário e não poderá ser desfeita.`)) {
      executarExclusao(uid);
    }
  };

  const executarExclusao = async (uid) => {
    try {
      try {
        const response = await fetch('https://us-central1-celebre-9f5c9.cloudfunctions.net/excluirUsuarioAuth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ uid })
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          console.warn("Aviso ao remover da autenticação:", errData);
        }
      } catch (errAuth) {
        console.error("Falha na chamada da exclusão de autenticação:", errAuth);
      }

      const userRef = doc(db, 'usuarios', uid);
      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        const docData = docSnap.data();
        if (docData.documento) {
          const docLimpo = docData.documento.replace(/\D/g, '');
          if (docLimpo) {
            await deleteDoc(doc(db, 'registros_documentos', docLimpo)).catch(() => {});
          }
        }
      }

      await deleteDoc(userRef);
      await deleteDoc(doc(db, 'configuracoes_empresa', uid)).catch(() => {});

      alert("Empresa excluída com sucesso por completo!");
      carregarDados();
    } catch (err) {
      console.error("Erro ao excluir usuário:", err);
      alert("Erro ao excluir usuário.");
    }
  };

  const abrirVisualizadorSuporte = async (cliente) => {
    setMembroSuporte(cliente);
    setTabSuporteActive('resumo');
    setModalSuporteAberto(true);
    setLoadingSuporte(true);
    
    try {
      const qEstoque = query(collection(db, "estoque"), where("userId", "==", cliente.uid));
      const qLocacoes = query(collection(db, "locacoes"), where("userId", "==", cliente.uid));
      const qClientes = query(collection(db, "clientes"), where("userId", "==", cliente.uid));

      const [snapEst, snapLoc, snapCli] = await Promise.all([
        getDocs(qEstoque),
        getDocs(qLocacoes),
        getDocs(qClientes)
      ]);

      const estoque = snapEst.docs.map(d => ({ id: d.id, ...d.data() }));
      const locacoes = snapLoc.docs.map(d => ({ id: d.id, ...d.data() }));
      const clientes = snapCli.docs.map(d => ({ id: d.id, ...d.data() }));

      setDadosSuporte({ estoque, locacoes, clientes });
    } catch (err) {
      console.error("Erro ao carregar dados de suporte do perfil:", err);
    } finally {
      setLoadingSuporte(false);
    }
  };

  // -------------------------------------------------------------
  // 🎨 CONTROLE DO ACERVO GLOBAL DO MOODBOARD
  // -------------------------------------------------------------
  const carregarItensMoodboard = async () => {
    setLoadingMoodboard(true);
    try {
      const snap = await getDocs(collection(db, "moodboard_elementos"));
      const lista = snap.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      setItensMoodboard(lista);
    } catch (err) {
      console.error("Erro ao carregar elementos do moodboard:", err);
    } finally {
      setLoadingMoodboard(false);
    }
  };

  const handleSalvarNovoItemOficial = async (e) => {
    e.preventDefault();
    if (!novoItemForm.nome || !novoItemForm.imagemUrl) {
      alert("Por favor, preencha o nome e selecione a imagem.");
      return;
    }

    setSalvandoItemMoodboard(true);
    try {
      await addDoc(collection(db, "moodboard_elementos"), {
        nome: novoItemForm.nome.trim(),
        categoria: novoItemForm.categoria,
        tag: (novoItemForm.tag || 'Oficial').trim(),
        cores: novoItemForm.cores || [],
        imagemUrl: novoItemForm.imagemUrl,
        isGlobal: true,
        sugeridoParaGlobal: false,
        criadoPorNome: "Celebre Super Admin",
        criadoEm: new Date().toISOString()
      });

      alert("🎉 Elemento Oficial adicionado com sucesso! Já está disponível para todas as clientes do Celebre.");
      setModalNovoItemAberto(false);
      setNovoItemForm({ nome: '', categoria: 'Parede', imagemUrl: '', tag: 'Ripado', cores: [] });
      carregarItensMoodboard();
    } catch (err) {
      console.error("Erro ao salvar elemento oficial:", err);
      alert("Erro ao salvar elemento.");
    } finally {
      setSalvandoItemMoodboard(false);
    }
  };

  const handleAbrirEdicaoItem = (item) => {
    setItemEmEdicao({
      id: item.id,
      nome: item.nome || '',
      categoria: item.categoria || 'Baloes',
      tag: item.tag || '',
      cores: item.cores || [],
      imagemUrl: item.imagemUrl || '',
      isGlobal: item.isGlobal || false,
      criadoPorNome: item.criadoPorNome || 'Decoradora'
    });
    setModalEdicaoItemAberto(true);
  };

  const handleSalvarEdicaoItem = async (e) => {
    e.preventDefault();
    if (!itemEmEdicao) return;
    setSalvandoEdicaoItem(true);
    try {
      await updateDoc(doc(db, "moodboard_elementos", itemEmEdicao.id), {
        nome: itemEmEdicao.nome.trim(),
        categoria: itemEmEdicao.categoria,
        tag: (itemEmEdicao.tag || '').trim(),
        cores: itemEmEdicao.cores || []
      });
      setItensMoodboard(prev => prev.map(i => i.id === itemEmEdicao.id ? { ...i, ...itemEmEdicao } : i));
      setModalEdicaoItemAberto(false);
      alert("✓ Elemento atualizado com sucesso!");
    } catch (err) {
      console.error("Erro ao editar elemento:", err);
      alert("Erro ao salvar alterações.");
    } finally {
      setSalvandoEdicaoItem(false);
    }
  };

  const handleAprovarSugestao = async (item) => {
    try {
      await updateDoc(doc(db, "moodboard_elementos", item.id), {
        isGlobal: true,
        sugeridoParaGlobal: false
      });
      setItensMoodboard(prev => prev.map(i => i.id === item.id ? { ...i, isGlobal: true, sugeridoParaGlobal: false } : i));
      alert(`🎉 Aprovado! "${item.nome}" agora é um elemento Oficial Global para todas as clientes do Celebre.`);
    } catch (err) {
      console.error("Erro ao aprovar sugestão:", err);
      alert("Erro ao aprovar sugestão.");
    }
  };

  const handleRecusarSugestao = async (item) => {
    if (!window.confirm(`Deseja manter o elemento "${item.nome}" apenas no portfólio privado da decoradora?`)) return;
    try {
      await updateDoc(doc(db, "moodboard_elementos", item.id), {
        sugeridoParaGlobal: false
      });
      setItensMoodboard(prev => prev.map(i => i.id === item.id ? { ...i, sugeridoParaGlobal: false } : i));
    } catch (err) {
      console.error("Erro ao recusar sugestão:", err);
      alert("Erro ao atualizar item.");
    }
  };

  const handleAlternarGlobal = async (item) => {
    try {
      const novoStatus = !item.isGlobal;
      await updateDoc(doc(db, "moodboard_elementos", item.id), {
        isGlobal: novoStatus,
        sugeridoParaGlobal: false
      });
      setItensMoodboard(prev => prev.map(i => i.id === item.id ? { ...i, isGlobal: novoStatus, sugeridoParaGlobal: false } : i));
    } catch (err) {
      console.error("Erro ao alternar status:", err);
      alert("Erro ao atualizar status do item.");
    }
  };

  const handleExcluirItemMoodboard = async (itemId) => {
    if (!window.confirm("Deseja realmente remover este elemento da biblioteca?")) return;
    try {
      await deleteDoc(doc(db, "moodboard_elementos", itemId));
      setItensMoodboard(prev => prev.filter(i => i.id !== itemId));
    } catch (err) {
      console.error("Erro ao excluir item:", err);
      alert("Erro ao excluir item.");
    }
  };

  // 🔍 Filtragem avançada dos elementos do Moodboard
  const itensMoodboardFiltrados = useMemo(() => {
    return itensMoodboard.filter(item => {
      // 1. Busca
      if (buscaMoodboard) {
        const termo = buscaMoodboard.trim().toLowerCase();
        const nome = (item.nome || '').toLowerCase();
        const tag = (item.tag || '').toLowerCase();
        const autor = (item.criadoPorNome || '').toLowerCase();
        const cat = (item.categoria || '').toLowerCase();
        if (!nome.includes(termo) && !tag.includes(termo) && !autor.includes(termo) && !cat.includes(termo)) {
          return false;
        }
      }

      // 2. Status / Origem
      if (filtroStatusMoodboard === 'globais' && !item.isGlobal) return false;
      if (filtroStatusMoodboard === 'sugestoes' && !item.sugeridoParaGlobal) return false;

      // 3. Categoria
      if (filtroCatMoodboard !== 'todas') {
        if (item.categoria !== filtroCatMoodboard) return false;
      }

      // 4. Subtipo / Tag rápida
      if (filtroSubtipoMoodboard !== 'todos') {
        const t = (item.tag || '').toLowerCase();
        const n = (item.nome || '').toLowerCase();
        const sub = filtroSubtipoMoodboard.toLowerCase();
        if (!t.includes(sub) && !n.includes(sub)) return false;
      }

      // 5. Cor
      if (filtroCorMoodboard !== 'todas') {
        const corTag = (item.tag || '').toLowerCase();
        const corNome = (item.nome || '').toLowerCase();
        const temCorArray = item.cores && Array.isArray(item.cores) && item.cores.includes(filtroCorMoodboard);
        
        const corObj = PALETA_CORES_MOODBOARD.find(c => c.id === filtroCorMoodboard);
        const palavrasChave = corObj 
          ? corObj.label.toLowerCase().split(/[\s/,-]+/).filter(w => w.length > 2)
          : [filtroCorMoodboard];
        
        const temCorTexto = palavrasChave.some(p => corTag.includes(p) || corNome.includes(p));
        if (!temCorArray && !temCorTexto) return false;
      }

      return true;
    }).sort((a, b) => {
      if (ordenacaoMoodboard === 'nome') {
        return (a.nome || '').localeCompare(b.nome || '');
      }
      if (ordenacaoMoodboard === 'antigos') {
        return new Date(a.criadoEm || 0) - new Date(b.criadoEm || 0);
      }
      return new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0);
    });
  }, [itensMoodboard, buscaMoodboard, filtroStatusMoodboard, filtroCatMoodboard, filtroSubtipoMoodboard, filtroCorMoodboard, ordenacaoMoodboard]);

  // 🔍 Filtros de Clientes
  const totalVencendo = clientes.filter(c => c.status === 'teste' && c.diasRestantes <= 2).length;

  const clientesFiltrados = clientes.filter(c => {
    const matchBusca = busca === '' || 
      c.nomeCompleto.toLowerCase().includes(busca.toLowerCase()) ||
      c.nomeExibicao.toLowerCase().includes(busca.toLowerCase()) ||
      c.email.toLowerCase().includes(busca.toLowerCase()) ||
      c.documento.includes(busca);

    const matchStatus = filtroStatus === 'todos' 
      ? true 
      : filtroStatus === 'vencendo' 
        ? (c.status === 'teste' && c.diasRestantes <= 2)
        : c.status === filtroStatus;
    
    return matchBusca && matchStatus;
  });

  // Contadores
  const totalClientes = clientes.filter(c => c.status !== 'admin').length;
  const totalTeste = clientes.filter(c => c.status === 'teste').length;
  const totalAtivos = clientes.filter(c => c.status === 'ativo').length;
  const totalBloqueados = clientes.filter(c => c.status === 'bloqueado').length;
  const totalExcluidos = clientes.filter(c => c.status === 'excluido').length;

  const sugestoesPendentes = itensMoodboard.filter(i => i.sugeridoParaGlobal).length;
  const oficiaisTotais = itensMoodboard.filter(i => i.isGlobal).length;

  const corFiltroAtivaObj = PALETA_CORES_MOODBOARD.find(c => c.id === filtroCorMoodboard);

  const getStatusBadge = (status) => {
    const badges = {
      admin: { label: 'MASTER', className: 'badge-admin' },
      teste: { label: 'TESTE', className: 'badge-teste' },
      ativo: { label: 'ATIVO', className: 'badge-ativo' },
      bloqueado: { label: 'BLOQUEADO', className: 'badge-bloqueado' },
      excluido: { label: 'EXCLUÍDO', className: 'badge-excluido' }
    };
    const b = badges[status] || badges.bloqueado;
    return <span className={`cg-badge ${b.className}`}>{b.label}</span>;
  };

  return (
    <div className="cg-wrapper fade-in">
      {/* 🌟 HEADER PRINCIPAL DARK LUXURY */}
      <div className="cg-header">
        <div className="cg-header-left">
          <div className="cg-superadm-badge">
            <i className="fas fa-crown"></i> SUPER ADMIN CELEBRE
          </div>
          <h1><i className="fas fa-shield-alt"></i> Controle Geral & Moderação Master</h1>
          <p>Gestão executiva de empresas, assinaturas e acervo oficial de cenografia em tempo real.</p>
        </div>
        <button 
          className="cg-btn-refresh" 
          onClick={() => { carregarDados(); if (abaPrincipal === 'moodboard') carregarItensMoodboard(); }}
          title="Recarregar Dados"
        >
          <i className={`fas fa-sync-alt ${loading || loadingMoodboard ? 'fa-spin' : ''}`}></i> Atualizar Dados
        </button>
      </div>

      {/* 🌟 NAVEGADOR PRINCIPAL DE MÓDULOS (SEGMENTED SWITCHER) */}
      <div className="cg-main-tabs">
        <button 
          className={`cg-main-tab-btn ${abaPrincipal === 'clientes' ? 'active' : ''}`}
          onClick={() => setAbaPrincipal('clientes')}
        >
          <i className="fas fa-users-cog"></i>
          <span className="cg-tab-text-full">Gestão de Empresas & Assinaturas</span>
          <span className="cg-tab-text-short">Empresas</span>
          <span className="cg-tab-badge">{clientes.length}</span>
        </button>
        <button 
          className={`cg-main-tab-btn ${abaPrincipal === 'moodboard' ? 'active' : ''}`}
          onClick={() => { setAbaPrincipal('moodboard'); carregarItensMoodboard(); }}
        >
          <i className="fas fa-palette"></i>
          <span className="cg-tab-text-full">Acervo Global do Moodboard</span>
          <span className="cg-tab-text-short">Moodboard</span>
          <span className="cg-tab-badge gold">
            {oficiaisTotais} Oficiais
            {sugestoesPendentes > 0 && ` · ${sugestoesPendentes} Sugestões`}
          </span>
        </button>
      </div>

      {abaPrincipal === 'moodboard' ? (
        <div className="cg-moodboard-manager">
          
          {/* 📊 KPI CARDS DO MOODBOARD */}
          <div className="cg-mb-stats-row">
            <div 
              className={`cg-mb-stat-box ${filtroStatusMoodboard === 'globais' ? 'active-filter' : ''}`} 
              onClick={() => setFiltroStatusMoodboard(filtroStatusMoodboard === 'globais' ? 'todos' : 'globais')}
            >
              <div className="cg-mb-stat-icon gold"><i className="fas fa-crown"></i></div>
              <div className="cg-mb-stat-info">
                <span className="cg-mb-stat-val">{oficiaisTotais}</span>
                <span className="cg-mb-stat-lbl">Itens Oficiais Globais</span>
              </div>
            </div>

            <div 
              className={`cg-mb-stat-box ${sugestoesPendentes > 0 ? 'highlight-alert' : ''} ${filtroStatusMoodboard === 'sugestoes' ? 'active-filter' : ''}`}
              onClick={() => setFiltroStatusMoodboard(filtroStatusMoodboard === 'sugestoes' ? 'todos' : 'sugestoes')}
            >
              <div className="cg-mb-stat-icon orange"><i className="fas fa-star"></i></div>
              <div className="cg-mb-stat-info">
                <span className="cg-mb-stat-val">{sugestoesPendentes}</span>
                <span className="cg-mb-stat-lbl">Sugestões de Decoradoras</span>
              </div>
              {sugestoesPendentes > 0 && <span className="cg-badge-pulse">Revisar</span>}
            </div>

            <div 
              className={`cg-mb-stat-box ${filtroStatusMoodboard === 'todos' && filtroCatMoodboard === 'todas' ? 'active-filter' : ''}`} 
              onClick={() => { setFiltroStatusMoodboard('todos'); setFiltroCatMoodboard('todas'); setFiltroSubtipoMoodboard('todos'); }}
            >
              <div className="cg-mb-stat-icon blue"><i className="fas fa-layer-group"></i></div>
              <div className="cg-mb-stat-info">
                <span className="cg-mb-stat-val">{itensMoodboard.length}</span>
                <span className="cg-mb-stat-lbl">Total no Acervo</span>
              </div>
            </div>

            <div className="cg-mb-stat-action">
              <button className="cg-btn-add-global-primary" onClick={() => setModalNovoItemAberto(true)}>
                <i className="fas fa-plus-circle"></i> + Cadastrar Novo Item Oficial
              </button>
            </div>
          </div>

          {/* 🔔 BANNER DE MODERAÇÃO DE SUGESTÕES (QUANDO HOUVER PENDÊNCIAS) */}
          {sugestoesPendentes > 0 && filtroStatusMoodboard !== 'sugestoes' && (
            <div className="cg-moderation-alert-banner" onClick={() => setFiltroStatusMoodboard('sugestoes')}>
              <div className="cg-mod-banner-left">
                <span className="cg-mod-bell"><i className="fas fa-bell"></i></span>
                <div>
                  <strong>{sugestoesPendentes} {sugestoesPendentes === 1 ? 'sugestão de cliente aguardando moderação!' : 'sugestões de clientes aguardando moderação!'}</strong>
                  <p>Clique aqui para avaliar os elementos enviados pelas decoradoras e torná-los Oficiais em 1 clique.</p>
                </div>
              </div>
              <button className="cg-mod-banner-btn">
                Moderar Sugestões ({sugestoesPendentes}) <i className="fas fa-arrow-right"></i>
              </button>
            </div>
          )}

          {/* 🎨 TOOLBAR COMPLETA & LIMPA (SEM BARRA DE ROLAGEM EXTENSA) */}
          <div className="cg-toolbar-moodboard-integrated">
            {/* 1. Status Filter Pills */}
            <div className="cg-status-pills-row">
              {STATUS_MOODBOARD_FILTROS.map(st => {
                const count = st.id === 'todos' 
                  ? itensMoodboard.length 
                  : st.id === 'globais' 
                    ? oficiaisTotais 
                    : sugestoesPendentes;
                return (
                  <button
                    key={st.id}
                    className={`cg-status-pill ${filtroStatusMoodboard === st.id ? 'active' : ''} ${st.id === 'sugestoes' && count > 0 ? 'pulse' : ''}`}
                    onClick={() => setFiltroStatusMoodboard(st.id)}
                  >
                    <i className={st.icon}></i>
                    <span>{st.label}</span>
                    <span className="cg-pill-count">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* 2. Dropdown de Categorias */}
            <div className="cg-category-select-box">
              <select
                className="cg-category-dropdown"
                value={filtroCatMoodboard}
                onChange={(e) => {
                  setFiltroCatMoodboard(e.target.value);
                  setFiltroSubtipoMoodboard('todos');
                }}
              >
                {CATEGORIAS_CENOGRAFIA.map(cat => {
                  const count = cat.id === 'todas'
                    ? itensMoodboard.length
                    : itensMoodboard.filter(i => i.categoria === cat.id).length;
                  return (
                    <option key={cat.id} value={cat.id}>
                      {cat.label} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* 3. Campo de Busca */}
            <div className="cg-search-box-integrated">
              <i className="fas fa-search"></i>
              <input 
                type="text" 
                placeholder="Buscar por nome, tag ou criador..." 
                value={buscaMoodboard} 
                onChange={(e) => setBuscaMoodboard(e.target.value)}
              />
              {buscaMoodboard && (
                <button className="cg-search-clear" onClick={() => setBuscaMoodboard('')}>
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>

            {/* 4. Seletor de Cores Popover */}
            <div className="cg-color-popover-wrapper">
              <button 
                type="button" 
                className={`cg-btn-color-trigger ${filtroCorMoodboard !== 'todas' ? 'active' : ''}`}
                onClick={() => setPaletaPopoverAberto(!paletaPopoverAberto)}
              >
                {filtroCorMoodboard !== 'todas' && corFiltroAtivaObj ? (
                  <>
                    <span className="cg-dot-active" style={{ background: corFiltroAtivaObj.cor, border: corFiltroAtivaObj.borda ? `1px solid ${corFiltroAtivaObj.borda}` : 'none' }}></span>
                    <span>Cor: <strong>{corFiltroAtivaObj.label}</strong></span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-palette"></i>
                    <span>Filtrar por Cor</span>
                  </>
                )}
                <i className={`fas fa-chevron-${paletaPopoverAberto ? 'up' : 'down'}`} style={{ fontSize: '10px', marginLeft: '4px' }}></i>
              </button>

              {filtroCorMoodboard !== 'todas' && (
                <button className="cg-btn-clear-color" onClick={() => setFiltroCorMoodboard('todas')} title="Limpar Filtro de Cor">
                  ✕
                </button>
              )}

              {paletaPopoverAberto && (
                <div className="cg-popover-palette-dropdown" onClick={e => e.stopPropagation()}>
                  <div className="cg-popover-header">
                    <strong><i className="fas fa-palette"></i> Paleta de Cores ({PALETA_CORES_MOODBOARD.length - 1} opções)</strong>
                    <button className="cg-popover-close" onClick={() => setPaletaPopoverAberto(false)}>✕</button>
                  </div>
                  <div className="cg-popover-grid">
                    {PALETA_CORES_MOODBOARD.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        className={`cg-popover-color-chip ${filtroCorMoodboard === c.id ? 'active' : ''}`}
                        onClick={() => {
                          setFiltroCorMoodboard(c.id);
                          setPaletaPopoverAberto(false);
                        }}
                      >
                        <span className="cg-color-dot-mini" style={{ background: c.cor, border: c.borda ? `1px solid ${c.borda}` : 'none' }}>
                          {filtroCorMoodboard === c.id && <i className="fas fa-check" style={{ color: c.id === 'branco' || c.id === 'nude' || c.id === 'dourado' ? '#0f172a' : '#fff' }}></i>}
                        </span>
                        <span>{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 5. Ordenação */}
            <div className="cg-sort-wrapper">
              <select 
                className="cg-sort-select" 
                value={ordenacaoMoodboard}
                onChange={e => setOrdenacaoMoodboard(e.target.value)}
              >
                <option value="recentes">📅 Recentes Primeiro</option>
                <option value="nome">🔤 Nome (A - Z)</option>
                <option value="antigos">⌛ Antigos Primeiro</option>
              </select>
            </div>

            {/* 6. Limpar Todos os Filtros */}
            {(buscaMoodboard || filtroStatusMoodboard !== 'todos' || filtroCatMoodboard !== 'todas' || filtroSubtipoMoodboard !== 'todos' || filtroCorMoodboard !== 'todas') && (
              <button 
                className="cg-btn-reset-all-filters"
                onClick={() => {
                  setBuscaMoodboard('');
                  setFiltroStatusMoodboard('todos');
                  setFiltroCatMoodboard('todas');
                  setFiltroSubtipoMoodboard('todos');
                  setFiltroCorMoodboard('todas');
                }}
              >
                <i className="fas fa-undo"></i> Limpar
              </button>
            )}
          </div>

          {/* 🏷️ SUBFILTROS RÁPIDOS SELECIONADOS (SE FOR PAREDE, PISO OU AMBIENTE) */}
          {filtroCatMoodboard === 'Parede' && (
            <div className="cg-subfilter-chips-row">
              <span className="cg-subfilter-label"><i className="fas fa-filter"></i> Tipo de Parede:</span>
              <button 
                className={`cg-subchip-btn ${filtroSubtipoMoodboard === 'todos' ? 'active' : ''}`}
                onClick={() => setFiltroSubtipoMoodboard('todos')}
              >
                Todas
              </button>
              {SUBTIPOS_PAREDE.map(sub => (
                <button
                  key={sub.tag}
                  className={`cg-subchip-btn ${filtroSubtipoMoodboard === sub.tag ? 'active' : ''}`}
                  onClick={() => setFiltroSubtipoMoodboard(filtroSubtipoMoodboard === sub.tag ? 'todos' : sub.tag)}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}

          {filtroCatMoodboard === 'Piso' && (
            <div className="cg-subfilter-chips-row">
              <span className="cg-subfilter-label"><i className="fas fa-filter"></i> Tipo de Chão:</span>
              <button 
                className={`cg-subchip-btn ${filtroSubtipoMoodboard === 'todos' ? 'active' : ''}`}
                onClick={() => setFiltroSubtipoMoodboard('todos')}
              >
                Todos
              </button>
              {SUBTIPOS_PISO.map(sub => (
                <button
                  key={sub.tag}
                  className={`cg-subchip-btn ${filtroSubtipoMoodboard === sub.tag ? 'active' : ''}`}
                  onClick={() => setFiltroSubtipoMoodboard(filtroSubtipoMoodboard === sub.tag ? 'todos' : sub.tag)}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}

          {filtroCatMoodboard === 'Ambiente' && (
            <div className="cg-subfilter-chips-row">
              <span className="cg-subfilter-label"><i className="fas fa-filter"></i> Tipo de Ambiente:</span>
              <button 
                className={`cg-subchip-btn ${filtroSubtipoMoodboard === 'todos' ? 'active' : ''}`}
                onClick={() => setFiltroSubtipoMoodboard('todos')}
              >
                Todos
              </button>
              {SUBTIPOS_AMBIENTE.map(sub => (
                <button
                  key={sub.tag}
                  className={`cg-subchip-btn ${filtroSubtipoMoodboard === sub.tag ? 'active' : ''}`}
                  onClick={() => setFiltroSubtipoMoodboard(filtroSubtipoMoodboard === sub.tag ? 'todos' : sub.tag)}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}

          {/* 🖼️ GRADE DE CARDS DO ACERVO */}
          {loadingMoodboard ? (
            <div className="cg-loading-tab">
              <i className="fas fa-spinner fa-spin"></i>
              <p>Carregando elementos do acervo...</p>
            </div>
          ) : itensMoodboardFiltrados.length === 0 ? (
            <div className="cg-empty-mb">
              <i className="fas fa-layer-group"></i>
              <h4>Nenhum elemento encontrado</h4>
              <p>Tente ajustar os filtros de categoria, status ou busca, ou cadastre novos elementos oficiais!</p>
              <button className="cg-btn-add-global-primary" onClick={() => setModalNovoItemAberto(true)}>
                <i className="fas fa-plus-circle"></i> + Cadastrar Novo Elemento
              </button>
            </div>
          ) : (
            <div className="cg-mb-grid">
              {itensMoodboardFiltrados.map((item) => {
                const isBgOrPhoto = item.categoria === 'Parede' || item.categoria === 'Piso' || item.categoria === 'Ambiente';

                return (
                  <div key={item.id} className={`cg-mb-card ${item.isGlobal ? 'is-global' : ''} ${item.sugeridoParaGlobal ? 'is-suggested' : ''}`}>
                    <div className={`cg-mb-thumb-container ${isBgOrPhoto ? 'is-photo-mode' : ''}`}>
                      <img src={item.imagemUrl} alt={item.nome} />
                      <span className="cg-mb-cat-badge">{item.categoria}</span>
                      
                      {item.isGlobal ? (
                        <span className="cg-mb-status-badge global"><i className="fas fa-crown"></i> OFICIAL</span>
                      ) : item.sugeridoParaGlobal ? (
                        <span className="cg-mb-status-badge suggested"><i className="fas fa-star"></i> SUGESTÃO</span>
                      ) : (
                        <span className="cg-mb-status-badge private"><i className="fas fa-lock"></i> PRIVADO</span>
                      )}
                    </div>

                    <div className="cg-mb-card-body">
                      <div className="cg-mb-card-title" title={item.nome}>{item.nome}</div>
                      
                      <div className="cg-mb-card-meta">
                        <span className="cg-mb-author">
                          <i className="fas fa-user-circle"></i> {item.criadoPorNome || 'Super Admin'}
                        </span>
                        {item.tag && <span className="cg-mb-tag">{item.tag}</span>}
                      </div>

                      {/* Cores Cadastradas no Card */}
                      {item.cores && Array.isArray(item.cores) && item.cores.length > 0 && (
                        <div className="cg-mb-colors-dots-row">
                          {item.cores.slice(0, 5).map(cId => {
                            const cObj = PALETA_CORES_MOODBOARD.find(c => c.id === cId) || { label: cId, cor: '#cbd5e1' };
                            return (
                              <span 
                                key={cId} 
                                className="cg-color-dot-micro" 
                                style={{ background: cObj.cor, border: cObj.borda ? `1px solid ${cObj.borda}` : 'none' }}
                                title={cObj.label}
                              />
                            );
                          })}
                          {item.cores.length > 5 && <small>+{item.cores.length - 5}</small>}
                        </div>
                      )}

                      {/* AÇÕES DO CARD */}
                      {item.sugeridoParaGlobal ? (
                        <div className="cg-mb-moderation-actions">
                          <button 
                            className="cg-btn-approve-suggested"
                            onClick={() => handleAprovarSugestao(item)}
                            title="Aprovar como Oficial Global para todos os clientes"
                          >
                            <i className="fas fa-check"></i> Aprovar Oficial
                          </button>
                          <button 
                            className="cg-btn-reject-suggested"
                            onClick={() => handleRecusarSugestao(item)}
                            title="Manter apenas no portfólio privado da decoradora"
                          >
                            <i className="fas fa-times"></i> Manter Privado
                          </button>
                          <button 
                            className="cg-btn-edit-item"
                            onClick={() => handleAbrirEdicaoItem(item)}
                            title="Editar Informações"
                          >
                            <i className="fas fa-pen"></i>
                          </button>
                        </div>
                      ) : (
                        <div className="cg-mb-card-actions">
                          <button 
                            className={`cg-btn-toggle-global ${item.isGlobal ? 'active' : ''}`}
                            onClick={() => handleAlternarGlobal(item)}
                            title={item.isGlobal ? 'Elemento ativo para todos os clientes. Clique para desativar.' : 'Clique para tornar oficial global'}
                          >
                            {item.isGlobal ? <><i className="fas fa-check-circle"></i> Oficial</> : <><i className="fas fa-star"></i> Tornar Oficial</>}
                          </button>

                          <button 
                            className="cg-btn-edit-item"
                            onClick={() => handleAbrirEdicaoItem(item)}
                            title="Edição Rápida (Nome, Categoria, Tags, Cores)"
                          >
                            <i className="fas fa-pen"></i>
                          </button>

                          <button 
                            className="cg-btn-del-item"
                            onClick={() => handleExcluirItemMoodboard(item.id)}
                            title="Excluir Elemento"
                          >
                            <i className="fas fa-trash-alt"></i>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* KPI CARDS (COM FILTRO DE VENCENDO) */}
          <div className="cg-kpi-row">
            <div className="cg-kpi-card" onClick={() => setFiltroStatus('todos')}>
              <div className="cg-kpi-icon" style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)' }}>
                <i className="fas fa-building"></i>
              </div>
              <div className="cg-kpi-info">
                <span className="cg-kpi-value">{totalClientes}</span>
                <span className="cg-kpi-label">Total Empresas</span>
              </div>
            </div>

            <div className="cg-kpi-card" onClick={() => setFiltroStatus('vencendo')}>
              <div className="cg-kpi-icon" style={{ background: 'linear-gradient(135deg, #ea580c, #c2410c)' }}>
                <i className="fas fa-hourglass-half"></i>
              </div>
              <div className="cg-kpi-info">
                <span className="cg-kpi-value" style={{ color: totalVencendo > 0 ? '#ea580c' : '#0f172a' }}>{totalVencendo}</span>
                <span className="cg-kpi-label">Testes Vencendo</span>
              </div>
            </div>

            <div className="cg-kpi-card" onClick={() => setFiltroStatus('teste')}>
              <div className="cg-kpi-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                <i className="fas fa-flask"></i>
              </div>
              <div className="cg-kpi-info">
                <span className="cg-kpi-value">{totalTeste}</span>
                <span className="cg-kpi-label">Em Teste</span>
              </div>
            </div>

            <div className="cg-kpi-card" onClick={() => setFiltroStatus('ativo')}>
              <div className="cg-kpi-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                <i className="fas fa-check-circle"></i>
              </div>
              <div className="cg-kpi-info">
                <span className="cg-kpi-value">{totalAtivos}</span>
                <span className="cg-kpi-label">Pagantes</span>
              </div>
            </div>

            <div className="cg-kpi-card" onClick={() => setFiltroStatus('bloqueado')}>
              <div className="cg-kpi-icon" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                <i className="fas fa-lock"></i>
              </div>
              <div className="cg-kpi-info">
                <span className="cg-kpi-value">{totalBloqueados}</span>
                <span className="cg-kpi-label">Bloqueados</span>
              </div>
            </div>

            <div className="cg-kpi-card" onClick={() => setFiltroStatus('excluido')}>
              <div className="cg-kpi-icon" style={{ background: 'linear-gradient(135deg, #64748b, #475569)' }}>
                <i className="fas fa-user-slash"></i>
              </div>
              <div className="cg-kpi-info">
                <span className="cg-kpi-value">{totalExcluidos}</span>
                <span className="cg-kpi-label">Excluídos</span>
              </div>
            </div>
          </div>

          {/* BARRA DE BUSCA E FILTROS */}
          <div className="cg-toolbar">
            <div className="cg-search-box">
              <i className="fas fa-search"></i>
              <input 
                type="text" 
                placeholder="Buscar por nome, email ou documento..." 
                value={busca} 
                onChange={(e) => setBusca(e.target.value)}
              />
              {busca && (
                <button className="cg-search-clear" onClick={() => setBusca('')}>
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>
            <div className="cg-filter-pills">
              {[
                { id: 'todos', label: 'Todos' },
                { id: 'vencendo', label: `⏳ Vencendo (${totalVencendo})` },
                { id: 'teste', label: 'Em Teste' },
                { id: 'ativo', label: 'Pagantes' },
                { id: 'bloqueado', label: 'Bloqueados' },
                { id: 'excluido', label: 'Excluídos' }
              ].map(f => (
                <button 
                  key={f.id} 
                  className={`cg-pill ${filtroStatus === f.id ? 'active' : ''} ${f.id === 'vencendo' && totalVencendo > 0 ? 'pill-vencendo' : ''}`}
                  onClick={() => setFiltroStatus(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* TABELA DE CLIENTES (DESKTOP) E CARDS RESPONSIVOS (MOBILE) */}
          <div className="cg-table-container">
            <table className="cg-table">
              <thead>
                <tr>
                  <th>Empresa / Nome</th>
                  <th>Email</th>
                  <th>Documento</th>
                  <th>Data Cadastro</th>
                  <th>Plano</th>
                  <th>Status</th>
                  <th>Teste</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="cg-empty">
                      <i className="fas fa-inbox"></i>
                      <p>Nenhum cliente encontrado com os filtros selecionados.</p>
                    </td>
                  </tr>
                ) : (
                  clientesFiltrados.map(c => (
                    <tr key={c.uid} className={`cg-row cg-row-${c.status} ${c.status === 'teste' && c.diasRestantes <= 2 ? 'row-vencendo' : ''}`}>
                      <td className="cg-cell-name">
                        <div className="cg-avatar">
                          {(c.nomeExibicao || '?')[0].toUpperCase()}
                        </div>
                        <div className="cg-name-group">
                          <strong>{c.nomeExibicao}</strong>
                          {c.nomeCompleto !== c.nomeExibicao && (
                            <small>{c.nomeCompleto}</small>
                          )}
                        </div>
                      </td>
                      <td className="cg-cell-email">{c.email}</td>
                      <td className="cg-cell-doc">
                        <span className="cg-doc-type">{c.tipoPessoa === 'PJ' ? 'CNPJ' : 'CPF'}</span>
                        {c.documento || '—'}
                      </td>
                      <td>{c.dataCadastroExibida}</td>
                      <td>
                        <span className="cg-plano-tag">{c.nomePlano}</span>
                      </td>
                      <td>{getStatusBadge(c.status)}</td>
                      <td>
                        {c.status === 'teste' ? (
                          <div className="cg-teste-info">
                            <div className="cg-teste-bar">
                              <div 
                                className="cg-teste-fill" 
                                style={{ 
                                  width: `${((7 - c.diasRestantes) / 7) * 100}%`,
                                  background: c.diasRestantes <= 2 ? '#ea580c' : '#f59e0b' 
                                }}
                              ></div>
                            </div>
                            <small style={{ color: c.diasRestantes <= 2 ? '#ea580c' : '#64748b', fontWeight: c.diasRestantes <= 2 ? '800' : '600' }}>
                              {c.diasRestantes <= 0 ? '⚠️ Vencido' : `${c.diasRestantes}d restantes`}
                            </small>
                          </div>
                        ) : (
                          <span className="cg-teste-na">—</span>
                        )}
                      </td>
                      <td className="cg-cell-actions">
                        {c.status !== 'admin' ? (
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                            {c.telefone && (
                              <a 
                                href={`https://wa.me/55${c.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${c.nomeExibicao}, tudo bem? Sou da equipe Celebre! Gostaria de saber como está sendo sua experiência no sistema Celebre.`)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="cg-btn-whatsapp-direct"
                                title={`Chamar no WhatsApp (${c.telefone})`}
                              >
                                <i className="fab fa-whatsapp"></i>
                              </a>
                            )}
                            <button 
                              className="cg-btn-support" 
                              onClick={() => abrirVisualizadorSuporte(c)}
                              title="Visualizar Perfil (Dar Suporte)"
                            >
                              <i className="fas fa-search-plus"></i>
                            </button>
                            <button 
                              className="cg-btn-edit" 
                              onClick={() => abrirEdicao(c)}
                              title="Editar Cadastro/Plano"
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                            <button 
                              className="cg-btn-delete" 
                              onClick={() => confirmarExclusao(c.uid, c.nomeExibicao)}
                              title="Excluir Empresa"
                            >
                              <i className="fas fa-trash-alt"></i>
                            </button>
                          </div>
                        ) : (
                          <span className="cg-admin-na">Bloqueado</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Mobile Cards View */}
            <div className="cg-mobile-cards-list">
              {clientesFiltrados.length === 0 ? (
                <div className="cg-empty-mobile">
                  <i className="fas fa-inbox"></i>
                  <p>Nenhuma empresa encontrada com os filtros selecionados.</p>
                </div>
              ) : (
                clientesFiltrados.map(c => (
                  <div className={`cg-mobile-client-card ${c.status === 'teste' && c.diasRestantes <= 2 ? 'card-vencendo' : ''}`} key={c.uid}>
                    <div className="cg-mcard-header">
                      <div className="cg-mcard-user">
                        <div className="cg-avatar">{(c.nomeExibicao || '?')[0].toUpperCase()}</div>
                        <div className="cg-mcard-titles">
                          <strong className="cg-mcard-name">{c.nomeExibicao}</strong>
                          {c.nomeCompleto && c.nomeCompleto !== c.nomeExibicao && (
                            <small className="cg-mcard-subname">{c.nomeCompleto}</small>
                          )}
                        </div>
                      </div>
                      <div className="cg-mcard-badge-box">
                        {getStatusBadge(c.status)}
                      </div>
                    </div>

                    <div className="cg-mcard-body">
                      <div className="cg-mcard-row">
                        <span className="cg-mcard-lbl"><i className="fas fa-envelope"></i> Email:</span>
                        <span className="cg-mcard-val-email">{c.email}</span>
                      </div>

                      {c.telefone && (
                        <div className="cg-mcard-row">
                          <span className="cg-mcard-lbl"><i className="fab fa-whatsapp"></i> Telefone / Zap:</span>
                          <span className="cg-mcard-val">{c.telefone}</span>
                        </div>
                      )}

                      <div className="cg-mcard-row">
                        <span className="cg-mcard-lbl"><i className="fas fa-id-card"></i> Doc:</span>
                        <span className="cg-mcard-val">{c.documento || '—'} <small>({c.tipoPessoa === 'PJ' ? 'CNPJ' : 'CPF'})</small></span>
                      </div>

                      <div className="cg-mcard-grid-2">
                        <div className="cg-mcard-col">
                          <span className="cg-mcard-lbl"><i className="fas fa-crown"></i> Plano:</span>
                          <span className="cg-plano-tag">{c.nomePlano}</span>
                        </div>
                        <div className="cg-mcard-col">
                          <span className="cg-mcard-lbl"><i className="fas fa-calendar-alt"></i> Cadastro:</span>
                          <span className="cg-mcard-val">{c.dataCadastroExibida}</span>
                        </div>
                      </div>

                      {c.status === 'teste' && (
                        <div className={`cg-mcard-teste-row ${c.diasRestantes <= 2 ? 'is-expiring' : ''}`}>
                          <div className="cg-teste-bar">
                            <div 
                              className="cg-teste-fill" 
                              style={{ 
                                width: `${((7 - c.diasRestantes) / 7) * 100}%`,
                                background: c.diasRestantes <= 2 ? '#ea580c' : '#f59e0b'
                              }}
                            ></div>
                          </div>
                          <small className="cg-mcard-dias">
                            {c.diasRestantes <= 0 ? '⚠️ Período de Teste Vencido' : `⏳ ${c.diasRestantes} dias restantes de teste`}
                          </small>
                        </div>
                      )}
                    </div>

                    {c.status !== 'admin' && (
                      <div className="cg-mcard-actions">
                        {c.telefone && (
                          <a 
                            href={`https://wa.me/55${c.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${c.nomeExibicao}, tudo bem? Sou da equipe Celebre! Gostaria de saber como está sendo sua experiência no sistema Celebre.`)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="cg-btn-whatsapp-mcard"
                            title="Chamar no WhatsApp"
                          >
                            <i className="fab fa-whatsapp"></i> Zap
                          </a>
                        )}
                        <button 
                          className="cg-btn-support cg-mcard-btn" 
                          onClick={() => abrirVisualizadorSuporte(c)}
                        >
                          <i className="fas fa-search-plus"></i> Suporte
                        </button>
                        <button 
                          className="cg-btn-edit cg-mcard-btn" 
                          onClick={() => abrirEdicao(c)}
                        >
                          <i className="fas fa-edit"></i> Editar
                        </button>
                        <button 
                          className="cg-btn-delete cg-mcard-btn-icon" 
                          onClick={() => confirmarExclusao(c.uid, c.nomeExibicao)}
                          title="Excluir"
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* MODAL DE EDIÇÃO */}
          {modalAberto && membroEdicao && (
            <div className="cg-modal-backdrop" onClick={() => setModalAberto(false)}>
              <div className="cg-modal-content" onClick={e => e.stopPropagation()}>
                <div className="cg-modal-header">
                  <h2><i className="fas fa-edit"></i> Editar Cliente</h2>
                  <button className="cg-modal-close" onClick={() => setModalAberto(false)}>
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                
                <form onSubmit={salvarEdicao} className="cg-modal-form">
                  <div className="cg-form-grid">
                    <div className="cg-form-group">
                      <label>Nome Fantasia / Empresa</label>
                      <input 
                        type="text" 
                        value={membroEdicao.nomeExibicao || ''} 
                        onChange={e => setMembroEdicao({ ...membroEdicao, nomeExibicao: e.target.value })}
                        required
                      />
                    </div>

                    <div className="cg-form-group">
                      <label>Razão Social / Nome Completo</label>
                      <input 
                        type="text" 
                        value={membroEdicao.nomeCompleto || ''} 
                        onChange={e => setMembroEdicao({ ...membroEdicao, nomeCompleto: e.target.value })}
                        required
                      />
                    </div>

                    <div className="cg-form-group">
                      <label>E-mail do Proprietário</label>
                      <input 
                        type="email" 
                        value={membroEdicao.email || ''} 
                        onChange={e => setMembroEdicao({ ...membroEdicao, email: e.target.value })}
                        required
                      />
                    </div>

                    <div className="cg-form-group">
                      <label>CPF ou CNPJ</label>
                      <input 
                        type="text" 
                        value={membroEdicao.documento || ''} 
                        onChange={e => setMembroEdicao({ ...membroEdicao, documento: e.target.value })}
                      />
                    </div>

                    <div className="cg-form-group">
                      <label>Plano Vinculado</label>
                      <select 
                        value={membroEdicao.planoId || ''} 
                        onChange={e => {
                          const selectedId = e.target.value;
                          setMembroEdicao({ 
                            ...membroEdicao, 
                            planoId: selectedId,
                            assinaturaAtiva: selectedId ? true : membroEdicao.assinaturaAtiva,
                            plano: selectedId ? 'pago' : ''
                          });
                        }}
                      >
                        <option value="">Sem plano / Nenhum</option>
                        {Object.keys(planos).length > 0 ? (
                          Object.entries(planos).map(([id, p]) => (
                            <option key={id} value={id}>{p.nome || id}</option>
                          ))
                        ) : (
                          <>
                            <option value="plano_basico">Plano Básico</option>
                            <option value="plano_profissional">Plano Profissional</option>
                            <option value="plano_premium">Plano Premium</option>
                          </>
                        )}
                      </select>
                    </div>

                    <div className="cg-form-group">
                      <label>Data de Cadastro da Empresa</label>
                      <input 
                        type="date" 
                        value={membroEdicao.dataCadastro ? membroEdicao.dataCadastro.split('T')[0] : ''} 
                        onChange={e => setMembroEdicao({ ...membroEdicao, dataCadastro: e.target.value })}
                      />
                      <small style={{ color: '#64748b', marginTop: '4px', display: 'block' }}>Altere a data para estipular o início exato do cálculo de 7 dias.</small>
                    </div>

                    <div className="cg-form-group">
                      <label>Término do Período de Teste</label>
                      <input 
                        type="date" 
                        value={membroEdicao.dataFimTeste || ''} 
                        onChange={e => setMembroEdicao({ ...membroEdicao, dataFimTeste: e.target.value })}
                      />
                      <small style={{ color: '#64748b', marginTop: '4px', display: 'block' }}>Deixe vazio se o teste grátis já acabou ou não deve ser aplicado.</small>
                    </div>
                  </div>

                  <div className="cg-payment-section">
                    <h3><i className="fas fa-credit-card"></i> Controle Manual de Assinatura</h3>
                    <div className="cg-form-grid" style={{ marginTop: '12px' }}>
                      <div className="cg-form-group">
                        <label>Assinatura Ativa (Passe VIP)</label>
                        <select 
                          value={String(membroEdicao.assinaturaAtiva)} 
                          onChange={e => setMembroEdicao({ ...membroEdicao, assinaturaAtiva: e.target.value === 'true' })}
                        >
                          <option value="false">Não (Bloquear se teste expirar)</option>
                          <option value="true">Sim (Acesso irrestrito pago)</option>
                        </select>
                      </div>

                      <div className="cg-form-group">
                        <label>Status do Plano</label>
                        <select 
                          value={membroEdicao.plano || ''} 
                          onChange={e => setMembroEdicao({ ...membroEdicao, plano: e.target.value })}
                        >
                          <option value="">Sem plano</option>
                          <option value="pago">Pago</option>
                          <option value="gratis">Grátis</option>
                        </select>
                      </div>

                      <div className="cg-form-group">
                        <label>Pagamento Avulso</label>
                        <select 
                          value={membroEdicao.statusPagamentoVulso || ''} 
                          onChange={e => setMembroEdicao({ ...membroEdicao, statusPagamentoVulso: e.target.value })}
                        >
                          <option value="">Nenhum</option>
                          <option value="pago">Pago</option>
                          <option value="pendente">Pendente</option>
                        </select>
                      </div>

                      <div className="cg-form-group">
                        <label>Status da Assinatura</label>
                        <select 
                          value={membroEdicao.statusAssinatura || ''} 
                          onChange={e => setMembroEdicao({ ...membroEdicao, statusAssinatura: e.target.value })}
                        >
                          <option value="">Sem assinatura</option>
                          <option value="ativa">Ativa</option>
                          <option value="cancelada">Cancelada</option>
                          <option value="pendente">Pendente</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="cg-modal-footer">
                    <button 
                      type="button" 
                      className="cg-btn-cancel" 
                      onClick={() => setModalAberto(false)}
                      disabled={salvando}
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      className="cg-btn-save"
                      disabled={salvando}
                    >
                      {salvando ? <><i className="fas fa-spinner fa-spin"></i> Salvando...</> : 'Salvar Alterações'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* MODAL DE VISUALIZAÇÃO DE SUPORTE */}
          {modalSuporteAberto && membroSuporte && (
            <div className="cg-modal-backdrop" onClick={() => setModalSuporteAberto(false)}>
              <div className="cg-modal-content support-modal-width" onClick={e => e.stopPropagation()}>
                <div className="cg-modal-header">
                  <h2><i className="fas fa-search-plus"></i> Painel de Suporte: {membroSuporte.nomeExibicao}</h2>
                  <button className="cg-modal-close" onClick={() => setModalSuporteAberto(false)}>
                    <i className="fas fa-times"></i>
                  </button>
                </div>

                <div className="cg-support-tabs">
                  <button 
                    className={`cg-support-tab-btn ${tabSuporteActive === 'resumo' ? 'active' : ''}`}
                    onClick={() => setTabSuporteActive('resumo')}
                  >
                    <i className="fas fa-info-circle"></i> Resumo Perfil
                  </button>
                  <button 
                    className={`cg-support-tab-btn ${tabSuporteActive === 'acervo' ? 'active' : ''}`}
                    onClick={() => setTabSuporteActive('acervo')}
                  >
                    <i className="fas fa-boxes"></i> Acervo ({dadosSuporte.estoque.length})
                  </button>
                  <button 
                    className={`cg-support-tab-btn ${tabSuporteActive === 'locacoes' ? 'active' : ''}`}
                    onClick={() => setTabSuporteActive('locacoes')}
                  >
                    <i className="fas fa-calendar-alt"></i> Locações/Pedidos ({dadosSuporte.locacoes.length})
                  </button>
                  <button 
                    className={`cg-support-tab-btn ${tabSuporteActive === 'clientes' ? 'active' : ''}`}
                    onClick={() => setTabSuporteActive('clientes')}
                  >
                    <i className="fas fa-users"></i> Clientes ({dadosSuporte.clientes.length})
                  </button>
                </div>

                <div className="cg-modal-form" style={{ minHeight: '380px' }}>
                  {loadingSuporte ? (
                    <div className="cg-support-tab-loading">
                      <i className="fas fa-spinner fa-spin"></i>
                      <p>Carregando dados da empresa...</p>
                    </div>
                  ) : (
                    <>
                      {/* TAB 1: RESUMO DO PERFIL */}
                      {tabSuporteActive === 'resumo' && (
                        <div className="cg-support-resumo-grid">
                          <div className="cg-support-kpi-subrow">
                            <div className="cg-support-subkpi">
                              <h4>Acervo Total</h4>
                              <span>{dadosSuporte.estoque.length}</span>
                            </div>
                            <div className="cg-support-subkpi">
                              <h4>Total Pedidos</h4>
                              <span>{dadosSuporte.locacoes.length}</span>
                            </div>
                            <div className="cg-support-subkpi">
                              <h4>Total Clientes</h4>
                              <span>{dadosSuporte.clientes.length}</span>
                            </div>
                          </div>

                          <div className="cg-support-details-card">
                            <h3>Informações Gerais</h3>
                            <table className="cg-support-details-table">
                              <tbody>
                                <tr>
                                  <td><strong>UID do Usuário:</strong></td>
                                  <td style={{ fontFamily: 'monospace', fontSize: '11.5px' }}>{membroSuporte.uid}</td>
                                </tr>
                                <tr>
                                  <td><strong>E-mail de Login:</strong></td>
                                  <td>{membroSuporte.email}</td>
                                </tr>
                                <tr>
                                  <td><strong>Documento (CPF/CNPJ):</strong></td>
                                  <td>{membroSuporte.documento || 'Não informado'}</td>
                                </tr>
                                <tr>
                                  <td><strong>Plano Selecionado:</strong></td>
                                  <td><span className="cg-plano-tag">{membroSuporte.nomePlano}</span></td>
                                </tr>
                                <tr>
                                  <td><strong>Data de Cadastro:</strong></td>
                                  <td>{membroSuporte.dataCadastroExibida}</td>
                                </tr>
                                <tr>
                                  <td><strong>Status do Teste Grátis:</strong></td>
                                  <td>
                                    {membroSuporte.status === 'teste' ? (
                                      <span style={{ color: '#d97706', fontWeight: 'bold' }}>Período de Teste Ativo ({membroSuporte.diasRestantes} dias restantes)</span>
                                    ) : (
                                      <span style={{ color: '#64748b' }}>Teste Finalizado / Expirado</span>
                                    )}
                                  </td>
                                </tr>
                                <tr>
                                  <td><strong>Fim do Período de Teste:</strong></td>
                                  <td>{membroSuporte.dataFimTeste ? new Date(membroSuporte.dataFimTeste).toLocaleDateString('pt-BR') : '—'}</td>
                                </tr>
                                <tr>
                                  <td><strong>Assinatura Ativa (Passe VIP):</strong></td>
                                  <td>{membroSuporte.assinaturaAtiva ? 'Sim (Liberado)' : 'Não'}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* TAB 2: ACERVO / ESTOQUE */}
                      {tabSuporteActive === 'acervo' && (
                        <div className="cg-support-table-panel">
                          <table className="cg-support-subtable">
                            <thead>
                              <tr>
                                <th>Código</th>
                                <th>Item</th>
                                <th>Categoria</th>
                                <th>Quantidade</th>
                                <th>Valor Locação</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dadosSuporte.estoque.length === 0 ? (
                                <tr>
                                  <td colSpan="5" className="cg-empty-tab">Nenhum item cadastrado no acervo.</td>
                                </tr>
                              ) : (
                                dadosSuporte.estoque.map(item => (
                                  <tr key={item.id}>
                                    <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>{item.codigo || '—'}</td>
                                    <td>
                                      <strong>{item.nome}</strong>
                                    </td>
                                    <td>{item.categoria || 'Sem Categoria'}</td>
                                    <td>{item.quantidade || 0} unidades</td>
                                    <td>R$ {Number(item.valorLocacao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* TAB 3: LOCAÇÕES / PEDIDOS */}
                      {tabSuporteActive === 'locacoes' && (
                        <div className="cg-support-table-panel">
                          <table className="cg-support-subtable">
                            <thead>
                              <tr>
                                <th>Festa/Evento</th>
                                <th>Cliente</th>
                                <th>Status</th>
                                <th>Data Retirada</th>
                                <th>Valor Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dadosSuporte.locacoes.length === 0 ? (
                                <tr>
                                  <td colSpan="5" className="cg-empty-tab">Nenhuma locação ou orçamento criado.</td>
                                </tr>
                              ) : (
                                dadosSuporte.locacoes.map(loc => (
                                  <tr key={loc.id}>
                                    <td><strong>{loc.nomeEvento || 'Sem Nome'}</strong></td>
                                    <td>{loc.clienteNome || 'Não Informado'}</td>
                                    <td>
                                      <span className={`cg-badge badge-${(loc.status || 'orcamento').toLowerCase()}`}>
                                        {loc.status || 'Orçamento'}
                                      </span>
                                    </td>
                                    <td>{loc.dataRetirada ? loc.dataRetirada.split('-').reverse().join('/') : '—'}</td>
                                    <td>R$ {Number(loc.valorTotal || loc.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* TAB 4: CLIENTES */}
                      {tabSuporteActive === 'clientes' && (
                        <div className="cg-support-table-panel">
                          <table className="cg-support-subtable">
                            <thead>
                              <tr>
                                <th>Nome</th>
                                <th>E-mail</th>
                                <th>Telefone / WhatsApp</th>
                                <th>CPF / CNPJ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dadosSuporte.clientes.length === 0 ? (
                                <tr>
                                  <td colSpan="4" className="cg-empty-tab">Nenhum cliente cadastrado por esta empresa.</td>
                                </tr>
                              ) : (
                                dadosSuporte.clientes.map(cli => (
                                  <tr key={cli.id}>
                                    <td><strong>{cli.nome || cli.razaoSocial}</strong></td>
                                    <td style={{ color: '#3b82f6' }}>{cli.email || '—'}</td>
                                    <td>{cli.telefone || cli.celular || '—'}</td>
                                    <td>{cli.cpf || cli.cnpj || '—'}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="cg-modal-footer" style={{ padding: '0 24px 20px 24px', borderTop: 'none' }}>
                  <button className="cg-btn-cancel" onClick={() => setModalSuporteAberto(false)}>
                    Fechar Painel
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* 🌟 MODAL: SUBIR NOVO ELEMENTO OFICIAL (COM SUBTIPOS INTELIGENTES POR CATEGORIA) */}
      {modalNovoItemAberto && (
        <div className="cg-modal-overlay" onClick={() => setModalNovoItemAberto(false)}>
          <div className="cg-modal-content cg-modal-upload-moodboard" onClick={e => e.stopPropagation()} style={{ maxWidth: '840px', width: '95%' }}>
            <div className="cg-modal-header">
              <h2><i className="fas fa-cloud-upload-alt"></i> Cadastrar Novo Item Oficial</h2>
              <button className="cg-modal-close" onClick={() => setModalNovoItemAberto(false)}>✕</button>
            </div>

            <form onSubmit={handleSalvarNovoItemOficial}>
              <div className="cg-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Linha 1: Categoria + Nome */}
                <div className="cg-form-row-2">
                  <div className="cg-form-group" style={{ flex: 1 }}>
                    <label className="cg-form-label">1. O que você está cadastrando?</label>
                    <select 
                      className="cg-form-select highlight-select" 
                      value={novoItemForm.categoria}
                      onChange={e => {
                        const novaCat = e.target.value;
                        let defaultTag = 'Oficial';
                        if (novaCat === 'Parede') defaultTag = 'Ripado';
                        else if (novaCat === 'Piso') defaultTag = 'Madeira';
                        else if (novaCat === 'Ambiente') defaultTag = 'Salão de Festa';
                        
                        setNovoItemForm({
                          ...novoItemForm, 
                          categoria: novaCat, 
                          tag: defaultTag,
                          cores: []
                        });
                      }}
                    >
                      <option value="Parede">🧱 Fundo de Parede</option>
                      <option value="Piso">🪵 Fundo de Piso / Chão</option>
                      <option value="Ambiente">🏞️ Ambiente Inteiro / Salão Completo</option>
                      <option value="Baloes">🎈 Balões & Arcos (PNG)</option>
                      <option value="Paineis">🏛️ Painéis & Estruturas (PNG)</option>
                      <option value="Flores">🌸 Flores & Folhagens (PNG)</option>
                      <option value="Moveis">🛋️ Móveis & Mesas (PNG)</option>
                      <option value="Letreiros">✨ LED & Letreiros (PNG)</option>
                      <option value="Texturas">🪵 Texturas & Materiais</option>
                      <option value="Outros">📦 Outros Acessórios</option>
                    </select>
                  </div>

                  <div className="cg-form-group" style={{ flex: 1.2 }}>
                    <label className="cg-form-label">2. Nome de Exibição do Item:</label>
                    <input 
                      type="text" 
                      className="cg-form-input" 
                      placeholder={
                        novoItemForm.categoria === 'Parede' ? 'Ex: Parede Ripada Bege, Tijolo Rústico...' :
                        novoItemForm.categoria === 'Piso' ? 'Ex: Tablado Madeira Nobre, Concreto...' :
                        novoItemForm.categoria === 'Ambiente' ? 'Ex: Salão de Festas com Janelas, Jardim...' :
                        'Ex: Arco Orgânico Rose Gold, Painel Romano...'
                      }
                      required 
                      value={novoItemForm.nome} 
                      onChange={e => setNovoItemForm({...novoItemForm, nome: e.target.value})}
                    />
                  </div>
                </div>

                {/* Linha 2: Subtipo Contextual Inteligente (Parede / Piso / Ambiente / Peças) */}
                {novoItemForm.categoria === 'Parede' && (
                  <div className="cg-contextual-subtype-box">
                    <label className="cg-form-label"><i className="fas fa-th-large"></i> Selecione o Tipo / Estilo da Parede:</label>
                    <div className="cg-subtype-chips-grid">
                      {SUBTIPOS_PAREDE.map(sub => (
                        <button
                          key={sub.tag}
                          type="button"
                          className={`cg-subtype-btn ${novoItemForm.tag === sub.tag ? 'active' : ''}`}
                          onClick={() => {
                            setNovoItemForm({
                              ...novoItemForm,
                              tag: sub.tag,
                              nome: novoItemForm.nome || `Parede ${sub.tag}`
                            });
                          }}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {novoItemForm.categoria === 'Piso' && (
                  <div className="cg-contextual-subtype-box">
                    <label className="cg-form-label"><i className="fas fa-layer-group"></i> Selecione o Tipo de Chão / Piso:</label>
                    <div className="cg-subtype-chips-grid">
                      {SUBTIPOS_PISO.map(sub => (
                        <button
                          key={sub.tag}
                          type="button"
                          className={`cg-subtype-btn ${novoItemForm.tag === sub.tag ? 'active' : ''}`}
                          onClick={() => {
                            setNovoItemForm({
                              ...novoItemForm,
                              tag: sub.tag,
                              nome: novoItemForm.nome || `Piso ${sub.tag}`
                            });
                          }}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {novoItemForm.categoria === 'Ambiente' && (
                  <div className="cg-contextual-subtype-box">
                    <label className="cg-form-label"><i className="fas fa-image"></i> Selecione o Tipo de Ambiente / Salão:</label>
                    <div className="cg-subtype-chips-grid">
                      {SUBTIPOS_AMBIENTE.map(sub => (
                        <button
                          key={sub.tag}
                          type="button"
                          className={`cg-subtype-btn ${novoItemForm.tag === sub.tag ? 'active' : ''}`}
                          onClick={() => {
                            setNovoItemForm({
                              ...novoItemForm,
                              tag: sub.tag,
                              nome: novoItemForm.nome || `Ambiente ${sub.tag}`
                            });
                          }}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Se for peça decorativa (Balões, Painéis, Flores, Móveis, LED), exibe Seletor de Cores */}
                {novoItemForm.categoria !== 'Parede' && novoItemForm.categoria !== 'Piso' && novoItemForm.categoria !== 'Ambiente' && (
                  <SeletorCoresModal 
                    coresSelecionadas={novoItemForm.cores || []}
                    onToggleCor={(corId) => {
                      const cur = novoItemForm.cores || [];
                      const updated = cur.includes(corId) ? cur.filter(x => x !== corId) : [...cur, corId];
                      setNovoItemForm({ ...novoItemForm, cores: updated });
                    }}
                    onLimpar={() => setNovoItemForm({ ...novoItemForm, cores: [] })}
                  />
                )}

                {/* Linha de Upload e Preview */}
                <div className="cg-form-row-2" style={{ alignItems: 'flex-start' }}>
                  <div className="cg-form-group" style={{ flex: 1 }}>
                    <label className="cg-form-label">
                      {novoItemForm.categoria === 'Parede' || novoItemForm.categoria === 'Piso' || novoItemForm.categoria === 'Ambiente'
                        ? '3. Foto de Fundo (JPG, WebP ou PNG em boa resolução):'
                        : '3. Recorte do Elemento (PNG com fundo transparente):'}
                    </label>
                    
                    <div className="cg-upload-dropzone">
                      <input 
                        id="file-upload-global-mb"
                        type="file" 
                        accept="image/png, image/jpeg, image/jpg, image/webp" 
                        required={!novoItemForm.imagemUrl}
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            setNovoItemForm(prev => ({ ...prev, imagemUrl: event.target.result }));
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                      <label htmlFor="file-upload-global-mb" className="cg-dropzone-label">
                        <i className="fas fa-file-image"></i>
                        <strong>{novoItemForm.imagemUrl ? '✓ Imagem Carregada (Clique para trocar)' : 'Clique para selecionar a imagem do Computador'}</strong>
                        <small>
                          {novoItemForm.categoria === 'Parede' || novoItemForm.categoria === 'Piso' || novoItemForm.categoria === 'Ambiente'
                            ? 'Fotografias em JPG/WebP ou textura de alta qualidade'
                            : 'Formato PNG com fundo transparente para sobreposição realista'}
                        </small>
                      </label>
                    </div>
                  </div>

                  {novoItemForm.imagemUrl && (
                    <div className="cg-preview-box" style={{ flex: '0 0 160px', margin: 0 }}>
                      <span className="cg-preview-label">Pré-visualização:</span>
                      <div className={`cg-preview-checkerboard ${novoItemForm.categoria === 'Parede' || novoItemForm.categoria === 'Piso' || novoItemForm.categoria === 'Ambiente' ? 'is-photo-mode' : ''}`} style={{ height: '110px' }}>
                        <img src={novoItemForm.imagemUrl} alt="Preview" style={{ maxHeight: '100px' }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="cg-modal-footer">
                <button type="button" className="cg-btn-cancel" onClick={() => setModalNovoItemAberto(false)}>
                  Cancelar
                </button>
                <button type="submit" className="cg-btn-save" disabled={salvandoItemMoodboard}>
                  {salvandoItemMoodboard ? <><i className="fas fa-spinner fa-spin"></i> Salvando...</> : <><i className="fas fa-check"></i> Publicar Oficial Global</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✏️ MODAL: EDIÇÃO RÁPIDA DE ELEMENTO MOODBOARD */}
      {modalEdicaoItemAberto && itemEmEdicao && (
        <div className="cg-modal-overlay" onClick={() => setModalEdicaoItemAberto(false)}>
          <div className="cg-modal-content cg-modal-upload-moodboard" onClick={e => e.stopPropagation()} style={{ maxWidth: '840px', width: '95%' }}>
            <div className="cg-modal-header">
              <h2><i className="fas fa-edit"></i> Edição Rápida do Elemento</h2>
              <button className="cg-modal-close" onClick={() => setModalEdicaoItemAberto(false)}>✕</button>
            </div>

            <form onSubmit={handleSalvarEdicaoItem}>
              <div className="cg-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div className="cg-preview-checkerboard" style={{ width: '90px', height: '90px', flexShrink: 0, padding: '4px' }}>
                    <img src={itemEmEdicao.imagemUrl} alt="Item" style={{ maxHeight: '80px' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="cg-form-label">Nome do Elemento:</label>
                    <input 
                      type="text" 
                      className="cg-form-input" 
                      required 
                      value={itemEmEdicao.nome} 
                      onChange={e => setItemEmEdicao({ ...itemEmEdicao, nome: e.target.value })}
                    />
                  </div>
                </div>

                <div className="cg-form-row-2">
                  <div className="cg-form-group">
                    <label className="cg-form-label">Categoria:</label>
                    <select 
                      className="cg-form-select" 
                      value={itemEmEdicao.categoria}
                      onChange={e => setItemEmEdicao({ ...itemEmEdicao, categoria: e.target.value })}
                    >
                      <option value="Parede">🧱 Fundo de Parede</option>
                      <option value="Piso">🪵 Fundo de Piso / Chão</option>
                      <option value="Ambiente">🏞️ Ambiente Inteiro / Salão</option>
                      <option value="Baloes">🎈 Balões & Arcos</option>
                      <option value="Paineis">🏛️ Painéis & Estruturas</option>
                      <option value="Flores">🌸 Flores & Folhagens</option>
                      <option value="Moveis">🛋️ Móveis & Mesas</option>
                      <option value="Letreiros">✨ LED & Letreiros</option>
                      <option value="Texturas">🪵 Texturas & Materiais</option>
                      <option value="Outros">📦 Outros Acessórios</option>
                    </select>
                  </div>

                  <div className="cg-form-group">
                    <label className="cg-form-label">Tag / Subtipo:</label>
                    <input 
                      type="text" 
                      className="cg-form-input" 
                      placeholder="Ex: Ripado, Madeira, Janela, Rose Gold..." 
                      value={itemEmEdicao.tag} 
                      onChange={e => setItemEmEdicao({ ...itemEmEdicao, tag: e.target.value })}
                    />
                  </div>
                </div>

                {/* Subtipos rápidos na edição */}
                {itemEmEdicao.categoria === 'Parede' && (
                  <div className="cg-contextual-subtype-box">
                    <label className="cg-form-label"><i className="fas fa-th-large"></i> Subtipo de Parede:</label>
                    <div className="cg-subtype-chips-grid">
                      {SUBTIPOS_PAREDE.map(sub => (
                        <button
                          key={sub.tag}
                          type="button"
                          className={`cg-subtype-btn ${itemEmEdicao.tag === sub.tag ? 'active' : ''}`}
                          onClick={() => setItemEmEdicao({ ...itemEmEdicao, tag: sub.tag })}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {itemEmEdicao.categoria === 'Piso' && (
                  <div className="cg-contextual-subtype-box">
                    <label className="cg-form-label"><i className="fas fa-layer-group"></i> Subtipo de Chão / Piso:</label>
                    <div className="cg-subtype-chips-grid">
                      {SUBTIPOS_PISO.map(sub => (
                        <button
                          key={sub.tag}
                          type="button"
                          className={`cg-subtype-btn ${itemEmEdicao.tag === sub.tag ? 'active' : ''}`}
                          onClick={() => setItemEmEdicao({ ...itemEmEdicao, tag: sub.tag })}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {itemEmEdicao.categoria === 'Ambiente' && (
                  <div className="cg-contextual-subtype-box">
                    <label className="cg-form-label"><i className="fas fa-image"></i> Subtipo de Ambiente:</label>
                    <div className="cg-subtype-chips-grid">
                      {SUBTIPOS_AMBIENTE.map(sub => (
                        <button
                          key={sub.tag}
                          type="button"
                          className={`cg-subtype-btn ${itemEmEdicao.tag === sub.tag ? 'active' : ''}`}
                          onClick={() => setItemEmEdicao({ ...itemEmEdicao, tag: sub.tag })}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {itemEmEdicao.categoria !== 'Parede' && itemEmEdicao.categoria !== 'Piso' && itemEmEdicao.categoria !== 'Ambiente' && (
                  <SeletorCoresModal 
                    coresSelecionadas={itemEmEdicao.cores || []}
                    onToggleCor={(corId) => {
                      const cur = itemEmEdicao.cores || [];
                      const updated = cur.includes(corId) ? cur.filter(x => x !== corId) : [...cur, corId];
                      setItemEmEdicao({ ...itemEmEdicao, cores: updated });
                    }}
                    onLimpar={() => setItemEmEdicao({ ...itemEmEdicao, cores: [] })}
                  />
                )}
              </div>

              <div className="cg-modal-footer">
                <button type="button" className="cg-btn-cancel" onClick={() => setModalEdicaoItemAberto(false)}>
                  Cancelar
                </button>
                <button type="submit" className="cg-btn-save" disabled={salvandoEdicaoItem}>
                  {salvandoEdicaoItem ? <><i className="fas fa-spinner fa-spin"></i> Salvando...</> : <><i className="fas fa-check"></i> Salvar Alterações</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ControleGeral;
