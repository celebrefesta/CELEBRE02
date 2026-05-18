import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { getAuth, onAuthStateChanged } from 'firebase/auth'; 
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import "./Navbar.css";

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [acesso, setAcesso] = useState({
      carregando: true,
      testeAtivo: false,
      assinaturaAtiva: false,
      beneficios: [],
      congelado: false
  });

  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  
  // Identificação da Super-Admin (Você)
  const emailAdmin = "celebrefesta25@gmail.com";
  const isSuperAdmin = usuarioLogado?.email === emailAdmin;

  const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMenu = () => setIsMobileMenuOpen(false);

  // 🔥 IDENTIFICAÇÃO DO SAAS
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;
  const userRole = localStorage.getItem('userRole') || 'admin';
  let permissoesFuncionario = {};
  
  try {
      permissoesFuncionario = JSON.parse(localStorage.getItem('userPermissions') || '{}');
  } catch (e) {
      permissoesFuncionario = {};
  }

  useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
              try {
                  // 🔥 Lê o plano do DONO DA CONTA (tenantId), não do funcionário
                  const idParaBusca = localStorage.getItem('tenantId') || user.uid;
                  const userSnap = await getDoc(doc(db, "usuarios", idParaBusca));

                  if (userSnap.exists()) {
                      const dados = userSnap.data();
                      
                      let testeAtivo = false;
                      if (dados.dataFimTeste) {
                          testeAtivo = new Date() <= new Date(dados.dataFimTeste);
                      }
                      
                      // Aceita plano "pago" ou statusAssinatura "ativa"
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
      return () => unsubscribe();
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
      if (isSuperAdmin || userRole === 'admin') return true;
      
      const mapPermissoes = {
          'Agenda': permissoesFuncionario.agenda,
          'Clientes': permissoesFuncionario.clientes,
          'Locações': permissoesFuncionario.locacoes,
          'Estoque': permissoesFuncionario.estoque,
          'Compras': permissoesFuncionario.compras,
          'Logística': permissoesFuncionario.logistica,
          'Contratos': permissoesFuncionario.contratos,
          'Catálogo': permissoesFuncionario.catalogo,
          'Moodboard': permissoesFuncionario.moodboard,
          'Início': true 
      };

      // Áreas PROIBIDAS para funcionários (segurança máxima)
      if (label === 'Financeiro' || label === 'Relatórios' || label === 'Assinatura') {
          return false;
      }

      if (mapPermissoes[label] !== undefined) {
          return mapPermissoes[label] === true;
      }

      return true; 
  };

  const ItemMenuProtegido = ({ to, icon, label, recurso }) => {
      
      const empresaPagou = verificarPermissaoPlano(recurso);
      const funcPodeVer = verificarAcessoFuncionario(label);

      // 🔥 MUDANÇA DE ESTRATÉGIA SaaS:
      // Se a empresa NÃO pagou, mostra o cadeado para TODOS verem que o recurso existe!
      if (!empresaPagou) {
          return (
              <div className="menu-item locked" title="A sua empresa precisa de um plano superior para acessar esta área.">
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                      <i className={icon}></i> <span>{label}</span>
                  </div>
                  <i className="fas fa-lock lock-icon"></i>
              </div>
          );
      }

      // Se a empresa pagou, mas este funcionário específico NÃO tem permissão, esconde o botão para ele não fazer asneira.
      if (!funcPodeVer) return null;

      // Tudo certo! Mostra o botão normal
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
              to={usuarioLogado ? `/catalogo/${tenantId}` : "/catalogo"} 
              icon="fas fa-store" 
              label="Catálogo" 
              recurso="Catalago Digital" 
          />

          {!isSuperAdmin ? (
            <>
              {/* O Funcionário não vê a aba de Assinatura (ocultada via inteligência), o admin vê */}
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