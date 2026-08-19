import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { collection, getDocs, getDoc, setDoc, query, addDoc, deleteDoc, doc, where, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom'; 
import { db } from '../../firebaseConfig';
import { getAuth } from 'firebase/auth';
import html2canvas from 'html2canvas'; 
import { gerarPropostaMoodboardPDF } from '../../utils/gerarPropostaMoodboardPDF';
import './Moodboard.css';

// 🪄 Remoção de Fundo via WASM (sem API externa, 100% offline)
let bgRemovalLib = null;
const carregarBgRemoval = async () => {
  if (!bgRemovalLib) {
    const mod = await import('@imgly/background-removal');
    bgRemovalLib = mod;
  }
  return bgRemovalLib;
};

// 🎨 Ícones SVG do Celebre Studio 3.0
const Icons = {
  Crown: (props) => <svg {...props} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>,
  Couch: (props) => <svg {...props} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12h20v8H2zm0 0l2-6h16l2 6M6 16v4m12-4v4"/></svg>,
  Balloon: (props) => <svg {...props} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a7 7 0 0 0-7 7c0 4.2 4.2 8.4 6 9.8l1 .2 1-.2c1.8-1.4 6-5.6 6-9.8a7 7 0 0 0-7-7z"/><path d="M12 19v3"/></svg>,
  UploadCloud: (props) => <svg {...props} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>,
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
  Sliders: (props) => <svg {...props} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
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

// 🧱 Presets Nativos de Cenografia & Texturas de Alta Definição
const PRESETS_PAREDE_PADRAO = [];

const PRESETS_CHAO_PADRAO = [];

// 🏞️ Presets Nativos de Ambientes Inteiros / Salões de Festa (100% de Fundo)
const PRESETS_AMBIENTE_PADRAO = [];

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

// 🎈 Componente SVG de Guirlanda & Arcos de Balões 3D Realistas (Clássico, Orgânico & Modelável)
const GuirlandaBaloesRealista = ({ 
  tipo = 'lateral_l', 
  cores = ['#b76e79', '#dfb6b2', '#f4e6d4', '#c5a059', '#ffffff'],
  curvatura = 30,
  ondulacao = 25,
  volume = 'organico',
  qtdBaloes = 20,
  tamanhoBalao = 24,
  seed = 0,
  formatoPortal = 'romano',
  estiloPortal = 'espiral',
  coberturaAro = 'meio_aro',
  estiloColuna = 'organica',
  densidadeCluster = 'cheio'
}) => {
  
  // 0. 🌊 GERADOR PROCEDURAL DINÂMICO & CUSTOMIZÁVEL DE GUIRLANDAS (Modelador Superior / Mesa)
  const gerarGuirlandaCustomizavel = () => {
    const baloes = [];
    const W = 400;
    const H = 200;
    const numSteps = Math.max(8, Math.min(45, Number(qtdBaloes) || 20));
    const paddingX = 40;
    const centerY = H / 2;
    const curv = Number(curvatura ?? 30);
    const ond = Number(ondulacao ?? 25);
    const vol = volume || 'organico';
    const tam = Number(tamanhoBalao || 24);
    const currentSeed = Number(seed || 0);

    const pseudoRand = (i, offset = 0) => {
      const x = Math.sin(i * 12.9898 + currentSeed * 78.233 + offset) * 43758.5453;
      return x - Math.floor(x);
    };

    const spinePoints = [];
    for (let i = 0; i < numSteps; i++) {
      const t = i / (numSteps - 1);
      const x = paddingX + t * (W - 2 * paddingX);
      const yArco = Math.sin(t * Math.PI) * (-curv * 0.75);
      const yOnda = Math.sin(t * Math.PI * 2) * (ond * 0.45);
      const y = centerY + yArco + yOnda;
      spinePoints.push({ x, y, t });
    }

    // Camada 1: Balões Grandes de Fundo / Base (Profundidade & Volume 3D)
    if (vol === 'organico' || vol === 'mega_luxo') {
      const step = vol === 'mega_luxo' ? 1 : 2;
      for (let i = 0; i < numSteps; i += step) {
        const p = spinePoints[i];
        const nextP = spinePoints[Math.min(numSteps - 1, i + 1)];
        const prevP = spinePoints[Math.max(0, i - 1)];
        const dx = nextP.x - prevP.x || 1;
        const dy = nextP.y - prevP.y || 0;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;

        const side = (i % 2 === 0 ? 1 : -1);
        const offsetDist = (tam * 0.6) * side;
        const r = tam * (1.2 + pseudoRand(i, 1) * 0.35);
        const corIdx = Math.floor(pseudoRand(i, 2) * cores.length);

        baloes.push({
          cx: Math.round(p.x + nx * offsetDist),
          cy: Math.round(p.y + ny * offsetDist),
          r: Math.round(r),
          c: corIdx
        });
      }
    }

    // Camada 2: Balões Centrais Principais
    for (let i = 0; i < numSteps; i++) {
      const p = spinePoints[i];
      const offsetCent = (pseudoRand(i, 3) - 0.5) * (tam * 0.35);
      const r = tam * (0.85 + pseudoRand(i, 4) * 0.3);
      const corIdx = (i + Math.floor(currentSeed)) % cores.length;

      baloes.push({
        cx: Math.round(p.x),
        cy: Math.round(p.y + offsetCent),
        r: Math.round(r),
        c: corIdx
      });
    }

    // Camada 3: Clusters de Minis 5" na Frente (Desconstruído)
    if (vol === 'organico' || vol === 'mega_luxo') {
      const stepMini = vol === 'mega_luxo' ? 1 : 2;
      for (let i = 0; i < numSteps; i += stepMini) {
        const p = spinePoints[i];
        const rMini = tam * 0.45;
        const offsetX = (pseudoRand(i, 5) - 0.5) * tam * 0.8;
        const offsetY = (pseudoRand(i, 6) - 0.5) * tam * 0.8;
        const corIdx = Math.floor(pseudoRand(i, 7) * cores.length);

        baloes.push({
          cx: Math.round(p.x + offsetX),
          cy: Math.round(p.y + offsetY),
          r: Math.max(6, Math.round(rMini)),
          c: corIdx
        });
      }
    }

    return { baloes, viewBoxW: W, viewBoxH: H };
  };

  // 1. 🏛️ ARCO PORTAL DE ENTRADA (Romano, Retangular, Circular 360°, Aberto)
  const gerarArcoClassicoPortal = () => {
    const baloes = [];
    const rBalao = 18;
    const clusters = [];
    const fmt = formatoPortal || 'romano';
    const est = estiloPortal || 'espiral';
    const s = Number(seed || 0);
    const W = 360;
    const H = 340;

    if (fmt === 'retangular') {
      // ⬛ PORTAL RETANGULAR / QUADRADO (Colunas Retas + Topo Reto 90°)
      for (let i = 0; i < 9; i++) {
        clusters.push({ x: 50, y: 310 - i * 28, clusterIdx: i });
      }
      for (let i = 1; i <= 9; i++) {
        clusters.push({ x: 50 + i * 26, y: 55, clusterIdx: 9 + i });
      }
      for (let i = 1; i < 9; i++) {
        clusters.push({ x: 310, y: 55 + i * 28, clusterIdx: 19 + i });
      }
    } else if (fmt === 'circular_fechado') {
      // ⭕ ARO / PORTAL CIRCULAR 360° FECHADO
      const centerX = 180;
      const centerY = 170;
      const radius = 135;
      const total = 28;
      for (let i = 0; i < total; i++) {
        const angle = (i / total) * Math.PI * 2;
        clusters.push({
          x: Math.round(centerX + radius * Math.cos(angle)),
          y: Math.round(centerY + radius * Math.sin(angle)),
          clusterIdx: i
        });
      }
    } else if (fmt === 'aberto_assimetrico') {
      // 🚪 PORTAL ABERTO / ASSIMÉTRICO (Passarela moderna)
      for (let i = 0; i < 11; i++) {
        clusters.push({ x: 50, y: 310 - i * 25, clusterIdx: i });
      }
      for (let i = 0; i <= 10; i++) {
        const angle = Math.PI - (i / 10) * (Math.PI * 0.7);
        clusters.push({
          x: 170 + 120 * Math.cos(angle),
          y: 120 - 75 * Math.sin(angle),
          clusterIdx: 11 + i
        });
      }
    } else {
      // 🏛️ ARCO ROMANO CLÁSSICO (Semicírculo Superior + Colunas)
      const numLeft = 6;
      const numCurve = 16;
      const numRight = 6;

      for (let i = 0; i < numLeft; i++) {
        clusters.push({ x: 50, y: 305 - i * 26, clusterIdx: i });
      }
      const centerX = 180;
      const centerY = 145;
      const radius = 130;
      for (let i = 0; i <= numCurve; i++) {
        const angle = Math.PI - (i / numCurve) * Math.PI;
        clusters.push({
          x: centerX + radius * Math.cos(angle),
          y: centerY - radius * Math.sin(angle),
          clusterIdx: numLeft + i
        });
      }
      for (let i = 0; i < numRight; i++) {
        clusters.push({ x: 310, y: 175 + i * 26, clusterIdx: numLeft + numCurve + 1 + i });
      }
    }

    if (est === 'organico') {
      // Estilo Orgânico Desconstruído
      clusters.forEach((c, idx) => {
        const rBig = 22 + ((idx + s) % 3) * 4;
        baloes.push({ cx: Math.round(c.x), cy: Math.round(c.y), r: rBig, c: (idx + s) % cores.length });
        const side = (idx + s) % 2 === 0 ? 12 : -12;
        baloes.push({ cx: Math.round(c.x + side), cy: Math.round(c.y - 6), r: 16, c: (idx + 1 + s) % cores.length });
        if (idx % 2 === 0) {
          baloes.push({ cx: Math.round(c.x - side * 0.5), cy: Math.round(c.y + 8), r: 9, c: (idx + 2 + s) % cores.length });
        }
      });
    } else {
      // Estilo Espiral Clássico Tetra (Com suporte a Embaralhar Seed)
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
            c: (c.clusterIdx + off.cOffset + s) % cores.length
          });
        });
      });
    }

    return { baloes, viewBoxW: W, viewBoxH: H };
  };

  // 2. 💫 ARCO PARA ARO REDONDO / CIRCULAR (Meio Aro 180°, 3/4 270°, Completo 360°, Topo 120°)
  const gerarArcoAroRedondo = () => {
    const baloes = [];
    const centerX = 160;
    const centerY = 160;
    const radius = 125;
    const cob = coberturaAro || 'meio_aro';
    const s = Number(seed || 0);
    
    let startAngleDeg = 145;
    let spanDeg = 240;
    
    if (cob === 'completo') {
      startAngleDeg = 90;
      spanDeg = 360;
    } else if (cob === 'topo') {
      startAngleDeg = 150;
      spanDeg = 120;
    } else if (cob === 'meio_aro') {
      startAngleDeg = 150;
      spanDeg = 180;
    } else if (cob === 'tres_quartos') {
      startAngleDeg = 160;
      spanDeg = 260;
    }

    const totalClusters = Math.max(12, Math.round((spanDeg / 360) * 32));

    for (let i = 0; i < totalClusters; i++) {
      const t = i / (totalClusters - 1);
      const angle = (startAngleDeg - t * spanDeg) * (Math.PI / 180);
      const cx = centerX + radius * Math.cos(angle);
      const cy = centerY - radius * Math.sin(angle);
      
      const colorIdx = (Math.floor(t * cores.length) + s) % cores.length;

      // Balão Fundo
      const rBase = 26 + Math.sin(i * 1.8 + s) * 8;
      baloes.push({ cx: Math.round(cx), cy: Math.round(cy), r: rBase, c: colorIdx });

      // Balões Médios Adjacentes
      const rAdj = radius + (i % 2 === 0 ? 18 : -16);
      const angleOffset = angle + (i % 2 === 0 ? 0.08 : -0.08);
      baloes.push({
        cx: Math.round(centerX + rAdj * Math.cos(angleOffset)),
        cy: Math.round(centerY - rAdj * Math.sin(angleOffset)),
        r: 20 + ((i + s) % 3) * 3,
        c: (colorIdx + 1 + (i % 2)) % cores.length
      });

      // Minis na Frente
      if (i % 2 === 0) {
        baloes.push({
          cx: Math.round(cx + (i % 3 === 0 ? 6 : -6)),
          cy: Math.round(cy + (i % 2 === 0 ? -6 : 6)),
          r: 12,
          c: (colorIdx + 2) % cores.length
        });
      }
    }

    return { baloes, viewBoxW: 320, viewBoxH: 320 };
  };

  // 3. 🗼 COLUNA DE BALÕES (Espiral, Orgânica, com Big Balloon)
  const gerarColunaBaloes = () => {
    const baloes = [];
    const W = 140;
    const H = 380;
    const numClusters = 14;
    const centerX = 70;
    const est = estiloColuna || 'organica';
    const s = Number(seed || 0);

    if (est === 'com_big_balloon') {
      baloes.push({ cx: centerX, cy: 55, r: 48, c: s % cores.length });
      for (let j = 0; j < 4; j++) {
        const a = (j / 4) * Math.PI * 2;
        baloes.push({ cx: centerX + 18 * Math.cos(a), cy: 100 + 8 * Math.sin(a), r: 10, c: (j + 1 + s) % cores.length });
      }
      for (let i = 0; i < 9; i++) {
        const y = 130 + i * 26;
        baloes.push({ cx: centerX - 12, cy: y, r: 18, c: (i + 1 + s) % cores.length });
        baloes.push({ cx: centerX + 12, cy: y, r: 18, c: (i + 2 + s) % cores.length });
      }
    } else if (est === 'espiral') {
      for (let i = 0; i < numClusters; i++) {
        const y = 350 - i * 24;
        const offsets = [
          { dx: -12, dy: -6, r: 18, cOffset: 0 },
          { dx: 12, dy: -6, r: 18, cOffset: 1 },
          { dx: -12, dy: 6, r: 18, cOffset: 2 },
          { dx: 12, dy: 6, r: 18, cOffset: 3 }
        ];
        offsets.forEach(off => {
          baloes.push({ cx: centerX + off.dx, cy: y + off.dy, r: off.r, c: (i + off.cOffset + s) % cores.length });
        });
      }
    } else {
      for (let i = 0; i < numClusters; i++) {
        const y = 350 - i * 24;
        const side = (i % 2 === 0 ? 1 : -1);
        const r = 22 + ((i + s) % 3) * 4;
        baloes.push({ cx: centerX + side * 10, cy: y, r, c: (i + s) % cores.length });
        baloes.push({ cx: centerX - side * 12, cy: y - 5, r: 16, c: (i + 1 + s) % cores.length });
        if (i % 2 === 0) {
          baloes.push({ cx: centerX, cy: y + 8, r: 10, c: (i + 2 + s) % cores.length });
        }
      }
    }

    return { baloes, viewBoxW: W, viewBoxH: H };
  };

  // 4. 🫧 CLUSTER DE CHÃO ORGÂNICO 3D (Desconstruído & Realista de Festa)
  const gerarClusterChao = () => {
    const baloes = [];
    const W = 320;
    const H = 190;
    const dens = densidadeCluster || 'cheio';
    const s = Number(seed || 0);

    // 1. Camada Traseira (Profundidade & Apoio Amplo no Piso)
    const camadaTraseira = [
      { cx: 70, cy: 138, r: 38, c: 0 },
      { cx: 130, cy: 130, r: 44, c: 1 },
      { cx: 195, cy: 134, r: 42, c: 2 },
      { cx: 255, cy: 142, r: 36, c: 3 },
      { cx: 100, cy: 88, r: 35, c: 4 },
      { cx: 162, cy: 80, r: 40, c: 0 },
      { cx: 220, cy: 92, r: 34, c: 1 }
    ];

    // 2. Camada Principal Frontal (Formato Orgânico Desconstruído Asimétrico)
    const camadaPrincipal = [
      { cx: 48, cy: 150, r: 32, c: 2 },
      { cx: 105, cy: 144, r: 38, c: 3 },
      { cx: 165, cy: 140, r: 40, c: 4 },
      { cx: 226, cy: 146, r: 34, c: 0 },
      { cx: 280, cy: 155, r: 26, c: 1 },
      { cx: 135, cy: 98, r: 32, c: 2 },
      { cx: 190, cy: 96, r: 30, c: 3 },
      { cx: 152, cy: 54, r: 26, c: 4 }
    ];

    // 3. Minis Orgânicos 5" nos Encaixes e Frentes (Riqueza e Textura de Festa)
    const minis = [
      { cx: 38, cy: 164, r: 14, c: 1 },
      { cx: 78, cy: 158, r: 13, c: 0 },
      { cx: 88, cy: 122, r: 15, c: 2 },
      { cx: 128, cy: 158, r: 14, c: 4 },
      { cx: 145, cy: 125, r: 16, c: 1 },
      { cx: 178, cy: 154, r: 14, c: 3 },
      { cx: 202, cy: 126, r: 15, c: 0 },
      { cx: 212, cy: 72, r: 14, c: 2 },
      { cx: 250, cy: 160, r: 13, c: 4 },
      { cx: 168, cy: 68, r: 12, c: 3 },
      { cx: 118, cy: 68, r: 13, c: 1 }
    ];

    const qtdMinis = dens === 'luxo' ? minis.length : dens === 'suave' ? 6 : 9;
    const todos = [...camadaTraseira, ...camadaPrincipal, ...minis.slice(0, qtdMinis)];

    todos.forEach(b => {
      baloes.push({ cx: b.cx, cy: b.cy, r: b.r, c: (b.c + s) % cores.length });
    });

    return { baloes, viewBoxW: W, viewBoxH: H };
  };

  // 5. 🎀 GUIRLANDA LATERAL EM L
  const baloesL = [
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

  let res = null;

  if (tipo === 'guirlanda_horizontal' || tipo === 'baloes_dinamico') {
    res = gerarGuirlandaCustomizavel();
  } else if (tipo === 'arco_classico_portal') {
    res = gerarArcoClassicoPortal();
  } else if (tipo === 'baloes_aro_redondo') {
    res = gerarArcoAroRedondo();
  } else if (tipo === 'coluna_baloes') {
    res = gerarColunaBaloes();
  } else if (tipo === 'cluster_chao' || tipo === 'baloes_cluster_chao') {
    res = gerarClusterChao();
  } else {
    const s = Number(seed || 0);
    const baloesSeedL = baloesL.map(b => ({ ...b, c: (b.c + s) % cores.length }));
    res = { baloes: baloesSeedL, viewBoxW: 260, viewBoxH: 360 };
  }

  const listaBaloes = res.baloes || [];
  const viewBoxW = res.viewBoxW || 300;
  const viewBoxH = res.viewBoxH || 300;

  return (
    <svg 
      width="100%" 
      height="100%" 
      viewBox={`0 0 ${viewBoxW} ${viewBoxH}`} 
      style={{ 
        overflow: 'visible', 
        pointerEvents: 'none'
      }}
    >
      <defs>
        {cores.map((c, i) => (
          <radialGradient key={i} id={`grad-balao-3d-${i}`} cx="30%" cy="26%" r="76%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.88" />
            <stop offset="20%" stopColor="#ffffff" stopOpacity="0.22" />
            <stop offset="48%" stopColor={c} />
            <stop offset="82%" stopColor={c} stopOpacity="0.95" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.28" />
          </radialGradient>
        ))}
      </defs>

      {/* Sombra de apoio no piso para cluster de chão */}
      {(tipo === 'cluster_chao' || tipo === 'baloes_cluster_chao') && (
        <ellipse cx={viewBoxW / 2} cy={viewBoxH - 12} rx={viewBoxW * 0.44} ry="10" fill="rgba(0,0,0,0.18)" filter="blur(4px)" />
      )}

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

// 🪑 Componente Mesa Retangular 3D de Festa com Pés Realistas & Tampo Chanfrado
const MesaRetangular3D = ({ item }) => {
  const cor = item.color || '#8B6914';
  const tampoCor = item.tampoCor || item.color || '#8B6914';
  const capaUrl = item.capaUrl;
  const posX = item.capaPosX ?? 50;
  const posY = item.capaPosY ?? 50;
  const scale = item.capaScale ?? 1;

  return (
    <div className="mesa-retangular-3d-wrapper" style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'visible' }}>
      {/* Tampo da Mesa com Perspectiva e Borda Chanfrada */}
      <div 
        style={{
          width: '100%',
          height: '32%',
          background: capaUrl ? undefined : `linear-gradient(180deg, ${tampoCor} 0%, ${tampoCor} 75%, rgba(0,0,0,0.3) 100%)`,
          borderRadius: '4px 4px 2px 2px',
          boxShadow: '0 6px 14px rgba(0,0,0,0.22), inset 0 1px 2px rgba(255,255,255,0.4)',
          position: 'relative',
          zIndex: 2,
          overflow: 'hidden'
        }}
      >
        {capaUrl ? (
          <img 
            src={capaUrl} 
            alt="Capa Mesa" 
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
          <div style={{ width: '100%', height: '100%', background: `linear-gradient(90deg, rgba(255,255,255,0.15) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.2) 100%)` }} />
        )}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: 'rgba(0,0,0,0.35)' }} />
      </div>

      {/* Estrutura / Pés da Mesa Cavalete / Rústica */}
      <div style={{ width: '100%', height: '68%', position: 'relative', display: 'flex', justifyContent: 'space-between', padding: '0 12%', boxSizing: 'border-box' }}>
        {/* Travessa Superior */}
        <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: '14%', background: `linear-gradient(180deg, rgba(0,0,0,0.3) 0%, ${cor} 100%)`, borderRadius: '0 0 2px 2px' }} />
        
        {/* Pé Esquerdo */}
        <div style={{ width: '14%', height: '100%', background: `linear-gradient(90deg, ${cor} 0%, rgba(255,255,255,0.15) 40%, rgba(0,0,0,0.25) 100%)`, borderRadius: '0 0 3px 3px', boxShadow: '2px 4px 8px rgba(0,0,0,0.2)' }} />
        
        {/* Travessa Central */}
        <div style={{ position: 'absolute', bottom: '25%', left: '16%', right: '16%', height: '8%', background: cor, opacity: 0.85, boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />

        {/* Pé Direito */}
        <div style={{ width: '14%', height: '100%', background: `linear-gradient(90deg, rgba(0,0,0,0.25) 0%, rgba(255,255,255,0.15) 60%, ${cor} 100%)`, borderRadius: '0 0 3px 3px', boxShadow: '-2px 4px 8px rgba(0,0,0,0.2)' }} />
      </div>
    </div>
  );
};

// 🛋️ Componente Mesa Provençal / Clássica com Pés Torneados
const MesaProvencal3D = ({ item }) => {
  const cor = item.color || '#ffffff';
  const tampoCor = item.tampoCor || item.color || '#ffffff';
  const capaUrl = item.capaUrl;
  const posX = item.capaPosX ?? 50;
  const posY = item.capaPosY ?? 50;
  const scale = item.capaScale ?? 1;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        width: '100%', height: '30%',
        background: `linear-gradient(180deg, ${tampoCor} 0%, rgba(0,0,0,0.15) 100%)`,
        borderRadius: '6px 6px 2px 2px',
        boxShadow: '0 6px 14px rgba(0,0,0,0.2), inset 0 2px 3px rgba(255,255,255,0.7)',
        position: 'relative', zIndex: 2, overflow: 'hidden'
      }}>
        {capaUrl && (
          <img src={capaUrl} alt="Capa" draggable="false" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${posX}% ${posY}%`, transform: `scale(${scale})`, pointerEvents: 'none' }} />
        )}
      </div>
      <svg width="100%" height="70%" viewBox="0 0 200 120" style={{ overflow: 'visible', pointerEvents: 'none' }}>
        <path d="M 10,0 Q 100,25 190,0 L 190,15 Q 100,35 10,15 Z" fill={cor} filter="drop-shadow(0 2px 3px rgba(0,0,0,0.15))" />
        <path d="M 15,10 C 5,40 30,70 12,120 L 22,120 C 42,70 20,40 28,10 Z" fill={cor} stroke="rgba(0,0,0,0.15)" strokeWidth="1" />
        <path d="M 185,10 C 195,40 170,70 188,120 L 178,120 C 158,70 180,40 172,10 Z" fill={cor} stroke="rgba(0,0,0,0.15)" strokeWidth="1" />
      </svg>
    </div>
  );
};

// 🔲 Componente Mesa Cubo Aramada / Tubular Minimalista
const MesaCuboAramada3D = ({ item }) => {
  const cor = item.color || '#c5a059';
  const tampoCor = item.tampoCor || '#ffffff';
  const capaUrl = item.capaUrl;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        width: '100%', height: '24%',
        background: tampoCor,
        borderRadius: '3px',
        boxShadow: '0 6px 14px rgba(0,0,0,0.25)',
        position: 'relative', zIndex: 2, overflow: 'hidden'
      }}>
        {capaUrl && <img src={capaUrl} alt="Capa" draggable="false" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '3px', pointerEvents: 'none' }} />}
      </div>
      <svg width="100%" height="76%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ marginTop: '-2px', pointerEvents: 'none' }}>
        <rect x="5" y="0" width="90" height="95" fill="none" stroke={cor} strokeWidth="4" />
        <line x1="5" y1="95" x2="95" y2="95" stroke={cor} strokeWidth="5" />
        <line x1="25" y1="0" x2="25" y2="95" stroke={cor} strokeWidth="2.5" opacity="0.7" />
        <line x1="75" y1="0" x2="75" y2="95" stroke={cor} strokeWidth="2.5" opacity="0.7" />
        <line x1="50" y1="0" x2="50" y2="95" stroke={cor} strokeWidth="3" opacity="0.9" />
      </svg>
    </div>
  );
};

// 🪵 Componente Painel Ripado Madeira
const PainelRipado3D = ({ item }) => {
  const cor = item.color || '#ba8249';
  const ripas = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#2d1808',
      borderRadius: '8px 8px 0 0',
      padding: '4px',
      boxSizing: 'border-box',
      display: 'flex',
      gap: '4px',
      boxShadow: '0 12px 30px rgba(0,0,0,0.3)',
      overflow: 'hidden'
    }}>
      {ripas.map(r => (
        <div 
          key={r} 
          style={{ 
            flex: 1, 
            height: '100%', 
            background: `linear-gradient(90deg, ${cor} 0%, rgba(255,255,255,0.18) 35%, rgba(0,0,0,0.2) 100%)`,
            borderRadius: '2px',
            boxShadow: '1px 0 3px rgba(0,0,0,0.4)'
          }} 
        />
      ))}
    </div>
  );
};

// ✨ Componente Painel Shimmer Wall (Paetê / Lantejoulas)
const PainelShimmer3D = ({ item }) => {
  const cor = item.color || '#d4af37';
  const grid = Array.from({ length: 48 });
  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#0f172a',
      borderRadius: '6px',
      padding: '6px',
      boxSizing: 'border-box',
      display: 'grid',
      gridTemplateColumns: 'repeat(6, 1fr)',
      gridTemplateRows: 'repeat(8, 1fr)',
      gap: '4px',
      boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
      overflow: 'hidden'
    }}>
      {grid.map((_, idx) => (
        <div
          key={idx}
          style={{
            background: (idx % 2 === 0) 
              ? `radial-gradient(circle at 35% 35%, #ffffff 0%, ${cor} 60%, rgba(0,0,0,0.4) 100%)` 
              : `radial-gradient(circle at 65% 65%, #fffdf0 0%, ${cor} 70%, rgba(0,0,0,0.3) 100%)`,
            borderRadius: '2px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            transform: `rotate(${((idx * 17) % 15) - 7}deg)`
          }}
        />
      ))}
    </div>
  );
};

