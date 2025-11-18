/* users-page.js — criação/edição de usuários, empresas e troca de senha */
(function () {
  'use strict';

  const page = document.getElementById('pageUsers');
  if (!page) return;

  const form = page.querySelector('#userForm');
  const permGridEl = page.querySelector('#permGrid');
  const tblBody = page.querySelector('#userTable tbody');

  const COMPANIES = ['BSX', 'BetPlay', 'Emanuel'];

  // grupos → chaves canônicas do seu RBAC (auth-rbac.js)
  const PERMS_UI = [
    { title: 'Início', items: [
      ['inicio_view','Início (ver)'],
      ['inicio_edit','Início (editar)'],
    ]},
    { title: 'Cadastros', items: [
      ['cad_gerentes_view','Cadastros Gerentes (ver)'],
      ['cad_gerentes_edit','Cadastros Gerentes (editar)'],
      ['cad_fichas_view','Fichas (ver)'],
      ['cad_fichas_edit','Fichas (editar)'],
    ]},
    { title: 'Prestações', items: [
      ['prest_lancar_view','Lançar Prestação (ver)'],
      ['prest_lancar_edit','Lançar Prestação (editar)'],
      ['prest_rel_view','Relatórios (ver)'],
      ['prest_rel_edit','Relatórios (editar)'],
      ['prest_fech_view','Finalizadas (ver)'],
      ['prest_fech_edit','Finalizadas (editar)'],
    ]},
    { title: 'Financeiro', items: [
      ['financeiro_view','Financeiro (ver)'],
      ['financeiro_edit','Financeiro (editar)'],
    ]},
    { title: 'Despesas', items: [
      ['despesas_view','Despesas (ver)'],
      ['despesas_edit','Despesas (editar)'],
    ]},

  { title: 'Vales', items: [
    ['vales_view','Vales (ver)'],
    ['vales_edit','Vales (editar)'],
  ]},
];
  

  // ---------- helpers UI ----------
  function makePermGrid(container, selected = []) {
    container.innerHTML = '';
    const selSet = new Set(
      Array.isArray(selected) ? selected
      : Object.keys(selected || {}).filter(k => selected[k])
    );

    PERMS_UI.forEach(group => {
      const wrap = document.createElement('div');
      wrap.className = 'perm-grid';

      const strong = document.createElement('strong');
      strong.textContent = group.title;
      strong.style.gridColumn = '1 / -1';
      strong.style.marginTop = '8px';
      wrap.appendChild(strong);

      group.items.forEach(([key, label]) => {
        const lab = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'perm';
        cb.value = key;
        if (selSet.has(key)) cb.checked = true;
        lab.appendChild(cb);
        lab.appendChild(document.createTextNode(' ' + label));
        wrap.appendChild(lab);
      });

      container.appendChild(wrap);
    });
  }

  function injectCompaniesBlock(afterEl, selected = []) {
    page.querySelector('#companiesBlock')?.remove();

    const blk = document.createElement('div');
    blk.id = 'companiesBlock';
    blk.className = 'perm-grid';
    blk.style.gridColumn = '1 / -1';
    blk.style.marginTop = '12px';

    const title = document.createElement('strong');
    title.textContent = 'Empresas permitidas';
    title.style.gridColumn = '1 / -1';
    blk.appendChild(title);

    const selSet = new Set((selected || []).map(s => String(s).toUpperCase()));

    // “Todas”
    const labAll = document.createElement('label');
    const cbAll = document.createElement('input');
    cbAll.type = 'checkbox';
    cbAll.id = 'compAll';
    cbAll.checked = !selected || selected.length === 0;
    labAll.appendChild(cbAll);
    labAll.appendChild(document.createTextNode(' Todas'));
    blk.appendChild(labAll);

    // individuais
    COMPANIES.forEach(c => {
      const lab = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'comp';
      cb.value = c;
      cb.checked = selSet.has(c);
      if (cbAll.checked) cb.disabled = true;
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(' ' + c));
      blk.appendChild(lab);
    });

    cbAll.addEventListener('change', () => {
      blk.querySelectorAll('input.comp').forEach(i => {
        i.disabled = cbAll.checked;
        if (cbAll.checked) i.checked = false;
      });
    });

    afterEl.parentNode.insertBefore(blk, afterEl.nextSibling);
  }

  function collectPerms(rootEl) {
    return Array.from(rootEl.querySelectorAll('input.perm:checked')).map(i => i.value);
  }
  function collectCompanies(rootEl) {
    const all = rootEl.querySelector('#compAll');
    if (all && all.checked) return []; // vazio = todas
    return Array.from(rootEl.querySelectorAll('input.comp:checked')).map(i => i.value);
  }
  // === Toolbar de busca/filtro da tabela ===
const tableEl = page.querySelector('#userTable');
const tableCard = tableEl.closest('.card') || page;
if (!page.querySelector('#userSearch')) {
  const toolbar = document.createElement('div');
  toolbar.className = 'users-toolbar';
  toolbar.innerHTML = `
    <input id="userSearch" type="search" placeholder="Buscar usuário/permissão…" />
    <label><input type="checkbox" id="userOnlyOps" /> Só operadores</label>
  `;
  tableCard.insertBefore(toolbar, tableCard.querySelector('.table-wrap') || tableEl);
  toolbar.querySelector('#userSearch').addEventListener('input', renderTable);
  toolbar.querySelector('#userOnlyOps').addEventListener('change', renderTable);
}
// ===== portal do menu de ações (impede clipping por overflow) =====
let __usersMenuActive = null;

function closeUsersMenu(){
  if (!__usersMenuActive) return;
  const { menu, parent, onScroll, onDocClick, onKey } = __usersMenuActive;
  menu.classList.remove('open', 'portal');
  menu.style.display = 'none';
  menu.style.left = menu.style.top = '';
  parent.appendChild(menu);
  window.removeEventListener('scroll', onScroll, true);
  window.removeEventListener('resize', onScroll);
  document.removeEventListener('click', onDocClick, true);
  document.removeEventListener('keydown', onKey, true);
  __usersMenuActive = null;
}

function openUsersMenu(triggerBtn, menu, parentCell){
  // 🔁 Toggle: se o mesmo menu já está aberto, fecha e sai
  if (__usersMenuActive && (__usersMenuActive.menu === menu || __usersMenuActive.trigger === triggerBtn)) {
    closeUsersMenu();
    return;
  }
  // fecha qualquer outro aberto
  closeUsersMenu();

  // move o menu para o body e mostra pra medir
  document.body.appendChild(menu);
  menu.classList.add('open', 'portal');
  menu.style.display = 'block';

  const b = triggerBtn.getBoundingClientRect();
  menu.style.minWidth = Math.max(160, b.width) + 'px';
  const m = menu.getBoundingClientRect();

  // posiciona: preferir abaixo; se não couber, abre acima
  let left = Math.min(b.left, window.innerWidth - m.width - 8);
  let top = b.bottom + 6;
  if (top + m.height > window.innerHeight - 8) {
    top = Math.max(8, b.top - m.height - 6);
  }
  if (left < 8) left = 8;

  menu.style.left = left + 'px';
  menu.style.top  = top + 'px';

  const onScroll = () => closeUsersMenu();
  const onDocClick = (ev) => {
    if (!menu.contains(ev.target) && ev.target !== triggerBtn) closeUsersMenu();
  };
  const onKey = (ev) => { if (ev.key === 'Escape') closeUsersMenu(); };

  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onScroll);
  document.addEventListener('click', onDocClick, true);
  document.addEventListener('keydown', onKey, true);

  __usersMenuActive = { menu, parent: parentCell, trigger: triggerBtn, onScroll, onDocClick, onKey };
}



  // ---------- tabela ----------
