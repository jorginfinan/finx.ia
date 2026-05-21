// ============================================
// PEÇAS DE MÁQUINAS — catálogo, estoque, histórico
// ============================================
(function () {
  'use strict';

  if (window.__PECAS_LOADED__) {
    console.warn('[Peças] Já carregado, ignorando...');
    return;
  }
  window.__PECAS_LOADED__ = true;

  let __initialized = false;
  let __saving = false;
  let __cachePecas = [];

  // ============================================
  // HELPERS
  // ============================================
  function esc(s) {
    const map = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
    return String(s ?? '').replace(/[&<>"']/g, m => map[m] || m);
  }

  function fmtBRL(n) {
    const v = Number(n) || 0;
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function fmtData(s) {
    if (!s) return '';
    const parts = String(s).split('T')[0].split('-');
    if (parts.length !== 3) return s;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  function fmtDataHora(s) {
    if (!s) return '';
    try {
      const d = new Date(s);
      return d.toLocaleString('pt-BR');
    } catch (_) { return s; }
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

  function parseModelos(str) {
    if (!str) return [];
    if (Array.isArray(str)) return str.map(s => String(s).trim()).filter(Boolean);
    return String(str)
      .split(/[,;\n]/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  function statusPeca(p) {
    if (!p.ativo) return { label: 'INATIVA', cor: '#6b7280', bg: '#f3f4f6', tag: 'inativa' };
    const atual = Number(p.estoque_atual) || 0;
    const min = Number(p.estoque_minimo) || 0;
    if (atual <= 0) return { label: 'SEM ESTOQUE', cor: '#991b1b', bg: '#fee2e2', tag: 'zero' };
    if (atual <= min) return { label: 'BAIXO', cor: '#92400e', bg: '#fef3c7', tag: 'baixo' };
    return { label: 'OK', cor: '#065f46', bg: '#d1fae5', tag: 'ok' };
  }

  // ============================================
  // CARREGAR DADOS
  // ============================================
  async function loadPecas() {
    try {
      if (!window.SupabaseAPI?.pecas) {
        console.warn('[Peças] SupabaseAPI.pecas indisponível');
        return [];
      }
      __cachePecas = await window.SupabaseAPI.pecas.getAll();
      return __cachePecas;
    } catch (e) {
      console.error('[Peças] Erro ao carregar:', e);
      return [];
    }
  }

  async function loadStats() {
    try {
      const stats = await window.SupabaseAPI.pecas.getEstatisticas();
      const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      setTxt('kpiPecasTotal', stats.total_pecas || 0);
      setTxt('kpiPecasUnidades', stats.total_unidades || 0);
      setTxt('kpiPecasBaixo', stats.baixo_estoque || 0);
      setTxt('kpiPecasZero', stats.sem_estoque || 0);
      setTxt('kpiPecasValor', fmtBRL(stats.valor_total_custo || 0));
    } catch (e) {
      console.error('[Peças] Erro stats:', e);
    }
  }

  // ============================================
  // RENDER PRINCIPAL DA TABELA
  // ============================================
  function renderTabela() {
    const tbody = document.getElementById('tbodyPecas');
    if (!tbody) return;

    const busca = (document.getElementById('pecasBusca')?.value || '').toLowerCase().trim();
    const filtro = document.getElementById('pecasFiltroStatus')?.value || '';

    let lista = __cachePecas.slice();

    if (busca) {
      lista = lista.filter(p => {
        const blob = [
          p.codigo, p.nome, p.fornecedor, p.descricao,
          (p.modelos_compativeis || []).join(' ')
        ].map(x => String(x || '').toLowerCase()).join(' ');
        return blob.includes(busca);
      });
    }

    if (filtro) {
      lista = lista.filter(p => statusPeca(p).tag === filtro);
    }

    if (!lista.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#6b7280; padding:30px;">Nenhuma peça encontrada.</td></tr>';
      return;
    }

    const podeEditar = podeFazer('maquinas_cadastrar');

    tbody.innerHTML = lista.map(p => {
      const st = statusPeca(p);
      const modelos = (p.modelos_compativeis || []).slice(0, 3).map(esc).join(', ');
      const maisModelos = (p.modelos_compativeis || []).length > 3 ? ` <small style="color:#6b7280;">+${(p.modelos_compativeis.length - 3)}</small>` : '';
      const linhaStyle = !p.ativo ? 'opacity:0.5;' : (st.tag === 'zero' ? 'background:#fef2f2;' : (st.tag === 'baixo' ? 'background:#fffbeb;' : ''));

      return `
        <tr style="${linhaStyle}" data-peca-id="${esc(p.id)}">
          <td><strong>${esc(p.codigo)}</strong></td>
          <td>
            ${esc(p.nome)}
            ${p.descricao ? `<br><small style="color:#6b7280;">${esc(String(p.descricao).slice(0, 70))}${p.descricao.length > 70 ? '…' : ''}</small>` : ''}
          </td>
          <td>${esc(p.fornecedor || '—')}</td>
          <td style="white-space:nowrap;">
            <span style="background:${st.bg}; color:${st.cor}; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:600;">
              ${Number(p.estoque_atual)||0} / mín ${Number(p.estoque_minimo)||0}
            </span>
            <br><small style="color:${st.cor};">${st.label}</small>
          </td>
          <td style="white-space:nowrap;">${fmtBRL(p.preco_custo)}</td>
          <td>${modelos || '—'}${maisModelos}</td>
          <td class="tv-right" style="white-space:nowrap;">
            <button class="btn ghost" data-act="historico" title="Histórico">📜</button>
            ${podeEditar ? '<button class="btn" data-act="entrada" title="Entrada de estoque">📥</button>' : ''}
            ${podeEditar ? '<button class="btn ghost" data-act="saida" title="Saída de estoque">📤</button>' : ''}
            ${podeEditar ? '<button class="btn ghost" data-act="ajuste" title="Ajuste">⚙️</button>' : ''}
            ${podeEditar ? '<button class="btn ghost" data-act="editar" title="Editar">✏️</button>' : ''}
            ${podeEditar ? `<button class="btn ${p.ativo ? 'danger' : ''}" data-act="${p.ativo ? 'inativar' : 'ativar'}" title="${p.ativo ? 'Inativar' : 'Ativar'}">${p.ativo ? '🗑️' : '↩️'}</button>` : ''}
          </td>
        </tr>
      `;
    }).join('');
  }

  // ============================================
  // FORM CADASTRO / EDIÇÃO
  // ============================================
  function resetForm() {
    const form = document.getElementById('formPeca');
    if (!form) return;
    form.reset();
    delete form.dataset.editingId;
    document.getElementById('pecaFormTitulo').textContent = 'Nova Peça';
    document.getElementById('btnSalvarPeca').textContent = 'Salvar Peça';
  }

  function carregarParaEdicao(p) {
    const form = document.getElementById('formPeca');
    if (!form) return;
    form.dataset.editingId = p.id;
    form.codigo.value = p.codigo || '';
    form.nome.value = p.nome || '';
    form.fornecedor.value = p.fornecedor || '';
    form.preco_custo.value = p.preco_custo ?? '';
    form.preco_unitario.value = p.preco_unitario ?? '';
    form.estoque_atual.value = p.estoque_atual ?? 0;
    form.estoque_minimo.value = p.estoque_minimo ?? 0;
    form.modelos_compativeis.value = (p.modelos_compativeis || []).join(', ');
    form.descricao.value = p.descricao || '';
    form.observacao.value = p.observacao || '';
    document.getElementById('pecaFormTitulo').textContent = 'Editar Peça: ' + p.codigo;
    document.getElementById('btnSalvarPeca').textContent = 'Atualizar Peça';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function onSubmitForm(e) {
    e.preventDefault();
    if (__saving) return;
    __saving = true;

    const form = e.currentTarget;
    const btn = document.getElementById('btnSalvarPeca');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

    try {
      if (!podeFazer('maquinas_cadastrar')) {
        throw new Error('Você não tem permissão para cadastrar/editar peças.');
      }

      const fd = new FormData(form);
      const editingId = form.dataset.editingId || '';

      const codigo = String(fd.get('codigo') || '').trim();
      const nome = String(fd.get('nome') || '').trim();
      if (!codigo) throw new Error('Informe o código da peça.');
      if (!nome) throw new Error('Informe o nome da peça.');

      const payload = {
        codigo,
        nome,
        fornecedor: String(fd.get('fornecedor') || '').trim() || null,
        preco_custo: Number(fd.get('preco_custo')) || 0,
        preco_unitario: Number(fd.get('preco_unitario')) || 0,
        estoque_atual: Number(fd.get('estoque_atual')) || 0,
        estoque_minimo: Number(fd.get('estoque_minimo')) || 0,
        modelos_compativeis: parseModelos(fd.get('modelos_compativeis')),
        descricao: String(fd.get('descricao') || '').trim() || null,
        observacao: String(fd.get('observacao') || '').trim() || null
      };

      if (editingId) {
        await window.SupabaseAPI.pecas.update(editingId, payload);
        if (window.AuditLog) window.AuditLog.log('peca_editada', { id: editingId, codigo, nome });
        notify('Peça atualizada com sucesso!', 'success');
      } else {
        // Checa duplicidade de código
        const existente = await window.SupabaseAPI.pecas.getByCodigo(codigo);
        if (existente) throw new Error('Já existe uma peça com este código nesta empresa.');

        payload.ativo = true;
        const created = await window.SupabaseAPI.pecas.create(payload);

        // Se houver estoque inicial, registra como movimentação 'entrada'
        if (payload.estoque_atual > 0) {
          try {
            // Como o create já gravou estoque_atual, voltamos para 0 e usamos aplicarMovimentacao
            // para garantir log. Mais simples: gravar manualmente como log inicial.
            await window.SupabaseAPI.client
              .from('pecas_movimentacoes')
              .insert([{
                empresa_id: created.empresa_id,
                peca_id: created.id,
                tipo: 'entrada',
                quantidade: payload.estoque_atual,
                estoque_antes: 0,
                estoque_depois: payload.estoque_atual,
                preco_unitario_momento: payload.preco_custo || 0,
                custo_total: (payload.preco_custo || 0) * payload.estoque_atual,
                motivo: 'Estoque inicial (cadastro)',
                data_evento: hoje(),
                usuario_nome: (window.getUsuarioAtual?.()?.nome) || 'Sistema'
              }]);
          } catch (e) {
            console.warn('[Peças] Não foi possível registrar log de estoque inicial:', e);
          }
        }

        if (window.AuditLog) window.AuditLog.log('peca_cadastrada', { id: created.id, codigo, nome });
        notify('Peça cadastrada com sucesso!', 'success');
      }

      resetForm();
      await render();
    } catch (e) {
      console.error('[Peças] Erro ao salvar:', e);
      notify(e.message || 'Erro ao salvar peça', 'error');
    } finally {
      __saving = false;
      if (btn) { btn.disabled = false; btn.textContent = document.getElementById('formPeca')?.dataset.editingId ? 'Atualizar Peça' : 'Salvar Peça'; }
    }
  }

  // ============================================
  // INATIVAR / ATIVAR
  // ============================================
  async function inativarPeca(p) {
    if (!confirm(`Inativar a peça "${p.codigo} — ${p.nome}"?\n\nEla deixará de aparecer nas listas, mas o histórico será preservado.`)) return;
    try {
      await window.SupabaseAPI.pecas.update(p.id, { ativo: false });
      if (window.AuditLog) window.AuditLog.log('peca_inativada', { id: p.id, codigo: p.codigo });
      notify('Peça inativada.', 'success');
      await render();
    } catch (e) {
      notify(e.message || 'Erro ao inativar', 'error');
    }
  }

  async function ativarPeca(p) {
    try {
      await window.SupabaseAPI.pecas.update(p.id, { ativo: true });
      if (window.AuditLog) window.AuditLog.log('peca_ativada', { id: p.id, codigo: p.codigo });
      notify('Peça reativada.', 'success');
      await render();
    } catch (e) {
      notify(e.message || 'Erro ao reativar', 'error');
    }
  }

  // ============================================
  // MOVIMENTAÇÃO DE ESTOQUE (entrada / saida / ajuste)
  // ============================================
  function abrirDialogMov(p, tipo) {
    const dlg = document.getElementById('dlgPecaEstoque');
    if (!dlg) return;

    const titulos = {
      entrada: '📥 Entrada de Estoque',
      saida:   '📤 Saída de Estoque',
      ajuste:  '⚙️ Ajuste de Estoque'
    };

    document.getElementById('dlgPecaEstoqueTitulo').textContent = titulos[tipo] || 'Movimentar Estoque';
    document.getElementById('dlgPecaInfo').textContent = `${p.codigo} — ${p.nome}`;
    document.getElementById('dlgPecaSaldoAtual').textContent = `Saldo atual: ${Number(p.estoque_atual)||0} un.${tipo==='ajuste' ? ' (informe a nova quantidade DESEJADA)' : ''}`;

    const form = document.getElementById('formPecaMov');
    form.reset();
    form.peca_id.value = p.id;
    form.tipo.value = tipo;
    form.data_evento.value = hoje();
    form.preco_unitario_momento.value = p.preco_custo || '';

    // Se ajuste, label da quantidade muda visualmente — usamos placeholder
    form.quantidade.placeholder = (tipo === 'ajuste') ? 'novo saldo (ex.: 12)' : 'quantidade (ex.: 10)';

    dlg.showModal();
  }

  async function onSubmitMov(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const pecaId = String(fd.get('peca_id') || '');
    const tipo = String(fd.get('tipo') || '');
    const qtd = Number(fd.get('quantidade')) || 0;
    const preco = fd.get('preco_unitario_momento') ? Number(fd.get('preco_unitario_momento')) : null;
    const motivo = String(fd.get('motivo') || '').trim() || null;
    const observacao = String(fd.get('observacao') || '').trim() || null;
    const dataEvento = String(fd.get('data_evento') || hoje());

    if (!pecaId || !tipo) { notify('Dados incompletos.', 'error'); return; }
    if (qtd <= 0) { notify('Quantidade deve ser maior que zero.', 'error'); return; }

    try {
      const peca = __cachePecas.find(p => p.id === pecaId);
      if (!peca) throw new Error('Peça não encontrada no cache.');

      let delta = 0;
      if (tipo === 'entrada') delta = +qtd;
      else if (tipo === 'saida') delta = -qtd;
      else if (tipo === 'ajuste') {
        // qtd aqui = novo saldo desejado
        const atual = Number(peca.estoque_atual) || 0;
        delta = qtd - atual;
        if (delta === 0) { notify('O novo saldo é igual ao atual; nada a fazer.', 'warning'); return; }
      } else {
        throw new Error('Tipo de movimentação inválido.');
      }

      await window.SupabaseAPI.pecas.aplicarMovimentacao({
        pecaId,
        delta,
        tipo: tipo === 'ajuste' ? 'ajuste' : tipo,
        precoUnitario: preco,
        motivo,
        observacao,
        dataEvento
      });

      if (window.AuditLog) window.AuditLog.log('peca_movimentada', { id: pecaId, codigo: peca.codigo, tipo, delta });

      document.getElementById('dlgPecaEstoque').close();
      notify('Estoque atualizado!', 'success');
      await render();
    } catch (e) {
      console.error('[Peças] Erro mov:', e);
      notify(e.message || 'Erro ao movimentar estoque', 'error');
    }
  }

  // ============================================
  // HISTÓRICO DA PEÇA
  // ============================================
  async function abrirHistorico(p) {
    const dlg = document.getElementById('dlgPecaHistorico');
    const info = document.getElementById('dlgPecaHistoricoInfo');
    const lista = document.getElementById('dlgPecaHistoricoLista');
    if (!dlg) return;

    info.innerHTML = `
      <div style="font-size:14px;"><strong>${esc(p.codigo)}</strong> — ${esc(p.nome)}</div>
      <div style="font-size:12px; color:#6b7280; margin-top:4px;">
        Saldo atual: <strong>${Number(p.estoque_atual)||0}</strong> un. •
        Mínimo: ${Number(p.estoque_minimo)||0} •
        Custo: ${fmtBRL(p.preco_custo)}
      </div>
    `;
    lista.innerHTML = '<div style="color:#6b7280; padding:20px; text-align:center;">Carregando...</div>';
    dlg.showModal();

    try {
      const [movs, vinculos] = await Promise.all([
        window.SupabaseAPI.pecasMovimentacoes.getByPeca(p.id),
        window.SupabaseAPI.maquinasPecas.getByPeca(p.id)
      ]);

      const partes = [];

      // bloco de movimentações de estoque
      partes.push('<h4 style="margin:0 0 8px;">Movimentações de estoque</h4>');
      if (!movs.length) {
        partes.push('<div style="color:#6b7280;">Sem movimentações.</div>');
      } else {
        const tipos = {
          entrada:    { ico: '📥', cor: '#10b981', label: 'Entrada' },
          saida:      { ico: '📤', cor: '#ef4444', label: 'Saída' },
          ajuste:     { ico: '⚙️', cor: '#6366f1', label: 'Ajuste' },
          instalacao: { ico: '🔧', cor: '#f59e0b', label: 'Instalação em máquina' },
          remocao:    { ico: '🔁', cor: '#0ea5e9', label: 'Removida de máquina' }
        };
        partes.push(movs.map(mv => {
          const t = tipos[mv.tipo] || { ico: '•', cor: '#6b7280', label: mv.tipo };
          const q = Number(mv.quantidade) || 0;
          const sinal = q > 0 ? '+' : '';
          return `
            <div style="border-left:3px solid ${t.cor}; padding:8px 12px; margin-bottom:8px; background:#fafafa; border-radius:0 8px 8px 0;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong>${t.ico} ${t.label}</strong>
                <span style="font-family:monospace; color:${q>=0 ? '#065f46' : '#991b1b'};">${sinal}${q}</span>
              </div>
              <div style="font-size:12px; color:#6b7280; margin-top:2px;">
                ${fmtData(mv.data_evento)} • saldo: ${mv.estoque_antes} → <strong>${mv.estoque_depois}</strong>
                ${mv.usuario_nome ? ' • por ' + esc(mv.usuario_nome) : ''}
              </div>
              ${mv.motivo ? `<div style="font-size:12px; color:#374151; margin-top:4px;"><em>${esc(mv.motivo)}</em></div>` : ''}
              ${mv.observacao ? `<div style="font-size:12px; color:#374151; margin-top:2px;">${esc(mv.observacao)}</div>` : ''}
            </div>
          `;
        }).join(''));
      }

      // bloco de máquinas em que esta peça está/esteve
      partes.push('<h4 style="margin:16px 0 8px;">Máquinas em que esta peça foi instalada</h4>');
      if (!vinculos.length) {
        partes.push('<div style="color:#6b7280;">Nunca foi montada em uma máquina.</div>');
      } else {
        partes.push(vinculos.map(v => `
          <div style="border-left:3px solid ${v.removida ? '#9ca3af' : '#10b981'}; padding:8px 12px; margin-bottom:8px; background:#fafafa; border-radius:0 8px 8px 0;">
            <div style="display:flex; justify-content:space-between;">
              <strong>${v.removida ? '🔁 Já removida' : '✅ Instalada'} — qty ${v.quantidade||1}</strong>
              <small style="color:#6b7280;">${fmtData(v.data_instalacao)}${v.data_remocao ? ' → ' + fmtData(v.data_remocao) : ''}</small>
            </div>
            <div style="font-size:12px; color:#6b7280; margin-top:2px;">
              Máquina: <code>${esc(v.maquina_id)}</code>
            </div>
            ${v.instalacao_observacao ? `<div style="font-size:12px; margin-top:2px;">Obs.: ${esc(v.instalacao_observacao)}</div>` : ''}
            ${v.remocao_motivo ? `<div style="font-size:12px; margin-top:2px; color:#92400e;">Motivo remoção: ${esc(v.remocao_motivo)}</div>` : ''}
          </div>
        `).join(''));
      }

      lista.innerHTML = partes.join('');
    } catch (e) {
      console.error('[Peças] Erro histórico:', e);
      lista.innerHTML = '<div style="color:#dc2626;">Erro ao carregar histórico.</div>';
    }
  }

  // ============================================
  // EXPORTAR CSV
  // ============================================
  function exportarCSV() {
    try {
      const linhas = [['Código', 'Nome', 'Fornecedor', 'Estoque', 'Mínimo', 'Custo', 'Unitário', 'Status', 'Modelos compatíveis']];
      __cachePecas.forEach(p => {
        const st = statusPeca(p);
        linhas.push([
          p.codigo, p.nome, p.fornecedor || '',
          Number(p.estoque_atual)||0, Number(p.estoque_minimo)||0,
          p.preco_custo || 0, p.preco_unitario || 0,
          st.label,
          (p.modelos_compativeis || []).join(' | ')
        ]);
      });
      const csv = linhas.map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pecas_${hoje()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      notify('CSV exportado!', 'success');
    } catch (e) {
      console.error('[Peças] Erro export:', e);
      notify('Erro ao exportar CSV', 'error');
    }
  }

  // ============================================
  // RENDER PRINCIPAL
  // ============================================
  async function render() {
    await Promise.all([
      loadStats(),
      loadPecas().then(renderTabela)
    ]);
  }

  // ============================================
  // EVENTOS
  // ============================================
  function bindEvents() {
    const form = document.getElementById('formPeca');
    if (form && !form.__wired) {
      form.__wired = true;
      form.addEventListener('submit', onSubmitForm);
    }

    const btnLimpar = document.getElementById('btnLimparPeca');
    if (btnLimpar && !btnLimpar.__wired) {
      btnLimpar.__wired = true;
      btnLimpar.addEventListener('click', resetForm);
    }

    const busca = document.getElementById('pecasBusca');
    if (busca && !busca.__wired) {
      busca.__wired = true;
      let t;
      busca.addEventListener('input', () => { clearTimeout(t); t = setTimeout(renderTabela, 200); });
    }

    const filtro = document.getElementById('pecasFiltroStatus');
    if (filtro && !filtro.__wired) {
      filtro.__wired = true;
      filtro.addEventListener('change', renderTabela);
    }

    const btnAtu = document.getElementById('btnAtualizarPecas');
    if (btnAtu && !btnAtu.__wired) {
      btnAtu.__wired = true;
      btnAtu.addEventListener('click', async () => {
        btnAtu.disabled = true;
        await render();
        btnAtu.disabled = false;
        notify('Lista atualizada!', 'success');
      });
    }

    const btnExp = document.getElementById('btnExportarPecas');
    if (btnExp && !btnExp.__wired) {
      btnExp.__wired = true;
      btnExp.addEventListener('click', exportarCSV);
    }

    // Delegação na tabela
    const tbody = document.getElementById('tbodyPecas');
    if (tbody && !tbody.__wired) {
      tbody.__wired = true;
      tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-act]');
        if (!btn) return;
        const tr = btn.closest('tr[data-peca-id]');
        if (!tr) return;
        const id = tr.getAttribute('data-peca-id');
        const peca = __cachePecas.find(p => p.id === id);
        if (!peca) return;
        const act = btn.getAttribute('data-act');

        if (act === 'editar')    return carregarParaEdicao(peca);
        if (act === 'historico') return abrirHistorico(peca);
        if (act === 'entrada')   return abrirDialogMov(peca, 'entrada');
        if (act === 'saida')     return abrirDialogMov(peca, 'saida');
        if (act === 'ajuste')    return abrirDialogMov(peca, 'ajuste');
        if (act === 'inativar')  return inativarPeca(peca);
        if (act === 'ativar')    return ativarPeca(peca);
      });
    }

    // Form de movimentação no dialog
    const formMov = document.getElementById('formPecaMov');
    if (formMov && !formMov.__wired) {
      formMov.__wired = true;
      formMov.addEventListener('submit', onSubmitMov);
    }

    // Botões "data-close-dlg" genéricos
    document.querySelectorAll('button[data-close-dlg]').forEach(b => {
      if (b.__wired) return;
      b.__wired = true;
      b.addEventListener('click', () => {
        const dlg = document.getElementById(b.getAttribute('data-close-dlg'));
        if (dlg && dlg.close) dlg.close();
      });
    });

    document.addEventListener('empresa:change', render);
  }

  // ============================================
  // INIT
  // ============================================
  async function init() {
    if (__initialized) {
      await render();
      return;
    }
    __initialized = true;
    console.log('[Peças] 🔄 Inicializando...');
    bindEvents();
    await render();
    console.log('[Peças] ✅ Página pronta');
  }

  // ============================================
  // ASSISTÊNCIA TÉCNICA — helpers usados por maquinas.js
  // (Diálogo está em index.html; o controlador é exposto aqui para reuso)
  // ============================================
  async function abrirAssistencia(maquina) {
    const dlg = document.getElementById('dlgMaqAssistencia');
    if (!dlg) return;

    document.getElementById('dlgAssistInfo').innerHTML = `
      <div style="font-size:14px;"><strong>${esc(maquina.serial || '')}</strong>${maquina.modelo ? ' — ' + esc(maquina.modelo) : ''}</div>
      <div style="font-size:12px; color:#6b7280; margin-top:4px;">
        ID: <code>${esc(maquina.id)}</code>${maquina.gerente_atual_nome ? ' • Com: ' + esc(maquina.gerente_atual_nome) : ''}
      </div>
    `;

    // Form atribuir peça
    const form = document.getElementById('formAddPecaMaquina');
    form.reset();
    form.maquina_id.value = maquina.id;
    form.data_instalacao.value = hoje();

    // Popular select de peças (apenas ativas com estoque > 0)
    const sel = form.peca_id;
    try {
      const todas = await window.SupabaseAPI.pecas.getAll({ ativasApenas: true });
      const compat = (todas || []).filter(p => {
        const lista = p.modelos_compativeis || [];
        if (!lista.length) return true; // se não declarou, aparece pra todas
        if (!maquina.modelo) return true;
        return lista.some(m => String(m).toLowerCase().trim() === String(maquina.modelo).toLowerCase().trim());
      });
      sel.innerHTML = '<option value="">Selecione...</option>' +
        compat.map(p => {
          const dispo = Number(p.estoque_atual) || 0;
          const flag = dispo > 0 ? '' : ' (sem estoque)';
          const disabled = dispo > 0 ? '' : ' disabled';
          return `<option value="${esc(p.id)}"${disabled}>${esc(p.codigo)} — ${esc(p.nome)} • ${dispo} un.${flag}</option>`;
        }).join('');
    } catch (e) {
      console.warn('[Peças/Assist] Erro listar:', e);
      sel.innerHTML = '<option value="">Erro ao carregar peças</option>';
    }

    // Render listas
    await renderAssistenciaListas(maquina.id);

    if (!form.__wired) {
      form.__wired = true;
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const maqId = String(fd.get('maquina_id') || '');
        const pecaId = String(fd.get('peca_id') || '');
        const qtd = Math.max(1, Number(fd.get('quantidade')) || 1);
        const obs = String(fd.get('observacao') || '').trim() || null;
        const data = String(fd.get('data_instalacao') || hoje());

        if (!maqId || !pecaId) { notify('Selecione uma peça.', 'error'); return; }

        try {
          await window.SupabaseAPI.maquinasPecas.instalarPecaNaMaquina({
            maquinaId: maqId,
            pecaId,
            quantidade: qtd,
            observacao: obs,
            dataInstalacao: data
          });

          // Registra também na linha do tempo da máquina
          try {
            await window.SupabaseAPI.maquinasMovimentacoes.create({
              maquina_id: maqId,
              tipo: 'edicao',
              data_evento: data,
              observacao: `[Assistência] Peça instalada: ${obs || '-'}`
            });
          } catch (_) {}

          notify('Peça instalada! Estoque debitado.', 'success');
          form.reset();
          form.data_instalacao.value = hoje();
          form.quantidade.value = 1;
          await renderAssistenciaListas(maqId);
        } catch (err) {
          notify(err.message || 'Erro ao instalar peça', 'error');
        }
      });
    }

    dlg.showModal();
  }

  async function renderAssistenciaListas(maquinaId) {
    const elAtuais = document.getElementById('dlgAssistAtuais');
    const elHist = document.getElementById('dlgAssistHistorico');
    if (!elAtuais || !elHist) return;

    elAtuais.innerHTML = '<div style="color:#6b7280;">Carregando...</div>';
    elHist.innerHTML = '<div style="color:#6b7280;">Carregando...</div>';

    try {
      const todas = await window.SupabaseAPI.maquinasPecas.getHistoricoByMaquina(maquinaId);
      const atuais = todas.filter(p => !p.removida);
      const removidas = todas.filter(p => p.removida);

      // Atuais
      if (!atuais.length) {
        elAtuais.innerHTML = '<div style="color:#6b7280;">Nenhuma peça instalada nesta máquina.</div>';
      } else {
        elAtuais.innerHTML = atuais.map(v => `
          <div style="display:flex; justify-content:space-between; align-items:center; border:1px solid #e5e7eb; padding:8px 10px; margin-bottom:6px; border-radius:8px; background:#f0fdf4;">
            <div>
              <strong>${esc(v.peca_codigo || '')}</strong> — ${esc(v.peca_nome || '')}
              <span style="margin-left:6px; background:#d1fae5; color:#065f46; padding:2px 8px; border-radius:6px; font-size:11px;">qty ${v.quantidade||1}</span>
              <div style="font-size:12px; color:#6b7280; margin-top:2px;">
                Instalada em ${fmtData(v.data_instalacao)}${v.usuario_nome ? ' por ' + esc(v.usuario_nome) : ''}
                ${v.instalacao_observacao ? ' • ' + esc(v.instalacao_observacao) : ''}
              </div>
            </div>
            <button class="btn ghost danger" data-remover-vinculo="${esc(v.id)}" title="Remover (devolve ao estoque)">🔁 Remover</button>
          </div>
        `).join('');
      }

      // Histórico completo
      if (!todas.length) {
        elHist.innerHTML = '<div style="color:#6b7280;">Sem histórico de peças.</div>';
      } else {
        elHist.innerHTML = todas.map(v => `
          <div style="border-left:3px solid ${v.removida ? '#9ca3af' : '#10b981'}; padding:6px 10px; margin-bottom:6px; background:#fafafa; border-radius:0 8px 8px 0;">
            <div style="display:flex; justify-content:space-between;">
              <strong>${v.removida ? '🔁' : '✅'} ${esc(v.peca_codigo || '')} — ${esc(v.peca_nome || '')}</strong>
              <small style="color:#6b7280;">${fmtData(v.data_instalacao)}${v.data_remocao ? ' → ' + fmtData(v.data_remocao) : ''}</small>
            </div>
            <div style="font-size:12px; color:#374151; margin-top:2px;">
              qty ${v.quantidade||1}${v.preco_unitario_momento ? ' • ' + fmtBRL(v.preco_unitario_momento) + ' un.' : ''}
              ${v.usuario_nome ? ' • por ' + esc(v.usuario_nome) : ''}
            </div>
            ${v.instalacao_observacao ? `<div style="font-size:12px; color:#374151;">Obs.: ${esc(v.instalacao_observacao)}</div>` : ''}
            ${v.removida ? `
              <div style="font-size:12px; color:#92400e; margin-top:2px;">
                Removida em ${fmtData(v.data_remocao)}${v.remocao_motivo ? ' — ' + esc(v.remocao_motivo) : ''}
              </div>` : ''}
          </div>
        `).join('');
      }

      // bind remover (delegação dentro do dlg)
      const wrap = elAtuais;
      wrap.querySelectorAll('button[data-remover-vinculo]').forEach(b => {
        b.addEventListener('click', async () => {
          const vinculoId = b.getAttribute('data-remover-vinculo');
          const motivo = prompt('Motivo da remoção (assistência técnica):');
          if (!motivo || !motivo.trim()) { notify('Operação cancelada.', 'warning'); return; }
          try {
            await window.SupabaseAPI.maquinasPecas.removerPecaDaMaquina(vinculoId, {
              motivo: motivo.trim(),
              observacao: 'Remoção via assistência técnica',
              devolverAoEstoque: confirm('Devolver esta peça ao estoque? (OK = sim, Cancelar = descartar)')
            });
            // log da máquina
            try {
              await window.SupabaseAPI.maquinasMovimentacoes.create({
                maquina_id: maquinaId,
                tipo: 'edicao',
                data_evento: hoje(),
                motivo: motivo.trim(),
                observacao: '[Assistência] Peça removida'
              });
            } catch (_) {}
            notify('Peça removida da máquina.', 'success');
            await renderAssistenciaListas(maquinaId);
          } catch (e) {
            notify(e.message || 'Erro ao remover peça', 'error');
          }
        });
      });
    } catch (e) {
      console.error('[Peças/Assist] Erro:', e);
      elAtuais.innerHTML = '<div style="color:#dc2626;">Erro ao carregar.</div>';
      elHist.innerHTML = '';
    }
  }

  // ============================================
  // EXPOR PARA NAV E MAQUINAS
  // ============================================
  window.PecasEstoque = { init, render };
  window.renderPecasEstoque = render;
  window.abrirAssistenciaTecnica = abrirAssistencia;   // chamado por maquinas.js

  console.log('[Peças] ✅ Módulo carregado');
})();
