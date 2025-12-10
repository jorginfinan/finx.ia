// js/ai.js — Assistente IA Inteligente para Gestão Financeira v2.0
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

  // ===== CONTEXTO CONVERSACIONAL =====
  const conversationContext = {
    lastTopic: null,
    lastEntity: null,
    lastPeriodo: null,
    lastNumbers: [],
    lastAction: null,
    turnHistory: []
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
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleDateString('pt-BR');
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

    // ===== SEMANA PASSADA =====
    if (s.includes('semana passada') || s.includes('ultima semana') || s.includes('semana anterior')) {
      const inicioSemanaPassada = new Date(hoje);
      inicioSemanaPassada.setDate(hoje.getDate() - hoje.getDay() - 7); // Domingo da semana passada
      inicioSemanaPassada.setHours(0,0,0,0);
      const fimSemanaPassada = new Date(inicioSemanaPassada);
      fimSemanaPassada.setDate(inicioSemanaPassada.getDate() + 6); // Sábado da semana passada
      fimSemanaPassada.setHours(23,59,59,999);
      return { 
        tipo: 'semana', 
        inicio: inicioSemanaPassada, 
        fim: fimSemanaPassada, 
        label: `Semana passada (${fmtData(inicioSemanaPassada)} a ${fmtData(fimSemanaPassada)})`,
        passado: true
      };
    }

    // ===== ESTA SEMANA / ESSA SEMANA =====
    if (s.includes('essa semana') || s.includes('esta semana') || s.includes('semana atual') || 
        (s.includes('semana') && !s.includes('passada') && !s.includes('anterior'))) {
      const inicioSemana = new Date(hoje);
      inicioSemana.setDate(hoje.getDate() - hoje.getDay()); // Domingo desta semana
      inicioSemana.setHours(0,0,0,0);
      const fimSemana = new Date(inicioSemana);
      fimSemana.setDate(inicioSemana.getDate() + 6); // Sábado desta semana
      fimSemana.setHours(23,59,59,999);
      return { 
        tipo: 'semana', 
        inicio: inicioSemana, 
        fim: fimSemana, 
        label: `Esta semana (${fmtData(inicioSemana)} a ${fmtData(fimSemana)})`,
        passado: false
      };
    }

    // Detecta mês específico
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

    // Detecta períodos relativos
    if (s.includes('hoje')) {
      const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0);
      const fimHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
      return { tipo: 'dia', inicio: inicioHoje, fim: fimHoje, label: 'Hoje' };
    }

    if (s.includes('ontem')) {
      const ontem = new Date(hoje);
      ontem.setDate(hoje.getDate() - 1);
      const inicioOntem = new Date(ontem.getFullYear(), ontem.getMonth(), ontem.getDate(), 0, 0, 0);
      const fimOntem = new Date(ontem.getFullYear(), ontem.getMonth(), ontem.getDate(), 23, 59, 59);
      return { tipo: 'dia', inicio: inicioOntem, fim: fimOntem, label: 'Ontem' };
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

    if (s.includes('ano')) {
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

  // ===== EXTRAÇÃO DE ENTIDADES =====
  function extractEntities(text) {
    const s = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    return {
      periodo: parsePeriodo(text),
      gerentes: extrairNomesGerentes(s),
      fichas: (s.match(/\b\d{4}\b/g) || []),
      temComparativo: /compar|melhor|pior|mais|menos|maior|menor|ranking|top|primeiro|ultimo/.test(s),
      temTendencia: /tendencia|evolucao|cresceu|caiu|subiu|desceu|variacao/.test(s),
      temAlerta: /alerta|problema|atencao|cuidado|critico|urgente|acima|estoura/.test(s),
      temSemana: /semana/.test(s),
      temFinalizou: /finaliz|encerr|fechou|quitou|conclu/.test(s),
      temAberto: /aberto|pendente|devendo|deve|falta/.test(s)
    };
  }

  function extrairNomesGerentes(s) {
    const pattern = /\b(\d{3})\s+([a-záéíóúãõ]+)\b/gi;
    const matches = [];
    let match;
    while ((match = pattern.exec(s)) !== null) {
      matches.push({ numero: match[1], nome: match[2] });
    }
    return matches;
  }

  // ===== DETECÇÃO DE INTENÇÃO AVANÇADA =====
  function detectIntent(text) {
    const s = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Mapeamento de padrões para intenções
    const intents = [
      // ===== NOVAS INTENÇÕES SEMANAIS =====
      { pattern: /semana.*(quem|qual).*(deve|devendo|aberto|maior)/, type: 'devedor_semana', confidence: 0.95 },
      { pattern: /(quem|qual).*(deve|devendo|aberto|maior).*semana/, type: 'devedor_semana', confidence: 0.95 },
      { pattern: /(essa|esta|semana).*(deve|devendo|maior.*valor)/, type: 'devedor_semana', confidence: 0.95 },
      { pattern: /semana.*(finaliz|encerr|fechou).*(aberto|pendente|valor)/, type: 'finalizou_com_aberto', confidence: 0.95 },
      { pattern: /(finaliz|encerr|fechou).*(aberto|pendente|valor).*semana/, type: 'finalizou_com_aberto', confidence: 0.95 },
      { pattern: /semana.*gerente.*(finaliz|fechou)/, type: 'finalizou_com_aberto', confidence: 0.9 },
      { pattern: /semana.*(prestac|conta).*aberta/, type: 'prestacoes_semana', confidence: 0.9 },
      { pattern: /semana.*(receb|entrada|pagou|pago)/, type: 'movimentacao_semana', confidence: 0.9 },
      { pattern: /(receb|entrada|pagou|pago).*semana/, type: 'movimentacao_semana', confidence: 0.9 },
      { pattern: /semana.*(resum|como.*esta|situacao)/, type: 'resumo_semana', confidence: 0.9 },
      { pattern: /(resum|situacao).*semana/, type: 'resumo_semana', confidence: 0.9 },
      
      // Caixa e Financeiro
      { pattern: /caixa|saldo|balanco|entrada|saida/, type: 'caixa_periodo', confidence: 0.9 },
      { pattern: /fluxo\s*(de\s*)?caixa/, type: 'fluxo_caixa', confidence: 0.95 },
      
      // Rankings e Comparativos
      { pattern: /(quem|qual).*(paga|pagou).*(melhor|mais\s*rapido|pontual|primeiro)/, type: 'ranking_pagamento', confidence: 0.95 },
      { pattern: /(quem|qual).*(paga|pagou).*(pior|atrasado|devagar|ultimo)/, type: 'ranking_inadimplente', confidence: 0.95 },
      { pattern: /(maior|mais).*(devedor|divida|deve|aberto)/, type: 'maior_devedor', confidence: 0.9 },
      { pattern: /(menor|menos).*(devedor|divida|deve)/, type: 'menor_devedor', confidence: 0.9 },
      
      // Despesas
      { pattern: /despesa.*(acima|estoura|passa|ultrapassa|permitid|ideal|limit)/, type: 'despesas_acima', confidence: 0.95 },
      { pattern: /(quem|qual).*(mais|maior).*(despesa|gast)/, type: 'ranking_despesas', confidence: 0.9 },
      { pattern: /total.*(despesa|gasto)/, type: 'total_despesas', confidence: 0.85 },
      
      // Prestações
      { pattern: /prestac.*(aberta|pendente|atrasad)/, type: 'prestacoes_abertas', confidence: 0.9 },
      { pattern: /prestac.*(fechad|quitad|pag)/, type: 'prestacoes_fechadas', confidence: 0.9 },
      { pattern: /total.*prestac/, type: 'total_prestacoes', confidence: 0.85 },
      
      // Gerentes específicos
      { pattern: /gerente.*(lista|todos|quais|quantos)/, type: 'listar_gerentes', confidence: 0.9 },
      { pattern: /\d{3}\s+[a-z]/, type: 'info_gerente', confidence: 0.8 },
      
      // Análises e Insights
      { pattern: /resum|visao\s*geral|status|como\s*(esta|vai|anda)|situacao/, type: 'resumo_geral', confidence: 0.85 },
      { pattern: /alert|problema|atencao|cuidado|critico/, type: 'alertas', confidence: 0.9 },
      { pattern: /tendencia|evolucao|historico|comparar.*mes/, type: 'tendencia', confidence: 0.85 },
      { pattern: /previsao|projecao|estimativa/, type: 'previsao', confidence: 0.8 },
      
      // Ajuda
      { pattern: /ajuda|help|o\s*que\s*(voce|vc)\s*(faz|pode)|como\s*(usar|funciona)/, type: 'ajuda', confidence: 0.95 }
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
      prestacoesSemFiltro: [], // Para análises que precisam de todas
      lancamentos: [],
      pendencias: [],
      despesas: [],
      periodo: periodo
    };

    const empresaAtual = getCompany();
    console.log('[AI] Coletando dados para:', empresaAtual, periodo?.label);

    // Gerentes
    try {
      if (window.SupabaseAPI?.gerentes?.getAll) {
        const gerentes = await window.SupabaseAPI.gerentes.getAll();
        ctx.gerentes = (gerentes || []).map(g => ({
          id: g.id,
          uid: g.uid || g.id,
          nome: g.nome || g.apelido || '',
          numero: g.numero || g.rota || '',
          comissao: Number(g.comissao) || 0
        }));
      } else if (Array.isArray(window.gerentes)) {
        ctx.gerentes = window.gerentes;
      }
    } catch(e) { console.warn('[AI] Erro gerentes:', e); }

    // Prestações
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
            ini: p.ini,
            fim: p.fim,
            fechado: !!p.fechado,
            aPagar: Number(resumo.aPagar) || Number(p.a_pagar) || 0,
            restam: Number(resumo.restam) || Number(p.restam) || 0,
            pagos: Number(resumo.pagos) || Number(p.pagos) || 0,
            coletas: Number(resumo.coletas) || 0,
            despesas: Number(resumo.despesas) || 0,
            createdAt: p.created_at || p.createdAt
          };
        });
        
        ctx.prestacoesSemFiltro = mapped;
        
        // Filtra por período se especificado
        if (periodo?.inicio && periodo?.fim) {
          ctx.prestacoes = mapped.filter(p => {
            const dataP = new Date(p.fim || p.ini || p.createdAt);
            return dataP >= periodo.inicio && dataP <= periodo.fim;
          });
        } else {
          ctx.prestacoes = mapped;
        }
      }
    } catch(e) { console.warn('[AI] Erro prestações:', e); }

    // Lançamentos (Financeiro) - SEMPRE FILTRADO POR PERÍODO
    try {
      if (window.SupabaseAPI?.lancamentos?.getAll) {
        const lancamentos = await window.SupabaseAPI.lancamentos.getAll();
        const mapped = (lancamentos || []).map(l => ({
          id: l.id,
          uid: l.uid,
          gerente: l.gerente || '',
          gerenteId: l.gerente_id,
          gerenteNome: ctx.gerentes.find(g => g.uid === l.gerente_id || g.id === l.gerente_id)?.nome || l.gerente || '',
          valor: Number(l.valor) || 0,
          tipo: l.tipo || '',
          status: l.status || '',
          forma: l.forma || '',
          data: l.data,
          createdAt: l.created_at
        }));
        
        // ✅ SEMPRE filtra por período para mostrar dados corretos
        if (periodo?.inicio && periodo?.fim) {
          ctx.lancamentos = mapped.filter(l => {
            const dataL = new Date(l.data || l.createdAt);
            return dataL >= periodo.inicio && dataL <= periodo.fim;
          });
        } else {
          ctx.lancamentos = mapped;
        }
      } else if (Array.isArray(window.lanc)) {
        // Fallback para localStorage - também filtrado
        const mapped = window.lanc.map(l => ({
          ...l,
          gerenteNome: l.gerente || ''
        }));
        
        if (periodo?.inicio && periodo?.fim) {
          ctx.lancamentos = mapped.filter(l => {
            const dataL = new Date(l.data);
            return dataL >= periodo.inicio && dataL <= periodo.fim;
          });
        } else {
          ctx.lancamentos = mapped;
        }
      }
    } catch(e) { console.warn('[AI] Erro lançamentos:', e); }

    // Pendências
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

    console.log('[AI] Dados coletados:', {
      gerentes: ctx.gerentes.length,
      prestacoes: ctx.prestacoes.length,
      lancamentos: ctx.lancamentos.length,
      pendencias: ctx.pendencias.length
    });

    return ctx;
  }

  // ===== PROCESSADORES DE RESPOSTA =====

  // ===== NOVOS PROCESSADORES SEMANAIS =====

  // 🔴 Quem está devendo mais esta semana/semana passada
  function processDevedorSemana(ctx) {
    const { prestacoes, periodo } = ctx;
    
    // Considera prestações abertas OU com saldo restante
    const comAberto = prestacoes.filter(p => p.restam > 0);
    
    if (!comAberto.length) {
      return `✅ <strong>Nenhuma prestação com valores em aberto - ${periodo?.label}</strong><br><br>` +
        `Todos os gerentes estão em dia neste período!`;
    }
    
    // Agrupa por gerente
    const stats = {};
    comAberto.forEach(p => {
      const gid = p.gerenteId;
      if (!stats[gid]) {
        stats[gid] = {
          nome: p.gerenteNome || 'Desconhecido',
          numero: p.gerenteNumero || '',
          totalAberto: 0,
          qtdAbertas: 0,
          prestacoes: []
        };
      }
      stats[gid].totalAberto += p.restam;
      stats[gid].qtdAbertas++;
      stats[gid].prestacoes.push(p);
    });
    
    const ranking = Object.values(stats)
      .sort((a, b) => b.totalAberto - a.totalAberto)
      .slice(0, 10);
    
    const lista = ranking.map((g, i) => {
      const nome = g.numero ? `${g.numero} ${g.nome}` : g.nome;
      const medal = i === 0 ? '🔴' : i === 1 ? '🟠' : i === 2 ? '🟡' : `${i+1}.`;
      return `${medal} <strong>${nome}</strong>: ${fmt(g.totalAberto)} em aberto (${g.qtdAbertas} prestação(ões))`;
    }).join('<br>');
    
    const totalGeral = ranking.reduce((s, g) => s + g.totalAberto, 0);
    
    return `📅 <strong>Maiores Devedores - ${periodo?.label}</strong><br><br>` +
      `${lista}<br><br>` +
      `💰 <strong>Total em aberto no período:</strong> ${fmt(totalGeral)}`;
  }

  // 🟠 Quem finalizou prestações com valores em aberto
  function processFinalizouComAberto(ctx) {
    const { prestacoes, periodo } = ctx;
    
    // Prestações FECHADAS mas com saldo restante > 0
    const finalizadasComAberto = prestacoes.filter(p => 
      p.fechado && p.restam > 0
    );
    
    if (!finalizadasComAberto.length) {
      return `✅ <strong>Nenhuma prestação finalizada com valores em aberto - ${periodo?.label}</strong><br><br>` +
        `Todas as prestações finalizadas neste período foram quitadas corretamente!`;
    }
    
    // Agrupa por gerente
    const stats = {};
    finalizadasComAberto.forEach(p => {
      const gid = p.gerenteId;
      if (!stats[gid]) {
        stats[gid] = {
          nome: p.gerenteNome || 'Desconhecido',
          numero: p.gerenteNumero || '',
          totalAberto: 0,
          qtd: 0,
          periodos: []
        };
      }
      stats[gid].totalAberto += p.restam;
      stats[gid].qtd++;
      stats[gid].periodos.push(`${fmtData(p.ini)} a ${fmtData(p.fim)}`);
    });
    
    const ranking = Object.values(stats)
      .sort((a, b) => b.totalAberto - a.totalAberto);
    
    const lista = ranking.map((g, i) => {
      const nome = g.numero ? `${g.numero} ${g.nome}` : g.nome;
      return `${i+1}. <strong>${nome}</strong>: ${fmt(g.totalAberto)} em aberto<br>` +
        `&nbsp;&nbsp;&nbsp;&nbsp;<em>${g.qtd} prestação(ões) finalizada(s)</em>`;
    }).join('<br>');
    
    const totalGeral = ranking.reduce((s, g) => s + g.totalAberto, 0);
    
    return `⚠️ <strong>Finalizaram com valores em aberto - ${periodo?.label}</strong><br><br>` +
      `${lista}<br><br>` +
      `💰 <strong>Total não quitado:</strong> ${fmt(totalGeral)}<br><br>` +
      `<em>⚠️ Estes valores foram "passados para frente" sem quitação.</em>`;
  }

  // 📊 Prestações da semana
  function processPrestacoesSemana(ctx) {
    const { prestacoes, periodo } = ctx;
    
    if (!prestacoes.length) {
      return `📅 <strong>Prestações - ${periodo?.label}</strong><br><br>` +
        `Nenhuma prestação encontrada neste período.`;
    }
    
    const abertas = prestacoes.filter(p => !p.fechado || p.restam > 0);
    const quitadas = prestacoes.filter(p => p.fechado && p.restam <= 0);
    
    const totalAPagar = prestacoes.reduce((s, p) => s + p.aPagar, 0);
    const totalPago = prestacoes.reduce((s, p) => s + p.pagos, 0);
    const totalAberto = prestacoes.reduce((s, p) => s + p.restam, 0);
    const percPago = totalAPagar > 0 ? (totalPago / totalAPagar) * 100 : 0;
    
    let resp = `📅 <strong>Prestações - ${periodo?.label}</strong><br><br>`;
    resp += `📊 <strong>Resumo:</strong><br>`;
    resp += `• Total de prestações: ${prestacoes.length}<br>`;
    resp += `• Quitadas: ${quitadas.length}<br>`;
    resp += `• Em aberto: ${abertas.length}<br><br>`;
    resp += `💰 <strong>Valores:</strong><br>`;
    resp += `• A pagar: ${fmt(totalAPagar)}<br>`;
    resp += `• Pago: ${fmt(totalPago)} (${fmtPerc(percPago)})<br>`;
    resp += `• Resta: ${fmt(totalAberto)}`;
    
    return resp;
  }

  // 💸 Movimentação da semana
  function processMovimentacaoSemana(ctx) {
    const { lancamentos, periodo } = ctx;
    
    if (!lancamentos.length) {
      return `📅 <strong>Movimentação - ${periodo?.label}</strong><br><br>` +
        `Nenhum lançamento encontrado neste período.`;
    }
    
    const recebimentos = lancamentos.filter(l => /RECEBIDO/i.test(l.status));
    const pagamentos = lancamentos.filter(l => /PAGO/i.test(l.status));
    
    const totalRec = recebimentos.reduce((s, l) => s + l.valor, 0);
    const totalPag = pagamentos.reduce((s, l) => s + l.valor, 0);
    const saldo = totalRec - totalPag;
    
    // Top 5 recebimentos
    const topRec = [...recebimentos].sort((a,b) => b.valor - a.valor).slice(0, 5);
    // Top 5 pagamentos
    const topPag = [...pagamentos].sort((a,b) => b.valor - a.valor).slice(0, 5);
    
    let resp = `📅 <strong>Movimentação - ${periodo?.label}</strong><br><br>`;
    
    resp += `💰 <strong>Entradas:</strong> ${fmt(totalRec)} (${recebimentos.length} lançamentos)<br>`;
    if (topRec.length) {
      resp += `<em>Maiores:</em><br>`;
      topRec.forEach((l, i) => {
        resp += `&nbsp;&nbsp;${i+1}. ${l.gerente || l.gerenteNome || 'N/A'}: ${fmt(l.valor)}<br>`;
      });
    }
    
    resp += `<br>💸 <strong>Saídas:</strong> ${fmt(totalPag)} (${pagamentos.length} lançamentos)<br>`;
    if (topPag.length) {
      resp += `<em>Maiores:</em><br>`;
      topPag.forEach((l, i) => {
        resp += `&nbsp;&nbsp;${i+1}. ${l.gerente || l.gerenteNome || 'N/A'}: ${fmt(l.valor)}<br>`;
      });
    }
    
    const saldoIcon = saldo >= 0 ? '✅' : '⚠️';
    resp += `<br>${saldoIcon} <strong>Saldo:</strong> ${fmt(saldo)}`;
    
    return resp;
  }

  // 📋 Resumo da semana
  function processResumoSemana(ctx) {
    const { prestacoes, lancamentos, pendencias, periodo } = ctx;
    
    // Prestações
    const prestacoesAbertas = prestacoes.filter(p => !p.fechado || p.restam > 0);
    const totalAberto = prestacoesAbertas.reduce((s, p) => s + p.restam, 0);
    
    // Caixa
    const recebimentos = lancamentos.filter(l => /RECEBIDO/i.test(l.status));
    const pagamentos = lancamentos.filter(l => /PAGO/i.test(l.status));
    const totalRec = recebimentos.reduce((s, l) => s + l.valor, 0);
    const totalPag = pagamentos.reduce((s, l) => s + l.valor, 0);
    const saldo = totalRec - totalPag;
    
    let resp = `📅 <strong>Resumo - ${periodo?.label}</strong><br><br>`;
    
    resp += `📋 <strong>Prestações:</strong><br>`;
    resp += `• Total: ${prestacoes.length}<br>`;
    resp += `• Em aberto: ${prestacoesAbertas.length} (${fmt(totalAberto)})<br><br>`;
    
    resp += `💰 <strong>Caixa:</strong><br>`;
    resp += `• Entradas: ${fmt(totalRec)} (${recebimentos.length})<br>`;
    resp += `• Saídas: ${fmt(totalPag)} (${pagamentos.length})<br>`;
    const saldoIcon = saldo >= 0 ? '✅' : '⚠️';
    resp += `• Saldo: ${saldoIcon} ${fmt(saldo)}<br><br>`;
    
    if (pendencias.length) {
      const totalPend = pendencias.reduce((s, p) => s + p.valor, 0);
      resp += `⏳ <strong>Pendências:</strong> ${pendencias.length} (${fmt(totalPend)})<br><br>`;
    }
    
    // Alertas
    const alertas = [];
    if (saldo < 0) alertas.push('🔴 Saldo negativo');
    if (prestacoesAbertas.length > 5) alertas.push(`⚠️ ${prestacoesAbertas.length} prestações em aberto`);
    if (pendencias.length > 5) alertas.push(`📋 ${pendencias.length} pendências aguardando`);
    
    // Finalizaram com aberto
    const finalizadasComAberto = prestacoes.filter(p => p.fechado && p.restam > 0);
    if (finalizadasComAberto.length) {
      const totalFinAberto = finalizadasComAberto.reduce((s, p) => s + p.restam, 0);
      alertas.push(`⚠️ ${finalizadasComAberto.length} fecharam com ${fmt(totalFinAberto)} em aberto`);
    }
    
    if (alertas.length) {
      resp += `<strong>🚨 Alertas:</strong><br>` + alertas.join('<br>');
    } else {
      resp += `✅ <strong>Tudo em ordem!</strong>`;
    }
    
    return resp;
  }

  // ===== PROCESSADORES EXISTENTES (MELHORADOS) =====

  // Caixa do período
  function processCaixaPeriodo(ctx) {
    const { lancamentos, periodo } = ctx;
    
    if (!lancamentos.length) {
      return `📊 <strong>Caixa - ${periodo?.label || 'Período'}</strong><br><br>` +
        `Sem lançamentos encontrados para este período.`;
    }
    
    const recebimentos = lancamentos.filter(l => 
      /RECEBIDO|ENTRADA|CREDITO/i.test(l.tipo) || /RECEBIDO/i.test(l.status)
    );
    const pagamentos = lancamentos.filter(l => 
      /PAGO|SAIDA|DEBITO/i.test(l.tipo) || /PAGO/i.test(l.status)
    );
    
    const totalRec = recebimentos.reduce((s, l) => s + l.valor, 0);
    const totalPag = pagamentos.reduce((s, l) => s + l.valor, 0);
    const saldo = totalRec - totalPag;
    
    const saldoClass = saldo >= 0 ? '✅' : '⚠️';
    
    return `📊 <strong>Caixa - ${periodo?.label || 'Período'}</strong><br><br>` +
      `💰 <strong>Entradas:</strong> ${fmt(totalRec)} (${recebimentos.length} lançamentos)<br>` +
      `💸 <strong>Saídas:</strong> ${fmt(totalPag)} (${pagamentos.length} lançamentos)<br>` +
      `${saldoClass} <strong>Saldo:</strong> ${fmt(saldo)}<br><br>` +
      (saldo < 0 ? `<em>⚠️ Atenção: Saldo negativo no período!</em>` : 
       saldo > 0 ? `<em>✅ Período positivo!</em>` : '');
  }

  // Ranking de pagamento (quem paga melhor)
  function processRankingPagamento(ctx) {
    const { prestacoes, gerentes } = ctx;
    
    if (!prestacoes.length) {
      return 'Sem prestações para analisar no período.';
    }
    
    const stats = {};
    prestacoes.forEach(p => {
      const gid = p.gerenteId;
      if (!stats[gid]) {
        stats[gid] = {
          nome: p.gerenteNome || 'Desconhecido',
          numero: p.gerenteNumero || '',
          totalAPagar: 0,
          totalPago: 0,
          qtdPrestacoes: 0,
          qtdQuitadas: 0
        };
      }
      stats[gid].totalAPagar += p.aPagar;
      stats[gid].totalPago += p.pagos;
      stats[gid].qtdPrestacoes++;
      if (p.fechado && p.restam <= 0) stats[gid].qtdQuitadas++;
    });
    
    const ranking = Object.values(stats)
      .map(g => ({
        ...g,
        percPago: g.totalAPagar > 0 ? (g.totalPago / g.totalAPagar) * 100 : 0,
        percQuitadas: g.qtdPrestacoes > 0 ? (g.qtdQuitadas / g.qtdPrestacoes) * 100 : 0
      }))
      .sort((a, b) => b.percPago - a.percPago)
      .slice(0, 10);
    
    if (!ranking.length) {
      return 'Sem dados suficientes para ranking.';
    }
    
    const lista = ranking.map((g, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
      const nome = g.numero ? `${g.numero} ${g.nome}` : g.nome;
      return `${medal} <strong>${nome}</strong>: ${fmtPerc(g.percPago)} pago (${g.qtdQuitadas}/${g.qtdPrestacoes} quitadas)`;
    }).join('<br>');
    
    return `🏆 <strong>Ranking - Quem Paga Melhor</strong><br><br>${lista}`;
  }

  // Ranking de inadimplentes
  function processRankingInadimplente(ctx) {
    const { prestacoes } = ctx;
    
    const abertas = prestacoes.filter(p => p.restam > 0);
    
    if (!abertas.length) {
      return '✅ Nenhuma prestação em aberto no momento!';
    }
    
    const stats = {};
    abertas.forEach(p => {
      const gid = p.gerenteId;
      if (!stats[gid]) {
        stats[gid] = {
          nome: p.gerenteNome,
          numero: p.gerenteNumero,
          totalAberto: 0,
          qtdAbertas: 0
        };
      }
      stats[gid].totalAberto += p.restam;
      stats[gid].qtdAbertas++;
    });
    
    const ranking = Object.values(stats)
      .sort((a, b) => b.totalAberto - a.totalAberto)
      .slice(0, 10);
    
    const lista = ranking.map((g, i) => {
      const nome = g.numero ? `${g.numero} ${g.nome}` : g.nome;
      return `${i+1}. <strong>${nome}</strong>: ${fmt(g.totalAberto)} em aberto (${g.qtdAbertas} prestações)`;
    }).join('<br>');
    
    const totalGeral = ranking.reduce((s, g) => s + g.totalAberto, 0);
    
    return `⚠️ <strong>Maiores Devedores</strong><br><br>${lista}<br><br>` +
      `💰 <strong>Total em aberto:</strong> ${fmt(totalGeral)}`;
  }

  // Despesas acima do permitido
  function processDespesasAcima(ctx) {
    const { prestacoes, gerentes } = ctx;
    
    const stats = {};
    prestacoes.forEach(p => {
      const gid = p.gerenteId;
      if (!stats[gid]) {
        stats[gid] = {
          nome: p.gerenteNome,
          numero: p.gerenteNumero,
          totalDespesas: 0,
          totalColetas: 0,
          qtdPrestacoes: 0
        };
      }
      stats[gid].totalDespesas += p.despesas;
      stats[gid].totalColetas += p.coletas;
      stats[gid].qtdPrestacoes++;
    });
    
    const ranking = Object.values(stats)
      .filter(g => g.totalColetas > 0)
      .map(g => ({
        ...g,
        percDespesa: (g.totalDespesas / g.totalColetas) * 100,
        excedente: g.totalDespesas - (g.totalColetas * 0.20)
      }))
      .filter(g => g.excedente > 0)
      .sort((a, b) => b.excedente - a.excedente)
      .slice(0, 10);
    
    if (!ranking.length) {
      return '✅ <strong>Nenhum gerente com despesas acima do ideal!</strong><br><br>' +
        'Todos estão dentro do limite de 20% das coletas.';
    }
    
    const lista = ranking.map((g, i) => {
      const nome = g.numero ? `${g.numero} ${g.nome}` : g.nome;
      return `${i+1}. <strong>${nome}</strong>: ${fmtPerc(g.percDespesa)} das coletas<br>` +
        `&nbsp;&nbsp;&nbsp;&nbsp;Despesas: ${fmt(g.totalDespesas)} | Excedente: ${fmt(g.excedente)}`;
    }).join('<br>');
    
    return `⚠️ <strong>Despesas Acima do Ideal (>20%)</strong><br><br>${lista}`;
  }

  // Ranking de despesas
  function processRankingDespesas(ctx) {
    const { prestacoes } = ctx;
    
    const stats = {};
    prestacoes.forEach(p => {
      const gid = p.gerenteId;
      if (!stats[gid]) {
        stats[gid] = { nome: p.gerenteNome, numero: p.gerenteNumero, total: 0, qtd: 0 };
      }
      stats[gid].total += p.despesas;
      stats[gid].qtd++;
    });
    
    const ranking = Object.values(stats)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
    
    const lista = ranking.map((g, i) => {
      const nome = g.numero ? `${g.numero} ${g.nome}` : g.nome;
      return `${i+1}. <strong>${nome}</strong>: ${fmt(g.total)} (${g.qtd} prestações)`;
    }).join('<br>');
    
    return `💸 <strong>Ranking de Despesas</strong><br><br>${lista}`;
  }

  // Total de despesas
  function processTotalDespesas(ctx) {
    const { prestacoes, periodo } = ctx;
    
    const total = prestacoes.reduce((s, p) => s + p.despesas, 0);
    const totalColetas = prestacoes.reduce((s, p) => s + p.coletas, 0);
    const perc = totalColetas > 0 ? (total / totalColetas) * 100 : 0;
    
    return `💸 <strong>Total de Despesas - ${periodo?.label}</strong><br><br>` +
      `• Total: ${fmt(total)}<br>` +
      `• % sobre coletas: ${fmtPerc(perc)}<br>` +
      `• Prestações analisadas: ${prestacoes.length}`;
  }

  // Prestações abertas
  function processPrestacoesAbertas(ctx) {
    const { prestacoes } = ctx;
    
    const abertas = prestacoes.filter(p => p.restam > 0);
    
    if (!abertas.length) {
      return '✅ Nenhuma prestação em aberto!';
    }
    
    const totalAberto = abertas.reduce((s, p) => s + p.restam, 0);
    
    const lista = abertas
      .sort((a, b) => b.restam - a.restam)
      .slice(0, 10)
      .map((p, i) => {
        const nome = p.gerenteNumero ? `${p.gerenteNumero} ${p.gerenteNome}` : p.gerenteNome;
        const status = p.fechado ? ' (finalizada!)' : '';
        return `${i+1}. <strong>${nome}</strong>: ${fmt(p.restam)}${status}`;
      }).join('<br>');
    
    return `📋 <strong>Prestações em Aberto (${abertas.length})</strong><br><br>` +
      `${lista}<br><br>` +
      `💰 <strong>Total em aberto:</strong> ${fmt(totalAberto)}`;
  }

  // Listar gerentes
  function processListarGerentes(ctx) {
    const { gerentes } = ctx;
    
    if (!gerentes.length) {
      return 'Nenhum gerente cadastrado.';
    }
    
    const lista = gerentes.map((g, i) => 
      `${i+1}. <strong>${g.numero || '---'}</strong> ${g.nome} (${g.comissao}%)`
    ).join('<br>');
    
    return `👥 <strong>Gerentes Cadastrados (${gerentes.length})</strong><br><br>${lista}`;
  }

  // Alertas
  function processAlertas(ctx) {
    const { prestacoes, pendencias, lancamentos } = ctx;
    const alertas = [];
    
    const muitoAberto = prestacoes.filter(p => p.restam > 5000);
    if (muitoAberto.length) {
      alertas.push(`⚠️ <strong>${muitoAberto.length}</strong> prestações com mais de R$ 5.000 em aberto`);
    }
    
    // Finalizaram com aberto
    const finalizadasComAberto = prestacoes.filter(p => p.fechado && p.restam > 0);
    if (finalizadasComAberto.length) {
      const totalFinAberto = finalizadasComAberto.reduce((s, p) => s + p.restam, 0);
      alertas.push(`🔴 <strong>${finalizadasComAberto.length}</strong> prestações finalizadas com ${fmt(totalFinAberto)} em aberto`);
    }
    
    if (pendencias.length > 10) {
      alertas.push(`📋 <strong>${pendencias.length}</strong> pendências aguardando confirmação`);
    }
    
    const despesasAltas = prestacoes.filter(p => 
      p.coletas > 0 && (p.despesas / p.coletas) > 0.25
    );
    if (despesasAltas.length) {
      alertas.push(`💸 <strong>${despesasAltas.length}</strong> prestações com despesas acima de 25%`);
    }
    
    const recebido = lancamentos.filter(l => /RECEBIDO/i.test(l.status)).reduce((s,l) => s + l.valor, 0);
    const pago = lancamentos.filter(l => /PAGO/i.test(l.status)).reduce((s,l) => s + l.valor, 0);
    if (pago > recebido) {
      alertas.push(`🔴 Saldo negativo no período: ${fmt(recebido - pago)}`);
    }
    
    if (!alertas.length) {
      return '✅ <strong>Nenhum alerta no momento!</strong><br><br>Tudo parece estar em ordem.';
    }
    
    return `🚨 <strong>Alertas</strong><br><br>` + alertas.join('<br><br>');
  }

  // Resumo geral
  function processResumoGeral(ctx) {
    const { gerentes, prestacoes, lancamentos, pendencias, periodo } = ctx;
    const parts = [];
    
    parts.push(`📅 <strong>Período:</strong> ${periodo?.label || 'Geral'}`);
    
    parts.push(`👥 <strong>Gerentes:</strong> ${gerentes.length} cadastrados`);
    
    const abertas = prestacoes.filter(p => p.restam > 0);
    const totalAberto = abertas.reduce((s, p) => s + p.restam, 0);
    parts.push(`📋 <strong>Prestações:</strong> ${prestacoes.length} no período (${abertas.length} em aberto: ${fmt(totalAberto)})`);
    
    const recebido = lancamentos.filter(l => /RECEBIDO|ENTRADA/i.test(l.tipo) || /RECEBIDO/i.test(l.status))
      .reduce((s, l) => s + l.valor, 0);
    const pago = lancamentos.filter(l => /PAGO|SAIDA/i.test(l.tipo) || /PAGO/i.test(l.status))
      .reduce((s, l) => s + l.valor, 0);
    const saldo = recebido - pago;
    const saldoIcon = saldo >= 0 ? '✅' : '⚠️';
    parts.push(`💰 <strong>Caixa:</strong> ${saldoIcon} ${fmt(saldo)} (Entradas: ${fmt(recebido)} | Saídas: ${fmt(pago)})`);
    
    if (pendencias.length) {
      const totalPend = pendencias.reduce((s, p) => s + p.valor, 0);
      parts.push(`⏳ <strong>Pendências:</strong> ${pendencias.length} (${fmt(totalPend)})`);
    }
    
    return parts.join('<br><br>');
  }

  // Ajuda
  function processAjuda() {
    return `🤖 <strong>Assistente Financeiro Inteligente v2.0</strong><br><br>` +
      `Posso ajudar com:<br><br>` +
      `<strong>📊 Caixa e Financeiro:</strong><br>` +
      `• "Como está o caixa de dezembro?"<br>` +
      `• "Qual o saldo do mês passado?"<br>` +
      `• "Movimentação desta semana"<br><br>` +
      `<strong>📅 Análises Semanais:</strong><br>` +
      `• "Quem está devendo mais esta semana?"<br>` +
      `• "Da semana passada quem finalizou com valores em aberto?"<br>` +
      `• "Resumo da semana"<br><br>` +
      `<strong>🏆 Rankings e Análises:</strong><br>` +
      `• "Quem paga melhor as prestações?"<br>` +
      `• "Qual gerente mais devedor?"<br>` +
      `• "Quem tem despesas acima do ideal?"<br><br>` +
      `<strong>📋 Prestações:</strong><br>` +
      `• "Prestações em aberto"<br>` +
      `• "Total de despesas deste mês"<br><br>` +
      `<strong>🚨 Alertas:</strong><br>` +
      `• "Tem algum alerta?"<br>` +
      `• "Situação atual"<br><br>` +
      `<em>💡 Dica: Especifique o período para análises mais precisas!</em>`;
  }

  // Fallback
  function processFallback(ctx) {
    const sugestoes = [
      'Resumo geral',
      'Como está o caixa deste mês?',
      'Quem está devendo mais esta semana?',
      'Da semana passada quem finalizou com aberto?',
      'Quem paga melhor?',
      'Despesas acima do ideal'
    ];
    
    return `🤔 Não entendi bem sua pergunta.<br><br>` +
      `<strong>Tente perguntar:</strong><br>` +
      sugestoes.map(s => `• "${s}"`).join('<br>') +
      `<br><br>Ou digite "ajuda" para ver todas as opções.`;
  }

  // ===== PROCESSAMENTO PRINCIPAL =====
  async function askLLM(question) {
    const entities = extractEntities(question);
    const intent = detectIntent(question);
    
    console.log('[AI] Intent:', intent);
    console.log('[AI] Período:', entities.periodo?.label);
    
    conversationContext.lastPeriodo = entities.periodo;
    conversationContext.lastTopic = intent.type;
    
    const ctx = await collectData(entities.periodo);
    
    switch (intent.type) {
      // NOVAS INTENÇÕES SEMANAIS
      case 'devedor_semana':
        return processDevedorSemana(ctx);
      
      case 'finalizou_com_aberto':
        return processFinalizouComAberto(ctx);
      
      case 'prestacoes_semana':
        return processPrestacoesSemana(ctx);
      
      case 'movimentacao_semana':
        return processMovimentacaoSemana(ctx);
      
      case 'resumo_semana':
        return processResumoSemana(ctx);
      
      // INTENÇÕES EXISTENTES
      case 'caixa_periodo':
      case 'fluxo_caixa':
        return processCaixaPeriodo(ctx);
      
      case 'ranking_pagamento':
        return processRankingPagamento(ctx);
      
      case 'ranking_inadimplente':
      case 'maior_devedor':
        return processRankingInadimplente(ctx);
      
      case 'despesas_acima':
        return processDespesasAcima(ctx);
      
      case 'ranking_despesas':
        return processRankingDespesas(ctx);
      
      case 'total_despesas':
        return processTotalDespesas(ctx);
      
      case 'prestacoes_abertas':
        return processPrestacoesAbertas(ctx);
      
      case 'listar_gerentes':
        return processListarGerentes(ctx);
      
      case 'alertas':
        return processAlertas(ctx);
      
      case 'resumo_geral':
        return processResumoGeral(ctx);
      
      case 'ajuda':
        return processAjuda();
      
      default:
        return processFallback(ctx);
    }
  }

  // ===== UI =====
  const now_ = () => new Date();
  
  function openPanel() {
    el.panel.classList.remove('is-hidden');
    el.input?.focus();
    renderCompanyTag();
    if (!state.history.length) {
      renderGreeting();
    } else {
      renderHistory();
    }
    renderChips();
    const ui = loadUI();
    if (ui.pos) {
      el.panel.style.right = 'auto';
      el.panel.style.bottom = 'auto';
      el.panel.style.left = (ui.pos.x || 40) + 'px';
      el.panel.style.top = (ui.pos.y || 40) + 'px';
      state.pos = ui.pos;
      state.pinned = !!ui.pinned;
      updatePin();
    }
    if (ui.size) {
      el.panel.style.width = (ui.size.w || 380) + 'px';
      el.panel.style.height = (ui.size.h || 520) + 'px';
      state.size = ui.size;
    }
  }

  function closePanel() {
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
      'Devedores da semana',
      'Finalizaram com aberto',
      'Caixa deste mês',
      'Alertas'
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
    row.innerHTML = `<div class="bubble">Olá! 👋 Sou seu assistente financeiro da <strong>${nice}</strong>.<br><br>` +
      `Posso te ajudar com:<br>` +
      `• Análise de caixa por período<br>` +
      `• Rankings de gerentes<br>` +
      `• Despesas e alertas<br>` +
      `• <strong>📅 Análises semanais!</strong><br><br>` +
      `Pergunte naturalmente ou use os botões abaixo!</div>`;
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
      await wait(20 + Math.random() * 20);
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

  console.log('🤖 Assistente Financeiro Inteligente v2.0 carregado!');
})();