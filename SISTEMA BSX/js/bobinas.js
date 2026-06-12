// ============================================
// CONTROLE DE BOBINAS
// Estoque + movimentações + entregas a gerentes (BSX + BetPlay)
// ============================================
(function () {
  'use strict';

  if (window.__BOBINAS_LOADED__) {
    console.warn('[Bobinas] Já carregado, ignorando...');
    return;
  }
  window.__BOBINAS_LOADED__ = true;

  let __initializedLanc = false;
  let __initializedCtrl = false;
  let __bobinaPrincipal = null;
  let __cacheMovs = [];
  let __cacheGerentes = [];  // gerentes ativos de BSX + BetPlay

  const EMPRESAS_ALVO = ['BSX', 'BetPlay'];

  // ============================================
  // HELPERS
  // ============================================
  function esc(s) {
    const map = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
    return String(s ?? '').replace(/[&<>"']/g, m => map[m] || m);
  }

  function fmtBRL(n) {
    return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function fmtData(s) {
    if (!s) return '';
    const parts = String(s).split('T')[0].split('-');
    if (parts.length !== 3) return s;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  function hoje() {
    return new Date().toISOString().slice(0, 10);
  }

  function notify(msg, type) {
    if (window.showNotification) window.showNotification(msg, type || 'info');
    else if (type === 'error') alert('❌ ' + msg);
  }

  function podeFazer(perm) {
    try { return window.UserAuth?.can?.(perm) === true; } catch (_) { return false; }
  }

  // ============================================
  // CARREGAR DADOS
  // ============================================
  function mostrarErroSetup(msg) {
    const div = document.getElementById('bobinasErroSetup');
    const det = document.getElementById('bobinasErroSetupDetalhe');
    if (div) div.style.display = '';
    if (det) det.textContent = msg || '';
  }
  function esconderErroSetup() {
    const div = document.getElementById('bobinasErroSetup');
    if (div) div.style.display = 'none';
  }

  async function carregarBobinaPrincipal() {
    try {
      __bobinaPrincipal = await window.SupabaseAPI.bobinas.getOrCreatePrincipal();
      if (__bobinaPrincipal) esconderErroSetup();
      return __bobinaPrincipal;
    } catch (e) {
      console.error('[Bobinas] Erro principal:', e);
      // Detecta erro típico de "tabela não existe" (PostgREST PGRST205 / 42P01)
      const txt = String(e?.message || e?.code || '');
      if (/PGRST205|relation .* does not exist|42P01|not found/i.test(txt)) {
        mostrarErroSetup('Detalhe: ' + txt);
      }
      return null;
    }
  }

  async function carregarGerentesMultiEmpresa() {
    try {
      if (!window.SupabaseAPI?.client) return [];

      const { data: empresas } = await window.SupabaseAPI.client
        .from('empresas')
        .select('id, nome');

      const alvoLower = EMPRESAS_ALVO.map(n => n.toLowerCase());
      const empresasAlvo = (empresas || [])
        .filter(e => alvoLower.includes(String(e.nome || '').toLowerCase()));
      if (!empresasAlvo.length) return [];
      const empById = new Map(empresasAlvo.map(e => [e.id, e.nome]));

      const { data: gerentes } = await window.SupabaseAPI.client
        .from('gerentes')
        .select('*')
        .in('empresa_id', empresasAlvo.map(e => e.id))
        .eq('ativo', true)
        .order('nome');

      __cacheGerentes = (gerentes || []).map(g => ({
        ...g,
        empresa_nome: empById.get(g.empresa_id) || ''
      }));
      return __cacheGerentes;
    } catch (e) {
      console.error('[Bobinas] Erro gerentes:', e);
      return [];
    }
  }

  async function carregarMovs() {
    try {
      const filtros = {
        tipo: document.getElementById('bobFiltroTipo')?.value || null,
        dataInicio: document.getElementById('bobFiltroDe')?.value || null,
        dataFim: document.getElementById('bobFiltroAte')?.value || null,
        limit: 500
      };
      Object.keys(filtros).forEach(k => { if (!filtros[k]) delete filtros[k]; });
      __cacheMovs = await window.SupabaseAPI.bobinasMovimentacoes.getAll(filtros);
      return __cacheMovs;
    } catch (e) {
      console.error('[Bobinas] Erro movs:', e);
      return [];
    }
  }

  // ============================================
  // RENDERS
  // ============================================
  function setTxt(id, v) {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  }

  function calcStatus() {
    if (!__bobinaPrincipal) return { label: 'OK', desc: 'estoque normal', bg: '#d1fae5', fg: '#065f46' };
    const atual = Number(__bobinaPrincipal.estoque_atual) || 0;
    const min   = Number(__bobinaPrincipal.estoque_minimo) || 0;
    if (atual <= 0) return { label: 'SEM ESTOQUE', desc: '⚠️ Repor com urgência', bg: '#fee2e2', fg: '#991b1b' };
    if (atual <= min) return { label: 'BAIXO', desc: 'abaixo do mínimo',         bg: '#fef3c7', fg: '#92400e' };
    return { label: 'OK', desc: 'estoque normal', bg: '#d1fae5', fg: '#065f46' };
  }

  // Cabeçalho usado em ambas as páginas (saldo + nome + status badge)
  function renderHeaderLanc() {
    if (!__bobinaPrincipal) return;
    setTxt('bobinaNome', __bobinaPrincipal.nome || 'Bobina');
    setTxt('bobinaSaldoAtual', Number(__bobinaPrincipal.estoque_atual) || 0);
    setTxt('bobinaMinimoAtual', Number(__bobinaPrincipal.estoque_minimo) || 0);
    const st = calcStatus();
    const badge = document.getElementById('bobinaStatusBadgeLanc');
    if (badge) {
      badge.textContent = st.label === 'OK' ? 'ESTOQUE OK' : st.label;
      badge.style.background = st.bg;
      badge.style.color = st.fg;
    }
  }

  // KPIs e status da página de Controle
  function renderKPIs() {
    if (!__bobinaPrincipal) return;
    const atual = Number(__bobinaPrincipal.estoque_atual) || 0;
    const min   = Number(__bobinaPrincipal.estoque_minimo) || 0;
    const custo = Number(__bobinaPrincipal.preco_custo) || 0;
    const valor = atual * custo;

    setTxt('kpiBobinasEstoque', atual);
    setTxt('kpiBobinasMinimo', min);
    setTxt('kpiBobinasValor', fmtBRL(valor));

    const st = calcStatus();
    setTxt('kpiBobinasStatus', st.label);
    setTxt('kpiBobinasStatusDesc', st.desc);
  }

  // ============================================
  // RENDER MOVIMENTAÇÕES
  // ============================================
  function renderMovs() {
    const tbody = document.getElementById('tbodyBobMovs');
    if (!tbody) return;

    const busca = (document.getElementById('bobBusca')?.value || '').toLowerCase().trim();
    let lista = __cacheMovs.slice();

    if (busca) {
      lista = lista.filter(mv => {
        const blob = [mv.gerente_nome, mv.gerente_empresa, mv.fornecedor, mv.rota, mv.motivo, mv.observacao, mv.usuario_nome, mv.nota_fiscal]
          .map(x => String(x || '').toLowerCase()).join(' ');
        return blob.includes(busca);
      });
    }

    if (!lista.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#6b7280; padding:30px;">Nenhuma movimentação.</td></tr>';
      return;
    }

    const tipos = {
      entrada: { ico: '📥', cor: '#10b981', label: 'Entrada' },
      entrega: { ico: '🧑‍💼', cor: '#3b82f6', label: 'Entrega' },
      saida:   { ico: '📤', cor: '#ef4444', label: 'Saída' },
      ajuste:  { ico: '⚙️', cor: '#6366f1', label: 'Ajuste' }
    };

    tbody.innerHTML = lista.map(mv => {
      const t = tipos[mv.tipo] || { ico: '•', cor: '#6b7280', label: mv.tipo };
      const q = Number(mv.quantidade) || 0;
      const sinal = q > 0 ? '+' : '';
      const corQ = q >= 0 ? '#065f46' : '#991b1b';

      let alvo = '—';
      if (mv.tipo === 'entrega') {
        alvo = `${esc(mv.gerente_nome || '—')}${mv.gerente_empresa ? ` <small style="color:#6b7280;">(${esc(mv.gerente_empresa)})</small>` : ''}`;
      } else if (mv.tipo === 'entrada' && mv.fornecedor) {
        alvo = esc(mv.fornecedor) + (mv.nota_fiscal ? ` <small style="color:#6b7280;">NF ${esc(mv.nota_fiscal)}</small>` : '');
      } else if (mv.motivo) {
        alvo = `<small style="color:#6b7280;">${esc(mv.motivo)}</small>`;
      }

      const custoTxt = mv.custo_total ? fmtBRL(mv.custo_total) : '—';
      const rotaCol = mv.rota
        ? `<span style="background:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:600;">${esc(mv.rota)}</span>`
        : '—';

      return `
        <tr>
          <td>${fmtData(mv.data_evento)}</td>
          <td>
            <span style="background:${t.cor}22; color:${t.cor}; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:600;">
              ${t.ico} ${t.label}
            </span>
          </td>
          <td style="font-family:monospace; color:${corQ}; font-weight:600;">${sinal}${q}</td>
          <td style="font-size:12px; color:#6b7280;">${mv.estoque_antes} → <strong>${mv.estoque_depois}</strong></td>
          <td>${alvo}</td>
          <td>${rotaCol}</td>
          <td style="white-space:nowrap;">${custoTxt}</td>
          <td style="font-size:12px;">${esc(mv.observacao || '')}</td>
          <td style="font-size:12px; color:#6b7280;">${esc(mv.usuario_nome || '—')}</td>
        </tr>
      `;
    }).join('');
  }

  // ============================================
  // RENDER RESUMO POR GERENTE
  // ============================================
  async function renderResumoPorGerente() {
    const tb = document.getElementById('tbodyBobResumoGerente');
    if (!tb) return;
    tb.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#6b7280; padding:20px;">Carregando...</td></tr>';
    try {
      const filtros = {
        dataInicio: document.getElementById('bobResumoDe')?.value || null,
        dataFim: document.getElementById('bobResumoAte')?.value || null
      };
      const lista = await window.SupabaseAPI.bobinasMovimentacoes.getResumoPorGerente(filtros);
      if (!lista.length) {
        tb.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#6b7280; padding:20px;">Nenhuma entrega no período.</td></tr>';
        return;
      }
      tb.innerHTML = lista.map(r => `
        <tr>
          <td><strong>${esc(r.gerente_nome || '—')}</strong></td>
          <td>${esc(r.gerente_empresa || '—')}</td>
          <td class="tv-right"><strong>${r.total}</strong> un.</td>
        </tr>
      `).join('');
    } catch (e) {
      tb.innerHTML = '<tr><td colspan="3" style="color:#dc2626; text-align:center;">Erro ao carregar.</td></tr>';
    }
  }

  // ============================================
  // ROTAS E FICHAS (igual lógica de máquinas)
  // ============================================
  // Popula <select> com as rotas únicas = áreas distintas em fichas
  function popularSelectRotas(sel) {
    if (!sel) return;
    const rotas = Array.from(new Set(
      (window.fichas || [])
        .map(f => String(f.area || '').trim())
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b));
    const atual = sel.value;
    sel.innerHTML = '<option value="">Todas as rotas</option>' +
      rotas.map(r => `<option value="${esc(r)}">${esc(r)}</option>`).join('');
    if (atual) sel.value = atual;
  }

  // Popula <datalist> com fichas (opcionalmente filtradas por rota)
  function popularDatalistFichas(dl, rotaSelecionada = null) {
    if (!dl) return;
    let fichas = window.fichas || [];
    if (rotaSelecionada) {
      const r = String(rotaSelecionada).trim().toLowerCase();
      fichas = fichas.filter(f => String(f.area || '').trim().toLowerCase() === r);
    }
    dl.innerHTML = fichas
      .sort((a, b) => String(a.ficha).localeCompare(String(b.ficha)))
      .map(f => `<option value="${esc(f.ficha)}">${esc(f.ficha)} — ${esc(f.area || '')}</option>`)
      .join('');
  }

  // ============================================
  // POPULAR SELECT DE GERENTES (multi-empresa)
  // ============================================
  function popularSelectGerentes(sel) {
    if (!sel) return;
    const lista = __cacheGerentes.filter(g => g.ativo !== false);
    const porEmpresa = new Map();
    lista.forEach(g => {
      const emp = g.empresa_nome || '';
      if (!porEmpresa.has(emp)) porEmpresa.set(emp, []);
      porEmpresa.get(emp).push(g);
    });
    const ordemEmp = ['BSX', 'BetPlay'];
    const empresasOrdenadas = Array.from(porEmpresa.keys()).sort((a, b) => {
      const ia = ordemEmp.indexOf(a); const ib = ordemEmp.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
    const usaOptgroup = porEmpresa.size > 1;
    let html = '<option value="">Selecione...</option>';
    empresasOrdenadas.forEach(emp => {
      const ls = porEmpresa.get(emp)
        .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));
      if (usaOptgroup && emp) {
        html += `<optgroup label="🏢 ${esc(emp)}">`;
        ls.forEach(g => { html += `<option value="${esc(g.id)}">${esc(g.nome)}</option>`; });
        html += '</optgroup>';
      } else {
        ls.forEach(g => { html += `<option value="${esc(g.id)}">${esc(g.nome)}</option>`; });
      }
    });
    sel.innerHTML = html;
  }

  // ============================================
  // DIALOG: AÇÃO DE BOBINA
  // ============================================
  async function abrirDialogAcao(tipo) {
    // Se ainda não temos a bobina principal, tenta carregar uma vez antes
    if (!__bobinaPrincipal) {
      await carregarBobinaPrincipal();
    }
    if (!__bobinaPrincipal) {
      alert('⚠️ Não foi possível carregar a bobina.\n\nVerifique se você rodou o arquivo db/bobinas-schema.sql no Supabase SQL Editor.\nDepois recarregue a página com Ctrl+Shift+R.');
      return;
    }
    if (!podeFazer('maquinas_cadastrar')) {
      alert('❌ Você não tem permissão para movimentar bobinas.');
      return;
    }

    const titulos = {
      entrada: '📥 Entrada de Estoque (compra)',
      entrega: '🧑‍💼 Entregar a Gerente',
      saida:   '📤 Saída Manual',
      ajuste:  '⚙️ Ajustar Inventário'
    };

    const dlg = document.getElementById('dlgBobinaAcao');
    const form = document.getElementById('formBobinaAcao');
    form.reset();
    form.bobina_id.value = __bobinaPrincipal.id;
    form.tipo.value = tipo;
    form.data_evento.value = hoje();

    document.getElementById('dlgBobinaAcaoTitulo').textContent = titulos[tipo] || 'Ação';
    document.getElementById('dlgBobinaInfo').textContent = __bobinaPrincipal.nome || 'Bobina';
    document.getElementById('dlgBobinaSaldo').innerHTML =
      `Saldo atual: <strong>${Number(__bobinaPrincipal.estoque_atual) || 0}</strong> un.` +
      (tipo === 'ajuste' ? ' <em>(informe o novo saldo desejado)</em>' : '');

    // Mostra/esconde campos por tipo
    const showFornecedor = (tipo === 'entrada');
    const showGerente    = (tipo === 'entrega');
    const showPreco      = (tipo === 'entrada');
    const showRotaFicha  = (tipo === 'entrega');

    document.getElementById('dlgBobinaFornecedorLabel').style.display = showFornecedor ? '' : 'none';
    document.getElementById('dlgBobinaNotaLabel').style.display       = showFornecedor ? '' : 'none';
    document.getElementById('dlgBobinaPrecoLabel').style.display      = showPreco ? '' : 'none';
    document.getElementById('dlgBobinaGerenteLabel').style.display    = showGerente ? '' : 'none';
    document.getElementById('dlgBobinaRotaLabel').style.display       = showRotaFicha ? '' : 'none';
    document.getElementById('dlgBobinaFichaLabel').style.display      = showRotaFicha ? '' : 'none';

    // Defaults
    if (showFornecedor) {
      form.fornecedor.value = __bobinaPrincipal.fornecedor_padrao || '';
      form.preco_unitario_momento.value = __bobinaPrincipal.preco_custo || '';
    }
    if (showGerente) {
      const selG = document.getElementById('dlgBobinaGerente');
      selG.required = true;
      popularSelectGerentes(selG);
    } else {
      const selG = document.getElementById('dlgBobinaGerente');
      if (selG) selG.required = false;
    }
    if (showRotaFicha) {
      const selR = document.getElementById('dlgBobinaRota');
      popularSelectRotas(selR);
      popularDatalistFichas(document.getElementById('dlgBobinaFichasList'));

      // Listener: ao mudar rota, refiltra fichas
      if (selR && !selR.__wiredRota) {
        selR.__wiredRota = true;
        selR.addEventListener('change', () => {
          popularDatalistFichas(document.getElementById('dlgBobinaFichasList'), selR.value);
        });
      }
    }

    form.quantidade.placeholder = (tipo === 'ajuste') ? 'novo saldo (ex.: 50)' : 'quantidade (ex.: 10)';

    dlg.showModal();
  }

  async function onSubmitAcao(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const tipo = String(fd.get('tipo') || '');
    const bobinaId = String(fd.get('bobina_id') || '');
    const qtd = Number(fd.get('quantidade')) || 0;
    const motivo = String(fd.get('motivo') || '').trim() || null;
    const obs = String(fd.get('observacao') || '').trim() || null;
    const dataEvento = String(fd.get('data_evento') || hoje());

    if (!bobinaId || !tipo) { notify('Dados incompletos.', 'error'); return; }
    if (qtd <= 0) { notify('Quantidade deve ser maior que zero.', 'error'); return; }

    try {
      const atual = Number(__bobinaPrincipal.estoque_atual) || 0;
      let delta = 0;
      let extras = {};

      if (tipo === 'entrada') {
        delta = +qtd;
        extras.fornecedor = String(fd.get('fornecedor') || '').trim() || null;
        extras.notaFiscal = String(fd.get('nota_fiscal') || '').trim() || null;
        const p = fd.get('preco_unitario_momento');
        extras.precoUnitario = p ? Number(p) : null;
      } else if (tipo === 'saida') {
        delta = -qtd;
      } else if (tipo === 'entrega') {
        delta = -qtd;
        const gerenteId = String(fd.get('gerente_id') || '');
        if (!gerenteId) { notify('Selecione o gerente.', 'error'); return; }
        const g = __cacheGerentes.find(x => x.id === gerenteId);
        if (!g) { notify('Gerente inválido.', 'error'); return; }
        extras.gerente = { id: g.id, nome: g.nome, empresa_nome: g.empresa_nome };

        // Rota: prioridade pra selecionada; senão deriva pela ficha
        const fichaInformada = String(fd.get('ficha') || '').trim() || null;
        let rotaInformada = String(fd.get('rota') || '').trim() || null;
        if (!rotaInformada && fichaInformada) {
          const fObj = (window.fichas || []).find(f => String(f.ficha) === String(fichaInformada));
          if (fObj && fObj.area) rotaInformada = String(fObj.area).trim();
        }
        if (rotaInformada) extras.rota = rotaInformada;

        // Se a ficha foi preenchida, anexa à observação (não há coluna dedicada)
        if (fichaInformada) {
          extras.observacao = `Ficha: ${fichaInformada}` + (obs ? ` — ${obs}` : '');
        }
      } else if (tipo === 'ajuste') {
        delta = qtd - atual;
        if (delta === 0) { notify('O novo saldo é igual ao atual.', 'warning'); return; }
      } else {
        throw new Error('Tipo inválido.');
      }

      await window.SupabaseAPI.bobinas.aplicarMovimentacao({
        bobinaId,
        delta,
        tipo,
        motivo,
        observacao: obs,
        dataEvento,
        ...extras
      });

      if (window.AuditLog) window.AuditLog.log('bobina_movimentada', { tipo, delta });

      document.getElementById('dlgBobinaAcao').close();
      notify('Movimentação registrada!', 'success');
      await render();
    } catch (err) {
      console.error('[Bobinas] Erro mov:', err);
      notify(err.message || 'Erro ao movimentar', 'error');
    }
  }

  // ============================================
  // DIALOG: CONFIGURAÇÕES
  // ============================================
  async function abrirDialogConfig() {
    if (!__bobinaPrincipal) await carregarBobinaPrincipal();
    if (!__bobinaPrincipal) {
      alert('⚠️ Não foi possível carregar a bobina.\n\nRode db/bobinas-schema.sql e recarregue a página.');
      return;
    }
    if (!podeFazer('maquinas_cadastrar')) {
      alert('❌ Você não tem permissão para alterar configurações.');
      return;
    }
    const dlg = document.getElementById('dlgBobinaConfig');
    if (!dlg) return;
    const form = document.getElementById('formBobinaConfig');
    if (form) {
      form.nome.value              = __bobinaPrincipal.nome || '';
      form.estoque_minimo.value    = __bobinaPrincipal.estoque_minimo ?? 0;
      form.preco_custo.value       = __bobinaPrincipal.preco_custo ?? 0;
      form.fornecedor_padrao.value = __bobinaPrincipal.fornecedor_padrao || '';
    }
    dlg.showModal();
  }

  // ============================================
  // SALVAR CONFIG
  // ============================================
  async function onSubmitConfig(e) {
    e.preventDefault();
    if (!__bobinaPrincipal) return;
    if (!podeFazer('maquinas_cadastrar')) {
      notify('Sem permissão.', 'error');
      return;
    }
    const form = e.currentTarget;
    const fd = new FormData(form);
    const patch = {
      nome: String(fd.get('nome') || '').trim() || 'Bobina térmica',
      estoque_minimo: Number(fd.get('estoque_minimo')) || 0,
      preco_custo: Number(fd.get('preco_custo')) || 0,
      fornecedor_padrao: String(fd.get('fornecedor_padrao') || '').trim() || null
    };
    try {
      __bobinaPrincipal = await window.SupabaseAPI.bobinas.update(__bobinaPrincipal.id, patch);
      const dlg = document.getElementById('dlgBobinaConfig');
      if (dlg && dlg.open) dlg.close();
      notify('Configurações salvas!', 'success');
      renderKPIs();
    } catch (err) {
      console.error('[Bobinas] Erro salvar config:', err);
      alert('Erro ao salvar: ' + (err.message || err));
    }
  }

  // ============================================
  // EXPORTAR CSV
  // ============================================
  function exportarCSV() {
    try {
      const linhas = [['Data', 'Tipo', 'Quantidade', 'Saldo antes', 'Saldo depois', 'Gerente', 'Empresa', 'Rota', 'Fornecedor', 'NF', 'Custo', 'Motivo', 'Observação', 'Usuário']];
      __cacheMovs.forEach(mv => {
        linhas.push([
          mv.data_evento || '', mv.tipo,
          mv.quantidade, mv.estoque_antes, mv.estoque_depois,
          mv.gerente_nome || '', mv.gerente_empresa || '',
          mv.rota || '',
          mv.fornecedor || '', mv.nota_fiscal || '',
          mv.custo_total || 0,
          mv.motivo || '', mv.observacao || '',
          mv.usuario_nome || ''
        ]);
      });
      const csv = linhas.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bobinas_${hoje()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      notify('CSV exportado!', 'success');
    } catch (e) {
      notify('Erro ao exportar', 'error');
    }
  }

  // ============================================
  // RENDERS POR PÁGINA
  // ============================================
  // Página de Lançamentos: só carrega header e cache de gerentes
  async function renderLanc() {
    await carregarBobinaPrincipal();
    renderHeaderLanc();
  }

  // Página de Controle: carrega KPIs, movimentações, resumo
  async function renderCtrl() {
    await carregarBobinaPrincipal();
    renderKPIs();
    await carregarMovs();
    renderMovs();
    await renderResumoPorGerente();
  }

  // Render conjunto (chamado após cada movimentação para atualizar tudo
  // independente da página atual)
  async function render() {
    await carregarBobinaPrincipal();
    renderHeaderLanc();
    renderKPIs();
    await carregarMovs();
    renderMovs();
    await renderResumoPorGerente();
  }

  // ============================================
  // EVENTOS
  // ============================================
  function wire(id, handler) {
    const el = document.getElementById(id);
    if (el && !el.__wiredBob) {
      el.__wiredBob = true;
      el.addEventListener('click', (e) => {
        e.preventDefault();
        handler();
      });
    } else if (!el) {
      console.warn('[Bobinas] Botão não encontrado:', id);
    }
  }

  function bindDialogsComuns() {
    // form de movimentação (entrada/saida/entrega/ajuste)
    const formAcao = document.getElementById('formBobinaAcao');
    if (formAcao && !formAcao.__wired) {
      formAcao.__wired = true;
      formAcao.addEventListener('submit', onSubmitAcao);
    }

    // form de configuração
    const formConfig = document.getElementById('formBobinaConfig');
    if (formConfig && !formConfig.__wired) {
      formConfig.__wired = true;
      formConfig.addEventListener('submit', onSubmitConfig);
    }

    // Fechar dialogs com data-close-dlg
    document.querySelectorAll('button[data-close-dlg]').forEach(b => {
      if (b.__wired) return;
      b.__wired = true;
      b.addEventListener('click', () => {
        const dlg = document.getElementById(b.getAttribute('data-close-dlg'));
        if (dlg && dlg.close) dlg.close();
      });
    });
  }

  function bindEventsLanc() {
    wire('btnBobinaEntrada', () => abrirDialogAcao('entrada'));
    wire('btnBobinaEntrega', () => abrirDialogAcao('entrega'));
    wire('btnBobinaSaida',   () => abrirDialogAcao('saida'));
    wire('btnBobinaAjuste',  () => abrirDialogAcao('ajuste'));
    wire('btnBobinaConfig',  () => abrirDialogConfig());
    bindDialogsComuns();
  }

  function bindEventsCtrl() {
    const busca = document.getElementById('bobBusca');
    if (busca && !busca.__wired) {
      busca.__wired = true;
      let t;
      busca.addEventListener('input', () => { clearTimeout(t); t = setTimeout(renderMovs, 200); });
    }

    document.getElementById('bobFiltroTipo')?.addEventListener('change', async () => { await carregarMovs(); renderMovs(); });
    document.getElementById('bobFiltroDe')?.addEventListener('change',  async () => { await carregarMovs(); renderMovs(); });
    document.getElementById('bobFiltroAte')?.addEventListener('change', async () => { await carregarMovs(); renderMovs(); });

    document.getElementById('btnBobAtualizar')?.addEventListener('click', async () => {
      await renderCtrl();
      notify('Atualizado!', 'success');
    });
    document.getElementById('btnBobExportar')?.addEventListener('click', exportarCSV);
    document.getElementById('btnBobResumoAplicar')?.addEventListener('click', renderResumoPorGerente);
  }

  // ============================================
  // INITS POR PÁGINA
  // ============================================
  async function initLanc() {
    if (__initializedLanc) {
      await renderLanc();
      return;
    }
    __initializedLanc = true;
    console.log('[Bobinas] 🔄 Inicializando página de LANÇAMENTOS...');
    bindEventsLanc();
    await carregarGerentesMultiEmpresa();
    await renderLanc();
    console.log('[Bobinas] ✅ Lançamentos pronto');
  }

  async function initCtrl() {
    if (__initializedCtrl) {
      await renderCtrl();
      return;
    }
    __initializedCtrl = true;
    console.log('[Bobinas] 🔄 Inicializando página de CONTROLE...');
    bindEventsCtrl();
    await renderCtrl();
    console.log('[Bobinas] ✅ Controle pronto');
  }

  // Re-renderiza ambas quando a empresa muda
  document.addEventListener('empresa:change', () => {
    __initializedLanc = false;
    __initializedCtrl = false;
    render();
  });

  // EXPOR
  window.Bobinas = { initLanc, initCtrl, render };
  window.renderBobinas = render;

  console.log('[Bobinas] ✅ Módulo carregado');
})();
