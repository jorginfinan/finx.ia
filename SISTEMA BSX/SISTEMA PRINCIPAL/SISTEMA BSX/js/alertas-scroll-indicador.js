/* ========================================
   JAVASCRIPT PARA INDICADOR DE SCROLL
   - Detecta quando há conteúdo abaixo
   - Adiciona classe para mostrar indicador
   - Remove quando rola até o fim
   ======================================== */

(function initAlertScrollIndicator() {
  'use strict';

  // Função para verificar se precisa de scroll
  function checkScrollIndicator() {
    const box = document.getElementById('dashAlertBox');
    if (!box) return;

    const hasScroll = box.scrollHeight > box.clientHeight;
    const isAtBottom = box.scrollHeight - box.scrollTop <= box.clientHeight + 10;

    // Adiciona/remove classe 'has-scroll'
    if (hasScroll && !isAtBottom) {
      box.classList.add('has-scroll');
      box.classList.remove('scrolled-to-bottom');
    } else if (isAtBottom) {
      box.classList.remove('has-scroll');
      box.classList.add('scrolled-to-bottom');
    } else {
      box.classList.remove('has-scroll', 'scrolled-to-bottom');
    }
  }

  // Observa mudanças no conteúdo do box de alertas
  function observeAlertBox() {
    const box = document.getElementById('dashAlertBox');
    if (!box) {
      // Se ainda não existe, tenta novamente depois
      setTimeout(observeAlertBox, 500);
      return;
    }

    // Observer para mudanças no conteúdo
    const observer = new MutationObserver(() => {
      checkScrollIndicator();
    });

    observer.observe(box, {
      childList: true,
      subtree: true,
      characterData: true
    });

    // Event listener para scroll
    box.addEventListener('scroll', checkScrollIndicator);

    // Verifica inicialmente
    checkScrollIndicator();

    // Re-verifica quando a janela é redimensionada
    window.addEventListener('resize', checkScrollIndicator);
  }

  // Inicializa quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeAlertBox);
  } else {
    observeAlertBox();
  }

  // Re-verifica quando renderAlerts for chamada
  const originalRenderAlerts = window.renderAlerts;
  if (typeof originalRenderAlerts === 'function') {
    window.renderAlerts = function(...args) {
      const result = originalRenderAlerts.apply(this, args);
      setTimeout(checkScrollIndicator, 100);
      return result;
    };
  }

  console.log('✅ Indicador de scroll de alertas inicializado');
})();