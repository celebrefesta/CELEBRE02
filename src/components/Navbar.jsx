import React from "react";
import { NavLink } from "react-router-dom";
import "./Navbar.css"; 

const Navbar = () => {
  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <h1 style={{ color: '#c5a059', textAlign: 'center', margin: '20px 0' }}>CELEBRE</h1>
      </div>

      <nav className="sidebar-nav">
        {/* --- INÍCIO --- */}
        <NavLink to="/" className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
          <i className="fas fa-th-large"></i> <span>Início</span>
        </NavLink>

        <div className="sidebar-divider"></div>

        {/* --- GRUPO 1: ATENDIMENTO & VENDAS --- */}
        <NavLink to="/agenda" className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
          <i className="fas fa-calendar-alt"></i> <span>Agenda</span>
        </NavLink>

        <NavLink to="/clientes" className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
          <i className="fas fa-users"></i> <span>Clientes</span>
        </NavLink>

        <NavLink to="/locacoes" className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
          <i className="fas fa-hand-holding-heart"></i> <span>Locações</span>
        </NavLink>

        <NavLink to="/estoque" className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
          <i className="fas fa-boxes"></i> <span>Estoque</span>
        </NavLink>

        <div className="sidebar-divider"></div>

        {/* --- GRUPO 2: GESTÃO & FINANÇAS --- */}
        <NavLink to="/compras" className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
          <i className="fas fa-shopping-cart"></i> <span>Compras</span>
        </NavLink>

        <NavLink to="/financeiro" className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
          <i className="fas fa-money-bill-wave"></i> <span>Financeiro</span>
        </NavLink>

        <NavLink to="/relatorios" className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
          <i className="fas fa-chart-line"></i> <span>Relatórios</span>
        </NavLink>

        <div className="sidebar-divider"></div>

        {/* --- GRUPO 3: OPERAÇÃO & CRIAÇÃO --- */}
        <NavLink to="/logistica" className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
          <i className="fas fa-truck"></i> <span>Logística</span>
        </NavLink>

        <NavLink to="/contratos" className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
          <i className="fas fa-file-contract"></i> <span>Contratos</span>
        </NavLink>

        <NavLink to="/moodboard" className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
          <i className="fas fa-palette"></i> <span>Moodboard</span>
        </NavLink>

        {/* 🌟 AQUI ESTÁ O NOVO BOTÃO DO CATÁLOGO 🌟 */}
        <NavLink to="/catalogo" className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
          <i className="fas fa-store"></i> <span>Catálogo</span>
        </NavLink>

        <div className="sidebar-divider"></div>

        {/* --- SISTEMA --- */}
        <NavLink to="/perfil" className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
          <i className="fas fa-user-circle"></i> <span>Meu Perfil</span>
        </NavLink>

        <NavLink to="/configuracoes" className={({ isActive }) => isActive ? "menu-item active" : "menu-item"}>
          <i className="fas fa-cog"></i> <span>Configurações</span>
        </NavLink>
      </nav>
    </div>
  );
};

export default Navbar;