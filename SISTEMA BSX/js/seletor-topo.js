// =====================================================================
// SELETORES DO TOPO (ramo e empresa)
// Menu próprio do sistema no lugar da lista nativa do navegador: mostra
// ícone, nome e detalhes, e funciona com mouse, teclado e toque.
// Os <select> originais (#ramoSelect e #empresaSelect) continuam na página,
// escondidos, como fonte de verdade: o resto do sistema (RBAC, empresa-shim,
// troca de empresa) segue lendo e ouvindo eles exatamente como antes.
// A última lista de empresas fica guardada no navegador (por usuário), então
// o seletor aparece na hora ao abrir/atualizar; o banco atualiza logo depois.
// Este arquivo carrega logo depois do topo da página (sem defer) de propósito.
// =====================================================================
(function () {
  'use strict';
  if (window.SeletorTopo) return;

  const NOMES_RAMO = { JB: 'JB', VG: 'Video game', FUTEBOL: 'Futebol' };
  const ORDEM_RAMOS = ['JB', 'VG', 'FUTEBOL'];
  // Ícones dos ramos: leão (JB), caça-níquel (Video game) e bola (Futebol).
  // Fonte: Pinhead Map Icons (licença CC0, uso livre). Grade 15x15, preenchidos.
  const ICONES_RAMO = {
    JB: 'M8.39 3.89S7.68 5 7 5H4.5c-.68 0-1.3.41-1.77.86L.5 8c-.27.26-.49.77-.5 1c-.02.5 0 1 0 1s1 0 1-1v-.5l1-1h.5l.16.29s-.95 1.82-.95 3.53c-.01.68.68.68.68.68h.68s.34 0 0-.34l-.34-.34c0-.68.77-1.65 1.27-2.32c0 0 .02 1.16 0 2c-.01.41.27 1 .68 1h.68s.34 0 0-.34l-.34-.34c-.31-.57.48-2.82.48-2.82c1.27 0 1.5.5 3 .5l.36 2.32c.12.71.64.68.64.68H11c.34 0 .96-.31.34-.77L11 11V9c1.21-.17 2-1 2-2h1c.32 0 1 0 1-.5v-1l-1.7-1.68C12.54 3.08 12 2.5 11 2.5c-1.45 0-2.14.57-2.61 1.39',
    VG: 'M8.57 0C9 0 9 .5 9 .5v1h.5c.5 0 .5.5.5.5h2c1 0 1 0 1 1v4.5s.5 0 .5.5h.5V4.5c-.37-.11-.5-.37-.5-.75c0-.37.38-.75.75-.75c.38 0 .75.38.75.75c0 .38-.17.61-.5.75v4.25c0 .25-.25.25-.25.25h-.75c0 .5-.5.5-.5.5V14c0 1 0 1-1 1H3c-1 0-1 0-1-1V3c0-1 0-1 1-1h2s0-.5.5-.5H6v-1s0-.5.5-.5zM10 13H5v1h5zm0-3H9v1h1zm-4 0H5v1h1zm2 0H7v1h1zm4-6H9.25v5H12zM8.82 4H6.13v5h2.69zM5.75 4H3v5h2.75zM7 .33c-.5 0-.5.17-.5.42v.75C6.75.75 7.25.5 8 .33zm2.5 4.42h.5c0 .25 1.38 0 1.38 0s.5 0 .25.25s-.75 2-.5 3H10c0-1.25.63-2.25.63-2.25s-.63-.25-.63 0h-.5zm-3.17 0h.5c0 .25 1.42 0 1.42 0s.5 0 .25.25s-.75 2-.5 3H6.83c0-1.25.67-2.25.67-2.25s-.67-.25-.67 0h-.5zm-3.08 0h.5c0 .25 1.38 0 1.38 0s.5 0 .25.25s-.75 2-.5 3H3.75c0-1.25.63-2.25.63-2.25s-.63-.25-.63 0h-.5z',
    FUTEBOL: 'M7.5.75c4.06 0 6.75 3.39 6.75 6.75c0 3.65-2.89 6.62-6.51 6.75H7.5C3.77 14.25.75 11.23.75 7.5C.75 3.5 4.08.75 7.5.75m1.37 8.99H6.14l-1.08 1.41l.76 1.81c.53.16 1.1.25 1.68.25c.59 0 1.15-.09 1.69-.25l.76-1.81zm2.89-3.34l-1.75.58l-.75 2.33l1.13 1.48l1.96-.28c.51-.81.82-1.76.86-2.78zm-8.51 0L1.79 7.75c.05 1 .35 1.94.85 2.75l1.98.29l1.13-1.48L5 6.98zM9.5 2.15l-1.71.97v1.9l1.99 1.44l1.8-.6l.38-1.91c-.63-.8-1.48-1.43-2.46-1.8M3.05 3.93l.37 1.92l1.8.6l1.99-1.44V3.12L5.5 2.16a5.7 5.7 0 0 0-2.45 1.77'
  };
  const iconeRamo = (ramo, tam = 16) =>
    `<svg viewBox="0 0 15 15" width="${tam}" height="${tam}" fill="currentColor" aria-hidden="true"><path d="${ICONES_RAMO[ramo] || ICONES_RAMO.JB}"/></svg>`;
  window.iconeRamo = iconeRamo;

  const SETA = '<svg class="sx-seta" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  const CHECK = '<svg class="sx-check" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  const GIRO = '<span class="sx-giro" aria-hidden="true"></span>';

  const ramoDe = e => (NOMES_RAMO[e?.ramo] ? e.ramo : 'JB');
  const CHAVE_ULTIMA = 'finx:ultimaEmpresa:';
  const CHAVE_CACHE = 'finx:seletorTopo:v1';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function ler(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function gravar(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  // Este arquivo roda antes do empresa-shim: lê a empresa direto do armazenamento
  function empresaAtual() {
    try { return String(window.getCompany?.() || ler('CURRENT_COMPANY') || 'BSX').toUpperCase(); }
    catch (_) { return 'BSX'; }
  }
  function usuarioAtual() {
    try {
      const s = JSON.parse(ler('APP_SESSION_V1') || 'null');
      return s && (s.id || s.username) ? String(s.id || s.username) : '';
    } catch (_) { return ''; }
  }
  const emojiDe = e => e?.emoji || (window.EMPRESA_EMOJI_FALLBACK || {})[String(e?.nome || '').toUpperCase()] || '🏢';

  // ---------- Lista guardada no navegador (por usuário) ----------
  function salvarCache(lista) {
    const u = usuarioAtual();
    if (!u || !Array.isArray(lista) || !lista.length) return;
    const enxuta = lista.map(e => ({ nome: e.nome, ramo: e.ramo || null, emoji: emojiDe(e) }));
    gravar(CHAVE_CACHE, JSON.stringify({ u, lista: enxuta }));
  }
  function lerCache() {
    try {
      const c = JSON.parse(ler(CHAVE_CACHE) || 'null');
      const u = usuarioAtual();
      return c && u && c.u === u && Array.isArray(c.lista) && c.lista.length ? c.lista : null;
    } catch (_) { return null; }
  }

  // ---------- Aplica a lista de empresas (já filtrada pelas permissões) ----------
  function aplicarLista(visiveis) {
    const sel = document.getElementById('empresaSelect');
    if (!sel || !Array.isArray(visiveis) || !visiveis.length) return;
    const atual = empresaAtual();

    // Ramo (JB / Video game / Futebol): a lista de empresas mostra só as do ramo atual
    let lista = visiveis;
    const temRamo = lista.some(e => e.ramo);
    const empAtual = lista.find(e => String(e.nome || '').toUpperCase() === atual);
    const ramoAtual = temRamo && empAtual ? ramoDe(empAtual) : null;
    atualizarRamo(temRamo ? lista : [], ramoAtual, atual);
    if (ramoAtual) lista = lista.filter(e => ramoDe(e) === ramoAtual);

    // Só reescreve as opções se algo mudou (nome, ordem ou emoji)
    const html = lista.map(e => {
      const nome = String(e.nome || '');
      const emoji = emojiDe(e);
      const selected = nome.toUpperCase() === atual ? ' selected' : '';
      return `<option value="${esc(nome)}" data-emoji="${esc(emoji)}" data-nome="${esc(nome)}"${selected}>${esc(emoji)} ${esc(nome)}</option>`;
    }).join('');
    if (sel.dataset.sig !== html) {
      sel.innerHTML = html;
      sel.dataset.sig = html;
    }

    const alvo = lista.find(e => String(e.nome || '').toUpperCase() === atual);
    if (!alvo && lista[0]) sel.value = lista[0].nome;
    else if (alvo && sel.value !== alvo.nome) sel.value = alvo.nome;

    // Troca de empresa (mesmo comportamento de antes: setCompany recarrega a página)
    if (!sel.__empresasWired) {
      sel.__empresasWired = true;
      sel.addEventListener('change', (e) => {
        const nova = e.target.value;
        if (!nova) return;
        try {
          if (typeof window.setCompany === 'function') window.setCompany(nova);
          else { localStorage.setItem('CURRENT_COMPANY', nova); location.reload(); }
        } catch (err) {
          console.error('[EmpresasSelector] Erro ao trocar empresa:', err);
        }
      });
    }
    renderizarTodos();
  }

  function atualizarRamo(lista, ramoAtual, empresaAtualNome) {
    const box = document.getElementById('ramoSwitcher');
    const sel = document.getElementById('ramoSelect');
    if (!box || !sel) return;
    const porRamo = r => lista.filter(e => ramoDe(e) === r);
    const ramos = ORDEM_RAMOS.filter(r => porRamo(r).length);
    // Só aparece quando o usuário tem empresas de mais de um ramo
    if (!ramoAtual || ramos.length < 2) { box.hidden = true; fecharMenu(); return; }
    box.hidden = false;
    // Ramo sem empresa aparece desabilitado (fica disponível quando a empresa for criada)
    const html = ORDEM_RAMOS.map(r => {
      const es = porRamo(r);
      const nomes = es.map(e => e.nome).join(', ');
      return `<option value="${r}" data-nome="${esc(NOMES_RAMO[r])}" data-qtd="${es.length}" data-nomes="${esc(nomes)}"${es.length ? '' : ' disabled'}>${esc(NOMES_RAMO[r])}${es.length ? '' : ' (sem empresa)'}</option>`;
    }).join('');
    if (sel.dataset.sig !== html) {
      sel.innerHTML = html;
      sel.dataset.sig = html;
    }
    if (sel.value !== ramoAtual) sel.value = ramoAtual;
    // Lembra a última empresa usada em cada ramo, para voltar nela
    gravar(CHAVE_ULTIMA + ramoAtual, empresaAtualNome);
    sel.__lista = lista;
    sel.__ramoAtual = ramoAtual;
    if (!sel.__wired) {
      sel.__wired = true;
      sel.addEventListener('change', () => {
        const novo = sel.value;
        if (novo === sel.__ramoAtual) return;
        const opcoes = (sel.__lista || []).filter(e => ramoDe(e) === novo);
        if (!opcoes.length) { sel.value = sel.__ramoAtual; renderizarTodos(); return; }
        const ultima = String(ler(CHAVE_ULTIMA + novo) || '').toUpperCase();
        const alvo = opcoes.find(e => String(e.nome || '').toUpperCase() === ultima) || opcoes[0];
        try {
          if (typeof window.setCompany === 'function') window.setCompany(alvo.nome);
          else { localStorage.setItem('CURRENT_COMPANY', alvo.nome); location.reload(); }
        } catch (err) {
          console.error('[EmpresasSelector] Erro ao trocar de ramo:', err);
          sel.value = sel.__ramoAtual;
          renderizarTodos();
        }
      });
    }
    renderizarTodos();
  }

  // ---------- Menu próprio ----------
  const seletores = [];
  let aberto = null;
  let saindo = false;
  window.addEventListener('beforeunload', () => { saindo = true; });
  window.addEventListener('pagehide', () => { saindo = true; });
  window.addEventListener('pageshow', () => { saindo = false; seletores.forEach(s => { s.carregando = null; renderizar(s); }); });

  function opcoes(s) {
    const atual = s.tipo === 'empresa' ? empresaAtual() : String(s.sel.value || '');
    const lista = Array.from(s.sel.options).filter(o => !o.hidden).map(o => {
      const txt = String(o.textContent || '').trim();
      let nome = o.dataset.nome || txt;
      let emoji = o.dataset.emoji || '';
      if (s.tipo === 'empresa' && !o.dataset.nome) {
        // Opções antigas vêm como "🏢 BSX": separa o emoji do nome
        const m = txt.match(/^(\S+)\s+(.+)$/);
        if (m && !/[A-Za-z0-9]/.test(m[1])) { emoji = m[1]; nome = m[2]; }
      }
      return {
        valor: o.value,
        nome,
        emoji,
        desab: o.disabled,
        atual: s.tipo === 'empresa' ? String(o.value).toUpperCase() === atual : o.value === atual,
        qtd: Number(o.dataset.qtd) || 0,
        nomes: o.dataset.nomes || ''
      };
    });
    if (!lista.some(o => o.atual)) {
      const marcado = lista.find(o => o.valor === s.sel.value);
      if (marcado) marcado.atual = true;
    }
    return lista;
  }

  function iconeDe(s, o, tam) {
    return s.tipo === 'ramo' ? iconeRamo(o.valor, tam) : `<span class="sx-emoji" aria-hidden="true">${esc(o.emoji || '🏢')}</span>`;
  }

  function renderizar(s) {
    const ops = opcoes(s);
    const cur = ops.find(o => o.atual) || ops[0];
    const rot = s.tipo === 'ramo' ? 'Ramo' : 'Empresa';
    let html;
    if (!cur) {
      html = `<span class="sx-ico"></span><span class="sx-txt"><span class="sx-cap">${rot}</span><span class="sx-val">—</span></span>${SETA}`;
    } else if (s.carregando) {
      html = `<span class="sx-ico">${iconeDe(s, s.carregando, 17)}</span><span class="sx-txt"><span class="sx-cap">Abrindo…</span><span class="sx-val">${esc(s.carregando.nome)}</span></span>${GIRO}`;
    } else {
      html = `<span class="sx-ico">${iconeDe(s, cur, 17)}</span><span class="sx-txt"><span class="sx-cap">${rot}</span><span class="sx-val">${esc(cur.nome)}</span></span>${SETA}`;
    }
    if (s.btn.__html !== html) {
      s.btn.innerHTML = html;
      s.btn.__html = html;
    }
    const titulo = cur ? `${rot}: ${cur.nome}` : rot;
    s.btn.title = titulo;
    s.btn.setAttribute('aria-label', titulo + ' (trocar)');
    s.btn.classList.toggle('sx-carregando', !!s.carregando);
    if (s.menu) montarItens(s);
  }
  function renderizarTodos() { seletores.forEach(renderizar); }

  function montarItens(s) {
    const ops = opcoes(s);
    let cab;
    if (s.tipo === 'ramo') {
      cab = '<div class="sx-cab">Ramo de atuação</div>';
    } else {
      const r = document.getElementById('ramoSelect')?.__ramoAtual;
      cab = `<div class="sx-cab">${r ? iconeRamo(r, 12) + ' Empresas · ' + esc(NOMES_RAMO[r]) : 'Empresas'}</div>`;
    }
    const itens = ops.map(o => {
      let sub = '';
      if (s.tipo === 'ramo') {
        sub = o.desab ? 'Nenhuma empresa cadastrada'
          : `${o.qtd} ${o.qtd === 1 ? 'empresa' : 'empresas'}${o.nomes ? ' · ' + o.nomes : ''}`;
      } else if (o.atual) {
        sub = 'Aberta agora';
      } else if (o.desab) {
        sub = 'Sem acesso';
      }
      return `<div class="sx-item${o.atual ? ' sx-atual' : ''}" role="option" tabindex="-1" data-valor="${esc(o.valor)}" aria-selected="${o.atual ? 'true' : 'false'}"${o.desab ? ' aria-disabled="true"' : ''}>
        <span class="sx-ico">${iconeDe(s, o, 18)}</span>
        <span class="sx-txt"><span class="sx-item-t">${esc(o.nome)}</span>${sub ? `<span class="sx-item-s">${esc(sub)}</span>` : ''}</span>
        ${o.atual ? CHECK : ''}
      </div>`;
    }).join('');
    const html = cab + `<div class="sx-lista">${itens || '<div class="sx-vazio">Nenhuma opção disponível</div>'}</div>`;
    if (s.menu.__html === html) return;
    const foco = document.activeElement?.closest?.('.sx-item')?.dataset.valor;
    s.menu.innerHTML = html;
    s.menu.__html = html;
    if (foco) itensAtivos(s).find(i => i.dataset.valor === foco)?.focus();
  }

  const itensAtivos = s => Array.from(s.menu?.querySelectorAll('.sx-item:not([aria-disabled="true"])') || []);

  function posicionar(s) {
    const m = s.menu;
    if (!m) return;
    const r = s.box.getBoundingClientRect();
    if (!r.width && !r.height) { fecharMenu(); return; }
    const vw = document.documentElement.clientWidth || window.innerWidth;
    const vh = window.innerHeight;
    const larg = Math.min(Math.max(r.width, s.tipo === 'ramo' ? 300 : 250), vw - 16);
    const esq = Math.min(Math.max(8, r.left), vw - larg - 8);
    const topo = r.bottom + 6;
    m.style.width = larg + 'px';
    m.style.left = esq + 'px';
    m.style.top = topo + 'px';
    m.style.maxHeight = Math.max(160, vh - topo - 12) + 'px';
  }

  function abrirMenu(s, foco = 'atual') {
    if (s.carregando) return;
    fecharMenu();
    const menu = document.createElement('div');
    menu.className = 'sx-menu sx-menu-' + s.tipo;
    menu.id = 'sxMenu-' + s.tipo;
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', s.tipo === 'ramo' ? 'Escolher ramo' : 'Escolher empresa');
    document.body.appendChild(menu);
    s.menu = menu;
    aberto = s;
    s.box.classList.add('sx-aberto');
    s.btn.setAttribute('aria-expanded', 'true');
    s.btn.setAttribute('aria-controls', menu.id);
    montarItens(s);
    posicionar(s);
    menu.addEventListener('click', ev => {
      const it = ev.target.closest('.sx-item');
      if (it) escolher(s, it.dataset.valor);
    });
    menu.addEventListener('keydown', ev => teclado(s, ev));
    menu.addEventListener('mousemove', ev => {
      const it = ev.target.closest('.sx-item:not([aria-disabled="true"])');
      if (it && document.activeElement !== it) it.focus({ preventScroll: true });
    });
    const itens = itensAtivos(s);
    const alvo = foco === 'ultimo' ? itens[itens.length - 1]
      : (itens.find(i => i.getAttribute('aria-selected') === 'true') || itens[0]);
    alvo?.focus({ preventScroll: true });
    alvo?.scrollIntoView?.({ block: 'nearest' });
  }

  function fecharMenu(devolverFoco) {
    const s = aberto;
    if (!s) return;
    aberto = null;
    s.menu?.remove();
    s.menu = null;
    s.box.classList.remove('sx-aberto');
    s.btn.setAttribute('aria-expanded', 'false');
    s.btn.removeAttribute('aria-controls');
    if (devolverFoco) s.btn.focus({ preventScroll: true });
  }

  function escolher(s, valor) {
    const o = opcoes(s).find(x => x.valor === valor);
    if (!o || o.desab) return;
    fecharMenu(true);
    if (o.atual) return;
    s.carregando = o;
    renderizar(s);
    s.sel.value = valor;
    s.sel.dispatchEvent(new Event('change', { bubbles: true }));
    // Se a troca não recarregou a página (ex.: usuário sem acesso), volta ao normal
    setTimeout(() => {
      if (saindo || !s.carregando) return;
      s.carregando = null;
      if (s.tipo === 'ramo') { const r = s.sel.__ramoAtual; if (r) s.sel.value = r; }
      renderizar(s);
    }, 4000);
  }

  function teclado(s, ev) {
    const itens = itensAtivos(s);
    const i = itens.indexOf(document.activeElement);
    const ir = n => { const it = itens[(n + itens.length) % itens.length]; it?.focus(); it?.scrollIntoView?.({ block: 'nearest' }); };
    switch (ev.key) {
      case 'ArrowDown': ev.preventDefault(); ir(i + 1); break;
      case 'ArrowUp': ev.preventDefault(); ir(i < 0 ? -1 : i - 1); break;
      case 'Home': ev.preventDefault(); ir(0); break;
      case 'End': ev.preventDefault(); ir(-1); break;
      case 'Enter':
      case ' ':
        ev.preventDefault();
        if (i >= 0) escolher(s, itens[i].dataset.valor);
        break;
      case 'Escape': ev.preventDefault(); fecharMenu(true); break;
      case 'Tab': fecharMenu(true); ev.preventDefault(); break;
      default:
        // Digitar a primeira letra pula para a opção
        if (ev.key.length === 1 && /\S/.test(ev.key)) {
          const l = ev.key.toLowerCase();
          const ord = itens.slice(i + 1).concat(itens.slice(0, i + 1));
          const hit = ord.find(it => (it.querySelector('.sx-item-t')?.textContent || '').trim().toLowerCase().startsWith(l));
          if (hit) { hit.focus(); hit.scrollIntoView?.({ block: 'nearest' }); }
        }
    }
  }

  function criar(box, sel, tipo) {
    if (!box || !sel) return null;
    if (box.__sx) return box.__sx;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sx-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    box.appendChild(btn);
    box.classList.add('sx-on', 'sx-' + tipo);
    box.removeAttribute('title');
    const s = { box, sel, tipo, btn, menu: null, carregando: null };
    box.__sx = s;
    seletores.push(s);
    btn.addEventListener('click', () => (aberto === s ? fecharMenu(true) : abrirMenu(s)));
    btn.addEventListener('keydown', ev => {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp' || ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        if (aberto === s && (ev.key === 'Enter' || ev.key === ' ')) fecharMenu(true);
        else abrirMenu(s, ev.key === 'ArrowUp' ? 'ultimo' : 'atual');
      }
    });
    // Qualquer mudança nas opções (banco, permissões do RBAC) atualiza o botão
    new MutationObserver(() => renderizar(s)).observe(sel, { childList: true, subtree: true, attributes: true, characterData: true });
    sel.addEventListener('change', () => { if (!s.carregando) renderizar(s); });
    renderizar(s);
    return s;
  }

  // Fecha ao clicar fora, ao sair da janela; reposiciona ao rolar/redimensionar
  document.addEventListener('pointerdown', ev => {
    if (!aberto) return;
    if (aberto.menu?.contains(ev.target) || aberto.box.contains(ev.target)) return;
    fecharMenu();
  }, true);
  window.addEventListener('resize', () => aberto && posicionar(aberto));
  window.addEventListener('scroll', ev => {
    if (!aberto || aberto.menu?.contains(ev.target)) return;
    posicionar(aberto);
  }, true);
  window.addEventListener('blur', () => fecharMenu());
  document.addEventListener('visibilitychange', () => { if (document.hidden) fecharMenu(); });

  function iniciar() {
    const selEmp = document.getElementById('empresaSelect');
    criar(selEmp?.closest('.company-switcher'), selEmp, 'empresa');
    criar(document.getElementById('ramoSwitcher'), document.getElementById('ramoSelect'), 'ramo');
    // Mostra na hora com a última lista conhecida; o banco atualiza em seguida
    const cache = lerCache();
    if (cache) {
      aplicarLista(cache);
      const emp = cache.find(e => String(e.nome || '').toUpperCase() === empresaAtual());
      if (emp && ramoDe(emp) === 'VG') document.body?.classList.add('ramo-vg');
    }
  }

  window.SeletorTopo = { aplicarLista, salvarCache, renderizar: renderizarTodos, fechar: () => fecharMenu() };

  if (document.getElementById('empresaSelect')) iniciar();
  else document.addEventListener('DOMContentLoaded', iniciar);
})();
