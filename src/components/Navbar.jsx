import React, { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { getAuth, onAuthStateChanged } from 'firebase/auth'; 
import { doc, getDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore'; 
import { db } from '../firebaseConfig';
import { calcularPeriodoTeste } from '../utils/periodoTesteUtils';
import logoCelebre from '../assets/LOGO_CELEBRE.png';
import "./Navbar.css";

const parseFirestoreDate = (dateVal) => {
  if (!dateVal) return null;
  if (dateVal.toDate) {
      try { return dateVal.toDate(); } catch (e) {}
  }
  if (dateVal.seconds) {
      return new Date(dateVal.seconds * 1000);
  }
  
  const str = String(dateVal).trim();
  
  // 1. Formato ISO ou AAAA-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
      const ano = parseInt(isoMatch[1], 10);
      const mes = parseInt(isoMatch[2], 10) - 1;
      const dia = parseInt(isoMatch[3], 10);
      return new Date(ano, mes, dia);
  }

  // 2. Formato brasileiro DD/MM/AAAA
  const brMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
      const dia = parseInt(brMatch[1], 10);
      const mes = parseInt(brMatch[2], 10) - 1;
      const ano = parseInt(brMatch[3], 10);
      return new Date(ano, mes, dia);
  }
  
  let parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
      parsed.setHours(0,0,0,0);
      return parsed;
  }
  
  return null;
};

