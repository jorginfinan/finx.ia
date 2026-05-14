(function () {
  'use strict';
 
  if (window.__ESTOQUE_LOADED__) {
    console.warn('[Estoque] Já carregado, ignorando...');
    return;
  }
  window.__ESTOQUE_LOADED__ = true;
 
  let __initialized = false;
  let __cacheEstoque = [];
  let __cacheDistr = [];
 
  // ============================================
  // HELPERS
  // ============================================
  function esc(s) {
    const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
    return String(s ?? '').replace(/[&<>"']/g, m => map[m] || m);
  }
 
  function fmtData(s) {
    if (!s) return '';
    const parts = String(s).split('T')[0].split('-');
    if (parts.length !== 3) return s;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
 
  function notify(msg, type) {
    if (window.showNotification) window.showNotification(msg, type || 'info');
  }
 
  // ============================================
  // CARREGAR DADOS
  // ============================================
  async function loadStats() {
    try {
      const stats = await window.SupabaseAPI.maquinas.getEstatisticas();
      document.getElementById('kpiEstoque').textContent = stats.estoque || 0;
      document.getElementById('kpiComVendedor').textContent = stats.com_vendedor || 0;
      document.getElementById('kpiManutencao').textContent = stats.manutencao || 0;
      document.getElementById('kpiBaixadas').textContent = stats.baixada || 0;
    } catch (e) {
      console.error('[Estoque] Erro nas estatísticas:', e);
    }
  }
 
  async function loadEstoque() {
    try {
      __cacheEstoque = await window.SupabaseAPI.maquinas.getEstoque();
      return __cacheEstoque;
    } catch (e) {
      console.error('[Estoque] Erro ao carregar estoque:', e);
      return [];
    }
  }
 
  async function loadDistribuicao() {
    try {
      __cacheDistr = await window.SupabaseAPI.maquinas.getComVendedores();
      return __cacheDistr;
    } catch (e) {
      console.error('[Estoque] Erro ao carregar distribuição:', e);
      return [];
    }
  }
 
  // ============================================
  // RENDER: ESTOQUE DISPONÍVEL
  // ============================================
  function renderEstoque() {
    const tbody = document.getElementById('tbodyEstoque');
    if (!tbody) return;
 
    const busca = (document.getElementById('estoqueBusca')?.value || '').toLowerCase().trim();
    let lista = __cacheEstoque;
 
    if (busca) {
      lista = lista.filter(m => {
        const blob = [m.serial, m.modelo, m.id_maquina, m.observacao_geral]
          .map(x => String(x || '').toLowerCase()).join(' ');
        return blob.includes(busca);
      });
    }
 
    if (!lista.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#6b7280; padding:30px;">Nenhuma máquina no estoque.</td></tr>';
      return;
    }
 
    tbody.innerHTML = lista.map(m => `
      <tr>
        <td><strong>${esc(m.serial)}</strong>${m.id_maquina ? '<br><small style="color:#6b7280;">' + esc(m.id_maquina) + '</small>' : ''}</td>
        <td>${esc(m.modelo || '—')}</td>
        <td>${fmtData(m.data_entrada)}</td>
        <td style="font-size:13px; color:#374151;">${esc(m.observacao_geral || '—')}</td>
      </tr>
    `).join('');
  }
 
  // ============================================
  // RENDER: DISTRIBUIÇÃO POR GERENTE
  // ============================================
  function renderDistribuicao() {
    const tbody = document.getElementById('tbodyDistribuicao');
    if (!tbody) return;
 
    const busca = (document.getElementById('distrBusca')?.value || '').toLowerCase().trim();
    let lista = __cacheDistr;
 
    if (busca) {
      lista = lista.filter(m => {
        const blob = [m.gerente_atual_nome, m.ficha_atual, m.serial, m.modelo, m.chip_atual]
          .map(x => String(x || '').toLowerCase()).join(' ');
        return blob.includes(busca);
      });
    }
 
    if (!lista.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#6b7280; padding:30px;">Nenhuma máquina com vendedor.</td></tr>';
      return;
    }
 
    // Ordenar por gerente
    lista = [...lista].sort((a, b) => String(a.gerente_atual_nome || '').localeCompare(String(b.gerente_atual_nome || '')));
 
    // Detectar gerentes com mais de uma máquina (destaque visual)
    const contagem = {};
    lista.forEach(m => {
      if (m.gerente_atual_id) contagem[m.gerente_atual_id] = (contagem[m.gerente_atual_id] || 0) + 1;
    });
 
    tbody.innerHTML = lista.map(m => {
      const multipla = (contagem[m.gerente_atual_id] || 0) > 1;
      const bgStyle = multipla ? 'background:#fef3c7;' : '';
      const nomeBadge = multipla
        ? `${esc(m.gerente_atual_nome || '—')} <span style="background:#f59e0b; color:#fff; padding:2px 6px; border-radius:10px; font-size:10px;">${contagem[m.gerente_atual_id]} máquinas</span>`
        : esc(m.gerente_atual_nome || '—');
 
      return `
        <tr style="${bgStyle}">
          <td>${nomeBadge}</td>
          <td>${esc(m.ficha_atual || '—')}</td>
          <td><strong>${esc(m.serial)}</strong></td>
          <td>${esc(m.modelo || '—')}</td>
          <td>${esc(m.chip_atual || '—')}</td>
          <td>${fmtData(m.updated_at || m.data_entrada)}</td>
        </tr>
      `;
    }).join('');
  }
 
  // ============================================
  // EXPORTAR CSV
  // ============================================
  function exportarCSV() {
    try {
      const linhas = [
        ['Tipo', 'Serial', 'Modelo', 'Status', 'Gerente', 'Ficha', 'Chip', 'Data Entrada']
      ];
 
      __cacheEstoque.forEach(m => {
        linhas.push(['Estoque', m.serial, m.modelo || '', m.status, '', '', '', m.data_entrada || '']);
      });
      __cacheDistr.forEach(m => {
        linhas.push([
          'Com Vendedor', m.serial, m.modelo || '', m.status,
          m.gerente_atual_nome || '', m.ficha_atual || '', m.chip_atual || '',
          m.data_entrada || ''
        ]);
      });
 
      const csv = linhas.map(row =>
        row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')
      ).join('\n');
 
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `estoque_maquinas_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
 
      notify('CSV exportado!', 'success');
 
      if (window.AuditLog) {
        window.AuditLog.log('estoque_exportado', { total: linhas.length - 1 });
      }
    } catch (e) {
      console.error('[Estoque] Erro ao exportar:', e);
      notify('Erro ao exportar CSV', 'error');
    }
  }
 
  // ============================================
  // RENDER PRINCIPAL
  // ============================================
  async function render() {
    await Promise.all([
      loadStats(),
      loadEstoque().then(renderEstoque),
      loadDistribuicao().then(renderDistribuicao)
    ]);
  }
 
  // ============================================
  // EVENTOS
  // ============================================
  function bindEvents() {
    const buscaEst = document.getElementById('estoqueBusca');
    if (buscaEst && !buscaEst.__wired) {
      buscaEst.__wired = true;
      let t;
      buscaEst.addEventListener('input', () => { clearTimeout(t); t = setTimeout(renderEstoque, 250); });
    }
 
    const buscaDistr = document.getElementById('distrBusca');
    if (buscaDistr && !buscaDistr.__wired) {
      buscaDistr.__wired = true;
      let t;
      buscaDistr.addEventListener('input', () => { clearTimeout(t); t = setTimeout(renderDistribuicao, 250); });
    }
 
    const btnExp = document.getElementById('btnExportarEstoque');
    if (btnExp && !btnExp.__wired) {
      btnExp.__wired = true;
      btnExp.addEventListener('click', exportarCSV);
    }
 
    const btnAtu = document.getElementById('btnAtualizarEstoque');
    if (btnAtu && !btnAtu.__wired) {
      btnAtu.__wired = true;
      btnAtu.addEventListener('click', async () => {
        btnAtu.disabled = true;
        await render();
        btnAtu.disabled = false;
        notify('Estoque atualizado!', 'success');
      });
    }
 
    document.addEventListener('empresa:change', render);
  }
 
  async function init() {
    if (__initialized) {
      await render();
      return;
    }
    __initialized = true;
    console.log('[Estoque] 🔄 Inicializando página de estoque...');
 
    bindEvents();
    await render();
    console.log('[Estoque] ✅ Página de estoque pronta');
  }
 
  // Expor para o nav.js
  window.MaquinasEstoque = {
    init,
    render
  };
  window.renderMaquinasEstoque = render;
 
  console.log('[Estoque] ✅ Módulo carregado');
})();