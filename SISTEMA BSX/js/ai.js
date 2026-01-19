// js/ai.js — Assistente IA FINX v3.0 - Analytics Avançado
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

  // ===== CONTEXTO CONVERSACIONAL AVANÇADO =====
  const conversationContext = {
    lastTopic: null,
    lastEntity: null,
    lastPeriodo: null,
    lastGerente: null,
    lastNumbers: [],
    lastAction: null,
    turnHistory: [],
    suggestedFollowups: []
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

  // ===== UTILITÁRIOS =====
  const now = () => new Date();
  const time = (d) => {
    try {
      if (!d) return '';
      const dateObj = d instanceof Date ? d : new Date(d);
      if (isNaN(dateObj.getTime())) return '';
      return dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  function fmt(n) {
    return 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  }

  function fmtPerc(n) {
    return (Number(n) || 0).toFixed(1) + '%';
  }

  function fmtData(d) {
    if (!d) return '';
    
    // Se for string no formato YYYY-MM-DD, parse manualmente para evitar problema de fuso horário
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [ano, mes, dia] = d.split('-').map(Number);
      return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
    }
    
    // Se for string com data e hora, ou Date object
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('pt-BR');
  }

  function fmtNum(n) {
    return (Number(n) || 0).toLocaleString('pt-BR');
  }

  // ===== PARSER DE PERÍODO MELHORADO =====
  const MESES = {
    'janeiro': 0, 'jan': 0,
    'fevereiro': 1, 'fev': 1,
    'marco': 2, 'março': 2, 'mar': 2,
    'abril': 3, 'abr': 3,
    'maio': 4, 'mai': 4,
    'junho': 5, 'jun': 5,
    'julho': 6, 'jul': 6,
    'agosto': 7, 'ago': 7,
    'setembro': 8, 'set': 8,
    'outubro': 9, 'out': 9,
    'novembro': 10, 'nov': 10,
    'dezembro': 11, 'dez': 11
  };

  function parsePeriodo(text) {
    const s = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth();

    // Semana passada
    if (s.includes('semana passada') || s.includes('ultima semana') || s.includes('semana anterior')) {
      const inicioSemanaPassada = new Date(hoje);
      inicioSemanaPassada.setDate(hoje.getDate() - hoje.getDay() - 7);
      inicioSemanaPassada.setHours(0,0,0,0);
      const fimSemanaPassada = new Date(inicioSemanaPassada);
      fimSemanaPassada.setDate(inicioSemanaPassada.getDate() + 6);
      fimSemanaPassada.setHours(23,59,59,999);
      return { 
        tipo: 'semana', 
        inicio: inicioSemanaPassada, 
        fim: fimSemanaPassada, 
        label: `Semana passada (${fmtData(inicioSemanaPassada)} a ${fmtData(fimSemanaPassada)})`,
        passado: true
      };
    }

    // Esta semana
    if (s.includes('essa semana') || s.includes('esta semana') || s.includes('semana atual') || 
        (s.includes('semana') && !s.includes('passada') && !s.includes('anterior'))) {
      const inicioSemana = new Date(hoje);
      inicioSemana.setDate(hoje.getDate() - hoje.getDay());
      inicioSemana.setHours(0,0,0,0);
      const fimSemana = new Date(inicioSemana);
      fimSemana.setDate(inicioSemana.getDate() + 6);
      fimSemana.setHours(23,59,59,999);
      return { 
        tipo: 'semana', 
        inicio: inicioSemana, 
        fim: fimSemana, 
        label: `Esta semana (${fmtData(inicioSemana)} a ${fmtData(fimSemana)})`,
        passado: false
      };
    }

    // Mês específico
    for (const [nome, num] of Object.entries(MESES)) {
      if (s.includes(nome)) {
        const anoMatch = s.match(/20\d{2}/);
        const ano = anoMatch ? parseInt(anoMatch[0]) : anoAtual;
        return {
          tipo: 'mes',
          mes: num,
          ano: ano,
          inicio: new Date(ano, num, 1),
          fim: new Date(ano, num + 1, 0, 23, 59, 59),
          label: `${nome.charAt(0).toUpperCase() + nome.slice(1)}/${ano}`
        };
      }
    }

    // Trimestre
    if (s.includes('trimestre') || s.includes('ultimos 3 meses')) {
      const inicioTri = new Date(anoAtual, mesAtual - 2, 1);
      return {
        tipo: 'trimestre',
        inicio: inicioTri,
        fim: new Date(anoAtual, mesAtual + 1, 0, 23, 59, 59),
        label: 'Últimos 3 meses'
      };
    }

    // Períodos relativos
    if (s.includes('hoje')) {
      const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0);
      const fimHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
      return { tipo: 'dia', inicio: inicioHoje, fim: fimHoje, label: 'Hoje' };
    }

    if (s.includes('ontem')) {
      const ontem = new Date(hoje);
      ontem.setDate(hoje.getDate() - 1);
      return { tipo: 'dia', inicio: new Date(ontem.setHours(0,0,0,0)), fim: new Date(ontem.setHours(23,59,59,999)), label: 'Ontem' };
    }

    if (s.includes('mes passado') || s.includes('ultimo mes') || s.includes('mes anterior')) {
      const mesAnterior = mesAtual === 0 ? 11 : mesAtual - 1;
      const anoMesAnterior = mesAtual === 0 ? anoAtual - 1 : anoAtual;
      return {
        tipo: 'mes',
        mes: mesAnterior,
        ano: anoMesAnterior,
        inicio: new Date(anoMesAnterior, mesAnterior, 1),
        fim: new Date(anoMesAnterior, mesAnterior + 1, 0, 23, 59, 59),
        label: 'Mês passado'
      };
    }

    if (s.includes('este mes') || s.includes('mes atual') || s.includes('esse mes') || s.includes('deste mes')) {
      return {
        tipo: 'mes',
        mes: mesAtual,
        ano: anoAtual,
        inicio: new Date(anoAtual, mesAtual, 1),
        fim: new Date(anoAtual, mesAtual + 1, 0, 23, 59, 59),
        label: 'Este mês'
      };
    }

    if (s.includes('ano') || s.includes('anual')) {
      return {
        tipo: 'ano',
        ano: anoAtual,
        inicio: new Date(anoAtual, 0, 1),
        fim: new Date(anoAtual, 11, 31, 23, 59, 59),
        label: `Ano ${anoAtual}`
      };
    }

    // Default: mês atual
    return {
      tipo: 'mes',
      mes: mesAtual,
      ano: anoAtual,
      inicio: new Date(anoAtual, mesAtual, 1),
      fim: new Date(anoAtual, mesAtual + 1, 0, 23, 59, 59),
      label: 'Este mês'
    };
  }

  // ===== EXTRAÇÃO DE ENTIDADES AVANÇADA =====
  function extractEntities(text) {
    const s = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    return {
      periodo: parsePeriodo(text),
      gerentes: extrairNomesGerentes(s),
      fichas: (s.match(/\b\d{4}\b/g) || []),
      temComparativo: /compar|melhor|pior|mais|menos|maior|menor|ranking|top|primeiro|ultimo/.test(s),
      temTendencia: /tendencia|evolucao|cresceu|caiu|subiu|desceu|variacao|historico/.test(s),
      temAlerta: /alerta|problema|atencao|cuidado|critico|urgente|acima|estoura/.test(s),
      temSemana: /semana/.test(s),
      temMes: /mes|mensal/.test(s),
      temFrequencia: /frequencia|envio|quantas|vezes|regularidade|pontualidade/.test(s),
      temRendimento: /rendimento|performance|desempenho|resultado|lucro|prejuizo/.test(s),
      temRota: /rota|rotas/.test(s),
      temFinalizou: /finaliz|encerr|fechou|quitou|conclu/.test(s),
      temAberto: /aberto|pendente|devendo|deve|falta/.test(s),
      temAnalise: /analise|analisar|analisa|detalh|completo|relatorio/.test(s)
    };
  }

  function extrairNomesGerentes(s) {
    const matches = [];
    
    // Padrão 1: número + nome (ex: "016 Bruno")
    const pattern1 = /\b(\d{3})\s+([a-záéíóúãõ]+)\b/gi;
    let match;
    while ((match = pattern1.exec(s)) !== null) {
      matches.push({ numero: match[1], nome: match[2] });
    }
    
    // Padrão 2: "do/da/de [Nome]"
    const pattern2 = /\b(do|da|de)\s+([a-záéíóúãõ]+)\b/gi;
    while ((match = pattern2.exec(s)) !== null) {
      const nome = match[2];
      const ignorar = ['mês', 'mes', 'ano', 'semana', 'dia', 'período', 'periodo', 'caixa', 'sistema', 'valor', 'total', 'rota', 'rotas'];
      if (!ignorar.includes(nome.toLowerCase())) {
        matches.push({ numero: '', nome: nome });
      }
    }
    
    return matches;
  }

  // ===== DETECÇÃO DE INTENÇÃO AVANÇADA =====
  function detectIntent(text) {
    const s = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Comando de debug especial
    if (s.includes('/debug') || s.includes('debug caixa')) {
      return { type: 'debug_caixa', confidence: 1.0 };
    }
    
    // ===== NOVAS INTENÇÕES DE ANALYTICS =====
    const intents = [
      // Taxa de Quitação (quem paga 100%)
      { pattern: /taxa.*(quitacao|quitação|pagamento)/, type: 'frequencia_envio', confidence: 0.95 },
      { pattern: /quitacao|quitação/, type: 'frequencia_envio', confidence: 0.95 },
      { pattern: /quem.*(paga|pagou).*(tudo|completo|100|cem|total)/, type: 'frequencia_envio', confidence: 0.95 },
      { pattern: /quem.*(quita|quitou)/, type: 'frequencia_envio', confidence: 0.95 },
      { pattern: /quem.*(nao|não).*(paga|pagou)/, type: 'frequencia_envio', confidence: 0.9 },
      { pattern: /(paga|pagou).*(completo|total|tudo)/, type: 'frequencia_envio', confidence: 0.9 },
      { pattern: /frequencia.*(pagamento|quitacao)/, type: 'frequencia_envio', confidence: 0.9 },
      
      // Rendimento por Rota
      { pattern: /rendimento.*(rota|gerente)|performance.*(rota|gerente)/, type: 'rendimento_rota', confidence: 0.95 },
      { pattern: /(qual|quais).*(rota|gerente).*(melhor|pior|mais.*lucro|menos.*lucro)/, type: 'ranking_rendimento', confidence: 0.95 },
      { pattern: /lucro.*(rota|gerente)|prejuizo.*(rota|gerente)/, type: 'rendimento_rota', confidence: 0.9 },
      { pattern: /resultado.*(rota|por.*gerente)/, type: 'rendimento_rota', confidence: 0.9 },
      
      // Análise Completa de Gerente
      { pattern: /analise.*(complet|detalh).*(gerente|\d{3})/, type: 'analise_completa_gerente', confidence: 0.95 },
      { pattern: /relatorio.*(complet|detalh).*(gerente|\d{3})/, type: 'analise_completa_gerente', confidence: 0.95 },
      { pattern: /tudo.*sobre.*(gerente|\d{3})/, type: 'analise_completa_gerente', confidence: 0.9 },
      
      // Comparativo entre Gerentes
      { pattern: /compar.*(gerente|rota)/, type: 'comparativo_gerentes', confidence: 0.95 },
      { pattern: /diferenca.*entre.*(gerente|\d{3})/, type: 'comparativo_gerentes', confidence: 0.9 },
      
      // Tendências e Histórico
      { pattern: /tendencia|evolucao|historico.*(gerente|rota|geral)/, type: 'tendencia_historico', confidence: 0.9 },
      { pattern: /como.*evoluiu|como.*esta.*indo/, type: 'tendencia_historico', confidence: 0.85 },
      
      // Métricas do Caixa
      { pattern: /metricas.*caixa|kpi|indicadores/, type: 'metricas_caixa', confidence: 0.9 },
      
      // Intenções Semanais
      { pattern: /semana.*(quem|qual).*(deve|devendo|aberto|maior)/, type: 'devedor_semana', confidence: 0.95 },
      { pattern: /(quem|qual).*(deve|devendo|aberto|maior).*semana/, type: 'devedor_semana', confidence: 0.95 },
      { pattern: /semana.*(finaliz|encerr|fechou).*(aberto|pendente)/, type: 'finalizou_com_aberto', confidence: 0.95 },
      { pattern: /semana.*(resum|como.*esta|situacao)/, type: 'resumo_semana', confidence: 0.9 },
      
      // Caixa e Financeiro
      { pattern: /caixa|saldo|balanco|entrada|saida/, type: 'caixa_periodo', confidence: 0.9 },
      { pattern: /fluxo\s*(de\s*)?caixa/, type: 'fluxo_caixa', confidence: 0.95 },
      
      // Rankings
      { pattern: /(quem|qual).*(paga|pagou).*(melhor|mais\s*rapido|pontual)/, type: 'ranking_pagamento', confidence: 0.95 },
      { pattern: /(maior|mais).*(devedor|divida|deve|aberto)/, type: 'maior_devedor', confidence: 0.9 },
      
      // Despesas
      { pattern: /despesa.*(acima|estoura|passa|ultrapassa)/, type: 'despesas_acima', confidence: 0.95 },
      { pattern: /(quem|qual).*(mais|maior).*(despesa|gast)/, type: 'ranking_despesas', confidence: 0.9 },
      
      // Prestações
      { pattern: /prestac.*(aberta|pendente|atrasad)/, type: 'prestacoes_abertas', confidence: 0.9 },
      
      // Gerentes específicos
      { pattern: /gerente.*(lista|todos|quais|quantos)/, type: 'listar_gerentes', confidence: 0.9 },
      { pattern: /(valor|quanto|saldo|divida|aberto|deve).*(do|da|de)\s+\w+/, type: 'info_gerente_detalhe', confidence: 0.95 },
      { pattern: /(historico|pagamentos|prestacoes).*(do|da|de)\s+\w+/, type: 'info_gerente_detalhe', confidence: 0.95 },
      { pattern: /\d{3}\s+[a-z]/, type: 'info_gerente_detalhe', confidence: 0.85 },
      
      // Análises e Insights
      { pattern: /resum|visao\s*geral|status|como\s*(esta|vai|anda)|situacao/, type: 'resumo_geral', confidence: 0.85 },
      { pattern: /alert|problema|atencao|cuidado|critico/, type: 'alertas', confidence: 0.9 },
      
      // Ajuda
      { pattern: /ajuda|help|o\s*que\s*(voce|vc)\s*(faz|pode)|como\s*(usar|funciona)|comandos/, type: 'ajuda', confidence: 0.95 }
    ];

    for (const intent of intents) {
      if (intent.pattern.test(s)) {
        return { type: intent.type, confidence: intent.confidence };
      }
    }

    return { type: 'desconhecido', confidence: 0.3 };
  }

  // ===== COLETA DE DADOS DO SUPABASE =====
  async function collectData(periodo) {
    const ctx = {
      gerentes: [],
      prestacoes: [],
      prestacoesSemFiltro: [],
      todasPrestacoes: [], // Histórico completo
      lancamentos: [],
      lancamentosSemFiltro: [],
      pendencias: [],
      despesas: [],
      periodo: periodo,
      empresa: getCompany()
    };

    const empresaAtual = getCompany();
    console.log('[AI] Coletando dados para:', empresaAtual, periodo?.label);

    // ===== GERENTES =====
    try {
      if (window.SupabaseAPI?.gerentes?.getAll) {
        const gerentes = await window.SupabaseAPI.gerentes.getAll();
        ctx.gerentes = (gerentes || []).map(g => ({
          id: g.id,
          uid: g.uid || g.id,
          nome: g.nome || g.apelido || '',
          numero: g.numero || g.rota || '',
          comissao: Number(g.comissao) || 0,
          comissao2: Number(g.comissao2) || 0,
          temSaldoAcumulado: g.tem_saldo_acumulado || g.temSaldoAcumulado || false
        }));
        console.log('[AI] ✅ Gerentes:', ctx.gerentes.length);
      }
    } catch(e) { console.warn('[AI] Erro gerentes:', e); }

    // ===== PRESTAÇÕES - TODAS =====
    try {
      if (window.SupabaseAPI?.prestacoes?.getAll) {
        const prestacoes = await window.SupabaseAPI.prestacoes.getAll();
        const mapped = (prestacoes || []).map(p => {
          let resumo = p.resumo;
          if (typeof resumo === 'string') {
            try { resumo = JSON.parse(resumo); } catch { resumo = {}; }
          }
          resumo = resumo || {};
          
          const gerente = ctx.gerentes.find(g => 
            g.uid === p.gerente_id || g.id === p.gerente_id || 
            String(g.id) === String(p.gerente_id)
          );
          
          return {
            id: p.id,
            gerenteId: p.gerente_id || p.gerenteId,
            gerenteNome: gerente?.nome || p.gerente_nome || '',
            gerenteNumero: gerente?.numero || '',
            ini: p.ini || p.periodo_ini,
            fim: p.fim || p.periodo_fim,
            fechado: !!p.fechado,
            aPagar: Number(resumo.aPagar) || Number(p.a_pagar) || 0,
            restam: Number(resumo.restam) || Number(p.restam) || 0,
            pagos: Number(resumo.pagos) || Number(p.pagos) || 0,
            coletas: Number(resumo.coletas) || Number(p.coletas) || 0,
            despesas: Number(resumo.despesas) || Number(p.despesas) || 0,
            comissao: Number(resumo.comissaoVal) || Number(p.valor_comissao) || 0,
            resultado: Number(resumo.resultado) || 0,
            baseCalculo: Number(resumo.baseCalculo) || Number(p.base_calculo) || 0,
            createdAt: p.created_at || p.createdAt,
            mesAno: null // Será calculado
          };
        });
        
        // Adiciona campo mesAno para análises
        mapped.forEach(p => {
          const d = new Date(p.fim || p.ini || p.createdAt);
          p.mesAno = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          p.semanaAno = getWeekNumber(d);
        });
        
        ctx.todasPrestacoes = mapped;
        ctx.prestacoesSemFiltro = mapped;
        
        // Filtra por período
        if (periodo?.inicio && periodo?.fim) {
          ctx.prestacoes = mapped.filter(p => {
            const dataP = new Date(p.fim || p.ini || p.createdAt);
            return dataP >= periodo.inicio && dataP <= periodo.fim;
          });
        } else {
          ctx.prestacoes = mapped;
        }
        console.log('[AI] ✅ Prestações:', ctx.prestacoes.length, '/', mapped.length);
      }
    } catch(e) { console.warn('[AI] Erro prestações:', e); }

    // ===== LANÇAMENTOS =====
    try {
      let lancamentosRaw = [];
      
      if (window.SupabaseAPI?.lancamentos?.getAll) {
        const lancamentos = await window.SupabaseAPI.lancamentos.getAll(empresaAtual);
        lancamentosRaw = lancamentos || [];
      }
      
      const mapped = lancamentosRaw.map(l => ({
        id: l.id,
        uid: l.uid,
        gerente: l.gerente || '',
        gerenteId: l.gerente_id || l.gerenteId,
        gerenteNome: ctx.gerentes.find(g => g.uid === l.gerente_id || g.id === l.gerente_id)?.nome || l.gerente || '',
        valor: Number(l.valor) || 0,
        tipo: l.tipo || '',
        status: l.status || '',
        forma: l.forma || '',
        data: l.data,
        info: l.info || l.descricao || l.observacao || '',
        createdAt: l.created_at || l.createdAt
      }));
      
      ctx.lancamentosSemFiltro = mapped;
      
      if (periodo?.inicio && periodo?.fim) {
        ctx.lancamentos = mapped.filter(l => {
          const dataStr = l.data || l.createdAt || '';
          if (!dataStr) return false;
          const parts = dataStr.split('-');
          const dataL = parts.length === 3 
            ? new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0)
            : new Date(dataStr);
          if (isNaN(dataL.getTime())) return false;
          return dataL >= periodo.inicio && dataL <= periodo.fim;
        });
      } else {
        ctx.lancamentos = mapped;
      }
      console.log('[AI] ✅ Lançamentos:', ctx.lancamentos.length);
    } catch(e) { console.warn('[AI] Erro lançamentos:', e); }

    // ===== PENDÊNCIAS =====
    try {
      if (window.PendenciasAPI?.getAll) {
        const pendencias = await window.PendenciasAPI.getAll();
        ctx.pendencias = (pendencias || []).filter(p => p.status === 'PENDENTE').map(p => ({
          id: p.id,
          gerenteId: p.gerente_id || p.gerenteId,
          gerenteNome: p.gerente_nome || p.gerenteNome || ctx.gerentes.find(g => g.uid === p.gerente_id)?.nome || '',
          valor: Number(p.valor || p.valorOriginal) || 0,
          tipo: p.tipoCaixa || p.tipo || '',
          data: p.data,
          info: p.info || ''
        }));
      }
    } catch(e) { console.warn('[AI] Erro pendências:', e); }

    console.log('[AI] Coleta finalizada:', {
      gerentes: ctx.gerentes.length,
      prestacoes: ctx.prestacoes.length,
      todasPrestacoes: ctx.todasPrestacoes.length,
      lancamentos: ctx.lancamentos.length,
      pendencias: ctx.pendencias.length
    });

    return ctx;
  }

  // Helper: Número da semana no ano
  function getWeekNumber(d) {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 4 - (date.getDay() || 7));
    const yearStart = new Date(date.getFullYear(), 0, 1);
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  }

  // =============================================
  // ===== NOVOS PROCESSADORES DE ANALYTICS =====
  // =============================================

  // 📊 TAXA DE QUITAÇÃO - Quantas prestações foram pagas 100%
  function processFrequenciaEnvio(ctx, nomesBuscados) {
    const { todasPrestacoes, gerentes } = ctx;
    
    // Se tem gerente específico
    if (nomesBuscados?.length) {
      const gerente = findGerente(ctx, nomesBuscados[0]);
      if (gerente) {
        return processFrequenciaGerenteEspecifico(ctx, gerente);
      }
    }
    
    // Análise geral - últimos 3 meses
    const tresMesesAtras = new Date();
    tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);
    
    const stats = {};
    
    gerentes.forEach(g => {
      const prestG = todasPrestacoes.filter(p => 
        (p.gerenteId === g.uid || p.gerenteId === g.id) &&
        new Date(p.createdAt || p.fim) >= tresMesesAtras
      );
      
      if (!prestG.length) return;
      
      // Conta prestações FECHADAS que foram quitadas (restam = 0)
      const fechadas = prestG.filter(p => p.fechado);
      const quitadas = fechadas.filter(p => p.restam <= 0);
      const naoQuitadas = fechadas.filter(p => p.restam > 0);
      
      // Taxa de quitação = quitadas / fechadas
      const taxaQuitacao = fechadas.length > 0 ? (quitadas.length / fechadas.length) * 100 : 0;
      
      // Total não pago
      const totalNaoPago = naoQuitadas.reduce((s, p) => s + p.restam, 0);
      
      stats[g.uid || g.id] = {
        nome: g.nome,
        numero: g.numero,
        totalPrestacoes: prestG.length,
        fechadas: fechadas.length,
        quitadas: quitadas.length,
        naoQuitadas: naoQuitadas.length,
        taxaQuitacao,
        totalNaoPago
      };
    });
    
    const ranking = Object.values(stats)
      .filter(g => g.fechadas > 0)
      .sort((a, b) => b.taxaQuitacao - a.taxaQuitacao);
    
    if (!ranking.length) {
      return '📊 <strong>Taxa de Quitação</strong><br><br>Sem dados suficientes para análise.';
    }
    
    let resp = `📊 <strong>Taxa de Quitação - Últimos 3 Meses</strong><br><br>`;
    resp += `<em>Taxa = prestações pagas 100% / total de prestações fechadas</em><br><br>`;
    
    // Top 10
    const top10 = ranking.slice(0, 10);
    top10.forEach((g, i) => {
      const nome = g.numero ? `${g.numero} ${g.nome}` : g.nome;
      const barWidth = Math.round((g.taxaQuitacao / 100) * 15);
      const bar = '█'.repeat(barWidth) + '░'.repeat(15 - barWidth);
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
      const icon = g.taxaQuitacao >= 80 ? '✅' : g.taxaQuitacao >= 50 ? '🟡' : '🔴';
      
      resp += `${medal} <strong>${nome}</strong> ${icon}<br>`;
      resp += `&nbsp;&nbsp;${bar} ${fmtPerc(g.taxaQuitacao)}<br>`;
      resp += `&nbsp;&nbsp;<em>${g.quitadas}/${g.fechadas} prestações quitadas</em>`;
      if (g.totalNaoPago > 0) {
        resp += ` | <span style="color:#ff6b6b">Deve: ${fmt(g.totalNaoPago)}</span>`;
      }
      resp += `<br><br>`;
    });
    
    // Alertas: quem está abaixo de 50%
    const baixaQuitacao = ranking.filter(g => g.taxaQuitacao < 50 && g.fechadas >= 2);
    if (baixaQuitacao.length) {
      resp += `<br>⚠️ <strong>Atenção - Baixa quitação (&lt;50%):</strong><br>`;
      baixaQuitacao.slice(0, 5).forEach(g => {
        const nome = g.numero ? `${g.numero} ${g.nome}` : g.nome;
        resp += `• ${nome}: ${fmtPerc(g.taxaQuitacao)} (${g.quitadas}/${g.fechadas}) - Deve: ${fmt(g.totalNaoPago)}<br>`;
      });
    }
    
    // Quem NUNCA quitou
    const nuncaQuitou = ranking.filter(g => g.taxaQuitacao === 0 && g.fechadas >= 2);
    if (nuncaQuitou.length) {
      resp += `<br>🔴 <strong>NUNCA quitaram uma prestação:</strong><br>`;
      nuncaQuitou.forEach(g => {
        const nome = g.numero ? `${g.numero} ${g.nome}` : g.nome;
        resp += `• ${nome}: ${g.fechadas} prestações, deve ${fmt(g.totalNaoPago)}<br>`;
      });
    }
    
    return resp;
  }

  // Taxa de Quitação de um gerente específico
  function processFrequenciaGerenteEspecifico(ctx, gerente) {
    const { todasPrestacoes } = ctx;
    
    const prestG = todasPrestacoes
      .filter(p => p.gerenteId === gerente.uid || p.gerenteId === gerente.id)
      .sort((a, b) => new Date(b.fim || b.createdAt) - new Date(a.fim || a.createdAt));
    
    if (!prestG.length) {
      return `📊 <strong>${gerente.numero || ''} ${gerente.nome}</strong><br><br>Nenhuma prestação encontrada.`;
    }
    
    // Filtra fechadas
    const fechadas = prestG.filter(p => p.fechado);
    const quitadas = fechadas.filter(p => p.restam <= 0);
    const naoQuitadas = fechadas.filter(p => p.restam > 0);
    const abertas = prestG.filter(p => !p.fechado);
    
    const taxaGeral = fechadas.length > 0 ? (quitadas.length / fechadas.length) * 100 : 0;
    const totalNaoPago = naoQuitadas.reduce((s, p) => s + p.restam, 0);
    
    let resp = `📊 <strong>Taxa de Quitação - ${gerente.numero || ''} ${gerente.nome}</strong><br><br>`;
    
    // Resumo
    const icon = taxaGeral >= 80 ? '✅' : taxaGeral >= 50 ? '🟡' : '🔴';
    resp += `📈 <strong>RESUMO GERAL:</strong><br>`;
    resp += `• Total de prestações: ${prestG.length}<br>`;
    resp += `• Fechadas: ${fechadas.length}<br>`;
    resp += `• ✅ Quitadas (100%): ${quitadas.length}<br>`;
    resp += `• ⚠️ Não quitadas: ${naoQuitadas.length}<br>`;
    resp += `• 🔓 Abertas: ${abertas.length}<br>`;
    resp += `• Taxa de quitação: <strong>${fmtPerc(taxaGeral)} ${icon}</strong><br>`;
    if (totalNaoPago > 0) {
      resp += `• 🔴 <strong>Total em aberto: ${fmt(totalNaoPago)}</strong><br>`;
    }
    resp += `<br>`;
    
    // Últimas 10 prestações fechadas com detalhes
    resp += `📅 <strong>HISTÓRICO DE PAGAMENTOS:</strong><br>`;
    const ultimas = fechadas.slice(0, 10);
    
    ultimas.forEach(p => {
      const periodo = `${fmtData(p.ini)} a ${fmtData(p.fim)}`;
      const quitou = p.restam <= 0;
      const icon = quitou ? '✅' : '🔴';
      const status = quitou ? 'QUITOU' : `DEVE ${fmt(p.restam)}`;
      
      resp += `<br>${icon} <strong>${periodo}</strong><br>`;
      resp += `&nbsp;&nbsp;A pagar: ${fmt(p.aPagar)} | Pago: ${fmt(p.pagos)}<br>`;
      resp += `&nbsp;&nbsp;<strong>${status}</strong><br>`;
    });
    
    if (fechadas.length > 10) {
      resp += `<br><em>... e mais ${fechadas.length - 10} prestações anteriores</em><br>`;
    }
    
    // Análise de tendência (últimos 3 meses vs anteriores)
    const tresMesesAtras = new Date();
    tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);
    
    const recentes = fechadas.filter(p => new Date(p.fim || p.createdAt) >= tresMesesAtras);
    const quitadasRecentes = recentes.filter(p => p.restam <= 0);
    const taxaRecente = recentes.length > 0 ? (quitadasRecentes.length / recentes.length) * 100 : 0;
    
    if (recentes.length >= 2) {
      resp += `<br>📊 <strong>ÚLTIMOS 3 MESES:</strong><br>`;
      resp += `• ${quitadasRecentes.length}/${recentes.length} prestações quitadas<br>`;
      resp += `• Taxa recente: ${fmtPerc(taxaRecente)}<br>`;
      
      const tendencia = taxaRecente > taxaGeral ? '📈 Melhorando' : 
                        taxaRecente < taxaGeral ? '📉 Piorando' : '➡️ Estável';
      resp += `• Tendência: ${tendencia}`;
    }
    
    return resp;
  }

  // 💰 RENDIMENTO POR ROTA
  function processRendimentoRota(ctx, nomesBuscados) {
    const { todasPrestacoes, gerentes, lancamentosSemFiltro } = ctx;
    
    // Se tem gerente específico
    if (nomesBuscados?.length) {
      const gerente = findGerente(ctx, nomesBuscados[0]);
      if (gerente) {
        return processRendimentoGerenteEspecifico(ctx, gerente);
      }
    }
    
    // Análise geral - últimos 3 meses
    const tresMesesAtras = new Date();
    tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);
    
    const stats = {};
    
    gerentes.forEach(g => {
      const prestG = todasPrestacoes.filter(p => 
        (p.gerenteId === g.uid || p.gerenteId === g.id) &&
        new Date(p.createdAt || p.fim) >= tresMesesAtras
      );
      
      if (!prestG.length) return;
      
      const totalColetas = prestG.reduce((s, p) => s + p.coletas, 0);
      const totalDespesas = prestG.reduce((s, p) => s + p.despesas, 0);
      const totalComissao = prestG.reduce((s, p) => s + p.comissao, 0);
      const totalAPagar = prestG.reduce((s, p) => s + p.aPagar, 0);
      const totalPago = prestG.reduce((s, p) => s + p.pagos, 0);
      const totalAberto = prestG.reduce((s, p) => s + p.restam, 0);
      
      // Rendimento líquido = Coletas - Despesas - Comissão
      const rendimentoLiquido = totalColetas - totalDespesas - totalComissao;
      // Margem = Rendimento / Coletas
      const margem = totalColetas > 0 ? (rendimentoLiquido / totalColetas) * 100 : 0;
      // Taxa de recebimento
      const taxaRecebimento = totalAPagar > 0 ? (totalPago / totalAPagar) * 100 : 100;
      
      stats[g.uid || g.id] = {
        nome: g.nome,
        numero: g.numero,
        qtdPrestacoes: prestG.length,
        totalColetas,
        totalDespesas,
        totalComissao,
        rendimentoLiquido,
        margem,
        totalAPagar,
        totalPago,
        totalAberto,
        taxaRecebimento,
        percDespesa: totalColetas > 0 ? (totalDespesas / totalColetas) * 100 : 0
      };
    });
    
    const ranking = Object.values(stats)
      .filter(g => g.qtdPrestacoes > 0)
      .sort((a, b) => b.rendimentoLiquido - a.rendimentoLiquido);
    
    if (!ranking.length) {
      return '💰 <strong>Rendimento por Rota</strong><br><br>Sem dados suficientes.';
    }
    
    let resp = `💰 <strong>Rendimento por Rota - Últimos 3 Meses</strong><br><br>`;
    
    // Totais gerais
    const totGeral = ranking.reduce((acc, g) => ({
      coletas: acc.coletas + g.totalColetas,
      despesas: acc.despesas + g.totalDespesas,
      comissao: acc.comissao + g.totalComissao,
      rendimento: acc.rendimento + g.rendimentoLiquido
    }), { coletas: 0, despesas: 0, comissao: 0, rendimento: 0 });
    
    resp += `📊 <strong>TOTAIS GERAIS:</strong><br>`;
    resp += `• Coletas: ${fmt(totGeral.coletas)}<br>`;
    resp += `• Despesas: ${fmt(totGeral.despesas)}<br>`;
    resp += `• Comissões: ${fmt(totGeral.comissao)}<br>`;
    resp += `• <strong>Rendimento Líquido: ${fmt(totGeral.rendimento)}</strong><br><br>`;
    
    // Top 5 melhores
    resp += `🏆 <strong>TOP 5 - MAIOR RENDIMENTO:</strong><br>`;
    ranking.slice(0, 5).forEach((g, i) => {
      const nome = g.numero ? `${g.numero} ${g.nome}` : g.nome;
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
      
      resp += `${medal} <strong>${nome}</strong>: ${fmt(g.rendimentoLiquido)}<br>`;
      resp += `&nbsp;&nbsp;Coletas: ${fmt(g.totalColetas)} | Margem: ${fmtPerc(g.margem)}<br><br>`;
    });
    
    // Bottom 3 (piores ou negativos)
    const negativos = ranking.filter(g => g.rendimentoLiquido < 0);
    if (negativos.length) {
      resp += `<br>⚠️ <strong>ROTAS COM PREJUÍZO:</strong><br>`;
      negativos.slice(-3).forEach(g => {
        const nome = g.numero ? `${g.numero} ${g.nome}` : g.nome;
        resp += `🔴 <strong>${nome}</strong>: ${fmt(g.rendimentoLiquido)}<br>`;
        resp += `&nbsp;&nbsp;Despesas: ${fmtPerc(g.percDespesa)} das coletas<br>`;
      });
    }
    
    // Alertas de despesa alta
    const despesaAlta = ranking.filter(g => g.percDespesa > 25);
    if (despesaAlta.length) {
      resp += `<br>💸 <strong>DESPESAS ACIMA DE 25%:</strong><br>`;
      despesaAlta.slice(0, 3).forEach(g => {
        const nome = g.numero ? `${g.numero} ${g.nome}` : g.nome;
        resp += `• ${nome}: ${fmtPerc(g.percDespesa)} das coletas<br>`;
      });
    }
    
    return resp;
  }

  // Rendimento de um gerente específico
  function processRendimentoGerenteEspecifico(ctx, gerente) {
    const { todasPrestacoes, lancamentosSemFiltro } = ctx;
    
    const prestG = todasPrestacoes
      .filter(p => p.gerenteId === gerente.uid || p.gerenteId === gerente.id)
      .sort((a, b) => new Date(b.fim || b.createdAt) - new Date(a.fim || a.createdAt));
    
    if (!prestG.length) {
      return `💰 <strong>${gerente.numero || ''} ${gerente.nome}</strong><br><br>Nenhuma prestação encontrada.`;
    }
    
    // Agrupa por mês
    const porMes = {};
    prestG.forEach(p => {
      if (!porMes[p.mesAno]) porMes[p.mesAno] = [];
      porMes[p.mesAno].push(p);
    });
    
    const mesesOrdenados = Object.keys(porMes).sort().reverse();
    
    let resp = `💰 <strong>Rendimento - ${gerente.numero || ''} ${gerente.nome}</strong><br><br>`;
    
    // Resumo geral
    const totalColetas = prestG.reduce((s, p) => s + p.coletas, 0);
    const totalDespesas = prestG.reduce((s, p) => s + p.despesas, 0);
    const totalComissao = prestG.reduce((s, p) => s + p.comissao, 0);
    const totalAPagar = prestG.reduce((s, p) => s + p.aPagar, 0);
    const totalPago = prestG.reduce((s, p) => s + p.pagos, 0);
    const totalAberto = prestG.reduce((s, p) => s + p.restam, 0);
    const rendimentoLiquido = totalColetas - totalDespesas - totalComissao;
    const margem = totalColetas > 0 ? (rendimentoLiquido / totalColetas) * 100 : 0;
    
    resp += `📊 <strong>RESUMO GERAL (${prestG.length} prestações):</strong><br>`;
    resp += `• Coletas totais: ${fmt(totalColetas)}<br>`;
    resp += `• Despesas totais: ${fmt(totalDespesas)} (${fmtPerc(totalColetas > 0 ? (totalDespesas/totalColetas)*100 : 0)})<br>`;
    resp += `• Comissões totais: ${fmt(totalComissao)}<br>`;
    resp += `• <strong>Rendimento líquido: ${fmt(rendimentoLiquido)}</strong><br>`;
    resp += `• Margem: ${fmtPerc(margem)}<br><br>`;
    
    // Situação financeira
    resp += `💵 <strong>SITUAÇÃO FINANCEIRA:</strong><br>`;
    resp += `• Total a pagar: ${fmt(totalAPagar)}<br>`;
    resp += `• Total pago: ${fmt(totalPago)}<br>`;
    if (totalAberto > 0) {
      resp += `• ⚠️ <strong>Em aberto: ${fmt(totalAberto)}</strong><br>`;
    } else {
      resp += `• ✅ Sem valores em aberto<br>`;
    }
    resp += `<br>`;
    
    // Evolução mensal
    resp += `📈 <strong>EVOLUÇÃO MENSAL:</strong><br>`;
    mesesOrdenados.slice(0, 6).forEach(mes => {
      const pMes = porMes[mes];
      const colMes = pMes.reduce((s, p) => s + p.coletas, 0);
      const despMes = pMes.reduce((s, p) => s + p.despesas, 0);
      const comMes = pMes.reduce((s, p) => s + p.comissao, 0);
      const rendMes = colMes - despMes - comMes;
      const icon = rendMes >= 0 ? '✅' : '🔴';
      
      const [ano, mesNum] = mes.split('-');
      const nomeMes = new Date(ano, mesNum - 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
      
      resp += `${icon} <strong>${nomeMes}:</strong> ${fmt(rendMes)}<br>`;
      resp += `&nbsp;&nbsp;Coletas: ${fmt(colMes)} | ${pMes.length} prestações<br>`;
    });
    
    // Análise de tendência
    if (mesesOrdenados.length >= 3) {
      const ultimos3 = mesesOrdenados.slice(0, 3);
      const rendUltimos = ultimos3.map(mes => {
        const pMes = porMes[mes];
        const col = pMes.reduce((s, p) => s + p.coletas, 0);
        const desp = pMes.reduce((s, p) => s + p.despesas, 0);
        const com = pMes.reduce((s, p) => s + p.comissao, 0);
        return col - desp - com;
      });
      
      const tendencia = rendUltimos[0] > rendUltimos[2] ? '📈 Crescendo' : 
                        rendUltimos[0] < rendUltimos[2] ? '📉 Caindo' : '➡️ Estável';
      
      resp += `<br>📊 <strong>TENDÊNCIA:</strong> ${tendencia}`;
    }
    
    return resp;
  }

  // 📋 ANÁLISE COMPLETA DE UM GERENTE
  function processAnaliseCompletaGerente(ctx, nomesBuscados) {
    if (!nomesBuscados?.length) {
      return `❓ <strong>Qual gerente você quer analisar?</strong><br><br>` +
        `Exemplos:<br>` +
        `• "Análise completa do 026 Sávio"<br>` +
        `• "Relatório detalhado do Luís"`;
    }
    
    const gerente = findGerente(ctx, nomesBuscados[0]);
    if (!gerente) {
      return `❌ Gerente "${nomesBuscados[0].nome}" não encontrado.`;
    }
    
    const { todasPrestacoes, lancamentosSemFiltro } = ctx;
    const nomeCompleto = `${gerente.numero || '---'} ${gerente.nome}`;
    const gerenteId = gerente.uid || gerente.id;
    
    const prestG = todasPrestacoes
      .filter(p => p.gerenteId === gerenteId || String(p.gerenteId) === String(gerenteId))
      .sort((a, b) => new Date(b.fim || b.createdAt) - new Date(a.fim || a.createdAt));
    
    // Busca lançamentos do gerente no caixa
    const lancamentosGerente = lancamentosSemFiltro.filter(l => {
      const nomeL = (l.gerente || l.gerenteNome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const nomeG = gerente.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return nomeL.includes(nomeG) || nomeG.includes(nomeL.split(' ')[0]) ||
             l.gerenteId === gerenteId || String(l.gerenteId) === String(gerenteId);
    });
    
    // Filtra lançamentos do mês atual
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    
    const lancamentosMes = lancamentosGerente.filter(l => {
      const dataL = new Date(l.data || l.createdAt);
      return dataL >= inicioMes;
    });
    
    // Busca adiantamentos - verifica tipo, info e se menciona o nome do gerente
    const nomeGerenteLower = gerente.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const numeroGerente = gerente.numero || '';
    
    const adiantamentos = lancamentosSemFiltro.filter(l => {
      const info = (l.info || l.descricao || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const gerenteLanc = (l.gerente || l.gerenteNome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const tipo = (l.tipo || '').toLowerCase();
      
      // Verifica se é adiantamento
      const isAdiantamento = tipo.includes('adiant') || 
                             info.includes('adiant') ||
                             gerenteLanc.includes('adiant');
      
      if (!isAdiantamento) return false;
      
      // Verifica se é do gerente
      const isDoGerente = info.includes(nomeGerenteLower) ||
                          gerenteLanc.includes(nomeGerenteLower) ||
                          (numeroGerente && (info.includes(numeroGerente) || gerenteLanc.includes(numeroGerente))) ||
                          l.gerenteId === gerenteId ||
                          String(l.gerenteId) === String(gerenteId);
      
      return isDoGerente;
    });
    
    const adiantamentosMes = adiantamentos.filter(l => {
      const dataL = new Date(l.data || l.createdAt);
      return dataL >= inicioMes;
    });
    
    if (!prestG.length && !lancamentosGerente.length) {
      return `📋 <strong>Análise - ${nomeCompleto}</strong><br><br>Nenhuma prestação ou lançamento encontrado para este gerente.`;
    }
    
    let resp = `📋 <strong>ANÁLISE COMPLETA - ${nomeCompleto}</strong><br><br>`;
    
    // ===== 1. DADOS CADASTRAIS =====
    resp += `👤 <strong>DADOS CADASTRAIS:</strong><br>`;
    resp += `• Comissão: ${gerente.comissao}%`;
    if (gerente.comissao2 > 0) resp += ` + ${gerente.comissao2}% (2ª comissão)`;
    resp += `<br>`;
    if (gerente.temSaldoAcumulado) resp += `• ✅ Usa saldo acumulado<br>`;
    resp += `<br>`;
    
    // ===== 2. SALDO NO CAIXA (MÊS ATUAL) =====
    const recebidosMes = lancamentosMes.filter(l => l.status === 'RECEBIDO');
    const pagosMes = lancamentosMes.filter(l => l.status === 'PAGO');
    const totalRecebidoMes = recebidosMes.reduce((s, l) => s + l.valor, 0);
    const totalPagoMes = pagosMes.reduce((s, l) => s + l.valor, 0);
    const totalAdiantMes = adiantamentosMes.reduce((s, l) => s + l.valor, 0);
    const saldoMes = totalRecebidoMes - totalPagoMes;
    
    const mesAtual = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    resp += `💵 <strong>CAIXA DO MÊS (${mesAtual}):</strong><br>`;
    resp += `• 💰 Recebido: ${fmt(totalRecebidoMes)} (${recebidosMes.length} lançamentos)<br>`;
    resp += `• 💸 Pago: ${fmt(totalPagoMes)} (${pagosMes.length} lançamentos)<br>`;
    if (totalAdiantMes > 0) {
      resp += `• 🏷️ Adiantamentos: ${fmt(totalAdiantMes)}<br>`;
    }
    const saldoIcon = saldoMes >= 0 ? '✅' : '🔴';
    resp += `• ${saldoIcon} <strong>Saldo do mês: ${fmt(saldoMes)}</strong><br><br>`;
    
    // ===== 3. PRESTAÇÕES - MÊS ATUAL =====
    const prestMes = prestG.filter(p => {
      const dataP = new Date(p.fim || p.ini || p.createdAt);
      return dataP >= inicioMes;
    });
    
    const abertas = prestMes.filter(p => !p.fechado);
    const fechadas = prestMes.filter(p => p.fechado);
    const fechadasQuitadas = fechadas.filter(p => p.restam <= 0);
    const fechadasComAberto = fechadas.filter(p => p.restam > 0);
    
    resp += `📅 <strong>PRESTAÇÕES DO MÊS:</strong><br>`;
    if (prestMes.length === 0) {
      resp += `• Nenhuma prestação no mês atual<br><br>`;
    } else {
      resp += `• Total: ${prestMes.length} prestações<br>`;
      if (abertas.length) resp += `• 🔓 Abertas: ${abertas.length}<br>`;
      if (fechadasQuitadas.length) resp += `• ✅ Fechadas quitadas: ${fechadasQuitadas.length}<br>`;
      if (fechadasComAberto.length) resp += `• ⚠️ Fechadas com saldo: ${fechadasComAberto.length}<br>`;
      
      // Ordena prestações por data mais recente (fim)
      const prestOrdenadas = [...prestMes].sort((a, b) => {
        const dataA = new Date(a.fim || a.ini);
        const dataB = new Date(b.fim || b.ini);
        return dataB - dataA;
      });
      
      // Lista prestações do mês - mostra A PAGAR e RESTAM
      prestOrdenadas.forEach(p => {
        const periodo = `${fmtData(p.ini)} a ${fmtData(p.fim)}`;
        let status, icon;
        if (!p.fechado) {
          status = 'Aberta';
          icon = '🔓';
        } else if (p.restam > 0) {
          status = 'Fechada c/ saldo';
          icon = '⚠️';
        } else {
          status = 'Quitada';
          icon = '✅';
        }
        resp += `<br>${icon} <strong>${periodo}</strong> - ${status}<br>`;
        resp += `&nbsp;&nbsp;A pagar: ${fmt(p.aPagar)} | Restam: ${fmt(p.restam)}<br>`;
      });
      resp += `<br>`;
    }
    
    // ===== 4. LUCRO/PREJUÍZO DO MÊS (BASEADO NO CAIXA) =====
    // O lucro real vem do que RECEBEMOS no caixa menos o que PAGAMOS (adiantamentos, etc)
    const totalApagarMes = prestMes.reduce((s, p) => s + p.aPagar, 0);
    const totalPagoPrests = prestMes.reduce((s, p) => s + p.pagos, 0);
    const totalRestamMes = prestMes.reduce((s, p) => s + p.restam, 0);
    
    resp += `📊 <strong>RESULTADO DO MÊS (Caixa):</strong><br>`;
    resp += `• 💰 Recebido no caixa: ${fmt(totalRecebidoMes)}<br>`;
    resp += `• 💸 Pago (adiant/desp): ${fmt(totalPagoMes)}<br>`;
    if (totalAdiantMes > 0) {
      resp += `• 🏷️ Adiantamentos: ${fmt(totalAdiantMes)}<br>`;
    }
    
    // Lucro = Recebido no caixa - Pagamentos do caixa
    const lucroMes = totalRecebidoMes - totalPagoMes;
    const lucroIcon = lucroMes >= 0 ? '✅' : '🔴';
    const lucroTexto = lucroMes >= 0 ? 'LUCRO' : 'PREJUÍZO';
    resp += `• ${lucroIcon} <strong>${lucroTexto} DO MÊS: ${fmt(Math.abs(lucroMes))}</strong><br>`;
    
    // Resumo das prestações
    resp += `<br>📋 <strong>RESUMO PRESTAÇÕES:</strong><br>`;
    resp += `• Total a receber: ${fmt(totalApagarMes)}<br>`;
    resp += `• Já recebido: ${fmt(totalPagoPrests)}<br>`;
    if (totalRestamMes > 0) {
      resp += `• ⚠️ <strong>Falta receber: ${fmt(totalRestamMes)}</strong><br>`;
    } else {
      resp += `• ✅ Tudo quitado<br>`;
    }
    resp += `<br>`;
    
    // ===== 5. ÚLTIMOS LANÇAMENTOS NO CAIXA =====
    if (lancamentosGerente.length > 0) {
      resp += `💳 <strong>ÚLTIMOS LANÇAMENTOS:</strong><br>`;
      const ultimos = lancamentosGerente
        .sort((a, b) => new Date(b.data || b.createdAt) - new Date(a.data || a.createdAt))
        .slice(0, 8);
      
      ultimos.forEach(l => {
        let icon = l.status === 'RECEBIDO' ? '💰' : '💸';
        const isAdiant = (l.tipo || '').toLowerCase().includes('adiant') || 
                        (l.info || '').toLowerCase().includes('adiant') ||
                        (l.gerente || '').toLowerCase().includes('adiant');
        if (isAdiant) icon = '🏷️';
        
        const data = fmtData(l.data || l.createdAt);
        const forma = l.forma || l.tipo || 'N/A';
        resp += `${icon} ${data}: ${fmt(l.valor)} (${forma})<br>`;
      });
      resp += `<br>`;
    }
    
    // ===== 5.1 ADIANTAMENTOS TOTAIS =====
    if (adiantamentos.length > 0) {
      const totalAdiant = adiantamentos.reduce((s, l) => s + l.valor, 0);
      resp += `🏷️ <strong>ADIANTAMENTOS (total histórico):</strong><br>`;
      resp += `• Total: ${fmt(totalAdiant)} em ${adiantamentos.length} adiantamentos<br>`;
      
      // Últimos 3 adiantamentos
      const ultimosAdiant = adiantamentos
        .sort((a, b) => new Date(b.data || b.createdAt) - new Date(a.data || a.createdAt))
        .slice(0, 3);
      
      if (ultimosAdiant.length) {
        resp += `• Últimos:<br>`;
        ultimosAdiant.forEach(l => {
          resp += `&nbsp;&nbsp;${fmtData(l.data || l.createdAt)}: ${fmt(l.valor)}<br>`;
        });
      }
      resp += `<br>`;
    }
    
    // ===== 6. ESTATÍSTICAS GERAIS (HISTÓRICO COMPLETO) =====
    const totalAPagarHist = prestG.reduce((s, p) => s + p.aPagar, 0);
    const totalPagoHist = prestG.reduce((s, p) => s + p.pagos, 0);
    const totalAbertoHist = prestG.reduce((s, p) => s + p.restam, 0);
    const fechadasHist = prestG.filter(p => p.fechado);
    const quitadasHist = fechadasHist.filter(p => p.restam <= 0);
    const fechadasComAbertoHist = fechadasHist.filter(p => p.restam > 0);
    const abertasHist = prestG.filter(p => !p.fechado);
    const percPagoHist = totalAPagarHist > 0 ? (totalPagoHist / totalAPagarHist) * 100 : 0;
    
    resp += `📈 <strong>ESTATÍSTICAS GERAIS (histórico):</strong><br>`;
    resp += `• Total de prestações: ${prestG.length}<br>`;
    resp += `• 🔓 Abertas: ${abertasHist.length}<br>`;
    resp += `• ✅ Quitadas: ${quitadasHist.length}<br>`;
    resp += `• ⚠️ Fechadas com saldo: ${fechadasComAbertoHist.length}<br>`;
    resp += `• Total a pagar: ${fmt(totalAPagarHist)}<br>`;
    resp += `• Total pago: ${fmt(totalPagoHist)}<br>`;
    resp += `• % médio de pagamento: ${fmtPerc(percPagoHist)}<br>`;
    if (totalAbertoHist > 0) {
      resp += `• ⚠️ <strong>Total em aberto: ${fmt(totalAbertoHist)}</strong><br>`;
    }
    
    // ===== 7. SCORE GERAL =====
    const tresMesesAtras = new Date();
    tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);
    const prestRecentes = prestG.filter(p => new Date(p.createdAt || p.fim) >= tresMesesAtras);
    
    const porMes = {};
    prestRecentes.forEach(p => {
      if (!porMes[p.mesAno]) porMes[p.mesAno] = 0;
      porMes[p.mesAno]++;
    });
    const mesesAtivos = Object.keys(porMes).length;
    const taxaEnvio = mesesAtivos > 0 ? Math.min((prestRecentes.length / (mesesAtivos * 4)) * 100, 100) : 0;
    
    const totalColetasRecentes = prestRecentes.reduce((s, p) => s + p.coletas, 0);
    const totalDespesasRecentes = prestRecentes.reduce((s, p) => s + p.despesas, 0);
    const percDespesa = totalColetasRecentes > 0 ? (totalDespesasRecentes / totalColetasRecentes) * 100 : 0;
    
    const scoreFreq = taxaEnvio >= 80 ? 100 : taxaEnvio >= 60 ? 75 : taxaEnvio >= 40 ? 50 : 25;
    const scoreDespesa = percDespesa <= 20 ? 100 : percDespesa <= 30 ? 75 : percDespesa <= 40 ? 50 : 25;
    const scoreQuitacao = percPagoHist >= 95 ? 100 : percPagoHist >= 80 ? 75 : percPagoHist >= 60 ? 50 : 25;
    const scoreGeral = Math.round((scoreFreq + scoreDespesa + scoreQuitacao) / 3);
    
    const getScoreEmoji = (s) => s >= 80 ? '🌟' : s >= 60 ? '👍' : s >= 40 ? '👎' : '⚠️';
    
    resp += `<br>🎯 <strong>SCORE GERAL: ${scoreGeral}/100 ${getScoreEmoji(scoreGeral)}</strong><br>`;
    resp += `• Frequência: ${scoreFreq}/100<br>`;
    resp += `• Despesas: ${scoreDespesa}/100<br>`;
    resp += `• Quitação: ${scoreQuitacao}/100<br>`;
    
    return resp;
  }

  // 🔄 COMPARATIVO ENTRE GERENTES
  function processComparativoGerentes(ctx) {
    const { todasPrestacoes, gerentes } = ctx;
    
    const tresMesesAtras = new Date();
    tresMesesAtras.setMonth(tresMesesAtras.getMonth() - 3);
    
    // Calcula métricas para cada gerente
    const metricas = gerentes.map(g => {
      const prestG = todasPrestacoes.filter(p => 
        (p.gerenteId === g.uid || p.gerenteId === g.id) &&
        new Date(p.createdAt || p.fim) >= tresMesesAtras
      );
      
      if (!prestG.length) return null;
      
      const porMes = {};
      prestG.forEach(p => {
        if (!porMes[p.mesAno]) porMes[p.mesAno] = 0;
        porMes[p.mesAno]++;
      });
      
      const mesesAtivos = Object.keys(porMes).length;
      const taxaEnvio = mesesAtivos > 0 ? Math.min((prestG.length / (mesesAtivos * 4)) * 100, 100) : 0;
      
      const totalColetas = prestG.reduce((s, p) => s + p.coletas, 0);
      const totalDespesas = prestG.reduce((s, p) => s + p.despesas, 0);
      const totalComissao = prestG.reduce((s, p) => s + p.comissao, 0);
      const rendimento = totalColetas - totalDespesas - totalComissao;
      const percDespesa = totalColetas > 0 ? (totalDespesas / totalColetas) * 100 : 0;
      
      const totalAPagar = prestG.reduce((s, p) => s + p.aPagar, 0);
      const totalPago = prestG.reduce((s, p) => s + p.pagos, 0);
      const taxaQuitacao = totalAPagar > 0 ? (totalPago / totalAPagar) * 100 : 100;
      
      // Score
      const scoreFreq = taxaEnvio >= 80 ? 100 : taxaEnvio >= 60 ? 75 : taxaEnvio >= 40 ? 50 : 25;
      const scoreDespesa = percDespesa <= 20 ? 100 : percDespesa <= 30 ? 75 : percDespesa <= 40 ? 50 : 25;
      const scoreQuitacao = taxaQuitacao >= 95 ? 100 : taxaQuitacao >= 80 ? 75 : taxaQuitacao >= 60 ? 50 : 25;
      const scoreGeral = Math.round((scoreFreq + scoreDespesa + scoreQuitacao) / 3);
      
      return {
        nome: g.nome,
        numero: g.numero,
        prestacoes: prestG.length,
        taxaEnvio,
        rendimento,
        percDespesa,
        taxaQuitacao,
        scoreGeral
      };
    }).filter(Boolean);
    
    if (!metricas.length) {
      return '🔄 <strong>Comparativo</strong><br><br>Sem dados suficientes.';
    }
    
    let resp = `🔄 <strong>COMPARATIVO DE GERENTES - Últimos 3 Meses</strong><br><br>`;
    
    // Ranking por Score
    const porScore = [...metricas].sort((a, b) => b.scoreGeral - a.scoreGeral);
    
    resp += `🏆 <strong>RANKING GERAL (Score):</strong><br>`;
    porScore.slice(0, 10).forEach((g, i) => {
      const nome = g.numero ? `${g.numero} ${g.nome}` : g.nome;
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
      const emoji = g.scoreGeral >= 80 ? '🌟' : g.scoreGeral >= 60 ? '👍' : g.scoreGeral >= 40 ? '👎' : '⚠️';
      
      resp += `${medal} <strong>${nome}</strong>: ${g.scoreGeral}/100 ${emoji}<br>`;
    });
    
    // Ranking por Rendimento
    resp += `<br>💰 <strong>TOP 5 - RENDIMENTO:</strong><br>`;
    const porRendimento = [...metricas].sort((a, b) => b.rendimento - a.rendimento);
    porRendimento.slice(0, 5).forEach((g, i) => {
      const nome = g.numero ? `${g.numero} ${g.nome}` : g.nome;
      resp += `${i+1}. ${nome}: ${fmt(g.rendimento)}<br>`;
    });
    
    // Ranking por Frequência
    resp += `<br>📊 <strong>TOP 5 - FREQUÊNCIA:</strong><br>`;
    const porFreq = [...metricas].sort((a, b) => b.taxaEnvio - a.taxaEnvio);
    porFreq.slice(0, 5).forEach((g, i) => {
      const nome = g.numero ? `${g.numero} ${g.nome}` : g.nome;
      resp += `${i+1}. ${nome}: ${fmtPerc(g.taxaEnvio)}<br>`;
    });
    
    // Alertas
    const problematicos = metricas.filter(g => g.scoreGeral < 50);
    if (problematicos.length) {
      resp += `<br>⚠️ <strong>ATENÇÃO NECESSÁRIA (Score < 50):</strong><br>`;
      problematicos.forEach(g => {
        const nome = g.numero ? `${g.numero} ${g.nome}` : g.nome;
        resp += `• ${nome}: Score ${g.scoreGeral}/100<br>`;
      });
    }
    
    return resp;
  }

  // 📈 MÉTRICAS DO CAIXA
  function processMetricasCaixa(ctx) {
    const { lancamentos, lancamentosSemFiltro, periodo } = ctx;
    
    const recebimentos = lancamentos.filter(l => l.status === 'RECEBIDO');
    const pagamentos = lancamentos.filter(l => l.status === 'PAGO');
    
    const totalRec = recebimentos.reduce((s, l) => s + l.valor, 0);
    const totalPag = pagamentos.reduce((s, l) => s + l.valor, 0);
    const saldo = totalRec - totalPag;
    
    let resp = `📈 <strong>MÉTRICAS DO CAIXA - ${periodo?.label || 'Período'}</strong><br><br>`;
    
    // KPIs principais
    resp += `📊 <strong>KPIs PRINCIPAIS:</strong><br>`;
    resp += `• Total de entradas: ${fmt(totalRec)}<br>`;
    resp += `• Total de saídas: ${fmt(totalPag)}<br>`;
    resp += `• Saldo: ${saldo >= 0 ? '✅' : '🔴'} ${fmt(saldo)}<br>`;
    resp += `• Qtd. lançamentos: ${lancamentos.length}<br><br>`;
    
    // Por forma de pagamento
    const porForma = {};
    recebimentos.forEach(l => {
      const forma = l.forma || 'Outros';
      if (!porForma[forma]) porForma[forma] = 0;
      porForma[forma] += l.valor;
    });
    
    if (Object.keys(porForma).length) {
      resp += `💳 <strong>ENTRADAS POR FORMA:</strong><br>`;
      Object.entries(porForma)
        .sort((a, b) => b[1] - a[1])
        .forEach(([forma, valor]) => {
          const perc = totalRec > 0 ? (valor / totalRec) * 100 : 0;
          resp += `• ${forma}: ${fmt(valor)} (${fmtPerc(perc)})<br>`;
        });
      resp += `<br>`;
    }
    
    // Top gerentes que mais recebemos
    const porGerente = {};
    recebimentos.forEach(l => {
      const nome = l.gerenteNome || l.gerente || 'Outros';
      if (!porGerente[nome]) porGerente[nome] = 0;
      porGerente[nome] += l.valor;
    });
    
    if (Object.keys(porGerente).length) {
      resp += `👥 <strong>TOP 5 - MAIS RECEBEMOS DE:</strong><br>`;
      Object.entries(porGerente)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([nome, valor], i) => {
          resp += `${i+1}. ${nome}: ${fmt(valor)}<br>`;
        });
    }
    
    return resp;
  }

  // Helper: encontrar gerente
  function findGerente(ctx, busca) {
    const { gerentes } = ctx;
    const buscaNome = (busca.nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const buscaNumero = busca.numero || '';
    
    return gerentes.find(g => {
      const nomeG = (g.nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const numeroG = g.numero || '';
      
      if (buscaNumero && numeroG === buscaNumero) return true;
      if (buscaNome && nomeG.includes(buscaNome)) return true;
      return false;
    });
  }

  // ===== PROCESSADORES EXISTENTES (mantidos) =====
  
  function processDevedorSemana(ctx) {
    const { prestacoes, periodo } = ctx;
    const comAberto = prestacoes.filter(p => p.restam > 0);
    
    if (!comAberto.length) {
      return `✅ <strong>Nenhuma prestação com valores em aberto - ${periodo?.label}</strong>`;
    }
    
    const stats = {};
    comAberto.forEach(p => {
      const gid = p.gerenteId;
      if (!stats[gid]) {
        stats[gid] = { nome: p.gerenteNome || 'Desconhecido', numero: p.gerenteNumero || '', totalAberto: 0, qtdAbertas: 0 };
      }
      stats[gid].totalAberto += p.restam;
      stats[gid].qtdAbertas++;
    });
    
    const ranking = Object.values(stats).sort((a, b) => b.totalAberto - a.totalAberto).slice(0, 10);
    
    const lista = ranking.map((g, i) => {
      const nome = g.numero ? `${g.numero} ${g.nome}` : g.nome;
      const medal = i === 0 ? '🔴' : i === 1 ? '🟠' : i === 2 ? '🟡' : `${i+1}.`;
      return `${medal} <strong>${nome}</strong>: ${fmt(g.totalAberto)} (${g.qtdAbertas} prestação)`;
    }).join('<br>');
    
    const totalGeral = ranking.reduce((s, g) => s + g.totalAberto, 0);
    
    return `📅 <strong>Maiores Devedores - ${periodo?.label}</strong><br><br>${lista}<br><br>💰 <strong>Total:</strong> ${fmt(totalGeral)}`;
  }

  function processFinalizouComAberto(ctx) {
    const { prestacoes, periodo } = ctx;
    const finalizadasComAberto = prestacoes.filter(p => p.fechado && p.restam > 0);
    
    if (!finalizadasComAberto.length) {
      return `✅ <strong>Nenhuma prestação finalizada com valores em aberto - ${periodo?.label}</strong>`;
    }
    
    const stats = {};
    finalizadasComAberto.forEach(p => {
      const gid = p.gerenteId;
      if (!stats[gid]) {
        stats[gid] = { nome: p.gerenteNome || 'Desconhecido', numero: p.gerenteNumero || '', totalAberto: 0, qtd: 0 };
      }
      stats[gid].totalAberto += p.restam;
      stats[gid].qtd++;
    });
    
    const ranking = Object.values(stats).sort((a, b) => b.totalAberto - a.totalAberto);
    
    const lista = ranking.map((g, i) => {
      const nome = g.numero ? `${g.numero} ${g.nome}` : g.nome;
      return `${i+1}. <strong>${nome}</strong>: ${fmt(g.totalAberto)} (${g.qtd} prestação)`;
    }).join('<br>');
    
    const totalGeral = ranking.reduce((s, g) => s + g.totalAberto, 0);
    
    return `⚠️ <strong>Finalizaram com aberto - ${periodo?.label}</strong><br><br>${lista}<br><br>💰 <strong>Total:</strong> ${fmt(totalGeral)}`;
  }

  function processCaixaPeriodo(ctx) {
    const { lancamentos, periodo } = ctx;
    
    if (!lancamentos.length) {
      return `📊 <strong>Caixa - ${periodo?.label}</strong><br><br>Sem lançamentos.`;
    }
    
    const recebimentos = lancamentos.filter(l => l.status === 'RECEBIDO');
    const pagamentos = lancamentos.filter(l => l.status === 'PAGO');
    
    const totalRec = recebimentos.reduce((s, l) => s + l.valor, 0);
    const totalPag = pagamentos.reduce((s, l) => s + l.valor, 0);
    const saldo = totalRec - totalPag;
    
    return `📊 <strong>Caixa - ${periodo?.label}</strong><br><br>` +
      `💰 Entradas: ${fmt(totalRec)} (${recebimentos.length})<br>` +
      `💸 Saídas: ${fmt(totalPag)} (${pagamentos.length})<br>` +
      `${saldo >= 0 ? '✅' : '⚠️'} Saldo: ${fmt(saldo)}`;
  }

  function processResumoGeral(ctx) {
    const { gerentes, prestacoes, lancamentos, pendencias, periodo } = ctx;
    
    const abertas = prestacoes.filter(p => p.restam > 0);
    const totalAberto = abertas.reduce((s, p) => s + p.restam, 0);
    
    const recebido = lancamentos.filter(l => l.status === 'RECEBIDO').reduce((s,l) => s + l.valor, 0);
    const pago = lancamentos.filter(l => l.status === 'PAGO').reduce((s,l) => s + l.valor, 0);
    const saldo = recebido - pago;
    
    let resp = `📊 <strong>Resumo Geral - ${periodo?.label}</strong><br><br>`;
    resp += `👥 Gerentes: ${gerentes.length}<br>`;
    resp += `📋 Prestações: ${prestacoes.length} (${abertas.length} em aberto: ${fmt(totalAberto)})<br>`;
    resp += `💰 Caixa: ${saldo >= 0 ? '✅' : '⚠️'} ${fmt(saldo)}<br>`;
    if (pendencias.length) resp += `⏳ Pendências: ${pendencias.length}<br>`;
    
    return resp;
  }

  function processAlertas(ctx) {
    const { prestacoes, pendencias, lancamentos } = ctx;
    const alertas = [];
    
    const muitoAberto = prestacoes.filter(p => p.restam > 5000);
    if (muitoAberto.length) {
      alertas.push(`⚠️ ${muitoAberto.length} prestações com mais de R$ 5.000 em aberto`);
    }
    
    const finalizadasComAberto = prestacoes.filter(p => p.fechado && p.restam > 0);
    if (finalizadasComAberto.length) {
      const total = finalizadasComAberto.reduce((s, p) => s + p.restam, 0);
      alertas.push(`🔴 ${finalizadasComAberto.length} prestações finalizadas com ${fmt(total)} em aberto`);
    }
    
    if (pendencias.length > 10) {
      alertas.push(`📋 ${pendencias.length} pendências aguardando`);
    }
    
    const recebido = lancamentos.filter(l => l.status === 'RECEBIDO').reduce((s,l) => s + l.valor, 0);
    const pago = lancamentos.filter(l => l.status === 'PAGO').reduce((s,l) => s + l.valor, 0);
    if (pago > recebido) {
      alertas.push(`🔴 Saldo negativo: ${fmt(recebido - pago)}`);
    }
    
    if (!alertas.length) {
      return '✅ <strong>Nenhum alerta!</strong> Tudo em ordem.';
    }
    
    return `🚨 <strong>Alertas</strong><br><br>` + alertas.join('<br><br>');
  }

  function processListarGerentes(ctx) {
    const { gerentes } = ctx;
    if (!gerentes.length) return 'Nenhum gerente cadastrado.';
    
    const lista = gerentes.map((g, i) => 
      `${i+1}. <strong>${g.numero || '---'}</strong> ${g.nome} (${g.comissao}%)`
    ).join('<br>');
    
    return `👥 <strong>Gerentes (${gerentes.length})</strong><br><br>${lista}`;
  }

  function processAjuda() {
    return `🤖 <strong>Assistente FINX v3.0</strong><br><br>` +
      `<strong>📊 ANÁLISES:</strong><br>` +
      `• "Taxa de quitação" - Quem paga 100% das prestações<br>` +
      `• "Rendimento por rota" - Performance financeira<br>` +
      `• "Análise completa do [gerente]" - Relatório detalhado<br>` +
      `• "Comparativo de gerentes" - Ranking geral<br>` +
      `• "Métricas do caixa" - KPIs financeiros<br><br>` +
      `<strong>💰 FINANCEIRO:</strong><br>` +
      `• "Caixa deste mês" ou "Caixa de janeiro"<br>` +
      `• "Quem está devendo mais?"<br>` +
      `• "Finalizaram com aberto"<br><br>` +
      `<strong>👥 GERENTES:</strong><br>` +
      `• "Situação do 026 Sávio"<br>` +
      `• "Histórico do Luís"<br>` +
      `• "Listar gerentes"<br><br>` +
      `<strong>⏰ PERÍODOS:</strong><br>` +
      `• "esta semana", "semana passada"<br>` +
      `• "este mês", "mês passado"<br>` +
      `• "janeiro", "fevereiro 2025"<br><br>` +
      `<strong>💡 DICA:</strong> Use "/limpar" para limpar o histórico.`;
  }

  // ===== MOTOR PRINCIPAL DE IA =====
  async function askLLM(text) {
    const intent = detectIntent(text);
    const entities = extractEntities(text);
    
    console.log('[AI] Intent:', intent.type, '| Confidence:', intent.confidence);
    
    // Coleta dados
    const ctx = await collectData(entities.periodo);
    
    // Atualiza contexto conversacional
    conversationContext.lastTopic = intent.type;
    conversationContext.lastPeriodo = entities.periodo;
    if (entities.gerentes.length) {
      conversationContext.lastGerente = entities.gerentes[0];
    }
    
    // Processa por intenção
    switch (intent.type) {
      // Novos analytics
      case 'frequencia_envio':
      case 'taxa_envio':
      case 'ranking_frequencia':
        return processFrequenciaEnvio(ctx, entities.gerentes);
      
      case 'rendimento_rota':
      case 'ranking_rendimento':
        return processRendimentoRota(ctx, entities.gerentes);
      
      case 'analise_completa_gerente':
        return processAnaliseCompletaGerente(ctx, entities.gerentes);
      
      case 'comparativo_gerentes':
        return processComparativoGerentes(ctx);
      
      case 'metricas_caixa':
        return processMetricasCaixa(ctx);
      
      // Intenções existentes
      case 'devedor_semana':
        return processDevedorSemana(ctx);
      
      case 'finalizou_com_aberto':
        return processFinalizouComAberto(ctx);
      
      case 'caixa_periodo':
      case 'fluxo_caixa':
        return processCaixaPeriodo(ctx);
      
      case 'resumo_geral':
      case 'resumo_semana':
        return processResumoGeral(ctx);
      
      case 'alertas':
        return processAlertas(ctx);
      
      case 'listar_gerentes':
        return processListarGerentes(ctx);
      
      case 'info_gerente_detalhe':
        return processAnaliseCompletaGerente(ctx, entities.gerentes);
      
      case 'maior_devedor':
      case 'ranking_inadimplente':
        return processDevedorSemana(ctx);
      
      case 'ajuda':
        return processAjuda();
      
      default:
        // Tenta inferir do contexto
        if (entities.temFrequencia) {
          return processFrequenciaEnvio(ctx, entities.gerentes);
        }
        if (entities.temRendimento || entities.temRota) {
          return processRendimentoRota(ctx, entities.gerentes);
        }
        if (entities.temAnalise && entities.gerentes.length) {
          return processAnaliseCompletaGerente(ctx, entities.gerentes);
        }
        if (entities.gerentes.length) {
          return processAnaliseCompletaGerente(ctx, entities.gerentes);
        }
        
        return processAjuda();
    }
  }

  // ===== UI FUNCTIONS =====
  const now_ = () => new Date().toISOString();

  function openPanel() {
    if (!el.panel) return;
    el.panel.classList.remove('is-hidden');
    el.panel.classList.add('is-visible');
    renderCompanyTag();
    if (!state.history.length) {
      renderGreeting();
      renderChips();
    }
    el.input?.focus();
  }

  function closePanel() {
    if (!el.panel) return;
    el.panel.classList.remove('is-visible');
    el.panel.classList.add('is-hidden');
  }

  function renderCompanyTag() {
    const c = getCompany();
    if (el.tag) el.tag.textContent = `• ${c}`;
  }

  function scrollBottom() {
    if (el.msgs) el.msgs.scrollTop = el.msgs.scrollHeight;
  }

  function bubble({ who, text, ts }) {
    const li = document.createElement('div');
    li.className = `ai__msg ${who}`;
    li.innerHTML = `
      <div class="bubble">
        ${text}
        <span class="meta">${time(ts || now_())}</span>
      </div>
    `;
    return li;
  }

  function renderHistory() {
    if (!el.msgs) return;
    el.msgs.innerHTML = '';
    state.history.forEach(m => el.msgs.appendChild(bubble(m)));
    scrollBottom();
  }

  function renderChips() {
    if (!el.chips) return;
    const chips = [
      'Resumo geral',
      'Taxa de quitação',
      'Rendimento por rota',
      'Comparativo de gerentes',
      'Alertas',
      'Ajuda'
    ];
    el.chips.innerHTML = '';
    chips.forEach(t => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ai__chip';
      b.textContent = t;
      b.onclick = () => sendText(t);
      el.chips.appendChild(b);
    });
  }

  function renderGreeting() {
    const c = getCompany();
    const nice = { BSX: 'BSX', BETPLAY: 'BetPlay', EMANUEL: 'Emanuel' }[c] || c;
    if (!el.msgs) return;
    el.msgs.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'ai__msg bot';
    row.innerHTML = `<div class="bubble">Olá! 👋 Sou seu assistente da <strong>${nice}</strong>.<br><br>` +
      `<strong>🆕 Novidades v3.0:</strong><br>` +
      `• <strong>Taxa de quitação</strong> - quem paga 100%<br>` +
      `• <strong>Rendimento por rota</strong><br>` +
      `• <strong>Análise completa</strong> de gerentes<br>` +
      `• <strong>Lucro/Prejuízo</strong> baseado no caixa<br><br>` +
      `Pergunte naturalmente ou use os botões!</div>`;
    el.msgs.appendChild(row);
  }

  function pushUser(text) {
    const msg = { who: 'me', text: esc(text), ts: now_() };
    state.history.push(msg);
    saveHistory();
    if (el.msgs) el.msgs.appendChild(bubble(msg));
    scrollBottom();
  }

  function pushBot(text) {
    const msg = { who: 'bot', text, ts: now_() };
    state.history.push(msg);
    saveHistory();
    if (el.msgs) el.msgs.appendChild(bubble(msg));
    scrollBottom();
  }

  function esc(s) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(s ?? '').replace(/[&<>"']/g, m => map[m]);
  }

  function showTyping(on) {
    if (el.typing) el.typing.classList.toggle('is-hidden', !on);
    scrollBottom();
  }

  async function streamBotText(fullText) {
    const parts = fullText.split(' ');
    let acc = '';
    const start = { who: 'bot', text: '', ts: now_() };
    const node = bubble(start);
    const bubbleEl = node.querySelector('.bubble');
    const contentSpan = document.createElement('span');
    bubbleEl.insertBefore(contentSpan, bubbleEl.firstChild);
    if (el.msgs) el.msgs.appendChild(node);
    scrollBottom();

    for (let i = 0; i < parts.length; i++) {
      acc += (i ? ' ' : '') + parts[i];
      contentSpan.innerHTML = acc;
      await wait(15 + Math.random() * 15);
      scrollBottom();
    }
    state.history.push({ who: 'bot', text: fullText, ts: now_() });
    saveHistory();
  }

  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  async function sendText(text) {
    const t = String(text || '').trim();
    if (!t) return;

    if (t === '/limpar') {
      state.history = [];
      saveHistory();
      renderHistory();
      renderGreeting();
      return;
    }

    pushUser(t);
    showTyping(true);
    try {
      const answer = await askLLM(t);
      showTyping(false);
      await streamBotText(answer);
    } catch (e) {
      console.error('[AI] Erro:', e);
      showTyping(false);
      pushBot('Ops, algo deu errado. Tente novamente.');
    }
  }

  // ===== Drag & Resize =====
  function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

  if (el.handle) {
    let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
    el.handle.addEventListener('mousedown', (ev) => {
      dragging = true;
      sx = ev.clientX; sy = ev.clientY;
      const rect = el.panel.getBoundingClientRect();
      ox = rect.left; oy = rect.top;
      ev.preventDefault();
    });
    window.addEventListener('mousemove', (ev) => {
      if (!dragging) return;
      const nx = ox + (ev.clientX - sx);
      const ny = oy + (ev.clientY - sy);
      const maxX = window.innerWidth - 120, maxY = window.innerHeight - 80;
      el.panel.style.left = clamp(nx, 8, maxX) + 'px';
      el.panel.style.top = clamp(ny, 8, maxY) + 'px';
      el.panel.style.right = 'auto';
      el.panel.style.bottom = 'auto';
    });
    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      const rect = el.panel.getBoundingClientRect();
      state.pos = { x: Math.round(rect.left), y: Math.round(rect.top) };
      state.pinned = false;
      saveUI(); updatePin();
    });
  }

  if (el.resize) {
    let sw = 0, sh = 0, sx = 0, sy = 0, resizing = false;
    el.resize.addEventListener('mousedown', (ev) => {
      resizing = true;
      const rect = el.panel.getBoundingClientRect();
      sw = rect.width; sh = rect.height; sx = ev.clientX; sy = ev.clientY;
      ev.preventDefault();
    });
    window.addEventListener('mousemove', (ev) => {
      if (!resizing) return;
      const w = clamp(sw + (ev.clientX - sx), 300, Math.min(700, window.innerWidth - 24));
      const h = clamp(sh + (ev.clientY - sy), 360, Math.min(900, window.innerHeight - 24));
      el.panel.style.width = w + 'px';
      el.panel.style.height = h + 'px';
    });
    window.addEventListener('mouseup', () => {
      if (!resizing) return;
      resizing = false;
      const rect = el.panel.getBoundingClientRect();
      state.size = { w: Math.round(rect.width), h: Math.round(rect.height) };
      saveUI();
    });
  }

  function updatePin() {
    if (el.btnPin) el.btnPin.textContent = state.pinned ? '📌' : '📍';
  }

  // ===== Eventos =====
  el.btnAI?.addEventListener('click', openPanel);
  el.btnClose?.addEventListener('click', closePanel);
  el.btnClear?.addEventListener('click', () => {
    state.history = [];
    saveHistory();
    renderHistory();
    renderGreeting();
    renderChips();
  });
  el.btnPin?.addEventListener('click', () => {
    state.pinned = !state.pinned;
    if (state.pinned) {
      el.panel.style.left = '';
      el.panel.style.top = '';
      el.panel.style.right = '24px';
      el.panel.style.bottom = '24px';
      state.pos = null;
    }
    saveUI();
    updatePin();
  });

  el.form?.addEventListener('submit', (ev) => {
    ev.preventDefault();
    sendText(el.input.value);
    el.input.value = '';
  });
  el.input?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      el.form.requestSubmit();
    }
    if (ev.key === 'Escape') closePanel();
  });

  window.addEventListener('keydown', (ev) => {
    if (ev.ctrlKey && ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      openPanel();
      el.input?.focus();
    }
  });

  // ===== Init =====
  (function init() {
    const ui = loadUI();
    if (ui.pinned === false) state.pinned = false;
    updatePin();
    renderCompanyTag();
    if (state.history.length) {
      renderHistory();
    }
  })();

  console.log('🤖 Assistente FINX v3.0 - Analytics Avançado carregado!');
})();