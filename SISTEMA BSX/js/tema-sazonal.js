// ===== TEMA SAZONAL - NATAL 2025 =====
// Para desativar: remova este arquivo do HTML ou mude TEMA_ATIVO para null
// Para trocar: mude TEMA_ATIVO para 'carnaval', 'pascoa', etc.

(function() {
  'use strict';
  
  // ========================================
  // CONFIGURAÇÃO - MUDE AQUI PARA TROCAR TEMA
  // ========================================
  const TEMA_ATIVO = 'natal'; // Opções: 'natal', 'carnaval', 'pascoa', 'junino', null (desativado)
  
  // Se tema desativado, não faz nada
  if (!TEMA_ATIVO) {
    console.log('[Tema] Desativado');
    return;
  }
  
  // ========================================
  // DEFINIÇÃO DOS TEMAS
  // ========================================
  const TEMAS = {
    
    // ===== NATAL =====
    natal: {
      nome: 'Natal 2025',
      emoji: '🎄',
      cores: {
        primaria: '#c41e3a',      // Vermelho natalino
        secundaria: '#165b33',     // Verde
        accent: '#f8b229',         // Dourado
        neve: '#ffffff'
      },
      css: `
        /* ===== DECORAÇÕES DE NATAL ===== */
        
        /* Luzes de Natal no topo */
        body::before {
          content: '🎄 ⭐ 🎁 ❄️ 🔔 ⭐ 🎄 ❄️ 🎁 ⭐ 🔔 🎄 ❄️ ⭐ 🎁 🔔 🎄';
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 30px;
          background: linear-gradient(90deg, #c41e3a, #165b33, #c41e3a, #165b33);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          letter-spacing: 8px;
          z-index: 9999;
          animation: luzes-piscar 2s ease-in-out infinite;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
        
        @keyframes luzes-piscar {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        /* Ajusta o body para não ficar atrás da barra */
        body {
          padding-top: 30px !important;
        }
        
        /* Flocos de neve caindo */
        .floco-neve {
          position: fixed;
          top: -20px;
          color: #fff;
          font-size: 20px;
          pointer-events: none;
          z-index: 9998;
          animation: cair-neve linear infinite;
          text-shadow: 0 0 5px rgba(255,255,255,0.8);
        }
        
        @keyframes cair-neve {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0.3;
          }
        }
        
        /* Sidebar com tema natalino */
        .sidebar, 
        [class*="sidebar"],
        nav[class*="dark"] {
          background: linear-gradient(180deg, #1a1a2e 0%, #0d1520 50%, #1a0a0a 100%) !important;
          border-right: 3px solid #c41e3a !important;
        }
        
        /* Logo com efeito natalino */
        .sidebar-logo,
        [class*="logo"] {
          text-shadow: 0 0 10px #f8b229, 0 0 20px #f8b229 !important;
        }
        
        /* Botões com cores natalinas */
        .btn-primary,
        button[class*="primary"] {
          background: linear-gradient(135deg, #c41e3a 0%, #8b0000 100%) !important;
          border-color: #f8b229 !important;
          box-shadow: 0 0 10px rgba(248, 178, 41, 0.3) !important;
        }
        
        .btn-primary:hover,
        button[class*="primary"]:hover {
          background: linear-gradient(135deg, #165b33 0%, #0d3d1f 100%) !important;
          transform: scale(1.02);
        }
        
        /* Cards com borda festiva */
        .card,
        [class*="card"] {
          border: 1px solid rgba(248, 178, 41, 0.2) !important;
          box-shadow: 0 4px 15px rgba(196, 30, 58, 0.1) !important;
        }
        
        /* Mensagem de boas festas no rodapé */
        body::after {
          content: '🎅 Boas Festas! Feliz Natal e Próspero Ano Novo! 🎄';
          position: fixed;
          bottom: 10px;
          right: 10px;
          background: linear-gradient(135deg, #c41e3a, #165b33);
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 12px;
          z-index: 9999;
          box-shadow: 0 4px 15px rgba(0,0,0,0.3);
          animation: pulse-festivo 2s ease-in-out infinite;
        }
        
        @keyframes pulse-festivo {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        /* Cursor personalizado */
        * {
          cursor: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><text y="18" font-size="18">🎄</text></svg>') 12 12, auto !important;
        }
        
        /* Scrollbar temática */
        ::-webkit-scrollbar {
          width: 12px;
        }
        
        ::-webkit-scrollbar-track {
          background: #1a1a2e;
        }
        
        ::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #c41e3a, #165b33);
          border-radius: 6px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #165b33, #c41e3a);
        }
        
        /* Tabelas com listras natalinas */
        table tbody tr:nth-child(even) {
          background-color: rgba(196, 30, 58, 0.03) !important;
        }
        
        table tbody tr:nth-child(odd) {
          background-color: rgba(22, 91, 51, 0.03) !important;
        }
        
        /* Inputs com borda festiva no focus */
        input:focus,
        select:focus,
        textarea:focus {
          border-color: #c41e3a !important;
          box-shadow: 0 0 0 3px rgba(196, 30, 58, 0.2) !important;
        }
        
        /* Badges/Tags com cores natalinas */
        .badge-success,
        [class*="badge"][class*="success"] {
          background: #165b33 !important;
        }
        
        .badge-danger,
        [class*="badge"][class*="danger"] {
          background: #c41e3a !important;
        }
        
        .badge-warning,
        [class*="badge"][class*="warning"] {
          background: #f8b229 !important;
          color: #1a1a2e !important;
        }
      `,
      
      // Função para criar flocos de neve
      init: function() {
        const flocos = ['❄', '❅', '❆', '✻', '✼', '❉'];
        const container = document.createElement('div');
        container.id = 'tema-natal-flocos';
        document.body.appendChild(container);
        
        function criarFloco() {
          const floco = document.createElement('span');
          floco.className = 'floco-neve';
          floco.textContent = flocos[Math.floor(Math.random() * flocos.length)];
          floco.style.left = Math.random() * 100 + 'vw';
          floco.style.fontSize = (Math.random() * 15 + 10) + 'px';
          floco.style.animationDuration = (Math.random() * 5 + 5) + 's';
          floco.style.opacity = Math.random() * 0.5 + 0.5;
          container.appendChild(floco);
          
          // Remove após animação
          setTimeout(() => floco.remove(), 10000);
        }
        
        // Cria flocos periodicamente
        setInterval(criarFloco, 500);
        
        // Cria alguns flocos iniciais
        for (let i = 0; i < 10; i++) {
          setTimeout(criarFloco, i * 200);
        }
        
        console.log('[Tema] 🎄 Natal ativado!');
      }
    },
    
    // ===== CARNAVAL (para depois) =====
    carnaval: {
      nome: 'Carnaval 2026',
      emoji: '🎭',
      cores: {
        primaria: '#9b59b6',      // Roxo
        secundaria: '#f1c40f',     // Amarelo
        accent: '#e74c3c',         // Vermelho
        verde: '#2ecc71'
      },
      css: `
        /* ===== DECORAÇÕES DE CARNAVAL ===== */
        
        /* Faixa colorida no topo */
        body::before {
          content: '🎭 💃 🎉 🎊 🥁 🎺 🎭 💃 🎉 🎊 🥁 🎺 🎭 💃 🎉 🎊';
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 30px;
          background: linear-gradient(90deg, #9b59b6, #f1c40f, #e74c3c, #2ecc71, #3498db, #9b59b6);
          background-size: 200% 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          letter-spacing: 8px;
          z-index: 9999;
          animation: arco-iris 3s linear infinite;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
        
        @keyframes arco-iris {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        
        body {
          padding-top: 30px !important;
        }
        
        /* Confetes */
        .confete {
          position: fixed;
          top: -20px;
          pointer-events: none;
          z-index: 9998;
          animation: cair-confete linear infinite;
        }
        
        @keyframes cair-confete {
          0% {
            transform: translateY(0) rotate(0deg) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg) scale(0.5);
            opacity: 0;
          }
        }
        
        /* Sidebar com tema carnavalesco */
        .sidebar, 
        [class*="sidebar"] {
          background: linear-gradient(180deg, #1a1a2e 0%, #2c1654 50%, #1a1a2e 100%) !important;
          border-right: 3px solid #f1c40f !important;
        }
        
        /* Botões coloridos */
        .btn-primary {
          background: linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%) !important;
          border-color: #f1c40f !important;
        }
        
        .btn-primary:hover {
          background: linear-gradient(135deg, #f1c40f 0%, #f39c12 100%) !important;
          color: #1a1a2e !important;
        }
        
        /* Mensagem de carnaval */
        body::after {
          content: '🎭 É Carnaval! Viva a folia! 🎉';
          position: fixed;
          bottom: 10px;
          right: 10px;
          background: linear-gradient(135deg, #9b59b6, #f1c40f, #e74c3c);
          color: white;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 12px;
          z-index: 9999;
          box-shadow: 0 4px 15px rgba(0,0,0,0.3);
          animation: samba 0.5s ease-in-out infinite;
        }
        
        @keyframes samba {
          0%, 100% { transform: rotate(-2deg); }
          50% { transform: rotate(2deg); }
        }
        
        /* Scrollbar colorida */
        ::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #9b59b6, #f1c40f, #e74c3c, #2ecc71);
          border-radius: 6px;
        }
      `,
      
      init: function() {
        const cores = ['#9b59b6', '#f1c40f', '#e74c3c', '#2ecc71', '#3498db', '#e91e63'];
        const formas = ['●', '■', '▲', '★', '♦'];
        const container = document.createElement('div');
        container.id = 'tema-carnaval-confetes';
        document.body.appendChild(container);
        
        function criarConfete() {
          const confete = document.createElement('span');
          confete.className = 'confete';
          confete.textContent = formas[Math.floor(Math.random() * formas.length)];
          confete.style.left = Math.random() * 100 + 'vw';
          confete.style.color = cores[Math.floor(Math.random() * cores.length)];
          confete.style.fontSize = (Math.random() * 15 + 8) + 'px';
          confete.style.animationDuration = (Math.random() * 3 + 3) + 's';
          container.appendChild(confete);
          
          setTimeout(() => confete.remove(), 6000);
        }
        
        setInterval(criarConfete, 300);
        
        for (let i = 0; i < 15; i++) {
          setTimeout(criarConfete, i * 100);
        }
        
        console.log('[Tema] 🎭 Carnaval ativado!');
      }
    },
    
    // ===== PÁSCOA (para depois) =====
    pascoa: {
      nome: 'Páscoa 2026',
      emoji: '🐰',
      cores: {
        primaria: '#f8bbd9',      // Rosa pastel
        secundaria: '#a8e6cf',     // Verde pastel
        accent: '#ffd54f'          // Amarelo
      },
      css: `
        /* ===== DECORAÇÕES DE PÁSCOA ===== */
        
        body::before {
          content: '🐰 🥚 🐣 🌷 🦋 🥕 🐰 🥚 🐣 🌷 🦋 🥕 🐰 🥚 🐣 🌷';
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 30px;
          background: linear-gradient(90deg, #f8bbd9, #a8e6cf, #ffd54f, #f8bbd9);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          letter-spacing: 8px;
          z-index: 9999;
        }
        
        body {
          padding-top: 30px !important;
        }
        
        body::after {
          content: '🐰 Feliz Páscoa! 🥚';
          position: fixed;
          bottom: 10px;
          right: 10px;
          background: linear-gradient(135deg, #f8bbd9, #a8e6cf);
          color: #333;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 12px;
          z-index: 9999;
        }
        
        .btn-primary {
          background: linear-gradient(135deg, #f8bbd9 0%, #f48fb1 100%) !important;
        }
      `,
      
      init: function() {
        console.log('[Tema] 🐰 Páscoa ativado!');
      }
    },
    
    // ===== FESTA JUNINA (para depois) =====
    junino: {
      nome: 'Festa Junina 2026',
      emoji: '🎪',
      cores: {
        primaria: '#ff6b35',      // Laranja
        secundaria: '#f7c59f',     // Bege
        accent: '#2e86ab'          // Azul
      },
      css: `
        /* ===== DECORAÇÕES DE FESTA JUNINA ===== */
        
        body::before {
          content: '🎪 🌽 🔥 🎶 👒 🪗 🎪 🌽 🔥 🎶 👒 🪗 🎪 🌽 🔥 🎶';
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 30px;
          background: linear-gradient(90deg, #ff6b35, #f7c59f, #2e86ab, #ff6b35);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          letter-spacing: 8px;
          z-index: 9999;
        }
        
        body {
          padding-top: 30px !important;
        }
        
        body::after {
          content: '🔥 Viva São João! 🌽';
          position: fixed;
          bottom: 10px;
          right: 10px;
          background: linear-gradient(135deg, #ff6b35, #f7c59f);
          color: #333;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 12px;
          z-index: 9999;
        }
        
        /* Bandeirinhas simuladas */
        .sidebar::before {
          content: '🚩🚩🚩🚩🚩';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          font-size: 20px;
          letter-spacing: 5px;
          text-align: center;
        }
      `,
      
      init: function() {
        console.log('[Tema] 🎪 Festa Junina ativado!');
      }
    }
  };
  
  // ========================================
  // APLICAR TEMA
  // ========================================
  function aplicarTema(temaId) {
    const tema = TEMAS[temaId];
    if (!tema) {
      console.warn('[Tema] Tema não encontrado:', temaId);
      return;
    }
    
    // Remove tema anterior se existir
    const estiloAnterior = document.getElementById('tema-sazonal-style');
    if (estiloAnterior) estiloAnterior.remove();
    
    const containerAnterior = document.getElementById('tema-natal-flocos') || 
                              document.getElementById('tema-carnaval-confetes');
    if (containerAnterior) containerAnterior.remove();
    
    // Injeta CSS
    const style = document.createElement('style');
    style.id = 'tema-sazonal-style';
    style.textContent = tema.css;
    document.head.appendChild(style);
    
    // Executa função de inicialização do tema
    if (tema.init) {
      tema.init();
    }
    
    // Adiciona classe no body para identificar tema ativo
    document.body.classList.add('tema-' + temaId);
    document.body.setAttribute('data-tema', temaId);
    
    console.log(`[Tema] ${tema.emoji} ${tema.nome} aplicado!`);
  }
  
  // ========================================
  // REMOVER TEMA
  // ========================================
  function removerTema() {
    const style = document.getElementById('tema-sazonal-style');
    if (style) style.remove();
    
    const containers = document.querySelectorAll('[id^="tema-"]');
    containers.forEach(c => c.remove());
    
    document.body.className = document.body.className.replace(/tema-\w+/g, '').trim();
    document.body.removeAttribute('data-tema');
    
    // Remove padding extra
    document.body.style.paddingTop = '';
    
    console.log('[Tema] Tema removido');
  }
  
  // ========================================
  // API GLOBAL
  // ========================================
  window.TemaSazonal = {
    ativar: aplicarTema,
    desativar: removerTema,
    trocar: function(novoTema) {
      removerTema();
      if (novoTema) aplicarTema(novoTema);
    },
    temas: Object.keys(TEMAS),
    atual: function() {
      return document.body.getAttribute('data-tema');
    }
  };
  
  // ========================================
  // INICIALIZAÇÃO
  // ========================================
  document.addEventListener('DOMContentLoaded', function() {
    aplicarTema(TEMA_ATIVO);
  });
  
  // Se DOM já carregou
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    aplicarTema(TEMA_ATIVO);
  }
  
  console.log('[Tema] 🎨 Sistema de temas sazonais carregado');
  console.log('[Tema] Use: TemaSazonal.trocar("carnaval") para mudar');
  console.log('[Tema] Use: TemaSazonal.desativar() para remover');
  
})();