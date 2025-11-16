
// empresa-unificado.js - Sistema de Multi-Empresa Corrigido
(function() {
  'use strict';
  
  // Configuração
  const EMPRESA_KEY = 'CURRENT_COMPANY';
  const EMPRESAS = ['BSX', 'BETPLAY', 'EMANUEL'];
  const DEFAULT = 'BSX';
  
  // Bancos que devem ser isolados por empresa
  const BANCOS_ISOLADOS = new Set([
    'bsx_fin_lanc',
    'bsx_gerentes_v2',
    'bsx_despesas_v1',
    'bsx_prest_contas_v1',
    'DB_PREST',                       
    'DB_CAIXA_PEND',              
    'DB_CAIXA_CONF_OK',          
    'bsx_fichas_v1',
    'bsx_ficha_area_v1',
    'bsx_fichas_vendas_v1',
    'bsx_vales_v1',
    'bsx_coletores_v1',
    'bsx_negativos_v1'
  ]);
  
  // Guardar métodos originais do localStorage
  const originalGetItem = localStorage.getItem.bind(localStorage);
  const originalSetItem = localStorage.setItem.bind(localStorage);
  const originalRemoveItem = localStorage.removeItem.bind(localStorage);
  
  // Função para pegar empresa atual
  function getCompany() {
    const empresa = originalGetItem(EMPRESA_KEY) || DEFAULT;
    return empresa.toUpperCase();
  }
  
  // Função para trocar empresa
  function setCompany(empresa) {
    const valor = EMPRESAS.includes(empresa.toUpperCase()) 
      ? empresa.toUpperCase() 
      : DEFAULT;
    
    originalSetItem(EMPRESA_KEY, valor);
    
    // Atualizar interface
    document.documentElement.setAttribute('data-company', valor);
    
    // Disparar evento
    document.dispatchEvent(new CustomEvent('empresa:change', {
      detail: { empresa: valor }
    }));
    
    // Recarregar para aplicar novo namespace
    location.reload();
  }
  
  // Função para adicionar prefixo quando necessário
  function addPrefix(key) {
    // Não prefixar estas chaves
    if (!key) return key;
    if (key === EMPRESA_KEY) return key;
    if (key.includes('__')) return key; // Já tem prefixo
    if (key.startsWith('APP_')) return key; // Sistema de autenticação
    
    // Prefixar apenas bancos da aplicação
    if (BANCOS_ISOLADOS.has(key)) {
      return getCompany() + '__' + key;
    }
    
    return key;
  }
  
  // Substituir métodos do localStorage
  localStorage.getItem = function(key) {
    return originalGetItem(addPrefix(key));
  };
  
  localStorage.setItem = function(key, value) {
    return originalSetItem(addPrefix(key), value);
  };
  
  localStorage.removeItem = function(key) {
    return originalRemoveItem(addPrefix(key));
  };
  
  // API pública
  window.getCompany = getCompany;
  window.setCompany = setCompany;
  
  // Sincronizar com seletores na página
  document.addEventListener('DOMContentLoaded', function() {
    // Atualizar todos os seletores de empresa
    const selectors = document.querySelectorAll('#empresaSelect, [data-company-select]');
    selectors.forEach(select => {
      select.value = getCompany();
      
      select.addEventListener('change', function(e) {
        setCompany(e.target.value);
      });
    });
    
    // Atualizar atributo no HTML
    document.documentElement.setAttribute('data-company', getCompany());
  });
  
  // Migração inicial de dados antigos
  function migrarDadosAntigos() {
    const empresa = getCompany();
    console.log('🔄 Verificando migração de dados para:', empresa);
    
    BANCOS_ISOLADOS.forEach(banco => {
      const chaveAntiga = banco;
      const chaveNova = empresa + '__' + banco;
      
      // Se existe dado antigo e não existe novo, migrar
      if (originalGetItem(chaveAntiga) && !originalGetItem(chaveNova)) {
        const dados = originalGetItem(chaveAntiga);
        originalSetItem(chaveNova, dados);
        console.log('✅ Migrado:', chaveAntiga, '→', chaveNova);
      }
    });
  }
  
  // Executar migração uma vez
  if (!originalGetItem('MIGRACAO_EMPRESA_V2')) {
    migrarDadosAntigos();
    originalSetItem('MIGRACAO_EMPRESA_V2', 'true');
  }
  
  console.log('✅ Sistema de multi-empresa carregado. Empresa atual:', getCompany());
})();
