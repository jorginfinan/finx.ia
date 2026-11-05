// ============================================
// PRESTAÇÃO DE VIDEO GAME (modalidade VG)
// Leituras e dinheiro em CENTAVOS: 150700 = R$ 1.507,00
// ============================================
(function () {
  'use strict';
  if (window.__VG_LOADED__) return;
  window.__VG_LOADED__ = true;

  const MODALIDADE = 'VG';
  const FORMAS = ['PIX', 'DINHEIRO', 'CARTÃO', 'DEPÓSITO'];

  const st = {
    pronto: false, empresaNome: null, empresaId: null,
    pontos: [], pontoId: null, maquinas: [], prestacoes: [],
    form: null, salvando: false, erroSetup: ''
  };

  // ---------- helpers ----------
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = c => ((Number(c) || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const brlReais = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dataBR = s => (s ? String(s).slice(0, 10).split('-').reverse().join('/') : '');
  const client = () => window.SupabaseAPI?.client;
  const pode = perm => { try { return window.UserAuth?.can?.(perm) === true; } catch (_) { return false; } };
  const podeEditar = () => pode('vg_edit');
  const pontoAtual = () => st.pontos.find(p => p.id === st.pontoId) || null;
  const novoId = () => (typeof window.uid === 'function' ? window.uid() : 'vg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));

  function hoje() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function aviso(msg, tipo) {
    if (window.showNotification) window.showNotification(msg, tipo || 'info');
    else if (tipo === 'error') alert(msg);
  }
  function leituraInt(txt) {
    const limpo = String(txt ?? '').replace(/\D/g, '');
    if (!limpo) return null;
    const n = Number(limpo);
    return Number.isSafeInteger(n) ? n : null;
  }

  // ---------- cálculo (função pura) ----------
  // Negativo acumulado só reduz a BASE das comissões; o líquido é sempre saldo − comissões.
  function calcular({ leituras, negativoAnterior, comissoes, base }) {
    const linhas = (leituras || []).map(l => {
      const venda = l.di - (l.zerado ? 0 : l.di_anterior);
      const premios = l.ds - (l.zerado ? 0 : l.ds_anterior);
      return { ...l, venda, premios, saldo: venda - premios };
    });
    const saldo = linhas.reduce((a, l) => a + l.saldo, 0);
    const negAnt = Math.max(0, Number(negativoAnterior) || 0);
    const baseValor = saldo - negAnt;
    let resto = Math.max(baseValor, 0);
    const valores = (comissoes || []).map(c => {
      if (baseValor <= 0) return { ...c, valor: 0 };
      const sobre = base === 'cascata' ? resto : baseValor;
      const valor = Math.round(sobre * (Number(c.pct) || 0) / 100);
      resto -= valor;
      return { ...c, valor };
    });
    const totalComissoes = valores.reduce((a, c) => a + c.valor, 0);
    return {
      linhas, saldo, negativoAnterior: negAnt, baseComissao: Math.max(baseValor, 0), comissoes: valores,
      totalComissoes, negativoNovo: baseValor < 0 ? -baseValor : 0, liquido: saldo - totalComissoes
    };
  }
  // Recebido do gerente soma; pago ao gerente (DIVIDA_PAGA) subtrai
  function totalPago(pagamentos) {
    return (pagamentos || []).reduce((a, p) => {
      const c = Math.round((Number(p.valor) || 0) * 100);
      return a + (String(p.forma).toUpperCase() === 'DIVIDA_PAGA' ? -c : c);
    }, 0);
  }

  // ---------- dados ----------
  async function empresaId() {
    const nome = window.getCompany?.() || 'BSX';
    if (st.empresaId && st.empresaNome === nome) return st.empresaId;
    const { data, error } = await client().from('empresas').select('id').eq('nome', nome).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Empresa não encontrada: ' + nome);
    st.empresaNome = nome;
    st.empresaId = data.id;
    return data.id;
  }
  async function carregarPontos() {
    const id = await empresaId();
    const { data, error } = await client().from('vg_pontos').select('*').eq('empresa_id', id).eq('ativo', true).order('nome');
    if (error) throw error;
    st.pontos = data || [];
    if (!st.pontos.some(p => p.id === st.pontoId)) st.pontoId = st.pontos[0]?.id || null;
  }
  async function carregarDoPonto() {
    st.maquinas = [];
    st.prestacoes = [];
    if (!st.pontoId) return;
    const [m, pr] = await Promise.all([
      client().from('vg_maquinas').select('*').eq('ponto_id', st.pontoId).order('created_at'),
      client().from('vg_prestacoes').select('*').eq('ponto_id', st.pontoId).order('data', { ascending: false })
    ]);
    if (m.error) throw m.error;
    if (pr.error) throw pr.error;
    st.maquinas = m.data || [];
    st.prestacoes = pr.data || [];
  }
  const anteriores = uidExcluida => st.prestacoes.filter(p => p.uid !== uidExcluida);

  function leituraAnterior(maq, uidExcluida) {
    for (const p of anteriores(uidExcluida)) {
      const l = (p.dados?.leituras || []).find(x => x.maquina_id === maq.id);
      if (l) return { di: l.di, ds: l.ds };
    }
    return { di: Number(maq.di_inicial) || 0, ds: Number(maq.ds_inicial) || 0 };
  }
  function negativoAnterior(uidExcluida) {
    const ant = anteriores(uidExcluida)[0];
    return ant ? Number(ant.negativo_novo) || 0 : Number(pontoAtual()?.negativo_inicial) || 0;
  }
  function comissoesDoPonto(p) {
    return [1, 2, 3].map(i => ({ nome: p[`comissao${i}_nome`] || `Comissão ${i}`, pct: Number(p[`comissao${i}_pct`]) || 0 }));
  }

  // ---------- formulário ----------
  function novoFormulario() {
    const ponto = pontoAtual();
    st.form = {
      modo: 'nova', uid: null, data: hoje(), pagamentos: [],
      comissoes: ponto ? comissoesDoPonto(ponto) : [],
      base: ponto?.base_comissao || 'saldo',
      negativoAnterior: negativoAnterior(null),
      linhas: st.maquinas.filter(m => m.ativo).map(m => {
        const a = leituraAnterior(m, null);
        return { maquina_id: m.id, nome: m.nome, di_anterior: a.di, ds_anterior: a.ds, diTxt: '', dsTxt: '', zerado: false };
      })
    };
  }
  function abrirPrestacao(uid) {
    const p = st.prestacoes.find(x => x.uid === uid);
    if (!p) return;
    const ultima = st.prestacoes[0]?.uid === uid;
    const modo = ultima && podeEditar() ? 'editar' : 'ver';
    const salvas = p.dados?.leituras || [];
    const linhas = salvas.map(l => {
      const maq = st.maquinas.find(m => m.id === l.maquina_id);
      const a = modo === 'editar' && maq ? leituraAnterior(maq, uid) : { di: l.di_anterior, ds: l.ds_anterior };
      return { maquina_id: l.maquina_id, nome: l.nome, di_anterior: a.di, ds_anterior: a.ds, diTxt: String(l.di), dsTxt: String(l.ds), zerado: !!l.zerado };
    });
    if (modo === 'editar') {
      st.maquinas.filter(m => m.ativo && !salvas.some(l => l.maquina_id === m.id)).forEach(m => {
        const a = leituraAnterior(m, uid);
        linhas.push({ maquina_id: m.id, nome: m.nome, di_anterior: a.di, ds_anterior: a.ds, diTxt: '', dsTxt: '', zerado: false });
      });
    }
    st.form = {
      modo, uid, data: String(p.data).slice(0, 10), linhas,
      pagamentos: JSON.parse(JSON.stringify(p.dados?.pagamentos || [])),
      comissoes: p.dados?.comissoes?.length ? p.dados.comissoes.map(c => ({ nome: c.nome, pct: c.pct })) : comissoesDoPonto(pontoAtual()),
      base: p.dados?.base || 'saldo',
      negativoAnterior: modo === 'editar' ? negativoAnterior(uid) : Number(p.negativo_anterior) || 0
    };
    render();
    document.getElementById('vgFormCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  // Separa as leituras válidas das que impedem salvar
  function avaliarLinhas() {
    const validas = [], erros = {};
    (st.form?.linhas || []).forEach(l => {
      const di = leituraInt(l.diTxt), ds = leituraInt(l.dsTxt);
      if (di === null || ds === null) { erros[l.maquina_id] = 'Informe as duas leituras atuais.'; return; }
      if (!l.zerado && (di < l.di_anterior || ds < l.ds_anterior)) {
        erros[l.maquina_id] = 'Leitura menor que a anterior. Se o video game foi zerado ou trocado, marque abaixo.';
        return;
      }
      validas.push({ maquina_id: l.maquina_id, nome: l.nome, di_anterior: l.di_anterior, ds_anterior: l.ds_anterior, di, ds, zerado: !!l.zerado });
    });
    return { validas, erros };
  }

  // ---------- tela ----------
  function garantirEstilos() {
    if (document.getElementById('vg-styles')) return;
    const css = document.createElement('style');
    css.id = 'vg-styles';
    css.textContent = `
      .vg-barra{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px}
      .vg-barra label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:600;color:#6b7280;min-width:240px}
      .vg-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:14px}
      .vg-topo{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-bottom:12px}
      .vg-titulo{font-size:16px;font-weight:700;color:#111827}
      .vg-sub{font-size:12px;color:#6b7280}
      .vg-maq{background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin-bottom:10px}
      .vg-maq-topo{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-weight:600;font-size:14px}
      .vg-grade{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr);gap:8px;align-items:center;font-size:13px}
      .vg-grade input{width:100%;min-width:0;padding:6px 8px;box-sizing:border-box}
      .vg-num{text-align:right;font-variant-numeric:tabular-nums}
      .vg-rot{font-size:11px;color:#6b7280;font-weight:600}
      .vg-rodape{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:8px;font-size:13px}
      .vg-erro{color:#b91c1c;font-size:12px;margin-top:6px}
      .vg-zerado{display:flex;gap:6px;align-items:center;font-size:12px;margin-top:4px;color:#92400e}
      .vg-coms{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:8px 0 12px}
      .vg-com{background:#f9fafb;border-radius:10px;padding:10px 12px}
      .vg-linha{display:flex;justify-content:space-between;gap:12px;padding:5px 0;font-size:14px}
      .vg-total{border-top:1px solid #e5e7eb;margin-top:4px;padding-top:9px;font-weight:700;font-size:15px}
      .vg-acoes{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px}
      .vg-tabela{overflow-x:auto}
      .vg-chip{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:600;background:#f3f4f6;color:#374151}
      .vg-chip.ok{background:#dcfce7;color:#166534}
      .vg-chip.esp{background:#fef3c7;color:#92400e}
      .vg-vazio{text-align:center;color:#6b7280;padding:28px 12px}
      .vg-setup{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:10px;padding:12px;font-size:14px;margin-bottom:14px}
      #vgRoot [hidden],dialog.vg-dlg [hidden]{display:none !important}
      .vg-so-celular{display:none}
      dialog.vg-dlg{border:none;border-radius:14px;padding:0;width:min(560px,94vw)}
      dialog.vg-dlg form{margin:0}
      @media (max-width:560px){
        .vg-grade{grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr) minmax(0,1fr)}
        .vg-grade .vg-so-largo{display:none}
        .vg-so-celular{display:block;margin-bottom:6px}
      }
    `;
    document.head.appendChild(css);
  }

  function render() {
    const root = document.getElementById('vgRoot');
    if (!root) return;
    const editar = podeEditar();
    const ponto = pontoAtual();
    const opcoes = st.pontos.map(p => `<option value="${esc(p.id)}"${p.id === st.pontoId ? ' selected' : ''}>${esc(p.nome)}</option>`).join('');
    root.innerHTML = `
      <h2>Video game</h2>
      ${st.erroSetup ? `<div class="vg-setup">${esc(st.erroSetup)}</div>` : ''}
      <div class="vg-barra">
        <label>PONTO<select id="vgPonto">${opcoes || '<option value="">Nenhum ponto cadastrado</option>'}</select></label>
        ${editar ? `<button type="button" class="btn" data-vg="ponto-novo">Novo ponto</button>` : ''}
        ${editar && ponto ? `<button type="button" class="btn ghost" data-vg="ponto-editar">Configurar ponto</button>` : ''}
      </div>
      ${ponto ? htmlFormulario(ponto) + htmlHistorico() : `<div class="vg-card vg-vazio">Cadastre o primeiro ponto para lançar as leituras dos video games.</div>`}
    `;
    if (ponto) { recalcular(); atualizarStatusPagamentos(); }
  }

  function htmlFormulario(ponto) {
    const f = st.form;
    const ver = f.modo === 'ver';
    const titulo = f.modo === 'nova' ? 'Nova leitura' : f.modo === 'editar' ? `Alterando a leitura de ${dataBR(f.data)}` : `Leitura de ${dataBR(f.data)} (somente consulta)`;
    return `
      <div class="vg-card" id="vgFormCard">
        <div class="vg-topo">
          <div>
            <div class="vg-titulo">${esc(ponto.nome)}</div>
            <div class="vg-sub">${esc(titulo)} · Gerente: ${esc(ponto.gerente_nome || '—')}</div>
          </div>
          <label class="vg-sub" style="display:flex;flex-direction:column;gap:4px;font-weight:600">DATA DA LEITURA
            <input type="date" id="vgData" value="${esc(f.data)}" ${ver ? 'disabled' : ''}></label>
        </div>
        ${f.linhas.length ? f.linhas.map(l => htmlMaquina(l, ver)).join('') : `<div class="vg-vazio">Adicione o primeiro video game deste ponto.</div>`}
        ${!ver && podeEditar() ? `<button type="button" class="btn ghost sm" data-vg="maquina-nova">+ Adicionar video game</button>` : ''}
        <div style="border-top:1px solid #e5e7eb;margin-top:14px;padding-top:12px">
          <div class="vg-topo" style="margin-bottom:0">
            <strong>Três comissões</strong>
            <span class="vg-sub">${f.base === 'cascata' ? 'Em cascata' : 'Todas sobre o saldo'}${f.modo === 'nova' ? '' : ' · percentuais gravados nesta leitura'}</span>
          </div>
          <div class="vg-coms" id="vgComs"></div>
          <div class="vg-linha"><span>Saldo do período (todos os video games)</span><span class="vg-num" id="vgSaldo"></span></div>
          <div class="vg-linha" id="vgNegAntLinha"><span>Negativo acumulado anterior</span><span class="vg-num" id="vgNegAnt"></span></div>
          <div class="vg-linha"><span>Total de comissões</span><span class="vg-num" id="vgTotCom" style="color:#b91c1c"></span></div>
          <div class="vg-linha vg-total"><span>Líquido da empresa</span><span class="vg-num" id="vgLiq"></span></div>
          <div class="vg-linha" id="vgNegNovoLinha" style="color:#92400e"><span>Negativo que vai para a próxima leitura</span><span class="vg-num" id="vgNegNovo"></span></div>
        </div>
        <div style="border-top:1px solid #e5e7eb;margin-top:12px;padding-top:12px">
          <div class="vg-topo" style="margin-bottom:6px">
            <strong>Pagamentos</strong>
            ${!ver && podeEditar() ? `<button type="button" class="btn sm" data-vg="pagamento-novo">Adicionar pagamento</button>` : ''}
          </div>
          <div class="vg-tabela">${htmlPagamentos(ver)}</div>
          <div class="vg-linha vg-total"><span id="vgRestamRot">Restam</span><span class="vg-num" id="vgRestam"></span></div>
        </div>
        <div class="vg-erro" id="vgMsg" role="alert"></div>
        <div class="vg-acoes">
          ${f.modo !== 'nova' ? `<button type="button" class="btn ghost" data-vg="form-novo">Voltar para nova leitura</button>` : ''}
          ${!ver && podeEditar() ? `<button type="button" class="btn primary" id="vgSalvar" data-vg="salvar">Salvar prestação</button>` : ''}
        </div>
      </div>`;
  }

  function htmlMaquina(l, ver) {
    const id = esc(l.maquina_id);
    const dis = ver ? 'disabled' : '';
    return `
      <div class="vg-maq" data-maq="${id}">
        <div class="vg-maq-topo"><span>🎮 ${esc(l.nome)}</span>
          ${!ver && podeEditar() ? `<button type="button" class="btn ghost sm" data-vg="maquina-remover" data-id="${id}" title="Retirar este video game do ponto">Retirar</button>` : ''}
        </div>
        <div class="vg-sub vg-so-celular">Anterior: di ${esc(l.di_anterior)} · ds ${esc(l.ds_anterior)}</div>
        <div class="vg-grade">
          <span class="vg-so-largo"></span><span class="vg-rot vg-num vg-so-largo">Anterior</span><span class="vg-rot vg-num vg-so-largo">Atual</span><span class="vg-rot vg-num vg-so-largo">No período</span>
          <span>di (venda)</span><span class="vg-num vg-so-largo" title="${esc(brl(l.di_anterior))}">${esc(l.di_anterior)}</span>
          <input inputmode="numeric" autocomplete="off" data-leitura="diTxt" data-id="${id}" value="${esc(l.diTxt)}" placeholder="ex.: 150700" aria-label="di atual de ${esc(l.nome)}" ${dis}>
          <span class="vg-num" data-o="venda"></span>
          <span>ds (prêmios)</span><span class="vg-num vg-so-largo" title="${esc(brl(l.ds_anterior))}">${esc(l.ds_anterior)}</span>
          <input inputmode="numeric" autocomplete="off" data-leitura="dsTxt" data-id="${id}" value="${esc(l.dsTxt)}" placeholder="ex.: 66470" aria-label="ds atual de ${esc(l.nome)}" ${dis}>
          <span class="vg-num" data-o="premios" style="color:#b91c1c"></span>
        </div>
        <div class="vg-rodape"><span class="vg-sub" data-o="acum"></span><strong>Saldo <span data-o="saldo"></span></strong></div>
        <label class="vg-zerado" data-o="zeradoBox" hidden><input type="checkbox" data-zerado data-id="${id}" ${l.zerado ? 'checked' : ''} ${dis}> Video game zerado ou trocado: contar a partir de zero</label>
        <div class="vg-erro" data-o="erro"></div>
      </div>`;
  }

  function htmlPagamentos(ver) {
    const lista = st.form.pagamentos;
    if (!lista.length) return `<div class="vg-sub" style="padding:6px 0">Nenhum pagamento lançado.</div>`;
    const edita = !ver && podeEditar();
    return `<table style="width:100%"><thead><tr><th>Data</th><th>Valor</th><th>Forma</th><th>Situação</th>${edita ? '<th>Ações</th>' : ''}</tr></thead><tbody>
      ${lista.map(p => {
        const divida = String(p.forma).toUpperCase() === 'DIVIDA_PAGA';
        const ult = (p.correcoes || []).slice(-1)[0];
        const corrigido = ult ? ` <span class="vg-chip esp" title="Corrigido de ${esc(brlReais(ult.de?.valor))} para ${esc(brlReais(ult.para?.valor))} por ${esc(ult.por)}">corrigido</span>` : '';
        return `<tr>
          <td>${esc(dataBR(p.data))}</td>
          <td style="${divida ? 'color:#b91c1c' : ''}">${divida ? '−' : ''}${esc(brlReais(p.valor))}${corrigido}</td>
          <td>${divida ? esc(p.obs || 'PIX') + ' (empresa → gerente)' : esc(p.forma)}</td>
          <td><span class="vg-chip" data-pg-status="${esc(p.id)}">…</span></td>
          ${edita ? `<td style="white-space:nowrap"><button type="button" class="btn sm" data-vg="pagamento-editar" data-id="${esc(p.id)}">Editar</button>
            <button type="button" class="btn danger sm" data-vg="pagamento-excluir" data-id="${esc(p.id)}">Excluir</button></td>` : ''}
        </tr>`;
      }).join('')}</tbody></table>`;
  }

  function htmlHistorico() {
    if (!st.prestacoes.length) return '';
    return `
      <div class="vg-card"><div class="vg-titulo" style="margin-bottom:8px">Leituras deste ponto</div>
      <div class="vg-tabela"><table style="width:100%">
        <thead><tr><th>Data</th><th>Saldo</th><th>Comissões</th><th>Líquido</th><th>Restam</th><th>Ações</th></tr></thead>
        <tbody>${st.prestacoes.map((p, i) => {
          const restam = (Number(p.liquido) || 0) - totalPago(p.dados?.pagamentos);
          return `<tr>
            <td>${esc(dataBR(p.data))}</td><td>${esc(brl(p.saldo))}</td><td>${esc(brl(p.total_comissoes))}</td>
            <td>${esc(brl(p.liquido))}</td><td>${esc(brl(restam))}</td>
            <td style="white-space:nowrap"><button type="button" class="btn sm" data-vg="prest-abrir" data-id="${esc(p.uid)}">${i === 0 && podeEditar() ? 'Alterar' : 'Ver'}</button>
            ${i === 0 && podeEditar() ? `<button type="button" class="btn danger sm" data-vg="prest-excluir" data-id="${esc(p.uid)}">Excluir</button>` : ''}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
      <div class="vg-sub" style="margin-top:6px">Só a leitura mais recente pode ser alterada, porque cada leitura parte da anterior.</div></div>`;
  }

  function definir(el, txt) { if (el) el.textContent = txt; }

  function recalcular() {
    if (!st.form || !document.getElementById('vgSaldo')) return null;
    const f = st.form;
    const { validas, erros } = avaliarLinhas();
    const r = calcular({ leituras: validas, negativoAnterior: f.negativoAnterior, comissoes: f.comissoes, base: f.base });
    f.linhas.forEach(l => {
      const box = document.querySelector(`[data-maq="${CSS.escape(String(l.maquina_id))}"]`);
      if (!box) return;
      const o = n => box.querySelector(`[data-o="${n}"]`);
      const lin = r.linhas.find(x => x.maquina_id === l.maquina_id);
      const di = leituraInt(l.diTxt), ds = leituraInt(l.dsTxt);
      definir(o('venda'), lin ? brl(lin.venda) : '—');
      definir(o('premios'), lin ? brl(lin.premios) : '—');
      definir(o('saldo'), lin ? brl(lin.saldo) : '—');
      definir(o('acum'), di !== null && ds !== null ? 'Acumulado do totalizador: ' + brl(di - ds) : '');
      definir(o('erro'), f.modo === 'ver' ? '' : (l.tocado || st.tentouSalvar ? erros[l.maquina_id] || '' : ''));
      const menor = di !== null && ds !== null && (di < l.di_anterior || ds < l.ds_anterior);
      if (o('zeradoBox')) o('zeradoBox').hidden = !(menor || l.zerado);
    });
    const comsBox = document.getElementById('vgComs');
    if (comsBox) comsBox.innerHTML = r.comissoes.map(c => `<div class="vg-com"><div class="vg-sub">${esc(c.nome)} (${esc(String(c.pct).replace('.', ','))}%)</div><div style="font-weight:700">${esc(brl(c.valor))}</div></div>`).join('');
    definir(document.getElementById('vgSaldo'), brl(r.saldo));
    definir(document.getElementById('vgNegAnt'), '− ' + brl(r.negativoAnterior) + ' (só na base das comissões)');
    document.getElementById('vgNegAntLinha').hidden = !r.negativoAnterior;
    definir(document.getElementById('vgTotCom'), '− ' + brl(r.totalComissoes));
    const liq = document.getElementById('vgLiq');
    definir(liq, brl(r.liquido));
    liq.style.color = r.liquido < 0 ? '#b91c1c' : '#166534';
    definir(document.getElementById('vgNegNovo'), brl(r.negativoNovo));
    document.getElementById('vgNegNovoLinha').hidden = !r.negativoNovo;
    const restam = r.liquido - totalPago(f.pagamentos);
    definir(document.getElementById('vgRestamRot'), restam < 0 ? 'Restam (empresa deve ao gerente)' : 'Restam (gerente deve à empresa)');
    definir(document.getElementById('vgRestam'), brl(Math.abs(restam)));
    return { r, erros };
  }

  async function atualizarStatusPagamentos() {
    for (const p of st.form?.pagamentos || []) {
      const chip = document.querySelector(`[data-pg-status="${CSS.escape(String(p.id))}"]`);
      if (!chip) continue;
      if (p.__rascunho) { chip.textContent = 'Não salvo'; continue; }
      try {
        const cods = (window.__codigosAtivos?.(p) || []).map(m => m.codigo);
        const noCaixa = await window.__valoresNoCaixa(p, cods);
        const tudo = cods.length && cods.every(c => noCaixa.has(c));
        chip.textContent = tudo ? 'No caixa' : 'Aguardando caixa';
        chip.className = 'vg-chip ' + (tudo ? 'ok' : 'esp');
      } catch (_) { chip.textContent = '—'; }
    }
  }

  // ---------- diálogos ----------
  function garantirDialogos() {
    if (document.getElementById('dlgVgPonto')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <dialog id="dlgVgPonto" class="vg-dlg">
        <header class="card"><strong id="dlgVgPontoTitulo">Ponto</strong></header>
        <form id="formVgPonto" class="card" novalidate>
          <div class="form-grid">
            <label style="grid-column:1/-1">Nome do ponto<input name="nome" placeholder="ex.: Bar do João"></label>
            <label style="grid-column:1/-1">Gerente responsável<select name="gerente"></select></label>
            ${[1, 2, 3].map(i => `
              <label>Comissão ${i}: nome<input name="c${i}_nome" placeholder="ex.: Ponto"></label>
              <label>Comissão ${i}: %<input name="c${i}_pct" inputmode="decimal" placeholder="0"></label>`).join('')}
            <label style="grid-column:1/-1">Base de cálculo
              <select name="base"><option value="saldo">Todas sobre o saldo</option><option value="cascata">Em cascata (cada uma sobre o que sobrou da anterior)</option></select></label>
            <label style="grid-column:1/-1" id="vgNegIniBox">Negativo que o ponto já tinha (R$)
              <input name="negativo" inputmode="decimal" placeholder="0,00"></label>
          </div>
          <div class="vg-erro" id="vgPontoErro" role="alert"></div>
          <div class="vg-acoes"><button type="button" class="btn ghost" data-vg-fechar="dlgVgPonto">Cancelar</button><button type="submit" class="btn">Salvar ponto</button></div>
        </form>
      </dialog>
      <dialog id="dlgVgMaquina" class="vg-dlg">
        <header class="card"><strong>Adicionar video game</strong></header>
        <form id="formVgMaquina" class="card" novalidate>
          <p class="vg-sub" style="margin:0 0 10px">Digite os números que estão na tela agora. A primeira leitura conta a partir deles.</p>
          <div class="form-grid">
            <label style="grid-column:1/-1">Nome<input name="nome"></label>
            <label>di atual (como na tela)<input name="di" inputmode="numeric" placeholder="ex.: 150700"></label>
            <label>ds atual (como na tela)<input name="ds" inputmode="numeric" placeholder="ex.: 66470"></label>
          </div>
          <div class="vg-erro" id="vgMaquinaErro" role="alert"></div>
          <div class="vg-acoes"><button type="button" class="btn ghost" data-vg-fechar="dlgVgMaquina">Cancelar</button><button type="submit" class="btn">Adicionar</button></div>
        </form>
      </dialog>
      <dialog id="dlgVgPagamento" class="vg-dlg">
        <header class="card"><strong id="dlgVgPagTitulo">Adicionar pagamento</strong></header>
        <form id="formVgPagamento" class="card" novalidate>
          <div class="form-grid">
            <label>Data<input name="data" type="date"></label>
            <label>Valor (R$)<input name="valor" inputmode="decimal" placeholder="0,00"></label>
            <label>Tipo<select name="tipo"><option value="rec">Recebido do gerente</option><option value="pag">Pago ao gerente</option></select></label>
            <label>Forma<select name="forma">${FORMAS.map(x => `<option>${x}</option>`).join('')}</select></label>
            <label style="grid-column:1/-1">Observação<input name="obs" placeholder="opcional"></label>
          </div>
          <p class="vg-sub" id="vgPagAviso" hidden style="margin:10px 0 0">A correção fica registrada e gera um novo código. Se o valor já foi confirmado no caixa, vai para lá só a diferença.</p>
          <div class="vg-erro" id="vgPagErro" role="alert"></div>
          <div class="vg-acoes"><button type="button" class="btn ghost" data-vg-fechar="dlgVgPagamento">Cancelar</button><button type="submit" class="btn">Salvar</button></div>
        </form>
      </dialog>`;
    document.body.appendChild(wrap);
    document.getElementById('formVgPonto').addEventListener('submit', salvarPonto);
    document.getElementById('formVgMaquina').addEventListener('submit', salvarMaquina);
    document.getElementById('formVgPagamento').addEventListener('submit', salvarPagamento);
    wrap.addEventListener('click', e => {
      const id = e.target.closest('[data-vg-fechar]')?.getAttribute('data-vg-fechar');
      if (id) document.getElementById(id).close();
    });
  }
  const numeroBR = txt => {
    const t = String(txt ?? '').trim();
    if (!t) return 0;
    const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
    return Number.isFinite(n) ? n : NaN;
  };

  function abrirDialogoPonto(ponto) {
    const f = document.getElementById('formVgPonto');
    f.reset();
    document.getElementById('vgPontoErro').textContent = '';
    document.getElementById('dlgVgPontoTitulo').textContent = ponto ? 'Configurar ponto' : 'Novo ponto';
    f.dataset.id = ponto?.id || '';
    const gerentes = (window.gerentes || []).slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR', { numeric: true }));
    f.gerente.innerHTML = '<option value="">Selecione</option>' + gerentes.map(g => `<option value="${esc(g.uid || g.id)}">${esc(g.nome)}</option>`).join('');
    if (ponto) {
      f.nome.value = ponto.nome || '';
      f.gerente.value = ponto.gerente_id || '';
      [1, 2, 3].forEach(i => {
        f[`c${i}_nome`].value = ponto[`comissao${i}_nome`] || '';
        f[`c${i}_pct`].value = String(Number(ponto[`comissao${i}_pct`]) || 0).replace('.', ',');
      });
      f.base.value = ponto.base_comissao || 'saldo';
      f.negativo.value = ponto.negativo_inicial ? String(ponto.negativo_inicial / 100).replace('.', ',') : '';
    }
    document.getElementById('vgNegIniBox').hidden = !!(ponto && st.prestacoes.length);
    document.getElementById('dlgVgPonto').showModal();
  }

  async function salvarPonto(e) {
    e.preventDefault();
    const f = e.target, erro = document.getElementById('vgPontoErro');
    const nome = f.nome.value.trim(), gerenteId = f.gerente.value;
    const pcts = [1, 2, 3].map(i => numeroBR(f[`c${i}_pct`].value));
    const negativo = numeroBR(f.negativo.value);
    if (!nome) { erro.textContent = 'Informe o nome do ponto.'; return; }
    if (!gerenteId) { erro.textContent = 'Selecione o gerente responsável.'; return; }
    if (pcts.some(p => Number.isNaN(p) || p < 0 || p > 100)) { erro.textContent = 'Cada comissão precisa estar entre 0 e 100%.'; return; }
    if (f.base.value === 'saldo' && pcts.reduce((a, b) => a + b, 0) > 100) { erro.textContent = 'As comissões somam mais de 100% do saldo.'; return; }
    if (Number.isNaN(negativo) || negativo < 0) { erro.textContent = 'Negativo inválido.'; return; }
    const g = (window.gerentes || []).find(x => String(x.uid || x.id) === String(gerenteId));
    const row = { nome, gerente_id: gerenteId, gerente_nome: g?.nome || '', base_comissao: f.base.value };
    [1, 2, 3].forEach((i, k) => {
      row[`comissao${i}_nome`] = f[`c${i}_nome`].value.trim() || `Comissão ${i}`;
      row[`comissao${i}_pct`] = pcts[k];
    });
    const id = f.dataset.id;
    if (!id || !st.prestacoes.length) row.negativo_inicial = Math.round(negativo * 100);
    try {
      if (id) {
        const { error } = await client().from('vg_pontos').update(row).eq('id', id);
        if (error) throw error;
      } else {
        row.empresa_id = await empresaId();
        const { data, error } = await client().from('vg_pontos').insert([row]).select().single();
        if (error) throw error;
        st.pontoId = data.id;
      }
      document.getElementById('dlgVgPonto').close();
      await recarregar();
      aviso('Ponto salvo', 'success');
    } catch (err) {
      console.error('[VideoGame] salvar ponto:', err);
      erro.textContent = 'Não foi possível salvar o ponto: ' + (err.message || err);
    }
  }

  function abrirDialogoMaquina() {
    const f = document.getElementById('formVgMaquina');
    f.reset();
    document.getElementById('vgMaquinaErro').textContent = '';
    f.nome.value = 'Video game ' + (st.maquinas.filter(m => m.ativo).length + 1);
    document.getElementById('dlgVgMaquina').showModal();
  }
  async function salvarMaquina(e) {
    e.preventDefault();
    const f = e.target, erro = document.getElementById('vgMaquinaErro');
    const di = leituraInt(f.di.value), ds = leituraInt(f.ds.value);
    if (!f.nome.value.trim()) { erro.textContent = 'Informe o nome.'; return; }
    if (di === null || ds === null) { erro.textContent = 'Informe di e ds como aparecem na tela.'; return; }
    try {
      const { data, error } = await client().from('vg_maquinas').insert([{
        empresa_id: await empresaId(), ponto_id: st.pontoId, nome: f.nome.value.trim(), di_inicial: di, ds_inicial: ds
      }]).select().single();
      if (error) throw error;
      st.maquinas.push(data);
      st.form.linhas.push({ maquina_id: data.id, nome: data.nome, di_anterior: di, ds_anterior: ds, diTxt: '', dsTxt: '', zerado: false });
      document.getElementById('dlgVgMaquina').close();
      render();
    } catch (err) {
      console.error('[VideoGame] salvar video game:', err);
      erro.textContent = 'Não foi possível salvar: ' + (err.message || err);
    }
  }
  async function removerMaquina(id) {
    const l = st.form.linhas.find(x => x.maquina_id === id);
    if (!l || !confirm(`Retirar "${l.nome}" deste ponto? As leituras antigas continuam no histórico.`)) return;
    const { error } = await client().from('vg_maquinas').update({ ativo: false }).eq('id', id);
    if (error) { aviso('Não foi possível retirar: ' + error.message, 'error'); return; }
    const m = st.maquinas.find(x => x.id === id);
    if (m) m.ativo = false;
    st.form.linhas = st.form.linhas.filter(x => x.maquina_id !== id);
    render();
  }

  function abrirDialogoPagamento(id) {
    const f = document.getElementById('formVgPagamento');
    f.reset();
    document.getElementById('vgPagErro').textContent = '';
    const pg = id ? st.form.pagamentos.find(p => p.id === id) : null;
    f.dataset.id = id || '';
    document.getElementById('dlgVgPagTitulo').textContent = pg ? 'Editar pagamento' : 'Adicionar pagamento';
    document.getElementById('vgPagAviso').hidden = !pg;
    f.tipo.disabled = !!pg;
    if (pg) {
      const divida = String(pg.forma).toUpperCase() === 'DIVIDA_PAGA';
      f.data.value = pg.data || '';
      f.valor.value = String(pg.valor).replace('.', ',');
      f.tipo.value = divida ? 'pag' : 'rec';
      f.forma.value = divida ? (FORMAS.includes(pg.obs) ? pg.obs : 'PIX') : pg.forma;
      f.obs.value = divida && FORMAS.includes(pg.obs) ? '' : (pg.obs || '');
    } else {
      const res = recalcular()?.r;
      const restam = res ? res.liquido - totalPago(st.form.pagamentos) : 0;
      f.data.value = hoje();
      f.tipo.value = restam < 0 ? 'pag' : 'rec';
      if (restam) f.valor.value = (Math.abs(restam) / 100).toFixed(2).replace('.', ',');
    }
    document.getElementById('dlgVgPagamento').showModal();
  }
  function salvarPagamento(e) {
    e.preventDefault();
    const f = e.target, erro = document.getElementById('vgPagErro');
    const valor = Math.round(numeroBR(f.valor.value) * 100) / 100;
    const id = f.dataset.id;
    if (!f.data.value) { erro.textContent = 'Informe a data.'; return; }
    if (Number.isNaN(valor) || valor < 0 || (!id && valor === 0)) { erro.textContent = 'Informe um valor válido.'; return; }
    const pagar = f.tipo.value === 'pag';
    const forma = pagar ? 'DIVIDA_PAGA' : f.forma.value;
    const obs = pagar ? (f.obs.value.trim() || f.forma.value) : f.obs.value.trim();
    const ponto = pontoAtual();
    if (id) {
      const pg = st.form.pagamentos.find(p => p.id === id);
      const antes = { valor: Number(pg.valor) || 0, data: pg.data || '', forma: pg.forma, obs: pg.obs || '' };
      const depois = { valor, data: f.data.value, forma, obs };
      if (JSON.stringify(antes) !== JSON.stringify(depois)) {
        (pg.correcoes ||= []).push({
          em: new Date().toISOString(), por: window.__currentUsername?.() || 'Sistema',
          dispositivo: window.__detectDevice?.() || 'desktop', de: antes, para: depois
        });
        Object.assign(pg, depois);
        pg.corrigido = true;
        pg.__recalcular = true;
      }
    } else {
      st.form.pagamentos.push(window.__iniciarCodigos({
        id: novoId(), data: f.data.value, valor, forma, obs, __rascunho: true
      }, ponto?.gerente_nome));
    }
    document.getElementById('dlgVgPagamento').close();
    render();
  }
  async function excluirPagamento(id) {
    const pg = st.form.pagamentos.find(p => p.id === id);
    if (!pg || !confirm('Excluir este pagamento?')) return;
    const bloqueio = await window.__bloqueioRemocaoPagamentos([pg]);
    if (bloqueio) { alert(bloqueio); return; }
    st.form.pagamentos = st.form.pagamentos.filter(p => p.id !== id);
    render();
  }

  // ---------- salvar ----------
  function rotuloCaixa(ponto) { return [ponto.gerente_nome, ponto.nome].filter(Boolean).join(' · '); }
  function textoOrigem(pontoNome, data) { return `Video game · ${pontoNome} · ${dataBR(data)}`; }

  async function gerarPendencias(prest, pagamentos, pontoNome, gerenteRotulo, opcoes = {}) {
    let n = 0;
    for (const pg of pagamentos || []) {
      if (!pg?.codigo) continue;
      n += await window.__garantirPendenciasCodificadas(prest, pg, {
        gerenteNome: gerenteRotulo, company: window.getCompany?.() || 'BSX',
        modalidade: MODALIDADE, infoBase: textoOrigem(pontoNome, prest.ini), ...opcoes
      }) || 0;
    }
    return n;
  }

  async function salvarPrestacao() {
    if (st.salvando) return;
    const f = st.form, ponto = pontoAtual(), msg = document.getElementById('vgMsg');
    const btn = document.getElementById('vgSalvar');
    msg.textContent = '';
    st.salvando = true;
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }
    const falha = t => { msg.textContent = t; };
    try {
      f.data = document.getElementById('vgData').value;
      if (!f.data) return falha('Informe a data da leitura.');
      if (!f.linhas.length) return falha('Adicione pelo menos um video game.');

      // Sempre confere com o banco: outra pessoa pode ter lançado neste ponto
      await carregarDoPonto();
      const ultima = st.prestacoes[0];
      if (f.modo === 'nova' && ultima && f.data <= String(ultima.data).slice(0, 10)) {
        return falha(`A data precisa ser depois da última leitura deste ponto (${dataBR(ultima.data)}).`);
      }
      if (f.modo === 'editar') {
        if (ultima?.uid !== f.uid) return falha('Existe uma leitura mais recente neste ponto. Só a última pode ser alterada.');
        const penultima = st.prestacoes[1];
        if (penultima && f.data <= String(penultima.data).slice(0, 10)) {
          return falha(`A data precisa ser depois da leitura anterior (${dataBR(penultima.data)}).`);
        }
      }
      f.negativoAnterior = negativoAnterior(f.uid);
      f.linhas.forEach(l => {
        const maq = st.maquinas.find(m => m.id === l.maquina_id);
        if (!maq) return;
        const a = leituraAnterior(maq, f.uid);
        l.di_anterior = a.di;
        l.ds_anterior = a.ds;
      });

      st.tentouSalvar = true;
      const calc = recalcular();
      if (Object.keys(calc.erros).length) return falha('Corrija as leituras destacadas para salvar.');
      const r = calc.r;

      const gerente = ponto.gerente_nome || '';
      await window.__reconciliarCodigos(f.pagamentos, gerente);
      f.pagamentos.forEach(p => { delete p.__rascunho; });

      const uid = f.uid || novoId();
      const montarLinha = () => ({
        uid, empresa_id: st.empresaId, ponto_id: ponto.id, data: f.data,
        gerente_id: ponto.gerente_id, gerente_nome: gerente,
        saldo: r.saldo, negativo_anterior: r.negativoAnterior, negativo_novo: r.negativoNovo,
        total_comissoes: r.totalComissoes, liquido: r.liquido,
        dados: {
          ponto_nome: ponto.nome, base: f.base, comissoes: r.comissoes, leituras: r.linhas,
          pagamentos: JSON.parse(JSON.stringify(f.pagamentos))
        }
      });
      const gravar = async () => {
        const q = f.modo === 'editar'
          ? client().from('vg_prestacoes').update(montarLinha()).eq('uid', uid).select('uid')
          : client().from('vg_prestacoes').insert([{ ...montarLinha(), created_by: window.__currentUsername?.() || '' }]).select('uid');
        const { data, error } = await q;
        if (error) throw error;
        if (!data?.length) throw new Error('Leitura não encontrada para atualizar.');
      };
      try {
        await gravar();
      } catch (err) {
        if (err.code === '23505') return falha('Já existe uma leitura deste ponto nesta data.');
        throw err;
      }
      f.modo = 'editar';
      f.uid = uid;

      // Conferência pós-gravação: o caixa pode ter confirmado um código durante o salvamento
      if (await window.__reconciliarCodigos(f.pagamentos, gerente)) await gravar();

      const prest = { id: uid, gerenteId: ponto.gerente_id, gerenteNome: gerente, ini: f.data, fim: f.data, pagamentos: f.pagamentos };
      await window.__limparPendenciasOrfas(prest);
      await gerarPendencias(prest, f.pagamentos, ponto.nome, rotuloCaixa(ponto));
      try { await window.__getPendenciasAsync?.(); window.renderFinPendencias?.(); } catch (_) {}

      st.tentouSalvar = false;
      await carregarDoPonto();
      novoFormulario();
      render();
      aviso('Prestação salva', 'success');
    } catch (err) {
      console.error('[VideoGame] salvar prestação:', err);
      falha('Não foi possível salvar: ' + (err.message || err));
    } finally {
      st.salvando = false;
      const b = document.getElementById('vgSalvar');
      if (b) { b.disabled = false; b.textContent = 'Salvar prestação'; }
    }
  }

  async function excluirPrestacao(uid) {
    await carregarDoPonto();
    const p = st.prestacoes[0];
    if (!p || p.uid !== uid) { alert('Só a leitura mais recente pode ser excluída.'); render(); return; }
    const bloqueio = await window.__bloqueioRemocaoPagamentos(p.dados?.pagamentos || []);
    if (bloqueio) { alert(bloqueio); return; }
    if (!confirm(`Excluir a leitura de ${dataBR(p.data)}? Os pagamentos ainda não confirmados saem da fila do caixa.`)) return;
    const { error } = await client().from('vg_prestacoes').delete().eq('uid', uid);
    if (error) { alert('Não foi possível excluir: ' + error.message); return; }
    await window.__limparPendenciasOrfas({ id: uid, pagamentos: [] });
    try { await window.__getPendenciasAsync?.(); window.renderFinPendencias?.(); } catch (_) {}
    await carregarDoPonto();
    novoFormulario();
    render();
  }

  // ---------- eventos ----------
  function ligarEventos() {
    const root = document.getElementById('vgRoot');
    root.addEventListener('input', e => {
      const campo = e.target.getAttribute('data-leitura');
      if (!campo) return;
      const l = st.form.linhas.find(x => x.maquina_id === e.target.getAttribute('data-id'));
      if (!l) return;
      const limpo = e.target.value.replace(/\D/g, '');
      if (limpo !== e.target.value) e.target.value = limpo;
      l[campo] = limpo;
      l.tocado = true;
      recalcular();
    });
    root.addEventListener('change', async e => {
      if (e.target.id === 'vgPonto') {
        st.pontoId = e.target.value;
        st.tentouSalvar = false;
        await carregarDoPonto();
        novoFormulario();
        render();
      } else if (e.target.id === 'vgData') {
        st.form.data = e.target.value;
      } else if (e.target.hasAttribute('data-zerado')) {
        const l = st.form.linhas.find(x => x.maquina_id === e.target.getAttribute('data-id'));
        if (l) { l.zerado = e.target.checked; recalcular(); }
      }
    });
    root.addEventListener('click', e => {
      const btn = e.target.closest('[data-vg]');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      const acoes = {
        'ponto-novo': () => abrirDialogoPonto(null),
        'ponto-editar': () => abrirDialogoPonto(pontoAtual()),
        'maquina-nova': abrirDialogoMaquina,
        'maquina-remover': () => removerMaquina(id),
        'pagamento-novo': () => abrirDialogoPagamento(null),
        'pagamento-editar': () => abrirDialogoPagamento(id),
        'pagamento-excluir': () => excluirPagamento(id),
        'salvar': salvarPrestacao,
        'form-novo': () => { st.tentouSalvar = false; novoFormulario(); render(); },
        'prest-abrir': () => abrirPrestacao(id),
        'prest-excluir': () => excluirPrestacao(id)
      };
      acoes[btn.getAttribute('data-vg')]?.();
    });
  }

  async function recarregar() {
    st.erroSetup = '';
    try {
      await carregarPontos();
      await carregarDoPonto();
    } catch (err) {
      console.error('[VideoGame] carregar:', err);
      st.pontos = [];
      st.pontoId = null;
      st.erroSetup = /vg_|schema cache|does not exist/i.test(String(err.message || ''))
        ? 'As tabelas do video game ainda não existem. Rode o arquivo db/video-game-schema.sql no Supabase.'
        : 'Não foi possível carregar o video game: ' + (err.message || err);
    }
    novoFormulario();
    render();
  }

  async function init() {
    if (!document.getElementById('vgRoot')) return;
    if (!st.pronto) {
      st.pronto = true;
      garantirEstilos();
      garantirDialogos();
      ligarEventos();
    }
    await recarregar();
  }

  // Segunda garantia, chamada pela sincronização do Financeiro
  async function garantirPendencias({ jaConhecido } = {}) {
    if (!client()) return 0;
    const id = await empresaId();
    const { data, error } = await client().from('vg_prestacoes').select('uid, data, gerente_id, gerente_nome, dados').eq('empresa_id', id);
    if (error) {
      if (/vg_prestacoes|schema cache|does not exist/i.test(String(error.message || ''))) return 0;
      throw error;
    }
    let n = 0;
    for (const r of data || []) {
      const pagamentos = r.dados?.pagamentos || [];
      const pontoNome = r.dados?.ponto_nome || '';
      const prest = { id: r.uid, gerenteId: r.gerente_id, gerenteNome: r.gerente_nome, ini: r.data, fim: r.data, pagamentos };
      const rotulo = [r.gerente_nome, pontoNome].filter(Boolean).join(' · ');
      n += await gerarPendencias(prest, pagamentos, pontoNome, rotulo, { jaConhecido });
    }
    return n;
  }

  document.addEventListener('empresa:change', () => {
    st.empresaId = null;
    st.empresaNome = null;
    st.pontoId = null;
    const sec = document.getElementById('pageVideoGame');
    if (st.pronto && sec && !sec.classList.contains('hidden')) recarregar();
  });

  window.VideoGame = { init, render, calcular, totalPago, garantirPendencias };
})();
