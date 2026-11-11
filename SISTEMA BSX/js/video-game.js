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
    form: null, salvando: false, erroSetup: '',
    cadPronto: false, contagem: {}, listaGerentes: [], imagem: null, salvandoCad: false
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
  const norm = s => String(s ?? '').trim().toLowerCase();
  const visivel = id => { const s = document.getElementById(id); return !!s && !s.classList.contains('hidden'); };
  // Cada cadastro (vg_pontos) é um gerente; cadastros antigos por ponto mostram também o nome do ponto
  const rotuloDe = (gerenteNome, pontoNome) =>
    gerenteNome && pontoNome && norm(gerenteNome) !== norm(pontoNome) ? `${gerenteNome} · ${pontoNome}` : (gerenteNome || pontoNome || '');
  const rotuloPonto = p => (p ? rotuloDe(p.gerente_nome, p.nome) : '');

  function hoje() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function aviso(msg, tipo) {
    if (window.showNotification) window.showNotification(msg, tipo || 'info');
    else if (tipo === 'error') alert(msg);
  }
  // Os dígitos entram pela direita, como no totalizador: 18100 → 181,00
  const centavosTxt = c => (Number(c) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function mascarar(input) {
    const dig = input.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    input.value = dig ? centavosTxt(Number(dig)) : '';
    return dig;
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
  // Quantos video games ativos cada gerente tem (só para a tela de cadastro)
  async function carregarContagem() {
    const id = await empresaId();
    const { data, error } = await client().from('vg_maquinas').select('ponto_id').eq('empresa_id', id).eq('ativo', true);
    if (error) throw error;
    st.contagem = {};
    (data || []).forEach(m => { st.contagem[m.ponto_id] = (st.contagem[m.ponto_id] || 0) + 1; });
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
  // Lista livre de comissões; as colunas antigas só valem enquanto o SQL novo não foi rodado
  function comissoesDoPonto(p) {
    if (Array.isArray(p?.comissoes)) return p.comissoes.map(c => ({ nome: c.nome, pct: Number(c.pct) || 0 }));
    return [1, 2, 3]
      .map(i => ({ nome: p?.[`comissao${i}_nome`] || `Comissão ${i}`, pct: Number(p?.[`comissao${i}_pct`]) || 0 }))
      .filter(c => c.pct > 0);
  }

  // ---------- formulário ----------
  function novoFormulario() {
    const ponto = pontoAtual();
    st.form = {
      modo: 'nova', uid: null, data: hoje(), pagamentos: [],
      comissoes: ponto ? comissoesDoPonto(ponto) : [],
      base: 'saldo',
      negativoAnterior: negativoAnterior(null),
      linhas: st.maquinas.filter(m => m.ativo).map(m => {
        const a = leituraAnterior(m, null);
        return { maquina_id: m.id, nome: m.nome, jogo: m.jogo || '', local: m.local || '', di_anterior: a.di, ds_anterior: a.ds, diTxt: '', dsTxt: '', zerado: false };
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
      return { maquina_id: l.maquina_id, nome: l.nome, jogo: l.jogo || maq?.jogo || '', local: l.local ?? maq?.local ?? '', di_anterior: a.di, ds_anterior: a.ds, diTxt: String(l.di), dsTxt: String(l.ds), zerado: !!l.zerado };
    });
    if (modo === 'editar') {
      st.maquinas.filter(m => m.ativo && !salvas.some(l => l.maquina_id === m.id)).forEach(m => {
        const a = leituraAnterior(m, uid);
        linhas.push({ maquina_id: m.id, nome: m.nome, jogo: m.jogo || '', local: m.local || '', di_anterior: a.di, ds_anterior: a.ds, diTxt: '', dsTxt: '', zerado: false });
      });
    }
    st.form = {
      modo, uid, data: String(p.data).slice(0, 10), linhas,
      pagamentos: JSON.parse(JSON.stringify(p.dados?.pagamentos || [])),
      comissoes: Array.isArray(p.dados?.comissoes) ? p.dados.comissoes.map(c => ({ nome: c.nome, pct: c.pct })) : comissoesDoPonto(pontoAtual()),
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
        erros[l.maquina_id] = 'Leitura menor que a anterior. Se o video game foi zerado, marque abaixo. Para troca de gerente ou de jogo, use o Cadastro video game.';
        return;
      }
      validas.push({ maquina_id: l.maquina_id, nome: l.nome, jogo: l.jogo || '', local: l.local || '', di_anterior: l.di_anterior, ds_anterior: l.ds_anterior, di, ds, zerado: !!l.zerado });
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
      .vg-maq-topo{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;font-weight:600;font-size:14px}
      .vg-grade{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr);gap:8px;align-items:center;font-size:13px}
      .vg-grade input{width:100%;min-width:0;padding:6px 8px;box-sizing:border-box}
      .vg-num{text-align:right;font-variant-numeric:tabular-nums}
      .vg-rot{font-size:11px;color:#6b7280;font-weight:600}
      .vg-rodape{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:8px;font-size:13px}
      .vg-erro{color:#b91c1c;font-size:12px;margin-top:6px}
      .vg-zerado{display:flex;gap:6px;align-items:center;font-size:12px;margin-top:4px;color:#92400e}
      .vg-maq-btns{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
      .vg-aviso{background:#fffbeb;border-left:4px solid #f59e0b;border-radius:0;padding:8px 10px;font-size:13px;color:#92400e;margin:0 0 10px}
      .vg-com-linha{display:grid;grid-template-columns:minmax(0,1fr) 90px auto;gap:8px;align-items:center;margin-bottom:8px}
      .vg-com-linha input{width:100%;min-width:0;box-sizing:border-box}
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
      dialog.vg-dlg form{margin:0;padding-top:16px !important}
      .vg-det{display:flex;flex-wrap:wrap;gap:4px 18px;font-size:13px;color:#374151}
      .vg-det b{font-weight:600;color:#111827}
      .vg-coms-cad{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
      details.vg-ret{margin-top:10px}
      details.vg-ret summary{cursor:pointer;font-size:13px;font-weight:600;color:#374151;padding:4px 0}
      .vg-ret-item{font-size:13px;color:#4b5563;padding:6px 0;border-top:1px solid #f3f4f6}
      .vg-dica{font-size:13px;color:#4b5563;background:#f9fafb;border:1px dashed #d1d5db;border-radius:10px;padding:10px 12px;margin-top:6px}
      dialog#dlgVgImagem{width:min(640px,96vw)}
      .vg-img-prev{display:block;width:100%;max-height:68vh;object-fit:contain;border:1px solid #e5e7eb;border-radius:8px;background:#f8fafc}
      @media (max-width:560px){
        .vg-grade{grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr) minmax(0,1fr)}
        .vg-grade .vg-so-largo{display:none}
        .vg-so-celular{display:block;margin-bottom:6px}
        .vg-maq-btns{width:100%;justify-content:flex-start}
      }
    `;
    document.head.appendChild(css);
  }

  function render() {
    const root = document.getElementById('vgRoot');
    if (!root) return;
    const ponto = pontoAtual();
    root.innerHTML = `
      <h2>Video game</h2>
      ${st.erroSetup ? `<div class="vg-setup">${esc(st.erroSetup)}</div>` : ''}
      <div class="vg-barra">
        <label>GERENTE<select id="vgPonto">${opcoesGerentes()}</select></label>
        <button type="button" class="btn ghost" data-tab="vg-cadastro">Cadastro video game</button>
      </div>
      ${ponto ? htmlFormulario(ponto) + htmlHistorico() : `<div class="vg-card vg-vazio">Cadastre o gerente e os video games dele em <strong>Cadastro video game</strong> para lançar a prestação.</div>`}
    `;
    if (ponto) { recalcular(); atualizarStatusPagamentos(); }
  }
  function opcoesGerentes() {
    return st.pontos.map(p => `<option value="${esc(p.id)}"${p.id === st.pontoId ? ' selected' : ''}>${esc(rotuloPonto(p))}</option>`).join('')
      || '<option value="">Nenhum gerente cadastrado</option>';
  }

  function htmlFormulario(ponto) {
    const f = st.form;
    const ver = f.modo === 'ver';
    const titulo = f.modo === 'nova' ? 'Nova leitura' : f.modo === 'editar' ? `Alterando a leitura de ${dataBR(f.data)}` : `Leitura de ${dataBR(f.data)} (somente consulta)`;
    return `
      <div class="vg-card" id="vgFormCard">
        <div class="vg-topo">
          <div>
            <div class="vg-titulo">${esc(rotuloPonto(ponto))}</div>
            <div class="vg-sub">${esc(titulo)}</div>
          </div>
          <label class="vg-sub" style="display:flex;flex-direction:column;gap:4px;font-weight:600">DATA DA LEITURA
            <input type="date" id="vgData" value="${esc(f.data)}" ${ver ? 'disabled' : ''}></label>
        </div>
        ${f.linhas.length ? f.linhas.map(l => htmlMaquina(l, ver)).join('') : `<div class="vg-vazio">Este gerente ainda não tem video game. Cadastre em <strong>Cadastro video game</strong>.</div>`}
        ${f.modo === 'nova' && podeEditar() ? `<div class="vg-sub">Para adicionar, trocar ou retirar video game, use o <a href="#vg-cadastro" data-tab="vg-cadastro">Cadastro video game</a>.</div>` : ''}
        <div style="border-top:1px solid #e5e7eb;margin-top:14px;padding-top:12px">
          <div class="vg-topo" style="margin-bottom:0">
            <strong>Comissões</strong>
            <span class="vg-sub">${f.base === 'cascata' ? 'Em cascata' : 'Sobre o resultado de todos os video games'}${f.modo === 'nova' ? '' : ' · percentuais gravados nesta leitura'}</span>
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
          ${f.modo !== 'nova' ? `<button type="button" class="btn ghost" data-vg="prest-imagem" data-id="${esc(f.uid)}" title="Imagem da prestação salva, para enviar no grupo do gerente">Gerar imagem</button>` : ''}
          ${!ver && podeEditar() ? `<button type="button" class="btn primary" id="vgSalvar" data-vg="salvar">Salvar prestação</button>` : ''}
        </div>
      </div>`;
  }

  function htmlMaquina(l, ver) {
    const id = esc(l.maquina_id);
    const dis = ver ? 'disabled' : '';
    return `
      <div class="vg-maq" data-maq="${id}">
        <div class="vg-maq-topo"><span>🎮 ${esc(l.nome)}${[l.jogo, l.local].filter(Boolean).length ? ` <span class="vg-sub">· ${esc([l.jogo, l.local].filter(Boolean).join(' · '))}</span>` : ''}</span></div>
        <div class="vg-sub vg-so-celular">Anterior: di ${esc(centavosTxt(l.di_anterior))} · ds ${esc(centavosTxt(l.ds_anterior))}</div>
        <div class="vg-grade">
          <span class="vg-so-largo"></span><span class="vg-rot vg-num vg-so-largo">Anterior</span><span class="vg-rot vg-num vg-so-largo">Atual</span><span class="vg-rot vg-num vg-so-largo">No período</span>
          <span>di (venda)</span><span class="vg-num vg-so-largo">${esc(centavosTxt(l.di_anterior))}</span>
          <input inputmode="numeric" autocomplete="off" data-leitura="diTxt" data-id="${id}" value="${esc(l.diTxt ? centavosTxt(l.diTxt) : '')}" placeholder="ex.: 1.507,00" aria-label="di atual de ${esc(l.nome)}" ${dis}>
          <span class="vg-num" data-o="venda"></span>
          <span>ds (prêmios)</span><span class="vg-num vg-so-largo">${esc(centavosTxt(l.ds_anterior))}</span>
          <input inputmode="numeric" autocomplete="off" data-leitura="dsTxt" data-id="${id}" value="${esc(l.dsTxt ? centavosTxt(l.dsTxt) : '')}" placeholder="ex.: 664,70" aria-label="ds atual de ${esc(l.nome)}" ${dis}>
          <span class="vg-num" data-o="premios" style="color:#b91c1c"></span>
        </div>
        <div class="vg-rodape"><span class="vg-sub" data-o="acum"></span><strong>Saldo <span data-o="saldo"></span></strong></div>
        <label class="vg-zerado" data-o="zeradoBox" hidden><input type="checkbox" data-zerado data-id="${id}" ${l.zerado ? 'checked' : ''} ${dis}> Video game foi zerado: contar a partir de zero</label>
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
      <div class="vg-card"><div class="vg-titulo" style="margin-bottom:8px">Prestações deste gerente</div>
      <div class="vg-tabela"><table style="width:100%">
        <thead><tr><th>Data</th><th>Saldo</th><th>Comissões</th><th>Líquido</th><th>Restam</th><th>Ações</th></tr></thead>
        <tbody>${st.prestacoes.map((p, i) => {
          const restam = (Number(p.liquido) || 0) - totalPago(p.dados?.pagamentos);
          return `<tr>
            <td>${esc(dataBR(p.data))}</td><td>${esc(brl(p.saldo))}</td><td>${esc(brl(p.total_comissoes))}</td>
            <td>${esc(brl(p.liquido))}</td><td>${esc(brl(restam))}</td>
            <td style="white-space:nowrap"><button type="button" class="btn sm" data-vg="prest-abrir" data-id="${esc(p.uid)}">${i === 0 && podeEditar() ? 'Alterar' : 'Ver'}</button>
            <button type="button" class="btn ghost sm" data-vg="prest-imagem" data-id="${esc(p.uid)}" title="Imagem para enviar no grupo do gerente">Imagem</button>
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
    if (comsBox) comsBox.innerHTML = r.comissoes.map(c => `<div class="vg-com"><div class="vg-sub">${esc(c.nome)} (${esc(String(c.pct).replace('.', ','))}%)</div><div style="font-weight:700">${esc(brl(c.valor))}</div></div>`).join('')
      || '<div class="vg-sub">Nenhuma comissão cadastrada para este gerente.</div>';
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
        <header class="card"><strong id="dlgVgPontoTitulo">Gerente</strong></header>
        <form id="formVgPonto" class="card" novalidate>
          <div class="form-grid">
            <label style="grid-column:1/-1">Gerente<select name="gerente"></select></label>
            <div id="vgGerNovoBox" style="grid-column:1/-1;display:contents" hidden>
              <label>Nome do gerente<input name="gerNome" placeholder="ex.: Fábia"></label>
              <label>Número<input name="gerNumero" placeholder="ex.: 078"></label>
            </div>
            <div style="grid-column:1/-1">
              <div class="vg-rot" style="font-size:12px">COMISSÕES</div>
              <div class="vg-sub" style="margin:2px 0 8px">Sobre a soma de todos os video games do gerente. Mudanças valem para as próximas prestações.</div>
              <div id="vgComLista"></div>
              <button type="button" class="btn ghost sm" id="vgComAdd">+ Adicionar comissão</button>
            </div>
            <label style="grid-column:1/-1" id="vgNegIniBox">Negativo que o gerente já tinha (R$)
              <input name="negativo" inputmode="decimal" placeholder="0,00"></label>
          </div>
          <div class="vg-erro" id="vgPontoErro" role="alert"></div>
          <div class="vg-acoes"><button type="button" class="btn ghost" data-vg-fechar="dlgVgPonto">Cancelar</button><button type="submit" class="btn" id="vgPontoSalvar">Salvar gerente</button></div>
        </form>
      </dialog>
      <dialog id="dlgVgMaquina" class="vg-dlg">
        <header class="card"><strong id="dlgVgMaquinaTitulo">Adicionar video game</strong></header>
        <form id="formVgMaquina" class="card" novalidate>
          <p class="vg-sub" id="vgMaquinaInfo" style="margin:0 0 10px"></p>
          <div class="form-grid">
            <label>Nome ou número<input name="nome" placeholder="ex.: 411"></label>
            <label>Jogo<input name="jogo" placeholder="ex.: Bingo"></label>
            <label>Local (opcional)<input name="local" placeholder="ex.: Bar do João"></label>
            <label>Instalado em<input name="instalada" type="date"></label>
            <p class="vg-sub" style="grid-column:1/-1;margin:4px 0 0"><strong>Leitura inicial:</strong> os números da tela depois do teste do aplicador. Não conta como venda: a primeira prestação parte deles.</p>
            <label>di inicial (entrada)<input name="di" data-mascara inputmode="numeric" placeholder="ex.: 9,00"></label>
            <label>ds inicial (saída)<input name="ds" data-mascara inputmode="numeric" placeholder="ex.: 1,00"></label>
          </div>
          <div class="vg-erro" id="vgMaquinaErro" role="alert"></div>
          <div class="vg-acoes"><button type="button" class="btn ghost" data-vg-fechar="dlgVgMaquina">Cancelar</button><button type="submit" class="btn" id="vgMaquinaSalvar">Adicionar</button></div>
        </form>
      </dialog>
      <dialog id="dlgVgTroca" class="vg-dlg">
        <header class="card"><strong id="dlgVgTrocaTitulo">Trocar</strong></header>
        <form id="formVgTroca" class="card" novalidate>
          <p class="vg-sub" id="vgTrocaInfo" style="margin:0 0 8px"></p>
          <p class="vg-aviso" id="vgTrocaAviso"></p>
          <div class="form-grid">
            <label style="grid-column:1/-1" id="vgTrocaDestinoBox">Novo gerente<select name="destino"></select></label>
            <label>Jogo<input name="jogo" placeholder="ex.: Bingo"></label>
            <label>Local (opcional)<input name="local" placeholder="ex.: Bar do João"></label>
            <label>Data da troca<input name="data" type="date"></label>
            <p class="vg-sub" style="grid-column:1/-1;margin:4px 0 0">Na troca o video game é zerado. Digite os números da tela depois do teste do aplicador: a próxima leitura parte deles.</p>
            <label>di de partida<input name="di" data-mascara inputmode="numeric" placeholder="ex.: 9,00"></label>
            <label>ds de partida<input name="ds" data-mascara inputmode="numeric" placeholder="ex.: 1,00"></label>
          </div>
          <div class="vg-erro" id="vgTrocaErro" role="alert"></div>
          <div class="vg-acoes"><button type="button" class="btn ghost" data-vg-fechar="dlgVgTroca">Cancelar</button><button type="submit" class="btn">Confirmar troca</button></div>
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
      </dialog>
      <dialog id="dlgVgImagem" class="vg-dlg">
        <header class="card"><strong>Imagem da prestação</strong></header>
        <div class="card" style="padding-top:14px">
          <img id="vgImgPrev" class="vg-img-prev" alt="Imagem da prestação de contas">
          <p class="vg-sub" id="vgImgInfo" style="margin:8px 0 0"></p>
          <div class="vg-acoes">
            <button type="button" class="btn ghost" data-vg-fechar="dlgVgImagem">Fechar</button>
            <button type="button" class="btn ghost" id="vgImgCopiar" hidden>Copiar</button>
            <button type="button" class="btn ghost" id="vgImgBaixar">Baixar</button>
            <button type="button" class="btn primary" id="vgImgCompartilhar" hidden>Compartilhar</button>
          </div>
        </div>
      </dialog>`;
    document.body.appendChild(wrap);
    document.getElementById('dlgVgImagem').addEventListener('close', limparImagem);
    document.getElementById('vgImgBaixar').addEventListener('click', baixarImagem);
    document.getElementById('vgImgCopiar').addEventListener('click', copiarImagem);
    document.getElementById('vgImgCompartilhar').addEventListener('click', compartilharImagem);
    document.getElementById('formVgPonto').gerente.addEventListener('change', e => {
      document.getElementById('vgGerNovoBox').hidden = e.target.value !== NOVO_GERENTE;
    });
    document.getElementById('formVgPonto').addEventListener('submit', salvarPonto);
    document.getElementById('formVgMaquina').addEventListener('submit', salvarMaquina);
    document.getElementById('formVgPagamento').addEventListener('submit', salvarPagamento);
    document.getElementById('formVgTroca').addEventListener('submit', salvarTroca);
    wrap.addEventListener('input', e => { if (e.target.hasAttribute('data-mascara')) mascarar(e.target); });
    wrap.addEventListener('click', e => {
      const id = e.target.closest('[data-vg-fechar]')?.getAttribute('data-vg-fechar');
      if (id) document.getElementById(id).close();
      if (e.target.closest('#vgComAdd')) adicionarLinhaComissao().querySelector('input')?.focus();
      e.target.closest('[data-com-remover]')?.closest('.vg-com-linha')?.remove();
    });
  }
  const numeroBR = txt => {
    const t = String(txt ?? '').trim();
    if (!t) return 0;
    const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
    return Number.isFinite(n) ? n : NaN;
  };

  function adicionarLinhaComissao(c) {
    const linha = document.createElement('div');
    linha.className = 'vg-com-linha';
    linha.innerHTML = `
      <input data-com-nome placeholder="Nome (ex.: Ponto)" aria-label="Nome da comissão" value="${esc(c?.nome || '')}">
      <input data-com-pct inputmode="decimal" placeholder="%" aria-label="Percentual da comissão" value="${esc(c ? String(c.pct).replace('.', ',') : '')}">
      <button type="button" class="btn ghost sm" data-com-remover aria-label="Remover comissão" title="Remover comissão">✕</button>`;
    document.getElementById('vgComLista').appendChild(linha);
    return linha;
  }

  const NOVO_GERENTE = '__novo__';

  // Gerentes da empresa (tabela gerentes), lidos na hora para incluir os recém-cadastrados
  async function carregarListaGerentes() {
    let arr = [];
    try { arr = (await window.SupabaseAPI?.gerentes?.getAll?.()) || []; } catch (_) { arr = []; }
    if (!arr.length) arr = window.gerentes || [];
    st.listaGerentes = arr
      .filter(g => g && g.ativo !== false)
      .map(g => ({ id: String(g.uid || g.id), nome: g.nome || '', numero: g.numero || '' }))
      .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR', { numeric: true }));
    return st.listaGerentes;
  }

  async function abrirDialogoPonto(ponto) {
    const f = document.getElementById('formVgPonto');
    f.reset();
    document.getElementById('vgPontoErro').textContent = '';
    document.getElementById('dlgVgPontoTitulo').textContent = ponto ? 'Comissões do gerente' : 'Novo gerente no video game';
    f.dataset.id = ponto?.id || '';
    f.gerente.disabled = !!ponto;
    f.gerente.innerHTML = ponto ? `<option value="">${esc(rotuloPonto(ponto))}</option>` : '<option value="">Carregando...</option>';
    if (ponto) f.negativo.value = ponto.negativo_inicial ? String(ponto.negativo_inicial / 100).replace('.', ',') : '';
    document.getElementById('vgGerNovoBox').hidden = true;
    document.getElementById('vgComLista').innerHTML = '';
    const lista = ponto ? comissoesDoPonto(ponto) : [];
    if (lista.length) lista.forEach(adicionarLinhaComissao); else adicionarLinhaComissao();
    document.getElementById('vgNegIniBox').hidden = !!(ponto && st.prestacoes.length);
    document.getElementById('dlgVgPonto').showModal();
    if (ponto) return;
    // Um cadastro por gerente: quem já está no video game não aparece de novo
    const usados = new Set(st.pontos.map(p => String(p.gerente_id)));
    const livres = (await carregarListaGerentes()).filter(g => !usados.has(g.id));
    f.gerente.innerHTML = '<option value="">Selecione</option>'
      + livres.map(g => `<option value="${esc(g.id)}">${esc(g.nome)}</option>`).join('')
      + `<option value="${NOVO_GERENTE}">+ Cadastrar novo gerente</option>`;
    if (!livres.length) {
      f.gerente.value = NOVO_GERENTE;
      document.getElementById('vgGerNovoBox').hidden = false;
    }
  }

  // Mesmo formato do Cadastro Gerentes; os campos que só o JB usa ficam no padrão
  async function cadastrarGerente(nome, numero) {
    const api = window.SupabaseAPI?.gerentes;
    if (!api?.create) throw new Error('Cadastro de gerentes indisponível. Recarregue a página.');
    const g = {
      nome, comissao: 0, numero, endereco: '', telefone: '', email: '', obs: '', observacoes: '',
      base_calculo: 'COLETAS_MENOS_DESPESAS', comissao_por_rota_positiva: false,
      tem_segunda_comissao: false, comissao2: 0, tem_saldo_acumulado: false, mensal: false,
      ativo: true, uid: novoId()
    };
    const data = await api.create(g);
    const id = String(data?.uid || data?.id || g.uid);
    if (Array.isArray(window.gerentes) && !window.gerentes.some(x => String(x.uid || x.id) === id)) {
      window.gerentes.push({
        id: data?.id, uid: id, nome, numero, comissao: 0, comissao2: 0, comissaoModo: 'simples',
        comissaoPorRotaPositiva: false, temSegundaComissao: false, temSaldoAcumulado: false,
        mensal: false, baseCalculo: 'COLETAS_MENOS_DESPESAS', ativo: true
      });
    }
    try { window.AuditLog?.log?.('gerente_criado', { id, nome, numero }); } catch (_) {}
    const novo = { id, nome, numero };
    st.listaGerentes.push(novo);
    return novo;
  }

  async function salvarPonto(e) {
    e.preventDefault();
    if (st.salvandoCad) return;
    const f = e.target, erro = document.getElementById('vgPontoErro');
    erro.textContent = '';
    const id = f.dataset.id;
    const escolha = f.gerente.value;
    const novoGer = !id && escolha === NOVO_GERENTE;
    const gerNome = f.gerNome.value.trim(), gerNumero = f.gerNumero.value.trim();
    const comissoes = [...document.querySelectorAll('#vgComLista .vg-com-linha')]
      .map(l => ({ nome: l.querySelector('[data-com-nome]').value.trim(), txt: l.querySelector('[data-com-pct]').value.trim() }))
      .filter(c => c.nome || c.txt)
      .map((c, i) => ({ nome: c.nome || `Comissão ${i + 1}`, pct: numeroBR(c.txt) }));
    const negativo = numeroBR(f.negativo.value);
    if (!id && !escolha) { erro.textContent = 'Selecione o gerente ou cadastre um novo.'; return; }
    if (novoGer && !gerNome) { erro.textContent = 'Informe o nome do gerente.'; return; }
    if (novoGer && !gerNumero) { erro.textContent = 'Informe o número do gerente.'; return; }
    if (novoGer) {
      const igual = st.listaGerentes.find(g => norm(g.nome) === norm(gerNome) || (g.numero && norm(g.numero) === norm(gerNumero)));
      if (igual) { erro.textContent = `Já existe o gerente ${igual.nome}${igual.numero ? ` (número ${igual.numero})` : ''}. Selecione na lista.`; return; }
    }
    if (comissoes.some(c => Number.isNaN(c.pct) || c.pct <= 0 || c.pct > 100)) { erro.textContent = 'Informe em cada comissão um percentual maior que 0 e até 100.'; return; }
    if (comissoes.reduce((a, c) => a + c.pct, 0) > 100) { erro.textContent = 'As comissões somam mais de 100% do resultado.'; return; }
    if (Number.isNaN(negativo) || negativo < 0) { erro.textContent = 'Negativo inválido.'; return; }
    const btn = document.getElementById('vgPontoSalvar');
    st.salvandoCad = true;
    if (btn) btn.disabled = true;
    try {
      if (id) {
        const row = { base_comissao: 'saldo', comissoes };
        if (!st.prestacoes.length) row.negativo_inicial = Math.round(negativo * 100);
        const { error } = await client().from('vg_pontos').update(row).eq('id', id);
        if (error) throw error;
      } else {
        await carregarPontos();
        const gerente = novoGer ? null : st.listaGerentes.find(g => g.id === escolha);
        if (!novoGer && !gerente) throw new Error('Gerente não encontrado. Feche e abra de novo.');
        if (gerente && st.pontos.some(p => String(p.gerente_id) === gerente.id)) {
          erro.textContent = `${gerente.nome} já está cadastrado no video game.`;
          return;
        }
        const g = gerente || await cadastrarGerente(gerNome, gerNumero);
        const row = {
          empresa_id: await empresaId(), nome: g.nome, gerente_id: g.id, gerente_nome: g.nome,
          base_comissao: 'saldo', comissoes, negativo_inicial: Math.round(negativo * 100)
        };
        const { data, error } = await client().from('vg_pontos').insert([row]).select().single();
        if (error) throw error;
        st.pontoId = data.id;
      }
      document.getElementById('dlgVgPonto').close();
      await recarregarTudo();
      aviso('Gerente salvo', 'success');
    } catch (err) {
      console.error('[VideoGame] salvar gerente:', err);
      erro.textContent = /comissoes/i.test(String(err.message || ''))
        ? 'Falta atualizar o banco: rode o arquivo db/video-game-comissoes.sql no Supabase.'
        : 'Não foi possível salvar: ' + (err.message || err);
    } finally {
      st.salvandoCad = false;
      if (btn) btn.disabled = false;
    }
  }

  function nomeLivre() {
    const usados = new Set(st.maquinas.filter(m => m.ativo).map(m => norm(m.nome)));
    let n = st.maquinas.filter(m => m.ativo).length + 1;
    while (usados.has(norm('Video game ' + n))) n++;
    return 'Video game ' + n;
  }

  // Sem id: novo video game do gerente. Com id: editar (leitura inicial só enquanto não tem prestação)
  function abrirDialogoMaquina(id) {
    const ponto = pontoAtual();
    if (!ponto) return;
    const m = id ? st.maquinas.find(x => x.id === id) : null;
    const travado = !!(m && ultimaLeituraNoPonto(m.id));
    const f = document.getElementById('formVgMaquina');
    f.reset();
    f.dataset.id = m?.id || '';
    document.getElementById('vgMaquinaErro').textContent = '';
    document.getElementById('dlgVgMaquinaTitulo').textContent = m ? `Editar ${m.nome}` : `Adicionar video game · ${rotuloPonto(ponto)}`;
    const info = document.getElementById('vgMaquinaInfo');
    info.textContent = travado ? 'Este video game já tem prestação: dá para mudar só o nome e o local. Para mudar o jogo, use Trocar jogo.' : '';
    info.hidden = !travado;
    document.getElementById('vgMaquinaSalvar').textContent = m ? 'Salvar' : 'Adicionar';
    ['jogo', 'instalada', 'di', 'ds'].forEach(n => { f[n].disabled = travado; });
    if (m) {
      f.nome.value = m.nome || '';
      f.jogo.value = m.jogo || '';
      f.local.value = m.local || '';
      f.instalada.value = String(m.instalada_em || '').slice(0, 10);
      f.di.value = centavosTxt(Number(m.di_inicial) || 0);
      f.ds.value = centavosTxt(Number(m.ds_inicial) || 0);
    } else {
      f.nome.value = nomeLivre();
      f.instalada.value = hoje();
    }
    document.getElementById('dlgVgMaquina').showModal();
  }
  async function salvarMaquina(e) {
    e.preventDefault();
    if (st.salvandoCad) return;
    const f = e.target, erro = document.getElementById('vgMaquinaErro');
    const m = f.dataset.id ? st.maquinas.find(x => x.id === f.dataset.id) : null;
    const travado = !!(m && ultimaLeituraNoPonto(m.id));
    const nome = f.nome.value.trim(), local = f.local.value.trim(), jogo = f.jogo.value.trim();
    const di = leituraInt(f.di.value), ds = leituraInt(f.ds.value);
    erro.textContent = '';
    if (!nome) { erro.textContent = 'Informe o nome ou número.'; return; }
    if (st.maquinas.some(x => x.ativo && x.id !== m?.id && norm(x.nome) === norm(nome))) { erro.textContent = 'Este gerente já tem um video game ativo com esse nome.'; return; }
    if (!travado && !f.instalada.value) { erro.textContent = 'Informe a data da instalação.'; return; }
    if (!travado && (di === null || ds === null)) { erro.textContent = 'Informe a leitura inicial: di e ds (pode ser 0,00).'; return; }
    const btn = document.getElementById('vgMaquinaSalvar');
    st.salvandoCad = true;
    if (btn) btn.disabled = true;
    try {
      let q;
      if (m) {
        const row = { nome };
        if (local !== (m.local || '')) row.local = local || null;
        if (!travado) Object.assign(row, { jogo: jogo || null, instalada_em: f.instalada.value, di_inicial: di, ds_inicial: ds });
        q = client().from('vg_maquinas').update(row).eq('id', m.id).select();
      } else {
        const row = {
          empresa_id: await empresaId(), ponto_id: st.pontoId, nome,
          jogo: jogo || null, di_inicial: di, ds_inicial: ds, instalada_em: f.instalada.value
        };
        if (local) row.local = local;
        q = client().from('vg_maquinas').insert([row]).select();
      }
      const { data, error } = await q;
      if (error) throw error;
      if (!data?.length) throw new Error('Video game não encontrado.');
      document.getElementById('dlgVgMaquina').close();
      await aposMudarMaquinas();
      aviso(m ? 'Video game atualizado' : 'Video game adicionado', 'success');
    } catch (err) {
      console.error('[VideoGame] salvar video game:', err);
      erro.textContent = msgErroMaquina(err);
    } finally {
      st.salvandoCad = false;
      if (btn) btn.disabled = false;
    }
  }
  const msgErroMaquina = err => {
    const t = String(err?.message || '');
    if (/'local'|\blocal\b.*column|column.*\blocal\b/i.test(t)) return 'Falta atualizar o banco: rode o arquivo db/video-game-cadastro.sql no Supabase.';
    if (/jogo|instalada_em|retirada_em|motivo_saida|origem_id/i.test(t)) return 'Falta atualizar o banco: rode o arquivo db/video-game-maquinas.sql no Supabase.';
    return 'Não foi possível salvar: ' + (err?.message || err);
  };
  const ultimaLeituraNoPonto = maqId => st.prestacoes.find(p => (p.dados?.leituras || []).some(l => l.maquina_id === maqId)) || null;

  async function removerMaquina(id) {
    const m = st.maquinas.find(x => x.id === id);
    if (!m || !m.ativo) return;
    const ult = ultimaLeituraNoPonto(id);
    const msg = `Retirar "${m.nome}" de ${rotuloPonto(pontoAtual())}?\n\n`
      + (ult ? `Última prestação com ele: ${dataBR(ult.data)}. O que foi vendido depois dela fica de fora.` : 'Ele ainda não tem prestação.')
      + '\nAs prestações antigas continuam no histórico.';
    if (!confirm(msg)) return;
    const { error } = await client().from('vg_maquinas').update({ ativo: false, retirada_em: hoje(), motivo_saida: 'retirada' }).eq('id', id);
    if (error) { aviso(msgErroMaquina(error), 'error'); return; }
    await aposMudarMaquinas();
    aviso(`${m.nome} retirado`, 'success');
  }

  function abrirDialogoTroca(id, tipo) {
    const m = st.maquinas.find(x => x.id === id);
    if (!m || !m.ativo) return;
    const destinos = st.pontos.filter(p => p.id !== st.pontoId);
    if (tipo === 'ponto' && !destinos.length) { alert('Cadastre primeiro o outro gerente no video game.'); return; }
    const f = document.getElementById('formVgTroca');
    f.reset();
    document.getElementById('vgTrocaErro').textContent = '';
    f.dataset.id = id;
    f.dataset.tipo = tipo;
    document.getElementById('dlgVgTrocaTitulo').textContent = tipo === 'ponto' ? `Trocar ${m.nome} de gerente` : `Trocar o jogo de ${m.nome}`;
    document.getElementById('vgTrocaInfo').textContent = `Gerente atual: ${rotuloPonto(pontoAtual()) || '—'} · Jogo atual: ${m.jogo || 'não informado'}${m.local ? ` · Local: ${m.local}` : ''}`;
    const ult = ultimaLeituraNoPonto(id);
    document.getElementById('vgTrocaAviso').textContent = ult
      ? `Última prestação deste video game: ${dataBR(ult.data)}. O que foi vendido depois dela fica de fora. Se ainda não fez a prestação final, faça antes de trocar.`
      : 'Este video game ainda não tem prestação com este gerente. Se já vendeu algo, faça a prestação antes de trocar.';
    f.destino.innerHTML = destinos.map(p => `<option value="${esc(p.id)}">${esc(rotuloPonto(p))}</option>`).join('');
    document.getElementById('vgTrocaDestinoBox').hidden = tipo !== 'ponto';
    f.jogo.value = tipo === 'ponto' ? (m.jogo || '') : '';
    f.local.value = tipo === 'jogo' ? (m.local || '') : '';
    f.data.value = hoje();
    document.getElementById('dlgVgTroca').showModal();
  }

  // Troca = encerra a instalação atual e abre outra no destino, a partir da leitura de partida
  async function salvarTroca(e) {
    e.preventDefault();
    if (st.salvandoCad) return;
    const f = e.target, erro = document.getElementById('vgTrocaErro');
    const tipo = f.dataset.tipo;
    const m = st.maquinas.find(x => x.id === f.dataset.id);
    const destino = tipo === 'ponto' ? f.destino.value : st.pontoId;
    const jogo = f.jogo.value.trim(), local = f.local.value.trim();
    const di = leituraInt(f.di.value), ds = leituraInt(f.ds.value);
    const ult = ultimaLeituraNoPonto(m?.id);
    erro.textContent = '';
    if (!m) return;
    if (!destino) { erro.textContent = 'Selecione o novo gerente.'; return; }
    if (tipo === 'jogo' && !jogo) { erro.textContent = 'Informe o novo jogo.'; return; }
    if (tipo === 'jogo' && jogo.toLowerCase() === String(m.jogo || '').toLowerCase()) { erro.textContent = 'O novo jogo é igual ao atual.'; return; }
    if (!f.data.value) { erro.textContent = 'Informe a data da troca.'; return; }
    if (ult && f.data.value < String(ult.data).slice(0, 10)) { erro.textContent = `A troca não pode ser antes da última prestação (${dataBR(ult.data)}).`; return; }
    if (di === null || ds === null) { erro.textContent = 'Informe di e ds de partida (pode ser 0,00).'; return; }
    st.salvandoCad = true;
    try {
      const nova = {
        empresa_id: await empresaId(), ponto_id: destino, nome: m.nome, jogo: jogo || null,
        di_inicial: di, ds_inicial: ds, origem_id: m.id, instalada_em: f.data.value
      };
      if (local) nova.local = local;
      const { data: criada, error } = await client().from('vg_maquinas').insert([nova]).select().single();
      if (error) throw error;
      const { error: e2 } = await client().from('vg_maquinas')
        .update({ ativo: false, retirada_em: f.data.value, motivo_saida: tipo === 'ponto' ? 'troca_ponto' : 'troca_jogo' })
        .eq('id', m.id);
      if (e2) {
        await client().from('vg_maquinas').delete().eq('id', criada.id);
        throw e2;
      }
      document.getElementById('dlgVgTroca').close();
      await aposMudarMaquinas();
      const destinoNome = rotuloPonto(st.pontos.find(p => p.id === destino));
      aviso(tipo === 'ponto' ? `${m.nome} agora está com ${destinoNome}` : `Jogo de ${m.nome} trocado para ${jogo}`, 'success');
    } catch (err) {
      console.error('[VideoGame] troca:', err);
      erro.textContent = msgErroMaquina(err);
    } finally {
      st.salvandoCad = false;
    }
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
  function rotuloCaixa(ponto) { return rotuloDe(ponto.gerente_nome, ponto.nome); }
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
      if (!f.linhas.length) return falha('Este gerente não tem video game. Cadastre em Cadastro video game.');

      // Sempre confere com o banco: outra pessoa pode ter lançado neste gerente
      await carregarDoPonto();
      const ultima = st.prestacoes[0];
      if (f.modo === 'nova' && ultima && f.data <= String(ultima.data).slice(0, 10)) {
        return falha(`A data precisa ser depois da última prestação deste gerente (${dataBR(ultima.data)}).`);
      }
      if (f.modo === 'editar') {
        if (ultima?.uid !== f.uid) return falha('Existe uma prestação mais recente deste gerente. Só a última pode ser alterada.');
        const penultima = st.prestacoes[1];
        if (penultima && f.data <= String(penultima.data).slice(0, 10)) {
          return falha(`A data precisa ser depois da prestação anterior (${dataBR(penultima.data)}).`);
        }
      }
      const antesDaInstalacao = f.linhas
        .map(l => st.maquinas.find(m => m.id === l.maquina_id))
        .find(m => m?.instalada_em && f.data < String(m.instalada_em).slice(0, 10));
      if (antesDaInstalacao) {
        return falha(`A data da leitura é anterior à instalação de ${antesDaInstalacao.nome} (${dataBR(antesDaInstalacao.instalada_em)}).`);
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
        if (err.code === '23505') return falha('Já existe uma prestação deste gerente nesta data.');
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
      abrirImagem(uid);
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

  // ---------- tela de cadastro (gerentes e video games) ----------
  const pctTxt = n => String(Number(n) || 0).replace('.', ',');
  const MOTIVOS = { troca_ponto: 'trocado de gerente', troca_jogo: 'trocado de jogo', retirada: 'retirado' };

  function renderCadastro() {
    const root = document.getElementById('vgCadRoot');
    if (!root) return;
    const editar = podeEditar();
    const ponto = pontoAtual();
    root.innerHTML = `
      <h2>Cadastro video game</h2>
      ${st.erroSetup ? `<div class="vg-setup">${esc(st.erroSetup)}</div>` : ''}
      <div class="vg-barra">
        <label>GERENTE<select id="vgCadPonto">${opcoesGerentes()}</select></label>
        ${editar ? `<button type="button" class="btn" data-vg="ger-novo">Novo gerente</button>` : ''}
        <button type="button" class="btn ghost" data-tab="prest-vg">Ir para a prestação</button>
      </div>
      ${ponto ? htmlCadGerente(ponto, editar) : `<div class="vg-card vg-vazio">Nenhum gerente no video game ainda.${editar ? ' Clique em <strong>Novo gerente</strong> para começar.' : ''}</div>`}
      ${htmlCadResumo()}
    `;
  }

  function htmlCadGerente(ponto, editar) {
    const coms = comissoesDoPonto(ponto);
    const ativas = st.maquinas.filter(m => m.ativo);
    const antigas = st.maquinas.filter(m => !m.ativo);
    const total = coms.reduce((a, c) => a + c.pct, 0);
    return `
      <div class="vg-card">
        <div class="vg-topo" style="margin-bottom:4px">
          <div>
            <div class="vg-titulo">${esc(rotuloPonto(ponto))}</div>
            <div class="vg-sub">${ativas.length} video game${ativas.length === 1 ? '' : 's'} ativo${ativas.length === 1 ? '' : 's'} · comissão calculada sobre a soma de todos</div>
          </div>
          ${editar ? `<button type="button" class="btn ghost sm" data-vg="ger-editar">Editar comissões</button>` : ''}
        </div>
        <div class="vg-coms-cad">${coms.length
          ? coms.map(c => `<span class="vg-chip">${esc(c.nome)} ${esc(pctTxt(c.pct))}%</span>`).join('') + (coms.length > 1 ? `<span class="vg-chip ok">Total ${esc(pctTxt(total))}%</span>` : '')
          : '<span class="vg-sub">Sem comissão cadastrada.</span>'}</div>
        ${Number(ponto.negativo_inicial) ? `<div class="vg-sub" style="margin-top:6px">Negativo inicial: ${esc(brl(ponto.negativo_inicial))}</div>` : ''}
      </div>
      <div class="vg-card">
        <div class="vg-topo" style="margin-bottom:8px">
          <div class="vg-titulo">Video games</div>
          ${editar ? `<button type="button" class="btn sm" data-vg="maquina-nova">+ Adicionar video game</button>` : ''}
        </div>
        ${ativas.length ? ativas.map(m => htmlCadMaquina(m, editar)).join('') : '<div class="vg-vazio">Nenhum video game ativo. Adicione o primeiro informando a leitura inicial.</div>'}
        ${antigas.length ? `<details class="vg-ret"><summary>Histórico: retirados e trocados (${antigas.length})</summary>${antigas.map(htmlCadAntiga).join('')}</details>` : ''}
      </div>`;
  }

  function htmlCadMaquina(m, editar) {
    const id = esc(m.id);
    const ult = ultimaLeituraNoPonto(m.id);
    const lu = ult ? (ult.dados?.leituras || []).find(l => l.maquina_id === m.id) : null;
    return `
      <div class="vg-maq">
        <div class="vg-maq-topo"><span>🎮 ${esc(m.nome)}${m.jogo ? ` <span class="vg-sub">· ${esc(m.jogo)}</span>` : ''}</span>
          ${editar ? `<span class="vg-maq-btns">
            <button type="button" class="btn ghost sm" data-vg="maquina-editar" data-id="${id}">Editar</button>
            <button type="button" class="btn ghost sm" data-vg="maquina-trocar-ponto" data-id="${id}" title="Passar este video game para outro gerente">Trocar gerente</button>
            <button type="button" class="btn ghost sm" data-vg="maquina-trocar-jogo" data-id="${id}" title="Trocar o jogo deste video game">Trocar jogo</button>
            <button type="button" class="btn ghost sm" data-vg="maquina-remover" data-id="${id}" title="Retirar este video game">Retirar</button></span>` : ''}
        </div>
        <div class="vg-det">
          <span>Local: <b>${esc(m.local || '—')}</b></span>
          <span>Instalado em: <b>${esc(dataBR(m.instalada_em) || '—')}</b></span>
          <span>Leitura inicial: <b>di ${esc(centavosTxt(Number(m.di_inicial) || 0))} · ds ${esc(centavosTxt(Number(m.ds_inicial) || 0))}</b></span>
          <span>Última prestação: <b>${lu ? `${esc(dataBR(ult.data))} (di ${esc(centavosTxt(lu.di))} · ds ${esc(centavosTxt(lu.ds))})` : 'ainda não tem'}</b></span>
        </div>
      </div>`;
  }

  function htmlCadAntiga(m) {
    const det = [m.jogo, m.local].filter(Boolean).map(esc).join(' · ');
    return `<div class="vg-ret-item">🎮 <strong>${esc(m.nome)}</strong>${det ? ' · ' + det : ''}
      — de ${esc(dataBR(m.instalada_em) || '?')} até ${esc(dataBR(m.retirada_em) || '?')} (${esc(MOTIVOS[m.motivo_saida] || 'inativo')})</div>`;
  }

  function htmlCadResumo() {
    if (st.pontos.length < 2) return '';
    return `<details class="vg-card vg-ret"><summary>Todos os gerentes do video game (${st.pontos.length})</summary>
      <div class="vg-tabela"><table style="width:100%"><thead><tr><th>Gerente</th><th>Video games</th><th>Comissões</th><th></th></tr></thead><tbody>
      ${st.pontos.map(p => `<tr${p.id === st.pontoId ? ' style="background:#eff6ff"' : ''}>
        <td>${esc(rotuloPonto(p))}</td><td>${st.contagem[p.id] || 0}</td>
        <td>${esc(comissoesDoPonto(p).map(c => `${c.nome} ${pctTxt(c.pct)}%`).join(' · ') || '—')}</td>
        <td><button type="button" class="btn ghost sm" data-vg="ger-abrir" data-id="${esc(p.id)}">Abrir</button></td></tr>`).join('')}
      </tbody></table></div></details>`;
  }

  // ---------- imagem da prestação (modelo tabela) ----------
  const FONTE = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  function dataHoraBR(d = new Date()) {
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} às ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'gerente';

  // Tudo vem da prestação SALVA: a imagem mostra exatamente o que está no sistema
  function infoImagem(p) {
    const ponto = st.pontos.find(x => x.id === p.ponto_id) || pontoAtual();
    const linhas = (p.dados?.leituras || []).map(l => {
      const maq = st.maquinas.find(m => m.id === l.maquina_id);
      const venda = Number.isFinite(l.venda) ? l.venda : l.di - (l.zerado ? 0 : l.di_anterior);
      const premios = Number.isFinite(l.premios) ? l.premios : l.ds - (l.zerado ? 0 : l.ds_anterior);
      const detalhe = [l.jogo || maq?.jogo, l.local ?? maq?.local, l.zerado ? 'zerado' : ''].filter(Boolean).join(' · ');
      return { nome: l.nome || maq?.nome || '', detalhe, venda, premios, saldo: venda - premios };
    });
    const pagamentos = (p.dados?.pagamentos || [])
      .map(pg => {
        const divida = String(pg.forma).toUpperCase() === 'DIVIDA_PAGA';
        return { data: pg.data, texto: divida ? `Pago ao gerente · ${pg.obs || 'PIX'}` : `Recebido · ${pg.forma || ''}`, valor: Math.round((Number(pg.valor) || 0) * 100) };
      })
      .filter(pg => pg.valor);
    const gerente = p.gerente_nome || ponto?.gerente_nome || '';
    const liquido = Number(p.liquido) || 0;
    return {
      titulo: rotuloDe(gerente, p.dados?.ponto_nome || ponto?.nome) || 'Gerente',
      empresa: st.empresaNome || window.getCompany?.() || '',
      data: p.data, linhas,
      comissoes: Array.isArray(p.dados?.comissoes) ? p.dados.comissoes : [],
      saldo: Number(p.saldo) || 0,
      negativoAnterior: Number(p.negativo_anterior) || 0,
      negativoNovo: Number(p.negativo_novo) || 0,
      liquido, pagamentos,
      restam: liquido - totalPago(p.dados?.pagamentos)
    };
  }

  function desenharImagem(info) {
    const W = 1080, M = 48, IN = M + 24, FIM = W - M - 24;
    const COL = { venda: 616, premios: 812, saldo: FIM };
    const pintar = ctx => {
      const txt = (t, x, y, o = {}) => {
        const { tam = 28, peso = 400, cor = '#0f172a', alinhar = 'left', max } = o;
        let s = tam, texto = String(t ?? '');
        ctx.textAlign = alinhar;
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = cor;
        ctx.font = `${peso} ${s}px ${FONTE}`;
        if (max) {
          while (ctx.measureText(texto).width > max && s > Math.round(tam * 0.7)) { s -= 1; ctx.font = `${peso} ${s}px ${FONTE}`; }
          if (ctx.measureText(texto).width > max) {
            while (texto.length > 1 && ctx.measureText(texto + '…').width > max) texto = texto.slice(0, -1);
            texto += '…';
          }
        }
        ctx.fillText(texto, x, y);
      };
      const caixa = (x, y, w, h, r, cor, borda) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
        ctx.fillStyle = cor;
        ctx.fill();
        if (borda) { ctx.strokeStyle = borda; ctx.lineWidth = 2; ctx.stroke(); }
      };
      const linha = (y, cor = '#e2e8f0') => { ctx.fillStyle = cor; ctx.fillRect(M, y, W - 2 * M, 2); };

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, ctx.canvas.height);

      // Cabeçalho
      ctx.fillStyle = '#13294b';
      ctx.fillRect(0, 0, W, 196);
      txt('PRESTAÇÃO DE CONTAS · VIDEO GAME', M, 62, { tam: 22, peso: 700, cor: '#93c5fd' });
      txt(info.titulo, M, 126, { tam: 52, peso: 800, cor: '#ffffff', max: W - 2 * M - 250 });
      txt(dataBR(info.data), W - M, 126, { tam: 40, peso: 700, cor: '#ffffff', alinhar: 'right' });
      txt(info.empresa, M, 170, { tam: 24, peso: 500, cor: '#cbd5e1', max: 600 });
      txt(`${info.linhas.length} video game${info.linhas.length === 1 ? '' : 's'}`, W - M, 170, { tam: 24, cor: '#cbd5e1', alinhar: 'right' });
      let y = 232;

      // Tabela
      caixa(M, y, W - 2 * M, 58, 12, '#f1f5f9');
      const cab = { tam: 20, peso: 700, cor: '#475569' };
      txt('VIDEO GAME', IN, y + 37, cab);
      txt('ENTRADA', COL.venda, y + 37, { ...cab, alinhar: 'right' });
      txt('SAÍDA', COL.premios, y + 37, { ...cab, alinhar: 'right' });
      txt('SALDO', COL.saldo, y + 37, { ...cab, alinhar: 'right' });
      y += 58;
      const maxNome = COL.venda - 175 - IN;
      info.linhas.forEach(l => {
        const h = l.detalhe ? 94 : 72;
        txt(l.nome, IN, y + 44, { tam: 30, peso: 700, max: maxNome });
        if (l.detalhe) txt(l.detalhe, IN, y + 78, { tam: 22, cor: '#64748b', max: maxNome });
        const vy = y + (l.detalhe ? 60 : 46);
        txt(brl(l.venda), COL.venda, vy, { tam: 28, alinhar: 'right', max: 172 });
        txt(brl(l.premios), COL.premios, vy, { tam: 28, cor: '#b91c1c', alinhar: 'right', max: 172 });
        txt(brl(l.saldo), COL.saldo, vy, { tam: 28, peso: 700, cor: l.saldo < 0 ? '#b91c1c' : '#0f172a', alinhar: 'right', max: 176 });
        y += h;
        linha(y);
      });
      const somaVenda = info.linhas.reduce((a, l) => a + l.venda, 0);
      const somaPremios = info.linhas.reduce((a, l) => a + l.premios, 0);
      y += 12;
      caixa(M, y, W - 2 * M, 76, 12, '#e0e7ff');
      txt('SOMA', IN, y + 49, { tam: 28, peso: 800, cor: '#13294b' });
      txt(brl(somaVenda), COL.venda, y + 49, { tam: 28, peso: 700, cor: '#13294b', alinhar: 'right', max: 172 });
      txt(brl(somaPremios), COL.premios, y + 49, { tam: 28, peso: 700, cor: '#b91c1c', alinhar: 'right', max: 172 });
      txt(brl(info.saldo), COL.saldo, y + 49, { tam: 30, peso: 800, cor: info.saldo < 0 ? '#b91c1c' : '#13294b', alinhar: 'right', max: 176 });
      y += 76 + 32;

      // Comissões sobre a soma e líquido
      const linhas = [];
      if (info.negativoAnterior) {
        linhas.push(['Negativo anterior (abate da base)', '− ' + brl(info.negativoAnterior), '#b45309']);
        linhas.push(['Base das comissões', brl(Math.max(info.saldo - info.negativoAnterior, 0)), '#0f172a']);
      }
      info.comissoes.forEach(c => linhas.push([`${c.nome} (${pctTxt(c.pct)}%)`, '− ' + brl(c.valor), '#b91c1c']));
      if (!info.comissoes.length) linhas.push(['Comissões', brl(0), '#0f172a']);
      const extra = info.negativoNovo ? 54 : 0;
      const alto = 28 + linhas.length * 54 + 92 + extra;
      caixa(M, y, W - 2 * M, alto, 18, '#f8fafc', '#e2e8f0');
      let yy = y + 28;
      linhas.forEach(([rot, val, cor]) => {
        txt(rot, IN, yy + 34, { tam: 27, cor: '#334155', max: 620 });
        txt(val, FIM, yy + 34, { tam: 28, peso: 600, cor, alinhar: 'right' });
        yy += 54;
      });
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(IN, yy + 8, FIM - IN, 2);
      txt('Líquido da prestação', IN, yy + 64, { tam: 31, peso: 800 });
      txt(brl(info.liquido), FIM, yy + 66, { tam: 36, peso: 800, cor: info.liquido < 0 ? '#b91c1c' : '#166534', alinhar: 'right' });
      yy += 92;
      if (info.negativoNovo) txt(`Negativo para a próxima prestação: ${brl(info.negativoNovo)}`, IN, yy + 30, { tam: 24, peso: 600, cor: '#b45309', max: FIM - IN });
      y += alto + 32;

      // Pagamentos
      if (info.pagamentos.length) {
        txt('PAGAMENTOS', M, y + 22, { tam: 21, peso: 700, cor: '#475569' });
        y += 36;
        info.pagamentos.forEach(pg => {
          txt(`${dataBR(pg.data)} · ${pg.texto}`, M, y + 34, { tam: 26, cor: '#334155', max: 700 });
          txt(brl(pg.valor), W - M, y + 34, { tam: 27, peso: 700, alinhar: 'right' });
          y += 52;
          linha(y);
        });
        y += 28;
      }

      // Faixa final
      const r = info.restam;
      const [rotulo, cor] = r > 0 ? ['RESTA ACERTAR', '#13294b'] : r < 0 ? ['EMPRESA DEVE AO GERENTE', '#b45309'] : ['QUITADO', '#166534'];
      caixa(M, y, W - 2 * M, 112, 20, cor);
      txt(rotulo, IN + 8, y + 70, { tam: 32, peso: 800, cor: '#ffffff', max: 560 });
      txt(brl(Math.abs(r)), FIM - 8, y + 72, { tam: 44, peso: 800, cor: '#ffffff', alinhar: 'right', max: 380 });
      y += 112 + 44;
      txt(`Gerado em ${dataHoraBR()}`, W / 2, y, { tam: 20, cor: '#94a3b8', alinhar: 'center' });
      return y + 32;
    };
    const medida = document.createElement('canvas');
    medida.width = W;
    medida.height = 10;
    const altura = Math.ceil(pintar(medida.getContext('2d')));
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = altura;
    pintar(canvas.getContext('2d'));
    return canvas;
  }

  async function abrirImagem(uid) {
    const p = st.prestacoes.find(x => x.uid === uid);
    if (!p) { aviso('Prestação não encontrada. Atualize a página.', 'error'); return; }
    try {
      const info = infoImagem(p);
      const blob = await new Promise(res => desenharImagem(info).toBlob(res, 'image/png'));
      if (!blob) throw new Error('imagem vazia');
      limparImagem();
      st.imagem = {
        blob, nome: `prestacao-${slug(info.titulo)}-${String(p.data).slice(0, 10)}.png`,
        titulo: `Prestação ${info.titulo} ${dataBR(p.data)}`, url: URL.createObjectURL(blob)
      };
    } catch (err) {
      console.error('[VideoGame] imagem:', err);
      aviso('Não foi possível gerar a imagem.', 'error');
      return;
    }
    let compartilha = false;
    try { compartilha = !!navigator.canShare?.({ files: [arquivoImagem()] }); } catch (_) {}
    document.getElementById('vgImgPrev').src = st.imagem.url;
    document.getElementById('vgImgCompartilhar').hidden = !compartilha;
    document.getElementById('vgImgCopiar').hidden = !(navigator.clipboard?.write && window.ClipboardItem);
    document.getElementById('vgImgInfo').textContent = compartilha
      ? 'Toque em Compartilhar e escolha o grupo do gerente no WhatsApp.'
      : 'Baixe ou copie a imagem e envie no grupo do gerente.';
    const dlg = document.getElementById('dlgVgImagem');
    if (!dlg.open) dlg.showModal();
  }
  const arquivoImagem = () => new File([st.imagem.blob], st.imagem.nome, { type: 'image/png' });
  function limparImagem() {
    if (st.imagem?.url) URL.revokeObjectURL(st.imagem.url);
    if (st.imagem) st.imagem.url = null;
  }
  function baixarImagem() {
    if (!st.imagem) return;
    const url = URL.createObjectURL(st.imagem.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = st.imagem.nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  async function copiarImagem() {
    if (!st.imagem) return;
    try {
      await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': st.imagem.blob })]);
      aviso('Imagem copiada. Cole no grupo do gerente.', 'success');
    } catch (_) { aviso('Não foi possível copiar. Use Baixar.', 'error'); }
  }
  async function compartilharImagem() {
    if (!st.imagem) return;
    try {
      await navigator.share({ files: [arquivoImagem()], title: st.imagem.titulo });
    } catch (err) {
      if (err?.name !== 'AbortError') aviso('Não foi possível compartilhar. Use Baixar.', 'error');
    }
  }

  // ---------- eventos ----------
  function ligarEventos() {
    const root = document.getElementById('vgRoot');
    root.addEventListener('input', e => {
      const campo = e.target.getAttribute('data-leitura');
      if (!campo) return;
      const l = st.form.linhas.find(x => x.maquina_id === e.target.getAttribute('data-id'));
      if (!l) return;
      l[campo] = mascarar(e.target);
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
      if (btn) executar(btn.getAttribute('data-vg'), btn.getAttribute('data-id'));
    });
  }
  function ligarEventosCadastro() {
    const root = document.getElementById('vgCadRoot');
    root.addEventListener('change', e => {
      if (e.target.id === 'vgCadPonto') selecionarGerente(e.target.value);
    });
    root.addEventListener('click', e => {
      const btn = e.target.closest('[data-vg]');
      if (btn) executar(btn.getAttribute('data-vg'), btn.getAttribute('data-id'));
    });
  }
  function executar(acao, id) {
    const acoes = {
      'ger-novo': () => abrirDialogoPonto(null),
      'ger-editar': () => abrirDialogoPonto(pontoAtual()),
      'ger-abrir': () => selecionarGerente(id),
      'maquina-nova': () => abrirDialogoMaquina(null),
      'maquina-editar': () => abrirDialogoMaquina(id),
      'maquina-remover': () => removerMaquina(id),
      'maquina-trocar-ponto': () => abrirDialogoTroca(id, 'ponto'),
      'maquina-trocar-jogo': () => abrirDialogoTroca(id, 'jogo'),
      'pagamento-novo': () => abrirDialogoPagamento(null),
      'pagamento-editar': () => abrirDialogoPagamento(id),
      'pagamento-excluir': () => excluirPagamento(id),
      'salvar': salvarPrestacao,
      'form-novo': () => { st.tentouSalvar = false; novoFormulario(); render(); },
      'prest-abrir': () => abrirPrestacao(id),
      'prest-excluir': () => excluirPrestacao(id),
      'prest-imagem': () => abrirImagem(id)
    };
    acoes[acao]?.();
  }

  function erroAoCarregar(err) {
    console.error('[VideoGame] carregar:', err);
    st.pontos = [];
    st.pontoId = null;
    st.maquinas = [];
    st.prestacoes = [];
    st.erroSetup = /vg_|schema cache|does not exist/i.test(String(err.message || ''))
      ? 'As tabelas do video game ainda não existem. Rode o arquivo db/video-game-schema.sql no Supabase.'
      : 'Não foi possível carregar o video game: ' + (err.message || err);
  }
  async function recarregar() {
    st.erroSetup = '';
    try {
      await carregarPontos();
      await carregarDoPonto();
    } catch (err) { erroAoCarregar(err); }
    novoFormulario();
    render();
  }
  async function recarregarCadastro() {
    st.erroSetup = '';
    try {
      await carregarPontos();
      await carregarDoPonto();
      await carregarContagem();
    } catch (err) { erroAoCarregar(err); }
    novoFormulario();
    renderCadastro();
  }
  // Depois de salvar no cadastro, atualiza a tela que estiver aberta
  async function recarregarTudo() {
    if (visivel('pageVgCadastro')) await recarregarCadastro();
    if (visivel('pageVideoGame')) await recarregar();
  }
  async function aposMudarMaquinas() {
    await carregarDoPonto();
    try { await carregarContagem(); } catch (_) {}
    novoFormulario();
    if (visivel('pageVideoGame')) render();
    renderCadastro();
  }
  async function selecionarGerente(id) {
    st.pontoId = id || null;
    try { await carregarDoPonto(); } catch (err) { aviso('Não foi possível carregar: ' + (err.message || err), 'error'); }
    novoFormulario();
    renderCadastro();
    document.getElementById('vgCadRoot')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  async function initCadastro() {
    if (!document.getElementById('vgCadRoot')) return;
    garantirEstilos();
    garantirDialogos();
    if (!st.cadPronto) {
      st.cadPronto = true;
      ligarEventosCadastro();
    }
    await recarregarCadastro();
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
      const rotulo = rotuloDe(r.gerente_nome, pontoNome);
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
    if (st.cadPronto && visivel('pageVgCadastro')) recarregarCadastro();
  });

  window.VideoGame = { init, initCadastro, render, calcular, totalPago, garantirPendencias };
})();
