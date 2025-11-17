// ============================================
// AUTH SUPABASE ADAPTER
// Adapta auth-rbac.js para usar Supabase
// ============================================

(function() {
  'use strict';
  
  if (!window.SupabaseAPI) {
    console.error('❌ SupabaseAPI não carregada! Carregue api-supabase.js primeiro.');
    return;
  }
  
  if (!window.UserAuth) {
    console.error('❌ UserAuth não carregada! Carregue auth-rbac.js primeiro.');
    return;
  }
  
  const API = window.SupabaseAPI.usuarios;
  
  // ============================================
  // SOBRESCREVER FUNÇÕES DO UserAuth
  // ============================================
  
  // Lista usuários
  const originalList = window.UserAuth.list;
  window.UserAuth.list = async function() {
    try {
      const users = await API.getAll();
      return users.map(u => ({
        id: u.id,
        username: u.username,
        pass: u.password,
        role: u.role,
        perms: u.permissoes || {},
        companies: [], // TODO: implementar empresas permitidas
        active: u.ativo
      }));
    } catch (error) {
      console.error('Erro ao listar usuários:', error);
      return originalList ? originalList() : [];
    }
  };
  
  // Criar usuário
  const originalCreate = window.UserAuth.createUser;
  window.UserAuth.createUser = async function({ username, password, role, perms, companies }) {
    try {
      username = String(username||'').trim().toLowerCase();
      if (!username || !password) {
        return { ok: false, msg: 'Preencha usuário e senha' };
      }
      
      // Verifica se existe
      const existing = await API.getByUsername(username);
      if (existing) {
        return { ok: false, msg: 'Usuário já existe' };
      }
      
      // Hash da senha
      const passHash = await window.UserAuth.sha(password);
      
      // Cria no Supabase
      await API.create({
        username,
        password: passHash,
        role: role || 'operador',
        permissoes: perms || {},
        nome: username
      });
      
      return { ok: true };
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      return { ok: false, msg: error.message };
    }
  };
  
  // Atualizar usuário
  const originalUpdate = window.UserAuth.updateUser;
  window.UserAuth.updateUser = async function(id, patch) {
    try {
      const updateData = {};
      
      if (patch.role !== undefined) updateData.role = patch.role;
      if (patch.perms !== undefined) updateData.permissoes = patch.perms;
      if (patch.companies !== undefined) {
        // TODO: implementar empresas permitidas
      }
      if (patch.active !== undefined) updateData.ativo = patch.active;
      
      await API.update(id, updateData);
      
      return { ok: true };
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      return { ok: false, msg: error.message };
    }
  };
  
  // Remover usuário
  const originalRemove = window.UserAuth.removeUser;
  window.UserAuth.removeUser = async function(id) {
    try {
      await API.delete(id);
      return { ok: true };
    } catch (error) {
      console.error('Erro ao remover usuário:', error);
      return { ok: false, msg: error.message };
    }
  };
  
  // Trocar senha
  const originalChangePassword = window.UserAuth.changePassword;
  window.UserAuth.changePassword = async function(id, newPassword) {
    try {
      const passHash = await window.UserAuth.sha(newPassword);
      await API.changePassword(id, passHash);
      return { ok: true };
    } catch (error) {
      console.error('Erro ao trocar senha:', error);
      return { ok: false, msg: error.message };
    }
  };
  
  // Login
  const originalLogin = window.UserAuth.login;
  window.UserAuth.login = async function(username, password) {
    try {
      const user = await API.getByUsername(username);
      
      if (!user || !user.ativo) {
        return { ok: false, msg: 'Usuário inexistente ou inativo' };
      }
      
      // Verifica senha
      const passHash = await window.UserAuth.sha(password);
      if (user.password !== passHash) {
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
        companies: [] // TODO: implementar
      });
      
      // Dispara evento
      document.dispatchEvent(new CustomEvent('auth:login', { 
        detail: { user: window.UserAuth.current() } 
      }));
      
      return { ok: true };
    } catch (error) {
      console.error('Erro no login:', error);
      return { ok: false, msg: 'Erro ao fazer login' };
    }
  };
  
  console.log('✅ Auth Supabase Adapter carregado!');
  console.log('🔐 UserAuth agora usa Supabase');
  
})();