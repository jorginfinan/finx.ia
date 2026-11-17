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
    cadPronto: false, contagem: {}, listaGerentes: [], imagem: null, salvandoCad: false,
    todas: [], erroMapa: '', periodo: '3m', formAberto: false, etapa: 1,
    maqTodas: [], atualizadoEm: '', decAnt: {}, abertos: new Set(), filtro: 'todos', popMaq: null, pgHist: []
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
  // Leituras antigas do caderno: só leitura (sem comissão, sem pagamento e sem caixa)
  const ehHistorico = p => p?.dados?.historico === true;
  const dia = s => String(s || '').slice(0, 10);
  const pad2 = n => String(n).padStart(2, '0');
  const isoDe = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

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
  // Despesas saem do resultado ANTES das comissões (como no JB: coletas − despesas).
  // Negativo acumulado só reduz a BASE das comissões; o líquido é sempre resultado − comissões.
  function calcular({ leituras, negativoAnterior, comissoes, base, despesas }) {
    const linhas = (leituras || []).map(l => {
      const venda = l.di - (l.zerado ? 0 : l.di_anterior);
      const premios = l.ds - (l.zerado ? 0 : l.ds_anterior);
      return { ...l, venda, premios, saldo: venda - premios };
    });
    const saldo = linhas.reduce((a, l) => a + l.saldo, 0);
    const totalDespesas = Math.max(0, Math.round(Number(despesas) || 0));
    const resultado = saldo - totalDespesas;
    const negAnt = Math.max(0, Number(negativoAnterior) || 0);
    const baseValor = resultado - negAnt;
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
      linhas, saldo, totalDespesas, resultado, negativoAnterior: negAnt, baseComissao: Math.max(baseValor, 0), comissoes: valores,
      totalComissoes, negativoNovo: baseValor < 0 ? -baseValor : 0, liquido: resultado - totalComissoes
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
    const { data, error } = await client().from('vg_maquinas').select('*').eq('empresa_id', id).order('created_at');
    if (error) throw error;
    st.maqTodas = data || [];
    st.contagem = {};
    st.maqTodas.filter(m => m.ativo).forEach(m => { st.contagem[m.ponto_id] = (st.contagem[m.ponto_id] || 0) + 1; });
  }
  // Todas as prestações da empresa (para o mapa de prestações)
  async function carregarMapa() {
    const id = await empresaId();
    const { data, error } = await client().from('vg_prestacoes')
      .select('uid, ponto_id, data, saldo, total_comissoes, liquido, dados')
      .eq('empresa_id', id).order('data', { ascending: false });
    if (error) throw error;
    st.todas = data || [];
    await carregarContagem();
    const agora = new Date();
    st.atualizadoEm = `${pad2(agora.getHours())}:${pad2(agora.getMinutes())}`;
  }
  async function atualizarMapa() {
    st.erroMapa = '';
    try { await carregarMapa(); } catch (err) {
      console.error('[VideoGame] mapa:', err);
      st.todas = [];
      st.erroMapa = 'Não foi possível carregar o mapa: ' + (err.message || err);
    }
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
    const ant = anteriores(uidExcluida).find(p => !ehHistorico(p));
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
      modo: 'nova', uid: null, data: hoje(), pagamentos: [], despesas: [],
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
    if (ehHistorico(p)) { aviso('Leitura do caderno: confira no mapa. Para alterar, use Histórico no Cadastro video game.'); return; }
    // Qualquer prestação abre para editar (como no JB). Nas anteriores à última, leituras e data
    // ficam travadas porque a prestação seguinte parte delas; pagamentos e despesas podem mudar.
    const ultima = st.prestacoes[0]?.uid === uid;
    const modo = podeEditar() ? 'editar' : 'ver';
    const trava = modo === 'editar' && !ultima;
    const recalc = modo === 'editar' && !trava;
    const salvas = p.dados?.leituras || [];
    const linhas = salvas.map(l => {
      const maq = st.maquinas.find(m => m.id === l.maquina_id);
      const a = recalc && maq ? leituraAnterior(maq, uid) : { di: l.di_anterior, ds: l.ds_anterior };
      return { maquina_id: l.maquina_id, nome: l.nome, jogo: l.jogo || maq?.jogo || '', local: l.local ?? maq?.local ?? '', di_anterior: a.di, ds_anterior: a.ds, diTxt: String(l.di), dsTxt: String(l.ds), zerado: !!l.zerado };
    });
    if (recalc) {
      st.maquinas.filter(m => m.ativo && !salvas.some(l => l.maquina_id === m.id)).forEach(m => {
        const a = leituraAnterior(m, uid);
        linhas.push({ maquina_id: m.id, nome: m.nome, jogo: m.jogo || '', local: m.local || '', di_anterior: a.di, ds_anterior: a.ds, diTxt: '', dsTxt: '', zerado: false });
      });
    }
    st.form = {
      modo, trava, uid, data: String(p.data).slice(0, 10), linhas,
      pagamentos: JSON.parse(JSON.stringify(p.dados?.pagamentos || [])),
      despesas: (p.dados?.despesas || []).map(d => ({ id: novoId(), descricao: d.descricao || '', valorTxt: String(Number(d.valor) || '') })),
      comissoes: Array.isArray(p.dados?.comissoes) ? p.dados.comissoes.map(c => ({ nome: c.nome, pct: c.pct })) : comissoesDoPonto(pontoAtual()),
      base: p.dados?.base || 'saldo',
      negativoAnterior: recalc ? negativoAnterior(uid) : Number(p.negativo_anterior) || 0
    };
    st.tentouSalvar = false;
    st.formAberto = true;
    st.etapa = modo === 'ver' ? 5 : 4;
    render();
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
  // Despesas da prestação (valor em centavos); linhas vazias são ignoradas
  function avaliarDespesas() {
    const lista = [];
    let erro = '';
    (st.form?.despesas || []).forEach((d, i) => {
      const descricao = String(d.descricao || '').trim();
      const valor = leituraInt(d.valorTxt) || 0;
      if (!descricao && !valor) return;
      if (!descricao) { erro = erro || `Despesa ${i + 1}: informe a descrição.`; return; }
      if (!valor) { erro = erro || `Despesa ${i + 1} (${descricao}): informe o valor.`; return; }
      lista.push({ descricao, valor });
    });
    return { lista, total: lista.reduce((a, d) => a + d.valor, 0), erro };
  }

  // ---------- tela ----------
  function garantirEstilos() {
    if (document.getElementById('vg-styles')) return;
    const css = document.createElement('style');
    css.id = 'vg-styles';
    css.textContent = `
      /* ===== VIDEO GAME · painel de operação (tema escuro) ===== */
      .vg-tech,dialog.vg-dlg{--vt-bg:#090d16;--vt-bg2:#0d1320;--vt-painel:#111a2b;--vt-painel2:#0f1726;--vt-borda:#1e2a40;--vt-borda2:#2a3a57;
        --vt-txt:#e6edf7;--vt-dim:#8a9bb5;--vt-fraco:#5b6b85;--vt-ciano:#22d3ee;--vt-violeta:#a78bfa;--vt-verde:#34d399;--vt-verm:#f87171;--vt-ambar:#fbbf24;
        --vt-mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
        --card-bg:#111a2b;--page-bg:#0d1320;--line:#1e2a40;--line-2:#2a3a57;--text:#e6edf7;--text-dim:#8a9bb5;--text-muted:#5b6b85;
        --navy:#16213a;--navy-2:#1e2c4a;--navy-3:#2a3a57;--brand:#22d3ee;--brand-2:#67e8f9;--brand-dim:rgba(34,211,238,.15);color:var(--vt-txt)}
      #content:has(> #pageVideoGame:not(.hidden)),#content:has(> #pageVgCadastro:not(.hidden)){background-color:#090d16 !important;
        background-image:linear-gradient(rgba(34,211,238,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,.035) 1px,transparent 1px) !important;background-size:32px 32px !important}
      .vg-tech h2,.vg-tech h3,.vg-tech h4{color:var(--vt-txt)}
      .vg-tech input:not([type=checkbox]):not([type=radio]),.vg-tech select,.vg-tech textarea,
      dialog.vg-dlg input:not([type=checkbox]):not([type=radio]),dialog.vg-dlg select,dialog.vg-dlg textarea{background:var(--vt-bg2) !important;color:var(--vt-txt) !important;border:1px solid var(--vt-borda2) !important;border-radius:9px !important;color-scheme:dark}
      .vg-tech input:focus,.vg-tech select:focus,.vg-tech textarea:focus,dialog.vg-dlg input:focus,dialog.vg-dlg select:focus,dialog.vg-dlg textarea:focus{border-color:var(--vt-ciano) !important;box-shadow:0 0 0 3px rgba(34,211,238,.15) !important;outline:none !important}
      .vg-tech input:disabled,.vg-tech select:disabled{opacity:.6}
      .vg-tech input[type=checkbox],dialog.vg-dlg input[type=checkbox]{accent-color:#22d3ee}
      .vg-tech table,dialog.vg-dlg table{background:transparent !important}
      .vg-tech thead th,dialog.vg-dlg thead th{background:var(--vt-painel2) !important;color:var(--vt-fraco) !important;border-bottom:1px solid var(--vt-borda) !important;font-weight:600 !important;letter-spacing:.7px !important}
      .vg-tech tbody td,dialog.vg-dlg tbody td{background:transparent !important;border-bottom:1px solid rgba(30,42,64,.8) !important;color:var(--vt-txt) !important}
      .vg-tech tbody tr:nth-child(even) td,dialog.vg-dlg tbody tr:nth-child(even) td{background:rgba(15,23,38,.55) !important}
      .vg-tech tbody tr:hover td,dialog.vg-dlg tbody tr:hover td{background:rgba(34,211,238,.05) !important}
      .vg-tech tfoot td,dialog.vg-dlg tfoot td{background:var(--vt-painel2) !important;color:var(--vt-txt) !important;border-top:1px solid var(--vt-borda2) !important}
      .vg-tech .btn.primary,dialog.vg-dlg .btn.primary{background:linear-gradient(135deg,#22d3ee,#60a5fa) !important;color:#06111f !important}
      dialog.vg-dlg{background:var(--vt-painel);color:var(--vt-txt);border:1px solid var(--vt-borda2) !important}
      dialog.vg-dlg::backdrop{background:rgba(5,8,15,.72)}
      dialog.vg-dlg .card{background:var(--vt-painel) !important;border-color:var(--vt-borda) !important;box-shadow:none !important;color:var(--vt-txt)}
      dialog.vg-dlg .form-grid label{color:var(--vt-dim) !important}

      /* elementos comuns (cadastro, diálogos e formulário) */
      .vg-barra{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px}
      .vg-barra label{display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;color:var(--vt-fraco);min-width:240px}
      .vg-card{background:var(--vt-painel);border:1px solid var(--vt-borda);border-radius:14px;padding:16px;margin-bottom:14px}
      .vg-topo{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-bottom:12px}
      .vg-titulo{font-size:16px;font-weight:700;color:var(--vt-txt)}
      .vg-sub{font-size:12px;color:var(--vt-dim)}
      .vg-maq{background:var(--vt-painel2);border:1px solid var(--vt-borda);border-radius:12px;padding:12px;margin-bottom:10px}
      .vg-maq-topo{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;font-weight:600;font-size:14px}
      .vg-maq-topo .vg-ico{width:16px;height:16px;color:var(--vt-ciano);vertical-align:-3px;margin-right:6px}
      .vg-num{text-align:right;font-variant-numeric:tabular-nums;font-family:var(--vt-mono)}
      .vg-erro{color:var(--vt-verm);font-size:12px;margin-top:6px}
      .vg-erro:empty{display:none}
      .vg-zerado{display:flex;gap:6px;align-items:center;font-size:12px;margin-top:8px;color:var(--vt-ambar)}
      .vg-maq-btns{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
      .vg-aviso{background:rgba(251,191,36,.08);border-left:3px solid var(--vt-ambar);border-radius:0;padding:8px 10px;font-size:13px;color:#fcd34d;margin:0 0 10px}
      .vg-com-linha{display:grid;grid-template-columns:minmax(0,1fr) 90px auto;gap:8px;align-items:center;margin-bottom:8px}
      .vg-com-linha input{width:100%;min-width:0;box-sizing:border-box}
      .vg-desp-linha{display:grid;grid-template-columns:minmax(0,1fr) 140px auto;gap:8px;align-items:center;margin-bottom:8px}
      .vg-desp-linha input{width:100%;min-width:0;box-sizing:border-box;padding:8px 10px}
      .vg-desp-linha input[data-desp="valorTxt"]{text-align:right;font-family:var(--vt-mono)}
      .vg-coms{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:8px 0 12px}
      .vg-com{background:var(--vt-painel2);border:1px solid var(--vt-borda);border-radius:10px;padding:8px 10px}
      .vg-com div:last-child{font-family:var(--vt-mono)}
      .vg-linha{display:flex;justify-content:space-between;gap:12px;padding:5px 0;font-size:13.5px;color:var(--vt-txt)}
      .vg-linha .vg-num{white-space:nowrap}
      .vg-total{border-top:1px solid var(--vt-borda);margin-top:4px;padding-top:9px;font-weight:700;font-size:15px}
      .vg-acoes{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px}
      .vg-tabela{overflow-x:auto}
      .vg-chip{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:600;background:#1a2438;color:#c7d2e3}
      .vg-chip.ok{background:rgba(52,211,153,.14);color:var(--vt-verde)}
      .vg-chip.esp{background:rgba(251,191,36,.14);color:var(--vt-ambar)}
      .vg-vazio{text-align:center;color:var(--vt-dim);padding:28px 12px}
      .vg-setup{background:rgba(248,113,113,.08);border:1px solid rgba(248,113,113,.35);color:#fca5a5;border-radius:10px;padding:12px;font-size:14px;margin-bottom:14px}
      #vgRoot [hidden],#vgCadRoot [hidden],dialog.vg-dlg [hidden],#vgPop [hidden]{display:none !important}
      dialog.vg-dlg{border-radius:14px;padding:0;width:min(560px,94vw)}
      dialog.vg-dlg form{margin:0;padding-top:16px !important}
      .vg-det{display:flex;flex-wrap:wrap;gap:4px 18px;font-size:13px;color:var(--vt-dim)}
      .vg-det b{font-weight:600;color:var(--vt-txt)}
      .vg-coms-cad{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
      details.vg-ret{margin-top:10px}
      details.vg-ret summary{cursor:pointer;font-size:13px;font-weight:600;color:var(--vt-dim);padding:4px 0}
      .vg-ret-item{font-size:13px;color:var(--vt-dim);padding:6px 0;border-top:1px solid var(--vt-borda)}
      .vg-ret-item .vg-ico{width:14px;height:14px;vertical-align:-2px;color:var(--vt-fraco)}
      dialog#dlgVgImagem{width:min(640px,96vw)}
      .vg-img-prev{display:block;width:100%;max-height:68vh;object-fit:contain;border:1px solid var(--vt-borda);border-radius:8px;background:var(--vt-bg2)}
      .vg-resumo{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:2px 0 14px}
      .vg-kpi{background:var(--vt-painel2);border:1px solid var(--vt-borda);border-radius:10px;padding:10px 12px}
      .vg-kpi .vg-v{font:700 17px var(--vt-mono);color:var(--vt-txt);margin-top:2px}
      .vg-neg{color:var(--vt-verm)}
      dialog#dlgVgHist{width:min(800px,96vw)}
      table.vg-hist-tab{width:100%;border-collapse:collapse;font-size:13px}
      table.vg-hist-tab th{white-space:nowrap;padding:8px 6px !important}
      table.vg-hist-tab td{padding:4px !important;vertical-align:middle;font-family:var(--vt-mono)}
      table.vg-hist-tab input{width:100%;min-width:0;box-sizing:border-box;padding:5px 6px}
      table.vg-hist-tab input[type=date]{min-width:128px}
      table.vg-hist-tab tr.vg-hist-erro td{background:rgba(248,113,113,.12) !important}
      #vgHistColar{width:100%;box-sizing:border-box;font-family:var(--vt-mono);font-size:13px;margin:6px 0}
      .vg-ico{width:15px;height:15px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}

      /* ===== topo da página ===== */
      .vt-num{font-family:var(--vt-mono);font-variant-numeric:tabular-nums;letter-spacing:-.2px}
      .vt-topo{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px}
      .vt-marca{display:flex;align-items:center;gap:10px;min-width:0}
      .vt-logo{width:36px;height:36px;flex:none;border-radius:10px;display:grid;place-items:center;color:var(--vt-ciano);background:linear-gradient(135deg,rgba(34,211,238,.22),rgba(167,139,250,.22));border:1px solid var(--vt-borda2)}
      .vt-logo .vg-ico{width:20px;height:20px}
      .vt-marca h2{margin:0;font-size:20px}
      .vt-sub{font-size:12px;color:var(--vt-dim)}
      .vt-vivo{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--vt-verde);border:1px solid rgba(52,211,153,.3);background:rgba(52,211,153,.08);padding:3px 9px;border-radius:999px}
      .vt-vivo i{width:6px;height:6px;border-radius:50%;background:var(--vt-verde);animation:vtPulso 1.8s infinite}
      @keyframes vtPulso{0%{box-shadow:0 0 0 0 rgba(52,211,153,.6)}100%{box-shadow:0 0 0 8px rgba(52,211,153,0)}}
      .vt-esp{flex:1}
      .vt-seg{display:flex;background:var(--vt-painel2);border:1px solid var(--vt-borda);border-radius:10px;padding:3px;flex-wrap:wrap}
      .vt-seg button{border:0;background:transparent;color:var(--vt-dim);font:600 12.5px Inter,sans-serif;padding:7px 11px;border-radius:7px;cursor:pointer}
      .vt-seg button.on{background:var(--vt-painel);color:var(--vt-txt);box-shadow:inset 0 0 0 1px var(--vt-borda2)}
      .vt-btp{border:0;border-radius:10px;padding:10px 16px;font:700 13.5px Inter,sans-serif;cursor:pointer;color:#06111f;background:linear-gradient(135deg,#22d3ee,#60a5fa);box-shadow:0 0 0 1px rgba(34,211,238,.4),0 8px 24px -8px rgba(34,211,238,.6)}
      .vt-bts{border:1px solid var(--vt-borda2);border-radius:10px;padding:8px 12px;font:600 12.5px Inter,sans-serif;cursor:pointer;color:var(--vt-txt);background:var(--vt-painel2);white-space:nowrap}
      .vt-bts:hover{border-color:var(--vt-ciano)}
      .vt-bts.mini{padding:5px 9px;font-size:12px}
      .vt-bts.perigo{color:var(--vt-verm);border-color:rgba(248,113,113,.4)}

      /* ===== indicadores ===== */
      .vt-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:16px}
      .vt-kpi{background:linear-gradient(180deg,var(--vt-painel),var(--vt-painel2));border:1px solid var(--vt-borda);border-radius:14px;padding:12px 14px;position:relative;overflow:hidden}
      .vt-kpi::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--cor,var(--vt-ciano))}
      .vt-kpi .rt{font-size:11px;letter-spacing:.8px;text-transform:uppercase;color:var(--vt-dim)}
      .vt-kpi .vl{font:700 21px/1.25 var(--vt-mono);margin-top:6px;color:var(--cor,var(--vt-txt));white-space:nowrap}
      .vt-kpi .rod{font-size:11.5px;color:var(--vt-fraco);margin-top:4px}
      .vt-barra{height:4px;border-radius:2px;background:var(--vt-borda);margin-top:8px;overflow:hidden}
      .vt-barra i{display:block;height:100%;background:var(--cor,var(--vt-ciano));transition:width 1s cubic-bezier(.2,.8,.2,1)}

      /* ===== gerentes ===== */
      .vt-filtros{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
      .vt-filtros button{border:1px solid var(--vt-borda);background:var(--vt-painel2);color:var(--vt-dim);border-radius:8px;padding:6px 10px;font:600 12px Inter,sans-serif;cursor:pointer}
      .vt-filtros button.on{color:var(--vt-txt);border-color:var(--vt-borda2);background:var(--vt-painel)}
      .vt-ger{background:var(--vt-painel);border:1px solid var(--vt-borda);border-radius:14px;margin-bottom:10px;overflow:hidden}
      .vt-ger.aberto{border-color:var(--vt-borda2)}
      .vt-ger-lin{display:grid;grid-template-columns:minmax(0,2.1fr) 150px minmax(0,1fr) minmax(0,1.1fr) auto;gap:16px;align-items:center;padding:14px 16px}
      .vt-id{display:flex;align-items:center;gap:12px;min-width:0}
      .vt-av{width:40px;height:40px;flex:none;border-radius:11px;display:grid;place-items:center;font:700 13px var(--vt-mono);color:var(--vt-ciano);background:rgba(34,211,238,.08);border:1px solid rgba(34,211,238,.25)}
      .vt-nm{font-weight:700;font-size:15px;letter-spacing:.3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .vt-maqs{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}
      .vt-qtd{display:inline-flex;align-items:center;gap:5px;font:700 11.5px var(--vt-mono);color:var(--vt-ciano);border:1px solid rgba(34,211,238,.35);background:rgba(34,211,238,.08);border-radius:6px;padding:2px 8px}
      .vt-maq{display:inline-flex;align-items:center;gap:5px;font:500 11px var(--vt-mono);color:var(--vt-dim);border:1px solid var(--vt-borda);border-radius:6px;padding:2px 7px;background:var(--vt-painel2);cursor:pointer;transition:border-color .15s,color .15s,background .15s}
      .vt-maq .vg-ico{width:13px;height:13px;color:var(--vt-verde)}
      .vt-maq.amb .vg-ico{color:var(--vt-ambar)}
      .vt-maq:hover{border-color:var(--vt-ciano);color:var(--vt-txt)}
      .vt-maq[aria-expanded="true"]{border-color:var(--vt-ciano);background:rgba(34,211,238,.1);color:var(--vt-txt)}
      .vt-cel .vt-rt{font-size:10.5px;letter-spacing:.7px;text-transform:uppercase;color:var(--vt-fraco)}
      .vt-cel .vt-vl{font:600 14px var(--vt-mono);margin-top:3px}
      .vt-det{font-size:11.5px;color:var(--vt-dim);margin-top:2px}
      .vt-ok{color:var(--vt-verde)}.vt-esp2{color:var(--vt-ambar)}.vt-atr{color:var(--vt-verm)}
      .vg-spark{width:150px;height:40px;display:block}
      .vg-spark path.l{fill:none;stroke:var(--vt-ciano);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:600;stroke-dashoffset:600;animation:vtTraco 1.2s ease-out forwards}
      .vg-spark path.a{fill:rgba(34,211,238,.12);stroke:none}
      .vg-spark circle{fill:var(--vt-ciano)}
      .vg-spark circle.cad{fill:var(--vt-fraco)}
      @keyframes vtTraco{to{stroke-dashoffset:0}}
      .vt-sit{font:700 11.5px var(--vt-mono);padding:4px 9px;border-radius:7px;white-space:nowrap;display:inline-block}
      .vt-sit.deve{color:var(--vt-verm);background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.3)}
      .vt-sit.cred{color:var(--vt-ambar);background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.3)}
      .vt-sit.ok{color:var(--vt-verde);background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.3)}
      .vt-sit.sem{color:var(--vt-dim);background:var(--vt-painel2);border:1px solid var(--vt-borda)}
      .vt-acoes{display:flex;gap:8px;justify-content:flex-end}

      /* ===== histórico do gerente ===== */
      .vt-hist{border-top:1px solid var(--vt-borda);padding:14px 16px 16px;background:var(--vt-bg2)}
      .vt-hk-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-bottom:6px}
      .vt-hk{border:1px solid var(--vt-borda);border-radius:10px;padding:8px 10px;background:var(--vt-painel2)}
      .vt-hk .rt{font-size:10px;letter-spacing:.7px;text-transform:uppercase;color:var(--vt-fraco)}
      .vt-hk .vl{font:600 14px var(--vt-mono);margin-top:3px;white-space:nowrap}
      .vt-sec{margin:16px 0 8px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--vt-dim);font-weight:700}
      table.vt-tab{width:100%;border-collapse:separate;border-spacing:0;table-layout:auto;font-size:13px}
      table.vt-tab th{font-size:10.5px !important;text-transform:uppercase;text-align:right;padding:8px 10px !important}
      table.vt-tab td{padding:10px 8px !important;text-align:right;white-space:nowrap;font-family:var(--vt-mono);font-size:12.5px;vertical-align:top}
      table.vt-tab th{padding:8px 8px !important}
      table.vt-tab td.vt-ac .vt-bts{padding:4px 8px;font-size:11.5px}
      table.vt-tab th:first-child,table.vt-tab td:first-child{text-align:left}
      table.vt-tab td.vt-ac{text-align:right;overflow:visible}
      .vt-abre{border:1px solid var(--vt-borda2);background:transparent;color:var(--vt-dim);width:22px;height:22px;border-radius:6px;cursor:pointer;margin-right:6px;line-height:1;padding:0}
      .vt-pd{display:block;font:500 10.5px Inter,sans-serif;color:var(--vt-fraco);margin:2px 0 0 28px}
      table.vt-tab tr.vt-det-lin td{white-space:normal;background:rgba(15,23,38,.6) !important}
      .vt-chips{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}
      .vt-chip{border:1px solid var(--vt-borda);border-radius:10px;padding:8px 10px;background:var(--vt-painel2);font-family:Inter,sans-serif;text-align:left}
      .vt-chip .t{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:var(--vt-dim)}
      .vt-chip .t b{color:var(--vt-txt);font-family:var(--vt-mono)}
      .vt-hold{height:4px;border-radius:2px;background:var(--vt-borda);margin-top:6px;overflow:hidden}
      .vt-hold i{display:block;height:100%;background:linear-gradient(90deg,var(--vt-violeta),var(--vt-ciano))}
      .vt-neg{color:var(--vt-verm)}.vt-pos{color:var(--vt-verde)}.vt-ciano{color:var(--vt-ciano)}.vt-violeta{color:var(--vt-violeta)}
      .vt-duas{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .vt-lista{border:1px solid var(--vt-borda);border-radius:10px;overflow:hidden}
      .vt-lista div{display:flex;justify-content:space-between;gap:10px;padding:8px 12px;border-top:1px solid var(--vt-borda);font-size:12.5px}
      .vt-lista div:first-child{border-top:0}
      .vt-lista .vz{color:var(--vt-fraco);justify-content:center}
      .vt-tag{font:600 10.5px Inter,sans-serif;padding:2px 7px;border-radius:999px;white-space:nowrap}
      .vt-tag.cx{color:var(--vt-verde);background:rgba(52,211,153,.12)}.vt-tag.ag{color:var(--vt-ambar);background:rgba(251,191,36,.12)}
      details.vt-cad{margin-top:12px;font-size:12.5px;color:var(--vt-dim)}
      details.vt-cad summary{cursor:pointer}

      /* ===== quadro do jogo ===== */
      #vgPop{position:absolute;z-index:1900;width:330px;background:#111a2b;color:#e6edf7;border:1px solid #2a3a57;border-radius:14px;padding:14px;box-shadow:0 18px 50px -10px rgba(0,0,0,.75),0 0 0 1px rgba(34,211,238,.08);animation:vtEntra .18s ease-out;font-family:Inter,system-ui,sans-serif}
      #vgPop.folha{position:fixed;left:8px !important;right:8px;bottom:8px;top:auto !important;width:auto;max-height:80vh;overflow:auto}
      #vgPopFundo{position:fixed;inset:0;z-index:1899;background:rgba(5,8,15,.7)}
      @keyframes vtEntra{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
      .vp-cab{display:flex;gap:10px;align-items:center;margin-bottom:10px}
      .vp-ico{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;color:#22d3ee;background:rgba(34,211,238,.08);border:1px solid rgba(34,211,238,.25)}
      .vp-ico .vg-ico{width:22px;height:22px}
      .vp-t{font-weight:700;font-size:14px}
      .vp-s{font-size:11.5px;color:#8a9bb5}
      .vp-x{margin-left:auto;border:1px solid #2a3a57;background:transparent;color:#8a9bb5;border-radius:8px;width:28px;height:28px;cursor:pointer}
      .vp-per{font-size:12px;color:#8a9bb5;border:1px solid #1e2a40;border-radius:9px;padding:7px 9px;background:#0d1320;margin-bottom:10px}
      .vp-per b{font-family:"JetBrains Mono",ui-monospace,Menlo,monospace;color:#e6edf7}
      .vp-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}
      .vp-grid div{border:1px solid #1e2a40;border-radius:8px;padding:6px 8px;background:#0d1320}
      .vp-grid span{display:block;font-size:9.5px;letter-spacing:.7px;text-transform:uppercase;color:#5b6b85}
      .vp-grid b{font:700 13px "JetBrains Mono",ui-monospace,Menlo,monospace}
      .vp-lucro{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
      .vp-lucro .rt{font-size:10.5px;letter-spacing:.7px;text-transform:uppercase;color:#5b6b85;width:100%}
      .vp-lucro .vl{font:800 24px "JetBrains Mono",ui-monospace,Menlo,monospace}
      .vp-lucro .hd{font:600 12px "JetBrains Mono",ui-monospace,Menlo,monospace;color:#a78bfa}
      #vgPop .vg-spark{width:100%;height:46px;margin-top:8px}
      #vgPop .vg-spark path.l{stroke:#22d3ee}
      #vgPop .vg-spark circle{fill:#22d3ee}
      .vp-rod{display:flex;justify-content:space-between;font-size:11px;color:#5b6b85;margin-top:2px}
      .vp-pos{color:#34d399}.vp-neg{color:#f87171}

      /* ===== formulário (nova prestação) ===== */
      .vt-ov{position:fixed;inset:0;z-index:2000;background:rgba(5,8,15,.72);display:flex;justify-content:center;align-items:stretch}
      .vt-ov-pg{background:#090d16;background-image:linear-gradient(rgba(34,211,238,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,.03) 1px,transparent 1px);background-size:32px 32px;
        width:min(1180px,100%);height:100%;display:flex;flex-direction:column;border-left:1px solid var(--vt-borda);border-right:1px solid var(--vt-borda)}
      .vt-ov-topo{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 18px;border-bottom:1px solid var(--vt-borda);background:rgba(13,19,32,.9)}
      .vt-ov-t{font-weight:700;font-size:16px}
      .vt-ov-corpo{flex:1;overflow:auto;padding:16px 18px 24px;overscroll-behavior:contain}
      .vt-form{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start}
      .vt-card{background:var(--vt-painel);border:1px solid var(--vt-borda);border-radius:14px;padding:16px}
      .vt-pipe{display:flex;align-items:center;margin-bottom:16px}
      .vt-pp{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--vt-fraco);white-space:nowrap;cursor:pointer;border:0;background:transparent;padding:0}
      .vt-pp b{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;font:700 11px var(--vt-mono);border:1px solid var(--vt-borda2);color:var(--vt-dim);background:var(--vt-painel2)}
      .vt-pp.on{color:var(--vt-txt)}
      .vt-pp.on b{border-color:var(--vt-ciano);color:var(--vt-ciano);box-shadow:0 0 0 3px rgba(34,211,238,.12)}
      .vt-pp.ok b{background:rgba(52,211,153,.12);border-color:rgba(52,211,153,.5);color:var(--vt-verde)}
      .vt-fio{flex:1;height:2px;background:var(--vt-borda);margin:0 10px;min-width:16px;position:relative;overflow:hidden}
      .vt-fio i{position:absolute;inset:0;background:linear-gradient(90deg,var(--vt-verde),var(--vt-ciano))}
      .vt-etapa{display:none}
      .vt-etapa.on{display:block}
      .vt-etapa h3{margin:0 0 4px;font-size:17px}
      .vt-sub2{font-size:12.5px;color:var(--vt-dim);margin:0 0 14px}
      .vt-campos{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
      .vt-lab{display:block;font-size:10.5px;letter-spacing:.7px;text-transform:uppercase;color:var(--vt-fraco);margin-bottom:5px}
      .vt-campos select,.vt-campos input{width:100%;box-sizing:border-box;padding:9px 10px;font:600 14px var(--vt-mono)}
      .vt-per{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:10px 12px;border:1px solid var(--vt-borda2);border-radius:10px;background:var(--vt-bg2);font-size:12.5px;color:var(--vt-dim);margin:12px 0}
      .vt-per b{font-family:var(--vt-mono);color:var(--vt-txt);font-size:13px}
      .vt-per.erro{border-color:rgba(248,113,113,.6);color:var(--vt-verm)}
      .vt-info{display:flex;flex-wrap:wrap;gap:4px 18px;font-size:12.5px;color:var(--vt-dim)}
      .vt-info b{color:var(--vt-txt);font-family:var(--vt-mono)}
      .vt-term{border:1px solid var(--vt-borda);border-radius:12px;background:var(--vt-painel2);padding:12px;margin-bottom:10px}
      .vt-term.erro{border-color:rgba(248,113,113,.6)}
      .vt-term-cab{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px}
      .vt-term-t{font-weight:700;font-size:14px;display:flex;align-items:center;gap:6px;min-width:0}
      .vt-term-t .vg-ico{color:var(--vt-ciano);width:16px;height:16px}
      .vt-term-t small{font:500 11px var(--vt-mono);color:var(--vt-fraco);margin-left:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .vt-st{display:inline-flex;align-items:center;gap:6px;font:500 11px var(--vt-mono);color:var(--vt-dim);border:1px solid var(--vt-borda);border-radius:6px;padding:2px 7px;white-space:nowrap}
      .vt-st i{width:6px;height:6px;border-radius:50%;background:var(--vt-ambar)}
      .vt-st.ok i{background:var(--vt-verde)}.vt-st.ok{color:var(--vt-verde)}
      .vt-st.erro i{background:var(--vt-verm)}.vt-st.erro{color:var(--vt-verm)}
      .vt-term-grid{display:grid;grid-template-columns:1fr 1fr minmax(0,1.7fr);gap:12px;align-items:end}
      .vt-term-grid input{width:100%;box-sizing:border-box;padding:9px 10px;text-align:right;font:600 14px var(--vt-mono)}
      .vt-ant{font:500 11px var(--vt-mono);color:var(--vt-fraco);margin-top:4px;text-align:right}
      .vt-saidas{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
      .vt-sd{border:1px solid var(--vt-borda);border-radius:8px;padding:6px 8px;background:var(--vt-bg2);min-width:0}
      .vt-sd span{display:block;font-size:9.5px;letter-spacing:.7px;text-transform:uppercase;color:var(--vt-fraco)}
      .vt-sd b{display:block;font:700 13px var(--vt-mono);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .vt-rodape{display:flex;justify-content:space-between;gap:8px;margin-top:14px;flex-wrap:wrap}
      .vt-resumo{position:sticky;top:0}
      .vt-resumo h4{margin:0 0 10px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--vt-dim)}
      .vt-resumo .vt-per{margin:0 0 12px}
      .vt-lc{display:grid;grid-template-columns:90px minmax(0,1fr) 112px;gap:8px;align-items:center;margin-bottom:8px;font-size:12px;color:var(--vt-dim)}
      .vt-bar{height:10px;border-radius:3px;background:var(--vt-borda);overflow:hidden;position:relative}
      .vt-bar i{position:absolute;top:0;bottom:0;border-radius:3px;transition:left .6s cubic-bezier(.2,.8,.2,1),width .6s cubic-bezier(.2,.8,.2,1)}
      .vt-lc .vt-num{text-align:right;color:var(--vt-txt);font-size:12.5px;white-space:nowrap}
      .vt-tot{display:flex;justify-content:space-between;align-items:baseline;gap:8px;border-top:1px solid var(--vt-borda);padding-top:10px;margin-top:6px;font-size:12px;color:var(--vt-dim)}
      .vt-tot.sem{border:0;padding-top:4px;margin-top:0}
      .vt-grande{font:700 20px var(--vt-mono)}
      .vt-prog{height:6px;border-radius:3px;background:var(--vt-borda);overflow:hidden;margin-top:8px}
      .vt-prog i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--vt-verde),var(--vt-ciano));transition:width .6s}
      .vt-slide{position:relative;height:52px;border-radius:14px;background:var(--vt-bg2);border:1px solid var(--vt-borda2);margin-top:14px;overflow:hidden;user-select:none;touch-action:none}
      .vt-slide .txt{position:absolute;inset:0;padding-left:50px;display:grid;place-items:center;font:700 12px Inter,sans-serif;letter-spacing:1.2px;text-transform:uppercase;pointer-events:none}
      .vg-tabela .btn{padding:5px 10px !important;font-size:12px !important}
      .vt-slide .txt span{background:linear-gradient(90deg,#8a9bb5 0%,#fff 50%,#8a9bb5 100%);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:vtBrilho 2.4s linear infinite}
      @keyframes vtBrilho{from{background-position:200% 0}to{background-position:-200% 0}}
      .vt-slide .rastro{position:absolute;left:0;top:0;bottom:0;width:52px;background:linear-gradient(90deg,rgba(34,211,238,.25),rgba(34,211,238,.05))}
      .vt-slide .pino{position:absolute;left:4px;top:4px;width:44px;height:42px;border-radius:11px;display:grid;place-items:center;cursor:grab;color:#06111f;font:800 18px var(--vt-mono);background:linear-gradient(135deg,#22d3ee,#60a5fa);box-shadow:0 0 18px -2px rgba(34,211,238,.7);outline:none}
      .vt-slide .pino:focus-visible{box-shadow:0 0 0 3px #fff}
      .vt-slide.feito{border-color:rgba(52,211,153,.6)}
      .vt-slide.feito .pino{background:linear-gradient(135deg,#34d399,#10b981)}

      @media (max-width:980px){
        .vt-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
        .vt-kpi .vl{font-size:17px}
        .vt-ger-lin{grid-template-columns:1fr 1fr}
        .vt-ger-lin .vt-id,.vt-ger-lin .vt-acoes{grid-column:1/-1}
        .vt-acoes{justify-content:flex-start}
        .vg-spark{width:100%}
        .vt-hk-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
        .vt-duas{grid-template-columns:1fr}
        .vt-form{grid-template-columns:1fr}
        .vt-resumo{position:static}
        .vt-term-grid{grid-template-columns:1fr 1fr}
        .vt-term-grid .vt-saidas{grid-column:1/-1}
        .vt-pp span{display:none}
        table.vt-tab,table.vt-tab tbody,table.vt-tab tr,table.vt-tab td{display:block;width:100%}
        table.vt-tab thead,table.vt-tab colgroup{display:none}
        table.vt-tab tr.vt-lin{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid var(--vt-borda);padding:6px 0}
        table.vt-tab td{border:0 !important;text-align:left;padding:4px 8px !important;white-space:normal}
        table.vt-tab td::before{content:attr(data-r);display:block;font:600 10px Inter,sans-serif;letter-spacing:.6px;text-transform:uppercase;color:var(--vt-fraco)}
        table.vt-tab td.vt-ac{grid-column:1/-1;text-align:left}
        table.vt-tab td.vt-ac::before{display:none}
      }
      @media (max-width:560px){
        table.vg-hist-tab .vg-so-largo{display:none}
        .vg-resumo{grid-template-columns:1fr 1fr;gap:8px}
        .vt-ov-topo,.vt-ov-corpo{padding-left:12px;padding-right:12px}
        .vg-desp-linha{grid-template-columns:minmax(0,1fr) 100px auto;gap:6px}
        .vg-maq-btns{width:100%;justify-content:flex-start}
        .vt-saidas{grid-template-columns:repeat(2,minmax(0,1fr))}
        .vt-hk-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
        .vt-hk .vl{font-size:13px}
      }
      @media (prefers-reduced-motion:reduce){
        .vg-tech *,#vgPop{animation:none !important;transition:none !important}
        .vg-spark path.l{stroke-dashoffset:0}
      }
    `;
    document.head.appendChild(css);
  }

  // ---------- mapa de prestações ----------
  const PERIODOS = { mes: 'Este mês', ant: 'Mês passado', '3m': 'Últimos 3 meses', '6m': 'Últimos 6 meses', tudo: 'Tudo' };
  function intervaloPeriodo(k) {
    const d = new Date(), y = d.getFullYear(), m = d.getMonth();
    if (k === 'mes') return [isoDe(new Date(y, m, 1)), null];
    if (k === 'ant') return [isoDe(new Date(y, m - 1, 1)), isoDe(new Date(y, m, 0))];
    if (k === '3m') return [isoDe(new Date(y, m - 2, 1)), null];
    if (k === '6m') return [isoDe(new Date(y, m - 5, 1)), null];
    return [null, null];
  }
  const noPeriodo = (data, [ini, fim]) => (!ini || dia(data) >= ini) && (!fim || dia(data) <= fim);
  function diasDesde(s) {
    const [y, m, d] = dia(s).split('-').map(Number);
    const t = new Date();
    return Math.round((Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) - Date.UTC(y, m - 1, d)) / 86400000);
  }
  const somar = (arr, f) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
  const restamDe = p => (ehHistorico(p) ? 0 : (Number(p.liquido) || 0) - totalPago(p.dados?.pagamentos));
  const despesasDe = p => Number(p.dados?.total_despesas) || somar(p.dados?.despesas || [], d => d.valor);
  const vendaDe = l => (Number.isFinite(l.venda) ? l.venda : l.di - (l.zerado ? 0 : l.di_anterior));
  const premiosDe = l => (Number.isFinite(l.premios) ? l.premios : l.ds - (l.zerado ? 0 : l.ds_anterior));
  const dataCurta = s => dataBR(s).slice(0, 5);

  // ---------- tela (painel de operação) ----------
  const ICONE = '<svg class="vg-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM6 7V4h8v3M6 10h8v4H6zM8.7 10v4M11.3 10v4M7 17.5h6M17 14h2a1 1 0 0 0 1-1V7"/><circle cx="20" cy="5.5" r="1.5"/></svg>';
  const PER_CURTO = { mes: 'Mês', ant: 'Mês passado', '3m': '3 meses', '6m': '6 meses', tudo: 'Tudo' };
  const siglaDe = nome => {
    const p = String(nome || '').trim().split(/\s+/).filter(Boolean);
    return ((p[0]?.[0] || '') + (p[1]?.[0] || p[0]?.[1] || '')).toUpperCase() || 'VG';
  };
  const pct1 = (a, b) => (b ? (a / b * 100).toFixed(1).replace('.', ',') + '%' : '—');
  const entreDias = (a, b) => Math.round((Date.parse(dia(b)) - Date.parse(dia(a))) / 86400000);
  const tagVG = i => 'VG-' + String(i + 1).padStart(2, '0');

  function render() {
    const root = document.getElementById('vgRoot');
    if (!root) return;
    root.classList.add('vg-tech');
    fecharPop();
    const ponto = pontoAtual();
    const aberto = !!(st.formAberto && ponto && st.form);
    const qtdVG = Object.values(st.contagem || {}).reduce((a, n) => a + n, 0);
    root.innerHTML = `
      <div class="vt-topo">
        <div class="vt-marca"><div class="vt-logo">${ICONE}</div><div><h2>Video game</h2>
          <div class="vt-sub">${st.pontos.length} gerente${st.pontos.length === 1 ? '' : 's'} · ${qtdVG} video game${qtdVG === 1 ? '' : 's'}</div></div></div>
        ${st.atualizadoEm && !st.erroMapa && !st.erroSetup ? `<span class="vt-vivo" title="Dados carregados do sistema"><i></i>Atualizado às ${esc(st.atualizadoEm)}</span>` : ''}
        <span class="vt-esp"></span>
        <div class="vt-seg" role="group" aria-label="Período">${Object.entries(PER_CURTO).map(([k, t]) =>
          `<button type="button" data-vg="periodo" data-id="${k}" class="${k === st.periodo ? 'on' : ''}" aria-pressed="${k === st.periodo}">${t}</button>`).join('')}</div>
        ${!st.erroSetup && st.pontos.length && podeEditar() ? `<button type="button" class="vt-btp" data-vg="form-abrir">+ Nova prestação</button>` : ''}
      </div>
      ${st.erroSetup ? `<div class="vg-setup">${esc(st.erroSetup)}</div>` : htmlPainel()}
      ${aberto ? htmlFormulario(ponto) : ''}`;
    animarNumeros(root);
    if (aberto) { recalcular(); atualizarStatusPagamentos(); ligarSlide(); }
    else atualizarStatusHist();
  }

  // Números do painel "decodificam" até o valor quando mudam
  function animarNumeros(root) {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    root.querySelectorAll('[data-dec]').forEach(el => {
      const chave = el.dataset.dec, alvo = el.textContent;
      if (st.decAnt[chave] === alvo) return;
      st.decAnt[chave] = alvo;
      const ini = performance.now(), dur = 650;
      (function passo(t) {
        if (!el.isConnected) return;
        const p = Math.min(1, (t - ini) / dur), fixos = Math.floor(alvo.length * p);
        el.textContent = [...alvo].map((ch, i) => (i < fixos || !/\d/.test(ch)) ? ch : String(Math.floor(Math.random() * 10))).join('');
        if (p < 1) requestAnimationFrame(passo); else el.textContent = alvo;
      })(ini);
    });
  }

  // ---------- dados do painel ----------
  const prestDoPonto = pontoId => (st.todas || []).filter(x => x.ponto_id === pontoId);
  const maqsDoPonto = pontoId => (st.maqTodas || []).filter(m => m.ponto_id === pontoId);
  const vendaPrest = p => somar(p.dados?.leituras || [], vendaDe);
  // Início do período de vendas: a leitura anterior do gerente (ou a instalação dos video games)
  function inicioDe(p, lista) {
    const i = lista.findIndex(x => x.uid === p.uid);
    const ant = i >= 0 ? lista[i + 1] : null;
    if (ant) return { data: dia(ant.data), inicio: false };
    const ids = (p.dados?.leituras || []).map(l => l.maquina_id);
    const inst = (st.maqTodas || []).filter(m => ids.includes(m.id) && m.instalada_em).map(m => dia(m.instalada_em)).sort()[0];
    return { data: inst || null, inicio: true };
  }
  // Última leitura de um video game: medidores, venda, prêmios e lucro das últimas leituras
  function ultimaDaMaquina(m) {
    const lista = prestDoPonto(m.ponto_id).filter(p => (p.dados?.leituras || []).some(l => l.maquina_id === m.id));
    if (!lista.length) return null;
    const l = lista[0].dados.leituras.find(x => x.maquina_id === m.id);
    const serie = lista.slice(0, 6).reverse().map(x => { const y = x.dados.leituras.find(z => z.maquina_id === m.id); return vendaDe(y) - premiosDe(y); });
    return {
      p: lista[0], l, venda: vendaDe(l), premios: premiosDe(l), serie,
      ini: lista[1] ? dia(lista[1].data) : (dia(m.instalada_em) || null), inicio: !lista[1]
    };
  }
  function resumoGerente(p, intervalo) {
    const lista = prestDoPonto(p.id);
    const reais = lista.filter(x => !ehHistorico(x));
    const ps = reais.filter(x => noPeriodo(x.data, intervalo));
    const restos = reais.map(restamDe);
    return {
      lista, reais, ps, ult: lista[0] || null,
      venda: somar(ps, vendaPrest), saldo: somar(ps, x => x.saldo), desp: somar(ps, despesasDe),
      com: somar(ps, x => x.total_comissoes), liq: somar(ps, x => x.liquido),
      rec: somar(ps, x => totalPago(x.dados?.pagamentos)),
      deve: somar(restos, v => Math.max(v, 0)), credito: somar(restos, v => Math.max(-v, 0))
    };
  }
  function sparkSvg(valores, cinzas, largura = 150, altura = 40) {
    const w = largura, h = altura;
    if (!valores.length) return `<svg class="vg-spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"></svg>`;
    const max = Math.max(...valores, 1), min = Math.min(...valores, 0), n = valores.length;
    const pts = valores.map((v, i) => [n === 1 ? w / 2 : 4 + i * (w - 8) / (n - 1), h - 5 - ((v - min) / ((max - min) || 1)) * (h - 12)]);
    const d = pts.map((pt, i) => (i ? 'L' : 'M') + pt[0].toFixed(1) + ' ' + pt[1].toFixed(1)).join(' ');
    return `<svg class="vg-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      <path class="a" d="${d} L${pts[n - 1][0].toFixed(1)} ${h} L${pts[0][0].toFixed(1)} ${h} Z"></path><path class="l" d="${d}"></path>
      ${pts.map((pt, i) => `<circle class="${cinzas?.[i] ? 'cad' : ''}" cx="${pt[0].toFixed(1)}" cy="${pt[1].toFixed(1)}" r="2.6"></circle>`).join('')}</svg>`;
  }

  // ---------- painel: indicadores + gerentes ----------
  function htmlPainel() {
    st.pgHist = [];
    if (!st.pontos.length) return `<div class="vg-card vg-vazio">Nenhum gerente no video game. Cadastre no menu <strong>Prestações → Cadastro video game</strong>.</div>`;
    const intervalo = intervaloPeriodo(st.periodo);
    const linhas = st.pontos.map(p => ({ p, r: resumoGerente(p, intervalo) }));
    const T = k => somar(linhas, x => x.r[k]);
    const liq = T('liq'), rec = T('rec'), saldo = T('saldo'), venda = T('venda'), desp = T('desp');
    const emAberto = linhas.filter(x => x.r.deve > 0).length;
    const qtd = somar(linhas, x => x.r.ps.length);
    const filtro = st.filtro || 'todos';
    const lista = linhas.filter(({ r }) => filtro === 'todos'
      || (filtro === 'deve' && r.deve > 0)
      || (filtro === 'ok' && r.reais.length && r.deve <= 0 && r.credito <= 0)
      || (filtro === 'atraso' && (!r.ult || diasDesde(r.ult.data) > 20)))
      .sort((a, b) => b.r.deve - a.r.deve || rotuloPonto(a.p).localeCompare(rotuloPonto(b.p), 'pt-BR'));
    return `
      ${st.erroMapa ? `<div class="vg-setup">${esc(st.erroMapa)}</div>` : ''}
      <div class="vt-kpis">
        <div class="vt-kpi" style="--cor:var(--vt-verde)"><div class="rt">Recebido</div><div class="vl" data-dec="rec">${brl(rec)}</div>
          <div class="rod">${liq > 0 ? Math.round(rec / liq * 100) + '% do líquido' : '—'}</div><div class="vt-barra"><i style="width:${liq > 0 ? Math.max(0, Math.min(100, rec / liq * 100)) : 0}%"></i></div></div>
        <div class="vt-kpi" style="--cor:var(--vt-verm)"><div class="rt">A receber</div><div class="vl" data-dec="rcb">${brl(T('deve'))}</div>
          <div class="rod">${emAberto} gerente${emAberto === 1 ? '' : 's'} com saldo aberto</div></div>
        <div class="vt-kpi" style="--cor:var(--vt-ciano)"><div class="rt">Líquido</div><div class="vl" data-dec="liq">${brl(liq)}</div><div class="rod">depois de despesas e comissões</div></div>
        <div class="vt-kpi" style="--cor:var(--vt-ambar)"><div class="rt">Despesas</div><div class="vl" data-dec="desp">${brl(desp)}</div><div class="rod">${saldo > 0 ? pct1(desp, saldo) + ' do saldo' : '—'}</div></div>
        <div class="vt-kpi" style="--cor:var(--vt-violeta)"><div class="rt">Prestações</div><div class="vl" data-dec="qtd">${qtd}</div><div class="rod">hold médio ${pct1(saldo, venda)}</div></div>
      </div>
      <div class="vt-filtros" role="group" aria-label="Filtrar gerentes">${[['todos', 'Todos'], ['deve', 'A receber'], ['ok', 'Quitados'], ['atraso', '+20 dias sem prestação']].map(([k, t]) =>
        `<button type="button" data-vg="filtro" data-id="${k}" class="${filtro === k ? 'on' : ''}" aria-pressed="${filtro === k}">${t}</button>`).join('')}</div>
      ${lista.map(({ p, r }) => htmlGerente(p, r)).join('') || '<div class="vt-ger" style="padding:22px;text-align:center;color:var(--vt-dim)">Nenhum gerente neste filtro.</div>'}`;
  }

  function htmlGerente(p, r) {
    const aberto = st.abertos.has(p.id);
    const maqs = maqsDoPonto(p.id).filter(m => m.ativo);
    const n = r.ult ? diasDesde(r.ult.data) : null;
    const cls = n === null ? 'vt-atr' : n <= 20 ? 'vt-ok' : n <= 35 ? 'vt-esp2' : 'vt-atr';
    const ini = r.ult ? inicioDe(r.ult, r.lista) : null;
    const serie = r.lista.slice(0, 8).reverse();
    const sit = r.deve > 0 ? `<span class="vt-sit deve">A receber ${brl(r.deve)}</span>`
      : r.credito > 0 ? `<span class="vt-sit cred">Empresa deve ${brl(r.credito)}</span>`
      : r.reais.length ? '<span class="vt-sit ok">Quitado</span>' : '<span class="vt-sit sem">Sem prestação</span>';
    const chips = maqs.map((m, i) => {
      const u = ultimaDaMaquina(m);
      const emDia = u && diasDesde(u.p.data) <= 20;
      return `<button type="button" class="vt-maq${emDia ? '' : ' amb'}" data-vg="maq-info" data-id="${esc(m.id)}" aria-expanded="false" title="Última leitura de ${esc(m.nome)}">${ICONE}${tagVG(i)} ${esc(m.nome)}</button>`;
    }).join('');
    return `<article class="vt-ger${aberto ? ' aberto' : ''}">
      <div class="vt-ger-lin">
        <div class="vt-id"><div class="vt-av">${esc(siglaDe(p.gerente_nome || p.nome))}</div><div style="min-width:0">
          <div class="vt-nm">${esc(rotuloPonto(p))}</div>
          <div class="vt-maqs"><span class="vt-qtd" title="${maqs.length} jogo${maqs.length === 1 ? '' : 's'} ativo${maqs.length === 1 ? '' : 's'}">${ICONE}${maqs.length} jogo${maqs.length === 1 ? '' : 's'}</span>${chips}</div></div></div>
        <div class="vt-cel">${sparkSvg(serie.map(x => Number(x.saldo) || 0), serie.map(ehHistorico))}</div>
        <div class="vt-cel"><div class="vt-rt">Último período</div>
          <div class="vt-vl">${r.ult ? `${ini?.data ? dataCurta(ini.data) : '…'} → ${dataCurta(r.ult.data)}` : '—'}</div>
          <div class="vt-det">${r.ult ? (ini?.inicio ? 'desde a instalação' : `${entreDias(ini.data, r.ult.data)} dias de venda`) + (ehHistorico(r.ult) ? ' · caderno' : '') : ''}</div>
          <div class="vt-det ${cls}">${n === null ? 'sem prestação' : `lida ${n <= 0 ? 'hoje' : `há ${n} dia${n === 1 ? '' : 's'}`}`}${r.ult ? ' · hold ' + pct1(Number(r.ult.saldo) || 0, vendaPrest(r.ult)) : ''}</div></div>
        <div class="vt-cel"><div class="vt-rt">Situação</div><div style="margin-top:4px">${sit}</div><div class="vt-det">recebido ${brl(r.rec)}</div></div>
        <div class="vt-acoes">
          <button type="button" class="vt-bts" data-vg="ger-hist" data-id="${esc(p.id)}" aria-expanded="${aberto}">${aberto ? 'Fechar ▴' : 'Histórico ▾'}</button>
          ${podeEditar() ? `<button type="button" class="vt-bts" data-vg="ger-nova" data-id="${esc(p.id)}" title="Nova prestação para ${esc(rotuloPonto(p))}" aria-label="Nova prestação para ${esc(rotuloPonto(p))}">＋</button>` : ''}
        </div>
      </div>
      ${aberto ? htmlHistGerente(p, r) : ''}
    </article>`;
  }

  function htmlHistGerente(p, r) {
    const ultimaUid = r.lista[0]?.uid;
    const cad = r.lista.filter(ehHistorico);
    const kpi = (t, v, c) => `<div class="vt-hk"><div class="rt">${t}</div><div class="vl ${c || ''}">${brl(v)}</div></div>`;
    const linhas = r.ps.map(x => {
      const ini = inicioDe(x, r.lista), rest = restamDe(x), pago = totalPago(x.dados?.pagamentos), desp = despesasDe(x);
      const edita = podeEditar(), exclui = edita && x.uid === ultimaUid;
      const det = (x.dados?.leituras || []).map(l => {
        const v = vendaDe(l), s = v - premiosDe(l), hold = v ? s / v * 100 : 0;
        return `<div class="vt-chip"><div class="t"><span>${esc(l.nome)}</span><b class="${s < 0 ? 'vt-neg' : ''}">${brl(s)}</b></div>
          <div class="t" style="margin-top:4px"><span>entrada ${esc(centavosTxt(l.di))} · saída ${esc(centavosTxt(l.ds))}</span><span>hold ${pct1(s, v)}</span></div>
          <div class="vt-hold"><i style="width:${Math.max(0, Math.min(100, hold))}%"></i></div></div>`;
      }).join('');
      const u = esc(x.uid), pid = esc(p.id);
      return `<tr class="vt-lin">
        <td data-r="Período"><button type="button" class="vt-abre" data-vg="prest-det" data-id="${u}" aria-expanded="false" aria-label="Ver cada video game">+</button>${ini.data ? dataCurta(ini.data) : '…'} → ${dataCurta(x.data)}<span class="vt-pd">${ini.inicio ? 'desde a instalação' : `${entreDias(ini.data, x.data)} dias de venda`}</span></td>
        <td data-r="Saldo">${brl(x.saldo)}</td>
        <td data-r="Despesas" class="${desp ? 'vt-neg' : ''}">${brl(desp)}</td>
        <td data-r="Comissão">${brl(x.total_comissoes)}</td>
        <td data-r="Líquido"><b>${brl(x.liquido)}</b></td>
        <td data-r="Recebido" class="${pago ? 'vt-pos' : ''}">${brl(pago)}</td>
        <td data-r="Situação">${rest > 0 ? `<span class="vt-sit deve">${brl(rest)}</span>` : rest < 0 ? `<span class="vt-sit cred">deve ${brl(-rest)}</span>` : '<span class="vt-sit ok">Quitada</span>'}</td>
        <td class="vt-ac"><button type="button" class="vt-bts mini" data-vg="prest-abrir" data-id="${u}" data-ponto="${pid}">${edita ? 'Editar' : 'Ver'}</button>
          <button type="button" class="vt-bts mini" data-vg="prest-imagem" data-id="${u}" data-ponto="${pid}">Imagem</button>${exclui ? `
          <button type="button" class="vt-bts mini perigo" data-vg="prest-excluir" data-id="${u}" data-ponto="${pid}">Excluir</button>` : ''}</td>
      </tr>
      <tr class="vt-det-lin" data-det="${u}" hidden><td colspan="8"><div class="vt-chips">${det || '<span class="vt-det">Sem leituras.</span>'}</div></td></tr>`;
    }).join('');
    const recs = [];
    r.ps.forEach(x => (x.dados?.pagamentos || []).forEach(pg => {
      const k = st.pgHist.push(pg) - 1;
      const divida = String(pg.forma).toUpperCase() === 'DIVIDA_PAGA';
      const v = Math.round((Number(pg.valor) || 0) * 100);
      recs.push(`<div><span>${esc(dataBR(pg.data || x.data))} · ${esc(divida ? 'Pago ao gerente · ' + (pg.obs || 'PIX') : (pg.forma || ''))}</span>
        <span class="vt-num"><b class="${divida ? 'vt-neg' : 'vt-pos'}">${divida ? '−' : ''}${brl(v)}</b> <span class="vt-tag ag" data-pgh="${k}">…</span></span></div>`);
    }));
    const desps = r.ps.flatMap(x => (x.dados?.despesas || []).map(d => ({ ...d, data: x.data })));
    return `<div class="vt-hist">
      <div class="vt-hk-grid">${kpi('Saldo', r.saldo)}${kpi('Despesas', r.desp, r.desp ? 'vt-neg' : '')}${kpi('Comissões', r.com)}${kpi('Líquido', r.liq)}${kpi('Recebido', r.rec, r.rec ? 'vt-pos' : '')}${kpi('A receber', r.deve, r.deve ? 'vt-neg' : '')}</div>
      <div class="vt-sec">Prestações</div>
      ${r.ps.length ? `<table class="vt-tab">
        <thead><tr><th>Período</th><th>Saldo</th><th>Despesas</th><th>Comissão</th><th>Líquido</th><th>Recebido</th><th>Situação</th><th></th></tr></thead>
        <tbody>${linhas}</tbody></table>`
        : `<div class="vt-lista"><div class="vz">Nenhuma prestação em ${esc(PERIODOS[st.periodo].toLowerCase())}.</div></div>`}
      <div class="vt-duas">
        <div><div class="vt-sec">Recebimentos</div><div class="vt-lista">${recs.join('') || '<div class="vz">Nenhum recebimento no período</div>'}</div></div>
        <div><div class="vt-sec">Despesas</div><div class="vt-lista">${desps.map(d => `<div><span>${esc(dataBR(d.data))} · ${esc(d.descricao)}</span><b class="vt-num vt-neg">${brl(d.valor)}</b></div>`).join('') || '<div class="vz">Nenhuma despesa no período</div>'}</div></div>
      </div>
      ${cad.length ? `<details class="vt-cad"><summary>Caderno, antes do sistema · ${cad.length} leitura${cad.length === 1 ? '' : 's'} · saldo ${brl(somar(cad, x => x.saldo))}</summary>
        <div class="vt-chips" style="margin-top:8px">${cad.slice().reverse().map(x => `<div class="vt-chip"><div class="t"><span>${esc(dataBR(x.data))}</span><b>${brl(x.saldo)}</b></div></div>`).join('')}</div></details>` : ''}
    </div>`;
  }

  // Situação no caixa de cada recebimento do histórico
  async function atualizarStatusHist() {
    for (const el of [...document.querySelectorAll('#vgRoot [data-pgh]')]) {
      const pg = st.pgHist?.[Number(el.dataset.pgh)];
      if (!pg) continue;
      try {
        const cods = (window.__codigosAtivos?.(pg) || []).map(m => m.codigo);
        if (!cods.length) { el.textContent = 'sem código'; el.className = 'vt-tag'; continue; }
        const noCaixa = await window.__valoresNoCaixa(pg, cods);
        const tudo = cods.every(c => noCaixa.has(c));
        el.textContent = tudo ? 'no caixa' : 'aguardando caixa';
        el.className = 'vt-tag ' + (tudo ? 'cx' : 'ag');
        el.title = 'Código: ' + cods.join(', ');
      } catch (_) { el.textContent = '—'; }
    }
  }

  // ---------- quadro do jogo: última leitura e último lucro ----------
  function fecharPop() {
    document.getElementById('vgPop')?.remove();
    document.getElementById('vgPopFundo')?.remove();
    document.querySelectorAll('.vt-maq[aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
    st.popMaq = null;
  }
  function abrirPopMaq(btn, maqId) {
    if (st.popMaq === maqId) { fecharPop(); return; }
    fecharPop();
    const m = (st.maqTodas || []).find(x => x.id === maqId);
    if (!m) return;
    const ponto = st.pontos.find(p => p.id === m.ponto_id);
    const idx = maqsDoPonto(m.ponto_id).filter(x => x.ativo).findIndex(x => x.id === m.id);
    const u = ultimaDaMaquina(m);
    const el = document.createElement('div');
    el.id = 'vgPop';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Última leitura de ' + m.nome);
    const cab = `<div class="vp-cab"><span class="vp-ico">${ICONE}</span><div><div class="vp-t">${tagVG(Math.max(idx, 0))} · ${esc(m.nome)}</div>
      <div class="vp-s">${esc(rotuloPonto(ponto))}${[m.jogo, m.local].filter(Boolean).length ? ' · ' + esc([m.jogo, m.local].filter(Boolean).join(' · ')) : ''}</div></div>
      <button type="button" class="vp-x" data-pop-fechar aria-label="Fechar">✕</button></div>`;
    if (!u) {
      el.innerHTML = cab + `<div class="vp-per">Ainda não tem leitura. Leitura inicial <b>${esc(centavosTxt(Number(m.di_inicial) || 0))}</b> / <b>${esc(centavosTxt(Number(m.ds_inicial) || 0))}</b>${m.instalada_em ? ` em <b>${esc(dataBR(m.instalada_em))}</b>` : ''}.</div>`;
    } else {
      const lucro = u.venda - u.premios, nd = u.ini ? entreDias(u.ini, u.p.data) : 0;
      const media = u.serie.length ? somar(u.serie, v => v) / u.serie.length : 0;
      const hold = u.venda ? lucro / u.venda * 100 : 0;
      el.innerHTML = cab + `
        <div class="vp-per">Última leitura <b>${esc(dataBR(u.p.data))}</b>${ehHistorico(u.p) ? ' (caderno)' : ''} · período <b>${u.ini ? dataCurta(u.ini) : '…'} → ${dataCurta(u.p.data)}</b>${nd > 0 ? ` · ${nd} dias` : u.inicio ? ' · desde a instalação' : ''}</div>
        <div class="vp-grid">
          <div><span>Entrada · coin in</span><b>${esc(centavosTxt(u.l.di))}</b></div><div><span>Saída · coin out</span><b>${esc(centavosTxt(u.l.ds))}</b></div>
          <div><span>Venda no período</span><b>${esc(centavosTxt(u.venda))}</b></div><div><span>Prêmios no período</span><b class="vp-neg">${esc(centavosTxt(u.premios))}</b></div>
        </div>
        <div class="vp-lucro"><span class="rt">Último lucro</span><span class="vl ${lucro > 0 ? 'vp-pos' : lucro < 0 ? 'vp-neg' : ''}">${brl(lucro)}</span>
          <span class="hd">hold ${pct1(lucro, u.venda)}</span>${nd > 0 ? `<span class="hd" style="color:#8a9bb5">${brl(Math.round(lucro / nd))}/dia</span>` : ''}</div>
        <div class="vt-hold"><i style="width:${Math.max(0, Math.min(100, hold))}%"></i></div>
        ${sparkSvg(u.serie, null, 300, 46)}
        <div class="vp-rod"><span>Lucro nas últimas ${u.serie.length} leitura${u.serie.length === 1 ? '' : 's'}</span><span>média ${brl(Math.round(media))}</span></div>`;
    }
    document.body.appendChild(el);
    btn.setAttribute('aria-expanded', 'true');
    st.popMaq = maqId;
    if (innerWidth < 640) {
      const f = document.createElement('div');
      f.id = 'vgPopFundo';
      document.body.insertBefore(f, el);
      el.classList.add('folha');
      return;
    }
    const rc = btn.getBoundingClientRect();
    el.style.left = Math.max(8, Math.min(rc.left + scrollX, scrollX + innerWidth - el.offsetWidth - 12)) + 'px';
    const embaixo = rc.bottom + el.offsetHeight + 12 < innerHeight;
    el.style.top = (embaixo ? rc.bottom + scrollY + 8 : Math.max(scrollY + 8, rc.top + scrollY - el.offsetHeight - 8)) + 'px';
  }
  document.addEventListener('click', e => {
    if (!st.popMaq) return;
    if (e.target.closest('[data-pop-fechar]') || (!e.target.closest('#vgPop') && !e.target.closest('.vt-maq'))) fecharPop();
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && st.popMaq) fecharPop(); });

  function opcoesGerentes() {
    return st.pontos.map(p => `<option value="${esc(p.id)}"${p.id === st.pontoId ? ' selected' : ''}>${esc(rotuloPonto(p))}</option>`).join('')
      || '<option value="">Nenhum gerente cadastrado</option>';
  }

  // ---------- formulário da prestação (etapas + resultado ao vivo) ----------
  const ETAPAS = ['Gerente', 'Leituras', 'Despesas', 'Pagamentos', 'Revisão'];
  // Período de vendas desta prestação: da última leitura do gerente até a data desta leitura
  function periodoForm() {
    const f = st.form;
    let ini = null, inicio = false, cad = false;
    const i = f.uid ? st.prestacoes.findIndex(p => p.uid === f.uid) : -1;
    const ant = i >= 0 ? st.prestacoes[i + 1] : (f.modo === 'nova' ? st.prestacoes[0] : null);
    if (ant) { ini = dia(ant.data); cad = ehHistorico(ant); }
    else {
      ini = st.maquinas.filter(m => f.linhas.some(l => l.maquina_id === m.id) && m.instalada_em).map(m => dia(m.instalada_em)).sort()[0] || null;
      inicio = true;
    }
    const fim = f.data || '';
    return { ini, fim, inicio, cad, n: ini && fim ? entreDias(ini, fim) : null };
  }
  function htmlPeriodoForm(mini) {
    const pr = periodoForm();
    if (mini && pr.fim && !(pr.ini && !pr.inicio && pr.n <= 0)) {
      return `<div class="vt-per"><b>${pr.ini ? esc(dataCurta(pr.ini)) : '—'} → ${esc(dataBR(pr.fim))}</b>${pr.n > 0 ? `<span class="vt-sit ok">${pr.n} dia${pr.n === 1 ? '' : 's'}</span>` : pr.inicio ? '<span>desde a instalação</span>' : ''}</div>`;
    }
    if (!pr.fim) return '<div class="vt-per">Informe a data da leitura.</div>';
    if (pr.ini && !pr.inicio && pr.n <= 0) return `<div class="vt-per erro">A data precisa ser depois da última leitura (<b>${esc(dataBR(pr.ini))}</b>).</div>`;
    return `<div class="vt-per">Período de vendas <b>${pr.ini ? esc(dataBR(pr.ini)) : '—'}</b> → <b>${esc(dataBR(pr.fim))}</b>
      ${pr.n !== null && pr.n > 0 ? `<span class="vt-sit ok">${pr.n} dia${pr.n === 1 ? '' : 's'}</span>` : ''}
      <span>${pr.inicio ? 'desde a instalação' : `última leitura: ${esc(dataBR(pr.ini))}${pr.cad ? ' (caderno)' : ''}`}</span></div>`;
  }
  // Data da leitura anterior de um video game (para mostrar junto do medidor anterior)
  function dataAnterior(maqId) {
    const f = st.form;
    const i = f?.uid ? st.prestacoes.findIndex(p => p.uid === f.uid) : -1;
    const lista = i >= 0 ? st.prestacoes.slice(i + 1) : st.prestacoes;
    const p = lista.find(x => (x.dados?.leituras || []).some(l => l.maquina_id === maqId));
    if (p) return dia(p.data);
    return dia(st.maquinas.find(m => m.id === maqId)?.instalada_em) || '';
  }

  function htmlFormulario(ponto) {
    const f = st.form;
    const ver = f.modo === 'ver';
    const e = st.etapa;
    const titulo = f.modo === 'nova' ? 'Nova prestação'
      : f.modo === 'editar' ? `Editar prestação de ${dataBR(f.data)}`
      : `Prestação de ${dataBR(f.data)}`;
    const travaLeit = ver || !!f.trava;
    const proxima = f.trava ? (() => { const i = st.prestacoes.findIndex(p => p.uid === f.uid); return i > 0 ? st.prestacoes[i - 1] : null; })() : null;
    const ativos = st.maquinas.filter(m => m.ativo).length;
    const negAnt = Number(f.negativoAnterior) || 0;
    const ok = n => ver || (n === 1 ? !!f.data : n === 2 ? !Object.keys(avaliarLinhas().erros).length : n === 3 ? !avaliarDespesas().erro : true);
    const pipe = ETAPAS.map((t, i) => {
      const n = i + 1, feito = n < e && ok(n);
      return `${i ? `<span class="vt-fio"><i style="width:${n <= e ? 100 : 0}%"></i></span>` : ''}<button type="button" class="vt-pp${n === e ? ' on' : ''}${feito ? ' ok' : ''}" data-vg="etapa" data-id="${n}" aria-current="${n === e ? 'step' : 'false'}"><b>${feito ? '✓' : String(n).padStart(2, '0')}</b><span>${t}</span></button>`;
    }).join('');
    const etapa = (n, h, sub, corpo) => `<section class="vt-etapa${e === n ? ' on' : ''}" data-etapa="${n}"><h3>${h}</h3>${sub ? `<p class="vt-sub2">${sub}</p>` : ''}${corpo}</section>`;
    return `
      <div class="vt-ov" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
        <div class="vt-ov-pg" id="vgFormCard">
          <div class="vt-ov-topo">
            <div class="vt-marca"><div class="vt-logo">${ICONE}</div><div style="min-width:0"><div class="vt-ov-t">${esc(titulo)}</div>
              <div class="vt-sub">${esc(rotuloPonto(ponto))}${ver ? ' · somente consulta' : ''}</div></div></div>
            <button type="button" class="vt-bts" data-vg="form-fechar" aria-label="Fechar o formulário">✕ Fechar</button>
          </div>
          <div class="vt-ov-corpo">
            <div class="vt-form">
              <div class="vt-card">
                <div class="vt-pipe">${pipe}</div>
                ${etapa(1, 'Gerente e data', f.modo === 'nova' ? 'Escolha o gerente e a data em que as leituras foram feitas.' : '', `
                  <div class="vt-campos">
                    <div><label class="vt-lab" for="vgPontoForm">Gerente</label><select id="vgPontoForm" ${f.modo !== 'nova' ? 'disabled' : ''}>${opcoesGerentes()}</select></div>
                    <div><label class="vt-lab" for="vgData">Data da leitura</label><input type="date" id="vgData" value="${esc(f.data)}" ${travaLeit ? 'disabled' : ''}></div>
                  </div>
                  <div data-per></div>
                  <div class="vt-info"><span>Video games ativos: <b>${ativos}</b></span>
                    ${negAnt ? `<span>Negativo anterior: <b style="color:var(--vt-ambar)">${esc(brl(negAnt))}</b></span>` : ''}</div>
                  ${!ativos && f.modo === 'nova' ? `<p class="vg-aviso" style="margin-top:12px">Este gerente não tem video game ativo. Cadastre no menu <strong>Prestações → Cadastro video game</strong>.</p>` : ''}`)}
                ${etapa(2, 'Leituras dos medidores', travaLeit ? '' : 'Digite a entrada (coin in) e a saída (coin out) atuais. O sistema compara com a leitura anterior de cada video game.', `
                  <div data-per></div>
                  ${f.trava ? `<p class="vg-aviso">Leituras e data travadas: ${proxima ? `a prestação de ${esc(dataBR(proxima.data))} parte destas leituras` : 'existe prestação depois desta'}. Aqui dá para lançar e corrigir <strong>pagamentos</strong> e <strong>despesas</strong>.</p>` : ''}
                  ${f.linhas.length ? f.linhas.map((l, i) => htmlMaquina(l, travaLeit, i)).join('') : `<div class="vg-vazio">Este gerente ainda não tem video game. Cadastre no menu <strong>Prestações → Cadastro video game</strong>.</div>`}`)}
                ${etapa(3, 'Despesas', ver ? '' : 'Saem do resultado antes da comissão, como no JB. Se não teve, é só seguir.', `
                  ${!ver && podeEditar() ? `<button type="button" class="vt-bts" data-vg="despesa-nova" style="margin-bottom:10px">+ Adicionar despesa</button>` : ''}
                  <div id="vgDespLista">${htmlDespesas(ver)}</div>
                  <div class="vg-erro" id="vgDespErro"></div>`)}
                ${etapa(4, 'Pagamentos do gerente', ver ? '' : 'Lance o que foi recebido do gerente (ou pago a ele). Cada pagamento vai para confirmação no caixa.', `
                  <div class="vg-resumo" style="margin-top:0">
                    <div class="vg-kpi"><div class="vg-sub">Líquido desta prestação</div><div class="vg-v" data-out="liquido"></div></div>
                    <div class="vg-kpi"><div class="vg-sub">Pagamentos</div><div class="vg-v" data-out="pago"></div></div>
                    <div class="vg-kpi"><div class="vg-sub" data-out="restamRot"></div><div class="vg-v" data-out="restam"></div></div>
                  </div>
                  ${!ver && podeEditar() ? `<button type="button" class="vt-bts" data-vg="pagamento-novo" style="margin-bottom:10px">+ Adicionar pagamento</button>` : ''}
                  <div class="vg-tabela">${htmlPagamentos(ver)}</div>`)}
                ${etapa(5, ver ? 'Resumo da prestação' : 'Revisão', ver ? '' : 'Confira cada video game antes de salvar.', `
                  <div class="vg-tabela" style="margin-bottom:12px"><table class="vt-tab" id="vgConfMaq"></table></div>
                  <div class="vg-sub" style="margin-bottom:6px">Comissões ${f.base === 'cascata' ? 'em cascata' : 'sobre o resultado de todos os video games'}${f.modo === 'nova' ? '' : ' · percentuais gravados nesta prestação'}</div>
                  <div class="vg-coms" id="vgComs"></div>
                  <div class="vg-linha"><span>Saldo do período (todos os video games)</span><span class="vg-num" id="vgSaldo"></span></div>
                  <div class="vg-linha" id="vgDespLinha"><span>Despesas</span><span class="vg-num vg-neg" id="vgDespTot"></span></div>
                  <div class="vg-linha" id="vgResLinha"><span>Resultado depois das despesas</span><span class="vg-num" id="vgRes"></span></div>
                  <div class="vg-linha" id="vgNegAntLinha"><span>Negativo acumulado anterior</span><span class="vg-num" id="vgNegAnt"></span></div>
                  <div class="vg-linha"><span>Total de comissões</span><span class="vg-num vg-neg" id="vgTotCom"></span></div>
                  <div class="vg-linha vg-total"><span>Líquido da empresa</span><span class="vg-num" id="vgLiq"></span></div>
                  <div class="vg-linha" id="vgNegNovoLinha" style="color:var(--vt-ambar)"><span>Negativo que vai para a próxima leitura</span><span class="vg-num" id="vgNegNovo"></span></div>
                  <div class="vg-linha"><span>Pagamentos</span><span class="vg-num" data-out="pago"></span></div>
                  <div class="vg-linha vg-total"><span id="vgRestamRot">Restam</span><span class="vg-num" id="vgRestam"></span></div>`)}
                <div class="vg-erro" id="vgMsg" role="alert" style="margin-top:12px"></div>
                <div class="vt-rodape">
                  <button type="button" class="vt-bts" data-vg="etapa-voltar" style="visibility:${e > 1 ? 'visible' : 'hidden'}">← Voltar</button>
                  ${e < ETAPAS.length ? `<button type="button" class="vt-btp" data-vg="etapa-proxima">Próximo →</button>` : ''}
                </div>
              </div>
              <aside class="vt-card vt-resumo" aria-label="Resultado da prestação">
                <h4>Resultado da prestação</h4>
                <div data-per="mini"></div>
                <div id="vgCascata"></div>
                <div class="vt-tot"><span>Líquido</span><span class="vt-num vt-grande" data-out="liquido"></span></div>
                <div class="vt-tot sem"><span data-out="restamRot"></span><span class="vt-num" data-out="restam" style="font-weight:700"></span></div>
                <div class="vt-tot sem"><span>Saldo por dia de venda</span><span class="vt-num" id="vgPorDia">—</span></div>
                <div class="vt-prog"><i id="vgProg"></i></div>
                ${!ver && podeEditar() ? `<div class="vt-slide" id="vgSlide"><div class="rastro" id="vgRastro"></div>
                  <div class="txt"><span id="vgSlideTxt">Deslize para salvar</span></div>
                  <div class="pino" id="vgPino" role="button" tabindex="0" aria-label="${f.modo === 'editar' ? 'Salvar alterações' : 'Salvar prestação'}">›</div></div>` : ''}
                ${f.modo !== 'nova' ? `<button type="button" class="vt-bts" data-vg="prest-imagem" data-id="${esc(f.uid)}" style="width:100%;margin-top:10px">Gerar imagem para o grupo</button>` : ''}
              </aside>
            </div>
          </div>
        </div>
      </div>`;
  }

  function htmlMaquina(l, ver, idx = 0) {
    const id = esc(l.maquina_id);
    const dis = ver ? 'disabled' : '';
    const dAnt = dataAnterior(l.maquina_id);
    const det = [l.jogo, l.local].filter(Boolean).join(' · ');
    return `
      <div class="vt-term" data-maq="${id}">
        <div class="vt-term-cab"><span class="vt-term-t">${ICONE}<span>${esc(l.nome)}</span><small>${tagVG(idx)}${det ? ' · ' + esc(det) : ''}</small></span>
          <span class="vt-st" data-o="st"><i></i><span data-o="stt">aguardando leitura</span></span></div>
        <div class="vt-term-grid">
          <div><label class="vt-lab" for="vgdi_${id}">Entrada · coin in</label>
            <input id="vgdi_${id}" inputmode="numeric" autocomplete="off" data-leitura="diTxt" data-id="${id}" value="${esc(l.diTxt ? centavosTxt(l.diTxt) : '')}" placeholder="0,00" ${dis}>
            <div class="vt-ant">anterior ${esc(centavosTxt(l.di_anterior))}${dAnt ? ' · ' + esc(dataCurta(dAnt)) : ''}</div></div>
          <div><label class="vt-lab" for="vgds_${id}">Saída · coin out</label>
            <input id="vgds_${id}" inputmode="numeric" autocomplete="off" data-leitura="dsTxt" data-id="${id}" value="${esc(l.dsTxt ? centavosTxt(l.dsTxt) : '')}" placeholder="0,00" ${dis}>
            <div class="vt-ant">anterior ${esc(centavosTxt(l.ds_anterior))}${dAnt ? ' · ' + esc(dataCurta(dAnt)) : ''}</div></div>
          <div class="vt-saidas">
            <div class="vt-sd"><span>Venda</span><b data-o="venda">—</b></div>
            <div class="vt-sd"><span>Prêmios</span><b data-o="premios" class="vt-neg">—</b></div>
            <div class="vt-sd"><span>Saldo</span><b data-o="saldo" class="vt-ciano">—</b></div>
            <div class="vt-sd"><span>Hold</span><b data-o="hold" class="vt-violeta">—</b></div>
          </div>
        </div>
        <label class="vg-zerado" data-o="zeradoBox" hidden><input type="checkbox" data-zerado data-id="${id}" ${l.zerado ? 'checked' : ''} ${dis}> Video game foi zerado: contar a partir de zero</label>
        <div class="vg-erro" data-o="erro"></div>
      </div>`;
  }

  // Deslizar para salvar: o gesto da alavanca, em versão moderna
  function ligarSlide() {
    const slide = document.getElementById('vgSlide'), pino = document.getElementById('vgPino'), rastro = document.getElementById('vgRastro');
    if (!slide || !pino) return;
    let x0 = null, maxX = 0;
    const pos = (x, anim) => {
      pino.style.transition = rastro.style.transition = anim ? 'left .25s, width .25s' : 'none';
      pino.style.left = (4 + x) + 'px';
      rastro.style.width = (x + 52) + 'px';
    };
    const disparar = async () => {
      if (st.salvando) return;
      pos(maxX, true);
      slide.classList.add('feito');
      pino.textContent = '✓';
      document.getElementById('vgSlideTxt').textContent = 'Salvando…';
      await salvarPrestacao();
      // Se não salvou (algo a corrigir), a alavanca volta
      const s2 = document.getElementById('vgSlide');
      if (s2 && s2 === slide) {
        slide.classList.remove('feito');
        pino.textContent = '›';
        document.getElementById('vgSlideTxt').textContent = 'Deslize para salvar';
        pos(0, true);
      }
    };
    pino.addEventListener('pointerdown', e => {
      if (st.salvando) return;
      x0 = e.clientX;
      maxX = slide.clientWidth - 54;
      pino.setPointerCapture?.(e.pointerId);
    });
    pino.addEventListener('pointermove', e => { if (x0 !== null) pos(Math.max(0, Math.min(maxX, e.clientX - x0)), false); });
    const soltar = e => {
      if (x0 === null) return;
      const x = Math.max(0, Math.min(maxX, e.clientX - x0));
      x0 = null;
      if (x > maxX * 0.85) disparar(); else pos(0, true);
    };
    pino.addEventListener('pointerup', soltar);
    pino.addEventListener('pointercancel', () => { x0 = null; pos(0, true); });
    pino.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); maxX = slide.clientWidth - 54; disparar(); }
    });
  }

  const rotuloSalvar = () => (st.form?.modo === 'editar' ? 'Salvar alterações' : 'Salvar prestação');

  function htmlDespesas(ver) {
    const lista = st.form?.despesas || [];
    const edita = !ver && podeEditar();
    if (!lista.length) return `<div class="vg-sub" style="padding:6px 0">Nenhuma despesa lançada.</div>`;
    if (!edita) {
      return lista.map(d => `<div class="vg-linha"><span>${esc(d.descricao)}</span><span class="vg-num" style="color:#b91c1c">− ${esc(brl(leituraInt(d.valorTxt) || 0))}</span></div>`).join('');
    }
    return lista.map(d => `
      <div class="vg-desp-linha">
        <input data-desp="descricao" data-id="${esc(d.id)}" value="${esc(d.descricao)}" placeholder="Descrição (ex.: conserto, energia)" aria-label="Descrição da despesa" autocomplete="off">
        <input data-desp="valorTxt" data-id="${esc(d.id)}" value="${esc(d.valorTxt ? centavosTxt(d.valorTxt) : '')}" inputmode="numeric" placeholder="0,00" aria-label="Valor da despesa" autocomplete="off">
        <button type="button" class="btn ghost sm" data-vg="despesa-remover" data-id="${esc(d.id)}" aria-label="Remover despesa" title="Remover despesa">✕</button>
      </div>`).join('');
  }
  function redesenharDespesas(focarUltima) {
    const box = document.getElementById('vgDespLista');
    if (!box || !st.form) return;
    box.innerHTML = htmlDespesas(st.form.modo === 'ver');
    recalcular();
    if (focarUltima) box.querySelector('.vg-desp-linha:last-child [data-desp="descricao"]')?.focus();
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

  function definir(el, txt) { if (el) el.textContent = txt; }

  function recalcular() {
    if (!st.form || !document.getElementById('vgSaldo')) return null;
    const f = st.form;
    const { validas, erros } = avaliarLinhas();
    const desp = avaliarDespesas();
    const r = calcular({ leituras: validas, negativoAnterior: f.negativoAnterior, comissoes: f.comissoes, base: f.base, despesas: desp.total });
    f.linhas.forEach(l => {
      const box = document.querySelector(`[data-maq="${CSS.escape(String(l.maquina_id))}"]`);
      if (!box) return;
      const o = n => box.querySelector(`[data-o="${n}"]`);
      const lin = r.linhas.find(x => x.maquina_id === l.maquina_id);
      const di = leituraInt(l.diTxt), ds = leituraInt(l.dsTxt);
      definir(o('venda'), lin ? centavosTxt(lin.venda) : '—');
      definir(o('premios'), lin ? centavosTxt(lin.premios) : '—');
      definir(o('saldo'), lin ? centavosTxt(lin.saldo) : '—');
      definir(o('hold'), lin && lin.venda ? pct1(lin.saldo, lin.venda) : '—');
      const msgErro = f.modo === 'ver' ? '' : (l.tocado || st.tentouSalvar ? erros[l.maquina_id] || '' : '');
      definir(o('erro'), msgErro);
      const completo = di !== null && ds !== null;
      const conferir = completo && !!erros[l.maquina_id];
      if (o('st')) o('st').className = 'vt-st' + (lin ? ' ok' : conferir ? ' erro' : '');
      definir(o('stt'), lin ? 'leitura ok' : conferir ? 'conferir' : 'aguardando leitura');
      box.classList.toggle('erro', !!msgErro);
      const menor = completo && (di < l.di_anterior || ds < l.ds_anterior);
      if (o('zeradoBox')) o('zeradoBox').hidden = !(menor || l.zerado);
    });
    const comsBox = document.getElementById('vgComs');
    if (comsBox) comsBox.innerHTML = r.comissoes.map(c => `<div class="vg-com"><div class="vg-sub">${esc(c.nome)} (${esc(String(c.pct).replace('.', ','))}%)</div><div style="font-weight:700">${esc(brl(c.valor))}</div></div>`).join('')
      || '<div class="vg-sub">Nenhuma comissão cadastrada para este gerente.</div>';
    definir(document.getElementById('vgSaldo'), brl(r.saldo));
    definir(document.getElementById('vgDespTot'), '− ' + brl(r.totalDespesas));
    definir(document.getElementById('vgRes'), brl(r.resultado));
    document.getElementById('vgDespLinha').hidden = !r.totalDespesas;
    document.getElementById('vgResLinha').hidden = !r.totalDespesas;
    definir(document.getElementById('vgDespErro'), f.modo === 'ver' ? '' : (f.despTocada || st.tentouSalvar ? desp.erro : ''));
    definir(document.getElementById('vgNegAnt'), '− ' + brl(r.negativoAnterior) + ' (só na base das comissões)');
    document.getElementById('vgNegAntLinha').hidden = !r.negativoAnterior;
    definir(document.getElementById('vgTotCom'), '− ' + brl(r.totalComissoes));
    const corLiq = r.liquido < 0 ? '#f87171' : '#34d399';
    const liq = document.getElementById('vgLiq');
    definir(liq, brl(r.liquido));
    liq.style.color = corLiq;
    definir(document.getElementById('vgNegNovo'), brl(r.negativoNovo));
    document.getElementById('vgNegNovoLinha').hidden = !r.negativoNovo;
    const pago = totalPago(f.pagamentos);
    const restam = r.liquido - pago;
    const restamRot = restam < 0 ? 'Empresa deve ao gerente' : restam === 0 && pago ? 'Quitado' : 'Resta receber do gerente';
    definir(document.getElementById('vgRestamRot'), restamRot);
    definir(document.getElementById('vgRestam'), brl(Math.abs(restam)));
    // Valores repetidos nas etapas e no painel de resultado
    const saida = (nome, txt, cor) => document.querySelectorAll(`[data-out="${nome}"]`).forEach(el => { el.textContent = txt; if (cor !== undefined) el.style.color = cor; });
    saida('liquido', brl(r.liquido), corLiq);
    saida('pago', brl(pago));
    saida('restamRot', restamRot);
    saida('restam', brl(Math.abs(restam)), restam < 0 ? '#fbbf24' : restam === 0 && pago ? '#34d399' : restam > 0 ? '#f87171' : '');
    // Cascata: saldo → despesas → comissões → líquido
    const casc = document.getElementById('vgCascata');
    if (casc) {
      const base = Math.max(r.saldo, r.totalDespesas + r.totalComissoes, 1);
      const pc = v => Math.max(0, Math.min(100, v / base * 100));
      const barras = [
        ['Saldo', r.saldo, 0, Math.max(r.saldo, 0), '#22d3ee'],
        ['Despesas', -r.totalDespesas, Math.max(r.saldo - r.totalDespesas, 0), r.totalDespesas, '#fbbf24'],
        ['Comissões', -r.totalComissoes, Math.max(r.resultado - r.totalComissoes, 0), r.totalComissoes, '#a78bfa'],
        ['Líquido', r.liquido, 0, Math.max(r.liquido, 0), r.liquido < 0 ? '#f87171' : '#34d399']
      ];
      casc.innerHTML = barras.map(([rot, v, ini, larg, cor]) => `<div class="vt-lc"><span>${rot}</span><div class="vt-bar"><i style="left:${pc(ini)}%;width:${pc(larg)}%;background:${cor}"></i></div><span class="vt-num">${v < 0 ? '−' : ''}${brl(Math.abs(v))}</span></div>`).join('');
    }
    document.querySelectorAll('#vgRoot [data-per]').forEach(el => { el.innerHTML = htmlPeriodoForm(el.dataset.per === 'mini'); });
    const pr = periodoForm();
    definir(document.getElementById('vgPorDia'), pr.n > 0 && r.saldo ? brl(Math.round(r.saldo / pr.n)) : '—');
    const prog = document.getElementById('vgProg');
    if (prog) prog.style.width = (r.liquido > 0 ? Math.max(0, Math.min(100, pago / r.liquido * 100)) : 0) + '%';
    const conf = document.getElementById('vgConfMaq');
    if (conf) {
      let tv = 0, tp = 0;
      const corpo = f.linhas.map(l => {
        const lin = r.linhas.find(x => x.maquina_id === l.maquina_id);
        if (lin) { tv += lin.venda; tp += lin.premios; }
        return `<tr><td>${esc(l.nome)}${l.zerado ? ' <span class="vg-chip esp">zerado</span>' : ''}</td>
          <td>${lin ? esc(brl(lin.venda)) : '—'}</td><td class="vt-neg">${lin ? esc(brl(lin.premios)) : '—'}</td>
          <td><b>${lin ? esc(brl(lin.saldo)) : '<span class="vt-neg">falta leitura</span>'}</b></td><td class="vt-violeta">${lin && lin.venda ? pct1(lin.saldo, lin.venda) : '—'}</td></tr>`;
      }).join('');
      conf.innerHTML = `<thead><tr><th>Video game</th><th>Venda</th><th>Prêmios</th><th>Saldo</th><th>Hold</th></tr></thead>
        <tbody>${corpo}</tbody>
        <tfoot><tr><td>Soma</td><td>${esc(brl(tv))}</td><td>${esc(brl(tp))}</td><td>${esc(brl(r.saldo))}</td><td>${tv ? pct1(r.saldo, tv) : '—'}</td></tr></tfoot>`;
    }
    return { r, erros, desp };
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
        if (cods.length) chip.title = 'Código: ' + cods.join(', ');
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
      </dialog>
      <dialog id="dlgVgHist" class="vg-dlg">
        <header class="card"><strong id="dlgVgHistTitulo">Histórico do caderno</strong></header>
        <form id="formVgHist" class="card" novalidate>
          <p class="vg-sub" style="margin:0 0 8px">Lance as leituras anotadas no caderno, da mais antiga para a mais nova: data, entrada (vendas) e saída (prêmios) do totalizador.
            A <strong>primeira linha é a leitura inicial</strong>; as outras ficam como prestações do caderno (sem comissão, sem pagamento e sem caixa).
            A próxima prestação no sistema parte da última linha.</p>
          <p class="vg-aviso" id="vgHistBloqueio" hidden></p>
          <details class="vg-ret" id="vgHistColarBox" style="margin:0 0 8px">
            <summary>Colar várias linhas de uma vez</summary>
            <textarea id="vgHistColar" rows="6" placeholder="06/07 18.112,00 11.489,00&#10;21/07 25.379,00 16.129,00"></textarea>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <button type="button" class="btn ghost sm" id="vgHistColarBtn">Preencher a tabela</button>
              <span class="vg-sub">Uma leitura por linha: data, entrada e saída. Linhas sem data são ignoradas.</span>
            </div>
          </details>
          <div class="vg-tabela"><table class="vg-hist-tab">
            <thead><tr><th>Data</th><th>Entrada (di)</th><th>Saída (ds)</th><th class="vg-num vg-so-largo">Venda</th><th class="vg-num vg-so-largo">Prêmios</th><th class="vg-num">Saldo</th><th></th></tr></thead>
            <tbody id="vgHistLinhas"></tbody>
            <tfoot><tr><td colspan="3">Soma do caderno</td><td class="vg-num vg-so-largo" id="vgHistTotV"></td><td class="vg-num vg-so-largo" id="vgHistTotP"></td><td class="vg-num" id="vgHistTotS"></td><td></td></tr></tfoot>
          </table></div>
          <button type="button" class="btn ghost sm" id="vgHistAdd" style="margin-top:6px">+ Adicionar linha</button>
          <div class="vg-erro" id="vgHistErro" role="alert"></div>
          <div class="vg-acoes"><button type="button" class="btn ghost" data-vg-fechar="dlgVgHist">Cancelar</button><button type="submit" class="btn" id="vgHistSalvar">Salvar histórico</button></div>
        </form>
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
    document.getElementById('formVgHist').addEventListener('submit', salvarHistorico);
    wrap.addEventListener('input', e => {
      if (e.target.hasAttribute('data-mascara')) mascarar(e.target);
      if (e.target.closest('#vgHistLinhas')) recalcularHist();
    });
    wrap.addEventListener('change', e => { if (e.target.closest('#vgHistLinhas')) recalcularHist(); });
    wrap.addEventListener('click', e => {
      const id = e.target.closest('[data-vg-fechar]')?.getAttribute('data-vg-fechar');
      if (id) document.getElementById(id).close();
      if (e.target.closest('#vgHistAdd')) { adicionarLinhaHist().querySelector('input')?.focus(); recalcularHist(); }
      if (e.target.closest('#vgHistColarBtn')) colarHistorico();
      const rem = e.target.closest('[data-hist-remover]');
      if (rem) { rem.closest('tr')?.remove(); recalcularHist(); }
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
    document.getElementById('vgNegIniBox').hidden = !!(ponto && st.prestacoes.some(p => !ehHistorico(p)));
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
        if (!st.prestacoes.some(p => !ehHistorico(p))) row.negativo_inicial = Math.round(negativo * 100);
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
    info.textContent = !travado ? ''
      : ultimaReal(m.id) ? 'Este video game já tem prestação: dá para mudar só o nome e o local. Para mudar o jogo, use Trocar jogo.'
      : 'Este video game tem histórico do caderno: a data de instalação e a leitura inicial mudam pelo botão Histórico. Aqui dá para mudar o nome e o local.';
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

  // ---------- histórico do caderno (leituras antigas) ----------
  const ultimaReal = maqId => st.prestacoes.find(p => !ehHistorico(p) && (p.dados?.leituras || []).some(l => l.maquina_id === maqId)) || null;
  const primeiraReal = maqId => st.prestacoes.filter(p => !ehHistorico(p) && (p.dados?.leituras || []).some(l => l.maquina_id === maqId)).pop() || null;
  const historicoDaMaquina = maqId => st.prestacoes.filter(ehHistorico)
    .map(p => ({ data: dia(p.data), l: (p.dados?.leituras || []).find(x => x.maquina_id === maqId) }))
    .filter(x => x.l)
    .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));

  function adicionarLinhaHist(r) {
    const num = v => (v === null || v === undefined ? '' : esc(centavosTxt(v)));
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="date" data-h="data" aria-label="Data da leitura" value="${esc(r?.data || '')}"></td>
      <td><input data-h="di" data-mascara inputmode="numeric" autocomplete="off" placeholder="0,00" aria-label="Entrada (di)" value="${num(r?.di)}"></td>
      <td><input data-h="ds" data-mascara inputmode="numeric" autocomplete="off" placeholder="0,00" aria-label="Saída (ds)" value="${num(r?.ds)}"></td>
      <td class="vg-num vg-so-largo" data-ho="venda"></td><td class="vg-num vg-so-largo" data-ho="premios"></td><td class="vg-num" data-ho="saldo"></td>
      <td><button type="button" class="btn ghost sm" data-hist-remover aria-label="Remover linha" title="Remover linha">✕</button></td>`;
    document.getElementById('vgHistLinhas').appendChild(tr);
    return tr;
  }
  function lerLinhasHist() {
    return [...document.querySelectorAll('#vgHistLinhas tr')].map((tr, i) => ({
      tr, n: i + 1, data: tr.querySelector('[data-h="data"]').value,
      di: leituraInt(tr.querySelector('[data-h="di"]').value), ds: leituraInt(tr.querySelector('[data-h="ds"]').value)
    }));
  }
  function recalcularHist() {
    let ant = null, tv = 0, tp = 0;
    lerLinhasHist().forEach(r => {
      const o = n => r.tr.querySelector(`[data-ho="${n}"]`);
      const ok = !!r.data && r.di !== null && r.ds !== null;
      let erro = false;
      if (!ok) ['venda', 'premios', 'saldo'].forEach(n => definir(o(n), ''));
      else if (!ant) { definir(o('venda'), ''); definir(o('premios'), ''); definir(o('saldo'), 'leitura inicial'); }
      else {
        const v = r.di - ant.di, p = r.ds - ant.ds;
        erro = r.data <= ant.data || v < 0 || p < 0;
        definir(o('venda'), brl(v));
        definir(o('premios'), brl(p));
        definir(o('saldo'), brl(v - p));
        if (!erro) { tv += v; tp += p; }
      }
      r.tr.classList.toggle('vg-hist-erro', erro);
      if (ok) ant = r;
    });
    definir(document.getElementById('vgHistTotV'), brl(tv));
    definir(document.getElementById('vgHistTotP'), brl(tp));
    definir(document.getElementById('vgHistTotS'), brl(tv - tp));
  }
  function validarHist(todas) {
    const linhas = todas.filter(r => r.data || r.di !== null || r.ds !== null);
    if (!linhas.length) return { erro: 'Informe pelo menos a leitura inicial.' };
    const hj = hoje();
    for (let i = 0; i < linhas.length; i++) {
      const r = linhas[i], ant = linhas[i - 1], n = `Linha ${r.n}`;
      if (!r.data || r.di === null || r.ds === null) return { erro: `${n}: informe a data, a entrada e a saída.` };
      if (r.data > hj) return { erro: `${n}: a data ${dataBR(r.data)} é no futuro.` };
      if (ant && r.data <= ant.data) return { erro: `${n} (${dataBR(r.data)}): a data precisa ser depois da linha de cima (${dataBR(ant.data)}).` };
      if (ant && (r.di < ant.di || r.ds < ant.ds)) return { erro: `${n} (${dataBR(r.data)}): a leitura é menor que a da linha de cima. Confira os números.` };
    }
    return { linhas: linhas.map(({ data, di, ds }) => ({ data, di, ds })) };
  }
  // "18.112,00" → 1811200 centavos; "18112" → 1811200
  function centavosDe(t) {
    const [int, dec = ''] = String(t).replace(/\.(?=\d{3}(?!\d))/g, '').split(',');
    if (!/^\d+$/.test(int) || !/^\d{0,2}$/.test(dec)) return null;
    const n = Number(int) * 100 + Number((dec + '00').slice(0, 2));
    return Number.isSafeInteger(n) ? n : null;
  }
  // Uma leitura por linha: data (dd/mm ou dd/mm/aaaa), entrada e saída; o resto da linha é ignorado
  function lerColagem(txt) {
    const hj = hoje(), anoAtual = Number(hj.slice(0, 4)), out = [];
    String(txt || '').split(/\r?\n/).forEach(linha => {
      const md = linha.match(/(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{4}|\d{2}))?/);
      if (!md) return;
      const nums = linha.slice(md.index + md[0].length).match(/\d[\d.]*(?:,\d{1,2})?/g) || [];
      if (nums.length < 2) return;
      const d = Number(md[1]), m = Number(md[2]);
      let ano = md[3] ? Number(md[3].length === 2 ? '20' + md[3] : md[3]) : anoAtual;
      const valida = a => { const x = new Date(a, m - 1, d); return x.getFullYear() === a && x.getMonth() === m - 1 && x.getDate() === d; };
      if (!valida(ano)) return;
      let iso = `${ano}-${pad2(m)}-${pad2(d)}`;
      if (!md[3] && iso > hj) { ano -= 1; if (!valida(ano)) return; iso = `${ano}-${pad2(m)}-${pad2(d)}`; }
      const di = centavosDe(nums[0]), ds = centavosDe(nums[1]);
      if (di === null || ds === null) return;
      out.push({ data: iso, di, ds });
    });
    return out;
  }
  function colarHistorico() {
    const erro = document.getElementById('vgHistErro');
    const lidas = lerColagem(document.getElementById('vgHistColar').value);
    if (!lidas.length) { erro.textContent = 'Nenhuma linha reconhecida. Use: data, entrada e saída (ex.: 06/07 18.112,00 11.489,00).'; return; }
    erro.textContent = '';
    document.getElementById('vgHistLinhas').innerHTML = '';
    lidas.forEach(adicionarLinhaHist);
    document.getElementById('vgHistColarBox').open = false;
    recalcularHist();
  }

  function abrirHistorico(id) {
    const m = st.maquinas.find(x => x.id === id);
    if (!m || !podeEditar()) return;
    const f = document.getElementById('formVgHist');
    f.dataset.id = m.id;
    document.getElementById('vgHistErro').textContent = '';
    document.getElementById('vgHistColar').value = '';
    document.getElementById('vgHistColarBox').open = false;
    document.getElementById('dlgVgHistTitulo').textContent = `Histórico do caderno · ${[m.nome, m.jogo].filter(Boolean).join(' · ')}`;
    document.getElementById('vgHistLinhas').innerHTML = '';
    adicionarLinhaHist({ data: dia(m.instalada_em), di: Number(m.di_inicial) || 0, ds: Number(m.ds_inicial) || 0 });
    historicoDaMaquina(m.id).forEach(x => adicionarLinhaHist({ data: x.data, di: x.l.di, ds: x.l.ds }));
    const real = primeiraReal(m.id);
    const bloq = document.getElementById('vgHistBloqueio');
    bloq.hidden = !real;
    bloq.textContent = real
      ? `Este video game já tem prestação lançada no sistema (a primeira em ${dataBR(real.data)}). O histórico do caderno só pode ser lançado antes da primeira prestação dele no sistema.`
      : '';
    f.querySelectorAll('input, textarea, button:not([data-vg-fechar])').forEach(el => { el.disabled = !!real; });
    recalcularHist();
    document.getElementById('dlgVgHist').showModal();
  }

  // Refaz do zero as leituras do caderno deste video game (pode salvar de novo sem duplicar)
  async function salvarHistorico(e) {
    e.preventDefault();
    if (st.salvandoCad) return;
    const f = e.target, erro = document.getElementById('vgHistErro');
    erro.textContent = '';
    const v = validarHist(lerLinhasHist());
    if (v.erro) { erro.textContent = v.erro; return; }
    const linhas = v.linhas;
    const btn = document.getElementById('vgHistSalvar');
    st.salvandoCad = true;
    btn.disabled = true;
    btn.textContent = 'Salvando...';
    try {
      await carregarDoPonto();
      const ponto = pontoAtual();
      const m = st.maquinas.find(x => x.id === f.dataset.id);
      if (!ponto || !m || !m.ativo) throw new Error('Video game não encontrado. Feche e abra de novo.');
      const real = primeiraReal(m.id);
      if (real) { erro.textContent = `Este video game já tem prestação lançada no sistema (${dataBR(real.data)}). O histórico só pode ser lançado antes dela.`; return; }
      const datasSistema = new Set(st.prestacoes.filter(p => !ehHistorico(p)).map(p => dia(p.data)));
      const choque = linhas.slice(1).find(r => datasSistema.has(r.data));
      if (choque) { erro.textContent = `Já existe prestação deste gerente lançada no sistema em ${dataBR(choque.data)}. Confira a data do caderno.`; return; }

      const ordem = id => { const i = st.maquinas.findIndex(x => x.id === id); return i < 0 ? 9999 : i; };
      const plano = new Map();
      st.prestacoes.filter(ehHistorico).forEach(p => plano.set(dia(p.data), { p, leituras: (p.dados?.leituras || []).filter(l => l.maquina_id !== m.id) }));
      linhas.slice(1).forEach((r, i) => {
        const a = linhas[i];
        const venda = r.di - a.di, premios = r.ds - a.ds;
        const item = plano.get(r.data) || { p: null, leituras: [] };
        item.leituras.push({
          maquina_id: m.id, nome: m.nome, jogo: m.jogo || '', local: m.local || '',
          di_anterior: a.di, ds_anterior: a.ds, di: r.di, ds: r.ds, zerado: false, venda, premios, saldo: venda - premios
        });
        plano.set(r.data, item);
      });
      const eid = await empresaId();
      const quem = window.__currentUsername?.() || '';
      for (const [data, item] of plano) {
        if (!item.leituras.length) {
          const { error } = await client().from('vg_prestacoes').delete().eq('uid', item.p.uid);
          if (error) throw error;
          continue;
        }
        item.leituras.sort((a, b) => ordem(a.maquina_id) - ordem(b.maquina_id));
        const saldo = somar(item.leituras, l => vendaDe(l) - premiosDe(l));
        const dados = { ...(item.p?.dados || {}), historico: true, ponto_nome: ponto.nome, base: 'saldo', comissoes: [], pagamentos: [], leituras: item.leituras };
        const { error } = item.p
          ? await client().from('vg_prestacoes').update({ saldo, dados }).eq('uid', item.p.uid)
          : await client().from('vg_prestacoes').insert([{
            uid: novoId(), empresa_id: eid, ponto_id: ponto.id, data,
            gerente_id: ponto.gerente_id, gerente_nome: ponto.gerente_nome || '',
            saldo, negativo_anterior: 0, negativo_novo: 0, total_comissoes: 0, liquido: 0, dados, created_by: quem
          }]);
        if (error) throw error;
      }
      const ini = linhas[0];
      if (ini.data !== dia(m.instalada_em) || ini.di !== Number(m.di_inicial) || ini.ds !== Number(m.ds_inicial)) {
        const { error } = await client().from('vg_maquinas').update({ instalada_em: ini.data, di_inicial: ini.di, ds_inicial: ini.ds }).eq('id', m.id);
        if (error) throw error;
      }
      try { window.AuditLog?.log?.('vg_historico_caderno', { maquina: m.nome, gerente: rotuloPonto(ponto), leituras: linhas.length }); } catch (_) {}
      document.getElementById('dlgVgHist').close();
      await aposMudarMaquinas();
      const n = linhas.length - 1;
      aviso(`Histórico de ${m.nome} salvo: leitura inicial + ${n} leitura${n === 1 ? '' : 's'} do caderno`, 'success');
    } catch (err) {
      console.error('[VideoGame] histórico:', err);
      erro.textContent = err?.code === '23505'
        ? 'Já existe prestação deste gerente em uma dessas datas.'
        : `Não foi possível salvar: ${err.message || err}. Pode salvar de novo: o histórico é refeito do zero.`;
    } finally {
      st.salvandoCad = false;
      btn.disabled = false;
      btn.textContent = 'Salvar histórico';
    }
  }

  function abrirDialogoPagamento(id) {
    const f = document.getElementById('formVgPagamento');
    f.reset();
    document.getElementById('vgPagErro').textContent = '';
    const pg = id ? st.form.pagamentos.find(p => p.id === id) : null;
    if (pg && !Array.isArray(pg.codigos)) {
      alert('Este pagamento foi lançado antes dos códigos de transação e não pode ser editado.\n\nPara corrigir, lance um novo pagamento com a diferença.');
      return;
    }
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
    st.form.sujo = true;
    document.getElementById('dlgVgPagamento').close();
    render();
  }
  async function excluirPagamento(id) {
    const pg = st.form.pagamentos.find(p => p.id === id);
    if (!pg || !confirm('Excluir este pagamento?')) return;
    const bloqueio = await window.__bloqueioRemocaoPagamentos([pg]);
    if (bloqueio) { alert(bloqueio); return; }
    st.form.pagamentos = st.form.pagamentos.filter(p => p.id !== id);
    st.form.sujo = true;
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
    const f = st.form, ponto = pontoAtual();
    const btn = document.getElementById('vgSalvar');
    definir(document.getElementById('vgMsg'), '');
    st.salvando = true;
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }
    // A mensagem fica no rodapé do formulário; quando o problema é de outra etapa, volta para ela
    const falha = t => { definir(document.getElementById('vgMsg'), t); };
    const falhaEm = (n, t) => { if (st.etapa !== n) irEtapa(n); falha(t); };
    try {
      f.data = document.getElementById('vgData')?.value || f.data;
      if (!f.data) return falhaEm(1, 'Informe a data da leitura.');
      if (!f.linhas.length) return falhaEm(1, 'Este gerente não tem video game. Cadastre em Cadastro video game.');

      // Sempre confere com o banco: outra pessoa pode ter lançado neste gerente
      await carregarDoPonto();
      const ultima = st.prestacoes[0];
      const eraNova = f.modo === 'nova';
      let salva = null;
      if (f.modo === 'nova' && ultima && f.data <= String(ultima.data).slice(0, 10)) {
        return falhaEm(1, `A data precisa ser depois da última prestação deste gerente (${dataBR(ultima.data)}).`);
      }
      if (f.modo === 'editar' && f.trava) {
        // Prestação anterior: data e leituras ficam exatamente como estão no banco
        salva = st.prestacoes.find(p => p.uid === f.uid && !ehHistorico(p));
        if (!salva) return falha('Esta prestação não existe mais. Atualize a página.');
        f.data = dia(salva.data);
        f.linhas = (salva.dados?.leituras || []).map(l => ({
          maquina_id: l.maquina_id, nome: l.nome, jogo: l.jogo || '', local: l.local || '',
          di_anterior: l.di_anterior, ds_anterior: l.ds_anterior, diTxt: String(l.di), dsTxt: String(l.ds), zerado: !!l.zerado
        }));
        f.negativoAnterior = Number(salva.negativo_anterior) || 0;
      } else {
        if (f.modo === 'editar') {
          if (ultima?.uid !== f.uid) return falha('Existe uma prestação mais recente deste gerente. Feche e abra esta prestação de novo pelo mapa.');
          const penultima = st.prestacoes[1];
          if (penultima && f.data <= String(penultima.data).slice(0, 10)) {
            return falhaEm(1, `A data precisa ser depois da prestação anterior (${dataBR(penultima.data)}).`);
          }
        }
        const antesDaInstalacao = f.linhas
          .map(l => st.maquinas.find(m => m.id === l.maquina_id))
          .find(m => m?.instalada_em && f.data < String(m.instalada_em).slice(0, 10));
        if (antesDaInstalacao) {
          return falhaEm(1, `A data da leitura é anterior à instalação de ${antesDaInstalacao.nome} (${dataBR(antesDaInstalacao.instalada_em)}).`);
        }
        f.negativoAnterior = negativoAnterior(f.uid);
        f.linhas.forEach(l => {
          const maq = st.maquinas.find(m => m.id === l.maquina_id);
          if (!maq) return;
          const a = leituraAnterior(maq, f.uid);
          l.di_anterior = a.di;
          l.ds_anterior = a.ds;
        });
      }

      st.tentouSalvar = true;
      const calc = recalcular();
      if (!calc) return falha('Não foi possível conferir a prestação. Feche e abra de novo.');
      if (Object.keys(calc.erros).length) return falhaEm(2, 'Corrija as leituras destacadas para salvar.');
      if (calc.desp.erro) { f.despTocada = true; return falhaEm(3, 'Confira as despesas: ' + calc.desp.erro); }
      const r = calc.r;
      if (salva) {
        // O negativo desta prestação passa para a seguinte: numa prestação anterior ele não pode mudar
        const idx = st.prestacoes.findIndex(p => p.uid === salva.uid);
        const seguinte = st.prestacoes.slice(0, idx).filter(p => !ehHistorico(p)).pop();
        if (seguinte && r.negativoNovo !== (Number(salva.negativo_novo) || 0)) {
          return falhaEm(3, `Esta alteração muda o negativo que passa para a prestação de ${dataBR(seguinte.data)} `
            + `(de ${brl(salva.negativo_novo)} para ${brl(r.negativoNovo)}). Numa prestação anterior, a despesa só pode mudar se o negativo continuar igual.`);
        }
      }

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
          despesas: calc.desp.lista, total_despesas: r.totalDespesas,
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

      try {
        window.AuditLog?.log?.('prestacao_salva', {
          tipo: eraNova ? 'Video game · nova' : 'Video game · alteração', id: uid,
          gerente: rotuloCaixa(ponto), periodo: dataBR(f.data), valor: brl(r.liquido),
          info: `${f.pagamentos.length} pagamento(s) · ${calc.desp.lista.length} despesa(s)`
        });
      } catch (_) {}

      st.tentouSalvar = false;
      st.formAberto = false;
      await carregarDoPonto();
      await atualizarMapa();
      novoFormulario();
      render();
      aviso(eraNova ? 'Prestação salva' : 'Alterações salvas', 'success');
      abrirImagem(uid);
    } catch (err) {
      console.error('[VideoGame] salvar prestação:', err);
      falha('Não foi possível salvar: ' + (err.message || err));
    } finally {
      st.salvando = false;
      const b = document.getElementById('vgSalvar');
      if (b) { b.disabled = false; b.textContent = rotuloSalvar(); }
    }
  }

  async function excluirPrestacao(uid) {
    await carregarDoPonto();
    const p = st.prestacoes[0];
    if (!p || p.uid !== uid) { alert('Só a leitura mais recente pode ser excluída.'); render(); return; }
    if (ehHistorico(p)) { alert('Leitura do caderno: altere pelo botão Histórico no Cadastro video game.'); return; }
    const bloqueio = await window.__bloqueioRemocaoPagamentos(p.dados?.pagamentos || []);
    if (bloqueio) { alert(bloqueio); return; }
    if (!confirm(`Excluir a leitura de ${dataBR(p.data)}? Os pagamentos ainda não confirmados saem da fila do caixa.`)) return;
    const { error } = await client().from('vg_prestacoes').delete().eq('uid', uid);
    if (error) { alert('Não foi possível excluir: ' + error.message); return; }
    try {
      window.AuditLog?.log?.('prestacao_excluida', {
        tipo: 'Video game', id: uid, gerente: rotuloDe(p.gerente_nome, p.dados?.ponto_nome),
        periodo: dataBR(p.data), valor: brl(p.liquido)
      });
    } catch (_) {}
    await window.__limparPendenciasOrfas({ id: uid, pagamentos: [] });
    try { await window.__getPendenciasAsync?.(); window.renderFinPendencias?.(); } catch (_) {}
    await carregarDoPonto();
    await atualizarMapa();
    novoFormulario();
    render();
  }

  // ---------- tela de cadastro (gerentes e video games) ----------
  const pctTxt = n => String(Number(n) || 0).replace('.', ',');
  const MOTIVOS = { troca_ponto: 'trocado de gerente', troca_jogo: 'trocado de jogo', retirada: 'retirado' };

  function renderCadastro() {
    const root = document.getElementById('vgCadRoot');
    if (!root) return;
    root.classList.add('vg-tech');
    const editar = podeEditar();
    const ponto = pontoAtual();
    root.innerHTML = `
      <h2>Cadastro video game</h2>
      ${st.erroSetup ? `<div class="vg-setup">${esc(st.erroSetup)}</div>` : ''}
      <div class="vg-barra">
        <label>GERENTE<select id="vgCadPonto">${opcoesGerentes()}</select></label>
        ${editar ? `<button type="button" class="btn" data-vg="ger-novo">Novo gerente</button>` : ''}
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
    const cad = historicoDaMaquina(m.id);
    return `
      <div class="vg-maq">
        <div class="vg-maq-topo"><span>${ICONE}${esc(m.nome)}${m.jogo ? ` <span class="vg-sub">· ${esc(m.jogo)}</span>` : ''}</span>
          ${editar ? `<span class="vg-maq-btns">
            <button type="button" class="btn ghost sm" data-vg="maquina-editar" data-id="${id}">Editar</button>
            <button type="button" class="btn ghost sm" data-vg="maquina-historico" data-id="${id}" title="Lançar as leituras antigas anotadas no caderno">Histórico</button>
            <button type="button" class="btn ghost sm" data-vg="maquina-trocar-ponto" data-id="${id}" title="Passar este video game para outro gerente">Trocar gerente</button>
            <button type="button" class="btn ghost sm" data-vg="maquina-trocar-jogo" data-id="${id}" title="Trocar o jogo deste video game">Trocar jogo</button>
            <button type="button" class="btn ghost sm" data-vg="maquina-remover" data-id="${id}" title="Retirar este video game">Retirar</button></span>` : ''}
        </div>
        <div class="vg-det">
          <span>Local: <b>${esc(m.local || '—')}</b></span>
          <span>Instalado em: <b>${esc(dataBR(m.instalada_em) || '—')}</b></span>
          <span>Leitura inicial: <b>di ${esc(centavosTxt(Number(m.di_inicial) || 0))} · ds ${esc(centavosTxt(Number(m.ds_inicial) || 0))}</b></span>
          <span>Última prestação: <b>${lu ? `${esc(dataBR(ult.data))}${ehHistorico(ult) ? ' (caderno)' : ''} (di ${esc(centavosTxt(lu.di))} · ds ${esc(centavosTxt(lu.ds))})` : 'ainda não tem'}</b></span>
          ${cad.length ? `<span>Caderno: <b>${cad.length === 1 ? `1 leitura (${esc(dataBR(cad[0].data))})` : `${cad.length} leituras (${esc(dataBR(cad[0].data))} a ${esc(dataBR(cad[cad.length - 1].data))})`}</b></span>` : ''}
        </div>
      </div>`;
  }

  function htmlCadAntiga(m) {
    const det = [m.jogo, m.local].filter(Boolean).map(esc).join(' · ');
    return `<div class="vg-ret-item">${ICONE} <strong>${esc(m.nome)}</strong>${det ? ' · ' + det : ''}
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
    // Período de vendas: da leitura anterior do gerente até esta
    const iP = st.prestacoes.findIndex(x => x.uid === p.uid);
    const antP = iP >= 0 ? st.prestacoes[iP + 1] : null;
    const iniP = antP ? dia(antP.data) : st.maquinas.filter(m => (p.dados?.leituras || []).some(l => l.maquina_id === m.id) && m.instalada_em).map(m => dia(m.instalada_em)).sort()[0];
    const nP = iniP ? entreDias(iniP, p.data) : 0;
    const periodo = iniP && nP > 0 ? `${dataCurta(iniP)} → ${dataBR(p.data)} (${nP} dias)` : '';
    return {
      titulo: rotuloDe(gerente, p.dados?.ponto_nome || ponto?.nome) || 'Gerente',
      empresa: st.empresaNome || window.getCompany?.() || '',
      data: p.data, linhas, periodo,
      comissoes: Array.isArray(p.dados?.comissoes) ? p.dados.comissoes : [],
      saldo: Number(p.saldo) || 0,
      despesas: (p.dados?.despesas || []).filter(d => Number(d.valor)),
      totalDespesas: despesasDe(p),
      negativoAnterior: Number(p.negativo_anterior) || 0,
      negativoNovo: Number(p.negativo_novo) || 0,
      liquido, pagamentos,
      restam: liquido - totalPago(p.dados?.pagamentos)
    };
  }

  function desenharImagem(info) {
    const W = 1080, M = 48, IN = M + 24, FIM = W - M - 24;
    const COL = { venda: 616, premios: 812, saldo: FIM };
    const COR = { fundo: '#0d1320', ouro: '#22d3ee', ouroClaro: '#67e8f9', soma: '#e6f7fb' };
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
      ctx.fillStyle = COR.fundo;
      ctx.fillRect(0, 0, W, 196);
      ctx.fillStyle = COR.ouro;
      ctx.fillRect(0, 190, W, 6);
      txt('PRESTAÇÃO DE CONTAS · VIDEO GAME', M, 62, { tam: 22, peso: 700, cor: COR.ouroClaro });
      txt(info.titulo, M, 126, { tam: 52, peso: 800, cor: '#ffffff', max: W - 2 * M - 250 });
      txt(dataBR(info.data), W - M, 126, { tam: 40, peso: 700, cor: '#ffffff', alinhar: 'right' });
      txt(info.periodo ? `${info.empresa} · período ${info.periodo}` : info.empresa, M, 170, { tam: 24, peso: 500, cor: '#cbd5e1', max: 700 });
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
      caixa(M, y, W - 2 * M, 76, 12, COR.soma);
      txt('SOMA', IN, y + 49, { tam: 28, peso: 800, cor: COR.fundo });
      txt(brl(somaVenda), COL.venda, y + 49, { tam: 28, peso: 700, cor: COR.fundo, alinhar: 'right', max: 172 });
      txt(brl(somaPremios), COL.premios, y + 49, { tam: 28, peso: 700, cor: '#b91c1c', alinhar: 'right', max: 172 });
      txt(brl(info.saldo), COL.saldo, y + 49, { tam: 30, peso: 800, cor: info.saldo < 0 ? '#b91c1c' : COR.fundo, alinhar: 'right', max: 176 });
      y += 76 + 32;

      // Comissões sobre a soma e líquido
      const linhas = [];
      const resultado = info.saldo - info.totalDespesas;
      if (info.totalDespesas) {
        info.despesas.forEach(d => linhas.push([`Despesa · ${d.descricao}`, '− ' + brl(d.valor), '#b91c1c']));
        linhas.push(['Resultado depois das despesas', brl(resultado), resultado < 0 ? '#b91c1c' : '#0f172a']);
      }
      if (info.negativoAnterior) {
        linhas.push(['Negativo anterior (abate da base)', '− ' + brl(info.negativoAnterior), '#b45309']);
        linhas.push(['Base das comissões', brl(Math.max(resultado - info.negativoAnterior, 0)), '#0f172a']);
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
      const [rotulo, cor] = r > 0 ? ['RESTA ACERTAR', COR.fundo] : r < 0 ? ['EMPRESA DEVE AO GERENTE', '#b45309'] : ['QUITADO', '#166534'];
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
    if (ehHistorico(p)) { aviso('Leitura do caderno não tem imagem de prestação.'); return; }
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
      const cd = e.target.getAttribute('data-desp');
      if (cd && st.form) {
        const d = (st.form.despesas || []).find(x => x.id === e.target.getAttribute('data-id'));
        if (!d) return;
        d[cd] = cd === 'valorTxt' ? mascarar(e.target) : e.target.value;
        st.form.despTocada = true;
        st.form.sujo = true;
        recalcular();
        return;
      }
      const campo = e.target.getAttribute('data-leitura');
      if (!campo) return;
      const l = st.form.linhas.find(x => x.maquina_id === e.target.getAttribute('data-id'));
      if (!l) return;
      l[campo] = mascarar(e.target);
      l.tocado = true;
      st.form.sujo = true;
      recalcular();
    });
    root.addEventListener('change', async e => {
      if (e.target.id === 'vgPontoForm') {
        // Troca de gerente dentro do formulário (só na prestação nova)
        st.pontoId = e.target.value;
        st.tentouSalvar = false;
        try { await carregarDoPonto(); } catch (err) { aviso('Não foi possível carregar: ' + (err.message || err), 'error'); }
        novoFormulario();
        st.etapa = 1;
        render();
      } else if (e.target.id === 'vgPeriodo') {
        st.periodo = PERIODOS[e.target.value] ? e.target.value : '3m';
        render();
      } else if (e.target.id === 'vgData') {
        st.form.data = e.target.value;
        st.form.sujo = true;
      } else if (e.target.hasAttribute('data-zerado')) {
        const l = st.form.linhas.find(x => x.maquina_id === e.target.getAttribute('data-id'));
        if (l) { l.zerado = e.target.checked; st.form.sujo = true; recalcular(); }
      }
    });
    root.addEventListener('click', e => {
      const btn = e.target.closest('[data-vg]');
      if (btn) executar(btn.getAttribute('data-vg'), btn.getAttribute('data-id'), btn);
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
  function executar(acao, id, btn) {
    const acoes = {
      'periodo': () => { st.periodo = PERIODOS[id] ? id : '3m'; render(); },
      'filtro': () => { st.filtro = id || 'todos'; render(); },
      'ger-hist': () => { if (st.abertos.has(id)) st.abertos.delete(id); else st.abertos.add(id); render(); },
      'ger-nova': () => abrirFormulario(id),
      'maq-info': () => abrirPopMaq(btn, id),
      'prest-det': () => {
        const tr = document.querySelector(`#vgRoot tr[data-det="${CSS.escape(String(id))}"]`);
        if (!tr) return;
        tr.hidden = !tr.hidden;
        btn.textContent = tr.hidden ? '+' : '−';
        btn.setAttribute('aria-expanded', String(!tr.hidden));
      },
      'ger-novo': () => abrirDialogoPonto(null),
      'ger-editar': () => abrirDialogoPonto(pontoAtual()),
      'ger-abrir': () => selecionarGerente(id),
      'maquina-nova': () => abrirDialogoMaquina(null),
      'maquina-editar': () => abrirDialogoMaquina(id),
      'maquina-remover': () => removerMaquina(id),
      'maquina-trocar-ponto': () => abrirDialogoTroca(id, 'ponto'),
      'maquina-trocar-jogo': () => abrirDialogoTroca(id, 'jogo'),
      'maquina-historico': () => abrirHistorico(id),
      'despesa-nova': () => {
        if (!st.form || st.form.modo === 'ver') return;
        (st.form.despesas ||= []).push({ id: novoId(), descricao: '', valorTxt: '' });
        st.form.sujo = true;
        redesenharDespesas(true);
      },
      'despesa-remover': () => {
        if (!st.form) return;
        st.form.despesas = (st.form.despesas || []).filter(d => d.id !== id);
        st.form.sujo = true;
        redesenharDespesas(false);
      },
      'pagamento-novo': () => abrirDialogoPagamento(null),
      'pagamento-editar': () => abrirDialogoPagamento(id),
      'pagamento-excluir': () => excluirPagamento(id),
      'salvar': salvarPrestacao,
      'form-abrir': abrirFormulario,
      'form-fechar': fecharFormulario,
      'etapa': () => irEtapa(id),
      'etapa-proxima': proximaEtapa,
      'etapa-voltar': () => irEtapa(st.etapa - 1),
      'form-novo': () => { st.tentouSalvar = false; novoFormulario(); render(); },
      'prest-abrir': () => comGerente(btn?.dataset.ponto, () => abrirPrestacao(id)),
      'prest-excluir': () => comGerente(btn?.dataset.ponto, () => excluirPrestacao(id)),
      'prest-imagem': () => comGerente(btn?.dataset.ponto, () => abrirImagem(id))
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
    st.formAberto = false;
    try {
      await carregarPontos();
      await carregarDoPonto();
    } catch (err) { erroAoCarregar(err); }
    if (!st.erroSetup) await atualizarMapa();
    novoFormulario();
    render();
  }
  // ---------- formulário em etapas ----------
  async function abrirFormulario(pontoId) {
    if (!st.pontos.length || !podeEditar()) return;
    const alvo = (pontoId && st.pontos.some(p => p.id === pontoId)) ? pontoId : (st.pontoId || st.pontos[0].id);
    st.pontoId = alvo;
    try { await carregarDoPonto(); } catch (err) { aviso('Não foi possível carregar: ' + (err.message || err), 'error'); return; }
    st.tentouSalvar = false;
    novoFormulario();
    st.formAberto = true;
    st.etapa = 1;
    render();
  }
  // Ações do histórico: carrega o gerente da prestação antes de abrir, excluir ou gerar a imagem
  async function comGerente(pontoId, fn) {
    if (pontoId) {
      st.pontoId = pontoId;
      try { await carregarDoPonto(); } catch (err) { aviso('Não foi possível carregar: ' + (err.message || err), 'error'); return; }
    }
    return fn();
  }
  function fecharFormulario() {
    const f = st.form;
    if (f && f.modo !== 'ver' && f.sujo && !confirm('Fechar sem salvar? O que foi digitado nesta prestação será perdido.')) return;
    st.formAberto = false;
    st.tentouSalvar = false;
    novoFormulario();
    render();
  }
  function irEtapa(n) {
    st.etapa = Math.min(Math.max(1, Number(n) || 1), ETAPAS.length);
    render();
    document.querySelector('#vgRoot .vg-ov-corpo')?.scrollTo(0, 0);
  }
  // Confere a etapa antes de seguir; devolve a mensagem de erro ('' se estiver tudo certo)
  function conferirEtapa(n) {
    const f = st.form;
    if (!f || f.modo === 'ver') return '';
    if (n === 1) {
      if (!pontoAtual()) return 'Selecione o gerente.';
      if (!f.linhas.length) return 'Este gerente não tem video game ativo. Cadastre no menu Prestações → Cadastro video game.';
      if (f.trava) return '';
      const d = document.getElementById('vgData')?.value || '';
      if (!d) return 'Informe a data da leitura.';
      f.data = d;
      const ultima = st.prestacoes[0];
      if (f.modo === 'nova' && ultima && d <= dia(ultima.data)) return `A data precisa ser depois da última prestação deste gerente (${dataBR(ultima.data)}).`;
      const penultima = st.prestacoes[1];
      if (f.modo === 'editar' && penultima && d <= dia(penultima.data)) return `A data precisa ser depois da prestação anterior (${dataBR(penultima.data)}).`;
      const m = f.linhas.map(l => st.maquinas.find(x => x.id === l.maquina_id)).find(x => x?.instalada_em && d < dia(x.instalada_em));
      if (m) return `A data da leitura é anterior à instalação de ${m.nome} (${dataBR(m.instalada_em)}).`;
      return '';
    }
    if (n === 2 && !f.trava && Object.keys(avaliarLinhas().erros).length) {
      st.tentouSalvar = true;
      recalcular();
      return 'Preencha ou corrija as leituras destacadas.';
    }
    if (n === 3) {
      const { erro } = avaliarDespesas();
      if (erro) { f.despTocada = true; recalcular(); return erro; }
    }
    return '';
  }
  function proximaEtapa() {
    const erro = conferirEtapa(st.etapa);
    if (erro) { definir(document.getElementById('vgMsg'), erro); return; }
    irEtapa(st.etapa + 1);
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
    if (visivel('pageVideoGame')) { await atualizarMapa(); render(); }
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
