/* ===== RBAC legado auto-contido (compatível c/ granular + aliases antigos) ===== */
(function(){
  'use strict';

  // Chaves planas (seu prefixo por empresa, se existir, deve estar em window.jget/jset)
  const K_USERS = 'APP_USERS_V1';
  const K_SESS  = 'APP_SESSION_V1';

  /* --- Helpers locais (auto-contidos). Se o projeto já tiver globais, usamos eles. --- */
  const jget = (typeof window.jget === 'function')
    ? window.jget
    : (k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)||''); }catch(_){ return d; } };

  const jset = (typeof window.jset === 'function')
    ? window.jset
    : (k,v)=> localStorage.setItem(k, JSON.stringify(v));

  const uid  = (typeof window.uid === 'function')
    ? window.uid
    : ()=> 'u'+Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);

    async function sha(txt){
      try{
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(txt)));
        const hex = Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
        return hex;
      }catch(_){
        return btoa('bsx#'+String(txt)); // fallback legado
      }
    }
    
    async function passOk(savedHash, rawPassword) {
      if (!savedHash || !rawPassword) return false;
      
      // Detecta senha legada (base64)
      if (savedHash.startsWith('YnN4') || savedHash.includes('bsx#')) {
        console.error('SENHA LEGADA DETECTADA - Usuário deve resetar senha');
        return false;
      }
      
      // Apenas SHA-256
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(String(rawPassword));
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        return savedHash === hashHex;
      } catch (error) {
        console.error('Erro ao verificar senha:', error);
        return false;
      }
    }
    
    // Função para migrar senhas legadas (executar uma vez)
    async function migrateLegacyPasswords() {
      const users = JSON.parse(localStorage.getItem('APP_USERS_V1') || '[]');
      let migrated = 0;
      
      for (const user of users) {
        if (user.pass && (user.pass.startsWith('YnN4') || user.pass.includes('bsx#'))) {
          console.warn(`Usuário ${user.username} tem senha legada - resetando para senha padrão`);
          
          // Define senha temporária (deve ser alterada no primeiro login)
          const tempPass = user.username + '2024';
          const encoder = new TextEncoder();
          const data = encoder.encode(tempPass);
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          user.pass = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          user.mustChangePassword = true;
          migrated++;
        }
      }
      
      if (migrated > 0) {
        localStorage.setItem('APP_USERS_V1', JSON.stringify(users));
        console.log(`Migradas ${migrated} senhas legadas.`);
        alert(`ATENÇÃO: ${migrated} usuário(s) tiveram suas senhas resetadas.\nNova senha temporária: [username]2024`);
      }
    }
    
    // Gerenciador de Event Listeners com cleanup automático
class EventManager {
  constructor() {
    this.listeners = new Map();
  }
  
  add(target, event, handler, options) {
    if (!this.listeners.has(target)) {
      this.listeners.set(target, []);
    }
    
    target.addEventListener(event, handler, options);
    this.listeners.get(target).push({ event, handler, options });
  }
  
  remove(target, event, handler) {
    target.removeEventListener(event, handler);
    
    if (this.listeners.has(target)) {
      const targetListeners = this.listeners.get(target);
      const index = targetListeners.findIndex(
        l => l.event === event && l.handler === handler
      );
      if (index > -1) {
        targetListeners.splice(index, 1);
      }
    }
  }
  
  cleanup() {
    for (const [target, listeners] of this.listeners) {
      for (const { event, handler, options } of listeners) {
        target.removeEventListener(event, handler, options);
      }
    }
    this.listeners.clear();
  }
}

// Uso global
window.eventManager = new EventManager();

// Limpar ao sair da página
window.addEventListener('beforeunload', () => {
  window.eventManager.cleanup();
});

class InputValidator {
  static sanitizeString(str, maxLength = 255) {
    if (typeof str !== 'string') str = String(str || '');
    return str.trim().slice(0, maxLength);
  }
  
  static sanitizeNumber(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const num = Number(value) || 0;
    return Math.max(min, Math.min(max, num));
  }
  
  static sanitizeEmail(email) {
    email = String(email || '').trim().toLowerCase();
    const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
    return emailRegex.test(email) ? email : '';
  }
  
  static sanitizePhone(phone) {
    // Remove tudo exceto números
    return String(phone || '').replace(/\D/g, '').slice(0, 15);
  }
  
