// ============================================
// ARQUIVO 3: ADAPTADORES - FAZEM AS FUNÇÕES ANTIGAS FUNCIONAREM
// ============================================
// INSTRUÇÕES:
// 1. Salve este arquivo como: js/adapters.js
// 2. Este arquivo faz suas funções antigas funcionarem com o Supabase
// ============================================

(function() {
  'use strict';

  // ============================================
  // ADAPTAR FUNÇÃO: salvarGerente()
  // ============================================
  
  window.salvarGerente = async function(event) {
    if (event) event.preventDefault();
    
    console.log('🔄 Salvando gerente no Supabase...');
    
    try {
      // Pega os dados do formulário
      const form = document.getElementById('formGerente');
      const uid = form.querySelector('[name="uid"]')?.value;
      const dados = {
        nome: form.querySelector('[name="nome"]')?.value || '',
        tipo: form.querySelector('[name="tipo"]')?.value || 'NORMAL',
        comissao: parseFloat(form.querySelector('[name="comissao"]')?.value || 10),
        telefone: form.querySelector('[name="telefone"]')?.value || '',
        endereco: form.querySelector('[name="endereco"]')?.value || '',
        observacoes: form.querySelector('[name="observacoes"]')?.value || '',
        ativo: form.querySelector('[name="ativo"]')?.checked !== false
      };
      
      // Se tem UID, é atualização
      if (uid) {
        await window.GerentesDB.update(uid, dados);
        alert('✅ Gerente atualizado com sucesso!');
      } else {
        // Senão, é criação
        await window.GerentesDB.create(dados);
        alert('✅ Gerente criado com sucesso!');
      }
      
      // Limpa o formulário
      form.reset();
      
      // Atualiza a tela
      if (window.renderGerentes) window.renderGerentes();
      if (window.fillPcGerentes) window.fillPcGerentes();
      
    } catch (error) {
      console.error('❌ Erro ao salvar gerente:', error);
      alert('❌ Erro ao salvar gerente: ' + error.message);
    }
  };

  // ============================================
  // ADAPTAR FUNÇÃO: editarGerente()
  // ============================================
  
  window.editarGerente = async function(uid) {
    console.log('📝 Carregando gerente para edição...');
    
    try {
      // Busca o gerente
      const gerente = window.gerentes.find(g => g.uid === uid);
      if (!gerente) {
        alert('Gerente não encontrado!');
        return;
      }
      
      // Preenche o formulário
      const form = document.getElementById('formGerente');
      form.querySelector('[name="uid"]').value = gerente.uid;
      form.querySelector('[name="nome"]').value = gerente.nome;
      form.querySelector('[name="tipo"]').value = gerente.tipo || 'NORMAL';
      form.querySelector('[name="comissao"]').value = gerente.comissao || 10;
      form.querySelector('[name="telefone"]').value = gerente.telefone || '';
      form.querySelector('[name="endereco"]').value = gerente.endereco || '';
      form.querySelector('[name="observacoes"]').value = gerente.observacoes || '';
      if (form.querySelector('[name="ativo"]')) {
        form.querySelector('[name="ativo"]').checked = gerente.ativo !== false;
      }
      
      // Foca no nome
      form.querySelector('[name="nome"]').focus();
      
    } catch (error) {
      console.error('❌ Erro ao carregar gerente:', error);
      alert('❌ Erro ao carregar gerente: ' + error.message);
    }
  };

  // ============================================
  // ADAPTAR FUNÇÃO: excluirGerente()
  // ============================================
  
  window.excluirGerente = async function(uid) {
    if (!confirm('Tem certeza que deseja excluir este gerente?')) {
      return;
    }
    
    console.log('🗑️ Excluindo gerente...');
    
    try {
      await window.GerentesDB.delete(uid);
      alert('✅ Gerente excluído com sucesso!');
      
      // Atualiza a tela
      if (window.renderGerentes) window.renderGerentes();
      if (window.fillPcGerentes) window.fillPcGerentes();
      
    } catch (error) {
      console.error('❌ Erro ao excluir gerente:', error);
      alert('❌ Erro ao excluir gerente: ' + error.message);
    }
  };

  // ============================================
  // ADAPTAR FUNÇÃO: addDespesa()
  // ============================================
  
  window.addDespesa = async function() {
    console.log('💸 Adicionando despesa...');
    
    try {
      // Pega os valores dos campos
      const data = document.getElementById('pcData')?.value;
      const gerenteId = document.getElementById('pcGerente')?.value;
      const gerenteNome = document.querySelector('#pcGerente option:checked')?.textContent || '';
      const descricao = prompt('Descrição da despesa:');
      const valor = parseFloat(prompt('Valor da despesa:') || 0);
      
      if (!descricao || !valor) {
        alert('Preencha todos os campos!');
        return;
      }
      
      // Cria a despesa
      await window.DespesasDB.create({
        data: data,
        gerente: gerenteId,
        gerenteNome: gerenteNome,
        descricao: descricao,
        valor: valor,
        tipo: 'DESPESA'
      });
      
      alert('✅ Despesa adicionada com sucesso!');
      
      // Atualiza a tela
      if (window.renderDespesas) window.renderDespesas();
      
    } catch (error) {
      console.error('❌ Erro ao adicionar despesa:', error);
      alert('❌ Erro ao adicionar despesa: ' + error.message);
    }
  };

  // ============================================
  // ADAPTAR FUNÇÃO: salvarPrestacao()
  // ============================================
  
  window.salvarPrestacao = async function() {
    console.log('💰 Salvando prestação...');
    
    try {
      // Pega os valores dos campos
      const data = document.getElementById('pcData')?.value;
      const periodo = document.getElementById('pcPeriodo')?.value;
      const gerenteId = document.getElementById('pcGerente')?.value;
      const gerenteNome = document.querySelector('#pcGerente option:checked')?.textContent || '';
      const coletas = parseFloat(document.getElementById('pcColetas')?.value || 0);
      const despesas = parseFloat(document.getElementById('pcDespesas')?.value || 0);
      const comissao = parseFloat(document.getElementById('pcComissao')?.value || 10);
      
      // Calcula valores
      const resultado = coletas - despesas;
      const valorComissao = (resultado * comissao) / 100;
      
      // Cria a prestação
      await window.PrestacoesDB.create({
        data: data,
        periodo: periodo,
        gerenteId: gerenteId,
        gerenteNome: gerenteNome,
        coletas: coletas,
        despesas: despesas,
        resultado: resultado,
        comissao: comissao,
        valorComissao: valorComissao,
        aPagar: valorComissao,
        status: 'aberta'
      });
      
      alert('✅ Prestação salva com sucesso!');
      
      // Limpa o formulário
      document.getElementById('pcColetas').value = '';
      document.getElementById('pcDespesas').value = '';
      
      // Atualiza a tela
      if (window.renderRelPrestacoes) window.renderRelPrestacoes();
      
    } catch (error) {
      console.error('❌ Erro ao salvar prestação:', error);
      alert('❌ Erro ao salvar prestação: ' + error.message);
    }
  };

  // ============================================
  // ADAPTAR FUNÇÃO: salvarLancamento()
  // ============================================
  
  window.salvarLancamento = async function() {
    console.log('📝 Salvando lançamento financeiro...');
    
    try {
      // Pega os valores dos campos
      const data = document.getElementById('lancData')?.value;
      const tipo = document.getElementById('lancTipo')?.value;
      const descricao = document.getElementById('lancDescricao')?.value;
      const valor = parseFloat(document.getElementById('lancValor')?.value || 0);
      const formaPagamento = document.getElementById('lancForma')?.value || 'DINHEIRO';
      const obs = document.getElementById('lancObs')?.value || '';
      
      if (!data || !tipo || !descricao || !valor) {
        alert('Preencha todos os campos obrigatórios!');
        return;
      }
      
      // Cria o lançamento
      await window.FinanceiroDB.create({
        data: data,
        tipo: tipo,
        descricao: descricao,
        valor: valor,
        formaPagamento: formaPagamento,
        obs: obs
      });
      
      alert('✅ Lançamento salvo com sucesso!');
      
      // Limpa o formulário
      document.getElementById('lancDescricao').value = '';
      document.getElementById('lancValor').value = '';
      document.getElementById('lancObs').value = '';
      
      // Atualiza a tela
      if (window.renderFin) window.renderFin();
      
    } catch (error) {
      console.error('❌ Erro ao salvar lançamento:', error);
      alert('❌ Erro ao salvar lançamento: ' + error.message);
    }
  };

  // ============================================
  // ADAPTAR FUNÇÃO: loadGerentes()
  // ============================================
  
  window.loadGerentes = async function() {
    console.log('📂 Carregando gerentes...');
    
    try {
      await window.GerentesDB.getAll();
      console.log('✅ Gerentes carregados:', window.gerentes.length);
    } catch (error) {
      console.error('❌ Erro ao carregar gerentes:', error);
    }
  };

  // ============================================
  // ADAPTAR FUNÇÃO: loadAll()
  // ============================================
  
  window.loadAll = async function() {
    console.log('📂 Carregando todos os dados...');
    
    try {
      await Promise.all([
        window.GerentesDB.getAll(),
        window.DespesasDB.getAll(),
        window.PrestacoesDB.getAll(),
        window.FinanceiroDB.getAll()
      ]);
      
      console.log('✅ Todos os dados carregados!');
      
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
    }
  };

  console.log('✅ Adaptadores carregados!');
  console.log('📝 Suas funções antigas agora salvam no Supabase');
  
})();