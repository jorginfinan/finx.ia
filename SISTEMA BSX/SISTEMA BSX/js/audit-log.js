// ===== SISTEMA DE AUDITORIA/HISTÓRICO =====
(function() {
  'use strict';
  
  const AUDIT_KEY = 'APP_AUDIT_LOG_V1';
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
  function log(action, details = {}) {
    try {
      const logs = JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
      
      const entry = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        user: getUser(),
        company: getCompany(),
        action: action,
        details: details,
        userAgent: navigator.userAgent
      };
      
      logs.push(entry);
      
      // Mantém apenas os últimos registros
      if (logs.length > MAX_LOGS) {
        logs.splice(0, logs.length - MAX_LOGS);
      }
      
      localStorage.setItem(AUDIT_KEY, JSON.stringify(logs));
      
      // Dispara evento para outras abas
      if (typeof window.SyncManager !== 'undefined') {
        window.SyncManager.notify('audit', { action });
      }
      
      return entry;
    } catch(e) {
      console.error('Erro ao registrar auditoria:', e);
      return null;
    }
  }
  
  // ===== BUSCAR LOGS =====
  function getLogs(filters = {}) {
    try {
      let logs = JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
      
      // Filtrar por usuário
      if (filters.username) {
        logs = logs.filter(l => l.user.username === filters.username);
      }
      
      // Filtrar por empresa
      if (filters.company) {
        logs = logs.filter(l => l.company === filters.company);
      }
      
      // Filtrar por ação
      if (filters.action) {
        logs = logs.filter(l => l.action.includes(filters.action));
      }
      
      // Filtrar por período
      if (filters.startDate) {
        const start = new Date(filters.startDate).getTime();
        logs = logs.filter(l => new Date(l.timestamp).getTime() >= start);
      }
      
      if (filters.endDate) {
        const end = new Date(filters.endDate).getTime();
        logs = logs.filter(l => new Date(l.timestamp).getTime() <= end);
      }
      
      // Ordenar por mais recente
      logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      return logs;
    } catch(e) {
      console.error('Erro ao buscar logs:', e);
      return [];
    }
  }
  
  // ===== EXPORTAR LOGS =====
  function exportLogs(filters = {}) {
    const logs = getLogs(filters);
    const csv = [
      ['Data/Hora', 'Usuário', 'Empresa', 'Ação', 'Detalhes'].join(','),
      ...logs.map(l => [
        new Date(l.timestamp).toLocaleString('pt-BR'),
        l.user.username,
        l.company,
        l.action,
        JSON.stringify(l.details).replace(/,/g, ';')
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'auditoria_' + new Date().toISOString().split('T')[0] + '.csv';
    link.click();
  }
  
  // ===== LIMPAR LOGS ANTIGOS =====
  function clearOldLogs(days = 90) {
    try {
      const logs = JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
      const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
      
      const filtered = logs.filter(l => new Date(l.timestamp).getTime() > cutoff);
      
      localStorage.setItem(AUDIT_KEY, JSON.stringify(filtered));
      
      return logs.length - filtered.length; // Quantidade removida
    } catch(e) {
      console.error('Erro ao limpar logs:', e);
      return 0;
    }
  }
  
  // ===== API PÚBLICA =====
  window.AuditLog = {
    log,
    getLogs,
    exportLogs,
    clearOldLogs
  };
  
  console.log('✅ Sistema de auditoria carregado');
})();
