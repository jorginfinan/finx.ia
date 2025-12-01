// ============================================
// SISTEMA DE SALDO ACUMULADO - SUPABASE
// VERSÃO CORRIGIDA v2.3 - Corrige baseCalculo para comissão
// ============================================
(function() {
  'use strict';
  
  // === Helpers de ID ===
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Mapeamento de empresas (nome → UUID)
  let empresasMap = {
    'BSX': 'b61cf5cb-e232-44b1-87b2-951adf7ea14c',
    'BETPLAY': '89a64c64-e583-4c39-8384-cef84f0f22db',
    'EMANUEL': '6d56f410-9b72-455b-9153-264d2c60f25b'
  };

  // Atualiza mapeamento quando empresas são carregadas
  window.addEventListener('empresas:loaded', (e) => {
    const empresas = e.detail || window.empresas || [];
    empresas.forEach(emp => {
      if (emp.nome && emp.id) {
        empresasMap[emp.nome.toUpperCase()] = emp.id;
      }
    });
    console.log('[Saldo] Mapeamento de empresas atualizado:', empresasMap);
  });

  // Tenta carregar empresas existentes
  if (window.empresas && Array.isArray(window.empresas)) {
    window.empresas.forEach(emp => {
      if (emp.nome && emp.id) {
        empresasMap[emp.nome.toUpperCase()] = emp.id;
      }
    });
  }

  // Converte gerenteId (uid da tela) para UUID do Supabase
  function resolveGerenteId(gerenteId) {
    if (!gerenteId) {
      console.warn('[Saldo] gerenteId vazio');
      return null;
    }

    // Se já for UUID válido, retorna direto
    if (typeof gerenteId === 'string' && uuidRegex.test(gerenteId)) {
      return gerenteId;
    }

    // Busca o gerente pelo uid para pegar o id (UUID)
    const g = (window.gerentes || []).find(
      x => String(x.uid) === String(gerenteId) || String(x.id) === String(gerenteId)
    );

    if (!g) {
      console.warn('[Saldo] Gerente não encontrado para uid:', gerenteId);
      return null;
    }

    // Retorna o ID (UUID do Supabase)
    if (g.id && uuidRegex.test(g.id)) {
      return g.id;
    }

    console.warn('[Saldo] Gerente não tem UUID válido. uid:', gerenteId);
    return null;
  }

  // Converte empresaId (nome ou UUID) para UUID do Supabase
  function resolveEmpresaId(empresaId) {
    if (!empresaId) {
      console.warn('[Saldo] empresaId vazio');
      return null;
    }

    // Se já for UUID válido, retorna direto
    if (typeof empresaId === 'string' && uuidRegex.test(empresaId)) {
      return empresaId;
    }

    // Converte nome para UUID usando o mapeamento
    const nomeUpper = String(empresaId).toUpperCase();
    if (empresasMap[nomeUpper]) {
      return empresasMap[nomeUpper];
    }

    // Tenta buscar em window.empresas se existir
    if (window.empresas && Array.isArray(window.empresas)) {
      const emp = window.empresas.find(e => 
        String(e.nome).toUpperCase() === nomeUpper || e.id === empresaId
      );
      if (emp && emp.id) {
        empresasMap[nomeUpper] = emp.id; // Cache para próximas chamadas
        return emp.id;
      }
    }

    console.warn('[Saldo] Empresa não encontrada:', empresaId);
    return null;
  }


  // ===== OBTER SALDO ACUMULADO DE UM GERENTE (SUPABASE) =====
  async function getSaldoCarregar(gerenteId, empresaId) {
    try {
      if (!window.SupabaseAPI?.client) {
        console.warn('[Saldo] Supabase não disponível');
        return 0;
      }

      const gId = resolveGerenteId(gerenteId);
      const eId = resolveEmpresaId(empresaId);

      if (!gId) {
        console.warn('[Saldo] gerente_id inválido:', gerenteId);
        return 0;
      }
      
      if (!eId) {
        console.warn('[Saldo] empresa_id inválido:', empresaId);
        return 0;
      }

      console.log('[Saldo] Buscando saldo - gerente:', gId, 'empresa:', eId);

      const { data, error } = await window.SupabaseAPI.client
        .from('saldo_acumulado')
        .select('saldo')
        .eq('gerente_id', gId)
        .eq('empresa_id', eId)
        .maybeSingle();

      if (error) {
        console.warn('[Saldo] Erro ao buscar:', error);
        return 0;
      }

      console.log('[Saldo] Saldo encontrado:', data?.saldo || 0);
      return data?.saldo || 0;
    } catch(e) {
      console.warn('[Saldo] Erro:', e);
      return 0;
    }
  }


  // ===== SALVAR SALDO ACUMULADO (SUPABASE) =====
  async function setSaldoCarregar(gerenteId, empresaId, valor) {
    try {
      if (!window.SupabaseAPI?.client) {
        throw new Error('Supabase não disponível');
      }

      const gId = resolveGerenteId(gerenteId);
      const eId = resolveEmpresaId(empresaId);

      if (!gId) {
        throw new Error(`gerente_id inválido: ${gerenteId}`);
      }
      
      if (!eId) {
        throw new Error(`empresa_id inválido: ${empresaId}`);
      }

      console.log('[Saldo] Salvando - valor:', valor, 'gerente:', gId, 'empresa:', eId);

      const timestamp = new Date().toISOString();

      // Verifica se já existe registro de saldo para (gerente, empresa)
      const { data: existing, error: errExisting } = await window.SupabaseAPI.client
        .from('saldo_acumulado')
        .select('*')
        .eq('gerente_id', gId)
        .eq('empresa_id', eId)
        .maybeSingle();

      if (errExisting) {
        console.error('[Saldo] Erro ao verificar existente:', errExisting);
        throw errExisting;
      }

      let error;

      if (existing) {
        console.log('[Saldo] Atualizando registro existente:', existing.id);
        ({ error } = await window.SupabaseAPI.client
          .from('saldo_acumulado')
          .update({ saldo: valor })
          .eq('id', existing.id));
      } else {
        console.log('[Saldo] Inserindo novo registro');
        ({ error } = await window.SupabaseAPI.client
          .from('saldo_acumulado')
          .insert([{
            gerente_id: gId,
            empresa_id: eId,
            saldo: valor,
            created_at: timestamp
          }]));
      }

      if (error) {
        console.error('[Saldo] Erro na operação:', error);
        throw error;
      }

      console.log('[Saldo] ✅ Saldo salvo com sucesso:', valor);

      // Dispara evento
      window.dispatchEvent(new CustomEvent('saldo:atualizado', {
        detail: { gerenteId, empresaId, saldo: valor }
      }));

      return { ok: true };
    } catch(e) {
      console.error('[Saldo] Erro ao salvar:', e);
      return { ok: false, error: e.message };
    }
  }


  // ===== CALCULAR COMISSÃO COM SALDO ACUMULADO =====
  async function calcularComissaoComSaldo(params) {
    const {
      gerenteId,
      empresaId,
      coletas,
      despesas,
      comissao,
      comissao2,
      saldoAnterior,
      baseCalculo
    } = params;

    // ✅ RESULTADO para saldo = sempre coletas - despesas (lucro/prejuízo real)
    const resultado = coletas - despesas;

    const saldoCarregar = saldoAnterior !== undefined 
      ? saldoAnterior 
      : await getSaldoCarregar(gerenteId, empresaId);

    // Comissão 50% = SEM SALDO ACUMULADO
    if (comissao >= 50) {
      const baseComissao50 = baseCalculo === 'COLETAS' ? coletas : resultado;
      const valorComissaoCalc = (baseComissao50 * comissao) / 100;
      return {
        coletas,
        despesas,
        resultado,
        resultadoFinal: resultado - valorComissaoCalc,
        saldoCarregarAnterior: 0,
        baseCalculo: baseComissao50,
        comissao: comissao,
        valorComissao: valorComissaoCalc,
        valorComissao2: 0,
        saldoCarregarNovo: 0,
        aPagar: resultado - valorComissaoCalc,
        observacao: 'Comissão 50% - sem saldo acumulado'
      };
    }

    // Comissão 10-40% = COM SALDO ACUMULADO
    let baseParaComissao = 0;
    let novoSaldoCarregar = 0;
    let observacao = '';

    if (resultado < 0) {
      // CASO 1: Resultado NEGATIVO - acumula prejuízo
      novoSaldoCarregar = saldoCarregar + Math.abs(resultado);
      baseParaComissao = 0;
      observacao = `Prejuízo de R$ ${Math.abs(resultado).toFixed(2)} acumulado. Total: R$ ${novoSaldoCarregar.toFixed(2)}`;
    }
    else if (resultado > 0 && resultado <= saldoCarregar) {
      // CASO 2: Resultado POSITIVO mas menor que saldo - abate parcial
      novoSaldoCarregar = saldoCarregar - resultado;
      baseParaComissao = 0;
      observacao = `Compensou R$ ${resultado.toFixed(2)}. Resta R$ ${novoSaldoCarregar.toFixed(2)}`;
    }
    else if (resultado > 0 && resultado > saldoCarregar) {
      // CASO 3: Resultado POSITIVO maior que saldo - zera saldo e calcula comissão
      novoSaldoCarregar = 0;
      
      // ✅ CORREÇÃO: Base para comissão depende do tipo de cálculo
      if (baseCalculo === 'COLETAS') {
        // Gerente com comissão sobre COLETAS
        // Base = COLETAS - SALDO_ACUMULADO (desconta o saldo das coletas)
        baseParaComissao = coletas - saldoCarregar;
        if (baseParaComissao < 0) baseParaComissao = 0;
      } else {
        // Gerente com comissão sobre COLETAS - DESPESAS
        // Comissão sobre o excedente após compensar saldo
        baseParaComissao = resultado - saldoCarregar;
      }
      
      if (saldoCarregar > 0) {
        observacao = `Saldo R$ ${saldoCarregar.toFixed(2)} compensado. Base comissão: R$ ${baseParaComissao.toFixed(2)}`;
      } else {
        observacao = `Comissão sobre R$ ${baseParaComissao.toFixed(2)}`;
      }
    }

    // Cálculo das comissões
    let valorComissaoCalc = 0;
    let valorComissao2Calc = 0;
    let resultadoFinal = resultado;
    
    const perc2 = Number(comissao2) || 0;
    
    if (baseParaComissao > 0) {
      // 1ª Comissão
      valorComissaoCalc = (baseParaComissao * comissao) / 100;
      
      // 2ª Comissão (se existir)
      if (perc2 > 0) {
        const apos1aComissao = baseParaComissao - valorComissaoCalc;
        if (apos1aComissao > 0) {
          valorComissao2Calc = (apos1aComissao * perc2) / 100;
          resultadoFinal = resultado - valorComissaoCalc - valorComissao2Calc;
        } else {
          valorComissao2Calc = 0;
          resultadoFinal = resultado - valorComissaoCalc;
        }
      } else {
        resultadoFinal = resultado - valorComissaoCalc;
      }
    } else {
      valorComissaoCalc = 0;
      valorComissao2Calc = 0;
      resultadoFinal = resultado;
    }

    return {
      coletas,
      despesas,
      resultado,
      resultadoFinal,
      saldoCarregarAnterior: saldoCarregar,
      baseCalculo: baseParaComissao,
      comissao,
      valorComissao: valorComissaoCalc,
      valorComissao2: valorComissao2Calc,
      saldoCarregarNovo: novoSaldoCarregar,
      aPagar: resultadoFinal,
      observacao
    };
  }

  // ===== SALVAR PRESTAÇÃO COM SALDO =====
  async function salvarPrestacaoComSaldo(prestacao) {
    const calculo = await calcularComissaoComSaldo({
      gerenteId: prestacao.gerenteId,
      empresaId: prestacao.empresaId || window.getCompany(),
      coletas: prestacao.coletas,
      despesas: prestacao.despesas,
      comissao: prestacao.comissao,
      comissao2: prestacao.comissao2 || 0,
      baseCalculo: prestacao.baseCalculo || 'COLETAS_MENOS_DESPESAS'
    });

    await setSaldoCarregar(
      prestacao.gerenteId, 
      prestacao.empresaId || window.getCompany(), 
      calculo.saldoCarregarNovo
    );

    prestacao.saldoCarregarAnterior = calculo.saldoCarregarAnterior;
    prestacao.baseCalculo = calculo.baseCalculo;
    prestacao.valorComissao = calculo.valorComissao;
    prestacao.valorComissao2 = calculo.valorComissao2;
    prestacao.saldoCarregarNovo = calculo.saldoCarregarNovo;
    prestacao.aPagar = calculo.aPagar;
    prestacao.observacao = calculo.observacao;

    if (window.AuditLog) {
      try {
        await window.AuditLog.log('prestacao_salva_com_saldo', {
          gerente: prestacao.gerenteNome,
          periodo: prestacao.periodo,
          resultado: calculo.resultado,
          saldoAnterior: calculo.saldoCarregarAnterior,
          saldoNovo: calculo.saldoCarregarNovo,
          aPagar: calculo.aPagar
        });
      } catch(e) {
        console.warn('[Saldo] Erro ao registrar auditoria:', e);
      }
    }

    return calculo;
  }

  // ===== HISTÓRICO DE SALDO =====
  async function getHistoricoSaldo(gerenteId, empresaId) {
    try {
      if (!window.SupabaseAPI?.client) return [];

      const gId = resolveGerenteId(gerenteId);
      const eId = resolveEmpresaId(empresaId);

      if (!gId || !eId) return [];

      const { data: prestacoes, error } = await window.SupabaseAPI.client
        .from('prestacoes')
        .select('*')
        .eq('gerente_id', gId)
        .eq('empresa_id', eId)
        .order('data', { ascending: false })
        .limit(50);

      if (error) {
        console.warn('[Saldo] Erro ao buscar histórico:', error);
        return [];
      }

      return (prestacoes || []).map(p => ({
        data: p.data || p.created_at,
        periodo: p.periodo,
        coletas: p.coletas || 0,
        despesas: p.despesas || 0,
        resultado: (p.coletas || 0) - (p.despesas || 0),
        saldoAnterior: p.saldo_anterior || 0,
        saldoNovo: p.saldo_novo || 0,
        baseCalculo: p.base_calculo || 0,
        valorComissao: p.valor_comissao || 0,
        aPagar: p.a_pagar || 0
      }));
    } catch(e) {
      console.error('[Saldo] Erro ao buscar histórico:', e);
      return [];
    }
  }

  // ===== RESETAR SALDO =====
  async function resetarSaldo(gerenteId, empresaId) {
    if (window.UserAuth?.currentUser()?.role !== 'admin') {
      return { ok: false, error: 'Apenas administradores podem resetar saldo' };
    }

    const result = await setSaldoCarregar(gerenteId, empresaId, 0);
    
    if (result.ok && window.AuditLog) {
      try {
        await window.AuditLog.log('saldo_resetado', { gerenteId, empresaId });
      } catch(e) {}
    }

    return result;
  }

  // ===== LISTAR SALDOS =====
  async function listarSaldos(empresaId) {
    try {
      if (!window.SupabaseAPI?.client) return [];

      const eId = resolveEmpresaId(empresaId);
      if (!eId) return [];

      const { data, error } = await window.SupabaseAPI.client
        .from('saldo_acumulado')
        .select('*')
        .eq('empresa_id', eId)
        .order('gerente_id');

      if (error) {
        console.warn('[Saldo] Erro ao listar:', error);
        return [];
      }

      return data || [];
    } catch(e) {
      console.error('[Saldo] Erro ao listar saldos:', e);
      return [];
    }
  }

  // ===== EXPORTAR API =====
  window.SaldoAcumulado = {
    calcular: calcularComissaoComSaldo,
    getSaldo: getSaldoCarregar,
    setSaldo: setSaldoCarregar,
    salvarPrestacao: salvarPrestacaoComSaldo,
    getHistorico: getHistoricoSaldo,
    resetar: resetarSaldo,
    listar: listarSaldos,
    // Expõe funções de resolução para debug
    _resolveGerenteId: resolveGerenteId,
    _resolveEmpresaId: resolveEmpresaId,
    _empresasMap: empresasMap
  };

  console.log('✅ Sistema de Saldo Acumulado carregado (Supabase) - v2.3');
})();