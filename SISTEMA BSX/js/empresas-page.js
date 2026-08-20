// ============================================
// CADASTRO DE EMPRESAS
// ============================================
(function () {
  'use strict';

  if (window.__EMPRESAS_PAGE_LOADED__) return;
  window.__EMPRESAS_PAGE_LOADED__ = true;

  let __cache = [];
  let __editingId = null;

  function esc(s) {
    const map = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
    return String(s ?? '').replace(/[&<>"']/g, m => map[m] || m);
  }

  function notify(msg, type) {
    if (window.showNotification) window.showNotification(msg, type || 'info');
    else if (type === 'error') alert('❌ ' + msg);
  }

  function isAdmin() {
    try { return window.UserAuth?.isAdmin?.() === true; } catch(_) { return false; }
  }

  async function loadEmpresas() {
    try {
      if (!window.SupabaseAPI?.empresas) return [];
      __cache = await window.SupabaseAPI.empresas.getAll();
      return __cache;
    } catch (e) {
      console.error('[Empresas] load:', e);
      return [];
    }
  }

  function renderTabela() {
    const tb = document.getElementById('tbodyEmpresas');
    if (!tb) return;
    if (!__cache.length) {
      tb.innerHTML = '<tr><td colspan="4" style="padding:14px; text-align:center; color:#6b7280;">Nenhuma empresa cadastrada.</td></tr>';
      return;
    }
    tb.innerHTML = __cache.map(e => {
      const statusBadge = e.ativo
        ? '<span style="background:#d1fae5; color:#065f46; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:600;">ATIVA</span>'
        : '<span style="background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:600;">INATIVA</span>';
      return `
        <tr data-emp-id="${esc(e.id)}">
          <td style="padding:8px; font-size:22px;">${esc(e.emoji || '🏢')}</td>
          <td style="padding:8px;"><strong>${esc(e.nome)}</strong></td>
          <td style="padding:8px;">${statusBadge}</td>
          <td style="padding:8px; text-align:right; white-space:nowrap;">
            <button class="btn ghost" data-emp-act="editar" data-tip="Editar dados">✏️</button>
            <button class="btn ${e.ativo ? '' : 'ghost'}" data-emp-act="${e.ativo ? 'inativar' : 'ativar'}" data-tip="${e.ativo ? 'Inativar' : 'Reativar'}">
              ${e.ativo ? '🚫' : '↩️'}
            </button>
            <button class="btn danger" data-emp-act="excluir" data-tip="Excluir permanentemente">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function resetForm() {
    const f = document.getElementById('formEmpresa');
    if (!f) return;
    f.reset();
    __editingId = null;
    f.querySelector('#empAtivo').checked = true;
    document.getElementById('btnSalvarEmpresa').textContent = 'Salvar Empresa';
  }

  function carregarParaEdicao(emp) {
    const f = document.getElementById('formEmpresa');
    if (!f) return;
    __editingId = emp.id;
    f.nome.value = emp.nome || '';
    f.emoji.value = emp.emoji || '🏢';
    f.querySelector('#empAtivo').checked = !!emp.ativo;
    document.getElementById('btnSalvarEmpresa').textContent = 'Atualizar Empresa';
    f.scrollIntoView({ behavior:'smooth', block:'center' });
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!isAdmin()) { notify('Apenas admin pode cadastrar empresas.', 'error'); return; }
    const f = e.currentTarget;
    const fd = new FormData(f);
    const nome  = String(fd.get('nome') || '').trim();
    const emoji = String(fd.get('emoji') || '🏢').trim() || '🏢';
    const ativo = !!fd.get('ativo');
    if (!nome) { notify('Informe o nome.', 'error'); return; }

    try {
      if (__editingId) {
        await window.SupabaseAPI.empresas.update(__editingId, { nome, emoji, ativo });
        notify('Empresa atualizada!', 'success');
      } else {
        await window.SupabaseAPI.empresas.create({ nome, emoji, ativo });
        notify('Empresa cadastrada!', 'success');
      }
      resetForm();
      await render();
      // Atualiza dropdown do topo
      try { window.__reloadEmpresaSelector?.(); } catch(_){}
    } catch (err) {
      notify(err.message || 'Erro ao salvar', 'error');
    }
  }

  async function inativarEmp(emp) {
    if (!isAdmin()) return notify('Sem permissão.', 'error');
    if (!confirm(`Inativar a empresa "${emp.nome}"?\n\nEla deixa de aparecer no seletor. Você pode reativar depois.`)) return;
    try {
      await window.SupabaseAPI.empresas.update(emp.id, { ativo: false });
      notify('Empresa inativada.', 'success');
      await render();
      try { window.__reloadEmpresaSelector?.(); } catch(_){}
    } catch (err) { notify(err.message || 'Erro', 'error'); }
  }

  async function ativarEmp(emp) {
    if (!isAdmin()) return notify('Sem permissão.', 'error');
    try {
      await window.SupabaseAPI.empresas.update(emp.id, { ativo: true });
      notify('Empresa reativada.', 'success');
      await render();
      try { window.__reloadEmpresaSelector?.(); } catch(_){}
    } catch (err) { notify(err.message || 'Erro', 'error'); }
  }

  async function excluirEmp(emp) {
    if (!isAdmin()) return notify('Sem permissão.', 'error');
    if (!confirm(`Excluir PERMANENTEMENTE a empresa "${emp.nome}"?\n\nSó é possível se não houver gerentes, prestações, despesas ou fichas vinculadas. Se houver, use a opção Inativar.`)) return;
    if (!confirm(`Tem certeza absoluta? Esta ação NÃO pode ser desfeita.`)) return;
    try {
      await window.SupabaseAPI.empresas.delete(emp.id);
      notify('Empresa excluída.', 'success');
      await render();
      try { window.__reloadEmpresaSelector?.(); } catch(_){}
    } catch (err) {
      alert('⚠️ ' + (err.message || 'Erro ao excluir'));
    }
  }

  function bindEvents() {
    const f = document.getElementById('formEmpresa');
    if (f && !f.__wired) {
      f.__wired = true;
      f.addEventListener('submit', onSubmit);
    }
    const btnLimpar = document.getElementById('btnLimparEmpresa');
    if (btnLimpar && !btnLimpar.__wired) {
      btnLimpar.__wired = true;
      btnLimpar.addEventListener('click', resetForm);
    }
    const tb = document.getElementById('tbodyEmpresas');
    if (tb && !tb.__wired) {
      tb.__wired = true;
      tb.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-emp-act]');
        if (!btn) return;
        const tr = btn.closest('tr[data-emp-id]');
        const id = tr?.getAttribute('data-emp-id');
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
    await loadEmpresas();
    renderTabela();
  }

  async function init() {
    bindEvents();
    await render();
  }

  window.EmpresasPage = { init, render };
  window.renderEmpresasPage = render;

  console.log('[Empresas] ✅ Módulo de cadastro carregado');
})();


// ============================================
// SELETOR DE EMPRESA (TOPO) — populado dinamicamente
// ============================================
(function () {
  'use strict';

  async function reloadSelector() {
    const sel = document.getElementById('empresaSelect');
    if (!sel) return;
    if (!window.SupabaseAPI?.empresas) {
      // Aguarda API estar pronta
      return setTimeout(reloadSelector, 500);
    }
    try {
      const empresas = await window.SupabaseAPI.empresas.getAll({ ativasApenas: true });
      if (!empresas.length) return;

      const atual = (window.getCompany?.() || 'BSX').toUpperCase();
      sel.innerHTML = empresas.map(e => {
        const nome = e.nome || '';
        const emoji = e.emoji || '🏢';
        const selected = nome.toUpperCase() === atual ? 'selected' : '';
        return `<option value="${nome}" ${selected}>${emoji} ${nome}</option>`;
      }).join('');
    } catch (e) {
      console.warn('[EmpresasSelector] Falha ao popular:', e);
    }
  }

  window.__reloadEmpresaSelector = reloadSelector;

  // Popula ao carregar (aguarda API + DOM)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(reloadSelector, 1000));
  } else {
    setTimeout(reloadSelector, 1000);
  }
})();
