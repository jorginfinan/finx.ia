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
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0ZHdtYndpYXBramJqYmVwZXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzMjg4NDgsImV4cCI6MjA3ODkwNDg0OH0.NZxm-ZQbQFVceO6yUABKAIj7XY7qN6RXSLi-8NF-BAw'
    
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
          console.log('[API] 📥 Buscando despesas da empresa:', empresaId);
          
          const { data, error } = await this.client
            .from(this.table)
            .select('*')
            .eq('empresa_id', empresaId)
            .order('data', { ascending: false });
          
          if (error) throw error;
          
          console.log('[API] 📦 Recebidas', data?.length, 'despesas do Supabase');
          
          // Log de uma amostra para debug
          if (data && data.length > 0) {
            const amostra = data.slice(0, 5).map(d => ({
              uid: d.uid,
              descricao: d.descricao,
              oculta: d.oculta,
              tipo: typeof d.oculta
            }));
            console.log('[API] 📋 Amostra (primeiras 5):', amostra);
            
            const ocultasNoBanco = data.filter(d => d.oculta === true).length;
            console.log('[API] 🚫 Despesas com oculta=true no banco:', ocultasNoBanco);
          }
          
          return data || [];
        } catch (error) {
          console.error('[API] ❌ Erro ao buscar despesas:', error);
          return [];
        }
      }
      
      async create(despesa) {
        try {
          const empresaId = await getEmpresaId();
          
          // Mapear campos do JS para Supabase
          const despesaSupabase = {
            uid: despesa.uid,
            ficha: despesa.ficha || '',
            gerente_id: despesa.gerenteId || null,
            gerente_nome: despesa.gerenteNome || despesa.gerente_nome || '',
            descricao: despesa.info || despesa.descricao || '', // info → descricao
            valor: Number(despesa.valor) || 0,
            data: despesa.data || new Date().toISOString().split('T')[0],
            periodo_ini: despesa.periodoIni || despesa.periodo_ini || null,
            periodo_fim: despesa.periodoFim || despesa.periodo_fim || null,
            oculta: despesa.isHidden || despesa.oculta || false, // isHidden → oculta
            rota: despesa.rota || '',
            categoria: despesa.categoria || '',
            editada: false,
            empresa_id: empresaId
          };
          
          const { data, error } = await this.client
            .from(this.table)
            .insert([despesaSupabase])
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
          
          console.log('[API] 📝 updateByUid recebeu:', {
            uid,
            patch,
            empresaId
          });
          
          // Mapear campos do JS para Supabase
          const patchSupabase = {};
          
          if (patch.ficha !== undefined) patchSupabase.ficha = patch.ficha;
          if (patch.gerenteNome !== undefined || patch.gerente_nome !== undefined) {
            patchSupabase.gerente_nome = patch.gerenteNome || patch.gerente_nome;
          }
          if (patch.info !== undefined || patch.descricao !== undefined) {
            patchSupabase.descricao = patch.info || patch.descricao; // info → descricao
          }
          if (patch.valor !== undefined) patchSupabase.valor = Number(patch.valor);
          if (patch.data !== undefined) patchSupabase.data = patch.data;
          if (patch.periodoIni !== undefined || patch.periodo_ini !== undefined) {
            patchSupabase.periodo_ini = patch.periodoIni || patch.periodo_ini;
          }
          if (patch.periodoFim !== undefined || patch.periodo_fim !== undefined) {
            patchSupabase.periodo_fim = patch.periodoFim || patch.periodo_fim;
          }
          if (patch.isHidden !== undefined || patch.oculta !== undefined) {
            patchSupabase.oculta = patch.isHidden !== undefined ? patch.isHidden : patch.oculta; // isHidden → oculta
            console.log('[API] 🔍 Mapeando oculta:', {
              'patch.isHidden': patch.isHidden,
              'patch.oculta': patch.oculta,
              'resultado patchSupabase.oculta': patchSupabase.oculta
            });
          }
          if (patch.rota !== undefined) patchSupabase.rota = patch.rota;
          if (patch.categoria !== undefined) patchSupabase.categoria = patch.categoria;
          if (patch.editada !== undefined) patchSupabase.editada = patch.editada;
          
          console.log('[API] 📤 Enviando para Supabase:', patchSupabase);
          
          const { data, error } = await this.client
            .from(this.table)
            .update(patchSupabase)
            .eq('uid', uid)
            .eq('empresa_id', empresaId)
            .select()
            .single();
          
          if (error) throw error;
          
          console.log('[API] ✅ Supabase retornou:', {
            uid: data.uid,
            descricao: data.descricao,
            oculta: data.oculta,
            'TIPO de oculta': typeof data.oculta
          });
          
          return data;
        } catch (error) {
          console.error('[API] ❌ Erro ao atualizar despesa:', error);
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
          console.error('Erro ao deletar despesa:', error);
          return false;
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
    // API DE FICHAS
    // ============================================
    
    class FichasAPI {
      constructor() {
        this.table = 'fichas';
        this.client = supabaseClient;
      }
      
      async getAll() {
        try {
          const empresaId = await getEmpresaId();
          if (!empresaId) {
            console.warn('[FichasAPI] empresa_id não encontrado');
            return [];
          }
          
          const { data, error } = await this.client
            .from(this.table)
            .select('*')
            .eq('empresa_id', empresaId)
            .order('ficha');
          
          if (error) throw error;
          return (data || []).map(f => ({
            ficha: f.ficha,
            area: f.area || ''
          }));
        } catch (error) {
          console.error('[FichasAPI] Erro getAll:', error);
          return [];
        }
      }
      
      async upsert(ficha, area) {
        try {
          const empresaId = await getEmpresaId();
          if (!empresaId) {
            console.warn('[FichasAPI] empresa_id não encontrado');
            return null;
          }
          
          ficha = String(ficha || '').trim();
          area = String(area || '').trim();
          if (!ficha) return null;
          
          // Verifica se já existe
          const { data: existing } = await this.client
            .from(this.table)
            .select('id')
            .eq('ficha', ficha)
            .eq('empresa_id', empresaId)
            .maybeSingle();
          
          if (existing) {
            // Update
            const { data, error } = await this.client
              .from(this.table)
              .update({ area })
              .eq('id', existing.id)
              .select()
              .single();
            
            if (error) throw error;
            console.log('[FichasAPI] ✅ Atualizada:', ficha);
            return data;
          } else {
            // Insert
            const { data, error } = await this.client
              .from(this.table)
              .insert({
                ficha,
                area,
                empresa_id: empresaId
              })
              .select()
              .single();
            
            if (error) throw error;
            console.log('[FichasAPI] ✅ Criada:', ficha);
            return data;
          }
        } catch (error) {
          console.error('[FichasAPI] Erro upsert:', error);
          return null;
        }
      }
      
      async delete(ficha) {
        try {
          const empresaId = await getEmpresaId();
          if (!empresaId) return false;
          
          const { error } = await this.client
            .from(this.table)
            .delete()
            .eq('ficha', ficha)
            .eq('empresa_id', empresaId);
          
          if (error) throw error;
          return true;
        } catch (error) {
          console.error('[FichasAPI] Erro delete:', error);
          return false;
        }
      }
    }
    
    // ============================================
    // API DE VENDAS
    // ============================================
    
    class VendasAPI {
      constructor() {
        this.table = 'vendas';
        this.client = supabaseClient;
      }
      
      async getAll() {
        try {
          const empresaId = await getEmpresaId();
          if (!empresaId) {
            console.warn('[VendasAPI] empresa_id não encontrado');
            return [];
          }
          
          const { data, error } = await this.client
            .from(this.table)
            .select('*')
            .eq('empresa_id', empresaId)
            .order('ano_mes', { ascending: false });
          
          if (error) throw error;
          
          // Mapeia para formato JS (ym, bruta, liquida)
          return (data || []).map(v => ({
            id: v.uid || v.id,
            ficha: v.ficha,
            ym: v.ano_mes,           // ano_mes → ym
            bruta: Number(v.venda_bruta) || 0,    // venda_bruta → bruta
            liquida: Number(v.venda_liquida) || 0  // venda_liquida → liquida
          }));
        } catch (error) {
          console.error('[VendasAPI] Erro getAll:', error);
          return [];
        }
      }
      
      async upsert(venda) {
        try {
          const empresaId = await getEmpresaId();
          if (!empresaId) {
            console.warn('[VendasAPI] empresa_id não encontrado');
            return null;
          }
          
          const uid = venda.id || 'vnd_' + Math.random().toString(36).slice(2, 11);
          const anoMes = venda.ym || venda.ano_mes;
          
          // Verifica se já existe
          const { data: existing } = await this.client
            .from(this.table)
            .select('id, uid')
            .eq('ficha', venda.ficha)
            .eq('ano_mes', anoMes)
            .eq('empresa_id', empresaId)
            .maybeSingle();
          
          if (existing) {
            // Update
            const { data, error } = await this.client
              .from(this.table)
              .update({
                venda_bruta: Number(venda.bruta) || 0,
                venda_liquida: Number(venda.liquida) || 0
              })
              .eq('id', existing.id)
              .select()
              .single();
            
            if (error) throw error;
            console.log('[VendasAPI] ✅ Atualizada:', venda.ficha, anoMes);
            return data;
          } else {
            // Insert
            const { data, error } = await this.client
              .from(this.table)
              .insert({
                uid,
                ficha: venda.ficha,
                ano_mes: anoMes,
                venda_bruta: Number(venda.bruta) || 0,
                venda_liquida: Number(venda.liquida) || 0,
                empresa_id: empresaId
              })
              .select()
              .single();
            
            if (error) throw error;
            console.log('[VendasAPI] ✅ Criada:', venda.ficha, anoMes);
            return data;
          }
        } catch (error) {
          console.error('[VendasAPI] Erro upsert:', error);
          return null;
        }
      }
      
      async delete(id) {
        try {
          const empresaId = await getEmpresaId();
          if (!empresaId) return false;
          
          const { error } = await this.client
            .from(this.table)
            .delete()
            .eq('uid', id)
            .eq('empresa_id', empresaId);
          
          if (error) throw error;
          return true;
        } catch (error) {
          console.error('[VendasAPI] Erro delete:', error);
          return false;
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
      fichas: new FichasAPI(),
      vendas: new VendasAPI(),
      client: supabaseClient
    };
    
    // Aliases para compatibilidade
    window.SupabaseAPI.users = window.SupabaseAPI.usuarios;
    
    console.log('✅ API Supabase carregada!');
    console.log('📊 Tabelas: usuarios, gerentes, despesas, prestacoes, fichas, vendas');
    
  })();