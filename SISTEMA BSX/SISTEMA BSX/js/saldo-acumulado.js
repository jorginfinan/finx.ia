// ============================================
// SISTEMA DE SALDO ACUMULADO - PRESTAÇÕES
// ============================================
(function() {
  'use strict';

  const SALDO_KEY = 'bsx_saldo_carregar_v1';

  // ===== HELPERS =====
  function jget(key, def) {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : def;
    } catch(e) {
      return def;
    }
  }

  function jset(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  // ===== OBTER SALDO A CARREGAR DE UM GERENTE =====
  function getSaldoCarregar(gerenteId, empresaId) {
    const saldos = jget(SALDO_KEY, {});
    const key = `${empresaId}_${gerenteId}`;
    return saldos[key] || 0;
  }

  // ===== SALVAR SALDO A CARREGAR =====
  function setSaldoCarregar(gerenteId, empresaId, valor) {
    const saldos = jget(SALDO_KEY, {});
    const key = `${empresaId}_${gerenteId}`;
    saldos[key] = valor;
    jset(SALDO_KEY, saldos);
  }

  // ===== CALCULAR COMISSÃO COM SALDO ACUMULADO =====
  function calcularComissaoComSaldo(params) {
    const {
      gerenteId,
      empresaId,
      coletas,          // Valor total de coletas
      despesas,         // Valor total de despesas
      comissao,         // Percentual de comissão (10, 20, 30, 40 ou 50)
      saldoAnterior     // Opcional: para visualização sem salvar
    } = params;

    // Calcula resultado base (Coletas - Despesas)
    const resultado = coletas - despesas;

    // Pega saldo anterior (se não fornecido)
    const saldoCarregar = saldoAnterior !== undefined 
      ? saldoAnterior 
      : getSaldoCarregar(gerenteId, empresaId);

    // ===== REGRA: Comissão 50% = SEM SALDO ACUMULADO =====
    if (comissao >= 50) {
      return {
        coletas,
        despesas,
        resultado,
        saldoCarregarAnterior: 0,
        baseCalculo: resultado,
        comissao: comissao,
        valorComissao: (resultado * comissao) / 100,
        saldoCarregarNovo: 0,
        aPagar: (resultado * comissao) / 100,
        observacao: 'Comissão 50% - sem saldo acumulado'
      };
    }

    // ===== REGRA: Comissão 10-40% = COM SALDO ACUMULADO =====
    
    let baseCalculo = 0;
    let novoSaldoCarregar = 0;
    let observacao = '';

    // CASO 1: Resultado NEGATIVO
    if (resultado < 0) {
      // Acumula o prejuízo
      novoSaldoCarregar = saldoCarregar + Math.abs(resultado);
      baseCalculo = 0;
      observacao = `Prejuízo de R$ ${Math.abs(resultado).toFixed(2)} acumulado. Total a compensar: R$ ${novoSaldoCarregar.toFixed(2)}`;
    }
    // CASO 2: Resultado POSITIVO mas menor que saldo anterior
    else if (resultado > 0 && resultado <= saldoCarregar) {
      // Abate do saldo, mas não paga comissão
      novoSaldoCarregar = saldoCarregar - resultado;
      baseCalculo = 0;
      observacao = `Resultado de R$ ${resultado.toFixed(2)} compensou parte do saldo. Resta R$ ${novoSaldoCarregar.toFixed(2)} a compensar`;
    }
    // CASO 3: Resultado POSITIVO e maior que saldo anterior
    else if (resultado > 0 && resultado > saldoCarregar) {
      // Zera o saldo e calcula comissão sobre o excedente
      novoSaldoCarregar = 0;
      baseCalculo = resultado - saldoCarregar;
      
      if (saldoCarregar > 0) {
        observacao = `Saldo de R$ ${saldoCarregar.toFixed(2)} compensado. Comissão calculada sobre R$ ${baseCalculo.toFixed(2)}`;
      } else {
        observacao = `Comissão calculada sobre resultado total de R$ ${baseCalculo.toFixed(2)}`;
      }
    }

    const valorComissao = (baseCalculo * comissao) / 100;
    const aPagar = valorComissao;

    return {
      coletas,
      despesas,
      resultado,
      saldoCarregarAnterior: saldoCarregar,
      baseCalculo,
      comissao,
      valorComissao,
      saldoCarregarNovo: novoSaldoCarregar,
      aPagar,
      observacao
    };
  }

  // ===== SALVAR PRESTAÇÃO COM SALDO =====
  function salvarPrestacaoComSaldo(prestacao) {
    const calculo = calcularComissaoComSaldo({
      gerenteId: prestacao.gerenteId,
      empresaId: prestacao.empresaId || window.getCompany(),
      coletas: prestacao.coletas,
      despesas: prestacao.despesas,
      comissao: prestacao.comissao
    });

    // Salva o novo saldo a carregar
    setSaldoCarregar(
      prestacao.gerenteId, 
      prestacao.empresaId || window.getCompany(), 
      calculo.saldoCarregarNovo
    );

    // Adiciona informações de cálculo à prestação
    prestacao.saldoCarregarAnterior = calculo.saldoCarregarAnterior;
    prestacao.baseCalculo = calculo.baseCalculo;
    prestacao.valorComissao = calculo.valorComissao;
    prestacao.saldoCarregarNovo = calculo.saldoCarregarNovo;
    prestacao.aPagar = calculo.aPagar;
    prestacao.observacao = calculo.observacao;

    // Auditoria
    if (window.AuditLog) {
      window.AuditLog.log('prestacao_salva_com_saldo', {
        gerente: prestacao.gerenteNome,
        periodo: prestacao.periodo,
        resultado: calculo.resultado,
        saldoAnterior: calculo.saldoCarregarAnterior,
        saldoNovo: calculo.saldoCarregarNovo,
        aPagar: calculo.aPagar
      });
    }

    return calculo;
  }

  // ===== VISUALIZAR HISTÓRICO DE SALDO =====
  function getHistoricoSaldo(gerenteId, empresaId) {
    // Busca todas as prestações do gerente
    const prestacoes = jget('bsx_prest_contas_v1', []);
    
    return prestacoes
      .filter(p => 
        p.gerenteId === gerenteId && 
        (p.empresaId || 'BSX') === empresaId
      )
      .sort((a, b) => new Date(b.data || b.createdAt) - new Date(a.data || a.createdAt))
      .map(p => ({
        data: p.data || p.createdAt,
        periodo: p.periodo,
        coletas: p.coletas,
        despesas: p.despesas,
        resultado: p.coletas - p.despesas,
        saldoAnterior: p.saldoCarregarAnterior || 0,
        saldoNovo: p.saldoCarregarNovo || 0,
        baseCalculo: p.baseCalculo || 0,
        valorComissao: p.valorComissao || 0,
        aPagar: p.aPagar || 0
      }));
  }

  // ===== RESETAR SALDO (ADMIN APENAS) =====
  function resetarSaldo(gerenteId, empresaId) {
    if (window.UserAuth?.currentUser()?.role !== 'admin') {
      return { ok: false, error: 'Apenas administradores podem resetar saldo' };
    }

    setSaldoCarregar(gerenteId, empresaId, 0);
    
    if (window.AuditLog) {
      window.AuditLog.log('saldo_resetado', {
        gerenteId,
        empresaId
      });
    }

    return { ok: true };
  }

  // ===== EXPORTAR API =====
  window.SaldoAcumulado = {
    calcular: calcularComissaoComSaldo,
    getSaldo: getSaldoCarregar,
    setSaldo: setSaldoCarregar,
    salvarPrestacao: salvarPrestacaoComSaldo,
    getHistorico: getHistoricoSaldo,
    resetar: resetarSaldo
  };

  console.log('✅ Sistema de Saldo Acumulado carregado');
})();