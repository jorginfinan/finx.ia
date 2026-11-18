// =====================================================================
// TRANSIÇÃO (estilo Portal) — troca de ramo, troca de empresa,
// entrada no sistema (login) e saída (Sair).
// Um círculo branco nasce no botão clicado, cobre a tela com a borda na
// cor do ramo (JB amarelo, Video game azul, Futebol verde) e depois se
// fecha no lugar certo:
//   · troca de ramo/empresa → nasce e fecha no seletor usado (o sistema
//     recarrega por baixo; um script curto no <head> mantém a tela coberta);
//   · login → nasce no botão "Entrar" e fecha no seletor de empresa;
//   · Sair  → nasce no botão "Sair" e fecha no botão "Entrar" da tela de login.
// Não muda nenhuma regra do sistema: o login continua igual (a animação só
// escuta o aviso "auth:login") e o Sair de sempre roda com a tela coberta.
// Se algo falhar, tudo acontece normalmente, sem animação.
// Carrega logo depois do js/seletor-topo.js (usa o window.iconeRamo dele).
// =====================================================================
(function () {
  'use strict';
  if (window.TransicaoTopo) return;

  const CHAVE = 'finx:transicaoTopo';
  const TIPOS = ['ramo', 'empresa', 'login'];          // tipos que continuam depois de recarregar
  const NOMES = { JB: 'JB', VG: 'Video game', FUTEBOL: 'Futebol' };
  const TEMPO = { portal: [480, 520], calmo: [180, 200] }; // ms: [cobrir, descobrir]
  const SEL_SAIR = '[data-action="logout"],#btnLogout';
  const SVG_SAIR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>';
  const SVG_CADEADO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  const raiz = document.documentElement;

  const corDe = r => (r === 'VG' || r === 'FUTEBOL' ? r : 'JB');
  const nomeDe = r => NOMES[r] || String(r || '');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icone = (r, t) => (typeof window.iconeRamo === 'function' ? window.iconeRamo(r, t) : '');
  const calmo = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };
  const visivel = el => !!el && getComputedStyle(el).display !== 'none';

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
    return d && TIPOS.includes(d.tipo) && Date.now() - Number(d.t || 0) < 15000 ? d : null;
  }
  function liberarPagina() { raiz.removeAttribute('data-sx-trans'); }

  // ---------- Dados da tela atual (para login/saída) ----------
  function ramoDaTela() {
    const b = document.body;
    return b?.classList.contains('ramo-vg') ? 'VG' : b?.classList.contains('ramo-futebol') ? 'FUTEBOL' : 'JB';
  }
  function usuarioNome() {
    try {
      const s = JSON.parse(localStorage.getItem('APP_SESSION_V1') || 'null');
      const n = String(s?.nome || s?.username || window.currentUser?.name || '').trim();
      return n ? n.charAt(0).toUpperCase() + n.slice(1) : '';
    } catch (_) { return ''; }
  }
  function empresaDaTela() {
    let nome = 'BSX';
    try { nome = String(window.getCompany?.() || localStorage.getItem('CURRENT_COMPANY') || 'BSX').toUpperCase(); } catch (_) {}
    const opt = Array.from(document.getElementById('empresaSelect')?.options || []).find(o => String(o.value).toUpperCase() === nome);
    const txt = String(opt?.textContent || '').trim().match(/^(\S+)\s+(.+)$/);
    const emoji = opt?.dataset.emoji || (txt && !/[A-Za-z0-9]/.test(txt[1]) ? txt[1] : '') || '🏢';
    return { empresa: opt?.dataset.nome || nome, emoji };
  }

  // ---------- Onde o portal nasce e onde se fecha ----------
  const seletorEmpresa = () => document.getElementById('empresaSelect')?.closest('.company-switcher');
  function alvoDe(st, fase) {
    const t = st.info.tipo;
    if (t === 'ramo') return document.getElementById('ramoSwitcher');
    if (t === 'empresa') return seletorEmpresa();
    if (t === 'login') return fase === 'cobrir' ? document.getElementById('btnDoLogin') : seletorEmpresa();
    if (t === 'logout') return fase === 'cobrir' ? st.botao : document.getElementById('btnDoLogin');
    return null;
  }
  function posicionar(st, fase) {
    const b = alvoDe(st, fase);
    const r = b && !b.hidden && visivel(b) ? b.getBoundingClientRect() : null;
    const ok = r && r.width;
    const x = ok ? r.left + r.width / 2 : innerWidth / 2;
    const y = ok ? r.top + r.height / 2 : (st.info.tipo === 'logout' ? innerHeight / 2 : 28);
    const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 6;
    st.el.style.setProperty('--x', x + 'px');
    st.el.style.setProperty('--y', y + 'px');
    st.el.style.setProperty('--r', R + 'px');
  }

  // ---------- Conteúdo do centro de cada tipo ----------
  function conteudo(info) {
    const emo = `<span class="tx-emoji">${esc(info.emoji || '🏢')}</span>`;
    switch (info.tipo) {
      case 'ramo':
        return {
          cor: info.para, rot: 'Trocando de ramo', nome: nomeDe(info.para).toUpperCase(), ico: icone(info.para, 40),
          sub: `Abrindo <span>${esc(info.emoji || '🏢')}</span><b>${esc(info.empresa)}</b>`,
          sr: `Trocando para o ramo ${nomeDe(info.para)}. Abrindo ${info.empresa}.`
        };
      case 'empresa':
        return {
          cor: info.ramo, rot: 'Abrindo empresa', nome: String(info.empresa || ''), ico: emo,
          sub: `${icone(info.ramo, 14)}<span>${esc(nomeDe(info.ramo))}</span>`,
          sr: `Abrindo a empresa ${info.empresa}.`
        };
      case 'login':
        return {
          cor: info.ramo, rot: 'Entrando no sistema', nome: info.usuario ? `Olá, ${info.usuario}` : 'Bem-vindo', ico: emo,
          sub: `<b>${esc(info.empresa)}</b><span>·</span>${icone(info.ramo, 14)}<span>${esc(nomeDe(info.ramo))}</span>`,
          sr: `Entrando no sistema. Abrindo ${info.empresa}.`
        };
      default: // logout
        return {
          cor: info.ramo, rot: 'Saindo do sistema', nome: info.usuario ? `Até logo, ${info.usuario}` : 'Até logo', ico: SVG_SAIR,
          sub: `${SVG_CADEADO}<span>Sessão encerrada</span>`,
          sr: 'Saindo do sistema.'
        };
    }
  }

  // ---------- Monta a tela da transição ----------
  function montar(info, cheio, botao) {
    const est = calmo() ? 'calmo' : 'portal';
    const c = conteudo(info);
    const el = document.createElement('div');
    el.className = `tx tx-${est} ` + (cheio ? 'tx-cheio' : 'tx-entra');
    el.dataset.cor = corDe(c.cor);
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.style.setProperty('--t1', TEMPO[est][0] + 'ms');
    el.style.setProperty('--t2', TEMPO[est][1] + 'ms');
    el.innerHTML = `
      <div class="tx-fundo" aria-hidden="true"></div>
      <div class="tx-anel" aria-hidden="true"></div>
      <div class="tx-anel tx-anel2" aria-hidden="true"></div>
      <div class="tx-centro" aria-hidden="true">
        <div class="tx-ico">${c.ico}</div>
        <div class="tx-rot">${esc(c.rot)}</div>
        <div class="tx-nome">${esc(c.nome)}</div>
        <div class="tx-sub">${c.sub}</div>
        <div class="tx-barra"><i></i></div>
      </div>
      <span class="tx-sr">${esc(c.sr)}</span>`;
    const st = { el, info, est, botao, timers: [], vivo: true };
    posicionar(st, 'cobrir');
    (document.body || raiz).appendChild(el);
    return st;
  }

  const depois = (st, ms, fn) => { st.timers.push(setTimeout(() => { if (st.vivo) fn(); }, ms)); };
  const progresso = (st, p, seg) => { st.el.style.setProperty('--pt', seg + 's'); st.el.style.setProperty('--p', p + '%'); };

  // Espera uma condição (com tempo mínimo e máximo) e segue
  function esperar(st, cond, min, max, fn) {
    const ini = performance.now();
    const id = setInterval(() => {
      if (!st.vivo) { clearInterval(id); return; }
      const t = performance.now() - ini;
      if (t < min || (!cond(ini) && t < max)) return;
      clearInterval(id);
      fn();
    }, 50);
    st.timers.push(id);
  }

  // Sistema pronto: a área do app está na tela
  function pronto(desde) {
    if (document.readyState === 'loading') return false;
    if (visivel(document.getElementById('app'))) return true;
    // Sem sessão (tela de login): não segura a tela por muito tempo
    return document.readyState === 'complete' && performance.now() - desde > 2000;
  }

  // ---------- Troca de ramo/empresa: cobre a tela e chama a troca ----------
  function sair(info, trocar) {
    if (typeof trocar !== 'function') return;
    if (atual) return; // já existe uma transição em andamento
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

  // ---------- Página recarregada: continua a transição ----------
  function entrar(info) {
    if (atual || !info) { liberarPagina(); return; }
    let st;
    try { st = montar(info, true); } catch (err) { console.warn('[TransicaoTopo]', err); liberarPagina(); return; }
    atual = st;
    progresso(st, 55, 0);
    requestAnimationFrame(() => requestAnimationFrame(() => progresso(st, 90, 3)));
    esperar(st, pronto, 250, 4500, () => {
      progresso(st, 100, 0.2);
      depois(st, 220, () => descobrir(st, true));
    });
  }

  // ---------- Entrada no sistema (login) ----------
  // Escuta o aviso "auth:login" que o login já dispara; não mexe no login.
  function aoEntrar() {
    if (atual || !document.body) return;
    const lp = document.getElementById('loginPage');
    if (!visivel(lp)) return; // só quando a pessoa estava na tela de login
    const info = Object.assign({ tipo: 'login', ramo: ramoDaTela(), usuario: usuarioNome() }, empresaDaTela());
    let st;
    try { st = montar(info, false); } catch (err) { console.warn('[TransicaoTopo]', err); return; }
    atual = st;
    // Cópia da tela de login por baixo, enquanto o portal cresce (o app já abre por trás)
    try {
      const copia = copiaDoLogin(lp);
      st.el.insertBefore(copia, st.el.firstChild);
      depois(st, TEMPO[st.est][0] + 40, () => copia.remove());
    } catch (_) {}
    // Se o sistema recarregar logo depois do login, a transição continua na página nova
    guardar(Object.assign({ t: Date.now() }, info));
    const cobrir = TEMPO[st.est][0];
    requestAnimationFrame(() => progresso(st, 70, cobrir / 1000 + 0.4));
    esperar(st, pronto, cobrir + 650, 4500, () => {
      esquecer();
      progresso(st, 100, 0.2);
      depois(st, 220, () => descobrir(st, true));
    });
  }
  function copiaDoLogin(lp) {
    const c = lp.cloneNode(true); // mantém o id da raiz só pelo visual (#loginPage no CSS)
    c.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'));
    c.querySelectorAll('input').forEach(i => {
      i.removeAttribute('name');
      if (i.type === 'password') i.value = '•'.repeat(String(i.value || '').length); // não copia a senha
    });
    c.setAttribute('aria-hidden', 'true');
    c.inert = true;
    c.classList.add('tx-copia');
    return c;
  }
  document.addEventListener('auth:login', () => { try { aoEntrar(); } catch (_) {} });

  // ---------- Saída do sistema (Sair) ----------
  // Segura o clique no "Sair", cobre a tela e então repete o mesmo clique:
  // os ouvintes de sempre recebem o clique e fazem o logout igual a antes.
  let repetindo = false;
  document.addEventListener('click', ev => {
    if (repetindo || atual || !document.body) return;
    const b = ev.target?.closest?.(SEL_SAIR);
    if (!b) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    const info = { tipo: 'logout', ramo: ramoDaTela(), usuario: usuarioNome() };
    let st;
    try { st = montar(info, false, b); } catch (err) { console.warn('[TransicaoTopo]', err); repetir(b); return; }
    atual = st;
    const cobrir = TEMPO[st.est][0];
    requestAnimationFrame(() => progresso(st, 100, cobrir / 1000 + 0.2));
    depois(st, cobrir + 220, () => {
      repetir(b);
      esperar(st, () => visivel(document.getElementById('loginPage')), 150, 2500, () => descobrir(st, false));
    });
  }, true);
  function repetir(b) {
    repetindo = true;
    try {
      if (b.isConnected) b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      else if (typeof window.doLogout === 'function') window.doLogout();
    } catch (err) {
      console.error('[TransicaoTopo] Erro ao sair:', err);
    } finally {
      repetindo = false;
    }
  }

  // ---------- Descobre: o portal se fecha no lugar certo ----------
  function descobrir(st, comPulso) {
    if (!st || !st.vivo || st.saindo) return;
    st.saindo = true;
    liberarPagina();
    posicionar(st, 'descobrir'); // o alvo já está no lugar certo na tela nova
    st.el.classList.remove('tx-entra', 'tx-cheio');
    void st.el.offsetWidth;
    st.el.classList.add('tx-sai');
    setTimeout(() => {
      soltar(st);
      if (comPulso) pulsar(alvoDe(st, 'descobrir'));
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

  function pulsar(b) {
    if (!b || b.hidden || !b.classList.contains('company-switcher')) return;
    b.classList.remove('tx-pulso');
    void b.offsetWidth;
    b.classList.add('tx-pulso');
    setTimeout(() => b.classList.remove('tx-pulso'), 2000);
  }

  window.TransicaoTopo = { sair, entrar, soltar: () => soltar() };

  // Página recarregada por uma troca (ou logo após o login): continua daqui
  const recado = lerRecado();
  if (recado) {
    if (document.body) entrar(recado);
    else document.addEventListener('DOMContentLoaded', () => entrar(recado));
  } else {
    liberarPagina();
  }
})();
