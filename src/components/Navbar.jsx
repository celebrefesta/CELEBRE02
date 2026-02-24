import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import "./Navbar.css"; 

const Navbar = () => {
  // 🌟 Estado para controlar se o menu está aberto no celular
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Função para abrir/fechar o menu
  const toggleMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  // Função para fechar o menu ao clicar em um link
  const closeMenu = () => setIsMobileMenuOpen(false);

  return (
    <>
      {/* 🌟 BOTÃO HAMBÚRGUER (Aparece apenas no mobile via CSS) */}
      <button className="mobile-menu-btn" onClick={toggleMenu}>
        <i className={isMobileMenuOpen ? "fas fa-times" : "fas fa-bars"}></i>
      </button>

      {/* 🌟 OVERLAY (Fundo escuro que fecha o menu ao clicar fora) */}
      <div 
        className={`sidebar-overlay ${isMobileMenuOpen ? "active" : ""}`} 
        onClick={closeMenu}
      ></div>

      {/* 🌟 SIDEBAR (Recebe a classe mobile-open se o estado for true) */}
      <div className={`sidebar ${isMobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-logo">
          <h1 style={{ color: '#c5a059', textAlign: 'center', margin: '20px 0' }}>CELEBRE</h1>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/" onClick={closeMenu} className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
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

          <NavLink to="/catalogo" onClick={closeMenu} className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
            <i className="fas fa-store"></i> <span>Catálogo</span>
          </NavLink>

          <div className="sidebar-divider"></div>

          <NavLink to="/perfil" onClick={closeMenu} className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
            <i className="fas fa-user-circle"></i> <span>Meu Perfil</span>
          </NavLink>

          <NavLink to="/configuracoes" onClick={closeMenu} className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
            <i className="fas fa-cog"></i> <span>Configurações</span>
          </NavLink>
        </nav>
      </div>
    </>
  );
};

export default Navbar;