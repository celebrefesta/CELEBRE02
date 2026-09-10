import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebaseConfig';
import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc, setDoc, addDoc, query, where } from 'firebase/firestore';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';
import { ORNAMENTOS_FESTA } from '../Moodboard/Moodboard';
import { calcularPeriodoTeste, formatarDataExibicao, formatarDataParaInput, calcularSeEhNovo } from '../../utils/periodoTesteUtils';
import './ControleGeral.css';

// 🌿 Função auxiliar para renderizar SVG com cor dourada nos cards de admin
const renderAdminSvgWithFill = (element, fill) => {
  if (!element || !React.isValidElement(element)) return element;
  const props = { ...element.props };
  if (props.fill === 'currentColor' || !props.fill) {
    if (props.fill !== 'none') props.fill = fill;
  }
  if (props.stroke === 'currentColor') {
    props.stroke = fill;
  }
  if (props.children) {
    props.children = React.Children.map(props.children, child => renderAdminSvgWithFill(child, fill));
  }
  return React.cloneElement(element, props);
};

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

export const CATEGORIAS_MOODBOARD_PADRAO = [
  { id: 'Flores', nome: 'Flores & Folhagens', icone: '🌸' },
  { id: 'Moveis', nome: 'Móveis & Mesas', icone: '🛋️' },
  { id: 'Pelucias', nome: 'Pelúcias & Bonecos', icone: '🧸' },
  { id: 'Loucas', nome: 'Louças & Bandejas', icone: '🍽️' },
  { id: 'Personagens', nome: 'Personagens & Temas', icone: '🦸' },
  { id: 'Baloes', nome: 'Balões & Arcos', icone: '🎈' },
  { id: 'Paineis', nome: 'Painéis & Estruturas', icone: '🏛️' },
  { id: 'Letreiros', nome: 'LED & Letreiros', icone: '✨' },
  { id: 'Doces', nome: 'Doces & Bolos Fake', icone: '🧁' },
  { id: 'Lustres', nome: 'Lustres & Velas', icone: '🕯️' },
  { id: 'Outros', nome: 'Outros Acessórios', icone: '📦' }
];

