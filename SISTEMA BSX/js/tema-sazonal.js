// ===== TEMA SAZONAL - NATAL 2025 (VERSÃO SUTIL) =====
// Para desativar: remova este arquivo do HTML ou mude TEMA_ATIVO para null

(function() {
    'use strict';
    
    // ========================================
    // CONFIGURAÇÃO
    // ========================================
    const TEMA_ATIVO = 'natal'; // Opções: 'natal', 'carnaval', null (desativado)
    
    if (!TEMA_ATIVO) {
      console.log('[Tema] Desativado');
      return;
    }
    
    // ========================================
    // DEFINIÇÃO DOS TEMAS
    // ========================================
    const TEMAS = {
      
      // ===== NATAL (VERSÃO SUTIL) =====
      natal: {
        nome: 'Natal 2025',
        emoji: '🎄',
        css: `
          /* ===== DECORAÇÕES DE NATAL - VERSÃO SUTIL ===== */
          /* NÃO ALTERA CORES DE TEXTO - APENAS ADICIONA DECORAÇÕES */
          
          /* Flocos de neve caindo */
          .floco-neve {
            position: fixed;
            top: -20px;
            color: rgba(255, 255, 255, 0.5);
            font-size: 14px;
            pointer-events: none;
            z-index: 9998;
            animation: cair-neve linear infinite;
            text-shadow: 0 0 3px rgba(255,255,255,0.3);
          }
          
          @keyframes cair-neve {
            0% {
              transform: translateY(0) rotate(0deg);
              opacity: 0.7;
            }
            100% {
              transform: translateY(100vh) rotate(360deg);
              opacity: 0;
            }
          }
          
          /* Mensagem de boas festas no canto */
          .natal-mensagem {
            position: fixed;
            bottom: 15px;
            right: 15px;
            background: linear-gradient(135deg, #c41e3a, #165b33);
            color: #ffffff !important;
            padding: 10px 18px;
            border-radius: 25px;
            font-size: 13px;
            font-weight: 500;
            z-index: 9999;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            animation: pulse-festivo 3s ease-in-out infinite;
            cursor: pointer;
            transition: transform 0.2s;
            font-family: inherit;
          }
          
          .natal-mensagem:hover {
            transform: scale(1.05);
          }
          
          @keyframes pulse-festivo {
            0%, 100% { box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
            50% { box-shadow: 0 4px 25px rgba(196, 30, 58, 0.5); }
          }
          
          /* Scrollbar temática (sutil) */
          ::-webkit-scrollbar {
            width: 10px;
          }
          
          ::-webkit-scrollbar-track {
            background: #1a1a2e;
          }
          
          ::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, #c41e3a, #165b33);
            border-radius: 5px;
          }
          
          ::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(180deg, #165b33, #c41e3a);
          }
        `,
        
        init: function() {
          // Container para flocos
          const container = document.createElement('div');
          container.id = 'tema-natal-flocos';
          document.body.appendChild(container);
          
          // Mensagem de boas festas
          const mensagem = document.createElement('div');
          mensagem.className = 'natal-mensagem';
          mensagem.innerHTML = '🎅 Boas Festas! 🎄';
          mensagem.title = 'Clique para esconder';
          mensagem.onclick = function() {
            this.style.display = 'none';
          };
          document.body.appendChild(mensagem);
          
          // Flocos de neve
          const flocos = ['❄', '❅', '❆'];
          
          function criarFloco() {
            const floco = document.createElement('span');
            floco.className = 'floco-neve';
            floco.textContent = flocos[Math.floor(Math.random() * flocos.length)];
            floco.style.left = Math.random() * 100 + 'vw';
            floco.style.fontSize = (Math.random() * 10 + 8) + 'px';
            floco.style.animationDuration = (Math.random() * 8 + 8) + 's';
            floco.style.opacity = Math.random() * 0.3 + 0.2;
            container.appendChild(floco);
            
            setTimeout(() => floco.remove(), 16000);
          }
          
          // Cria flocos periodicamente (menos frequente para ser sutil)
          setInterval(criarFloco, 1000);
          
          // Alguns flocos iniciais
          for (let i = 0; i < 3; i++) {
            setTimeout(criarFloco, i * 500);
          }
          
          console.log('[Tema] 🎄 Natal ativado!');
        }
      },
      
      // ===== CARNAVAL (VERSÃO SUTIL) =====
      carnaval: {
        nome: 'Carnaval 2026',
        emoji: '🎭',
        css: `
          /* ===== DECORAÇÕES DE CARNAVAL - VERSÃO SUTIL ===== */
          
          .confete {
            position: fixed;
            top: -20px;
            pointer-events: none;
            z-index: 9998;
            animation: cair-confete linear infinite;
            font-size: 8px;
          }
          
          @keyframes cair-confete {
            0% {
              transform: translateY(0) rotate(0deg);
              opacity: 0.7;
            }
            100% {
              transform: translateY(100vh) rotate(720deg);
              opacity: 0;
            }
          }
          
          .carnaval-mensagem {
            position: fixed;
            bottom: 15px;
            right: 15px;
            background: linear-gradient(135deg, #9b59b6, #f1c40f, #e74c3c);
            color: #ffffff !important;
            padding: 10px 18px;
            border-radius: 25px;
            font-size: 13px;
            font-weight: 500;
            z-index: 9999;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            cursor: pointer;
          }
          
          ::-webkit-scrollbar-thumb {
            background: linear-gradient(180deg, #9b59b6, #f1c40f, #e74c3c);
            border-radius: 5px;
          }
        `,
        
        init: function() {
          const cores = ['#9b59b6', '#f1c40f', '#e74c3c', '#2ecc71', '#3498db'];
          const formas = ['●', '■', '▲', '★'];
          const container = document.createElement('div');
          container.id = 'tema-carnaval-confetes';
          document.body.appendChild(container);
          
          const mensagem = document.createElement('div');
          mensagem.className = 'carnaval-mensagem';
          mensagem.innerHTML = '🎭 É Carnaval! 🎉';
          mensagem.onclick = function() { this.style.display = 'none'; };
          document.body.appendChild(mensagem);
          
          function criarConfete() {
            const confete = document.createElement('span');
            confete.className = 'confete';
            confete.textContent = formas[Math.floor(Math.random() * formas.length)];
            confete.style.left = Math.random() * 100 + 'vw';
            confete.style.color = cores[Math.floor(Math.random() * cores.length)];
            confete.style.fontSize = (Math.random() * 8 + 5) + 'px';
            confete.style.animationDuration = (Math.random() * 5 + 5) + 's';
            container.appendChild(confete);
            
            setTimeout(() => confete.remove(), 10000);
          }
          
          setInterval(criarConfete, 600);
          
          console.log('[Tema] 🎭 Carnaval ativado!');
        }
      }
    };
    
    // ========================================
    // APLICAR TEMA
    // ========================================
    function aplicarTema(temaId) {
      const tema = TEMAS[temaId];
      if (!tema) return;
      
      removerTema();
      
      const style = document.createElement('style');
      style.id = 'tema-sazonal-style';
      style.textContent = tema.css;
      document.head.appendChild(style);
      
      if (tema.init) tema.init();
      
      document.body.setAttribute('data-tema', temaId);
      console.log(`[Tema] ${tema.emoji} ${tema.nome} aplicado!`);
    }
    
    // ========================================
    // REMOVER TEMA
    // ========================================
    function removerTema() {
      const style = document.getElementById('tema-sazonal-style');
      if (style) style.remove();
      
      ['tema-natal-flocos', 'tema-carnaval-confetes'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });
      
      document.querySelectorAll('.natal-mensagem, .carnaval-mensagem').forEach(el => el.remove());
      
      document.body.removeAttribute('data-tema');
    }
    
    // ========================================
    // API GLOBAL
    // ========================================
    window.TemaSazonal = {
      ativar: aplicarTema,
      desativar: removerTema,
      trocar: function(novoTema) {
        removerTema();
        if (novoTema) setTimeout(() => aplicarTema(novoTema), 100);
      },
      temas: Object.keys(TEMAS)
    };
    
    // ========================================
    // INICIALIZAÇÃO
    // ========================================
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => aplicarTema(TEMA_ATIVO));
    } else {
      aplicarTema(TEMA_ATIVO);
    }
    
    console.log('[Tema] 🎨 Sistema de temas carregado');
    
  })();