// ============================================
// AUTH SUPABASE ADAPTER - VERSÃO SUPABASE
// ============================================

(function () {
    'use strict';
  
    // SHA-256 compatível com browsers modernos
    async function sha256(message) {
      if (window.crypto?.subtle) {
        const msgBuffer = new TextEncoder().encode(String(message));
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }
      // fallback bem simples
      let hash = 0;
      const str = String(message || '');
      for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + c;
        hash |= 0;
      }
      return Math.abs(hash).toString(16);
    }
  
    // Disponibiliza SHA globalmente
    window.sha256 = sha256;
    window.SHA256 = sha256;
    window.sha = sha256;
  
    function initAdapter() {
      if (!window.UserAuth) {
        console.error('[AuthAdapter] window.UserAuth ainda está indisponível.');
        return;
      }
      if (!window.SupabaseAPI?.usuarios) {
        console.error('[AuthAdapter] SupabaseAPI.usuarios ainda está indisponível.');
        return;
      }
  
      const API = window.SupabaseAPI.usuarios;
  
      // Garante SHA no UserAuth
      window.UserAuth.sha = sha256;
      window.UserAuth.sha256 = sha256;
  
      // LIST → sempre vindo do Supabase
      const originalList = window.UserAuth.list;
      window.UserAuth.list = async function () {
        try {
          const users = await API.getAll();
          if (!Array.isArray(users)) return [];
          return users.map(u => ({
            id: u.id,
            username: u.username,
            nome: u.nome,
            role: u.role || 'operador',
            pass: u.password,
            perms: u.permissoes || {},
            companies: [],
            ativo: u.ativo !== false
          }));
        } catch (err) {
          console.error('[AuthAdapter] erro em list():', err);
          return [];
        }
      };
  
      // CREATE → grava no Supabase
      const originalCreate = window.UserAuth.createUser;
      window.UserAuth.createUser = async function (data) {
        try {
          const username = String(data?.username || '').trim().toLowerCase();
          const password = String(data?.password || '');
          const role = data?.role || 'operador';
          const nome = data?.nome || data?.name || username;
  
          const hash = await sha256(password);
  
          const payload = {
            username,
            password: hash,
            role,
            nome,
            empresa_id: data?.empresa_id || null,
            permissoes: data?.perms || data?.permissoes || {},
            ativo: data?.ativo ?? true
          };
  
          const user = await API.create(payload);
          return user;
        } catch (err) {
          console.error('[AuthAdapter] erro em createUser():', err);
          if (typeof originalCreate === 'function') {
            return originalCreate(data);
          }
          throw err;
        }
      };
  
      // LOGIN → valida hash com coluna password
      const originalLogin = window.UserAuth.login;
      window.UserAuth.login = async function (username, password) {
        username = String(username || '').trim().toLowerCase();
        password = String(password || '');
  
        try {
          const user = await API.getByUsername(username);
          if (!user || user.ativo === false) {
            throw new Error('Usuário não encontrado ou inativo');
          }
  
          const hash = await sha256(password);
          if (user.password !== hash) {
            throw new Error('Senha inválida');
          }
  
          const perms = (user.role === 'admin')
            ? (window.UserAuth.permsAllTrue ? window.UserAuth.permsAllTrue() : {})
            : (user.permissoes || {});
  
          const session = {
            id: user.id,
            username: user.username,
            nome: user.nome,
            role: user.role || 'operador',
            empresa_id: user.empresa_id || null,
            perms
          };
  
          if (typeof window.UserAuth.setSession === 'function') {
            window.UserAuth.setSession(session);
          } else {
            window.UserAuth._session = session;
          }
  
          try {
            const evt = new CustomEvent('auth:login', { detail: session });
            document.dispatchEvent(evt);
          } catch (_) {}
  
          return session;
        } catch (err) {
          console.error('[AuthAdapter] Erro no login via Supabase:', err);
          if (typeof originalLogin === 'function') {
            return originalLogin(username, password);
          }
          throw err;
        }
      };
  
      console.log('[AuthAdapter] ✅ Adapter Supabase aplicado em UserAuth.');
    }
  
    // Espera UserAuth + SupabaseAPI ficarem prontos
    function waitForDeps(retries) {
      retries = retries ?? 50;
  
      const ready =
        window.UserAuth &&
        window.SupabaseAPI &&
        window.SupabaseAPI.usuarios;
  
      if (ready) {
        initAdapter();
        return;
      }
  
      if (retries <= 0) {
        console.error('[AuthAdapter] Falha ao inicializar: dependências não ficaram prontas.');
        return;
      }
  
      setTimeout(() => waitForDeps(retries - 1), 100);
    }
  
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => waitForDeps());
    } else {
      waitForDeps();
    }
  })();
  