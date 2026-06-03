import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { getAuth, onAuthStateChanged } from 'firebase/auth'; 
import { doc, getDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore'; 
import { db } from '../firebaseConfig';
import "./Navbar.css";

const Navbar = () => {
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
  const usuarioLogado = auth.currentUser;
  
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

      const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
          if (user) {
              try {
                  const qFunc = query(collection(db, "equipe"), where("email", "==", user.email));
                  const snapFunc = await getDocs(qFunc);
                  
                  const isFuncionarioReal = !snapFunc.empty;
                  
                  setIsDonoDaConta(!isFuncionarioReal);

                  let idParaBusca = user.uid;

                  if (isFuncionarioReal) {
                      const funcDoc = snapFunc.docs[0]; 
                      const dadosFunc = funcDoc.data();
                      
                      unsubSnapshot = onSnapshot(doc(db, "equipe", funcDoc.id), (docSnap) => {
                          if (docSnap.exists()) setPermissoesAtivas(docSnap.data());
                      });

                      if (dadosFunc.empresaId) {
                          idParaBusca = dadosFunc.empresaId;
                          localStorage.setItem('tenantId', idParaBusca); 
                      }
                  } else {
                      localStorage.setItem('userRole', 'admin');
                      localStorage.setItem('tenantId', user.uid);
                      idParaBusca = user.uid;
                  }

                  const userSnap = await getDoc(doc(db, "usuarios", idParaBusca));

                  if (userSnap.exists()) {
                      const dados = userSnap.data();
                      let testeAtivo = false;
                      if (dados.dataFimTeste) {
                          testeAtivo = new Date() <= new Date(dados.dataFimTeste);
                      }
                      
                      const assinaturaAtiva = dados.assinaturaAtiva === true || dados.plano === 'pago' || dados.statusPagamentoVulso === 'pago';
                      
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
          }
      });

      return () => {
          unsubscribeAuth();
          if (unsubSnapshot) unsubSnapshot(); 
      };
  }, [auth]);

  // 🛡️ REGRA 1: A EMPRESA TEM ESSE RECURSO NO PLANO DELA?
  const verificarPermissaoPlano = (recursoExigido) => {
      if (isSuperAdmin) return true;
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

  const ItemMenuProtegido = ({ to, icon, label, recurso }) => {
      
      const funcPodeVer = verificarAcessoFuncionario(label);
      const empresaPagou = verificarPermissaoPlano(recurso);

      // 🔥 LÓGICA DE CORES: Se NÃO tem permissão ou a empresa NÃO pagou, mostra o cadeado!
      if (!funcPodeVer || !empresaPagou) {
          
          // Se a empresa não pagou, o bloqueio é do plano (Vermelho). Caso contrário, é da gestão (Branco).
          const corCadeado = !empresaPagou ? '#ef4444' : '#ffffff';

          const mensagemBloqueio = !empresaPagou 
              ? "A sua empresa precisa de um plano superior para acessar esta área."
              : "Você não tem permissão para acessar esta área. Solicite liberação ao administrador.";

          return (
              <div className="menu-item locked" title={mensagemBloqueio}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                      <i className={icon}></i> <span style={{ opacity: 0.6 }}>{label}</span>
                  </div>
                  <i className="fas fa-lock lock-icon" style={{ color: corCadeado }}></i>
              </div>
          );
      }

      // Tudo liberado e pago!
      return (
          <NavLink to={to} onClick={closeMenu} className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
              <i className={icon}></i> <span>{label}</span>
          </NavLink>
      );
  };

  return (
    <>
      <button className="mobile-menu-btn" onClick={toggleMenu}>
        <i className={isMobileMenuOpen ? "fas fa-times" : "fas fa-bars"}></i>
      </button>

      <div className={`sidebar-overlay ${isMobileMenuOpen ? "active" : ""}`} onClick={closeMenu}></div>

      <div className={`sidebar ${isMobileMenuOpen ? "mobile-open" : ""}`}>
        
        <div className="sidebar-logo">
          <h1>CELEBRE</h1>
        </div>

        <nav className="sidebar-nav">
          
          <ItemMenuProtegido to="/dashboard" icon="fas fa-th-large" label="Início" />

          <div className="sidebar-divider"></div>

          <ItemMenuProtegido to="/agenda" icon="fas fa-calendar-alt" label="Agenda" recurso="Agenda" />
          <ItemMenuProtegido to="/clientes" icon="fas fa-users" label="Clientes" recurso="Gestão Clientes" />
          <ItemMenuProtegido to="/locacoes" icon="fas fa-hand-holding-heart" label="Locações" recurso="Gestão de Pedidos/ Orçamentos" />
          <ItemMenuProtegido to="/estoque" icon="fas fa-boxes" label="Estoque" recurso="Gestão de Estoque" />

          <div className="sidebar-divider"></div>

          <ItemMenuProtegido to="/compras" icon="fas fa-shopping-cart" label="Compras" recurso="Gestão Fornecedores" />
          <ItemMenuProtegido to="/financeiro" icon="fas fa-money-bill-wave" label="Financeiro" recurso="Gestão Financeira" />
          <ItemMenuProtegido to="/relatorios" icon="fas fa-chart-line" label="Relatórios" recurso="Gestão de Relatórios" />

          <div className="sidebar-divider"></div>

          <ItemMenuProtegido to="/logistica" icon="fas fa-truck" label="Logística" recurso="Gestão de Logística" />
          <ItemMenuProtegido to="/contratos" icon="fas fa-file-contract" label="Contratos" recurso="Gestão de Contratos" />
          <ItemMenuProtegido to="/moodboard" icon="fas fa-palette" label="Moodboard" recurso="Moodboard- Projeto Digital" />
          
          <ItemMenuProtegido 
              to={usuarioLogado ? `/catalogo/${localStorage.getItem('tenantId') || usuarioLogado?.uid}` : "/catalogo"} 
              icon="fas fa-store" 
              label="Catálogo" 
              recurso="Catalago Digital" 
          />

          {!isSuperAdmin ? (
            <>
              {/* O Funcionário não vê a aba de Assinatura, o admin vê */}
              <div className="sidebar-divider"></div>
              <ItemMenuProtegido to="/planos" icon="fas fa-star" label="Assinatura" />
            </>
          ) : (
            <>
              <div className="sidebar-divider" style={{ borderTop: '2px solid #c5a059' }}></div>
              <p style={{ color: '#c5a059', fontSize: '11px', marginLeft: '20px', fontWeight: 'bold' }}>PAINEL MASTER</p>
              
              <NavLink to="/admin-planos" onClick={closeMenu} className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
                <i className="fas fa-tools"></i> <span>Gerenciar Planos</span>
              </NavLink>

              <NavLink to="/gestao-usuarios" onClick={closeMenu} className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
                <i className="fas fa-user-shield"></i> <span>Controle Geral</span>
              </NavLink>
            </>
          )}

        </nav>
      </div>
    </>
  );
};

export default Navbar;