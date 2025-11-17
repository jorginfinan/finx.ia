(function(){
  'use strict';
  let __saving = false;
  let __savingTimeout = null;
  let __submitting = false; // ✅ Flag anti-duplicação no escopo correto

  const KEY = 'bsx_gerentes_v2';
  const KEY_BACKUP = 'bsx_gerentes_v2_backup';

  // Utilidades seguras
  function jget(k, d){
    try{
      const s = localStorage.getItem(k);
      return s ? JSON.parse(s) : d;
    }catch(_){ 
      return d; 
    }
  }
  
  function jset(k, v){ 
    localStorage.setItem(k, JSON.stringify(v)); 
  }
  
  const uidFn = (typeof window.uid === 'function')
    ? window.uid
    : function() { return 'g_'+Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4); };

    async function read() {
      try {
        const arr = await window.SupabaseAPI.gerentes.getAtivos();
        return Array.isArray(arr) ? arr : [];
      } catch (error) {
        console.error('Erro ao carregar gerentes:', error);
        return [];
      }
    }
    
    // ✅ ATUALIZAR onSubmit (salvar gerente):
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
          base_calculo: comissaoPorRotaPositiva ? 'coletas' : String(fd.get('baseCalculo') || 'coletas-despesas'),
          comissao_por_rota_positiva: comissaoPorRotaPositiva,
          tem_segunda_comissao: temSegundaComissao,
          comissao2: temSegundaComissao ? comissao2Value : 0
        };
        
        // Salva no Supabase
        if (uidEditing) {
          await window.SupabaseAPI.gerentes.updateByUid(uidEditing, g);
        } else {
          g.uid = uidFn();
          await window.SupabaseAPI.gerentes.create(g);
        }
        
        // Limpa formulário
        form.reset();
        form.removeAttribute('data-editing-uid');
        delete form.dataset.editingUid;
        
        // Re-renderiza
        await render();
        
        window.showNotification('Gerente salvo com sucesso!', 'success');
        
      } catch (error) {
        console.error('[Gerentes] ❌ Erro ao salvar:', error);
        window.showNotification(error.message || 'Erro ao salvar. Tente novamente.', 'error');
      } finally {
        __savingTimeout = setTimeout(function() {
          __saving = false;
          __submitting = false;
          if (btn) btn.disabled = false;
          __savingTimeout = null;
        }, 500);
      }
    }
    
    // ✅ ATUALIZAR render:
    async function render() {
      const arr = await read();
      arr.sort(function(a,b) { 
        return String(a.nome||'').localeCompare(String(b.nome||'')); 
      });
    
      const tb = document.getElementById('tbodyGerentes');
      if (tb) {
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
    
      // Atualiza datalist
      const dl = document.getElementById('listGerentes');
      if (dl) {
        dl.innerHTML = arr.map(function(g) { 
          return '<option value="' + esc(g.nome) + '"></option>'; 
        }).join('');
      }
    
    
    // Remove duplicados baseado no UID antes de salvar
    const uniqueMap = new Map();
    safe.forEach(function(g) {
      const uid = g.uid || g.id;
      if (uid && !uniqueMap.has(uid)) {
        uniqueMap.set(uid, g);
      }
    });
    
    const deduplicated = Array.from(uniqueMap.values());
    
    // Salva na chave principal
    jset(KEY, deduplicated);
    
    // Cria backup (apenas se não estiver vazio - evita restaurar array vazio)
    if (deduplicated.length > 0) {
      jset(KEY_BACKUP, deduplicated);
    }
    
    // Atualiza referência global
    try { window.gerentes = deduplicated; } catch(_) {}
    
    // Dispara evento
    try { window.dispatchEvent(new Event('gerentes:updated')); } catch(_){}

    // ✅ NOTIFICA SINCRONIZAÇÃO
if (typeof window.SyncManager !== 'undefined') {
  window.SyncManager.notify('gerentes', { count: deduplicated.length });
}
  }


  function esc(s) {
    const map = {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
      "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;'
    };
    return String(s ?? '').replace(/[&<>"'`=\/]/g, function(m) { return map[m]; });
  }

  // Renderiza tabela e datalist
  function render(){
    const arr = read().slice().sort(function(a,b) { 
      return String(a.nome||'').localeCompare(String(b.nome||'')); 
    });

    const tb = document.getElementById('tbodyGerentes');
    if (tb){
      tb.innerHTML = arr.length ? arr.map(function(g) {
        const com = (Number(g.comissao)||0).toFixed(0);
        const com2 = g.temSegundaComissao ? (' + ' + (Number(g.comissao2)||0).toFixed(0) + '%') : '';
        
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

    // Atualiza datalist
    const dl = document.getElementById('listGerentes');
    if (dl){
      dl.innerHTML = arr.map(function(g) { 
        return '<option value="' + esc(g.nome) + '"></option>'; 
      }).join('');
    }
  }

  // Adiciona função de notificação se não existir
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

// Função de submit do formulário
function onSubmit(e) {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation(); // ✅ IMPORTANTE: Para propagação imediata
  
  // ✅ BLOQUEIO DUPLO: Previne submits múltiplos
  if (__saving || __submitting) {
    console.warn('[Gerentes] ⚠️ Já está salvando, aguarde...');
    console.warn('[Gerentes] - __saving:', __saving);
    console.warn('[Gerentes] - __submitting:', __submitting);
    return false;
  }
  
  console.log('[Gerentes] 🔒 Iniciando salvamento...');
  __submitting = true; // ✅ Marca como "em processamento"
  
  const form = e.currentTarget;
  
  // ✅ VERIFICAÇÃO: só processa se for o formulário de gerentes
  if (form.id !== 'formGerente') {
    console.log('Não é formulário de gerente, ignorando');
    return;
  }
  
  const btn = form.querySelector('#btnSalvarGerente') || 
              form.querySelector('button[type="submit"]');
  
  __saving = true;
  if (btn) btn.disabled = true;
  
  if (__savingTimeout) {
    clearTimeout(__savingTimeout);
    __savingTimeout = null;
  }
  
  try {
    const fd = new FormData(form);
    const uidEditing = (form.dataset.editingUid || '').trim();
    
    // Lê o array ATUAL
    const arr = read();
    
    // Coleta os dados do formulário
    const nome = String(fd.get('nome')||'').trim();
    const numero = String(fd.get('numero')||'').trim();
    
    // Validações básicas ANTES de qualquer coisa
    if (!nome) {
      throw new Error('Informe o nome do gerente.');
    }
    
    if (!numero) {
      throw new Error('Informe o número do gerente.');
    }
    
    const temSegundaComissao = !!fd.get('temSegundaComissao');
    const comissao2Value = Number(fd.get('comissao2') || 0);
    
    if (temSegundaComissao && !comissao2Value) {
      throw new Error('Informe o valor da 2ª comissão.');
    }
    
    // ✅ Se passou nas validações básicas, prepara o objeto
    const comissaoPorRotaPositiva = !!fd.get('comissaoPorRotaPositiva');
    
    const g = {
      uid: uidEditing || uidFn(), // Usa o UID existente ou cria novo
      nome: nome,
      comissao: Number(fd.get('comissao')||0) || 0,
      numero: numero,
      endereco: String(fd.get('endereco')||'').trim(),
      telefone: String(fd.get('telefone')||'').trim(),
      email: String(fd.get('email')||'').trim(),
      obs: String(fd.get('obs')||'').trim(),
      baseCalculo: comissaoPorRotaPositiva ? 'coletas' : String(fd.get('baseCalculo') || 'coletas-despesas'),
      comissaoPorRotaPositiva: comissaoPorRotaPositiva,
      temSegundaComissao: temSegundaComissao,
      comissao2: temSegundaComissao ? comissao2Value : 0,
      updatedAt: new Date().toISOString()
    };
    
    // Preserva createdAt
    if (uidEditing) {
      const existing = arr.find(function(x) { return x.uid === uidEditing; });
      g.createdAt = (existing && existing.createdAt) || new Date().toISOString();
    } else {
      g.createdAt = new Date().toISOString();
    }
    
    // ✅ SALVA: cria novo array
    let newArr;
    
    if (uidEditing) {
      // EDITANDO: substitui o item com o mesmo UID
      console.log('[Gerentes] 📝 EDITANDO gerente com UID:', uidEditing);
      newArr = arr.map(function(x) {
        return x.uid === uidEditing ? g : x;
      });
    } else {
      // NOVO: adiciona ao array
      console.log('[Gerentes] ✨ CRIANDO NOVO gerente');
      newArr = arr.slice(); // copia o array
      newArr.push(g);
    }
    
    // Salva no localStorage
    write(newArr);
    
    console.log('[Gerentes] - ✅ Salvo no localStorage!');
    console.log('[Gerentes] - Total de gerentes agora:', newArr.length);
    
    // Limpa o formulário
    form.reset();
    form.removeAttribute('data-editing-uid');
    delete form.dataset.editingUid;
    
    console.log('[Gerentes] - ✅ Formulário limpo!');
    
    // Re-renderiza a tabela
    render();
    
    // Feedback de sucesso
    window.showNotification('Gerente salvo com sucesso!', 'success');
    
    // ✅ AUDITORIA
    if (typeof window.AuditLog !== 'undefined') {
      window.AuditLog.log(uidEditing ? 'gerente_editado' : 'gerente_criado', {
        id: g.uid,
        nome: g.nome,
        numero: g.numero
      });
    }
    
  } catch (error) {
    console.error('[Gerentes] ❌ Erro ao salvar:', error);
    window.showNotification(error.message || 'Erro ao salvar. Tente novamente.', 'error');
  } finally {
    // ✅ Reseta flags com pequeno delay
    __savingTimeout = setTimeout(function() {
      __saving = false;
      __submitting = false; // ✅ Libera para novo submit
      if (btn) btn.disabled = false;
      __savingTimeout = null;
      console.log('[Gerentes] 🔓 Flags resetadas, pronto para novo salvamento');
    }, 500); // Reduzido de 1000 para 500ms
  }
}



  // Delegação para Editar/Excluir - ESPECÍFICA PARA GERENTES
  function onTableClick(e){
    const target = e.target;
    
    // ✅ VERIFICAÇÃO: só processa botões de gerentes
    const btnDel  = target.closest('[data-del-gerente]');
    const btnEdit = target.closest('[data-edit-gerente]');
    
    if (!btnDel && !btnEdit) return;
    
    // ✅ VERIFICAÇÃO: garante que está na tabela de gerentes
    const tbody = target.closest('#tbodyGerentes');
    if (!tbody) return;
    
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

    const uid = (btnDel||btnEdit).getAttribute('data-del-gerente') || 
                (btnEdit||btnDel).getAttribute('data-edit-gerente');
    if (!uid) return;
    
    const arr = read();
    const g   = arr.find(function(x) { return x.uid === uid; });
    if (!g) {
      alert('Gerente não encontrado.');
      return;
    }

    if (btnDel){
      if (!confirm('Excluir o gerente "' + g.nome + '"?')) return;
      
      // ✅ Remove e salva imediatamente
      const novo = arr.filter(function(x) { return x.uid !== uid; });
      write(novo);
      
      // Re-renderiza
      render();
      
      window.showNotification('Gerente excluído com sucesso!', 'success');
      
      // ✅ AUDITORIA
      if (typeof window.AuditLog !== 'undefined') {
        window.AuditLog.log('gerente_excluido', {
          id: uid,
          nome: g.nome
        });
      }
      
      return;
    }

    if (btnEdit){
      const f = document.getElementById('formGerente');
      if (!f) return;

      // ✅ IMPORTANTE: Define o UID no formulário ANTES de preencher
      f.dataset.editingUid = g.uid;

      // Preenche campos básicos
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
      setVal('obs', g.obs);

      // Preenche campos de opções avançadas (se existirem)
      const baseCalcEl = f.querySelector('[name="baseCalculo"]');
      if (baseCalcEl) baseCalcEl.value = g.baseCalculo || 'coletas-despesas';

      const rotaPosEl = f.querySelector('[name="comissaoPorRotaPositiva"]');
      if (rotaPosEl) rotaPosEl.checked = !!g.comissaoPorRotaPositiva;

      const tem2ComEl = f.querySelector('[name="temSegundaComissao"]');
      if (tem2ComEl) tem2ComEl.checked = !!g.temSegundaComissao;

      const com2El = f.querySelector('[name="comissao2"]');
      if (com2El) com2El.value = String(Number(g.comissao2) || 0);

      // Scroll suave
      f.scrollIntoView({ behavior:'smooth', block:'center' });
      
      // Foca no primeiro campo
      const firstInput = f.querySelector('input[name="nome"]');
      if (firstInput) {
        setTimeout(function() { firstInput.focus(); }, 300);
      }
    }
  }

  function init(){
    // Carrega gerentes
    try { window.gerentes = read(); } catch(_) {}
    
    const form = document.getElementById('formGerente');
    if (form && !form.__wired_gerentes){
      form.__wired_gerentes = true;
      form.addEventListener('submit', onSubmit);
      console.log('[Gerentes] ✅ Event listener registrado (submit)');
    } else if (form) {
      console.log('[Gerentes] ⚠️ Event listener JÁ estava registrado');
    }

    const tb = document.getElementById('tbodyGerentes');
    if (tb && !tb.__wired_gerentes){
      tb.__wired_gerentes = true;
      tb.addEventListener('click', onTableClick, true);
      console.log('[Gerentes] ✅ Event listener registrado (click na tabela)');
    }

    // Re-render quando trocar de empresa
    document.addEventListener('empresa:change', render);

    // ✅ DESABILITA o storage event listener para evitar restaurações indevidas
    // Cada aba gerencia seus próprios dados independentemente
    /*
    window.addEventListener('storage', function(e) {
      const k = e?.key || '';
      if (k.includes('bsx_gerentes_v2')) render();
    });
    */

    render();
  }

  // ✅ Adiciona botão "Limpar Formulário" se existir
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
})();