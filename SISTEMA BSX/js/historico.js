// ===== SISTEMA DE HISTORICO/AUDITORIA - SUPABASE =====
(function() {
  'use strict';
  
  const MAX_LOGS_DISPLAY = 500;
  
  // Cache local para performance
  let logsCache = [];
  let cacheTimestamp = 0;
  const CACHE_TTL = 30000; // 30 segundos
  
  // ===== HELPERS =====
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
  
  // ===== REGISTRAR AÇÃO NO SUPABASE =====
  async function log(action, details = {}) {
    try {
      const user = getUser();
      const empresa = getCompany();
      
      const entry = {
        usuario_nome: user.username,
        acao: action,
        detalhes: {
          ...details,
          user_id: user.id,
          user_role: user.role,
          empresa_codigo: empresa
        },
        user_agent: (navigator.userAgent || '').substring(0, 500)
      };
      
      console.log('[Audit]', action, details);
      
      // ✅ USA SupabaseAPI.client
      if (window.SupabaseAPI?.client) {
        const { data, error } = await window.SupabaseAPI.client
          .from('auditoria')
          .insert([entry])
          .select()
          .single();
        
        if (error) {
          console.error('[Audit] Erro ao salvar no Supabase:', error.message);
          saveToLocalStorage(entry);
        } else {
          console.log('[Audit] ✅ Salvo no Supabase:', data?.id);
          cacheTimestamp = 0;
          return data;
        }
      } else {
        console.warn('[Audit] SupabaseAPI não disponível, salvando local');
        saveToLocalStorage(entry);
      }
      
      return entry;
    } catch(e) {
      console.error('[Audit] Erro ao registrar:', e);
      return null;
    }
  }
  
  // Fallback para localStorage
  function saveToLocalStorage(entry) {
    try {
      const key = 'APP_AUDIT_PENDING';
      const pending = JSON.parse(localStorage.getItem(key) || '[]');
      pending.push({
        ...entry,
        _localId: 'local_' + Date.now(),
        _createdAt: new Date().toISOString()
      });
      if (pending.length > 100) pending.splice(0, pending.length - 100);
      localStorage.setItem(key, JSON.stringify(pending));
    } catch(e) {
      console.error('[Audit] Erro localStorage:', e);
    }
  }
  
  // Sincroniza pendentes do localStorage para Supabase
  async function syncPendingLogs() {
    // ✅ USA SupabaseAPI.client
    if (!window.SupabaseAPI?.client) return;
    
    try {
      const key = 'APP_AUDIT_PENDING';
      const pending = JSON.parse(localStorage.getItem(key) || '[]');
      
      if (pending.length === 0) return;
      
      console.log('[Audit] Sincronizando', pending.length, 'logs pendentes...');
      
      const toInsert = pending.map(p => ({
        usuario_nome: p.usuario_nome,
        acao: p.acao,
        detalhes: p.detalhes,
        user_agent: p.user_agent,
        created_at: p._createdAt
      }));
      
      // ✅ USA SupabaseAPI.client
      const { error } = await window.SupabaseAPI.client
        .from('auditoria')
        .insert(toInsert);
      
      if (!error) {
        localStorage.removeItem(key);
        console.log('[Audit] ✅ Logs pendentes sincronizados');
      }
    } catch(e) {
      console.warn('[Audit] Erro ao sincronizar pendentes:', e);
    }
  }
  
  // ===== BUSCAR LOGS DO SUPABASE =====
  async function getLogs(filters = {}) {
    try {
      // Verifica cache
      if (Date.now() - cacheTimestamp < CACHE_TTL && !Object.keys(filters).length) {
        return logsCache;
      }
      
      // ✅ USA SupabaseAPI.client
      if (!window.SupabaseAPI?.client) {
        console.warn('[Audit] SupabaseAPI não disponível');
        return [];
      }
      
      // ✅ USA SupabaseAPI.client
      let query = window.SupabaseAPI.client
        .from('auditoria')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(MAX_LOGS_DISPLAY);
      
      // Filtrar por usuário
      if (filters.username) {
        query = query.eq('usuario_nome', filters.username);
      }
      
      // Filtrar por empresa (via detalhes)
      if (filters.company) {
        query = query.contains('detalhes', { empresa_codigo: filters.company });
      }
      
      // Filtrar por ação
      if (filters.action) {
        query = query.ilike('acao', `%${filters.action}%`);
      }
      
      // Filtrar por período
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate + 'T00:00:00');
      }
      
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate + 'T23:59:59');
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('[Audit] Erro ao buscar logs:', error);
        return [];
      }
      
      // Transforma para formato compatível com a UI
      const logs = (data || []).map(row => ({
        id: row.id,
        timestamp: row.created_at,
        user: {
          id: row.detalhes?.user_id || 'unknown',
          username: row.usuario_nome || 'Sistema',
          role: row.detalhes?.user_role || 'unknown'
        },
        company: row.detalhes?.empresa_codigo || 'BSX',
        action: row.acao,
        details: row.detalhes || {},
        userAgent: row.user_agent,
        ipAddress: row.ip_address
      }));
      
      // Atualiza cache
      if (!Object.keys(filters).length) {
        logsCache = logs;
        cacheTimestamp = Date.now();
      }
      
      return logs;
    } catch(e) {
      console.error('[Audit] Erro ao buscar logs:', e);
      return [];
    }
  }
  
  // Versão síncrona para compatibilidade (usa cache)
  function getLogsSync(filters = {}) {
    if (logsCache.length) {
      let logs = [...logsCache];
      
      if (filters.username) {
        logs = logs.filter(l => l.user.username === filters.username);
      }
      if (filters.company) {
        logs = logs.filter(l => l.company === filters.company);
      }
      if (filters.action) {
        logs = logs.filter(l => l.action.toLowerCase().includes(filters.action.toLowerCase()));
      }
      
      return logs;
    }
    return [];
  }
  
  // ===== EXPORTAR LOGS =====
  async function exportLogs(filters = {}) {
    const logs = await getLogs(filters);
    
    if (logs.length === 0) {
      alert('Nenhum registro para exportar.');
      return;
    }
    
    const csv = [
      ['Data/Hora', 'Usuario', 'Perfil', 'Empresa', 'Acao', 'Detalhes', 'IP'].join(','),
      ...logs.map(l => [
        new Date(l.timestamp).toLocaleString('pt-BR'),
        l.user.username,
        l.user.role,
        l.company,
        l.action,
        JSON.stringify(l.details).replace(/,/g, ';'),
        l.ipAddress || ''
      ].map(field => '"' + String(field).replace(/"/g, '""') + '"').join(','))
    ].join('\n');
    
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'auditoria_' + new Date().toISOString().split('T')[0] + '.csv';
    link.click();
    
    log('auditoria_exportada', { total: logs.length });
  }
  
  // ===== LIMPAR LOGS ANTIGOS =====
  async function clearOldLogs(days = 90) {
    try {
      // ✅ USA SupabaseAPI.client
      if (!window.SupabaseAPI?.client) {
        alert('SupabaseAPI não disponível');
        return 0;
      }
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffISO = cutoffDate.toISOString();
      
      // Conta quantos serão removidos
      const { count } = await window.SupabaseAPI.client
        .from('auditoria')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', cutoffISO);
      
      if (!count || count === 0) {
        return 0;
      }
      
      // ✅ USA SupabaseAPI.client
      const { error } = await window.SupabaseAPI.client
        .from('auditoria')
        .delete()
        .lt('created_at', cutoffISO);
      
      if (error) {
        console.error('[Audit] Erro ao limpar:', error);
        return 0;
      }
      
      log('auditoria_limpeza', { dias: days, removidos: count });
      cacheTimestamp = 0;
      
      return count;
    } catch(e) {
      console.error('[Audit] Erro ao limpar logs:', e);
      return 0;
    }
  }
  
  // ===== RENDERIZAR TABELA =====
  async function renderTable(filters = {}) {
    const tbody = document.getElementById('auditTableBody');
    if (!tbody) return;
    
    // Mostra loading
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px;"><div class="spinner"></div> Carregando...</td></tr>';
    
    const logs = await getLogs(filters);
    
    if (logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color:#999;">Nenhum registro encontrado</td></tr>';
      hideStats();
      return;
    }
    
    tbody.innerHTML = logs.map(l => {
      const date = new Date(l.timestamp);
      const dateStr = date.toLocaleDateString('pt-BR');
      const timeStr = date.toLocaleTimeString('pt-BR');
      
      // Formatar detalhes
      let detailsStr = '';
      const detailsToShow = { ...l.details };
      delete detailsToShow.user_id;
      delete detailsToShow.user_role;
      delete detailsToShow.empresa_codigo;
      
      if (Object.keys(detailsToShow).length > 0) {
        const detailsArray = [];
        for (const [key, value] of Object.entries(detailsToShow)) {
          const label = formatDetailKey(key);
          const formattedValue = formatDetailValue(key, value);
          detailsArray.push(label + ': ' + formattedValue);
        }
        detailsStr = detailsArray.join(' | ');
      } else {
        detailsStr = '—';
      }
      
      const actionLabel = getActionLabel(l.action);
      
      return `
        <tr>
          <td style="white-space:nowrap;">
            <div style="font-weight:500;">${dateStr}</div>
            <div style="font-size:12px; color:#666;">${timeStr}</div>
          </td>
          <td>
            <div style="font-weight:500;">${esc(l.user.username)}</div>
            <div style="font-size:12px; color:#666;">${esc(l.user.role)}</div>
          </td>
          <td><strong>${esc(l.company)}</strong></td>
          <td>
            <span class="badge badge-${getActionColor(l.action)}">${esc(actionLabel)}</span>
          </td>
          <td style="font-size:13px; color:#555; max-width:400px; word-break:break-word;">
            ${esc(detailsStr)}
          </td>
        </tr>
      `;
    }).join('');
    
    showStats(logs);
  }
  
  // ===== FORMATAR CHAVES DOS DETALHES =====
  function formatDetailKey(key) {
    const labels = {
      'id': 'ID',
      'nome': 'Nome',
      'numero': 'Número',
      'username': 'Usuário',
      'role': 'Perfil',
      'userId': 'ID Usuário',
      'changes': 'Alterações',
      'de': 'De',
      'para': 'Para',
      'gerente': 'Gerente',
      'gerenteNome': 'Gerente',
      'mes': 'Mês',
      'total': 'Total',
      'tipo': 'Tipo',
      'descricao': 'Descrição',
      'valor': 'Valor',
      'dias': 'Dias',
      'removidos': 'Removidos',
      'count': 'Quantidade',
      'periodo': 'Período',
      'ini': 'Início',
      'fim': 'Fim',
      'info': 'Info'
    };
    
    return labels[key] || key;
  }
  
  // ===== FORMATAR VALORES DOS DETALHES =====
  function formatDetailValue(key, value) {
    if (value === null || value === undefined) return '—';
    
    if (key === 'total' || key === 'valor') {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        return 'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
    }
    
    return String(value);
  }
  
  // Função esc
  function esc(text) {
    if (typeof window.esc === 'function') return window.esc(text);
    
    const map = {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
      "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;'
    };
    return String(text ?? '').replace(/[&<>"'`=\/]/g, m => map[m]);
  }
  
  // ===== LABELS DAS AÇÕES =====
  function getActionLabel(action) {
    const labels = {
      'login': 'Login',
      'logout': 'Logout',
      'usuario_criado': 'Usuário Criado',
      'usuario_atualizado': 'Usuário Atualizado',
      'usuario_removido': 'Usuário Removido',
      'gerente_criado': 'Gerente Criado',
      'gerente_editado': 'Gerente Editado',
      'gerente_excluido': 'Gerente Excluído',
      'prestacao_salva': 'Prestação Salva',
      'prestacao_fechada': 'Prestação Fechada',
      'prestacao_excluida': 'Prestação Excluída',
      'lancamento_criado': 'Lançamento Criado',
      'lancamento_editado': 'Lançamento Editado',
      'lancamento_excluido': 'Lançamento Excluído',
      'recebimento_confirmado': 'Recebimento Confirmado',
      'pagamento_confirmado': 'Pagamento Confirmado',
      'recebimento_descartado': 'Recebimento Descartado',
      'pagamento_descartado': 'Pagamento Descartado',
      'despesa_criada': 'Despesa Criada',
      'despesa_editada': 'Despesa Editada',
      'despesa_excluida': 'Despesa Excluída',
      'vale_criado': 'Vale Criado',
      'vale_editado': 'Vale Editado',
      'vale_excluido': 'Vale Excluído',
      'ficha_criada': 'Ficha Criada',
      'ficha_editada': 'Ficha Editada',
      'ficha_excluida': 'Ficha Excluída',
      'empresa_alterada': 'Empresa Alterada',
      'auditoria_exportada': 'Auditoria Exportada',
      'auditoria_limpeza': 'Limpeza de Logs',
      'pendencia_confirmada': 'Pendência Confirmada',
      'pendencia_descartada': 'Pendência Descartada',
      'saldo_ajustado': 'Saldo Ajustado',
      'backup_criado': 'Backup Criado',
      'dados_importados': 'Dados Importados'
    };
    
    return labels[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
  
  function getActionColor(action) {
    if (action.includes('criado') || action.includes('criada') || action.includes('salva')) return 'success';
    if (action.includes('confirmado') || action.includes('confirmada')) return 'success';
    if (action.includes('excluido') || action.includes('excluida') || action.includes('removido')) return 'danger';
    if (action.includes('descartado') || action.includes('descartada')) return 'warning';
    if (action.includes('login')) return 'info';
    if (action.includes('logout')) return 'secondary';
    if (action.includes('editado') || action.includes('editada') || action.includes('atualizado')) return 'warning';
    if (action.includes('alterada') || action.includes('ajustado')) return 'primary';
    return 'primary';
  }
  
  // ===== ESTATÍSTICAS =====
  function showStats(logs) {
    const statsDiv = document.getElementById('auditStats');
    const statsText = document.getElementById('auditStatsText');
    
    if (!statsDiv || !statsText) return;
    
    const total = logs.length;
    const users = [...new Set(logs.map(l => l.user.username))].length;
    const actions = [...new Set(logs.map(l => l.action))].length;
    
    statsText.textContent = `${total} registros | ${users} usuários | ${actions} tipos de ação`;
    statsDiv.style.display = 'block';
  }
  
  function hideStats() {
    const statsDiv = document.getElementById('auditStats');
    if (statsDiv) statsDiv.style.display = 'none';
  }
  
  // ===== POPULAR FILTROS =====
  async function populateFilters() {
    const logs = await getLogs();
    const users = [...new Set(logs.map(l => l.user.username))].sort();
    const companies = [...new Set(logs.map(l => l.company))].sort();
    
    const userSelect = document.getElementById('auditFilterUser');
    if (userSelect) {
      userSelect.innerHTML = '<option value="">Todos</option>' +
        users.map(u => `<option value="${esc(u)}">${esc(u)}</option>`).join('');
    }
    
    const companySelect = document.getElementById('auditFilterCompany');
    if (companySelect) {
      companySelect.innerHTML = '<option value="">Todas</option>' +
        companies.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    }
  }
  
  // ===== EVENTOS DA UI =====
  function initUI() {
    const btnFilter = document.getElementById('btnAuditFilter');
    const btnExport = document.getElementById('btnAuditExport');
    const btnClear = document.getElementById('btnAuditClear');
    const btnRefresh = document.getElementById('btnAuditRefresh');
    
    if (btnFilter) {
      btnFilter.addEventListener('click', async function() {
        const filters = {
          username: document.getElementById('auditFilterUser')?.value || '',
          company: document.getElementById('auditFilterCompany')?.value || '',
          action: document.getElementById('auditFilterAction')?.value || '',
          startDate: document.getElementById('auditFilterStartDate')?.value || '',
          endDate: document.getElementById('auditFilterEndDate')?.value || ''
        };
        
        await renderTable(filters);
      });
    }
    
    if (btnExport) {
      btnExport.addEventListener('click', async function() {
        const filters = {
          username: document.getElementById('auditFilterUser')?.value || '',
          company: document.getElementById('auditFilterCompany')?.value || '',
          action: document.getElementById('auditFilterAction')?.value || '',
          startDate: document.getElementById('auditFilterStartDate')?.value || '',
          endDate: document.getElementById('auditFilterEndDate')?.value || ''
        };
        
        await exportLogs(filters);
      });
    }
    
    if (btnClear) {
      btnClear.addEventListener('click', async function() {
        const days = prompt('Remover logs com mais de quantos dias?', '90');
        if (!days) return;
        
        const numDays = parseInt(days);
        if (isNaN(numDays) || numDays < 1) {
          alert('Digite um número válido de dias.');
          return;
        }
        
        if (!confirm(`Remover logs com mais de ${numDays} dias?`)) return;
        
        const removed = await clearOldLogs(numDays);
        alert(`${removed} registros removidos.`);
        await renderTable();
        await populateFilters();
      });
    }
    
    if (btnRefresh) {
      btnRefresh.addEventListener('click', async function() {
        cacheTimestamp = 0;
        await renderTable();
        await populateFilters();
      });
    }
  }
  
  // ===== INICIALIZAÇÃO =====
  async function init() {
    const page = document.getElementById('pageHistorico');
    if (!page) return;
    
    await syncPendingLogs();
    await populateFilters();
    await renderTable();
    initUI();
    
    console.log('[Historico] ✅ Sistema inicializado com Supabase');
  }
  
  // ===== API PÚBLICA =====
  window.AuditLog = window.AuditLog || {};
  Object.assign(window.AuditLog, {
    log,
    getLogs,
    getLogsSync,
    exportLogs,
    clearOldLogs,
    renderTable,
    syncPendingLogs,
    init
  });
  
  // Auto-inicializar
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(syncPendingLogs, 2000);
    
    const observer = new MutationObserver(function() {
      const page = document.getElementById('pageHistorico');
      if (page && !page.classList.contains('hidden') && !page.__auditInit) {
        page.__auditInit = true;
        setTimeout(init, 200);
      }
    });
    
    const content = document.getElementById('content');
    if (content) {
      observer.observe(content, { childList: true, subtree: true, attributes: true });
    }
  });
  
  window.addEventListener('hashchange', function() {
    const hash = (location.hash || '').replace('#', '');
    if (hash === 'historico' || hash === 'audit') {
      setTimeout(init, 200);
    }
  });
  
  console.log('[Historico] 📋 Sistema de Auditoria Supabase carregado');
  
})();