// ============================================
// PÁGINA DE EMPRESAS (submenu próprio, só admin)
// ============================================
(function () {
  'use strict';

  if (window.__EMPRESAS_PAGE_LOADED__) return;
  window.__EMPRESAS_PAGE_LOADED__ = true;

  let __cache = [];       // { id, nome, emoji, ativo }
  let __stats = [];       // stats por empresa
  let __editingId = null;

  // ============================================
  // HELPERS
  // ============================================
  function esc(s) {
    const map = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
    return String(s ?? '').replace(/[&<>"']/g, m => map[m] || m);
  }

  function notify(msg, type) {
    if (window.showNotification) window.showNotification(msg, type || 'info');
    else if (type === 'error') alert('❌ ' + msg);
  }

  function isAdmin() {
    try {
      // ✅ UserAuth NÃO expõe isAdmin() — é preciso ler currentUser().role
      // Fallbacks:
      //   1) currentUser().role === 'admin' (via auth-rbac.js)
      //   2) window.currentUser?.role === 'admin' (auth.js legado)
      //   3) window.currentUser?.isAdmin === true (compat toCompat)
      const cu = window.UserAuth?.currentUser?.() || window.currentUser || null;
      if (!cu) return false;
      if (cu.role === 'admin') return true;
      if (cu.isAdmin === true) return true;
      return false;
    } catch(_) { return false; }
  }

  // ============================================
  // LOADS
  // ============================================
  async function loadEmpresas() {
    try {
      if (!window.SupabaseAPI?.empresas) return [];
      __cache = await window.SupabaseAPI.empresas.getAll();
      return __cache;
    } catch (e) { console.error('[Empresas] load:', e); return []; }
  }

  async function loadStats() {
    try {
      if (!window.SupabaseAPI?.empresas?.getEstatisticas) return [];
      __stats = await window.SupabaseAPI.empresas.getEstatisticas();
      return __stats;
    } catch (e) { console.error('[Empresas] stats:', e); return []; }
  }

  // ============================================
  // RENDERS
  // ============================================
  function setTxt(id, v) {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  }

  function renderKPIs() {
    const ativas   = __stats.filter(s => s.ativo).length;
    const total    = __stats.length;
    const gerTotal = __stats.reduce((a, s) => a + (s.gerentes_ativos || 0), 0);
    const prestSem = __stats.reduce((a, s) => a + (s.prest_semana_aberta || 0) + (s.prest_semana_fechada || 0), 0);
    const prestMes = __stats.reduce((a, s) => a + (s.prest_mes_aberta || 0) + (s.prest_mes_fechada || 0), 0);
    setTxt('kpiEmpAtivas', ativas);
    setTxt('kpiEmpTotal', total + ' no total');
    setTxt('kpiEmpGerentes', gerTotal);
    setTxt('kpiEmpPrestSem', prestSem);
    setTxt('kpiEmpPrestMes', prestMes);
  }

  function ramoBadge(id) {
    const ramo = __cache.find(c => c.id === id)?.ramo;
    if (!ramo) return '';
    return `<span title="Prestação de contas liberada" style="background:#eef2ff; color:#3730a3; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:600; display:inline-flex; align-items:center; gap:4px;">${window.iconeRamo ? window.iconeRamo(ramo, 13) : ''}${esc(window.RamoEmpresa?.nome?.(ramo) || ramo)}</span>`;
  }

  function renderResumoCards() {
    const wrap = document.getElementById('empresasResumoCards');
    if (!wrap) return;
    if (!__stats.length) {
      wrap.innerHTML = '<div style="color:#6b7280; padding:20px; text-align:center;">Nenhuma empresa cadastrada.</div>';
      return;
    }

    // Ordena: ativas primeiro, depois alfabético
    const ordenados = __stats.slice().sort((a, b) => {
      if (a.ativo !== b.ativo) return b.ativo - a.ativo;
      return String(a.nome).localeCompare(String(b.nome));
    });

    wrap.innerHTML = ordenados.map(s => {
      const statusBadge = s.ativo
        ? '<span style="background:#d1fae5; color:#065f46; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:600;">ATIVA</span>'
        : '<span style="background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:600;">INATIVA</span>';

      const bg = s.ativo ? '#ffffff' : '#f9fafb';
      const opacity = s.ativo ? '1' : '0.7';

      return `
        <div style="border:1px solid #e5e7eb; border-radius:12px; padding:16px; background:${bg}; opacity:${opacity};" data-emp-id="${esc(s.id)}">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:28px;">${esc(s.emoji || (window.EMPRESA_EMOJI_FALLBACK||{})[String(s.nome).toUpperCase()] || '🏢')}</span>
              <strong style="font-size:16px;">${esc(s.nome)}</strong>
              ${ramoBadge(s.id)}
            </div>
            ${statusBadge}
          </div>

          <!-- Grid de mini KPIs -->
          <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:8px; margin-top:12px;">

            <!-- Gerentes -->
            <div style="background:#f0f9ff; padding:10px; border-radius:8px;">
              <div style="font-size:11px; color:#075985; font-weight:600;">GERENTES</div>
              <div style="font-size:20px; font-weight:700; color:#0369a1;">${s.gerentes_ativos}</div>
              <div style="font-size:10px; color:#0284c7;">${s.gerentes_semanais} sem • ${s.gerentes_mensais} mês</div>
            </div>

            <!-- Máquinas -->
            <div style="background:#f0fdf4; padding:10px; border-radius:8px;">
              <div style="font-size:11px; color:#166534; font-weight:600;">MÁQUINAS</div>
              <div style="font-size:20px; font-weight:700; color:#15803d;">${s.maquinas_total}</div>
              <div style="font-size:10px; color:#22c55e;">${s.maquinas_com_vendedor} c/ vendedor</div>
            </div>

            <!-- Prestações semana -->
            <div style="background:#fef3c7; padding:10px; border-radius:8px;">
              <div style="font-size:11px; color:#92400e; font-weight:600;">📅 SEMANA</div>
              <div style="font-size:20px; font-weight:700; color:#b45309;">${s.prest_semana_aberta + s.prest_semana_fechada}</div>
              <div style="font-size:10px; color:#a16207;">${s.prest_semana_aberta} aberta(s) • ${s.prest_semana_fechada} fechada(s)</div>
            </div>

            <!-- Prestações mês -->
            <div style="background:#ede9fe; padding:10px; border-radius:8px;">
              <div style="font-size:11px; color:#5b21b6; font-weight:600;">🗓️ MÊS</div>
              <div style="font-size:20px; font-weight:700; color:#6d28d9;">${s.prest_mes_aberta + s.prest_mes_fechada}</div>
              <div style="font-size:10px; color:#7c3aed;">${s.prest_mes_aberta} aberta(s) • ${s.prest_mes_fechada} fechada(s)</div>
            </div>
          </div>

          <!-- Ações -->
          <div style="display:flex; gap:6px; margin-top:14px; justify-content:flex-end;">
            <button class="btn ghost" data-emp-act="editar" data-tip="Editar dados">✏️ Editar</button>
            ${s.ativo
              ? '<button class="btn ghost" data-emp-act="inativar" data-tip="Inativar (não aparece no seletor)">🚫 Inativar</button>'
              : '<button class="btn" data-emp-act="ativar" data-tip="Reativar">↩️ Ativar</button>'
            }
            <button class="btn danger" data-emp-act="excluir" data-tip="Excluir permanentemente (só se sem dados)">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // ============================================
  // FORM CADASTRO
  // ============================================
  // Popula o <select> de emojis com as opções padrão
  function popularSelectEmoji(valorSelecionado) {
    const sel = document.getElementById('empEmojiSelect');
    if (!sel) return;
    const opts = window.EMPRESA_EMOJI_OPTIONS || [{ emoji: '🏢', label: 'Prédio' }];
    sel.innerHTML = opts.map(o =>
      `<option value="${esc(o.emoji)}">${esc(o.emoji)}  ${esc(o.label)}</option>`
    ).join('');
    if (valorSelecionado) {
      // Se o emoji atual não estiver nas opções, adiciona no topo
      if (!opts.some(o => o.emoji === valorSelecionado)) {
        const opt = document.createElement('option');
        opt.value = valorSelecionado;
        opt.textContent = valorSelecionado + '  (personalizado)';
        sel.insertBefore(opt, sel.firstChild);
      }
      sel.value = valorSelecionado;
    }
  }

  function resetForm() {
    const f = document.getElementById('formEmpresa');
    if (!f) return;
    f.reset();
    __editingId = null;
    f.querySelector('#empAtivo').checked = true;
    popularSelectEmoji('🏢');   // reseta para o padrão
    document.getElementById('btnSalvarEmpresa').textContent = 'Salvar Empresa';
  }

  function carregarParaEdicao(emp) {
    const f = document.getElementById('formEmpresa');
    if (!f) return;
    __editingId = emp.id;
    f.nome.value = emp.nome || '';
    popularSelectEmoji(emp.emoji || '🏢');
    f.querySelector('#empAtivo').checked = !!emp.ativo;
    if (f.ramo) f.ramo.value = emp.ramo || 'JB';
    document.getElementById('btnSalvarEmpresa').textContent = 'Atualizar Empresa';
    f.scrollIntoView({ behavior:'smooth', block:'center' });
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!isAdmin()) { notify('Apenas admin.', 'error'); return; }
    const f = e.currentTarget;
    const fd = new FormData(f);
    const nome  = String(fd.get('nome') || '').trim();
    const emoji = String(fd.get('emoji') || '🏢').trim() || '🏢';
    const ativo = !!fd.get('ativo');
    const ramo  = String(fd.get('ramo') || 'JB');
    if (!nome) { notify('Informe o nome.', 'error'); return; }

    try {
      if (__editingId) {
        await window.SupabaseAPI.empresas.update(__editingId, { nome, emoji, ativo, ramo });
        notify('Empresa atualizada!', 'success');
      } else {
        await window.SupabaseAPI.empresas.create({ nome, emoji, ativo, ramo });
        notify('Empresa cadastrada!', 'success');
      }
      resetForm();
      await render();
      try { window.__reloadEmpresaSelector?.(); } catch(_){}
      try { window.RamoEmpresa?.recarregar?.(); } catch(_){}
    } catch (err) {
      alert('⚠️ ' + (/ramo/i.test(String(err.message || ''))
        ? 'Falta atualizar o banco: rode o arquivo db/empresas-ramo.sql no Supabase.'
        : (err.message || 'Erro ao salvar')));
    }
  }

  async function inativarEmp(emp) {
    if (!isAdmin()) return;
    if (!confirm(`Inativar "${emp.nome}"?\n\nEla deixa de aparecer no seletor. Você pode reativar depois.`)) return;
    try {
      await window.SupabaseAPI.empresas.update(emp.id, { ativo: false });
      notify('Empresa inativada.', 'success');
      await render();
      try { window.__reloadEmpresaSelector?.(); } catch(_){}
    } catch (err) { alert('⚠️ ' + (err.message || 'Erro')); }
  }

  async function ativarEmp(emp) {
    if (!isAdmin()) return;
    try {
      await window.SupabaseAPI.empresas.update(emp.id, { ativo: true });
      notify('Empresa reativada.', 'success');
      await render();
      try { window.__reloadEmpresaSelector?.(); } catch(_){}
    } catch (err) { alert('⚠️ ' + (err.message || 'Erro')); }
  }

  async function excluirEmp(emp) {
    if (!isAdmin()) return;
    if (!confirm(`Excluir PERMANENTEMENTE "${emp.nome}"?\n\nSó é possível se não houver gerentes, prestações, despesas ou fichas vinculadas.`)) return;
    if (!confirm('Tem certeza absoluta? Esta ação NÃO pode ser desfeita.')) return;
    try {
      await window.SupabaseAPI.empresas.delete(emp.id);
      notify('Empresa excluída.', 'success');
      await render();
      try { window.__reloadEmpresaSelector?.(); } catch(_){}
    } catch (err) {
      alert('⚠️ ' + (err.message || 'Erro ao excluir'));
    }
  }

  // ============================================
  // EVENTS
  // ============================================
  function bindEvents() {
    const f = document.getElementById('formEmpresa');
    if (f && !f.__wired) {
      f.__wired = true;
      f.addEventListener('submit', onSubmit);
    }
    const btnL = document.getElementById('btnLimparEmpresa');
    if (btnL && !btnL.__wired) {
      btnL.__wired = true;
      btnL.addEventListener('click', resetForm);
    }
    const btnA = document.getElementById('btnAtualizarEmpresas');
    if (btnA && !btnA.__wired) {
      btnA.__wired = true;
      btnA.addEventListener('click', async () => {
        btnA.disabled = true;
        await render();
        btnA.disabled = false;
        notify('Atualizado!', 'success');
      });
    }

    // Delegation nos cards
    const wrap = document.getElementById('empresasResumoCards');
    if (wrap && !wrap.__wired) {
      wrap.__wired = true;
      wrap.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-emp-act]');
        if (!btn) return;
        const card = btn.closest('[data-emp-id]');
        const id = card?.getAttribute('data-emp-id');
        const emp = __cache.find(x => String(x.id) === String(id));
        if (!emp) return;
        const act = btn.getAttribute('data-emp-act');
        if (act === 'editar')   return carregarParaEdicao(emp);
        if (act === 'inativar') return inativarEmp(emp);
        if (act === 'ativar')   return ativarEmp(emp);
        if (act === 'excluir')  return excluirEmp(emp);
      });
    }
  }

  async function render() {
    await Promise.all([ loadEmpresas(), loadStats() ]);
    renderKPIs();
    renderResumoCards();
  }

  async function init() {
    // ⛔ Bloqueio duro: só admin. Se qualquer usuário comum conseguir
    // navegar para esta página (ex.: por hash direto), a UI mostra
    // mensagem de acesso negado em vez de carregar dados.
    if (!isAdmin()) {
      const wrap = document.getElementById('empresasResumoCards');
      if (wrap) {
        wrap.innerHTML = `
          <div style="grid-column:1/-1; padding:24px; text-align:center; background:#fef2f2; border:1px solid #fca5a5; border-radius:12px;">
            <div style="font-size:36px; margin-bottom:8px;">🔒</div>
            <strong style="color:#991b1b;">Acesso restrito a administradores</strong>
            <div style="font-size:12px; color:#7f1d1d; margin-top:6px;">
              Esta área é exclusiva para admin. Se precisa de acesso, fale com um administrador do sistema.
            </div>
          </div>`;
      }
      // Esconde form e KPIs também (o guard() do RBAC já faz, mas garantia extra)
      const form = document.getElementById('formEmpresa');
      if (form) form.closest('.card').style.display = 'none';
      const kpis = document.getElementById('empresasKPIs');
      if (kpis) kpis.style.display = 'none';
      return;
    }
    bindEvents();
    popularSelectEmoji('🏢');   // popula o select de ícones do form
    await render();
  }

  window.EmpresasPage = { init, render };
  window.renderEmpresasPage = render;

  console.log('[Empresas] ✅ Página carregada');
})();


// ============================================
// SELETOR DE EMPRESA (TOPO) — populado dinamicamente
// ============================================
//
// ✅ Fallback de ícones — preserva os emojis históricos do HTML
// para empresas antigas que possam não ter emoji definido no banco.
// Se o banco tem emoji, usa o do banco; senão, usa o fallback.
window.EMPRESA_EMOJI_FALLBACK = {
  'BSX':     '🏢',
  'BSXTV':   '📺',
  'BETPLAY': '🎮',
  'EMANUEL': '👤'
};

// ✅ Opções padrão para o cadastro escolher (usadas pelo formulário)
window.EMPRESA_EMOJI_OPTIONS = [
  { emoji: '🏢', label: 'Prédio' },
  { emoji: '📺', label: 'TV' },
  { emoji: '🎮', label: 'Game' },
  { emoji: '🎰', label: 'Caça-níquel' },
  { emoji: '👤', label: 'Pessoa' },
  { emoji: '🏬', label: 'Loja' },
  { emoji: '🏭', label: 'Fábrica' },
  { emoji: '🏦', label: 'Banco' },
  { emoji: '🏛️', label: 'Institucional' },
  { emoji: '💼', label: 'Executivo' },
  { emoji: '🛍️', label: 'Sacola' },
  { emoji: '📱', label: 'Celular' },
  { emoji: '💳', label: 'Cartão' },
  { emoji: '⚙️', label: 'Engrenagem' },
  { emoji: '🚀', label: 'Foguete' }
];

(function () {
  'use strict';

  // Retorna a lista de empresas (em UPPERCASE) que o usuário tem acesso.
  // Array vazio = SEM restrição (admin ou usuário legado sem limitação).
  function empresasPermitidas() {
    try {
      const cu = window.UserAuth?.currentUser?.();
      if (!cu) return [];
      if (cu.role === 'admin') return [];  // admin vê tudo
      const arr = Array.isArray(cu.companies) ? cu.companies : [];
      return arr.map(c => String(c).toUpperCase());
    } catch (_) { return []; }
  }

  async function reloadSelector() {
    const sel = document.getElementById('empresaSelect');
    if (!sel) return;
    if (!window.SupabaseAPI?.empresas) {
      return setTimeout(reloadSelector, 500);
    }
    // ⚠️  Não mexer no select se o usuário está interagindo com ele agora
    // (no mobile isso "cancela" o toque e a seleção não confirma).
    if (document.activeElement === sel) {
      console.log('[EmpresasSelector] Select em foco — adiando reload.');
      return setTimeout(reloadSelector, 800);
    }
    try {
      const empresas = await window.SupabaseAPI.empresas.getAll({ ativasApenas: true });
      if (!empresas.length) return;

      // ✅ Filtra pelas empresas que o usuário tem acesso
      const permitidas = empresasPermitidas();
      let visiveis = empresas;
      if (permitidas.length > 0) {
        visiveis = empresas.filter(e =>
          permitidas.includes(String(e.nome || '').toUpperCase())
        );
      }
      if (!visiveis.length) {
        visiveis = empresas.filter(e =>
          String(e.nome || '').toUpperCase() === (window.getCompany?.() || 'BSX').toUpperCase()
        );
        if (!visiveis.length) return;
      }

      const atual = (window.getCompany?.() || 'BSX').toUpperCase();
      const fallback = window.EMPRESA_EMOJI_FALLBACK || {};

      // ✅ Ramo (JB / Video game / Futebol): seletor ao lado, e a lista de empresas
      // mostra só as do ramo da empresa atual. Sem a coluna ramo no banco, nada muda.
      const temRamo = visiveis.some(e => e.ramo);
      const empAtual = visiveis.find(e => String(e.nome || '').toUpperCase() === atual);
      const ramoAtual = temRamo && empAtual ? ramoDe(empAtual) : null;
      atualizarSeletorRamo(temRamo ? visiveis : [], ramoAtual, atual);
      if (ramoAtual) visiveis = visiveis.filter(e => ramoDe(e) === ramoAtual);

      // ✅ Gera a nova lista e SÓ substitui se o conjunto de opções mudou.
      // Isso evita destruir o listener e resetar interações no mobile.
      const novoHTML = visiveis.map(e => {
        const nome = e.nome || '';
        const emoji = e.emoji || fallback[nome.toUpperCase()] || '🏢';
        const selected = nome.toUpperCase() === atual ? 'selected' : '';
        return `<option value="${nome}" ${selected}>${emoji} ${nome}</option>`;
      }).join('');

      // Compara a lista de valores atual com a nova (rápido)
      const atualValores = Array.from(sel.options).map(o => o.value).join('|');
      const novaListaValores = visiveis.map(e => e.nome).join('|');

      if (atualValores !== novaListaValores) {
        sel.innerHTML = novoHTML;
      }

      // Ajusta visualmente qual está selecionada, sem disparar change
      const currentIsVisible = visiveis.some(e => String(e.nome).toUpperCase() === atual);
      if (!currentIsVisible && visiveis[0]) {
        sel.value = visiveis[0].nome;
      } else {
        // Só ajusta se estiver diferente pra não disparar change no mobile
        const alvo = visiveis.find(e => String(e.nome).toUpperCase() === atual)?.nome;
        if (alvo && sel.value !== alvo) sel.value = alvo;
      }

      // ✅ Garante que o listener de change EXISTE
      // (se por acaso foi perdido em algum re-render)
      if (!sel.__empresasWired) {
        sel.__empresasWired = true;
        sel.addEventListener('change', (e) => {
          const novaEmpresa = e.target.value;
          if (!novaEmpresa) return;
          try {
            if (typeof window.setCompany === 'function') {
              window.setCompany(novaEmpresa);
            } else {
              localStorage.setItem('CURRENT_COMPANY', novaEmpresa);
              location.reload();
            }
          } catch (err) {
            console.error('[EmpresasSelector] Erro ao trocar empresa:', err);
          }
        });
      }
    } catch (e) {
      console.warn('[EmpresasSelector] Falha:', e);
    }
  }

  // ---------- Seletor de ramo ----------
  const NOMES_RAMO = { JB: 'JB', VG: 'Video game', FUTEBOL: 'Futebol' };
  // Ícones dos ramos: leão (JB), caça-níquel (Video game) e bola (Futebol).
  // Fonte: Pinhead Map Icons (licença CC0, uso livre). Grade 15x15, preenchidos.
  const ICONES_RAMO = {
    JB: 'M8.39 3.89S7.68 5 7 5H4.5c-.68 0-1.3.41-1.77.86L.5 8c-.27.26-.49.77-.5 1c-.02.5 0 1 0 1s1 0 1-1v-.5l1-1h.5l.16.29s-.95 1.82-.95 3.53c-.01.68.68.68.68.68h.68s.34 0 0-.34l-.34-.34c0-.68.77-1.65 1.27-2.32c0 0 .02 1.16 0 2c-.01.41.27 1 .68 1h.68s.34 0 0-.34l-.34-.34c-.31-.57.48-2.82.48-2.82c1.27 0 1.5.5 3 .5l.36 2.32c.12.71.64.68.64.68H11c.34 0 .96-.31.34-.77L11 11V9c1.21-.17 2-1 2-2h1c.32 0 1 0 1-.5v-1l-1.7-1.68C12.54 3.08 12 2.5 11 2.5c-1.45 0-2.14.57-2.61 1.39',
    VG: 'M8.57 0C9 0 9 .5 9 .5v1h.5c.5 0 .5.5.5.5h2c1 0 1 0 1 1v4.5s.5 0 .5.5h.5V4.5c-.37-.11-.5-.37-.5-.75c0-.37.38-.75.75-.75c.38 0 .75.38.75.75c0 .38-.17.61-.5.75v4.25c0 .25-.25.25-.25.25h-.75c0 .5-.5.5-.5.5V14c0 1 0 1-1 1H3c-1 0-1 0-1-1V3c0-1 0-1 1-1h2s0-.5.5-.5H6v-1s0-.5.5-.5zM10 13H5v1h5zm0-3H9v1h1zm-4 0H5v1h1zm2 0H7v1h1zm4-6H9.25v5H12zM8.82 4H6.13v5h2.69zM5.75 4H3v5h2.75zM7 .33c-.5 0-.5.17-.5.42v.75C6.75.75 7.25.5 8 .33zm2.5 4.42h.5c0 .25 1.38 0 1.38 0s.5 0 .25.25s-.75 2-.5 3H10c0-1.25.63-2.25.63-2.25s-.63-.25-.63 0h-.5zm-3.17 0h.5c0 .25 1.42 0 1.42 0s.5 0 .25.25s-.75 2-.5 3H6.83c0-1.25.67-2.25.67-2.25s-.67-.25-.67 0h-.5zm-3.08 0h.5c0 .25 1.38 0 1.38 0s.5 0 .25.25s-.75 2-.5 3H3.75c0-1.25.63-2.25.63-2.25s-.63-.25-.63 0h-.5z',
    FUTEBOL: 'M7.5.75c4.06 0 6.75 3.39 6.75 6.75c0 3.65-2.89 6.62-6.51 6.75H7.5C3.77 14.25.75 11.23.75 7.5C.75 3.5 4.08.75 7.5.75m1.37 8.99H6.14l-1.08 1.41l.76 1.81c.53.16 1.1.25 1.68.25c.59 0 1.15-.09 1.69-.25l.76-1.81zm2.89-3.34l-1.75.58l-.75 2.33l1.13 1.48l1.96-.28c.51-.81.82-1.76.86-2.78zm-8.51 0L1.79 7.75c.05 1 .35 1.94.85 2.75l1.98.29l1.13-1.48L5 6.98zM9.5 2.15l-1.71.97v1.9l1.99 1.44l1.8-.6l.38-1.91c-.63-.8-1.48-1.43-2.46-1.8M3.05 3.93l.37 1.92l1.8.6l1.99-1.44V3.12L5.5 2.16a5.7 5.7 0 0 0-2.45 1.77'
  };
  window.iconeRamo = (ramo, tam = 16) =>
    `<svg viewBox="0 0 15 15" width="${tam}" height="${tam}" fill="currentColor" aria-hidden="true"><path d="${ICONES_RAMO[ramo] || ICONES_RAMO.JB}"/></svg>`;
  function mostrarIconeRamo(box, ramo) {
    const ico = box?.querySelector('.company-switcher-icon');
    if (!ico || ico.dataset.ramo === ramo) return;
    ico.innerHTML = window.iconeRamo(ramo);
    ico.dataset.ramo = ramo;
    box.title = 'Ramo: ' + (NOMES_RAMO[ramo] || ramo);
  }
  const ramoDe = e => (NOMES_RAMO[e?.ramo] ? e.ramo : 'JB');
  const CHAVE_ULTIMA = 'finx:ultimaEmpresa:';

  function atualizarSeletorRamo(lista, ramoAtual, empresaAtual) {
    const box = document.getElementById('ramoSwitcher');
    const sel = document.getElementById('ramoSelect');
    if (!box || !sel) return;
    const ramos = ['JB', 'VG', 'FUTEBOL'].filter(r => lista.some(e => ramoDe(e) === r));
    // Só aparece quando o usuário tem empresas de mais de um ramo
    if (!ramoAtual || ramos.length < 2) { box.hidden = true; return; }
    box.hidden = false;
    const chaveLista = ramos.join('|');
    if (sel.dataset.lista !== chaveLista) {
      // Ramo sem empresa aparece desabilitado (fica disponível quando a empresa for criada)
      sel.innerHTML = ['JB', 'VG', 'FUTEBOL'].map(r => ramos.includes(r)
        ? `<option value="${r}">${NOMES_RAMO[r]}</option>`
        : `<option value="${r}" disabled>${NOMES_RAMO[r]} (sem empresa)</option>`).join('');
      sel.dataset.lista = chaveLista;
    }
    if (document.activeElement !== sel && sel.value !== ramoAtual) sel.value = ramoAtual;
    mostrarIconeRamo(box, ramoAtual);
    // Lembra a última empresa usada em cada ramo, para voltar nela
    try { localStorage.setItem(CHAVE_ULTIMA + ramoAtual, empresaAtual); } catch (_) {}
    sel.__lista = lista;
    sel.__ramoAtual = ramoAtual;
    if (sel.__wired) return;
    sel.__wired = true;
    sel.addEventListener('change', () => {
      const novo = sel.value;
      if (novo === sel.__ramoAtual) return;
      const opcoes = (sel.__lista || []).filter(e => ramoDe(e) === novo);
      if (!opcoes.length) { sel.value = sel.__ramoAtual; return; }
      let ultima = '';
      try { ultima = String(localStorage.getItem(CHAVE_ULTIMA + novo) || '').toUpperCase(); } catch (_) {}
      const alvo = opcoes.find(e => String(e.nome || '').toUpperCase() === ultima) || opcoes[0];
      mostrarIconeRamo(box, novo);
      try {
        if (typeof window.setCompany === 'function') window.setCompany(alvo.nome);
        else { localStorage.setItem('CURRENT_COMPANY', alvo.nome); location.reload(); }
      } catch (err) {
        console.error('[EmpresasSelector] Erro ao trocar de ramo:', err);
        sel.value = sel.__ramoAtual;
      }
    });
  }

  window.__reloadEmpresaSelector = reloadSelector;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(reloadSelector, 1000));
  } else {
    setTimeout(reloadSelector, 1000);
  }
})();
