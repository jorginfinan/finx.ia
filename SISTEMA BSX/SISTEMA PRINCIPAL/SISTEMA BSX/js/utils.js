// ==========================================
// utils.js - VERSÃO OTIMIZADA v2.0
// ==========================================
(function () {
  'use strict';

  // ===== SISTEMA DE CACHE EM MEMÓRIA =====
  const DataCache = {
    _cache: new Map(),
    _ttl: 60000, // 1 minuto
    
    get(key, loader) {
      const cached = this._cache.get(key);
      if (cached && Date.now() - cached.timestamp < this._ttl) {
        return cached.data;
      }
      
      const data = loader();
      this._cache.set(key, { data, timestamp: Date.now() });
      return data;
    },
    
    set(key, data) {
      this._cache.set(key, { data, timestamp: Date.now() });
    },
    
    invalidate(key) {
      this._cache.delete(key);
    },
    
    clear() {
      this._cache.clear();
    },
    
    // Limpa cache expirado periodicamente
    startAutoCleanup() {
      setInterval(() => {
        const now = Date.now();
        for (const [key, value] of this._cache) {
          if (now - value.timestamp > this._ttl) {
            this._cache.delete(key);
          }
        }
      }, this._ttl);
    }
  };

  // ===== JSON + LocalStorage COM CACHE =====
  function jget(key, defaultValue) {
    return DataCache.get(key, () => {
      try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : defaultValue;
      } catch (error) {
        console.error('[jget] Erro ao ler:', key, error);
        return defaultValue;
      }
    });
  }

  function jset(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      DataCache.invalidate(key);
      return true;
    } catch (error) {
      console.error('[jset] Erro ao salvar:', key, error);
      // Tenta limpar espaço se quota excedida
      if (error.name === 'QuotaExceededError') {
        console.warn('Quota excedida, tentando limpar cache...');
        clearOldData();
      }
      return false;
    }
  }

  // Limpa dados antigos em caso de quota excedida
  function clearOldData() {
    const keys = Object.keys(localStorage);
    const timestampKeys = keys.filter(k => k.includes('_timestamp'));
    
    // Ordena por timestamp e remove os mais antigos
    timestampKeys.sort((a, b) => {
      const tsA = parseInt(localStorage.getItem(a)) || 0;
      const tsB = parseInt(localStorage.getItem(b)) || 0;
      return tsA - tsB;
    });
    
    // Remove 20% dos dados mais antigos
    const toRemove = Math.ceil(timestampKeys.length * 0.2);
    timestampKeys.slice(0, toRemove).forEach(key => {
      const dataKey = key.replace('_timestamp', '');
      localStorage.removeItem(key);
      localStorage.removeItem(dataKey);
    });
  }

  // ===== GERADOR DE ID ÚNICO MELHORADO =====
  function uid(prefix = '') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    const counter = (uid.counter = (uid.counter || 0) + 1);
    return prefix + timestamp + '_' + random + '_' + counter.toString(36);
  }

  // ===== ESCAPE HTML (PROTEGE CONTRA XSS) =====
  function esc(texto) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;',
      '`': '&#x60;',
      '=': '&#x3D;'
    };
    return String(texto ?? '').replace(/[&<>"'`=\/]/g, m => map[m]);
  }

  // ===== PARSER DE MOEDA MELHORADO =====
  function parseMoney(value) {
    if (value == null) return 0;

    let s = String(value).trim();
    if (!s) return 0;

    // Remove R$, espaços e qualquer coisa que não seja dígito, ponto, vírgula, sinal
    s = s.replace(/[^\d.,-]/g, '');

    // Se tiver ponto e vírgula: assume ponto como milhar e vírgula como decimal
    if (s.includes('.') && s.includes(',')) {
      // 1.234,56 → 1234.56
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.includes(',')) {
      // Só vírgula: verifica se é decimal ou milhar
      const parts = s.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        // 1234,56 → 1234.56 (decimal)
        s = s.replace(',', '.');
      } else {
        // 1,234 → 1234 (milhar)
        s = s.replace(/,/g, '');
      }
    }

    const num = parseFloat(s);
    return isNaN(num) ? 0 : num;
  }

  // ===== FORMATAÇÃO DE MOEDA =====
  function formatMoney(valor) {
    const num = typeof valor === 'number' ? valor : parseMoney(valor);
    return num.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  }

  // ===== FORMATAÇÃO DE DATA =====
  function formatDate(date) {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  function formatDateTime(date) {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // ===== DEBOUNCE MELHORADO =====
  function debounce(func, wait = 300) {
    let timeout;
    let lastCall = 0;
    
    return function executedFunction(...args) {
      const context = this;
      const now = Date.now();
      const timeSinceLastCall = now - lastCall;
      
      clearTimeout(timeout);
      
      // Execução imediata se passou tempo suficiente
      if (timeSinceLastCall >= wait) {
        lastCall = now;
        return func.apply(context, args);
      }
      
      // Senão, agenda execução
      timeout = setTimeout(() => {
        lastCall = Date.now();
        func.apply(context, args);
      }, wait - timeSinceLastCall);
    };
  }

  // ===== THROTTLE (LIMITA EXECUÇÕES) =====
  function throttle(func, limit = 300) {
    let inThrottle;
    return function(...args) {
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // ===== DEEP CLONE MELHORADO =====
  function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof RegExp) return new RegExp(obj);
    if (Array.isArray(obj)) return obj.map(item => deepClone(item));

    const cloned = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }

  // ===== VALIDADORES MELHORADOS =====
  const Validators = {
    email(email) {
      const re = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
      return re.test(String(email).toLowerCase());
    },

    phone(phone) {
      const numbers = String(phone).replace(/\D/g, '');
      return numbers.length === 10 || numbers.length === 11;
    },

    cpf(cpf) {
      cpf = String(cpf).replace(/\D/g, '');

      if (cpf.length !== 11) return false;
      if (/^(\d)\1{10}$/.test(cpf)) return false;

      let sum = 0;
      let remainder;

      for (let i = 1; i <= 9; i++) {
        sum += parseInt(cpf.substring(i - 1, i), 10) * (11 - i);
      }

      remainder = (sum * 10) % 11;
      if (remainder === 10 || remainder === 11) remainder = 0;
      if (remainder !== parseInt(cpf.substring(9, 10), 10)) return false;

      sum = 0;
      for (let i = 1; i <= 10; i++) {
        sum += parseInt(cpf.substring(i - 1, i), 10) * (12 - i);
      }

      remainder = (sum * 10) % 11;
      if (remainder === 10 || remainder === 11) remainder = 0;
      if (remainder !== parseInt(cpf.substring(10, 11), 10)) return false;

      return true;
    },

    cnpj(cnpj) {
      cnpj = String(cnpj).replace(/\D/g, '');

      if (cnpj.length !== 14) return false;
      if (/^(\d)\1{13}$/.test(cnpj)) return false;

      let length = cnpj.length - 2;
      let numbers = cnpj.substring(0, length);
      const digits = cnpj.substring(length);
      let sum = 0;
      let pos = length - 7;

      for (let i = length; i >= 1; i--) {
        sum += numbers.charAt(length - i) * pos--;
        if (pos < 2) pos = 9;
      }

      let result = sum % 11 < 2 ? 0 : 11 - sum % 11;
      if (result != digits.charAt(0)) return false;

      length = length + 1;
      numbers = cnpj.substring(0, length);
      sum = 0;
      pos = length - 7;

      for (let i = length; i >= 1; i--) {
        sum += numbers.charAt(length - i) * pos--;
        if (pos < 2) pos = 9;
      }

      result = sum % 11 < 2 ? 0 : 11 - sum % 11;
      if (result != digits.charAt(1)) return false;

      return true;
    },

    money(value) {
      const num = parseMoney(value);
      return !isNaN(num) && num >= 0;
    },

    required(value) {
      if (value === null || value === undefined) return false;
      if (typeof value === 'string') return value.trim().length > 0;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    },

    minLength(value, min) {
      if (!value) return false;
      return String(value).length >= min;
    },

    maxLength(value, max) {
      if (!value) return true;
      return String(value).length <= max;
    },

    range(value, min, max) {
      const num = typeof value === 'number' ? value : parseMoney(value);
      return num >= min && num <= max;
    }
  };

  // ===== LOGGER CENTRALIZADO =====
  class Logger {
    constructor(module) {
      this.module = module;
      this.enabled = localStorage.getItem('DEBUG_MODE') === 'true';
    }

    log(message, ...args) {
      if (this.enabled) {
        console.log(`[${this.module}]`, message, ...args);
      }
    }

    warn(message, ...args) {
      console.warn(`[${this.module}]`, message, ...args);
    }

    error(message, ...args) {
      console.error(`[${this.module}]`, message, ...args);

      // Salvar erro no localStorage
      try {
        const errors = jget('APP_ERRORS', []);
        errors.push({
          module: this.module,
          message: String(message),
          timestamp: new Date().toISOString(),
          data: args.map(a => {
            try {
              return JSON.stringify(a);
            } catch {
              return String(a);
            }
          })
        });

        // Manter apenas últimos 50 erros
        if (errors.length > 50) {
          errors.splice(0, errors.length - 50);
        }

        jset('APP_ERRORS', errors);
      } catch (e) {
        // Falha silenciosa se não conseguir salvar
      }
    }

    time(label) {
      if (this.enabled) {
        console.time(`[${this.module}] ${label}`);
      }
    }

    timeEnd(label) {
      if (this.enabled) {
        console.timeEnd(`[${this.module}] ${label}`);
      }
    }
  }

  // ===== NOTIFICAÇÕES =====
  function showNotification(message, type = 'info', duration = 3000) {
    type = type || 'info';
    
    // Remove notificação anterior se existir
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = 'notification notification-' + type;
    notification.textContent = message;
    
    const colors = {
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    };
    
    notification.style.cssText = 
      'position: fixed; top: 20px; right: 20px; padding: 14px 20px;' +
      'background: ' + (colors[type] || colors.info) + ';' +
      'color: white; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);' +
      'z-index: 10000; animation: slideInRight 0.3s ease; font-weight: 500;' +
      'max-width: 400px; word-wrap: break-word;';
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }

  // ===== FORMATADORES EXTRAS =====
  function fmtHora(d) {
    if (!d) return '';
    try {
      const x = d instanceof Date ? d : new Date(d);
      if (!isFinite(+x)) return '';
      return x.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
    } catch {
      return '';
    }
  }

  function fmtData(dateStr) {
    if (!dateStr) return '';
    const parts = String(dateStr).split('-');
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }

  // ===== HELPERS DE ARRAY =====
  const ArrayHelpers = {
    unique(arr) {
      return [...new Set(arr)];
    },
    
    groupBy(arr, key) {
      return arr.reduce((groups, item) => {
        const group = item[key];
        if (!groups[group]) groups[group] = [];
        groups[group].push(item);
        return groups;
      }, {});
    },
    
    sortBy(arr, key, desc = false) {
      return [...arr].sort((a, b) => {
        const valA = a[key];
        const valB = b[key];
        
        if (valA < valB) return desc ? 1 : -1;
        if (valA > valB) return desc ? -1 : 1;
        return 0;
      });
    },
    
    sum(arr, key) {
      return arr.reduce((sum, item) => sum + (item[key] || 0), 0);
    }
  };

  // ===== EXPORTAR API PÚBLICA =====
  window.Utils = {
    // Storage
    jget,
    jset,
    DataCache,
    
    // IDs
    uid,
    
    // Segurança
    esc,
    
    // Formatação
    formatMoney,
    formatDate,
    formatDateTime,
    parseMoney,
    fmtHora,
    fmtData,
    
    // Performance
    debounce,
    throttle,
    
    // Utilidades
    deepClone,
    Validators,
    Logger,
    ArrayHelpers,
    
    // UI
    showNotification
  };

  // Manter compatibilidade global
  window.jget = jget;
  window.jset = jset;
  window.uid = uid;
  window.esc = esc;
  window.showNotification = showNotification;
  window.fmtHora = fmtHora;
  window.fmtData = fmtData;

  // Inicia limpeza automática de cache
  DataCache.startAutoCleanup();

  console.log('✅ Utilitários v2.0 carregados');
})();

// ===== ANIMAÇÕES CSS (adicionar ao head) =====
if (!document.getElementById('utils-animations')) {
  const style = document.createElement('style');
  style.id = 'utils-animations';
  style.textContent = `
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}