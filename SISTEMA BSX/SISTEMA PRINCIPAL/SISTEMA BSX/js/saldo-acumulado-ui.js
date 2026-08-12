// ============================================
// UI - VISUALIZAÇÃO DE SALDO ACUMULADO
// ============================================
(function() {
  'use strict';

  // ===== RENDERIZAR CARD DE SALDO NO RELATÓRIO =====
  function renderSaldoCard(calculo, gerenteNome) {
    const card = document.createElement('div');
    card.className = 'card saldo-card';
    card.style.cssText = `
      background: ${calculo.saldoCarregarNovo > 0 ? '#fef3c7' : '#d1fae5'};
      border-left: 4px solid ${calculo.saldoCarregarNovo > 0 ? '#f59e0b' : '#10b981'};
      padding: 20px;
      margin: 16px 0;
      border-radius: 12px;
    `;

    // HTML do card
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="margin: 0; font-size: 18px; color: #1f2937;">
          💰 Cálculo de Comissão - ${esc(gerenteNome)}
        </h3>
        <span style="background: ${calculo.comissao >= 50 ? '#3b82f6' : '#8b5cf6'}; color: white; padding: 6px 14px; border-radius: 20px; font-size: 14px; font-weight: 600;">
          Comissão ${calculo.comissao}%
        </span>
      </div>

      <div class="saldo-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 16px;">
        <!-- Coletas -->
        <div class="saldo-item">
          <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Coletas</div>
          <div style="font-size: 20px; font-weight: 700; color: #10b981;">
            ${formatMoney(calculo.coletas)}
          </div>
        </div>

        <!-- Despesas -->
        <div class="saldo-item">
          <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Despesas</div>
          <div style="font-size: 20px; font-weight: 700; color: #ef4444;">
            ${formatMoney(calculo.despesas)}
          </div>
        </div>

        <!-- Resultado -->
        <div class="saldo-item">
          <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">Resultado</div>
          <div style="font-size: 20px; font-weight: 700; color: ${calculo.resultado >= 0 ? '#10b981' : '#ef4444'};">
            ${formatMoney(calculo.resultado)}
          </div>
        </div>
      </div>

      ${calculo.comissao < 50 ? `
        <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
            <!-- Saldo Anterior -->
            <div>
              <div style="font-size: 11px; color: #6b7280; margin-bottom: 4px; text-transform: uppercase;">
                Saldo Anterior
              </div>
              <div style="font-size: 16px; font-weight: 600; color: ${calculo.saldoCarregarAnterior > 0 ? '#f59e0b' : '#6b7280'};">
                ${calculo.saldoCarregarAnterior > 0 ? '-' : ''}${formatMoney(Math.abs(calculo.saldoCarregarAnterior))}
              </div>
            </div>

            <!-- Base de Cálculo -->
            <div>
              <div style="font-size: 11px; color: #6b7280; margin-bottom: 4px; text-transform: uppercase;">
                Base Comissão
              </div>
              <div style="font-size: 16px; font-weight: 600; color: ${calculo.baseCalculo > 0 ? '#10b981' : '#6b7280'};">
                ${formatMoney(calculo.baseCalculo)}
              </div>
            </div>

            <!-- Saldo Novo -->
            <div>
              <div style="font-size: 11px; color: #6b7280; margin-bottom: 4px; text-transform: uppercase;">
                Saldo a Carregar
              </div>
              <div style="font-size: 16px; font-weight: 600; color: ${calculo.saldoCarregarNovo > 0 ? '#ef4444' : '#10b981'};">
                ${calculo.saldoCarregarNovo > 0 ? '-' : ''}${formatMoney(Math.abs(calculo.saldoCarregarNovo))}
              </div>
            </div>
          </div>
        </div>

        ${calculo.observacao ? `
          <div style="background: #f3f4f6; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; color: #374151;">
            <strong>ℹ️ Observação:</strong> ${esc(calculo.observacao)}
          </div>
        ` : ''}
      ` : `
        <div style="background: #dbeafe; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; color: #1e40af;">
          <strong>ℹ️ Comissão 50%:</strong> Calculada sobre o resultado total, sem acúmulo de saldo.
        </div>
      `}

      <!-- Valor Final -->
      <div style="background: ${calculo.aPagar >= 0 ? '#10b981' : '#ef4444'}; color: white; padding: 20px; border-radius: 10px; text-align: center;">
        <div style="font-size: 14px; opacity: 0.9; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px;">
          ${calculo.aPagar >= 0 ? 'Valor a Pagar' : 'Empresa Deve ao Gerente'}
        </div>
        <div style="font-size: 32px; font-weight: 800;">
          ${formatMoney(Math.abs(calculo.aPagar))}
        </div>
        ${calculo.valorComissao > 0 ? `
          <div style="font-size: 12px; opacity: 0.8; margin-top: 6px;">
            (${calculo.comissao}% de ${formatMoney(calculo.baseCalculo)})
          </div>
        ` : ''}
      </div>
    `;

    return card;
  }

  // ===== RENDERIZAR HISTÓRICO DE SALDO =====
  function renderHistoricoSaldo(gerenteId, empresaId, containerEl) {
    const historico = window.SaldoAcumulado.getHistorico(gerenteId, empresaId);
    
    if (!historico || historico.length === 0) {
      containerEl.innerHTML = '<p style="text-align:center; color:#6b7280; padding:40px;">Nenhum histórico encontrado</p>';
      return;
    }

    containerEl.innerHTML = `
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #1f2937; color: white;">
              <th style="padding: 12px; text-align: left;">Data</th>
              <th style="padding: 12px; text-align: left;">Período</th>
              <th style="padding: 12px; text-align: right;">Coletas</th>
              <th style="padding: 12px; text-align: right;">Despesas</th>
              <th style="padding: 12px; text-align: right;">Resultado</th>
              <th style="padding: 12px; text-align: right;">Saldo Anterior</th>
              <th style="padding: 12px; text-align: right;">Base Cálculo</th>
              <th style="padding: 12px; text-align: right;">Comissão</th>
              <th style="padding: 12px; text-align: right;">Saldo Novo</th>
            </tr>
          </thead>
          <tbody>
            ${historico.map((h, idx) => `
              <tr style="border-bottom: 1px solid #e5e7eb; ${idx % 2 === 0 ? 'background: #f9fafb;' : ''}">
                <td style="padding: 10px;">${new Date(h.data).toLocaleDateString('pt-BR')}</td>
                <td style="padding: 10px;">${esc(h.periodo)}</td>
                <td style="padding: 10px; text-align: right; color: #10b981; font-weight: 600;">
                  ${formatMoney(h.coletas)}
                </td>
                <td style="padding: 10px; text-align: right; color: #ef4444; font-weight: 600;">
                  ${formatMoney(h.despesas)}
                </td>
                <td style="padding: 10px; text-align: right; font-weight: 700; color: ${h.resultado >= 0 ? '#10b981' : '#ef4444'};">
                  ${formatMoney(h.resultado)}
                </td>
                <td style="padding: 10px; text-align: right; color: ${h.saldoAnterior > 0 ? '#f59e0b' : '#6b7280'};">
                  ${h.saldoAnterior > 0 ? '-' : ''}${formatMoney(Math.abs(h.saldoAnterior))}
                </td>
                <td style="padding: 10px; text-align: right; font-weight: 600;">
                  ${formatMoney(h.baseCalculo)}
                </td>
                <td style="padding: 10px; text-align: right; color: #10b981; font-weight: 700;">
                  ${formatMoney(h.valorComissao)}
                </td>
                <td style="padding: 10px; text-align: right; font-weight: 600; color: ${h.saldoNovo > 0 ? '#ef4444' : '#10b981'};">
                  ${h.saldoNovo > 0 ? '-' : ''}${formatMoney(Math.abs(h.saldoNovo))}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // ===== HELPER: FORMAT MONEY =====
  function formatMoney(valor) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor || 0);
  }

  // ===== HELPER: ESCAPE HTML =====
  function esc(text) {
    const map = {
      '&': '&amp;', '<': '&lt;', '>': '&gt;',
      '"': '&quot;', "'": '&#39;'
    };
    return String(text || '').replace(/[&<>"']/g, m => map[m]);
  }

  // ===== EXPORTAR API =====
  window.SaldoAcumuladoUI = {
    renderCard: renderSaldoCard,
    renderHistorico: renderHistoricoSaldo
  };

  console.log('✅ UI de Saldo Acumulado carregada');
})();