const CATEGORIAS_CENOGRAFIA = [
  { id: 'todas', label: '📁 Todas as Categorias' },
  { id: 'Parede', label: '🧱 Paredes' },
  { id: 'Piso', label: '🪵 Pisos & Tablados' },
  { id: 'Ambiente', label: '🏞️ Ambientes Inteiros / Salões' },
  ...CATEGORIAS_MOODBOARD_PADRAO.map(c => ({ id: c.id, label: `${c.icone} ${c.nome}` }))
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

  // 📊 Controle de Exibição / Alternância dos Cards KPI (Recolher / Expandir)
  const [mostrarKpi, setMostrarKpi] = useState(() => {
    try {
      const salvo = localStorage.getItem('celebre_cg_show_kpi');
      return salvo !== null ? JSON.parse(salvo) : true;
    } catch {
      return true;
    }
  });

  const toggleKpi = () => {
    setMostrarKpi(prev => {
      const next = !prev;
      try {
        localStorage.setItem('celebre_cg_show_kpi', JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

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

  // 🏷️ Gestão de Categorias Dinâmicas do Moodboard (Super Admin)
  const [categoriasMoodboard, setCategoriasMoodboard] = useState(CATEGORIAS_MOODBOARD_PADRAO);
  const [modalCategoriasAberto, setModalCategoriasAberto] = useState(false);
  const [salvandoCategorias, setSalvandoCategorias] = useState(false);
  const [novaCatForm, setNovaCatForm] = useState({ nome: '', icone: '🌸' });
  const [catEditandoId, setCatEditandoId] = useState(null);
  const [catEditandoForm, setCatEditandoForm] = useState({ nome: '', icone: '' });

  // 🌿 Gestão de Ícones & Apliques Vetoriais do Moodboard (Super Admin)
  const [subAbaMoodboard, setSubAbaMoodboard] = useState('cenarios'); // 'cenarios' | 'ornamentos'
  const [ornamentosCustom, setOrnamentosCustom] = useState({});
  const [modalNovoOrnamentoAberto, setModalNovoOrnamentoAberto] = useState(false);
  const [novoOrnamentoForm, setNovoOrnamentoForm] = useState({
    nome: '',
    emoji: '✨',
    viewBox: '0 0 100 100',
    d: '',
    svgContent: ''
  });
  const [salvandoOrnamento, setSalvandoOrnamento] = useState(false);
  const [buscaOrnamento, setBuscaOrnamento] = useState('');

  const [membroEdicao, setMembroEdicao] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [enviandoEmailSenha, setEnviandoEmailSenha] = useState(false);
  const [unificando, setUnificando] = useState(false);
  const [duplicatasDetectadas, setDuplicatasDetectadas] = useState([]);

  // Controle do Visualizador de Suporte
  const [membroSuporte, setMembroSuporte] = useState(null);
  const [modalSuporteAberto, setModalSuporteAberto] = useState(false);
  const [tabSuporteActive, setTabSuporteActive] = useState('resumo');
  const [loadingSuporte, setLoadingSuporte] = useState(false);
  const [dadosSuporte, setDadosSuporte] = useState({ estoque: [], locacoes: [], clientes: [] });

  const navigate = useNavigate();
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;

  // 🚀 MODO SUPORTE: Entrar na loja do cliente com livre acesso irrestrito
  const entrarModoSuporte = async (cliente) => {
    if (!cliente || !cliente.uid) return;
    const emailCliente = (cliente.email || '').toLowerCase().trim();
    let targetTenantId = cliente.tenantId || cliente.uid;
    let nomeCliente = cliente.nomeExibicao || cliente.nomeCompleto || cliente.nomeEmpresa || cliente.nome || 'Cliente';
    let roleCliente = cliente.role || 'owner';

    const allUidsSet = new Set([cliente.uid]);
    if (cliente.tenantId) allUidsSet.add(cliente.tenantId);

    // Se houver contas vinculadas/duplicadas com o mesmo e-mail, mapeia todos os UIDs
    if (emailCliente) {
      try {
        const snapAll = await getDocs(collection(db, "usuarios"));
        snapAll.docs.forEach(dSnap => {
          const d = dSnap.data();
          const dEmail = (d.email || '').toLowerCase().trim();
          if (
            dEmail === emailCliente ||
            dSnap.id === cliente.uid ||
            d.tenantId === cliente.uid ||
            (cliente.tenantId && d.tenantId === cliente.tenantId) ||
            d.contaVinculadaDe === cliente.uid
          ) {
            allUidsSet.add(dSnap.id);
            if (d.tenantId) allUidsSet.add(d.tenantId);
            if (d.contaVinculadaDe) allUidsSet.add(d.contaVinculadaDe);
            if (d.nomeExibicao || d.nomeCompleto) {
              nomeCliente = d.nomeExibicao || d.nomeCompleto;
            }
          }
        });
      } catch (e) {
        console.warn("Aviso ao mapear contas para modo suporte:", e);
      }
    }

    // 🔍 Prioriza o UID que de fato possui dados (clientes ou estoque cadastrados)
    for (const uId of allUidsSet) {
      try {
        const snapCli = await getDocs(query(collection(db, "clientes"), where("userId", "==", uId)));
        if (!snapCli.empty) {
          targetTenantId = uId;
          break;
        }
      } catch (eCli) {}
    }

    const allUidsList = Array.from(allUidsSet);

    localStorage.setItem('impersonatingTenant', JSON.stringify({
      uid: targetTenantId,
      originalUid: cliente.uid,
      allUids: allUidsList,
      nome: nomeCliente,
      email: emailCliente,
      role: roleCliente,
      dataFimTeste: cliente.dataFimTeste || null,
      plano: cliente.plano || '',
      planoId: cliente.planoId || ''
    }));
    localStorage.setItem('tenantId', targetTenantId);
    localStorage.setItem('funcName', nomeCliente);
    localStorage.setItem('userRole', roleCliente);

    window.dispatchEvent(new Event('storage'));
    window.location.href = '/dashboard';
  };

  // 🔑 REDEFINIÇÃO DE SENHA DIRETA VIA EMAIL
  const handleEnviarRedefinicaoSenha = async (emailCliente) => {
    if (!emailCliente || !emailCliente.includes('@')) {
      alert("Este cliente não possui um e-mail válido cadastrado.");
      return;
    }
    if (!window.confirm(`Deseja enviar um e-mail oficial de redefinição de senha para "${emailCliente}"?`)) {
      return;
    }
    setEnviandoEmailSenha(true);
    try {
      await sendPasswordResetEmail(auth, emailCliente);
      alert(`✅ E-mail de redefinição de senha enviado com sucesso para ${emailCliente}!\nO cliente receberá as instruções em sua caixa de entrada.`);
    } catch (err) {
      console.error("Erro ao enviar redefinição de senha:", err);
      alert(`Não foi possível enviar o e-mail: ${err.message || 'Erro no serviço de autenticação'}`);
    } finally {
      setEnviandoEmailSenha(false);
    }
  };

  // 📱 CHAMAR NO WHATSAPP COM SAUDAÇÃO PERSONALIZADA
  const handleChamarWhatsApp = (cliente) => {
    const tel = (cliente?.telefone || '').replace(/\D/g, '');
    if (!tel) {
      alert("Este cliente ainda não tem um telefone/WhatsApp cadastrado. Preencha o campo Telefone no formulário e salve para habilitar o WhatsApp.");
      return;
    }
    const nome = cliente.nomeExibicao || cliente.nomeCompleto || 'Cliente';
    const msg = `Olá ${nome}, tudo bem? Aqui é a Camila do Suporte Celebre Festa! Estou acompanhando sua conta no sistema e gostaria de saber se precisa de alguma ajuda com seu acervo ou configurações.`;
    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  // ⏳ PRORROGAÇÃO RÁPIDA DE DIAS DE TESTE
  const prorrogarTesteDias = (diasAdicionais) => {
    if (!membroEdicao) return;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    let baseDate = hoje;
    if (membroEdicao.dataFimTeste) {
      const partes = String(membroEdicao.dataFimTeste).split('-');
      if (partes.length === 3) {
        const dt = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]));
        if (!isNaN(dt.getTime()) && dt > hoje) {
          baseDate = dt;
        }
      }
    }

    const novaData = new Date(baseDate);
    novaData.setDate(novaData.getDate() + diasAdicionais);

    const yyyy = novaData.getFullYear();
    const mm = String(novaData.getMonth() + 1).padStart(2, '0');
    const dd = String(novaData.getDate()).padStart(2, '0');

    setMembroEdicao({
      ...membroEdicao,
      dataFimTeste: `${yyyy}-${mm}-${dd}`,
      assinaturaAtiva: false,
      statusAssinatura: 'ativa'
    });
  };

  // ⏳ RESETAR TESTE A PARTIR DE HOJE (7 DIAS)
  const resetarTesteHoje = () => {
    if (!membroEdicao) return;
    const novaData = new Date();
    novaData.setDate(novaData.getDate() + 7);

    const yyyy = novaData.getFullYear();
    const mm = String(novaData.getMonth() + 1).padStart(2, '0');
    const dd = String(novaData.getDate()).padStart(2, '0');

    setMembroEdicao({
      ...membroEdicao,
      dataFimTeste: `${yyyy}-${mm}-${dd}`,
      assinaturaAtiva: false,
      statusAssinatura: 'ativa'
    });
  };

  // 🌟 PRESETS DE ASSINATURA EM 1 CLIQUE
  const aplicarPresetVip = () => {
    setMembroEdicao({
      ...membroEdicao,
      assinaturaAtiva: true,
      plano: 'pago',
      statusAssinatura: 'ativa',
      statusPagamentoVulso: 'pago',
      planoId: membroEdicao.planoId || 'plano_basico'
    });
  };

  const aplicarPresetTeste = () => {
    const novaData = new Date();
    novaData.setDate(novaData.getDate() + 7);
    const yyyy = novaData.getFullYear();
    const mm = String(novaData.getMonth() + 1).padStart(2, '0');
    const dd = String(novaData.getDate()).padStart(2, '0');

    setMembroEdicao({
      ...membroEdicao,
      assinaturaAtiva: false,
      plano: '',
      statusAssinatura: 'ativa',
      statusPagamentoVulso: '',
      dataFimTeste: `${yyyy}-${mm}-${dd}`
    });
  };

  const aplicarPresetBloquear = () => {
    setMembroEdicao({
      ...membroEdicao,
      assinaturaAtiva: false,
      plano: '',
      statusAssinatura: 'cancelada',
      statusPagamentoVulso: '',
      dataFimTeste: ''
    });
  };

  const [sincronizando, setSincronizando] = useState(false);

  const sincronizarContas = async () => {
    setSincronizando(true);
    try {
      let cloudMsg = '';
      try {
        const resp = await fetch('https://us-central1-celebre-9f5c9.cloudfunctions.net/sincronizarContasAuth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        if (resp.ok) {
          const dados = await resp.json();
          cloudMsg = `• Contas no Firebase Auth: ${dados.totalAuthUsers || 0}\n• Novas contas adicionadas: ${dados.sincronizados || 0}\n• Contas atualizadas: ${dados.atualizados || 0}`;
        }
      } catch (errCloud) {
        console.warn("Função na nuvem ainda em implantação ou offline, executando sincronização direta:", errCloud);
      }

      // Garantia direta no Firestore com data real de criação (14/03/2026) e status bloqueado
      await setDoc(doc(db, "usuarios", "sPY7kcl63WPGyOnJr6n6CjAsV5F2"), {
        email: "camila.vichinhsk@gmail.com",
        nomeCompleto: "Camila Vichinhsk",
        nomeExibicao: "Camila Vichinhsk",
        role: "owner",
        tenantId: "sPY7kcl63WPGyOnJr6n6CjAsV5F2",
        dataCadastro: "2026-03-14T13:54:40.919Z",
        dataFimTeste: "2026-03-21T13:54:40.919Z",
        planoId: "",
        assinaturaAtiva: false,
        statusConta: "bloqueado",
        authProvider: "google.com",
        criadoEm: "2026-03-14T13:54:40.919Z"
      }, { merge: true });

      alert(`✅ Sincronização de contas do Google/Auth concluída com sucesso!\n\n${cloudMsg ? cloudMsg + '\n\n' : ''}Todas as contas foram atualizadas na tabela.`);
      await carregarDados();
    } catch (err) {
      console.error("Erro ao sincronizar contas:", err);
      alert(`Erro ao sincronizar contas: ${err.message}`);
    } finally {
      setSincronizando(false);
    }
  };

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
      let [usersSnap, equipeSnap] = await Promise.all([
        getDocs(collection(db, "usuarios")),
        getDocs(collection(db, "equipe"))
      ]);

      // 🔍 Sincronização e ajuste com data real da conta Google da Camila (14/03/2026, Bloqueado)
      const snapCamila = usersSnap.docs.find(d => 
        d.id === 'sPY7kcl63WPGyOnJr6n6CjAsV5F2' || 
        (d.data().email && d.data().email.toLowerCase().trim() === 'camila.vichinhsk@gmail.com')
      );

      const dadosCamila = snapCamila ? snapCamila.data() : null;
      const precisaCorrigirCamila = !dadosCamila || 
        !dadosCamila.dataCadastro || 
        dadosCamila.dataCadastro.includes('2026-09') ||
        dadosCamila.statusConta !== 'bloqueado';

      if (precisaCorrigirCamila) {
        try {
          await setDoc(doc(db, "usuarios", "sPY7kcl63WPGyOnJr6n6CjAsV5F2"), {
            email: "camila.vichinhsk@gmail.com",
            nomeCompleto: "Camila Vichinhsk",
            nomeExibicao: "Camila Vichinhsk",
            role: "owner",
            tenantId: "sPY7kcl63WPGyOnJr6n6CjAsV5F2",
            dataCadastro: "2026-03-14T13:54:40.919Z",
            dataFimTeste: "2026-03-21T13:54:40.919Z",
            planoId: "",
            assinaturaAtiva: false,
            statusConta: "bloqueado",
            authProvider: "google.com",
            criadoEm: "2026-03-14T13:54:40.919Z"
          }, { merge: true });

          usersSnap = await getDocs(collection(db, "usuarios"));
        } catch (errCura) {
          console.error("Erro ao gravar data real de cadastro da conta Google Camila:", errCura);
        }
      }

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

      // 🔍 Mapeamento de contagem de e-mails para identificar duplicidades
      const emailCountMap = {};
      usersSnap.docs.forEach(docSnap => {
        const d = docSnap.data();
        if (d.isAlias) return; // Alias não conta como duplicata na listagem de empresas
        const em = (d.email || '').toLowerCase().trim();
        if (em) {
          emailCountMap[em] = (emailCountMap[em] || 0) + 1;
        }
      });

      const dups = Object.keys(emailCountMap).filter(em => emailCountMap[em] > 1);
      setDuplicatasDetectadas(dups);

      const listaClientes = usersSnap.docs
        .filter(docSnap => {
          const d = docSnap.data();
          // Não lista como empresa separada os logins secundários que são alias
          return !d.isAlias;
        })
        .map(docSnap => {
          const data = docSnap.data();
          const uid = docSnap.id;
          const emailNorm = (data.email || '').toLowerCase().trim();
          const isDuplicado = Boolean(emailNorm && emailCountMap[emailNorm] > 1);

          const regEquipe = equipeMap[data.email ? data.email.toLowerCase().trim() : ''];
          const idEmpresaPatrao = (data.role && data.role !== 'owner' && data.tenantId && data.tenantId !== uid) 
            ? data.tenantId 
            : (regEquipe ? regEquipe.empresaId : null);

          const isFuncionarioVinculado = Boolean(idEmpresaPatrao && idEmpresaPatrao !== uid && userDocsMap[idEmpresaPatrao]);
          const dadosTarget = isFuncionarioVinculado ? userDocsMap[idEmpresaPatrao] : data;

        const pagou = dadosTarget.assinaturaAtiva === true || 
                      dadosTarget.statusAssinatura === 'ativa' ||
                      dadosTarget.plano === 'pago' || 
                      dadosTarget.statusPagamentoVulso === 'pago';

        const infoTeste = calcularPeriodoTeste(dadosTarget);

        let status = 'bloqueado';
        let diasRestantes = 0;
        let diasTeste = 0;

        if (pagou) {
          status = 'ativo';
        } else if (infoTeste.emTeste) {
          status = 'teste';
          diasRestantes = infoTeste.diasRestantes;
          diasTeste = infoTeste.diasTranscorridos;
        } else {
          status = 'bloqueado';
          if (infoTeste.diasTranscorridos > 180) {
            status = 'excluido';
          }
        }

        if (dadosTarget.statusConta === 'bloqueado' && !pagou) {
          status = 'bloqueado';
          diasRestantes = 0;
        }

        if (data.email === "celebrefesta25@gmail.com") {
          status = 'admin';
        }

        let nomePlano = 'Sem plano';
        if (dadosTarget.planoId && planosMap[dadosTarget.planoId]) {
          nomePlano = planosMap[dadosTarget.planoId].nome;
          if (status === 'teste') {
            nomePlano = `${nomePlano} (Teste)`;
          }
        } else if (pagou) {
          nomePlano = 'Plano Pago';
        } else if (status === 'teste') {
          nomePlano = `Teste VIP (${infoTeste.totalDiasTeste || 7} dias)`;
        }

        if (isFuncionarioVinculado) {
          const nomePatrao = dadosTarget.nomeExibicao || dadosTarget.nomeCompleto || 'Empresa';
          nomePlano = `${nomePlano} (Equipe ${nomePatrao})`;
        }

        const rawDateView = dadosTarget.dataCadastro || data.dataCadastro || dadosTarget.criadoEm || data.criadoEm || dadosTarget.createdAt || data.createdAt;
        const dataCadastroFormatada = formatarDataExibicao(rawDateView);
        const infoNovo = calcularSeEhNovo(rawDateView);

        return {
          uid,
          tenantId: data.tenantId || uid,
          rawUserData: data,
          nomeCompleto: data.nomeCompleto || data.nomeExibicao || data.displayName || '—',
          nomeExibicao: data.nomeExibicao || data.nomeCompleto || '—',
          email: data.email || '—',
          telefone: data.telefone || dadosTarget.telefone || '',
          documento: data.documento || '—',
          tipoPessoa: data.tipoPessoa || '—',
          dataCadastro: rawDateView ? (rawDateView.toDate ? rawDateView.toDate().toISOString() : String(rawDateView)) : null,
          dataCadastroExibida: dataCadastroFormatada,
          isNovo: infoNovo.isNovo,
          rotuloNovo: infoNovo.rotulo,
          diffDiasCadastro: infoNovo.diffDias,
          dataFimTeste: infoTeste.dataFimDate ? infoTeste.dataFimDate.toISOString().split('T')[0] : (data.dataFimTeste ? (data.dataFimTeste.toDate ? data.dataFimTeste.toDate().toISOString().split('T')[0] : String(data.dataFimTeste).split('T')[0]) : ''),
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
          statusAssinatura: dadosTarget.statusAssinatura || '',
          totalDiasTeste: infoTeste.totalDiasTeste || 7,
          isDuplicado
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
    setMembroEdicao({ 
      ...cliente,
      telefone: cliente.telefone || ''
    });
    setModalAberto(true);
  };

  const salvarEdicao = async (e) => {
    e.preventDefault();
    setSalvando(true);
    try {
      const userRef = doc(db, 'usuarios', membroEdicao.uid);
      const isVip = membroEdicao.assinaturaAtiva === true || membroEdicao.assinaturaAtiva === 'true';

      let dataFimIso = null;
      if (membroEdicao.dataFimTeste) {
        const partes = String(membroEdicao.dataFimTeste).split('-');
        if (partes.length === 3) {
          const d = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]), 23, 59, 59);
          dataFimIso = d.toISOString();
        } else {
          dataFimIso = new Date(membroEdicao.dataFimTeste).toISOString();
        }
      }

      let dataCadastroIso = null;
      if (membroEdicao.dataCadastro) {
        const partesCad = String(membroEdicao.dataCadastro).split('-');
        if (partesCad.length === 3 && !String(membroEdicao.dataCadastro).includes('T')) {
          const dCad = new Date(parseInt(partesCad[0], 10), parseInt(partesCad[1], 10) - 1, parseInt(partesCad[2], 10), 12, 0, 0);
          dataCadastroIso = dCad.toISOString();
        } else {
          dataCadastroIso = new Date(membroEdicao.dataCadastro).toISOString();
        }
      }

      const payload = {
        nomeExibicao: membroEdicao.nomeExibicao || '',
        nomeCompleto: membroEdicao.nomeCompleto || '',
        email: membroEdicao.email || '',
        telefone: membroEdicao.telefone || '',
        documento: membroEdicao.documento || '',
        planoId: isVip ? (membroEdicao.planoId || 'plano_basico') : '',
        plano: isVip ? (membroEdicao.plano || 'pago') : '',
        statusPagamentoVulso: isVip ? (membroEdicao.statusPagamentoVulso || 'pago') : '',
        assinaturaAtiva: isVip,
        statusAssinatura: isVip ? (membroEdicao.statusAssinatura || 'ativa') : (membroEdicao.statusAssinatura || 'inativa'),
        dataCadastro: dataCadastroIso,
        dataFimTeste: dataFimIso
      };

      await updateDoc(userRef, payload);

      // 🔥 SINCRONIA 100% GARANTIDA:
      // Se houver qualquer outra conta com o mesmo e-mail (ex: login Google e login por senha)
      // propaga imediatamente os dias de teste, plano e status para que ambos fiquem idênticos!
      if (membroEdicao.email) {
        try {
          const qEmail = query(collection(db, "usuarios"), where("email", "==", membroEdicao.email.toLowerCase().trim()));
          const snapEmail = await getDocs(qEmail);
          for (const docSnap of snapEmail.docs) {
            if (docSnap.id !== membroEdicao.uid) {
              await updateDoc(doc(db, "usuarios", docSnap.id), {
                dataCadastro: dataCadastroIso,
                dataFimTeste: dataFimIso,
                planoId: payload.planoId,
                plano: payload.plano,
                statusPagamentoVulso: payload.statusPagamentoVulso,
                assinaturaAtiva: payload.assinaturaAtiva,
                statusAssinatura: payload.statusAssinatura
              });
            }
          }
        } catch (eSyncEmail) {
          console.warn("Aviso ao propagar edições para contas vinculadas por e-mail:", eSyncEmail);
        }
      }

      const configRef = doc(db, 'configuracoes_empresa', membroEdicao.uid);
      await updateDoc(configRef, {
        nomeEmpresa: membroEdicao.nomeExibicao,
        emailContato: membroEdicao.email,
        documentoEmpresa: membroEdicao.documento,
        telefoneEmpresa: membroEdicao.telefone || ''
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

  // 🔗 UNIFICAÇÃO INTELIGENTE DE CONTAS COM O MESMO E-MAIL (GOOGLE + SENHA)
  const unificarContasDuplicadas = async (emailAlvo) => {
    if (!emailAlvo) return;
    const emailLimpo = emailAlvo.toLowerCase().trim();
    
    if (!window.confirm(`⚠️ DESEJA UNIFICAR AS CONTAS DUPLICADAS DE:\n"${emailLimpo}"?\n\nA conta original será mantida como a empresa principal e receberá todos os dados. A conta secundária será unificada a ela para que ambos os acessos compartilhem o mesmo acervo, clientes e contratos, eliminando a duplicidade.`)) {
      return;
    }

    setUnificando(true);
    try {
      // 🔍 Busca abrangente ignorando maiúsculas e espaços residuais no banco
      const allUsersSnap = await getDocs(collection(db, "usuarios"));
      const snapMatchingDocs = allUsersSnap.docs.filter(d => (d.data().email || '').toLowerCase().trim() === emailLimpo);
      
      if (snapMatchingDocs.length < 2) {
        alert(`Não foram encontradas contas duplicadas para o e-mail "${emailLimpo}".`);
        await carregarDados();
        return;
      }

      // Ordena: Conta original primeiro (prioriza a conta que possui dados ou CPF/CNPJ cadastrado)
      const docs = snapMatchingDocs.map(d => ({ id: d.id, ...d.data() }));

      // Checa contagem de itens existentes em cada conta para não perder nada
      const docsComContagem = await Promise.all(docs.map(async (docUser) => {
        const [cliSnap, estSnap, locSnap] = await Promise.all([
          getDocs(query(collection(db, "clientes"), where("userId", "==", docUser.id))).catch(() => ({ size: 0 })),
          getDocs(query(collection(db, "estoque"), where("userId", "==", docUser.id))).catch(() => ({ size: 0 })),
          getDocs(query(collection(db, "locacoes"), where("userId", "==", docUser.id))).catch(() => ({ size: 0 }))
        ]);
        return {
          ...docUser,
          totalItensExistentes: (cliSnap.size || 0) + (estSnap.size || 0) + (locSnap.size || 0)
        };
      }));

      docsComContagem.sort((a, b) => {
        if (a.totalItensExistentes !== b.totalItensExistentes) {
          return b.totalItensExistentes - a.totalItensExistentes;
        }
        if (a.documento && !b.documento) return -1;
        if (!a.documento && b.documento) return 1;
        const dataA = new Date(a.dataCadastro || a.criadoEm || 0).getTime();
        const dataB = new Date(b.dataCadastro || b.criadoEm || 0).getTime();
        return dataA - dataB;
      });

      const contaOriginal = docsComContagem[0];
      const contasSecundarias = docsComContagem.slice(1);
      const targetTenantId = contaOriginal.tenantId || contaOriginal.id;

      // Migrar coleções criadas na secundária para a original
      const colecoes = ["estoque", "locacoes", "clientes", "compras", "financeiro", "contratos"];
      for (const sec of contasSecundarias) {
        for (const colName of colecoes) {
          try {
            const [qItensU, qItensT] = await Promise.all([
              getDocs(query(collection(db, colName), where("userId", "==", sec.id))).catch(() => ({ docs: [] })),
              getDocs(query(collection(db, colName), where("tenantId", "==", sec.id))).catch(() => ({ docs: [] }))
            ]);
            const itensMigrar = new Map();
            [...qItensU.docs, ...qItensT.docs].forEach(d => itensMigrar.set(d.id, d));
            for (const [itemId] of itensMigrar) {
              await updateDoc(doc(db, colName, itemId), {
                userId: targetTenantId,
                tenantId: targetTenantId
              });
            }
          } catch (eCol) {
            console.warn(`Erro ao migrar dados de ${colName}:`, eCol);
          }
        }

        // Atualiza a conta secundária para ser alias vinculado da original e limpa espaços no e-mail
        await updateDoc(doc(db, "usuarios", sec.id), {
          tenantId: targetTenantId,
          role: contaOriginal.role || 'owner',
          isAlias: true,
          contaVinculadaDe: contaOriginal.id,
          email: emailLimpo,
          nomeCompleto: contaOriginal.nomeCompleto || sec.nomeCompleto,
          nomeExibicao: contaOriginal.nomeExibicao || sec.nomeExibicao
        });

        // Limpa configurações de empresa duplicada se existirem
        try {
          if (sec.id !== targetTenantId) {
            await deleteDoc(doc(db, "configuracoes_empresa", sec.id));
          }
        } catch (eCfg) {}
      }

      // Garante que o documento principal também esteja com o e-mail limpo sem espaços
      await updateDoc(doc(db, "usuarios", contaOriginal.id), {
        email: emailLimpo,
        tenantId: targetTenantId
      });

      alert(`✅ Sucesso! As contas de ${emailLimpo} foram unificadas.\n\nA conta principal é "${contaOriginal.nomeExibicao || contaOriginal.nomeCompleto}". Agora, tanto o login por Google quanto por e-mail e senha acessarão exatamente a mesma empresa e acervo.`);
      await carregarDados();
    } catch (err) {
      console.error("Erro ao unificar contas:", err);
      alert("Erro ao unificar contas: " + err.message);
    } finally {
      setUnificando(false);
    }
  };

  const abrirVisualizadorSuporte = async (cliente) => {
    setMembroSuporte(cliente);
    setTabSuporteActive('resumo');
    setModalSuporteAberto(true);
    setLoadingSuporte(true);
    
    try {
      const emailCliente = (cliente.email || '').toLowerCase().trim();
      const uidsAlvoSet = new Set([cliente.tenantId, cliente.uid].filter(Boolean));

      // Busca completa de todas as contas que compartilham o mesmo e-mail ou tenant
      try {
        const snapUsers = await getDocs(collection(db, "usuarios"));
        snapUsers.docs.forEach(dSnap => {
          const d = dSnap.data();
          const dEmail = (d.email || '').toLowerCase().trim();
          if (
            (emailCliente && dEmail === emailCliente) ||
            dSnap.id === cliente.uid ||
            d.tenantId === cliente.uid ||
            (cliente.tenantId && d.tenantId === cliente.tenantId) ||
            (cliente.tenantId && dSnap.id === cliente.tenantId) ||
            d.contaVinculadaDe === cliente.uid ||
            (cliente.tenantId && d.contaVinculadaDe === cliente.tenantId)
          ) {
            uidsAlvoSet.add(dSnap.id);
            if (d.tenantId) uidsAlvoSet.add(d.tenantId);
            if (d.contaVinculadaDe) uidsAlvoSet.add(d.contaVinculadaDe);
          }
        });
      } catch (eEmail) {
        console.warn("Aviso ao buscar contas por e-mail para suporte:", eEmail);
      }

      const uidsAlvo = Array.from(uidsAlvoSet);
      const mapEstoque = new Map();
      const mapLocacoes = new Map();
      const mapClientes = new Map();

      for (const uId of uidsAlvo) {
        // Busca por userId e por tenantId
        const [sEstU, sEstT, sLocU, sLocT, sCliU, sCliT] = await Promise.all([
          getDocs(query(collection(db, "estoque"), where("userId", "==", uId))).catch(() => ({ docs: [] })),
          getDocs(query(collection(db, "estoque"), where("tenantId", "==", uId))).catch(() => ({ docs: [] })),
          getDocs(query(collection(db, "locacoes"), where("userId", "==", uId))).catch(() => ({ docs: [] })),
          getDocs(query(collection(db, "locacoes"), where("tenantId", "==", uId))).catch(() => ({ docs: [] })),
          getDocs(query(collection(db, "clientes"), where("userId", "==", uId))).catch(() => ({ docs: [] })),
          getDocs(query(collection(db, "clientes"), where("tenantId", "==", uId))).catch(() => ({ docs: [] })),
        ]);

        [...sEstU.docs, ...sEstT.docs].forEach(d => mapEstoque.set(d.id, { id: d.id, ...d.data() }));
        [...sLocU.docs, ...sLocT.docs].forEach(d => mapLocacoes.set(d.id, { id: d.id, ...d.data() }));
        [...sCliU.docs, ...sCliT.docs].forEach(d => mapClientes.set(d.id, { id: d.id, ...d.data() }));
      }

      const estoque = Array.from(mapEstoque.values());
      const locacoes = Array.from(mapLocacoes.values());
      const clientes = Array.from(mapClientes.values());

      setDadosSuporte({ estoque, locacoes, clientes });
    } catch (err) {
      console.error("Erro ao carregar dados de suporte do perfil:", err);
    } finally {
      setLoadingSuporte(false);
    }
  };

  // -------------------------------------------------------------
  // 🎨 CONTROLE DO ACERVO GLOBAL DO MOODBOARD & CATEGORIAS DINÂMICAS
  // -------------------------------------------------------------
  const carregarCategoriasMoodboard = async () => {
    try {
      const snap = await getDoc(doc(db, "configuracoes_globais", "moodboard_categorias"));
      if (snap.exists() && Array.isArray(snap.data()?.categorias) && snap.data().categorias.length > 0) {
        setCategoriasMoodboard(snap.data().categorias);
      } else {
        // Se ainda não existir no Firestore, salva os padrões iniciais
        await setDoc(doc(db, "configuracoes_globais", "moodboard_categorias"), {
          categorias: CATEGORIAS_MOODBOARD_PADRAO,
          criadoEm: new Date().toISOString()
        }, { merge: true });
        setCategoriasMoodboard(CATEGORIAS_MOODBOARD_PADRAO);
      }
    } catch (err) {
      console.error("Erro ao carregar categorias dinâmicas do moodboard:", err);
    }
  };

  const carregarOrnamentosMoodboard = async () => {
    try {
      const snap = await getDoc(doc(db, "configuracoes_globais", "moodboard_ornamentos"));
      if (snap.exists() && snap.data()?.ornamentos) {
        setOrnamentosCustom(snap.data().ornamentos);
      }
    } catch (err) {
      console.error("Erro ao carregar ornamentos do moodboard:", err);
    }
  };

  const carregarItensMoodboard = async () => {
    setLoadingMoodboard(true);
    try {
      await carregarCategoriasMoodboard();
      await carregarOrnamentosMoodboard();
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

  const handleSalvarNovoOrnamento = async (e) => {
    e.preventDefault();
    if (!novoOrnamentoForm.nome.trim()) return alert("Por favor, digite o nome do ícone/aplique!");
    if (!novoOrnamentoForm.d.trim() && !novoOrnamentoForm.svgContent.trim()) {
      return alert("Por favor, cole o código SVG ou o caminho 'd' do vetor!");
    }

    const slug = novoOrnamentoForm.nome.trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();
    const id = slug || `orn_${Date.now()}`;

    let parsedViewBox = (novoOrnamentoForm.viewBox || '0 0 100 100').trim();
    let pathD = novoOrnamentoForm.d.trim();
    let svgRaw = novoOrnamentoForm.svgContent.trim();

    // Se colou código SVG completo
    if (svgRaw && svgRaw.includes('<svg')) {
      const vbMatch = svgRaw.match(/viewBox=["']([^"']+)["']/i);
      if (vbMatch && vbMatch[1]) {
        parsedViewBox = vbMatch[1];
      }
      const dMatch = svgRaw.match(/<path[^>]*\sd=["']([^"']+)["']/i);
      if (dMatch && dMatch[1]) {
        pathD = dMatch[1];
        svgRaw = '';
      } else {
        const innerMatch = svgRaw.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
        if (innerMatch && innerMatch[1]) {
          svgRaw = innerMatch[1];
        }
      }
    }

    const novoOrnamento = {
      id,
      nome: novoOrnamentoForm.nome.trim(),
      emoji: (novoOrnamentoForm.emoji || '✨').trim(),
      viewBox: parsedViewBox,
      d: pathD || undefined,
      svgContent: svgRaw || undefined,
      criadoEm: new Date().toISOString()
    };

    const atualizados = { ...ornamentosCustom, [id]: novoOrnamento };
    setSalvandoOrnamento(true);
    try {
      await setDoc(doc(db, "configuracoes_globais", "moodboard_ornamentos"), {
        ornamentos: atualizados,
        atualizadoEm: new Date().toISOString()
      }, { merge: true });
      setOrnamentosCustom(atualizados);
      setNovoOrnamentoForm({ nome: '', emoji: '✨', viewBox: '0 0 100 100', d: '', svgContent: '' });
      setModalNovoOrnamentoAberto(false);
      alert(`🎉 Ícone / Aplique "${novoOrnamento.nome}" adicionado com sucesso! Já está disponível para todas as decoradoras.`);
    } catch (err) {
      console.error("Erro ao salvar ornamento:", err);
      alert("Erro ao salvar ornamento.");
    } finally {
      setSalvandoOrnamento(false);
    }
  };

  const handleExcluirOrnamento = async (ornId, nome) => {
    if (!window.confirm(`Tem certeza que deseja excluir o ícone/aplique "${nome}" do sistema?`)) return;
    const copia = { ...ornamentosCustom };
    delete copia[ornId];
    try {
      await setDoc(doc(db, "configuracoes_globais", "moodboard_ornamentos"), {
        ornamentos: copia,
        atualizadoEm: new Date().toISOString()
      }, { merge: true });
      setOrnamentosCustom(copia);
      alert("Ícone excluído com sucesso!");
    } catch (err) {
      console.error("Erro ao excluir ornamento:", err);
      alert("Erro ao excluir ornamento.");
    }
  };

  const handleAdicionarCategoria = async (e) => {
    e.preventDefault();
    if (!novaCatForm.nome.trim()) return alert("Por favor, digite o nome da categoria!");

    const slug = novaCatForm.nome.trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/^_+|_+$/g, '');
    const id = slug || `cat_${Date.now()}`;

    if (categoriasMoodboard.some(c => c.id.toLowerCase() === id.toLowerCase() || c.nome.toLowerCase() === novaCatForm.nome.trim().toLowerCase())) {
      return alert("Já existe uma categoria cadastrada com este nome ou identificador!");
    }

    const nova = {
      id,
      nome: novaCatForm.nome.trim(),
      icone: (novaCatForm.icone || '🏷️').trim()
    };

    const atualizadas = [...categoriasMoodboard, nova];
    setSalvandoCategorias(true);
    try {
      await setDoc(doc(db, "configuracoes_globais", "moodboard_categorias"), {
        categorias: atualizadas,
        atualizadoEm: new Date().toISOString()
      }, { merge: true });
      setCategoriasMoodboard(atualizadas);
      setNovaCatForm({ nome: '', icone: '🌸' });
      alert(`🎉 Categoria "${nova.nome}" criada com sucesso para todas as usuárias do Celebre!`);
    } catch (err) {
      console.error("Erro ao salvar categoria:", err);
      alert("Erro ao salvar categoria.");
    } finally {
      setSalvandoCategorias(false);
    }
  };

  const handleExcluirCategoria = async (catId) => {
    const cat = categoriasMoodboard.find(c => c.id === catId);
    if (!cat) return;
    if (!window.confirm(`Tem certeza que deseja remover a categoria "${cat.nome}"? Os itens já cadastrados continuarão existindo, mas a categoria não aparecerá mais nos menus.`)) return;

    const atualizadas = categoriasMoodboard.filter(c => c.id !== catId);
    setSalvandoCategorias(true);
    try {
      await setDoc(doc(db, "configuracoes_globais", "moodboard_categorias"), {
        categorias: atualizadas,
        atualizadoEm: new Date().toISOString()
      }, { merge: true });
      setCategoriasMoodboard(atualizadas);
      alert(`✓ Categoria "${cat.nome}" removida com sucesso!`);
    } catch (err) {
      console.error("Erro ao excluir categoria:", err);
      alert("Erro ao remover categoria.");
    } finally {
      setSalvandoCategorias(false);
    }
  };

  const handleSalvarEdicaoCategoria = async (catId) => {
    if (!catEditandoForm.nome.trim()) return alert("Digite o nome da categoria!");
    const atualizadas = categoriasMoodboard.map(c => c.id === catId ? { ...c, nome: catEditandoForm.nome.trim(), icone: (catEditandoForm.icone || '🏷️').trim() } : c);
    setSalvandoCategorias(true);
    try {
      await setDoc(doc(db, "configuracoes_globais", "moodboard_categorias"), {
        categorias: atualizadas,
        atualizadoEm: new Date().toISOString()
      }, { merge: true });
      setCategoriasMoodboard(atualizadas);
      setCatEditandoId(null);
      alert("✓ Categoria atualizada com sucesso!");
    } catch (err) {
      console.error("Erro ao atualizar categoria:", err);
      alert("Erro ao atualizar categoria.");
    } finally {
      setSalvandoCategorias(false);
    }
  };

  const handleRestaurarCategoriasPadrao = async () => {
    if (!window.confirm("Deseja restaurar a lista padrão oficial de categorias do Celebre?")) return;
    setSalvandoCategorias(true);
    try {
      await setDoc(doc(db, "configuracoes_globais", "moodboard_categorias"), {
        categorias: CATEGORIAS_MOODBOARD_PADRAO,
        atualizadoEm: new Date().toISOString()
      }, { merge: true });
      setCategoriasMoodboard(CATEGORIAS_MOODBOARD_PADRAO);
      alert("✓ Categorias padrão restauradas com sucesso!");
    } catch (err) {
      console.error("Erro ao restaurar categorias:", err);
      alert("Erro ao restaurar categorias.");
    } finally {
      setSalvandoCategorias(false);
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
  const totalNovos = clientes.filter(c => c.isNovo && c.status !== 'admin').length;
  const totalVencendo = clientes.filter(c => c.status === 'teste' && c.diasRestantes <= 2).length;

  const clientesFiltrados = clientes.filter(c => {
    const matchBusca = busca === '' || 
      c.nomeCompleto.toLowerCase().includes(busca.toLowerCase()) ||
      c.nomeExibicao.toLowerCase().includes(busca.toLowerCase()) ||
      c.email.toLowerCase().includes(busca.toLowerCase()) ||
      c.documento.includes(busca);

    const matchStatus = filtroStatus === 'todos' 
      ? true 
      : filtroStatus === 'novos'
        ? c.isNovo
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
            <span className="cg-tab-badge-full">
              {oficiaisTotais} Oficiais{sugestoesPendentes > 0 && ` · ${sugestoesPendentes} Sugestões`}
            </span>
            <span className="cg-tab-badge-short">{oficiaisTotais}</span>
          </span>
        </button>
      </div>

      {abaPrincipal === 'moodboard' ? (
        <div className="cg-moodboard-manager">
          
          {/* 🌟 NAVEGADOR DE SUB-MÓDULOS DO MOODBOARD */}
          <div className="cg-moodboard-subtabs-nav" style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`cg-subtab-pill ${subAbaMoodboard === 'cenarios' ? 'active' : ''}`}
              onClick={() => setSubAbaMoodboard('cenarios')}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                border: subAbaMoodboard === 'cenarios' ? '2px solid #c5a059' : '1px solid #e2e8f0',
                background: subAbaMoodboard === 'cenarios' ? 'linear-gradient(135deg, #1e293b, #0f172a)' : '#ffffff',
                color: subAbaMoodboard === 'cenarios' ? '#c5a059' : '#475569',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: subAbaMoodboard === 'cenarios' ? '0 4px 12px rgba(197, 160, 89, 0.2)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <i className="fas fa-layer-group"></i> 🖼️ Acervo de Cenários & Peças PNG
              <span style={{
                background: subAbaMoodboard === 'cenarios' ? 'rgba(197, 160, 89, 0.2)' : '#f1f5f9',
                color: subAbaMoodboard === 'cenarios' ? '#c5a059' : '#64748b',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 'bold'
              }}>
                {itensMoodboard.length}
              </span>
            </button>

            <button
              type="button"
              className={`cg-subtab-pill ${subAbaMoodboard === 'ornamentos' ? 'active' : ''}`}
              onClick={() => setSubAbaMoodboard('ornamentos')}
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                border: subAbaMoodboard === 'ornamentos' ? '2px solid #c5a059' : '1px solid #e2e8f0',
                background: subAbaMoodboard === 'ornamentos' ? 'linear-gradient(135deg, #1e293b, #0f172a)' : '#ffffff',
                color: subAbaMoodboard === 'ornamentos' ? '#c5a059' : '#475569',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: subAbaMoodboard === 'ornamentos' ? '0 4px 12px rgba(197, 160, 89, 0.2)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <i className="fas fa-crown"></i> 🌿 Ícones & Apliques Vetoriais (Letreiros)
              <span style={{
                background: subAbaMoodboard === 'ornamentos' ? 'rgba(197, 160, 89, 0.2)' : '#f1f5f9',
                color: subAbaMoodboard === 'ornamentos' ? '#c5a059' : '#64748b',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 'bold'
              }}>
                {Object.keys(ORNAMENTOS_FESTA).length + Object.keys(ornamentosCustom).length}
              </span>
            </button>
          </div>

          {subAbaMoodboard === 'ornamentos' ? (
            <div className="cg-ornaments-manager-section">
              {/* KPI STATS ORNAMENTOS */}
              <div className="cg-mb-stats-row">
                <div className="cg-mb-stat-box">
                  <div className="cg-mb-stat-icon gold"><i className="fas fa-crown"></i></div>
                  <div className="cg-mb-stat-info">
                    <span className="cg-mb-stat-val">{Object.keys(ORNAMENTOS_FESTA).length + Object.keys(ornamentosCustom).length}</span>
                    <span className="cg-mb-stat-lbl">Total de Ícones Padrão</span>
                  </div>
                </div>

                <div className="cg-mb-stat-box">
                  <div className="cg-mb-stat-icon blue"><i className="fas fa-shapes"></i></div>
                  <div className="cg-mb-stat-info">
                    <span className="cg-mb-stat-val">{Object.keys(ORNAMENTOS_FESTA).length}</span>
                    <span className="cg-mb-stat-lbl">Ícones Nativos do Sistema</span>
                  </div>
                </div>

                <div className="cg-mb-stat-box">
                  <div className="cg-mb-stat-icon orange"><i className="fas fa-plus-circle"></i></div>
                  <div className="cg-mb-stat-info">
                    <span className="cg-mb-stat-val">{Object.keys(ornamentosCustom).length}</span>
                    <span className="cg-mb-stat-lbl">Novos Ícones Criados</span>
                  </div>
                </div>

                <div className="cg-mb-stat-action">
                  <button className="cg-btn-add-global-primary" onClick={() => setModalNovoOrnamentoAberto(true)}>
                    <i className="fas fa-plus-circle"></i> + Cadastrar Novo Ícone / Aplique
                  </button>
                </div>
              </div>

              {/* BARRA DE BUSCA DE ÍCONES */}
              <div className="cg-toolbar" style={{ marginTop: '16px', marginBottom: '16px' }}>
                <div className="cg-search-box" style={{ maxWidth: '400px' }}>
                  <i className="fas fa-search"></i>
                  <input
                    type="text"
                    placeholder="Buscar ícone por nome..."
                    value={buscaOrnamento}
                    onChange={(e) => setBuscaOrnamento(e.target.value)}
                  />
                  {buscaOrnamento && (
                    <button className="cg-search-clear" onClick={() => setBuscaOrnamento('')}>
                      <i className="fas fa-times"></i>
                    </button>
                  )}
                </div>
                <div style={{ marginLeft: 'auto', fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fas fa-info-circle" style={{ color: '#c5a059' }}></i>
                  Todos os ícones cadastrados aqui ficam disponíveis instantaneamente para todas as usuárias no Moodboard na aba <strong>Texto & Letreiros → Ícones</strong>.
                </div>
              </div>

              {/* GRID DE CARDS DE ÍCONES */}
              <div className="cg-ornaments-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '16px',
                marginTop: '16px'
              }}>
                {Object.entries({ ...ORNAMENTOS_FESTA, ...ornamentosCustom })
                  .filter(([key, orn]) => {
                    if (!buscaOrnamento) return true;
                    return (orn.nome || '').toLowerCase().includes(buscaOrnamento.toLowerCase());
                  })
                  .map(([key, orn]) => {
                    const isCustom = !!ornamentosCustom[key];
                    return (
                      <div
                        key={key}
                        className="cg-ornament-admin-card"
                        style={{
                          background: '#ffffff',
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          position: 'relative',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {/* BADGE DE TIPO */}
                        <span style={{
                          position: 'absolute',
                          top: '10px',
                          left: '10px',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          padding: '2px 6px',
                          borderRadius: '6px',
                          background: isCustom ? '#fef3c7' : '#f1f5f9',
                          color: isCustom ? '#b45309' : '#64748b'
                        }}>
                          {isCustom ? '⭐ Personalizado' : '🔒 Nativo'}
                        </span>

                        {/* PREVIEW DO VETOR DOURADO */}
                        <div style={{
                          width: '100px',
                          height: '100px',
                          marginTop: '20px',
                          marginBottom: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: '#f8fafc',
                          borderRadius: '10px',
                          padding: '10px'
                        }}>
                          <svg
                            width="100%"
                            height="100%"
                            viewBox={orn.viewBox || "0 0 100 100"}
                            style={{ filter: 'drop-shadow(1px 2px 2px rgba(0,0,0,0.25))' }}
                          >
                            <defs>
                              <linearGradient id={`adm-gold-${key}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#bf953f" />
                                <stop offset="50%" stopColor="#fcf6ba" />
                                <stop offset="100%" stopColor="#aa771c" />
                              </linearGradient>
                            </defs>
                            <g fill={`url(#adm-gold-${key})`}>
                              {orn.path
                                ? renderAdminSvgWithFill(orn.path, `url(#adm-gold-${key})`)
                                : orn.d
                                  ? <path d={orn.d} fill={`url(#adm-gold-${key})`} />
                                  : orn.svgContent
                                    ? <g dangerouslySetInnerHTML={{ __html: orn.svgContent.replace(/currentColor/g, `url(#adm-gold-${key})`) }} />
                                    : null}
                            </g>
                          </svg>
                        </div>

                        {/* NOME E EMOJI */}
                        <div style={{ textAlign: 'center', width: '100%', marginBottom: '10px' }}>
                          <strong style={{ fontSize: '13px', color: '#1e293b', display: 'block' }}>
                            {orn.emoji || '✨'} {orn.nome}
                          </strong>
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>ID: {key}</span>
                        </div>

                        {/* AÇÃO (EXCLUIR SE FOR CUSTOM) */}
                        {isCustom ? (
                          <button
                            type="button"
                            onClick={() => handleExcluirOrnamento(key, orn.nome)}
                            style={{
                              marginTop: 'auto',
                              width: '100%',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid #fee2e2',
                              background: '#fef2f2',
                              color: '#dc2626',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}
                          >
                            <i className="fas fa-trash-alt"></i> Excluir Ícone
                          </button>
                        ) : (
                          <div style={{ marginTop: 'auto', fontSize: '11px', color: '#94a3b8', padding: '6px 0' }}>
                            <i className="fas fa-lock" style={{ fontSize: '9px' }}></i> Protegido pelo Sistema
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            <>
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
              <button className="cg-btn-manage-categories" onClick={() => setModalCategoriasAberto(true)} title="Gerenciar categorias de elementos do Moodboard">
                <i className="fas fa-tags"></i> Gerenciar Categorias ({categoriasMoodboard.length})
              </button>
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
                <option value="todas">📁 Todas as Categorias ({itensMoodboard.length})</option>
                <optgroup label="Cenários & Fundos">
                  <option value="Parede">🧱 Paredes ({itensMoodboard.filter(i => i.categoria === 'Parede').length})</option>
                  <option value="Piso">🪵 Pisos & Tablados ({itensMoodboard.filter(i => i.categoria === 'Piso').length})</option>
                  <option value="Ambiente">🏞️ Ambientes Inteiros ({itensMoodboard.filter(i => i.categoria === 'Ambiente').length})</option>
                </optgroup>
                <optgroup label="Cenografia & Decoração">
                  {categoriasMoodboard.map(cat => {
                    const count = itensMoodboard.filter(i => i.categoria === cat.id).length;
                    return (
                      <option key={cat.id} value={cat.id}>
                        {cat.icone} {cat.nome} ({count})
                      </option>
                    );
                  })}
                </optgroup>
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
        </>
      )}
    </div>
  ) : (
        <>
          {/* BARRA DE ALTERNÂNCIA (EXPANDIR / RECOLHER) DOS CARDS KPI */}
          <div className="cg-kpi-toggle-wrapper">
            <button 
              type="button" 
              className={`cg-btn-toggle-kpi ${!mostrarKpi ? 'is-collapsed' : ''}`}
              onClick={toggleKpi}
              aria-expanded={mostrarKpi}
              title={mostrarKpi ? "Recolher indicadores gerais" : "Expandir indicadores gerais"}
            >
              <div className="cg-toggle-kpi-left">
                <span className="cg-toggle-kpi-icon">📊</span>
                {mostrarKpi ? (
                  <span className="cg-toggle-kpi-title">Indicadores Gerais da Plataforma</span>
                ) : (
                  <span className="cg-toggle-kpi-summary">
                    <strong>{totalClientes}</strong> empresas • <strong>{totalTeste}</strong> em teste • <strong>{totalAtivos}</strong> pagantes • <strong>{totalBloqueados}</strong> bloqueados
                  </span>
                )}
              </div>
              <span className="cg-toggle-kpi-badge">
                {mostrarKpi ? (
                  <>Recolher <i className="fas fa-chevron-up"></i></>
                ) : (
                  <>Expandir <i className="fas fa-chevron-down"></i></>
                )}
              </span>
            </button>
          </div>

          {/* KPI CARDS (COM FILTRO DE VENCENDO) */}
          <div className={`cg-kpi-row ${!mostrarKpi ? 'cg-kpi-hidden' : ''}`}>
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

            {/* DROPDOWN SELECT PADRÃO DE STATUS (IGUAL AO SEGUNDO PRINT) */}
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="select-pill-filter cg-status-select"
              title="Filtrar por Status"
              aria-label="Filtrar Empresas por Status"
            >
              <option value="todos">🏢 Todas as Empresas ({totalClientes})</option>
              <option value="novos">✨ Novos ({totalNovos})</option>
              <option value="vencendo">⏳ Vencendo ({totalVencendo})</option>
              <option value="teste">🧪 Em Teste ({totalTeste})</option>
              <option value="ativo">💎 Pagantes ({totalAtivos})</option>
              <option value="bloqueado">🔒 Bloqueados ({totalBloqueados})</option>
              <option value="excluido">🗑️ Excluídos ({totalExcluidos})</option>
            </select>

            {/* Filtros em Pílulas no Desktop (Oculto no Celular) */}
            <div className="cg-filter-pills cg-desktop-only-pills">
              {[
                { id: 'todos', label: 'Todos' },
                { id: 'novos', label: `✨ Novos (${totalNovos})` },
                { id: 'vencendo', label: `⏳ Vencendo (${totalVencendo})` },
                { id: 'teste', label: 'Em Teste' },
                { id: 'ativo', label: 'Pagantes' },
                { id: 'bloqueado', label: 'Bloqueados' },
                { id: 'excluido', label: 'Excluídos' }
              ].map(f => (
                <button 
                  key={f.id} 
                  className={`cg-pill ${filtroStatus === f.id ? 'active' : ''} ${f.id === 'novos' && totalNovos > 0 ? 'pill-novos' : ''} ${f.id === 'vencendo' && totalVencendo > 0 ? 'pill-vencendo' : ''}`}
                  onClick={() => setFiltroStatus(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="cg-sync-action-group">
              <button 
                type="button"
                className="cg-btn-sync-auth" 
                onClick={sincronizarContas} 
                disabled={sincronizando}
                title="Sincronizar todas as contas criadas com Google ou e-mail"
              >
                <i className={`fas fa-sync-alt ${sincronizando ? 'fa-spin' : ''}`}></i>
                <span className="cg-sync-label-desktop">{sincronizando ? 'Sincronizando...' : 'Sincronizar Google / Auth'}</span>
                <span className="cg-sync-label-mobile">{sincronizando ? 'Sincronizando...' : 'Sincronizar Auth'}</span>
              </button>
            </div>
          </div>

          {/* ⚠️ ALERTA INTELIGENTE DE CONTAS DUPLICADAS POR E-MAIL */}
          {duplicatasDetectadas.length > 0 && (
            <div style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '12px',
              padding: '14px 18px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
              boxShadow: '0 2px 8px rgba(217, 119, 6, 0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.4rem' }}>⚠️</span>
                <div>
                  <strong style={{ color: '#92400e', fontSize: '0.95rem' }}>
                    Contas Duplicadas Detectadas ({duplicatasDetectadas.length})
                  </strong>
                  <p style={{ margin: '2px 0 0', color: '#b45309', fontSize: '0.82rem' }}>
                    O e-mail <strong>{duplicatasDetectadas.join(', ')}</strong> possui mais de um cadastro no banco (ex: criado com e-mail e depois acessado via Google).
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => unificarContasDuplicadas(duplicatasDetectadas[0])}
                disabled={unificando}
                style={{
                  background: '#d97706',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(217, 119, 6, 0.3)'
                }}
              >
                <i className={`fas fa-link ${unificando ? 'fa-spin' : ''}`}></i>
                {unificando ? 'Unificando...' : '🔗 Unificar e Resolver Agora'}
              </button>
            </div>
          )}

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
                    <tr key={c.uid} className={`cg-row cg-row-${c.status} ${c.isNovo ? 'row-novo' : ''} ${c.status === 'teste' && c.diasRestantes <= 2 ? 'row-vencendo' : ''}`}>
                      <td className="cg-cell-name">
                        <div className="cg-avatar">
                          {(c.nomeExibicao || '?')[0].toUpperCase()}
                        </div>
                        <div className="cg-name-group">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <strong>{c.nomeExibicao}</strong>
                            {c.isNovo && (
                              <span className="cg-badge-novo" title={`Cliente novo! Cadastrado ${c.rotuloNovo.toLowerCase()}`}>
                                ✨ NOVO • {c.rotuloNovo}
                              </span>
                            )}
                            {c.isDuplicado && (
                              <span style={{
                                background: '#fef3c7',
                                color: '#b45309',
                                border: '1px solid #fcd34d',
                                borderRadius: '6px',
                                fontSize: '0.66rem',
                                fontWeight: '700',
                                padding: '1px 6px'
                              }}>
                                ⚠️ E-mail Duplicado
                              </span>
                            )}
                          </div>
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
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span>{c.dataCadastroExibida}</span>
                          {c.isNovo && (
                            <small style={{ color: '#059669', fontWeight: '800', fontSize: '0.70rem' }}>
                              🟢 {c.rotuloNovo}
                            </small>
                          )}
                        </div>
                      </td>
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
                                  width: `${Math.min(100, Math.max(0, (((c.totalDiasTeste || 7) - c.diasRestantes) / (c.totalDiasTeste || 7)) * 100))}%`,
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
                            {c.isDuplicado && (
                              <button 
                                className="cg-btn-merge"
                                onClick={() => unificarContasDuplicadas(c.email)}
                                title="Unificar contas duplicadas deste e-mail"
                                style={{
                                  background: '#d97706',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '8px',
                                  padding: '5px 8px',
                                  cursor: 'pointer',
                                  fontSize: '0.72rem',
                                  fontWeight: '700',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <i className="fas fa-link"></i> Unificar
                              </button>
                            )}
                            <button 
                              className="cg-btn-impersonate" 
                              onClick={() => entrarModoSuporte(c)}
                              title="Acessar conta em Modo Suporte (Livre Acesso)"
                            >
                              <i className="fas fa-rocket"></i> Acessar
                            </button>
                            <button 
                              className="cg-btn-support" 
                              onClick={() => abrirVisualizadorSuporte(c)}
                              title="Visualizar Conta e Dados da Empresa"
                            >
                              <i className="fas fa-eye"></i>
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
                          <span className="cg-admin-na" style={{ fontSize: '11.5px', fontWeight: '700', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <i className="fas fa-shield-alt" style={{ color: '#c5a059' }}></i> Conta Master
                          </span>
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
                  <div className={`cg-mobile-client-card ${c.isNovo ? 'card-novo' : ''} ${c.status === 'teste' && c.diasRestantes <= 2 ? 'card-vencendo' : ''}`} key={c.uid}>
                    <div className="cg-mcard-header">
                      <div className="cg-mcard-user">
                        <div className="cg-avatar">{(c.nomeExibicao || '?')[0].toUpperCase()}</div>
                        <div className="cg-mcard-titles">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <strong className="cg-mcard-name">{c.nomeExibicao}</strong>
                            {c.isNovo && (
                              <span className="cg-badge-novo" title={`Cliente novo! Cadastrado ${c.rotuloNovo.toLowerCase()}`}>
                                ✨ NOVO • {c.rotuloNovo}
                              </span>
                            )}
                          </div>
                          {c.isDuplicado && (
                            <span style={{
                              background: '#fef3c7',
                              color: '#b45309',
                              border: '1px solid #fcd34d',
                              borderRadius: '6px',
                              fontSize: '0.62rem',
                              fontWeight: '700',
                              padding: '1px 5px',
                              display: 'inline-block',
                              width: 'fit-content'
                            }}>
                              ⚠️ E-mail Duplicado
                            </span>
                          )}
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

                      {/* CAIXA DE PLANO & VIGÊNCIA DE TESTE */}
                      <div className="cg-mcard-plan-box">
                        <div className="cg-mcard-plan-header">
                          <div className="cg-mcard-plan-item">
                            <span className="cg-mcard-plan-lbl"><i className="fas fa-crown"></i> Plano:</span>
                            <span className="cg-plano-tag">{c.nomePlano}</span>
                          </div>
                          <div className="cg-mcard-plan-item" style={{ textAlign: 'right', alignItems: 'flex-end' }}>
                            <span className="cg-mcard-plan-lbl"><i className="far fa-calendar-alt"></i> Cadastro:</span>
                            <span className="cg-mcard-date-val">
                              {c.dataCadastroExibida}
                              {c.isNovo && <span className="cg-mcard-tag-novo">{c.rotuloNovo}</span>}
                            </span>
                          </div>
                        </div>

                        {c.status === 'teste' && (
                          <div className={`cg-mcard-trial-gauge ${c.diasRestantes <= 2 ? 'is-expiring' : ''}`}>
                            <div className="cg-trial-gauge-header">
                              <span className="cg-trial-gauge-title">
                                <i className="fas fa-hourglass-half"></i> Período de Teste
                              </span>
                              <span className="cg-trial-gauge-days">
                                {c.diasRestantes <= 0 ? '⚠️ Período Vencido' : `⏳ ${c.diasRestantes} dias restantes`}
                              </span>
                            </div>
                            <div className="cg-trial-progress-bar">
                              <div 
                                className="cg-trial-progress-fill" 
                                style={{ 
                                  width: `${Math.min(100, Math.max(0, (((c.totalDiasTeste || 7) - c.diasRestantes) / (c.totalDiasTeste || 7)) * 100))}%`,
                                  background: c.diasRestantes <= 2 
                                    ? 'linear-gradient(90deg, #f97316, #dc2626)' 
                                    : 'linear-gradient(90deg, #f59e0b, #d97706)'
                                }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {c.status !== 'admin' && (
                      <div className="cg-mcard-actions-wrapper">
                        {/* Botão Primário: Acessar Conta com livre acesso */}
                        <button 
                          type="button"
                          className="cg-btn-mcard-access-primary" 
                          onClick={() => entrarModoSuporte(c)}
                          title="Acessar conta em Modo Suporte (Livre Acesso)"
                        >
                          <i className="fas fa-rocket"></i>
                          <span>Acessar Conta</span>
                          <i className="fas fa-arrow-right cg-btn-access-arrow"></i>
                        </button>

                        {/* Linha de Ações Secundárias Simétricas */}
                        <div className="cg-mcard-secondary-actions">
                          {c.telefone && (
                            <button
                              type="button"
                              className="cg-btn-mcard-action cg-action-whatsapp"
                              onClick={() => handleChamarWhatsApp(c)}
                              title={`Chamar no WhatsApp (${c.telefone})`}
                            >
                              <i className="fab fa-whatsapp"></i>
                              <span>Zap</span>
                            </button>
                          )}

                          <button 
                            type="button"
                            className="cg-btn-mcard-action cg-action-support" 
                            onClick={() => abrirVisualizadorSuporte(c)}
                            title="Visualizar Conta e Dados da Empresa"
                          >
                            <i className="fas fa-eye"></i>
                            <span>Ver Conta</span>
                          </button>

                          <button 
                            type="button"
                            className="cg-btn-mcard-action cg-action-edit" 
                            onClick={() => abrirEdicao(c)}
                            title="Editar Cadastro / Plano"
                          >
                            <i className="fas fa-edit"></i>
                            <span>Editar</span>
                          </button>

                          {c.isDuplicado && (
                            <button 
                              type="button"
                              className="cg-btn-mcard-action cg-action-merge" 
                              onClick={() => unificarContasDuplicadas(c.email)}
                              title="Unificar contas deste e-mail"
                            >
                              <i className="fas fa-link"></i>
                              <span>Unificar</span>
                            </button>
                          )}

                          <button 
                            type="button"
                            className="cg-btn-mcard-delete" 
                            onClick={() => confirmarExclusao(c.uid, c.nomeExibicao)}
                            title="Excluir Empresa"
                          >
                            <i className="fas fa-trash-alt"></i>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* MODAL DE EDIÇÃO DO CLIENTE / CONTROLE MASTER DA CONTA */}
          {modalAberto && membroEdicao && createPortal(
            <div className="cg-modal-backdrop" onClick={() => setModalAberto(false)}>
              <div className="cg-modal-content cg-client-edit-modal" onClick={e => e.stopPropagation()}>
                
                {/* TOPO DO MODAL */}
                <div className="cg-modal-header">
                  <div className="cg-modal-header-titles">
                    <h2><i className="fas fa-user-cog"></i> Gestão do Cliente & Suporte Master</h2>
                    <span className="cg-modal-header-sub">Painel com livre acesso de moderação e assistência</span>
                  </div>
                  <button className="cg-modal-close" onClick={() => setModalAberto(false)}>
                    <i className="fas fa-times"></i>
                  </button>
                </div>

                <form onSubmit={salvarEdicao} className="cg-modal-form cg-modal-scrollable">
                  
                  {/* GRID PANORÂMICO DE 2 COLUNAS NO PC */}
                  <div className="cg-client-modal-two-cols">
                    
                    {/* COLUNA ESQUERDA: HERO + AÇÕES DE SUPORTE + CONTROLE DE ASSINATURA */}
                    <div className="cg-modal-col-left">
                      {/* CARD DE IDENTIDADE DO CLIENTE */}
                      <div className="cg-client-hero-card">
                        <div className="cg-client-hero-left">
                          <div className="cg-client-hero-avatar">
                            {(membroEdicao.nomeExibicao || '?')[0].toUpperCase()}
                          </div>
                          <div className="cg-client-hero-info">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <h3>{membroEdicao.nomeExibicao}</h3>
                              {membroEdicao.isNovo && (
                                <span className="cg-badge-novo" title={`Cadastrado ${membroEdicao.rotuloNovo.toLowerCase()}`}>
                                  ✨ NOVO • {membroEdicao.rotuloNovo}
                                </span>
                              )}
                            </div>
                            <p>{membroEdicao.nomeCompleto || 'Sem razão social'} • <span>{membroEdicao.email}</span></p>
                          </div>
                        </div>
                        <div className="cg-client-hero-badge">
                          {getStatusBadge(membroEdicao.status)}
                        </div>
                      </div>

                      {/* BARRA DE AÇÕES RÁPIDAS DE SUPORTE (LIVRE ACESSO) */}
                      <div className="cg-quick-support-box">
                        <div className="cg-quick-support-title">
                          <i className="fas fa-bolt"></i> Ações Rápidas de Suporte (Livre Acesso)
                        </div>

                        <div className="cg-quick-support-grid">
                          {/* BOTÃO PRINCIPAL: ENTRAR NA CONTA DO CLIENTE */}
                          <button 
                            type="button" 
                            className="cg-btn-impersonate-action"
                            onClick={() => entrarModoSuporte(membroEdicao)}
                            title="Navegar no sistema como esta empresa para visualizar ou ajustar acervo, pedidos e configurações"
                          >
                            <i className="fas fa-rocket"></i>
                            <div className="cg-btn-impersonate-texts">
                              <strong>Acessar Conta Desta Empresa</strong>
                              <small>Entrar no sistema em Modo Suporte com livre acesso</small>
                            </div>
                          </button>

                          <div className="cg-quick-support-row-secondary">
                            <button 
                              type="button" 
                              className="cg-btn-whatsapp-action"
                              onClick={() => handleChamarWhatsApp(membroEdicao)}
                              title="Iniciar conversa com o cliente no WhatsApp"
                            >
                              <i className="fab fa-whatsapp"></i> Chamar no WhatsApp
                            </button>

                            <button 
                              type="button" 
                              className="cg-btn-reset-pwd-action"
                              onClick={() => handleEnviarRedefinicaoSenha(membroEdicao.email)}
                              disabled={enviandoEmailSenha}
                              title="Enviar e-mail para o cliente redefinir a senha"
                            >
                              {enviandoEmailSenha ? (
                                <><i className="fas fa-spinner fa-spin"></i> Enviando...</>
                              ) : (
                                <><i className="fas fa-key"></i> Redefinir Senha</>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* CONTROLE DE ASSINATURA */}
                      <div className="cg-payment-section">
                        <div className="cg-payment-header">
                          <h3><i className="fas fa-credit-card"></i> Controle de Assinatura & Liberação</h3>
                          <span className="cg-payment-header-hint">Presets rápidos de 1 clique ou ajuste manual</span>
                        </div>

                        {/* PRESETS DE 1-CLIQUE */}
                        <div className="cg-preset-pills-row">
                          <button 
                            type="button" 
                            className={`cg-preset-pill vip ${membroEdicao.assinaturaAtiva ? 'active' : ''}`}
                            onClick={aplicarPresetVip}
                            title="Liberar acesso total irrestrito"
                          >
                            <i className="fas fa-crown"></i> 🌟 Liberar VIP Total
                          </button>

                          <button 
                            type="button" 
                            className={`cg-preset-pill teste ${!membroEdicao.assinaturaAtiva && membroEdicao.statusAssinatura === 'ativa' ? 'active' : ''}`}
                            onClick={aplicarPresetTeste}
                            title="Manter como teste grátis (7 dias)"
                          >
                            <i className="fas fa-hourglass-start"></i> ⏳ Modo Teste (7d)
                          </button>

                          <button 
                            type="button" 
                            className={`cg-preset-pill block ${membroEdicao.statusAssinatura === 'cancelada' ? 'active' : ''}`}
                            onClick={aplicarPresetBloquear}
                            title="Bloquear imediatamente o acesso da empresa"
                          >
                            <i className="fas fa-ban"></i> 🚫 Bloquear Acesso
                          </button>
                        </div>

                        {/* AJUSTES MANUAIS DETALHADOS */}
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
                    </div>

                    {/* COLUNA DIREITA: DADOS CADASTRAIS + DATAS & TESTE */}
                    <div className="cg-modal-col-right">
                      {/* DADOS BÁSICOS & CONTATO */}
                      <div className="cg-form-section-title">
                        <i className="fas fa-id-card"></i> Dados Cadastrais & Contato
                      </div>

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
                          <label>Telefone / WhatsApp</label>
                          <input 
                            type="text" 
                            placeholder="(00) 00000-0000"
                            value={membroEdicao.telefone || ''} 
                            onChange={e => setMembroEdicao({ ...membroEdicao, telefone: e.target.value })}
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
                      </div>

                      {/* GESTÃO DE DATAS & PERÍODO DE TESTE */}
                      <div className="cg-form-section-title" style={{ marginTop: '16px' }}>
                        <i className="fas fa-hourglass-half"></i> Período de Teste & Cadastro
                      </div>

                      <div className="cg-form-grid">
                        <div className="cg-form-group">
                          <label>Data de Cadastro da Empresa</label>
                          <input 
                            type="date" 
                            value={formatarDataParaInput(membroEdicao.dataCadastro)} 
                            onChange={e => setMembroEdicao({ ...membroEdicao, dataCadastro: e.target.value })}
                          />
                          <small style={{ color: '#64748b', marginTop: '4px', display: 'block' }}>Início para contagem do teste grátis de 7 dias.</small>
                        </div>

                        <div className="cg-form-group">
                          <label>Término do Período de Teste</label>
                          <input 
                            type="date" 
                            value={formatarDataParaInput(membroEdicao.dataFimTeste)} 
                            onChange={e => setMembroEdicao({ ...membroEdicao, dataFimTeste: e.target.value })}
                          />
                          <small style={{ color: '#64748b', marginTop: '4px', display: 'block' }}>Data limite para expiração do acesso cortesia.</small>
                        </div>
                      </div>

                      {/* PRORROGAÇÃO RÁPIDA (1-CLIQUE) */}
                      <div className="cg-trial-extension-bar">
                        <span className="cg-trial-ext-label"><i className="fas fa-plus-circle"></i> Prorrogar Teste:</span>
                        <div className="cg-trial-ext-buttons">
                          <button type="button" className="cg-btn-ext-pill" onClick={() => prorrogarTesteDias(7)}>+ 7 Dias</button>
                          <button type="button" className="cg-btn-ext-pill" onClick={() => prorrogarTesteDias(15)}>+ 15 Dias</button>
                          <button type="button" className="cg-btn-ext-pill" onClick={() => prorrogarTesteDias(30)}>+ 30 Dias</button>
                          <button type="button" className="cg-btn-ext-pill reset" onClick={resetarTesteHoje}>Hoje + 7d</button>
                        </div>
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
            </div>,
            document.body
          )}

          {/* MODAL DE VISUALIZAÇÃO DE CONTA / RESUMO EXECUTIVO */}
          {modalSuporteAberto && membroSuporte && createPortal(
            <div className="cg-modal-backdrop" onClick={() => setModalSuporteAberto(false)}>
              <div className="cg-modal-content support-modal-width" onClick={e => e.stopPropagation()}>
                <div className="cg-modal-header">
                  <div className="cg-modal-header-titles">
                    <h2 style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span><i className="fas fa-id-card"></i> Visualizar Conta: {membroSuporte.nomeExibicao}</span>
                      {membroSuporte.isNovo && (
                        <span className="cg-badge-novo" title={`Cliente novo! Cadastrado ${membroSuporte.rotuloNovo.toLowerCase()}`}>
                          ✨ NOVO • {membroSuporte.rotuloNovo}
                        </span>
                      )}
                    </h2>
                    <span className="cg-modal-header-sub">Resumo executivo de acervo, locações e clientes cadastrados</span>
                  </div>
                  <button className="cg-modal-close" onClick={() => setModalSuporteAberto(false)}>
                    <i className="fas fa-times"></i>
                  </button>
                </div>

                {/* BOTÃO MODO SUPORTE NO TOPO DO MODAL */}
                <div className="cg-support-modal-top-action">
                  <button 
                    type="button" 
                    className="cg-btn-impersonate-modal-sup" 
                    onClick={() => entrarModoSuporte(membroSuporte)}
                  >
                    <i className="fas fa-rocket"></i> Acessar Toda a Loja Desta Empresa (Modo Suporte Completo)
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
            </div>,
            document.body
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
                      <optgroup label="Cenários & Fundos (Fotos/Texturas)">
                        <option value="Parede">🧱 Fundo de Parede</option>
                        <option value="Piso">🪵 Fundo de Piso / Chão</option>
                        <option value="Ambiente">🏞️ Ambiente Inteiro / Salão Completo</option>
                      </optgroup>
                      <optgroup label="Cenografia & Decoração (PNGs)">
                        {categoriasMoodboard.map(c => (
                          <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>
                        ))}
                      </optgroup>
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
                      <optgroup label="Cenários & Fundos">
                        <option value="Parede">🧱 Fundo de Parede</option>
                        <option value="Piso">🪵 Fundo de Piso / Chão</option>
                        <option value="Ambiente">🏞️ Ambiente Inteiro / Salão</option>
                      </optgroup>
                      <optgroup label="Cenografia & Decoração">
                        {categoriasMoodboard.map(c => (
                          <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>
                        ))}
                      </optgroup>
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

      {/* 🏷️ MODAL: GERENCIAR CATEGORIAS DO MOODBOARD */}
      {modalCategoriasAberto && (
        <div className="cg-modal-overlay" onClick={() => setModalCategoriasAberto(false)}>
          <div className="cg-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px', width: '95%' }}>
            <div className="cg-modal-header">
              <h2><i className="fas fa-tags"></i> Gerenciar Categorias do Moodboard</h2>
              <button className="cg-modal-close" onClick={() => setModalCategoriasAberto(false)}>✕</button>
            </div>
            <div className="cg-modal-body cg-cats-modal-wrap">
              <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
                As categorias cadastradas aqui aparecem automaticamente nos filtros e no modal de Upload para todas as usuárias do Celebre em tempo real.
              </p>

              {/* Formulário: Nova Categoria */}
              <form onSubmit={handleAdicionarCategoria} className="cg-new-cat-card">
                <div className="cg-new-cat-title">
                  <i className="fas fa-plus-circle"></i> Cadastrar Nova Categoria
                </div>
                <div className="cg-new-cat-inputs-row">
                  <input
                    type="text"
                    className="cg-cat-emoji-input"
                    value={novaCatForm.icone}
                    onChange={e => setNovaCatForm({ ...novaCatForm, icone: e.target.value })}
                    placeholder="🌸"
                    maxLength={4}
                    title="Emoji ou Ícone"
                  />
                  <input
                    type="text"
                    className="cg-cat-name-input"
                    value={novaCatForm.nome}
                    onChange={e => setNovaCatForm({ ...novaCatForm, nome: e.target.value })}
                    placeholder="Ex: Doces Fake, Bolos Cenográficos, Velas..."
                    required
                  />
                  <button type="submit" className="cg-btn-add-cat" disabled={salvandoCategorias}>
                    {salvandoCategorias ? 'Salvando...' : '+ Adicionar'}
                  </button>
                </div>
                {/* Sugestões de Emojis Rápidos */}
                <div className="cg-quick-emojis-row">
                  <span style={{ fontSize: '10.5px', color: '#94a3b8', marginRight: '4px' }}>Sugestões:</span>
                  {['🌸', '🧸', '🍽️', '🦸', '🎈', '🏛️', '🛋️', '✨', '🧁', '🕯️', '🎂', '🎀', '🎪', '🪴', '🪑', '📦'].map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      className="cg-quick-emoji-btn"
                      onClick={() => setNovaCatForm({ ...novaCatForm, icone: emoji })}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </form>

              {/* Lista de Categorias Ativas */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <strong style={{ fontSize: '12.5px', color: '#0f172a' }}>
                  Categorias Ativas ({categoriasMoodboard.length})
                </strong>
                <button
                  type="button"
                  onClick={handleRestaurarCategoriasPadrao}
                  style={{ background: 'transparent', border: 'none', color: '#c5a059', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                  title="Restaurar lista original do Celebre"
                >
                  ↺ Restaurar Padrões
                </button>
              </div>

              <div className="cg-cats-grid">
                {categoriasMoodboard.map(cat => (
                  <div key={cat.id} className="cg-cat-item-card">
                    {catEditandoId === cat.id ? (
                      <div style={{ display: 'flex', gap: '6px', width: '100%', alignItems: 'center' }}>
                        <input
                          type="text"
                          className="cg-cat-emoji-input"
                          style={{ width: '40px', height: '32px', fontSize: '14px' }}
                          value={catEditandoForm.icone}
                          onChange={e => setCatEditandoForm({ ...catEditandoForm, icone: e.target.value })}
                        />
                        <input
                          type="text"
                          className="cg-cat-name-input"
                          style={{ height: '32px', fontSize: '12px' }}
                          value={catEditandoForm.nome}
                          onChange={e => setCatEditandoForm({ ...catEditandoForm, nome: e.target.value })}
                        />
                        <button
                          type="button"
                          className="cg-btn-cat-action"
                          style={{ background: '#0f172a', color: '#c5a059' }}
                          onClick={() => handleSalvarEdicaoCategoria(cat.id)}
                          title="Salvar"
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          className="cg-btn-cat-action"
                          onClick={() => setCatEditandoId(null)}
                          title="Cancelar"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="cg-cat-item-info">
                          <span className="cg-cat-item-icon">{cat.icone || '🏷️'}</span>
                          <div>
                            <div className="cg-cat-item-name">{cat.nome}</div>
                            <span className="cg-cat-item-id">ID: {cat.id}</span>
                          </div>
                        </div>
                        <div className="cg-cat-item-actions">
                          <button
                            type="button"
                            className="cg-btn-cat-action"
                            onClick={() => {
                              setCatEditandoId(cat.id);
                              setCatEditandoForm({ nome: cat.nome, icone: cat.icone || '🏷️' });
                            }}
                            title="Editar categoria"
                          >
                            <i className="fas fa-pencil-alt"></i>
                          </button>
                          <button
                            type="button"
                            className="cg-btn-cat-action danger"
                            onClick={() => handleExcluirCategoria(cat.id)}
                            title="Excluir categoria"
                          >
                            <i className="fas fa-trash-alt"></i>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="cg-modal-footer">
              <button type="button" className="cg-btn-cancel" onClick={() => setModalCategoriasAberto(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌿 MODAL: CADASTRAR NOVO ÍCONE / APLIQUE VETORIAL */}
      {modalNovoOrnamentoAberto && (
        <div className="cg-modal-overlay" onClick={() => setModalNovoOrnamentoAberto(false)}>
          <div className="cg-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px', width: '95%' }}>
            <div className="cg-modal-header">
              <h2><i className="fas fa-crown"></i> Cadastrar Novo Ícone / Aplique Vetorial</h2>
              <button className="cg-modal-close" onClick={() => setModalNovoOrnamentoAberto(false)}>✕</button>
            </div>

            <form onSubmit={handleSalvarNovoOrnamento}>
              <div className="cg-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
                  Adicione novos ícones e apliques para que fiquem disponíveis como padrão no catálogo de Letreiros & Ícones para todas as usuárias do Celebre.
                </p>

                {/* Linha 1: Nome + Emoji + ViewBox */}
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 140px', gap: '12px' }}>
                  <div className="cg-form-group">
                    <label className="cg-form-label">Emoji:</label>
                    <input
                      type="text"
                      className="cg-form-input"
                      style={{ textAlign: 'center', fontSize: '16px' }}
                      value={novoOrnamentoForm.emoji}
                      onChange={e => setNovoOrnamentoForm({ ...novoOrnamentoForm, emoji: e.target.value })}
                      placeholder="✨"
                      maxLength={4}
                    />
                  </div>

                  <div className="cg-form-group">
                    <label className="cg-form-label">Nome do Ícone / Aplique:</label>
                    <input
                      type="text"
                      className="cg-form-input"
                      value={novoOrnamentoForm.nome}
                      onChange={e => setNovoOrnamentoForm({ ...novoOrnamentoForm, nome: e.target.value })}
                      placeholder="Ex: Ursinho Real, Borboleta 3D, Anjo..."
                      required
                    />
                  </div>

                  <div className="cg-form-group">
                    <label className="cg-form-label">ViewBox SVG:</label>
                    <input
                      type="text"
                      className="cg-form-input"
                      value={novoOrnamentoForm.viewBox}
                      onChange={e => setNovoOrnamentoForm({ ...novoOrnamentoForm, viewBox: e.target.value })}
                      placeholder="0 0 100 100"
                    />
                  </div>
                </div>

                {/* Linha 2: Código SVG ou Caminho Path */}
                <div className="cg-form-group">
                  <label className="cg-form-label">
                    Código SVG ou Caminho Vetorial (Path 'd'):
                  </label>
                  <textarea
                    className="cg-form-textarea"
                    style={{ fontFamily: 'monospace', fontSize: '12px', minHeight: '120px', width: '100%', resize: 'vertical' }}
                    value={novoOrnamentoForm.d || novoOrnamentoForm.svgContent}
                    onChange={e => {
                      const val = e.target.value;
                      if (val.includes('<svg') || val.includes('<g') || val.includes('<polygon') || val.includes('<circle')) {
                        setNovoOrnamentoForm({ ...novoOrnamentoForm, svgContent: val, d: '' });
                      } else {
                        setNovoOrnamentoForm({ ...novoOrnamentoForm, d: val, svgContent: '' });
                      }
                    }}
                    placeholder="Cole aqui o código SVG completo (<svg>...</svg>) OU a tag <path d='...' /> OU apenas o caminho d='M10,20 ...'"
                    required
                  />
                  <small style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>
                    💡 Dica: Você pode copiar o SVG do Canva, Figma, Freepik ou Flaticon e colar aqui diretamente.
                  </small>
                </div>

                {/* Linha 3: Live Preview Instantâneo */}
                <div style={{
                  background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                  borderRadius: '10px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px'
                }}>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px dashed rgba(197, 160, 89, 0.4)',
                    flexShrink: 0
                  }}>
                    {novoOrnamentoForm.d || novoOrnamentoForm.svgContent ? (
                      <svg width="60" height="60" viewBox={novoOrnamentoForm.viewBox || "0 0 100 100"}>
                        <defs>
                          <linearGradient id="modal-preview-gold" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#bf953f" />
                            <stop offset="50%" stopColor="#fcf6ba" />
                            <stop offset="100%" stopColor="#aa771c" />
                          </linearGradient>
                        </defs>
                        {novoOrnamentoForm.d ? (
                          <path d={novoOrnamentoForm.d} fill="url(#modal-preview-gold)" />
                        ) : (
                          <g dangerouslySetInnerHTML={{
                            __html: (novoOrnamentoForm.svgContent || '')
                              .replace(/<svg[^>]*>/i, '')
                              .replace(/<\/svg>/i, '')
                              .replace(/currentColor/g, 'url(#modal-preview-gold)')
                              .replace(/fill="[^"]*"/g, 'fill="url(#modal-preview-gold)"')
                          }} />
                        )}
                      </svg>
                    ) : (
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', textAlign: 'center' }}>
                        Preview do Vetor
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#ffffff' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#c5a059', marginBottom: '4px' }}>
                      {novoOrnamentoForm.emoji || '✨'} {novoOrnamentoForm.nome || 'Nome do Ícone'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {novoOrnamentoForm.d || novoOrnamentoForm.svgContent
                        ? '✨ Vetor reconhecido! Veja ao lado como ele será renderizado em Acrílico Dourado.'
                        : 'Cole o código ou caminho do vetor acima para visualizar a prévia instantânea.'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="cg-modal-footer">
                <button type="button" className="cg-btn-cancel" onClick={() => setModalNovoOrnamentoAberto(false)}>
                  Cancelar
                </button>
                <button type="submit" className="cg-btn-save" disabled={salvandoOrnamento}>
                  {salvandoOrnamento ? <><i className="fas fa-spinner fa-spin"></i> Salvando...</> : <><i className="fas fa-check"></i> Salvar Ícone no Sistema</>}
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