// ---------- tabela ----------
async function renderTable() {
  let users = [];

  if (window.UserAuth?.list) {
    try {
      users = await window.UserAuth.list();
    } catch (e) {
      console.error('[Users] erro ao carregar usuários:', e);
      users = [];
    }
  }

  if (!Array.isArray(users)) {
    console.warn('[Users] UserAuth.list não retornou array, usando [].', users);
    users = [];
  }

  const q = (page.querySelector('#userSearch')?.value || '').toLowerCase();
  const onlyOps = !!page.querySelector('#userOnlyOps')?.checked;

  if (onlyOps) users = users.filter(u => u.role !== 'admin');
  if (q) {
    users = users.filter(u => {
      const permsText = Array.isArray(u.perms)
        ? u.perms.join(' ')
        : Object.keys(u.perms || {}).filter(k => u.perms[k]).join(' ');
      return (`${u.username} ${u.role} ${permsText}`).toLowerCase().includes(q);
    });
  }
  tblBody.innerHTML = '';
    users.forEach(u => {
      const tr = document.createElement('tr');
      tr.dataset.role = u.role;

      const tdU = document.createElement('td'); tdU.textContent = u.username;
      const tdR = document.createElement('td'); tdR.textContent = u.role;

      const tdP = document.createElement('td');
      tdP.className = 'perm-summary';
      tdP.textContent = (u.role === 'admin') ? 'todas' : '—'; // não listar detalhes aqui
      

      const tdA = document.createElement('td');
      tdA.className = 'user-actions';
      
      // Somente operadores têm menu de ações
      if (u.role !== 'admin') {
        // Botão Opções ▾
        const optBtn = document.createElement('button');
        optBtn.className = 'btn';
        optBtn.type = 'button';
        optBtn.textContent = 'Opções ▾';
        tdA.appendChild(optBtn);
      
        // Menu
        const menu = document.createElement('div');
        menu.className = 'users-menu';
        menu.innerHTML = `
          <button class="menu-item" data-act="edit">Editar</button>
          <button class="menu-item" data-act="makeAdmin">Tornar admin</button>
          <button class="menu-item danger" data-act="delete">Excluir</button>
        `;
        tdA.appendChild(menu);
      
        // Abrir/fechar menu
        optBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openUsersMenu(optBtn, menu, tdA);
        });
        
      
        // Ações do menu
        menu.addEventListener('click', async (e) => {
          const btn = e.target.closest('button.menu-item');
          if (!btn) return;
          menu.classList.remove('open');
      
          if (btn.dataset.act === 'edit') {
            openEditDialog(u);
            return;
          }
          if (btn.dataset.act === 'makeAdmin') {
            await window.UserAuth.updateUser(u.id, { role: 'admin', perms: {} });
            renderTable(); window.UserAuth.guard?.();
            return;
          }
          if (btn.dataset.act === 'delete') {
            if (!confirm(`Excluir o usuário ${u.username}?`)) return;
            window.UserAuth.removeUser(u.id);
            renderTable(); window.UserAuth.guard?.();
            return;
          }
        });
      
      } else {
        // Para admin, sem ações (mantém célula vazia ou um traço, se quiser)
        // tdA.textContent = '—';
      }
      

      tr.appendChild(tdU); tr.appendChild(tdR); tr.appendChild(tdP); tr.appendChild(tdA);
      tblBody.appendChild(tr);
    });
  }


  // ---------- criação ----------
  makePermGrid(permGridEl, []);
  injectCompaniesBlock(permGridEl, []);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();

    if (!window.UserAuth?.createUser) {
      alert('Módulo de usuários não carregado. Verifique js/auth-rbac.js.');
      return;
    }

    const fd = new FormData(form);
    const username = String(fd.get('username') || '').trim().toLowerCase();
    const password = String(fd.get('password') || '').trim();

    if (!username || !password) {
      alert('Preencha usuário e senha.');
      return;
    }

    const perms = collectPerms(page);
    const companies = collectCompanies(page);

    try {
      const r = await window.UserAuth.createUser({
        username, password, role: 'operador', perms, companies
      });
      if (!r?.ok) {
        alert(r?.msg || 'Falha ao criar usuário');
        return;
      }
      form.reset();
      makePermGrid(permGridEl, []);
      injectCompaniesBlock(permGridEl, []);
      renderTable();
      window.UserAuth.guard?.();
    } catch (e) {
      console.error(e);
      alert('Erro ao criar usuário.');
    }
  });

  // ---------- edição (permissões, empresas e senha) ----------
  function openEditDialog(user) {
    let dlg = document.getElementById('dlgUserEdit');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'dlgUserEdit';
      dlg.innerHTML = `
        <header class="card"><strong>Editar usuário</strong></header>
        <form method="dialog" class="card" style="margin:0">
          <div class="form-grid">
            <label>Usuário
              <input name="username" disabled />
            </label>
            <label>Nova senha (opcional)
              <input name="newpass" type="password" placeholder="Preencha para alterar" />
            </label>
            <div style="grid-column:1/-1">
              <strong>Permissões</strong>
              <div id="editPermGrid" class="perm-grid" style="margin-top:8px"></div>
            </div>
          </div>
          <div id="editCompaniesHolder" style="margin:8px 0"></div>
          <div style="display:flex;justify-content:flex-end;gap:10px">
            <button class="btn ghost" value="cancel">Cancelar</button>
            <button class="btn" id="btnUserEditSave" value="default">Salvar</button>
          </div>
        </form>
      `;
      document.body.appendChild(dlg);
    }

    dlg.querySelector('input[name="username"]').value = user.username;
    dlg.querySelector('input[name="newpass"]').value = '';

    const grid = dlg.querySelector('#editPermGrid');
    const sel = Array.isArray(user.perms) ? user.perms
              : Object.keys(user.perms || {}).filter(k => user.perms[k]);
    makePermGrid(grid, sel);

    const holder = dlg.querySelector('#editCompaniesHolder');
    holder.innerHTML = '<div id="__tmpAfter"></div>';
    injectCompaniesBlock(holder.querySelector('#__tmpAfter'), user.companies || []);
    holder.querySelector('#__tmpAfter')?.remove();

    dlg.querySelector('#btnUserEditSave').onclick = async () => {
      const newPerms = collectPerms(dlg);
      const companies = collectCompanies(dlg);
      const newpass = dlg.querySelector('input[name="newpass"]').value.trim();

      await window.UserAuth.updateUser(user.id, { perms: newPerms, companies });
      if (newpass) {
        if (!window.UserAuth.changePassword) {
          alert('Função de troca de senha não disponível. Atualize auth-rbac.js.');
        } else {
          const r = await window.UserAuth.changePassword(user.id, newpass);
          if (!r?.ok) return alert(r?.msg || 'Erro ao alterar senha');
        }
      }

      dlg.close();
      renderTable();
      window.UserAuth.guard?.();
      window.UserAuth.enforceCompanyAccess?.();
    };

    dlg.showModal();
  }

  // inicial
  renderTable();
})();
