// ============================================
// GERENTES LOADER - Carrega do Supabase
// ============================================

(function() {
  'use strict';
  
  let gerentesCache = [];
  let lastUpdate = 0;
  const CACHE_TIME = 30000; // 30 segundos
  
  async function loadGerentesFromSupabase() {
    try {
      if (!window.SupabaseAPI?.gerentes) {
        console.warn('[GerentesLoader] SupabaseAPI não disponível ainda');
        return [];
      }
      
      const gerentes = await window.SupabaseAPI.gerentes.getAll();
      
      if (Array.isArray(gerentes)) {
        gerentesCache = gerentes;
        lastUpdate = Date.now();
        window.gerentes = gerentes;
        
        console.log(`[GerentesLoader] ✅ ${gerentes.length} gerentes carregados`);
        
        try {
          const evt = new CustomEvent('gerentes:loaded', { detail: gerentes });
          document.dispatchEvent(evt);
        } catch(e) {}
        
        return gerentes;
      }
      
      return [];
    } catch (error) {
      console.error('[GerentesLoader] Erro ao carregar gerentes:', error);
      return [];
    }
  }
  
  async function getGerenteByUid(uid) {
    const now = Date.now();
    if (now - lastUpdate > CACHE_TIME || gerentesCache.length === 0) {
      await loadGerentesFromSupabase();
    }
    
    const uidStr = String(uid);
    return gerentesCache.find(g => String(g.uid || g.id) === uidStr) || null;
  }
  
  async function reloadGerentes() {
    gerentesCache = [];
    lastUpdate = 0;
    return await loadGerentesFromSupabase();
  }
  
  function init() {
    loadGerentesFromSupabase();
    
    setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadGerentesFromSupabase();
      }
    }, 60000);
    
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastUpdate;
        if (elapsed > CACHE_TIME) {
          loadGerentesFromSupabase();
        }
      }
    });
  }
  
  window.GerentesLoader = {
    load: loadGerentesFromSupabase,
    reload: reloadGerentes,
    getByUid: getGerenteByUid,
    getCache: () => gerentesCache
  };
  
  function waitForSupabase(retries = 50) {
    if (window.SupabaseAPI?.gerentes) {
      init();
      console.log('✅ GerentesLoader inicializado');
      return;
    }
    
    if (retries <= 0) {
      console.error('[GerentesLoader] SupabaseAPI não ficou pronto');
      return;
    }
    
    setTimeout(() => waitForSupabase(retries - 1), 100);
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => waitForSupabase());
  } else {
    waitForSupabase();
  }
})();