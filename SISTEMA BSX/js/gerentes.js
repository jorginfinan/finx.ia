(function(){
  'use strict';
  
  // ============================================
  // PROTEÇÃO CONTRA MÚLTIPLO CARREGAMENTO
  // ============================================
  if (window.__GERENTES_LOADED__) {
    console.warn('[Gerentes] Já carregado, ignorando...');
    return;
  }
  window.__GERENTES_LOADED__ = true;
  
  let __saving = false;
  let __savingTimeout = null;
  let __submitting = false;

  const uidFn = (typeof window.uid === 'function')
    ? window.uid
    : function() { return 'g_'+Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4); };

  // ============================================
  // LEITURA - Apenas Supabase
  // ============================================
  async function read() {
    try {
      const arr = await window.SupabaseAPI.gerentes.getAtivos();
      return Array.isArray(arr) ? arr : [];
    } catch (error) {
      console.error('[Gerentes] Erro ao carregar:', error);
      return [];
    }
  }
  
  // ============================================
  // SUBMIT - Apenas Supabase
  // ============================================
  async function onSubmit(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    if (__saving || __submitting) {
      console.warn('[Gerentes] ⚠️ Já está salvando, aguarde...');
      return false;
    }
    
    __submitting = true;
    const form = e.currentTarget;
    const btn = form.querySelector('#btnSalvarGerente');
    
    __saving = true;
    if (btn) btn.disabled = true;
    
    try {
      const fd = new FormData(form);
      const uidEditing = (form.dataset.editingUid || '').trim();
      
      const nome = String(fd.get('nome')||'').trim();
      const numero = String(fd.get('numero')||'').trim();
      
      if (!nome) throw new Error('Informe o nome do gerente.');
      if (!numero) throw new Error('Informe o número do gerente.');
      
      const temSegundaComissao = !!fd.get('temSegundaComissao');
      const comissao2Value = Number(fd.get('comissao2') || 0);
      
      if (temSegundaComissao && !comissao2Value) {
        throw new Error('Informe o valor da 2ª comissão.');
      }
      
      const comissaoPorRotaPositiva = !!fd.get('comissaoPorRotaPositiva');
      
      const g = {
        nome,
        comissao: Number(fd.get('comissao')||0) || 0,
        numero,
        endereco: String(fd.get('endereco')||'').trim(),
        telefone: String(fd.get('telefone')||'').trim(),
        email: String(fd.get('email')||'').trim(),
        obs: String(fd.get('obs')||'').trim(),
        observacoes: String(fd.get('obs')||'').trim(),
        base_calculo: comissaoPorRotaPositiva ? 'COLETAS' : String(fd.get('baseCalculo') || 'COLETAS_MENOS_DESPESAS').toUpperCase().replace(/-/g, '_'),
        comissao_por_rota_positiva: comissaoPorRotaPositiva,
        tem_segunda_comissao: temSegundaComissao,
        comissao2: temSegundaComissao ? comissao2Value : 0
      };
      
      console.log('[Gerentes] Salvando:', uidEditing ? 'EDIÇÃO' : 'NOVO');
      
      if (uidEditing) {
        await window.SupabaseAPI.gerentes.updateByUid(uidEditing, g);
      } else {
        g.uid = uidFn();
        await window.SupabaseAPI.gerentes.create(g);
      }
      
      form.reset();
      form.removeAttribute('data-editing-uid');
      delete form.dataset.editingUid;
      
      await render();
      
      window.showNotification('Gerente salvo com sucesso!', 'success');
      
      if (typeof window.AuditLog !== 'undefined') {
        window.AuditLog.log(uidEditing ? 'gerente_editado' : 'gerente_criado', {
          id: g.uid,
          nome: g.nome,
          numero: g.numero
        });
      }
      
    } catch (error) {
      console.error('[Gerentes] ❌ Erro ao salvar:', error);
      window.showNotification(error.message || 'Erro ao salvar', 'error');
    } finally {
      __savingTimeout = setTimeout(function() {
        __saving = false;
        __submitting = false;
        if (btn) btn.disabled = false;
        __savingTimeout = null;
      }, 500);
    }
  }
  
  // ============================================
  // RENDER
  // ============================================
  async function render() {
    let arr = [];
  
    try {
      arr = await read();
    } catch (e) {
      console.error('[Gerentes] Erro ao renderizar:', e);
      arr = [];
    }
  
    if (!Array.isArray(arr)) {
      console.warn('[Gerentes] Resposta não é array:', arr);
      arr = [];
    }
  
    arr.sort(function(a,b) {
      return String(a.nome||'').localeCompare(String(b.nome||''));
    });
  
    const tb = document.getElementById('tbodyGerentes');
    if (tb){
      tb.innerHTML = arr.length ? arr.map(function(g) {
        const com = (Number(g.comissao)||0).toFixed(0);
        const com2 = g.tem_segunda_comissao ? (' + ' + (Number(g.comissao2)||0).toFixed(0) + '%') : '';
        return '<tr data-context="gerentes" data-uid="' + g.uid + '">' +
          '<td>' + esc(g.nome) + '</td>' +
          '<td>' + esc(g.numero||'') + '</td>' +
          '<td>' + esc(g.endereco||'') + '</td>' +
          '<td>' + esc(g.telefone||'') + '</td>' +
          '<td>' + esc(g.email||'') + '</td>' +
          '<td>' + com + '%' + com2 + '</td>' +
          '<td>' + esc(g.obs||'') + '</td>' +
          '<td class="tv-right">' +
            '<button type="button" class="btn btn-gerente-edit" data-edit-gerente="' + g.uid + '">EDITAR</button> ' +
            '<button type="button" class="btn danger btn-gerente-del" data-del-gerente="' + g.uid + '">EXCLUIR</button>' +
          '</td>' +
        '</tr>';
      }).join('') : '<tr><td colspan="8">Nenhum gerente cadastrado.</td></tr>';
    }
  
    const dl = document.getElementById('listGerentes');
    if (dl){
      dl.innerHTML = arr.map(function(g) { 
        return '<option value="' + esc(g.nome) + '"></option>'; 
      }).join('');
    }
  }

  function esc(s) {
    const map = {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
      "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;'
    };
    return String(s ?? '').replace(/[&<>"'`=\/]/g, function(m) { return map[m]; });
  }

  if (typeof window.showNotification !== 'function') {
    window.showNotification = function(message, type) {
      type = type || 'info';
      const notification = document.createElement('div');
      notification.className = 'notification notification-' + type;
      notification.textContent = message;
      notification.style.cssText = 
        'position: fixed; top: 20px; right: 20px; padding: 12px 20px;' +
        'background: ' + (type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3') + ';' +
        'color: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);' +
        'z-index: 10000; animation: slideIn 0.3s ease;';
      document.body.appendChild(notification);
      setTimeout(function() {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(function() { notification.remove(); }, 300);
      }, 3000);
    };
  }

  // ============================================
  // CLICK NA TABELA
  // ============================================
  async function onTableClick(e){
    const target = e.target;
    
    const btnDel  = target.closest('[data-del-gerente]');
    const btnEdit = target.closest('[data-edit-gerente]');
    
    if (!btnDel && !btnEdit) return;
    
    const tbody = target.closest('#tbodyGerentes');
    if (!tbody) return;
    
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const uid = (btnDel||btnEdit).getAttribute('data-del-gerente') || 
                (btnEdit||btnDel).getAttribute('data-edit-gerente');
    if (!uid) return;
    
    console.log('[Gerentes] Ação:', btnDel ? 'EXCLUIR' : 'EDITAR', 'UID:', uid);
    
    const arr = await read();
    const g   = arr.find(function(x) { return x.uid === uid; });
    
    if (!g) {
      alert('Gerente não encontrado.');
      return;
    }

    if (btnDel){
      if (!confirm('Excluir o gerente "' + g.nome + '"?')) return;
      
      try {
        await window.SupabaseAPI.gerentes.deleteByUid(uid);
        await render();
        window.showNotification('Gerente excluído!', 'success');
        
        if (typeof window.AuditLog !== 'undefined') {
          window.AuditLog.log('gerente_excluido', {
            id: uid,
            nome: g.nome
          });
        }
      } catch (error) {
        console.error('[Gerentes] Erro ao excluir:', error);
        window.showNotification('Erro ao excluir', 'error');
      }
      
      return;
    }

    if (btnEdit){
      const f = document.getElementById('formGerente');
      if (!f) return;

      f.dataset.editingUid = g.uid;

      const setVal = function(name, val) {
        const el = f.querySelector('[name="' + name + '"]');
        if (el) el.value = val || '';
      };

      setVal('nome', g.nome);
      setVal('comissao', String(Number(g.comissao) || 0));
      setVal('numero', g.numero);
      setVal('endereco', g.endereco);
      setVal('telefone', g.telefone);
      setVal('email', g.email);
      setVal('obs', g.obs || g.observacoes);

      const baseCalcEl = f.querySelector('[name="baseCalculo"]');
      if (baseCalcEl) {
        const baseCalc = (g.base_calculo || 'COLETAS_MENOS_DESPESAS').toLowerCase().replace(/_/g, '-');
        baseCalcEl.value = baseCalc;
      }

      const rotaPosEl = f.querySelector('[name="comissaoPorRotaPositiva"]');
      if (rotaPosEl) rotaPosEl.checked = !!g.comissao_por_rota_positiva;

      const tem2ComEl = f.querySelector('[name="temSegundaComissao"]');
      if (tem2ComEl) tem2ComEl.checked = !!g.tem_segunda_comissao;

      const com2El = f.querySelector('[name="comissao2"]');
      if (com2El) com2El.value = String(Number(g.comissao2) || 0);

      f.scrollIntoView({ behavior:'smooth', block:'center' });
      
      const firstInput = f.querySelector('input[name="nome"]');
      if (firstInput) {
        setTimeout(function() { firstInput.focus(); }, 300);
      }
    }
  }

  // ============================================
  // INICIALIZAÇÃO
  // ============================================
  function init(){
    const form = document.getElementById('formGerente');
    if (form && !form.__wired_gerentes){
      form.__wired_gerentes = true;
      form.addEventListener('submit', onSubmit);
      console.log('[Gerentes] ✅ Submit registrado');
    }

    const tb = document.getElementById('tbodyGerentes');
    if (tb && !tb.__wired_gerentes){
      tb.__wired_gerentes = true;
      tb.addEventListener('click', onTableClick, true);
      console.log('[Gerentes] ✅ Click registrado');
    }

    document.addEventListener('empresa:change', render);

    render();
  }

  const btnLimpar = document.getElementById('btnLimparGerente');
  if (btnLimpar && !btnLimpar.__wired) {
    btnLimpar.__wired = true;
    btnLimpar.addEventListener('click', function() {
      const form = document.getElementById('formGerente');
      if (form) {
        form.reset();
        form.removeAttribute('data-editing-uid');
        window.showNotification('Formulário limpo', 'info');
      }
    });
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init);
  else
    init();
    
  console.log('[Gerentes] ✅ Módulo carregado!');
})();