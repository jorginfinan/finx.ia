// ============================================
// RAMO DA EMPRESA (JB, Video game, Futebol)
// Elementos com data-ramo="JB" (ou "VG", "FUTEBOL"; vários separados por vírgula)
// só aparecem quando a empresa selecionada é desse ramo.
// Enquanto o ramo não é conhecido (ou o banco ainda não tem a coluna), nada é escondido.
// ============================================
(function () {
  'use strict';
  if (window.RamoEmpresa) return;

  const NOMES = { JB: 'JB', VG: 'Video game', FUTEBOL: 'Futebol' };
  let ramo = null;

  // Classe própria: o RBAC mexe em style.display e não pode desfazer este bloqueio
  const css = document.createElement('style');
  css.textContent = '.ramo-oculto{display:none !important}';
  document.head.appendChild(css);

  function permite(el) {
    const lista = el?.getAttribute?.('data-ramo');
    return !ramo || !lista || lista.split(',').map(s => s.trim()).includes(ramo);
  }

  function aplicar() {
    document.querySelectorAll('[data-ramo]').forEach(el => el.classList.toggle('ramo-oculto', !permite(el)));

    // Grupo do menu cujos itens são todos de outro ramo some inteiro
    document.querySelectorAll('.sb-sub[data-sub]').forEach(sub => {
      const itens = [...sub.querySelectorAll('.sb-subitem')];
      const todos = itens.length > 0 && itens.every(i => i.classList.contains('ramo-oculto'));
      sub.classList.toggle('ramo-oculto', todos);
      document.querySelector(`.sb-group[data-group="${sub.dataset.sub}"]`)?.classList.toggle('ramo-oculto', todos);
    });

    // Página aberta de outro ramo volta para o início
    const aberta = [...document.querySelectorAll('section[data-ramo]')]
      .find(s => !s.classList.contains('hidden') && s.style.display !== 'none');
    if (aberta && !permite(aberta)) window.showPage?.('inicio');
  }

  async function carregar(tentativas = 40) {
    const client = window.SupabaseAPI?.client;
    if (!client) {
      if (tentativas > 0) setTimeout(() => carregar(tentativas - 1), 250);
      return;
    }
    try {
      const nome = String(window.getCompany?.() || 'BSX').toUpperCase();
      const { data, error } = await client.from('empresas').select('nome, ramo');
      if (error) throw error;
      const emp = (data || []).find(e => String(e.nome || '').toUpperCase() === nome);
      ramo = emp ? (NOMES[emp.ramo] ? emp.ramo : 'JB') : null;
    } catch (e) {
      console.warn('[Ramo] Ramo da empresa indisponível; menu completo mantido.', e?.message || e);
      ramo = null;
    }
    aplicar();
  }

  window.RamoEmpresa = { atual: () => ramo, nome: r => NOMES[r] || r || '', permite, aplicar, recarregar: carregar };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => carregar());
  else carregar();
  document.addEventListener('empresa:change', () => carregar());
})();