const Navbar = () => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [permissoesAtivas, setPermissoesAtivas] = useState(null); 
  const [isDonoDaConta, setIsDonoDaConta] = useState(localStorage.getItem('userRole') !== 'funcionario'); 

  const [acesso, setAcesso] = useState({
      carregando: true,
      testeAtivo: false,
      assinaturaAtiva: false,
      beneficios: [],
      congelado: false
  });

  const auth = getAuth();
  const [usuarioLogado, setUsuarioLogado] = useState(auth.currentUser);
  const [nomeUsuario, setNomeUsuario] = useState('');
  
  const emailAdmin = "celebrefesta25@gmail.com";
  const isSuperAdmin = usuarioLogado?.email === emailAdmin;

  const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMenu = () => setIsMobileMenuOpen(false);

  let permissoesCache = {};
  try {
      permissoesCache = JSON.parse(localStorage.getItem('userPermissions')) || {};
  } catch (e) {
      permissoesCache = {};
  }

  useEffect(() => {
      let unsubSnapshot = null;

      const unsubscribe = onAuthStateChanged(auth, async (user) => {
          setUsuarioLogado(user);

          if (!user) {
              setAcesso({ carregando: false, testeAtivo: false, assinaturaAtiva: false, beneficios: [], congelado: false });
              return;
          }

          if (user.email === "celebrefesta25@gmail.com") {
              setAcesso({ carregando: false, testeAtivo: true, assinaturaAtiva: true, beneficios: [], congelado: false });
              setIsDonoDaConta(true);
              setNomeUsuario("Super Admin");
              return;
          }

          try {
              let idParaBusca = user.uid;
              let isFuncionarioReal = false;

              const ownDocSnap = await getDoc(doc(db, "usuarios", user.uid));
              
              if (ownDocSnap.exists()) {
                  const userData = ownDocSnap.data();
                  if (userData.role && userData.role !== 'owner' && userData.tenantId) {
                      idParaBusca = userData.tenantId;
                      isFuncionarioReal = true;
                      localStorage.setItem('tenantId', idParaBusca);
                      localStorage.setItem('userRole', userData.role);

                      const qFunc = query(collection(db, "equipe"), where("email", "==", user.email));
                      const snapFunc = await getDocs(qFunc);
                      if (!snapFunc.empty) {
                          const funcDoc = snapFunc.docs[0];
                          const dadosF = funcDoc.data();
                          setPermissoesAtivas(dadosF.permissoes || dadosF);
                          unsubSnapshot = onSnapshot(doc(db, "equipe", funcDoc.id), (docSnap) => {
                              if (docSnap.exists()) {
                                  const d = docSnap.data();
                                  setPermissoesAtivas(d.permissoes || d);
                              }
                          });
                      }
                  } else {
                      idParaBusca = user.uid;
                      localStorage.setItem('tenantId', user.uid);
                  }
              } else {
                  const qFunc = query(collection(db, "equipe"), where("email", "==", user.email));
                  const snapFunc = await getDocs(qFunc);
                  
                  if (!snapFunc.empty && snapFunc.docs[0].data().empresaId) {
                      isFuncionarioReal = true;
                      const funcDoc = snapFunc.docs[0];
                      const dadosFunc = funcDoc.data();
                      idParaBusca = dadosFunc.empresaId;
                      localStorage.setItem('tenantId', idParaBusca);
                      localStorage.setItem('userRole', dadosFunc.cargo || 'Funcionário');
                      setPermissoesAtivas(dadosFunc.permissoes || dadosFunc);
                      
                      unsubSnapshot = onSnapshot(doc(db, "equipe", funcDoc.id), (docSnap) => {
                          if (docSnap.exists()) {
                              const d = docSnap.data();
                              setPermissoesAtivas(d.permissoes || d);
                          }
                      });
                  }
              }

              setIsDonoDaConta(!isFuncionarioReal);

              const userSnap = await getDoc(doc(db, "usuarios", idParaBusca));

              if (userSnap.exists()) {
                  const dados = userSnap.data();
                  
                  const assinaturaAtiva = 
                      dados.assinaturaAtiva === true || 
                      dados.statusAssinatura === 'ativa' || 
                      dados.plano === 'pago' || 
                      dados.statusPagamentoVulso === 'pago';

                  // LÓGICA SIMPLES: 7 dias a partir do cadastro da empresa (Centralizado e Unificado)
                  let testeAtivo = false;
                  if (!assinaturaAtiva) {
                      const infoT = calcularPeriodoTeste(dados);
                      testeAtivo = infoT.emTeste;
                  } else {
                      testeAtivo = true;
                  }
                      
                      let beneficios = [];
                      if (dados.planoId && assinaturaAtiva) {
                          const planoSnap = await getDoc(doc(db, "planos", dados.planoId));
                          if (planoSnap.exists()) beneficios = planoSnap.data().beneficios || [];
                      }

                      setAcesso({
                          carregando: false,
                          testeAtivo,
                          assinaturaAtiva,
                          beneficios,
                          congelado: !testeAtivo && !assinaturaAtiva
                      });
                  } else {
                      setAcesso(prev => ({...prev, carregando: false}));
                  }
              } catch (error) {
                  console.error("Erro ao carregar permissões do menu:", error);
                  setAcesso(prev => ({...prev, carregando: false}));
              }
      });

      return () => {
          unsubscribe();
          if (unsubSnapshot) unsubSnapshot(); 
      };
  }, [auth]);

  // 🛡️ REGRA 1: A EMPRESA TEM ESSE RECURSO NO PLANO DELA?
  const verificarPermissaoPlano = (recursoExigido, label) => {
      if (isSuperAdmin) return true;
      // Início e Assinatura nunca ficam bloqueados para a empresa
      if (label === 'Início' || label === 'Assinatura') return true;
      if (acesso.congelado) return false;
      if (acesso.testeAtivo) return true; 
      if (!recursoExigido) return true; 
      
      return acesso.beneficios.some(b => b.toLowerCase().includes(recursoExigido.toLowerCase()));
  };

  // 🛡️ REGRA 2: O FUNCIONÁRIO PODE CLICAR AQUI?
  const verificarAcessoFuncionario = (label) => {
      if (isSuperAdmin || isDonoDaConta) return true;
      
      if (label === 'Financeiro' || label === 'Relatórios' || label === 'Assinatura') return false;
      if (label === 'Início') return true;

      const objPermissoes = permissoesAtivas || permissoesCache;
      
      if (!objPermissoes) return false;

      const removerAcentos = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const labelLimpa = removerAcentos(label);
      
      let valorEncontrado = null; 

      const base = objPermissoes.permissoes ? objPermissoes.permissoes : objPermissoes;

      if (Array.isArray(base)) {
          const arrNorm = base.map(removerAcentos);
          valorEncontrado = arrNorm.includes(labelLimpa);
      } else if (typeof base === 'object' && base !== null) {
          const chaves = Object.keys(base);
          for (let k of chaves) {
              if (removerAcentos(k) === labelLimpa) {
                  valorEncontrado = base[k];
                  break;
              }
          }
      }

      if (valorEncontrado !== null) return valorEncontrado === true;

      return false; 
  };

  const nomeExibicao = localStorage.getItem('funcName') || usuarioLogado?.displayName || (usuarioLogado?.email ? usuarioLogado.email.split('@')[0] : "Usuário");
  const cargoExibicao = isSuperAdmin ? "Super Admin" : (isDonoDaConta ? "Administrador" : (localStorage.getItem('userRole') || "Colaborador"));
  const fotoPerfil = usuarioLogado?.photoURL || null;
  const primeiraLetra = (nomeExibicao || 'U').charAt(0).toUpperCase();

  const ItemMenuProtegido = ({ to, icon, label, recurso }) => {
      const funcPodeVer = verificarAcessoFuncionario(label);
      const empresaPagou = verificarPermissaoPlano(recurso, label);

      // 🔥 LÓGICA DE CORES E BLOQUEIO:
      if (!funcPodeVer || !empresaPagou) {
          const mensagemBloqueio = !empresaPagou 
              ? "A sua empresa precisa de um plano ativo para acessar esta área."
              : "Você não tem permissão para acessar esta área. Solicite liberação ao administrador.";

          return (
              <div 
                  className="menu-item locked" 
                  title={mensagemBloqueio}
                  onClick={() => {
                      closeMenu();
                      if (!empresaPagou) {
                          alert("⏳ Período de testes expirado! Escolha um plano para liberar o acesso a todas as ferramentas do Celebre.");
                          navigate('/upgrade');
                      } else {
                          alert("🔒 Seu perfil de colaborador não possui acesso a esta área. Solicite ao administrador da empresa para liberar em Equipe.");
                      }
                  }}
                  role="button"
                  tabIndex={0}
              >
                  <div className="menu-item-main">
                      <div className="menu-icon-box">
                          <i className={icon}></i>
                      </div>
                      <span className="menu-label">{label}</span>
                  </div>
                  <span className={`menu-locked-badge ${!empresaPagou ? 'plan-expired' : 'role-locked'}`} title={!empresaPagou ? 'Requer Plano' : 'Sem Permissão'}>
                      <i className="fas fa-lock"></i>
                  </span>
              </div>
          );
      }

      // Tudo liberado e pago!
      return (
          <NavLink 
              to={to} 
              onClick={closeMenu} 
              className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}
          >
              <div className="menu-item-main">
                  <div className="menu-icon-box">
                      <i className={icon}></i>
                  </div>
                  <span className="menu-label">{label}</span>
              </div>
              <span className="menu-active-pill"></span>
          </NavLink>
      );
  };

  return (
    <>
      <button 
        type="button"
        className={`mobile-menu-btn ${isMobileMenuOpen ? "open" : ""}`} 
        onClick={toggleMenu}
        aria-label={isMobileMenuOpen ? "Fechar menu" : "Abrir menu"}
      >
        <i className={isMobileMenuOpen ? "fas fa-times" : "fas fa-bars"}></i>
      </button>

      <div 
        className={`sidebar-overlay ${isMobileMenuOpen ? "active" : ""}`} 
        onClick={closeMenu}
        aria-hidden="true"
      ></div>

      <aside className={`sidebar ${isMobileMenuOpen ? "mobile-open" : ""}`} aria-label="Navegação Lateral">
        
        {/* CABEÇALHO COM LOGO E BOTÃO FECHAR MOBILE */}
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <img src={logoCelebre} alt="Celebre" className="sidebar-brand-logo-img" />
            <div className="brand-text">
              <h1 className="brand-title">CELEBRE</h1>
              <span className="brand-subtitle">SISTEMA INTEGRADO</span>
            </div>
          </div>

          <button 
            type="button" 
            className="sidebar-mobile-close-btn" 
            onClick={closeMenu}
            aria-label="Fechar menu"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* NAVEGAÇÃO ORGANIZADA POR SEÇÕES */}
        <nav className="sidebar-nav custom-scrollbar">
          
          {/* SEÇÃO 1: PRINCIPAL */}
          <div className="sidebar-section">
            <span className="nav-section-title">Visão Geral</span>
            <ItemMenuProtegido to="/dashboard" icon="fas fa-th-large" label="Início" />
          </div>

          {/* SEÇÃO 2: OPERAÇÃO & GESTÃO */}
          <div className="sidebar-section">
            <span className="nav-section-title">Gestão & Acervo</span>
            <ItemMenuProtegido to="/agenda" icon="fas fa-calendar-alt" label="Agenda" recurso="Agenda" />
            <ItemMenuProtegido to="/clientes" icon="fas fa-users" label="Clientes" recurso="Gestão Clientes" />
            <ItemMenuProtegido to="/locacoes" icon="fas fa-hand-holding-heart" label="Locações" recurso="Gestão de Pedidos/ Orçamentos" />
            <ItemMenuProtegido to="/estoque" icon="fas fa-boxes" label="Estoque" recurso="Gestão de Estoque" />
          </div>

          {/* SEÇÃO 3: FINANCEIRO */}
          <div className="sidebar-section">
            <span className="nav-section-title">Financeiro & Controle</span>
            <ItemMenuProtegido to="/compras" icon="fas fa-shopping-cart" label="Compras" recurso="Gestão Fornecedores" />
            <ItemMenuProtegido to="/financeiro" icon="fas fa-money-bill-wave" label="Financeiro" recurso="Gestão Financeira" />
            <ItemMenuProtegido to="/relatorios" icon="fas fa-chart-line" label="Relatórios" recurso="Gestão de Relatórios" />
          </div>

          {/* SEÇÃO 4: LOGÍSTICA & CONTRATOS */}
          <div className="sidebar-section">
            <span className="nav-section-title">Serviços & Expansão</span>
            <ItemMenuProtegido to="/logistica" icon="fas fa-truck" label="Logística" recurso="Gestão de Logística" />
            <ItemMenuProtegido to="/contratos" icon="fas fa-file-contract" label="Contratos" recurso="Gestão de Contratos" />
            <ItemMenuProtegido to="/moodboard" icon="fas fa-palette" label="Moodboard" recurso="Moodboard- Projeto Digital" />
            <ItemMenuProtegido 
                to={usuarioLogado ? `/catalogo/${localStorage.getItem('tenantId') || usuarioLogado?.uid}` : "/catalogo"} 
                icon="fas fa-store" 
                label="Catálogo" 
                recurso="Catalago Digital" 
            />
          </div>

          {/* SEÇÃO 5: PAINEL MASTER (SUPER ADMIN) */}
          {isSuperAdmin && (
            <div className="sidebar-section master-section">
              <span className="nav-section-title master-title">
                <i className="fas fa-shield-alt"></i> Painel Master
              </span>
              
              <NavLink 
                to="/admin-planos" 
                onClick={closeMenu} 
                className={({ isActive }) => isActive ? "menu-item active master-item" : "menu-item master-item"}
              >
                <div className="menu-item-main">
                  <div className="menu-icon-box master-icon">
                    <i className="fas fa-tools"></i>
                  </div>
                  <span className="menu-label">Gerenciar Planos</span>
                </div>
                <span className="menu-active-pill"></span>
              </NavLink>

              <NavLink 
                to="/gestao-usuarios" 
                onClick={closeMenu} 
                className={({ isActive }) => isActive ? "menu-item active master-item" : "menu-item master-item"}
              >
                <div className="menu-item-main">
                  <div className="menu-icon-box master-icon">
                    <i className="fas fa-user-shield"></i>
                  </div>
                  <span className="menu-label">Controle Geral</span>
                </div>
                <span className="menu-active-pill"></span>
              </NavLink>
            </div>
          )}

        </nav>

        {/* RODAPÉ EXECUTIVO (USUÁRIO E STATUS) */}
        <div className="sidebar-footer">
          <div 
            className="sidebar-user-card" 
            onClick={() => { closeMenu(); navigate('/perfil'); }}
            title="Ver meu perfil"
          >
            <div className="sidebar-user-avatar">
              {fotoPerfil ? (
                <img src={fotoPerfil} alt={nomeExibicao} />
              ) : (
                <span>{primeiraLetra}</span>
              )}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{nomeExibicao}</span>
              <span className="sidebar-user-role">
                <span className="user-status-dot"></span>
                {cargoExibicao}
              </span>
            </div>
            <button 
              type="button" 
              className="btn-sidebar-gear"
              onClick={(e) => {
                e.stopPropagation();
                closeMenu();
                navigate('/configuracoes');
              }}
              title="Configurações do Sistema"
              aria-label="Configurações"
            >
              <i className="fas fa-cog"></i>
            </button>
          </div>
        </div>

      </aside>
    </>
  );
};

export default Navbar;