// =====================================================================
// TRANSIÇÃO DO TOPO — troca de ramo e troca de empresa (estilo Portal)
// Ao trocar de ramo ou de empresa nos seletores do topo:
//   1) um círculo branco nasce no seletor clicado e cobre a tela, com a
//      borda na cor do ramo (JB amarelo, Video game azul, Futebol verde);
//   2) o sistema recarrega por baixo e a transição continua na página nova
//      (um script curto no <head> esconde a página até ela ficar pronta);
//   3) o círculo se fecha de volta no seletor, que pulsa.
// Não muda nenhuma regra do sistema: só chama a troca no meio.
// Se algo falhar, a troca acontece normalmente, sem animação.
// Carrega logo depois do js/seletor-topo.js (usa o window.iconeRamo dele).
// =====================================================================
(function () {
  'use strict';
  if (window.TransicaoTopo) return;

  const CHAVE = 'finx:transicaoTopo';
  const NOMES = { JB: 'JB', VG: 'Video game', FUTEBOL: 'Futebol' };
  const TEMPO = { portal: [480, 520], calmo: [180, 200] }; // ms: [cobrir, descobrir]
  const raiz = document.documentElement;

  const corDe = r => (r === 'VG' || r === 'FUTEBOL' ? r : 'JB');
  const nomeDe = r => NOMES[r] || String(r || '');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icone = (r, t) => (typeof window.iconeRamo === 'function' ? window.iconeRamo(r, t) : '');
  const calmo = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };

  let atual = null;
  let descarregando = false;
  addEventListener('beforeunload', () => { descarregando = true; });
  addEventListener('pagehide', () => { descarregando = true; });
  addEventListener('pageshow', ev => {
    descarregando = false;
    if (ev.persisted) soltar(); // voltou pelo "voltar" do navegador: some na hora
  });

  // ---------- Recado para a página nova (sessionStorage, só nesta aba) ----------
  function guardar(d) { try { sessionStorage.setItem(CHAVE, JSON.stringify(d)); } catch (_) {} }
  function esquecer() { try { sessionStorage.removeItem(CHAVE); } catch (_) {} }
  function lerRecado() {
    let d = window.__sxTrans || null;
    window.__sxTrans = null;
    if (!d) {
      try { d = JSON.parse(sessionStorage.getItem(CHAVE) || 'null'); } catch (_) { d = null; }
      esquecer();
    }
    return d && (d.tipo === 'ramo' || d.tipo === 'empresa') && Date.now() - Number(d.t || 0) < 15000 ? d : null;
  }
  function liberarPagina() { raiz.removeAttribute('data-sx-trans'); }

  // ---------- O portal nasce e termina no seletor usado ----------
  function seletorDe(info) {
    return info.tipo === 'ramo'
      ? document.getElementById('ramoSwitcher')
      : document.getElementById('empresaSelect')?.closest('.company-switcher');
  }
  function posicionar(st) {
    const b = seletorDe(st.info);
    const r = b && !b.hidden ? b.getBoundingClientRect() : null;
    const x = r && r.width ? r.left + r.width / 2 : innerWidth / 2;
    const y = r && r.width ? r.top + r.height / 2 : 28;
    const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 6;
    st.el.style.setProperty('--x', x + 'px');
    st.el.style.setProperty('--y', y + 'px');
    st.el.style.setProperty('--r', R + 'px');
  }

  // ---------- Monta a tela da transição ----------
  function montar(info, cheio) {
    const ramo = info.tipo === 'ramo';
    const est = calmo() ? 'calmo' : 'portal';
    const el = document.createElement('div');
    el.className = `tx tx-${est} ` + (cheio ? 'tx-cheio' : 'tx-entra');
    el.dataset.cor = corDe(ramo ? info.para : info.ramo);
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.style.setProperty('--t1', TEMPO[est][0] + 'ms');
    el.style.setProperty('--t2', TEMPO[est][1] + 'ms');
    const nome = ramo ? nomeDe(info.para).toUpperCase() : String(info.empresa || '');
    const ico = ramo ? icone(info.para, 40) : `<span class="tx-emoji">${esc(info.emoji || '🏢')}</span>`;
    const sub = ramo
      ? `Abrindo <span>${esc(info.emoji || '🏢')}</span><b>${esc(info.empresa)}</b>`
      : `${icone(info.ramo, 14)}<span>${esc(nomeDe(info.ramo))}</span>`;
    el.innerHTML = `
      <div class="tx-fundo" aria-hidden="true"></div>
      <div class="tx-anel" aria-hidden="true"></div>
      <div class="tx-anel tx-anel2" aria-hidden="true"></div>
      <div class="tx-centro" aria-hidden="true">
        <div class="tx-ico">${ico}</div>
        <div class="tx-rot">${ramo ? 'Trocando de ramo' : 'Abrindo empresa'}</div>
        <div class="tx-nome">${esc(nome)}</div>
        <div class="tx-sub">${sub}</div>
        <div class="tx-barra"><i></i></div>
      </div>
      <span class="tx-sr">${ramo ? `Trocando para o ramo ${esc(nomeDe(info.para))}. Abrindo ${esc(info.empresa)}.` : `Abrindo a empresa ${esc(info.empresa)}.`}</span>`;
    const st = { el, info, est, timers: [], vivo: true };
    posicionar(st);
    (document.body || raiz).appendChild(el);
    return st;
  }

  const depois = (st, ms, fn) => { st.timers.push(setTimeout(() => { if (st.vivo) fn(); }, ms)); };
  const progresso = (st, p, seg) => { st.el.style.setProperty('--pt', seg + 's'); st.el.style.setProperty('--p', p + '%'); };

  // ---------- 1) Sai: cobre a tela e chama a troca ----------
  function sair(info, trocar) {
    if (typeof trocar !== 'function') return;
    if (atual) return; // já existe uma troca em andamento
    if (!info || (info.tipo !== 'ramo' && info.tipo !== 'empresa') || !document.body) { trocar(); return; }
    let st;
    try { st = montar(info, false); } catch (err) { console.warn('[TransicaoTopo]', err); trocar(); return; }
    atual = st;
    let foi = false;
    const seguir = () => {
      if (foi || !st.vivo) return;
      foi = true;
      guardar(Object.assign({ t: Date.now() }, info));
      try { trocar(); }
      catch (err) { console.error('[TransicaoTopo] Erro ao trocar:', err); cancelar(); return; }
      // Se a página não recarregar (ex.: usuário sem acesso), o portal se fecha
      depois(st, 3000, () => { if (!descarregando) cancelar(); else depois(st, 9000, cancelar); });
    };
    const cobrir = TEMPO[st.est][0];
    requestAnimationFrame(() => progresso(st, 55, cobrir / 1000 + 0.2));
    depois(st, cobrir + 180, seguir);
  }

  // ---------- 2) Chega: página recarregada ----------
  function pronto(desde) {
    if (document.readyState === 'loading') return false;
    const app = document.getElementById('app');
    if (!app || getComputedStyle(app).display !== 'none') return true;
    // Sem sessão (tela de login): não segura a tela por muito tempo
    return document.readyState === 'complete' && performance.now() - desde > 2000;
  }

  function entrar(info) {
    if (atual || !info) { liberarPagina(); return; }
    let st;
    try { st = montar(info, true); } catch (err) { console.warn('[TransicaoTopo]', err); liberarPagina(); return; }
    atual = st;
    progresso(st, 55, 0);
    requestAnimationFrame(() => requestAnimationFrame(() => progresso(st, 90, 3)));
    const ini = performance.now();
    const vigia = setInterval(() => {
      if (!st.vivo) { clearInterval(vigia); return; }
      const t = performance.now() - ini;
      if (t < 250 || (!pronto(ini) && t < 4500)) return;
      clearInterval(vigia);
      progresso(st, 100, 0.2);
      depois(st, 220, () => descobrir(st, true));
    }, 50);
    st.timers.push(vigia);
  }

  // ---------- 3) Descobre: o portal se fecha no seletor ----------
  function descobrir(st, comPulso) {
    if (!st || !st.vivo || st.saindo) return;
    st.saindo = true;
    liberarPagina();
    posicionar(st); // o seletor já está no lugar certo na página nova
    st.el.classList.remove('tx-entra', 'tx-cheio');
    void st.el.offsetWidth;
    st.el.classList.add('tx-sai');
    setTimeout(() => {
      soltar(st);
      if (comPulso) pulsar(st.info);
    }, TEMPO[st.est][1] + 120);
  }

  function cancelar() {
    const st = atual;
    if (!st || !st.vivo) return;
    esquecer();
    descobrir(st, false);
  }

  function soltar(st) {
    st = st || atual;
    liberarPagina();
    if (!st) return;
    st.vivo = false;
    st.timers.forEach(id => { clearTimeout(id); clearInterval(id); });
    st.el.remove();
    if (atual === st) atual = null;
  }

  function pulsar(info) {
    const b = seletorDe(info);
    if (!b || b.hidden) return;
    b.classList.remove('tx-pulso');
    void b.offsetWidth;
    b.classList.add('tx-pulso');
    setTimeout(() => b.classList.remove('tx-pulso'), 2000);
  }

  window.TransicaoTopo = { sair, entrar, soltar: () => soltar() };

  // Página recarregada por uma troca: continua a transição daqui
  const recado = lerRecado();
  if (recado) {
    if (document.body) entrar(recado);
    else document.addEventListener('DOMContentLoaded', () => entrar(recado));
  } else {
    liberarPagina();
  }
})();
