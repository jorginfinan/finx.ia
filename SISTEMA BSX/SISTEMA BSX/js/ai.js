// js/ai.js — Chat moderno com IA CONTEXTUAL MELHORADA
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const byId = (id) => document.getElementById(id);
  const el = {
    panel: byId('aiPanel'),
    handle: byId('aiDragHandle'),
    resize: byId('aiResizeHandle'),
    msgs: byId('aiMsgs'),
    typing: byId('aiTyping'),
    chips: byId('aiChips'),
    form: byId('aiForm'),
    input: byId('aiInput'),
    send: byId('aiSend'),
    btnAI: byId('btnAI'),
    btnClose: byId('aiClose'),
    btnClear: byId('aiClear'),
    btnPin: byId('aiPin'),
    tag: byId('aiCompanyTag')
  };

  if (!el.panel) return;

  // ===== CONTEXTO CONVERSACIONAL (NOVO!) =====
  const conversationContext = {
    lastTopic: null,        // último tópico discutido
    lastEntity: null,       // última entidade mencionada (gerente, ficha, etc)
    lastNumbers: [],        // últimos números mencionados
    lastAction: null,       // última ação solicitada
    turnHistory: []         // últimas 5 perguntas
  };

  // ===== Estado e persistência =====
  const getCompany = () =>
    (localStorage.getItem('CURRENT_COMPANY') || 'BSX').toUpperCase();
  const histKey = () => `bsx_ai_history_${getCompany()}`;
  const uiKey = 'bsx_ai_ui';

  const state = {
    pinned: true,
    pos: null,
    size: null,
    history: loadHistory()
  };

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(histKey()) || '[]'); }
    catch { return []; }
  }
  function saveHistory() {
    try { localStorage.setItem(histKey(), JSON.stringify(state.history)); } catch {}
  }
  function loadUI() {
    try { return JSON.parse(localStorage.getItem(uiKey) || '{}'); } catch { return {}; }
  }
  function saveUI() {
    const data = loadUI();
    data.pinned = state.pinned;
    if (state.pos) data.pos = state.pos;
    if (state.size) data.size = state.size;
    localStorage.setItem(uiKey, JSON.stringify(data));
  }

  // ===== Util =====
  const now = () => new Date();
  const time = (d) => {
    try {
      if (!d) return '';
      const dateObj = d instanceof Date ? d : new Date(d);
      if (isNaN(dateObj.getTime())) return '';
      if (typeof dateObj.toLocaleTimeString === 'function') {
        try {
          return dateObj.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
          });
        } catch (e) {}
      }
      const horas = String(dateObj.getHours()).padStart(2, '0');
      const minutos = String(dateObj.getMinutes()).padStart(2, '0');
      return `${horas}:${minutos}`;
    } catch (e) {
      return '';
    }
  };

  // ===== NLP MELHORADO - EXTRAÇÃO DE ENTIDADES =====
  function extractEntities(text) {
    const s = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    const entities = {
      gerentes: [],
      fichas: [],
      numeros: [],
      datas: [],
      formas: [],
      acoes: [],
      topicos: []
    };

    // Extrai nomes de gerentes (padrão: números seguidos de nome)
    const gerentePattern = /\b(\d{3})\s+([a-záéíóú]+)\b/gi;
    let match;
    while ((match = gerentePattern.exec(s)) !== null) {
      entities.gerentes.push(match[1] + ' ' + match[2].toUpperCase());
    }

    // Extrai fichas (números de 4 dígitos)
    const fichaPattern = /\bficha\s*(\d{4})\b|\b(\d{4})\b(?=\s|$)/gi;
    while ((match = fichaPattern.exec(s)) !== null) {
      const ficha = match[1] || match[2];
      if (ficha) entities.fichas.push(ficha);
    }

    // Extrai números gerais
    const numeroPattern = /\b\d+(?:[.,]\d+)?\b/g;
    while ((match = numeroPattern.exec(s)) !== null) {
      entities.numeros.push(match[0]);
    }

    // Extrai formas de pagamento
    if (s.includes('pix')) entities.formas.push('PIX');
    if (s.includes('dinheiro')) entities.formas.push('DINHEIRO');
    if (s.includes('cartao') || s.includes('cartão')) entities.formas.push('CARTÃO');

    // Extrai ações
    const acoes = {
      'mostrar|exibir|listar|ver': 'listar',
      'calcular|somar|total': 'calcular',
      'comparar|versus|vs': 'comparar',
      'maior|maximo|máximo': 'maior',
      'menor|minimo|mínimo': 'menor',
      'filtrar|selecionar': 'filtrar'
    };
    for (const [pattern, acao] of Object.entries(acoes)) {
      if (new RegExp(pattern).test(s)) {
        entities.acoes.push(acao);
        break;
      }
    }

    // Extrai tópicos
    const topicos = {
      'prestac(ao|ão|oes|ões)': 'prestacoes',
      'despesa': 'despesas',
      'financeir': 'financeiro',
      'venda': 'vendas',
      'ficha': 'fichas',
      'gerente': 'gerentes',
      'devedor|inadimpl': 'devedores',
      'aberto': 'abertos',
      'pagar': 'apagar'
    };
    for (const [pattern, topico] of Object.entries(topicos)) {
      if (new RegExp(pattern).test(s)) {
        entities.topicos.push(topico);
      }
    }

    return entities;
  }

  // ===== SISTEMA DE INFERÊNCIA CONTEXTUAL =====
  function resolveWithContext(text, entities) {
    const s = text.toLowerCase();
    
    // Se a pergunta é vaga, usa o contexto
    const vaguePatterns = [
      /^(e )?ele\??$/i,
      /^(e )?isso\??$/i,
      /^(e )?este\??$/i,
      /^(e )?este\s+\w+\??$/i,
      /^quanto\??$/i,
      /^qual\??$/i,
      /^quantos?\??$/i,
      /^(e )?depois\??$/i,
      /^(e )?agora\??$/i,
      /^continua/i
    ];

    const isVague = vaguePatterns.some(p => p.test(text.trim()));

    if (isVague || entities.gerentes.length === 0 && entities.fichas.length === 0) {
      // Tenta inferir do contexto
      if (conversationContext.lastEntity) {
        entities.gerentes = entities.gerentes.concat(
          conversationContext.lastEntity.gerentes || []
        );
        entities.fichas = entities.fichas.concat(
          conversationContext.lastEntity.fichas || []
        );
      }
      if (conversationContext.lastTopic && entities.topicos.length === 0) {
        entities.topicos.push(conversationContext.lastTopic);
      }
    }

    // Atualiza contexto
    if (entities.gerentes.length || entities.fichas.length) {
      conversationContext.lastEntity = {
        gerentes: entities.gerentes,
        fichas: entities.fichas
      };
    }
    if (entities.topicos.length) {
      conversationContext.lastTopic = entities.topicos[0];
    }
    if (entities.acoes.length) {
      conversationContext.lastAction = entities.acoes[0];
    }

    // Adiciona ao histórico de turnos
    conversationContext.turnHistory.unshift({
      text,
      entities,
      timestamp: Date.now()
    });
    if (conversationContext.turnHistory.length > 5) {
      conversationContext.turnHistory.pop();
    }

    return entities;
  }

  // ===== SISTEMA DE SINÔNIMOS E VARIAÇÕES =====
  function normalizarPergunta(text) {
    let s = text.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    // Sinônimos de ações
    const sinonimos = {
      // Ações de consulta
      'me diga|me diz|me fala|fala pra mim': 'mostre',
      'preciso saber|quero saber|gostaria de saber': 'qual',
      'pode me mostrar|consegue mostrar': 'mostre',
      
      // Ações de cálculo
      'faz a conta|calcula': 'calcule',
      'soma tudo|soma todos': 'total',
      
      // Entidades
      'gerenciador|responsavel|responsável': 'gerente',
      'boleto|cobranca|cobrança': 'prestacao',
      'gasto|custo|despesa': 'despesa',
      'entrada|recebimento': 'recebido',
      'saida|saída|pagamento': 'pago',
      
      // Quantificadores
      'quem tem mais|o maior|a maior': 'maior',
      'quem tem menos|o menor|a menor': 'menor',
      'todos|todas': 'total',
      
      // Tempo
      'esse mes|este mes|neste mes': 'mes atual',
      'mes passado|mes anterior': 'mes anterior',
      'hoje': 'dia atual'
    };

    for (const [pattern, replace] of Object.entries(sinonimos)) {
      s = s.replace(new RegExp(pattern, 'gi'), replace);
    }

    return s;
  }

  // ===== PROCESSAMENTO INTELIGENTE DE PERGUNTAS =====
  function smartProcessQuestion(text) {
    const normalized = normalizarPergunta(text);
    const entities = extractEntities(normalized);
    const contextEntities = resolveWithContext(text, entities);

    // Gera uma consulta enriquecida
    const enrichedQuery = {
      original: text,
      normalized,
      entities: contextEntities,
      intent: detectIntent(normalized, contextEntities),
      confidence: calculateConfidence(contextEntities)
    };

    return enrichedQuery;
  }

  // ===== DETECÇÃO DE INTENÇÃO =====
  function detectIntent(text, entities) {
    const s = text.toLowerCase();

    // Intenções específicas
    if (s.includes('maior') && (entities.topicos.includes('devedores') || s.includes('aberto'))) {
      return { type: 'maior_devedor', confidence: 0.9 };
    }
    if (s.includes('total') && entities.topicos.includes('prestacoes')) {
      return { type: 'total_prestacoes', confidence: 0.9 };
    }
    if (s.includes('total') && entities.topicos.includes('despesas')) {
      return { type: 'total_despesas', confidence: 0.9 };
    }
    if (s.includes('acima') || s.includes('estour') || s.includes('alert')) {
      return { type: 'despesas_acima', confidence: 0.85 };
    }
    if (entities.gerentes.length > 0) {
      if (entities.topicos.includes('prestacoes')) {
        return { type: 'prestacao_gerente', confidence: 0.9 };
      }
      if (entities.topicos.includes('despesas')) {
        return { type: 'despesas_gerente', confidence: 0.9 };
      }
      return { type: 'info_gerente', confidence: 0.7 };
    }
    if (entities.fichas.length > 0) {
      return { type: 'info_ficha', confidence: 0.85 };
    }
    if (s.includes('resumo') || s.includes('visao geral')) {
      return { type: 'resumo_geral', confidence: 0.8 };
    }

    return { type: 'desconhecido', confidence: 0.3 };
  }

  // ===== CÁLCULO DE CONFIANÇA =====
  function calculateConfidence(entities) {
    let score = 0.5; // base

    if (entities.gerentes.length > 0) score += 0.2;
    if (entities.fichas.length > 0) score += 0.15;
    if (entities.topicos.length > 0) score += 0.15;
    if (entities.acoes.length > 0) score += 0.1;

    return Math.min(score, 1.0);
  }

  // ===== GERAÇÃO DE RESPOSTAS CONTEXTUAIS =====
  function generateContextualResponse(query, ctx) {
    const { intent, entities, confidence } = query;

    // Se a confiança é baixa, pede esclarecimento
    if (confidence < 0.5) {
      return gerarPedidoEsclarecimento(query, ctx);
    }

    // Processa baseado na intenção
    switch (intent.type) {
      case 'maior_devedor':
        return processMaiorDevedor(ctx);
      
      case 'total_prestacoes':
        if (entities.gerentes.length > 0) {
          return processTotalPrestacaoGerente(entities.gerentes[0], ctx);
        }
        return processTotalPrestacoes(ctx);
      
      case 'total_despesas':
        if (entities.gerentes.length > 0) {
          return processTotalDespesasGerente(entities.gerentes[0], ctx);
        }
        return processTotalDespesas(ctx);
      
      case 'despesas_acima':
        return processDespesasAcima(ctx);
      
      case 'prestacao_gerente':
        return processPrestacaoGerente(entities.gerentes[0], ctx);
      
      case 'despesas_gerente':
        return processDespesasGerente(entities.gerentes[0], ctx);
      
      case 'info_ficha':
        return processInfoFicha(entities.fichas[0], ctx);
      
      case 'resumo_geral':
        return processResumoGeral(ctx);
      
      default:
        return processDefault(query, ctx);
    }
  }

  // ===== PROCESSADORES ESPECÍFICOS =====
  
  function processMaiorDevedor(ctx) {
    const p = ctx.prestacoes || [];
    if (!p.length) return 'Sem prestações abertas no momento.';
    
    const maiores = [...p]
      .sort((a,b) => (b.restante||0) - (a.restante||0))
      .slice(0, 5);
    
    const resp = maiores.map((x,i) => 
      `${i+1}. <strong>${x.gerente}</strong>: ${fmt(x.restante||0)} em aberto`
    ).join('<br>');
    
    return `<strong>Maiores valores em aberto:</strong><br><br>${resp}`;
  }

  function processTotalPrestacoes(ctx) {
    const p = ctx.prestacoes || [];
    if (!p.length) return 'Sem prestações abertas.';
    
    const total = p.reduce((a,b) => a + (b.valor||0), 0);
    const aberto = p.reduce((a,b) => a + (b.restante||0), 0);
    const recebido = p.reduce((a,b) => a + (b.recebido||0), 0);
    
    return `<strong>Resumo de Prestações:</strong><br><br>` +
      `• Total: ${fmt(total)}<br>` +
      `• Recebido: ${fmt(recebido)}<br>` +
      `• Em aberto: ${fmt(aberto)}`;
  }

  function processTotalPrestacaoGerente(gerente, ctx) {
    const p = (ctx.prestacoes || []).filter(x => 
      x.gerente && x.gerente.toLowerCase().includes(gerente.toLowerCase())
    );
    
    if (!p.length) return `Sem prestações para "${gerente}".`;
    
    const total = p.reduce((a,b) => a + (b.valor||0), 0);
    const aberto = p.reduce((a,b) => a + (b.restante||0), 0);
    
    return `<strong>${p[0].gerente}</strong>:<br><br>` +
      `• Total: ${fmt(total)}<br>` +
      `• Em aberto: ${fmt(aberto)}`;
  }

  function processTotalDespesas(ctx) {
    const d = ctx.despesas || [];
    if (!d.length) return 'Sem despesas nesta tela.';
    
    const total = d.reduce((a,b) => a + (Number(b.valor)||0), 0);
    const acima = d.filter(x => (x.diff||0) > 0);
    
    return `<strong>Despesas:</strong><br><br>` +
      `• Total: ${fmt(total)}<br>` +
      `• Acima do ideal: ${acima.length} itens`;
  }

  function processDespesasAcima(ctx) {
    const d = ctx.despesas || [];
    const acima = d.filter(x => (x.diff||0) > 0);
    
    if (!acima.length) return 'Nenhuma despesa acima do ideal!';
    
    const top = acima
      .sort((a,b) => (b.diff||0) - (a.diff||0))
      .slice(0, 10);
    
    const resp = top.map((x,i) => 
      `${i+1}. ${x.gerente} - Ficha ${x.ficha}: ${fmt(x.diff)} acima`
    ).join('<br>');
    
    return `<strong>Despesas acima do ideal (top 10):</strong><br><br>${resp}`;
  }

  function processInfoFicha(ficha, ctx) {
    const vendas = (ctx.vendas || []).filter(x => String(x.ficha) === String(ficha));
    const despesas = (ctx.despesas || []).filter(x => String(x.ficha) === String(ficha));
    
    if (!vendas.length && !despesas.length) {
      return `Sem dados para a ficha ${ficha}.`;
    }
    
    let resp = `<strong>Ficha ${ficha}:</strong><br><br>`;
    
    if (vendas.length) {
      const totalBruta = vendas.reduce((a,b) => a + (Number(b.bruta)||0), 0);
      resp += `• Vendas: ${fmt(totalBruta)}<br>`;
    }
    
    if (despesas.length) {
      const totalDesp = despesas.reduce((a,b) => a + (Number(b.valor)||0), 0);
      resp += `• Despesas: ${fmt(totalDesp)}`;
    }
    
    return resp;
  }

  function processResumoGeral(ctx) {
    const parts = [];
    
    if (ctx.dashboard) {
      parts.push(`<strong>Painel:</strong><br>` +
        `• A receber: ${fmt(ctx.dashboard.totalValor||0)}<br>` +
        `• Recebido: ${fmt(ctx.dashboard.totalRec||0)}<br>` +
        `• Em aberto: ${fmt(ctx.dashboard.totalAberto||0)}`);
    }
    
    if (ctx.financeiro && ctx.financeiro.length) {
      const rec = ctx.financeiro.filter(x => /RECEBIDO/i.test(x.status));
      const pag = ctx.financeiro.filter(x => /PAGO/i.test(x.status));
      parts.push(`<strong>Financeiro:</strong><br>` +
        `• Recebido: ${fmt(rec.reduce((a,b) => a + (Number(b.valor)||0), 0))}<br>` +
        `• Pago: ${fmt(pag.reduce((a,b) => a + (Number(b.valor)||0), 0))}`);
    }
    
    return parts.length ? parts.join('<br><br>') : 'Sem dados para resumo geral.';
  }

  function gerarPedidoEsclarecimento(query, ctx) {
    const sugestoes = [];
    
    if (ctx.prestacoes && ctx.prestacoes.length) {
      sugestoes.push('• Maiores valores em aberto');
      sugestoes.push('• Total por gerente');
    }
    
    if (ctx.despesas && ctx.despesas.length) {
      sugestoes.push('• Despesas acima do ideal');
      sugestoes.push('• Total de despesas');
    }
    
    return `Hmm, não entendi bem...<br><br>` +
      `Você pode tentar:<br>` +
      sugestoes.join('<br>') +
      `<br><br>Ou seja mais específico na pergunta!`;
  }

  function processDefault(query, ctx) {
    // Fallback inteligente baseado no que foi detectado
    if (query.entities.topicos.includes('prestacoes')) {
      return processTotalPrestacoes(ctx);
    }
    if (query.entities.topicos.includes('despesas')) {
      return processTotalDespesas(ctx);
    }
    
    return gerarPedidoEsclarecimento(query, ctx);
  }

  // ===== FUNÇÕES AUXILIARES =====
  function fmt(n) {
    return 'R$ ' + (Number(n)||0).toFixed(2)
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
      .replace('.', ',')
      .replace(/,(\d{2})$/, ',$1');
  }

  // ===== COLETA DE CONTEXTO (mantém original) =====
  function collectContext() {
    const ctx = { dashboard: null, prestacoes: [], despesas: [], financeiro: [], vendas: [], saldo: null };

    // Função auxiliar para extrair número de texto formatado
    function parseValor(texto) {
      if (!texto) return 0;
      // Remove tudo exceto números, vírgula e ponto
      // Exemplo: "R$ 9.057,97 (75,82%)" -> "9.057,97"
      const match = texto.match(/[\d.,]+/);
      if (!match) return 0;
      // Converte: remove pontos de milhar, troca vírgula por ponto
      return parseFloat(match[0].replace(/\./g, '').replace(',', '.')) || 0;
    }

    // Dashboard
    try {
      const totValor = document.getElementById('dashResTotValor')?.innerText || '';
      const totRec = document.getElementById('dashResTotRec')?.innerText || '';
      const totAber = document.getElementById('dashResTotAber')?.innerText || '';
      if (totValor || totRec || totAber) {
        ctx.dashboard = {
          totalValor: parseValor(totValor),
          totalRec: parseValor(totRec),
          totalAberto: parseValor(totAber)
        };
      }
    } catch {}

    // Prestações
    try {
      if (typeof window.getPrestacoes === 'function') {
        const arr = window.getPrestacoes() || [];
        ctx.prestacoes = arr.filter(p => !p.fechado).map(p => ({
          id: p.id,
          gerente: p.gerenteNome || '',
          valor: Number(p?.resumo?.aPagar || 0),
          restante: Number(p?.resumo?.restam || 0),
          recebido: Number(p?.resumo?.pagos || 0)
        }));
      }
    } catch {}

    // Despesas
    try {
      if (typeof window.getDespesas === 'function') {
        const arr = window.getDespesas() || [];
        ctx.despesas = arr.map(d => ({
          gerente: d.gerenteNome || d.gerente || '',
          ficha: d.ficha || '',
          valor: Number(d.valor || 0),
          diff: Number(d.diff || 0)
        }));
      }
    } catch {}

    // Financeiro
    try {
      if (Array.isArray(window.lanc)) {
        ctx.financeiro = window.lanc.map(l => ({
          gerente: l.gerente || '',
          valor: Number(l.valor || 0),
          status: l.status || '',
          forma: l.forma || ''
        }));
      }
    } catch {}

    // Vendas
    try {
      if (Array.isArray(window.vendas)) {
        ctx.vendas = window.vendas.map(v => ({
          ficha: v.ficha || '',
          mes: v.ym || v.mes || '',
          bruta: Number(v.bruta || 0),
          liquida: Number(v.liquida || v.liquido || 0)
        }));
      }
    } catch {}

    return ctx;
  }

  // ===== CHAMADA PARA LLM (mantém original com fallback melhorado) =====
  async function askLLM(question) {
    const ctx = collectContext();
    
    // Processa com o sistema inteligente
    const query = smartProcessQuestion(question);
    
    // Gera resposta contextual
    const answer = generateContextualResponse(query, ctx);
    
    return answer;
  }

  // ===== UI (mantém original) =====
  function openPanel() {
    el.panel.classList.remove('is-hidden');
    el.input?.focus();
    renderCompanyTag();
    renderGreeting();
    const ui = loadUI();
    if (ui.pos) {
      el.panel.style.right = 'auto';
      el.panel.style.bottom = 'auto';
      el.panel.style.left = (ui.pos.x || 40) + 'px';
      el.panel.style.top  = (ui.pos.y || 40) + 'px';
      state.pos = ui.pos;
      state.pinned = !!ui.pinned;
      updatePin();
    }
    if (ui.size) {
      el.panel.style.width  = (ui.size.w || 380) + 'px';
      el.panel.style.height = (ui.size.h || 520) + 'px';
      state.size = ui.size;
    }
  }

  function closePanel() {
    el.panel.classList.add('is-hidden');
  }

  function renderCompanyTag(){
    const c = getCompany();
    el.tag.textContent = `• ${c}`;
  }

  function scrollBottom() {
    el.msgs.scrollTop = el.msgs.scrollHeight;
  }

  function bubble({ who, text, ts }) {
    const li = document.createElement('div');
    li.className = `ai__msg ${who}`;
    li.innerHTML = `
      <div class="bubble">
        ${text}
        <span class="meta">${time(ts || now())}</span>
      </div>
    `;
    return li;
  }

  function renderHistory() {
    el.msgs.innerHTML = '';
    state.history.forEach(m => el.msgs.appendChild(bubble(m)));
    scrollBottom();
  }

  function renderChips() {
    const chips = [
      'Quem tem maior valor em aberto?',
      'Total de despesas acima do ideal',
      'Resumo geral',
      'Ajuda'
    ];
    el.chips.innerHTML = '';
    chips.forEach(t => {
      const b = document.createElement('button');
      b.type='button'; b.className='ai__chip'; b.textContent=t;
      b.onclick = () => sendText(t);
      el.chips.appendChild(b);
    });
  }

  function renderGreeting() {
    const c = getCompany();
    const nice = { BSX:'BSX', BETPLAY:'BetPlay', EMANUEL:'Emanuel' }[c] || c;
    el.msgs.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'ai__msg bot';
    row.innerHTML = `<div class="bubble">Olá! Sou sua assistente inteligente da <strong>${nice}</strong>.<br><br>` +
      `Faça perguntas naturais como:<br>` +
      `• "Quem está devendo mais?"<br>` +
      `• "Total de despesas do mês"<br>` +
      `• "Resumo geral"<br><br>` +
      `Ou use as sugestões abaixo!</div>`;
    el.msgs.appendChild(row);
    renderChips();
    setTimeout(() => el.input?.focus(), 40);
  }

  function pushUser(text){
    const msg = { who:'me', text: esc(text), ts: now() };
    state.history.push(msg); saveHistory();
    el.msgs.appendChild(bubble(msg));
    scrollBottom();
  }

  function pushBot(text){
    const msg = { who:'bot', text, ts: now() };
    state.history.push(msg); saveHistory();
    el.msgs.appendChild(bubble(msg));
    scrollBottom();
  }

  function esc(s) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;',
      '`': '&#x60;',
      '=': '&#x3D;'
    };
    return String(s ?? '').replace(/[&<>"'`=\/]/g, m => map[m]);
  }

  function showTyping(on){
    el.typing.classList.toggle('is-hidden', !on);
    scrollBottom();
  }

  async function streamBotText(fullText){
    const parts = fullText.split(' ');
    let acc = '';
    const start = { who:'bot', text:'', ts: now() };
    const node = bubble(start);
    const bubbleEl = node.querySelector('.bubble');
    const contentSpan = document.createElement('span');
    bubbleEl.insertBefore(contentSpan, bubbleEl.firstChild);
    el.msgs.appendChild(node);
    scrollBottom();

    for (let i=0;i<parts.length;i++){
      acc += (i? ' ':'') + parts[i];
      contentSpan.innerHTML = acc;
      await wait(25 + Math.random()*25);
      scrollBottom();
    }
    state.history.push({ who:'bot', text: fullText, ts: now() }); saveHistory();
  }

  const wait = (ms)=> new Promise(r=>setTimeout(r,ms));

  async function sendText(text){
    const t = String(text||'').trim();
    if (!t) return;

    if (t === '/limpar'){ state.history = []; saveHistory(); renderHistory(); return; }
    if (t === '/ajuda'){ 
      pushBot(`🤖 <strong>Assistente Inteligente</strong><br><br>` +
        `Faça perguntas naturais! Entendo:<br>` +
        `• "Quem deve mais?"<br>` +
        `• "Total de despesas"<br>` +
        `• "Ficha 0301"<br>` +
        `• "Resumo geral"<br><br>` +
        `Comandos: <code>/limpar</code>`);
      return;
    }

    pushUser(t);
    showTyping(true);
    try{
      const answer = await askLLM(t);
      showTyping(false);
      await streamBotText(answer);
    }catch(e){
      console.error(e);
      showTyping(false);
      pushBot('Ops, algo deu errado. Tente novamente.');
    }
  }

  // ===== Drag & Resize (mantém original) =====
  function clamp(val, min, max){ return Math.max(min, Math.min(max, val)); }

  (function dragger(){
    let sx=0, sy=0, ox=0, oy=0, dragging=false;
    el.handle.addEventListener('mousedown', (ev)=>{
      dragging = true;
      sx = ev.clientX; sy = ev.clientY;
      const rect = el.panel.getBoundingClientRect();
      ox = rect.left; oy = rect.top;
      ev.preventDefault();
    });
    window.addEventListener('mousemove', (ev)=>{
      if (!dragging) return;
      const nx = ox + (ev.clientX - sx);
      const ny = oy + (ev.clientY - sy);
      const maxX = window.innerWidth - 120, maxY = window.innerHeight - 80;
      el.panel.style.left = clamp(nx, 8, maxX) + 'px';
      el.panel.style.top  = clamp(ny, 8, maxY) + 'px';
      el.panel.style.right = 'auto';
      el.panel.style.bottom = 'auto';
    });
    window.addEventListener('mouseup', ()=>{
      if (!dragging) return;
      dragging = false;
      const rect = el.panel.getBoundingClientRect();
      state.pos = { x: Math.round(rect.left), y: Math.round(rect.top) };
      state.pinned = false;
      saveUI(); updatePin();
    });
  })();

  (function resizer(){
    let sw=0, sh=0, sx=0, sy=0, resizing=false;
    el.resize.addEventListener('mousedown', (ev)=>{
      resizing=true;
      const rect = el.panel.getBoundingClientRect();
      sw = rect.width; sh = rect.height; sx = ev.clientX; sy = ev.clientY;
      ev.preventDefault();
    });
    window.addEventListener('mousemove', (ev)=>{
      if (!resizing) return;
      const w = clamp(sw + (ev.clientX - sx), 300, Math.min(700, window.innerWidth - 24));
      const h = clamp(sh + (ev.clientY - sy), 360, Math.min(900, window.innerHeight - 24));
      el.panel.style.width = w + 'px';
      el.panel.style.height = h + 'px';
    });
    window.addEventListener('mouseup', ()=>{
      if (!resizing) return;
      resizing=false;
      const rect = el.panel.getBoundingClientRect();
      state.size = { w: Math.round(rect.width), h: Math.round(rect.height) };
      saveUI();
    });
  })();

  function updatePin(){
    el.btnPin.textContent = state.pinned ? '📌' : '📍';
  }

  // ===== Eventos =====
  el.btnAI?.addEventListener('click', openPanel);
  el.btnClose?.addEventListener('click', closePanel);
  el.btnClear?.addEventListener('click', ()=>{ state.history=[]; saveHistory(); renderHistory(); });
  el.btnPin?.addEventListener('click', ()=>{
    state.pinned = !state.pinned;
    if (state.pinned){
      el.panel.style.left=''; el.panel.style.top='';
      el.panel.style.right='24px'; el.panel.style.bottom='24px';
      state.pos = null;
    }
    saveUI(); updatePin();
  });

  el.form?.addEventListener('submit', (ev)=>{
    ev.preventDefault();
    sendText(el.input.value); el.input.value='';
  });
  el.input?.addEventListener('keydown', (ev)=>{
    if (ev.key==='Enter' && !ev.shiftKey){ ev.preventDefault(); el.form.requestSubmit(); }
    if (ev.key==='Escape'){ closePanel(); }
  });

  window.addEventListener('keydown', (ev)=>{
    if (ev.ctrlKey && ev.key.toLowerCase()==='k'){ ev.preventDefault(); openPanel(); el.input.focus(); }
  });

  (function init(){
    const ui = loadUI();
    if (ui.pinned === false){ state.pinned = false; }
    updatePin();
    if (!state.history.length){
      state.history.push({
        who:'bot',
        text:`Olá! 👋 Sou sua assistente inteligente.<br><br>` +
          `Faça perguntas naturais como:<br>` +
          `• "Quem deve mais?"<br>` +
          `• "Total de despesas"<br>` +
          `• "Resumo geral"`,
        ts: now()
      });
      saveHistory();
    }
    renderCompanyTag();
    renderHistory();
  })();

  console.log('🤖 AI Contextual carregada com sucesso!');
})();