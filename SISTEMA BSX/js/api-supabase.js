// ============================================
// API SUPABASE COMPLETA - FINX.IA
// Substitui localStorage por Supabase
// ============================================

(function() {
    'use strict';
    
    // ============================================
    // CONFIGURAÇÃO DO SUPABASE
    // ============================================
    
    // ❗ IMPORTANTE: Substitua pelas suas credenciais do Supabase
    const SUPABASE_URL = 'https://ttdwmbwiapkjbjbepeza.supabase.co'; // Ex: https://xxx.supabase.co
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0ZHdtYndpYXBramJqYmVwZXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzMjg4NDgsImV4cCI6MjA3ODkwNDg0OH0.NZxm-ZQbQFVceO6yUABKAIj7XY7qN6RXSLi-8NF-BAw';
    
    // Verifica se o Supabase está configurado
    if (!window.supabase) {
      console.error('❌ Supabase não está carregado! Adicione o script do Supabase ao HTML.');
      return;
    }
    
    // Inicializa cliente Supabase
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // ============================================
    // CLASSE BASE - API GENÉRICA
    // ============================================
    
    class SupabaseAPI {
      constructor(tableName) {
        this.table = tableName;
        this.client = supabaseClient;
      }
      
      // Pega empresa atual
      getEmpresa() {
        return window.getCompany ? window.getCompany() : 'BSX';
      }
      
      // GET - Lista todos os registros (com filtro de empresa)
      async getAll(filters = {}) {
        try {
          let query = this.client
            .from(this.table)
            .select('*')
            .eq('empresa', this.getEmpresa());
          
          // Adiciona filtros extras
          Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              query = query.eq(key, value);
            }
          });
          
          const { data, error } = await query.order('created_at', { ascending: false });
          
          if (error) throw error;
          return data || [];
        } catch (error) {
          console.error(`Erro ao buscar ${this.table}:`, error);
          return [];
        }
      }
      
      // GET ONE - Busca por ID
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
          console.error(`Erro ao buscar ${this.table} por ID:`, error);
          return null;
        }
      }
      
      // GET ONE - Busca por UID (legado)
      async getByUid(uid) {
        try {
          const { data, error } = await this.client
            .from(this.table)
            .select('*')
            .eq('uid', uid)
            .eq('empresa', this.getEmpresa())
            .single();
          
          if (error) throw error;
          return data;
        } catch (error) {
          console.error(`Erro ao buscar ${this.table} por UID:`, error);
          return null;
        }
      }
      
      // CREATE - Cria novo registro
      async create(data) {
        try {
          // Adiciona empresa automaticamente
          const record = {
            ...data,
            empresa: this.getEmpresa(),
            created_at: new Date().toISOString()
          };
          
          const { data: created, error } = await this.client
            .from(this.table)
            .insert([record])
            .select()
            .single();
          
          if (error) throw error;
          
          // Auditoria
          this.logAudit('create', created);
          
          return created;
        } catch (error) {
          console.error(`Erro ao criar ${this.table}:`, error);
          throw error;
        }
      }
      
      // UPDATE - Atualiza registro
      async update(id, data) {
        try {
          const record = {
            ...data,
            updated_at: new Date().toISOString()
          };
          
          const { data: updated, error } = await this.client
            .from(this.table)
            .update(record)
            .eq('id', id)
            .select()
            .single();
          
          if (error) throw error;
          
          // Auditoria
          this.logAudit('update', updated);
          
          return updated;
        } catch (error) {
          console.error(`Erro ao atualizar ${this.table}:`, error);
          throw error;
        }
      }
      
      // UPDATE BY UID - Atualiza por UID (legado)
      async updateByUid(uid, data) {
        try {
          const record = {
            ...data,
            updated_at: new Date().toISOString()
          };
          
          const { data: updated, error } = await this.client
            .from(this.table)
            .update(record)
            .eq('uid', uid)
            .eq('empresa', this.getEmpresa())
            .select()
            .single();
          
          if (error) throw error;
          
          // Auditoria
          this.logAudit('update', updated);
          
          return updated;
        } catch (error) {
          console.error(`Erro ao atualizar ${this.table} por UID:`, error);
          throw error;
        }
      }
      
      // DELETE - Remove registro
      async delete(id) {
        try {
          const { error } = await this.client
            .from(this.table)
            .delete()
            .eq('id', id);
          
          if (error) throw error;
          
          // Auditoria
          this.logAudit('delete', { id });
          
          return true;
        } catch (error) {
          console.error(`Erro ao deletar ${this.table}:`, error);
          return false;
        }
      }
      
      // DELETE BY UID - Remove por UID
      async deleteByUid(uid) {
        try {
          const { error } = await this.client
            .from(this.table)
            .delete()
            .eq('uid', uid)
            .eq('empresa', this.getEmpresa());
          
          if (error) throw error;
          
          // Auditoria
          this.logAudit('delete', { uid });
          
          return true;
        } catch (error) {
          console.error(`Erro ao deletar ${this.table} por UID:`, error);
          return false;
        }
      }
      
      // LOG DE AUDITORIA
      async logAudit(action, details) {
        if (!window.AuditAPI) return;
        
        try {
          await window.AuditAPI.log(`${this.table}_${action}`, details);
        } catch (error) {
          console.warn('Erro ao registrar auditoria:', error);
        }
      }
    }
    
    // ============================================
    // API DE USUÁRIOS
    // ============================================
    
    class UsersAPI extends SupabaseAPI {
      constructor() {
        super('users');
      }
      
      // Lista todos (sem filtro de empresa)
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
      
      // Busca por username
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
      
      // Cria usuário
      async create(userData) {
        try {
          const { data, error } = await this.client
            .from(this.table)
            .insert([{
              username: userData.username.toLowerCase(),
              pass: userData.pass,
              role: userData.role || 'operador',
              perms: userData.perms || {},
              companies: userData.companies || [],
              active: true
            }])
            .select()
            .single();
          
          if (error) throw error;
          
          await this.logAudit('create', { username: data.username });
          
          return data;
        } catch (error) {
          console.error('Erro ao criar usuário:', error);
          throw error;
        }
      }
      
      // Atualiza usuário
      async update(id, patch) {
        try {
          const { data, error } = await this.client
            .from(this.table)
            .update(patch)
            .eq('id', id)
            .select()
            .single();
          
          if (error) throw error;
          
          await this.logAudit('update', { id, changes: Object.keys(patch) });
          
          return data;
        } catch (error) {
          console.error('Erro ao atualizar usuário:', error);
          throw error;
        }
      }
      
      // Remove usuário
      async delete(id) {
        try {
          const { error } = await this.client
            .from(this.table)
            .delete()
            .eq('id', id);
          
          if (error) throw error;
          
          await this.logAudit('delete', { id });
          
          return true;
        } catch (error) {
          console.error('Erro ao deletar usuário:', error);
          return false;
        }
      }
      
      // Altera senha
      async changePassword(id, newPasswordHash) {
        return this.update(id, { pass: newPasswordHash });
      }
    }
    
    // ============================================
    // API DE GERENTES
    // ============================================
    
    class GerentesAPI extends SupabaseAPI {
      constructor() {
        super('gerentes');
      }
      
      // Lista gerentes ativos
      async getAtivos() {
        return this.getAll({ ativo: true });
      }
      
      // Busca por nome
      async getByNome(nome) {
        try {
          const { data, error } = await this.client
            .from(this.table)
            .select('*')
            .eq('empresa', this.getEmpresa())
            .eq('nome', nome)
            .single();
          
          if (error) throw error;
          return data;
        } catch (error) {
          return null;
        }
      }
      
      // Desativa gerente (soft delete)
      async desativar(uid) {
        return this.updateByUid(uid, { ativo: false });
      }
    }
    
    // ============================================
    // API DE DESPESAS
    // ============================================
    
    class DespesasAPI extends SupabaseAPI {
      constructor() {
        super('despesas');
      }
      
      // Busca por período
      async getByPeriodo(dataInicio, dataFim) {
        try {
          const { data, error } = await this.client
            .from(this.table)
            .select('*')
            .eq('empresa', this.getEmpresa())
            .gte('data', dataInicio)
            .lte('data', dataFim)
            .order('data', { ascending: false });
          
          if (error) throw error;
          return data || [];
        } catch (error) {
          console.error('Erro ao buscar despesas por período:', error);
          return [];
        }
      }
      
      // Busca por gerente
      async getByGerente(gerenteNome) {
        return this.getAll({ gerente_nome: gerenteNome });
      }
      
      // Busca despesas não ocultas
      async getVisiveis() {
        return this.getAll({ oculta: false });
      }
      
      // Ocultar despesa
      async ocultar(uid) {
        return this.updateByUid(uid, { oculta: true });
      }
      
      // Mostrar despesa
      async mostrar(uid) {
        return this.updateByUid(uid, { oculta: false });
      }
    }
    
    // ============================================
    // API DE PRESTAÇÕES
    // ============================================
    
    class PrestacoesAPI extends SupabaseAPI {
      constructor() {
        super('prestacoes');
      }
      
      // Busca prestações abertas
      async getAbertas() {
        return this.getAll({ fechada: false });
      }
      
      // Busca prestações fechadas
      async getFechadas() {
        return this.getAll({ fechada: true });
      }
      
      // Busca por gerente
      async getByGerente(gerenteId) {
        return this.getAll({ gerente_id: gerenteId });
      }
      
      // Fechar prestação
      async fechar(uid) {
        return this.updateByUid(uid, { fechada: true });
      }
      
      // Reabrir prestação
      async reabrir(uid) {
        return this.updateByUid(uid, { fechada: false });
      }
      
      // Registrar pagamento
      async registrarPagamento(uid, pagamento) {
        try {
          const prestacao = await this.getByUid(uid);
          if (!prestacao) throw new Error('Prestação não encontrada');
          
          const pagamentos = prestacao.pago || [];
          pagamentos.push({
            ...pagamento,
            data: new Date().toISOString()
          });
          
          return this.updateByUid(uid, { pago: pagamentos });
        } catch (error) {
          console.error('Erro ao registrar pagamento:', error);
          throw error;
        }
      }
    }
    
    // ============================================
    // API DE LANÇAMENTOS FINANCEIROS
    // ============================================
    
    class LancamentosAPI extends SupabaseAPI {
      constructor() {
        super('lancamentos');
      }
      
      // Busca por tipo
      async getByTipo(tipo) {
        return this.getAll({ tipo });
      }
      
      // Busca por categoria
      async getByCategoria(categoria) {
        return this.getAll({ categoria });
      }
      
      // Busca por período
      async getByPeriodo(dataInicio, dataFim) {
        try {
          const { data, error } = await this.client
            .from(this.table)
            .select('*')
            .eq('empresa', this.getEmpresa())
            .gte('data', dataInicio)
            .lte('data', dataFim)
            .order('data', { ascending: false });
          
          if (error) throw error;
          return data || [];
        } catch (error) {
          console.error('Erro ao buscar lançamentos por período:', error);
          return [];
        }
      }
    }
    
    // ============================================
    // API DE FICHAS
    // ============================================
    
    class FichasAPI extends SupabaseAPI {
      constructor() {
        super('fichas');
      }
      
      // Busca área por ficha
      async getAreaByFicha(ficha) {
        try {
          const { data, error } = await this.client
            .from(this.table)
            .select('area')
            .eq('empresa', this.getEmpresa())
            .eq('ficha', ficha)
            .single();
          
          if (error) throw error;
          return data?.area || '';
        } catch (error) {
          return '';
        }
      }
      
      // Define área da ficha (upsert)
      async setArea(ficha, area) {
        try {
          const { data, error } = await this.client
            .from(this.table)
            .upsert({
              empresa: this.getEmpresa(),
              ficha,
              area
            }, {
              onConflict: 'empresa,ficha'
            })
            .select()
            .single();
          
          if (error) throw error;
          return data;
        } catch (error) {
          console.error('Erro ao definir área da ficha:', error);
          throw error;
        }
      }
    }
    
    // ============================================
    // API DE VENDAS
    // ============================================
    
    class VendasAPI extends SupabaseAPI {
      constructor() {
        super('vendas');
      }
      
      // Busca por ficha e mês
      async getByFichaMes(ficha, ym) {
        try {
          const { data, error } = await this.client
            .from(this.table)
            .select('*')
            .eq('empresa', this.getEmpresa())
            .eq('ficha', ficha)
            .eq('ym', ym)
            .single();
          
          if (error) throw error;
          return data;
        } catch (error) {
          return null;
        }
      }
      
      // Salva/atualiza venda (upsert)
      async salvar(venda) {
        try {
          const { data, error } = await this.client
            .from(this.table)
            .upsert({
              ...venda,
              empresa: this.getEmpresa()
            }, {
              onConflict: 'empresa,ficha,ym'
            })
            .select()
            .single();
          
          if (error) throw error;
          return data;
        } catch (error) {
          console.error('Erro ao salvar venda:', error);
          throw error;
        }
      }
    }
    
    // ============================================
    // API DE VALES
    // ============================================
    
    class ValesAPI extends SupabaseAPI {
      constructor() {
        super('vales');
      }
      
      // Busca por gerente
      async getByGerente(gerenteNome) {
        return this.getAll({ gerente_nome: gerenteNome });
      }
      
      // Busca por período
      async getByPeriodo(dataInicio, dataFim) {
        try {
          const { data, error } = await this.client
            .from(this.table)
            .select('*')
            .eq('empresa', this.getEmpresa())
            .gte('data', dataInicio)
            .lte('data', dataFim)
            .order('data', { ascending: false });
          
          if (error) throw error;
          return data || [];
        } catch (error) {
          console.error('Erro ao buscar vales por período:', error);
          return [];
        }
      }
    }
    
    // ============================================
    // API DE SALDO ACUMULADO
    // ============================================
    
    class SaldoAPI extends SupabaseAPI {
      constructor() {
        super('saldo_acumulado');
      }
      
      // Busca saldo do gerente
      async getSaldo(gerenteId) {
        try {
          const { data, error } = await this.client
            .from(this.table)
            .select('saldo')
            .eq('empresa', this.getEmpresa())
            .eq('gerente_id', gerenteId)
            .single();
          
          if (error) throw error;
          return data?.saldo || 0;
        } catch (error) {
          return 0;
        }
      }
      
      // Define saldo do gerente (upsert)
      async setSaldo(gerenteId, saldo) {
        try {
          const { data, error } = await this.client
            .from(this.table)
            .upsert({
              empresa: this.getEmpresa(),
              gerente_id: gerenteId,
              saldo
            }, {
              onConflict: 'empresa,gerente_id'
            })
            .select()
            .single();
          
          if (error) throw error;
          return data;
        } catch (error) {
          console.error('Erro ao definir saldo:', error);
          throw error;
        }
      }
    }
    
    // ============================================
    // API DE AUDITORIA
    // ============================================
    
    class AuditAPI {
      constructor() {
        this.client = supabaseClient;
      }
      
      // Registra log de auditoria
      async log(action, details = {}) {
        try {
          const user = window.UserAuth?.currentUser?.() || {};
          
          const { error } = await this.client
            .from('audit_log')
            .insert([{
              user_id: user.id || null,
              username: user.username || 'sistema',
              empresa: window.getCompany?.() || 'BSX',
              action,
              details,
              user_agent: navigator.userAgent
            }]);
          
          if (error) throw error;
        } catch (error) {
          console.warn('Erro ao registrar auditoria:', error);
        }
      }
      
      // Busca logs
      async getLogs(filters = {}) {
        try {
          let query = this.client
            .from('audit_log')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(filters.limit || 100);
          
          if (filters.username) {
            query = query.eq('username', filters.username);
          }
          
          if (filters.action) {
            query = query.ilike('action', `%${filters.action}%`);
          }
          
          if (filters.startDate) {
            query = query.gte('timestamp', filters.startDate);
          }
          
          if (filters.endDate) {
            query = query.lte('timestamp', filters.endDate);
          }
          
          const { data, error } = await query;
          
          if (error) throw error;
          return data || [];
        } catch (error) {
          console.error('Erro ao buscar logs:', error);
          return [];
        }
      }
    }
    
    // ============================================
    // EXPORTAR API PÚBLICA
    // ============================================
    
    window.SupabaseAPI = {
      users: new UsersAPI(),
      gerentes: new GerentesAPI(),
      despesas: new DespesasAPI(),
      prestacoes: new PrestacoesAPI(),
      lancamentos: new LancamentosAPI(),
      fichas: new FichasAPI(),
      vendas: new VendasAPI(),
      vales: new ValesAPI(),
      saldo: new SaldoAPI(),
      audit: new AuditAPI(),
      
      // Cliente direto para queries customizadas
      client: supabaseClient
    };
    
    // Alias para compatibilidade
    window.API = window.SupabaseAPI;
    window.AuditAPI = window.SupabaseAPI.audit;
    
    console.log('✅ API Supabase carregada com sucesso!');
    console.log('📦 Módulos disponíveis:', Object.keys(window.SupabaseAPI));
    
  })();