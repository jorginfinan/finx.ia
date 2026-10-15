// ============================================
// ANÁLISE POR GERENTE - v1.0
// Consolidação de despesas, coletas e pagamentos
// ============================================

(function() {
  'use strict';
  
  console.log('[Análise Gerente] 🔄 Carregando módulo...');
  
  // ============================================
  // ESTADO DO MÓDULO
  // ============================================
  
  // ✅ FLAG PARA EVITAR MÚLTIPLAS INICIALIZAÇÕES
  let _initialized = false;
  
  let currentGerente = null;
  let currentPeriodo = { de: null, ate: null };
  let dadosAnalise = {
    prestacoes: [],
    despesas: [],
    pagamentos: [],
    resumo: {}
  };
  
  // ============================================
  // INICIALIZAÇÃO
  // ============================================
  
  function init() {
    // Tenta encontrar o container - suporta dois IDs possíveis
    let container = document.getElementById('analiseGerenteContent');
    if (!container) {
      container = document.getElementById('pageAnaliseGerente');
    }
    
    if (!container) {
      console.warn('[Análise Gerente] Container não encontrado');
      return;
    }
    
    // ✅ Se já inicializado, apenas recarrega os gerentes (pode ter carregado depois)
    if (_initialized) {
      console.log('[Análise Gerente] Já inicializado, recarregando gerentes...');
      carregarGerentes();
      return;
    }
    
    // ✅ MARCA COMO INICIALIZADO
    _initialized = true;
    
    // Se o container é a própria section, cria um div interno
    if (container.tagName === 'SECTION') {
      let innerDiv = container.querySelector('.ag-inner');
      if (!innerDiv) {
        innerDiv = document.createElement('div');
        innerDiv.className = 'ag-inner';
        // Preserva o H1 se existir
        const h1 = container.querySelector('h1');
        if (h1) {
          innerDiv.innerHTML = '';
          container.innerHTML = '';
          container.appendChild(h1);
          container.appendChild(innerDiv);
        } else {
          container.innerHTML = '<h1>📊 Análise por Gerente</h1>';
          container.appendChild(innerDiv);
        }
      }
      container = innerDiv;
    }
    
    renderPage(container);
    setupEventListeners();
    carregarGerentes();
    setPeriodoPadrao();
    
    console.log('[Análise Gerente] ✅ Módulo inicializado');
  }
  
  // ============================================
  // RENDER DA PÁGINA
  // ============================================
  
  function renderPage(container) {
    container.innerHTML = `
      <div class="analise-gerente-page">
        <!-- FILTROS -->
        <div class="ag-filtros card">
          <div class="ag-filtros-row">
            <div class="ag-filtro-group">
              <label>Gerente</label>
              <select id="agGerente" class="input">
                <option value="">Selecione o gerente</option>
              </select>
            </div>
            
            <div class="ag-filtro-group">
              <label>Mês Rápido</label>
              <select id="agMesRapido" class="input">
                ${gerarOpcoesMeses()}
              </select>
            </div>
            
            <div class="ag-filtro-group">
              <label>De</label>
              <input type="date" id="agDe" class="input">
            </div>
            
            <div class="ag-filtro-group">
              <label>Até</label>
              <input type="date" id="agAte" class="input">
            </div>
            
            <div class="ag-filtro-group ag-filtro-btn">
              <button id="agBuscar" class="btn primary">
                🔍 Analisar
              </button>
            </div>
          </div>
        </div>
        
        <!-- CARDS DE RESUMO -->
        <div class="ag-cards" id="agCards" style="display:none;">
          <div class="ag-card ag-card-coletas">
            <div class="ag-card-icon">📥</div>
            <div class="ag-card-info">
              <span class="ag-card-label">Total Coletas</span>
              <span class="ag-card-value" id="agTotalColetas">R$ 0,00</span>
            </div>
          </div>
          
          <div class="ag-card ag-card-despesas">
            <div class="ag-card-icon">📤</div>
            <div class="ag-card-info">
              <span class="ag-card-label">Total Despesas</span>
              <span class="ag-card-value" id="agTotalDespesas">R$ 0,00</span>
            </div>
          </div>
          
          <div class="ag-card ag-card-comissao">
            <div class="ag-card-icon">💰</div>
            <div class="ag-card-info">
              <span class="ag-card-label">Comissões</span>
              <span class="ag-card-value" id="agTotalComissao">R$ 0,00</span>
            </div>
          </div>
          
          <div class="ag-card ag-card-pagamentos">
            <div class="ag-card-icon">💳</div>
            <div class="ag-card-info">
              <span class="ag-card-label">Pago ao gerente</span>
              <span class="ag-card-value" id="agTotalPagamentos">R$ 0,00</span>
              <span class="ag-card-sub" id="agTotalRecebidosSub">Recebido: R$ 0,00</span>
            </div>
          </div>

          <div class="ag-card ag-card-saldo">
            <div class="ag-card-icon">📊</div>
            <div class="ag-card-info">
              <span class="ag-card-label">Saldo (Recebido − Pago)</span>
              <span class="ag-card-value" id="agSaldo">R$ 0,00</span>
            </div>
          </div>
        </div>
        
        <!-- BOTÕES DE EXPORTAÇÃO -->
        <div class="ag-export" id="agExport" style="display:none;">
          <button id="agExportPdf" class="btn secondary">
            📄 Exportar PDF
          </button>
          <button id="agExportExcel" class="btn secondary">
            📊 Exportar Excel
          </button>
        </div>
        
        <!-- TABELAS DETALHADAS -->
        <div class="ag-tabelas" id="agTabelas" style="display:none;">
          
          <!-- PRESTAÇÕES -->
          <div class="ag-secao card">
            <div class="ag-secao-header" data-toggle="agTabelaPrestacoes">
              <h3>📋 Prestações / Coletas</h3>
              <span class="ag-secao-badge" id="agBadgePrestacoes">0</span>
              <span class="ag-secao-toggle">▼</span>
            </div>
            <div class="ag-secao-content" id="agTabelaPrestacoes">
              <table class="ag-table">
                <thead>
                  <tr>
                    <th>Período</th>
                    <th>Coletas</th>
                    <th title="Despesas registradas no fechamento da prestação">Despesas ¹</th>
                    <th>Comissão</th>
                    <th>Resultado</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody id="agBodyPrestacoes">
                  <tr><td colspan="6" class="ag-empty">Nenhuma prestação encontrada</td></tr>
                </tbody>
                <tfoot id="agFootPrestacoes">
                  <tr class="ag-total-row">
                    <td><strong>TOTAL</strong></td>
                    <td class="valor"><strong id="agTotalColetasTabela">R$ 0,00</strong></td>
                    <td class="valor despesa"><strong id="agTotalDespPrestTabela">R$ 0,00</strong></td>
                    <td class="valor"><strong id="agTotalComissaoTabela">R$ 0,00</strong></td>
                    <td class="valor"><strong id="agTotalResultadoTabela">R$ 0,00</strong></td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          
          <!-- DESPESAS -->
          <div class="ag-secao card">
            <div class="ag-secao-header" data-toggle="agTabelaDespesas">
              <h3>💸 Despesas Detalhadas</h3>
              <span class="ag-secao-badge" id="agBadgeDespesas">0</span>
              <span class="ag-secao-toggle">▼</span>
            </div>
            <div class="ag-secao-content" id="agTabelaDespesas">
              <div class="ag-busca-container">
                <select id="agFiltroRota" class="input ag-filtro-rota">
                  <option value="">Todas as rotas</option>
                </select>
                <input type="text" id="agBuscaDespesa" class="input ag-busca-input" placeholder="🔍 Filtrar por descrição...">
              </div>
              <table class="ag-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Rota</th>
                    <th>Ficha</th>
                    <th>Descrição</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody id="agBodyDespesas">
                  <tr><td colspan="5" class="ag-empty">Nenhuma despesa encontrada</td></tr>
                </tbody>
                <tfoot id="agFootDespesas">
                  <tr class="ag-total-row">
                    <td colspan="4"><strong>TOTAL</strong></td>
                    <td class="valor despesa"><strong id="agTotalDespesasTabela">R$ 0,00</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          
          <!-- PAGAMENTOS -->
          <div class="ag-secao card">
            <div class="ag-secao-header" data-toggle="agTabelaPagamentos">
              <h3>💳 Recebimentos e Pagamentos</h3>
              <span class="ag-secao-badge" id="agBadgePagamentos">0</span>
              <span class="ag-secao-toggle">▼</span>
            </div>
            <div class="ag-secao-content" id="agTabelaPagamentos">
              <div class="ag-busca-container">
                <label style="font-size:13px;color:#6b7280;align-self:center;">De</label>
                <input type="date" id="agPagDe" class="input ag-filtro-rota">
                <label style="font-size:13px;color:#6b7280;align-self:center;">Até</label>
                <input type="date" id="agPagAte" class="input ag-filtro-rota">
                <select id="agFiltroTipoPag" class="input ag-filtro-rota" style="font-size:13px;">
                  <option value="">Todos</option>
                  <option value="recebimento">Só Recebimentos</option>
                  <option value="pagamento">Só Pagamentos</option>
                </select>
                <button id="agFiltrarPag" class="btn secondary" style="padding:6px 14px;font-size:13px;">Filtrar</button>
                <button id="agLimparPag" class="btn secondary" style="padding:6px 14px;font-size:13px;background:#f3f4f6;color:#374151;">Limpar</button>
              </div>
              <div id="agBlocoRecebimentos">
                <div class="ag-sub-title ag-sub-rec">
                  📥 Recebimentos <small>— o gerente entregou (entrou no caixa)</small>
                  <span class="ag-secao-badge" id="agBadgeRecebimentos">0</span>
                </div>
                <table class="ag-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Forma</th>
                      <th>Descrição</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody id="agBodyRecebimentos">
                    <tr><td colspan="4" class="ag-empty">Nenhum recebimento</td></tr>
                  </tbody>
                  <tfoot>
                    <tr class="ag-total-row">
                      <td colspan="3"><strong>Total recebido</strong></td>
                      <td class="valor" style="color:#059669"><strong id="agTotalRecTabela">R$ 0,00</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div id="agBlocoPagamentos">
                <div class="ag-sub-title ag-sub-pag">
                  📤 Pagamentos <small>— a empresa pagou ao gerente (saiu do caixa)</small>
                  <span class="ag-secao-badge" id="agBadgeSoPagamentos">0</span>
                </div>
                <table class="ag-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Tipo</th>
                      <th>Forma</th>
                      <th>Descrição</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody id="agBodyPagamentos">
                    <tr><td colspan="5" class="ag-empty">Nenhum pagamento</td></tr>
                  </tbody>
                  <tfoot>
                    <tr class="ag-total-row">
                      <td colspan="4"><strong>Total pago</strong></td>
                      <td class="valor despesa"><strong id="agTotalPagTabela">R$ 0,00</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div class="ag-saldo-caixa">
                <span>Saldo (Recebido − Pago)</span>
                <strong id="agTotalPagamentosTabela">R$ 0,00</strong>
              </div>
            </div>
          </div>
          
        </div>
        
        <!-- MENSAGEM INICIAL -->
        <div class="ag-inicial" id="agInicial">
          <div class="ag-inicial-icon">📊</div>
          <h2>Análise por Gerente</h2>
          <p>Selecione um gerente e o período para visualizar a análise consolidada.</p>
        </div>
        
      </div>
    `;
  }
  
  // ============================================
  // HELPERS
  // ============================================
  
  function gerarOpcoesMeses() {
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth();
    
    let options = '<option value="">Selecione o mês</option>';
    
    // Últimos 12 meses
    for (let i = 0; i < 12; i++) {
      let mes = mesAtual - i;
      let ano = anoAtual;
      
      if (mes < 0) {
        mes += 12;
        ano -= 1;
      }
      
      const valor = `${ano}-${String(mes + 1).padStart(2, '0')}`;
      const label = `${meses[mes]} ${ano}`;
      const selected = i === 0 ? ' selected' : '';
      
      options += `<option value="${valor}"${selected}>${label}</option>`;
    }
    
    return options;
  }
  
  function setPeriodoPadrao() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth();
    
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    
    document.getElementById('agDe').value = formatDateISO(primeiroDia);
    document.getElementById('agAte').value = formatDateISO(ultimoDia);
    
    currentPeriodo = {
      de: formatDateISO(primeiroDia),
      ate: formatDateISO(ultimoDia)
    };
  }
  
  function formatDateISO(date) {
    return date.toISOString().split('T')[0];
  }
  
  function formatDateBR(dateStr) {
    if (!dateStr) return '-';
    const [ano, mes, dia] = dateStr.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  
  function fmtBRL(valor) {
    return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  
  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
  
  // ============================================
  // CARREGAR GERENTES
  // ============================================
  
  function carregarGerentes() {
    const select = document.getElementById('agGerente');
    if (!select) return;
    
    const gerentes = window.gerentes || [];
    
    console.log('[Análise Gerente] Carregando gerentes:', gerentes.length);
    
    // Se ainda não tem gerentes, tenta novamente em 500ms
    if (gerentes.length === 0) {
      console.log('[Análise Gerente] ⏳ Aguardando gerentes carregarem...');
      setTimeout(carregarGerentes, 500);
      return;
    }
    
    // Extrai número da rota do início do nome (ex: "041 Assis Boy" → "041")
    // g.numero pode ser telefone — não usar para ordenação/label
    const comRota = gerentes.map(g => {
      const match = (g.nome || '').match(/^(\d+)/);
      const rota = match ? match[1].padStart(3, '0') : '999';
      return { ...g, _rota: rota };
    });
    
    const ordenados = comRota.sort((a, b) => a._rota.localeCompare(b._rota));
    
    let options = '<option value="">Selecione o gerente</option>';
    
    ordenados.forEach(g => {
      const nome = g.nome || '';
      const uid = g.uid || g.id || '';
      options += `<option value="${uid}">${nome}</option>`;
    });
    
    select.innerHTML = options;
    console.log('[Análise Gerente] ✅ Gerentes carregados:', ordenados.length);
  }
  
  // ============================================
  // EVENT LISTENERS
  // ============================================
  
  function setupEventListeners() {
    // Botão Analisar
    document.getElementById('agBuscar')?.addEventListener('click', executarAnalise);
    
    // Mês rápido
    document.getElementById('agMesRapido')?.addEventListener('change', function() {
      const valor = this.value;
      if (!valor) return;
      
      const [ano, mes] = valor.split('-').map(Number);
      const primeiroDia = new Date(ano, mes - 1, 1);
      const ultimoDia = new Date(ano, mes, 0);
      
      document.getElementById('agDe').value = formatDateISO(primeiroDia);
      document.getElementById('agAte').value = formatDateISO(ultimoDia);
    });
    
    // Toggle seções
    document.querySelectorAll('.ag-secao-header[data-toggle]').forEach(header => {
      header.addEventListener('click', function() {
        const targetId = this.dataset.toggle;
        const content = document.getElementById(targetId);
        const toggle = this.querySelector('.ag-secao-toggle');
        
        if (content) {
          const isHidden = content.style.display === 'none';
          content.style.display = isHidden ? 'block' : 'none';
          if (toggle) toggle.textContent = isHidden ? '▼' : '▶';
        }
      });
    });
    
    // Exportação
    document.getElementById('agExportPdf')?.addEventListener('click', exportarPDF);
    document.getElementById('agExportExcel')?.addEventListener('click', exportarExcel);
    
    // Filtro de busca de despesas
    document.getElementById('agBuscaDespesa')?.addEventListener('input', function() {
      const filtroRota = document.getElementById('agFiltroRota')?.value || '';
      renderTabelaDespesas(this.value, filtroRota);
    });
    
    // Filtro de rota
    document.getElementById('agFiltroRota')?.addEventListener('change', function() {
      const filtroBusca = document.getElementById('agBuscaDespesa')?.value || '';
      renderTabelaDespesas(filtroBusca, this.value);
    });
    
    // Filtro de data dos pagamentos
    function aplicarFiltrosPag() {
      const de   = document.getElementById('agPagDe')?.value || '';
      const ate  = document.getElementById('agPagAte')?.value || '';
      const tipo = document.getElementById('agFiltroTipoPag')?.value || '';
      renderTabelaPagamentos(de, ate, tipo);
      recalcularCards(de, ate, tipo);
    }
    
    document.getElementById('agFiltrarPag')?.addEventListener('click', aplicarFiltrosPag);
    
    document.getElementById('agFiltroTipoPag')?.addEventListener('change', aplicarFiltrosPag);
    
    document.getElementById('agLimparPag')?.addEventListener('click', function() {
      document.getElementById('agPagDe').value = '';
      document.getElementById('agPagAte').value = '';
      document.getElementById('agFiltroTipoPag').value = '';
      renderTabelaPagamentos('', '', '');
      recalcularCards('', '', '');
    });
  }
  
  // ============================================
  // EXECUTAR ANÁLISE
  // ============================================
  
  async function executarAnalise() {
    const gerenteId = document.getElementById('agGerente').value;
    const de = document.getElementById('agDe').value;
    const ate = document.getElementById('agAte').value;
    
    if (!gerenteId) {
      alert('Selecione um gerente');
      return;
    }
    
    if (!de || !ate) {
      alert('Selecione o período');
      return;
    }
    
    currentGerente = (window.gerentes || []).find(g => (g.uid || g.id) === gerenteId);
    currentPeriodo = { de, ate };
    
    console.log('[Análise Gerente] 🔍 Executando análise:', {
      gerente: currentGerente?.nome,
      periodo: currentPeriodo
    });
    
    // Mostra loading
    document.getElementById('agBuscar').disabled = true;
    document.getElementById('agBuscar').textContent = '⏳ Carregando...';
    
    try {
      // Busca dados
      await buscarDados();
      
      // Calcula resumo
      calcularResumo();
      
      // Renderiza
      renderCards();
      renderTabelaPrestacoes();
      renderTabelaDespesas();
      renderTabelaPagamentos();
      
      // Mostra resultados
      document.getElementById('agInicial').style.display = 'none';
      document.getElementById('agCards').style.display = 'grid';
      document.getElementById('agExport').style.display = 'flex';
      document.getElementById('agTabelas').style.display = 'block';
      
    } catch (error) {
      console.error('[Análise Gerente] Erro:', error);
      alert('Erro ao carregar dados: ' + error.message);
    } finally {
      document.getElementById('agBuscar').disabled = false;
      document.getElementById('agBuscar').textContent = '🔍 Analisar';
    }
  }
  
  // ============================================
  // BUSCAR DADOS
  // ============================================
  
  async function buscarDados() {
    const gerenteNome = currentGerente?.nome || '';
    const gerenteUid  = currentGerente?.uid || currentGerente?.id || '';
    
    // ✅ Extrai o número da rota do início do nome (ex: "041 Assis Boy" → "041")
    // currentGerente.numero pode ser telefone — não usar para busca em lancamentos
    const rotaMatch = (gerenteNome || '').match(/^(\d+)/);
    const gerenteRota = rotaMatch ? rotaMatch[1].padStart(3, '0') : '';
    
    const { de, ate } = currentPeriodo;
    
    // 1. PRESTAÇÕES — carrega direto do Supabase
    let todasPrestacoes = [];
    if (typeof window.carregarPrestacoesGlobal === 'function') {
      try { todasPrestacoes = await window.carregarPrestacoesGlobal(); }
      catch(e) { todasPrestacoes = JSON.parse(localStorage.getItem(window.DB_PREST) || '[]'); }
    } else {
      todasPrestacoes = JSON.parse(localStorage.getItem(window.DB_PREST) || '[]');
    }
    dadosAnalise.prestacoes = buscarPrestacoes(todasPrestacoes, gerenteUid, gerenteRota, de, ate);
    
    // 2. DESPESAS
    dadosAnalise.despesas = buscarDespesas(gerenteNome, gerenteRota, de, ate);
    
    // 3. PAGAMENTOS — recarrega window.lanc antes de buscar
    if (typeof window.carregarFinanceiroSupabase === 'function') {
      try { await window.carregarFinanceiroSupabase(); } catch(e) {}
    }
    dadosAnalise.pagamentos = buscarPagamentos(gerenteRota, gerenteNome, de, ate);
    
    console.log('[Análise Gerente] Dados carregados:', {
      prestacoes: dadosAnalise.prestacoes.length,
      despesas: dadosAnalise.despesas.length,
      pagamentos: dadosAnalise.pagamentos.length
    });
  }
  
  function buscarPrestacoes(todasPrestacoes, gerenteUid, gerenteRota, de, ate) {
    return todasPrestacoes.filter(p => {
      // Filtra por uid do gerente ou pelo número da rota no nome
      const pUid = p.gerenteId || '';
      const pNome = (p.gerenteNome || '').toLowerCase();
      const uidMatch = gerenteUid && pUid === gerenteUid;
      const rotaMatch = gerenteRota && pNome.includes(gerenteRota);
      if (!uidMatch && !rotaMatch) return false;
      
      const dataRef = p.fim || p.periodoFim || p.dataFim || p.data || '';
      if (dataRef < de || dataRef > ate) return false;
      return true;
    }).sort((a, b) => {
      const dataA = a.ini || a.periodoIni || a.dataIni || '';
      const dataB = b.ini || b.periodoIni || b.dataIni || '';
      return dataA.localeCompare(dataB);
    });
  }
  
  // Casa o texto de gerente gravado num lançamento/despesa com o gerente analisado.
  // - Texto com número de rota ("034 ...") → exige a MESMA rota. Antes casava só
  //   pelo primeiro nome e misturava "034 DIEGO" com "078 DIEGO SILVA".
  // - Texto sem número → nome igual; nome parcial só se não for ambíguo com outro gerente.
  function criarMatcherGerente(gerenteNome) {
    const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
    const alvo = norm(gerenteNome);
    const mAlvo = alvo.match(/^(\d+)\s*(.*)$/);
    const rotaAlvo = mAlvo ? mAlvo[1].padStart(3, '0') : '';
    const nomeAlvo = mAlvo ? mAlvo[2] : alvo;
    const contem = (a, b) => a.length > 2 && b.length > 2 && (a.includes(b) || b.includes(a));
    const outrosNomes = (window.gerentes || [])
      .map(g => norm(g?.nome))
      .filter(n => n && n !== alvo)
      .map(n => n.replace(/^\d+\s*/, ''))
      .filter(Boolean);

    return function (texto) {
      const t = norm(texto);
      if (!t) return false;
      const m = t.match(/^(\d+)\s*(.*)$/);
      if (m) return !!rotaAlvo && m[1].padStart(3, '0') === rotaAlvo;
      if (!nomeAlvo) return false;
      if (t === nomeAlvo) return true;
      if (!contem(t, nomeAlvo)) return false;
      return !outrosNomes.some(n => contem(t, n));
    };
  }

  function buscarDespesas(gerenteNome, gerenteRota, de, ate) {
    const todasDespesas = window.despesas || [];
    const fichaRotaMap = new Map(
      (window.fichas || []).map(f => [String(f.ficha).trim(), String(f.area || '').trim()])
    );

    const rotaPad      = (gerenteRota || '').padStart(3, '0');
    const gerenteUid   = String(currentGerente?.uid || currentGerente?.id || '');
    const matchGerente = criarMatcherGerente(gerenteNome);

    const result = todasDespesas.filter(d => {
      const idMatch = gerenteUid && d.gerenteId && String(d.gerenteId) === gerenteUid;
      if (!idMatch && !matchGerente(d.gerenteNome)) return false;
      
      const dataRef = d.data || d.periodoFim || '';
      if (dataRef < de || dataRef > ate) return false;
      
      // ✅ NÃO filtra isHidden — a prestação mostra todas as despesas,
      // inclusive as marcadas como ocultas (QUINZENA, AJUDA, etc.)
      return true;
    }).map(d => {
      const fichaStr = String(d.ficha || '').trim();
      const rotaDaFicha = fichaStr ? (fichaRotaMap.get(fichaStr) || '') : '';
      return { ...d, rota: d.rota && d.rota.trim() ? d.rota : rotaDaFicha };
    }).sort((a, b) => (a.data || '').localeCompare(b.data || ''));
    
    console.log(`[AG-Despesas] Gerente: "${gerenteNome}" | Rota: ${rotaPad} | Total window.despesas: ${todasDespesas.length} | Encontradas: ${result.length} | Período: ${de} → ${ate}`);
    return result;
  }
  
  function buscarPagamentos(gerenteRota, gerenteNome, de, ate) {
    const pagamentos = [];
    
    // ✅ BUSCA EM window.lanc (tabela lancamentos do Supabase)
    const lancamentos = window.lanc || [];
    const matchGerente = criarMatcherGerente(gerenteNome);
    
    lancamentos.forEach(f => {
      if (!matchGerente(f.gerente)) return;
      
      const dataF = f.data || '';
      if (dataF < de || dataF > ate) return;
      
      const isPago     = (f.status || '').toUpperCase() === 'PAGO';
      const isRecebido = (f.status || '').toUpperCase() === 'RECEBIDO';
      
      const categoria = (f.categoria || '').toLowerCase();
      let tipoLabel = 'Outros';
      if (categoria.includes('adiantamento'))                       tipoLabel = 'Adiantamento';
      else if (categoria.includes('prest') || categoria.includes('comiss'))
        tipoLabel = isPago ? 'Pagamento' : 'Recebimento';
      else if (isPago)     tipoLabel = 'Pagamento';
      else if (isRecebido) tipoLabel = 'Recebimento';
      
      pagamentos.push({
        data: dataF, tipo: tipoLabel,
        descricao: f.categoria || '-',
        valor: Number(f.valor) || 0,
        formaPgto: f.forma || 'PIX',
        isPago, isRecebido,
        origem: 'lancamento',
        id: f.uid || f.id
      });
    });
    
    // Também busca nos vales como fallback
    const vales = window.vales || [];
    
    vales.forEach(v => {
      const vGerente = String(v.gerenteNumero || v.gerente || '');
      if (!matchGerente(vGerente)) return;
      
      const dataVale = v.data || '';
      if (dataVale >= de && dataVale <= ate) {
        // Verifica se já não existe no financeiro (evita duplicata)
        const jáExiste = pagamentos.some(p => 
          p.data === dataVale && 
          Math.abs(p.valor - (Number(v.valor) || 0)) < 0.01 &&
          p.tipo === 'Adiantamento'
        );
        
        if (!jáExiste) {
          pagamentos.push({
            data: dataVale,
            tipo: 'Adiantamento',
            descricao: v.obs || v.descricao || 'Adiantamento (Vale)',
            valor: Number(v.valor) || 0,
            isPago: true,
            origem: 'vale',
            valeId: v.id
          });
        }
      }
    });
    
    // Ordena por data
    return pagamentos.sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  }
  
  // ============================================
  // CALCULAR RESUMO
  // ============================================
  
  function calcularResumo() {
    const { prestacoes, despesas, pagamentos } = dadosAnalise;
    
    // Total de coletas (soma das prestações)
    const totalColetas = prestacoes.reduce((sum, p) => {
      const coletas = Number(p.resumo?.coletas) || Number(p.coletas) || 0;
      return sum + coletas;
    }, 0);
    
    // Total de despesas
    const totalDespesas = despesas.reduce((sum, d) => {
      return sum + (Number(d.valor) || 0);
    }, 0);
    
    // Total de comissões
    const totalComissao = prestacoes.reduce((sum, p) => {
      const comissao = Number(p.resumo?.comissaoVal) || 
                       Number(p.resumo?.comis1) + Number(p.resumo?.comis2 || 0) ||
                       0;
      return sum + comissao;
    }, 0);
    
    const { totalPago, totalRecebido } = somarCaixa(pagamentos);

    // Resultado das prestações (Coletas - Despesas)
    const totalResultado = prestacoes.reduce((sum, p) => {
      const resultado = Number(p.resumo?.resultado) || 0;
      return sum + resultado;
    }, 0);

    const totalPagamentos = totalPago;

    // Saldo = fluxo líquido de caixa (Recebido - Pago)
    const saldo = totalRecebido - totalPago;
    
    dadosAnalise.resumo = {
      totalColetas,
      totalDespesas,
      totalComissao,
      totalPagamentos,
      totalPago,
      totalRecebido,
      totalResultado,
      saldo
    };
    
    console.log('[Análise Gerente] Resumo calculado:', dadosAnalise.resumo);
  }
  
  // ============================================
  // RENDER CARDS
  // ============================================
  
  // Direção do movimento decidida pelo STATUS do lançamento (RECEBIDO = entrou,
  // PAGO = saiu). O tipo ("Adiantamento", etc.) é só descritivo.
  function ehSaida(pg) {
    if (pg.isPago) return true;
    if (pg.isRecebido) return false;
    return pg.tipo === 'Adiantamento' || pg.tipo === 'Pagamento';
  }

  function somarCaixa(lista) {
    let totalPago = 0, totalRecebido = 0;
    (lista || []).forEach(pg => {
      const v = Number(pg.valor) || 0;
      if (ehSaida(pg)) totalPago += v; else totalRecebido += v;
    });
    return { totalPago, totalRecebido };
  }

  function filtrarPagamentos(filtroDe = '', filtroAte = '', filtroTipo = '') {
    let lista = dadosAnalise.pagamentos || [];
    if (filtroDe)  lista = lista.filter(p => (p.data || '') >= filtroDe);
    if (filtroAte) lista = lista.filter(p => (p.data || '') <= filtroAte);
    if (filtroTipo === 'recebimento') lista = lista.filter(p => !ehSaida(p));
    else if (filtroTipo === 'pagamento') lista = lista.filter(p => ehSaida(p));
    return lista;
  }

  function filtrosPagamentosAtuais() {
    return {
      de:   document.getElementById('agPagDe')?.value || '',
      ate:  document.getElementById('agPagAte')?.value || '',
      tipo: document.getElementById('agFiltroTipoPag')?.value || ''
    };
  }

  function saldoTexto(saldo) {
    if (saldo > 0) return fmtBRL(saldo) + ' (entrou mais)';
    if (saldo < 0) return fmtBRL(Math.abs(saldo)) + ' (saiu mais)';
    return 'R$ 0,00 (zerado)';
  }

  function atualizarCardsCaixa(lista) {
    const { totalPago, totalRecebido } = somarCaixa(lista);
    const saldo = totalRecebido - totalPago;

    document.getElementById('agTotalPagamentos').textContent = fmtBRL(totalPago);
    const sub = document.getElementById('agTotalRecebidosSub');
    if (sub) sub.textContent = 'Recebido: ' + fmtBRL(totalRecebido);

    const saldoEl = document.getElementById('agSaldo');
    const saldoCard = saldoEl.closest('.ag-card');
    saldoCard.classList.remove('ag-card-positivo', 'ag-card-negativo');
    if (saldo > 0) saldoCard.classList.add('ag-card-positivo');
    else if (saldo < 0) saldoCard.classList.add('ag-card-negativo');
    saldoEl.textContent = saldoTexto(saldo);
  }

  // Recalcula cards respeitando filtros de data e tipo
  function recalcularCards(filtroDe = '', filtroAte = '', filtroTipo = '') {
    atualizarCardsCaixa(filtrarPagamentos(filtroDe, filtroAte, filtroTipo));
  }

  function renderCards() {
    const { totalColetas, totalDespesas, totalComissao } = dadosAnalise.resumo;

    document.getElementById('agTotalColetas').textContent = fmtBRL(totalColetas);
    document.getElementById('agTotalDespesas').textContent = fmtBRL(totalDespesas);
    document.getElementById('agTotalComissao').textContent = fmtBRL(totalComissao);
    atualizarCardsCaixa(dadosAnalise.pagamentos);
  }
  
  // ============================================
  // RENDER TABELAS
  // ============================================
  
  function renderTabelaPrestacoes() {
    const tbody = document.getElementById('agBodyPrestacoes');
    const badge = document.getElementById('agBadgePrestacoes');
    const { prestacoes } = dadosAnalise;
    
    badge.textContent = prestacoes.length;
    
    if (prestacoes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="ag-empty">Nenhuma prestação encontrada</td></tr>';
      // Limpa totais
      document.getElementById('agTotalColetasTabela').textContent = 'R$ 0,00';
      document.getElementById('agTotalDespPrestTabela').textContent = 'R$ 0,00';
      document.getElementById('agTotalComissaoTabela').textContent = 'R$ 0,00';
      document.getElementById('agTotalResultadoTabela').textContent = 'R$ 0,00';
      return;
    }
    
    let html = '';
    let somaColetas = 0;
    let somaDespesas = 0;
    let somaComissao = 0;
    let somaResultado = 0;
    
    prestacoes.forEach(p => {
      const periodo = `${formatDateBR(p.ini || p.periodoIni)} a ${formatDateBR(p.fim || p.periodoFim)}`;
      const coletas = Number(p.resumo?.coletas) || 0;
      const despesas = Number(p.resumo?.despesas) || 0;
      const comissao = Number(p.resumo?.comissaoVal) || Number(p.resumo?.comis1 || 0) + Number(p.resumo?.comis2 || 0);
      const resultado = Number(p.resumo?.resultado) || 0;
      const restam = Number(p.resumo?.restam) || 0;
      
      somaColetas += coletas;
      somaDespesas += despesas;
      somaComissao += comissao;
      somaResultado += resultado;
      
      let status = 'Quitada';
      let statusClass = 'status-ok';
      if (restam > 0) {
        status = `Restam ${fmtBRL(restam)}`;
        statusClass = 'status-pendente';
      }
      
      html += `
        <tr>
          <td>${esc(periodo)}</td>
          <td class="valor">${fmtBRL(coletas)}</td>
          <td class="valor despesa">${fmtBRL(despesas)}</td>
          <td class="valor">${fmtBRL(comissao)}</td>
          <td class="valor">${fmtBRL(resultado)}</td>
          <td class="${statusClass}">${status}</td>
        </tr>
      `;
    });
    
    tbody.innerHTML = html;
    
    // Atualiza totais no tfoot
    document.getElementById('agTotalColetasTabela').textContent = fmtBRL(somaColetas);
    document.getElementById('agTotalDespPrestTabela').textContent = fmtBRL(somaDespesas);
    document.getElementById('agTotalComissaoTabela').textContent = fmtBRL(somaComissao);
    document.getElementById('agTotalResultadoTabela').textContent = fmtBRL(somaResultado);
  }
  
  function renderTabelaDespesas(filtro = '', filtroRota = '') {
    const tbody = document.getElementById('agBodyDespesas');
    const badge = document.getElementById('agBadgeDespesas');
    let { despesas } = dadosAnalise;
    
    // Popula select de rotas apenas na primeira chamada (sem filtros ativos)
    // Evita resetar a seleção do usuário a cada re-render
    if (!filtro && !filtroRota) popularSelectRotas(despesas);
    
    // Aplica filtro de rota
    if (filtroRota) {
      if (filtroRota === '-') {
        // Filtra despesas sem rota
        despesas = despesas.filter(d => !d.rota || d.rota.trim() === '');
      } else {
        despesas = despesas.filter(d => (d.rota || '') === filtroRota);
      }
    }
    
    // Aplica filtro de busca
    if (filtro && filtro.trim()) {
      const termo = filtro.toLowerCase().trim();
      despesas = despesas.filter(d => {
        const info = (d.info || d.descricao || '').toLowerCase();
        const ficha = (d.ficha || '').toLowerCase();
        const rota = (d.rota || '').toLowerCase();
        return info.includes(termo) || ficha.includes(termo) || rota.includes(termo);
      });
    }
    
    badge.textContent = despesas.length;
    
    if (despesas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="ag-empty">Nenhuma despesa encontrada</td></tr>';
      document.getElementById('agTotalDespesasTabela').textContent = 'R$ 0,00';
      return;
    }
    
    let html = '';
    let somaValor = 0;
    
    despesas.forEach(d => {
      const valor = Number(d.valor) || 0;
      somaValor += valor;
      const rota = d.rota && d.rota.trim() ? d.rota : '-';
      
      html += `
        <tr>
          <td>${formatDateBR(d.data)}</td>
          <td class="rota-cell">${esc(rota)}</td>
          <td>${esc(d.ficha || '-')}</td>
          <td>${esc(d.info || d.descricao || '-')}</td>
          <td class="valor despesa">${fmtBRL(valor)}</td>
        </tr>
      `;
    });
    
    tbody.innerHTML = html;
    
    // Total filtrado (linhas visíveis)
    const totalGeralDesp = dadosAnalise.despesas.reduce((s, d) => s + (Number(d.valor) || 0), 0);
    const totalEl = document.getElementById('agTotalDespesasTabela');
    
    if ((filtro || filtroRota) && somaValor !== totalGeralDesp) {
      // Mostra total filtrado + total geral entre parênteses
      totalEl.innerHTML = `${fmtBRL(somaValor)} <small style="color:#9ca3af;font-weight:400;">(total: ${fmtBRL(totalGeralDesp)})</small>`;
    } else {
      totalEl.textContent = fmtBRL(somaValor);
    }
  }
  
  function popularSelectRotas(despesas) {
    const select = document.getElementById('agFiltroRota');
    if (!select) return;
    
    // Coleta todas as rotas únicas
    const rotasSet = new Set();
    let temSemRota = false;
    
    despesas.forEach(d => {
      const rota = (d.rota || '').trim();
      if (rota) {
        rotasSet.add(rota);
      } else {
        temSemRota = true;
      }
    });
    
    // Ordena rotas
    const rotasOrdenadas = Array.from(rotasSet).sort((a, b) => {
      // Tenta ordenar numericamente se possível
      const numA = parseInt(a);
      const numB = parseInt(b);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.localeCompare(b);
    });
    
    // Monta options
    let options = '<option value="">Todas as rotas</option>';
    
    if (temSemRota) {
      options += '<option value="-">- (sem rota)</option>';
    }
    
    rotasOrdenadas.forEach(rota => {
      options += `<option value="${rota}">${rota}</option>`;
    });
    
    select.innerHTML = options;
  }
  
  function renderTabelaPagamentos(filtroDe = '', filtroAte = '', filtroTipo = '') {
    const lista = filtrarPagamentos(filtroDe, filtroAte, filtroTipo);
    const recebimentos = lista.filter(p => !ehSaida(p));
    const pagos        = lista.filter(p => ehSaida(p));
    const { totalPago, totalRecebido } = somarCaixa(lista);

    document.getElementById('agBadgePagamentos').textContent = lista.length;
    document.getElementById('agBadgeRecebimentos').textContent = recebimentos.length;
    document.getElementById('agBadgeSoPagamentos').textContent = pagos.length;

    // Com filtro de tipo, mostra só o bloco correspondente
    document.getElementById('agBlocoRecebimentos').style.display = filtroTipo === 'pagamento' ? 'none' : '';
    document.getElementById('agBlocoPagamentos').style.display   = filtroTipo === 'recebimento' ? 'none' : '';

    const forma = pg => pg.formaPgto ? esc(pg.formaPgto) : '-';

    document.getElementById('agBodyRecebimentos').innerHTML = recebimentos.length
      ? recebimentos.map(pg => `
        <tr>
          <td>${formatDateBR(pg.data)}</td>
          <td>${forma(pg)}</td>
          <td>${esc(pg.descricao || '-')}</td>
          <td class="valor" style="color:#059669">${fmtBRL(pg.valor)}</td>
        </tr>`).join('')
      : '<tr><td colspan="4" class="ag-empty">Nenhum recebimento</td></tr>';

    document.getElementById('agBodyPagamentos').innerHTML = pagos.length
      ? pagos.map(pg => {
          const tipoClass = pg.tipo === 'Adiantamento' ? 'tipo-adiant' : 'tipo-pago';
          const tipoTxt   = pg.tipo === 'Adiantamento' ? 'Adiantamento' : 'Pagamento';
          return `
        <tr>
          <td>${formatDateBR(pg.data)}</td>
          <td><span class="${tipoClass}">${tipoTxt}</span></td>
          <td>${forma(pg)}</td>
          <td>${esc(pg.descricao || '-')}</td>
          <td class="valor despesa">${fmtBRL(pg.valor)}</td>
        </tr>`;
        }).join('')
      : '<tr><td colspan="5" class="ag-empty">Nenhum pagamento</td></tr>';

    document.getElementById('agTotalRecTabela').textContent = fmtBRL(totalRecebido);
    document.getElementById('agTotalPagTabela').textContent = fmtBRL(totalPago);

    const saldo = totalRecebido - totalPago;
    const saldoEl = document.getElementById('agTotalPagamentosTabela');
    saldoEl.textContent = saldoTexto(saldo);
    saldoEl.style.color = saldo > 0 ? '#059669' : saldo < 0 ? '#dc2626' : '';
  }
  
  // ============================================
  // EXPORTAR PDF
  // ============================================
  
  function exportarPDF() {
    if (!currentGerente) {
      alert('Nenhuma análise carregada');
      return;
    }

    const { prestacoes, despesas, resumo } = dadosAnalise;
    const f = filtrosPagamentosAtuais();
    const listaCaixa   = filtrarPagamentos(f.de, f.ate, f.tipo);
    const recebimentos = listaCaixa.filter(p => !ehSaida(p));
    const pagos        = listaCaixa.filter(p => ehSaida(p));
    const { totalPago, totalRecebido } = somarCaixa(listaCaixa);
    const saldoCaixa = totalRecebido - totalPago;

    const filtrosTxt = [];
    if (f.de || f.ate) filtrosTxt.push(`Recebimentos/Pagamentos de ${f.de ? formatDateBR(f.de) : '…'} a ${f.ate ? formatDateBR(f.ate) : '…'}`);
    if (f.tipo === 'recebimento') filtrosTxt.push('Só recebimentos');
    if (f.tipo === 'pagamento')   filtrosTxt.push('Só pagamentos');

    let tCol = 0, tDes = 0, tCom = 0, tRes = 0;
    const linhasPrest = prestacoes.map(p => {
      const coletas   = Number(p.resumo?.coletas) || 0;
      const desp      = Number(p.resumo?.despesas) || 0;
      const comissao  = Number(p.resumo?.comissaoVal) || Number(p.resumo?.comis1 || 0) + Number(p.resumo?.comis2 || 0);
      const resultado = Number(p.resumo?.resultado) || 0;
      const restam    = Number(p.resumo?.restam) || 0;
      tCol += coletas; tDes += desp; tCom += comissao; tRes += resultado;
      return `<tr>
        <td>${esc(formatDateBR(p.ini || p.periodoIni))} a ${esc(formatDateBR(p.fim || p.periodoFim))}</td>
        <td class="num">${fmtBRL(coletas)}</td>
        <td class="num neg">${fmtBRL(desp)}</td>
        <td class="num">${fmtBRL(comissao)}</td>
        <td class="num ${resultado < 0 ? 'neg' : 'pos'}">${fmtBRL(resultado)}</td>
        <td>${restam > 0 ? 'Restam ' + fmtBRL(restam) : 'Quitada'}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="6" class="vazio">Nenhuma prestação no período.</td></tr>';

    const linhasDesp = despesas.map(d => `<tr>
        <td class="data">${esc(formatDateBR(d.data))}</td>
        <td>${esc(d.rota && d.rota.trim() ? d.rota : '-')}</td>
        <td>${esc(d.ficha || '-')}</td>
        <td>${esc(d.info || d.descricao || '-')}</td>
        <td class="num neg">${fmtBRL(d.valor)}</td>
      </tr>`).join('') || '<tr><td colspan="5" class="vazio">Nenhuma despesa no período.</td></tr>';

    const linhasRec = recebimentos.map(pg => `<tr>
        <td class="data">${esc(formatDateBR(pg.data))}</td>
        <td>${esc(pg.formaPgto || '-')}</td>
        <td>${esc(pg.descricao || '-')}</td>
        <td class="num pos">${fmtBRL(pg.valor)}</td>
      </tr>`).join('') || '<tr><td colspan="4" class="vazio">Nenhum recebimento.</td></tr>';

    const linhasPag = pagos.map(pg => `<tr>
        <td class="data">${esc(formatDateBR(pg.data))}</td>
        <td>${pg.tipo === 'Adiantamento' ? 'Adiantamento' : 'Pagamento'}</td>
        <td>${esc(pg.formaPgto || '-')}</td>
        <td>${esc(pg.descricao || '-')}</td>
        <td class="num neg">${fmtBRL(pg.valor)}</td>
      </tr>`).join('') || '<tr><td colspan="5" class="vazio">Nenhum pagamento.</td></tr>';

    const titulo = `${esc(currentGerente.nome || '')}`;
    const periodo = `${esc(formatDateBR(currentPeriodo.de))} a ${esc(formatDateBR(currentPeriodo.ate))}`;
    const empresa = esc(window.getCompany?.() || '');
    const emitido = new Date().toLocaleString('pt-BR');

    const html = `<!doctype html><html><head><meta charset="utf-8">
<title>Análise - ${titulo}</title>
<style>
  @page { size: A4 portrait; margin: 8mm 10mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; color: #111; margin: 0; font-size: 11px; }
  .header { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid #111; padding-bottom:6px; margin-bottom:8px; }
  .header-title { font-size:17px; font-weight:700; }
  .header-sub { font-size:10px; color:#555; margin-top:2px; }
  .header-right { font-size:10px; color:#666; text-align:right; }
  .cards { display:grid; grid-template-columns:repeat(5,1fr); gap:6px; margin-bottom:10px; }
  .card { border:1px solid #e5e7eb; border-left:4px solid #999; border-radius:6px; padding:6px 8px; }
  .card .lbl { font-size:9px; text-transform:uppercase; color:#555; letter-spacing:.3px; }
  .card .val { font-size:13px; font-weight:700; margin-top:2px; }
  .card .sub { font-size:9px; color:#555; margin-top:1px; }
  .c-col { border-left-color:#10b981; } .c-des { border-left-color:#ef4444; } .c-com { border-left-color:#f59e0b; }
  .c-pag { border-left-color:#3b82f6; } .c-sal { border-left-color:#8b5cf6; }
  .secao { margin-bottom:10px; }
  .secao h3 { font-size:12px; margin:0 0 3px; padding:5px 8px; color:#fff; border-radius:4px 4px 0 0;
              print-color-adjust:exact; -webkit-print-color-adjust:exact; }
  .h-prest h3 { background:#0f172a; } .h-desp h3 { background:#b45309; }
  .h-rec h3 { background:#16a34a; } .h-pag h3 { background:#dc2626; }
  .secao h3 small { font-weight:400; opacity:.9; margin-left:6px; }
  thead { display:table-header-group; }
  tr { page-break-inside:avoid; }
  table { width:100%; border-collapse:collapse; font-size:10px; }
  th, td { padding:4px 6px; border-bottom:1px solid #e5e7eb; text-align:left; }
  th { background:#f3f4f6; text-transform:uppercase; font-size:9px; letter-spacing:.3px; }
  td.num { text-align:right; font-family:ui-monospace, monospace; font-weight:600; white-space:nowrap; }
  td.data { white-space:nowrap; }
  .pos { color:#047857; } .neg { color:#b91c1c; }
  tfoot td { background:#f9fafb; font-weight:700; border-top:2px solid #333; border-bottom:none; }
  .vazio { text-align:center; color:#6b7280; font-style:italic; padding:10px !important; }
  .saldo { display:flex; justify-content:space-between; align-items:center; margin-top:4px; padding:8px 12px;
           border-radius:6px; background:${saldoCaixa >= 0 ? '#ecfdf5' : '#fef2f2'};
           border-left:4px solid ${saldoCaixa >= 0 ? '#059669' : '#dc2626'};
           print-color-adjust:exact; -webkit-print-color-adjust:exact; }
  .saldo .lbl { font-size:10px; text-transform:uppercase; color:#555; }
  .saldo .val { font-size:15px; font-weight:700; color:${saldoCaixa >= 0 ? '#047857' : '#b91c1c'}; }
  .print-btn { position:fixed; top:16px; right:16px; padding:10px 18px; background:#2563eb; color:#fff; border:none;
               border-radius:8px; font-weight:700; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,.15); }
  @media print { .print-btn { display:none; } }
</style></head><body>
  <button class="print-btn" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>

  <div class="header">
    <div>
      <div class="header-title">📊 Análise — ${titulo}</div>
      <div class="header-sub">Período: <strong>${periodo}</strong>${empresa ? ' • ' + empresa : ''}${filtrosTxt.length ? ' • ' + esc(filtrosTxt.join(' • ')) : ''}</div>
    </div>
    <div class="header-right">Emitido em: <strong>${esc(emitido)}</strong></div>
  </div>

  <div class="cards">
    <div class="card c-col"><div class="lbl">Total Coletas</div><div class="val">${fmtBRL(resumo.totalColetas)}</div></div>
    <div class="card c-des"><div class="lbl">Total Despesas</div><div class="val">${fmtBRL(resumo.totalDespesas)}</div></div>
    <div class="card c-com"><div class="lbl">Comissões</div><div class="val">${fmtBRL(resumo.totalComissao)}</div></div>
    <div class="card c-pag"><div class="lbl">Pago ao gerente</div><div class="val">${fmtBRL(totalPago)}</div><div class="sub">Recebido: ${fmtBRL(totalRecebido)}</div></div>
    <div class="card c-sal"><div class="lbl">Saldo (Receb. − Pago)</div><div class="val">${saldoTexto(saldoCaixa)}</div></div>
  </div>

  <div class="secao h-prest">
    <h3>📋 Prestações / Coletas <small>(${prestacoes.length})</small></h3>
    <table>
      <thead><tr><th>Período</th><th style="text-align:right">Coletas</th><th style="text-align:right">Despesas</th><th style="text-align:right">Comissão</th><th style="text-align:right">Resultado</th><th>Status</th></tr></thead>
      <tbody>${linhasPrest}</tbody>
      ${prestacoes.length ? `<tfoot><tr><td>TOTAL</td><td class="num">${fmtBRL(tCol)}</td><td class="num neg">${fmtBRL(tDes)}</td><td class="num">${fmtBRL(tCom)}</td><td class="num ${tRes < 0 ? 'neg' : 'pos'}">${fmtBRL(tRes)}</td><td></td></tr></tfoot>` : ''}
    </table>
  </div>

  <div class="secao h-desp">
    <h3>💸 Despesas Detalhadas <small>(${despesas.length} — ${fmtBRL(resumo.totalDespesas)})</small></h3>
    <table>
      <thead><tr><th>Data</th><th>Rota</th><th>Ficha</th><th>Descrição</th><th style="text-align:right">Valor</th></tr></thead>
      <tbody>${linhasDesp}</tbody>
      ${despesas.length ? `<tfoot><tr><td colspan="4" style="text-align:right">TOTAL DESPESAS:</td><td class="num neg">${fmtBRL(resumo.totalDespesas)}</td></tr></tfoot>` : ''}
    </table>
  </div>

  ${f.tipo === 'pagamento' ? '' : `
  <div class="secao h-rec">
    <h3>📥 Recebimentos — o gerente entregou <small>(${recebimentos.length} — ${fmtBRL(totalRecebido)})</small></h3>
    <table>
      <thead><tr><th>Data</th><th>Forma</th><th>Descrição</th><th style="text-align:right">Valor</th></tr></thead>
      <tbody>${linhasRec}</tbody>
      ${recebimentos.length ? `<tfoot><tr><td colspan="3" style="text-align:right">TOTAL RECEBIDO:</td><td class="num pos">${fmtBRL(totalRecebido)}</td></tr></tfoot>` : ''}
    </table>
  </div>`}

  ${f.tipo === 'recebimento' ? '' : `
  <div class="secao h-pag">
    <h3>📤 Pagamentos — a empresa pagou ao gerente <small>(${pagos.length} — ${fmtBRL(totalPago)})</small></h3>
    <table>
      <thead><tr><th>Data</th><th>Tipo</th><th>Forma</th><th>Descrição</th><th style="text-align:right">Valor</th></tr></thead>
      <tbody>${linhasPag}</tbody>
      ${pagos.length ? `<tfoot><tr><td colspan="4" style="text-align:right">TOTAL PAGO:</td><td class="num neg">${fmtBRL(totalPago)}</td></tr></tfoot>` : ''}
    </table>
  </div>`}

  <div class="saldo">
    <span class="lbl">Saldo (Recebido ${fmtBRL(totalRecebido)} − Pago ${fmtBRL(totalPago)})</span>
    <span class="val">${saldoTexto(saldoCaixa)}</span>
  </div>

  <script>setTimeout(() => window.print(), 300);<\/script>
</body></html>`;

    let w = null;
    try { w = window.open('', '_blank'); } catch (_) {}
    if (w && w.document) {
      w.document.open();
      w.document.write(html);
      w.document.close();
      try { w.focus(); } catch (_) {}
      return;
    }
    // Popup bloqueado: abre via Blob em nova aba
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  
  // ============================================
  // EXPORTAR EXCEL
  // ============================================
  
  async function exportarExcel() {
    if (!currentGerente) {
      alert('Nenhuma análise carregada');
      return;
    }
    
    console.log('[Análise Gerente] 📊 Exportando Excel...');
    
    // Verifica se XLSX está disponível
    if (typeof XLSX === 'undefined') {
      alert('Biblioteca XLSX não encontrada. Não é possível exportar.');
      return;
    }
    
    const wb = XLSX.utils.book_new();
    
    // Aba Resumo
    const resumoData = [
      ['ANÁLISE POR GERENTE'],
      [''],
      ['Gerente:', `${currentGerente.numero || ''} - ${currentGerente.nome || ''}`],
      ['Período:', `${formatDateBR(currentPeriodo.de)} a ${formatDateBR(currentPeriodo.ate)}`],
      [''],
      ['RESUMO'],
      ['Total Coletas', dadosAnalise.resumo.totalColetas],
      ['Total Despesas', dadosAnalise.resumo.totalDespesas],
      ['Comissões', dadosAnalise.resumo.totalComissao],
      ['Recebido do gerente', dadosAnalise.resumo.totalRecebido],
      ['Pago ao gerente', dadosAnalise.resumo.totalPago],
      ['Saldo (Recebido - Pago)', dadosAnalise.resumo.saldo]
    ];
    const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');
    
    // Aba Prestações
    const prestData = [
      ['Período Início', 'Período Fim', 'Coletas', 'Despesas', 'Comissão', 'Resultado', 'Restam']
    ];
    dadosAnalise.prestacoes.forEach(p => {
      prestData.push([
        p.periodoIni || '',
        p.periodoFim || '',
        Number(p.resumo?.coletas) || 0,
        Number(p.resumo?.despesas) || 0,
        Number(p.resumo?.comissaoVal) || 0,
        Number(p.resumo?.resultado) || 0,
        Number(p.resumo?.restam) || 0
      ]);
    });
    const wsPrest = XLSX.utils.aoa_to_sheet(prestData);
    XLSX.utils.book_append_sheet(wb, wsPrest, 'Prestações');
    
    // Aba Despesas
    const despData = [
      ['Data', 'Ficha', 'Descrição', 'Valor']
    ];
    dadosAnalise.despesas.forEach(d => {
      despData.push([
        d.data || '',
        d.ficha || '',
        d.info || d.descricao || '',
        Number(d.valor) || 0
      ]);
    });
    const wsDesp = XLSX.utils.aoa_to_sheet(despData);
    XLSX.utils.book_append_sheet(wb, wsDesp, 'Despesas');
    
    // Aba Pagamentos
    const pagData = [
      ['Data', 'Entrada/Saída', 'Tipo', 'Forma', 'Descrição', 'Valor']
    ];
    dadosAnalise.pagamentos.forEach(pg => {
      pagData.push([
        pg.data || '',
        ehSaida(pg) ? 'Saída (pago)' : 'Entrada (recebido)',
        pg.tipo || '',
        pg.formaPgto || '',
        pg.descricao || '',
        Number(pg.valor) || 0
      ]);
    });
    const wsPag = XLSX.utils.aoa_to_sheet(pagData);
    XLSX.utils.book_append_sheet(wb, wsPag, 'Pagamentos');
    
    // Download
    const fileName = `analise_${currentGerente.numero}_${currentPeriodo.de}_${currentPeriodo.ate}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    console.log('[Análise Gerente] ✅ Excel exportado');
  }
  
  // ============================================
  // ESTILOS
  // ============================================
  
  function injectStyles() {
    if (document.getElementById('ag-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'ag-styles';
    style.textContent = `
      .analise-gerente-page {
        padding: 20px;
        max-width: 1400px;
        margin: 0 auto;
      }
      
      /* Filtros */
      .ag-filtros {
        margin-bottom: 20px;
        padding: 20px;
      }
      
      .ag-filtros-row {
        display: flex;
        flex-wrap: wrap;
        gap: 15px;
        align-items: flex-end;
      }
      
      .ag-filtro-group {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      
      .ag-filtro-group label {
        font-size: 12px;
        font-weight: 600;
        color: #6b7280;
        text-transform: uppercase;
      }
      
      .ag-filtro-group .input {
        min-width: 180px;
        padding: 8px 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 14px;
      }
      
      .ag-filtro-btn {
        margin-left: auto;
      }
      
      /* Cards */
      .ag-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
        margin-bottom: 20px;
      }
      
      .ag-card {
        background: #fff;
        border-radius: 12px;
        padding: 20px;
        display: flex;
        align-items: center;
        gap: 15px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        border-left: 4px solid #e5e7eb;
      }
      
      .ag-card-coletas { border-left-color: #10b981; }
      .ag-card-despesas { border-left-color: #ef4444; }
      .ag-card-comissao { border-left-color: #f59e0b; }
      .ag-card-pagamentos { border-left-color: #3b82f6; }
      .ag-card-saldo { border-left-color: #8b5cf6; }
      .ag-card-positivo { border-left-color: #10b981; background: #f0fdf4; }
      .ag-card-negativo { border-left-color: #ef4444; background: #fef2f2; }
      
      .ag-card-icon {
        font-size: 32px;
      }
      
      .ag-card-info {
        display: flex;
        flex-direction: column;
      }
      
      .ag-card-label {
        font-size: 12px;
        color: #6b7280;
        text-transform: uppercase;
        font-weight: 600;
      }
      
      .ag-card-value {
        font-size: 22px;
        font-weight: 700;
        color: #1f2937;
      }
      
      .ag-card-sub {
        font-size: 12px;
        color: #059669;
        font-weight: 600;
        margin-top: 2px;
      }

      /* Recebimentos / Pagamentos */
      .ag-sub-title {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 15px;
        font-weight: 700;
        font-size: 14px;
        border-bottom: 1px solid #e5e7eb;
      }
      .ag-sub-title small { font-weight: 400; color: #6b7280; flex: 1; }
      .ag-sub-rec { background: #ecfdf5; color: #065f46; border-left: 4px solid #10b981; }
      .ag-sub-pag { background: #fef2f2; color: #991b1b; border-left: 4px solid #ef4444; margin-top: 14px; }
      .ag-sub-rec .ag-secao-badge { background: #10b981; }
      .ag-sub-pag .ag-secao-badge { background: #ef4444; }
      .ag-saldo-caixa {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin: 14px 15px 15px;
        padding: 12px 15px;
        border-radius: 8px;
        background: #f3f4f6;
        font-weight: 600;
      }
      .ag-saldo-caixa strong { font-size: 16px; font-family: 'Courier New', monospace; }

      /* Export */
      .ag-export {
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
      }
      
      /* Seções */
      .ag-secao {
        margin-bottom: 15px;
      }
      
      .ag-secao-header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 15px 20px;
        cursor: pointer;
        user-select: none;
        background: #f9fafb;
        border-radius: 8px 8px 0 0;
        border-bottom: 1px solid #e5e7eb;
      }
      
      .ag-secao-header:hover {
        background: #f3f4f6;
      }
      
      .ag-secao-header h3 {
        margin: 0;
        font-size: 16px;
        flex: 1;
      }
      
      .ag-secao-badge {
        background: #3b82f6;
        color: #fff;
        padding: 2px 10px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
      }
      
      .ag-secao-toggle {
        color: #9ca3af;
        font-size: 12px;
      }
      
      .ag-secao-content {
        padding: 0;
        overflow-x: auto;
      }
      
      /* Tabela */
      .ag-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
      }
      
      .ag-table th {
        background: #f9fafb;
        padding: 12px 15px;
        text-align: left;
        font-weight: 600;
        color: #374151;
        border-bottom: 2px solid #e5e7eb;
      }
      
      .ag-table td {
        padding: 12px 15px;
        border-bottom: 1px solid #f3f4f6;
      }
      
      .ag-table tr:hover {
        background: #f9fafb;
      }
      
      .ag-table .valor {
        font-family: 'Courier New', monospace;
        text-align: right;
      }
      
      .ag-table .despesa {
        color: #ef4444;
      }
      
      .ag-table .rota-cell {
        font-weight: 500;
        color: #6366f1;
      }
      
      .ag-table .status-ok {
        color: #10b981;
        font-weight: 600;
      }
      
      .ag-table .status-pendente {
        color: #f59e0b;
        font-weight: 600;
      }
      
      .ag-table .tipo-pix {
        background: #dbeafe;
        color: #1d4ed8;
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 12px;
      }
      
      .ag-table .tipo-adiant {
        background: #fef3c7;
        color: #b45309;
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 12px;
      }
      
      .ag-table .tipo-pago {
        background: #fee2e2;
        color: #dc2626;
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 12px;
      }
      
      .ag-table .tipo-receb {
        background: #d1fae5;
        color: #059669;
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 12px;
      }
      
      .ag-table .tipo-outros {
        background: #e5e7eb;
        color: #4b5563;
        padding: 3px 8px;
        border-radius: 4px;
        font-size: 12px;
      }
      
      /* Campo de busca */
      .ag-busca-container {
        padding: 10px 15px;
        background: #f9fafb;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        align-items: center;
      }
      
      .ag-filtro-rota {
        min-width: 150px;
        max-width: 200px;
        padding: 8px 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 14px;
      }
      
      .ag-busca-input {
        flex: 1;
        min-width: 200px;
        max-width: 400px;
        padding: 8px 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 14px;
      }
      
      .ag-busca-input:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }
      
      /* Total row no footer */
      .ag-table tfoot {
        background: #f3f4f6;
        border-top: 2px solid #e5e7eb;
      }
      
      .ag-total-row td {
        padding: 12px 15px;
        font-weight: 600;
      }
      
      .ag-total-row .valor {
        font-size: 15px;
      }
      
      .ag-empty {
        text-align: center;
        color: #9ca3af;
        font-style: italic;
        padding: 40px !important;
      }
      
      /* Inicial */
      .ag-inicial {
        text-align: center;
        padding: 80px 20px;
        color: #6b7280;
      }
      
      .ag-inicial-icon {
        font-size: 64px;
        margin-bottom: 20px;
      }
      
      .ag-inicial h2 {
        margin: 0 0 10px 0;
        color: #1f2937;
      }
      
      .ag-inicial p {
        margin: 0;
      }
      
      /* Dark mode */
      [data-theme="dark"] .ag-card {
        background: #1f2937;
      }
      
      [data-theme="dark"] .ag-card-value {
        color: #f9fafb;
      }
      
      [data-theme="dark"] .ag-table th {
        background: #374151;
        color: #f9fafb;
      }
      
      [data-theme="dark"] .ag-secao-header {
        background: #374151;
      }
      
      [data-theme="dark"] .ag-filtro-group .input {
        background: #374151;
        border-color: #4b5563;
        color: #f9fafb;
      }
    `;
    
    document.head.appendChild(style);
  }
  
  // ============================================
  // EXPORTA E INICIALIZA
  // ============================================
  
  window.AnaliseGerente = {
    init,
    executarAnalise,
    exportarPDF,
    exportarExcel
  };
  
  // Injeta estilos
  injectStyles();
  
  // ✅ REMOVIDO: MutationObserver causava loop infinito
  // O nav.js já chama AnaliseGerente.init() via afterShow quando a página é exibida
  
  console.log('[Análise Gerente] ✅ Módulo carregado');
  
})();