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
                  <tfoot id="agFootPagamentos">
                    <tr class="ag-total-row">
                      <td colspan="3"><strong>TOTAL</strong></td>
                      <td class="valor"><strong id="agTotalPagamentosTabela">R$ 0,00</strong></td>
                    </tr>
                  </tfoot>
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
      
      console.log('[Análise Gerente] Carregando gerentes:', gerentes.length);
      
      // Se ainda não tem gerentes, tenta novamente em 500ms
      if (gerentes.length === 0) {
        console.log('[Análise Gerente] ⏳ Aguardando gerentes carregarem...');
        setTimeout(carregarGerentes, 500);
        return;
      }
      
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
        const uid = g.uid || g.id || '';
        options += `<option value="${uid}">${label}</option>`;
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
      // ✅ Mapa rápido ficha → rota (area) vindo de window.fichas
      const fichaRotaMap = new Map(
        (window.fichas || []).map(f => [String(f.ficha).trim(), String(f.area || '').trim()])
      );
      
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
      }).map(d => {
        // ✅ Enriquece com a rota vinda de window.fichas se d.rota estiver vazio
        const fichaStr = String(d.ficha || '').trim();
        const rotaDaFicha = fichaStr ? (fichaRotaMap.get(fichaStr) || '') : '';
        return { ...d, rota: d.rota && d.rota.trim() ? d.rota : rotaDaFicha };
      }).sort((a, b) => {
        const dataA = a.data || '';
        const dataB = b.data || '';
        return dataA.localeCompare(dataB);
      });
    }
    
    function buscarPagamentos(gerenteNum, de, ate) {
      const pagamentos = [];
      
      // ✅ BUSCA EM window.lanc (tabela lancamentos do Supabase)
      // O campo r.gerente é texto livre: "026", "Sávio", "026 Sávio", "026 - SAVIO", etc.
      const lancamentos = window.lanc || [];
      
      // Monta variações do número e nome do gerente para match flexível
      const numPadded = String(gerenteNum).padStart(3, '0');   // "026"
      const numRaw    = String(gerenteNum);                      // "26"
      const gerenteObj = (window.gerentes || []).find(g =>
        String(g.numero) === numRaw || String(g.numero) === numPadded
      );
      const gerenteNomeLower = (gerenteObj?.nome || '').toLowerCase().trim();
      
      function matchGerente(textoGerente) {
        const t = (textoGerente || '').toLowerCase().replace(/[-_]/g, ' ').trim();
        if (!t) return false;
        // Match por número padded (ex: "026", "026 sávio", "026 - savio")
        if (t.includes(numPadded)) return true;
        // Match por número sem zero à esquerda (ex: "26 sávio")
        if (numRaw !== numPadded && t.includes(numRaw)) return true;
        // Match por nome do gerente (ex: "sávio", "savio")
        if (gerenteNomeLower) {
          // Normaliza acentos para comparação
          const normalize = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
          if (normalize(t).includes(normalize(gerenteNomeLower))) return true;
        }
        return false;
      }
      
      lancamentos.forEach(f => {
        if (!matchGerente(f.gerente)) return;
        
        // Filtro por data
        const dataF = f.data || '';
        if (dataF < de || dataF > ate) return;
        
        // Em window.lanc: status é "PAGO" ou "RECEBIDO"
        const isPago     = (f.status || '').toUpperCase() === 'PAGO';
        const isRecebido = (f.status || '').toUpperCase() === 'RECEBIDO';
        
        const categoria = (f.categoria || '').toLowerCase();
        let tipoLabel = 'Outros';
        if (categoria.includes('adiantamento')) {
          tipoLabel = 'Adiantamento';
        } else if (categoria.includes('prest') || categoria.includes('comiss')) {
          tipoLabel = isPago ? 'Pagamento' : 'Recebimento';
        } else if (isPago) {
          tipoLabel = 'Pagamento';
        } else if (isRecebido) {
          tipoLabel = 'Recebimento';
        }
        
        pagamentos.push({
          data: dataF,
          tipo: tipoLabel,
          descricao: f.categoria || '-',
          valor: Number(f.valor) || 0,
          formaPgto: f.forma || 'PIX',
          isPago,
          isRecebido,
          origem: 'lancamento',
          id: f.uid || f.id
        });
      });
      
      // Também busca nos vales como fallback
      const vales = window.vales || [];
      
      vales.forEach(v => {
        const vGerente = v.gerenteNumero || v.gerente || '';
        if (vGerente !== gerenteNum) return;
        
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
      
      // Total de pagamentos (separado por tipo)
      let totalPago = 0;
      let totalRecebido = 0;
      
      pagamentos.forEach(pg => {
        const valor = Number(pg.valor) || 0;
        if (pg.isPago || pg.tipo === 'Adiantamento' || pg.tipo === 'Pagamento') {
          totalPago += valor;
        } else if (pg.isRecebido || pg.tipo === 'Recebimento') {
          totalRecebido += valor;
        }
      });
      
      const totalPagamentos = totalPago; // Para o card de pagamentos
      
      // Saldo = Resultado das prestações - Pagamentos feitos ao gerente
      const totalResultado = prestacoes.reduce((sum, p) => {
        const resultado = Number(p.resumo?.resultado) || 0;
        return sum + resultado;
      }, 0);
      
      const saldo = totalResultado - totalPago;
      
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
        const periodo = `${formatDateBR(p.periodoIni)} a ${formatDateBR(p.periodoFim)}`;
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
      
      // Popula select de rotas (só se ainda não foi populado ou mudou)
      popularSelectRotas(despesas);
      
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
      
      // Atualiza total no tfoot
      document.getElementById('agTotalDespesasTabela').textContent = fmtBRL(somaValor);
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
    
    function renderTabelaPagamentos() {
      const tbody = document.getElementById('agBodyPagamentos');
      const badge = document.getElementById('agBadgePagamentos');
      const { pagamentos } = dadosAnalise;
      
      badge.textContent = pagamentos.length;
      
      if (pagamentos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="ag-empty">Nenhum pagamento encontrado</td></tr>';
        document.getElementById('agTotalPagamentosTabela').textContent = 'R$ 0,00';
        return;
      }
      
      let html = '';
      let somaPago = 0;
      let somaRecebido = 0;
      
      pagamentos.forEach(pg => {
        const valor = Number(pg.valor) || 0;
        
        // Determina classe visual
        let tipoClass = 'tipo-outros';
        if (pg.tipo === 'Adiantamento') {
          tipoClass = 'tipo-adiant';
          somaPago += valor;
        } else if (pg.tipo === 'Recebimento' || pg.isRecebido) {
          tipoClass = 'tipo-receb';
          somaRecebido += valor;
        } else if (pg.tipo === 'Pagamento' || pg.isPago) {
          tipoClass = 'tipo-pago';
          somaPago += valor;
        } else {
          // Outros - tenta inferir
          if (pg.isPago) somaPago += valor;
          else somaRecebido += valor;
        }
        
        html += `
          <tr>
            <td>${formatDateBR(pg.data)}</td>
            <td><span class="${tipoClass}">${esc(pg.tipo)}</span></td>
            <td>${esc(pg.descricao || '-')}${pg.formaPgto ? ` <small>(${pg.formaPgto})</small>` : ''}</td>
            <td class="valor ${pg.isPago ? 'despesa' : ''}">${fmtBRL(valor)}</td>
          </tr>
        `;
      });
      
      tbody.innerHTML = html;
      
      // Total = Pagamentos - Recebimentos (saldo negativo = pagou mais do que recebeu)
      const saldoPagamentos = somaPago - somaRecebido;
      const totalEl = document.getElementById('agTotalPagamentosTabela');
      
      if (somaRecebido > 0 && somaPago > 0) {
        totalEl.innerHTML = `
          <span class="tipo-receb">+${fmtBRL(somaRecebido)}</span> / 
          <span class="tipo-pago">-${fmtBRL(somaPago)}</span>
        `;
      } else if (somaPago > 0) {
        totalEl.textContent = fmtBRL(somaPago);
      } else {
        totalEl.textContent = fmtBRL(somaRecebido);
      }
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