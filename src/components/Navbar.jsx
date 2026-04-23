import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { getAuth } from 'firebase/auth';
import "./Navbar.css";

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const emailAdmin = "celebrefesta25@gmail.com";

  // Verifica se quem está logado é a Camila (Dona)
  const isSuperAdmin = usuarioLogado?.email === emailAdmin;

  const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMenu = () => setIsMobileMenuOpen(false);

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
          {/* LINKS COMUNS A TODOS */}
          <NavLink to="/dashboard" onClick={closeMenu} className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
            <i className="fas fa-th-large"></i> <span>Início</span>
          </NavLink>

          <div className="sidebar-divider"></div>

          <NavLink to="/agenda" onClick={closeMenu} className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
            <i className="fas fa-calendar-alt"></i> <span>Agenda</span>
          </NavLink>

          <NavLink to="/clientes" onClick={closeMenu} className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
            <i className="fas fa-users"></i> <span>Clientes</span>
          </NavLink>

          <NavLink to="/locacoes" onClick={closeMenu} className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
            <i className="fas fa-hand-holding-heart"></i> <span>Locações</span>
          </NavLink>

          <NavLink to="/estoque" onClick={closeMenu} className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
            <i className="fas fa-boxes"></i> <span>Estoque</span>
          </NavLink>

          <div className="sidebar-divider"></div>

          <NavLink to="/compras" onClick={closeMenu} className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
            <i className="fas fa-shopping-cart"></i> <span>Compras</span>
          </NavLink>

          <NavLink to="/financeiro" onClick={closeMenu} className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
            <i className="fas fa-money-bill-wave"></i> <span>Financeiro</span>
          </NavLink>

          <NavLink to="/relatorios" onClick={closeMenu} className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
            <i className="fas fa-chart-line"></i> <span>Relatórios</span>
          </NavLink>

          <div className="sidebar-divider"></div>

          <NavLink to="/logistica" onClick={closeMenu} className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
            <i className="fas fa-truck"></i> <span>Logística</span>
          </NavLink>

          <NavLink to="/contratos" onClick={closeMenu} className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
            <i className="fas fa-file-contract"></i> <span>Contratos</span>
          </NavLink>

          <NavLink to="/moodboard" onClick={closeMenu} className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
            <i className="fas fa-palette"></i> <span>Moodboard</span>
          </NavLink>

          <NavLink to={usuarioLogado ? `/catalogo/${usuarioLogado.uid}` : "/catalogo"} 
            onClick={closeMenu} 
            className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
            <i className="fas fa-store"></i> <span>Catálogo</span>
          </NavLink>

          {/* ------------------------------------------------------------------- */}
          {/* LÓGICA DE VISIBILIDADE CONDICIONAL */}
          {/* ------------------------------------------------------------------- */}

          {!isSuperAdmin ? (
            // O QUE O CLIENTE VÊ (Assinatura/Teste)
            <>
              <div className="sidebar-divider"></div>
              <NavLink to="/planos" onClick={closeMenu} className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
                <i className="fas fa-star"></i> <span>Assinatura</span>
              </NavLink>
            </>
          ) : (
            // O QUE SÓ A CAMILA VÊ (Centro do Sistema)
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
                to="/gestao-usuarios" // Exemplo: se quiser criar uma futura página de ver todos os clientes
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