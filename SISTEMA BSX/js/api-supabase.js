// API SUPABASE - SIMPLES
(function() {
  'use strict';
  
  class API {
    constructor() {
      this.client = window.supabase;
    }
    
    // GERENTES
    async getGerentes() {
      const { data } = await this.client
        .from('gerentes')
        .select('*')
        .eq('ativo', true)
        .order('nome');
      return data || [];
    }
    
    async saveGerente(gerente) {
      if (gerente.id) {
        // Atualizar
        const { data } = await this.client
          .from('gerentes')
          .update(gerente)
          .eq('id', gerente.id)
          .select()
          .single();
        return data;
      } else {
        // Criar novo
        const { data } = await this.client
          .from('gerentes')
          .insert([gerente])
          .select()
          .single();
        return data;
      }
    }
    
    async deleteGerente(id) {
      await this.client
        .from('gerentes')
        .update({ ativo: false })
        .eq('id', id);
    }
  }
  
  window.API = new API();
  console.log('✅ API carregada');
})();