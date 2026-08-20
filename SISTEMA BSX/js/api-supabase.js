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
  // API DE PEÇAS — catálogo + estoque
  // ============================================

  class PecasAPI {
    constructor() {
      this.table = 'pecas';
      this.client = supabaseClient;
    }

    async getAll({ ativasApenas = false } = {}) {
      try {
        const empresaId = await getEmpresaId();
        let q = this.client
          .from(this.table)
          .select('*')
          .eq('empresa_id', empresaId)
          .order('nome', { ascending: true });
        if (ativasApenas) q = q.eq('ativo', true);
        const { data, error } = await q;
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.error('[PecasAPI] getAll:', e);
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
        console.error('[PecasAPI] getById:', e);
        return null;
      }
    }

    async getByCodigo(codigo) {
      try {
        const empresaId = await getEmpresaId();
        const { data, error } = await this.client
          .from(this.table)
          .select('*')
          .eq('empresa_id', empresaId)
          .eq('codigo', codigo)
          .maybeSingle();
        if (error) throw error;
        return data;
      } catch (e) {
        console.error('[PecasAPI] getByCodigo:', e);
        return null;
      }
    }

    async create(peca) {
      try {
        const empresaId = await getEmpresaId();
        const payload = { ...peca, empresa_id: empresaId };
        if (!Array.isArray(payload.modelos_compativeis)) payload.modelos_compativeis = [];
        const { data, error } = await this.client
          .from(this.table)
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (e) {
        console.error('[PecasAPI] create:', e);
        throw e;
      }
    }

    async update(id, patch) {
      try {
        const p = { ...patch };
        if (p.modelos_compativeis && !Array.isArray(p.modelos_compativeis)) {
          p.modelos_compativeis = [];
        }
        const { data, error } = await this.client
          .from(this.table)
          .update(p)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (e) {
        console.error('[PecasAPI] update:', e);
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
        console.error('[PecasAPI] delete:', e);
        return false;
      }
    }

    async getEstatisticas() {
      try {
        const empresaId = await getEmpresaId();
        const { data, error } = await this.client
          .from(this.table)
          .select('estoque_atual, estoque_minimo, preco_custo, ativo')
          .eq('empresa_id', empresaId);
        if (error) throw error;
        const stats = {
          total_pecas: 0,
          total_unidades: 0,
          baixo_estoque: 0,
          sem_estoque: 0,
          valor_total_custo: 0
        };
        (data || []).forEach(p => {
          if (!p.ativo) return;
          stats.total_pecas += 1;
          const qtd = Number(p.estoque_atual) || 0;
          stats.total_unidades += qtd;
          stats.valor_total_custo += qtd * (Number(p.preco_custo) || 0);
          if (qtd <= 0) stats.sem_estoque += 1;
          else if (qtd <= (Number(p.estoque_minimo) || 0)) stats.baixo_estoque += 1;
        });
        return stats;
      } catch (e) {
        console.error('[PecasAPI] getEstatisticas:', e);
        return { total_pecas: 0, total_unidades: 0, baixo_estoque: 0, sem_estoque: 0, valor_total_custo: 0 };
      }
    }

    // Aplica um delta atômico no estoque e cria um log em pecas_movimentacoes.
    // delta positivo soma; negativo subtrai. Retorna { peca, movimentacao }.
    async aplicarMovimentacao({
      pecaId,
      delta,
      tipo,                         // 'entrada' | 'saida' | 'ajuste' | 'instalacao' | 'remocao'
      precoUnitario = null,
      maquinaId = null,
      maquinaMovimentacaoId = null,
      motivo = null,
      observacao = null,
      dataEvento = null
    }) {
      if (!pecaId || !delta || !tipo) throw new Error('aplicarMovimentacao: parâmetros incompletos.');

      const empresaId = await getEmpresaId();
      const usuario = window.getUsuarioAtual ? window.getUsuarioAtual() : { id: null, nome: 'Sistema' };

      // Lê saldo atual
      const { data: pecaAtual, error: errGet } = await this.client
        .from(this.table)
        .select('id, estoque_atual, preco_custo, preco_unitario')
        .eq('id', pecaId)
        .single();
      if (errGet) throw errGet;
      if (!pecaAtual) throw new Error('Peça não encontrada.');

      const estoqueAntes = Number(pecaAtual.estoque_atual) || 0;
      const estoqueDepois = estoqueAntes + Number(delta);
      if (estoqueDepois < 0) {
        throw new Error(`Estoque insuficiente: tem ${estoqueAntes}, tentou retirar ${Math.abs(delta)}.`);
      }

      // Atualiza estoque
      const { data: pecaNova, error: errUpd } = await this.client
        .from(this.table)
        .update({ estoque_atual: estoqueDepois })
        .eq('id', pecaId)
        .select()
        .single();
      if (errUpd) throw errUpd;

      // Cria log
      const preco = precoUnitario != null ? Number(precoUnitario) : (Number(pecaAtual.preco_custo) || 0);
      const movPayload = {
        empresa_id: empresaId,
        peca_id: pecaId,
        tipo,
        quantidade: Number(delta),
        estoque_antes: estoqueAntes,
        estoque_depois: estoqueDepois,
        preco_unitario_momento: preco,
        custo_total: +(preco * Math.abs(Number(delta))).toFixed(2),
        maquina_id: maquinaId,
        maquina_movimentacao_id: maquinaMovimentacaoId,
        motivo,
        observacao,
        data_evento: dataEvento || new Date().toISOString().slice(0, 10),
        usuario_id: usuario.id || null,
        usuario_nome: usuario.nome || 'Sistema'
      };
      const { data: mov, error: errMov } = await this.client
        .from('pecas_movimentacoes')
        .insert([movPayload])
        .select()
        .single();
      if (errMov) throw errMov;

      return { peca: pecaNova, movimentacao: mov };
    }
  }


  // ============================================
  // API DE MOVIMENTAÇÕES DE PEÇAS — histórico de estoque
  // ============================================

  class PecasMovimentacoesAPI {
    constructor() {
      this.table = 'pecas_movimentacoes';
      this.client = supabaseClient;
    }

    async getByPeca(pecaId, { limit = 200 } = {}) {
      try {
        const { data, error } = await this.client
          .from(this.table)
          .select('*')
          .eq('peca_id', pecaId)
          .order('created_at', { ascending: false })
          .limit(limit);
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.error('[PecasMovsAPI] getByPeca:', e);
        return [];
      }
    }

    async getByMaquina(maquinaId, { limit = 500 } = {}) {
      try {
        const { data, error } = await this.client
          .from(this.table)
          .select('*')
          .eq('maquina_id', maquinaId)
          .order('created_at', { ascending: false })
          .limit(limit);
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.error('[PecasMovsAPI] getByMaquina:', e);
        return [];
      }
    }

    async getAll(filters = {}) {
      try {
        const empresaId = await getEmpresaId();
        let q = this.client
          .from(this.table)
          .select('*')
          .eq('empresa_id', empresaId);
        if (filters.tipo) q = q.eq('tipo', filters.tipo);
        if (filters.pecaId) q = q.eq('peca_id', filters.pecaId);
        if (filters.maquinaId) q = q.eq('maquina_id', filters.maquinaId);
        if (filters.dataInicio) q = q.gte('data_evento', filters.dataInicio);
        if (filters.dataFim) q = q.lte('data_evento', filters.dataFim);
        const { data, error } = await q.order('created_at', { ascending: false }).limit(filters.limit || 500);
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.error('[PecasMovsAPI] getAll:', e);
        return [];
      }
    }
  }


  // ============================================
  // API DE PEÇAS EM MÁQUINAS — composição/montagem
  // ============================================

  class MaquinasPecasAPI {
    constructor() {
      this.table = 'maquinas_pecas';
      this.client = supabaseClient;
    }

    // Composição ATUAL de uma máquina (peças instaladas, não removidas)
    async getAtuaisByMaquina(maquinaId) {
      try {
        const { data, error } = await this.client
          .from(this.table)
          .select('*')
          .eq('maquina_id', maquinaId)
          .eq('removida', false)
          .order('data_instalacao', { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.error('[MaqPecasAPI] getAtuaisByMaquina:', e);
        return [];
      }
    }

    // Histórico COMPLETO de peças que já passaram pela máquina (incluindo removidas)
    async getHistoricoByMaquina(maquinaId) {
      try {
        const { data, error } = await this.client
          .from(this.table)
          .select('*')
          .eq('maquina_id', maquinaId)
          .order('data_instalacao', { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.error('[MaqPecasAPI] getHistoricoByMaquina:', e);
        return [];
      }
    }

    // Todas as máquinas em que esta peça foi/está instalada
    async getByPeca(pecaId) {
      try {
        const { data, error } = await this.client
          .from(this.table)
          .select('*')
          .eq('peca_id', pecaId)
          .order('data_instalacao', { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.error('[MaqPecasAPI] getByPeca:', e);
        return [];
      }
    }

    async create(payload) {
      try {
        const empresaId = await getEmpresaId();
        const usuario = window.getUsuarioAtual ? window.getUsuarioAtual() : { id: null, nome: 'Sistema' };
        const body = {
          ...payload,
          empresa_id: empresaId,
          usuario_id: payload.usuario_id || usuario.id,
          usuario_nome: payload.usuario_nome || usuario.nome
        };
        const { data, error } = await this.client
          .from(this.table)
          .insert([body])
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (e) {
        console.error('[MaqPecasAPI] create:', e);
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
        console.error('[MaqPecasAPI] update:', e);
        throw e;
      }
    }

    // Marca como removida (soft) e devolve peça ao estoque
    async removerPecaDaMaquina(maquinasPecasId, { motivo = null, observacao = null, devolverAoEstoque = true } = {}) {
      try {
        const { data: linha, error: errGet } = await this.client
          .from(this.table)
          .select('*')
          .eq('id', maquinasPecasId)
          .single();
        if (errGet) throw errGet;
        if (!linha) throw new Error('Vínculo peça-máquina não encontrado.');
        if (linha.removida) throw new Error('Esta peça já foi removida.');

        let movEstoque = null;
        if (devolverAoEstoque) {
          const r = await window.SupabaseAPI.pecas.aplicarMovimentacao({
            pecaId: linha.peca_id,
            delta: +Math.abs(Number(linha.quantidade) || 1),
            tipo: 'remocao',
            maquinaId: linha.maquina_id,
            motivo,
            observacao: observacao || `Removida da máquina (assistência)`
          });
          movEstoque = r.movimentacao;
        }

        const usuario = window.getUsuarioAtual ? window.getUsuarioAtual() : { id: null, nome: 'Sistema' };
        const { data: updated, error: errUpd } = await this.client
          .from(this.table)
          .update({
            removida: true,
            data_remocao: new Date().toISOString().slice(0, 10),
            remocao_motivo: motivo,
            remocao_observacao: observacao,
            remocao_pecas_mov_id: movEstoque?.id || null,
            usuario_nome: usuario.nome || linha.usuario_nome
          })
          .eq('id', maquinasPecasId)
          .select()
          .single();
        if (errUpd) throw errUpd;
        return updated;
      } catch (e) {
        console.error('[MaqPecasAPI] removerPecaDaMaquina:', e);
        throw e;
      }
    }

    // Instala uma peça em uma máquina + debita estoque
    async instalarPecaNaMaquina({ maquinaId, pecaId, quantidade = 1, observacao = null, dataInstalacao = null }) {
      try {
        const peca = await window.SupabaseAPI.pecas.getById(pecaId);
        if (!peca) throw new Error('Peça não encontrada.');
        if ((Number(peca.estoque_atual) || 0) < quantidade) {
          throw new Error(`Estoque insuficiente da peça "${peca.nome}". Disponível: ${peca.estoque_atual}, necessário: ${quantidade}.`);
        }

        const r = await window.SupabaseAPI.pecas.aplicarMovimentacao({
          pecaId,
          delta: -Math.abs(quantidade),
          tipo: 'instalacao',
          maquinaId,
          motivo: 'Instalação em máquina',
          observacao
        });

        const linha = await this.create({
          maquina_id: maquinaId,
          peca_id: pecaId,
          peca_codigo: peca.codigo,
          peca_nome: peca.nome,
          quantidade,
          preco_unitario_momento: Number(peca.preco_unitario) || Number(peca.preco_custo) || 0,
          data_instalacao: dataInstalacao || new Date().toISOString().slice(0, 10),
          instalacao_observacao: observacao,
          instalacao_pecas_mov_id: r.movimentacao?.id || null
        });

        return { peca: r.peca, vinculo: linha, movimentacao: r.movimentacao };
      } catch (e) {
        console.error('[MaqPecasAPI] instalarPecaNaMaquina:', e);
        throw e;
      }
    }
  }


  // ============================================
  // API DE BOBINAS — estoque + movimentações
  // ============================================

  class BobinasAPI {
    constructor() {
      this.table = 'bobinas';
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
      } catch (e) {
        console.error('[BobinasAPI] getAll:', e);
        return [];
      }
    }

    // Retorna a bobina principal da empresa (cria uma se não existir)
    async getOrCreatePrincipal() {
      try {
        const empresaId = await getEmpresaId();
        if (!empresaId) throw new Error('Empresa não encontrada');

        let { data, error } = await this.client
          .from(this.table)
          .select('*')
          .eq('empresa_id', empresaId)
          .eq('ativo', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (error) throw error;

        if (!data) {
          const { data: nova, error: errIns } = await this.client
            .from(this.table)
            .insert([{
              empresa_id: empresaId,
              nome: 'Bobina térmica',
              estoque_atual: 0,
              estoque_minimo: 10
            }])
            .select()
            .single();
          if (errIns) throw errIns;
          data = nova;
        }
        return data;
      } catch (e) {
        console.error('[BobinasAPI] getOrCreatePrincipal:', e);
        return null;
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
        console.error('[BobinasAPI] update:', e);
        throw e;
      }
    }

    async getEstatisticas() {
      try {
        const empresaId = await getEmpresaId();
        const { data, error } = await this.client
          .from(this.table)
          .select('estoque_atual, estoque_minimo, preco_custo, ativo')
          .eq('empresa_id', empresaId);
        if (error) throw error;

        const stats = {
          total_unidades: 0,
          estoque_minimo_total: 0,
          baixo_estoque: false,
          sem_estoque: false,
          valor_total_custo: 0
        };
        (data || []).forEach(b => {
          if (!b.ativo) return;
          const qtd = Number(b.estoque_atual) || 0;
          const min = Number(b.estoque_minimo) || 0;
          stats.total_unidades += qtd;
          stats.estoque_minimo_total += min;
          stats.valor_total_custo += qtd * (Number(b.preco_custo) || 0);
          if (qtd <= 0) stats.sem_estoque = true;
          else if (qtd <= min) stats.baixo_estoque = true;
        });
        return stats;
      } catch (e) {
        console.error('[BobinasAPI] getEstatisticas:', e);
        return { total_unidades: 0, estoque_minimo_total: 0, baixo_estoque: false, sem_estoque: false, valor_total_custo: 0 };
      }
    }

    // Aplica delta no estoque + cria log em bobinas_movimentacoes.
    // Retorna { bobina, movimentacao }.
    async aplicarMovimentacao({
      bobinaId,
      delta,
      tipo,                          // 'entrada' | 'saida' | 'entrega' | 'ajuste'
      precoUnitario = null,
      gerente = null,                // { id, nome, empresa_nome }
      fornecedor = null,
      notaFiscal = null,
      rota = null,                   // rota da entrega (vem das fichas)
      motivo = null,
      observacao = null,
      dataEvento = null
    }) {
      if (!bobinaId || !delta || !tipo) {
        throw new Error('aplicarMovimentacao: parâmetros incompletos.');
      }

      const empresaId = await getEmpresaId();
      const usuario = window.getUsuarioAtual ? window.getUsuarioAtual() : { id: null, nome: 'Sistema' };

      // Lê saldo atual
      const { data: bAtual, error: errGet } = await this.client
        .from(this.table)
        .select('id, estoque_atual, preco_custo')
        .eq('id', bobinaId)
        .single();
      if (errGet) throw errGet;
      if (!bAtual) throw new Error('Bobina não encontrada.');

      const estoqueAntes = Number(bAtual.estoque_atual) || 0;
      const estoqueDepois = estoqueAntes + Number(delta);
      if (estoqueDepois < 0) {
        throw new Error(`Estoque insuficiente: tem ${estoqueAntes}, tentou retirar ${Math.abs(delta)}.`);
      }

      // Atualiza estoque
      const { data: bNova, error: errUpd } = await this.client
        .from(this.table)
        .update({ estoque_atual: estoqueDepois })
        .eq('id', bobinaId)
        .select()
        .single();
      if (errUpd) throw errUpd;

      const preco = precoUnitario != null ? Number(precoUnitario) : (Number(bAtual.preco_custo) || 0);
      const payload = {
        empresa_id: empresaId,
        bobina_id: bobinaId,
        tipo,
        quantidade: Number(delta),
        estoque_antes: estoqueAntes,
        estoque_depois: estoqueDepois,
        preco_unitario_momento: preco,
        custo_total: +(preco * Math.abs(Number(delta))).toFixed(2),
        gerente_id: gerente?.id || null,
        gerente_nome: gerente?.nome || null,
        gerente_empresa: gerente?.empresa_nome || null,
        fornecedor: fornecedor || null,
        nota_fiscal: notaFiscal || null,
        rota: rota || null,
        // ficha vai dentro da observação (não há coluna dedicada para ficha)
        motivo,
        observacao,
        data_evento: dataEvento || new Date().toISOString().slice(0, 10),
        usuario_id: usuario.id || null,
        usuario_nome: usuario.nome || 'Sistema'
      };

      let { data: mov, error: errMov } = await this.client
        .from('bobinas_movimentacoes')
        .insert([payload])
        .select()
        .single();

      // ✅ Fallback: se a coluna `rota` ainda não existe no banco
      // (migração db/bobinas-add-rota.sql não foi aplicada), remove o
      // campo, anexa a rota na observação e tenta de novo. Assim a
      // operação não trava e o usuário consegue continuar trabalhando.
      if (errMov && /'?rota'? column/i.test(errMov.message || '')) {
        console.warn('[BobinasAPI] Coluna `rota` ausente — usando fallback (rota anexada à observação). Rode db/bobinas-add-rota.sql para corrigir.');
        const fb = { ...payload };
        const rotaInfo = fb.rota ? `Rota: ${fb.rota}. ` : '';
        delete fb.rota;
        fb.observacao = (rotaInfo + (fb.observacao || '')).trim();
        const retry = await this.client
          .from('bobinas_movimentacoes')
          .insert([fb])
          .select()
          .single();
        mov = retry.data;
        errMov = retry.error;
      }

      if (errMov) throw errMov;

      return { bobina: bNova, movimentacao: mov };
    }
  }


  // ============================================
  // API DE MOVIMENTAÇÕES DE BOBINAS
  // ============================================
  class BobinasMovimentacoesAPI {
    constructor() {
      this.table = 'bobinas_movimentacoes';
      this.client = supabaseClient;
    }

    async getAll(filters = {}) {
      try {
        const empresaId = await getEmpresaId();
        let q = this.client
          .from(this.table)
          .select('*')
          .eq('empresa_id', empresaId);

        if (filters.tipo) q = q.eq('tipo', filters.tipo);
        if (filters.bobinaId) q = q.eq('bobina_id', filters.bobinaId);
        if (filters.gerenteId) q = q.eq('gerente_id', filters.gerenteId);
        if (filters.dataInicio) q = q.gte('data_evento', filters.dataInicio);
        if (filters.dataFim) q = q.lte('data_evento', filters.dataFim);

        const { data, error } = await q
          .order('created_at', { ascending: false })
          .limit(filters.limit || 500);
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.error('[BobinasMovsAPI] getAll:', e);
        return [];
      }
    }

    async getResumoPorGerente({ dataInicio = null, dataFim = null } = {}) {
      try {
        const empresaId = await getEmpresaId();
        let q = this.client
          .from(this.table)
          .select('gerente_id, gerente_nome, gerente_empresa, quantidade, tipo')
          .eq('empresa_id', empresaId)
          .eq('tipo', 'entrega');
        if (dataInicio) q = q.gte('data_evento', dataInicio);
        if (dataFim) q = q.lte('data_evento', dataFim);

        const { data, error } = await q;
        if (error) throw error;

        const mapa = new Map();
        (data || []).forEach(r => {
          if (!r.gerente_id) return;
          const k = r.gerente_id;
          if (!mapa.has(k)) {
            mapa.set(k, {
              gerente_id: r.gerente_id,
              gerente_nome: r.gerente_nome,
              gerente_empresa: r.gerente_empresa,
              total: 0
            });
          }
          mapa.get(k).total += Math.abs(Number(r.quantidade) || 0);
        });
        return Array.from(mapa.values()).sort((a, b) => b.total - a.total);
      } catch (e) {
        console.error('[BobinasMovsAPI] getResumoPorGerente:', e);
        return [];
      }
    }
  }


  // ============================================
  // EXPORTAR API
  // ============================================

  // ============================================
  // API DE EMPRESAS — cadastro/edição das empresas
  // ============================================
  class EmpresasAPI {
    constructor() {
      this.table = 'empresas';
      this.client = supabaseClient;
    }

    async getAll({ ativasApenas = false } = {}) {
      try {
        let q = this.client.from(this.table).select('*').order('nome');
        if (ativasApenas) q = q.eq('ativo', true);
        const { data, error } = await q;
        if (error) throw error;
        // Atualiza cache global de empresas usado pelos helpers da API
        empresasCache = (data || []).map(e => ({ id: e.id, nome: e.nome }));
        return data || [];
      } catch (e) {
        console.error('[EmpresasAPI] getAll:', e);
        return [];
      }
    }

    // ⛔ Sanity check: escrita só para admin.
    // (A UI já bloqueia via data-perm e via init(), mas quem chamar
    // pelo console também vai bater aqui e falhar cedo. Proteção real
    // do banco deve ser feita via RLS no Supabase.)
    _requireAdmin() {
      const ok = (() => {
        try { return window.UserAuth?.isAdmin?.() === true; } catch(_) { return false; }
      })();
      if (!ok) throw new Error('Somente administradores podem alterar empresas.');
    }

    async create({ nome, emoji, ativo = true }) {
      try {
        this._requireAdmin();
        const nomeLimpo = String(nome || '').trim();
        if (!nomeLimpo) throw new Error('Informe o nome da empresa.');

        // Checa duplicidade (case-insensitive)
        const { data: existing } = await this.client
          .from(this.table).select('id, nome').ilike('nome', nomeLimpo);
        if (existing && existing.length > 0) {
          throw new Error(`Já existe uma empresa com o nome "${existing[0].nome}".`);
        }

        const payload = {
          nome: nomeLimpo,
          emoji: String(emoji || '🏢').slice(0, 8),
          ativo: !!ativo
        };
        const { data, error } = await this.client
          .from(this.table).insert([payload]).select().single();
        if (error) throw error;
        // Invalida cache global
        empresasCache = null;
        console.log('[EmpresasAPI] ✅ Criada:', data.nome);
        return data;
      } catch (e) {
        console.error('[EmpresasAPI] create:', e);
        throw e;
      }
    }

    async update(id, patch) {
      try {
        this._requireAdmin();
        const p = {};
        if (patch.nome !== undefined) p.nome = String(patch.nome).trim();
        if (patch.emoji !== undefined) p.emoji = String(patch.emoji || '🏢').slice(0, 8);
        if (patch.ativo !== undefined) p.ativo = !!patch.ativo;

        const { data, error } = await this.client
          .from(this.table).update(p).eq('id', id).select().single();
        if (error) throw error;
        empresasCache = null;
        return data;
      } catch (e) {
        console.error('[EmpresasAPI] update:', e);
        throw e;
      }
    }

    // Retorna estatísticas para cada empresa
    // { id, nome, emoji, ativo, gerentes_total, gerentes_ativos, gerentes_mensais,
    //   prest_semana_aberta, prest_semana_fechada, prest_mes_aberta, prest_mes_fechada,
    //   maquinas_ativas, maquinas_estoque, maquinas_com_vendedor }
    async getEstatisticas({ semanaIni, semanaFim, mesIni, mesFim } = {}) {
      const client = this.client;
      const hoje = new Date();
      // Semana atual (seg → dom)
      const dow = hoje.getDay() || 7;  // domingo = 7
      const seg = new Date(hoje);  seg.setDate(hoje.getDate() - (dow - 1));
      const dom = new Date(seg);   dom.setDate(seg.getDate() + 6);
      const iso = (d) => d.toISOString().slice(0,10);
      const semIni = semanaIni || iso(seg);
      const semFim = semanaFim || iso(dom);
      // Mês atual
      const y = hoje.getFullYear(), m = hoje.getMonth();
      const primeiro = new Date(y, m, 1);
      const ultimo   = new Date(y, m + 1, 0);
      const mIni = mesIni || iso(primeiro);
      const mFim = mesFim || iso(ultimo);

      try {
        // Carrega todas empresas
        const { data: empresas } = await client
          .from('empresas').select('*').order('nome');
        if (!empresas || !empresas.length) return [];

        const stats = [];
        for (const emp of empresas) {
          const st = {
            id: emp.id, nome: emp.nome,
            emoji: emp.emoji || '🏢', ativo: !!emp.ativo,
            gerentes_total: 0, gerentes_ativos: 0, gerentes_mensais: 0, gerentes_semanais: 0,
            prest_semana_aberta: 0, prest_semana_fechada: 0,
            prest_mes_aberta: 0,    prest_mes_fechada: 0,
            maquinas_total: 0, maquinas_estoque: 0, maquinas_com_vendedor: 0, maquinas_manutencao: 0
          };

          // Gerentes
          try {
            const { data: gers } = await client
              .from('gerentes').select('id, ativo, mensal').eq('empresa_id', emp.id);
            (gers || []).forEach(g => {
              st.gerentes_total++;
              if (g.ativo !== false) st.gerentes_ativos++;
              if (g.mensal) st.gerentes_mensais++;
              else st.gerentes_semanais++;
            });
          } catch(_){}

          // Prestações da semana (por período_ini dentro do intervalo)
          try {
            const { data: pw } = await client
              .from('prestacoes').select('fechada, periodo_ini')
              .eq('empresa_id', emp.id)
              .gte('periodo_ini', semIni).lte('periodo_ini', semFim);
            (pw || []).forEach(p => {
              if (p.fechada) st.prest_semana_fechada++;
              else st.prest_semana_aberta++;
            });
          } catch(_){}

          // Prestações do mês
          try {
            const { data: pm } = await client
              .from('prestacoes').select('fechada, periodo_ini')
              .eq('empresa_id', emp.id)
              .gte('periodo_ini', mIni).lte('periodo_ini', mFim);
            (pm || []).forEach(p => {
              if (p.fechada) st.prest_mes_fechada++;
              else st.prest_mes_aberta++;
            });
          } catch(_){}

          // Máquinas (não crítico se a tabela não existir)
          try {
            const { data: maqs } = await client
              .from('maquinas').select('status, ativo').eq('empresa_id', emp.id);
            (maqs || []).forEach(mq => {
              if (mq.ativo === false) return;
              st.maquinas_total++;
              if (mq.status === 'estoque')      st.maquinas_estoque++;
              if (mq.status === 'com_vendedor') st.maquinas_com_vendedor++;
              if (mq.status === 'manutencao')   st.maquinas_manutencao++;
            });
          } catch(_){}

          stats.push(st);
        }
        return stats;
      } catch (e) {
        console.error('[EmpresasAPI] getEstatisticas:', e);
        return [];
      }
    }

    async delete(id) {
      try {
        this._requireAdmin();
        // Checa dependências antes de deletar
        const checks = [
          { tabela: 'gerentes', label: 'gerentes' },
          { tabela: 'prestacoes', label: 'prestações' },
          { tabela: 'despesas', label: 'despesas' },
          { tabela: 'fichas', label: 'fichas' }
        ];
        for (const c of checks) {
          try {
            const { count } = await this.client
              .from(c.tabela).select('*', { count: 'exact', head: true })
              .eq('empresa_id', id);
            if ((count || 0) > 0) {
              throw new Error(`Não é possível excluir: existem ${count} ${c.label} vinculadas a esta empresa. Inative-a em vez de excluir.`);
            }
          } catch (e) {
            if (e.message?.startsWith('Não é possível excluir')) throw e;
            // se der erro na consulta, ignora e prossegue
          }
        }
        const { error } = await this.client.from(this.table).delete().eq('id', id);
        if (error) throw error;
        empresasCache = null;
        return true;
      } catch (e) {
        console.error('[EmpresasAPI] delete:', e);
        throw e;
      }
    }
  }


  window.SupabaseAPI = {
    usuarios: new UsuariosAPI(),
    gerentes: new GerentesAPI(),
    despesas: new DespesasAPI(),
    prestacoes: new PrestacoesAPI(),
    fichas: new FichasAPI(),
    vendas: new VendasAPI(),
    maquinas: new MaquinasAPI(),
    maquinasMovimentacoes: new MaquinasMovimentacoesAPI(),
    maquinasChips: new MaquinasChipsAPI(),
    pecas: new PecasAPI(),
    pecasMovimentacoes: new PecasMovimentacoesAPI(),
    maquinasPecas: new MaquinasPecasAPI(),
    bobinas: new BobinasAPI(),                                 // ⬅️ NOVA
    bobinasMovimentacoes: new BobinasMovimentacoesAPI(),       // ⬅️ NOVA
    empresas: new EmpresasAPI(),                               // ⬅️ NOVA
    client: supabaseClient
  };

  // Aliases para compatibilidade
  window.SupabaseAPI.users = window.SupabaseAPI.usuarios;

  console.log('✅ API Supabase carregada!');
  console.log('📊 Tabelas: usuarios, gerentes, despesas, prestacoes, fichas, vendas, maquinas, maquinas_movimentacoes, maquinas_chips_historico, pecas, pecas_movimentacoes, maquinas_pecas, bobinas, bobinas_movimentacoes');

})();