  static sanitizeCurrency(value) {
    // Remove tudo exceto números, vírgula e ponto
    let cleaned = String(value || '').replace(/[^\d.,]/g, '');
    // Converte vírgula para ponto
    cleaned = cleaned.replace(',', '.');
    // Garante apenas um ponto decimal
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    return parseFloat(cleaned) || 0;
  }
  
  static sanitizeDate(date) {
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
}

// Exporta globalmente
window.InputValidator = InputValidator;

class RateLimiter {
  constructor(maxAttempts = 3, windowMs = 60000) {
    this.attempts = new Map();
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }
  
  isAllowed(key) {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    
    // Remove tentativas antigas
    const recentAttempts = attempts.filter(time => now - time < this.windowMs);
    
    if (recentAttempts.length >= this.maxAttempts) {
      return false;
    }
    
    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);
    return true;
  }
  
  reset(key) {
    this.attempts.delete(key);
  }
}

// Rate limiter para login
window.loginRateLimiter = new RateLimiter(5, 60000); // 5 tentativas por minuto

class Logger {
  constructor(module) {
    this.module = module;
    this.logLevel = localStorage.getItem('LOG_LEVEL') || 'warn';
  }
  
  _log(level, message, data = {}) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    if (levels[level] < levels[this.logLevel]) return;
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      module: this.module,
      level,
      message,
      data,
      user: window.currentUser?.username || 'anonymous',
      company: window.getCompany?.() || 'unknown'
    };
    
    console[level](
      `[${logEntry.module}] ${logEntry.message}`,
      logEntry.data
    );
    
    // Armazena logs críticos
    if (level === 'error') {
      this.storeError(logEntry);
    }
  }
  
  storeError(entry) {
    const errors = JSON.parse(localStorage.getItem('APP_ERRORS') || '[]');
    errors.push(entry);
    // Mantém apenas últimos 100 erros
    if (errors.length > 100) errors.shift();
    localStorage.setItem('APP_ERRORS', JSON.stringify(errors));
  }
  
  debug(message, data) { this._log('debug', message, data); }
  info(message, data) { this._log('info', message, data); }
  warn(message, data) { this._log('warn', message, data); }
  error(message, data) { this._log('error', message, data); }
}

// Criar loggers para cada módulo
window.loggers = {
  auth: new Logger('auth'),
  gerentes: new Logger('gerentes'),
  financeiro: new Logger('financeiro'),
  prestacoes: new Logger('prestacoes'),
  despesas: new Logger('despesas')
};