// 🪟 Componente Biombo 3 Folhas Articulado
const PainelBiombo3D = ({ item }) => {
  const cor = item.color || '#ffffff';
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', gap: '4px', filter: 'drop-shadow(0 12px 25px rgba(0,0,0,0.22))' }}>
      {[0, 1, 2].map(folha => (
        <div key={folha} style={{
          flex: 1, height: '100%',
          backgroundColor: cor,
          border: `3px solid rgba(0,0,0,0.12)`,
          borderRadius: '4px',
          boxSizing: 'border-box',
          padding: '6px 4px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: `linear-gradient(135deg, ${cor} 0%, rgba(0,0,0,0.05) 100%)`
        }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ height: '5%', background: 'rgba(0,0,0,0.08)', borderRadius: '1px' }} />
          ))}
        </div>
      ))}
    </div>
  );
};

// 🏛️ Componente Arco Romano Duplo Metálico com Suporte a Capa Sublimada
const ArcoDuplo3D = ({ item }) => {
  const cor = item.color || '#c5a059';
  const capaUrl = item.capaUrl;
  const posX = item.capaPosX ?? 50;
  const posY = item.capaPosY ?? 50;
  const scale = item.capaScale ?? 1;
  const clipId = `arco-duplo-clip-${item.uniqueId || 'default'}`;

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="100%" height="100%" viewBox="0 0 200 300" style={{ pointerEvents: 'none', overflow: 'visible' }}>
        <defs>
          <clipPath id={clipId}>
            <path d="M 28,300 L 28,95 A 72,72 0 0,1 172,95 L 172,300 Z" />
          </clipPath>
          <linearGradient id={`grad-metal-${item.uniqueId || 'def'}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={cor} stopOpacity="0.9" />
            <stop offset="35%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="70%" stopColor={cor} />
            <stop offset="100%" stopColor={cor} stopOpacity="0.75" />
          </linearGradient>
        </defs>

        {/* Painel Interno com Capa de Tecido se houver */}
        {capaUrl ? (
          <g clipPath={`url(#${clipId})`}>
            <rect x="25" y="20" width="150" height="280" fill="#ffffff" />
            <image 
              href={capaUrl} 
              x="25" 
              y="20" 
              width="150" 
              height="280" 
              preserveAspectRatio="xMidYMid slice" 
              transform={`scale(${scale})`}
              transformOrigin={`${posX}% ${posY}%`}
              style={{ objectPosition: `${posX}% ${posY}%` }}
            />
          </g>
        ) : (
          /* Fundo translúcido suave quando vazado */
          <path d="M 32,300 L 32,95 A 68,68 0 0,1 168,95 L 168,300 Z" fill="rgba(255,255,255,0.03)" />
        )}

        {/* 1. Aro Externo (Tubo Metálico 3D) */}
        <path 
          d="M 12,300 L 12,95 A 88,88 0 0,1 188,95 L 188,300" 
          fill="none" 
          stroke={cor} 
          strokeWidth="6" 
          strokeLinecap="round" 
        />
        <path 
          d="M 12,300 L 12,95 A 88,88 0 0,1 188,95 L 188,300" 
          fill="none" 
          stroke={`url(#grad-metal-${item.uniqueId || 'def'})`} 
          strokeWidth="5" 
        />

        {/* 2. Aro Interno (Tubo Metálico Paralelo) */}
        <path 
          d="M 28,300 L 28,95 A 72,72 0 0,1 172,95 L 172,300" 
          fill="none" 
          stroke={cor} 
          strokeWidth="5" 
          strokeLinecap="round" 
        />
        <path 
          d="M 28,300 L 28,95 A 72,72 0 0,1 172,95 L 172,300" 
          fill="none" 
          stroke={`url(#grad-metal-${item.uniqueId || 'def'})`} 
          strokeWidth="4" 
        />

        {/* Travessas Metálicas de Conexão entre os Aros */}
        {[
          { x1: 12, y1: 160, x2: 28, y2: 160 },
          { x1: 12, y1: 230, x2: 28, y2: 230 },
          { x1: 172, y1: 160, x2: 188, y2: 160 },
          { x1: 172, y1: 230, x2: 188, y2: 230 },
          { x1: 100, y1: 7, x2: 100, y2: 23 },
          { x1: 45, y1: 38, x2: 56, y2: 50 },
          { x1: 155, y1: 38, x2: 144, y2: 50 }
        ].map((t, idx) => (
          <line key={idx} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={cor} strokeWidth="3" strokeLinecap="round" />
        ))}

        {/* Pés de Base de Chão */}
        <rect x="4" y="296" width="32" height="4" rx="2" fill={cor} />
        <rect x="164" y="296" width="32" height="4" rx="2" fill={cor} />
      </svg>
    </div>
  );
};

// 🪑 Componente Cômoda Vintage 3 Gavetas
const ComodaVintage3D = ({ item }) => {
  const cor = item.color || '#ffffff';
  return (
    <div style={{
      width: '100%', height: '100%',
      backgroundColor: cor,
      borderRadius: '8px',
      border: '2px solid rgba(0,0,0,0.1)',
      boxShadow: '0 12px 24px rgba(0,0,0,0.22)',
      display: 'flex',
      flexDirection: 'column',
      padding: '6px',
      boxSizing: 'border-box',
      gap: '4px',
      background: `linear-gradient(180deg, ${cor} 0%, rgba(0,0,0,0.06) 100%)`
    }}>
      {[1, 2, 3].map(g => (
        <div key={g} style={{
          flex: 1,
          border: '1.5px solid rgba(0,0,0,0.12)',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.4)',
          position: 'relative',
          boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.6)'
        }}>
          <div style={{ width: '18px', height: '6px', borderRadius: '3px', background: '#c5a059', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />
        </div>
      ))}
    </div>
  );
};

// 🛒 Componente Carrinho Gourmet / Chá / Doces
const CarrinhoGourmet3D = ({ item }) => {
  const cor = item.color || '#c5a059';
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg width="100%" height="100%" viewBox="0 0 180 180" style={{ pointerEvents: 'none' }}>
        {/* Bandeja Superior */}
        <rect x="25" y="30" width="130" height="14" rx="3" fill={cor} stroke="rgba(0,0,0,0.2)" strokeWidth="1" />
        {/* Bandeja Inferior */}
        <rect x="35" y="100" width="110" height="12" rx="2" fill={cor} stroke="rgba(0,0,0,0.2)" strokeWidth="1" />
        {/* Estrutura / Alça Curva */}
        <path d="M 25,36 L 15,20 Q 10,12 18,8 Q 28,8 30,16 L 36,36" fill="none" stroke={cor} strokeWidth="4" strokeLinecap="round" />
        {/* Colunas Verticais */}
        <line x1="45" y1="44" x2="45" y2="135" stroke={cor} strokeWidth="4" />
        <line x1="135" y1="44" x2="135" y2="135" stroke={cor} strokeWidth="4" />
        {/* Rodas Grandes Clássicas */}
        <circle cx="45" cy="145" r="24" fill="none" stroke={cor} strokeWidth="4" />
        <circle cx="45" cy="145" r="4" fill={cor} />
        <line x1="45" y1="121" x2="45" y2="169" stroke={cor} strokeWidth="2" />
        <line x1="21" y1="145" x2="69" y2="145" stroke={cor} strokeWidth="2" />
        {/* Rodinha Dianteira */}
        <circle cx="135" cy="155" r="14" fill="none" stroke={cor} strokeWidth="3" />
        <circle cx="135" cy="155" r="3" fill={cor} />
      </svg>
    </div>
  );
};

