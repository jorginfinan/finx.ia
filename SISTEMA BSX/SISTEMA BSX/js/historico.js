// ===== SISTEMA DE HISTORICO/AUDITORIA COMPLETO =====
(function() {
    'use strict';
    
    const AUDIT_KEY = 'APP_AUDIT_LOG_V1';
    const MAX_LOGS = 1000;
    
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
    
    // ===== REGISTRAR ACAO =====
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
        
        // Mantem apenas os ultimos registros
        if (logs.length > MAX_LOGS) {
          logs.splice(0, logs.length - MAX_LOGS);
        }
        
        localStorage.setItem(AUDIT_KEY, JSON.stringify(logs));
        
        // Notifica outras abas
        if (typeof window.SyncManager !== 'undefined') {
          window.SyncManager.notify('audit', { action });
        }
        
        console.log('[Audit]', action, details);
        
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
        
        // Filtrar por usuario
        if (filters.username) {
          logs = logs.filter(l => l.user.username === filters.username);
        }
        
        // Filtrar por empresa
        if (filters.company) {
          logs = logs.filter(l => l.company === filters.company);
        }
        
        // Filtrar por acao
        if (filters.action) {
          logs = logs.filter(l => l.action.toLowerCase().includes(filters.action.toLowerCase()));
        }
        
        // Filtrar por periodo
        if (filters.startDate) {
          const start = new Date(filters.startDate).getTime();
          logs = logs.filter(l => new Date(l.timestamp).getTime() >= start);
        }
        
        if (filters.endDate) {
          const end = new Date(filters.endDate).getTime() + 86400000; // +1 dia
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
      
      if (logs.length === 0) {
        alert('Nenhum registro para exportar.');
        return;
      }
      
      const csv = [
        ['Data/Hora', 'Usuario', 'Perfil', 'Empresa', 'Acao', 'Detalhes'].join(','),
        ...logs.map(l => [
          new Date(l.timestamp).toLocaleString('pt-BR'),
          l.user.username,
          l.user.role,
          l.company,
          l.action,
          JSON.stringify(l.details).replace(/,/g, ';')
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
    function clearOldLogs(days = 90) {
      try {
        const logs = JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        
        const filtered = logs.filter(l => new Date(l.timestamp).getTime() > cutoff);
        
        localStorage.setItem(AUDIT_KEY, JSON.stringify(filtered));
        
        const removed = logs.length - filtered.length;
        
        log('auditoria_limpeza', { dias: days, removidos: removed });
        
        return removed;
      } catch(e) {
        console.error('Erro ao limpar logs:', e);
        return 0;
      }
    }
    
    // ===== RENDERIZAR TABELA =====
    function renderTable(filters = {}) {
      const tbody = document.getElementById('auditTableBody');
      if (!tbody) return;
      
      const logs = getLogs(filters);
      
      if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px; color:#999;">Nenhum registro encontrado</td></tr>';
        hideStats();
        return;
      }
      
      tbody.innerHTML = logs.map(l => {
        const date = new Date(l.timestamp);
        const dateStr = date.toLocaleDateString('pt-BR');
        const timeStr = date.toLocaleTimeString('pt-BR');
        
        // Formatar detalhes de forma mais legivel
        let detailsStr = '';
        if (Object.keys(l.details).length > 0) {
          const detailsArray = [];
          for (const [key, value] of Object.entries(l.details)) {
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
        'numero': 'Numero',
        'username': 'Usuario',
        'role': 'Perfil',
        'userId': 'ID Usuario',
        'changes': 'Alteracoes',
        'de': 'De',
        'para': 'Para',
        'gerente': 'Gerente',
        'mes': 'Mes',
        'total': 'Total',
        'tipo': 'Tipo',
        'descricao': 'Descricao',
        'valor': 'Valor',
        'dias': 'Dias',
        'removidos': 'Removidos',
        'count': 'Quantidade'
      };
      
      return labels[key] || key;
    }
    
    // ===== FORMATAR VALORES DOS DETALHES =====
    function formatDetailValue(key, value) {
      if (value === null || value === undefined) return '—';
      
      // Valores monetarios
      if (key === 'total' || key === 'valor') {
        const num = parseFloat(value);
        if (!isNaN(num)) {
          return 'R$ ' + num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
      }
      
      return String(value);
    }
    
    // Funcao esc global (se nao existir)
    function esc(text) {
      if (typeof window.esc === 'function') return window.esc(text);
      
      const map = {
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
        "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;'
      };
      return String(text ?? '').replace(/[&<>"'`=\/]/g, m => map[m]);
    }
    
    // ===== LABELS DAS ACOES =====
    function getActionLabel(action) {
      const labels = {
        'login': 'Login',
        'logout': 'Logout',
        'usuario_criado': 'Usuario Criado',
        'usuario_atualizado': 'Usuario Atualizado',
        'usuario_removido': 'Usuario Removido',
        'gerente_criado': 'Gerente Criado',
        'gerente_editado': 'Gerente Editado',
        'gerente_excluido': 'Gerente Excluido',
        'prestacao_salva': 'Prestacao Salva',
        'prestacao_fechada': 'Prestacao Fechada',
        'prestacao_excluida': 'Prestacao Excluida',
        'lancamento_criado': 'Lancamento Criado',
        'lancamento_editado': 'Lancamento Editado',
        'lancamento_excluido': 'Lancamento Excluido',
        'recebimento_confirmado': 'Recebimento Confirmado',
        'pagamento_confirmado': 'Pagamento Confirmado',
        'recebimento_descartado': 'Recebimento Descartado',
        'pagamento_descartado': 'Pagamento Descartado',
        'despesa_criada': 'Despesa Criada',
        'despesa_editada': 'Despesa Editada',
        'despesa_excluida': 'Despesa Excluida',
        'vale_criado': 'Vale Criado',
        'vale_editado': 'Vale Editado',
        'vale_excluido': 'Vale Excluido',
        'ficha_criada': 'Ficha Criada',
        'ficha_editada': 'Ficha Editada',
        'ficha_excluida': 'Ficha Excluida',
        'empresa_alterada': 'Empresa Alterada',
        'auditoria_exportada': 'Auditoria Exportada',
        'auditoria_limpeza': 'Limpeza de Logs'
      };
      
      return labels[action] || action.replace(/_/g, ' ').toUpperCase();
    }
    
    function getActionColor(action) {
      if (action.includes('criado') || action.includes('criada') || action.includes('salva')) return 'success';
      if (action.includes('confirmado')) return 'success';
      if (action.includes('excluido') || action.includes('excluida') || action.includes('removido')) return 'danger';
      if (action.includes('descartado') || action.includes('descartada')) return 'warning';
      if (action.includes('login')) return 'info';
      if (action.includes('logout')) return 'secondary';
      if (action.includes('editado') || action.includes('editada') || action.includes('atualizado')) return 'warning';
      return 'primary';
    }
    
    // ===== ESTATISTICAS =====
    function showStats(logs) {
      const statsDiv = document.getElementById('auditStats');
      const statsText = document.getElementById('auditStatsText');
      
      if (!statsDiv || !statsText) return;
      
      const total = logs.length;
      const users = [...new Set(logs.map(l => l.user.username))].length;
      const actions = [...new Set(logs.map(l => l.action))].length;
      
      statsText.textContent = `${total} registros | ${users} usuarios | ${actions} tipos de acao`;
      statsDiv.style.display = 'block';
    }
    
    function hideStats() {
      const statsDiv = document.getElementById('auditStats');
      if (statsDiv) statsDiv.style.display = 'none';
    }
    
    // ===== POPULAR FILTROS =====
    function populateFilters() {
      const logs = getLogs();
      const users = [...new Set(logs.map(l => l.user.username))].sort();
      
      const userSelect = document.getElementById('auditFilterUser');
      if (userSelect) {
        userSelect.innerHTML = '<option value="">Todos</option>' +
          users.map(u => `<option value="${esc(u)}">${esc(u)}</option>`).join('');
      }
    }
    
    // ===== EVENTOS DA UI =====
    function initUI() {
      const btnFilter = document.getElementById('btnAuditFilter');
      const btnExport = document.getElementById('btnAuditExport');
      const btnClear = document.getElementById('btnAuditClear');
      
      if (btnFilter) {
        btnFilter.addEventListener('click', function() {
          const filters = {
            username: document.getElementById('auditFilterUser')?.value || '',
            company: document.getElementById('auditFilterCompany')?.value || '',
            action: document.getElementById('auditFilterAction')?.value || '',
            startDate: document.getElementById('auditFilterStartDate')?.value || '',
            endDate: document.getElementById('auditFilterEndDate')?.value || ''
          };
          
          renderTable(filters);
        });
      }
      
      if (btnExport) {
        btnExport.addEventListener('click', function() {
          const filters = {
            username: document.getElementById('auditFilterUser')?.value || '',
            company: document.getElementById('auditFilterCompany')?.value || '',
            action: document.getElementById('auditFilterAction')?.value || '',
            startDate: document.getElementById('auditFilterStartDate')?.value || '',
            endDate: document.getElementById('auditFilterEndDate')?.value || ''
          };
          
          exportLogs(filters);
        });
      }
      
      if (btnClear) {
        btnClear.addEventListener('click', function() {
          const days = prompt('Remover logs com mais de quantos dias?', '90');
          if (!days) return;
          
          const numDays = parseInt(days);
          if (isNaN(numDays) || numDays < 1) {
            alert('Digite um numero valido de dias.');
            return;
          }
          
          if (!confirm(`Remover logs com mais de ${numDays} dias?`)) return;
          
          const removed = clearOldLogs(numDays);
          alert(`${removed} registros removidos.`);
          renderTable();
          populateFilters();
        });
      }
    }
    
    // ===== INICIALIZACAO =====
    function init() {
      // So inicializa se estiver na pagina de historico
      const page = document.getElementById('pageHistorico');
      if (!page) return;
      
      populateFilters();
      renderTable();
      initUI();
      
      console.log('[Historico] Sistema inicializado');
    }
    
    // ===== API PUBLICA =====
    window.AuditLog = window.AuditLog || {};
    Object.assign(window.AuditLog, {
      log,
      getLogs,
      exportLogs,
      clearOldLogs,
      renderTable,
      init
    });
    
    // Auto-inicializar quando a pagina de historico for mostrada
    document.addEventListener('DOMContentLoaded', function() {
      // Observa quando a pagina e mostrada
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
    
    // Tambem inicializa ao navegar
    window.addEventListener('hashchange', function() {
      const hash = (location.hash || '').replace('#', '');
      if (hash === 'historico' || hash === 'audit') {
        setTimeout(init, 200);
      }
    });
    
  })();