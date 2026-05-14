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
    console.log('[API] getEmpresaId - nome empresa:', nome);
    // Busca ID da empresa no cache ou faz query
    return getEmpresaIdByNome(nome);
  }
  
  let empresasCache = null;
  
  async function getEmpresaIdByNome(nome) {
    if (!empresasCache) {
      console.log('[API] Buscando empresas do Supabase...');
      const { data, error } = await supabaseClient.from('empresas').select('id, nome');
      if (error) {
        console.error('[API] Erro ao buscar empresas:', error);
      }
      empresasCache = data || [];
      console.log('[API] Empresas encontradas:', empresasCache);
    }
    const emp = empresasCache.find(e => e.nome === nome);
    console.log('[API] Empresa encontrada:', emp);
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
        
        // ✅ SUPORTE A MÚLTIPLAS EMPRESAS
        let companies = [];
        if (Array.isArray(userData.companies) && userData.companies.length > 0) {
          // Normaliza para uppercase
          companies = userData.companies.map(c => String(c).toUpperCase());
        }
        // Se companies vazio, significa acesso a TODAS as empresas
        
        const { data, error } = await this.client
          .from(this.table)
          .insert([{
            nome: userData.nome || userData.username,
            username: userData.username.toLowerCase(),
            password: userData.password,
            role: userData.role || 'operador',
            empresa_id: empresaId,
            permissoes: userData.permissoes || userData.perms || {},
            companies: companies,  // ✅ NOVO: Array de empresas permitidas
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
        // ✅ SUPORTE A MÚLTIPLAS EMPRESAS
        if (Array.isArray(patch.companies)) {
          patch.companies = patch.companies.map(c => String(c).toUpperCase());
        }
        
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
        
        // ✅ CORREÇÃO: Busca em lotes de 1000 para contornar limite do Supabase
        let allData = [];
        let from = 0;
        const batchSize = 1000;
        let hasMore = true;
        
        while (hasMore) {
          const { data, error } = await this.client
            .from(this.table)
            .select('*')
            .eq('empresa_id', empresaId)
            .order('data', { ascending: false })
            .order('uid', { ascending: true })  // sort estável evita registros perdidos na paginação
            .range(from, from + batchSize - 1);
          
          if (error) throw error;
          
          if (data && data.length > 0) {
            allData = allData.concat(data);
            console.log(`[API] 📦 Lote ${Math.floor(from/batchSize) + 1}: +${data.length} despesas (total: ${allData.length})`);
            from += batchSize;
            hasMore = data.length === batchSize; // Continua se recebeu lote cheio
          } else {
            hasMore = false;
          }
        }
        
        console.log('[API] ✅ Total de despesas carregadas:', allData.length);
        
        // Log de uma amostra para debug
        if (allData.length > 0) {
          const amostra = allData.slice(0, 5).map(d => ({
            uid: d.uid,
            descricao: d.descricao,
            oculta: d.oculta,
            tipo: typeof d.oculta
          }));
          console.log('[API] 📋 Amostra (primeiras 5):', amostra);
          
          const ocultasNoBanco = allData.filter(d => d.oculta === true).length;
          console.log('[API] 🚫 Despesas com oculta=true no banco:', ocultasNoBanco);
        }
        
        return allData;
      } catch (error) {
        console.error('[API] ❌ Erro ao buscar despesas:', error);
        return [];
      }
    }
    
    // ✅ CORREÇÃO: Removido gerente_id (coluna não existe na tabela)
    async create(despesa) {
      try {
        const empresaId = await getEmpresaId();
        
        // Mapear campos do JS para Supabase
        const despesaSupabase = {
          uid: despesa.uid,
          ficha: despesa.ficha || '',
          gerente_nome: despesa.gerenteNome || despesa.gerente_nome || '',
          descricao: despesa.info || despesa.descricao || '',
          valor: Number(despesa.valor) || 0,
          data: despesa.data || new Date().toISOString().split('T')[0],
          periodo_ini: despesa.periodoIni || despesa.periodo_ini || null,
          periodo_fim: despesa.periodoFim || despesa.periodo_fim || null,
          oculta: despesa.isHidden || despesa.oculta || false,
          rota: despesa.rota || '',
          categoria: despesa.categoria || '',
          editada: false,
          empresa_id: empresaId,
          prestacao_uid: despesa.prestacao_uid || despesa.prestacaoUid || null
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
    
    // ✅ NOVO: Função upsert para evitar erros de duplicata
    async upsert(despesa) {
      try {
        const empresaId = await getEmpresaId();
        
        const despesaSupabase = {
          uid: despesa.uid,
          ficha: despesa.ficha || '',
          gerente_nome: despesa.gerenteNome || despesa.gerente_nome || '',
          descricao: despesa.info || despesa.descricao || '',
          valor: Number(despesa.valor) || 0,
          data: despesa.data || new Date().toISOString().split('T')[0],
          periodo_ini: despesa.periodoIni || despesa.periodo_ini || null,
          periodo_fim: despesa.periodoFim || despesa.periodo_fim || null,
          oculta: despesa.isHidden || despesa.oculta || false,
          rota: despesa.rota || '',
          categoria: despesa.categoria || '',
          editada: despesa.editada || false,
          empresa_id: empresaId,
          prestacao_uid: despesa.prestacao_uid || despesa.prestacaoUid || null
        };
        
        console.log('[DespesasAPI] 📤 Upsert despesa:', despesaSupabase.uid, despesaSupabase.descricao, 'prest:', despesaSupabase.prestacao_uid);
        
        const { data, error } = await this.client
          .from(this.table)
          .upsert([despesaSupabase], { 
            onConflict: 'uid',
            ignoreDuplicates: false 
          })
          .select()
          .single();
        
        if (error) throw error;
        console.log('[DespesasAPI] ✅ Despesa salva:', despesaSupabase.uid);
        return data;
      } catch (error) {
        console.error('[DespesasAPI] ❌ Erro ao upsert despesa:', error);
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
          patchSupabase.descricao = patch.info || patch.descricao;
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
          patchSupabase.oculta = patch.isHidden !== undefined ? patch.isHidden : patch.oculta;
          console.log('[API] 🔍 Mapeando oculta:', {
            'patch.isHidden': patch.isHidden,
            'patch.oculta': patch.oculta,
            'resultado patchSupabase.oculta': patchSupabase.oculta
          });
        }
        if (patch.rota !== undefined) patchSupabase.rota = patch.rota;
        if (patch.categoria !== undefined) patchSupabase.categoria = patch.categoria;
        if (patch.editada !== undefined) patchSupabase.editada = patch.editada;
        if (patch.prestacao_uid !== undefined || patch.prestacaoUid !== undefined) {
          patchSupabase.prestacao_uid = patch.prestacao_uid || patch.prestacaoUid;
        }
        
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
    
    // ✅ NOVO: Buscar despesas por prestacao_uid (FK direta)
    async getByPrestacaoUid(prestacaoUid) {
      try {
        const empresaId = await getEmpresaId();
        
        const { data, error } = await this.client
          .from(this.table)
          .select('*')
          .eq('empresa_id', empresaId)
          .eq('prestacao_uid', prestacaoUid)
          .order('data', { ascending: true });
        
        if (error) throw error;
        return data || [];
      } catch (error) {
        console.error('[DespesasAPI] Erro getByPrestacaoUid:', error);
        return [];
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
  // API DE FICHAS (CADASTRO UNIVERSAL - TODAS EMPRESAS)
  // ============================================
  
  class FichasAPI {
    constructor() {
      this.table = 'fichas';
      this.client = supabaseClient;
    }
    
    async getAll() {
      try {
        // ✅ CORREÇÃO: Busca em lotes de 1000 para contornar limite do Supabase
        let allData = [];
        let from = 0;
        const batchSize = 1000;
        let hasMore = true;
        
        while (hasMore) {
          const { data, error } = await this.client
            .from(this.table)
            .select('*')
            .order('ficha')
            .range(from, from + batchSize - 1);
          
          if (error) {
            console.error('[FichasAPI] Erro na query:', error);
            throw error;
          }
          
          if (data && data.length > 0) {
            allData = allData.concat(data);
            console.log(`[FichasAPI] 📦 Lote ${Math.floor(from/batchSize) + 1}: +${data.length} fichas (total: ${allData.length})`);
            from += batchSize;
            hasMore = data.length === batchSize;
          } else {
            hasMore = false;
          }
        }
        
        console.log('[FichasAPI] ✅ Total carregadas:', allData.length, 'fichas');
        
        return allData.map(f => ({
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
        ficha = String(ficha || '').trim();
        area = String(area || '').trim();
        if (!ficha) return null;
        
        // Verifica se já existe (por ficha, sem filtro de empresa)
        const { data: existing } = await this.client
          .from(this.table)
          .select('id')
          .eq('ficha', ficha)
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
          // Insert - pega empresa atual só para o insert (se campo for obrigatório)
          const empresaId = await getEmpresaId();
          
          const { data, error } = await this.client
            .from(this.table)
            .insert({
              ficha,
              area,
              empresa_id: empresaId  // Usa empresa atual no insert
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
        // Deleta por ficha (universal)
        const { error } = await this.client
          .from(this.table)
          .delete()
          .eq('ficha', ficha);
        
        if (error) throw error;
        return true;
      } catch (error) {
        console.error('[FichasAPI] Erro delete:', error);
        return false;
      }
    }
  }
  
  // ============================================
  // API DE VENDAS (CADASTRO UNIVERSAL - TODAS EMPRESAS)
  // ============================================
  
  class VendasAPI {
    constructor() {
      this.table = 'vendas';
      this.client = supabaseClient;
    }
    
    async getAll() {
      try {
        // ✅ CORREÇÃO: Busca em lotes de 1000 para contornar limite do Supabase
        let allData = [];
        let from = 0;
        const batchSize = 1000;
        let hasMore = true;
        
        const empresaId = await getEmpresaId();
        
        while (hasMore) {
          const { data, error } = await this.client
            .from(this.table)
            .select('*')
            .eq('empresa_id', empresaId)
            .order('ano_mes', { ascending: false })
            .order('ficha', { ascending: true })  // sort estável evita registros perdidos na paginação
            .range(from, from + batchSize - 1);
          
          if (error) {
            console.error('[VendasAPI] Erro na query:', error);
            throw error;
          }
          
          if (data && data.length > 0) {
            allData = allData.concat(data);
            console.log(`[VendasAPI] 📦 Lote ${Math.floor(from/batchSize) + 1}: +${data.length} vendas (total: ${allData.length})`);
            from += batchSize;
            hasMore = data.length === batchSize;
          } else {
            hasMore = false;
          }
        }
        
        console.log('[VendasAPI] ✅ Total carregadas:', allData.length, 'vendas');
        
        // Mapeia para formato JS (ym, bruta, liquida)
        return allData.map(v => ({
          id: v.uid || v.id,
          ficha: v.ficha,
          ym: v.ano_mes,
          bruta: Number(v.venda_bruta) || 0,
          liquida: Number(v.venda_liquida) || 0
        }));
      } catch (error) {
        console.error('[VendasAPI] Erro getAll:', error);
        return [];
      }
    }
    
    async upsert(venda) {
      const empresaId = await getEmpresaId();
      const uid = venda.id || 'vnd_' + Math.random().toString(36).slice(2, 11);
      const anoMes = venda.ym || venda.ano_mes;
      
      // Verifica se já existe filtrando pela empresa correta
      const { data: existing, error: errCheck } = await this.client
        .from(this.table)
        .select('id, uid')
        .eq('ficha', venda.ficha)
        .eq('ano_mes', anoMes)
        .eq('empresa_id', empresaId)
        .maybeSingle();
      
      if (errCheck) {
        console.error('[VendasAPI] Erro ao verificar existência:', errCheck);
        throw errCheck;
      }
      
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
        
        if (error) {
          console.error('[VendasAPI] Erro ao atualizar venda:', error);
          throw error;
        }
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
        
        if (error) {
          console.error('[VendasAPI] Erro ao inserir venda:', error);
          throw error;
        }
        console.log('[VendasAPI] ✅ Criada:', venda.ficha, anoMes);
        return data;
      }
    }
    
    async delete(id) {
      try {
        // Deleta por uid (universal)
        const { error } = await this.client
          .from(this.table)
          .delete()
          .eq('uid', id);
        
        if (error) throw error;
        return true;
      } catch (error) {
        console.error('[VendasAPI] Erro delete:', error);
        return false;
      }
    }
  }
  
  // ============================================
  // API DE MÁQUINAS — cadastro principal
  // ============================================
  
  class MaquinasAPI {
    constructor() {
      this.table = 'maquinas';
      this.client = supabaseClient;
    }

    // Lista todas as máquinas da empresa atual
    async getAll() {
      try {
        const empresaId = await getEmpresaId();
        const { data, error } = await this.client
          .from(this.table)
          .select('*')
          .eq('empresa_id', empresaId)
          .order('data_entrada', { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.error('[MaquinasAPI] getAll:', e);
        return [];
      }
    }

    // Apenas máquinas no estoque (sem vendedor)
    async getEstoque() {
      try {
        const empresaId = await getEmpresaId();
        const { data, error } = await this.client
          .from(this.table)
          .select('*')
          .eq('empresa_id', empresaId)
          .eq('status', 'estoque')
          .eq('ativo', true)
          .order('data_entrada', { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.error('[MaquinasAPI] getEstoque:', e);
        return [];
      }
    }

    // Apenas máquinas com vendedores
    async getComVendedores() {
      try {
        const empresaId = await getEmpresaId();
        const { data, error } = await this.client
          .from(this.table)
          .select('*')
          .eq('empresa_id', empresaId)
          .eq('status', 'com_vendedor')
          .eq('ativo', true)
          .order('gerente_atual_nome');
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.error('[MaquinasAPI] getComVendedores:', e);
        return [];
      }
    }

    // Máquinas de um gerente específico (raro mas pode acontecer ter mais de uma)
    async getByGerente(gerenteId) {
      try {
        const empresaId = await getEmpresaId();
        const { data, error } = await this.client
          .from(this.table)
          .select('*')
          .eq('empresa_id', empresaId)
          .eq('gerente_atual_id', gerenteId)
          .eq('status', 'com_vendedor');
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.error('[MaquinasAPI] getByGerente:', e);
        return [];
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
      } catch (e) {
        console.error('[MaquinasAPI] getById:', e);
        return null;
      }
    }

    async getBySerial(serial) {
      try {
        const empresaId = await getEmpresaId();
        const { data, error } = await this.client
          .from(this.table)
          .select('*')
          .eq('empresa_id', empresaId)
          .eq('serial', serial)
          .maybeSingle();
        if (error) throw error;
        return data;
      } catch (e) {
        console.error('[MaquinasAPI] getBySerial:', e);
        return null;
      }
    }

    async create(maquina) {
      try {
        const empresaId = await getEmpresaId();
        const { data, error } = await this.client
          .from(this.table)
          .insert([{ ...maquina, empresa_id: empresaId }])
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (e) {
        console.error('[MaquinasAPI] create:', e);
        throw e;
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
      } catch (e) {
        console.error('[MaquinasAPI] update:', e);
        throw e;
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
      } catch (e) {
        console.error('[MaquinasAPI] delete:', e);
        return false;
      }
    }

    // Estatísticas para o dashboard de estoque
    async getEstatisticas() {
      try {
        const empresaId = await getEmpresaId();
        const { data, error } = await this.client
          .from(this.table)
          .select('status')
          .eq('empresa_id', empresaId)
          .eq('ativo', true);
        if (error) throw error;
        const stats = {
          total: data?.length || 0,
          estoque: 0,
          com_vendedor: 0,
          manutencao: 0,
          baixada: 0
        };
        (data || []).forEach(m => {
          if (stats[m.status] !== undefined) stats[m.status]++;
        });
        return stats;
      } catch (e) {
        console.error('[MaquinasAPI] getEstatisticas:', e);
        return { total: 0, estoque: 0, com_vendedor: 0, manutencao: 0, baixada: 0 };
      }
    }
  }


  // ============================================
  // API DE MOVIMENTAÇÕES — histórico completo de cada máquina
  // ============================================
  
  class MaquinasMovimentacoesAPI {
    constructor() {
      this.table = 'maquinas_movimentacoes';
      this.client = supabaseClient;
    }

    // Histórico completo de uma máquina específica
    async getByMaquina(maquinaId) {
      try {
        const { data, error } = await this.client
          .from(this.table)
          .select('*')
          .eq('maquina_id', maquinaId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.error('[MovsAPI] getByMaquina:', e);
        return [];
      }
    }

    // Todas movimentações da empresa (com filtros opcionais)
    async getAll(filters = {}) {
      try {
        const empresaId = await getEmpresaId();
        let query = this.client
          .from(this.table)
          .select('*')
          .eq('empresa_id', empresaId);

        if (filters.tipo) query = query.eq('tipo', filters.tipo);
        if (filters.gerenteId) query = query.eq('gerente_id', filters.gerenteId);
        if (filters.ficha) query = query.eq('ficha', filters.ficha);
        if (filters.maquinaId) query = query.eq('maquina_id', filters.maquinaId);
        if (filters.dataInicio) query = query.gte('data_evento', filters.dataInicio);
        if (filters.dataFim) query = query.lte('data_evento', filters.dataFim);

        const { data, error } = await query.order('created_at', { ascending: false }).limit(500);
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.error('[MovsAPI] getAll:', e);
        return [];
      }
    }

    async create(movimentacao) {
      try {
        const empresaId = await getEmpresaId();
        const usuario = window.getUsuarioAtual ? window.getUsuarioAtual() : { id: null, nome: 'Sistema' };
        const payload = {
          ...movimentacao,
          empresa_id: empresaId,
          usuario_id: movimentacao.usuario_id || usuario.id,
          usuario_nome: movimentacao.usuario_nome || usuario.nome
        };
        const { data, error } = await this.client
          .from(this.table)
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (e) {
        console.error('[MovsAPI] create:', e);
        throw e;
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
      } catch (e) {
        console.error('[MovsAPI] delete:', e);
        return false;
      }
    }
  }


  // ============================================
  // API DE HISTÓRICO DE CHIPS — rastreamento independente
  // ============================================
  
  class MaquinasChipsAPI {
    constructor() {
      this.table = 'maquinas_chips_historico';
      this.client = supabaseClient;
    }

    // Histórico de um chip específico (onde já esteve)
    async getByChip(numeroChip) {
      try {
        const empresaId = await getEmpresaId();
        const { data, error } = await this.client
          .from(this.table)
          .select('*')
          .eq('empresa_id', empresaId)
          .eq('numero_chip', numeroChip)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.error('[ChipsAPI] getByChip:', e);
        return [];
      }
    }

    async getAll() {
      try {
        const empresaId = await getEmpresaId();
        const { data, error } = await this.client
          .from(this.table)
          .select('*')
          .eq('empresa_id', empresaId)
          .order('created_at', { ascending: false })
          .limit(1000);
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.error('[ChipsAPI] getAll:', e);
        return [];
      }
    }

    async create(registro) {
      try {
        const empresaId = await getEmpresaId();
        const usuario = window.getUsuarioAtual ? window.getUsuarioAtual() : { id: null, nome: 'Sistema' };
        const payload = {
          ...registro,
          empresa_id: empresaId,
          usuario_id: registro.usuario_id || usuario.id,
          usuario_nome: registro.usuario_nome || usuario.nome
        };
        const { data, error } = await this.client
          .from(this.table)
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (e) {
        console.error('[ChipsAPI] create:', e);
        throw e;
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
    maquinas: new MaquinasAPI(),                              // ⬅️ NOVA
    maquinasMovimentacoes: new MaquinasMovimentacoesAPI(),    // ⬅️ NOVA
    maquinasChips: new MaquinasChipsAPI(),                    // ⬅️ NOVA
    client: supabaseClient
  };
  
  // Aliases para compatibilidade
  window.SupabaseAPI.users = window.SupabaseAPI.usuarios;
  
  console.log('✅ API Supabase carregada!');
  console.log('📊 Tabelas: usuarios, gerentes, despesas, prestacoes, fichas, vendas, maquinas, maquinas_movimentacoes, maquinas_chips_historico');
  
})();