// 🌿 CATÁLOGO DE ÍCONES & ENFEITES DE FESTA VETORIAIS (PARA COMPOSIÇÃO MANUAL)
const ORNAMENTOS_FESTA = {
  ramo_esquerdo: {
    nome: 'Ramo Esquerdo',
    emoji: '🌿',
    viewBox: '0 0 100 120',
    path: (
      <g>
        <path d="M50,115 Q45,70 20,10" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <path d="M20,10 Q12,18 20,28 Q32,22 20,10 Z" fill="currentColor" />
        <path d="M28,32 Q15,36 24,48 Q38,42 28,32 Z" fill="currentColor" />
        <path d="M36,54 Q22,60 30,72 Q46,65 36,54 Z" fill="currentColor" />
        <path d="M43,76 Q30,82 38,94 Q54,86 43,76 Z" fill="currentColor" />
        <path d="M32,25 Q46,28 38,40 Q26,34 32,25 Z" fill="currentColor" />
        <path d="M40,48 Q54,52 46,64 Q34,58 40,48 Z" fill="currentColor" />
        <path d="M47,70 Q61,74 53,86 Q41,80 47,70 Z" fill="currentColor" />
      </g>
    )
  },
  ramo_direito: {
    nome: 'Ramo Direito',
    emoji: '🌿',
    viewBox: '0 0 100 120',
    path: (
      <g transform="translate(100, 0) scale(-1, 1)">
        <path d="M50,115 Q45,70 20,10" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <path d="M20,10 Q12,18 20,28 Q32,22 20,10 Z" fill="currentColor" />
        <path d="M28,32 Q15,36 24,48 Q38,42 28,32 Z" fill="currentColor" />
        <path d="M36,54 Q22,60 30,72 Q46,65 36,54 Z" fill="currentColor" />
        <path d="M43,76 Q30,82 38,94 Q54,86 43,76 Z" fill="currentColor" />
        <path d="M32,25 Q46,28 38,40 Q26,34 32,25 Z" fill="currentColor" />
        <path d="M40,48 Q54,52 46,64 Q34,58 40,48 Z" fill="currentColor" />
        <path d="M47,70 Q61,74 53,86 Q41,80 47,70 Z" fill="currentColor" />
      </g>
    )
  },
  guirlanda_louro: {
    nome: 'Guirlanda de Louros',
    emoji: '🍃',
    viewBox: '0 0 120 120',
    path: (
      <g>
        <path d="M60,110 C25,110 10,75 10,45 C10,25 25,10 40,5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M60,110 C95,110 110,75 110,45 C110,25 95,10 80,5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M40,5 Q32,12 40,20 Q50,14 40,5 Z" fill="currentColor" />
        <path d="M24,20 Q14,24 20,34 Q32,30 24,20 Z" fill="currentColor" />
        <path d="M14,40 Q6,46 12,56 Q24,50 14,40 Z" fill="currentColor" />
        <path d="M12,65 Q8,74 16,82 Q26,74 12,65 Z" fill="currentColor" />
        <path d="M24,88 Q22,98 32,104 Q38,94 24,88 Z" fill="currentColor" />
        <path d="M80,5 Q88,12 80,20 Q70,14 80,5 Z" fill="currentColor" />
        <path d="M96,20 Q106,24 100,34 Q88,30 96,20 Z" fill="currentColor" />
        <path d="M106,40 Q114,46 108,56 Q96,50 106,40 Z" fill="currentColor" />
        <path d="M108,65 Q112,74 104,82 Q94,74 108,65 Z" fill="currentColor" />
        <path d="M96,88 Q98,98 88,104 Q82,94 96,88 Z" fill="currentColor" />
        <circle cx="60" cy="110" r="4" fill="currentColor" />
      </g>
    )
  },
  coroa_imperial: {
    nome: 'Coroa Imperial',
    emoji: '👑',
    viewBox: '0 0 100 80',
    path: (
      <g>
        <path d="M10,65 L90,65 L80,25 L60,45 L50,15 L40,45 L20,25 Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="50" cy="12" r="4" fill="currentColor" />
        <circle cx="20" cy="22" r="3.5" fill="currentColor" />
        <circle cx="80" cy="22" r="3.5" fill="currentColor" />
        <circle cx="35" cy="42" r="2.5" fill="currentColor" />
        <circle cx="65" cy="42" r="2.5" fill="currentColor" />
        <rect x="12" y="68" width="76" height="6" rx="3" fill="currentColor" />
      </g>
    )
  },
  tiara_princesa: {
    nome: 'Tiara Princesa',
    emoji: '👑',
    viewBox: '0 0 100 60',
    path: (
      <g>
        <path d="M10,50 Q50,40 90,50" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <path d="M25,47 Q35,25 50,10 Q65,25 75,47" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path d="M38,44 Q45,28 50,18 Q55,28 62,44" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="50" cy="8" r="3.5" fill="currentColor" />
        <circle cx="35" cy="23" r="2.5" fill="currentColor" />
        <circle cx="65" cy="23" r="2.5" fill="currentColor" />
      </g>
    )
  },
  coracao_romantico: {
    nome: 'Coração Romântico',
    emoji: '💖',
    viewBox: '0 0 100 90',
    path: (
      <path d="M50,85 C20,55 5,35 15,18 C25,3 45,10 50,25 C55,10 75,3 85,18 C95,35 80,55 50,85 Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    )
  },
  aliancas: {
    nome: 'Alianças de Casamento',
    emoji: '💍',
    viewBox: '0 0 100 70',
    path: (
      <g>
        <circle cx="38" cy="38" r="26" fill="none" stroke="currentColor" strokeWidth="6" />
        <circle cx="62" cy="38" r="26" fill="none" stroke="currentColor" strokeWidth="6" />
        <polygon points="38,6 44,14 38,20 32,14" fill="currentColor" />
      </g>
    )
  },
  borboleta: {
    nome: 'Borboleta 3D',
    emoji: '🦋',
    viewBox: '0 0 100 90',
    path: (
      <g>
        <path d="M50,30 Q50,70 50,75" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <path d="M48,35 C20,5 5,25 15,50 C20,62 35,60 48,52 Z" fill="currentColor" opacity="0.9" />
        <path d="M48,55 C25,60 20,75 30,85 C40,90 46,75 48,65 Z" fill="currentColor" opacity="0.8" />
        <path d="M52,35 C80,5 95,25 85,50 C80,62 65,60 52,52 Z" fill="currentColor" opacity="0.9" />
        <path d="M52,55 C75,60 80,75 70,85 C60,90 54,75 52,65 Z" fill="currentColor" opacity="0.8" />
        <path d="M49,30 Q40,15 32,12 M51,30 Q60,15 68,12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </g>
    )
  },
  pomba_paz: {
    nome: 'Pomba Batizado',
    emoji: '🕊️',
    viewBox: '0 0 100 90',
    path: (
      <g>
        <path d="M15,55 C25,45 45,45 55,30 C65,15 80,10 85,15 C75,25 65,40 70,55 C55,50 40,65 25,75 C20,78 12,65 15,55 Z" fill="currentColor" />
        <path d="M55,30 C50,15 40,5 30,2 C40,12 45,25 48,38 Z" fill="currentColor" />
        <path d="M85,15 Q92,12 95,8 M90,12 Q93,9 90,6" fill="none" stroke="currentColor" strokeWidth="2" />
      </g>
    )
  },
  estrelas_brilho: {
    nome: 'Estrelas / Brilho',
    emoji: '⭐',
    viewBox: '0 0 100 100',
    path: (
      <g>
        <path d="M50,10 Q50,45 15,50 Q50,55 50,90 Q50,55 85,50 Q50,45 50,10 Z" fill="currentColor" />
        <path d="M80,15 Q80,25 70,27 Q80,29 80,39 Q80,29 90,27 Q80,25 80,15 Z" fill="currentColor" />
        <path d="M22,70 Q22,78 14,80 Q22,82 22,90 Q22,82 30,80 Q22,78 22,70 Z" fill="currentColor" />
      </g>
    )
  },
  laco_festa: {
    nome: 'Laço de Festa',
    emoji: '🎀',
    viewBox: '0 0 100 80',
    path: (
      <g>
        <circle cx="50" cy="35" r="7" fill="currentColor" />
        <path d="M45,35 C15,15 10,50 45,40 Z" fill="currentColor" />
        <path d="M55,35 C85,15 90,50 55,40 Z" fill="currentColor" />
        <path d="M46,40 Q35,65 25,75 Q40,68 48,42 Z" fill="currentColor" />
        <path d="M54,40 Q65,65 75,75 Q60,68 52,42 Z" fill="currentColor" />
      </g>
    )
  },
  flor_de_lis: {
    nome: 'Flor de Lis',
    emoji: '⚜️',
    viewBox: '0 0 100 100',
    path: (
      <g>
        <path d="M50,10 C56,28 64,38 72,42 C62,45 54,40 50,48 C46,40 38,45 28,42 C36,38 44,28 50,10 Z" fill="currentColor" />
        <path d="M50,10 C50,30 50,45 50,75 C54,85 62,90 70,92 C56,92 50,85 50,75 C50,85 44,92 30,92 C38,90 46,85 50,75 Z" fill="currentColor" />
        <path d="M28,42 C12,46 5,60 15,75 C25,85 35,70 34,58 C24,65 18,55 28,42 Z" fill="currentColor" />
        <path d="M72,42 C88,46 95,60 85,75 C75,85 65,70 66,58 C76,65 82,55 72,42 Z" fill="currentColor" />
        <rect x="30" y="58" width="40" height="7" rx="3.5" fill="currentColor" />
      </g>
    )
  },
  pezinho_bebe: {
    nome: 'Pézinhos de Bebê',
    emoji: '👶',
    viewBox: '0 0 100 90',
    path: (
      <g>
        <path d="M35,45 C35,65 24,78 18,72 C12,65 15,45 25,35 C32,28 35,35 35,45 Z" fill="currentColor" />
        <circle cx="27" cy="22" r="4.5" fill="currentColor" />
        <circle cx="35" cy="25" r="3.5" fill="currentColor" />
        <circle cx="40" cy="30" r="3" fill="currentColor" />
        <circle cx="43" cy="36" r="2.5" fill="currentColor" />
        <circle cx="44" cy="42" r="2" fill="currentColor" />
        <path d="M65,45 C65,65 76,78 82,72 C88,65 85,45 75,35 C68,28 65,35 65,45 Z" fill="currentColor" />
        <circle cx="73" cy="22" r="4.5" fill="currentColor" />
        <circle cx="65" cy="25" r="3.5" fill="currentColor" />
        <circle cx="60" cy="30" r="3" fill="currentColor" />
        <circle cx="57" cy="36" r="2.5" fill="currentColor" />
        <circle cx="56" cy="42" r="2" fill="currentColor" />
      </g>
    )
  },
  cruz_batizado: {
    nome: 'Cruz de Batizado',
    emoji: '✝️',
    viewBox: '0 0 80 100',
    path: (
      <g>
        <path d="M34,10 L46,10 Q50,10 50,14 L50,30 L66,30 Q70,30 70,34 L70,46 Q70,50 66,50 L50,50 L50,86 Q50,90 46,90 L34,90 Q30,90 30,86 L30,50 L14,50 Q10,50 10,46 L10,34 Q10,30 14,30 L30,30 L30,14 Q30,10 34,10 Z" fill="currentColor" />
        <circle cx="40" cy="40" r="4" fill="#ffffff" opacity="0.6" />
      </g>
    )
  },
  capelo_formatura: {
    nome: 'Capelo Formatura',
    emoji: '🎓',
    viewBox: '0 0 100 80',
    path: (
      <g>
        <polygon points="50,15 92,35 50,55 8,35" fill="currentColor" />
        <path d="M30,46 L30,62 Q50,75 70,62 L70,46 Q50,58 30,46 Z" fill="currentColor" opacity="0.9" />
        <path d="M50,35 Q65,40 75,55 L75,68" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="75" cy="68" r="3" fill="currentColor" />
      </g>
    )
  }
};

// 🌿 Componente de Renderização de Enfeite / Ícone Vetorial
const ElementoOrnamentoSVG = ({ item }) => {
  const ornamentoData = ORNAMENTOS_FESTA[item.ornamentType] || ORNAMENTOS_FESTA.ramo_esquerdo;
  const material = item.material || 'gold_mirror';
  const color = item.color || '#c5a059';

  const fillStyle = material === 'gold_mirror' 
    ? `url(#grad-gold-orn-${item.uniqueId})` 
    : material === 'rose_gold'
    ? `url(#grad-rose-orn-${item.uniqueId})`
    : material === 'silver_mirror'
    ? `url(#grad-silver-orn-${item.uniqueId})`
    : material === 'mdf_wood'
    ? `url(#pat-mdf-wood-orn)`
    : color;

  const mdfStroke = material === 'mdf_wood' ? '#5a3512' : undefined;
  const mdfStrokeW = material === 'mdf_wood' ? 1.2 : undefined;

  return (
    <svg 
      width="100%" 
      height="100%" 
      viewBox={ornamentoData.viewBox || "0 0 100 100"} 
      style={{ 
        overflow: 'visible',
        color: fillStyle,
        filter: material === 'mdf_wood' 
          ? 'drop-shadow(2px 3px 2px rgba(60,30,10,0.6))' 
          : material === 'gold_mirror' || material === 'rose_gold' || material === 'silver_mirror'
          ? 'drop-shadow(1.5px 2px 2px rgba(0,0,0,0.35))'
          : (item.shadow > 0 ? `drop-shadow(2px 2px ${item.shadow}px rgba(0,0,0,0.4))` : undefined)
      }}
    >
      <defs>
        <linearGradient id={`grad-gold-orn-${item.uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#bf953f" />
          <stop offset="25%" stopColor="#fcf6ba" />
          <stop offset="50%" stopColor="#b38728" />
          <stop offset="75%" stopColor="#fbf5b7" />
          <stop offset="100%" stopColor="#aa771c" />
        </linearGradient>
        <linearGradient id={`grad-rose-orn-${item.uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#b76e79" />
          <stop offset="30%" stopColor="#ffd1dc" />
          <stop offset="50%" stopColor="#e0a9af" />
          <stop offset="75%" stopColor="#f7c5cc" />
          <stop offset="100%" stopColor="#9c4f5a" />
        </linearGradient>
        <linearGradient id={`grad-silver-orn-${item.uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8a8a8a" />
          <stop offset="25%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#a6a6a6" />
          <stop offset="75%" stopColor="#f5f5f5" />
          <stop offset="100%" stopColor="#737373" />
        </linearGradient>
        <pattern id="pat-mdf-wood-orn" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(25)">
          <rect width="40" height="40" fill="#d29b62" />
          <line x1="0" y1="5" x2="40" y2="5" stroke="#ba8249" strokeWidth="2.5" />
          <line x1="0" y1="12" x2="40" y2="12" stroke="#e0b17e" strokeWidth="1.5" />
          <line x1="0" y1="20" x2="40" y2="20" stroke="#a36e37" strokeWidth="3" opacity="0.85" />
          <line x1="0" y1="28" x2="40" y2="28" stroke="#be8850" strokeWidth="2" />
          <line x1="0" y1="36" x2="40" y2="36" stroke="#8e5a25" strokeWidth="1.5" opacity="0.75" />
        </pattern>
      </defs>
      <g stroke={mdfStroke} strokeWidth={mdfStrokeW}>
        {ornamentoData.path}
      </g>
    </svg>
  );
};

// ✍️ Componente Avançado de Tipografia, Letreiros, Texto Curvo & Materiais de Festa
const ElementoTextoPersonalizado = ({ item, isEditing, onDoubleClick, onChange, onBlur }) => {
  const material = item.material || 'none';
  const textureUrl = item.textureUrl || '';
  const textureScale = Number(item.textureScale || 100);
  const strokeWidth = Number(item.strokeWidth || 0);
  const strokeColor = item.strokeColor || '#ffffff';
  const curvatura = Number(item.curvatura || 0);
  const placaFundo = item.placaFundo || 'nenhuma';
  const fontSize = Number(item.fontSize || 48);
  const letterSpacing = Number(item.letterSpacing || 0);
  const textShadow = item.neonGlow > 0 
    ? `0 0 4px ${item.neonColor || item.color}, 0 0 10px ${item.neonColor || item.color}, 0 0 ${item.neonGlow}px ${item.neonColor || item.color}, 0 0 ${item.neonGlow * 1.8}px ${item.neonColor || item.color}` 
    : (item.shadow > 0 ? `2px 2px ${item.shadow}px rgba(0,0,0,0.5)` : 'none');

  let materialClass = '';
  if (material === 'gold_mirror') materialClass = 'text-mat-gold_mirror';
  else if (material === 'rose_gold') materialClass = 'text-mat-rose_gold';
  else if (material === 'silver_mirror') materialClass = 'text-mat-silver_mirror';
  else if (material === 'mdf_wood' && !textureUrl) materialClass = 'text-mat-mdf_wood';
  else if (material === 'glitter_gold') materialClass = 'text-mat-glitter_gold';
  else if (material === 'backlight_halo') materialClass = 'text-mat-backlight_halo';

  const isCustomTex = material === 'custom_texture' || !!textureUrl;

  // 🌈 Renderizador de Texto Curvo SVG (Com Fórmula de Arco Circular Geométrica Precisa)
  const renderCurvedText = () => {
    const content = item.content || 'Texto';
    const textLen = content.length || 5;
    const textPixelWidth = textLen * fontSize * 0.7;
    const span = Math.max(textPixelWidth + 80, 240);
    const absCurve = Math.max(5, Math.abs(curvatura));
    const sagitta = (absCurve / 100) * (span * 0.42);
    const R = Math.round((sagitta * sagitta + (span / 2) * (span / 2)) / (2 * Math.max(1, sagitta)));
    const svgW = span + 60;
    const svgH = Math.round(Math.max(fontSize * 2.2 + sagitta + 35, 110));
    const pathId = `curve-path-${item.uniqueId}`;

    const startX = 30;
    const endX = svgW - 30;
    let d = '';

    if (curvatura > 0) {
      // Arco Convexo (topo)
      const startY = svgH - 20;
      d = `M ${startX},${startY} A ${R} ${R} 0 0 1 ${endX},${startY}`;
    } else {
      // Arco Côncavo (base)
      const startY = 20;
      d = `M ${startX},${startY} A ${R} ${R} 0 0 0 ${endX},${startY}`;
    }

    const fillStyle = isCustomTex && textureUrl
      ? `url(#pat-custom-tex-${item.uniqueId})`
      : material === 'gold_mirror' 
      ? `url(#grad-gold-${item.uniqueId})` 
      : material === 'rose_gold'
      ? `url(#grad-rose-${item.uniqueId})`
      : material === 'silver_mirror'
      ? `url(#grad-silver-${item.uniqueId})`
      : material === 'mdf_wood'
      ? `url(#pat-mdf-wood-${item.uniqueId})`
      : material === 'glitter_gold'
      ? `url(#pat-glitter-${item.uniqueId})`
      : (item.color || '#c5a059');

    const mdfStroke = (material === 'mdf_wood' && !isCustomTex) ? '#5a3512' : (strokeWidth > 0 ? strokeColor : undefined);
    const mdfStrokeW = (material === 'mdf_wood' && !isCustomTex) ? 1.5 : (strokeWidth > 0 ? strokeWidth : undefined);
    const patSize = Math.max(60, Math.round(fontSize * (textureScale / 60)));

    return (
      <svg 
        width={svgW} 
        height={svgH} 
        viewBox={`0 0 ${svgW} ${svgH}`} 
        style={{ 
          overflow: 'visible',
          filter: (material === 'mdf_wood' || isCustomTex || material === 'gold_mirror' || material === 'glitter_gold') 
            ? 'drop-shadow(2px 3px 3px rgba(0,0,0,0.45))' 
            : undefined 
        }}
      >
        <defs>
          <path id={pathId} d={d} fill="none" />
          {isCustomTex && textureUrl && (
            <pattern id={`pat-custom-tex-${item.uniqueId}`} patternUnits="userSpaceOnUse" width={patSize} height={patSize}>
              <image href={textureUrl} x="0" y="0" width={patSize} height={patSize} preserveAspectRatio="xMidYMid slice" />
            </pattern>
          )}
          <linearGradient id={`grad-gold-${item.uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#bf953f" />
            <stop offset="25%" stopColor="#fcf6ba" />
            <stop offset="50%" stopColor="#b38728" />
            <stop offset="75%" stopColor="#fbf5b7" />
            <stop offset="100%" stopColor="#aa771c" />
          </linearGradient>
          <linearGradient id={`grad-rose-${item.uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#b76e79" />
            <stop offset="30%" stopColor="#ffd1dc" />
            <stop offset="50%" stopColor="#e0a9af" />
            <stop offset="75%" stopColor="#f7c5cc" />
            <stop offset="100%" stopColor="#9c4f5a" />
          </linearGradient>
          <linearGradient id={`grad-silver-${item.uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8a8a8a" />
            <stop offset="25%" stopColor="#ffffff" />
            <stop offset="50%" stopColor="#a6a6a6" />
            <stop offset="75%" stopColor="#f5f5f5" />
            <stop offset="100%" stopColor="#737373" />
          </linearGradient>
          <pattern id={`pat-mdf-wood-${item.uniqueId}`} width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(25)">
            <rect width="40" height="40" fill="#d29b62" />
            <line x1="0" y1="5" x2="40" y2="5" stroke="#ba8249" strokeWidth="2.5" />
            <line x1="0" y1="12" x2="40" y2="12" stroke="#e0b17e" strokeWidth="1.5" />
            <line x1="0" y1="20" x2="40" y2="20" stroke="#a36e37" strokeWidth="3" opacity="0.85" />
            <line x1="0" y1="28" x2="40" y2="28" stroke="#be8850" strokeWidth="2" />
            <line x1="0" y1="36" x2="40" y2="36" stroke="#8e5a25" strokeWidth="1.5" opacity="0.75" />
          </pattern>
          <pattern id={`pat-glitter-${item.uniqueId}`} width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill="#d4af37" />
            <circle cx="4" cy="4" r="2" fill="#fff7cc" />
            <circle cx="14" cy="8" r="2.5" fill="#ffd700" />
            <circle cx="8" cy="15" r="1.8" fill="#fff" />
            <circle cx="17" cy="16" r="1.5" fill="#aa771c" />
          </pattern>
        </defs>
        <text
          fontSize={fontSize}
          fontFamily={item.fontFamily}
          fontWeight={item.fontWeight}
          fontStyle={item.fontStyle}
          letterSpacing={letterSpacing ? `${letterSpacing}px` : undefined}
          fill={fillStyle}
          stroke={mdfStroke}
          strokeWidth={mdfStrokeW}
          paintOrder="stroke fill"
          style={{ 
            textShadow: (!isCustomTex && material === 'none') ? textShadow : undefined, 
            filter: item.neonGlow > 0 ? `drop-shadow(0 0 ${item.neonGlow * 0.7}px ${item.neonColor || item.color})` : undefined 
          }}
        >
          <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
            {content}
          </textPath>
        </text>
      </svg>
    );
  };

  // Conteúdo do Texto (Curvo ou Normal)
  const renderTextBody = () => {
    if (curvatura !== 0 && !isEditing) {
      return renderCurvedText();
    }

    if (isEditing) {
      return (
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
            onChange(e.target.value);
          }}
          onBlur={onBlur}
          style={{
            minWidth: '100px',
            width: item.content ? 'auto' : '150px',
            height: 'auto',
            fontSize: `${fontSize}px`,
            color: item.color,
            fontFamily: item.fontFamily,
            fontWeight: item.fontWeight,
            fontStyle: item.fontStyle,
            textAlign: item.textAlign,
            letterSpacing: letterSpacing ? `${letterSpacing}px` : undefined,
            WebkitTextStroke: strokeWidth > 0 ? `${strokeWidth}px ${strokeColor}` : undefined,
            paintOrder: 'stroke fill',
            background: 'rgba(255,255,255,0.95)',
            border: '2px dashed #0f172a',
            borderRadius: '6px',
            outline: 'none',
            resize: 'none',
            overflow: 'hidden',
            padding: '5px 10px',
            lineHeight: '1.2',
            whiteSpace: 'pre',
            textShadow
          }}
        />
      );
    }

    const customTexStyle = (isCustomTex && textureUrl) ? {
      backgroundImage: `url("${textureUrl}")`,
      backgroundSize: `${textureScale}%`,
      backgroundPosition: 'center',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      color: 'transparent',
      display: 'inline-block',
      filter: item.shadow > 0 ? `drop-shadow(2px 2px ${item.shadow}px rgba(0,0,0,0.5))` : 'drop-shadow(1px 2px 2px rgba(0,0,0,0.35))'
    } : {};

    return (
      <div
        onDoubleClick={onDoubleClick}
        className={materialClass}
        style={{
          width: 'max-content',
          height: 'max-content',
          fontSize: `${fontSize}px`,
          color: (isCustomTex && textureUrl) ? 'transparent' : item.color,
          fontFamily: item.fontFamily,
          fontWeight: item.fontWeight,
          fontStyle: item.fontStyle,
          textAlign: item.textAlign,
          letterSpacing: letterSpacing ? `${letterSpacing}px` : undefined,
          WebkitTextStroke: strokeWidth > 0 ? `${strokeWidth}px ${strokeColor}` : undefined,
          paintOrder: 'stroke fill',
          cursor: 'text',
          whiteSpace: 'pre-wrap',
          padding: '5px 10px',
          lineHeight: '1.2',
          textShadow: (isCustomTex && textureUrl) ? 'none' : textShadow,
          ...customTexStyle
        }}
      >
        {item.content || <span style={{ opacity: 0, paddingLeft: '50px' }}>_</span>}
      </div>
    );
  };

  // Se tiver placa de suporte de fundo
  if (placaFundo && placaFundo !== 'nenhuma') {
    return (
      <div className={`placa-decorativa-wrapper placa-${placaFundo}`}>
        {renderTextBody()}
      </div>
    );
  }

  return renderTextBody();
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
  const [abaAtiva, setAbaAtiva] = useState('estoque'); 
  const [editingTextId, setEditingTextId] = useState(null);
  const [subAbaTexto, setSubAbaTexto] = useState('texto'); // 'texto' | 'icones'
  const [cenarioAba, setCenarioAba] = useState('parede'); // 'parede' | 'piso' | 'ambiente'
  const [wallBackground, setWallBackground] = useState('#f8fafc');
  const [floorBackground, setFloorBackground] = useState('#e2e8f0');
  const [activeSurface, setActiveSurface] = useState('wall');
  
  const [texturasParede, setTexturasParede] = useState(PRESETS_PAREDE_PADRAO);
  const [texturasChao, setTexturasChao] = useState(PRESETS_CHAO_PADRAO);
  const [filtroCategoriaTextura, setFiltroCategoriaTextura] = useState('todas'); // 'todas' | 'mar' | 'grama' | 'madeira' | 'aco' | 'marmore' | 'tijolo' | 'luzes' | 'minhas'
  
  // 🔍 Filtros e Busca no Estoque & Acervo
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroCategoriaEstoque, setFiltroCategoriaEstoque] = useState('todas');
  const [expandedCats, setExpandedCats] = useState({});

  // 🧲 Alinhamento Magnético & Guias
  const [snappingAtivo, setSnappingAtivo] = useState(true);
  const [activeSnapGuides, setActiveSnapGuides] = useState([]);

  // ⌨️ Modal de Atalhos de Produtividade
  const [modalAtalhosAberto, setModalAtalhosAberto] = useState(false);

  // ✍️ Estado de Criação de Texto & Efeitos
  const [textoNovoInput, setTextoNovoInput] = useState('Festa da Sophia');
  const [efeitoTextoAtivo, setEfeitoTextoAtivo] = useState('gold_mirror');
  const [fonteTextoAtiva, setFonteTextoAtiva] = useState("'Great Vibes', cursive");

  // 🔍 Zoom & Visualização
  const [zoom, setZoom] = useState(1);
  const [isPanCapaMode, setIsPanCapaMode] = useState(false);
  const [rotacaoTooltip, setRotacaoTooltip] = useState(null);

  // 🪄 Remoção de Fundo & Upload Rápido
  const [removendoFundo, setRemovendoFundo] = useState(false);
  const [modalUploadRapidoAberto, setModalUploadRapidoAberto] = useState(false);
  const [imagemRapidaBase64, setImagemRapidaBase64] = useState('');
  const [imagemRapidaNome, setImagemRapidaNome] = useState('');
  const [salvarNoPortfolio, setSalvarNoPortfolio] = useState(false);
  const [categoriaImagemRapida, setCategoriaImagemRapida] = useState('Outros');

  // 📱 MOBILE: Bottom Sheet State
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 900);
  const [painelMobileAberto, setPainelMobileAberto] = useState(false);
  const swipeTouchStart = useRef({ y: 0, time: 0 });

  // 🏛️ Cenário, Ambiente & Transição 3D
  const [modoApresentacao, setModoApresentacao] = useState(false);
  const [modoCenario, setModoCenario] = useState('duplo'); // 'duplo' (parede + piso 3D) | 'unico' (fundo inteiro / foto de salão)
  const [alturaChao, setAlturaChao] = useState(36); // porcentagem de piso (15 a 55%)
  const [sombraChaoIntensidade, setSombraChaoIntensidade] = useState(25); // sombra do ciclorama / contato (0 a 60%)
  const [estiloRodape, setEstiloRodape] = useState('suave');
  const [profundidadeFoco, setProfundidadeFoco] = useState(0); // profundidade / blur de fundo (0 a 10px)

  // 📐 Enquadramento, Posição & Escala das Imagens de Fundo
  const [posicaoParedeY, setPosicaoParedeY] = useState(50); // 0 a 100%
  const [posicaoParedeX, setPosicaoParedeX] = useState(50); // 0 a 100%
  const [zoomParede, setZoomParede] = useState(100); // 100 a 250%

  const [posicaoPisoY, setPosicaoPisoY] = useState(50); // 0 a 100%
  const [posicaoPisoX, setPosicaoPisoX] = useState(50); // 0 a 100%
  const [zoomPiso, setZoomPiso] = useState(100); // 100 a 250%

  const [posicaoAmbienteY, setPosicaoAmbienteY] = useState(50); // 0 a 100%
  const [posicaoAmbienteX, setPosicaoAmbienteX] = useState(50); // 0 a 100%
  const [zoomAmbiente, setZoomAmbiente] = useState(100); // 100 a 250% // 'suave' (fundo infinito) | 'rodape' (rodapé estúdio)

  // 🔄 Histórico de Ações (Undo / Redo)
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const isHistoryAction = useRef(false);
  
  // 🕹️ Refs de Interação Ultrarrápida (Zero Delay / 120 FPS)
  const activeItemId = useRef(null);
  const interactionMode = useRef('none'); // 'none' | 'drag' | 'resize' | 'rotate' | 'pan_capa'
  const resizeDir = useRef(null);
  const startPointerPos = useRef({ x: 0, y: 0 });
  const latestPointerPos = useRef({ clientX: 0, clientY: 0 });
  const startItemPos = useRef({});
  const startCenter = useRef({ x: 0, y: 0 });
  const startAngle = useRef(0);
  const rafMove = useRef(null);
  const dragTargetDom = useRef(null);
  const currentPendingChanges = useRef({});
  const itensCanvasRef = useRef(itensCanvas);
  itensCanvasRef.current = itensCanvas;

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
  
  // 📱 DETECTAR MOBILE
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 900;
      setIsMobile(mobile);
      if (!mobile) setPainelMobileAberto(false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 📱 SWIPE DOWN PARA FECHAR O BOTTOM SHEET
  const handlePainelTouchStart = useCallback((e) => {
    swipeTouchStart.current = { y: e.touches[0].clientY, time: Date.now() };
  }, []);
  const handlePainelTouchEnd = useCallback((e) => {
    const dy = e.changedTouches[0].clientY - swipeTouchStart.current.y;
    const dt = Date.now() - swipeTouchStart.current.time;
    // Swipe down rápido (>50px em <350ms) fecha o painel
    if (dy > 50 && dt < 350) setPainelMobileAberto(false);
  }, []);

  // 📱 ABRIR ABA + PAINEL MOBILE
  const abrirAbaMobile = useCallback((aba) => {
    if (isMobile) {
      if (painelMobileAberto && abaAtiva === aba) {
        setPainelMobileAberto(false);
      } else {
        setAbaAtiva(aba);
        setPainelMobileAberto(true);
      }
    } else {
      setAbaAtiva(aba);
    }
  }, [isMobile, painelMobileAberto, abaAtiva]);
  
  const fontesDisponiveis = [ 
    // Caligrafia & Script (Festas / Casamentos / 15 Anos)
    { nome: '✨ Great Vibes (Caligrafia Real)', valor: "'Great Vibes', cursive", categoria: 'script' }, 
    { nome: '✍️ Dancing Script (Manuscrita)', valor: "'Dancing Script', cursive", categoria: 'script' }, 
    { nome: '💫 Satisfy (Cursiva Moderna)', valor: "'Satisfy', cursive", categoria: 'script' }, 
    { nome: '🎈 Pacifico (Descontraída)', valor: "'Pacifico', cursive", categoria: 'script' }, 
    { nome: '🖋️ Caveat (Assinatura / Delicada)', valor: "'Caveat', cursive", categoria: 'script' }, 
    // Luxo & Clássico (Serifadas)
    { nome: '🏛️ Playfair Display (Luxo)', valor: "'Playfair Display', serif", categoria: 'serif' }, 
    { nome: '👑 Cinzel (Romana / Casamento)', valor: "'Cinzel', serif", categoria: 'serif' }, 
    { nome: '📖 Lora (Elegante)', valor: "'Lora', serif", categoria: 'serif' }, 
    // Modernas & Letreiros (Sem Serifa / Caixa Alta)
    { nome: '🏢 Outfit (Geométrica Premium)', valor: "'Outfit', sans-serif", categoria: 'sans' }, 
    { nome: '💎 Montserrat (Moderna)', valor: "'Montserrat', sans-serif", categoria: 'sans' }, 
    { nome: '⚡ Bebas Neue (Caixa Alta Forte)', valor: "'Bebas Neue', sans-serif", categoria: 'sans' }, 
    { nome: '🌟 Poppins (Clean / Tendência)', valor: "'Poppins', sans-serif", categoria: 'sans' }, 
    // Infantis & Temáticas
    { nome: '🧸 Fredoka (Infantil Fofa)', valor: "'Fredoka', cursive", categoria: 'fun' }, 
    { nome: '🎨 Amatic SC (Rústica / Boho)', valor: "'Amatic SC', cursive", categoria: 'fun' } 
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

  // 🏷️ CATEGORIAS EXTRAÍDAS DO ESTOQUE
  const categoriasDoEstoque = useMemo(() => {
    const setCats = new Set();
    estoqueReal.forEach(item => {
      if (item.categoria && item.categoria.trim()) {
        setCats.add(item.categoria.trim());
      }
    });
    return Array.from(setCats).sort();
  }, [estoqueReal]);

  // 🔍 ACERVO FILTRADO POR BUSCA E CATEGORIA (ESTOQUE FÍSICO)
  const estoqueFiltrado = useMemo(() => {
    let list = estoqueReal;
    if (filtroCategoriaEstoque !== 'todas') {
      list = list.filter(item => (item.categoria || '').toLowerCase() === filtroCategoriaEstoque.toLowerCase());
    }
    if (!termoBusca.trim()) return list;
    const t = termoBusca.toLowerCase();
    return list.filter(item => 
      (item.nome && item.nome.toLowerCase().includes(t)) ||
      (item.codigo && item.codigo.toLowerCase().includes(t)) ||
      (item.categoria && item.categoria.toLowerCase().includes(t))
    );
  }, [estoqueReal, termoBusca, filtroCategoriaEstoque]);
  
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

  // 🎈 Elementos exclusivos para a Aba de Balões (apenas balões / arcos PNG)
  const elementosBaloesFiltrados = useMemo(() => {
    const isSuperAdmin = usuarioLogado?.email === "celebrefesta25@gmail.com";
    return elementosCenografia.filter(item => {
      const isMeu = item.empresaId === tenantId || (isSuperAdmin && item.isGlobal);
      const isGlobal = item.isGlobal === true;

      if (filtroBiblioteca === 'oficiais' && !isGlobal) return false;
      if (filtroBiblioteca === 'meu_portfolio' && !isMeu) return false;

      const cat = (item.categoria || '').toLowerCase();
      const nome = (item.nome || '').toLowerCase();
      const tag = (item.tag || '').toLowerCase();
      const isBalao = cat === 'baloes' || cat === 'balão' || cat === 'balao' || cat === 'balões' || 
                      nome.includes('bal') || nome.includes('arco') || nome.includes('guirlanda') || 
                      tag.includes('bal') || tag.includes('arco');
      return isBalao;
    });
  }, [elementosCenografia, filtroBiblioteca, tenantId, usuarioLogado]);

  // 🧱 Fundos de Parede (Apenas Oficiais do SuperADM + Uploads)
  const fundosParedeCompletos = useMemo(() => {
    const oficiaisSuperAdm = (elementosCenografia || [])
      .filter(i => (i.categoria === 'Parede' || (i.categoria === 'Texturas' && (i.nome || '').toLowerCase().includes('parede'))) && (i.isGlobal || i.empresaId === tenantId))
      .map(i => ({ nome: i.nome, url: i.imagemUrl, isSuperAdm: i.isGlobal, isMeu: i.empresaId === tenantId }));
    
    const urlsVistas = new Set();
    const resultado = [];
    oficiaisSuperAdm.forEach(item => {
      if (item && item.url && !urlsVistas.has(item.url)) {
        urlsVistas.add(item.url);
        resultado.push(item);
      }
    });
    return resultado;
  }, [elementosCenografia, tenantId]);

  // 🪵 Fundos de Piso (Apenas Oficiais do SuperADM + Uploads)
  const fundosPisoCompletos = useMemo(() => {
    const oficiaisSuperAdm = (elementosCenografia || [])
      .filter(i => (i.categoria === 'Piso' || (i.categoria === 'Texturas' && (i.nome || '').toLowerCase().includes('piso'))) && (i.isGlobal || i.empresaId === tenantId))
      .map(i => ({ nome: i.nome, url: i.imagemUrl, isSuperAdm: i.isGlobal, isMeu: i.empresaId === tenantId }));
    
    const urlsVistas = new Set();
    const resultado = [];
    oficiaisSuperAdm.forEach(item => {
      if (item && item.url && !urlsVistas.has(item.url)) {
        urlsVistas.add(item.url);
        resultado.push(item);
      }
    });
    return resultado;
  }, [elementosCenografia, tenantId]);

  // 🏞️ Fundos de Ambiente Inteiro / Salões (Apenas Oficiais do SuperADM + Uploads)
  const fundosAmbienteCompletos = useMemo(() => {
    const oficiaisSuperAdm = (elementosCenografia || [])
      .filter(i => (i.categoria === 'Ambiente' || i.categoria === 'Salao') && (i.isGlobal || i.empresaId === tenantId))
      .map(i => ({ nome: i.nome, url: i.imagemUrl, isSuperAdm: i.isGlobal, isMeu: i.empresaId === tenantId }));
    
    const urlsVistas = new Set();
    const resultado = [];
    oficiaisSuperAdm.forEach(item => {
      if (item && item.url && !urlsVistas.has(item.url)) {
        urlsVistas.add(item.url);
        resultado.push(item);
      }
    });
    return resultado;
  }, [elementosCenografia, tenantId]);
  
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

  // ⌨️ ATALHOS DE TECLADO INTELIGENTES DE PRODUTIVIDADE
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        return;
      }

      // Desfazer (Ctrl + Z)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      // Refazer (Ctrl + Y ou Ctrl + Shift + Z)
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        handleRedo();
        return;
      }
      // Duplicar (Ctrl + D)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && selecionadoId) {
        e.preventDefault();
        duplicarItem(selecionadoId);
        return;
      }
      // Travar/Destravar Item (Ctrl + G ou L)
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') || e.key.toLowerCase() === 'l') {
        if (selecionadoId) {
          e.preventDefault();
          toggleLock(selecionadoId);
          return;
        }
      }
      // Excluir Item (Del ou Backspace)
      if ((e.key === 'Delete' || e.key === 'Backspace') && selecionadoId) {
        e.preventDefault();
        deleteItem(selecionadoId);
        return;
      }
      // Espelhar Horizontal (H)
      if (e.key.toLowerCase() === 'h' && selecionadoId && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const it = itensCanvas.find(i => i.uniqueId === selecionadoId);
        if (it) atualizarItem(selecionadoId, { flipH: !it.flipH });
        return;
      }
      // Espelhar Vertical (V)
      if (e.key.toLowerCase() === 'v' && selecionadoId && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const it = itensCanvas.find(i => i.uniqueId === selecionadoId);
        if (it) atualizarItem(selecionadoId, { flipV: !it.flipV });
        return;
      }
      // Camada para trás ([)
      if (e.key === '[' && selecionadoId) {
        e.preventDefault();
        sendBackward(selecionadoId);
        return;
      }
      // Camada para frente (])
      if (e.key === ']' && selecionadoId) {
        e.preventDefault();
        bringForward(selecionadoId);
        return;
      }
      // Zoom (+ e -)
      if ((e.key === '+' || e.key === '=') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setZoom(z => Math.min(1.6, Number((z + 0.1).toFixed(1))));
        return;
      }
      if ((e.key === '-' || e.key === '_') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setZoom(z => Math.max(0.5, Number((z - 0.1).toFixed(1))));
        return;
      }
      // Modal de Ajuda de Atalhos (?)
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setModalAtalhosAberto(prev => !prev);
        return;
      }
      // Desmarcar / Fechar Modais (Esc)
      if (e.key === 'Escape') {
        setSelecionadoId(null);
        setEditingTextId(null);
        setIsPanCapaMode(false);
        setModalAtalhosAberto(false);
        closeContextMenu();
        return;
      }
      // Movimentação Fina com Setas (2px normal, 10px com Shift)
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
  }, [selecionadoId, itensCanvas, handleUndo, handleRedo, saveSnapshot]);

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
            if (w > h) { h = (h * MAX_SIZE) / w; w = MAX_SIZE; }
            else { w = (w * MAX_SIZE) / h; h = MAX_SIZE; }
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

  // 🪄 REMOVER FUNDO DE IMAGEM (WASM — SEM API, 100% GRATUITO)
  const removerFundoImagem = async (id) => {
    const item = itensCanvas.find(i => i.uniqueId === id);
    if (!item || !item.imagem) return alert('Selecione um item com imagem para remover o fundo.');
    setRemovendoFundo(true);
    try {
      const lib = await carregarBgRemoval();
      const blob = await fetch(item.imagem).then(r => r.blob());
      const resultBlob = await lib.removeBackground(blob);
      const reader = new FileReader();
      reader.onload = (e) => {
        const imagemOriginal = item.imagemOriginal || item.imagem;
        atualizarItem(id, { imagem: e.target.result, imagemOriginal });
        setRemovendoFundo(false);
      };
      reader.readAsDataURL(resultBlob);
    } catch (err) {
      console.error('Erro ao remover fundo:', err);
      alert('Erro ao processar remoção de fundo. Verifique sua conexão na primeira vez (carrega modelo ~60MB).');
      setRemovendoFundo(false);
    }
  };

  // ↩️ RESTAURAR IMAGEM ORIGINAL (DESFAZER RECORTE IA)
  const restaurarImagemOriginal = (id) => {
    const item = itensCanvas.find(i => i.uniqueId === id);
    if (!item || !item.imagemOriginal) return;
    atualizarItem(id, { imagem: item.imagemOriginal, imagemOriginal: null });
  };

  // 📸 UPLOAD RÁPIDO DE IMAGEM — ADICIONA DIRETO NO CANVAS
  const handleUploadImagemRapida = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const nome = file.name.replace(/\.[^.]+$/, '').substring(0, 50);
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX = 1400;
          let w = img.width, h = img.height;
          if (w > MAX || h > MAX) {
            if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
            else { w = Math.round(w * MAX / h); h = MAX; }
          }
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          const base64 = canvas.toDataURL('image/png');
          setImagemRapidaBase64(base64);
          setImagemRapidaNome(nome);
          setModalUploadRapidoAberto(true);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  // ✅ CONFIRMAR UPLOAD RÁPIDO: ADICIONA AO CANVAS + OPCIONALMENTE SALVA NO PORTFÓLIO
  const confirmarUploadRapido = async (comRemocaoDeFundo = false) => {
    let imagemFinal = imagemRapidaBase64;
    if (comRemocaoDeFundo) {
      setRemovendoFundo(true);
      try {
        const lib = await carregarBgRemoval();
        const blob = await fetch(imagemRapidaBase64).then(r => r.blob());
        const resultBlob = await lib.removeBackground(blob);
        imagemFinal = await new Promise((res) => {
          const reader = new FileReader();
          reader.onload = e => res(e.target.result);
          reader.readAsDataURL(resultBlob);
        });
      } catch (err) {
        alert('Erro na remoção de fundo. Adicionando sem remover.');
      } finally {
        setRemovendoFundo(false);
      }
    }

    // Adicionar ao canvas
    adicionarAoCanvas({
      nome: imagemRapidaNome || 'Minha Imagem',
      imagem: imagemFinal,
      isEstoqueProprio: false,
      isItemExterno: true,
      origem: 'upload_rapido',
      categoria: categoriaImagemRapida
    });

    // Salvar no Portfólio se o usuário quiser
    if (salvarNoPortfolio) {
      try {
        await addDoc(collection(db, 'moodboard_elementos'), {
          nome: imagemRapidaNome || 'Minha Imagem',
          categoria: categoriaImagemRapida,
          tag: 'Meu Acervo',
          imagemUrl: imagemFinal,
          isGlobal: false,
          sugeridoParaGlobal: false,
          empresaId: tenantId,
          criadoPorNome: usuarioLogado?.displayName || usuarioLogado?.email || 'Minha Empresa',
          criadoEm: new Date().toISOString()
        });
        carregarElementosBiblioteca();
      } catch(err) { console.error('Erro ao salvar no portfólio:', err); }
    }

    setModalUploadRapidoAberto(false);
    setImagemRapidaBase64('');
    setImagemRapidaNome('');
    setSalvarNoPortfolio(false);
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
      tampoCor: '#ffffff',
      tampoTipo: 'continua',
      capaUrl: '',
      capaPosX: 50,
      capaPosY: 50,
      capaScale: 1,
      rotation: 0,
      flipH: false,
      flipV: false,
      locked: false,
      opacity: 100,
      brightness: 100,
      contrast: 100,
      saturate: 100,
      shadow: 0
    };

    // --- Painéis & Arcos ---
    if (tipoEstrutura === 'painel_redondo') {
      novoItem.width = 240; novoItem.height = 240;
    } else if (tipoEstrutura === 'arco_romano') {
      novoItem.width = 170; novoItem.height = 280;
    } else if (tipoEstrutura === 'arco_duplo') {
      novoItem.width = 190; novoItem.height = 290;
    } else if (tipoEstrutura === 'painel_retangular') {
      novoItem.width = 200; novoItem.height = 300;
    } else if (tipoEstrutura === 'painel_ripado') {
      novoItem.width = 180; novoItem.height = 290; novoItem.color = '#ba8249';
    } else if (tipoEstrutura === 'painel_shimmer') {
      novoItem.width = 200; novoItem.height = 280; novoItem.color = '#d4af37';
    } else if (tipoEstrutura === 'painel_biombo') {
      novoItem.width = 240; novoItem.height = 280; novoItem.color = '#ffffff';
    } else if (tipoEstrutura === 'painel_hexagonal') {
      novoItem.width = 220; novoItem.height = 240;
    } else if (tipoEstrutura === 'meia_lua') {
      novoItem.width = 260; novoItem.height = 160;
    } else if (tipoEstrutura === 'nicho_prateleira') {
      novoItem.width = 200; novoItem.height = 140;
    }
    // --- Mesas & Cilindros 3D ---
    else if (tipoEstrutura === 'cilindro_g') {
      novoItem.width = 125; novoItem.height = 190;
    } else if (tipoEstrutura === 'cilindro_m') {
      novoItem.width = 110; novoItem.height = 160;
    } else if (tipoEstrutura === 'cilindro_p') {
      novoItem.width = 95; novoItem.height = 130;
    } else if (tipoEstrutura === 'mesa_retangular') {
      novoItem.width = 220; novoItem.height = 110; novoItem.color = '#8B6914'; novoItem.tampoCor = '#8B6914';
    } else if (tipoEstrutura === 'mesa_provencal') {
      novoItem.width = 220; novoItem.height = 120; novoItem.color = '#ffffff'; novoItem.tampoCor = '#ffffff';
    } else if (tipoEstrutura === 'mesa_cubo') {
      novoItem.width = 120; novoItem.height = 145; novoItem.color = '#c5a059'; novoItem.tampoCor = '#ffffff';
    } else if (tipoEstrutura === 'comoda_vintage') {
      novoItem.width = 200; novoItem.height = 150; novoItem.color = '#ffffff';
    } else if (tipoEstrutura === 'carrinho_gourmet') {
      novoItem.width = 180; novoItem.height = 180; novoItem.color = '#c5a059';
    }
    // --- Balões Cenografia ---
    else if (tipoEstrutura === 'arco_classico_portal') {
      novoItem.width = 340; novoItem.height = 300;
      novoItem.coresBalao = paletaBalaoAtiva.cores; novoItem.x = 80; novoItem.y = 60;
      novoItem.formatoPortal = 'romano'; novoItem.estiloPortal = 'espiral';
      novoItem.seed = 1;
    } else if (tipoEstrutura === 'baloes_aro_redondo') {
      novoItem.width = 280; novoItem.height = 280;
      novoItem.coresBalao = paletaBalaoAtiva.cores; novoItem.x = 110; novoItem.y = 80;
      novoItem.coberturaAro = 'meio_aro';
      novoItem.seed = 2;
    } else if (tipoEstrutura === 'baloes_lateral_l') {
      novoItem.width = 250; novoItem.height = 320;
      novoItem.coresBalao = paletaBalaoAtiva.cores; novoItem.x = 120; novoItem.y = 100;
      novoItem.seed = 3;
    } else if (tipoEstrutura === 'baloes_cluster_chao') {
      novoItem.width = 170; novoItem.height = 140;
      novoItem.coresBalao = paletaBalaoAtiva.cores; novoItem.x = 180; novoItem.y = 280;
      novoItem.densidadeCluster = 'cheio';
      novoItem.seed = 4;
    } else if (tipoEstrutura === 'coluna_baloes') {
      novoItem.width = 110; novoItem.height = 380;
      novoItem.coresBalao = paletaBalaoAtiva.cores;
      novoItem.estiloColuna = 'organica';
      novoItem.seed = 5;
    } else if (tipoEstrutura === 'guirlanda_horizontal') {
      novoItem.width = 400; novoItem.height = 160;
      novoItem.coresBalao = paletaBalaoAtiva.cores; novoItem.x = 50; novoItem.y = 60;
      novoItem.curvatura = 30; novoItem.ondulacao = 30; novoItem.volumeBalao = 'organico'; novoItem.qtdBaloes = 20; novoItem.tamanhoBalao = 24; novoItem.seed = Math.floor(Math.random() * 50);
    }

    const updated = [...itensCanvas, novoItem];
    setItensCanvas(updated);
    setSelecionadoId(idUnico);
    setAbaDireita('propriedades');
    saveSnapshot(updated);
  };

  const adicionarTexto = (preset = {}) => {
    const idUnico = `txt_${Date.now()}`;
    const itemTexto = { 
        type: 'text', 
        content: preset.content || "Nome da Festa", 
        color: preset.color || (preset.neon ? "#ffffff" : "#c5a059"), 
        neonColor: preset.neonColor || "#c5a059", 
        fontSize: preset.fontSize || (preset.neon ? 52 : 48), 
        fontFamily: preset.fontFamily || (preset.neon ? "'Great Vibes', cursive" : "'Dancing Script', cursive"), 
        fontWeight: preset.fontWeight || 'normal',
        fontStyle: preset.fontStyle || 'normal',
        letterSpacing: preset.letterSpacing || 0,
        textAlign: preset.textAlign || 'center',
        material: preset.material || 'none',
        textureUrl: preset.textureUrl || '',
        textureScale: preset.textureScale || 100,
        curvatura: preset.curvatura || 0,
        placaFundo: preset.placaFundo || 'nenhuma',
        strokeWidth: preset.strokeWidth || 0,
        strokeColor: preset.strokeColor || '#ffffff',
        uniqueId: idUnico, 
        x: 120, 
        y: 80, 
        width: 220, 
        height: 60, 
        rotation: 0, 
        locked: false, 
        opacity: 100, 
        shadow: preset.shadow || 0,
        neonGlow: preset.neonGlow ?? (preset.neon ? 20 : 0) 
    };
    
    const updated = [...itensCanvas, itemTexto];
    setItensCanvas(updated); 
    setSelecionadoId(idUnico); 
    setAbaDireita('propriedades');
    saveSnapshot(updated);
  };

  const handleUploadTexturaTexto = (targetId = null) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 800;
          let width = img.width;
          let height = img.height;
          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          const base64 = canvas.toDataURL('image/jpeg', 0.85);

          if (targetId) {
            atualizarItem(targetId, {
              material: 'custom_texture',
              textureUrl: base64,
              textureScale: 100
            });
          } else {
            adicionarTexto({
              content: 'Meu Texto',
              material: 'custom_texture',
              textureUrl: base64,
              textureScale: 100,
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 54,
              letterSpacing: 2
            });
          }
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const adicionarOrnamento = (tipoOrnamento = 'ramo_esquerdo', materialPadrao = 'gold_mirror') => {
    const idUnico = `orn_${Date.now()}`;
    const ornInfo = ORNAMENTOS_FESTA[tipoOrnamento] || ORNAMENTOS_FESTA.ramo_esquerdo;
    const novoOrnamento = {
      type: 'ornament',
      ornamentType: tipoOrnamento,
      nome: ornInfo.nome,
      uniqueId: idUnico,
      x: 180,
      y: 120,
      width: 100,
      height: 100,
      color: '#c5a059',
      material: materialPadrao,
      rotation: 0,
      flipH: false,
      flipV: false,
      locked: false,
      opacity: 100,
      shadow: 0
    };

    const updated = [...itensCanvas, novoOrnamento];
    setItensCanvas(updated);
    setSelecionadoId(idUnico);
    setAbaDireita('propriedades');
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

    // 🕹️ POINTER DOWN: DISPARADOR DE DRAG / RESIZE / ROTATE / PAN_CAPA (DIRETO NO DOM, 0ms LATÊNCIA, 120 FPS REAL)
  const handlePointerDown = (e, id, type, dir = null) => {
    e.stopPropagation();
    
    setSelecionadoId(id);
    
    // Foca automaticamente no painel de propriedades do lado direito
    if (typeof window !== 'undefined' && window.innerWidth > 900) {
      setPainelDireitoAberto(true);
    }
    setAbaDireita('propriedades');

    const item = itensCanvasRef.current.find(i => i.uniqueId === id);
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
      capaPosY: item.capaPosY ?? 50,
      curvatura: item.curvatura ?? 30,
      ondulacao: item.ondulacao ?? 25,
      flipH: item.flipH,
      flipV: item.flipV
    };
    currentPendingChanges.current = {};

    // Localiza o elemento DOM da peça no canvas
    const targetDom = (e.currentTarget.classList?.contains('canvas-object') 
      ? e.currentTarget 
      : e.currentTarget.closest('.canvas-object')) || boardRef.current?.querySelector(`[data-item-id="${id}"]`);
    dragTargetDom.current = targetDom;

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
    } else if (dir === 'curve' || dir === 'wave') {
      interactionMode.current = dir;
    } else if (dir) {
      interactionMode.current = 'resize';
      resizeDir.current = dir;
    } else if (isPanCapaMode && item.capaUrl) {
      interactionMode.current = 'pan_capa';
    } else {
      interactionMode.current = 'drag';
    }

    document.body.style.userSelect = 'none';

    const onWindowMove = (moveEvt) => {
      if (interactionMode.current === 'none' || !activeItemId.current) return;
      
      const el = dragTargetDom.current;
      if (!el) return;

      let scale = zoom || 1;
      if (boardRef.current) {
        const bRect = boardRef.current.getBoundingClientRect();
        if (bRect.width && boardRef.current.offsetWidth) {
          scale = bRect.width / boardRef.current.offsetWidth;
        }
      }

      const totalDx = (moveEvt.clientX - startPointerPos.current.x) / scale;
      const totalDy = (moveEvt.clientY - startPointerPos.current.y) / scale;
      const s = startItemPos.current;

      // 1. ARRASTE ULTRARRÁPIDO DIRETO NO DOM (0ms LATÊNCIA COM ALINHAMENTO MAGNÉTICO)
      if (interactionMode.current === 'drag') {
        let newX = Math.round(s.x + totalDx);
        let newY = Math.round(s.y + totalDy);
        
        const guides = [];
        if (snappingAtivo && boardRef.current) {
          const boardW = boardRef.current.offsetWidth || 1000;
          const boardH = boardRef.current.offsetHeight || 600;
          const itemW = s.width || 100;
          const itemH = s.height || 100;
          const snapDist = 9;

          // 1. Snap ao Centro Horizontal do Canvas
          const centerX = (boardW - itemW) / 2;
          if (Math.abs(newX - centerX) < snapDist) {
            newX = Math.round(centerX);
            guides.push({ type: 'vertical', pos: newX + itemW / 2, label: 'Centro do Canvas' });
          }

          // 2. Snap à Linha Base do Piso (Chão)
          const floorY = boardH - itemH - 24;
          if (Math.abs(newY - floorY) < snapDist) {
            newY = Math.round(floorY);
            guides.push({ type: 'horizontal', pos: newY + itemH, label: 'Linha do Chão' });
          }

          // 3. Snap com outras peças no canvas (Mesma base de piso, centros e laterais)
          const otherItems = itensCanvasRef.current.filter(it => it.uniqueId !== activeItemId.current && !it.locked);
          for (const other of otherItems) {
            const otherW = other.width || 100;
            const otherH = other.height || 100;

            // Alinhar Base no mesmo nível (Bottom-to-Bottom)
            const otherBottom = other.y + otherH;
            const myBottomTarget = otherBottom - itemH;
            if (Math.abs(newY - myBottomTarget) < snapDist) {
              newY = Math.round(myBottomTarget);
              guides.push({ type: 'horizontal', pos: otherBottom, label: 'Nível do Piso' });
            }

            // Alinhar Centro X com outro item
            const otherCenterX = other.x + otherW / 2;
            const myCenterXTarget = otherCenterX - itemW / 2;
            if (Math.abs(newX - myCenterXTarget) < snapDist) {
              newX = Math.round(myCenterXTarget);
              guides.push({ type: 'vertical', pos: otherCenterX, label: 'Centro Alinhado' });
            }

            // Encostar Lado a Lado (Esquerda ou Direita)
            if (Math.abs(newX - (other.x + otherW)) < snapDist) {
              newX = other.x + otherW;
              guides.push({ type: 'vertical', pos: newX, label: 'Encosto' });
            } else if (Math.abs((newX + itemW) - other.x) < snapDist) {
              newX = other.x - itemW;
              guides.push({ type: 'vertical', pos: other.x, label: 'Encosto' });
            }
          }
        }

        setActiveSnapGuides(guides);

        currentPendingChanges.current = { x: newX, y: newY };
        el.style.left = `${newX}px`;
        el.style.top = `${newY}px`;
        return;
      }

      // 2. ENQUADRAMENTO DA CAPA
      if (interactionMode.current === 'pan_capa') {
        const newPosX = Math.max(0, Math.min(100, Math.round(s.capaPosX - (totalDx * 0.4))));
        const newPosY = Math.max(0, Math.min(100, Math.round(s.capaPosY - (totalDy * 0.4))));
        currentPendingChanges.current = { capaPosX: newPosX, capaPosY: newPosY };
        const img = el.querySelector('img');
        if (img) img.style.objectPosition = `${newPosX}% ${newPosY}%`;
        return;
      }

      // 3. ROTAÇÃO DIRETA NO DOM
      if (interactionMode.current === 'rotate') {
        const currentRad = Math.atan2(moveEvt.clientY - startCenter.current.y, moveEvt.clientX - startCenter.current.x);
        let angleDeg = Math.round((currentRad * (180 / Math.PI)) - startAngle.current);
        angleDeg = ((angleDeg % 360) + 360) % 360;
        if (angleDeg < 4 || angleDeg > 356) angleDeg = 0;
        else if (Math.abs(angleDeg - 90) < 4) angleDeg = 90;
        else if (Math.abs(angleDeg - 180) < 4) angleDeg = 180;
        else if (Math.abs(angleDeg - 270) < 4) angleDeg = 270;

        currentPendingChanges.current = { rotation: angleDeg };
        el.style.transform = `rotate(${angleDeg}deg) scaleX(${s.flipH ? -1 : 1}) scaleY(${s.flipV ? -1 : 1})`;
        setRotacaoTooltip(`${angleDeg}°`);
        return;
      }

      // 4. REDIMENSIONAMENTO DIRETO NO DOM
      if (interactionMode.current === 'resize') {
        if (type === 'text') {
          let scaleFactor = 0;
          if (resizeDir.current === 'se') scaleFactor = (totalDx + totalDy) * 0.35;
          else if (resizeDir.current === 'nw') scaleFactor = (-totalDx - totalDy) * 0.35;
          else if (resizeDir.current === 'ne') scaleFactor = (totalDx - totalDy) * 0.35;
          else if (resizeDir.current === 'sw') scaleFactor = (-totalDx + totalDy) * 0.35;
          else scaleFactor = (totalDx + totalDy) * 0.35;

          const newFontSize = Math.max(14, Math.min(220, Math.round((s.fontSize || 48) + scaleFactor)));
          currentPendingChanges.current = { fontSize: newFontSize };
          atualizarItem(activeItemId.current, { fontSize: newFontSize });
          return;
        } else {
          let newW = s.width;
          let newH = s.height;
          let newX = s.x;
          let newY = s.y;

          if (resizeDir.current?.includes('e')) newW += totalDx;
          if (resizeDir.current?.includes('s')) newH += totalDy;
          if (resizeDir.current?.includes('w')) {
            newW -= totalDx;
            newX += totalDx;
          }
          if (resizeDir.current?.includes('n')) {
            newH -= totalDy;
            newY += totalDy;
          }

          newW = Math.max(30, Math.round(newW));
          newH = Math.max(30, Math.round(newH));
          newX = Math.round(newX);
          newY = Math.round(newY);

          currentPendingChanges.current = { x: newX, y: newY, width: newW, height: newH };
          el.style.left = `${newX}px`;
          el.style.top = `${newY}px`;
          el.style.width = `${newW}px`;
          el.style.height = `${newH}px`;
        }
        return;
      }

      // 5. MODELAGEM DE CURVATURA DO ARCO DIRETO NO CANVAS (INTERATIVO)
      if (interactionMode.current === 'curve') {
        const deltaCurv = Math.round(-totalDy * 0.95);
        const newCurv = Math.max(-100, Math.min(100, (s.curvatura || 0) + deltaCurv));
        currentPendingChanges.current = { curvatura: newCurv };
        atualizarItem(activeItemId.current, { curvatura: newCurv });
        setRotacaoTooltip(`Curvatura: ${newCurv}%`);
        return;
      }

      // 6. MODELAGEM DE ONDULAÇÃO 'S' DIRETO NO CANVAS (INTERATIVO)
      if (interactionMode.current === 'wave') {
        const deltaOnd = Math.round((totalDx - totalDy) * 0.8);
        const newOnd = Math.max(0, Math.min(100, (s.ondulacao || 0) + deltaOnd));
        currentPendingChanges.current = { ondulacao: newOnd };
        atualizarItem(activeItemId.current, { ondulacao: newOnd });
        setRotacaoTooltip(`Ondulação: ${newOnd}%`);
        return;
      }
    };

    const onWindowUp = (upEvt) => {
      window.removeEventListener('pointermove', onWindowMove);
      window.removeEventListener('pointerup', onWindowUp);
      document.body.style.userSelect = '';

      setActiveSnapGuides([]);

      const changes = { ...currentPendingChanges.current };
      const targetId = activeItemId.current;

      if (targetId && Object.keys(changes).length > 0) {
        setItensCanvas(prev => {
          const updated = prev.map(it => it.uniqueId === targetId ? { ...it, ...changes } : it);
          saveSnapshot(updated);
          return updated;
        });
      }

      interactionMode.current = 'none';
      activeItemId.current = null;
      resizeDir.current = null;
      dragTargetDom.current = null;
      currentPendingChanges.current = {};
      setRotacaoTooltip(null);
    };

    window.addEventListener('pointermove', onWindowMove, { passive: false });
    window.addEventListener('pointerup', onWindowUp, { passive: false });
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
  const isEstruturaSelecionada = itemSelecionado?.type === 'shape' && ['arco_romano', 'painel_redondo', 'painel_retangular', 'painel_hexagonal', 'meia_lua', 'nicho_prateleira', 'cilindro_g', 'cilindro_m', 'cilindro_p'].includes(itemSelecionado?.shapeType);
  const isBalaoSelecionado = itemSelecionado?.type === 'shape' && ['arco_classico_portal', 'baloes_aro_redondo', 'baloes_lateral_l', 'baloes_cluster_chao', 'coluna_baloes', 'guirlanda_horizontal'].includes(itemSelecionado?.shapeType);
  
  const getStyle = (valor, surface = 'wall') => {
    if (!valor) return { background: '#fff' };
    const isImg = valor.startsWith('http') || valor.startsWith('data:') || valor.startsWith('blob:') || valor.startsWith('/') || valor.startsWith('url');
    if (!isImg) return { backgroundColor: valor };
    const bgUrl = valor.startsWith('url') ? valor : `url("${valor}")`;
    
    let posX = 50;
    let posY = 50;
    let scale = 100;
    
    if (surface === 'wall') {
      posX = posicaoParedeX;
      posY = posicaoParedeY;
      scale = zoomParede;
    } else if (surface === 'floor') {
      posX = posicaoPisoX;
      posY = posicaoPisoY;
      scale = zoomPiso;
    } else if (surface === 'ambiente') {
      posX = posicaoAmbienteX;
      posY = posicaoAmbienteY;
      scale = zoomAmbiente;
    }

    return {
      backgroundImage: bgUrl,
      backgroundPosition: `${posX}% ${posY}%`,
      backgroundSize: scale === 100 ? 'cover' : `${scale}% auto`,
      backgroundRepeat: scale > 100 ? 'repeat' : 'no-repeat'
    };
  };

  return (
    <div className={`studio-page ${modoApresentacao ? 'showroom-mode' : ''} ${isMobile ? 'is-mobile' : ''}`} onClick={handleCanvasClick}>
      
      {/* 👑 BARRA DE FERRAMENTAS (LATERAL NO DESKTOP / DOCK INFERIOR NO MOBILE) */}
      {!modoApresentacao && (
        <div className="studio-toolbar" onClick={e => e.stopPropagation()}>
          <div className="tool-logo" title="CELEBRE Studio Pro" onClick={() => navigate('/dashboard')}>
            <Icons.Crown />
          </div>

          {/* 1. MEU ESTOQUE / CATÁLOGO DE PEÇAS */}
          <div 
            className={`tool-item ${abaAtiva === 'estoque' && (!isMobile || painelMobileAberto) ? 'active' : ''}`}
            onClick={() => abrirAbaMobile('estoque')}
            title="Peças, móveis e catálogo do seu acervo"
          >
            <Icons.Couch />
            <span>Estoque</span>
          </div>

          {/* 2. ESTRUTURAS & PAINÉIS */}
          <div 
            className={`tool-item ${abaAtiva === 'formas' && (!isMobile || painelMobileAberto) ? 'active' : ''}`}
            onClick={() => abrirAbaMobile('formas')}
            title="Painéis, arcos, mesas e cilindros"
          >
            <Icons.Shapes />
            <span>Estruturas</span>
          </div>

          {/* 3. BALÕES & CENOGRAFIA */}
          <div 
            className={`tool-item ${abaAtiva === 'baloes' && (!isMobile || painelMobileAberto) ? 'active' : ''}`}
            onClick={() => abrirAbaMobile('baloes')}
            title="Arcos orgânicos, guirlandas e bexigas"
          >
            <Icons.Balloon />
            <span>Balões</span>
          </div>

          {/* 4. UPLOAD RÁPIDO */}
          <div 
            className="tool-item tool-item-upload" 
            onClick={handleUploadImagemRapida} 
            title="Subir foto recortada (PNG) direto no canvas"
          >
            <Icons.UploadCloud />
            <span>Upload</span>
          </div>

          {/* 5. TEXTO & EFEITOS */}
          <div 
            className={`tool-item ${abaAtiva === 'texto' && (!isMobile || painelMobileAberto) ? 'active' : ''}`}
            onClick={() => abrirAbaMobile('texto')}
            title="Títulos, nomes, letreiros e efeitos"
          >
            <Icons.Type />
            <span>Texto</span>
          </div>

          {/* 6. CENÁRIO & AMBIENTAÇÃO */}
          <div 
            className={`tool-item ${abaAtiva === 'fundo' && (!isMobile || painelMobileAberto) ? 'active' : ''}`}
            onClick={() => abrirAbaMobile('fundo')}
            title="Paredes, chão 3D, ciclorama e iluminação"
          >
            <Icons.Layers />
            <span>Cenário</span>
          </div>
        </div>
      )}

      {/* 🎮 BACKDROP DO BOTTOM SHEET (MOBILE) */}
      {isMobile && painelMobileAberto && !modoApresentacao && (
        <div className="bottom-sheet-backdrop" onClick={() => setPainelMobileAberto(false)} />
      )}

      {/* 🎛️ PAINEL LATERAL (DESKTOP) / BOTTOM SHEET (MOBILE) */}
      {!modoApresentacao && (
        <div
          className={`studio-panel ${isMobile ? 'bottom-sheet-panel' : ''} ${isMobile && painelMobileAberto ? 'bottom-sheet-open' : ''}`}
          onClick={e => e.stopPropagation()}
          onTouchStart={isMobile ? handlePainelTouchStart : undefined}
          onTouchEnd={isMobile ? handlePainelTouchEnd : undefined}
        >
          {/* ALÇA DE DRAG (MOBILE ONLY) */}
          {isMobile && (
            <div className="bottom-sheet-handle-wrap" onClick={() => setPainelMobileAberto(false)}>
              <div className="bottom-sheet-handle" />
              <span className="bottom-sheet-handle-label">
                {abaAtiva === 'estoque' && '📦 Meu Estoque & Acervo'}
                {abaAtiva === 'formas' && '🏛️ Estruturas & Painéis'}
                {abaAtiva === 'baloes' && '🎈 Balões & Cenografia'}
                {abaAtiva === 'texto' && '🔤 Texto & Efeitos'}
                {abaAtiva === 'fundo' && '🖼️ Cenário & Paredes'}
              </span>
              <span style={{ fontSize: '10px', color: '#94a3b8', marginLeft: 'auto' }}>▼ fechar</span>
            </div>
          )}

          {/* ABA 1: MEU ESTOQUE FÍSICO / ACERVO COMPLETO */}
          {abaAtiva === 'estoque' && (
             <div className="panel-content">
               {/* 🔀 Seletor de Origem Unificado */}
               <div className="acervo-source-segmented-control" style={{ marginBottom: '10px' }}>
                 <button 
                   type="button"
                   className={`source-seg-btn ${abaAcervoFonte === 'estoque' ? 'active' : ''}`}
                   onClick={() => { setAbaAcervoFonte('estoque'); setTermoBusca(''); }}
                   title="Peças físicas do seu estoque próprio"
                 >
                   <Icons.Couch width={13} height={13} />
                   <span>Meu Estoque ({estoqueReal.length})</span>
                 </button>
                 <button 
                   type="button"
                   className={`source-seg-btn ${abaAcervoFonte === 'globais' ? 'active' : ''}`}
                   onClick={() => { setAbaAcervoFonte('globais'); setTermoBusca(''); }}
                   title="Elementos PNG oficiais e flores"
                 >
                   <Icons.Crown width={13} height={13} />
                   <span>Elementos PNG ({elementosCenografia.filter(i => i.isGlobal).length})</span>
                 </button>
                 <button 
                   type="button"
                   className={`source-seg-btn ${abaAcervoFonte === 'portfolio' ? 'active' : ''}`}
                   onClick={() => { setAbaAcervoFonte('portfolio'); setTermoBusca(''); }}
                   title="Recortes PNG que você subiu"
                 >
                   <Icons.Image width={13} height={13} />
                   <span>Meu Portfólio ({elementosCenografia.filter(i => i.empresaId === tenantId && !i.isGlobal).length})</span>
                 </button>
               </div>

               {/* 1. SE FOR MEU ESTOQUE FÍSICO */}
               {abaAcervoFonte === 'estoque' && (
                 <>
                   {/* Barra de Busca Rápida */}
                   <div className="search-box-acervo-compact" style={{ marginBottom: '8px' }}>
                      <Icons.Search width={14} height={14} />
                      <input 
                        type="text" 
                        placeholder="Buscar nome, código ou categoria..." 
                        value={termoBusca}
                        onChange={e => setTermoBusca(e.target.value)}
                      />
                      {termoBusca ? (
                        <button className="btn-clear-search" onClick={() => setTermoBusca('')}>✕</button>
                      ) : (
                        <span className="compact-item-counter">{estoqueFiltrado.length}</span>
                      )}
                   </div>

                   {/* Chips de Categorias do Estoque */}
                   <div className="estoque-category-chips-row">
                     <button
                       type="button"
                       className={`estoque-category-chip ${filtroCategoriaEstoque === 'todas' ? 'active' : ''}`}
                       onClick={() => setFiltroCategoriaEstoque('todas')}
                     >
                       🏷️ Todas ({estoqueReal.length})
                     </button>
                     {categoriasDoEstoque.map(cat => (
                       <button
                         key={cat}
                         type="button"
                         className={`estoque-category-chip ${filtroCategoriaEstoque === cat ? 'active' : ''}`}
                         onClick={() => setFiltroCategoriaEstoque(cat)}
                       >
                         {cat} ({estoqueReal.filter(i => (i.categoria || '').trim() === cat).length})
                       </button>
                     ))}
                   </div>

                   <div className="acervo-list-scroll">
                     {Object.keys(grouped).length === 0 ? (
                       <div className="empty-search-state">
                         <p>Nenhuma peça encontrada no seu estoque para "{termoBusca}".</p>
                       </div>
                     ) : (
                       Object.keys(grouped).sort().map(cat => (
                         <div key={cat} className="acervo-category">
                           <div className={`acervo-category-header ${expandedCats[cat] || termoBusca || filtroCategoriaEstoque !== 'todas' ? 'expanded' : ''}`} onClick={() => toggleCategory(cat)}>
                             <span className="cat-name">{cat}</span> <span className="count">{grouped[cat].length}</span>
                           </div>
                           {(expandedCats[cat] || termoBusca || filtroCategoriaEstoque !== 'todas') && (
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
                                       {typeof item.quantidadeDisponivel === 'number' && (
                                         <span className={`badge-card-qty ${item.quantidadeDisponivel === 0 ? 'esgotado' : ''}`}>
                                           {item.quantidadeDisponivel === 0 ? '⚠️ 0 disp.' : `${item.quantidadeDisponivel} disp.`}
                                         </span>
                                       )}
                                   </div>
                                   <div className="card-info-box">
                                     <div className="card-name" title={item.nome}>{item.nome}</div>
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

               {/* 2. SE FOR ELEMENTOS OFICIAIS OU MEU PORTFÓLIO PNG */}
               {(abaAcervoFonte === 'globais' || abaAcervoFonte === 'portfolio') && (
                 <>
                   {/* Botão de Upload para Portfólio */}
                   {abaAcervoFonte === 'portfolio' && (
                     <button 
                       className="btn-upload-capa" 
                       style={{ background: '#0f172a', marginBottom: '6px', padding: '6px 12px', fontSize: '11px' }} 
                       onClick={() => setModalUploadElementoAberto(true)}
                     >
                       <Icons.Image width={14} height={14} /> 📷 + Subir Novo PNG p/ Portfólio
                     </button>
                   )}

                   {/* Busca Compacta com Contador Integrado */}
                   <div className="search-box-acervo-compact">
                      <Icons.Search width={14} height={14} />
                      <input 
                        type="text" 
                        placeholder={abaAcervoFonte === 'globais' ? "Buscar flores, pelúcias, recortes..." : "Buscar no seu portfólio..."} 
                        value={termoBusca}
                        onChange={e => setTermoBusca(e.target.value)}
                      />
                      {termoBusca ? (
                        <button className="btn-clear-search" onClick={() => setTermoBusca('')}>✕</button>
                      ) : (
                        <span className="compact-item-counter">{elementosFiltrados.length}</span>
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
                         {cat.icone} {cat.nome}
                       </button>
                     ))}
                   </div>

                   {/* Grid de Elementos PNG */}
                   <div className="acervo-list-scroll">
                     {loadingBiblioteca ? (
                       <div className="empty-search-state"><p>Carregando biblioteca...</p></div>
                     ) : elementosFiltrados.length === 0 ? (
                       <div className="empty-search-state"><p>Nenhum elemento PNG encontrado.</p></div>
                     ) : (
                       <div className="acervo-grid">
                         {elementosFiltrados.map(elem => (
                           <div
                             key={elem.id}
                             className="acervo-card"
                             draggable
                             onDragStart={(e) => handleDragStartAcervo(e, {
                               nome: elem.nome,
                               imagem: elem.imagemUrl,
                               isEstoqueProprio: false,
                               isItemExterno: true,
                               origem: elem.isGlobal ? 'catalogo_global' : 'portfolio_proprio'
                             })}
                             onClick={() => adicionarAoCanvas({
                               nome: elem.nome,
                               imagem: elem.imagemUrl,
                               isEstoqueProprio: false,
                               isItemExterno: true,
                               origem: elem.isGlobal ? 'catalogo_global' : 'portfolio_proprio'
                             })}
                             title="Clique ou arraste para a prancheta"
                           >
                             <div className="card-thumb elem-preview-checkerboard">
                               <img src={elem.imagemUrl} alt={elem.nome} crossOrigin="anonymous" />
                               <span className="badge-card-stock" style={{ background: '#f8fafc', color: '#475569', borderColor: '#cbd5e1' }}>
                                 {elem.isGlobal ? '✨ Oficial' : '📁 Portfólio'}
                               </span>
                             </div>
                             <div className="card-info-box">
                               <div className="card-name" title={elem.nome}>{elem.nome}</div>
                               <div className="card-price" style={{ color: '#64748b', fontSize: '9.5px' }}>{elem.categoria}</div>
                             </div>
                           </div>
                         ))}
                       </div>
                     )}
                   </div>
                 </>
               )}
             </div>
          )}

          {/* ABA: ESTRUTURAS & PAINÉIS */}
          {abaAtiva === 'formas' && (
            <div className="panel-content">
              <h3 className="panel-title">ESTRUTURAS & PAINÉIS</h3>
              <p className="hint-text" style={{margin: '0 0 6px 0'}}>Clique para adicionar ao cenário. Personalize com cores e capas:</p>

              {/* Seletor de Cor da Estrutura */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', background: '#f8fafc', borderRadius: '8px', padding: '8px 12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#334155', flex: 1 }}>🎨 Cor Base da Estrutura:</span>
                <input type="color" value={corEstrutura} onChange={e => setCorEstrutura(e.target.value)} style={{ width: '32px', height: '28px', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: 0 }} />
              </div>

              {/* 🏛️ PAINÉIS & ARCOS */}
              <div className="estruturas-section-label">🏛️ Painéis & Arcos</div>
              <div className="shapes-presets-grid">
                <div className="shape-card-item" onClick={() => adicionarFormaOuEstrutura('arco_romano')}>
                  <div className="shape-preview arco-romano-preview" style={{borderColor: corEstrutura, background: '#f8fafc'}}></div>
                  <span>Arco Romano</span>
                </div>
                <div className="shape-card-item" onClick={() => adicionarFormaOuEstrutura('arco_duplo')}>
                  <div className="shape-preview" style={{ width: '32px', height: '46px', border: `2px solid ${corEstrutura}`, borderTopLeftRadius: '20px', borderTopRightRadius: '20px', borderBottom: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '18px', height: '32px', border: `1.5px dashed ${corEstrutura}`, borderTopLeftRadius: '12px', borderTopRightRadius: '12px', borderBottom: 'none' }} />
                  </div>
                  <span>Arco Duplo</span>
                </div>
                <div className="shape-card-item" onClick={() => adicionarFormaOuEstrutura('painel_redondo')}>
                  <div className="shape-preview painel-redondo-preview" style={{backgroundColor: corEstrutura}}></div>
                  <span>Painel Redondo</span>
                </div>
                <div className="shape-card-item" onClick={() => adicionarFormaOuEstrutura('painel_retangular')}>
                  <div className="shape-preview" style={{ width: '32px', height: '46px', backgroundColor: corEstrutura, borderRadius: '3px', border: '1px solid rgba(0,0,0,0.1)' }}></div>
                  <span>Painel Ret.</span>
                </div>
                <div className="shape-card-item" onClick={() => adicionarFormaOuEstrutura('painel_ripado')}>
                  <div className="shape-preview" style={{ width: '32px', height: '46px', background: '#3e2311', borderRadius: '4px 4px 0 0', display: 'flex', gap: '2px', padding: '2px', boxSizing: 'border-box' }}>
                    {[0,1,2,3].map(i => <div key={i} style={{ flex: 1, background: corEstrutura || '#ba8249', borderRadius: '1px' }} />)}
                  </div>
                  <span>Ripado</span>
                </div>
                <div className="shape-card-item" onClick={() => adicionarFormaOuEstrutura('painel_shimmer')}>
                  <div className="shape-preview" style={{ width: '34px', height: '46px', background: '#0f172a', borderRadius: '3px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px', padding: '3px', boxSizing: 'border-box' }}>
                    {Array.from({ length: 9 }).map((_, i) => <div key={i} style={{ background: '#d4af37', borderRadius: '1px' }} />)}
                  </div>
                  <span>Shimmer</span>
                </div>
                <div className="shape-card-item" onClick={() => adicionarFormaOuEstrutura('painel_biombo')}>
                  <div className="shape-preview" style={{ width: '42px', height: '44px', display: 'flex', gap: '2px' }}>
                    {[0,1,2].map(i => <div key={i} style={{ flex: 1, border: `1px solid ${corEstrutura}`, background: '#f8fafc', borderRadius: '2px' }} />)}
                  </div>
                  <span>Biombo 3F</span>
                </div>
                <div className="shape-card-item" onClick={() => adicionarFormaOuEstrutura('meia_lua')}>
                  <div className="shape-preview" style={{ width: '46px', height: '24px', background: corEstrutura, borderRadius: '30px 30px 0 0' }}></div>
                  <span>Meia Lua</span>
                </div>
                <div className="shape-card-item" onClick={() => adicionarFormaOuEstrutura('painel_hexagonal')}>
                  <div className="shape-preview" style={{ width: '40px', height: '40px', clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', backgroundColor: corEstrutura }}></div>
                  <span>Hexagonal</span>
                </div>
                <div className="shape-card-item" onClick={() => adicionarFormaOuEstrutura('nicho_prateleira')}>
                  <div className="shape-preview" style={{ width: '40px', height: '36px', border: `2.5px solid ${corEstrutura}`, borderRadius: '3px', display: 'flex', flexDirection: 'column', justifyContent: 'space-around', padding: '2px', background: '#f8fafc' }}>
                    {[0,1].map(i=><div key={i} style={{ height: '30%', background: corEstrutura, borderRadius: '2px' }} />)}
                  </div>
                  <span>Nichos</span>
                </div>
              </div>

              {/* 🪑 MESAS & CILINDROS 3D */}
              <div className="estruturas-section-label">🪑 Mesas, Cilindros & Mobiliário 3D</div>
              <div className="shapes-presets-grid">
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
                <div className="shape-card-item" onClick={() => adicionarFormaOuEstrutura('mesa_retangular')}>
                  <div className="shape-preview" style={{ width: '48px', height: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '100%', height: '35%', backgroundColor: '#8B6914', borderRadius: '3px 3px 0 0', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                    <div style={{ width: '78%', height: '65%', display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
                      <div style={{ width: '16%', height: '100%', backgroundColor: '#6B4F0A', borderRadius: '0 0 2px 2px' }} />
                      <div style={{ width: '16%', height: '100%', backgroundColor: '#6B4F0A', borderRadius: '0 0 2px 2px' }} />
                    </div>
                  </div>
                  <span>Mesa Rústica</span>
                </div>
                <div className="shape-card-item" onClick={() => adicionarFormaOuEstrutura('mesa_provencal')}>
                  <div className="shape-preview" style={{ width: '48px', height: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ width: '100%', height: '35%', backgroundColor: '#ffffff', borderRadius: '3px', border: '1px solid #cbd5e1', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                    <div style={{ width: '85%', height: '65%', borderLeft: '2.5px solid #94a3b8', borderRight: '2.5px solid #94a3b8', borderBottom: '1px solid #cbd5e1' }} />
                  </div>
                  <span>Provençal</span>
                </div>
                <div className="shape-card-item" onClick={() => adicionarFormaOuEstrutura('mesa_cubo')}>
                  <div className="shape-preview" style={{ width: '32px', height: '38px', border: `2px solid ${corEstrutura || '#c5a059'}`, borderRadius: '2px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ width: '100%', height: '25%', background: '#f8fafc', borderBottom: `1.5px solid ${corEstrutura || '#c5a059'}` }} />
                    <div style={{ flex: 1, borderLeft: `1.5px solid ${corEstrutura || '#c5a059'}`, margin: '0 auto', width: '2px' }} />
                  </div>
                  <span>Mesa Cubo</span>
                </div>
                <div className="shape-card-item" onClick={() => adicionarFormaOuEstrutura('comoda_vintage')}>
                  <div className="shape-preview" style={{ width: '42px', height: '34px', background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '2px', padding: '3px' }}>
                    {[0,1,2].map(i => <div key={i} style={{ flex: 1, background: '#e2e8f0', borderRadius: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ width: '6px', height: '2px', background: '#c5a059' }} /></div>)}
                  </div>
                  <span>Cômoda</span>
                </div>
                <div className="shape-card-item" onClick={() => adicionarFormaOuEstrutura('carrinho_gourmet')}>
                  <div className="shape-preview" style={{ width: '40px', height: '38px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '2px' }}>
                    <div style={{ width: '90%', height: '6px', background: corEstrutura || '#c5a059', borderRadius: '2px' }} />
                    <div style={{ width: '70%', height: '5px', background: corEstrutura || '#c5a059', borderRadius: '1px' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '90%' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: `2px solid ${corEstrutura || '#c5a059'}` }} />
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', border: `1.5px solid ${corEstrutura || '#c5a059'}` }} />
                    </div>
                  </div>
                  <span>Carrinho</span>
                </div>
              </div>
            </div>
          )}

          {/* ABA: BALÕES & ARCOS */}
          {abaAtiva === 'baloes' && (
            <div className="panel-content">
              <p className="hint-text" style={{margin: '0 0 8px 0'}}>Guirlandas orgânicas, arcos, colunas e biblioteca de balões PNG:</p>

              {/* 🎨 SELETOR DE CORES & PALETA DE BEXIGAS */}
              <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#0f172a' }}>🎨 Cores dos Balões:</span>
                  <span style={{ fontSize: '9.5px', color: '#c5a059', fontWeight: '700' }}>{paletaBalaoAtiva.nome}</span>
                </div>

                {/* 5 Círculos de Cores Editáveis */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  {paletaBalaoAtiva.cores.map((cor, cIdx) => (
                    <div key={cIdx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flex: 1 }}>
                      <input
                        type="color"
                        value={cor}
                        onChange={(e) => {
                          const novas = [...paletaBalaoAtiva.cores];
                          novas[cIdx] = e.target.value;
                          setPaletaBalaoAtiva(prev => ({ ...prev, cores: novas }));
                          if (selecionadoId && isBalaoSelecionado) {
                            atualizarItem(selecionadoId, { coresBalao: novas });
                          }
                        }}
                        style={{ width: '100%', height: '24px', border: '1.5px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', padding: 0 }}
                        title={`Clique para alterar a Cor #${cIdx + 1}`}
                      />
                    </div>
                  ))}
                </div>

                {/* Dropdown de Paletas Prontas */}
                <select
                  value={paletaBalaoAtiva.nome}
                  onChange={(e) => {
                    const encontrada = PALETAS_BALOES.find(p => p.nome === e.target.value);
                    if (encontrada) {
                      setPaletaBalaoAtiva(encontrada);
                      if (selecionadoId && isBalaoSelecionado) {
                        atualizarItem(selecionadoId, { coresBalao: encontrada.cores });
                      }
                    }
                  }}
                  style={{ width: '100%', padding: '5px 8px', fontSize: '10.5px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: '600', color: '#334155' }}
                >
                  {PALETAS_BALOES.map((pal, idx) => (
                    <option key={idx} value={pal.nome}>
                      🎨 {pal.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* 🎈 BALÕES & GUIRLANDAS */}
              <div className="estruturas-section-label">🎈 Formatos de Balões & Guirlandas</div>
              <div className="shapes-presets-grid">
                <div className="shape-card-item" onClick={() => adicionarFormaOuEstrutura('arco_classico_portal')}>
                  <div className="shape-preview" style={{ width: '48px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>🎪</div>
                  <span>Arco Portal</span>
                </div>
                <div className="shape-card-item" onClick={() => adicionarFormaOuEstrutura('baloes_aro_redondo')}>
                  <div className="shape-preview" style={{ fontSize: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🔵</div>
                  <span>Aro Redondo</span>
                </div>
                <div className="shape-card-item" onClick={() => adicionarFormaOuEstrutura('baloes_lateral_l')}>
                  <div className="shape-preview" style={{ fontSize: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎈</div>
                  <span>Guirlanda L</span>
                </div>
                <div className="shape-card-item" onClick={() => adicionarFormaOuEstrutura('baloes_cluster_chao')}>
                  <div className="shape-preview" style={{ fontSize: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🫧</div>
                  <span>Cluster Chão</span>
                </div>
                <div className="shape-card-item" onClick={() => adicionarFormaOuEstrutura('guirlanda_horizontal')}>
                  <div className="shape-preview" style={{ fontSize: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>〰️</div>
                  <span>Guirlanda H.</span>
                </div>
                <div className="shape-card-item" onClick={() => adicionarFormaOuEstrutura('coluna_baloes')}>
                  <div className="shape-preview" style={{ fontSize: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🗼</div>
                  <span>Coluna</span>
                </div>
              </div>

              {/* SEÇÃO BIBLIOTECA & PORTFÓLIO EXCLUSIVA DE BALÕES */}
              <div className="baloes-section">
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                  <h4 style={{fontSize: '13px', color: '#0f172a', fontWeight: '800', margin: 0}}>
                    🎈 Biblioteca de Balões & Arcos (PNG)
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

                {/* Botão de Adicionar Balão ao Portfólio */}
                <button 
                  className="btn-upload-capa" 
                  style={{background: '#0f172a', marginBottom: '10px'}} 
                  onClick={() => setModalUploadElementoAberto(true)}
                >
                  <Icons.Image /> 📷 + Subir Novo Balão / Arco PNG
                </button>

                {/* Grid de Elementos Exclusivos de Balões */}
                {loadingBiblioteca ? (
                  <div style={{textAlign: 'center', padding: '20px', fontSize: '11px', color: '#64748b'}}>
                    Carregando balões...
                  </div>
                ) : elementosBaloesFiltrados.length === 0 ? (
                  <div style={{textAlign: 'center', padding: '20px 10px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1'}}>
                    <p style={{fontSize: '11px', color: '#64748b', margin: '0 0 8px 0'}}>
                      {filtroBiblioteca === 'meu_portfolio' ? 'Você ainda não adicionou balões ao seu portfólio.' : 'Nenhum balão oficial cadastrado.'}
                    </p>
                    <button className="btn-secondary" style={{padding: '6px 10px', fontSize: '10px'}} onClick={() => setModalUploadElementoAberto(true)}>
                      + Subir Balão / Arco PNG
                    </button>
                  </div>
                ) : (
                  <div className="presets-arcos-grid">
                    {elementosBaloesFiltrados.map((item, idx) => (
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

          {/* ABA: TEXTO & LETREIROS NEON (CATÁLOGO & PRESETS CRIATIVOS) */}
          {/* ABA: TEXTO & ÍCONES / APLIQUES DE FESTA */}
          {abaAtiva === 'texto' && (
            <div className="panel-content">
              <h3 className="panel-title">TEXTOS & ENFEITES</h3>

              {/* Sub-Aba Switcher: Títulos vs Ícones & Enfeites */}
              <div style={{ display: 'flex', gap: '4px', marginBottom: '14px', background: '#f1f5f9', padding: '4px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={() => setSubAbaTexto('texto')}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    fontSize: '11px',
                    fontWeight: '800',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: subAbaTexto === 'texto' ? '#ffffff' : 'transparent',
                    color: subAbaTexto === 'texto' ? '#0f172a' : '#64748b',
                    boxShadow: subAbaTexto === 'texto' ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  🔤 Títulos & Nomes
                </button>
                <button
                  type="button"
                  onClick={() => setSubAbaTexto('icones')}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    fontSize: '11px',
                    fontWeight: '800',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    background: subAbaTexto === 'icones' ? '#ffffff' : 'transparent',
                    color: subAbaTexto === 'icones' ? '#0f172a' : '#64748b',
                    boxShadow: subAbaTexto === 'icones' ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  🌿 Ícones & Apliques
                </button>
              </div>

              {/* SUB-ABA 1: CRIADOR DE TEXTO & EFEITOS */}
              {subAbaTexto === 'texto' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  
                  {/* Indicador de Edição Ativa */}
                  {itemSelecionado?.type === 'text' && (
                    <div style={{ padding: '8px 10px', background: '#fef3c7', borderRadius: '8px', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13px' }}>⚡</span>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: '#92400e' }}>Editando texto selecionado no cenário</span>
                    </div>
                  )}

                  {/* 1. Digitar Texto / Nome */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '800', color: '#334155', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                      ✍️ Digite o Texto / Nome / Frase:
                    </label>
                    <input 
                      type="text"
                      className="text-input-direct"
                      value={itemSelecionado?.type === 'text' ? (itemSelecionado.content || '') : textoNovoInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTextoNovoInput(val);
                        if (itemSelecionado?.type === 'text' && selecionadoId) {
                          atualizarItem(selecionadoId, { content: val });
                        }
                      }}
                      placeholder="Ex: Sophia 15 Anos, Bem-Vindos..."
                      style={{ width: '100%', padding: '10px 12px', fontSize: '13px', borderRadius: '8px', border: '1.5px solid #cbd5e1', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* 2. Botão Principal: Inserir no Cenário */}
                  <button
                    type="button"
                    onClick={() => {
                      const txt = (itemSelecionado?.type === 'text' ? itemSelecionado.content : textoNovoInput).trim() || 'Nome da Festa';
                      let preset = {
                        content: txt,
                        fontFamily: fonteTextoAtiva,
                        fontSize: 50,
                      };
                      if (efeitoTextoAtivo === 'neon') {
                        preset = { ...preset, neon: true, neonColor: '#ec4899', color: '#ffffff', neonGlow: 22 };
                      } else if (efeitoTextoAtivo === 'acrilico_redondo') {
                        preset = { ...preset, placaFundo: 'acrilico_redondo', color: '#0f172a', letterSpacing: 2 };
                      } else if (efeitoTextoAtivo === 'acrilico_retangular') {
                        preset = { ...preset, placaFundo: 'acrilico_retangular', color: '#0f172a', letterSpacing: 2 };
                      } else if (efeitoTextoAtivo !== 'none') {
                        preset = { ...preset, material: efeitoTextoAtivo };
                      }
                      adicionarTexto(preset);
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                      color: '#c5a059',
                      border: '1.5px solid #c5a059',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      fontSize: '12px',
                      fontWeight: '900',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <span>✍️</span>
                    <span>+ Inserir Texto no Cenário</span>
                  </button>

                  {/* 3. Efeitos & Materiais de Acabamento */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '800', color: '#334155', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                      🪞 Efeitos & Materiais de Acabamento:
                    </label>
                    <div className="texture-swatches-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                      {[
                        { id: 'none', nome: 'Sólido / Normal', tipo: 'cor', bg: '#0f172a' },
                        { id: 'gold_mirror', nome: 'Acrílico Ouro', tipo: 'grad', bg: 'linear-gradient(135deg, #bf953f 0%, #fcf6ba 30%, #b38728 55%, #aa771c 100%)' },
                        { id: 'rose_gold', nome: 'Rose Gold', tipo: 'grad', bg: 'linear-gradient(135deg, #b76e79 0%, #ffd1dc 30%, #e0a9af 55%, #9c4f5a 100%)' },
                        { id: 'silver_mirror', nome: 'Prata Espelho', tipo: 'grad', bg: 'linear-gradient(135deg, #8a8a8a 0%, #ffffff 30%, #a6a6a6 55%, #737373 100%)' },
                        { id: 'mdf_wood', nome: 'MDF 3D Laser', tipo: 'pat', bg: 'repeating-linear-gradient(45deg, #d29b62, #d29b62 6px, #ba8249 6px, #ba8249 12px)' },
                        { id: 'glitter_gold', nome: 'Glitter Dourado', tipo: 'grad', bg: 'radial-gradient(circle at 50% 50%, #fff7cc 10%, #d4af37 40%, #996515 80%, #ffd700 100%)' },
                        { id: 'neon', nome: 'Letreiro Neon LED', tipo: 'neon', bg: '#0f172a' },
                        { id: 'acrilico_redondo', nome: 'Placa Redonda', tipo: 'placa', bg: '#e2e8f0' },
                        { id: 'acrilico_retangular', nome: 'Placa Retangular', tipo: 'placa', bg: '#e2e8f0' },
                      ].map(efeito => {
                        const isAtivo = itemSelecionado?.type === 'text'
                          ? (efeito.id === 'neon' ? itemSelecionado.neon : efeito.id.startsWith('acrilico_') ? itemSelecionado.placaFundo === efeito.id : (itemSelecionado.material || 'none') === efeito.id)
                          : efeitoTextoAtivo === efeito.id;

                        return (
                          <div
                            key={efeito.id}
                            className={`texture-swatch-card ${isAtivo ? 'active' : ''}`}
                            onClick={() => {
                              setEfeitoTextoAtivo(efeito.id);
                              if (itemSelecionado?.type === 'text' && selecionadoId) {
                                if (efeito.id === 'neon') {
                                  atualizarItem(selecionadoId, { neon: true, neonColor: itemSelecionado.neonColor || '#ec4899', color: '#ffffff', material: 'none', placaFundo: 'nenhuma' });
                                } else if (efeito.id === 'acrilico_redondo') {
                                  atualizarItem(selecionadoId, { placaFundo: 'acrilico_redondo', neon: false });
                                } else if (efeito.id === 'acrilico_retangular') {
                                  atualizarItem(selecionadoId, { placaFundo: 'acrilico_retangular', neon: false });
                                } else if (efeito.id === 'none') {
                                  atualizarItem(selecionadoId, { material: 'none', neon: false, placaFundo: 'nenhuma' });
                                } else {
                                  atualizarItem(selecionadoId, { material: efeito.id, neon: false, placaFundo: 'nenhuma' });
                                }
                              }
                            }}
                            title={`Aplicar ${efeito.nome}`}
                          >
                            <div 
                              className="texture-swatch-thumb" 
                              style={{ background: efeito.bg }}
                            >
                              {efeito.tipo === 'cor' && <span style={{ fontSize: '11px', color: '#fff' }}>Aa</span>}
                              {efeito.tipo === 'neon' && <span style={{ fontSize: '12px', color: '#ec4899', textShadow: '0 0 6px #ec4899' }}>💡</span>}
                              {efeito.tipo === 'placa' && <span style={{ fontSize: '12px' }}>🏷️</span>}
                            </div>
                            <span className="texture-swatch-name">{efeito.nome}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4. Estilos de Fonte Rápidos */}
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: '800', color: '#334155', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                      🔠 Família de Fonte / Tipografia:
                    </label>
                    <select
                      className="font-selector"
                      value={itemSelecionado?.type === 'text' ? itemSelecionado.fontFamily : fonteTextoAtiva}
                      onChange={(e) => {
                        const f = e.target.value;
                        setFonteTextoAtiva(f);
                        if (itemSelecionado?.type === 'text' && selecionadoId) {
                          atualizarItem(selecionadoId, { fontFamily: f });
                        }
                      }}
                      style={{ width: '100%', padding: '9px 10px', fontSize: '12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', boxSizing: 'border-box' }}
                    >
                      {fontesDisponiveis.map(f => (
                        <option key={f.nome} value={f.valor} style={{ fontFamily: f.valor }}>
                          {f.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* SUB-ABA 2: ÍCONES, RAMOS, COROAS & ENFEITES MANUAIS */}
              {subAbaTexto === 'icones' && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>
                    🌿 Clique para Inserir na Prancheta:
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '10px' }}>
                    Adicione ramos, coroas, corações e brasões soltos para compor livremente ao redor de nomes e painéis.
                  </div>

                  <div className="ornament-gallery-grid">
                    {Object.entries(ORNAMENTOS_FESTA).map(([key, orn]) => (
                      <div
                        key={key}
                        className="ornament-card-item"
                        onClick={() => adicionarOrnamento(key, 'gold_mirror')}
                        title={`Adicionar ${orn.nome}`}
                      >
                        <div className="ornament-preview-box">
                          <svg width="100%" height="100%" viewBox={orn.viewBox || "0 0 100 100"} style={{ color: '#c5a059', filter: 'drop-shadow(1px 2px 2px rgba(0,0,0,0.25))' }}>
                            <defs>
                              <linearGradient id={`prev-gold-${key}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#bf953f" />
                                <stop offset="50%" stopColor="#fcf6ba" />
                                <stop offset="100%" stopColor="#aa771c" />
                              </linearGradient>
                            </defs>
                            <g fill={`url(#prev-gold-${key})`}>
                              {orn.path}
                            </g>
                          </svg>
                        </div>
                        <span className="ornament-card-label">{orn.nome}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Botão Ver Peças */}
              <button 
                type="button" 
                className="btn-secondary" 
                style={{ width: '100%', padding: '10px', borderRadius: '8px', fontWeight: 'bold', marginTop: '12px' }} 
                onClick={() => { setSelecionadoId(null); setAbaAtiva('acervo'); }}
              >
                ← Voltar ao Catálogo de Peças
              </button>
            </div>
          )}

          {/* ABA: CENÁRIO & AMBIENTE */}
          {abaAtiva === 'fundo' && (
               <div className="panel-content">
                   <div className="panel-header-row" style={{ marginBottom: '10px' }}>
                     <h3 className="panel-title" style={{ margin: 0 }}>CENÁRIO & AMBIENTE</h3>
                   </div>

                   {/* 🔀 3 Abas Diretas: Parede, Piso e Ambiente Inteiro */}
                   <div className="cenario-type-switcher" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginBottom: '14px' }}>
                     <button 
                       type="button"
                       className={`switch-btn ${cenarioAba === 'parede' ? 'active' : ''}`} 
                       onClick={() => {
                         setCenarioAba('parede');
                         setModoCenario('duplo');
                         setActiveSurface('wall');
                       }}
                       style={{ padding: '8px 2px', fontSize: '10.5px', fontWeight: '800' }}
                     >
                       🧱 Parede
                     </button>
                     <button 
                       type="button"
                       className={`switch-btn ${cenarioAba === 'piso' ? 'active' : ''}`} 
                       onClick={() => {
                         setCenarioAba('piso');
                         setModoCenario('duplo');
                         setActiveSurface('floor');
                       }}
                       style={{ padding: '8px 2px', fontSize: '10.5px', fontWeight: '800' }}
                     >
                       🪵 Piso
                     </button>
                     <button 
                       type="button"
                       className={`switch-btn ${cenarioAba === 'ambiente' ? 'active' : ''}`} 
                       onClick={() => {
                         setCenarioAba('ambiente');
                         setModoCenario('unico');
                       }}
                       style={{ padding: '8px 2px', fontSize: '10.5px', fontWeight: '800' }}
                     >
                       🏞️ Ambiente
                     </button>
                   </div>

                   {/* 1. ABA: PAREDE */}
                   {cenarioAba === 'parede' && (
                     <>
                       {/* Cores Rápidas de Parede */}
                       <div className="cenario-section-title">🎨 Cores de Parede:</div>
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
                             onClick={() => {
                               setWallBackground(item.cor);
                               saveSnapshot(itensCanvas, item.cor, floorBackground);
                             }}
                             title={item.nome}
                           />
                         ))}
                         <label className="fast-color-picker-label" title="Escolher cor livre">
                           <input 
                             type="color" 
                             className="invisible-color-input" 
                             onChange={(e) => {
                               setWallBackground(e.target.value);
                               saveSnapshot(itensCanvas, e.target.value, floorBackground);
                             }} 
                           />
                           <span>🎨</span>
                         </label>
                       </div>

                       {/* Fundos e Texturas de Parede */}
                        <div className="adm-header-flex" style={{ marginTop: '14px' }}>
                          <h4>Fundos de Parede ({fundosParedeCompletos.length})</h4>
                        </div>

                        {fundosParedeCompletos.length === 0 ? (
                          <div className="bg-presets-empty-box">
                            <span style={{ fontSize: '24px' }}>🧱</span>
                            <p>Nenhuma parede oficial cadastrada</p>
                            <small>Cadastre novas paredes no Painel Master (Controle Geral).</small>
                          </div>
                        ) : (
                          <div className="bg-presets-modern-grid">
                            {fundosParedeCompletos.map((bg, idx) => (
                              <div 
                                key={idx} 
                                className={`bg-preset-card ${wallBackground === bg.url && modoCenario === 'duplo' ? 'active' : ''}`} 
                                onClick={() => {
                                  setModoCenario('duplo');
                                  setWallBackground(bg.url);
                                  saveSnapshot(itensCanvas, bg.url, floorBackground);
                                }} 
                                title={bg.nome}
                              >
                                <img src={bg.url} alt={bg.nome} />
                                <span>{bg.nome}</span>
                                {bg.isSuperAdm && (
                                  <span className="badge-card-stock" style={{ background: '#fef3c7', color: '#b45309', border: 'none' }}>
                                    👑 Oficial
                                  </span>
                                )}
                                {bg.isMeu && (
                                  <div className="btn-del-bg" onClick={(e) => { e.stopPropagation(); removerTextura('wall', bg.url); }}>✕</div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                                                {/* Enquadramento & Posição da Parede */}
                        {wallBackground && (wallBackground.startsWith('http') || wallBackground.startsWith('data:') || wallBackground.startsWith('blob:') || wallBackground.startsWith('/') || wallBackground.startsWith('url')) && (
                          <div className="transicao-chao-box" style={{ marginTop: '12px' }}>
                            <div className="transicao-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong>📐 Enquadramento & Posição</strong>
                              <button 
                                type="button"
                                className="btn-link-reset"
                                onClick={() => { setPosicaoParedeY(50); setPosicaoParedeX(50); setZoomParede(100); }}
                                title="Resetar posição"
                              >
                                ↺ Centralizar
                              </button>
                            </div>
                            <p className="hint-text" style={{ margin: '0 0 8px 0', fontSize: '11px' }}>
                              Mova para cima/baixo para usar a melhor parte da imagem:
                            </p>

                            <div className="slider-group" style={{ marginBottom: '8px' }}>
                              <label>↕️ Posição Vertical / Altura ({posicaoParedeY}%)</label>
                              <input 
                                type="range" min="0" max="100" value={posicaoParedeY} 
                                onChange={e => setPosicaoParedeY(Number(e.target.value))} 
                              />
                            </div>

                            <div className="slider-group" style={{ marginBottom: '8px' }}>
                              <label>↔️ Posição Horizontal ({posicaoParedeX}%)</label>
                              <input 
                                type="range" min="0" max="100" value={posicaoParedeX} 
                                onChange={e => setPosicaoParedeX(Number(e.target.value))} 
                              />
                            </div>

                            <div className="slider-group" style={{ marginBottom: '4px' }}>
                              <label>🔍 Zoom / Escala da Parede ({zoomParede}%)</label>
                              <input 
                                type="range" min="80" max="250" value={zoomParede} 
                                onChange={e => setZoomParede(Number(e.target.value))} 
                              />
                            </div>
                          </div>
                        )}

                        {/* Ajustes de Transição Ciclorama 3D & Profundidade */}
                        <div className="transicao-chao-box" style={{ marginTop: '14px' }}>
                          <div className="transicao-title-row">
                            <strong>✨ Profundidade 3D & Ciclorama</strong>
                          </div>
                          <p className="hint-text" style={{ margin: '0 0 8px 0', fontSize: '11px' }}>Ajuste a perspectiva, desfoque óptico e transição do chão:</p>

                          <div className="slider-group" style={{ marginBottom: '8px' }}>
                            <label>📷 Profundidade de Tela / Desfoque ({profundidadeFoco}px)</label>
                            <input 
                              type="range" min="0" max="10" value={profundidadeFoco} 
                              onChange={e => setProfundidadeFoco(Number(e.target.value))} 
                            />
                          </div>

                          <div className="slider-group" style={{ marginBottom: '8px' }}>
                            <label>Sombra de Contato / Oclusão ({sombraChaoIntensidade}%)</label>
                            <input 
                              type="range" min="0" max="60" value={sombraChaoIntensidade} 
                              onChange={e => setSombraChaoIntensidade(Number(e.target.value))} 
                            />
                          </div>

                          <div className="slider-group" style={{ marginBottom: '8px' }}>
                            <label>Altura da Linha do Piso ({alturaChao}%)</label>
                            <input 
                              type="range" min="15" max="55" value={alturaChao} 
                              onChange={e => setAlturaChao(Number(e.target.value))} 
                            />
                          </div>

                          <div className="tampo-type-toggle" style={{ marginTop: '6px' }}>
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
                    )}

                    {/* 2. ABA: PISO */}
                    {cenarioAba === 'piso' && (
                     <>
                       {/* Cores Rápidas de Piso */}
                       <div className="cenario-section-title">🎨 Cores de Piso / Chão:</div>
                       <div className="fast-colors-palette">
                         {[
                           { nome: 'Branco Polido', cor: '#ffffff' },
                           { nome: 'Off-White', cor: '#f1f5f9' },
                           { nome: 'Bege Madeira Clara', cor: '#f5ebe0' },
                           { nome: 'Cinza Cimento', cor: '#cbd5e1' },
                           { nome: 'Grafite Piso', cor: '#475569' },
                           { nome: 'Marrom Tablado', cor: '#78350f' },
                           { nome: 'Preto Noite', cor: '#0a0e17' }
                         ].map((item, idx) => (
                           <div 
                             key={idx}
                             className="fast-color-chip"
                             style={{ backgroundColor: item.cor }}
                             onClick={() => {
                               setFloorBackground(item.cor);
                               saveSnapshot(itensCanvas, wallBackground, item.cor);
                             }}
                             title={item.nome}
                           />
                         ))}
                         <label className="fast-color-picker-label" title="Escolher cor livre">
                           <input 
                             type="color" 
                             className="invisible-color-input" 
                             onChange={(e) => {
                               setFloorBackground(e.target.value);
                               saveSnapshot(itensCanvas, wallBackground, e.target.value);
                             }} 
                           />
                           <span>🎨</span>
                         </label>
                       </div>

                       {/* Fundos e Texturas de Piso */}
                        <div className="adm-header-flex" style={{ marginTop: '14px' }}>
                          <h4>Fundos de Piso ({fundosPisoCompletos.length})</h4>
                        </div>

                        {fundosPisoCompletos.length === 0 ? (
                          <div className="bg-presets-empty-box">
                            <span style={{ fontSize: '24px' }}>🪵</span>
                            <p>Nenhum chão oficial cadastrado</p>
                            <small>Cadastre novos pisos no Painel Master (Controle Geral).</small>
                          </div>
                        ) : (
                          <div className="bg-presets-modern-grid">
                            {fundosPisoCompletos.map((bg, idx) => (
                              <div 
                                key={idx} 
                                className={`bg-preset-card ${floorBackground === bg.url && modoCenario === 'duplo' ? 'active' : ''}`} 
                                onClick={() => {
                                  setModoCenario('duplo');
                                  setFloorBackground(bg.url);
                                  saveSnapshot(itensCanvas, wallBackground, bg.url);
                                }} 
                                title={bg.nome}
                              >
                                <img src={bg.url} alt={bg.nome} />
                                <span>{bg.nome}</span>
                                {bg.isSuperAdm && (
                                  <span className="badge-card-stock" style={{ background: '#fef3c7', color: '#b45309', border: 'none' }}>
                                    👑 Oficial
                                  </span>
                                )}
                                {bg.isMeu && (
                                  <div className="btn-del-bg" onClick={(e) => { e.stopPropagation(); removerTextura('floor', bg.url); }}>✕</div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                                                {/* Enquadramento & Posição do Chão */}
                        {floorBackground && (floorBackground.startsWith('http') || floorBackground.startsWith('data:') || floorBackground.startsWith('blob:') || floorBackground.startsWith('/') || floorBackground.startsWith('url')) && (
                          <div className="transicao-chao-box" style={{ marginTop: '12px' }}>
                            <div className="transicao-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong>📐 Enquadramento do Piso</strong>
                              <button 
                                type="button"
                                className="btn-link-reset"
                                onClick={() => { setPosicaoPisoY(50); setPosicaoPisoX(50); setZoomPiso(100); }}
                                title="Resetar posição"
                              >
                                ↺ Centralizar
                              </button>
                            </div>
                            <p className="hint-text" style={{ margin: '0 0 8px 0', fontSize: '11px' }}>
                              Mova para posicionar veios da madeira, porcelanato ou grama:
                            </p>

                            <div className="slider-group" style={{ marginBottom: '8px' }}>
                              <label>↕️ Posição Vertical ({posicaoPisoY}%)</label>
                              <input 
                                type="range" min="0" max="100" value={posicaoPisoY} 
                                onChange={e => setPosicaoPisoY(Number(e.target.value))} 
                              />
                            </div>

                            <div className="slider-group" style={{ marginBottom: '8px' }}>
                              <label>↔️ Posição Horizontal ({posicaoPisoX}%)</label>
                              <input 
                                type="range" min="0" max="100" value={posicaoPisoX} 
                                onChange={e => setPosicaoPisoX(Number(e.target.value))} 
                              />
                            </div>

                            <div className="slider-group" style={{ marginBottom: '4px' }}>
                              <label>🔍 Zoom / Escala do Piso ({zoomPiso}%)</label>
                              <input 
                                type="range" min="80" max="250" value={zoomPiso} 
                                onChange={e => setZoomPiso(Number(e.target.value))} 
                              />
                            </div>
                          </div>
                        )}

                        {/* Ajustes de Linha do Piso & Profundidade */}
                        <div className="transicao-chao-box" style={{ marginTop: '14px' }}>
                          <div className="transicao-title-row">
                            <strong>📏 Profundidade 3D & Nivelamento do Chão</strong>
                          </div>

                          <div className="slider-group" style={{ marginBottom: '8px' }}>
                            <label>📷 Profundidade de Tela / Desfoque ({profundidadeFoco}px)</label>
                            <input 
                              type="range" min="0" max="10" value={profundidadeFoco} 
                              onChange={e => setProfundidadeFoco(Number(e.target.value))} 
                            />
                          </div>

                          <div className="slider-group" style={{ marginBottom: '8px' }}>
                            <label>Altura da Linha do Piso ({alturaChao}%)</label>
                            <input 
                              type="range" min="15" max="55" value={alturaChao} 
                              onChange={e => setAlturaChao(Number(e.target.value))} 
                            />
                          </div>

                          <div className="slider-group" style={{ marginBottom: '8px' }}>
                            <label>Sombra de Contato ({sombraChaoIntensidade}%)</label>
                            <input 
                              type="range" min="0" max="60" value={sombraChaoIntensidade} 
                              onChange={e => setSombraChaoIntensidade(Number(e.target.value))} 
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* 3. ABA: AMBIENTE INTEIRO */}
                    {cenarioAba === 'ambiente' && (
                      <>
                        {/* Modo Fundo Único */}
                        <p className="hint-text" style={{ margin: '8px 0 10px 0' }}>
                          Foto 100% de tela cheia (ideal para fotos de salão de festa, espaço de eventos ou papel de parede contínuo):
                        </p>

                        {/* Cores Rápidas */}
                        <div className="cenario-section-title">🎨 Cor Sólida de Fundo:</div>
                        <div className="fast-colors-palette" style={{ marginBottom: '14px' }}>
                          {[
                            { nome: 'Branco', cor: '#ffffff' },
                            { nome: 'Off-White', cor: '#f8fafc' },
                            { nome: 'Cinza Claro', cor: '#e2e8f0' },
                            { nome: 'Bege Salão', cor: '#f5ebe0' },
                            { nome: 'Grafite Escuro', cor: '#0f172a' }
                          ].map((item, idx) => (
                            <div 
                              key={idx}
                              className="fast-color-chip"
                              style={{ backgroundColor: item.cor }}
                              onClick={() => { setModoCenario('unico'); setWallBackground(item.cor); saveSnapshot(itensCanvas, item.cor, floorBackground); }}
                              title={item.nome}
                            />
                          ))}
                          <label className="fast-color-picker-label" title="Escolher cor livre">
                            <input type="color" className="invisible-color-input" onChange={(e) => { setModoCenario('unico'); setWallBackground(e.target.value); saveSnapshot(itensCanvas, e.target.value, floorBackground); }} />
                            <span>🎨</span>
                          </label>
                        </div>

                        {/* Galeria de Salões & Ambientes Inteiros */}
                        <div className="adm-header-flex" style={{ marginTop: '14px' }}>
                          <h4>Salões & Ambientes Inteiros ({fundosAmbienteCompletos.length})</h4>
                        </div>

                        {fundosAmbienteCompletos.length === 0 ? (
                          <div className="bg-presets-empty-box">
                            <span style={{ fontSize: '24px' }}>🏞️</span>
                            <p>Nenhum ambiente oficial cadastrado</p>
                            <small>Cadastre fotos de salões e espaços no Painel Master (Controle Geral).</small>
                          </div>
                        ) : (
                          <div className="bg-presets-modern-grid">
                            {fundosAmbienteCompletos.map((bg, idx) => (
                              <div 
                                key={idx} 
                                className={`bg-preset-card ${wallBackground === bg.url && modoCenario === 'unico' ? 'active' : ''}`} 
                                onClick={() => {
                                  setModoCenario('unico');
                                  setWallBackground(bg.url);
                                  saveSnapshot(itensCanvas, bg.url, floorBackground);
                                }} 
                                title={bg.nome}
                              >
                                <img src={bg.url} alt={bg.nome} />
                                <span>{bg.nome}</span>
                                {bg.isSuperAdm && (
                                  <span className="badge-card-stock" style={{ background: '#fef3c7', color: '#b45309', border: 'none' }}>
                                    👑 Oficial
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                                                {/* Enquadramento & Posição do Ambiente Inteiro */}
                        {wallBackground && (wallBackground.startsWith('http') || wallBackground.startsWith('data:') || wallBackground.startsWith('blob:') || wallBackground.startsWith('/') || wallBackground.startsWith('url')) && (
                          <div className="transicao-chao-box" style={{ marginTop: '12px' }}>
                            <div className="transicao-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong>📐 Enquadramento da Foto do Salão</strong>
                              <button 
                                type="button"
                                className="btn-link-reset"
                                onClick={() => { setPosicaoAmbienteY(50); setPosicaoAmbienteX(50); setZoomAmbiente(100); }}
                                title="Resetar posição"
                              >
                                ↺ Centralizar
                              </button>
                            </div>
                            <p className="hint-text" style={{ margin: '0 0 8px 0', fontSize: '11px' }}>
                              Mova a foto para cima/baixo para focar mais no chão ou no teto/lustres:
                            </p>

                            <div className="slider-group" style={{ marginBottom: '8px' }}>
                              <label>↕️ Posição Vertical / Altura ({posicaoAmbienteY}%)</label>
                              <input 
                                type="range" min="0" max="100" value={posicaoAmbienteY} 
                                onChange={e => setPosicaoAmbienteY(Number(e.target.value))} 
                              />
                            </div>

                            <div className="slider-group" style={{ marginBottom: '8px' }}>
                              <label>↔️ Posição Horizontal ({posicaoAmbienteX}%)</label>
                              <input 
                                type="range" min="0" max="100" value={posicaoAmbienteX} 
                                onChange={e => setPosicaoAmbienteX(Number(e.target.value))} 
                              />
                            </div>

                            <div className="slider-group" style={{ marginBottom: '4px' }}>
                              <label>🔍 Zoom / Enquadramento ({zoomAmbiente}%)</label>
                              <input 
                                type="range" min="100" max="250" value={zoomAmbiente} 
                                onChange={e => setZoomAmbiente(Number(e.target.value))} 
                              />
                            </div>
                          </div>
                        )}

                        {/* Ajustes de Profundidade para Ambiente Inteiro */}
                        <div className="transicao-chao-box" style={{ marginTop: '14px' }}>
                          <div className="transicao-title-row">
                            <strong>📷 Profundidade de Tela & Foco Óptico</strong>
                          </div>
                          <p className="hint-text" style={{ margin: '0 0 8px 0', fontSize: '11px' }}>Desfoca o fundo fotográfico para destacar a decoração e os balões:</p>

                          <div className="slider-group" style={{ marginBottom: '4px' }}>
                            <label>Profundidade de Foco / Desfoque ({profundidadeFoco}px)</label>
                            <input 
                              type="range" min="0" max="10" value={profundidadeFoco} 
                              onChange={e => setProfundidadeFoco(Number(e.target.value))} 
                            />
                          </div>
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
                 
                 {/* Botão Sair / Voltar ao Início */}
                 <button className="btn-header-action danger-exit" onClick={() => navigate('/dashboard')} title="Voltar ao Painel Principal">
                     <Icons.Crown width={14} height={14} /> <span className="btn-text">INÍCIO</span>
                 </button>

                 <div className="header-divider"></div>

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
                   <span className="btn-text">{modoApresentacao ? 'SAIR' : 'APRESENTAÇÃO'}</span>
                 </button>

                 {!modoApresentacao && (
                   <>
                     <div className="header-divider"></div>

                     {/* 🧲 Alinhamento Magnético */}
                     <button 
                       className={`btn-header-action ${snappingAtivo ? 'luxury-gold' : ''}`} 
                       onClick={() => setSnappingAtivo(!snappingAtivo)} 
                       title={snappingAtivo ? "Alinhamento Magnético Ativado (Clique para desativar)" : "Alinhamento Magnético Desativado (Clique para ativar)"}
                     >
                       <span style={{ fontSize: '13px' }}>🧲</span>
                       <span className="btn-text">{snappingAtivo ? 'MAGNET: ON' : 'MAGNET: OFF'}</span>
                     </button>

                     {/* ⌨️ Atalhos de Produtividade */}
                     <button 
                       className="btn-header-action" 
                       onClick={() => setModalAtalhosAberto(true)} 
                       title="Guia de Atalhos de Teclado (Pressione ?)"
                     >
                       <span style={{ fontSize: '13px' }}>⌨️</span>
                       <span className="btn-text">ATALHOS</span>
                     </button>

                     <div className="header-divider"></div>

                     {/* Projetos */}
                     <button className="btn-header-action" onClick={handleAbrirListaProjetos} title="Meus Projetos"><Icons.Folder /> <span className="btn-text">PROJETOS</span></button>
                     <button className="btn-header-action" onClick={handleAbrirModalSalvar} title="Salvar Projeto"><Icons.Save /> <span className="btn-text">SALVAR</span></button>
                     
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
                     <button className="btn-header-action primary" onClick={handleExportImage} title="Baixar Imagem PNG"><Icons.Download /> <span className="btn-text">PNG</span></button>
                     <button className="btn-header-action luxury-gold" onClick={handleGerarPropostaPDF} disabled={exportandoPDF} title="Gerar Proposta Comercial PDF">
                       <Icons.FileText /> <span className="btn-text">{exportandoPDF ? '...' : 'PDF'}</span>
                     </button>
                   </>
                 )}
             </div>
         </div>
        
        {/* 🖼️ O QUADRO DECORATIVO (ARTBOARD) */}
        <div className="artboard-zoom-wrapper" style={{ transform: `scale(${zoom})` }}>
          <div className="canvas-artboard" ref={boardRef}>
              
              {/* 🧲 GUIAS MAGNÉTICAS DE ALINHAMENTO ATIVAS */}
              {activeSnapGuides.map((guide, idx) => (
                <div
                  key={idx}
                  className="snap-guide-line"
                  style={guide.type === 'vertical' ? {
                    left: `${guide.pos}px`,
                    top: 0,
                    width: '2px',
                    height: '100%',
                  } : {
                    top: `${guide.pos}px`,
                    left: 0,
                    height: '2px',
                    width: '100%',
                  }}
                >
                  {guide.label && (
                    <span 
                      className="snap-guide-label" 
                      style={guide.type === 'horizontal' ? { top: '-18px', left: '12px' } : { top: '12px', left: '6px' }}
                    >
                      {guide.label}
                    </span>
                  )}
                </div>
              ))}
              
              {/* Camadas do Cenário (Suavização / Ciclorama 3D) */}
              <div className="canvas-layers" style={{ filter: profundidadeFoco > 0 ? `blur(${profundidadeFoco}px)` : 'none', transform: profundidadeFoco > 0 ? 'scale(1.03)' : 'none', transition: 'filter 0.2s ease, transform 0.2s ease' }}>
                {modoCenario === 'unico' ? (
                  <div className="layer-single-bg" style={getStyle(wallBackground, "ambiente")} />
                ) : (
                  <>
                    <div 
                      className="layer-wall" 
                      style={{
                        ...getStyle(wallBackground, "wall"),
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
                        ...getStyle(floorBackground, "floor"),
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
                const isAComprar = item.type === 'image' && item.isEstoqueProprio === false && !item.origem?.includes('upload');

                return (
                  <div key={item.uniqueId} 
                      data-item-id={item.uniqueId}
                      className={`canvas-object ${isSelected ? 'selected' : ''} ${item.locked ? 'locked-item' : ''} ${isPanCapaMode && isSelected ? 'in-pan-mode' : ''}`}
                      style={{ 
                          left: item.x, 
                          top: item.y, 
                          width: item.type === 'text' ? 'max-content' : `${item.width}px`, 
                          height: item.type === 'text' ? 'max-content' : `${item.height}px`, 
                          zIndex: index + 10,
                          transform: `rotate(${item.rotation || 0}deg) scaleX(${item.flipH ? -1 : 1}) scaleY(${item.flipV ? -1 : 1})`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          filter: (item.shadow > 0 || (item.brightness && item.brightness !== 100) || (item.contrast && item.contrast !== 100) || (item.saturate && item.saturate !== 100))
                            ? `brightness(${item.brightness || 100}%) contrast(${item.contrast || 100}%) saturate(${item.saturate || 100}%) ${item.shadow > 0 ? `drop-shadow(5px 5px ${item.shadow}px rgba(0,0,0,0.5))` : ''}`
                            : undefined,
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
                  
                  {/* TEXTO PROFISSIONAL (COM MATERIAIS, CURVAS, NEON E SUPORTES) */}
                  {item.type === 'text' && (
                    <ElementoTextoPersonalizado 
                      item={item}
                      isEditing={editingTextId === item.uniqueId}
                      onDoubleClick={(e) => { e.stopPropagation(); setEditingTextId(item.uniqueId); }}
                      onChange={(newVal) => atualizarItem(item.uniqueId, { content: newVal })}
                      onBlur={() => {
                        setEditingTextId(null);
                        if (!item.content?.trim()) deleteItem(item.uniqueId);
                      }}
                    />
                  )}

                  {/* 🌿 ENFEITES, RAMOS, COROAS & APLIQUES VETORIAIS */}
                  {item.type === 'ornament' && (
                    <ElementoOrnamentoSVG item={item} />
                  )}

                  {/* IMAGEM DO ACERVO */}
                  {item.type === 'image' && item.imagem && (
                    <>
                      <img src={item.imagem} draggable="false" style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} crossOrigin="anonymous" alt="" />
                      {/* Badge A Comprar Pulsante */}
                      {isAComprar && !modoApresentacao && (
                        <div className="badge-acomprar-canvas">🛒 Comprar</div>
                      )}
                    </>
                  )}

                  {/* 🏛️ MESAS CILINDRO 3D REALISTAS */}
                  {item.type === 'shape' && item.shapeType?.includes('cilindro') && (
                    <CilindroMesa3D item={item} />
                  )}

                  {/* 🏛️ PAINÉIS & ARCOS COM CAPA (ARCO ROMANO / PAINEL REDONDO) */}
                  {item.type === 'shape' && ['arco_romano', 'painel_redondo'].includes(item.shapeType) && (
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
                      <GuirlandaBaloesRealista 
                        tipo="arco_classico_portal" 
                        cores={item.coresBalao || paletaBalaoAtiva.cores}
                        formatoPortal={item.formatoPortal || 'romano'}
                        estiloPortal={item.estiloPortal || 'espiral'}
                        seed={item.seed}
                      />
                    </div>
                  )}
                  {item.type === 'shape' && item.shapeType === 'baloes_aro_redondo' && (
                    <div className="shape-render-element shape-baloes_geral" style={{ width: '100%', height: '100%' }}>
                      <GuirlandaBaloesRealista 
                        tipo="baloes_aro_redondo" 
                        cores={item.coresBalao || paletaBalaoAtiva.cores}
                        coberturaAro={item.coberturaAro || 'meio_aro'}
                        seed={item.seed}
                      />
                    </div>
                  )}
                  {item.type === 'shape' && item.shapeType === 'baloes_lateral_l' && (
                    <div className="shape-render-element shape-baloes_geral" style={{ width: '100%', height: '100%' }}>
                      <GuirlandaBaloesRealista 
                        tipo="lateral_l" 
                        cores={item.coresBalao || paletaBalaoAtiva.cores}
                        seed={item.seed}
                      />
                    </div>
                  )}
                  {item.type === 'shape' && item.shapeType === 'baloes_cluster_chao' && (
                    <div className="shape-render-element shape-baloes_geral" style={{ width: '100%', height: '100%' }}>
                      <GuirlandaBaloesRealista 
                        tipo="cluster_chao" 
                        cores={item.coresBalao || paletaBalaoAtiva.cores}
                        densidadeCluster={item.densidadeCluster || 'cheio'}
                        seed={item.seed}
                      />
                    </div>
                  )}
                  {item.type === 'shape' && item.shapeType === 'coluna_baloes' && (
                    <div className="shape-render-element shape-baloes_geral" style={{ width: '100%', height: '100%' }}>
                      <GuirlandaBaloesRealista 
                        tipo="coluna_baloes" 
                        cores={item.coresBalao || paletaBalaoAtiva.cores}
                        estiloColuna={item.estiloColuna || 'organica'}
                        seed={item.seed}
                      />
                    </div>
                  )}
                  {item.type === 'shape' && item.shapeType === 'guirlanda_horizontal' && (
                    <div className="shape-render-element shape-baloes_geral" style={{ width: '100%', height: '100%' }}>
                      <GuirlandaBaloesRealista 
                        tipo="guirlanda_horizontal" 
                        cores={item.coresBalao || paletaBalaoAtiva.cores}
                        curvatura={item.curvatura}
                        ondulacao={item.ondulacao}
                        volume={item.volumeBalao}
                        qtdBaloes={item.qtdBaloes}
                        tamanhoBalao={item.tamanhoBalao}
                        seed={item.seed}
                      />
                    </div>
                  )}
                  {/* 🏛️ ESTRUTURAS, MOBILIÁRIO 3D & PAINÉIS */}
                  {item.type === 'shape' && item.shapeType === 'painel_retangular' && (
                    <div className="shape-render-element shape-painel_retangular" style={{ width: '100%', height: '100%', backgroundColor: item.color || '#e2e8f0', borderRadius: '4px' }}>
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
                        </div>
                      ) : <div className="shape-empty-placeholder" />}
                    </div>
                  )}
                  {item.type === 'shape' && item.shapeType === 'painel_hexagonal' && (
                    <div className="shape-render-element shape-painel_hexagonal" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="100%" height="100%" viewBox="0 0 200 230" style={{ pointerEvents: 'none' }}>
                        <polygon points="100,5 195,52 195,148 100,195 5,148 5,52" fill={item.capaUrl ? 'none' : (item.color || '#c5a059')} stroke={item.color || '#c5a059'} strokeWidth="4" />
                        {item.capaUrl && (
                          <image href={item.capaUrl} x="5" y="5" width="190" height="190" clipPath="url(#hexClip)" preserveAspectRatio="xMidYMid slice" />
                        )}
                        <defs><clipPath id="hexClip"><polygon points="100,5 195,52 195,148 100,195 5,148 5,52" /></clipPath></defs>
                      </svg>
                    </div>
                  )}
                  {item.type === 'shape' && item.shapeType === 'meia_lua' && (
                    <div className="shape-render-element" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                      <svg width="100%" height="100%" viewBox="0 0 260 140" style={{ pointerEvents: 'none' }}>
                        <path d="M0,140 A130,130 0 0,1 260,140 Z" fill={item.color || '#e2e8f0'} />
                        {item.capaUrl && <image href={item.capaUrl} x="0" y="0" width="260" height="140" clipPath="url(#meiaLuaClip)" preserveAspectRatio="xMidYMid slice"/>}
                        <defs><clipPath id="meiaLuaClip"><path d="M0,140 A130,130 0 0,1 260,140 Z" /></clipPath></defs>
                      </svg>
                    </div>
                  )}
                  {item.type === 'shape' && item.shapeType === 'arco_duplo' && (
                    <ArcoDuplo3D item={item} />
                  )}
                  {item.type === 'shape' && item.shapeType === 'painel_ripado' && (
                    <PainelRipado3D item={item} />
                  )}
                  {item.type === 'shape' && item.shapeType === 'painel_shimmer' && (
                    <PainelShimmer3D item={item} />
                  )}
                  {item.type === 'shape' && item.shapeType === 'painel_biombo' && (
                    <PainelBiombo3D item={item} />
                  )}
                  {item.type === 'shape' && item.shapeType === 'mesa_retangular' && (
                    <MesaRetangular3D item={item} />
                  )}
                  {item.type === 'shape' && item.shapeType === 'mesa_provencal' && (
                    <MesaProvencal3D item={item} />
                  )}
                  {item.type === 'shape' && item.shapeType === 'mesa_cubo' && (
                    <MesaCuboAramada3D item={item} />
                  )}
                  {item.type === 'shape' && item.shapeType === 'comoda_vintage' && (
                    <ComodaVintage3D item={item} />
                  )}
                  {item.type === 'shape' && item.shapeType === 'carrinho_gourmet' && (
                    <CarrinhoGourmet3D item={item} />
                  )}
                  {item.type === 'shape' && item.shapeType === 'nicho_prateleira' && (
                    <div className="shape-render-element" style={{ width: '100%', height: '100%', backgroundColor: item.color || '#f8fafc', border: `4px solid ${item.color || '#e2e8f0'}`, borderRadius: '6px', display: 'flex', flexDirection: 'column', justifyContent: 'space-around', padding: '8px', boxSizing: 'border-box' }}>
                      {[0,1,2].map(i => <div key={i} style={{ height: '28%', backgroundColor: item.color ? item.color + '55' : '#e2e8f0', borderRadius: '3px', border: `1px solid ${item.color || '#cbd5e1'}` }} />)}
                    </div>
                  )}

                  {/* 🕹️ CONTROLES INTERATIVOS DIRETOS (CANVA/FIGMA STYLE) */}
                  {isSelected && !item.locked && !editingTextId && (() => {
                    const unflipTransform = `scaleX(${item.flipH ? -1 : 1}) scaleY(${item.flipV ? -1 : 1})`;
                    const unflipBar = (item.flipH || item.flipV) ? { transform: `translateX(-50%) ${unflipTransform}` } : undefined;
                    const unflipHandle = (item.flipH || item.flipV) ? { transform: `translate(-50%, -50%) ${unflipTransform}` } : undefined;

                    return (
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
                            style={unflipHandle}
                            onPointerDown={e => handlePointerDown(e, item.uniqueId, item.type, 'rotate')}
                            title="Girar Item"
                          >
                            <Icons.Rotate width={12} height={12} />
                          </div>

                          {/* Tooltip de Grau de Rotação */}
                          {rotacaoTooltip && (
                            <div className="rotation-degree-badge" style={unflipBar}>
                              {rotacaoTooltip}
                            </div>
                          )}

                          {/* Borda de Seleção */}
                          <div className="selection-bounding-box" />

                          {/* 🎈 Alças & Modificadores Rápidos no Canvas (Específicos para cada tipo de arco) */}
                          {['guirlanda_horizontal', 'baloes_dinamico'].includes(item.shapeType) && (
                            <>
                              <div 
                                className="balloon-curve-handle"
                                style={unflipHandle}
                                onPointerDown={e => handlePointerDown(e, item.uniqueId, item.type, 'curve')}
                                title="🎈 Puxe para cima/baixo para curvar o arco"
                              >
                                <span>〰️</span>
                              </div>
                              <div 
                                className="balloon-wave-handle"
                                style={unflipHandle}
                                onPointerDown={e => handlePointerDown(e, item.uniqueId, item.type, 'wave')}
                                title="🌊 Puxe para os lados para ondular o arco"
                              >
                                <span>🌊</span>
                              </div>
                            </>
                          )}

                          {/* 🏛️ Modificador Rápido no Topo do Arco Portal */}
                          {item.shapeType === 'arco_classico_portal' && (
                            <div className="floating-balloon-format-bar" style={unflipBar} onClick={e => e.stopPropagation()}>
                              <button 
                                type="button" 
                                className={`btn-handle-mini ${(item.formatoPortal || 'romano') === 'romano' ? 'active' : ''}`}
                                onClick={() => atualizarItem(item.uniqueId, { formatoPortal: 'romano' })}
                                title="Formato Romano (Arredondado)"
                              >
                                🏛️ Romano
                              </button>
                              <button 
                                type="button" 
                                className={`btn-handle-mini ${item.formatoPortal === 'retangular' ? 'active' : ''}`}
                                onClick={() => atualizarItem(item.uniqueId, { formatoPortal: 'retangular' })}
                                title="Formato Retangular (Quadrado 90°)"
                              >
                                ⬛ Retangular
                              </button>
                              <button 
                                type="button" 
                                className={`btn-handle-mini ${item.formatoPortal === 'circular_fechado' ? 'active' : ''}`}
                                onClick={() => atualizarItem(item.uniqueId, { formatoPortal: 'circular_fechado' })}
                                title="Formato Circular (Fechado 360°)"
                              >
                                ⭕ 360°
                              </button>
                              <button 
                                type="button" 
                                className={`btn-handle-mini ${item.formatoPortal === 'aberto_assimetrico' ? 'active' : ''}`}
                                onClick={() => atualizarItem(item.uniqueId, { formatoPortal: 'aberto_assimetrico' })}
                                title="Formato Aberto / Passarela"
                              >
                                🚪 Aberto
                              </button>
                              <button 
                                type="button" 
                                className="btn-handle-mini"
                                style={{ borderLeft: '1px solid rgba(255,255,255,0.2)', marginLeft: '2px' }}
                                onClick={() => atualizarItem(item.uniqueId, { estiloPortal: (item.estiloPortal === 'organico' ? 'espiral' : 'organico') })}
                                title="Alternar entre Clássico Espiral e Orgânico Desconstruído"
                              >
                                {item.estiloPortal === 'organico' ? '✨ Orgânico' : '🌀 Espiral'}
                              </button>
                            </div>
                          )}

                          {/* ⭕ Modificador Rápido no Topo do Aro Redondo */}
                          {item.shapeType === 'baloes_aro_redondo' && (
                            <div className="floating-balloon-format-bar" style={unflipBar} onClick={e => e.stopPropagation()}>
                              <button 
                                type="button" 
                                className={`btn-handle-mini ${(item.coberturaAro || 'meio_aro') === 'meio_aro' ? 'active' : ''}`}
                                onClick={() => atualizarItem(item.uniqueId, { coberturaAro: 'meio_aro' })}
                                title="Meio Aro (180°)"
                              >
                                🌓 Meio Aro
                              </button>
                              <button 
                                type="button" 
                                className={`btn-handle-mini ${item.coberturaAro === 'tres_quartos' ? 'active' : ''}`}
                                onClick={() => atualizarItem(item.uniqueId, { coberturaAro: 'tres_quartos' })}
                                title="3/4 do Aro (270°)"
                              >
                                🌔 3/4 Aro
                              </button>
                              <button 
                                type="button" 
                                className={`btn-handle-mini ${item.coberturaAro === 'completo' ? 'active' : ''}`}
                                onClick={() => atualizarItem(item.uniqueId, { coberturaAro: 'completo' })}
                                title="Aro Completo 360°"
                              >
                                🌕 360° Fechado
                              </button>
                              <button 
                                type="button" 
                                className={`btn-handle-mini ${item.coberturaAro === 'topo' ? 'active' : ''}`}
                                onClick={() => atualizarItem(item.uniqueId, { coberturaAro: 'topo' })}
                                title="Apenas Topo Arqueado"
                              >
                                🌈 Topo
                              </button>
                            </div>
                          )}

                          {/* 🗼 Modificador Rápido da Coluna de Balões */}
                          {item.shapeType === 'coluna_baloes' && (
                            <div className="floating-balloon-format-bar" style={unflipBar} onClick={e => e.stopPropagation()}>
                              <button 
                                type="button" 
                                className={`btn-handle-mini ${(item.estiloColuna || 'organica') === 'organica' ? 'active' : ''}`}
                                onClick={() => atualizarItem(item.uniqueId, { estiloColuna: 'organica' })}
                                title="Orgânica Desconstruída"
                              >
                                ✨ Orgânica
                              </button>
                              <button 
                                type="button" 
                                className={`btn-handle-mini ${item.estiloColuna === 'espiral' ? 'active' : ''}`}
                                onClick={() => atualizarItem(item.uniqueId, { estiloColuna: 'espiral' })}
                                title="Espiral Clássico"
                              >
                                🌀 Espiral
                              </button>
                              <button 
                                type="button" 
                                className={`btn-handle-mini ${item.estiloColuna === 'com_big_balloon' ? 'active' : ''}`}
                                onClick={() => atualizarItem(item.uniqueId, { estiloColuna: 'com_big_balloon' })}
                                title="Com Big Balloon no Topo"
                              >
                                🎈 Big Balloon
                              </button>
                            </div>
                          )}

                          {/* ⚡ Barra de Ações Rápidas Acoplada ao Objeto (EXCLUSIVA MOBILE / CELULAR) */}
                          {isMobile && (
                            <div className="floating-object-action-bar" style={unflipBar} onClick={e => e.stopPropagation()}>
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
                          )}
                      </>
                    );
                  })()}
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
                        <input type="range" min="0" max="200" value={itemSelecionado.brightness || 100}
                          onChange={e => atualizarItem(selecionadoId, { brightness: Number(e.target.value) })}
                          onDoubleClick={() => atualizarItem(selecionadoId, { brightness: 100 })} />
                      </div>

                      <div className="slider-group" style={{ marginBottom: '6px' }} title="Dê 2 cliques para resetar">
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 'bold' }}>
                          <span>Contraste</span>
                          <span>{itemSelecionado.contrast || 100}%</span>
                        </div>
                        <input type="range" min="0" max="200" value={itemSelecionado.contrast || 100}
                          onChange={e => atualizarItem(selecionadoId, { contrast: Number(e.target.value) })}
                          onDoubleClick={() => atualizarItem(selecionadoId, { contrast: 100 })} />
                      </div>

                      {/* 🌈 SATURAÇÃO (NOVA) */}
                      <div className="slider-group" style={{ marginBottom: '6px' }} title="Dê 2 cliques para resetar">
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 'bold' }}>
                          <span>Saturação</span>
                          <span>{itemSelecionado.saturate || 100}%</span>
                        </div>
                        <input type="range" min="0" max="300" value={itemSelecionado.saturate || 100}
                          onChange={e => atualizarItem(selecionadoId, { saturate: Number(e.target.value) })}
                          onDoubleClick={() => atualizarItem(selecionadoId, { saturate: 100 })} />
                      </div>

                      {/* 🪄 REMOVER FUNDO (IA WASM) */}
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                        <button
                          type="button"
                          className="btn-remove-bg-ia"
                          style={{ flex: 1, margin: 0 }}
                          onClick={() => removerFundoImagem(selecionadoId)}
                          disabled={removendoFundo}
                          title="Remove o fundo da imagem usando IA (WASM, sem custo)"
                        >
                          {removendoFundo ? (
                            <><i className="fas fa-spinner fa-spin" style={{ marginRight: '6px' }} />Processando IA...</>
                          ) : (
                            <>🪄 IA: Remover Fundo</>
                          )}
                        </button>
                        {itemSelecionado.imagemOriginal && (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '6px 10px', fontSize: '10.5px', color: '#0f172a', fontWeight: 'bold', background: '#fff' }}
                            onClick={() => restaurarImagemOriginal(selecionadoId)}
                            title="Restaurar foto original anterior à remoção de fundo"
                          >
                            ↩️ Restaurar
                          </button>
                        )}
                      </div>
                      <p style={{ fontSize: '9.5px', color: '#94a3b8', margin: '0 0 8px 0', lineHeight: 1.4 }}>
                        {itemSelecionado.imagemOriginal 
                          ? '✅ Recorte aplicado. Clique em "Restaurar" se quiser desfazer.' 
                          : 'Funciona offline. Na 1ª vez baixa modelo (~60MB). Pode desfazer com Ctrl+Z.'}
                      </p>
                    </>
                  )}

                  {/* ✍️ SEÇÃO DE EDIÇÃO DE TEXTO & LETREIRO NEON NO INSPECTOR */}
                  {itemSelecionado.type === 'text' && (
                    <div style={{ marginTop: '10px', marginBottom: '10px', padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1.5px solid #c5a059' }}>
                      <div className="inspector-section-title" style={{ marginTop: 0, marginBottom: '6px', color: '#c5a059' }}>
                        ✍️ Conteúdo & Tipografia
                      </div>

                      {/* Input de Texto */}
                      <input 
                        type="text"
                        className="text-input-direct"
                        value={itemSelecionado.content || ''}
                        onChange={e => atualizarItem(selecionadoId, { content: e.target.value })}
                        placeholder="Digite o texto..."
                        style={{ marginBottom: '8px' }}
                      />

                      {/* Seletor de Fonte */}
                      <div style={{ marginBottom: '8px' }}>
                        <select className="font-selector" value={itemSelecionado.fontFamily} onChange={e => atualizarItem(selecionadoId, { fontFamily: e.target.value })}>
                          {fontesDisponiveis.map(f => (
                            <option key={f.nome} value={f.valor} style={{ fontFamily: f.valor }}>
                              {f.nome}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Barra de Formatação (B, I, Alinhamento, Cor) */}
                      <div className="style-controls-row" style={{ marginBottom: '8px' }}>
                        <button 
                          type="button"
                          className={`btn-style ${itemSelecionado.fontWeight === 'bold' ? 'active' : ''}`} 
                          onClick={() => atualizarItem(selecionadoId, { fontWeight: itemSelecionado.fontWeight === 'bold' ? 'normal' : 'bold' })}
                          title="Negrito"
                        >
                          <Icons.Bold />
                        </button>
                        <button 
                          type="button"
                          className={`btn-style ${itemSelecionado.fontStyle === 'italic' ? 'active' : ''}`} 
                          onClick={() => atualizarItem(selecionadoId, { fontStyle: itemSelecionado.fontStyle === 'italic' ? 'normal' : 'italic' })}
                          title="Itálico"
                        >
                          <Icons.Italic />
                        </button>
                        <button 
                          type="button"
                          className={`btn-style ${(itemSelecionado.textAlign || 'center') === 'left' ? 'active' : ''}`} 
                          onClick={() => atualizarItem(selecionadoId, { textAlign: 'left' })}
                        >
                          <i className="fas fa-align-left" />
                        </button>
                        <button 
                          type="button"
                          className={`btn-style ${(itemSelecionado.textAlign || 'center') === 'center' ? 'active' : ''}`} 
                          onClick={() => atualizarItem(selecionadoId, { textAlign: 'center' })}
                        >
                          <i className="fas fa-align-center" />
                        </button>
                        <button 
                          type="button"
                          className={`btn-style ${(itemSelecionado.textAlign || 'center') === 'right' ? 'active' : ''}`} 
                          onClick={() => atualizarItem(selecionadoId, { textAlign: 'right' })}
                        >
                          <i className="fas fa-align-right" />
                        </button>
                        <div className="divider-v" />
                        <label className="color-picker-wrapper" title="Cor do Texto">
                          <input type="color" className="color-input-mini" value={itemSelecionado.color || '#c5a059'} onChange={e => atualizarItem(selecionadoId, { color: e.target.value })} />
                        </label>
                      </div>

                      {/* ✨ MATERIAIS, TEXTURAS REAIS & UPLOAD NO INSPECTOR */}
                      <div style={{ marginBottom: '10px', background: '#f8fafc', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <label style={{ fontSize: '10.5px', fontWeight: '800', color: '#334155', textTransform: 'uppercase', margin: 0 }}>
                            🪞 Textura / Material da Letra:
                          </label>
                        </div>

                        {/* Botão Upload de Textura para o Texto */}
                        <button
                          type="button"
                          onClick={() => handleUploadTexturaTexto(selecionadoId)}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            background: '#0f172a',
                            color: '#fef08a',
                            border: '1px solid rgba(234, 179, 8, 0.4)',
                            borderRadius: '6px',
                            fontSize: '10.5px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            marginBottom: '8px'
                          }}
                        >
                          <span>📤</span>
                          <span>Upload de Foto/Textura no Texto</span>
                        </button>

                        {/* Swatches Visuais de Materiais de Festa */}
                        <div className="texture-swatches-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                          {[
                            { id: 'none', nome: 'Cor Sólida', tipo: 'cor', thumb: null, bg: itemSelecionado.color || '#c5a059' },
                            { id: 'gold_mirror', nome: 'Ouro Espelho', tipo: 'grad', thumb: null, bg: 'linear-gradient(135deg, #bf953f 0%, #fcf6ba 30%, #b38728 55%, #aa771c 100%)' },
                            { id: 'rose_gold', nome: 'Rose Gold', tipo: 'grad', thumb: null, bg: 'linear-gradient(135deg, #b76e79 0%, #ffd1dc 30%, #e0a9af 55%, #9c4f5a 100%)' },
                            { id: 'silver_mirror', nome: 'Prata Espelho', tipo: 'grad', thumb: null, bg: 'linear-gradient(135deg, #8a8a8a 0%, #ffffff 30%, #a6a6a6 55%, #737373 100%)' },
                            { id: 'mdf_wood', nome: 'MDF Madeira', tipo: 'pat', thumb: null, bg: 'repeating-linear-gradient(45deg, #d29b62, #d29b62 6px, #ba8249 6px, #ba8249 12px)' },
                            { id: 'glitter_gold', nome: 'Glitter Dourado', tipo: 'grad', thumb: null, bg: 'radial-gradient(circle at 50% 50%, #fff7cc 10%, #d4af37 40%, #996515 80%, #ffd700 100%)' },
                            { id: 'backlight_halo', nome: 'Letreiro Neon', tipo: 'neon', thumb: null, bg: '#0f172a' },
                            ...(elementosCenografia || [])
                              .filter(e => e.categoria === 'Texturas' && (e.isGlobal || e.empresaId === tenantId))
                              .map(e => ({ id: `admin_${e.id}`, nome: e.nome, url: e.imagemUrl, thumb: e.imagemUrl }))
                          ].map(mat => {
                            const isMatActive = mat.url 
                              ? (itemSelecionado.textureUrl === mat.url) 
                              : ((itemSelecionado.material || 'none') === mat.id && !itemSelecionado.textureUrl);

                            return (
                              <div
                                key={mat.id}
                                className={`texture-swatch-card ${isMatActive ? 'active' : ''}`}
                                onClick={() => {
                                  if (mat.url) {
                                    atualizarItem(selecionadoId, { material: 'custom_texture', textureUrl: mat.url, textureScale: itemSelecionado.textureScale || 100 });
                                  } else {
                                    atualizarItem(selecionadoId, { material: mat.id, textureUrl: '' });
                                  }
                                }}
                                title={mat.nome}
                              >
                                <div 
                                  className="texture-swatch-thumb" 
                                  style={mat.thumb ? { backgroundImage: `url("${mat.thumb}")` } : { background: mat.bg }}
                                >
                                  {mat.tipo === 'cor' && <span style={{ fontSize: '11px' }}>🎨</span>}
                                  {mat.tipo === 'neon' && <span style={{ fontSize: '12px', filter: 'drop-shadow(0 0 4px #ec4899)' }}>💡</span>}
                                  {isMatActive && (
                                    <div style={{ position: 'absolute', top: '2px', right: '2px', background: '#c5a059', color: '#fff', borderRadius: '50%', width: '13px', height: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8.5px', fontWeight: 'bold', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
                                      ✓
                                    </div>
                                  )}
                                </div>
                                <span className="texture-swatch-name">{mat.nome}</span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Slider de Escala da Textura (quando houver textura ativa) */}
                        {(itemSelecionado.material === 'custom_texture' || !!itemSelecionado.textureUrl) && (
                          <div className="slider-group" style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed #cbd5e1' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 'bold' }}>
                              <span>🔍 Zoom da Textura no Texto</span>
                              <span>{itemSelecionado.textureScale || 100}%</span>
                            </div>
                            <input 
                              type="range" min="30" max="300" value={itemSelecionado.textureScale || 100} 
                              onChange={e => atualizarItem(selecionadoId, { textureScale: Number(e.target.value) })} 
                              onDoubleClick={() => atualizarItem(selecionadoId, { textureScale: 100 })}
                              style={{ width: '100%', accentColor: '#c5a059', cursor: 'pointer' }}
                            />
                          </div>
                        )}
                      </div>

                      {/* 🌈 TEXTO CURVADO / ARQUEADO NO INSPECTOR */}
                      <div className="slider-group" style={{ marginBottom: '6px' }} title="Dê 2 cliques para resetar">
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 'bold' }}>
                          <span>🌈 Curvatura do Arco</span>
                          <span>{itemSelecionado.curvatura || 0}%</span>
                        </div>
                        <input 
                          type="range" min="-100" max="100" value={itemSelecionado.curvatura || 0} 
                          onChange={e => atualizarItem(selecionadoId, { curvatura: Number(e.target.value) })} 
                          onDoubleClick={() => atualizarItem(selecionadoId, { curvatura: 0 })}
                        />
                      </div>

                      {/* 🎨 CONTORNO / BORDA EXTERNA NO INSPECTOR */}
                      <div style={{ background: '#f1f5f9', padding: '6px 8px', borderRadius: '6px', marginBottom: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#334155' }}>🎨 Contorno / Borda</span>
                          <input type="color" className="color-input-mini" style={{ width: '18px', height: '18px' }} value={itemSelecionado.strokeColor || '#ffffff'} onChange={e => atualizarItem(selecionadoId, { strokeColor: e.target.value })} />
                        </div>
                        <input 
                          type="range" min="0" max="12" value={itemSelecionado.strokeWidth || 0} 
                          onChange={e => atualizarItem(selecionadoId, { strokeWidth: Number(e.target.value) })} 
                          onDoubleClick={() => atualizarItem(selecionadoId, { strokeWidth: 0 })}
                        />
                      </div>

                      {/* 🏷️ PLACA / SUPORTE DE FUNDO NO INSPECTOR */}
                      <div style={{ marginBottom: '8px' }}>
                        <label style={{ fontSize: '10.5px', fontWeight: '800', color: '#475569', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                          🏷️ Placa de Fundo:
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                          {[
                            { id: 'nenhuma', label: 'Nenhuma' },
                            { id: 'acrilico_redondo', label: '🔘 Redonda' },
                            { id: 'acrilico_arco', label: '🏛️ Arco' },
                            { id: 'acrilico_retangular', label: '⬛ Retang.' },
                            { id: 'flamula_tecido', label: '📜 Flâmula' },
                            { id: 'cavalete_madeira', label: '🖼️ Cavalete' }
                          ].map(p => (
                            <button
                              key={p.id}
                              type="button"
                              className={`btn-mat-choice ${(itemSelecionado.placaFundo || 'nenhuma') === p.id ? 'active' : ''}`}
                              onClick={() => atualizarItem(selecionadoId, { placaFundo: p.id })}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Controle Avançado de Tamanho da Fonte */}
                      <div className="slider-group" style={{ marginBottom: '8px', background: '#ffffff', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '800', color: '#1e293b' }}>🔤 Tamanho da Fonte</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              type="button"
                              onClick={() => atualizarItem(selecionadoId, { fontSize: Math.max(12, Number(itemSelecionado.fontSize || 48) - 4) })}
                              style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}
                              title="Diminuir Fonte (-4px)"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="12"
                              max="250"
                              value={itemSelecionado.fontSize || 48}
                              onChange={e => atualizarItem(selecionadoId, { fontSize: Math.max(12, Math.min(250, Number(e.target.value) || 12)) })}
                              style={{ width: '46px', height: '24px', textAlign: 'center', fontSize: '11px', fontWeight: 'bold', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '0 2px' }}
                            />
                            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>px</span>
                            <button
                              type="button"
                              onClick={() => atualizarItem(selecionadoId, { fontSize: Math.min(250, Number(itemSelecionado.fontSize || 48) + 4) })}
                              style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#f8fafc', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' }}
                              title="Aumentar Fonte (+4px)"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <input 
                          type="range" min="12" max="220" value={itemSelecionado.fontSize || 48} 
                          onChange={e => atualizarItem(selecionadoId, { fontSize: Number(e.target.value) })} 
                          onDoubleClick={() => atualizarItem(selecionadoId, { fontSize: 48 })}
                          style={{ width: '100%', accentColor: '#c5a059', cursor: 'pointer' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', gap: '4px' }}>
                          {[
                            { label: 'P (32)', val: 32 },
                            { label: 'M (48)', val: 48 },
                            { label: 'G (68)', val: 68 },
                            { label: 'GG (96)', val: 96 },
                            { label: 'XG (130)', val: 130 }
                          ].map(pill => (
                            <button
                              key={pill.val}
                              type="button"
                              onClick={() => atualizarItem(selecionadoId, { fontSize: pill.val })}
                              style={{
                                flex: 1, padding: '3px 0', fontSize: '9.5px', fontWeight: '700', borderRadius: '4px',
                                border: (itemSelecionado.fontSize === pill.val) ? '1px solid #c5a059' : '1px solid #e2e8f0',
                                background: (itemSelecionado.fontSize === pill.val) ? '#fef3c7' : '#f8fafc',
                                color: (itemSelecionado.fontSize === pill.val) ? '#92400e' : '#475569',
                                cursor: 'pointer'
                              }}
                            >
                              {pill.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Slider de Letter Spacing */}
                      <div className="slider-group" style={{ marginBottom: '8px' }} title="Dê 2 cliques para resetar">
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 'bold' }}>
                          <span>Espaçamento de Letras</span>
                          <span>{itemSelecionado.letterSpacing || 0}px</span>
                        </div>
                        <input 
                          type="range" min="-2" max="20" value={itemSelecionado.letterSpacing || 0} 
                          onChange={e => atualizarItem(selecionadoId, { letterSpacing: Number(e.target.value) })} 
                          onDoubleClick={() => atualizarItem(selecionadoId, { letterSpacing: 0 })}
                        />
                      </div>

                      {/* Painel Neon LED */}
                      <div style={{ background: '#0f172a', padding: '8px 10px', borderRadius: '6px', border: '1px solid rgba(197, 160, 89, 0.3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ color: '#c5a059', fontWeight: 'bold', fontSize: '10.5px' }}>🌟 Neon LED</span>
                          <button
                            type="button"
                            onClick={() => atualizarItem(selecionadoId, { neonGlow: (itemSelecionado.neonGlow > 0 ? 0 : 20) })}
                            style={{
                              fontSize: '9.5px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px',
                              border: 'none', background: itemSelecionado.neonGlow > 0 ? '#22c55e' : '#334155', color: '#fff', cursor: 'pointer'
                            }}
                          >
                            {itemSelecionado.neonGlow > 0 ? 'ON' : 'OFF'}
                          </button>
                        </div>
                        <div className="neon-light-palette" style={{ marginTop: '4px' }}>
                          {['#eab308', '#ec4899', '#38bdf8', '#fef08a', '#a855f7', '#22c55e', '#ef4444'].map(cor => (
                            <button
                              key={cor}
                              type="button"
                              className={`neon-dot-btn ${(itemSelecionado.neonColor || '#c5a059') === cor ? 'active' : ''}`}
                              style={{ backgroundColor: cor, width: '18px', height: '18px' }}
                              onClick={() => atualizarItem(selecionadoId, { neonColor: cor, neonGlow: Math.max(16, itemSelecionado.neonGlow || 20) })}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 🌿 CONTROLES DO ENFEITE / APLIQUE DE FESTA NO INSPECTOR */}
                  {itemSelecionado.type === 'ornament' && (
                    <div className="inspector-group" style={{ marginBottom: '12px', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div className="inspector-section-title" style={{ marginTop: 0, marginBottom: '6px' }}>✨ Material & Acabamento</div>
                      
                      <div className="materials-selector-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px', marginBottom: '8px' }}>
                        {[
                          { id: 'gold_mirror', label: '✨ Ouro Espelho' },
                          { id: 'rose_gold', label: '🌸 Rose Gold' },
                          { id: 'silver_mirror', label: '🥈 Prata' },
                          { id: 'mdf_wood', label: '🪵 MDF Madeira' },
                          { id: 'none', label: '🎨 Cor Própria' }
                        ].map(mat => (
                          <button
                            key={mat.id}
                            type="button"
                            className={`btn-mat-choice ${(itemSelecionado.material || 'gold_mirror') === mat.id ? 'active' : ''}`}
                            onClick={() => atualizarItem(selecionadoId, { material: mat.id })}
                            style={{ padding: '6px', fontSize: '10px' }}
                          >
                            {mat.label}
                          </button>
                        ))}
                      </div>

                      {/* Cor personalizada se material for none */}
                      {itemSelecionado.material === 'none' && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', padding: '4px 6px', background: '#ffffff', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                          <span style={{ fontSize: '10.5px', fontWeight: 'bold', color: '#334155' }}>Cor do Enfeite</span>
                          <input 
                            type="color" 
                            value={itemSelecionado.color || '#c5a059'} 
                            onChange={e => atualizarItem(selecionadoId, { color: e.target.value })}
                            style={{ width: '28px', height: '22px', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
                          />
                        </div>
                      )}

                      {/* Slider de Tamanho */}
                      <div className="slider-group" style={{ marginBottom: '6px' }} title="Dê 2 cliques para resetar">
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 'bold' }}>
                          <span>Tamanho</span>
                          <span>{itemSelecionado.width || 100}px</span>
                        </div>
                        <input 
                          type="range" min="30" max="300" 
                          value={itemSelecionado.width || 100}
                          onChange={e => {
                            const sz = Number(e.target.value);
                            atualizarItem(selecionadoId, { width: sz, height: sz });
                          }}
                          onDoubleClick={() => atualizarItem(selecionadoId, { width: 100, height: 100 })}
                        />
                      </div>
                    </div>
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

                  {/* 3. Se for Estrutura / Cilindro / Mesa: Capa Sublimada, Tampo & Enquadramento */}
                  {isEstruturaSelecionada && (
                    <div className="inspector-capa-section" style={{ marginTop: '10px', padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div className="inspector-section-title" style={{ marginTop: 0, marginBottom: '6px' }}>🎨 Capa de Tecido Sublimado</div>
                      
                      <div style={{ display: 'flex', gap: '6px', marginBottom: itemSelecionado.capaUrl ? '8px' : '0' }}>
                        <button 
                          type="button"
                          className="btn-upload-capa" 
                          style={{ flex: 1, fontSize: '11px', padding: '7px 10px', margin: 0 }}
                          onClick={() => handleUploadCapaEstrutura(selecionadoId)}
                        >
                          <Icons.Image width={13} height={13} /> {itemSelecionado.capaUrl ? '🔄 Trocar Imagem / Capa' : '📷 Inserir Foto / Capa'}
                        </button>
                        {itemSelecionado.capaUrl && (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '7px 10px', fontSize: '11px', color: '#dc2626', borderColor: '#fca5a5', background: '#fff' }}
                            onClick={() => aplicarCapaNaEstrutura(selecionadoId, '')}
                            title="Remover Capa"
                          >
                            ✕ Remover
                          </button>
                        )}
                      </div>

                      {/* 🔘 Acabamento e Cor do Tampo (Cilindros e Mesas) */}
                      {(itemSelecionado.shapeType?.includes('cilindro') || itemSelecionado.shapeType?.includes('mesa')) && (
                        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#334155' }}>🔘 Tampo Superior:</span>
                            <span style={{ fontSize: '9.5px', color: '#64748b' }}>
                              {itemSelecionado.tampoTipo === 'liso' ? 'Cor Fixa' : 'Contínuo com Capa'}
                            </span>
                          </div>

                          <div className="tampo-type-toggle" style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                            <button 
                              type="button"
                              className={`btn-tampo-type ${itemSelecionado.tampoTipo !== 'liso' ? 'active' : ''}`}
                              onClick={() => atualizarItem(selecionadoId, { tampoTipo: 'continua' })}
                              style={{ flex: 1, padding: '5px', fontSize: '10px' }}
                            >
                              🔄 Estampa da Capa
                            </button>
                            <button 
                              type="button"
                              className={`btn-tampo-type ${itemSelecionado.tampoTipo === 'liso' ? 'active' : ''}`}
                              onClick={() => atualizarItem(selecionadoId, { tampoTipo: 'liso', tampoCor: itemSelecionado.tampoCor || '#ffffff' })}
                              style={{ flex: 1, padding: '5px', fontSize: '10px' }}
                            >
                              🎨 Cor do Tampo
                            </button>
                          </div>

                          {/* Seletor de Cores do Tampo quando Liso/Fixo */}
                          {itemSelecionado.tampoTipo === 'liso' && (
                            <div style={{ background: '#ffffff', padding: '6px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '6px' }}>
                              <div style={{ fontSize: '9.5px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>Escolha a Cor da Tampa:</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                {[
                                  { label: 'Branco', cor: '#ffffff' },
                                  { label: 'Madeira Pinus', cor: '#d29b62' },
                                  { label: 'Ouro', cor: '#c5a059' },
                                  { label: 'Rose Gold', cor: '#b76e79' },
                                  { label: 'Preto', cor: '#1e293b' },
                                  { label: 'Off-White', cor: '#f8fafc' }
                                ].map(c => (
                                  <div
                                    key={c.cor}
                                    onClick={() => atualizarItem(selecionadoId, { tampoCor: c.cor })}
                                    title={`Tampo ${c.label}`}
                                    style={{
                                      width: '20px',
                                      height: '20px',
                                      borderRadius: '50%',
                                      backgroundColor: c.cor,
                                      border: (itemSelecionado.tampoCor === c.cor) ? '2px solid #0f172a' : '1px solid #cbd5e1',
                                      boxShadow: (itemSelecionado.tampoCor === c.cor) ? '0 0 0 2px #c5a059' : 'none',
                                      cursor: 'pointer'
                                    }}
                                  />
                                ))}
                                <label title="Cor personalizada da tampa" style={{ position: 'relative', width: '20px', height: '20px', borderRadius: '50%', border: '1.5px dashed #c5a059', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}>
                                  <span style={{ fontSize: '9px' }}>🎨</span>
                                  <input 
                                    type="color" 
                                    value={itemSelecionado.tampoCor || '#ffffff'} 
                                    onChange={e => atualizarItem(selecionadoId, { tampoCor: e.target.value })} 
                                    style={{ position: 'absolute', top: '-10px', left: '-10px', width: '200%', height: '200%', opacity: 0, cursor: 'pointer' }}
                                  />
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 🖐️ MOVIMENTAÇÃO, ZOOM & ENQUADRAMENTO DA CAPA */}
                      {itemSelecionado.capaUrl && (
                        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#0f172a' }}>🖐️ Ajuste & Enquadramento da Imagem:</span>
                            <button
                              type="button"
                              onClick={() => atualizarItem(selecionadoId, { capaPosX: 50, capaPosY: 50, capaScale: 1 })}
                              style={{ fontSize: '9.5px', fontWeight: '700', color: '#c5a059', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                              title="Restaurar posição original"
                            >
                              🎯 Centralizar
                            </button>
                          </div>

                          {/* 1. Zoom / Escala da Capa */}
                          <div className="slider-group" style={{ marginBottom: '6px' }} title="Dê 2 cliques para resetar em 100%">
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 'bold' }}>
                              <span>🔍 Zoom da Capa</span>
                              <span>{Math.round((itemSelecionado.capaScale || 1) * 100)}%</span>
                            </div>
                            <input 
                              type="range" min="50" max="300" 
                              value={Math.round((itemSelecionado.capaScale || 1) * 100)}
                              onChange={e => atualizarItem(selecionadoId, { capaScale: Number(e.target.value) / 100 })}
                              onDoubleClick={() => atualizarItem(selecionadoId, { capaScale: 1 })}
                              style={{ width: '100%', accentColor: '#c5a059', cursor: 'pointer' }}
                            />
                          </div>

                          {/* 2. Posição Horizontal X */}
                          <div className="slider-group" style={{ marginBottom: '6px' }} title="Dê 2 cliques para centralizar">
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 'bold' }}>
                              <span>↔️ Mover Horizontal (X)</span>
                              <span>{itemSelecionado.capaPosX ?? 50}%</span>
                            </div>
                            <input 
                              type="range" min="0" max="100" 
                              value={itemSelecionado.capaPosX ?? 50}
                              onChange={e => atualizarItem(selecionadoId, { capaPosX: Number(e.target.value) })}
                              onDoubleClick={() => atualizarItem(selecionadoId, { capaPosX: 50 })}
                              style={{ width: '100%', accentColor: '#c5a059', cursor: 'pointer' }}
                            />
                          </div>

                          {/* 3. Posição Vertical Y */}
                          <div className="slider-group" style={{ marginBottom: '4px' }} title="Dê 2 cliques para centralizar">
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 'bold' }}>
                              <span>↕️ Mover Vertical (Y)</span>
                              <span>{itemSelecionado.capaPosY ?? 50}%</span>
                            </div>
                            <input 
                              type="range" min="0" max="100" 
                              value={itemSelecionado.capaPosY ?? 50}
                              onChange={e => atualizarItem(selecionadoId, { capaPosY: Number(e.target.value) })}
                              onDoubleClick={() => atualizarItem(selecionadoId, { capaPosY: 50 })}
                              style={{ width: '100%', accentColor: '#c5a059', cursor: 'pointer' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 🎈 Se for Balão / Guirlanda: Cores e Paletas */}
                  {isBalaoSelecionado && (
                    <div className="inspector-balao-section" style={{ marginTop: '10px', padding: '10px', background: '#fdfbf7', borderRadius: '8px', border: '1px solid #fde68a' }}>
                      <div className="inspector-section-title" style={{ marginTop: 0, marginBottom: '6px', color: '#92400e' }}>
                        🎈 Cores dos Balões da Guirlanda
                      </div>

                      {/* 5 Cores Individuais com Input Color */}
                      <div style={{ fontSize: '10px', fontWeight: '700', color: '#78350f', marginBottom: '6px' }}>
                        Personalizar Cores das Bexigas (1 a 5):
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                        {(itemSelecionado.coresBalao || paletaBalaoAtiva.cores).map((cor, idx) => (
                          <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flex: 1 }}>
                            <input
                              type="color"
                              value={cor}
                              onChange={(e) => {
                                const novasCores = [...(itemSelecionado.coresBalao || paletaBalaoAtiva.cores)];
                                novasCores[idx] = e.target.value;
                                atualizarItem(selecionadoId, { coresBalao: novasCores });
                              }}
                              style={{ width: '100%', height: '26px', border: '1.5px solid #d97706', borderRadius: '4px', cursor: 'pointer', padding: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
                              title={`Cor da Bexiga #${idx + 1}`}
                            />
                            <span style={{ fontSize: '8.5px', fontWeight: '800', color: '#92400e' }}>#{idx + 1}</span>
                          </div>
                        ))}
                      </div>

                      {/* Paletas Prontas Rápidas */}
                      <div style={{ fontSize: '10px', fontWeight: '700', color: '#78350f', marginBottom: '5px' }}>
                        Trocar Paleta da Guirlanda:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '130px', overflowY: 'auto' }}>
                        {PALETAS_BALOES.map((pal, pIdx) => (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={() => {
                              setPaletaBalaoAtiva(pal);
                              atualizarItem(selecionadoId, { coresBalao: pal.cores });
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '5px 8px',
                              borderRadius: '6px',
                              background: '#ffffff',
                              border: '1px solid #fde68a',
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                          >
                            <span style={{ fontSize: '10px', fontWeight: '700', color: '#1e293b' }}>{pal.nome}</span>
                            <div style={{ display: 'flex', gap: '3px' }}>
                              {pal.cores.map((c, i) => (
                                <div key={i} style={{ width: '12px', height: '12px', borderRadius: '50%', background: c, border: '1px solid rgba(0,0,0,0.15)' }} />
                              ))}
                            </div>
                          </button>
                        ))}
                      </div>

                      {/* 🎲 EMBARALHAR CORES DOS BALÕES */}
                      <button 
                        type="button" 
                        className="btn-inspector-action"
                        style={{ width: '100%', marginTop: '8px', padding: '7px', fontSize: '10.5px', fontWeight: '700', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                        onClick={() => atualizarItem(selecionadoId, { seed: (itemSelecionado.seed || 0) + 1 })}
                        title="Embaralhar as cores nas bexigas"
                      >
                        <span>🎲</span>
                        <span>Embaralhar Ordem das Cores</span>
                      </button>

                      {/* AJUSTES ADICIONAIS PARA CLUSTER DE CHÃO */}
                      {itemSelecionado.shapeType === 'baloes_cluster_chao' && (
                        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #fde68a' }}>
                          <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#92400e', marginBottom: '6px' }}>
                            🫧 Densidade de Bexigas do Cluster
                          </div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {[
                              { id: 'suave', label: 'Suave' },
                              { id: 'cheio', label: 'Cheio' },
                              { id: 'luxo', label: 'Mega Luxo' }
                            ].map(d => (
                              <button
                                key={d.id}
                                type="button"
                                className={`btn-tampo-type ${(itemSelecionado.densidadeCluster || 'cheio') === d.id ? 'active' : ''}`}
                                onClick={() => atualizarItem(selecionadoId, { densidadeCluster: d.id })}
                                style={{ flex: 1, padding: '5px', fontSize: '9.5px' }}
                              >
                                {d.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 4. Ações Rápidas de Alinhamento & Camada */}
                  <div className="inspector-section-title" style={{ marginTop: '10px' }}>Ações Rápidas</div>
                  <div className="inspector-actions-grid">
                    <button type="button" className="btn-inspector-action" onClick={() => atualizarItem(selecionadoId, { flipH: !itemSelecionado.flipH })} title="Espelhar Horizontalmente">
                      <Icons.Flip width={12} /> Flip H
                    </button>
                    <button type="button" className="btn-inspector-action" onClick={() => atualizarItem(selecionadoId, { flipV: !itemSelecionado.flipV })} title="Espelhar Verticalmente">
                      <Icons.Flip width={12} style={{ transform: 'rotate(90deg)' }} /> Flip V
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
                    <button type="button" className="btn-inspector-action" style={{ gridColumn: '1 / -1', color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2' }} onClick={() => deleteItem(selecionadoId)} title="Excluir Elemento">
                      <Icons.Trash width={12} /> Excluir Elemento
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

      {/* 📸 MODAL: UPLOAD RÁPIDO DE IMAGEM — ADICIONA AO CANVAS + OPÇÃO DE PORTFÓLIO */}
      {modalUploadRapidoAberto && imagemRapidaBase64 && (
        <div className="overlay" style={{ zIndex: 99999 }} onClick={() => setModalUploadRapidoAberto(false)}>
          <div className="modal-content luxury-modal upload-rapido-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header-luxury">
              <h3>📸 Imagem Pronta para o Canvas</h3>
              <p>Revise antes de adicionar ao cenário. Você pode remover o fundo automaticamente.</p>
            </div>
            <div className="modal-body-luxury">

              {/* Preview da Imagem */}
              <div className="elem-preview-checkerboard" style={{ marginBottom: '14px', height: '180px' }}>
                <img src={imagemRapidaBase64} alt="Preview" style={{ maxHeight: '160px', maxWidth: '100%', objectFit: 'contain' }} />
              </div>

              <label style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', display: 'block', marginBottom: '4px' }}>Nome:</label>
              <input
                type="text"
                value={imagemRapidaNome}
                onChange={e => setImagemRapidaNome(e.target.value)}
                className="input-modal-luxury"
                placeholder="Nome da imagem no cenário..."
                style={{ marginBottom: '12px' }}
              />

              <label style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', display: 'block', marginBottom: '4px' }}>Categoria:</label>
              <select
                value={categoriaImagemRapida}
                onChange={e => setCategoriaImagemRapida(e.target.value)}
                className="input-modal-luxury"
                style={{ marginBottom: '14px' }}
              >
                {['Baloes','Paineis','Flores','Moveis','Letreiros','Outros'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              {/* Opção: salvar no portfólio */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', cursor: 'pointer', marginBottom: '14px' }}>
                <input type="checkbox" checked={salvarNoPortfolio} onChange={e => setSalvarNoPortfolio(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>💾 Salvar também no Meu Portfólio</div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>Fica disponível para reusar em outros projetos</div>
                </div>
              </label>
            </div>

            <div className="modal-actions" style={{ flexDirection: 'column', gap: '8px' }}>
              {/* Botão com Remoção de Fundo */}
              <button
                className="btn-confirm-luxury"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #c5a059)', gap: '8px', fontSize: '13px' }}
                onClick={() => confirmarUploadRapido(true)}
                disabled={removendoFundo}
              >
                {removendoFundo ? (
                  <><i className="fas fa-spinner fa-spin" /> Removendo Fundo (IA)...</>
                ) : (
                  <>🪄 Remover Fundo e Adicionar ao Cenário</>
                )}
              </button>
              {/* Botão Sem Remoção de Fundo */}
              <button
                className="btn-primary-action"
                style={{ marginBottom: 0 }}
                onClick={() => confirmarUploadRapido(false)}
                disabled={removendoFundo}
              >
                📸 Adicionar Sem Remover Fundo
              </button>
              <button className="btn-cancel" onClick={() => setModalUploadRapidoAberto(false)} disabled={removendoFundo}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⌨️ MODAL: GUIA DE ATALHOS DE TECLADO */}
      {modalAtalhosAberto && (
        <div className="modal-atalhos-backdrop" onClick={() => setModalAtalhosAberto(false)}>
          <div className="modal-atalhos-card" onClick={e => e.stopPropagation()}>
            <div className="modal-atalhos-header">
              <h3>⌨️ Atalhos de Produtividade do Studio</h3>
              <button 
                type="button" 
                onClick={() => setModalAtalhosAberto(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-atalhos-grid">
              <div className="atalho-item-card">
                <span className="atalho-desc">Desfazer ação</span>
                <div className="atalho-keys-wrap">
                  <span className="atalho-key">Ctrl</span>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>+</span>
                  <span className="atalho-key">Z</span>
                </div>
              </div>

              <div className="atalho-item-card">
                <span className="atalho-desc">Refazer ação</span>
                <div className="atalho-keys-wrap">
                  <span className="atalho-key">Ctrl</span>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>+</span>
                  <span className="atalho-key">Y</span>
                </div>
              </div>

              <div className="atalho-item-card">
                <span className="atalho-desc">Duplicar peça selecionada</span>
                <div className="atalho-keys-wrap">
                  <span className="atalho-key">Ctrl</span>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>+</span>
                  <span className="atalho-key">D</span>
                </div>
              </div>

              <div className="atalho-item-card">
                <span className="atalho-desc">Excluir peça</span>
                <div className="atalho-keys-wrap">
                  <span className="atalho-key">Del</span>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>/</span>
                  <span className="atalho-key">Backspace</span>
                </div>
              </div>

              <div className="atalho-item-card">
                <span className="atalho-desc">Travar / Destravar peça</span>
                <div className="atalho-keys-wrap">
                  <span className="atalho-key">Ctrl</span>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>+</span>
                  <span className="atalho-key">G</span>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>ou</span>
                  <span className="atalho-key">L</span>
                </div>
              </div>

              <div className="atalho-item-card">
                <span className="atalho-desc">Espelhar horizontal (Flip H)</span>
                <div className="atalho-keys-wrap">
                  <span className="atalho-key">H</span>
                </div>
              </div>

              <div className="atalho-item-card">
                <span className="atalho-desc">Espelhar vertical (Flip V)</span>
                <div className="atalho-keys-wrap">
                  <span className="atalho-key">V</span>
                </div>
              </div>

              <div className="atalho-item-card">
                <span className="atalho-desc">Enviar para trás / frente</span>
                <div className="atalho-keys-wrap">
                  <span className="atalho-key">[</span>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>ou</span>
                  <span className="atalho-key">]</span>
                </div>
              </div>

              <div className="atalho-item-card">
                <span className="atalho-desc">Mover peça (Passo fino 2px)</span>
                <div className="atalho-keys-wrap">
                  <span className="atalho-key">↑</span>
                  <span className="atalho-key">↓</span>
                  <span className="atalho-key">←</span>
                  <span className="atalho-key">→</span>
                </div>
              </div>

              <div className="atalho-item-card">
                <span className="atalho-desc">Mover rápido (Passo 10px)</span>
                <div className="atalho-keys-wrap">
                  <span className="atalho-key">Shift</span>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>+</span>
                  <span className="atalho-key">Setas</span>
                </div>
              </div>

              <div className="atalho-item-card">
                <span className="atalho-desc">Aumentar / Diminuir Zoom</span>
                <div className="atalho-keys-wrap">
                  <span className="atalho-key">Ctrl</span>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>+</span>
                  <span className="atalho-key">+</span>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>/</span>
                  <span className="atalho-key">-</span>
                </div>
              </div>

              <div className="atalho-item-card">
                <span className="atalho-desc">Desmarcar / Fechar</span>
                <div className="atalho-keys-wrap">
                  <span className="atalho-key">Esc</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>
              💡 <strong>Dica Pro:</strong> Dê duplo clique em qualquer painel com capa ou cilindro para ajustar o enquadramento do tecido com o mouse!
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Moodboard;