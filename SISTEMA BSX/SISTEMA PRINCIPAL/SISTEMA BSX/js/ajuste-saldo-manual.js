// ===== AJUSTE MANUAL DE SALDO ACUMULADO =====
// Sistema consolidado para ajustar saldo sem criar prestação

(function() {
  'use strict';

  /**
   * Ajusta manualmente o saldo acumulado de um gerente
   * @param {string} gerenteId - ID do gerente
   * @param {number} novoSaldo - Novo valor do saldo (negativo = dívida)
   * @param {string} motivo - Motivo do ajuste
   */
  async function ajustarSaldoManual(gerenteId, novoSaldo, motivo = '') {
    try {
      if (!gerenteId) {
        throw new Error('ID do gerente é obrigatório');
      }

      const saldoNumerico = parseFloat(novoSaldo);
      if (!Number.isFinite(saldoNumerico)) {
        throw new Error('Saldo inválido');
      }

      // Busca o gerente
      const gerente = (window.gerentes || []).find(g => g.uid === gerenteId);
      if (!gerente) {
        throw new Error('Gerente não encontrado');
      }

      // Salva no Supabase
      if (!window.SupabaseAPI?.supabase) {
        throw new Error('Supabase não disponível');
      }

      const company = window.getCompany?.() || 'BSX';
      const timestamp = new Date().toISOString();

      // Verifica se já existe registro
      const { data: existing, error: selectError } = await window.SupabaseAPI.supabase
        .from('saldo_acumulado')
        .select('*')
        .eq('gerente_id', gerenteId)
        .eq('company', company)
        .maybeSingle();

      if (selectError) {
        console.warn('[Ajuste Saldo] Erro ao buscar saldo:', selectError);
      }

      const saldoAnterior = existing?.saldo || 0;

      if (existing) {
        // Atualiza registro existente
        const { error } = await window.SupabaseAPI.supabase
          .from('saldo_acumulado')
          .update({
            saldo: saldoNumerico,
            updated_at: timestamp
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Cria novo registro
        const { error } = await window.SupabaseAPI.supabase
          .from('saldo_acumulado')
          .insert([{
            gerente_id: gerenteId,
            gerente_nome: gerente.nome,
            company: company,
            saldo: saldoNumerico,
            created_at: timestamp,
            updated_at: timestamp
          }]);

        if (error) throw error;
      }

      // Registra no audit log
      if (window.AuditLog) {
        try {
          await window.AuditLog.log('saldo_ajustado_manual', {
            gerenteId: gerenteId,
            gerenteNome: gerente.nome,
            saldoAnterior: saldoAnterior,
            saldoNovo: saldoNumerico,
            diferenca: saldoNumerico - saldoAnterior,
            motivo: motivo || 'Ajuste manual'
          });
        } catch(e) {
          console.warn('[Ajuste Saldo] Erro ao registrar auditoria:', e);
        }
      }

      // Atualiza UI
      if (window.SaldoAcumuladoUI?.atualizarDisplay) {
        try {
          window.SaldoAcumuladoUI.atualizarDisplay();
        } catch(e) {
          console.warn('[Ajuste Saldo] Erro ao atualizar UI:', e);
        }
      }

      // Dispara evento
      try {
        window.dispatchEvent(new CustomEvent('saldo:atualizado', {
          detail: { gerenteId, saldoNovo: saldoNumerico }
        }));
      } catch(e) {
        console.warn('[Ajuste Saldo] Erro ao disparar evento:', e);
      }

      console.log(`✅ Saldo ajustado: ${gerente.nome} → R$ ${saldoNumerico.toFixed(2)}`);
      return { success: true, saldoAnterior, saldoNovo: saldoNumerico };

    } catch (error) {
      console.error('[Ajuste Saldo] Erro:', error);
      throw error;
    }
  }

  /**
   * Abre modal para ajustar saldo manualmente
   */
  function abrirModalAjusteSaldo() {
    console.log('[Ajuste Saldo] Abrindo modal...');
    
    const gerentes = window.gerentes || [];
    
    if (!gerentes.length) {
      alert('Nenhum gerente cadastrado');
      return;
    }

    // Remove modal anterior se existir
    const modalAntigo = document.getElementById('modalAjusteSaldo');
    if (modalAntigo) {
      modalAntigo.remove();
    }

    // Cria modal
    const modal = document.createElement('div');
    modal.id = 'modalAjusteSaldo';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    modal.innerHTML = `
      <div style="
        background: white;
        padding: 24px;
        border-radius: 8px;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      ">
        <h3 style="margin: 0 0 20px 0; font-size: 18px; color: #1a1a2e;">
          ⚠️ Ajuste Manual de Saldo
        </h3>
        
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555;">
            Gerente
          </label>
          <select id="ajusteSaldoGerente" style="
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
          ">
            <option value="">Selecione...</option>
            ${gerentes.map(g => `
              <option value="${g.uid}">${g.nome}</option>
            `).join('')}
          </select>
        </div>

        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555;">
            Novo Saldo (R$)
          </label>
          <input 
            type="text" 
            id="ajusteSaldoValor" 
            placeholder="Ex: -150.00"
            style="
              width: 100%;
              padding: 10px;
              border: 1px solid #ddd;
              border-radius: 4px;
              font-size: 14px;
            "
          />
          <small style="color: #888; font-size: 12px;">
            Use valores negativos para dívidas
          </small>
        </div>

        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 6px; font-weight: 600; color: #555;">
            Motivo (opcional)
          </label>
          <textarea 
            id="ajusteSaldoMotivo" 
            rows="3"
            placeholder="Ex: Correção de erro contábil, ajuste inicial, etc."
            style="
              width: 100%;
              padding: 10px;
              border: 1px solid #ddd;
              border-radius: 4px;
              font-size: 14px;
              resize: vertical;
            "
          ></textarea>
        </div>

        <div style="
          background: #fff3cd;
          border: 1px solid #ffc107;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 20px;
          font-size: 13px;
          color: #856404;
        ">
          <strong>⚠️ Atenção:</strong> Este ajuste irá sobrescrever o saldo atual do gerente.
          Use apenas para correções manuais.
        </div>

        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button 
            id="btnCancelarAjuste"
            style="
              padding: 10px 20px;
              border: 1px solid #ddd;
              background: white;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
            "
          >
            Cancelar
          </button>
          <button 
            id="btnConfirmarAjuste"
            style="
              padding: 10px 20px;
              border: none;
              background: #1a1a2e;
              color: white;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 600;
            "
          >
            Confirmar Ajuste
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    document.getElementById('btnCancelarAjuste').addEventListener('click', () => {
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    // Formatar valor ao digitar
    const inputValor = document.getElementById('ajusteSaldoValor');
    inputValor.addEventListener('input', function(e) {
      let v = e.target.value;
      // Remove tudo exceto números, vírgula, ponto e sinal negativo
      v = v.replace(/[^\d.,-]/g, '');
      e.target.value = v;
    });

    document.getElementById('btnConfirmarAjuste').addEventListener('click', async () => {
      const gerenteId = document.getElementById('ajusteSaldoGerente').value;
      const valorStr = document.getElementById('ajusteSaldoValor').value.trim();
      const motivo = document.getElementById('ajusteSaldoMotivo').value.trim();

      if (!gerenteId) {
        alert('Selecione um gerente');
        return;
      }

      if (!valorStr) {
        alert('Informe o novo saldo');
        return;
      }

      // Converte valor (aceita vírgula ou ponto)
      const valor = parseFloat(valorStr.replace(',', '.'));
      if (!Number.isFinite(valor)) {
        alert('Valor inválido');
        return;
      }

      const gerente = gerentes.find(g => g.uid === gerenteId);
      const confirmMsg = `Confirma ajuste de saldo?\n\n` +
        `Gerente: ${gerente?.nome}\n` +
        `Novo saldo: R$ ${valor.toFixed(2)}\n` +
        (motivo ? `Motivo: ${motivo}` : '');

      if (!confirm(confirmMsg)) return;

      try {
        const btn = document.getElementById('btnConfirmarAjuste');
        btn.disabled = true;
        btn.textContent = 'Ajustando...';

        await ajustarSaldoManual(gerenteId, valor, motivo);

        alert('✅ Saldo ajustado com sucesso!');
        modal.remove();

      } catch (error) {
        alert('❌ Erro ao ajustar saldo:\n' + error.message);
        console.error(error);
        const btnErr = document.getElementById('btnConfirmarAjuste');
        if (btnErr) {
          btnErr.disabled = false;
          btnErr.textContent = 'Confirmar Ajuste';
        }
      }
    });
  }

  // Expor funções globalmente
  window.ajustarSaldoManual = ajustarSaldoManual;
  window.abrirModalAjusteSaldo = abrirModalAjusteSaldo;

  console.log('✅ Sistema de ajuste manual de saldo carregado');
  
  // Debug: verificar se a função está disponível
  if (typeof window.abrirModalAjusteSaldo === 'function') {
    console.log('✅ Função abrirModalAjusteSaldo disponível globalmente');
  } else {
    console.error('❌ Função abrirModalAjusteSaldo NÃO está disponível!');
  }
})();