// Executar ao carregar
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🔧 Aplicando correções críticas...');
  
  // 1. Migrar senhas legadas
  if (typeof migrateLegacyPasswords === 'function') {
    await migrateLegacyPasswords();
  }
  
  // 2. Adicionar CSS para notificações
  if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
      .notification {
        transition: all 0.3s ease;
      }
      .notification-success { background: #4caf50 !important; }
      .notification-error { background: #f44336 !important; }
      .notification-info { background: #2196f3 !important; }
    `;
    document.head.appendChild(style);
  }
  
  console.log('✅ Correções aplicadas com sucesso!');
  
  // 3. Avisar se há atualizações pendentes
  const lastUpdate = localStorage.getItem('LAST_SECURITY_UPDATE');
  const currentVersion = '2024-12-19';
  
  if (lastUpdate !== currentVersion) {
    localStorage.setItem('LAST_SECURITY_UPDATE', currentVersion);
    if (window.showNotification) {
      showNotification('Sistema atualizado com correções de segurança', 'success');
    }
  }
});

console.log('📦 Script de correções carregado. Execute as funções conforme necessário.');


  /* --- Permissões: novas (granulares) + aliases antigos p/ compat --- */
  const PERM_ALIASES = {
    // Início
    'inicio_view': ['inicio_view','dashboard','dashboard_view','home','inicio'],
    'inicio_edit': ['inicio_edit','dashboard_edit'],

    // Cadastros → Gerentes
    'cad_gerentes_view': ['cad_gerentes_view','cadastros','cadastros_view','gerentes','gerentes_view'],
    'cad_gerentes_edit': ['cad_gerentes_edit','cadastros_edit','gerentes_edit'],

      // ✅ fichas: alinhar os nomes usados na UI
  'fichas_view': ['fichas','fichas_view','cad_fichas_view'],
  'fichas_edit': ['fichas_edit','cad_fichas_edit'],

    // Prestações → Lançar
    'prest_lancar_view': ['prest_lancar_view','prestacoes','prestacoes_view'],
    'prest_lancar_edit': ['prest_lancar_edit','prestacoes_edit'],

    // Prestações → Relatórios
    'prest_rel_view':    ['prest_rel_view','relatorios','relatorios_view','prestacoes_view'],
    'prest_rel_edit':    ['prest_rel_edit','relatorios_edit','prestacoes_edit'],

    // Prestações → Finalizadas
    'prest_fech_view':   ['prest_fech_view','prestacoes_view'],
    'prest_fech_edit':   ['prest_fech_edit','prestacoes_edit'],

    // Vales
    'prest_vales_view': ['prest_vales_view','vales','vales_view','prest_vales_tab'],
  'prest_vales_edit': ['prest_vales_edit','vales_edit'],

    // Financeiro
    'financeiro_view':   ['financeiro_view','financeiro'],
    'financeiro_edit':   ['financeiro_edit'],

    // Despesas
    'despesas_view':     ['despesas_view','despesas'],
    'despesas_edit':     ['despesas_edit'],

    // Usuários (admin)
    'usuarios':          ['usuarios','admin']
  };
  const MODS = Object.keys(PERM_ALIASES);

  function permsAllTrue(){ const o={}; MODS.forEach(k=>o[k]=true); return o; }

  function canonicalPermKey(name){
    if (!name) return null;
    if (PERM_ALIASES[name]) return name;
    for (const k in PERM_ALIASES){
      if (PERM_ALIASES[k].includes(name)) return k;
    }
    return name;
  }

  // Normalizador legado: array / csv / objeto -> objeto canônico
  function toPermObject(perms){
    const out = {}; MODS.forEach(k => out[k] = false);
    if (!perms) return out;

    if (!Array.isArray(perms) && typeof perms === 'object'){
      for (const k in perms){
        if (!perms[k]) continue;
        const key = canonicalPermKey(k);
        if (Object.prototype.hasOwnProperty.call(out, key)) out[key] = true;
        else {
          for (const kk in PERM_ALIASES){
            if (PERM_ALIASES[kk].includes(k)) { out[kk] = true; break; }
          }
        }
      }
      return out;
    }

    const arr = Array.isArray(perms) ? perms.slice()
      : String(perms).split(/[,\s;]+/).filter(Boolean);

    arr.forEach(raw=>{
      const x = String(raw||'').trim(); if (!x) return;
      const key = canonicalPermKey(x);
      if (Object.prototype.hasOwnProperty.call(out, key)) out[key] = true;
      else {
        for (const kk in PERM_ALIASES){
          if (PERM_ALIASES[kk].includes(x)) { out[kk] = true; break; }
        }
      }
    });
    return out;
  }

  // Editar ⇒ ver (mesma ideia, só que sem salvar duplicado)
  function __editImpliesView(key){
    if (!key || !key.endsWith('_view')) return null;
    return key.replace('_view','_edit');
  }

  // hasPerm no estilo antigo (aceita array ou objeto) + aliases + “editar ⇒ ver”
  function hasPerm(cu, need){
    if (!need) return true;
    const key = canonicalPermKey(need);
    if (cu && cu.role === 'admin') return true;
    if (!cu || !cu.perms) return false;

    let p = cu.perms;
    if (Array.isArray(p)){
      // legado puro
      if (p.includes(need) || p.includes(key)) return true;
      const aliases = PERM_ALIASES[key] || [];
      if (aliases.length && p.some(x=>aliases.includes(x))) return true;
      // se pediram *_view e o array contém *_edit
      const maybeEdit = __editImpliesView(key);
      if (maybeEdit && (p.includes(maybeEdit) || (PERM_ALIASES[maybeEdit]||[]).some(a=>p.includes(a)))) return true;
      return false;
    }

    // objeto
    if (p[key]) return true;
    const aliases = PERM_ALIASES[key] || [];
    if (aliases.some(a => p[a] || p[canonicalPermKey(a)])) return true;
    const maybeEdit = __editImpliesView(key);
    if (maybeEdit && (p[maybeEdit] || (PERM_ALIASES[maybeEdit]||[]).some(a => p[a] || p[canonicalPermKey(a)]))) return true;
    return false;
  }

  /* --- Persistência & sessão --- */
  async function loadUsers() {
    try {
      // Se a API ainda não estiver pronta, retorna array vazio
      if (!window.SupabaseAPI || (!window.SupabaseAPI.users && !window.SupabaseAPI.usuarios)) {
        console.warn('[RBAC] SupabaseAPI.users ainda não disponível. Retornando [].');
        return [];
      }
  
      const api = window.SupabaseAPI.users || window.SupabaseAPI.usuarios;
      const users = await api.getAll();
      return Array.isArray(users) ? users : [];
    } catch (error) {
      console.error('[RBAC] Erro ao carregar usuários do Supabase:', error);
      return [];
    }
  }
  
  
  async function saveUsers(arr) {
    // Não precisa mais salvar array completo
    // Cada operação já salva individualmente
  }
  
  // ✅ ATUALIZAR createUser:
  async function createUser({username, password, role='operador', perms, companies}) {
    username = String(username||'').trim().toLowerCase();
    if (!username || !password) return {ok:false, msg:'Preencha usuário e senha'};
    
    // Verifica se existe
    const existing = await window.SupabaseAPI.users.getByUsername(username);
    if (existing) return {ok:false, msg:'Usuário já existe'};
    
    // Cria no Supabase
    const permObj = (role==='admin') ? permsAllTrue() : toPermObject(perms);
    
    try {
      await window.SupabaseAPI.users.create({
        username,
        pass: await sha(password),
        role,
        perms: permObj,
        companies: Array.isArray(companies) ? companies : []
      });
      
      return {ok:true};
    } catch (error) {
      return {ok:false, msg: error.message};
    }
  }
  
  // ✅ ATUALIZAR updateUser:
  async function updateUser(id, patch) {
    try {
      const p = Object.assign({}, patch||{});
      if (p.perms) p.perms = toPermObject(p.perms);
      if (p.role === 'admin') p.perms = permsAllTrue();
      if (typeof p.password === 'string') delete p.password;
      
      await window.SupabaseAPI.users.update(id, p);
      return {ok:true};
    } catch (error) {
      return {ok:false, msg: error.message};
    }
  }
  
  // ✅ ATUALIZAR removeUser:
  async function removeUser(id) {
    try {
      await window.SupabaseAPI.users.delete(id);
      return {ok:true};
    } catch (error) {
      return {ok:false, msg: error.message};
    }
  }
  
  // ✅ ATUALIZAR login:
  async function login(username, password) {
    const u = await window.SupabaseAPI.users.getByUsername(username);
    if (!u || u.active===false) return {ok:false, msg:'Usuário inexistente ou inativo'};
    if (!(await passOk(u.pass, password))) return {ok:false, msg:'Senha inválida'};
    
    const perms = (u.role==='admin') ? permsAllTrue()
               : (Array.isArray(u.perms) ? toPermObject(u.perms) : (u.perms||{}));
    
    setSession({
      id: u.id,
      username: u.username,
      role: u.role,
      perms,
      companies: Array.isArray(u.companies) ? u.companies : []
    });
    
    document.dispatchEvent(new CustomEvent('auth:login', { detail:{ user: current() } }));
    return {ok:true};
  }
  function setSession(s){ jset(K_SESS, s); }
  function current(){ return jget(K_SESS, null); }

  // Garante admin e migra permissão antiga (array) p/ objeto
  async function ensureAdmin() {
    let arr = await loadUsers();
    if (!Array.isArray(arr)) arr = [];
  
    // Se já existe admin, só ajusta permissões e sessão
    if (arr.some(u => u.role === 'admin')) {
      console.log('[RBAC] Admin já existe (via Supabase).');
  
      arr = arr.map(u => {
        if (u.role === 'admin') {
          u.perms = permsAllTrue();
        } else if (Array.isArray(u.perms)) {
          u.perms = toPermObject(u.perms);
        }
        return u;
      });
  
    } else {
      // Em teoria o supabase-init já criou o admin,
      // então aqui só logamos o estado.
      console.warn('[RBAC] Nenhum admin encontrado na lista de usuários.');
    }
  
    const s = current();
    if (s && Array.isArray(s.perms)) {
      s.perms = (s.role === 'admin') ? permsAllTrue() : toPermObject(s.perms);
      setSession(s);
    }
  }
  

  /* --- API pública --- */
  function list(){ return loadUsers(); }
  function listUsers(){ return list(); }

  function find(username){
    username = String(username||'').trim().toLowerCase();
    return loadUsers().find(u=>u.username===username);
  }

  async function createUser({username, password, role='operador', perms, companies}) {
    username = String(username||'').trim().toLowerCase();
    if (!username || !password) return {ok:false, msg:'Preencha usuário e senha'};
    const arr = loadUsers();
    if (arr.some(u=>u.username===username)) return {ok:false, msg:'Usuário já existe'};
    const permObj = (role==='admin') ? permsAllTrue() : toPermObject(perms);
    arr.push({
      id: uid(), username, pass: await sha(password),
      role, active:true, perms: permObj,
      companies: Array.isArray(companies) ? companies : [],   // << NOVO
      createdAt:new Date().toISOString()
    });
    saveUsers(arr);
    return {ok:true};
  }

  function updateUser(id, patch){
    const arr = loadUsers();
    const i = arr.findIndex(u=>u.id===id);
    if (i<0) return {ok:false, msg:'Usuário não encontrado'};
    const p = Object.assign({}, patch||{});
    if (p.perms) p.perms = toPermObject(p.perms);
    if (p.role === 'admin') p.perms = permsAllTrue();
    if (typeof p.password === 'string'){ delete p.password; } 
    arr[i] = Object.assign({}, arr[i], p);
    saveUsers(arr);
    return {ok:true};
  }

  function removeUser(id){ saveUsers(loadUsers().filter(u=>u.id!==id)); }

  async function login(username, password){
    const u = find(username);
    if (!u || u.active===false) return {ok:false, msg:'Usuário inexistente ou inativo'};
    if (!(await passOk(u.pass, password))) return {ok:false, msg:'Senha inválida'};
    const perms = (u.role==='admin') ? permsAllTrue()
               : (Array.isArray(u.perms) ? toPermObject(u.perms) : (u.perms||{}));
    setSession({
      id:u.id, username:u.username, role:u.role,
      perms,
      companies: Array.isArray(u.companies) ? u.companies : []  // << NOVO
    });
    document.dispatchEvent(new CustomEvent('auth:login', { detail:{ user: current() } }));
    return {ok:true};
  }

  async function changePassword(id, newPassword){
    newPassword = String(newPassword||'');
    if (!newPassword) return {ok:false, msg:'Senha vazia'};
    const arr = loadUsers();
    const i = arr.findIndex(u=>u.id===id);
    if (i<0) return {ok:false, msg:'Usuário não encontrado'};
    arr[i] = Object.assign({}, arr[i], { pass: await sha(newPassword) });
    saveUsers(arr);
    // mantém sessão; não força logout
    return {ok:true};
  }
  
  

  function logout(){
    localStorage.removeItem(K_SESS);
    document.dispatchEvent(new Event('auth:logout'));
  }

  // ✅ GUARD APRIMORADO - Controla visibilidade de elementos E menus da sidebar
  function guard(){
    const cu = current();
    
    // 1. Controla elementos com data-perm (páginas, botões, etc)
    document.querySelectorAll('[data-perm]').forEach(el=>{
      const need = el.getAttribute('data-perm');
      const show = hasPerm(cu, need);
      if (show){ 
        el.removeAttribute('hidden'); 
        el.style.display=''; 
      } else { 
        el.setAttribute('hidden',''); 
        el.style.display='none'; 
      }
    });

    // 2. ✅ Controla visibilidade dos itens de menu da sidebar
    document.querySelectorAll('.sb-item[data-perm], .sb-subitem[data-perm]').forEach(item => {
      const need = item.getAttribute('data-perm');
      const show = hasPerm(cu, need);
      
      if (show) {
        item.style.display = '';
        item.removeAttribute('hidden');
      } else {
        item.style.display = 'none';
        item.setAttribute('hidden', '');
      }
    });

    // 3. ✅ Esconde grupos vazios (quando todas as subitens estão ocultas)
    document.querySelectorAll('.sb-group').forEach(group => {
      const groupKey = group.getAttribute('data-group');
      if (!groupKey) return;
      
      const sub = document.querySelector(`.sb-sub[data-sub="${groupKey}"]`);
      if (!sub) return;
      
      const visibleItems = Array.from(sub.querySelectorAll('.sb-subitem'))
        .filter(item => item.style.display !== 'none' && !item.hasAttribute('hidden'));
      
      // Se não há itens visíveis, esconde o grupo inteiro
      if (visibleItems.length === 0) {
        group.style.display = 'none';
        group.setAttribute('hidden', '');
        sub.style.display = 'none';
        sub.setAttribute('hidden', '');
      } else {
        group.style.display = '';
        group.removeAttribute('hidden');
      }
    });
  }

  // Exposição
// Exposição
window.UserAuth = Object.assign(window.UserAuth || {}, {
  // lista / CRUD
  list, 
  listUsers,
  createUser, 
  updateUser, 
  removeUser,
  
  // sessão / auth
  login, 
  logout, 
  currentUser: current,
  current,          // <– exposto para o adapter
  setSession,       // <– exposto para o adapter
  
  // permissões
  permsAllTrue,     // <– exposto para o adapter
  can: (p) => hasPerm(current(), p),
  has: (p) => hasPerm(current(), p),
  isAdmin: () => (current()?.role === 'admin'),
  
  // extras
  guard,
  changePassword
});


  /* ====== ENFORCE DE EMPRESAS (operador só vê/troca o que tiver permissão) ====== */
(function(){
  // Lê da sessão RBAC as empresas permitidas. Array vazio = TODAS (sem restrição).
  function __allowedCompanies(){
    try{
      const s = (window.UserAuth && UserAuth.currentUser && UserAuth.currentUser()) || null;
      if (s?.role === 'admin') return []; // admin vê tudo
      const arr = Array.isArray(s?.companies) ? s.companies : [];
      return arr.map(c => String(c).toUpperCase());
    }catch(_){ return []; }
  }

  // Esconde/desabilita opções não permitidas nos selects de empresa
  function __filterCompanySelects(allowed){
    try{
      const sels = document.querySelectorAll('[data-company-select], #empresaSelect');
      sels.forEach(sel=>{
        const upVal = String(sel.value || '').toUpperCase();
        let keepCurrent = true;

        Array.from(sel.options).forEach(opt=>{
          const v = String(opt.value || '').toUpperCase();
          const ok = (allowed.length === 0) || allowed.includes(v);
          opt.hidden = !ok;
          opt.disabled = !ok;
          if (!ok && v === upVal) keepCurrent = false;
        });

        if (!keepCurrent){
          const firstOk = Array.from(sel.options).find(o => !o.hidden && !o.disabled);
          if (firstOk) sel.value = firstOk.value;
        }
      });
    }catch(_){}
  }

  // Envolve setCompany para bloquear trocas proibidas
  (function __wrapSetCompany(){
    const raw = window.setCompany;
    if (typeof raw !== 'function' || raw.__rbacWrapped) return;

    function wrapped(emp){
      const target = String(emp || 'BSX').toUpperCase();
      const allowed = __allowedCompanies();
      if (allowed.length && !allowed.includes(target)){
        alert('Seu usuário não tem acesso à empresa: ' + target);
        __filterCompanySelects(allowed);
        return;
      }
      return raw(target); // ok, troca e recarrega
    }
    wrapped.__rbacWrapped = true;
    window.setCompany = wrapped;
  })();

  // Força empresa válida e ajusta selects (chamado em vários ganchos)
  function enforceCompanyAccess(){
    const allowed = __allowedCompanies();
    try{
      const cur = String(localStorage.getItem('CURRENT_COMPANY') || 'BSX').toUpperCase();
      // se houver restrição e a atual não estiver na lista, troca para a 1ª permitida
      if (allowed.length && !allowed.includes(cur)){
        const go = allowed[0] || 'BSX';
        // vai recarregar a página; não continua daqui
        return window.setCompany && window.setCompany(go);
      }
    }catch(_){}

    // sem troca: só filtra o(s) select(s)
    __filterCompanySelects(allowed);
  }

  // expõe na API pública (users-page.js já chama isso após salvar/editar)
  window.UserAuth = Object.assign(window.UserAuth || {}, { enforceCompanyAccess });

  // aplica em momentos chave
  try { document.addEventListener('auth:login', enforceCompanyAccess); } catch(_){}
  try { window.addEventListener('pageshow', enforceCompanyAccess); } catch(_){}
  try { document.addEventListener('empresa:change', enforceCompanyAccess); } catch(_){}
})();


ensureAdmin().then(guard);
window.addEventListener('pageshow', guard);
document.addEventListener('auth:login', guard);
document.addEventListener('auth:logout', guard);
})();