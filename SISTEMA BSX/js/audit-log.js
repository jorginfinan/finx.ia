// ===== SISTEMA DE AUDITORIA/HISTÓRICO (SUPABASE) =====
(function() {
    'use strict';
    
    const MAX_LOGS = 1000; // Mantém últimos 1000 registros
    
    // ===== FUNÇÕES AUXILIARES =====
    function getUser() {
      try {
        const user = window.UserAuth?.currentUser();
        return {
          id: user?.id || 'unknown',
          username: user?.username || 'Sistema',
          role: user?.role || 'unknown'
        };
      } catch(e) {
        return { id: 'unknown', username: 'Sistema', role: 'unknown' };
      }
    }
    
    function getCompany() {
      try {
        return window.getCompany?.() || 'BSX';
      } catch(e) {
        return 'BSX';
      }
    }
    
    // ===== REGISTRAR AÇÃO =====
    async function log(action, details = {}) {
      try {
        const user = getUser();
        const company = getCompany();
        
        const entry = {
          timestamp: new Date().toISOString(),
          user_id: user.id,
          username: user.username,
          user_role: user.role,
          company: company,
          action: action,
          details: details,
          user_agent: navigator.userAgent
        };
        
        // Salva no Supabase
        if (window.SupabaseAPI?.supabase) {
          const { data, error } = await window.SupabaseAPI.supabase
            .from('audit_logs')
            .insert([entry])
            .select()
            .single();
          
          if (error) {
            console.error('[AuditLog] Erro ao salvar:', error);
            return null;
          }
          
          console.log(`[AuditLog] 📝 ${action}`, details);
          
          // Dispara evento para outras abas
          if (typeof window.SyncManager !== 'undefined') {
            window.SyncManager.notify('audit', { action });
          }
          
          return data;
        } else {
          console.warn('[AuditLog] SupabaseAPI não disponível');
          return null;
        }
      } catch(e) {
        console.error('[AuditLog] Erro ao registrar auditoria:', e);
        return null;
      }
    }
    
    // ===== BUSCAR LOGS =====
    async function getLogs(filters = {}) {
      try {
        if (!window.SupabaseAPI?.supabase) {
          console.warn('[AuditLog] SupabaseAPI não disponível');
          return [];
        }
        
        let query = window.SupabaseAPI.supabase
          .from('audit_logs')
          .select('*');
        
        // Filtrar por empresa (RLS já filtra, mas podemos adicionar)
        if (filters.company) {
          query = query.eq('company', filters.company);
        }
        
        // Filtrar por usuário
        if (filters.username) {
          query = query.eq('username', filters.username);
        }
        
        // Filtrar por ação
        if (filters.action) {
          query = query.ilike('action', `%${filters.action}%`);
        }
        
        // Filtrar por período
        if (filters.startDate) {
          query = query.gte('timestamp', new Date(filters.startDate).toISOString());
        }
        
        if (filters.endDate) {
          query = query.lte('timestamp', new Date(filters.endDate).toISOString());
        }
        
        // Ordenar por mais recente e limitar
        query = query.order('timestamp', { ascending: false }).limit(filters.limit || MAX_LOGS);
        
        const { data, error } = await query;
        
        if (error) {
          console.error('[AuditLog] Erro ao buscar logs:', error);
          return [];
        }
        
        return data || [];
      } catch(e) {
        console.error('[AuditLog] Erro ao buscar logs:', e);
        return [];
      }
    }
    
    // ===== EXPORTAR LOGS =====
    async function exportLogs(filters = {}) {
      const logs = await getLogs(filters);
      
      if (!logs.length) {
        alert('Nenhum log encontrado para exportar');
        return;
      }
      
      const csv = [
        ['Data/Hora', 'Usuário', 'Função', 'Empresa', 'Ação', 'Detalhes'].join(','),
        ...logs.map(l => [
          new Date(l.timestamp).toLocaleString('pt-BR'),
          l.username || 'Sistema',
          l.user_role || 'unknown',
          l.company || 'BSX',
          l.action || '',
          JSON.stringify(l.details || {}).replace(/,/g, ';')
        ].join(','))
      ].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'auditoria_' + new Date().toISOString().split('T')[0] + '.csv';
      link.click();
    }
    
    // ===== LIMPAR LOGS ANTIGOS =====
    async function clearOldLogs(days = 90) {
      try {
        if (!window.SupabaseAPI?.supabase) {
          console.warn('[AuditLog] SupabaseAPI não disponível');
          return 0;
        }
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        const { data, error } = await window.SupabaseAPI.supabase
          .from('audit_logs')
          .delete()
          .lt('timestamp', cutoffDate.toISOString())
          .select();
        
        if (error) {
          console.error('[AuditLog] Erro ao limpar logs:', error);
          return 0;
        }
        
        const removed = data?.length || 0;
        console.log(`[AuditLog] ${removed} logs antigos removidos`);
        return removed;
      } catch(e) {
        console.error('[AuditLog] Erro ao limpar logs:', e);
        return 0;
      }
    }
    
    // ===== ESTATÍSTICAS =====
    async function getStats(filters = {}) {
      try {
        if (!window.SupabaseAPI?.supabase) {
          console.warn('[AuditLog] SupabaseAPI não disponível');
          return null;
        }
        
        const logs = await getLogs(filters);
        
        // Agrupa por ação
        const byAction = {};
        const byUser = {};
        const byCompany = {};
        
        logs.forEach(log => {
          byAction[log.action] = (byAction[log.action] || 0) + 1;
          byUser[log.username] = (byUser[log.username] || 0) + 1;
          byCompany[log.company] = (byCompany[log.company] || 0) + 1;
        });
        
        return {
          total: logs.length,
          byAction,
          byUser,
          byCompany,
          lastLog: logs[0] || null
        };
      } catch(e) {
        console.error('[AuditLog] Erro ao gerar estatísticas:', e);
        return null;
      }
    }
    
    // ===== API PÚBLICA =====
    window.AuditLog = {
      log,
      getLogs,
      exportLogs,
      clearOldLogs,
      getStats
    };
    
    console.log('✅ Sistema de auditoria carregado (Supabase)');
  })();