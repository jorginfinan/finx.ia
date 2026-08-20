// ============================================
// MAPA DE USO — Máquinas + Bobinas por gerente
// ============================================
(function () {
  'use strict';

  if (window.__MAPA_LOADED__) return;
  window.__MAPA_LOADED__ = true;

  let __initialized = false;
  let __gerentes = [];      // gerentes ativos multi-empresa (BSX + BetPlay)
  let __empresasMap = {};   // id -> { id, nome, emoji }
  let __maquinas = [];      // todas as máquinas ativas
  let __bobMovs = [];       // movimentações de bobinas no período
  let __maqPecas = [];      // vínculos máquina-peça (com data no período)
  let __filtros = { ano: null, mes: null, empresa: '', rota: '' };

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
    const p = String(s).split('T')[0].split('-');
    if (p.length !== 3) return s;
    return `${p[2]}/${p[1]}/${p[0]}`;
  }

  function nomeMes(m) {
    return ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][m - 1] || '';
  }
  function nomeMesLongo(m) {
    return ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][m-1] || '';
  }

  function ymRange(ano, mes) {
    const ini = `${ano}-${String(mes).padStart(2,'0')}-01`;
    const ult = new Date(ano, mes, 0).getDate();
    const fim = `${ano}-${String(mes).padStart(2,'0')}-${String(ult).padStart(2,'0')}`;
    return { ini, fim };
  }

  function notify(msg, type) {
    if (window.showNotification) window.showNotification(msg, type || 'info');
  }

  // ============================================
  // CARREGA GERENTES MULTI-EMPRESA (BSX + BetPlay)
  // ============================================
  async function carregarGerentesEmpresas() {
    if (!window.SupabaseAPI?.client) return;
    try {
      // Empresas ativas
      const { data: empresas } = await window.SupabaseAPI.client
        .from('empresas').select('id, nome, emoji').eq('ativo', true);
      __empresasMap = {};
      (empresas || []).forEach(e => { __empresasMap[e.id] = e; });

      // Gerentes ativos de todas as empresas ativas
      const empIds = Object.keys(__empresasMap);
      if (!empIds.length) { __gerentes = []; return; }
      const { data: gers } = await window.SupabaseAPI.client
        .from('gerentes').select('*')
        .in('empresa_id', empIds)
        .eq('ativo', true)
        .order('nome');
      __gerentes = (gers || []).map(g => ({
        ...g,
        empresa_nome: __empresasMap[g.empresa_id]?.nome || '',
        empresa_emoji: __empresasMap[g.empresa_id]?.emoji || '🏢'
      }));
    } catch (e) {
      console.error('[Mapa] Erro carregar gerentes:', e);
    }
  }

  // ============================================
  // FILTROS UI — popula selects
  // ============================================
  function popularSelectPeriodo() {
    const sel = document.getElementById('mapaPeriodo');
    if (!sel) return;
    const hoje = new Date();
    const opts = [];
    // Últimos 12 meses (mês atual primeiro)
    for (let i = 0; i < 12; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const y = d.getFullYear(), m = d.getMonth() + 1;
      const rotulo = i === 0
        ? `📅 Mês atual (${nomeMesLongo(m)}/${y})`
        : `${nomeMesLongo(m)}/${y}`;
      opts.push(`<option value="${y}-${String(m).padStart(2,'0')}">${rotulo}</option>`);
    }
    sel.innerHTML = opts.join('');
    // valor default = mês atual
    __filtros.ano = hoje.getFullYear();
    __filtros.mes = hoje.getMonth() + 1;
    sel.value = `${__filtros.ano}-${String(__filtros.mes).padStart(2,'0')}`;
  }

  function popularSelectEmpresa() {
    const sel = document.getElementById('mapaEmpresa');
    if (!sel) return;
    const opcoes = Object.values(__empresasMap)
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map(e => `<option value="${esc(e.nome)}">${e.emoji || '🏢'} ${esc(e.nome)}</option>`)
      .join('');
    sel.innerHTML = '<option value="">Todas</option>' + opcoes;
  }

  function popularSelectRota() {
    const sel = document.getElementById('mapaRota');
    if (!sel) return;
    const rotas = Array.from(new Set(
      (window.fichas || []).map(f => String(f.area || '').trim()).filter(Boolean)
    )).sort((a, b) => a.localeCompare(b));
    sel.innerHTML = '<option value="">Todas as rotas</option>' +
      rotas.map(r => `<option value="${esc(r)}">${esc(r)}</option>`).join('');
  }

  // ============================================
  // CARREGA MÁQUINAS E MOVIMENTAÇÕES DO PERÍODO
  // ============================================
  async function carregarDadosPeriodo() {
    if (!window.SupabaseAPI?.client) return;
    const { ano, mes } = __filtros;
    if (!ano || !mes) return;
    const { ini, fim } = ymRange(ano, mes);

    try {
      // Máquinas ativas (todas empresas do filtro / ou de todos empresas)
      const empIds = __filtros.empresa
        ? Object.values(__empresasMap).filter(e => e.nome === __filtros.empresa).map(e => e.id)
        : Object.keys(__empresasMap);

      // Máquinas — sem filtro de período (é situação atual)
      let mqQ = window.SupabaseAPI.client.from('maquinas').select('*').eq('ativo', true);
      if (empIds.length) mqQ = mqQ.in('empresa_id', empIds);
      const { data: mqs } = await mqQ;
      __maquinas = mqs || [];

      // Bobinas — no período
      let bmQ = window.SupabaseAPI.client.from('bobinas_movimentacoes')
        .select('*')
        .eq('tipo', 'entrega')
        .gte('data_evento', ini).lte('data_evento', fim);
      if (empIds.length) bmQ = bmQ.in('empresa_id', empIds);
      const { data: bms } = await bmQ;
      __bobMovs = bms || [];

      // Peças em máquinas — instaladas no período
      try {
        let pmQ = window.SupabaseAPI.client.from('maquinas_pecas')
          .select('*')
          .gte('data_instalacao', ini).lte('data_instalacao', fim);
        if (empIds.length) pmQ = pmQ.in('empresa_id', empIds);
        const { data: pms } = await pmQ;
        __maqPecas = pms || [];
      } catch(_) {
        __maqPecas = [];
      }
    } catch (e) {
      console.error('[Mapa] Erro carregar dados:', e);
    }
  }

  // ============================================
  // AGREGA POR GERENTE
  // ============================================
  function agregarPorGerente() {
    // Filtra gerentes por empresa/rota se aplicável
    let ativos = __gerentes.slice();
    if (__filtros.empresa) {
      ativos = ativos.filter(g => g.empresa_nome === __filtros.empresa);
    }

    // Mapa: maquinas por gerente_atual_id
    const maqPorGer = new Map();
    __maquinas.forEach(m => {
      if (!m.gerente_atual_id) return;
      const arr = maqPorGer.get(m.gerente_atual_id) || [];
      arr.push(m);
      maqPorGer.set(m.gerente_atual_id, arr);
    });

    // Mapa: bobinas por gerente_id
    const bobPorGer = new Map();
    __bobMovs.forEach(mv => {
      if (!mv.gerente_id) return;
      const arr = bobPorGer.get(mv.gerente_id) || [];
      arr.push(mv);
      bobPorGer.set(mv.gerente_id, arr);
    });

    // Mapa: peças por gerente (via maquina)
    const maqIdToGer = new Map();
    __maquinas.forEach(m => { if (m.gerente_atual_id) maqIdToGer.set(m.id, m.gerente_atual_id); });
    const pecasPorGer = new Map();
    __maqPecas.forEach(p => {
      const gid = maqIdToGer.get(p.maquina_id);
      if (!gid) return;
      const arr = pecasPorGer.get(gid) || [];
      arr.push(p);
      pecasPorGer.set(gid, arr);
    });

    return ativos.map(g => {
      const maqs = maqPorGer.get(g.id) || [];
      const bobs = bobPorGer.get(g.id) || [];
      const pecas = pecasPorGer.get(g.id) || [];

      const bobinasQtd = bobs.reduce((a, b) => a + Math.abs(Number(b.quantidade) || 0), 0);
      const bobinasCusto = bobs.reduce((a, b) => a + (Number(b.custo_total) || 0), 0);
      const pecasCusto = pecas.reduce((a, p) => a + (Number(p.preco_unitario_momento) || 0) * (Number(p.quantidade) || 1), 0);

      // Rota principal do gerente: da primeira máquina ativa que tenha rota_atual,
      // ou tenta pela ficha do gerente (número)
      let rota = '';
      const mqComRota = maqs.find(m => m.rota_atual);
      if (mqComRota) rota = mqComRota.rota_atual;

      // Contagem de status
      const statusCount = { com_vendedor: 0, estoque: 0, manutencao: 0 };
      maqs.forEach(m => { if (statusCount[m.status] !== undefined) statusCount[m.status]++; });

      return {
        id: g.id,
        nome: g.nome,
        numero: g.numero,
        mensal: !!g.mensal,
        empresa_nome: g.empresa_nome,
        empresa_emoji: g.empresa_emoji,
        rota,
        maqs, bobs, pecas,
        maquinas_count: maqs.length,
        maquinas_manut: statusCount.manutencao,
        bobinas_qtd: bobinasQtd,
        bobinas_custo: bobinasCusto,
        pecas_qtd: pecas.reduce((a, p) => a + (Number(p.quantidade) || 1), 0),
        pecas_custo: pecasCusto
      };
    }).filter(g => {
      // Se filtro de rota está ativo, mostra só gerentes que têm essa rota
      if (__filtros.rota) return String(g.rota).toLowerCase() === String(__filtros.rota).toLowerCase();
      return true;
    });
  }

  // ============================================
  // RENDER — RESUMO GERAL
  // ============================================
  function renderResumo(agregado) {
    const { ano, mes } = __filtros;
    document.getElementById('mapaResumoTitulo').textContent =
      `📊 Resumo Geral — ${nomeMesLongo(mes)}/${ano}`;

    const totGer = agregado.length;
    const semanais = agregado.filter(g => !g.mensal).length;
    const mensais  = agregado.filter(g =>  g.mensal).length;

    const totMaq = agregado.reduce((a, g) => a + g.maquinas_count, 0);
    const totManut = agregado.reduce((a, g) => a + g.maquinas_manut, 0);
    const totBob = agregado.reduce((a, g) => a + g.bobinas_qtd, 0);
    const totBobV = agregado.reduce((a, g) => a + g.bobinas_custo, 0);
    const totPecas = agregado.reduce((a, g) => a + g.pecas_qtd, 0);
    const totPecasV = agregado.reduce((a, g) => a + g.pecas_custo, 0);

    document.getElementById('rGerentes').textContent = totGer;
    document.getElementById('rGerentesSub').textContent = `${semanais} sem • ${mensais} mensais`;
    document.getElementById('rMaquinas').textContent = totMaq;
    document.getElementById('rMaquinasSub').textContent = totManut ? `${totManut} em manutenção` : 'todas ativas';
    document.getElementById('rBobinas').textContent = `${totBob} un.`;
    document.getElementById('rBobinasSub').textContent = fmtBRL(totBobV);
    document.getElementById('rPecas').textContent = totPecas;
    document.getElementById('rPecasSub').textContent = fmtBRL(totPecasV);
    document.getElementById('rCusto').textContent = fmtBRL(totBobV + totPecasV);
  }

  // ============================================
  // RENDER — GRID DE CARDS
  // ============================================
  function renderGrid() {
    const wrap = document.getElementById('mapaGrid');
    const count = document.getElementById('mapaCountGer');
    if (!wrap) return;

    const busca = (document.getElementById('mapaBusca')?.value || '').toLowerCase().trim();
    const ordem = document.getElementById('mapaOrdem')?.value || 'bobinas';

    let lista = agregarPorGerente();
    if (busca) {
      lista = lista.filter(g =>
        String(g.nome).toLowerCase().includes(busca) ||
        String(g.rota).toLowerCase().includes(busca)
      );
    }

    // Ordenação
    lista.sort((a, b) => {
      if (ordem === 'nome') return a.nome.localeCompare(b.nome);
      if (ordem === 'rota') return String(a.rota).localeCompare(String(b.rota));
      if (ordem === 'maquinas') return b.maquinas_count - a.maquinas_count;
      return b.bobinas_qtd - a.bobinas_qtd;  // default: bobinas
    });

    if (count) count.textContent = `(${lista.length})`;

    // Renderiza resumo com o AGREGADO já filtrado (para KPIs refletirem o filtro)
    renderResumo(lista);

    if (!lista.length) {
      wrap.innerHTML = '<div style="grid-column:1/-1; color:#6b7280; padding:30px; text-align:center;">Nenhum gerente encontrado com esses filtros.</div>';
      return;
    }

    const mesRotulo = nomeMes(__filtros.mes);

    wrap.innerHTML = lista.map(g => {
      const manutLabel = g.maquinas_manut
        ? `<small style="color:#92400e;">${g.maquinas_manut} manut</small>`
        : '';
      return `
        <div class="mapa-card" data-ger-id="${esc(g.id)}"
             style="background:#fff; border:1px solid #e5e7eb; border-radius:10px; padding:14px; cursor:pointer; transition:all .15s ease;">
          <div style="font-weight:700; font-size:14px; margin-bottom:2px;">${esc(g.nome)}</div>
          <div style="margin-bottom:10px;">
            ${g.rota ? `<span style="background:#e0e7ff; color:#3730a3; padding:1px 7px; border-radius:6px; font-size:10px; font-weight:600;">${esc(g.rota)}</span>` : ''}
            <span style="background:#f3f4f6; color:#374151; padding:1px 7px; border-radius:6px; font-size:10px; font-weight:600; margin-left:4px;">${esc(g.empresa_emoji)} ${esc(g.empresa_nome)}</span>
            ${g.mensal ? '<span style="background:#ede9fe; color:#6d28d9; padding:1px 7px; border-radius:6px; font-size:10px; font-weight:600; margin-left:4px;">🗓️ mensal</span>' : ''}
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
            <div style="background:#f9fafb; padding:8px; border-radius:6px; text-align:center;">
              <div style="font-size:20px; font-weight:700; line-height:1; color:#059669;">${g.maquinas_count}</div>
              <div style="font-size:10px; color:#6b7280; margin-top:2px;">Máquinas ${manutLabel}</div>
            </div>
            <div style="background:#f9fafb; padding:8px; border-radius:6px; text-align:center;">
              <div style="font-size:20px; font-weight:700; line-height:1; color:#d97706;">${g.bobinas_qtd}</div>
              <div style="font-size:10px; color:#6b7280; margin-top:2px;">Bobinas <small>${mesRotulo}</small></div>
            </div>
          </div>
          <button type="button" class="btn-det" data-ver-detalhes
                  style="width:100%; margin-top:10px; padding:6px; background:transparent; color:#2563eb; border:1px dashed #e5e7eb; border-radius:6px; font-size:11px; font-weight:600; cursor:pointer;">
            Ver detalhes ▸
          </button>
        </div>
      `;
    }).join('');
  }

  // ============================================
  // DIALOG DE DETALHES
  // ============================================
  async function abrirDetalhes(gerId) {
    const dlg = document.getElementById('dlgMapaDetalhes');
    if (!dlg) return;

    // Encontra o gerente agregado
    const agregado = agregarPorGerente();
    const g = agregado.find(x => x.id === gerId);
    if (!g) return;

    document.getElementById('dlgMapaNome').textContent = g.nome;
    document.getElementById('dlgMapaMeta').innerHTML =
      `${g.rota ? `<span style="background:#e0e7ff; color:#3730a3; padding:2px 7px; border-radius:6px; font-size:11px; font-weight:600;">${esc(g.rota)}</span>` : ''}
       <span style="margin-left:6px;">${esc(g.empresa_emoji)} ${esc(g.empresa_nome)}</span>
       ${g.mensal ? ' • <em style="color:#6d28d9;">Prestação mensal</em>' : ''}`;

    const conteudo = document.getElementById('dlgMapaConteudo');
    conteudo.innerHTML = '<div style="color:#6b7280; padding:20px; text-align:center;">Carregando histórico...</div>';
    dlg.showModal();

    // Carrega histórico mensal (últimos 6 meses)
    const hist = await carregarHistoricoMensal(gerId);

    // Monta HTML
    const partes = [];

    // 1) MÁQUINAS (situação atual)
    partes.push(`<h4 style="margin:0 0 8px; font-size:13px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px;">🖥️ Máquinas cadastradas neste gerente</h4>`);
    if (!g.maqs.length) {
      partes.push('<div style="color:#6b7280; font-style:italic; padding:8px;">Nenhuma máquina atribuída.</div>');
    } else {
      partes.push(`
        <table style="width:100%; border-collapse:collapse; font-size:13px; margin-bottom:16px;">
          <thead><tr style="background:#f9fafb;">
            <th style="text-align:left; padding:8px 6px; font-size:11px; color:#6b7280; text-transform:uppercase;">Serial</th>
            <th style="text-align:left; padding:8px 6px; font-size:11px; color:#6b7280; text-transform:uppercase;">Modelo</th>
            <th style="text-align:left; padding:8px 6px; font-size:11px; color:#6b7280; text-transform:uppercase;">Rota</th>
            <th style="text-align:left; padding:8px 6px; font-size:11px; color:#6b7280; text-transform:uppercase;">Chip</th>
            <th style="text-align:left; padding:8px 6px; font-size:11px; color:#6b7280; text-transform:uppercase;">Desde</th>
            <th style="text-align:left; padding:8px 6px; font-size:11px; color:#6b7280; text-transform:uppercase;">Status</th>
          </tr></thead>
          <tbody>
            ${g.maqs.map(m => {
              const statusMap = {
                com_vendedor: '<span style="background:#d1fae5; color:#065f46; padding:2px 7px; border-radius:6px; font-size:11px; font-weight:600;">Com vendedor</span>',
                manutencao:   '<span style="background:#fef3c7; color:#92400e; padding:2px 7px; border-radius:6px; font-size:11px; font-weight:600;">Manutenção</span>',
                estoque:      '<span style="background:#e0f2fe; color:#075985; padding:2px 7px; border-radius:6px; font-size:11px; font-weight:600;">Estoque</span>'
              };
              return `<tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:8px 6px;"><strong>${esc(m.serial || '')}</strong></td>
                <td style="padding:8px 6px;">${esc(m.modelo || '—')}</td>
                <td style="padding:8px 6px;">${m.rota_atual ? `<span style="background:#e0e7ff; color:#3730a3; padding:2px 7px; border-radius:6px; font-size:11px; font-weight:600;">${esc(m.rota_atual)}</span>` : '—'}</td>
                <td style="padding:8px 6px;">${esc(m.chip_atual || '—')}</td>
                <td style="padding:8px 6px;">${fmtData(m.data_entrada)}</td>
                <td style="padding:8px 6px;">${statusMap[m.status] || esc(m.status || '')}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      `);
    }

    // 2) BOBINAS DO MÊS ATUAL (detalhado)
    partes.push(`<h4 style="margin:12px 0 8px; font-size:13px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px;">🧻 Bobinas — ${nomeMesLongo(__filtros.mes)}/${__filtros.ano}</h4>`);
    if (!g.bobs.length) {
      partes.push('<div style="color:#6b7280; font-style:italic; padding:8px;">Nenhuma bobina entregue no período.</div>');
    } else {
      const sortedBobs = g.bobs.slice().sort((a, b) => String(a.data_evento).localeCompare(String(b.data_evento)));
      partes.push(`
        <table style="width:100%; border-collapse:collapse; font-size:13px; margin-bottom:16px;">
          <thead><tr style="background:#f9fafb;">
            <th style="text-align:left; padding:8px 6px; font-size:11px; color:#6b7280;">Data</th>
            <th style="text-align:left; padding:8px 6px; font-size:11px; color:#6b7280;">Rota</th>
            <th style="text-align:right; padding:8px 6px; font-size:11px; color:#6b7280;">Qtd</th>
            <th style="text-align:right; padding:8px 6px; font-size:11px; color:#6b7280;">Custo</th>
          </tr></thead>
          <tbody>
            ${sortedBobs.map(b => `
              <tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:8px 6px;">${fmtData(b.data_evento)}</td>
                <td style="padding:8px 6px;">${b.rota ? `<span style="background:#e0e7ff; color:#3730a3; padding:2px 7px; border-radius:6px; font-size:11px; font-weight:600;">${esc(b.rota)}</span>` : '—'}</td>
                <td style="padding:8px 6px; text-align:right; font-family:ui-monospace,monospace;">${Math.abs(Number(b.quantidade) || 0)}</td>
                <td style="padding:8px 6px; text-align:right; font-family:ui-monospace,monospace;">${fmtBRL(b.custo_total)}</td>
              </tr>
            `).join('')}
            <tr style="background:#f9fafb; font-weight:700;">
              <td colspan="2" style="padding:8px 6px;">TOTAL DO MÊS</td>
              <td style="padding:8px 6px; text-align:right; font-family:ui-monospace,monospace;">${g.bobinas_qtd}</td>
              <td style="padding:8px 6px; text-align:right; color:#059669; font-family:ui-monospace,monospace;">${fmtBRL(g.bobinas_custo)}</td>
            </tr>
          </tbody>
        </table>
      `);
    }

    // 3) HISTÓRICO MENSAL
    partes.push(`<h4 style="margin:12px 0 8px; font-size:13px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px;">📅 Histórico mensal de bobinas</h4>`);
    if (!hist.length) {
      partes.push('<div style="color:#6b7280; font-style:italic; padding:8px;">Sem histórico anterior.</div>');
    } else {
      partes.push(`
        <table style="width:100%; border-collapse:collapse; font-size:13px; margin-bottom:16px;">
          <thead><tr style="background:#f9fafb;">
            <th style="text-align:left; padding:8px 6px; font-size:11px; color:#6b7280;">Mês</th>
            <th style="text-align:right; padding:8px 6px; font-size:11px; color:#6b7280;">Qtd entregue</th>
            <th style="text-align:right; padding:8px 6px; font-size:11px; color:#6b7280;">Custo total</th>
            <th style="text-align:right; padding:8px 6px; font-size:11px; color:#6b7280;">Média/semana</th>
          </tr></thead>
          <tbody>
            ${hist.map(h => `
              <tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:8px 6px;">${h.rotulo}${h.atual ? ' <small style="color:#6b7280;">(atual)</small>' : ''}</td>
                <td style="padding:8px 6px; text-align:right; font-family:ui-monospace,monospace;">${h.qtd}</td>
                <td style="padding:8px 6px; text-align:right; font-family:ui-monospace,monospace;">${fmtBRL(h.custo)}</td>
                <td style="padding:8px 6px; text-align:right; font-family:ui-monospace,monospace;">~${(h.qtd / 4).toFixed(1)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `);
    }

    // 4) PEÇAS DO MÊS
    partes.push(`<h4 style="margin:12px 0 8px; font-size:13px; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px;">🔧 Peças usadas (assistência) — ${nomeMesLongo(__filtros.mes)}/${__filtros.ano}</h4>`);
    if (!g.pecas.length) {
      partes.push('<div style="color:#6b7280; font-style:italic; padding:8px;">Nenhuma peça instalada no período.</div>');
    } else {
      // resolve serial da máquina pra cada peça
      const maqIdSerial = new Map();
      g.maqs.forEach(m => maqIdSerial.set(m.id, m.serial));
      partes.push(`
        <table style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead><tr style="background:#f9fafb;">
            <th style="text-align:left; padding:8px 6px; font-size:11px; color:#6b7280;">Data</th>
            <th style="text-align:left; padding:8px 6px; font-size:11px; color:#6b7280;">Máquina</th>
            <th style="text-align:left; padding:8px 6px; font-size:11px; color:#6b7280;">Peça</th>
            <th style="text-align:right; padding:8px 6px; font-size:11px; color:#6b7280;">Qtd</th>
            <th style="text-align:right; padding:8px 6px; font-size:11px; color:#6b7280;">Custo</th>
          </tr></thead>
          <tbody>
            ${g.pecas.map(p => `
              <tr style="border-bottom:1px solid #e5e7eb;">
                <td style="padding:8px 6px;">${fmtData(p.data_instalacao)}</td>
                <td style="padding:8px 6px;">${esc(maqIdSerial.get(p.maquina_id) || '—')}</td>
                <td style="padding:8px 6px;"><strong>${esc(p.peca_codigo || '')}</strong> — ${esc(p.peca_nome || '')}</td>
                <td style="padding:8px 6px; text-align:right; font-family:ui-monospace,monospace;">${p.quantidade || 1}</td>
                <td style="padding:8px 6px; text-align:right; font-family:ui-monospace,monospace;">${fmtBRL((p.preco_unitario_momento || 0) * (p.quantidade || 1))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `);
    }

    conteudo.innerHTML = partes.join('');
  }

  // ============================================
  // HISTÓRICO MENSAL de bobinas de um gerente
  // ============================================
  async function carregarHistoricoMensal(gerId, meses = 6) {
    if (!window.SupabaseAPI?.client) return [];
    try {
      const hoje = new Date();
      const dataMin = new Date(hoje.getFullYear(), hoje.getMonth() - (meses - 1), 1);
      const iso = (d) => d.toISOString().slice(0,10);
      const { data } = await window.SupabaseAPI.client
        .from('bobinas_movimentacoes')
        .select('data_evento, quantidade, custo_total')
        .eq('gerente_id', gerId)
        .eq('tipo', 'entrega')
        .gte('data_evento', iso(dataMin));

      // agrupa por mês
      const mapa = new Map();  // "YYYY-MM" -> { qtd, custo }
      (data || []).forEach(m => {
        const ym = String(m.data_evento).slice(0, 7);
        if (!mapa.has(ym)) mapa.set(ym, { qtd: 0, custo: 0 });
        const acc = mapa.get(ym);
        acc.qtd += Math.abs(Number(m.quantidade) || 0);
        acc.custo += Number(m.custo_total) || 0;
      });

      // gera lista dos últimos N meses
      const out = [];
      for (let i = 0; i < meses; i++) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const y = d.getFullYear(), m = d.getMonth() + 1;
        const ym = `${y}-${String(m).padStart(2,'0')}`;
        const acc = mapa.get(ym) || { qtd: 0, custo: 0 };
        out.push({
          ym,
          rotulo: `${nomeMesLongo(m)}/${y}`,
          qtd: acc.qtd,
          custo: acc.custo,
          atual: (i === 0)
        });
      }
      return out;
    } catch (e) {
      console.error('[Mapa] Erro histórico:', e);
      return [];
    }
  }

  // ============================================
  // CSV
  // ============================================
  function exportarCSV() {
    const agregado = agregarPorGerente();
    const busca = (document.getElementById('mapaBusca')?.value || '').toLowerCase().trim();
    const lista = busca
      ? agregado.filter(g => String(g.nome).toLowerCase().includes(busca))
      : agregado;
    if (!lista.length) { notify('Nada a exportar.', 'warning'); return; }

    const linhas = [['Gerente','Empresa','Rota','Mensal','Máquinas','Manut','Bobinas (un.)','Bobinas (R$)','Peças (un.)','Peças (R$)','Total (R$)']];
    lista.forEach(g => {
      linhas.push([
        g.nome, g.empresa_nome, g.rota || '',
        g.mensal ? 'sim' : 'não',
        g.maquinas_count, g.maquinas_manut,
        g.bobinas_qtd, g.bobinas_custo.toFixed(2),
        g.pecas_qtd, g.pecas_custo.toFixed(2),
        (g.bobinas_custo + g.pecas_custo).toFixed(2)
      ]);
    });
    const csv = linhas.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mapa_${__filtros.ano}-${String(__filtros.mes).padStart(2,'0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify('CSV exportado.', 'success');
  }

  // ============================================
  // EVENTOS
  // ============================================
  function bindEvents() {
    const btnA = document.getElementById('btnMapaAplicar');
    if (btnA && !btnA.__wired) {
      btnA.__wired = true;
      btnA.addEventListener('click', async () => {
        btnA.disabled = true;
        await aplicarFiltrosERecarregar();
        btnA.disabled = false;
      });
    }
    const busca = document.getElementById('mapaBusca');
    if (busca && !busca.__wired) {
      busca.__wired = true;
      let t;
      busca.addEventListener('input', () => { clearTimeout(t); t = setTimeout(renderGrid, 200); });
    }
    const ordem = document.getElementById('mapaOrdem');
    if (ordem && !ordem.__wired) {
      ordem.__wired = true;
      ordem.addEventListener('change', renderGrid);
    }
    const btnC = document.getElementById('btnMapaCSV');
    if (btnC && !btnC.__wired) {
      btnC.__wired = true;
      btnC.addEventListener('click', exportarCSV);
    }
    // Delegação: clique nos cards (linha inteira ou botão detalhes)
    const grid = document.getElementById('mapaGrid');
    if (grid && !grid.__wired) {
      grid.__wired = true;
      grid.addEventListener('click', (e) => {
        const card = e.target.closest('[data-ger-id]');
        if (!card) return;
        const id = card.getAttribute('data-ger-id');
        abrirDetalhes(id);
      });
    }
    // Botões data-close-dlg (para o dialog)
    document.querySelectorAll('button[data-close-dlg]').forEach(b => {
      if (b.__wiredMapa) return;
      b.__wiredMapa = true;
      b.addEventListener('click', () => {
        const dlg = document.getElementById(b.getAttribute('data-close-dlg'));
        if (dlg && dlg.close) dlg.close();
      });
    });
  }

  // ============================================
  // APLICAR FILTROS
  // ============================================
  async function aplicarFiltrosERecarregar() {
    const sp = document.getElementById('mapaPeriodo')?.value || '';
    if (sp) {
      const [y, m] = sp.split('-');
      __filtros.ano = Number(y);
      __filtros.mes = Number(m);
    }
    __filtros.empresa = document.getElementById('mapaEmpresa')?.value || '';
    __filtros.rota    = document.getElementById('mapaRota')?.value || '';
    await carregarDadosPeriodo();
    renderGrid();
  }

  async function init() {
    if (__initialized) {
      await aplicarFiltrosERecarregar();
      return;
    }
    __initialized = true;
    console.log('[Mapa] 🔄 Inicializando...');
    await carregarGerentesEmpresas();
    popularSelectPeriodo();
    popularSelectEmpresa();
    popularSelectRota();
    bindEvents();
    await aplicarFiltrosERecarregar();
    console.log('[Mapa] ✅ Pronto');
  }

  window.MapaPage = { init, render: aplicarFiltrosERecarregar };
  window.renderMapa = aplicarFiltrosERecarregar;

  // CSS extra para hover dos cards
  const style = document.createElement('style');
  style.textContent = `
    .mapa-card:hover {
      border-color: #2563eb !important;
      box-shadow: 0 4px 12px rgba(37,99,235,0.15);
      transform: translateY(-1px);
    }
  `;
  document.head.appendChild(style);

  console.log('[Mapa] ✅ Módulo carregado');
})();
