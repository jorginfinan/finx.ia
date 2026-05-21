(function () {
  'use strict';
 
  // ============================================
  // PROTEÇÃO CONTRA MÚLTIPLO CARREGAMENTO
  // ============================================
  if (window.__MAQUINAS_CAD_LOADED__) {
    console.warn('[Maquinas] Já carregado, ignorando...');
    return;
  }
  window.__MAQUINAS_CAD_LOADED__ = true;
 
  let __initialized = false;
  let __saving = false;
  let __lastRender = 0;
  let __cacheMaquinas = [];
 
  // ============================================
  // HELPERS
  // ============================================
  function esc(s) {
    const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;'};
    return String(s ?? '').replace(/[&<>"'`=\/]/g, m => map[m] || m);
  }
 
  function uidLocal() {
    return 'mq_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  }
 
  function hoje() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }
 
  function fmtData(s) {
    if (!s) return '';
    const parts = String(s).split('-');
    if (parts.length !== 3) return s;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
 
  function statusLabel(s) {
    const labels = {
      'estoque': '<span style="background:#d1fae5; color:#065f46; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:600;">NO ESTOQUE</span>',
      'com_vendedor': '<span style="background:#dbeafe; color:#1e40af; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:600;">COM VENDEDOR</span>',
      'manutencao': '<span style="background:#fef3c7; color:#92400e; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:600;">MANUTENÇÃO</span>',
      'baixada': '<span style="background:#fee2e2; color:#991b1b; padding:3px 8px; border-radius:6px; font-size:11px; font-weight:600;">BAIXADA</span>'
    };
    return labels[s] || s;
  }
 
  function notify(msg, type) {
    if (window.showNotification) {
      window.showNotification(msg, type || 'info');
    } else {
      alert(msg);
    }
  }
 
  // Verifica se usuário pode executar uma ação
  function podeFazer(perm) {
    try {
      return window.UserAuth?.can?.(perm) === true;
    } catch (e) {
      return false;
    }
  }
 
  // ============================================
  // POPULAR SELECTS DE GERENTE E FICHAS
  // ============================================
  function popularGerentesSelect(sel) {
    if (!sel) return;
    const gerentes = (window.gerentes || []).filter(g => g.ativo !== false);
    const atual = sel.value;
    sel.innerHTML = '<option value="">Selecione...</option>' +
      gerentes
        .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')))
        .map(g => `<option value="${esc(g.id || g.uid)}">${esc(g.nome)}</option>`)
        .join('');
    if (atual) sel.value = atual;
  }
 
  function popularFichasDatalist(dl) {
    if (!dl) return;
    const fichas = window.fichas || [];
    dl.innerHTML = fichas
      .sort((a, b) => String(a.ficha).localeCompare(String(b.ficha)))
      .map(f => `<option value="${esc(f.ficha)}">${esc(f.ficha)} — ${esc(f.area || '')}</option>`)
      .join('');
  }
 
  // ============================================
  // CARREGAR MÁQUINAS DO SUPABASE
  // ============================================
  async function loadMaquinas() {
    try {
      if (!window.SupabaseAPI?.maquinas) {
        console.warn('[Maquinas] SupabaseAPI.maquinas não disponível');
        return [];
      }
      const arr = await window.SupabaseAPI.maquinas.getAll();
      __cacheMaquinas = Array.isArray(arr) ? arr : [];
      return __cacheMaquinas;
    } catch (e) {
      console.error('[Maquinas] Erro ao carregar:', e);
      return [];
    }
  }
 
  // ============================================
  // RENDER DA TABELA PRINCIPAL
  // ============================================
  async function render() {
    const now = Date.now();
    if (now - __lastRender < 300) return;
    __lastRender = now;
 
    const tbody = document.getElementById('tbodyMaquinas');
    if (!tbody) return;
 
    const arr = await loadMaquinas();
    const busca = (document.getElementById('maqBusca')?.value || '').toLowerCase().trim();
    const filtroStatus = document.getElementById('maqFiltroStatus')?.value || '';
 
    let filtradas = arr;
 
    if (filtroStatus) {
      filtradas = filtradas.filter(m => m.status === filtroStatus);
    }
 
    if (busca) {
      filtradas = filtradas.filter(m => {
        const blob = [m.serial, m.modelo, m.id_maquina, m.gerente_atual_nome, m.ficha_atual, m.chip_atual]
          .map(x => String(x || '').toLowerCase())
          .join(' ');
        return blob.includes(busca);
      });
    }
 
    if (!filtradas.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#6b7280; padding:30px;">Nenhuma máquina encontrada.</td></tr>';
      return;
    }
 
    tbody.innerHTML = filtradas.map(m => {
      const podeEntregar = m.status === 'estoque' && podeFazer('maquinas_entregar');
      const podeDevolver = m.status === 'com_vendedor' && podeFazer('maquinas_devolver');
      const podeEditar = podeFazer('maquinas_cadastrar');
      const podeBaixar = podeFazer('maquinas_excluir');
 
      const gerenteFicha = m.gerente_atual_nome
        ? `${esc(m.gerente_atual_nome)}${m.ficha_atual ? ' / ' + esc(m.ficha_atual) : ''}`
        : '—';
 
      return `
        <tr data-id="${esc(m.id)}">
          <td><strong>${esc(m.serial || '')}</strong>${m.id_maquina ? '<br><small style="color:#6b7280;">' + esc(m.id_maquina) + '</small>' : ''}</td>
          <td>${esc(m.modelo || '—')}</td>
          <td>${statusLabel(m.status)}</td>
          <td>${gerenteFicha}</td>
          <td>${esc(m.chip_atual || '—')}</td>
          <td>${fmtData(m.data_entrada)}</td>
          <td class="tv-right" style="white-space:nowrap;">
            <button class="btn ghost" data-act="historico" title="Ver histórico">📜</button>
            <button class="btn ghost" data-act="assistencia" title="Peças / Assistência Técnica">🔧</button>
            ${podeEntregar ? '<button class="btn" data-act="entregar" title="Entregar">📤</button>' : ''}
            ${podeDevolver ? '<button class="btn" data-act="devolver" title="Devolver">📥</button>' : ''}
            ${podeEditar ? '<button class="btn ghost" data-act="editar" title="Editar">✏️</button>' : ''}
            ${podeBaixar ? '<button class="btn danger" data-act="baixar" title="Dar baixa">🗑️</button>' : ''}
          </td>
        </tr>
      `;
    }).join('');
  }
 
  // ============================================
  // FORMULÁRIO DE CADASTRO / EDIÇÃO
  // ============================================
  function resetForm() {
    const form = document.getElementById('formMaquina');
    if (!form) return;
    form.reset();
    form.removeAttribute('data-editing-id');
    delete form.dataset.editingId;
    const dt = form.querySelector('[name="data_entrada"]');
    if (dt) dt.value = hoje();
    document.getElementById('maqFormTitulo').textContent = 'Nova Máquina';
    document.getElementById('btnSalvarMaquina').textContent = 'Salvar Máquina';
    toggleBlocoEntrega('estoque');
  }
 
  function toggleBlocoEntrega(destino) {
    const bloco = document.getElementById('maqBlocoEntrega');
    if (!bloco) return;
    bloco.style.display = (destino === 'entrega') ? '' : 'none';
    // tornar gerente obrigatório só quando for entrega
    const selG = document.getElementById('selMaqGerente');
    if (selG) selG.required = (destino === 'entrega');
  }
 
  // Verifica se o gerente já tem máquinas ativas (precisa de observação obrigatória)
  async function gerenteJaTemMaquina(gerenteId) {
    if (!gerenteId) return false;
    try {
      const lista = await window.SupabaseAPI.maquinas.getByGerente(gerenteId);
      return Array.isArray(lista) && lista.length > 0;
    } catch (e) {
      return false;
    }
  }
 
  async function onSubmitForm(e) {
    e.preventDefault();
    if (__saving) return;
    __saving = true;
 
    const form = e.currentTarget;
    const btn = document.getElementById('btnSalvarMaquina');
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }
 
    try {
      const fd = new FormData(form);
      const editingId = form.dataset.editingId || '';
 
      const serial = String(fd.get('serial') || '').trim();
      if (!serial) throw new Error('Informe o serial da máquina.');
 
      const dadosMaquina = {
        serial,
        id_maquina: String(fd.get('id_maquina') || '').trim() || null,
        modelo: String(fd.get('modelo') || '').trim() || null,
        data_entrada: String(fd.get('data_entrada') || hoje()),
        observacao_geral: String(fd.get('observacao_geral') || '').trim() || null
      };
 
      if (editingId) {
        // ===== EDIÇÃO (atualiza só dados básicos) =====
        if (!podeFazer('maquinas_cadastrar')) {
          throw new Error('Você não tem permissão para editar máquinas.');
        }
        await window.SupabaseAPI.maquinas.update(editingId, dadosMaquina);
 
        if (window.AuditLog) {
          window.AuditLog.log('maquina_editada', { id: editingId, serial, changes: Object.keys(dadosMaquina).join(',') });
        }
        notify('Máquina atualizada com sucesso!', 'success');
      } else {
        // ===== CRIAÇÃO =====
        if (!podeFazer('maquinas_cadastrar')) {
          throw new Error('Você não tem permissão para cadastrar máquinas.');
        }
 
        // Verifica duplicidade de serial na empresa
        const existente = await window.SupabaseAPI.maquinas.getBySerial(serial);
        if (existente) {
          throw new Error('Já existe uma máquina com este serial nesta empresa.');
        }
 
        const destino = String(fd.get('destino') || 'estoque');
        dadosMaquina.uid = uidLocal();
        dadosMaquina.status = 'estoque';
        dadosMaquina.ativo = true;
 
        let entregaData = null;
 
        if (destino === 'entrega') {
          if (!podeFazer('maquinas_entregar')) {
            throw new Error('Você não tem permissão para entregar máquinas.');
          }
 
          const gerenteId = String(fd.get('gerente_id') || '');
          if (!gerenteId) throw new Error('Selecione o gerente.');
 
          const ficha = String(fd.get('ficha') || '').trim() || null;
          const chip = String(fd.get('chip_numero') || '').trim() || null;
          const obs = String(fd.get('entrega_obs') || '').trim();
 
          // Verifica regra: gerente com mais de uma máquina exige observação
          const jaTem = await gerenteJaTemMaquina(gerenteId);
          if (jaTem && !obs) {
            throw new Error('Este gerente já tem outra máquina. Observação OBRIGATÓRIA explicando o motivo.');
          }
 
          const ger = (window.gerentes || []).find(g => String(g.id || g.uid) === gerenteId);
 
          dadosMaquina.status = 'com_vendedor';
          dadosMaquina.gerente_atual_id = ger?.id || null;
          dadosMaquina.gerente_atual_nome = ger?.nome || null;
          dadosMaquina.ficha_atual = ficha;
          dadosMaquina.chip_atual = chip;
 
          entregaData = { gerenteId: ger?.id || null, ger, ficha, chip, obs };
        }
 
        const created = await window.SupabaseAPI.maquinas.create(dadosMaquina);
 
        // Registra movimentação inicial
        const movEntrada = await window.SupabaseAPI.maquinasMovimentacoes.create({
          maquina_id: created.id,
          tipo: 'entrada_estoque',
          data_evento: dadosMaquina.data_entrada,
          observacao: 'Cadastro inicial da máquina'
        });
 
        if (window.AuditLog) {
          window.AuditLog.log('maquina_criada', {
            id: created.id,
            serial: created.serial,
            modelo: created.modelo
          });
        }
 
        // Se foi cadastro com entrega já no ato, registra movimentação de entrega
        if (entregaData) {
          const movEntrega = await window.SupabaseAPI.maquinasMovimentacoes.create({
            maquina_id: created.id,
            tipo: 'entrega',
            gerente_id: entregaData.ger?.id || null,
            gerente_nome: entregaData.ger?.nome || null,
            ficha: entregaData.ficha,
            data_evento: dadosMaquina.data_entrada,
            chip_numero: entregaData.chip,
            observacao: entregaData.obs || null,
            movimentacao_anterior_id: movEntrada?.id || null
          });
 
          // Registra evento de chip se houver
          if (entregaData.chip) {
            await window.SupabaseAPI.maquinasChips.create({
              numero_chip: entregaData.chip,
              maquina_id: created.id,
              gerente_id: entregaData.ger?.id || null,
              gerente_nome: entregaData.ger?.nome || null,
              ficha: entregaData.ficha,
              evento: 'entregue',
              data_evento: dadosMaquina.data_entrada,
              movimentacao_id: movEntrega?.id || null
            });
          }
 
          if (window.AuditLog) {
            window.AuditLog.log('maquina_entregue', {
              id: created.id,
              serial: created.serial,
              gerente: entregaData.ger?.nome,
              ficha: entregaData.ficha,
              chip: entregaData.chip
            });
          }
        }
 
        notify('Máquina cadastrada com sucesso!', 'success');
      }
 
      resetForm();
      await render();
 
    } catch (e) {
      console.error('[Maquinas] Erro ao salvar:', e);
      notify(e.message || 'Erro ao salvar', 'error');
    } finally {
      __saving = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = form?.dataset.editingId ? 'Salvar Alterações' : 'Salvar Máquina';
      }
    }
  }
 
  // ============================================
  // AÇÕES NA TABELA
  // ============================================
  async function onTableClick(e) {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const tr = btn.closest('tr[data-id]');
    if (!tr) return;
 
    const id = tr.dataset.id;
    const acao = btn.dataset.act;
    const m = __cacheMaquinas.find(x => x.id === id);
    if (!m) return;
 
    e.preventDefault();
    e.stopPropagation();
 
    if (acao === 'historico') {
      return abrirHistorico(m);
    }
    if (acao === 'assistencia') {
      if (typeof window.abrirAssistenciaTecnica !== 'function') {
        return notify('Módulo de peças ainda não carregado.', 'error');
      }
      return window.abrirAssistenciaTecnica(m);
    }
    if (acao === 'entregar') {
      if (!podeFazer('maquinas_entregar')) return notify('Sem permissão para entregar.', 'error');
      return abrirDialogEntregar(m);
    }
    if (acao === 'devolver') {
      if (!podeFazer('maquinas_devolver')) return notify('Sem permissão para devolver.', 'error');
      return abrirDialogDevolver(m);
    }
    if (acao === 'editar') {
      if (!podeFazer('maquinas_cadastrar')) return notify('Sem permissão para editar.', 'error');
      return preencherFormEdicao(m);
    }
    if (acao === 'baixar') {
      if (!podeFazer('maquinas_excluir')) return notify('Sem permissão para dar baixa.', 'error');
      return darBaixa(m);
    }
  }
 
  function preencherFormEdicao(m) {
    const form = document.getElementById('formMaquina');
    if (!form) return;
    form.dataset.editingId = m.id;
    form.querySelector('[name="serial"]').value = m.serial || '';
    form.querySelector('[name="id_maquina"]').value = m.id_maquina || '';
    form.querySelector('[name="modelo"]').value = m.modelo || '';
    form.querySelector('[name="data_entrada"]').value = m.data_entrada || hoje();
    form.querySelector('[name="observacao_geral"]').value = m.observacao_geral || '';
 
    // Não permite mudar destino durante edição
    form.querySelectorAll('[name="destino"]').forEach(r => r.disabled = true);
    toggleBlocoEntrega('estoque');
 
    document.getElementById('maqFormTitulo').textContent = 'Editar Máquina: ' + (m.serial || '');
    document.getElementById('btnSalvarMaquina').textContent = 'Salvar Alterações';
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
 
  // ============================================
  // DIALOG: ENTREGAR
  // ============================================
  function abrirDialogEntregar(m) {
    const dlg = document.getElementById('dlgMaqEntregar');
    if (!dlg) return;
    const form = document.getElementById('formEntregar');
    form.reset();
    form.querySelector('[name="maquina_id"]').value = m.id;
    form.querySelector('[name="data_evento"]').value = hoje();
 
    document.getElementById('dlgEntregarMaquinaInfo').textContent =
      `${m.serial}${m.modelo ? ' — ' + m.modelo : ''}`;
    document.getElementById('dlgEntregarTitulo').textContent = 'Entregar Máquina';
    document.getElementById('dlgEntregarAviso').style.display = 'none';
    document.getElementById('dlgEntregarObsObrigatoria').style.display = 'none';
 
    popularGerentesSelect(document.getElementById('dlgSelGerente'));
    popularFichasDatalist(document.getElementById('listFichasMaq2'));
 
    dlg.showModal();
  }
 
  async function onSubmitEntregar(e) {
    e.preventDefault();
    if (__saving) return;
    __saving = true;
 
    try {
      const form = e.currentTarget;
      const fd = new FormData(form);
      const maquinaId = fd.get('maquina_id');
      const gerenteId = fd.get('gerente_id');
      const ficha = String(fd.get('ficha') || '').trim() || null;
      const dataEvento = String(fd.get('data_evento') || hoje());
      const chip = String(fd.get('chip_numero') || '').trim() || null;
      const obs = String(fd.get('observacao') || '').trim();
 
      if (!gerenteId) throw new Error('Selecione o gerente.');
 
      const jaTem = await gerenteJaTemMaquina(gerenteId);
      if (jaTem && !obs) {
        throw new Error('Este gerente já tem máquina(s) ativa(s). Observação OBRIGATÓRIA.');
      }
 
      const ger = (window.gerentes || []).find(g => String(g.id || g.uid) === gerenteId);
 
      // Cria movimentação de entrega
      const mov = await window.SupabaseAPI.maquinasMovimentacoes.create({
        maquina_id: maquinaId,
        tipo: 'entrega',
        gerente_id: ger?.id || null,
        gerente_nome: ger?.nome || null,
        ficha,
        data_evento: dataEvento,
        chip_numero: chip,
        observacao: obs || null
      });
 
      // Atualiza estado atual da máquina
      await window.SupabaseAPI.maquinas.update(maquinaId, {
        status: 'com_vendedor',
        gerente_atual_id: ger?.id || null,
        gerente_atual_nome: ger?.nome || null,
        ficha_atual: ficha,
        chip_atual: chip
      });
 
      // Registra histórico do chip
      if (chip) {
        await window.SupabaseAPI.maquinasChips.create({
          numero_chip: chip,
          maquina_id: maquinaId,
          gerente_id: ger?.id || null,
          gerente_nome: ger?.nome || null,
          ficha,
          evento: 'entregue',
          data_evento: dataEvento,
          movimentacao_id: mov?.id || null
        });
      }
 
      if (window.AuditLog) {
        window.AuditLog.log('maquina_entregue', {
          id: maquinaId,
          gerente: ger?.nome,
          ficha,
          chip,
          obs
        });
      }
 
      document.getElementById('dlgMaqEntregar').close();
      notify('Máquina entregue com sucesso!', 'success');
      await render();
    } catch (e) {
      console.error('[Maquinas] Erro ao entregar:', e);
      notify(e.message || 'Erro ao entregar', 'error');
    } finally {
      __saving = false;
    }
  }
 
  // Verifica em tempo real se gerente selecionado já tem máquina
  async function onChangeGerenteDlg(e) {
    const gerenteId = e.target.value;
    const aviso = document.getElementById('dlgEntregarAviso');
    const obsLabel = document.getElementById('dlgEntregarObsObrigatoria');
    if (!gerenteId) {
      aviso.style.display = 'none';
      obsLabel.style.display = 'none';
      return;
    }
    const jaTem = await gerenteJaTemMaquina(gerenteId);
    aviso.style.display = jaTem ? '' : 'none';
    obsLabel.style.display = jaTem ? '' : 'none';
  }
 
  // ============================================
  // DIALOG: DEVOLVER (com opção de troca)
  // ============================================
  async function abrirDialogDevolver(m) {
    const dlg = document.getElementById('dlgMaqDevolver');
    if (!dlg) return;
    const form = document.getElementById('formDevolver');
    form.reset();
    form.querySelector('[name="maquina_id"]').value = m.id;
    form.querySelector('[name="data_evento"]').value = hoje();
 
    document.getElementById('dlgDevolverMaquinaInfo').textContent =
      `${m.serial}${m.modelo ? ' — ' + m.modelo : ''} (com ${m.gerente_atual_nome || '—'}${m.ficha_atual ? ' / ' + m.ficha_atual : ''})`;
 
    // Reseta bloco de troca
    document.getElementById('chkFazerTroca').checked = false;
    document.getElementById('blocoTroca').style.display = 'none';
    document.getElementById('selTrocaMaquina').innerHTML = '<option value="">Selecione...</option>';
    document.getElementById('inpTrocaChip').value = '';
 
    // Carrega máquinas em estoque para opção de troca
    try {
      const estoque = await window.SupabaseAPI.maquinas.getEstoque();
      const sel = document.getElementById('selTrocaMaquina');
      sel.innerHTML = '<option value="">Selecione...</option>' +
        estoque.map(mq => `<option value="${esc(mq.id)}">${esc(mq.serial)}${mq.modelo ? ' — ' + esc(mq.modelo) : ''}</option>`).join('');
    } catch (e) {
      console.warn('Erro ao listar estoque:', e);
    }
 
    dlg.showModal();
  }
 
  async function onSubmitDevolver(e) {
    e.preventDefault();
    if (__saving) return;
    __saving = true;
 
    try {
      const form = e.currentTarget;
      const fd = new FormData(form);
      const maquinaId = fd.get('maquina_id');
      const dataEvento = String(fd.get('data_evento') || hoje());
      const motivo = String(fd.get('motivo') || '');
      const chipDevolvido = !!fd.get('chip_devolvido');
      const obs = String(fd.get('observacao') || '').trim() || null;
 
      if (!motivo) throw new Error('Informe o motivo da devolução.');
 
      const m = __cacheMaquinas.find(x => x.id === maquinaId);
      if (!m) throw new Error('Máquina não encontrada.');
 
      // ===== 1. Registra devolução =====
      const movDev = await window.SupabaseAPI.maquinasMovimentacoes.create({
        maquina_id: maquinaId,
        tipo: 'devolucao',
        gerente_id: m.gerente_atual_id,
        gerente_nome: m.gerente_atual_nome,
        ficha: m.ficha_atual,
        data_evento: dataEvento,
        chip_numero: m.chip_atual,
        chip_devolvido: chipDevolvido,
        motivo,
        observacao: obs
      });
 
      // Registra histórico do chip se devolvido
      if (m.chip_atual && chipDevolvido) {
        await window.SupabaseAPI.maquinasChips.create({
          numero_chip: m.chip_atual,
          maquina_id: maquinaId,
          gerente_id: m.gerente_atual_id,
          gerente_nome: m.gerente_atual_nome,
          ficha: m.ficha_atual,
          evento: 'devolvido',
          data_evento: dataEvento,
          movimentacao_id: movDev?.id || null
        });
      }
 
      // Atualiza estado da máquina devolvida (volta pro estoque)
      await window.SupabaseAPI.maquinas.update(maquinaId, {
        status: 'estoque',
        gerente_atual_id: null,
        gerente_atual_nome: null,
        ficha_atual: null,
        chip_atual: chipDevolvido ? null : m.chip_atual  // mantém chip se não foi devolvido
      });
 
      if (window.AuditLog) {
        window.AuditLog.log('maquina_devolvida', {
          id: maquinaId,
          serial: m.serial,
          motivo,
          chip_devolvido: chipDevolvido,
          gerente: m.gerente_atual_nome
        });
      }
 
      // ===== 2. Se for troca, entrega outra máquina =====
      const fazerTroca = document.getElementById('chkFazerTroca').checked;
      if (fazerTroca) {
        const novaMaquinaId = document.getElementById('selTrocaMaquina').value;
        const novoChip = document.getElementById('inpTrocaChip').value.trim() || null;
        if (!novaMaquinaId) throw new Error('Selecione a nova máquina para a troca.');
 
        const novaMaq = await window.SupabaseAPI.maquinas.getById(novaMaquinaId);
        if (!novaMaq) throw new Error('Nova máquina não encontrada.');
 
        const movEntrega = await window.SupabaseAPI.maquinasMovimentacoes.create({
          maquina_id: novaMaquinaId,
          tipo: 'troca',
          gerente_id: m.gerente_atual_id,
          gerente_nome: m.gerente_atual_nome,
          ficha: m.ficha_atual,
          data_evento: dataEvento,
          chip_numero: novoChip,
          observacao: `Troca: substituiu a máquina ${m.serial}. Motivo: ${motivo}`,
          movimentacao_anterior_id: movDev?.id || null
        });
 
        await window.SupabaseAPI.maquinas.update(novaMaquinaId, {
          status: 'com_vendedor',
          gerente_atual_id: m.gerente_atual_id,
          gerente_atual_nome: m.gerente_atual_nome,
          ficha_atual: m.ficha_atual,
          chip_atual: novoChip
        });
 
        if (novoChip) {
          await window.SupabaseAPI.maquinasChips.create({
            numero_chip: novoChip,
            maquina_id: novaMaquinaId,
            gerente_id: m.gerente_atual_id,
            gerente_nome: m.gerente_atual_nome,
            ficha: m.ficha_atual,
            evento: 'entregue',
            data_evento: dataEvento,
            movimentacao_id: movEntrega?.id || null
          });
        }
 
        if (window.AuditLog) {
          window.AuditLog.log('maquina_trocada', {
            serial_anterior: m.serial,
            serial_novo: novaMaq.serial,
            gerente: m.gerente_atual_nome
          });
        }
      }
 
      document.getElementById('dlgMaqDevolver').close();
      notify(fazerTroca ? 'Devolução + troca registrada!' : 'Devolução registrada!', 'success');
      await render();
    } catch (e) {
      console.error('[Maquinas] Erro ao devolver:', e);
      notify(e.message || 'Erro ao devolver', 'error');
    } finally {
      __saving = false;
    }
  }
 
  // ============================================
  // DAR BAIXA
  // ============================================
  async function darBaixa(m) {
    const motivo = prompt('Motivo da baixa (obrigatório):');
    if (!motivo || !motivo.trim()) {
      notify('Operação cancelada — motivo obrigatório.', 'warning');
      return;
    }
    if (!confirm(`Confirmar BAIXA da máquina ${m.serial}?\nMotivo: ${motivo}\n\nA máquina ficará inativa e não poderá mais ser usada.`)) return;
 
    try {
      // Registra movimentação de baixa
      await window.SupabaseAPI.maquinasMovimentacoes.create({
        maquina_id: m.id,
        tipo: 'baixa',
        gerente_id: m.gerente_atual_id,
        gerente_nome: m.gerente_atual_nome,
        ficha: m.ficha_atual,
        data_evento: hoje(),
        motivo: motivo.trim(),
        observacao: 'Baixa definitiva da máquina'
      });
 
      // Marca como baixada
      await window.SupabaseAPI.maquinas.update(m.id, {
        status: 'baixada',
        ativo: false,
        gerente_atual_id: null,
        gerente_atual_nome: null,
        ficha_atual: null,
        chip_atual: null
      });
 
      if (window.AuditLog) {
        window.AuditLog.log('maquina_baixada', { id: m.id, serial: m.serial, motivo: motivo.trim() });
      }
 
      notify('Máquina baixada.', 'success');
      await render();
    } catch (e) {
      console.error('[Maquinas] Erro ao dar baixa:', e);
      notify(e.message || 'Erro ao dar baixa', 'error');
    }
  }
 
  // ============================================
  // HISTÓRICO DA MÁQUINA
  // ============================================
  async function abrirHistorico(m) {
    const dlg = document.getElementById('dlgMaqHistorico');
    const lista = document.getElementById('dlgHistoricoLista');
    const info = document.getElementById('dlgHistoricoInfo');
    if (!dlg) return;
 
    info.innerHTML = `
      <div style="font-size:14px;"><strong>${esc(m.serial)}</strong>${m.modelo ? ' — ' + esc(m.modelo) : ''}</div>
      <div style="font-size:12px; color:#6b7280; margin-top:4px;">
        Entrada: ${fmtData(m.data_entrada)} • Status atual: ${statusLabel(m.status)}
      </div>
    `;
    lista.innerHTML = '<div style="text-align:center; color:#6b7280; padding:20px;">Carregando histórico...</div>';
    dlg.showModal();
 
    try {
      const movs = await window.SupabaseAPI.maquinasMovimentacoes.getByMaquina(m.id);
      if (!movs.length) {
        lista.innerHTML = '<div style="text-align:center; color:#6b7280;">Nenhuma movimentação registrada.</div>';
        return;
      }
 
      // ====== Peças instaladas / histórico de peças ======
      let blocoPecas = '';
      try {
        if (window.SupabaseAPI?.maquinasPecas) {
          const pecasMaq = await window.SupabaseAPI.maquinasPecas.getHistoricoByMaquina(m.id);
          if (pecasMaq && pecasMaq.length) {
            const atuais = pecasMaq.filter(p => !p.removida);
            const passadas = pecasMaq.filter(p => p.removida);
            const fmtItem = (v, atual) => `
              <div style="border-left:3px solid ${atual ? '#10b981' : '#9ca3af'}; padding:6px 10px; margin-bottom:6px; background:#fafafa; border-radius:0 8px 8px 0;">
                <div style="display:flex; justify-content:space-between;">
                  <strong>${atual ? '✅' : '🔁'} ${esc(v.peca_codigo || '')} — ${esc(v.peca_nome || '')}</strong>
                  <small style="color:#6b7280;">${fmtData(v.data_instalacao)}${v.data_remocao ? ' → ' + fmtData(v.data_remocao) : ''}</small>
                </div>
                <div style="font-size:12px; color:#6b7280;">qty ${v.quantidade||1}${v.usuario_nome ? ' • por ' + esc(v.usuario_nome) : ''}</div>
                ${v.remocao_motivo ? `<div style="font-size:12px; color:#92400e;">Motivo: ${esc(v.remocao_motivo)}</div>` : ''}
              </div>
            `;
            blocoPecas = `
              <div style="margin:14px 0; padding:12px; background:#f8fafc; border-radius:10px; border:1px solid #e5e7eb;">
                <strong>🔧 Peças desta máquina</strong>
                <div style="margin-top:8px;">
                  <small style="color:#065f46; font-weight:600;">Instaladas agora (${atuais.length})</small>
                  ${atuais.length ? atuais.map(v => fmtItem(v, true)).join('') : '<div style="color:#6b7280; font-size:12px; margin-top:4px;">Nenhuma peça instalada no momento.</div>'}
                </div>
                ${passadas.length ? `
                  <div style="margin-top:10px;">
                    <small style="color:#6b7280; font-weight:600;">Já passaram por aqui (${passadas.length})</small>
                    ${passadas.map(v => fmtItem(v, false)).join('')}
                  </div>` : ''}
              </div>
            `;
          }
        }
      } catch (e) { console.warn('[Maquinas/Hist] peças:', e); }

      const blocoMovs = movs.map(mv => {
        const tipos = {
          'entrada_estoque': { ico: '📥', cor: '#10b981', label: 'Entrada no estoque' },
          'entrega':         { ico: '📤', cor: '#3b82f6', label: 'Entregue ao vendedor' },
          'devolucao':       { ico: '🔄', cor: '#f59e0b', label: 'Devolução' },
          'troca':           { ico: '🔁', cor: '#8b5cf6', label: 'Troca de máquina' },
          'baixa':           { ico: '🗑️', cor: '#dc2626', label: 'Baixa definitiva' },
          'edicao':          { ico: '✏️', cor: '#6b7280', label: 'Edição / Assistência' }
        };
        const t = tipos[mv.tipo] || { ico: '•', cor: '#6b7280', label: mv.tipo };
        const detalhes = [];
        if (mv.gerente_nome) detalhes.push(`Gerente: <strong>${esc(mv.gerente_nome)}</strong>`);
        if (mv.ficha) detalhes.push(`Ficha: <strong>${esc(mv.ficha)}</strong>`);
        if (mv.chip_numero) detalhes.push(`Chip: <strong>${esc(mv.chip_numero)}</strong>${mv.chip_devolvido ? ' (devolvido)' : ''}`);
        if (mv.motivo) detalhes.push(`Motivo: ${esc(mv.motivo)}`);
        if (mv.observacao) detalhes.push(`Obs: ${esc(mv.observacao)}`);
 
        return `
          <div style="border-left:3px solid ${t.cor}; padding:10px 12px; margin-bottom:10px; background:#fafafa; border-radius:0 8px 8px 0;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <strong>${t.ico} ${t.label}</strong>
              <small style="color:#6b7280;">${fmtData(mv.data_evento)} • por ${esc(mv.usuario_nome || 'Sistema')}</small>
            </div>
            ${detalhes.length ? '<div style="font-size:13px; color:#374151;">' + detalhes.join(' • ') + '</div>' : ''}
          </div>
        `;
      }).join('');

      lista.innerHTML = blocoPecas + '<h4 style="margin:14px 0 6px;">Linha do tempo</h4>' + blocoMovs;
    } catch (e) {
      lista.innerHTML = '<div style="color:#dc2626;">Erro ao carregar histórico.</div>';
    }
  }
 
  // ============================================
  // INIT
  // ============================================
  function bindEvents() {
    const form = document.getElementById('formMaquina');
    if (form && !form.__wired) {
      form.__wired = true;
      form.addEventListener('submit', onSubmitForm);
 
      // Radio destino
      form.querySelectorAll('[name="destino"]').forEach(r => {
        r.addEventListener('change', e => toggleBlocoEntrega(e.target.value));
      });
    }
 
    const btnLimpar = document.getElementById('btnLimparMaquina');
    if (btnLimpar && !btnLimpar.__wired) {
      btnLimpar.__wired = true;
      btnLimpar.addEventListener('click', resetForm);
    }
 
    const tbody = document.getElementById('tbodyMaquinas');
    if (tbody && !tbody.__wired) {
      tbody.__wired = true;
      tbody.addEventListener('click', onTableClick);
    }
 
    const busca = document.getElementById('maqBusca');
    if (busca && !busca.__wired) {
      busca.__wired = true;
      let t;
      busca.addEventListener('input', () => { clearTimeout(t); t = setTimeout(render, 250); });
    }
 
    const filtro = document.getElementById('maqFiltroStatus');
    if (filtro && !filtro.__wired) {
      filtro.__wired = true;
      filtro.addEventListener('change', render);
    }
 
    const formEntregar = document.getElementById('formEntregar');
    if (formEntregar && !formEntregar.__wired) {
      formEntregar.__wired = true;
      formEntregar.addEventListener('submit', onSubmitEntregar);
    }
 
    const selGerenteDlg = document.getElementById('dlgSelGerente');
    if (selGerenteDlg && !selGerenteDlg.__wired) {
      selGerenteDlg.__wired = true;
      selGerenteDlg.addEventListener('change', onChangeGerenteDlg);
    }
 
    const formDevolver = document.getElementById('formDevolver');
    if (formDevolver && !formDevolver.__wired) {
      formDevolver.__wired = true;
      formDevolver.addEventListener('submit', onSubmitDevolver);
    }
 
    const chkTroca = document.getElementById('chkFazerTroca');
    if (chkTroca && !chkTroca.__wired) {
      chkTroca.__wired = true;
      chkTroca.addEventListener('change', e => {
        document.getElementById('blocoTroca').style.display = e.target.checked ? '' : 'none';
      });
    }
 
    // Botões de fechar dialog
    document.querySelectorAll('[data-close-dlg]').forEach(b => {
      if (b.__wired) return;
      b.__wired = true;
      b.addEventListener('click', () => {
        const id = b.getAttribute('data-close-dlg');
        const dlg = document.getElementById(id);
        if (dlg) dlg.close();
      });
    });
 
    // Recarrega ao trocar empresa
    document.addEventListener('empresa:change', () => { __cacheMaquinas = []; render(); });
  }
 
  async function init() {
    if (__initialized) {
      render();
      return;
    }
    __initialized = true;
    console.log('[Maquinas] 🔄 Inicializando página de cadastro...');
 
    bindEvents();
    resetForm();
 
    // Popular selects iniciais
    popularGerentesSelect(document.getElementById('selMaqGerente'));
    popularFichasDatalist(document.getElementById('listFichasMaq'));
 
    await render();
    console.log('[Maquinas] ✅ Página de cadastro pronta');
  }
 
  // Expor para o nav.js
  window.MaquinasCadastro = {
    init,
    render,
    reset: resetForm
  };
  window.renderMaquinasCadastro = render;
 
  console.log('[Maquinas] ✅ Módulo carregado');
})();
