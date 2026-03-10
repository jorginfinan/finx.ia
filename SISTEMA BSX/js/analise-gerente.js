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
              <span class="ag-card-label">Pagamentos</span>
              <span class="ag-card-value" id="agTotalPagamentos">R$ 0,00</span>
            </div>
          </div>
          
          <div class="ag-card ag-card-saldo">
            <div class="ag-card-icon">📊</div>
            <div class="ag-card-info">
              <span class="ag-card-label">Saldo</span>
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
                    <th>Despesas</th>
                    <th>Comissão</th>
                    <th>Resultado</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody id="agBodyPrestacoes">
                  <tr><td colspan="6" class="ag-empty">Nenhuma prestação encontrada</td></tr>
                </tbody>
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
              <table class="ag-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Ficha</th>
                    <th>Descrição</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody id="agBodyDespesas">
                  <tr><td colspan="4" class="ag-empty">Nenhuma despesa encontrada</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <!-- PAGAMENTOS -->
          <div class="ag-secao card">
            <div class="ag-secao-header" data-toggle="agTabelaPagamentos">
              <h3>💳 Pagamentos ao Gerente</h3>
              <span class="ag-secao-badge" id="agBadgePagamentos">0</span>
              <span class="ag-secao-toggle">▼</span>
            </div>
            <div class="ag-secao-content" id="agTabelaPagamentos">
              <table class="ag-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Descrição</th>
                    <th>Valor</th>
                  </tr>
                </thead>
                <tbody id="agBodyPagamentos">
                  <tr><td colspan="4" class="ag-empty">Nenhum pagamento encontrado</td></tr>
                </tbody>
              </table>
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
    
    // Ordena por número
    const ordenados = [...gerentes].sort((a, b) => {
      const numA = String(a.numero || '').padStart(3, '0');
      const numB = String(b.numero || '').padStart(3, '0');
      return numA.localeCompare(numB);
    });
    
    let options = '<option value="">Selecione o gerente</option>';
    
    ordenados.forEach(g => {
      const num = g.numero || '';
      const nome = g.nome || '';
      const label = num ? `${num} - ${nome}` : nome;
      options += `<option value="${g.uid || g.id}">${esc(label)}</option>`;
    });
    
    select.innerHTML = options;
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
    const gerenteNum = currentGerente?.numero || '';
    const { de, ate } = currentPeriodo;
    
    // 1. PRESTAÇÕES
    dadosAnalise.prestacoes = buscarPrestacoes(gerenteNum, de, ate);
    
    // 2. DESPESAS
    dadosAnalise.despesas = buscarDespesas(gerenteNome, gerenteNum, de, ate);
    
    // 3. PAGAMENTOS (PIX + Adiantamentos)
    dadosAnalise.pagamentos = buscarPagamentos(gerenteNum, de, ate);
    
    console.log('[Análise Gerente] Dados carregados:', {
      prestacoes: dadosAnalise.prestacoes.length,
      despesas: dadosAnalise.despesas.length,
      pagamentos: dadosAnalise.pagamentos.length
    });
  }
  
  function buscarPrestacoes(gerenteNum, de, ate) {
    // Busca prestações salvas
    const todasPrestacoes = window.prestacoesSalvas || [];
    
    return todasPrestacoes.filter(p => {
      // Filtro por gerente
      const pGerente = p.gerenteNumero || p.gerente?.numero || '';
      if (pGerente !== gerenteNum) return false;
      
      // Filtro por período (usa periodoFim ou dataFim)
      const dataRef = p.periodoFim || p.dataFim || p.data || '';
      if (dataRef < de || dataRef > ate) return false;
      
      return true;
    }).sort((a, b) => {
      const dataA = a.periodoIni || a.dataIni || '';
      const dataB = b.periodoIni || b.dataIni || '';
      return dataA.localeCompare(dataB);
    });
  }
  
  function buscarDespesas(gerenteNome, gerenteNum, de, ate) {
    const todasDespesas = window.despesas || [];
    
    return todasDespesas.filter(d => {
      // Filtro por gerente (nome ou número no nome)
      const dGerente = (d.gerenteNome || '').toLowerCase();
      const nomeMatch = dGerente.includes(gerenteNome.toLowerCase());
      const numMatch = dGerente.includes(gerenteNum);
      
      if (!nomeMatch && !numMatch) return false;
      
      // Filtro por período
      const dataRef = d.data || d.periodoFim || '';
      if (dataRef < de || dataRef > ate) return false;
      
      // Ignora ocultas
      if (d.isHidden) return false;
      
      return true;
    }).sort((a, b) => {
      const dataA = a.data || '';
      const dataB = b.data || '';
      return dataA.localeCompare(dataB);
    });
  }
  
  function buscarPagamentos(gerenteNum, de, ate) {
    const pagamentos = [];
    
    // 1. Busca pagamentos das prestações (PIX)
    const prestacoes = window.prestacoesSalvas || [];
    
    prestacoes.forEach(p => {
      const pGerente = p.gerenteNumero || p.gerente?.numero || '';
      if (pGerente !== gerenteNum) return;
      
      // Pagamentos registrados na prestação
      const pgtos = p.pagamentos || p.resumo?.pagamentos || [];
      
      pgtos.forEach(pgto => {
        const dataPgto = pgto.data || pgto.dataPagamento || '';
        if (dataPgto >= de && dataPgto <= ate) {
          pagamentos.push({
            data: dataPgto,
            tipo: 'PIX',
            descricao: pgto.obs || `Pagamento prestação ${p.periodoIni || ''} a ${p.periodoFim || ''}`,
            valor: Number(pgto.valor) || 0,
            origem: 'prestacao',
            prestacaoId: p.id
          });
        }
      });
    });
    
    // 2. Busca adiantamentos (vales)
    const vales = window.vales || [];
    
    vales.forEach(v => {
      const vGerente = v.gerenteNumero || v.gerente || '';
      if (vGerente !== gerenteNum) return;
      
      const dataVale = v.data || '';
      if (dataVale >= de && dataVale <= ate) {
        pagamentos.push({
          data: dataVale,
          tipo: 'Adiantamento',
          descricao: v.obs || v.descricao || 'Adiantamento',
          valor: Number(v.valor) || 0,
          origem: 'vale',
          valeId: v.id
        });
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
    
    // Total de pagamentos
    const totalPagamentos = pagamentos.reduce((sum, pg) => {
      return sum + (Number(pg.valor) || 0);
    }, 0);
    
    // Saldo (Coletas - Despesas - Comissões - Pagamentos já feitos)
    // Na verdade, o que sobra para pagar seria: Resultado das prestações - Pagamentos
    const totalResultado = prestacoes.reduce((sum, p) => {
      const resultado = Number(p.resumo?.resultado) || 0;
      return sum + resultado;
    }, 0);
    
    const saldo = totalResultado - totalPagamentos;
    
    dadosAnalise.resumo = {
      totalColetas,
      totalDespesas,
      totalComissao,
      totalPagamentos,
      totalResultado,
      saldo
    };
    
    console.log('[Análise Gerente] Resumo calculado:', dadosAnalise.resumo);
  }
  
  // ============================================
  // RENDER CARDS
  // ============================================
  
  function renderCards() {
    const { totalColetas, totalDespesas, totalComissao, totalPagamentos, saldo } = dadosAnalise.resumo;
    
    document.getElementById('agTotalColetas').textContent = fmtBRL(totalColetas);
    document.getElementById('agTotalDespesas').textContent = fmtBRL(totalDespesas);
    document.getElementById('agTotalComissao').textContent = fmtBRL(totalComissao);
    document.getElementById('agTotalPagamentos').textContent = fmtBRL(totalPagamentos);
    
    const saldoEl = document.getElementById('agSaldo');
    saldoEl.textContent = fmtBRL(Math.abs(saldo));
    
    // Cor do saldo
    const saldoCard = saldoEl.closest('.ag-card');
    if (saldo > 0) {
      saldoCard.classList.remove('ag-card-negativo');
      saldoCard.classList.add('ag-card-positivo');
      saldoEl.textContent = fmtBRL(saldo) + ' (a pagar)';
    } else if (saldo < 0) {
      saldoCard.classList.remove('ag-card-positivo');
      saldoCard.classList.add('ag-card-negativo');
      saldoEl.textContent = fmtBRL(Math.abs(saldo)) + ' (pago a mais)';
    } else {
      saldoCard.classList.remove('ag-card-positivo', 'ag-card-negativo');
      saldoEl.textContent = 'R$ 0,00 (zerado)';
    }
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
      return;
    }
    
    let html = '';
    
    prestacoes.forEach(p => {
      const periodo = `${formatDateBR(p.periodoIni)} a ${formatDateBR(p.periodoFim)}`;
      const coletas = Number(p.resumo?.coletas) || 0;
      const despesas = Number(p.resumo?.despesas) || 0;
      const comissao = Number(p.resumo?.comissaoVal) || Number(p.resumo?.comis1 || 0) + Number(p.resumo?.comis2 || 0);
      const resultado = Number(p.resumo?.resultado) || 0;
      const restam = Number(p.resumo?.restam) || 0;
      
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
  }
  
  function renderTabelaDespesas() {
    const tbody = document.getElementById('agBodyDespesas');
    const badge = document.getElementById('agBadgeDespesas');
    const { despesas } = dadosAnalise;
    
    badge.textContent = despesas.length;
    
    if (despesas.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="ag-empty">Nenhuma despesa encontrada</td></tr>';
      return;
    }
    
    let html = '';
    
    despesas.forEach(d => {
      html += `
        <tr>
          <td>${formatDateBR(d.data)}</td>
          <td>${esc(d.ficha || '-')}</td>
          <td>${esc(d.info || d.descricao || '-')}</td>
          <td class="valor despesa">${fmtBRL(d.valor)}</td>
        </tr>
      `;
    });
    
    tbody.innerHTML = html;
  }
  
  function renderTabelaPagamentos() {
    const tbody = document.getElementById('agBodyPagamentos');
    const badge = document.getElementById('agBadgePagamentos');
    const { pagamentos } = dadosAnalise;
    
    badge.textContent = pagamentos.length;
    
    if (pagamentos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="ag-empty">Nenhum pagamento encontrado</td></tr>';
      return;
    }
    
    let html = '';
    
    pagamentos.forEach(pg => {
      const tipoClass = pg.tipo === 'Adiantamento' ? 'tipo-adiant' : 'tipo-pix';
      
      html += `
        <tr>
          <td>${formatDateBR(pg.data)}</td>
          <td class="${tipoClass}">${esc(pg.tipo)}</td>
          <td>${esc(pg.descricao || '-')}</td>
          <td class="valor">${fmtBRL(pg.valor)}</td>
        </tr>
      `;
    });
    
    tbody.innerHTML = html;
  }
  
  // ============================================
  // EXPORTAR PDF
  // ============================================
  
  async function exportarPDF() {
    if (!currentGerente) {
      alert('Nenhuma análise carregada');
      return;
    }
    
    console.log('[Análise Gerente] 📄 Exportando PDF...');
    
    // Cria canvas para o PDF
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const WIDTH = 1200;
    const HEIGHT = 1600;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    
    // Fundo
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    let y = 40;
    
    // Título
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 28px Arial';
    ctx.fillText(`Análise - ${currentGerente.numero || ''} ${currentGerente.nome || ''}`, 40, y);
    
    y += 35;
    ctx.font = '16px Arial';
    ctx.fillStyle = '#6b7280';
    ctx.fillText(`Período: ${formatDateBR(currentPeriodo.de)} a ${formatDateBR(currentPeriodo.ate)}`, 40, y);
    
    y += 50;
    
    // Cards resumo
    const { resumo } = dadosAnalise;
    const cards = [
      { label: 'Total Coletas', value: fmtBRL(resumo.totalColetas), color: '#10b981' },
      { label: 'Total Despesas', value: fmtBRL(resumo.totalDespesas), color: '#ef4444' },
      { label: 'Comissões', value: fmtBRL(resumo.totalComissao), color: '#f59e0b' },
      { label: 'Pagamentos', value: fmtBRL(resumo.totalPagamentos), color: '#3b82f6' },
      { label: 'Saldo', value: fmtBRL(resumo.saldo), color: resumo.saldo >= 0 ? '#10b981' : '#ef4444' }
    ];
    
    let cardX = 40;
    cards.forEach(card => {
      // Box
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(cardX, y, 210, 70);
      
      // Label
      ctx.fillStyle = '#6b7280';
      ctx.font = '14px Arial';
      ctx.fillText(card.label, cardX + 15, y + 25);
      
      // Value
      ctx.fillStyle = card.color;
      ctx.font = 'bold 20px Arial';
      ctx.fillText(card.value, cardX + 15, y + 55);
      
      cardX += 225;
    });
    
    y += 100;
    
    // Seção Prestações
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 20px Arial';
    ctx.fillText('📋 Prestações / Coletas', 40, y);
    y += 30;
    
    ctx.font = '12px Arial';
    ctx.fillStyle = '#6b7280';
    
    // Header tabela
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(40, y, WIDTH - 80, 25);
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 12px Arial';
    ctx.fillText('Período', 50, y + 17);
    ctx.fillText('Coletas', 250, y + 17);
    ctx.fillText('Despesas', 400, y + 17);
    ctx.fillText('Comissão', 550, y + 17);
    ctx.fillText('Resultado', 700, y + 17);
    ctx.fillText('Status', 850, y + 17);
    y += 30;
    
    ctx.font = '12px Arial';
    dadosAnalise.prestacoes.slice(0, 15).forEach(p => {
      const periodo = `${formatDateBR(p.periodoIni)} a ${formatDateBR(p.periodoFim)}`;
      const coletas = Number(p.resumo?.coletas) || 0;
      const despesas = Number(p.resumo?.despesas) || 0;
      const comissao = Number(p.resumo?.comissaoVal) || 0;
      const resultado = Number(p.resumo?.resultado) || 0;
      const restam = Number(p.resumo?.restam) || 0;
      
      ctx.fillStyle = '#374151';
      ctx.fillText(periodo, 50, y + 15);
      ctx.fillText(fmtBRL(coletas), 250, y + 15);
      ctx.fillStyle = '#ef4444';
      ctx.fillText(fmtBRL(despesas), 400, y + 15);
      ctx.fillStyle = '#374151';
      ctx.fillText(fmtBRL(comissao), 550, y + 15);
      ctx.fillText(fmtBRL(resultado), 700, y + 15);
      ctx.fillStyle = restam > 0 ? '#f59e0b' : '#10b981';
      ctx.fillText(restam > 0 ? `Restam ${fmtBRL(restam)}` : 'Quitada', 850, y + 15);
      
      y += 25;
    });
    
    // Download
    const link = document.createElement('a');
    link.download = `analise_${currentGerente.numero}_${currentPeriodo.de}_${currentPeriodo.ate}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    
    console.log('[Análise Gerente] ✅ PDF exportado');
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
      ['Pagamentos', dadosAnalise.resumo.totalPagamentos],
      ['Saldo', dadosAnalise.resumo.saldo]
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
      ['Data', 'Tipo', 'Descrição', 'Valor']
    ];
    dadosAnalise.pagamentos.forEach(pg => {
      pagData.push([
        pg.data || '',
        pg.tipo || '',
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
  
  // Auto-init quando a página for exibida
  document.addEventListener('DOMContentLoaded', () => {
    // Aguarda a navegação para a página
    const observer = new MutationObserver(() => {
      const container = document.getElementById('analiseGerenteContent') || 
                        document.getElementById('pageAnaliseGerente');
      if (container && container.offsetParent !== null) {
        init();
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  });
  
  console.log('[Análise Gerente] ✅ Módulo carregado');
  
})();