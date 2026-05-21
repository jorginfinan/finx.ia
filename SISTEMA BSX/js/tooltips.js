// ============================================================
// TOOLTIPS — sistema global, instantâneo, com auto-flip.
// Use data-tip="texto" em qualquer elemento.
// Posição preferida (opcional): data-tip-pos="above|below|left|right".
// Se a posição preferida saísse da viewport, o JS escolhe outra
// automaticamente.
// ============================================================
(function () {
  'use strict';

  if (window.__TIPS_LOADED__) return;
  window.__TIPS_LOADED__ = true;

  const GAP = 8;            // distância entre balão e elemento
  const MARGIN = 6;         // margem mínima da borda da viewport
  let bubble = null;
  let currentTarget = null;

  function ensureBubble() {
    if (bubble) return bubble;
    bubble = document.createElement('div');
    bubble.id = '__tipBubble';
    bubble.setAttribute('role', 'tooltip');
    document.body.appendChild(bubble);
    return bubble;
  }

  function hide() {
    if (!bubble) return;
    bubble.classList.remove('visible');
    currentTarget = null;
  }

  function tryPosition(targetRect, bubbleRect, pos) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top, left;

    if (pos === 'above') {
      top  = targetRect.top - bubbleRect.height - GAP;
      left = targetRect.left + targetRect.width / 2 - bubbleRect.width / 2;
    } else if (pos === 'below') {
      top  = targetRect.bottom + GAP;
      left = targetRect.left + targetRect.width / 2 - bubbleRect.width / 2;
    } else if (pos === 'left') {
      top  = targetRect.top + targetRect.height / 2 - bubbleRect.height / 2;
      left = targetRect.left - bubbleRect.width - GAP;
    } else { // right
      top  = targetRect.top + targetRect.height / 2 - bubbleRect.height / 2;
      left = targetRect.right + GAP;
    }

    // verifica se cabe (com margem)
    const fits = (
      top  >= MARGIN &&
      left >= MARGIN &&
      top  + bubbleRect.height <= vh - MARGIN &&
      left + bubbleRect.width  <= vw - MARGIN
    );

    return { top, left, fits };
  }

  function position(target) {
    if (!bubble) return;

    const targetRect = target.getBoundingClientRect();
    // medir o balão (já visível invisivelmente p/ obter tamanho real)
    bubble.style.left = '0px';
    bubble.style.top  = '0px';
    const bRect = bubble.getBoundingClientRect();

    const preferred = target.getAttribute('data-tip-pos') || 'above';

    // ordem de tentativas: preferida -> opostas/laterais
    const order = (() => {
      const map = {
        above: ['above', 'below', 'left', 'right'],
        below: ['below', 'above', 'left', 'right'],
        left:  ['left', 'right', 'above', 'below'],
        right: ['right', 'left', 'above', 'below']
      };
      return map[preferred] || map.above;
    })();

    let chosen = null;
    for (const p of order) {
      const r = tryPosition(targetRect, bRect, p);
      if (r.fits) { chosen = { ...r, pos: p }; break; }
    }
    // Se nenhuma posição cabe perfeitamente, escolhe a preferida e clampa
    if (!chosen) {
      const r = tryPosition(targetRect, bRect, preferred);
      chosen = { ...r, pos: preferred };
    }

    // clamp final para nunca sair da viewport
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    chosen.left = Math.max(MARGIN, Math.min(chosen.left, vw - bRect.width  - MARGIN));
    chosen.top  = Math.max(MARGIN, Math.min(chosen.top,  vh - bRect.height - MARGIN));

    bubble.style.left = chosen.left + 'px';
    bubble.style.top  = chosen.top  + 'px';
    bubble.setAttribute('data-pos', chosen.pos);
  }

  function show(target) {
    const text = target.getAttribute('data-tip');
    if (!text) return;
    ensureBubble();
    bubble.textContent = text;
    bubble.classList.add('visible');
    currentTarget = target;
    // posicionar APÓS classList.add (para que tenha dimensões reais)
    position(target);
  }

  // ============ EVENTOS GLOBAIS ============
  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-tip]');
    if (!target) return;
    if (target === currentTarget) return;
    show(target);
  });

  document.addEventListener('mouseout', (e) => {
    if (!currentTarget) return;
    // só esconde se sair de fato do alvo
    const to = e.relatedTarget;
    if (to && currentTarget.contains(to)) return;
    if (to && to.closest && to.closest('[data-tip]') === currentTarget) return;
    hide();
  });

  // foco via teclado (acessibilidade)
  document.addEventListener('focusin', (e) => {
    const target = e.target.closest('[data-tip]');
    if (!target) return;
    show(target);
  });
  document.addEventListener('focusout', () => hide());

  // Esconde ao rolar ou redimensionar (evita ficar flutuando fora de lugar)
  window.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide);

  // Esconde também ao clicar (evita ficar travado depois de clicar e perder hover)
  document.addEventListener('click', hide, true);

  console.log('[Tooltips] ✅ Sistema global carregado');
})();
