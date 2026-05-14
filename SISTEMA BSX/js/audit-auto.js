// ===== INTEGRAÇÃO AUTOMÁTICA DE AUDITORIA - SUPABASE =====
(function() {
  'use strict';
  
  // Aguarda o AuditLog e SupabaseAPI estarem disponíveis
  function waitForDependencies(callback, maxAttempts = 50) {
    let attempts = 0;
    
    const check = () => {
      attempts++;
      
      // ✅ USA SupabaseAPI.client ao invés de window.supabase
      if (typeof window.AuditLog !== 'undefined' && window.SupabaseAPI?.client) {
        callback();
        return;
      }
      
      if (attempts >= maxAttempts) {
        console.warn('[Audit-Auto] Timeout aguardando dependências');
        // Tenta mesmo assim com AuditLog local
        if (typeof window.AuditLog !== 'undefined') {
          callback();
        }
        return;
      }
      
      setTimeout(check, 100);
    };
    
    check();
  }
  
  waitForDependencies(function() {
    console.log('[Audit-Auto] 🔄 Inicializando interceptadores...');
    
    // ===== HELPER PARA INTERCEPTAR FUNÇÕES =====
    function interceptFunction(obj, funcName, options = {}) {
      if (!obj || typeof obj[funcName] !== 'function') return false;
      
      const original = obj[funcName];
      const { before, after, action, getDetails } = options;
      
      obj[funcName] = async function(...args) {
        // Callback antes
        if (before) before(args);
        
        try {
          const result = await original.apply(this, args);
          
          // Callback depois (só se sucesso)
          if (after) after(args, result);
          
          // Log automático
          if (action && result?.ok !== false) {
            const details = getDetails ? getDetails(args, result) : {};
            window.AuditLog.log(action, details);
          }
          
          return result;
        } catch(e) {
          console.error(`[Audit-Auto] Erro em ${funcName}:`, e);
          throw e;
        }
      };
      
      return true;
    }
    
    // ===== INTERCEPTAR USERAUTH =====
    if (window.UserAuth) {
      // Login
      interceptFunction(window.UserAuth, 'login', {
        action: 'login',
        getDetails: ([username], result) => result?.ok ? { username } : null
      });
      
      // Criar usuário
      interceptFunction(window.UserAuth, 'createUser', {
        action: 'usuario_criado',
        getDetails: ([data]) => ({ username: data.username, role: data.role })
      });
      
      // Atualizar usuário
      interceptFunction(window.UserAuth, 'updateUser', {
        action: 'usuario_atualizado',
        getDetails: ([id, patch]) => ({ userId: id, changes: Object.keys(patch).join(', ') })
      });
      
      // Remover usuário
      interceptFunction(window.UserAuth, 'removeUser', {
        before: ([id]) => {
          const users = window.UserAuth.list?.() || [];
          const user = users.find(u => u.id === id);
          window.AuditLog.log('usuario_removido', { 
            userId: id,
            username: user?.username || 'desconhecido'
          });
        }
      });
      
      // Logout
      interceptFunction(window.UserAuth, 'logout', {
        before: () => window.AuditLog.log('logout')
      });
      
      console.log('[Audit-Auto] ✅ UserAuth interceptado');
    }
    
    // ===== INTERCEPTAR EMPRESA =====
    if (typeof window.setCompany === 'function') {
      const originalSetCompany = window.setCompany;
      window.setCompany = function(empresa) {
        const oldCompany = window.getCompany?.() || 'BSX';
        const result = originalSetCompany(empresa);
        if (oldCompany !== empresa) {
          window.AuditLog.log('empresa_alterada', { de: oldCompany, para: empresa });
        }
        return result;
      };
      console.log('[Audit-Auto] ✅ setCompany interceptado');
    }
    
    // ===== INTERCEPTAR SUPABASE API - GERENTES =====
    if (window.SupabaseAPI?.gerentes) {
      // Criar gerente
      interceptFunction(window.SupabaseAPI.gerentes, 'create', {
        action: 'gerente_criado',
        getDetails: ([data], result) => ({
          id: result?.id,
          nome: data.nome,
          numero: data.numero
        })
      });
      
      // Atualizar gerente
      interceptFunction(window.SupabaseAPI.gerentes, 'update', {
        action: 'gerente_editado',
        getDetails: ([id, data]) => ({
          id,
          changes: Object.keys(data).join(', ')
        })
      });
      
      // Deletar gerente
      interceptFunction(window.SupabaseAPI.gerentes, 'delete', {
        before: async ([id]) => {
          try {
            const gerentes = await window.SupabaseAPI.gerentes.getAll();
            const g = gerentes?.find(x => x.id === id);
            window.AuditLog.log('gerente_excluido', { 
              id, 
              nome: g?.nome || 'desconhecido',
              numero: g?.numero || ''
            });
          } catch(e) {}
        }
      });
      
      console.log('[Audit-Auto] ✅ SupabaseAPI.gerentes interceptado');
    }
    
    // ===== INTERCEPTAR SUPABASE API - PRESTAÇÕES =====
    if (window.SupabaseAPI?.prestacoes) {
      // Criar/Salvar prestação
      interceptFunction(window.SupabaseAPI.prestacoes, 'upsert', {
        action: 'prestacao_salva',
        getDetails: ([data], result) => ({
          id: result?.id || data.id,
          gerenteId: data.gerente_id,
          periodo: `${data.ini || ''} a ${data.fim || ''}`,
          valor: data.resumo?.aPagar
        })
      });
      
      // Deletar prestação
      interceptFunction(window.SupabaseAPI.prestacoes, 'delete', {
        before: ([id]) => {
          window.AuditLog.log('prestacao_excluida', { id });
        }
      });
      
      console.log('[Audit-Auto] ✅ SupabaseAPI.prestacoes interceptado');
    }
    
    // ===== INTERCEPTAR SUPABASE API - LANÇAMENTOS =====
    if (window.SupabaseAPI?.lancamentos) {
      // Criar lançamento
      interceptFunction(window.SupabaseAPI.lancamentos, 'create', {
        action: 'lancamento_criado',
        getDetails: ([data], result) => ({
          id: result?.id,
          tipo: data.tipo,
          valor: data.valor,
          forma: data.forma
        })
      });
      
      // Atualizar lançamento
      interceptFunction(window.SupabaseAPI.lancamentos, 'update', {
        action: 'lancamento_editado',
        getDetails: ([id, data]) => ({
          id,
          changes: Object.keys(data).join(', ')
        })
      });
      
      // Deletar lançamento
      interceptFunction(window.SupabaseAPI.lancamentos, 'delete', {
        before: ([id]) => {
          window.AuditLog.log('lancamento_excluido', { id });
        }
      });
      
      console.log('[Audit-Auto] ✅ SupabaseAPI.lancamentos interceptado');
    }
    
    // ===== INTERCEPTAR PENDÊNCIAS API =====
    if (window.PendenciasAPI) {
      // Confirmar pendência
      interceptFunction(window.PendenciasAPI, 'confirm', {
        action: 'pendencia_confirmada',
        getDetails: ([id, data]) => ({
          id,
          valor: data?.valor,
          tipo: data?.tipo
        })
      });
      
      // Descartar pendência
      interceptFunction(window.PendenciasAPI, 'discard', {
        action: 'pendencia_descartada',
        getDetails: ([id]) => ({ id })
      });
      
      console.log('[Audit-Auto] ✅ PendenciasAPI interceptado');
    }
    
    // ===== INTERCEPTAR VALES =====
    if (window.SupabaseAPI?.vales) {
      interceptFunction(window.SupabaseAPI.vales, 'create', {
        action: 'vale_criado',
        getDetails: ([data], result) => ({
          id: result?.id || data.id,
          gerenteId: data.gerenteId,
          valor: data.valor
        })
      });
      
      interceptFunction(window.SupabaseAPI.vales, 'update', {
        action: 'vale_editado',
        getDetails: ([id, data]) => ({ id, changes: Object.keys(data).join(', ') })
      });
      
      interceptFunction(window.SupabaseAPI.vales, 'delete', {
        before: ([id]) => window.AuditLog.log('vale_excluido', { id })
      });
      
      console.log('[Audit-Auto] ✅ SupabaseAPI.vales interceptado');
    }
    
    // ===== INTERCEPTAR DESPESAS =====
    if (window.SupabaseAPI?.despesas) {
      interceptFunction(window.SupabaseAPI.despesas, 'create', {
        action: 'despesa_criada',
        getDetails: ([data], result) => ({
          id: result?.id || data.id,
          descricao: data.info || data.descricao,
          valor: data.valor
        })
      });
      
      interceptFunction(window.SupabaseAPI.despesas, 'update', {
        action: 'despesa_editada',
        getDetails: ([id, data]) => ({ id, changes: Object.keys(data).join(', ') })
      });
      
      interceptFunction(window.SupabaseAPI.despesas, 'delete', {
        before: ([id]) => window.AuditLog.log('despesa_excluida', { id })
      });
      
      console.log('[Audit-Auto] ✅ SupabaseAPI.despesas interceptado');
    }
    
    // ===== INTERCEPTAR SUPABASE API - MÁQUINAS =====
    if (window.SupabaseAPI?.maquinas) {
      // Criar máquina
      interceptFunction(window.SupabaseAPI.maquinas, 'create', {
        action: 'maquina_criada_api',
        getDetails: ([data], result) => ({
          id: result?.id,
          serial: data.serial,
          modelo: data.modelo,
          status: data.status
        })
      });
      
      // Atualizar máquina
      interceptFunction(window.SupabaseAPI.maquinas, 'update', {
        action: 'maquina_atualizada_api',
        getDetails: ([id, patch]) => ({
          id,
          changes: Object.keys(patch).join(', ')
        })
      });
      
      // Deletar máquina
      interceptFunction(window.SupabaseAPI.maquinas, 'delete', {
        before: async ([id]) => {
          try {
            const m = await window.SupabaseAPI.maquinas.getById(id);
            window.AuditLog.log('maquina_excluida_api', {
              id,
              serial: m?.serial || 'desconhecido',
              modelo: m?.modelo || ''
            });
          } catch(e) {}
        }
      });
      
      console.log('[Audit-Auto] ✅ SupabaseAPI.maquinas interceptado');
    }
    
    // ===== INTERCEPTAR SUPABASE API - MOVIMENTAÇÕES =====
    if (window.SupabaseAPI?.maquinasMovimentacoes) {
      interceptFunction(window.SupabaseAPI.maquinasMovimentacoes, 'create', {
        action: 'maquina_movimentacao',
        getDetails: ([data], result) => ({
          id: result?.id,
          maquina_id: data.maquina_id,
          tipo: data.tipo,
          gerente: data.gerente_nome || null,
          ficha: data.ficha || null,
          chip: data.chip_numero || null,
          motivo: data.motivo || null
        })
      });
      
      console.log('[Audit-Auto] ✅ SupabaseAPI.maquinasMovimentacoes interceptado');
    }
    
    // ===== INTERCEPTAR SUPABASE API - HISTÓRICO DE CHIPS =====
    if (window.SupabaseAPI?.maquinasChips) {
      interceptFunction(window.SupabaseAPI.maquinasChips, 'create', {
        action: 'chip_evento',
        getDetails: ([data]) => ({
          numero_chip: data.numero_chip,
          evento: data.evento,
          maquina_id: data.maquina_id || null,
          gerente: data.gerente_nome || null,
          ficha: data.ficha || null
        })
      });
      
      console.log('[Audit-Auto] ✅ SupabaseAPI.maquinasChips interceptado');
    }
    
    // ===== INTERCEPTAR SALDO ACUMULADO =====
    if (window.SaldoAcumulado) {
      interceptFunction(window.SaldoAcumulado, 'setSaldo', {
        action: 'saldo_ajustado',
        getDetails: ([gerenteId, empresaId, valor]) => ({
          gerenteId,
          empresaId,
          novoSaldo: valor
        })
      });
      
      console.log('[Audit-Auto] ✅ SaldoAcumulado interceptado');
    }
    
    // ===== LOG DE ERROS CRÍTICOS =====
    window.addEventListener('error', function(event) {
      // Só loga erros críticos (não erros de rede comuns)
      if (event.message && !event.message.includes('Script error')) {
        window.AuditLog?.log('erro_sistema', {
          message: event.message?.substring(0, 200),
          filename: event.filename?.split('/').pop(),
          line: event.lineno
        });
      }
    });
    
    // ===== RETENTAR INTERCEPTAÇÃO PERIÓDICA =====
    // Algumas APIs podem carregar depois
    setTimeout(() => {
      if (window.SupabaseAPI?.gerentes && !window.SupabaseAPI.gerentes.__intercepted) {
        window.SupabaseAPI.gerentes.__intercepted = true;
        console.log('[Audit-Auto] 🔄 Re-verificando APIs...');
      }
    }, 5000);
    
    console.log('[Audit-Auto] ✅ Auditoria automática Supabase ativada');
  });
  
})();