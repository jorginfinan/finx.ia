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
        const { data: empresa } = await client
          .from('empresas')
          .select('id')
          .eq('nome', 'BSX')
          .single();

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
          console.log('📝 Use: admin / admin123');
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
})();