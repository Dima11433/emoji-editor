/**
 * MAGNAT Emoji Studio — Bot Database & State Store
 * Lightweight zero-dependency JSON-based store with automatic persistence.
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');

const DEFAULT_ADMINS = ['6667583896', '1380263054'];
if (process.env.ADMIN_IDS) {
  process.env.ADMIN_IDS.split(',').forEach(id => {
    const clean = id.trim();
    if (clean && !DEFAULT_ADMINS.includes(clean)) DEFAULT_ADMINS.push(clean);
  });
}

function loadInitialState() {
  const initial = {
    admins: DEFAULT_ADMINS,
    users: {},
    promos: {
      'MAGNAT2026': {
        code: 'MAGNAT2026',
        type: 'generations',
        value: 50,
        activations_left: 1000,
        max_activations: 1000,
        created_at: new Date().toISOString(),
      },
      'VIPSTART': {
        code: 'VIPSTART',
        type: 'plan',
        value: 'pro',
        days: 30,
        activations_left: 500,
        max_activations: 500,
        created_at: new Date().toISOString(),
      },
      'EMOJIKING': {
        code: 'EMOJIKING',
        type: 'generations',
        value: 100,
        activations_left: 200,
        max_activations: 200,
        created_at: new Date().toISOString(),
      },
    },
    stats: {
      total_launches: 0,
      total_generations_used: 0,
      total_stars_earned: 0,
      total_rub_earned: 0,
      last_backup_at: new Date().toISOString(),
    },
    settings: {
      maintenance: false,
      stars_rate: 1.2,
      price_per_piece: 9,
      price_per_piece_bulk: 7,
      free_trial_generations: 5,
    },
  };

  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      // Merge initial admins
      DEFAULT_ADMINS.forEach(id => {
        if (!parsed.admins.includes(id)) parsed.admins.push(id);
      });
      return { ...initial, ...parsed };
    }
  } catch (e) {
    console.error('Error loading db.json, creating fresh store:', e.message);
  }

  return initial;
}

const state = loadInitialState();

function save() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save db.json:', err.message);
  }
}

// Initial save to disk
save();

const db = {
  isAdmin(userId) {
    const sId = String(userId);
    return state.admins.includes(sId);
  },

  addAdmin(userId) {
    const sId = String(userId);
    if (!state.admins.includes(sId)) {
      state.admins.push(sId);
      save();
    }
  },

  removeAdmin(userId) {
    const sId = String(userId);
    state.admins = state.admins.filter(id => id !== sId);
    save();
  },

  getAdmins() {
    return [...state.admins];
  },

  upsertUser(tgUser) {
    if (!tgUser || !tgUser.id) return null;
    const id = String(tgUser.id);
    const now = new Date().toISOString();

    if (!state.users[id]) {
      state.users[id] = {
        id: tgUser.id,
        username: tgUser.username || null,
        first_name: tgUser.first_name || 'User',
        last_name: tgUser.last_name || null,
        language_code: tgUser.language_code || 'ru',
        is_premium: !!tgUser.is_premium,
        plan: 'free',
        plan_expires: null,
        generations: state.settings.free_trial_generations || 5,
        total_spent_stars: 0,
        total_spent_rub: 0,
        joined_at: now,
        last_active: now,
        is_banned: false,
      };
      state.stats.total_launches++;
    } else {
      state.users[id].username = tgUser.username || state.users[id].username;
      state.users[id].first_name = tgUser.first_name || state.users[id].first_name;
      state.users[id].last_active = now;
      if (tgUser.is_premium !== undefined) {
        state.users[id].is_premium = !!tgUser.is_premium;
      }
    }

    save();
    return state.users[id];
  },

  getUser(userId) {
    const id = String(userId);
    return state.users[id] || null;
  },

  findUser(query) {
    const q = String(query).replace('@', '').toLowerCase().trim();
    if (!q) return null;

    // Check direct ID match
    if (state.users[q]) return state.users[q];

    // Check username or first_name
    for (const u of Object.values(state.users)) {
      if (u.username && u.username.toLowerCase() === q) return u;
      if (String(u.id) === q) return u;
    }
    return null;
  },

  getAllUsers() {
    return Object.values(state.users);
  },

  updateUser(userId, partial) {
    const id = String(userId);
    if (!state.users[id]) return null;
    state.users[id] = { ...state.users[id], ...partial };
    save();
    return state.users[id];
  },

  grantPlan(userId, planId, days = 30) {
    const user = db.getUser(userId);
    if (!user) return null;

    const expires = new Date();
    if (planId === 'vip') {
      expires.setFullYear(expires.getFullYear() + 99); // Lifetime
    } else {
      expires.setDate(expires.getDate() + Number(days));
    }

    user.plan = planId;
    user.plan_expires = expires.toISOString();
    // Add bonus generations with plan
    const bonusGen = planId === 'vip' || planId === 'max' ? 9999 : planId === 'pro_plus' ? 400 : 150;
    user.generations = Math.max(user.generations, bonusGen);

    save();
    return user;
  },

  addGenerations(userId, count) {
    const user = db.getUser(userId);
    if (!user) return null;
    user.generations = (user.generations || 0) + Number(count);
    save();
    return user;
  },

  recordPayment(userId, starsAmount = 0, rubAmount = 0) {
    const user = db.getUser(userId);
    if (user) {
      user.total_spent_stars += starsAmount;
      user.total_spent_rub += rubAmount;
    }
    state.stats.total_stars_earned += starsAmount;
    state.stats.total_rub_earned += rubAmount;
    save();
  },

  getStats() {
    const users = Object.values(state.users);
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const activeToday = users.filter(u => new Date(u.last_active).getTime() > oneDayAgo).length;
    const paidUsers = users.filter(u => u.plan !== 'free' || u.total_spent_stars > 0 || u.total_spent_rub > 0).length;

    const plansCount = {
      free: 0,
      pro: 0,
      pro_plus: 0,
      max: 0,
      editor: 0,
      vip: 0,
    };
    users.forEach(u => {
      if (plansCount[u.plan] !== undefined) plansCount[u.plan]++;
      else plansCount.free++;
    });

    return {
      total_users: users.length,
      active_today: activeToday,
      paid_users: paidUsers,
      total_stars: state.stats.total_stars_earned,
      total_rub: state.stats.total_rub_earned,
      total_launches: state.stats.total_launches,
      plans_breakdown: plansCount,
      maintenance: state.settings.maintenance,
    };
  },

  // Promocodes
  getPromos() {
    return Object.values(state.promos);
  },

  getPromo(code) {
    return state.promos[String(code).toUpperCase()] || null;
  },

  createPromo({ code, type = 'generations', value = 20, days = 30, max_activations = 100 }) {
    const cleanCode = String(code).trim().toUpperCase();
    state.promos[cleanCode] = {
      code: cleanCode,
      type, // 'generations' or 'plan'
      value, // count or plan id
      days,
      activations_left: Number(max_activations),
      max_activations: Number(max_activations),
      created_at: new Date().toISOString(),
    };
    save();
    return state.promos[cleanCode];
  },

  deletePromo(code) {
    const cleanCode = String(code).trim().toUpperCase();
    if (state.promos[cleanCode]) {
      delete state.promos[cleanCode];
      save();
      return true;
    }
    return false;
  },

  usePromo(userId, code) {
    const promo = db.getPromo(code);
    if (!promo || promo.activations_left <= 0) return { ok: false, error: 'Промокод не найден или закончился' };

    const user = db.getUser(userId);
    if (!user) return { ok: false, error: 'Пользователь не найден' };

    if (user.used_promos && user.used_promos.includes(promo.code)) {
      return { ok: false, error: 'Вы уже использовали этот промокод' };
    }

    if (!user.used_promos) user.used_promos = [];
    user.used_promos.push(promo.code);
    promo.activations_left--;

    if (promo.type === 'generations') {
      user.generations += Number(promo.value);
    } else if (promo.type === 'plan') {
      db.grantPlan(userId, promo.value, promo.days || 30);
    }

    save();
    return { ok: true, promo, user };
  },

  getSettings() {
    return { ...state.settings };
  },

  updateSettings(partial) {
    state.settings = { ...state.settings, ...partial };
    save();
    return state.settings;
  },
};

module.exports = db;
