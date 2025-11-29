// ============================================
// INICIALIZAÇÃO SUPABASE - CORREÇÃO VERCEL
// ============================================

(function() {
  'use strict';
  
  // Corrigir a chave do Supabase (estava duplicada)
  window.SUPABASE_CONFIG = {
    url: 'https://ttdwmbwiapkjbjbepeza.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0ZHdtYndpYXBramJqYmVwZXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzMjg4NDgsImV4cCI6MjA3ODkwNDg0OH0.NZxm-ZQbQFVceO6yUABKAIj7XY7qN6RXSLi-8NF-BAw'
  };

  // Criar admin automaticamente se não existir
  async function ensureAdminExists() {
    if (!window.supabase) {
      console.error('❌ Supabase não carregado');
      return;
    }

    const client = window.supabase.createClient(
      window.SUPABASE_CONFIG.url,
      window.SUPABASE_CONFIG.key
    );

    try {
      // Verificar se existe algum usuário admin
      const { data: admins } = await client
        .from('usuarios')
        .select('id')
        .eq('role', 'admin')
        .limit(1);

      if (!admins || admins.length === 0) {
        console.log('🔧 Criando usuário admin inicial...');
        
        // Hash da senha "admin123"
        const passwordHash = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';
        
        // Buscar ID da empresa BSX
        let empresa;
        const { data: empresaData } = await client
          .from('empresas')
          .select('id')
          .eq('nome', 'BSX')
          .single();
        
        empresa = empresaData;

        if (!empresa) {
          // Criar empresa BSX se não existir
          const { data: novaEmpresa } = await client
            .from('empresas')
            .insert([{ nome: 'BSX' }])
            .select()
            .single();
          
          empresa = novaEmpresa;
        }

        // Criar usuário admin
        const { data, error } = await client
          .from('usuarios')
          .insert([{
            nome: 'Administrador',
            username: 'admin',
            password: passwordHash,
            role: 'admin',
            empresa_id: empresa.id,
            permissoes: {},
            ativo: true
          }])
          .select()
          .single();

        if (error) {
          console.error('❌ Erro ao criar admin:', error);
        } else {
          console.log('✅ Admin criado com sucesso!');
          console.log('🔑 Use: admin / admin123');
        }
      } else {
        console.log('✅ Admin já existe');
      }
    } catch (error) {
      console.error('❌ Erro na inicialização:', error);
    }
  }

  // Executar quando o DOM carregar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureAdminExists);
  } else {
    ensureAdminExists();
  }
  
  // ===== CARREGAR GERENTES AUTOMATICAMENTE =====
  async function carregarGerentes() {
    try {
      console.log('[Init] 📥 Carregando gerentes...');
      
      if (!window.SupabaseAPI?.gerentes) {
        console.warn('[Init] SupabaseAPI.gerentes não disponível ainda');
        setTimeout(carregarGerentes, 1000);
        return;
      }
      
      const gerentes = await window.SupabaseAPI.gerentes.getAll();
      
      if (Array.isArray(gerentes)) {
        window.gerentes = gerentes.map(g => ({
          id: g.id,           // ✅ CORRIGIDO: UUID do Supabase
          uid: g.uid || g.id, // UID legado
          nome: g.nome || '(sem nome)',
          numero: g.numero || '',
          comissao: Number(g.comissao) || 0,
          comissao2: Number(g.comissao2) || 0,
          comissaoModo: g.comissao_modo || g.comissaoModo || 'simples',
          comissaoPorRotaPositiva: g.comissao_por_rota_positiva || false,
          temSegundaComissao: g.tem_segunda_comissao || false,
          temSaldoAcumulado: g.tem_saldo_acumulado || false,
          baseCalculo: g.base_calculo || g.baseCalculo || 'COLETAS_MENOS_DESPESAS',
          ativo: g.ativo !== false
        }));
        
        console.log(`[Init] ✅ ${window.gerentes.length} gerentes carregados`);
        
        document.dispatchEvent(new CustomEvent('gerentes:loaded', { 
          detail: window.gerentes 
        }));
      }
    } catch (error) {
      console.error('[Init] Erro ao carregar gerentes:', error);
    }
  }
  
  // Carrega gerentes após 1 segundo
  setTimeout(carregarGerentes, 1000);
  
  // Recarrega a cada 30 segundos
  setInterval(carregarGerentes, 30000);
  
  // Função global para forçar reload
  window.recarregarGerentes = carregarGerentes;

})();