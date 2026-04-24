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
  const emailAdmin = "celebrefesta25@gmail.com";

  const isSuperAdmin = usuarioLogado?.email === emailAdmin;

  const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMenu = () => setIsMobileMenuOpen(false);

  useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (user) {
              try {
                  const userSnap = await getDoc(doc(db, "usuarios", user.uid));
                  if (userSnap.exists()) {
                      const dados = userSnap.data();
                      
                      let testeAtivo = false;
                      if (dados.dataFimTeste) {
                          testeAtivo = new Date() <= new Date(dados.dataFimTeste);
                      }
                      
                      const assinaturaAtiva = dados.assinaturaAtiva === true;
                      
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
                  }
              } catch (error) {
                  console.error("Erro ao carregar permissões do menu:", error);
              }
          }
      });
      return () => unsubscribe();
  }, [auth]);

  const verificarPermissao = (recursoExigido) => {
      if (isSuperAdmin) return true; 
      if (acesso.congelado) return false; 
      if (acesso.testeAtivo) return true; 
      if (!recursoExigido) return true; 
      
      return acesso.beneficios.some(b => b.toLowerCase().includes(recursoExigido.toLowerCase()));
  };

  const ItemMenuProtegido = ({ to, icon, label, recurso }) => {
      const liberado = verificarPermissao(recurso);

      if (!liberado) {
          return (
              <div 
                  className="menu-item locked" 
                  style={{ 
                      opacity: 0.5, 
                      cursor: 'not-allowed', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      padding: '12px 20px',
                      color: '#64748b'
                  }}
                  title="Você precisa escolher um plano para acessar esta área."
              >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <i className={icon}></i> <span>{label}</span>
                  </div>
                  <i className="fas fa-lock" style={{ fontSize: '12px', color: '#94a3b8' }}></i>
              </div>
          );
      }

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

      <div 
        className={`sidebar-overlay ${isMobileMenuOpen ? "active" : ""}`} 
        onClick={closeMenu}
      ></div>

      <div className={`sidebar ${isMobileMenuOpen ? "mobile-open" : ""}`}>
        
        <div className="sidebar-logo">
          <h1 style={{ color: '#c5a059', textAlign: 'center', margin: '20px 0' }}>CELEBRE</h1>
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
              to={usuarioLogado ? `/catalogo/${usuarioLogado.uid}` : "/catalogo"} 
              icon="fas fa-store" 
              label="Catálogo" 
              recurso="Catalago Digital" 
          />

          {!isSuperAdmin ? (
            <>
              <div className="sidebar-divider"></div>
              <NavLink to="/planos" onClick={closeMenu} className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
                <i className="fas fa-star" style={{ color: '#c5a059' }}></i> <span style={{ fontWeight: 'bold' }}>Assinatura</span>
              </NavLink>
            </>
          ) : (
            <>
              <div className="sidebar-divider" style={{ borderTop: '2px solid #c5a059' }}></div>
              <p style={{ color: '#c5a059', fontSize: '11px', marginLeft: '20px', fontWeight: 'bold' }}>PAINEL MASTER</p>
              
              <NavLink 
                to="/admin-planos" 
                onClick={closeMenu} 
                className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}
                style={{ color: '#c5a059' }}
              >
                <i className="fas fa-tools"></i> <span>Gerenciar Planos</span>
              </NavLink>

              <NavLink 
                to="/gestao-usuarios"
                onClick={closeMenu} 
                className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}
              >
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