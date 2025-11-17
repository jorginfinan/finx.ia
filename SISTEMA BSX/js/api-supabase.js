// ============================================
// API SUPABASE - FINX.IA
// VERSÃO CORRIGIDA - Tabelas em português
// ============================================

(function() {
    'use strict';
    
    // ============================================
    // CONFIGURAÇÃO DO SUPABASE
    // ============================================
    
    // ❗ COLE SUAS CREDENCIAIS AQUI:
    const SUPABASE_URL = 'https://ttdwmbwiapkjbjbepeza.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0ZHdtYndpYXBramJqYmVwZXpheyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0ZHdtYndpYXBramJqYmVwZXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzMjg4NDgsImV4cCI6MjA3ODkwNDg0OH0.NZxm-ZQbQFVceO6yUABKAIj7XY7qN6RXSLi-8NF-BAwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE4MDcyMDQsImV4cCI6MjA0NzM4MzIwNH0.RlHzE41kl5k8F5gzr6H-t6PoYzv6aYgX3LxQp-gzIZI';
    
    if (!window.supabase) {
      console.error('❌ Supabase não carregado! Adicione o CDN ao HTML.');
      return;
    }
    
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // ============================================
    // HELPERS
    // ============================================
    
    function getEmpresaId() {
      const nome = window.getCompany ? window.getCompany() : 'BSX';
      // Busca ID da empresa no cache ou faz query
      return getEmpresaIdByNome(nome);
    }
    
    let empresasCache = null;
    
    async function getEmpresaIdByNome(nome) {
      if (!empresasCache) {
        const { data } = await supabaseClient.from('empresas').select('id, nome');
        empresasCache = data || [];
      }
      const emp = empresasCache.find(e => e.nome === nome);
      return emp?.id || null;
    }
    
    async function getAllEmpresasIds() {
      if (!empresasCache) {
        const { data } = await supabaseClient.from('empresas').select('id, nome');
        empresasCache = data || [];
      }
      return empresasCache.map(e => e.id);
    }
    
    // ============================================
    // API DE USUÁRIOS
    // ============================================
    
    class UsuariosAPI {
      constructor() {
        this.table = 'usuarios';
        this.client = supabaseClient;
      }
      
      async getAll() {
        try {
          const { data, error } = await this.client
            .from(this.table)
            .select('*')
            .order('username');
          
          if (error) throw error;
          return data || [];
        } catch (error) {
          console.error('Erro ao buscar usuários:', error);
          return [];
        }
      }
      
      async getByUsername(username) {
        try {
          const { data, error } = await this.client
            .from(this.table)
            .select('*')
            .eq('username', username.toLowerCase())
            .single();
          
          if (error) throw error;
          return data;
        } catch (error) {
          return null;
        }
      }
      
      async getById(id) {
        try {
          const { data, error } = await this.client
            .from(this.table)
            .select('*')
            .eq('id', id)
            .single();
          
          if (error) throw error;
          return data;
        } catch (error) {
          return null;
        }
      }
      
      async create(userData) {
        try {
          const empresaId = await getEmpresaId();
          
          const { data, error } = await this.client
            .from(this.table)
            .insert([{
              nome: userData.nome || userData.username,
              username: userData.username.toLowerCase(),
              password: userData.password,
              role: userData.role || 'operador',
              empresa_id: empresaId,
              permissoes: userData.permissoes || userData.perms || {},
              ativo: true
            }])
            .select()
            .single();
          
          if (error) throw error;
          return data;
        } catch (error) {
          console.error('Erro ao criar usuário:', error);
          throw error;
        }
      }
      
      async update(id, patch) {
        try {
          const { data, error } = await this.client
            .from(this.table)
            .update(patch)
            .eq('id', id)
            .select()
            .single();
          
          if (error) throw error;
          return data;
        } catch (error) {
          console.error('Erro ao atualizar usuário:', error);
          throw error;
        }
      }
      
      async delete(id) {
        try {
          const { error } = await this.client
            .from(this.table)
            .delete()
            .eq('id', id);
          
          if (error) throw error;
          return true;
        } catch (error) {
          console.error('Erro ao deletar usuário:', error);
          return false;
        }
      }
      
      async changePassword(id, newPasswordHash) {
        return this.update(id, { password: newPasswordHash });
      }
    }
    
    // ============================================
    // API DE GERENTES
    // ============================================
    
    class GerentesAPI {
      constructor() {
        this.table = 'gerentes';
        this.client = supabaseClient;
      }
      
      async getAll() {
        try {
          const empresaId = await getEmpresaId();
          const { data, error } = await this.client
            .from(this.table)
            .select('*')
            .eq('empresa_id', empresaId)
            .order('nome');
          
          if (error) throw error;
          return data || [];
        } catch (error) {
          console.error('Erro ao buscar gerentes:', error);
          return [];
        }
      }
      
      async getAtivos() {
        try {
          const empresaId = await getEmpresaId();
          const { data, error } = await this.client
            .from(this.table)
            .select('*')
            .eq('empresa_id', empresaId)
            .eq('ativo', true)
            .order('nome');
          
          if (error) throw error;
          return data || [];
        } catch (error) {
          console.error('Erro ao buscar gerentes ativos:', error);
          return [];
        }
      }
      
      async getByUid(uid) {
        try {
          const empresaId = await getEmpresaId();
          const { data, error } = await this.client
            .from(this.table)
            .select('*')
            .eq('empresa_id', empresaId)
            .eq('uid', uid)
            .single();
          
          if (error) throw error;
          return data;
        } catch (error) {
          return null;
        }
      }
      
      async create(gerente) {
        try {
          const empresaId = await getEmpresaId();
          
          const { data, error } = await this.client
            .from(this.table)
            .insert([{
              ...gerente,
              empresa_id: empresaId
            }])
            .select()
            .single();
          
          if (error) throw error;
          return data;
        } catch (error) {
          console.error('Erro ao criar gerente:', error);
          throw error;
        }
      }
      
      async updateByUid(uid, patch) {
        try {
          const empresaId = await getEmpresaId();
          
          const { data, error } = await this.client
            .from(this.table)
            .update(patch)
            .eq('uid', uid)
            .eq('empresa_id', empresaId)
            .select()
            .single();
          
          if (error) throw error;
          return data;
        } catch (error) {
          console.error('Erro ao atualizar gerente:', error);
          throw error;
        }
      }
      
      async deleteByUid(uid) {
        try {
          const empresaId = await getEmpresaId();
          
          const { error } = await this.client
            .from(this.table)
            .delete()
            .eq('uid', uid)
            .eq('empresa_id', empresaId);
          
          if (error) throw error;
          return true;
        } catch (error) {
          console.error('Erro ao deletar gerente:', error);
          return false;
        }
      }
      
      async desativar(uid) {
        return this.updateByUid(uid, { ativo: false });
      }
    }
    
    // ============================================
    // API DE DESPESAS
    // ============================================
    
    class DespesasAPI {
      constructor() {
        this.table = 'despesas';
        this.client = supabaseClient;
      }
      
      async getAll() {
        try {
          const empresaId = await getEmpresaId();
          const { data, error } = await this.client
            .from(this.table)
            .select('*')
            .eq('empresa_id', empresaId)
            .order('data', { ascending: false });
          
          if (error) throw error;
          return data || [];
        } catch (error) {
          console.error('Erro ao buscar despesas:', error);
          return [];
        }
      }
      
      async create(despesa) {
        try {
          const empresaId = await getEmpresaId();
          
          const { data, error } = await this.client
            .from(this.table)
            .insert([{
              ...despesa,
              empresa_id: empresaId
            }])
            .select()
            .single();
          
          if (error) throw error;
          return data;
        } catch (error) {
          console.error('Erro ao criar despesa:', error);
          throw error;
        }
      }
      
      async updateByUid(uid, patch) {
        try {
          const empresaId = await getEmpresaId();
          
          const { data, error } = await this.client
            .from(this.table)
            .update(patch)
            .eq('uid', uid)
            .eq('empresa_id', empresaId)
            .select()
            .single();
          
          if (error) throw error;
          return data;
        } catch (error) {
          console.error('Erro ao atualizar despesa:', error);
          throw error;
        }
      }
    }
    
    // ============================================
    // API DE PRESTAÇÕES
    // ============================================
    
    class PrestacoesAPI {
      constructor() {
        this.table = 'prestacoes';
        this.client = supabaseClient;
      }
      
      async getAll() {
        try {
          const empresaId = await getEmpresaId();
          const { data, error } = await this.client
            .from(this.table)
            .select('*')
            .eq('empresa_id', empresaId)
            .order('data', { ascending: false });
          
          if (error) throw error;
          return data || [];
        } catch (error) {
          console.error('Erro ao buscar prestações:', error);
          return [];
        }
      }
      
      async create(prestacao) {
        try {
          const empresaId = await getEmpresaId();
          
          const { data, error } = await this.client
            .from(this.table)
            .insert([{
              ...prestacao,
              empresa_id: empresaId
            }])
            .select()
            .single();
          
          if (error) throw error;
          return data;
        } catch (error) {
          console.error('Erro ao criar prestação:', error);
          throw error;
        }
      }
    }
    
    // ============================================
    // EXPORTAR API
    // ============================================
    
    window.SupabaseAPI = {
      usuarios: new UsuariosAPI(),
      gerentes: new GerentesAPI(),
      despesas: new DespesasAPI(),
      prestacoes: new PrestacoesAPI(),
      client: supabaseClient
    };
    
    // Aliases para compatibilidade
    window.SupabaseAPI.users = window.SupabaseAPI.usuarios;
    
    console.log('✅ API Supabase carregada!');
    console.log('📊 Tabelas: usuarios, gerentes, despesas, prestacoes');
    
  })();