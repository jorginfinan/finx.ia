// ===== INTEGRAÇÃO AUTOMÁTICA DE AUDITORIA =====
(function() {
    'use strict';
    
    // Aguarda o AuditLog estar disponível
    function waitForAuditLog(callback) {
      if (typeof window.AuditLog !== 'undefined') {
        callback();
        return;
      }
      
      setTimeout(() => waitForAuditLog(callback), 100);
    }
    
    waitForAuditLog(function() {
      console.log('[Audit-Auto] Inicializando interceptadores...');
      
      // ===== HELPER PARA INTERCEPTAR FUNÇÕES =====
      function interceptFunction(obj, funcName, beforeLog, afterLog) {
        if (!obj || typeof obj[funcName] !== 'function') return;
        
        const original = obj[funcName];
        obj[funcName] = async function(...args) {
          if (beforeLog) beforeLog(args);
          
          const result = await original.apply(this, args);
          
          if (afterLog) afterLog(args, result);
          
          return result;
        };
      }
      
      // ===== INTERCEPTAR USERAUTH =====
      if (window.UserAuth) {
        // Login
        interceptFunction(window.UserAuth, 'login', null, function([username], result) {
          if (result?.ok) {
            window.AuditLog.log('login', { username });
          }
        });
        
        // Criar usuário
        interceptFunction(window.UserAuth, 'createUser', null, function([data], result) {
          if (result?.ok) {
            window.AuditLog.log('usuario_criado', { 
              username: data.username,
              role: data.role 
            });
          }
        });
        
        // Atualizar usuário
        interceptFunction(window.UserAuth, 'updateUser', null, function([id, patch], result) {
          if (result?.ok) {
            window.AuditLog.log('usuario_atualizado', { 
              userId: id,
              changes: Object.keys(patch).join(', ')
            });
          }
        });
        
        // Remover usuário
        interceptFunction(window.UserAuth, 'removeUser', function([id]) {
          const users = window.UserAuth.list?.() || [];
          const user = users.find(u => u.id === id);
          window.AuditLog.log('usuario_removido', { 
            userId: id,
            username: user?.username || 'desconhecido'
          });
        });
        
        // Logout
        interceptFunction(window.UserAuth, 'logout', function() {
          window.AuditLog.log('logout');
        });
        
        console.log('[Audit-Auto] ✅ UserAuth interceptado');
      }
      
      // ===== INTERCEPTAR EMPRESA =====
      if (typeof window.setCompany === 'function') {
        const originalSetCompany = window.setCompany;
        window.setCompany = function(empresa) {
          const oldCompany = window.getCompany?.() || 'BSX';
          const result = originalSetCompany(empresa);
          window.AuditLog.log('empresa_alterada', { 
            de: oldCompany, 
            para: empresa 
          });
          return result;
        };
        
        console.log('[Audit-Auto] ✅ setCompany interceptado');
      }
      
      console.log('[Audit-Auto] ✅ Auditoria automática ativada');
    });
    
  })();