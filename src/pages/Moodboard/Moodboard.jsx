import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { collection, getDocs, getDoc, setDoc, query, addDoc, deleteDoc, doc, where, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom'; 
import { db } from '../../firebaseConfig';
import { getAuth } from 'firebase/auth';
import html2canvas from 'html2canvas'; 
import { gerarPropostaMoodboardPDF } from '../../utils/gerarPropostaMoodboardPDF';
import './Moodboard.css';

// 🎨 Ícones SVG do Celebre Studio 3.0
const Icons = {
  Crown: (props) => <svg {...props} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>,
  Couch: (props) => <svg {...props} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12h20v8H2zm0 0l2-6h16l2 6M6 16v4m12-4v4"/></svg>,
  Type: (props) => <svg {...props} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>,
  Layers: (props) => <svg {...props} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>,
  Magic: (props) => <svg {...props} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>,
  Shapes: (props) => <svg {...props} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="7" cy="7" r="4"/><rect x="13" y="3" width="8" height="8" rx="1"/><polygon points="7 14 11 21 3 21"/></svg>,
  Save: (props) => <svg {...props} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>,
  Folder: (props) => <svg {...props} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>,
  Trash: (props) => <svg {...props} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
  Download: (props) => <svg {...props} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>,
  FileText: (props) => <svg {...props} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>,
  ShoppingBag: (props) => <svg {...props} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>,
  ShoppingCart: (props) => <svg {...props} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
  Undo: (props) => <svg {...props} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path></svg>,
  Redo: (props) => <svg {...props} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 7v6h-6"></path><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"></path></svg>,
  Copy: (props) => <svg {...props} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>,
  ZoomIn: (props) => <svg {...props} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>,
  ZoomOut: (props) => <svg {...props} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>,
  Search: (props) => <svg {...props} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  Lock: (props) => <svg {...props} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>,
  Unlock: (props) => <svg {...props} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>,
  Rotate: (props) => <svg {...props} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/></svg>,
  Flip: (props) => <svg {...props} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12l-4-4m4 4l-4 4m4-4H9m-4 0l4-4m-4 4l4 4m-4-4h10"/></svg>,
  Bold: (props) => <svg {...props} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path></svg>,
  Italic: (props) => <svg {...props} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="4" x2="10" y2="4"></line><line x1="14" y1="20" x2="5" y2="20"></line><line x1="15" y1="4" x2="9" y2="20"></line></svg>,
  ArrowUp: (props) => <svg {...props} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>,
  ArrowDown: (props) => <svg {...props} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>,
  AlignHorizontal: (props) => <svg {...props} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="2" x2="12" y2="22"></line><rect x="4" y="6" width="16" height="4" rx="1"></rect><rect x="6" y="14" width="12" height="4" rx="1"></rect></svg>,
  AlignBottom: (props) => <svg {...props} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="2" y1="22" x2="22" y2="22"></line><rect x="4" y="8" width="6" height="10" rx="1"></rect><rect x="14" y="4" width="6" height="14" rx="1"></rect></svg>,
  Image: (props) => <svg {...props} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  Move: (props) => <svg {...props} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>,
  Sparkles: (props) => <svg {...props} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l1.912 5.885L20 10l-4.885 3.912L17 20l-5-3.885L7 20l1.885-6.088L4 10l6.088-1.115L12 3z"/></svg>,
  Lightbulb: (props) => <svg {...props} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-7 7c0 2.5 1.5 4.5 3 6h8c1.5-1.5 3-3.5 3-6a7 7 0 0 0-7-7z"/></svg>,
  Maximize: (props) => <svg {...props} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>,
  Minimize: (props) => <svg {...props} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></svg>,
  Eye: (props) => <svg {...props} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>,
  Sliders: (props) => <svg {...props} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>,
  Layers: (props) => <svg {...props} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
};

// 🎈 Categorias da Galeria de Cenografia & Inspirações
const CATEGORIAS_BIBLIOTECA_MOODBOARD = [
  { id: 'todas', label: 'Todas', icon: 'fas fa-border-all' },
  { id: 'Baloes', label: '🎈 Balões', icon: 'fas fa-circle' },
  { id: 'Paineis', label: '🏛️ Painéis', icon: 'fas fa-archway' },
  { id: 'Flores', label: '🌸 Flores', icon: 'fas fa-spa' },
  { id: 'Moveis', label: '🛋️ Móveis', icon: 'fas fa-couch' },
  { id: 'Letreiros', label: '✨ LED', icon: 'fas fa-bolt' },
  { id: 'Outros', label: '📦 Outros', icon: 'fas fa-box' }
];

// 🎨 Paleta Especializada de Cores para Filtro Visual de Arcos e Peças
const PALETA_CORES_MOODBOARD = [
  { id: 'todas', label: 'Todas', cor: 'linear-gradient(135deg, #ef4444, #3b82f6, #10b981, #f59e0b)' },
  { id: 'holografico', label: 'Holográfico', cor: 'linear-gradient(135deg, #a5f3fc 0%, #fbcfe8 35%, #fef08a 70%, #c084fc 100%)' },
  { id: 'neon', label: 'Neon', cor: 'linear-gradient(135deg, #22c55e 0%, #38bdf8 33%, #ec4899 66%, #eab308 100%)' },
  { id: 'dourado', label: 'Dourado', cor: '#eab308' },
  { id: 'rose_gold', label: 'Rose Gold', cor: '#e0a899' },
  { id: 'prata', label: 'Prata', cor: '#94a3b8' },
  { id: 'cobre', label: 'Cobre', cor: '#b45309' },
  { id: 'branco', label: 'Branco', cor: '#ffffff', borda: '#cbd5e1' },
  { id: 'cinza_grafite', label: 'Grafite', cor: '#64748b' },
  { id: 'preto', label: 'Preto', cor: '#0f172a' },
  { id: 'nude', label: 'Nude/Bege', cor: '#d7b899' },
  { id: 'marrom', label: 'Marrom', cor: '#78350f' },
  { id: 'terracota', label: 'Terracota', cor: '#c2410c' },
  { id: 'azul_bebe', label: 'Azul Bebê', cor: '#93c5fd' },
  { id: 'azul_royal', label: 'Azul Royal', cor: '#2563eb' },
  { id: 'azul_marinho', label: 'Marinho', cor: '#1e3a8a' },
  { id: 'azul_tiffany', label: 'Tiffany', cor: '#2dd4bf' },
  { id: 'rosa_bebe', label: 'Rosa Bebê', cor: '#fbcfe8' },
  { id: 'rosa_pink', label: 'Pink', cor: '#ec4899' },
  { id: 'vermelho', label: 'Vermelho', cor: '#ef4444' },
  { id: 'vinho', label: 'Marsala', cor: '#881337' },
  { id: 'verde_safari', label: 'Safari', cor: '#15803d' },
  { id: 'verde_oliva', label: 'Oliva', cor: '#4d7c0f' },
  { id: 'verde_menta', label: 'Menta', cor: '#6ee7b7' },
  { id: 'verde_lima', label: 'Lima', cor: '#84cc16' },
  { id: 'mostarda', label: 'Mostarda', cor: '#ca8a04' },
  { id: 'amarelo_bebe', label: 'Amarelo Bebê', cor: '#fef08a' },
  { id: 'amarelo', label: 'Amarelo', cor: '#facc15' },
  { id: 'laranja', label: 'Laranja', cor: '#f97316' },
  { id: 'salmao', label: 'Salmão', cor: '#fb923c' },
  { id: 'lilas', label: 'Lilás', cor: '#c084fc' },
  { id: 'roxo', label: 'Roxo', cor: '#7e22ce' }
];

// 🧱 Presets Nativos de Cenografia
const PRESETS_PAREDE_PADRAO = [
  { nome: 'Ripado Madeira Nobre', url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=1200&auto=format&fit=crop' },
  { nome: 'Boiserie Branco Clássico', url: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?q=80&w=1200&auto=format&fit=crop' },
  { nome: 'Muro Inglês / Folhagem', url: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?q=80&w=1200&auto=format&fit=crop' },
  { nome: 'Cortina Luzes LED', url: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?q=80&w=1200&auto=format&fit=crop' },
  { nome: 'Tijolinho Branco Rústico', url: 'https://images.unsplash.com/photo-1558611997-0950a7cf6161?q=80&w=1200&auto=format&fit=crop' },
  { nome: 'Rose Gold Metálico', url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?q=80&w=1200&auto=format&fit=crop' },
  { nome: 'Mármore Carrara Ouro', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1200&auto=format&fit=crop' },
  { nome: 'Sunset Pastel Encantado', url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1200&auto=format&fit=crop' }
];

const PRESETS_CHAO_PADRAO = [
  { nome: 'Piso Vinílico Carvalho', url: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?q=80&w=1200&auto=format&fit=crop' },
  { nome: 'Mármore Carrara Polido', url: 'https://images.unsplash.com/photo-1563298723-dcfebaa392e3?q=80&w=1200&auto=format&fit=crop' },
  { nome: 'Grama Sintética Jardim', url: 'https://images.unsplash.com/photo-1533460004989-acf29222263f?q=80&w=1200&auto=format&fit=crop' },
  { nome: 'Tapete Redondo Boho', url: 'https://images.unsplash.com/photo-1600121848594-d8644e57abab?q=80&w=1200&auto=format&fit=crop' },
  { nome: 'Piso Preto Espelhado Luxury', url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?q=80&w=1200&auto=format&fit=crop' }
];

// 🎨 Presets de Capas de Tecido Sublimado para Painéis e Cilindros
const PRESETS_CAPAS_TEGIDO = [
  { nome: 'Ripado Madeira Nobre', url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=800&auto=format&fit=crop' },
  { nome: 'Mármore & Filetes Ouro', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=800&auto=format&fit=crop' },
  { nome: 'Glitter Dourado Luxury', url: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?q=80&w=800&auto=format&fit=crop' },
  { nome: 'Rose Gold Acetinado', url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?q=80&w=800&auto=format&fit=crop' },
  { nome: 'Folhagem Safari / Tropical', url: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?q=80&w=800&auto=format&fit=crop' },
  { nome: 'Céu Noturno & Estrelas', url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=800&auto=format&fit=crop' },
  { nome: 'Tijolinho Rústico Branco', url: 'https://images.unsplash.com/photo-1558611997-0950a7cf6161?q=80&w=800&auto=format&fit=crop' }
];

// 🎈 Paletas de Balões Profissionais para Decoração
const PALETAS_BALOES = [
  { nome: 'Rose Gold & Nude Chic', cores: ['#b76e79', '#dfb6b2', '#f4e6d4', '#c5a059', '#ffffff'] },
  { nome: 'Candy Macaron Pastel', cores: ['#ffb7b2', '#b5ead7', '#c7ceea', '#ffdac1', '#e2f0cb'] },
  { nome: 'Safari & Eucalipto', cores: ['#c86446', '#e09f67', '#6b8e23', '#435d43', '#f7f2e7'] },
  { nome: 'Navy Blue & Ouro Nobre', cores: ['#0f172a', '#1e3a8a', '#c5a059', '#94a3b8', '#ffffff'] },
  { nome: 'Black & Gold Luxury', cores: ['#090d16', '#262626', '#c5a059', '#f59e0b', '#ffffff'] },
  { nome: 'Lavanda & Lilás Encantado', cores: ['#9d4edd', '#c77dff', '#e0aaff', '#d4af37', '#ffffff'] }
];

// 🎈 Galeria de Arcos & Cenografia carregada dinamicamente do Firestore (moodboard_elementos)

// 🎈 Componente SVG de Guirlanda & Arcos de Balões 3D Realistas (Clássico & Orgânico)
const GuirlandaBaloesRealista = ({ tipo = 'lateral_l', cores = ['#b76e79', '#dfb6b2', '#f4e6d4', '#c5a059', '#ffffff'] }) => {
  
  // 1. 🏛️ ARCO CLÁSSICO / TRADICIONAL COMPLETO (Portal 2,4m de Clusters de 4 Balões Tetras)
  const gerarArcoClassicoPortal = () => {
    const baloes = [];
    const rBalao = 18;
    const numLeft = 6;
    const numCurve = 16;
    const numRight = 6;

    const clusters = [];
    // Coluna Esquerda (de baixo para cima)
    for (let i = 0; i < numLeft; i++) {
      clusters.push({ x: 50, y: 305 - i * 26, clusterIdx: i });
    }
    // Curva Superior (Semicírculo Perfeito)
    const centerX = 180;
    const centerY = 145;
    const radius = 130;
    for (let i = 0; i <= numCurve; i++) {
      const angle = Math.PI - (i / numCurve) * Math.PI;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY - radius * Math.sin(angle);
      clusters.push({ x, y, clusterIdx: numLeft + i });
    }
    // Coluna Direita (de cima para baixo)
    for (let i = 0; i < numRight; i++) {
      clusters.push({ x: 310, y: 175 + i * 26, clusterIdx: numLeft + numCurve + 1 + i });
    }

    // Cada cluster é composto por 4 balões cruzados (padrão espiral profissional de festa)
    clusters.forEach((c) => {
      const offsets = [
        { dx: -10, dy: -8, r: rBalao, cOffset: 0 },
        { dx: 10, dy: -8, r: rBalao, cOffset: 1 },
        { dx: -10, dy: 8, r: rBalao, cOffset: 2 },
        { dx: 10, dy: 8, r: rBalao, cOffset: 3 }
      ];
      offsets.forEach((off) => {
        baloes.push({
          cx: Math.round(c.x + off.dx),
          cy: Math.round(c.y + off.dy),
          r: off.r,
          c: (c.clusterIdx + off.cOffset) % cores.length
        });
      });
    });

    return baloes;
  };

  // 2. 💫 ARCO ORGÂNICO PARA PAINEL REDONDO / ARO CIRCULAR (Guirlanda de Aro)
  const gerarArcoAroRedondo = () => {
    const baloes = [];
    const centerX = 160;
    const centerY = 160;
    const radius = 125;
    const totalClusters = 24;

    for (let i = 0; i < totalClusters; i++) {
      const t = i / (totalClusters - 1);
      // Cobre do ângulo 140° passando pelo topo até -60°
      const angle = (145 - t * 240) * (Math.PI / 180);
      const cx = centerX + radius * Math.cos(angle);
      const cy = centerY - radius * Math.sin(angle);
      
      const colorIdx = Math.floor(t * (cores.length - 0.01));

      // Balão Fundo
      const rBase = 26 + Math.sin(i * 1.8) * 8;
      baloes.push({ cx: Math.round(cx), cy: Math.round(cy), r: rBase, c: colorIdx });

      // Balões Médios Adjacentes
      const rAdj = radius + (i % 2 === 0 ? 18 : -16);
      const angleOffset = angle + (i % 2 === 0 ? 0.08 : -0.08);
      baloes.push({
        cx: Math.round(centerX + rAdj * Math.cos(angleOffset)),
        cy: Math.round(centerY - rAdj * Math.sin(angleOffset)),
        r: 20 + (i % 3) * 3,
        c: (colorIdx + (i % 2)) % cores.length
      });

      // Minis na Frente
      if (i % 2 === 0) {
        baloes.push({
          cx: Math.round(cx + (i % 3 === 0 ? 6 : -6)),
          cy: Math.round(cy + (i % 2 === 0 ? -6 : 6)),
          r: 12,
          c: (colorIdx + 1) % cores.length
        });
      }
    }

    return baloes;
  };

  // 3. 🎀 GUIRLANDA LATERAL EM L (Puffy Organic L-Garland)
  const baloesL = [
    // Camada 1: Balões Gigantes
    { cx: 215, cy: 55, r: 38, c: 0 },
    { cx: 175, cy: 45, r: 42, c: 1 },
    { cx: 125, cy: 48, r: 44, c: 2 },
    { cx: 75, cy: 55, r: 46, c: 3 },
    { cx: 48, cy: 95, r: 48, c: 0 },
    { cx: 65, cy: 145, r: 44, c: 4 },
    { cx: 45, cy: 195, r: 46, c: 1 },
    { cx: 62, cy: 245, r: 44, c: 2 },
    { cx: 44, cy: 295, r: 48, c: 3 },
    { cx: 58, cy: 338, r: 38, c: 0 },

    // Camada 2: Corpo Médio
    { cx: 238, cy: 58, r: 24, c: 2 },
    { cx: 198, cy: 30, r: 28, c: 3 },
    { cx: 192, cy: 75, r: 26, c: 4 },
    { cx: 152, cy: 26, r: 30, c: 0 },
    { cx: 148, cy: 68, r: 28, c: 1 },
    { cx: 105, cy: 25, r: 32, c: 2 },
    { cx: 96, cy: 72, r: 30, c: 3 },
    { cx: 56, cy: 34, r: 32, c: 4 },
    { cx: 26, cy: 68, r: 34, c: 0 },
    { cx: 76, cy: 92, r: 28, c: 1 },
    { cx: 26, cy: 118, r: 32, c: 2 },
    { cx: 68, cy: 125, r: 30, c: 3 },
    { cx: 34, cy: 162, r: 34, c: 4 },
    { cx: 78, cy: 172, r: 28, c: 0 },
    { cx: 24, cy: 212, r: 32, c: 1 },
    { cx: 66, cy: 218, r: 30, c: 2 },
    { cx: 32, cy: 262, r: 34, c: 3 },
    { cx: 76, cy: 268, r: 28, c: 4 },
    { cx: 24, cy: 308, r: 32, c: 0 },
    { cx: 68, cy: 312, r: 30, c: 1 },
    { cx: 36, cy: 342, r: 26, c: 2 },

    // Camada 3: Minis Frente
    { cx: 214, cy: 46, r: 14, c: 1 },
    { cx: 174, cy: 52, r: 15, c: 3 },
    { cx: 184, cy: 36, r: 12, c: 0 },
    { cx: 134, cy: 42, r: 15, c: 4 },
    { cx: 124, cy: 58, r: 13, c: 2 },
    { cx: 84, cy: 46, r: 16, c: 1 },
    { cx: 72, cy: 64, r: 13, c: 0 },
    { cx: 42, cy: 70, r: 17, c: 3 },
    { cx: 52, cy: 84, r: 13, c: 2 },
    { cx: 36, cy: 104, r: 14, c: 4 },
    { cx: 48, cy: 134, r: 16, c: 0 },
    { cx: 60, cy: 148, r: 12, c: 1 },
    { cx: 30, cy: 178, r: 15, c: 2 },
    { cx: 46, cy: 188, r: 13, c: 3 },
    { cx: 50, cy: 228, r: 16, c: 0 },
    { cx: 38, cy: 242, r: 12, c: 4 },
    { cx: 48, cy: 278, r: 15, c: 1 },
    { cx: 34, cy: 288, r: 12, c: 2 },
    { cx: 54, cy: 322, r: 14, c: 3 }
  ];

  // 4. 🎈 CLUSTER DE BALÕES DE CHÃO
  const baloesClusterChao = [
    { cx: 55, cy: 110, r: 44, c: 0 },
    { cx: 105, cy: 115, r: 46, c: 1 },
    { cx: 150, cy: 110, r: 42, c: 2 },
    { cx: 80, cy: 65, r: 42, c: 3 },
    { cx: 125, cy: 65, r: 40, c: 4 },
    { cx: 100, cy: 35, r: 34, c: 0 },
    { cx: 30, cy: 122, r: 26, c: 1 },
    { cx: 75, cy: 126, r: 30, c: 2 },
    { cx: 125, cy: 126, r: 30, c: 3 },
    { cx: 170, cy: 122, r: 26, c: 4 },
    { cx: 50, cy: 78, r: 30, c: 0 },
    { cx: 95, cy: 82, r: 28, c: 1 },
    { cx: 145, cy: 78, r: 30, c: 2 },
    { cx: 75, cy: 42, r: 26, c: 3 },
    { cx: 120, cy: 42, r: 26, c: 4 },
    { cx: 55, cy: 102, r: 16, c: 3 },
    { cx: 100, cy: 106, r: 17, c: 0 },
    { cx: 145, cy: 102, r: 16, c: 1 },
    { cx: 78, cy: 68, r: 15, c: 2 },
    { cx: 118, cy: 68, r: 15, c: 4 },
    { cx: 98, cy: 42, r: 14, c: 1 }
  ];

  let listaBaloes = [];
  let viewBoxW = 260;
  let viewBoxH = 360;

  if (tipo === 'arco_classico_portal') {
    listaBaloes = gerarArcoClassicoPortal();
    viewBoxW = 360;
    viewBoxH = 330;
  } else if (tipo === 'baloes_aro_redondo') {
    listaBaloes = gerarArcoAroRedondo();
    viewBoxW = 320;
    viewBoxH = 320;
  } else if (tipo === 'cluster_chao' || tipo === 'baloes_cluster_chao') {
    listaBaloes = baloesClusterChao;
    viewBoxW = 200;
    viewBoxH = 160;
  } else {
    listaBaloes = baloesL;
    viewBoxW = 260;
    viewBoxH = 360;
  }

  return (
    <svg 
      width="100%" 
      height="100%" 
      viewBox={`0 0 ${viewBoxW} ${viewBoxH}`} 
      style={{ 
        overflow: 'visible', 
        filter: 'drop-shadow(0 10px 22px rgba(0,0,0,0.24))',
        pointerEvents: 'none'
      }}
    >
      <defs>
        {cores.map((c, i) => (
          <radialGradient key={i} id={`grad-balao-3d-${i}`} cx="32%" cy="28%" r="72%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="18%" stopColor="#ffffff" stopOpacity="0.4" />
            <stop offset="52%" stopColor={c} />
            <stop offset="85%" stopColor={c} stopOpacity="0.9" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.55" />
          </radialGradient>
        ))}
      </defs>

      {listaBaloes.map((b, idx) => {
        const corIndex = b.c % cores.length;
        const baseColor = cores[corIndex];

        return (
          <g key={idx}>
            {/* Balão Esférico 3D com Volume Real */}
            <circle cx={b.cx} cy={b.cy} r={b.r} fill={baseColor} />
            <circle cx={b.cx} cy={b.cy} r={b.r} fill={`url(#grad-balao-3d-${corIndex})`} />

            {/* Ponto de Brilho Acetinado / Reflexo Glossy Superior Esquerdo */}
            <ellipse 
              cx={b.cx - b.r * 0.32} 
              cy={b.cy - b.r * 0.35} 
              rx={Math.max(1, b.r * 0.22)} 
              ry={Math.max(1, b.r * 0.14)} 
              transform={`rotate(-25 ${b.cx - b.r * 0.32} ${b.cy - b.r * 0.35})`} 
              fill="#ffffff" 
              opacity="0.75" 
            />
            {/* Micro Ponto de Luz Especular */}
            <circle 
              cx={b.cx - b.r * 0.12} 
              cy={b.cy - b.r * 0.46} 
              r={Math.max(1.5, b.r * 0.08)} 
              fill="#ffffff" 
              opacity="0.9" 
            />
          </g>
        );
      })}
    </svg>
  );
};

// 🏛️ Componente Mesa Cilindro 3D Hiper-Realista de Festa com Capa
const CilindroMesa3D = ({ item }) => {
  const cor = item.color || '#e2e8f0';
  const capaUrl = item.capaUrl;
  const posX = item.capaPosX ?? 50;
  const posY = item.capaPosY ?? 50;
  const scale = item.capaScale ?? 1;
  const isTampoLiso = item.tampoTipo === 'liso';
  const tampoCor = item.tampoCor || '#ffffff';

  return (
    <div className="cylinder-3d-container">
      {/* Corpo Cilíndrico com Base Curva */}
      <div 
        className="cylinder-3d-body"
        style={{ backgroundColor: cor }}
      >
        {capaUrl ? (
          <img 
            src={capaUrl} 
            alt="Capa Cilindro" 
            draggable="false"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: `${posX}% ${posY}%`,
              transform: `scale(${scale})`,
              transformOrigin: `${posX}% ${posY}%`,
              pointerEvents: 'none'
            }} 
          />
        ) : (
          <div className="cylinder-base-fill" style={{ backgroundColor: cor }} />
        )}
        
        {/* Iluminação 3D Cilíndrica e Sombra Lateral */}
        <div className="cylinder-3d-gradient-overlay" />
      </div>

      {/* Tampo Oval Superior (Perspectiva 3D da Mesa) */}
      <div 
        className="cylinder-3d-top"
        style={{ backgroundColor: isTampoLiso ? tampoCor : cor }}
      >
        {capaUrl && !isTampoLiso ? (
          <img 
            src={capaUrl} 
            alt="Tampo Cilindro" 
            draggable="false"
            style={{
              width: '100%',
              height: '240%',
              objectFit: 'cover',
              objectPosition: `${posX}% ${posY}%`,
              transform: `scale(${scale})`,
              transformOrigin: `${posX}% ${posY}%`,
              pointerEvents: 'none',
              filter: 'brightness(1.08)'
            }} 
          />
        ) : (
          <div className="cylinder-top-sheen" style={{ backgroundColor: isTampoLiso ? tampoCor : 'transparent' }} />
        )}
      </div>
    </div>
  );
};

const Moodboard = () => {
  const navigate = useNavigate();
  
  // 🔥 Autenticação e Chave Mestra
  const auth = getAuth();
  const usuarioLogado = auth.currentUser;
  const tenantId = localStorage.getItem('tenantId') || usuarioLogado?.uid;

  const [empresaConfig, setEmpresaConfig] = useState({});
  const [estoqueReal, setEstoqueReal] = useState([]);
  const [itensCanvas, setItensCanvas] = useState([]);
  const [selecionadoId, setSelecionadoId] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('acervo'); 
  const [editingTextId, setEditingTextId] = useState(null);
  const [wallBackground, setWallBackground] = useState('#f8fafc');
  const [floorBackground, setFloorBackground] = useState('#e2e8f0');
  const [activeSurface, setActiveSurface] = useState('wall');
  
  const [texturasParede, setTexturasParede] = useState(PRESETS_PAREDE_PADRAO);
  const [texturasChao, setTexturasChao] = useState(PRESETS_CHAO_PADRAO);
  
  // 🔍 Filtros e Busca no Acervo
  const [termoBusca, setTermoBusca] = useState('');
  const [expandedCats, setExpandedCats] = useState({});

  // 🔍 Zoom & Visualização
  const [zoom, setZoom] = useState(1);
  const [isPanCapaMode, setIsPanCapaMode] = useState(false);
  const [rotacaoTooltip, setRotacaoTooltip] = useState(null);

  // 🏛️ Cenário, Ambiente & Transição 3D
  const [modoApresentacao, setModoApresentacao] = useState(false);
  const [modoCenario, setModoCenario] = useState('duplo'); // 'duplo' (parede + piso 3D) | 'unico' (fundo inteiro / foto de salão)
  const [alturaChao, setAlturaChao] = useState(36); // porcentagem de piso (15 a 55%)
  const [sombraChaoIntensidade, setSombraChaoIntensidade] = useState(25); // sombra do ciclorama / contato (0 a 60%)
  const [estiloRodape, setEstiloRodape] = useState('suave'); // 'suave' (fundo infinito) | 'rodape' (rodapé estúdio)

  // 🔄 Histórico de Ações (Undo / Redo)
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const isHistoryAction = useRef(false);
  
  // 🕹️ Refs de Interação Ultrarrápida (Zero Delay / 120 FPS)
  const activeItemId = useRef(null);
  const interactionMode = useRef('none'); // 'none' | 'drag' | 'resize' | 'rotate' | 'pan_capa'
  const resizeDir = useRef(null);
  const startPointerPos = useRef({ x: 0, y: 0 });
  const startItemPos = useRef({});
  const startCenter = useRef({ x: 0, y: 0 });
  const startAngle = useRef(0);
  const rafMove = useRef(null);

  // 🎛️ Painel Direito Studio Pro (Estilo Photoshop / Figma)
  const [painelDireitoAberto, setPainelDireitoAberto] = useState(() => typeof window !== 'undefined' && window.innerWidth > 900);
  const [abaDireita, setAbaDireita] = useState('camadas'); // 'camadas' | 'propriedades' | 'baloes'

  // 🎈 BIBLIOTECA & PORTFÓLIO DE CENOGRAFIA (FIRESTORE)
  const [elementosCenografia, setElementosCenografia] = useState([]);
  const [abaAcervoFonte, setAbaAcervoFonte] = useState('estoque'); // 'estoque' | 'globais' | 'portfolio'
  const [filtroBiblioteca, setFiltroBiblioteca] = useState('oficiais'); // 'todos' | 'oficiais' | 'meu_portfolio'
  const [categoriaBiblioteca, setCategoriaBiblioteca] = useState('todas'); // 'todas' | 'Baloes' | 'Paineis' | 'Flores' | 'Moveis' | 'Letreiros' | 'Outros'
  const [filtroCorBiblioteca, setFiltroCorBiblioteca] = useState('todas'); // cor id ou 'todas'
  const [loadingBiblioteca, setLoadingBiblioteca] = useState(false);
  const [modalUploadElementoAberto, setModalUploadElementoAberto] = useState(false);
  const [novoElementoForm, setNovoElementoForm] = useState({ nome: '', categoria: 'Baloes', tag: '', imagemUrl: '' });
  const [salvandoNovoElemento, setSalvandoNovoElemento] = useState(false);

  // 🎈 Formas & Cenografia
  const [corEstrutura, setCorEstrutura] = useState('#ffffff');
  const [paletaBalaoAtiva, setPaletaBalaoAtiva] = useState(PALETAS_BALOES[0]);

  // 📁 Modais
  const [modalSalvarAberto, setModalSalvarAberto] = useState(false);
  const [modalAbrirAberto, setModalAbrirAberto] = useState(false);
  const [modalPecasAberto, setModalPecasAberto] = useState(false);
  const [nomeProjeto, setNomeProjeto] = useState("");
  const [projetosSalvos, setProjetosSalvos] = useState([]);
  const [salvandoProjeto, setSalvandoProjeto] = useState(false);
  const [exportandoPDF, setExportandoPDF] = useState(false);
  const [avisoCopiadoCompras, setAvisoCopiadoCompras] = useState(false);
  
  const boardRef = useRef(null);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, itemId: null });
  
  const fontesDisponiveis = [ 
    { nome: 'Moderna (Poppins)', valor: "'Poppins', sans-serif" }, 
    { nome: 'Clássica (Playfair)', valor: "'Playfair Display', serif" }, 
    { nome: 'Elegante (Great Vibes)', valor: "'Great Vibes', cursive" }, 
    { nome: 'Manuscrita (Dancing)', valor: "'Dancing Script', cursive" }, 
    { nome: 'Divertida (Pacifico)', valor: "'Pacifico', cursive" }, 
    { nome: 'Simples (Montserrat)', valor: "'Montserrat', sans-serif" } 
  ];

  // 💰 RESUMO COMERCIAL DAS PEÇAS NO CANVAS (SEPARANDO ESTOQUE, BEXIGAS P/ COMPRAR E PEÇAS FÍSICAS)
  const resumoComercial = useMemo(() => {
    const mapa = {};
    let valorTotal = 0;
    let totalPecas = 0;
    let totalPecasEstoque = 0;
    let totalPecasExternas = 0;

    itensCanvas.forEach(item => {
      if (item.type === 'image' && item.nome) {
        const chave = item.id || item.nome;
        const vUnit = Number(item.valor || item.preco || item.valorLocacao || item.financeiro?.valorAluguel || 0);
        const isEstoque = item.isEstoqueProprio !== false && !item.isItemExterno;
        const isBalao = item.categoria === 'Baloes' || (item.nome || '').toLowerCase().includes('arco') || (item.nome || '').toLowerCase().includes('balão') || (item.nome || '').toLowerCase().includes('balao');

        if (!mapa[chave]) {
          mapa[chave] = {
            id: item.id,
            nome: item.nome,
            codigo: item.codigo || '—',
            categoria: item.categoria || 'Acervo',
            imagem: item.imagem || item.foto || '',
            valorUnitario: vUnit,
            quantidade: 0,
            subtotal: 0,
            isEstoqueProprio: isEstoque,
            isItemExterno: !isEstoque,
            isBalao,
            tipoCompra: isBalao ? 'bexigas' : 'peca_fisica',
            origem: item.origem || (isEstoque ? 'estoque' : 'global_celebre')
          };
        }
        mapa[chave].quantidade += 1;
        mapa[chave].subtotal += vUnit;
        valorTotal += vUnit;
        totalPecas += 1;
        if (isEstoque) totalPecasEstoque += 1;
        else totalPecasExternas += 1;
      }
    });

    const lista = Object.values(mapa);
    const listaEstoque = lista.filter(i => i.isEstoqueProprio);
    const listaAComprar = lista.filter(i => !i.isEstoqueProprio);
    const listaBaloesAComprar = listaAComprar.filter(i => i.isBalao);
    const listaPecasAComprar = listaAComprar.filter(i => !i.isBalao);

    return {
      lista,
      listaEstoque,
      listaAComprar,
      listaBaloesAComprar,
      listaPecasAComprar,
      totalPecas,
      totalPecasEstoque,
      totalPecasExternas,
      totalBaloesAComprar: listaBaloesAComprar.reduce((acc, i) => acc + i.quantidade, 0),
      totalPecasAComprar: listaPecasAComprar.reduce((acc, i) => acc + i.quantidade, 0),
      valorTotal
    };
  }, [itensCanvas]);

  // 🔍 ACERVO FILTRADO POR BUSCA (ESTOQUE FÍSICO)
  const estoqueFiltrado = useMemo(() => {
    if (!termoBusca.trim()) return estoqueReal;
    const t = termoBusca.toLowerCase();
    return estoqueReal.filter(item => 
      (item.nome && item.nome.toLowerCase().includes(t)) ||
      (item.codigo && item.codigo.toLowerCase().includes(t)) ||
      (item.categoria && item.categoria.toLowerCase().includes(t))
    );
  }, [estoqueReal, termoBusca]);
  
  const grouped = useMemo(() => {
    const mapa = {};
    estoqueFiltrado.forEach(i => { 
        const c = i.categoria || 'Sem Categoria'; 
        if (!mapa[c]) mapa[c] = []; 
        mapa[c].push(i); 
    });
    return mapa;
  }, [estoqueFiltrado]);

  // 🎈 CARREGAR BIBLIOTECA & PORTFÓLIO DE CENOGRAFIA (FIRESTORE GLOBAL)
  const carregarElementosBiblioteca = useCallback(async () => {
    setLoadingBiblioteca(true);
    try {
      const snap = await getDocs(collection(db, "moodboard_elementos"));
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setElementosCenografia(lista);
    } catch (err) {
      console.error("Erro ao carregar biblioteca de cenografia:", err);
    } finally {
      setLoadingBiblioteca(false);
    }
  }, []);

  useEffect(() => {
    carregarElementosBiblioteca();
  }, [carregarElementosBiblioteca]);

  // Subir recorte para Meu Portfólio
  const handleSalvarMeuElemento = async (e) => {
    e.preventDefault();
    if (!novoElementoForm.nome.trim() || !novoElementoForm.imagemUrl) {
      return alert("Por favor, preencha o nome e selecione a imagem PNG recortada!");
    }
    try {
      setSalvandoNovoElemento(true);
      const isSuperAdmin = usuarioLogado?.email === "celebrefesta25@gmail.com";
      await addDoc(collection(db, "moodboard_elementos"), {
        nome: novoElementoForm.nome.trim(),
        categoria: novoElementoForm.categoria,
        tag: novoElementoForm.tag.trim() || (isSuperAdmin ? 'Oficial' : 'Meu Acervo'),
        imagemUrl: novoElementoForm.imagemUrl,
        isGlobal: isSuperAdmin ? true : false,
        sugeridoParaGlobal: false,
        empresaId: tenantId,
        criadoPorNome: usuarioLogado?.displayName || usuarioLogado?.email || "Minha Empresa",
        criadoEm: new Date().toISOString()
      });

      alert(isSuperAdmin ? "🎉 Publicado como Oficial Global com sucesso!" : "🎉 Elemento salvo no seu Portfólio com sucesso!");
      setModalUploadElementoAberto(false);
      setNovoElementoForm({ nome: '', categoria: 'Baloes', tag: '', imagemUrl: '' });
      carregarElementosBiblioteca();
    } catch (err) {
      console.error("Erro ao salvar elemento:", err);
      alert("Erro ao salvar elemento.");
    } finally {
      setSalvandoNovoElemento(false);
    }
  };

  // Sugerir para o Sistema
  const handleSugerirParaGlobal = async (item) => {
    try {
      await updateDoc(doc(db, "moodboard_elementos", item.id), {
        sugeridoParaGlobal: true
      });
      setElementosCenografia(prev => prev.map(i => i.id === item.id ? { ...i, sugeridoParaGlobal: true } : i));
      alert("✨ Sugestão enviada para a Celebre! Nossa equipe avaliará para disponibilizar para todas as decoradoras do Brasil.");
    } catch (err) {
      console.error("Erro ao sugerir item:", err);
      alert("Erro ao enviar sugestão.");
    }
  };

  // Alternar global direto (se admin)
  const handleAlternarGlobalElemento = async (item) => {
    try {
      const novoStatus = !item.isGlobal;
      await updateDoc(doc(db, "moodboard_elementos", item.id), {
        isGlobal: novoStatus,
        sugeridoParaGlobal: false
      });
      setElementosCenografia(prev => prev.map(i => i.id === item.id ? { ...i, isGlobal: novoStatus, sugeridoParaGlobal: false } : i));
    } catch (err) {
      console.error("Erro ao alternar status global:", err);
      alert("Erro ao atualizar item.");
    }
  };

  // Excluir do meu portfólio
  const handleExcluirMeuElemento = async (itemId) => {
    if (!window.confirm("Deseja realmente remover este elemento do seu portfólio?")) return;
    try {
      await deleteDoc(doc(db, "moodboard_elementos", itemId));
      setElementosCenografia(prev => prev.filter(i => i.id !== itemId));
    } catch (err) {
      console.error("Erro ao excluir:", err);
      alert("Erro ao excluir item.");
    }
  };

  // 🎈 Elementos Filtrados (Global, Portfólio, Categoria e Cores)
  const elementosFiltrados = useMemo(() => {
    const isSuperAdmin = usuarioLogado?.email === "celebrefesta25@gmail.com";
    const termo = (termoBusca || '').trim().toLowerCase();

    return elementosCenografia.filter(item => {
      const isMeu = item.empresaId === tenantId || (isSuperAdmin && item.isGlobal);
      const isGlobal = item.isGlobal === true;

      if (abaAcervoFonte === 'globais' && !isGlobal) return false;
      if (abaAcervoFonte === 'portfolio' && !isMeu) return false;

      // Filtro legado se chamado na aba Formas
      if (filtroBiblioteca === 'oficiais' && !isGlobal && abaAcervoFonte === 'estoque') return false;
      if (filtroBiblioteca === 'meu_portfolio' && !isMeu && abaAcervoFonte === 'estoque') return false;

      // Categoria
      if (categoriaBiblioteca !== 'todas' && item.categoria !== categoriaBiblioteca) return false;

      // Cor
      if (filtroCorBiblioteca !== 'todas') {
        const corTag = (item.tag || '').toLowerCase();
        const corNome = (item.nome || '').toLowerCase();
        const temCorArray = item.cores && Array.isArray(item.cores) && item.cores.includes(filtroCorBiblioteca);
        const temCorTexto = corTag.includes(filtroCorBiblioteca) || corNome.includes(filtroCorBiblioteca);
        if (!temCorArray && !temCorTexto) return false;
      }

      // Busca
      if (termo) {
        const n = (item.nome || '').toLowerCase();
        const t = (item.tag || '').toLowerCase();
        const c = (item.categoria || '').toLowerCase();
        if (!n.includes(termo) && !t.includes(termo) && !c.includes(termo)) return false;
      }

      return true;
    });
  }, [elementosCenografia, abaAcervoFonte, filtroBiblioteca, categoriaBiblioteca, filtroCorBiblioteca, termoBusca, tenantId, usuarioLogado]);
  
  // 📜 SISTEMA DE HISTÓRICO (UNDO / REDO)
  const saveSnapshot = useCallback((novosItens, wall = wallBackground, floor = floorBackground) => {
    if (isHistoryAction.current) {
      isHistoryAction.current = false;
      return;
    }
    const snapshot = {
      itens: JSON.parse(JSON.stringify(novosItens)),
      wall,
      floor
    };
    setHistory(prev => {
      const trimmed = prev.slice(0, historyStep + 1);
      if (trimmed.length > 30) trimmed.shift();
      return [...trimmed, snapshot];
    });
    setHistoryStep(prev => Math.min(prev + 1, 30));
  }, [wallBackground, floorBackground, historyStep]);

  const handleUndo = useCallback(() => {
    if (historyStep <= 0) return;
    isHistoryAction.current = true;
    const target = history[historyStep - 1];
    setItensCanvas(JSON.parse(JSON.stringify(target.itens)));
    setWallBackground(target.wall);
    setFloorBackground(target.floor);
    setHistoryStep(prev => prev - 1);
  }, [history, historyStep]);

  const handleRedo = useCallback(() => {
    if (historyStep >= history.length - 1) return;
    isHistoryAction.current = true;
    const target = history[historyStep + 1];
    setItensCanvas(JSON.parse(JSON.stringify(target.itens)));
    setWallBackground(target.wall);
    setFloorBackground(target.floor);
    setHistoryStep(prev => prev + 1);
  }, [history, historyStep]);

  // 🔥 SISTEMA DE AUDITORIA
  const registrarLog = async (acao, detalhes) => {
    if (!usuarioLogado) return;
    try {
      const nomeEquipa = localStorage.getItem('funcName') || usuarioLogado?.displayName || usuarioLogado?.email || "Equipe";
      await addDoc(collection(db, "logs_atividades"), {
        empresaId: tenantId,
        userId: tenantId,
        funcionarioId: usuarioLogado?.uid,
        nomeFuncionario: nomeEquipa,
        usuarioEmail: usuarioLogado?.email || "Desconhecido",
        acao: acao.toUpperCase(),
        detalhes: detalhes,
        dataHora: new Date().toISOString(),
        criadoEm: serverTimestamp()
      });
    } catch (error) {
      console.error("Erro ao gravar log da auditoria do Moodboard:", error);
    }
  };

  useEffect(() => {
    if (!usuarioLogado) {
        navigate('/login');
        return;
    }

    const carregarTudo = async () => {
      try {
        const q = query(collection(db, 'estoque'), where("userId", "==", tenantId));
        const snap = await getDocs(q);
  
        let lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        lista.sort((a, b) => {
            const dataA = a.criadoEm?.toMillis ? a.criadoEm.toMillis() : 0;
            const dataB = b.criadoEm?.toMillis ? b.criadoEm.toMillis() : 0;
            return dataB - dataA;
        });

        const norm = lista.map(i => ({ 
          ...i, 
          imagem: i.foto || i.imagem || (i.fotos?.[0]) || '',
          valor: Number(i.financeiro?.valorAluguel || i.preco || i.valorLocacao || 0)
        }));
        setEstoqueReal(norm);

        const paramSnap = await getDoc(doc(db, "configuracoes_empresa", tenantId));
        if (paramSnap.exists()) {
            const data = paramSnap.data();
            setEmpresaConfig(data);
            if(data.texturasParede && data.texturasParede.length > 0) setTexturasParede(data.texturasParede);
            if(data.texturasChao && data.texturasChao.length > 0) setTexturasChao(data.texturasChao);
        }

        const initialSnap = { itens: [], wall: '#f8fafc', floor: '#e2e8f0' };
        setHistory([initialSnap]);
        setHistoryStep(0);

      } catch (err) {
        console.error("Erro ao carregar dados do Moodboard:", err);
      }
    };
    carregarTudo();
  }, [usuarioLogado, navigate, tenantId]);

  // ⌨️ ATALHOS DE TECLADO INTELIGENTES
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        handleRedo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && selecionadoId) {
        e.preventDefault();
        duplicarItem(selecionadoId);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selecionadoId) {
        e.preventDefault();
        deleteItem(selecionadoId);
      }
      if (e.key === 'Escape') {
        setSelecionadoId(null);
        setEditingTextId(null);
        setIsPanCapaMode(false);
        closeContextMenu();
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selecionadoId) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 2;
        setItensCanvas(prev => {
          const updated = prev.map(item => {
            if (item.uniqueId === selecionadoId && !item.locked) {
              let nx = item.x;
              let ny = item.y;
              if (e.key === 'ArrowLeft') nx -= step;
              if (e.key === 'ArrowRight') nx += step;
              if (e.key === 'ArrowUp') ny -= step;
              if (e.key === 'ArrowDown') ny += step;
              return { ...item, x: nx, y: ny };
            }
            return item;
          });
          saveSnapshot(updated);
          return updated;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selecionadoId, handleUndo, handleRedo, saveSnapshot]);

  // 📑 DUPLICAR ITEM
  const duplicarItem = (id) => {
    const itemOriginal = itensCanvas.find(i => i.uniqueId === id);
    if (!itemOriginal) return;

    const novoItem = {
      ...JSON.parse(JSON.stringify(itemOriginal)),
      uniqueId: `${itemOriginal.type}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      x: itemOriginal.x + 25,
      y: itemOriginal.y + 25
    };

    const updated = [...itensCanvas, novoItem];
    setItensCanvas(updated);
    setSelecionadoId(novoItem.uniqueId);
    saveSnapshot(updated);
  };

  // 📐 ALINHAMENTO
  const alignItem = (tipoAlinhamento) => {
    if (!selecionadoId || !boardRef.current) return;
    const boardWidth = boardRef.current.offsetWidth || 1000;
    const boardHeight = boardRef.current.offsetHeight || 600;

    const updated = itensCanvas.map(item => {
      if (item.uniqueId === selecionadoId && !item.locked) {
        const itemW = item.width || 150;
        const itemH = item.height || 150;
        
        if (tipoAlinhamento === 'center-h') {
          return { ...item, x: Math.round((boardWidth - itemW) / 2) };
        }
        if (tipoAlinhamento === 'center-v') {
          return { ...item, y: Math.round((boardHeight - itemH) / 2) };
        }
        if (tipoAlinhamento === 'bottom') {
          return { ...item, y: Math.round(boardHeight - itemH - 30) };
        }
        if (tipoAlinhamento === 'top') {
          return { ...item, y: 30 };
        }
      }
      return item;
    });

    setItensCanvas(updated);
    saveSnapshot(updated);
  };

  // 🖼️ APLICAR CAPA/ESTAMPA NA ESTRUTURA SELECIONADA
  const aplicarCapaNaEstrutura = (id, urlCapa) => {
    atualizarItem(id, { 
      capaUrl: urlCapa, 
      capaPosX: 50, 
      capaPosY: 50, 
      capaScale: 1 
    });
  };

  // 📷 UPLOAD DE FOTO/CAPA DO COMPUTADOR PARA ESTRUTURA
  const handleUploadCapaEstrutura = (id) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 1200;
          let w = img.width;
          let h = img.height;
          if (w > MAX_SIZE || h > MAX_SIZE) {
            if (w > h) {
              h = (h * MAX_SIZE) / w;
              w = MAX_SIZE;
            } else {
              w = (w * MAX_SIZE) / h;
              h = MAX_SIZE;
            }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const base64 = canvas.toDataURL('image/jpeg', 0.85);
          aplicarCapaNaEstrutura(id, base64);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  // 🚀 GERAR NOVA LOCAÇÃO DIRETO DO MOODBOARD
  const handleGerarLocacao = () => {
    if (resumoComercial.totalPecas === 0) {
      alert("⚠️ Adicione pelo menos uma peça do acervo ao cenário antes de gerar a locação.");
      return;
    }

    const itensParaLocacao = resumoComercial.lista.map(it => ({
      id: it.id,
      pecaId: it.id,
      nome: it.nome,
      codigo: it.codigo,
      categoria: it.categoria,
      quantidade: it.quantidade,
      valor: it.valorUnitario,
      imagem: it.imagem
    }));

    navigate('/locacoes/nova', {
      state: {
        itensMoodboard: itensParaLocacao,
        nomeProjeto: nomeProjeto || 'Decoração Moodboard Studio'
      }
    });
  };

  // 📄 GERAR PROPOSTA EM PDF
  const handleGerarPropostaPDF = async () => {
    if (!boardRef.current) return;
    try {
      setExportandoPDF(true);
      setSelecionadoId(null);
      await new Promise(r => setTimeout(r, 250));

      const canvas = await html2canvas(boardRef.current, { 
        useCORS: true, 
        allowTaint: true, 
        backgroundColor: null,
        scale: 2
      });

      const imagemBase64 = canvas.toDataURL('image/png');

      await gerarPropostaMoodboardPDF({
        imagemMoodboard: imagemBase64,
        nomeProjeto: nomeProjeto || 'Decoração Personalizada Celebre',
        itens: resumoComercial.lista,
        valorTotal: resumoComercial.valorTotal,
        empresa: empresaConfig
      });

      await registrarLog("PROPOSTA PDF MOODBOARD", `Gerou proposta em PDF do projeto "${nomeProjeto || 'Decoração'}" com ${resumoComercial.totalPecas} peças.`);
    } catch (err) {
      console.error("Erro ao gerar proposta PDF:", err);
      alert("Erro ao gerar PDF da proposta comercial.");
    } finally {
      setExportandoPDF(false);
    }
  };

  const adicionarTextura = async (tipo) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1200; 
                let width = img.width;
                let height = img.height;
                
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                const base64 = canvas.toDataURL('image/jpeg', 0.8);
                const nome = prompt("Nome para este fundo (ex: Painel Ripado Bege):");
                if (!nome) return;
                
                const nova = { nome, url: base64 };
                try {
                    if (tipo === 'wall') {
                        const atualizadas = [...texturasParede, nova];
                        setTexturasParede(atualizadas);
                        await setDoc(doc(db, "configuracoes_empresa", tenantId), { texturasParede: atualizadas }, { merge: true });
                    } else {
                        const atualizadas = [...texturasChao, nova];
                        setTexturasChao(atualizadas);
                        await setDoc(doc(db, "configuracoes_empresa", tenantId), { texturasChao: atualizadas }, { merge: true });
                    }
                    alert("✅ Fundo salvo na galeria com sucesso!");
                } catch(err) { 
                    alert("❌ Erro ao salvar fundo. Tente uma imagem mais leve.");
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };
    input.click();
  };

  const removerTextura = async (tipo, urlParaRemover) => {
    if(!window.confirm("Deseja mesmo excluir este fundo da galeria?")) return;
    try {
        if (tipo === 'wall') {
            const atualizadas = texturasParede.filter(t => t.url !== urlParaRemover);
            setTexturasParede(atualizadas);
            await setDoc(doc(db, "configuracoes_empresa", tenantId), { texturasParede: atualizadas }, { merge: true });
        } else {
            const atualizadas = texturasChao.filter(t => t.url !== urlParaRemover);
            setTexturasChao(atualizadas);
            await setDoc(doc(db, "configuracoes_empresa", tenantId), { texturasChao: atualizadas }, { merge: true });
        }
    } catch(e) { 
        alert("Erro ao remover fundo.");
    }
  };

  const handleAbrirModalSalvar = () => {
    if (itensCanvas.length === 0) return alert("O projeto está vazio!");
    setNomeProjeto(nomeProjeto || "");
    setModalSalvarAberto(true);
  };

  const salvarProjeto = async () => {
    if (!nomeProjeto.trim()) return alert("Digite um nome para o projeto!");
    
    try {
        setSalvandoProjeto(true);
        setSelecionadoId(null);
        await new Promise(r => setTimeout(r, 150));

        let thumbnailBase64 = '';
        if (boardRef.current) {
          try {
            const miniCanvas = await html2canvas(boardRef.current, { scale: 0.3, backgroundColor: null, useCORS: true });
            thumbnailBase64 = miniCanvas.toDataURL('image/jpeg', 0.6);
          } catch(eThumb) {
            console.warn("Erro ao gerar miniatura:", eThumb);
          }
        }

        await addDoc(collection(db, "projetos_moodboard"), {
            nome: nomeProjeto.trim(), 
            itens: itensCanvas, 
            wallBackground, 
            floorBackground,
            thumbnail: thumbnailBase64,
            valorTotal: resumoComercial.valorTotal,
            totalPecas: resumoComercial.totalPecas,
            createdAt: new Date().toISOString(),
            userId: tenantId,
            empresaId: tenantId,
            funcionarioId: usuarioLogado.uid 
        });
        
        await registrarLog("NOVO PROJETO MOODBOARD", `Salvou um novo projeto de design no Moodboard chamado "${nomeProjeto}".`);
        
        alert("✅ Projeto e miniatura salvos com sucesso!");
        setModalSalvarAberto(false);
    } catch (error) { 
        console.error("Erro ao salvar projeto:", error);
        alert("Erro ao salvar projeto.");
    } finally {
        setSalvandoProjeto(false);
    }
  };

  const handleAbrirListaProjetos = async () => {
    try {
        const q = query(collection(db, "projetos_moodboard"), where("userId", "==", tenantId));
        const snapshot = await getDocs(q);
        
        let lista = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        lista.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setProjetosSalvos(lista);
        setModalAbrirAberto(true);
    } catch (error) { 
        alert("Erro ao buscar projetos salvos.");
    }
  };

  const carregarProjeto = (projeto) => {
    if (window.confirm(`Carregar o projeto "${projeto.nome}"? O desenho atual será substituído.`)) {
        const itensCarregados = projeto.itens || [];
        setItensCanvas(itensCarregados);
        setWallBackground(projeto.wallBackground || '#f8fafc');
        setFloorBackground(projeto.floorBackground || '#e2e8f0');
        setNomeProjeto(projeto.nome || "");
        setModalAbrirAberto(false);
        saveSnapshot(itensCarregados, projeto.wallBackground || '#f8fafc', projeto.floorBackground || '#e2e8f0');
    }
  };
  
  const deletarProjetoSalvo = async (id, nomeProjetoApagado) => {
    if (window.confirm(`Excluir permanentemente o projeto "${nomeProjetoApagado || 'Projeto'}"?`)) {
        try {
            await deleteDoc(doc(db, "projetos_moodboard", id));
            setProjetosSalvos(prev => prev.filter(p => p.id !== id));
            await registrarLog("EXCLUSÃO DE PROJETO MOODBOARD", `Excluiu o projeto de design "${nomeProjetoApagado || 'Desconhecido'}".`);
        } catch (error) { 
            alert("Erro ao excluir projeto.");
        }
    }
  };

  const handleContextMenu = (e, id) => { 
      e.preventDefault();
      setSelecionadoId(id);
      setContextMenu({ visible: true, x: e.clientX, y: e.clientY, itemId: id }); 
  };
  
  const closeContextMenu = () => setContextMenu({ visible: false, x: 0, y: 0, itemId: null });
  
  const bringToFront = (targetId = null) => { 
      const id = targetId || contextMenu.itemId;
      if (!id) return; 
      
      setItensCanvas(prev => { 
          const idx = prev.findIndex(i => i.uniqueId === id); 
          if(idx < 0) return prev; 
          const item = prev[idx]; 
          const rest = prev.filter(i => i.uniqueId !== id); 
          const updated = [...rest, item];
          saveSnapshot(updated);
          return updated; 
      });
      closeContextMenu(); 
  };
  
  const sendToBack = (targetId = null) => { 
      const id = targetId || contextMenu.itemId;
      if (!id) return; 
      
      setItensCanvas(prev => { 
          const idx = prev.findIndex(i => i.uniqueId === id); 
          if(idx < 0) return prev; 
          const item = prev[idx]; 
          const rest = prev.filter(i => i.uniqueId !== id); 
          const updated = [item, ...rest];
          saveSnapshot(updated);
          return updated; 
      });
      closeContextMenu(); 
  };

  const toggleLock = (targetId = null) => { 
      const id = targetId || contextMenu.itemId;
      if (!id) return; 
      setItensCanvas(prev => {
        const updated = prev.map(i => i.uniqueId === id ? { ...i, locked: !i.locked } : i);
        saveSnapshot(updated);
        return updated;
      }); 
      closeContextMenu();
  };
  
  const toggleCategory = (cat) => setExpandedCats(prev => ({ ...prev, [cat]: !prev[cat] }));
  
  const adicionarAoCanvas = (item, posX = 140, posY = 140) => {
    const novoItem = { 
        ...item, 
        type: 'image', 
        uniqueId: `img_${Date.now()}_${Math.floor(Math.random()*1000)}`, 
        x: posX + (itensCanvas.length % 5) * 15, 
        y: posY + (itensCanvas.length % 5) * 15, 
        width: 170, 
        height: 170, 
        rotation: 0, 
        flipH: false, 
        locked: false, 
        opacity: 100, 
        brightness: 100, 
        contrast: 100, 
        shadow: 0 
    };
    const updated = [...itensCanvas, novoItem];
    setItensCanvas(updated); 
    setSelecionadoId(novoItem.uniqueId); 
    setAbaAtiva('efeitos');
    saveSnapshot(updated);
  };

  // 🎈 ADICIONAR ESTRUTURA OU GUIRLANDA DE BALÕES
  const adicionarFormaOuEstrutura = (tipoEstrutura) => {
    const idUnico = `shape_${Date.now()}`;
    let novoItem = {
      type: 'shape',
      shapeType: tipoEstrutura,
      uniqueId: idUnico,
      x: 150,
      y: 130,
      width: 160,
      height: 260,
      color: corEstrutura,
      capaUrl: '',
      capaPosX: 50,
      capaPosY: 50,
      capaScale: 1,
      rotation: 0,
      flipH: false,
      locked: false,
      opacity: 100,
      brightness: 100,
      contrast: 100,
      shadow: 8
    };

    if (tipoEstrutura === 'painel_redondo') {
      novoItem.width = 240;
      novoItem.height = 240;
    } else if (tipoEstrutura === 'arco_romano') {
      novoItem.width = 170;
      novoItem.height = 280;
    } else if (tipoEstrutura === 'cilindro_g') {
      novoItem.width = 125;
      novoItem.height = 190;
    } else if (tipoEstrutura === 'cilindro_m') {
      novoItem.width = 110;
      novoItem.height = 160;
    } else if (tipoEstrutura === 'cilindro_p') {
      novoItem.width = 95;
      novoItem.height = 130;
    } else if (tipoEstrutura === 'arco_classico_portal') {
      novoItem.width = 340;
      novoItem.height = 300;
      novoItem.coresBalao = paletaBalaoAtiva.cores;
      novoItem.x = 80;
      novoItem.y = 60;
    } else if (tipoEstrutura === 'baloes_aro_redondo') {
      novoItem.width = 280;
      novoItem.height = 280;
      novoItem.coresBalao = paletaBalaoAtiva.cores;
      novoItem.x = 110;
      novoItem.y = 80;
    } else if (tipoEstrutura === 'baloes_lateral_l') {
      novoItem.width = 250;
      novoItem.height = 320;
      novoItem.coresBalao = paletaBalaoAtiva.cores;
      novoItem.x = 120;
      novoItem.y = 100;
    } else if (tipoEstrutura === 'baloes_cluster_chao') {
      novoItem.width = 170;
      novoItem.height = 140;
      novoItem.coresBalao = paletaBalaoAtiva.cores;
      novoItem.x = 180;
      novoItem.y = 280;
    }

    const updated = [...itensCanvas, novoItem];
    setItensCanvas(updated);
    setSelecionadoId(idUnico);
    setAbaAtiva('efeitos');
    saveSnapshot(updated);
  };

  const adicionarTexto = () => {
    const idUnico = `txt_${Date.now()}`;
    const itemTexto = { 
        type: 'text', 
        content: "Nome da Festa", 
        color: "#0f172a", 
        neonColor: "#c5a059", 
        fontSize: 48, 
        fontFamily: "'Pacifico', cursive", 
        uniqueId: idUnico, 
        x: 120, 
        y: 80, 
        width: 220, 
        height: 60, 
        rotation: 0, 
        locked: false, 
        opacity: 100, 
        shadow: 0,
        neonGlow: 0 
    };
    
    const updated = [...itensCanvas, itemTexto];
    setItensCanvas(updated); 
    setSelecionadoId(idUnico); 
    setEditingTextId(idUnico); 
    setAbaAtiva('texto');
    saveSnapshot(updated);
  };

  const aplicarAoFundo = (valor) => {
    const estiloFinal = valor.startsWith('data:image') || valor.startsWith('http') ? `url(${valor})` : valor;
    if (activeSurface === 'wall') {
        setWallBackground(estiloFinal); 
        saveSnapshot(itensCanvas, estiloFinal, floorBackground);
    } else {
        setFloorBackground(estiloFinal);
        saveSnapshot(itensCanvas, wallBackground, estiloFinal);
    }
  };
  
  const handleExportImage = async () => { 
      if (!boardRef.current) return;
      setSelecionadoId(null); 
      setIsPanCapaMode(false);
      
      setTimeout(async () => { 
          const canvas = await html2canvas(boardRef.current, { useCORS: true, allowTaint: true, backgroundColor: null, scale: 2 }); 
          const link = document.createElement('a'); 
          link.download = `Projeto_${(nomeProjeto || 'Moodboard').replace(/\s+/g, '_')}.png`; 
          link.href = canvas.toDataURL(); 
          link.click(); 
          
          await registrarLog("EXPORTAÇÃO DE MOODBOARD", `Fez o download do projeto "${nomeProjeto || 'Sem Nome'}" em alta resolução (PNG).`);
      }, 200);
  };

    // 🕹️ POINTER DOWN: DISPARADOR DE DRAG / RESIZE / ROTATE / PAN_CAPA (ABSOLUTO & ULTRA FLUIDO 120 FPS)
  const handlePointerDown = (e, id, type, dir = null) => {
    e.stopPropagation();
    
    setSelecionadoId(id);
    
    // Foca automaticamente no painel de propriedades do lado direito (sem mexer na navegação da esquerda!)
    if (typeof window !== 'undefined' && window.innerWidth > 900) {
      setPainelDireitoAberto(true);
    }
    setAbaDireita('propriedades');

    const item = itensCanvas.find(i => i.uniqueId === id);
    if (!item || item.locked || id === editingTextId) return;

    activeItemId.current = id;
    startPointerPos.current = { x: e.clientX, y: e.clientY };
    startItemPos.current = {
      x: item.x || 0,
      y: item.y || 0,
      width: item.width || 100,
      height: item.height || 100,
      rotation: item.rotation || 0,
      fontSize: item.fontSize || 48,
      capaPosX: item.capaPosX ?? 50,
      capaPosY: item.capaPosY ?? 50
    };

    if (dir === 'rotate') {
      interactionMode.current = 'rotate';
      if (boardRef.current) {
        const bRect = boardRef.current.getBoundingClientRect();
        const scale = (bRect.width / (boardRef.current.offsetWidth || 1000));
        const itemCenterX = bRect.left + ((item.x || 0) + (item.width || 100) / 2) * scale;
        const itemCenterY = bRect.top + ((item.y || 0) + (item.height || 100) / 2) * scale;
        startCenter.current = { x: itemCenterX, y: itemCenterY };
        const initialRad = Math.atan2(e.clientY - itemCenterY, e.clientX - itemCenterX);
        startAngle.current = (initialRad * (180 / Math.PI)) - (item.rotation || 0);
      }
    } else if (dir) {
      interactionMode.current = 'resize';
      resizeDir.current = dir;
    } else if (isPanCapaMode && item.capaUrl) {
      interactionMode.current = 'pan_capa';
    } else {
      interactionMode.current = 'drag';
    }

    const onWindowMove = (moveEvt) => {
      if (interactionMode.current === 'none' || !activeItemId.current) return;
      
      const clientX = moveEvt.clientX;
      const clientY = moveEvt.clientY;

      if (rafMove.current) cancelAnimationFrame(rafMove.current);

      rafMove.current = requestAnimationFrame(() => {
        rafMove.current = null;

        let scale = zoom || 1;
        if (boardRef.current) {
          const bRect = boardRef.current.getBoundingClientRect();
          if (bRect.width && boardRef.current.offsetWidth) {
            scale = bRect.width / boardRef.current.offsetWidth;
          }
        }

        const totalDx = (clientX - startPointerPos.current.x) / scale;
        const totalDy = (clientY - startPointerPos.current.y) / scale;
        const s = startItemPos.current;

        setItensCanvas(prev => prev.map(it => {
          if (it.uniqueId !== activeItemId.current || it.locked) return it;

          // 1. ARRASTE DO ITEM (100% SINCRONIZADO E PRECISO)
          if (interactionMode.current === 'drag') {
            return {
              ...it,
              x: Math.round(s.x + totalDx),
              y: Math.round(s.y + totalDy)
            };
          }

          // 2. ENQUADRAMENTO DA CAPA
          if (interactionMode.current === 'pan_capa') {
            const newPosX = Math.max(0, Math.min(100, s.capaPosX - (totalDx * 0.4)));
            const newPosY = Math.max(0, Math.min(100, s.capaPosY - (totalDy * 0.4)));
            return { ...it, capaPosX: Math.round(newPosX), capaPosY: Math.round(newPosY) };
          }

          // 3. ROTAÇÃO
          if (interactionMode.current === 'rotate') {
            const currentRad = Math.atan2(clientY - startCenter.current.y, clientX - startCenter.current.x);
            let angleDeg = Math.round((currentRad * (180 / Math.PI)) - startAngle.current);
            angleDeg = ((angleDeg % 360) + 360) % 360;
            if (angleDeg < 4 || angleDeg > 356) angleDeg = 0;
            else if (Math.abs(angleDeg - 90) < 4) angleDeg = 90;
            else if (Math.abs(angleDeg - 180) < 4) angleDeg = 180;
            else if (Math.abs(angleDeg - 270) < 4) angleDeg = 270;
            
            setRotacaoTooltip(`${angleDeg}°`);
            return { ...it, rotation: angleDeg };
          }

          // 4. REDIMENSIONAMENTO
          if (interactionMode.current === 'resize') {
            if (it.type === 'text') {
              const sizeChange = (totalDx + totalDy) * 0.4;
              const newFontSize = Math.max(12, Math.round(s.fontSize + sizeChange));
              return { ...it, fontSize: newFontSize };
            } else {
              let newW = s.width;
              let newH = s.height;
              let newX = s.x;
              let newY = s.y;

              if (resizeDir.current.includes('e')) newW += totalDx;
              if (resizeDir.current.includes('s')) newH += totalDy;
              if (resizeDir.current.includes('w')) {
                newW -= totalDx;
                newX += totalDx;
              }
              if (resizeDir.current.includes('n')) {
                newH -= totalDy;
                newY += totalDy;
              }

              return {
                ...it,
                x: Math.round(newX),
                y: Math.round(newY),
                width: Math.max(30, Math.round(newW)),
                height: Math.max(30, Math.round(newH))
              };
            }
          }

          return it;
        }));
      });
    };

    const onWindowUp = (upEvt) => {
      window.removeEventListener('pointermove', onWindowMove);
      window.removeEventListener('pointerup', onWindowUp);
      if (rafMove.current) {
        cancelAnimationFrame(rafMove.current);
        rafMove.current = null;
      }
      handlePointerUp(upEvt);
    };

    window.addEventListener('pointermove', onWindowMove, { passive: false });
    window.addEventListener('pointerup', onWindowUp, { passive: false });
  };

  const handlePointerUp = (e) => {
    if (interactionMode.current !== 'none') {
      saveSnapshot(itensCanvas);
    }

    interactionMode.current = 'none';
    activeItemId.current = null;
    resizeDir.current = null;
    setRotacaoTooltip(null);
  };
  
  const handleCanvasClick = () => {
      if (selecionadoId) {
          setAbaAtiva('acervo');
      }
      setSelecionadoId(null);
      setEditingTextId(null); 
      setIsPanCapaMode(false);
      closeContextMenu();
  };
  
  const atualizarItem = (id, alt) => {
    setItensCanvas(prev => {
      const updated = prev.map(i => i.uniqueId === id ? { ...i, ...alt } : i);
      saveSnapshot(updated);
      return updated;
    });
  };
  
  const deleteItem = (id) => { 
      setItensCanvas(prev => {
        const updated = prev.filter(i => i.uniqueId !== id);
        saveSnapshot(updated);
        return updated;
      }); 
      setSelecionadoId(null); 
  };

  // 🎯 GESTÃO DE DRAG AND DROP DIRETO DO ACERVO PARA O PALCO
  const handleDragStartAcervo = (e, item) => {
    e.dataTransfer.setData('text/plain', JSON.stringify(item));
  };

  const handleDropCanvas = (e) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      const item = JSON.parse(dataStr);
      if (item && boardRef.current) {
        const bRect = boardRef.current.getBoundingClientRect();
        const dropX = Math.round((e.clientX - bRect.left) / zoom) - 75;
        const dropY = Math.round((e.clientY - bRect.top) / zoom) - 75;
        adicionarAoCanvas(item, Math.max(10, dropX), Math.max(10, dropY));
      }
    } catch(err){}
  };
  
  const itemSelecionado = itensCanvas.find(i => i.uniqueId === selecionadoId);
  const isEstruturaSelecionada = itemSelecionado?.type === 'shape' && ['arco_romano', 'painel_redondo', 'cilindro_g', 'cilindro_m', 'cilindro_p'].includes(itemSelecionado?.shapeType);
  const isBaloesSelecionados = itemSelecionado?.type === 'shape' && itemSelecionado?.shapeType?.startsWith('baloes_');
  
  const getStyle = (valor) => (!valor ? { background: '#fff' } : valor.startsWith('url') ? { backgroundImage: valor, backgroundSize: 'cover', backgroundPosition: 'center' } : { backgroundColor: valor });

  return (
    <div className={`studio-page ${modoApresentacao ? 'showroom-mode' : ''}`} onClick={handleCanvasClick}>
      
      {/* 👑 BARRA DE FERRAMENTAS LATERAL ESQUERDA (OCULTA NO MODO APRESENTAÇÃO) */}
      {!modoApresentacao && (
        <div className="studio-toolbar" onClick={e => e.stopPropagation()}>
          <div className="tool-logo" title="CELEBRE Studio 3.0" onClick={() => navigate('/dashboard')}>
            <Icons.Crown />
          </div>
          <div className={`tool-item ${abaAtiva === 'acervo' && abaAcervoFonte === 'estoque' ? 'active' : ''}`} onClick={() => { setAbaAtiva('acervo'); setAbaAcervoFonte('estoque'); }}>
              <Icons.Couch /><span>Acervo</span>
          </div>
          <div className={`tool-item ${abaAtiva === 'acervo' && abaAcervoFonte === 'globais' ? 'active' : ''}`} onClick={() => { setAbaAtiva('acervo'); setAbaAcervoFonte('globais'); }}>
              <Icons.Crown /><span>Galeria</span>
          </div>
          <div className={`tool-item ${abaAtiva === 'formas' ? 'active' : ''}`} onClick={() => setAbaAtiva('formas')}>
              <Icons.Shapes /><span>Estruturas</span>
          </div>
          <div className={`tool-item ${abaAtiva === 'texto' ? 'active' : ''}`} onClick={() => setAbaAtiva('texto')}>
              <Icons.Type /><span>Texto</span>
          </div>
          <div className={`tool-item ${abaAtiva === 'fundo' ? 'active' : ''}`} onClick={() => setAbaAtiva('fundo')}>
              <Icons.Layers /><span>Cenário</span>
          </div>
        </div>
      )}

      {/* 🎛️ PAINEL LATERAL DE CONTEÚDO (OCULTO NO MODO APRESENTAÇÃO) */}
      {!modoApresentacao && (
        <div className="studio-panel" onClick={e => e.stopPropagation()}>
          
          {/* ABA: ACERVO COM FONTE DE ITENS (MEU ESTOQUE / OFICIAIS / PORTFÓLIO) */}
          {abaAtiva === 'acervo' && (
             <div className="panel-content">
               {/* 🔀 Seletor de Origem do Acervo */}
               <div className="acervo-source-segmented-control">
                 <button 
                   type="button"
                   className={`source-seg-btn ${abaAcervoFonte === 'estoque' ? 'active' : ''}`}
                   onClick={() => { setAbaAcervoFonte('estoque'); setTermoBusca(''); }}
                   title="Peças físicas do seu estoque próprio"
                 >
                   <Icons.Couch width={13} height={13} />
                   <span>Estoque ({estoqueReal.length})</span>
                 </button>
                 <button 
                   type="button"
                   className={`source-seg-btn ${abaAcervoFonte === 'globais' ? 'active' : ''}`}
                   onClick={() => { setAbaAcervoFonte('globais'); setTermoBusca(''); }}
                   title="Arcos e elementos oficiais da Celebre"
                 >
                   <Icons.Crown width={13} height={13} />
                   <span>Oficiais ({elementosCenografia.filter(i => i.isGlobal).length})</span>
                 </button>
                 <button 
                   type="button"
                   className={`source-seg-btn ${abaAcervoFonte === 'portfolio' ? 'active' : ''}`}
                   onClick={() => { setAbaAcervoFonte('portfolio'); setTermoBusca(''); }}
                   title="Recortes PNG que você subiu"
                 >
                   <Icons.Image width={13} height={13} />
                   <span>Portfólio ({elementosCenografia.filter(i => i.empresaId === tenantId && !i.isGlobal).length})</span>
                 </button>
               </div>

               {/* SE FOR MEU ESTOQUE FÍSICO */}
               {abaAcervoFonte === 'estoque' && (
                 <>
                   <div className="panel-header-row" style={{ marginTop: '4px' }}>
                     <h3 className="panel-title">SEU ESTOQUE DE PEÇAS</h3>
                     <span className="panel-badge-count">{estoqueFiltrado.length} peças</span>
                   </div>

                   {/* Barra de Busca Rápida */}
                   <div className="search-box-acervo">
                      <Icons.Search />
                      <input 
                        type="text" 
                        placeholder="Buscar no seu estoque..." 
                        value={termoBusca}
                        onChange={e => setTermoBusca(e.target.value)}
                      />
                      {termoBusca && (
                        <button className="btn-clear-search" onClick={() => setTermoBusca('')}>✕</button>
                      )}
                   </div>

                   <div className="acervo-list-scroll">
                     {Object.keys(grouped).length === 0 ? (
                       <div className="empty-search-state">
                         <p>Nenhuma peça encontrada no seu estoque para "{termoBusca}".</p>
                       </div>
                     ) : (
                       Object.keys(grouped).sort().map(cat => (
                         <div key={cat} className="acervo-category">
                           <div className={`acervo-category-header ${expandedCats[cat] || termoBusca ? 'expanded' : ''}`} onClick={() => toggleCategory(cat)}>
                             <span className="cat-name">{cat}</span> <span className="count">{grouped[cat].length}</span>
                           </div>
                           {(expandedCats[cat] || termoBusca) && (
                             <div className="acervo-grid">
                               {grouped[cat].map(item => (
                                 <div 
                                   key={item.id} 
                                   className="acervo-card" 
                                   draggable 
                                   onDragStart={(e) => handleDragStartAcervo(e, { ...item, isEstoqueProprio: true })}
                                   onClick={() => adicionarAoCanvas({ ...item, isEstoqueProprio: true })} 
                                   title="Clique ou arraste para o cenário"
                                 >
                                   <div className="card-thumb">
                                       <img src={item.imagem || 'https://via.placeholder.com/120?text=Sem+Foto'} crossOrigin="anonymous" alt={item.nome} />
                                       <span className="badge-card-stock">✓ No Estoque</span>
                                   </div>
                                   <div className="card-info-box">
                                     <div className="card-name">{item.nome}</div>
                                     <div className="card-price">
                                       {item.valor > 0 ? `R$ ${item.valor.toFixed(2)}` : 'Sob Consulta'}
                                     </div>
                                   </div>
                                 </div>
                               ))}
                             </div>
                           )}
                         </div>
                       ))
                     )}
                   </div>
                 </>
               )}

               {/* SE FOR OFICIAIS CELEBRE OU MEU PORTFÓLIO PNG */}
               {(abaAcervoFonte === 'globais' || abaAcervoFonte === 'portfolio') && (
                 <>
                   <div className="panel-header-row" style={{ marginTop: '4px' }}>
                     <h3 className="panel-title">
                       {abaAcervoFonte === 'globais' ? '👑 GALERIA OFICIAL GLOBAL' : '📁 MEU PORTFÓLIO PNG'}
                     </h3>
                     <span className="panel-badge-count">{elementosFiltrados.length} itens</span>
                   </div>

                   {/* Botão de Upload para Portfólio */}
                   {abaAcervoFonte === 'portfolio' && (
                     <button 
                       className="btn-upload-capa" 
                       style={{ background: '#0f172a', marginBottom: '8px' }} 
                       onClick={() => setModalUploadElementoAberto(true)}
                     >
                       <Icons.Image /> 📷 + Subir Novo PNG p/ Meu Portfólio
                     </button>
                   )}

                   {/* Busca */}
                   <div className="search-box-acervo">
                      <Icons.Search />
                      <input 
                        type="text" 
                        placeholder="Buscar por nome, tag..." 
                        value={termoBusca}
                        onChange={e => setTermoBusca(e.target.value)}
                      />
                      {termoBusca && (
                        <button className="btn-clear-search" onClick={() => setTermoBusca('')}>✕</button>
                      )}
                   </div>

                   {/* Chips de Categorias */}
                   <div className="mb-category-chips-row">
                     {CATEGORIAS_BIBLIOTECA_MOODBOARD.map(cat => (
                       <button
                         key={cat.id}
                         type="button"
                         className={`mb-cat-chip ${categoriaBiblioteca === cat.id ? 'active' : ''}`}
                         onClick={() => setCategoriaBiblioteca(cat.id)}
                       >
                         {cat.label}
                       </button>
                     ))}
                   </div>

                   {/* Barra Rápida de Paleta de Cores para Arcos / Balões */}
                   <div className="mb-color-filter-strip">
                     <span className="mb-color-filter-label">Cor:</span>
                     <div className="mb-color-bubbles-scroll">
                       {PALETA_CORES_MOODBOARD.map(c => (
                         <button
                           key={c.id}
                           type="button"
                           className={`mb-color-dot-btn ${filtroCorBiblioteca === c.id ? 'active' : ''}`}
                           style={{ background: c.cor, border: c.borda ? `1.5px solid ${c.borda}` : undefined }}
                           onClick={() => setFiltroCorBiblioteca(c.id)}
                           title={c.label}
                         >
                           {filtroCorBiblioteca === c.id && <i className="fas fa-check" style={{ fontSize: '7px', color: c.id === 'branco' ? '#000' : '#fff' }}></i>}
                         </button>
                       ))}
                     </div>
                     {filtroCorBiblioteca !== 'todas' && (
                       <button type="button" className="mb-color-clear-btn" onClick={() => setFiltroCorBiblioteca('todas')}>✕</button>
                     )}
                   </div>

                   {/* Grid de Itens */}
                   <div className="acervo-list-scroll">
                     {loadingBiblioteca ? (
                       <div style={{ textAlign: 'center', padding: '30px 10px', fontSize: '12px', color: '#64748b' }}>
                         <i className="fas fa-spinner fa-spin"></i> Carregando galeria...
                       </div>
                     ) : elementosFiltrados.length === 0 ? (
                       <div className="empty-search-state">
                         <p>Nenhum elemento encontrado com os filtros selecionados.</p>
                         {abaAcervoFonte === 'portfolio' && (
                           <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '11px', marginTop: '8px' }} onClick={() => setModalUploadElementoAberto(true)}>
                             + Subir Primeiro Recorte PNG
                           </button>
                         )}
                       </div>
                     ) : (
                        <div className="presets-arcos-grid">
                          {elementosFiltrados.map((item, idx) => {
                            const isBalao = item.categoria === 'Baloes' || (item.nome || '').toLowerCase().includes('arco') || (item.nome || '').toLowerCase().includes('balão');
                            return (
                              <div 
                                key={item.id || idx}
                                className="preset-arco-card"
                                onClick={() => {
                                  if (!item.imagemUrl) return;
                                  const img = new Image();
                                  img.onload = () => {
                                    const defaultW = 260;
                                    const calcH = Math.round((defaultW * (img.height || 260)) / (img.width || 260));
                                    adicionarAoCanvas({
                                      nome: item.nome,
                                      imagem: item.imagemUrl,
                                      width: defaultW,
                                      height: calcH,
                                      isEstoqueProprio: false,
                                      isItemExterno: true,
                                      origem: item.isGlobal ? 'global_celebre' : 'meu_portfolio',
                                      categoria: item.categoria || 'Cenografia'
                                    });
                                  };
                                  img.src = item.imagemUrl;
                                }}
                                title={`${item.nome} (${isBalao ? 'Bexigas a Comprar' : 'Item Fora do Estoque'} - Clique para adicionar)`}
                              >
                                <div className="preset-arco-thumb-wrapper">
                                  {item.imagemUrl ? (
                                    <img src={item.imagemUrl} alt={item.nome} />
                                  ) : (
                                    <div style={{ fontSize: '24px' }}>🎈</div>
                                  )}
                                  {isBalao ? (
                                    <span className="badge-card-balloon-buy" title="Necessário comprar pacotes de bexigas nas cores deste arco">
                                      🎈 Bexigas p/ Comprar
                                    </span>
                                  ) : (
                                    <span className="badge-card-need-buy" title="Esta peça não está no seu estoque próprio">
                                      <Icons.ShoppingCart width={10} height={10} /> p/ Comprar
                                    </span>
                                  )}
                                </div>
                                <div className="preset-arco-info">
                                  <span className="preset-arco-title">{item.nome}</span>
                                  <span className="preset-arco-tag">
                                    {isBalao ? '🎈 Bexigas / Balões' : (item.tag || (item.isGlobal ? '👑 Celebre Oficial' : '📁 Portfólio'))}
                                  </span>
                                </div>

                                {/* Ações do item */}
                                <div className="elem-card-actions" onClick={e => e.stopPropagation()}>
                                  {item.empresaId === tenantId && !item.isGlobal && (
                                    <button 
                                      className={`btn-elem-action ${item.sugeridoParaGlobal ? 'suggested' : ''}`}
                                      onClick={() => handleSugerirParaGlobal(item)}
                                      title={item.sugeridoParaGlobal ? "Sugestão enviada para a Celebre" : "Sugerir para se tornar Padrão do Sistema"}
                                    >
                                      {item.sugeridoParaGlobal ? '⭐ Enviado' : '⭐ Sugerir Padrão'}
                                    </button>
                                  )}

                                  {usuarioLogado?.email === "celebrefesta25@gmail.com" && (
                                    <button 
                                      className="btn-elem-action" 
                                      style={{color: '#c5a059'}}
                                      onClick={() => handleAlternarGlobalElemento(item)}
                                      title={item.isGlobal ? "Remover do Global" : "Tornar Global Oficial"}
                                    >
                                      {item.isGlobal ? '👑 Oficial' : '+ Tornar Oficial'}
                                    </button>
                                  )}

                                  {item.empresaId === tenantId && (
                                    <button 
                                      className="btn-elem-del"
                                      onClick={() => handleExcluirMeuElemento(item.id)}
                                      title="Excluir do meu portfólio"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                     )}
                   </div>
                 </>
               )}
             </div>
          )}

          {/* ABA: ESTRUTURAS & FORMAS DECORATIVAS */}
          {abaAtiva === 'formas' && (
            <div className="panel-content">
              <h3 className="panel-title">ESTRUTURAS & CENOGRAFIA</h3>
              <p className="hint-text" style={{margin: '0 0 12px 0'}}>Adicione painéis e mesas cilindro 3D com capas personalizáveis:</p>

              <div className="shapes-presets-grid">
                <div className="shape-card-item" onClick={() => adicionarFormaOuEstrutura('arco_romano')}>
                  <div className="shape-preview arco-romano-preview" style={{borderColor: '#0f172a', background: '#f8fafc'}}></div>
                  <span>Arco Romano</span>
                </div>
                <div className="shape-card-item" onClick={() => adicionarFormaOuEstrutura('painel_redondo')}>
                  <div className="shape-preview painel-redondo-preview" style={{backgroundColor: '#e2e8f0'}}></div>
                  <span>Painel Redondo</span>
                </div>
                <div className="shape-card-item" onClick={() => adicionarFormaOuEstrutura('cilindro_g')}>
                  <div className="shape-preview cilindro-g-preview"></div>
                  <span>Cilindro (G)</span>
                </div>
                <div className="shape-card-item" onClick={() => adicionarFormaOuEstrutura('cilindro_m')}>
                  <div className="shape-preview cilindro-m-preview"></div>
                  <span>Cilindro (M)</span>
                </div>
                <div className="shape-card-item" onClick={() => adicionarFormaOuEstrutura('cilindro_p')}>
                  <div className="shape-preview cilindro-p-preview"></div>
                  <span>Cilindro (P)</span>
                </div>
              </div>

              {/* SEÇÃO BIBLIOTECA & PORTFÓLIO DE CENOGRAFIA */}
              <div className="baloes-section">
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                  <h4 style={{fontSize: '13px', color: '#0f172a', fontWeight: '800', margin: 0}}>
                    🎈 Biblioteca & Portfólio (PNG)
                  </h4>
                  <span style={{fontSize: '10px', color: '#c5a059', fontWeight: 'bold'}}>Fundo Transparente</span>
                </div>

                {/* Filtro: Padrão Oficial vs Meu Portfólio */}
                <div className="cenario-type-switcher" style={{marginBottom: '8px'}}>
                  <button 
                    className={`switch-btn ${filtroBiblioteca === 'oficiais' ? 'active' : ''}`}
                    onClick={() => setFiltroBiblioteca('oficiais')}
                  >
                    👑 Oficiais Celebre
                  </button>
                  <button 
                    className={`switch-btn ${filtroBiblioteca === 'meu_portfolio' ? 'active' : ''}`}
                    onClick={() => setFiltroBiblioteca('meu_portfolio')}
                  >
                    📁 Meu Portfólio
                  </button>
                </div>

                {/* Botão de Adicionar ao Meu Portfólio */}
                <button 
                  className="btn-upload-capa" 
                  style={{background: '#0f172a', marginBottom: '10px'}} 
                  onClick={() => setModalUploadElementoAberto(true)}
                >
                  <Icons.Image /> 📷 + Subir PNG p/ Meu Portfólio
                </button>

                {/* Filtro por Categoria */}
                <div className="cenario-section-title" style={{margin: '4px 0 6px 0'}}>Filtrar Categoria:</div>
                <div className="cenario-type-switcher" style={{marginBottom: '10px', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px'}}>
                  <button className={`switch-btn ${categoriaBiblioteca === 'todas' ? 'active' : ''}`} style={{fontSize: '10px', padding: '5px 2px'}} onClick={() => setCategoriaBiblioteca('todas')}>
                    Todos
                  </button>
                  <button className={`switch-btn ${categoriaBiblioteca === 'Baloes' ? 'active' : ''}`} style={{fontSize: '10px', padding: '5px 2px'}} onClick={() => setCategoriaBiblioteca('Baloes')}>
                    🎈 Balões
                  </button>
                  <button className={`switch-btn ${categoriaBiblioteca === 'Flores' ? 'active' : ''}`} style={{fontSize: '10px', padding: '5px 2px'}} onClick={() => setCategoriaBiblioteca('Flores')}>
                    🌸 Flores
                  </button>
                  <button className={`switch-btn ${categoriaBiblioteca === 'Paineis' ? 'active' : ''}`} style={{fontSize: '10px', padding: '5px 2px'}} onClick={() => setCategoriaBiblioteca('Paineis')}>
                    🏛️ Painéis
                  </button>
                  <button className={`switch-btn ${categoriaBiblioteca === 'Moveis' ? 'active' : ''}`} style={{fontSize: '10px', padding: '5px 2px'}} onClick={() => setCategoriaBiblioteca('Moveis')}>
                    🛋️ Móveis
                  </button>
                  <button className={`switch-btn ${categoriaBiblioteca === 'Letreiros' ? 'active' : ''}`} style={{fontSize: '10px', padding: '5px 2px'}} onClick={() => setCategoriaBiblioteca('Letreiros')}>
                    ✨ LED
                  </button>
                </div>

                {/* Grid de Elementos */}
                {loadingBiblioteca ? (
                  <div style={{textAlign: 'center', padding: '20px', fontSize: '11px', color: '#64748b'}}>
                    Carregando elementos...
                  </div>
                ) : elementosFiltrados.length === 0 ? (
                  <div style={{textAlign: 'center', padding: '20px 10px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1'}}>
                    <p style={{fontSize: '11px', color: '#64748b', margin: '0 0 8px 0'}}>
                      {filtroBiblioteca === 'meu_portfolio' ? 'Você ainda não adicionou itens ao seu portfólio.' : 'Nenhum elemento oficial nesta categoria.'}
                    </p>
                    <button className="btn-secondary" style={{padding: '6px 10px', fontSize: '10px'}} onClick={() => setModalUploadElementoAberto(true)}>
                      + Subir Novo Recorte PNG
                    </button>
                  </div>
                ) : (
                  <div className="presets-arcos-grid">
                    {elementosFiltrados.map((item, idx) => (
                      <div 
                        key={item.id || idx}
                        className="preset-arco-card"
                        onClick={() => {
                          const img = new Image();
                          img.onload = () => {
                            const defaultW = 260;
                            const calcH = Math.round((defaultW * (img.height || 260)) / (img.width || 260));
                            adicionarAoCanvas({
                              nome: item.nome,
                              imagem: item.imagemUrl,
                              width: defaultW,
                              height: calcH,
                              isEstoqueProprio: false,
                              isItemExterno: true,
                              origem: item.isGlobal ? 'global_celebre' : 'meu_portfolio',
                              categoria: item.categoria || 'Cenografia'
                            });
                          };
                          img.src = item.imagemUrl;
                        }}
                        title={`${item.nome} (Item Fora do Estoque - Clique para adicionar)`}
                      >
                        <div className="preset-arco-thumb-wrapper">
                          <img src={item.imagemUrl} alt={item.nome} />
                          <span className="badge-card-need-buy" title="Esta peça não está no seu estoque próprio">
                            <Icons.ShoppingCart width={10} height={10} /> p/ Comprar
                          </span>
                        </div>
                        <div className="preset-arco-info">
                          <span className="preset-arco-title">{item.nome}</span>
                          <span className="preset-arco-tag">{item.tag || (item.isGlobal ? '👑 Celebre Oficial' : '📁 Portfólio')}</span>
                        </div>

                        {/* Ações do item */}
                        <div className="elem-card-actions" onClick={e => e.stopPropagation()}>
                          {item.empresaId === tenantId && !item.isGlobal && (
                            <button 
                              className={`btn-elem-action ${item.sugeridoParaGlobal ? 'suggested' : ''}`}
                              onClick={() => handleSugerirParaGlobal(item)}
                              title={item.sugeridoParaGlobal ? "Sugestão enviada para a Celebre" : "Sugerir para se tornar Padrão do Sistema"}
                            >
                              {item.sugeridoParaGlobal ? '⭐ Enviado' : '⭐ Sugerir Padrão'}
                            </button>
                          )}

                          {usuarioLogado?.email === "celebrefesta25@gmail.com" && (
                            <button 
                              className="btn-elem-action" 
                              style={{color: '#c5a059'}}
                              onClick={() => handleAlternarGlobalElemento(item)}
                              title={item.isGlobal ? "Remover do Global" : "Tornar Global Oficial"}
                            >
                              {item.isGlobal ? '👑 Oficial' : '+ Tornar Oficial'}
                            </button>
                          )}

                          {item.empresaId === tenantId && (
                            <button 
                              className="btn-elem-del"
                              onClick={() => handleExcluirMeuElemento(item.id)}
                              title="Excluir do meu portfólio"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ABA: TEXTO */}
          {abaAtiva === 'texto' && (
               <div className="panel-content">
                  <h3 className="panel-title">ESTILO DO TEXTO</h3>
                  <div className="text-tools">
                      <div style={{display: 'flex', gap: '10px', marginBottom: '15px'}}>
                          <button className="btn-primary-action" style={{marginBottom: 0, flex: 1.2}} onClick={adicionarTexto}>+ Novo Texto</button>
                          <button className="btn-secondary" style={{flex: 1, padding: '10px', borderRadius: '8px', fontWeight: 'bold'}} onClick={() => { setSelecionadoId(null); setAbaAtiva('acervo'); }}>Ver Peças</button>
                      </div>
                      
                      {itemSelecionado?.type === 'text' ? (
                          <div className="edit-box">
                              <p className="hint-text" style={{margin: '0 0 10px 0', color: '#0f172a', fontWeight: 'bold'}}>💡 Dê 2 cliques no texto na tela para editar o nome!</p>
                              
                              <select className="font-selector" value={itemSelecionado.fontFamily} onChange={e => atualizarItem(selecionadoId, {fontFamily: e.target.value})}>
                                  {fontesDisponiveis.map(f => <option key={f.nome} value={f.valor}>{f.nome}</option>)}
                              </select>
   
                              <div className="style-controls-row">
                                  <button className={`btn-style ${itemSelecionado.fontWeight === 'bold' ? 'active' : ''}`} onClick={() => atualizarItem(selecionadoId, {fontWeight: itemSelecionado.fontWeight === 'bold' ? 'normal' : 'bold'})}><Icons.Bold /></button>
                                  <button className={`btn-style ${itemSelecionado.fontStyle === 'italic' ? 'active' : ''}`} onClick={() => atualizarItem(selecionadoId, {fontStyle: itemSelecionado.fontStyle === 'italic' ? 'normal' : 'italic'})}><Icons.Italic /></button>
                                  <div className="divider-v"></div>
                                  <label className="color-picker-wrapper">
                                      Cor: <input type="color" className="color-input-mini" value={itemSelecionado.color} onChange={e => atualizarItem(selecionadoId, {color: e.target.value})} />
                                  </label>
                              </div>

                              <div className="slider-group" style={{marginTop: '10px'}} title="Dê 2 cliques para voltar ao normal">
                                   <label>Tamanho da Fonte ({itemSelecionado.fontSize}px)</label>
                                   <input type="range" min="12" max="150" value={itemSelecionado.fontSize} 
                                      onChange={e => atualizarItem(selecionadoId, {fontSize: Number(e.target.value)})} 
                                      onDoubleClick={() => atualizarItem(selecionadoId, {fontSize: 48})}
                                   />
                              </div>

                              <div className="slider-group" style={{marginTop: '15px', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0'}}>
                                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                                      <label style={{color: '#c5a059', margin: 0, fontWeight: 'bold'}} title="Dê 2 cliques na bolinha para desligar">🌟 Efeito Neon LED ({(itemSelecionado.neonGlow || 0)}px)</label>
                                      
                                      <label className="color-picker-wrapper" style={{fontSize: '10px', cursor: 'pointer'}}>
                                          Cor LED: <input type="color" className="color-input-mini" style={{width: '20px', height: '20px'}} value={itemSelecionado.neonColor || itemSelecionado.color} onChange={e => atualizarItem(selecionadoId, {neonColor: e.target.value})} />
                                      </label>
                                  </div>
                            
                                  <input type="range" min="0" max="50" value={itemSelecionado.neonGlow || 0} 
                                      onChange={e => atualizarItem(selecionadoId, {neonGlow: Number(e.target.value)})} 
                                      onDoubleClick={() => atualizarItem(selecionadoId, {neonGlow: 0})}
                                  />
                              </div>

                          </div>
                      ) : <p className="hint-text">Selecione ou adicione um texto para configurar.</p>}
                   </div>
              </div>
          )}

          {/* ABA: CENÁRIO & AMBIENTE */}
          {abaAtiva === 'fundo' && (
               <div className="panel-content">
                   <div className="panel-header-row">
                     <h3 className="panel-title">CENÁRIO & AMBIENTE</h3>
                   </div>

                   {/* Alternador de Modo do Cenário */}
                   <div className="cenario-type-switcher">
                     <button 
                       className={`switch-btn ${modoCenario === 'duplo' ? 'active' : ''}`} 
                       onClick={() => setModoCenario('duplo')}
                     >
                       🏛️ Estúdio 3D (Parede + Piso)
                     </button>
                     <button 
                       className={`switch-btn ${modoCenario === 'unico' ? 'active' : ''}`} 
                       onClick={() => setModoCenario('unico')}
                     >
                       🖼️ Fundo Inteiro / Salão
                     </button>
                   </div>

                   {modoCenario === 'duplo' ? (
                     <>
                       {/* Seletor de Superfície (Parede vs Piso) */}
                       <div className="surface-switcher" style={{marginTop: '10px'}}>
                          <button className={`switch-btn ${activeSurface === 'wall' ? 'active' : ''}`} onClick={() => setActiveSurface('wall')}>
                            🧱 PAREDE ({activeSurface === 'wall' ? 'Editando' : 'Editar'})
                          </button>
                          <button className={`switch-btn ${activeSurface === 'floor' ? 'active' : ''}`} onClick={() => setActiveSurface('floor')}>
                            🟧 PISO ({activeSurface === 'floor' ? 'Editando' : 'Editar'})
                          </button>
                       </div>

                       {/* Paleta de Cores Rápidas */}
                       <div className="cenario-section-title">Cores Rápidas de Estúdio:</div>
                       <div className="fast-colors-palette">
                         {[
                           { nome: 'Branco Neve', cor: '#ffffff' },
                           { nome: 'Off-White Suave', cor: '#f8fafc' },
                           { nome: 'Bege Areia Nude', cor: '#f5ebe0' },
                           { nome: 'Cinza Estúdio', cor: '#e2e8f0' },
                           { nome: 'Rosa Bebê', cor: '#fce7f3' },
                           { nome: 'Azul Céu', cor: '#e0f2fe' },
                           { nome: 'Verde Eucalipto', cor: '#e2ece9' },
                           { nome: 'Grafite Nobre', cor: '#1e293b' },
                           { nome: 'Preto Noite', cor: '#0a0e17' }
                         ].map((item, idx) => (
                           <div 
                             key={idx}
                             className="fast-color-chip"
                             style={{ backgroundColor: item.cor }}
                             onClick={() => aplicarAoFundo(item.cor)}
                             title={item.nome}
                           />
                         ))}
                         <label className="fast-color-picker-label" title="Escolher cor livre">
                           <input type="color" className="invisible-color-input" onChange={(e) => aplicarAoFundo(e.target.value)} />
                           <span>🎨</span>
                         </label>
                       </div>

                       {/* Texturas com Miniaturas Nítidas */}
                       <div className="adm-header-flex" style={{marginTop: '14px'}}>
                           <h4>Texturas de {activeSurface === 'wall' ? 'Parede' : 'Piso'}</h4>
                           <button className="btn-add-textura" onClick={() => adicionarTextura(activeSurface)}>+ Enviar Foto</button>
                       </div>

                       <div className="bg-presets-modern-grid">
                           {(activeSurface === 'wall' ? texturasParede : texturasChao).map((bg, idx) => (
                               <div 
                                 key={idx} 
                                 className={`bg-preset-card ${(activeSurface === 'wall' ? wallBackground : floorBackground) === bg.url ? 'active' : ''}`} 
                                 onClick={() => aplicarAoFundo(bg.url)}
                                 title={bg.nome}
                               >
                                   <img src={bg.url} alt={bg.nome} />
                                   <span>{bg.nome}</span>
                                   {idx >= 5 && (
                                     <div className="btn-del-bg" onClick={(e) => { e.stopPropagation(); removerTextura(activeSurface, bg.url); }}>✕</div>
                                   )}
                               </div>
                           ))}
                       </div>

                       {/* 🌟 AJUSTES DE TRANSIÇÃO / SUAVIZAÇÃO DA QUEBRA DA PAREDE E PISO */}
                       <div className="transicao-chao-box" style={{marginTop: '14px'}}>
                         <div className="transicao-title-row">
                           <strong>✨ Suavização da Transição (Ciclorama 3D)</strong>
                         </div>
                         <p className="hint-text" style={{margin: '0 0 8px 0', fontSize: '11px'}}>Elimina a quebra dura e cria profundidade realista:</p>

                         <div className="slider-group" style={{marginBottom: '8px'}}>
                           <label>Profundidade / Sombra de Contato ({sombraChaoIntensidade}%)</label>
                           <input 
                             type="range" min="0" max="60" value={sombraChaoIntensidade} 
                             onChange={e => setSombraChaoIntensidade(Number(e.target.value))} 
                           />
                         </div>

                         <div className="slider-group" style={{marginBottom: '8px'}}>
                           <label>Altura da Linha do Piso ({alturaChao}%)</label>
                           <input 
                             type="range" min="15" max="55" value={alturaChao} 
                             onChange={e => setAlturaChao(Number(e.target.value))} 
                           />
                         </div>

                         <div className="tampo-type-toggle" style={{marginTop: '6px'}}>
                           <button 
                             className={`btn-tampo-type ${estiloRodape === 'suave' ? 'active' : ''}`}
                             onClick={() => setEstiloRodape('suave')}
                           >
                             ✨ Fundo Infinito Suave
                           </button>
                           <button 
                             className={`btn-tampo-type ${estiloRodape === 'rodape' ? 'active' : ''}`}
                             onClick={() => setEstiloRodape('rodape')}
                           >
                             📏 Rodapé de Estúdio
                           </button>
                         </div>
                       </div>
                     </>
                   ) : (
                     <>
                       {/* Modo Fundo Único */}
                       <p className="hint-text" style={{margin: '10px 0'}}>Cenário único em tela cheia (ideal para fotos de salão de festa ou papel de parede contínuo):</p>
                       <button className="btn-upload-capa" style={{background: '#0f172a'}} onClick={() => adicionarTextura('wall')}>
                         <Icons.Image /> Enviar Foto do Salão / Espaço
                       </button>

                       <div className="fast-colors-palette" style={{marginTop: '10px'}}>
                         {[
                           { nome: 'Branco', cor: '#ffffff' },
                           { nome: 'Off-White', cor: '#f8fafc' },
                           { nome: 'Cinza Claro', cor: '#e2e8f0' },
                           { nome: 'Grafite Escuro', cor: '#0f172a' }
                         ].map((item, idx) => (
                           <div 
                             key={idx}
                             className="fast-color-chip"
                             style={{ backgroundColor: item.cor }}
                             onClick={() => { setWallBackground(item.cor); saveSnapshot(itensCanvas, item.cor, floorBackground); }}
                             title={item.nome}
                           />
                         ))}
                         <label className="fast-color-picker-label" title="Escolher cor livre">
                           <input type="color" className="invisible-color-input" onChange={(e) => { setWallBackground(e.target.value); saveSnapshot(itensCanvas, e.target.value, floorBackground); }} />
                           <span>🎨</span>
                         </label>
                       </div>
                     </>
                   )}
               </div>
          )}
        </div>
      )}

      {/* 🎨 ÁREA DA PRANCHETA & STUDIO CANVAS */}
      <div 
        className="studio-canvas" 
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDropCanvas}
        onContextMenu={(e) => { e.preventDefault(); }}
      >
        
        {/* 🌟 BARRA SUPERIOR DARK LUXURY */}
        <div className="canvas-header-overlay" onClick={e => e.stopPropagation()}>
             <div className="header-actions-group">
                 
                 {/* Controles de Histórico */}
                 {!modoApresentacao && (
                   <div className="header-btn-cluster">
                      <button className="btn-header-tool" onClick={handleUndo} disabled={historyStep <= 0} title="Desfazer (Ctrl + Z)">
                        <Icons.Undo />
                      </button>
                      <button className="btn-header-tool" onClick={handleRedo} disabled={historyStep >= history.length - 1} title="Refazer (Ctrl + Y)">
                        <Icons.Redo />
                      </button>
                   </div>
                 )}

                 {/* Controles de Zoom */}
                 <div className="header-btn-cluster zoom-cluster">
                    <button className="btn-header-tool" onClick={() => setZoom(z => Math.max(0.5, Number((z - 0.1).toFixed(1))))} title="Diminuir Zoom">
                      <Icons.ZoomOut />
                    </button>
                    <span className="zoom-indicator" onClick={() => setZoom(1)} title="Clique para resetar 100%">
                      {Math.round(zoom * 100)}%
                    </span>
                    <button className="btn-header-tool" onClick={() => setZoom(z => Math.min(1.6, Number((z + 0.1).toFixed(1))))} title="Aumentar Zoom">
                      <Icons.ZoomIn />
                    </button>
                 </div>

                 <div className="header-divider"></div>

                 {/* 🌟 Modo Apresentação / Showroom */}
                 <button 
                  className={`btn-header-action ${modoApresentacao ? 'luxury-gold' : ''}`} 
                  onClick={() => { setModoApresentacao(!modoApresentacao); setSelecionadoId(null); }}
                  title="Modo Apresentação limpa para encantar o cliente"
                 >
                   {modoApresentacao ? <Icons.Minimize /> : <Icons.Maximize />} 
                   <span className="btn-text">{modoApresentacao ? 'SAIR DO SHOWROOM' : 'APRESENTAÇÃO'}</span>
                 </button>

                 {!modoApresentacao && (
                   <>
                     <div className="header-divider"></div>

                     {/* Projetos */}
                     <button className="btn-header-action" onClick={handleAbrirListaProjetos}><Icons.Folder /> <span className="btn-text">PROJETOS</span></button>
                     <button className="btn-header-action" onClick={handleAbrirModalSalvar}><Icons.Save /> <span className="btn-text">SALVAR</span></button>
                     
                     <div className="header-divider"></div>

                     {/* Alternador do Painel Direito Pro (Photoshop) */}
                     <button 
                       className={`btn-header-action ${painelDireitoAberto ? 'luxury-gold' : ''}`} 
                       onClick={() => setPainelDireitoAberto(!painelDireitoAberto)}
                       title="Alternar Painel Lateral Pro (Camadas & Inspetor Photoshop)"
                     >
                       <Icons.Sliders width={14} height={14} /> 
                       <span className="btn-text">PAINEL PRO</span>
                     </button>

                     <div className="header-divider"></div>

                     {/* Ações de Exportação */}
                     <button className="btn-header-action primary" onClick={handleExportImage}><Icons.Download /> <span className="btn-text">BAIXAR PNG</span></button>
                     <button className="btn-header-action luxury-gold" onClick={handleGerarPropostaPDF} disabled={exportandoPDF}>
                       <Icons.FileText /> <span className="btn-text">{exportandoPDF ? 'GERANDO...' : 'PROPOSTA (PDF)'}</span>
                     </button>

                     <div className="header-divider"></div>
                     
                     <button className="btn-header-action danger-exit" onClick={() => navigate('/dashboard')}>
                         ✕ <span className="btn-text">SAIR</span>
                     </button>
                   </>
                 )}
             </div>
         </div>
        
        {/* 🖼️ O QUADRO DECORATIVO (ARTBOARD) */}
        <div className="artboard-zoom-wrapper" style={{ transform: `scale(${zoom})` }}>
          <div className="canvas-artboard" ref={boardRef}>
              
              {/* Camadas do Cenário (Suavização / Ciclorama 3D) */}
              <div className="canvas-layers">
                {modoCenario === 'unico' ? (
                  <div className="layer-single-bg" style={getStyle(wallBackground)} />
                ) : (
                  <>
                    <div 
                      className="layer-wall" 
                      style={{
                        ...getStyle(wallBackground),
                        height: `${100 - alturaChao}%`
                      }}
                    >
                      {/* Sombra de Ambient Occlusion no fundo da parede (Curva de Ciclorama) */}
                      <div 
                        className="wall-bottom-shadow-gradient" 
                        style={{
                          opacity: sombraChaoIntensidade / 100
                        }}
                      />
                    </div>

                    {estiloRodape === 'rodape' && (
                      <div className="layer-baseboard" />
                    )}

                    <div 
                      className="layer-floor" 
                      style={{
                        ...getStyle(floorBackground),
                        height: `${alturaChao}%`
                      }}
                    >
                      {/* Sombra de contato e reflexo sutil no chão */}
                      <div 
                        className="floor-top-shadow-gradient" 
                        style={{
                          opacity: sombraChaoIntensidade / 100
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
      
              {itensCanvas.map((item, index) => {
                const isSelected = selecionadoId === item.uniqueId && !modoApresentacao;

                return (
                  <div key={item.uniqueId} 
                      className={`canvas-object ${isSelected ? 'selected' : ''} ${item.locked ? 'locked-item' : ''} ${isPanCapaMode && isSelected ? 'in-pan-mode' : ''}`}
                      style={{ 
                          left: item.x, 
                          top: item.y, 
                          width: item.type === 'text' ? 'max-content' : `${item.width}px`, 
                          height: item.type === 'text' ? 'max-content' : `${item.height}px`, 
                          zIndex: index + 10,
                          transform: `rotate(${item.rotation || 0}deg) scaleX(${item.flipH ? -1 : 1})`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          filter: `brightness(${item.brightness || 100}%) contrast(${item.contrast || 100}%) ${item.shadow > 0 ? `drop-shadow(5px 5px ${item.shadow}px rgba(0,0,0,0.5))` : ''}`,
                          opacity: (item.opacity || 100) / 100, 
                          cursor: isPanCapaMode && isSelected ? 'move' : (item.locked ? 'not-allowed' : 'grab'),
                          touchAction: 'none'
                      }}
                      onPointerDown={e => handlePointerDown(e, item.uniqueId, item.type)} 
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (item.type === 'text') {
                          setEditingTextId(item.uniqueId);
                        } else if (item.capaUrl) {
                          setIsPanCapaMode(!isPanCapaMode);
                        }
                      }}
                      onClick={e => e.stopPropagation()} 
                      onContextMenu={(e) => handleContextMenu(e, item.uniqueId)}
                  >
                  
                  {/* TEXTO */}
                  {item.type === 'text' && (
                      editingTextId === item.uniqueId ? (
                          <textarea
                              autoFocus
                              wrap="off" 
                              onFocus={(e) => {
                                  const val = e.target.value;
                                  e.target.setSelectionRange(val.length, val.length);
                              }}
                              value={item.content}
                              onChange={(e) => {
                                  e.target.style.width = '100px'; 
                                  e.target.style.width = (e.target.scrollWidth + 10) + 'px';
                                  e.target.style.height = 'auto';
                                  e.target.style.height = e.target.scrollHeight + 'px';
                                  atualizarItem(item.uniqueId, { content: e.target.value });
                              }}
                              onBlur={(e) => {
                                  setEditingTextId(null);
                                  if(!e.target.value.trim()) deleteItem(item.uniqueId); 
                              }} 
                              style={{
                                  minWidth: '100px',
                                  width: item.content ? 'auto' : '150px',
                                  height: 'auto',
                                  fontSize: `${item.fontSize}px`, color: item.color, fontFamily: item.fontFamily,
                                  fontWeight: item.fontWeight, fontStyle: item.fontStyle, textAlign: item.textAlign,
                                  background: 'rgba(255,255,255,0.95)', border: '2px dashed #0f172a', borderRadius: '6px',
                                  outline: 'none', resize: 'none', overflow: 'hidden', padding: '5px 10px',
                                  lineHeight: '1.2', whiteSpace: 'pre',
                                  textShadow: item.neonGlow > 0 ? `0 0 5px ${item.neonColor || item.color}, 0 0 ${item.neonGlow}px ${item.neonColor || item.color}, 0 0 ${item.neonGlow * 2}px ${item.neonColor || item.color}` : 'none'
                              }}
                          />
                      ) : (
                          <div 
                              onDoubleClick={(e) => { e.stopPropagation(); setEditingTextId(item.uniqueId); }}
                              style={{ 
                                  width:'max-content', height: 'max-content', 
                                  fontSize: `${item.fontSize}px`, color: item.color, 
                                  fontFamily: item.fontFamily, fontWeight: item.fontWeight, 
                                  fontStyle: item.fontStyle, textAlign: item.textAlign, cursor: 'text',
                                  whiteSpace: 'pre-wrap', padding: '5px 10px', lineHeight: '1.2',
                                  textShadow: item.neonGlow > 0 ? `0 0 5px ${item.neonColor || item.color}, 0 0 ${item.neonGlow}px ${item.neonColor || item.color}, 0 0 ${item.neonGlow * 2}px ${item.neonColor || item.color}` : 'none'
                              }}>
                              {item.content || <span style={{opacity: 0, paddingLeft: '50px'}}>_</span>}
                          </div>
                      )
                  )}

                  {/* IMAGEM DO ACERVO */}
                  {item.type === 'image' && item.imagem && (
                      <img src={item.imagem} draggable="false" style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} crossOrigin="anonymous" alt="" />
                  )}

                  {/* 🏛️ MESAS CILINDRO 3D REALISTAS */}
                  {item.type === 'shape' && item.shapeType?.includes('cilindro') && (
                    <CilindroMesa3D item={item} />
                  )}

                  {/* 🏛️ PAINÉIS & ARCOS COM CAPA E AJUSTE DE IMAGEM */}
                  {item.type === 'shape' && !item.shapeType?.includes('cilindro') && !item.shapeType?.startsWith('baloes_') && (
                    <div className={`shape-render-element shape-${item.shapeType}`} style={{ width: '100%', height: '100%', backgroundColor: item.color || '#fff' }}>
                      {item.capaUrl ? (
                        <div className="shape-capa-viewport">
                          <img 
                            src={item.capaUrl} 
                            alt="Capa" 
                            draggable="false" 
                            style={{ 
                              width: '100%', 
                              height: '100%', 
                              objectFit: 'cover', 
                              objectPosition: `${item.capaPosX ?? 50}% ${item.capaPosY ?? 50}%`,
                              transform: `scale(${item.capaScale || 1})`,
                              transformOrigin: `${item.capaPosX ?? 50}% ${item.capaPosY ?? 50}%`,
                              pointerEvents: 'none' 
                            }} 
                          />
                          {isPanCapaMode && isSelected && (
                            <div className="pan-grid-overlay">
                              <span className="pan-hint-tag">🖐️ Arraste para enquadrar</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="shape-empty-placeholder"></div>
                      )}
                    </div>
                  )}

                  {/* 🎈 ARCOS & GUIRLANDAS DE BALÕES 3D REALISTAS */}
                  {item.type === 'shape' && item.shapeType === 'arco_classico_portal' && (
                    <div className="shape-render-element shape-baloes_geral" style={{ width: '100%', height: '100%' }}>
                      <GuirlandaBaloesRealista tipo="arco_classico_portal" cores={item.coresBalao || paletaBalaoAtiva.cores} />
                    </div>
                  )}
                  {item.type === 'shape' && item.shapeType === 'baloes_aro_redondo' && (
                    <div className="shape-render-element shape-baloes_geral" style={{ width: '100%', height: '100%' }}>
                      <GuirlandaBaloesRealista tipo="baloes_aro_redondo" cores={item.coresBalao || paletaBalaoAtiva.cores} />
                    </div>
                  )}
                  {item.type === 'shape' && item.shapeType === 'baloes_lateral_l' && (
                    <div className="shape-render-element shape-baloes_geral" style={{ width: '100%', height: '100%' }}>
                      <GuirlandaBaloesRealista tipo="lateral_l" cores={item.coresBalao || paletaBalaoAtiva.cores} />
                    </div>
                  )}
                  {item.type === 'shape' && item.shapeType === 'baloes_cluster_chao' && (
                    <div className="shape-render-element shape-baloes_geral" style={{ width: '100%', height: '100%' }}>
                      <GuirlandaBaloesRealista tipo="cluster_chao" cores={item.coresBalao || paletaBalaoAtiva.cores} />
                    </div>
                  )}
                  
                  {/* 🕹️ CONTROLES INTERATIVOS DIRETOS (CANVA/FIGMA STYLE) */}
                  {isSelected && !item.locked && !editingTextId && (
                      <>
                          {/* 4 Alças de Redimensionamento nos Cantos */}
                          <div className="resize-handle nw" onPointerDown={e => handlePointerDown(e, item.uniqueId, item.type, 'nw')} />
                          <div className="resize-handle ne" onPointerDown={e => handlePointerDown(e, item.uniqueId, item.type, 'ne')} />
                          <div className="resize-handle se" onPointerDown={e => handlePointerDown(e, item.uniqueId, item.type, 'se')} />
                          <div className="resize-handle sw" onPointerDown={e => handlePointerDown(e, item.uniqueId, item.type, 'sw')} />
                          
                          {/* Pino de Rotação Superior */}
                          <div className="rotate-handle-stem" />
                          <div 
                            className="rotate-handle-knob" 
                            onPointerDown={e => handlePointerDown(e, item.uniqueId, item.type, 'rotate')}
                            title="Girar Item"
                          >
                            <Icons.Rotate width={12} height={12} />
                          </div>

                          {/* Tooltip de Grau de Rotação */}
                          {rotacaoTooltip && (
                            <div className="rotation-degree-badge">
                              {rotacaoTooltip}
                            </div>
                          )}

                          {/* Borda de Seleção */}
                          <div className="selection-bounding-box" />

                          {/* ⚡ Barra de Ações Rápidas Acoplada ao Objeto */}
                          <div className="floating-object-action-bar" onClick={e => e.stopPropagation()}>
                            {isEstruturaSelecionada && (
                              <button className="btn-obj-action" onClick={() => handleUploadCapaEstrutura(item.uniqueId)} title="Trocar Capa da Estrutura">
                                <Icons.Image /> Capa
                              </button>
                            )}
                            <button className="btn-obj-action" onClick={() => duplicarItem(item.uniqueId)} title="Duplicar (Ctrl + D)">
                              <Icons.Copy />
                            </button>
                            <button className="btn-obj-action" onClick={() => bringToFront(item.uniqueId)} title="Trazer para Frente">
                              <Icons.ArrowUp />
                            </button>
                            <button className="btn-obj-action" onClick={() => sendToBack(item.uniqueId)} title="Enviar para Trás">
                              <Icons.ArrowDown />
                            </button>
                            <button className="btn-obj-action" onClick={() => toggleLock(item.uniqueId)} title="Bloquear Posição">
                              <Icons.Lock />
                            </button>
                            <button className="btn-obj-action danger" onClick={() => deleteItem(item.uniqueId)} title="Excluir (Del)">
                              <Icons.Trash />
                            </button>
                          </div>
                      </>
                   )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 🛍️ PÍLULA FLUTUANTE COMERCIAL / CALCULADORA EM TEMPO REAL (OCULTA NO MODO APRESENTAÇÃO) */}
        {!modoApresentacao && (
          <div className="floating-commercial-bar" onClick={e => e.stopPropagation()}>
            <div className="comm-info-pill" onClick={() => setModalPecasAberto(true)} title="Clique para ver o detalhamento das peças">
              <div className="comm-icon-box">
                <Icons.ShoppingBag />
              </div>
              <div className="comm-text-group">
                <span className="comm-items-count">
                  <strong>{resumoComercial.totalPecas}</strong> {resumoComercial.totalPecas === 1 ? 'peça' : 'peças'}
                  {resumoComercial.totalPecasEstoque > 0 && <small style={{ opacity: 0.8, marginLeft: '4px' }}>({resumoComercial.totalPecasEstoque} estoque)</small>}
                </span>
                <span className="comm-total-value">
                  R$ {resumoComercial.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <button className="btn-view-pieces" title="Ver Lista de Peças">
                <Icons.Eye />
              </button>
            </div>

            {/* ⚠️ Alerta de Peças a Comprar / Sublocar se houver itens fora do estoque */}
            {resumoComercial.totalPecasExternas > 0 && (
              <div className="comm-warning-pill" onClick={() => setModalPecasAberto(true)} title="Clique para ver as peças que você não tem no estoque">
                <Icons.ShoppingCart />
                <span><strong>{resumoComercial.totalPecasExternas}</strong> {resumoComercial.totalPecasExternas === 1 ? 'peça a comprar' : 'peças a comprar/sublocar'}</span>
              </div>
            )}

            <div className="comm-actions-group">
              <button className="btn-convert-locacao" onClick={handleGerarLocacao} title="Transfere as peças para uma Nova Locação com carrinho preenchido">
                <Icons.Crown width={16} height={16} /> GERAR LOCAÇÃO
              </button>
            </div>
          </div>
        )}

        {/* 📋 MENU DE CONTEXTO (CLIQUE DIREITO) */}
        {contextMenu.visible && (
            <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={e => e.stopPropagation()}>
                {isEstruturaSelecionada && (
                  <>
                    <div className="ctx-item" onClick={() => { handleUploadCapaEstrutura(contextMenu.itemId); closeContextMenu(); }}>
                      <Icons.Image /> 📷 Trocar Capa (Foto)
                    </div>
                    <div className="ctx-divider"></div>
                  </>
                )}
                <div className="ctx-item" onClick={() => duplicarItem(contextMenu.itemId)}><Icons.Copy /> Duplicar (Ctrl+D)</div>
                <div className="ctx-divider"></div>
                <div className="ctx-item" onClick={() => bringToFront()}><Icons.Layers style={{transform: 'rotate(180deg)'}} width={16} /> Trazer p/ Frente</div>
                <div className="ctx-item" onClick={() => sendToBack()}><Icons.Layers width={16} /> Enviar p/ Trás</div>
                <div className="ctx-divider"></div>
                <div className="ctx-item" onClick={() => toggleLock()}>
                    <Icons.Lock /> {itensCanvas.find(i => i.uniqueId === contextMenu.itemId)?.locked ? 'Desbloquear' : 'Bloquear'}
                </div>
                <div className="ctx-divider"></div>
                <div className="ctx-item delete" onClick={() => { deleteItem(contextMenu.itemId); closeContextMenu(); }}>
                    <Icons.Trash /> Excluir (Del)
                </div>
            </div>
        )}

        {/* 💾 MODAL: SALVAR PROJETO */}
        {modalSalvarAberto && (
            <div className="overlay">
                <div className="modal-content luxury-modal">
                    <div className="modal-header-luxury">
                      <h3>Salvar Projeto Decorativo</h3>
                      <p>Gera miniatura visual e salva no cofre da sua empresa</p>
                    </div>
                    <div className="modal-body-luxury">
                      <label style={{fontSize: '13px', fontWeight: 'bold', color: '#0f172a', display: 'block', marginBottom: '6px'}}>Nome do Projeto / Tema:</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Chá Revelação Ursinho Príncipe" 
                        value={nomeProjeto} 
                        onChange={(e) => setNomeProjeto(e.target.value)} 
                        autoFocus 
                        className="input-modal-luxury"
                      />
                      
                      <div className="save-summary-badge">
                        <span>Total de Peças: <strong>{resumoComercial.totalPecas} un.</strong></span>
                        <span>Valor Estimado: <strong>R$ {resumoComercial.valorTotal.toFixed(2)}</strong></span>
                      </div>
                    </div>
                    <div className="modal-actions">
                        <button className="btn-cancel" onClick={() => setModalSalvarAberto(false)} disabled={salvandoProjeto}>Cancelar</button>
                        <button className="btn-confirm-luxury" onClick={salvarProjeto} disabled={salvandoProjeto}>
                          {salvandoProjeto ? 'Salvando...' : 'Salvar Projeto'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* 📂 MODAL: ABRIR PROJETOS (GALERIA VISUAL COM THUMBNAILS) */}
        {modalAbrirAberto && (
             <div className="overlay">
                <div className="modal-content large luxury-modal">
                    <div className="modal-header-luxury">
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <div>
                          <h3>Galeria de Projetos Salvos</h3>
                          <p>Escolha um projeto salvo para abrir ou gerenciar</p>
                        </div>
                        <span className="panel-badge-count">{projetosSalvos.length} projetos</span>
                      </div>
                    </div>
                    
                    <div className="projects-grid-cards">
                        {projetosSalvos.length === 0 ? (
                            <div className="empty-projects-state">
                              <Icons.Folder width={40} height={40} style={{opacity: 0.3}} />
                              <p>Nenhum projeto salvo no momento.</p>
                            </div> 
                        ) : (
                            projetosSalvos.map(proj => (
                                <div key={proj.id} className="project-card-luxury">
                                    <div className="proj-thumb" onClick={() => carregarProjeto(proj)}>
                                      {proj.thumbnail ? (
                                        <img src={proj.thumbnail} alt={proj.nome} />
                                      ) : (
                                        <div className="proj-thumb-placeholder">
                                          <Icons.Crown width={32} height={32} />
                                        </div>
                                      )}
                                      <div className="proj-hover-overlay">
                                        <span>Abrir Projeto</span>
                                      </div>
                                    </div>
                                    <div className="proj-info-bottom">
                                      <div className="proj-title-row">
                                        <h4 title={proj.nome}>{proj.nome}</h4>
                                        <button onClick={(e) => { e.stopPropagation(); deletarProjetoSalvo(proj.id, proj.nome); }} className="btn-del-proj-icon" title="Excluir Projeto">
                                          <Icons.Trash />
                                        </button>
                                      </div>
                                      <div className="proj-meta-row">
                                        <span>{proj.itens?.length || 0} itens</span>
                                        <span>{proj.createdAt ? new Date(proj.createdAt).toLocaleDateString('pt-BR') : ''}</span>
                                      </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="modal-footer-row">
                      <button className="btn-cancel" onClick={() => setModalAbrirAberto(false)}>Fechar Galeria</button>
                    </div>
                </div>
            </div>
         )}

         {/* 📦 MODAL: LISTA DETALHADA DE PEÇAS & CONFERÊNCIA COMERCIAL (ESTOQUE VS COMPRAS) */}
         {modalPecasAberto && (
           <div className="overlay">
             <div className="modal-content large luxury-modal">
               <div className="modal-header-luxury">
                 <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                   <div>
                     <h3>Conferência & Peças do Projeto</h3>
                     <p>Separação automática de peças do seu acervo e itens a comprar/sublocar</p>
                   </div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                     <span className="badge-modal-stock-count">📦 {resumoComercial.totalPecasEstoque} Estoque</span>
                     {resumoComercial.totalPecasExternas > 0 && (
                       <span className="badge-modal-buy-count">🛒 {resumoComercial.totalPecasExternas} a Comprar</span>
                     )}
                     <div className="modal-header-total">
                       Total Locação: <strong>R$ {resumoComercial.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                     </div>
                   </div>
                 </div>
               </div>

               <div className="pieces-table-wrapper" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                 {resumoComercial.lista.length === 0 ? (
                   <p style={{padding: '30px', textAlign: 'center', color: '#64748b'}}>Nenhuma peça foi adicionada ao cenário ainda.</p>
                 ) : (
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                     
                     {/* 1. SEÇÃO: PEÇAS DO ESTOQUE PRÓPRIO */}
                     {resumoComercial.listaEstoque.length > 0 && (
                       <div className="modal-pieces-group">
                         <div className="modal-group-title-bar">
                           <span className="group-title-txt">📦 PEÇAS DO SEU ESTOQUE (DISPONÍVEIS P/ LOCAÇÃO)</span>
                           <span className="group-count-tag">{resumoComercial.listaEstoque.length} itens</span>
                         </div>
                         <table className="pieces-table-luxury">
                           <thead>
                             <tr>
                               <th>Foto</th>
                               <th>Descrição da Peça</th>
                               <th>Categoria</th>
                               <th style={{textAlign: 'center'}}>Qtd</th>
                               <th style={{textAlign: 'right'}}>Unitário</th>
                               <th style={{textAlign: 'right'}}>Subtotal</th>
                             </tr>
                           </thead>
                           <tbody>
                             {resumoComercial.listaEstoque.map((it, idx) => (
                               <tr key={idx}>
                                 <td style={{width: '50px'}}>
                                   <img src={it.imagem || 'https://via.placeholder.com/50?text=Item'} className="piece-table-thumb" alt="" />
                                 </td>
                                 <td>
                                   <strong>{it.nome}</strong>
                                   {it.codigo && <div style={{fontSize: '11px', color: '#94a3b8'}}>Cód: {it.codigo}</div>}
                                 </td>
                                 <td>{it.categoria}</td>
                                 <td style={{textAlign: 'center', fontWeight: 'bold'}}>{it.quantidade} un.</td>
                                 <td style={{textAlign: 'right'}}>R$ {it.valorUnitario.toFixed(2)}</td>
                                 <td style={{textAlign: 'right', fontWeight: 'bold', color: '#0f172a'}}>R$ {it.subtotal.toFixed(2)}</td>
                               </tr>
                             ))}
                           </tbody>
                         </table>
                       </div>
                     )}

                     {/* 2. SEÇÃO: BEXIGAS & BALÕES PARA PRODUÇÃO DOS ARCOS */}
                     {resumoComercial.listaBaloesAComprar.length > 0 && (
                       <div className="modal-pieces-group">
                         <div className="mb-warning-buy-banner" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
                           <div className="mb-warning-buy-header">
                             <div className="mb-warning-buy-icon" style={{ background: '#f59e0b' }}>🎈</div>
                             <div>
                               <h4>🎈 Bexigas & Balões para Produção ({resumoComercial.totalBaloesAComprar} {resumoComercial.totalBaloesAComprar === 1 ? 'arco' : 'arcos'})</h4>
                               <p>Para montar os arcos de balões abaixo, compre os <strong>pacotes de bexigas (5", 9", 12", 18")</strong> e consumíveis (nylon, 260s) nas cores indicadas.</p>
                             </div>
                           </div>
                           <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                             <button 
                               type="button" 
                               className="btn-copy-shopping-list"
                               onClick={() => {
                                 const txt = resumoComercial.listaBaloesAComprar.map(it => `• ${it.quantidade}x ${it.nome} (Sugerido: 4 a 6 pacotes de bexigas)`).join('\n');
                                 const mensagem = `🎈 *LISTA DE BEXIGAS / BALÕES*\n*Projeto:* ${nomeProjeto || 'Moodboard'}\n\n${txt}\n\nGerado via Celebre Sistema.`;
                                 navigator.clipboard.writeText(mensagem);
                                 setAvisoCopiadoCompras(true);
                                 setTimeout(() => setAvisoCopiadoCompras(false), 3000);
                               }}
                             >
                               {avisoCopiadoCompras ? '✓ Lista Copiada p/ o WhatsApp!' : '📋 Copiar Lista de Bexigas (WhatsApp)'}
                             </button>
                             <button 
                               type="button" 
                               className="btn-go-to-compras"
                               onClick={() => { setModalPecasAberto(false); navigate('/compras'); }}
                             >
                               🛒 Gestão de Compras
                             </button>
                           </div>
                         </div>

                         <table className="pieces-table-luxury" style={{ marginTop: '10px' }}>
                           <thead>
                             <tr>
                               <th>Foto</th>
                               <th>Modelo do Arco / Cenografia</th>
                               <th>Categoria</th>
                               <th style={{textAlign: 'center'}}>Qtd de Arcos</th>
                               <th style={{textAlign: 'right'}}>Produção</th>
                             </tr>
                           </thead>
                           <tbody>
                             {resumoComercial.listaBaloesAComprar.map((it, idx) => (
                               <tr key={idx}>
                                 <td style={{width: '50px'}}>
                                   <img src={it.imagem || 'https://via.placeholder.com/50?text=Item'} className="piece-table-thumb" alt="" />
                                 </td>
                                 <td>
                                   <strong>{it.nome}</strong>
                                   <div style={{fontSize: '11px', color: '#b45309', fontWeight: '600'}}>Necessário comprar pacotes de bexigas p/ inflar</div>
                                 </td>
                                 <td>🎈 Balões</td>
                                 <td style={{textAlign: 'center', fontWeight: 'bold'}}>{it.quantidade} un.</td>
                                 <td style={{textAlign: 'right'}}>
                                   <span className="badge-card-balloon-buy" style={{ position: 'static' }}>🎈 Bexigas p/ Comprar</span>
                                 </td>
                               </tr>
                             ))}
                           </tbody>
                         </table>
                       </div>
                     )}

                     {/* 3. SEÇÃO: PEÇAS FÍSICAS FORA DO ESTOQUE (MÓVEIS / PAINÉIS / LED) */}
                     {resumoComercial.listaPecasAComprar.length > 0 && (
                       <div className="modal-pieces-group">
                         <div className="mb-warning-buy-banner" style={{ background: '#fff7ed', borderColor: '#fed7aa' }}>
                           <div className="mb-warning-buy-header">
                             <div className="mb-warning-buy-icon" style={{ background: '#ea580c' }}><Icons.ShoppingCart /></div>
                             <div>
                               <h4>📦 Peças Físicas p/ Sublocar ou Comprar ({resumoComercial.totalPecasAComprar} itens)</h4>
                               <p>Estes móveis, painéis ou estruturas permanentes <strong>não constam no seu estoque próprio</strong>. Providencie a sublocação com parceiros ou compra.</p>
                             </div>
                           </div>
                           <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                             <button 
                               type="button" 
                               className="btn-copy-shopping-list"
                               style={{ background: '#0f172a' }}
                               onClick={() => {
                                 const txt = resumoComercial.listaPecasAComprar.map(it => `• ${it.quantidade}x ${it.nome} (${it.categoria || 'Decoração'})`).join('\n');
                                 const mensagem = `📦 *LISTA DE SUBLOCAÇÃO / COMPRAS*\n*Projeto:* ${nomeProjeto || 'Moodboard'}\n\n${txt}\n\nGerado via Celebre Sistema.`;
                                 navigator.clipboard.writeText(mensagem);
                                 setAvisoCopiadoCompras(true);
                                 setTimeout(() => setAvisoCopiadoCompras(false), 3000);
                               }}
                             >
                               {avisoCopiadoCompras ? '✓ Lista Copiada!' : '📋 Copiar Lista de Peças'}
                             </button>
                             <button 
                               type="button" 
                               className="btn-go-to-compras"
                               style={{ background: '#ea580c' }}
                               onClick={() => { setModalPecasAberto(false); navigate('/compras'); }}
                             >
                               🛒 Ir para Compras
                             </button>
                           </div>
                         </div>

                         <table className="pieces-table-luxury" style={{ marginTop: '10px' }}>
                           <thead>
                             <tr>
                               <th>Foto</th>
                               <th>Peça Física</th>
                               <th>Categoria</th>
                               <th style={{textAlign: 'center'}}>Qtd</th>
                               <th style={{textAlign: 'right'}}>Status</th>
                             </tr>
                           </thead>
                           <tbody>
                             {resumoComercial.listaPecasAComprar.map((it, idx) => (
                               <tr key={idx}>
                                 <td style={{width: '50px'}}>
                                   <img src={it.imagem || 'https://via.placeholder.com/50?text=Item'} className="piece-table-thumb" alt="" />
                                 </td>
                                 <td>
                                   <strong>{it.nome}</strong>
                                   <div style={{fontSize: '11px', color: '#64748b'}}>Peça permanente externa</div>
                                 </td>
                                 <td>{it.categoria}</td>
                                 <td style={{textAlign: 'center', fontWeight: 'bold'}}>{it.quantidade} un.</td>
                                 <td style={{textAlign: 'right'}}>
                                   <span className="badge-table-need-buy">📦 Sublocar / Comprar</span>
                                 </td>
                               </tr>
                             ))}
                           </tbody>
                         </table>
                       </div>
                     )}

                   </div>
                 )}
               </div>

               <div className="modal-footer-row" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                 <button className="btn-cancel" onClick={() => setModalPecasAberto(false)}>Voltar ao Cenário</button>
                 <div style={{display: 'flex', gap: '10px'}}>
                   <button className="btn-header-action primary" onClick={() => { setModalPecasAberto(false); handleGerarPropostaPDF(); }}>
                     <Icons.FileText /> Exportar Proposta (PDF)
                   </button>
                   <button className="btn-confirm-luxury" onClick={() => { setModalPecasAberto(false); handleGerarLocacao(); }}>
                     <Icons.Crown /> Gerar Nova Locação
                   </button>
                 </div>
               </div>
             </div>
           </div>
         )}
      </div>

      {/* 🎛️ PAINEL LATERAL DIREITO PRO (ESTILO PHOTOSHOP / FIGMA / CANVA) */}
      {!modoApresentacao && painelDireitoAberto && (
        <>
          <div className="studio-right-panel-backdrop" onClick={() => setPainelDireitoAberto(false)} />
          <div className="studio-right-panel" onClick={e => e.stopPropagation()}>
          {/* Cabeçalho do Painel Direito */}
          <div className="right-panel-header">
            <div className="right-panel-title">
              <Icons.Sparkles width={14} height={14} />
              <span>ESTÚDIO PRO</span>
            </div>
            <button className="btn-close-right-panel" onClick={() => setPainelDireitoAberto(false)} title="Recolher Painel">✕</button>
          </div>

          {/* Abas do Painel Direito */}
          <div className="right-panel-tabs">
            <button 
              type="button"
              className={`r-tab-btn ${abaDireita === 'camadas' ? 'active' : ''}`}
              onClick={() => setAbaDireita('camadas')}
              title="Gerenciar Camadas e Z-Index"
            >
              <Icons.Layers width={13} height={13} />
              <span>Camadas ({itensCanvas.length})</span>
            </button>
            <button 
              type="button"
              className={`r-tab-btn ${abaDireita === 'propriedades' ? 'active' : ''}`}
              onClick={() => setAbaDireita('propriedades')}
              title="Ajustes de Posição, Escala e Efeitos"
            >
              <Icons.Sliders width={13} height={13} />
              <span>Propriedades</span>
            </button>
            <button 
              type="button"
              className={`r-tab-btn ${abaDireita === 'baloes' ? 'active' : ''}`}
              onClick={() => setAbaDireita('baloes')}
              title="Bexigas & Balões para Produção"
            >
              <span>🎈 Bexigas</span>
            </button>
          </div>

          {/* CONTEÚDO DA ABA CAMADAS (LAYERS) */}
          {abaDireita === 'camadas' && (
            <div className="right-panel-body">
              <div className="layers-header-row">
                <span>ORDEM DE PROFUNDIDADE (Z-INDEX)</span>
                <small>Topo para Base</small>
              </div>

              {itensCanvas.length === 0 ? (
                <div className="empty-layers-box">
                  <Icons.Layers width={28} height={28} style={{ opacity: 0.3, marginBottom: '6px' }} />
                  <p style={{ margin: 0, fontSize: '11.5px', color: '#64748b' }}>Nenhuma peça adicionada ao cenário.</p>
                </div>
              ) : (
                <div className="layers-list-scroll">
                  {[...itensCanvas].reverse().map((item, revIdx) => {
                    const isSelected = item.uniqueId === selecionadoId;
                    const isBaloes = item.categoria === 'Baloes' || item.shapeType?.startsWith('baloes_') || (item.nome || '').toLowerCase().includes('arco');
                    return (
                      <div 
                        key={item.uniqueId}
                        className={`layer-row-item ${isSelected ? 'selected' : ''} ${item.locked ? 'locked' : ''}`}
                        onClick={() => { setSelecionadoId(item.uniqueId); }}
                      >
                        <div className="layer-thumb-mini">
                          {item.type === 'text' ? (
                            <span className="layer-text-icon">T</span>
                          ) : item.imagem ? (
                            <img src={item.imagem} alt="" />
                          ) : (
                            <span className="layer-shape-icon">🏛️</span>
                          )}
                        </div>

                        <div className="layer-name-col">
                          <span className="layer-name-txt" title={item.nome || item.content || 'Item'}>
                            {item.type === 'text' ? `Texto: "${item.content || ''}"` : (item.nome || item.shapeType || 'Elemento')}
                          </span>
                          <span className="layer-type-tag">
                            {isBaloes ? '🎈 Bexigas / Balão' : item.isEstoqueProprio ? '📦 Estoque' : '🛒 Fora do Estoque'}
                          </span>
                        </div>

                        <div className="layer-actions-group" onClick={e => e.stopPropagation()}>
                          <button 
                            type="button"
                            className={`btn-layer-tool ${item.opacity === 0 ? 'muted' : ''}`} 
                            onClick={() => atualizarItem(item.uniqueId, { opacity: item.opacity === 0 ? 100 : 0 })}
                            title={item.opacity === 0 ? 'Mostrar Camada' : 'Ocultar Camada'}
                          >
                            <Icons.Eye width={11} height={11} />
                          </button>
                          <button 
                            type="button"
                            className={`btn-layer-tool ${item.locked ? 'active' : ''}`} 
                            onClick={() => toggleLock(item.uniqueId)}
                            title={item.locked ? 'Desbloquear' : 'Bloquear'}
                          >
                            <Icons.Lock width={11} height={11} />
                          </button>
                          <button 
                            type="button"
                            className="btn-layer-tool" 
                            onClick={() => bringToFront(item.uniqueId)}
                            title="Subir Camada"
                          >
                            <Icons.ArrowUp width={11} height={11} />
                          </button>
                          <button 
                            type="button"
                            className="btn-layer-tool" 
                            onClick={() => sendToBack(item.uniqueId)}
                            title="Descer Camada"
                          >
                            <Icons.ArrowDown width={11} height={11} />
                          </button>
                          <button 
                            type="button"
                            className="btn-layer-tool danger" 
                            onClick={() => deleteItem(item.uniqueId)}
                            title="Excluir Camada"
                          >
                            <Icons.Trash width={11} height={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* CONTEÚDO DA ABA PROPRIEDADES (INSPECTOR COMPLETO) */}
          {abaDireita === 'propriedades' && (
            <div className="right-panel-body">
              {itemSelecionado ? (
                <div className="inspector-content">
                  {/* Card do Item Selecionado */}
                  <div className="inspector-item-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="layer-thumb-mini" style={{ width: '28px', height: '28px' }}>
                        {itemSelecionado.type === 'text' ? 'T' : (itemSelecionado.imagem ? <img src={itemSelecionado.imagem} alt="" /> : '🏛️')}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ display: 'block', fontSize: '11.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {itemSelecionado.nome || (itemSelecionado.type === 'text' ? `Texto: "${itemSelecionado.content || ''}"` : 'Elemento')}
                        </strong>
                        <small style={{ fontSize: '9.5px', color: '#64748b' }}>
                          {itemSelecionado.isEstoqueProprio ? '📦 Peça do Estoque' : '🛒 Fora do Estoque'}
                        </small>
                      </div>
                    </div>
                  </div>

                  {/* 1. Posicionamento & Dimensões */}
                  <div className="inspector-section-title">Posicionamento & Dimensões</div>
                  <div className="inspector-2col-grid">
                    <div className="inspector-field">
                      <label>Largura (W)</label>
                      <input 
                        type="number" 
                        value={Math.round(itemSelecionado.width || 100)}
                        onChange={e => atualizarItem(selecionadoId, { width: Math.max(20, Number(e.target.value)) })}
                      />
                    </div>
                    <div className="inspector-field">
                      <label>Altura (H)</label>
                      <input 
                        type="number" 
                        value={Math.round(itemSelecionado.height || 100)}
                        onChange={e => atualizarItem(selecionadoId, { height: Math.max(20, Number(e.target.value)) })}
                      />
                    </div>
                    <div className="inspector-field">
                      <label>Posição X</label>
                      <input 
                        type="number" 
                        value={Math.round(itemSelecionado.x || 0)}
                        onChange={e => atualizarItem(selecionadoId, { x: Number(e.target.value) })}
                      />
                    </div>
                    <div className="inspector-field">
                      <label>Posição Y</label>
                      <input 
                        type="number" 
                        value={Math.round(itemSelecionado.y || 0)}
                        onChange={e => atualizarItem(selecionadoId, { y: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  {/* 2. Ajustes Visuais, Filtros & Efeitos */}
                  <div className="inspector-section-title" style={{ marginTop: '10px' }}>Filtros & Efeitos Visuais</div>
                  
                  {(itemSelecionado.type === 'image' || itemSelecionado.capaUrl) && (
                    <>
                      <div className="slider-group" style={{ marginBottom: '6px' }} title="Dê 2 cliques para resetar">
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 'bold' }}>
                          <span>Brilho</span>
                          <span>{itemSelecionado.brightness || 100}%</span>
                        </div>
                        <input 
                          type="range" min="0" max="200" 
                          value={itemSelecionado.brightness || 100}
                          onChange={e => atualizarItem(selecionadoId, { brightness: Number(e.target.value) })}
                          onDoubleClick={() => atualizarItem(selecionadoId, { brightness: 100 })}
                        />
                      </div>

                      <div className="slider-group" style={{ marginBottom: '6px' }} title="Dê 2 cliques para resetar">
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 'bold' }}>
                          <span>Contraste</span>
                          <span>{itemSelecionado.contrast || 100}%</span>
                        </div>
                        <input 
                          type="range" min="0" max="200" 
                          value={itemSelecionado.contrast || 100}
                          onChange={e => atualizarItem(selecionadoId, { contrast: Number(e.target.value) })}
                          onDoubleClick={() => atualizarItem(selecionadoId, { contrast: 100 })}
                        />
                      </div>
                    </>
                  )}

                  <div className="slider-group" style={{ marginBottom: '6px' }} title="Dê 2 cliques para resetar">
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 'bold' }}>
                      <span>Opacidade</span>
                      <span>{itemSelecionado.opacity ?? 100}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="100" 
                      value={itemSelecionado.opacity ?? 100}
                      onChange={e => atualizarItem(selecionadoId, { opacity: Number(e.target.value) })}
                      onDoubleClick={() => atualizarItem(selecionadoId, { opacity: 100 })}
                    />
                  </div>

                  <div className="slider-group" style={{ marginBottom: '6px' }} title="Dê 2 cliques para resetar">
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 'bold' }}>
                      <span>Sombra 3D</span>
                      <span>{itemSelecionado.shadow || 0}px</span>
                    </div>
                    <input 
                      type="range" min="0" max="50" 
                      value={itemSelecionado.shadow || 0}
                      onChange={e => atualizarItem(selecionadoId, { shadow: Number(e.target.value) })}
                      onDoubleClick={() => atualizarItem(selecionadoId, { shadow: 0 })}
                    />
                  </div>

                  <div className="slider-group" style={{ marginBottom: '6px' }} title="Dê 2 cliques para resetar">
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 'bold' }}>
                      <span>Rotação</span>
                      <span>{itemSelecionado.rotation || 0}°</span>
                    </div>
                    <input 
                      type="range" min="0" max="360" 
                      value={itemSelecionado.rotation || 0}
                      onChange={e => atualizarItem(selecionadoId, { rotation: Number(e.target.value) })}
                      onDoubleClick={() => atualizarItem(selecionadoId, { rotation: 0 })}
                    />
                  </div>

                  {/* 3. Se for Estrutura / Cilindro: Capa Sublimada & Tampo */}
                  {isEstruturaSelecionada && (
                    <div className="inspector-capa-section" style={{ marginTop: '10px', padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div className="inspector-section-title" style={{ marginTop: 0, marginBottom: '6px' }}>🎨 Capa de Tecido Sublimado</div>
                      
                      <button 
                        type="button"
                        className="btn-upload-capa" 
                        style={{ fontSize: '11px', padding: '6px 10px', marginBottom: '8px' }}
                        onClick={() => handleUploadCapaEstrutura(selecionadoId)}
                      >
                        <Icons.Image width={12} height={12} /> 📷 Subir Foto do PC
                      </button>

                      {/* Presets de Estampas */}
                      <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>Estampas Prontas:</div>
                      <div className="presets-capas-grid" style={{ maxHeight: '110px', overflowY: 'auto' }}>
                        {PRESETS_CAPAS_TEGIDO.map((capa, cIdx) => (
                          <div 
                            key={cIdx} 
                            className="preset-capa-card" 
                            style={{ backgroundImage: `url(${capa.url})` }} 
                            onClick={() => aplicarCapaNaEstrutura(selecionadoId, capa.url)}
                            title={capa.nome}
                          >
                            <span>{capa.nome}</span>
                          </div>
                        ))}
                      </div>

                      {/* Se for Cilindro: Acabamento do Tampo */}
                      {itemSelecionado.shapeType?.includes('cilindro') && (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>🔘 Tampo Superior:</div>
                          <div className="tampo-type-toggle" style={{ display: 'flex', gap: '4px' }}>
                            <button 
                              type="button"
                              className={`btn-tampo-type ${itemSelecionado.tampoTipo !== 'liso' ? 'active' : ''}`}
                              onClick={() => atualizarItem(selecionadoId, { tampoTipo: 'continua' })}
                              style={{ flex: 1, padding: '4px', fontSize: '10px' }}
                            >
                              🔄 Contínuo
                            </button>
                            <button 
                              type="button"
                              className={`btn-tampo-type ${itemSelecionado.tampoTipo === 'liso' ? 'active' : ''}`}
                              onClick={() => atualizarItem(selecionadoId, { tampoTipo: 'liso', tampoCor: itemSelecionado.tampoCor || '#ffffff' })}
                              style={{ flex: 1, padding: '4px', fontSize: '10px' }}
                            >
                              ⚪ Liso
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 4. Ações Rápidas de Alinhamento & Camada */}
                  <div className="inspector-section-title" style={{ marginTop: '10px' }}>Ações Rápidas</div>
                  <div className="inspector-actions-grid">
                    <button type="button" className="btn-inspector-action" onClick={() => alignItem('center-h')} title="Centralizar Horizontalmente">
                      <Icons.AlignHorizontal width={12} /> Centralizar
                    </button>
                    <button type="button" className="btn-inspector-action" onClick={() => alignItem('bottom')} title="Alinhar na Base do Chão">
                      <Icons.AlignBottom width={12} /> No Chão
                    </button>
                    <button type="button" className="btn-inspector-action" onClick={() => atualizarItem(selecionadoId, { flipH: !itemSelecionado.flipH })} title="Espelhar">
                      <Icons.Flip width={12} /> Espelhar
                    </button>
                    <button type="button" className="btn-inspector-action" onClick={() => duplicarItem(selecionadoId)} title="Duplicar">
                      <Icons.Copy width={12} /> Duplicar
                    </button>
                    <button type="button" className="btn-inspector-action" onClick={() => bringToFront(selecionadoId)} title="Trazer para Frente">
                      <Icons.ArrowUp width={12} /> Trazer Frente
                    </button>
                    <button type="button" className="btn-inspector-action" onClick={() => sendToBack(selecionadoId)} title="Enviar para Trás">
                      <Icons.ArrowDown width={12} /> Enviar Trás
                    </button>
                    <button 
                      type="button" 
                      className={`btn-inspector-action ${itemSelecionado.locked ? 'active' : ''}`} 
                      onClick={() => toggleLock(selecionadoId)} 
                      title={itemSelecionado.locked ? 'Desbloquear' : 'Bloquear'}
                    >
                      {itemSelecionado.locked ? <><Icons.Lock width={12} /> Bloqueado</> : <><Icons.Unlock width={12} /> Bloquear</>}
                    </button>
                    <button type="button" className="btn-inspector-action" style={{ color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2' }} onClick={() => deleteItem(selecionadoId)} title="Excluir Elemento">
                      <Icons.Trash width={12} /> Excluir
                    </button>
                  </div>
                </div>
              ) : (
                <div className="empty-layers-box">
                  <p style={{ margin: 0, fontSize: '11.5px', color: '#64748b' }}>Selecione um elemento na prancheta para ver e editar suas propriedades aqui.</p>
                </div>
              )}
            </div>
          )}

          {/* CONTEÚDO DA ABA BEXIGAS & BALÕES */}
          {abaDireita === 'baloes' && (
            <div className="right-panel-body">
              <div className="balloon-calc-box">
                <div className="balloon-calc-header">
                  <h4>🎈 Produção de Bexigas</h4>
                  <p>Planejamento de cores e pacotes para montagem dos arcos do projeto.</p>
                </div>

                {itensCanvas.filter(i => i.categoria === 'Baloes' || (i.nome || '').toLowerCase().includes('arco') || i.shapeType?.startsWith('baloes_')).length === 0 ? (
                  <div className="empty-layers-box">
                    <p style={{ margin: 0, fontSize: '11.5px', color: '#64748b' }}>Nenhum arco de balões adicionado ao cenário.</p>
                    <small style={{ color: '#94a3b8', marginTop: '4px' }}>Adicione um arco da Galeria para calcular as bexigas.</small>
                  </div>
                ) : (
                  <div className="balloon-arches-list">
                    {itensCanvas.filter(i => i.categoria === 'Baloes' || (i.nome || '').toLowerCase().includes('arco') || i.shapeType?.startsWith('baloes_')).map((arco, aIdx) => (
                      <div key={aIdx} className="balloon-arch-item-card">
                        <div className="arch-card-top">
                          {arco.imagem && <img src={arco.imagem} alt="" className="arch-thumb-mini" />}
                          <div>
                            <strong>{arco.nome || 'Arco Orgânico'}</strong>
                            <div style={{ fontSize: '10.5px', color: '#64748b' }}>Estimativa: ~180 a 250 bexigas</div>
                          </div>
                        </div>

                        <div className="arch-packages-hint">
                          <strong>📦 Pacotes de Bexiga Sugeridos:</strong>
                          <ul>
                            <li>2x Pacotes 9" ou 10" (Base)</li>
                            <li>2x Pacotes 5" (Acabamento)</li>
                            <li>1x Pacote 12" ou 18" (Destaque)</li>
                          </ul>
                        </div>
                      </div>
                    ))}

                    <button 
                      type="button" 
                      className="btn-copy-balloon-shopping"
                      onClick={() => {
                        const arcos = itensCanvas.filter(i => i.categoria === 'Baloes' || (i.nome || '').toLowerCase().includes('arco') || i.shapeType?.startsWith('baloes_'));
                        const txt = arcos.map(a => `• ${a.nome} (Sugerido: 4 a 6 pacotes de 50 un)`).join('\n');
                        const msg = `🎈 *LISTA DE BEXIGAS PARA PRODUÇÃO*\n*Projeto:* ${nomeProjeto || 'Moodboard'}\n\n${txt}\n\nGerado via Celebre Sistema.`;
                        navigator.clipboard.writeText(msg);
                        alert("✓ Lista de Bexigas copiada para a Área de Transferência!");
                      }}
                    >
                      📋 Copiar Lista de Bexigas (WhatsApp)
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        </>
      )}
    </div>
  );
};

export default Moodboard;