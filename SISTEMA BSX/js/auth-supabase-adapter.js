// ============================================
// AUTH SUPABASE ADAPTER - VERSÃO CORRIGIDA
// ============================================

(function() {
    'use strict';
    
    // FUNÇÃO SHA256 GLOBAL
    async function sha256(message) {
      if (window.crypto && window.crypto.subtle) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
      }
      // fallback simples
      let hash = 0;
      for (let i = 0; i < message.length; i++) {
        const char = message.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(16);
    }

    // deixa SHA disponível globalmente
    window.sha256 = sha256;
    window.SHA256 = sha256;
    window.sha = sha256;
    
    // ============================================
    // AGUARDA DEPENDÊNCIAS
    // ============================================
    
    function waitForDependencies(callback) {
      let attempts = 0;
      const maxAttempts = 50;
      
      function check() {
        attempts++;
        
        if (window.SupabaseAPI && window.UserAuth) {
          // Força SHA no UserAuth
          window.UserAuth.sha = sha256;
          window.UserAuth.sha256 = sha256;
          
          console.log('✅ Dependências prontas, SHA256 anexada');
          callback();
          return;
        }
        
        if (attempts >= maxAttempts) {
          console.error('❌ Timeout aguardando dependências');
          return;
        }
        
        setTimeout(check, 100);
      }
      
      check();
    }
    
    // ============================================
    // FUNÇÃO PRINCIPAL DO ADAPTER
    // ============================================
    
    function initAdapter() {
        const API = window.SupabaseAPI.usuarios;
      
        // garante SHA no UserAuth
        window.UserAuth.sha = sha256;
        window.UserAuth.sha256 = sha256;
      
      
      // ============================================
      // LISTA USUÁRIOS
      // ============================================
      
      const originalList = window.UserAuth.list;
      window.UserAuth.list = async function() {
        try {
          const users = await API.getAll();
          
          if (!Array.isArray(users)) {
            console.warn('API retornou não-array, convertendo...');
            return [];
          }
          
          return users.map(u => ({
            id: u.id,
            username: u.username,
            pass: u.password,
            role: u.role,
            perms: u.permissoes || {},
            companies: [],
            active: u.ativo
          }));
        } catch (error) {
          console.error('Erro ao listar usuários:', error);
          
          if (originalList) {
            try {
              const result = originalList();
              return Array.isArray(result) ? result : [];
            } catch (e) {
              console.error('Fallback também falhou:', e);
            }
          }
          return [];
        }
      };
      
      // ============================================
      // LOGIN
      // ============================================
      
      const originalLogin = window.UserAuth.login;
      window.UserAuth.login = async function(username, password) {
        try {
          console.log('🔐 Tentando login via Supabase...');
          
          // Busca usuário no Supabase
          const user = await API.getByUsername(username);
          
          if (!user) {
            console.log('Usuário não encontrado no Supabase, tentando localStorage...');
            
            if (originalLogin) {
              return await originalLogin(username, password);
            }
            
            return { ok: false, msg: 'Usuário não encontrado' };
          }
          
          if (!user.ativo) {
            return { ok: false, msg: 'Usuário inativo' };
          }
          
          // USA A FUNÇÃO SHA256 GLOBAL
          const passHash = await sha256(password);
          
          // Verifica senha
          if (user.password !== passHash) {
            console.log('Senha incorreta');
            return { ok: false, msg: 'Senha inválida' };
          }
          
          // Monta permissões
          const perms = (user.role === 'admin') 
            ? window.UserAuth.permsAllTrue()
            : (user.permissoes || {});
          
          // Cria sessão
          window.UserAuth.setSession({
            id: user.id,
            username: user.username,
            role: user.role,
            perms,
            companies: []
          });
          
          // Dispara evento
          document.dispatchEvent(new CustomEvent('auth:login', { 
            detail: { user: window.UserAuth.current() } 
          }));
          
          console.log('✅ Login bem sucedido via Supabase!');
          return { ok: true };
          
        } catch (error) {
          console.error('❌ Erro no login Supabase:', error);
          console.log('Tentando fallback para localStorage...');
          
          if (originalLogin) {
            try {
              return await originalLogin(username, password);
            } catch (e) {
              console.error('Fallback também falhou:', e);
            }
          }
          
          return { ok: false, msg: 'Erro ao fazer login: ' + error.message };
        }
      };
      
      // ============================================
      // CRIAR USUÁRIO
      // ============================================
      
      const originalCreate = window.UserAuth.createUser;
      window.UserAuth.createUser = async function({ username, password, role, perms, companies }) {
        try {
          username = String(username||'').trim().toLowerCase();
          if (!username || !password) {
            return { ok: false, msg: 'Preencha usuário e senha' };
          }
          
          const existing = await API.getByUsername(username);
          if (existing) {
            return { ok: false, msg: 'Usuário já existe' };
          }
          
          const passHash = await sha256(password);
          
          await API.create({
            username,
            password: passHash,
            role: role || 'operador',
            permissoes: perms || {},
            nome: username
          });
          
          console.log('✅ Usuário criado no Supabase');
          return { ok: true };
          
        } catch (error) {
          console.error('Erro ao criar usuário:', error);
          
          if (originalCreate) {
            return originalCreate({ username, password, role, perms, companies });
          }
          
          return { ok: false, msg: error.message };
        }
      };
      
      // ============================================
      // ATUALIZAR USUÁRIO
      // ============================================
      
      const originalUpdate = window.UserAuth.updateUser;
      window.UserAuth.updateUser = async function(id, patch) {
        try {
          const updateData = {};
          
          if (patch.role !== undefined) updateData.role = patch.role;
          if (patch.perms !== undefined) updateData.permissoes = patch.perms;
          if (patch.active !== undefined) updateData.ativo = patch.active;
          
          await API.update(id, updateData);
          
          return { ok: true };
        } catch (error) {
          console.error('Erro ao atualizar usuário:', error);
          
          if (originalUpdate) {
            return originalUpdate(id, patch);
          }
          
          return { ok: false, msg: error.message };
        }
      };
      
      // ============================================
      // REMOVER USUÁRIO
      // ============================================
      
      const originalRemove = window.UserAuth.removeUser;
      window.UserAuth.removeUser = async function(id) {
        try {
          await API.delete(id);
          return { ok: true };
        } catch (error) {
          console.error('Erro ao remover usuário:', error);
          
          if (originalRemove) {
            return originalRemove(id);
          }
          
          return { ok: false, msg: error.message };
        }
      };
      
      // ============================================
      // TROCAR SENHA
      // ============================================
      
      const originalChangePassword = window.UserAuth.changePassword;
      window.UserAuth.changePassword = async function(id, newPassword) {
        try {
          const passHash = await sha256(newPassword);
          await API.changePassword(id, passHash);
          return { ok: true };
        } catch (error) {
          console.error('Erro ao trocar senha:', error);
          
          if (originalChangePassword) {
            return originalChangePassword(id, newPassword);
          }
          
          return { ok: false, msg: error.message };
        }
      };
      
      console.log('✅ Auth Supabase Adapter carregado!');
      console.log('🔑 UserAuth.sha disponível:', typeof window.UserAuth.sha);
    }
    
    // ============================================
    // INICIALIZAÇÃO
    // ============================================
    
    // Corrige APP_DB se não existir
    if (!window.APP_DB) {
      window.APP_DB = {
        users: 'APP_USERS_V3',
        session: 'APP_SESSION_V3'
      };
    }
    
    // Inicia quando tudo estiver pronto
    waitForDependencies(initAdapter);
    
})();