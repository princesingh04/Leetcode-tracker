/**
 * LeetCode Rating Tracker — Client Application Logic
 */

// Application State
const state = {
  allProblems: [],
  solvedSet: new Set(),
  token: localStorage.getItem('lc_tracker_token') || null,
  user: null,
  filters: {
    minRating: 0,
    maxRating: 4000,
    status: 'all', // 'all', 'solved', 'unsolved'
    search: ''
  },
  sort: {
    key: 'rating',
    asc: false
  },
  page: 1,
  limit: 50,
  filteredProblems: [], // Cache for pagination
  theme: localStorage.getItem('theme') || 'dark'
};

// DOM Element References
const elements = {
  app: document.getElementById('app'),
  authBtn: document.getElementById('auth-btn'),
  userBanner: document.getElementById('user-banner'),
  userLcUsername: document.getElementById('user-lc-username'),
  editLcBtn: document.getElementById('edit-lc-btn'),
  lastSyncedTime: document.getElementById('last-synced-time'),
  syncBtn: document.getElementById('sync-btn'),
  syncIcon: document.getElementById('sync-icon'),
  logoutBtn: document.getElementById('logout-btn'),
  themeToggleBtn: document.getElementById('theme-toggle-btn'),
  
  // Stats
  statTotalSolved: document.getElementById('stat-total-solved'),
  statTotalProgress: document.getElementById('stat-total-progress'),
  statMediumSolved: document.getElementById('stat-medium-solved'),
  statMediumProgress: document.getElementById('stat-medium-progress'),
  statHardSolved: document.getElementById('stat-hard-solved'),
  statHardProgress: document.getElementById('stat-hard-progress'),
  statMasterSolved: document.getElementById('stat-master-solved'),
  statMasterProgress: document.getElementById('stat-master-progress'),

  // Filters
  presetButtons: document.querySelectorAll('.preset-btn'),
  minRatingInput: document.getElementById('min-rating'),
  maxRatingInput: document.getElementById('max-rating'),
  applyRangeBtn: document.getElementById('apply-range-btn'),
  radioTabs: document.querySelectorAll('.radio-tab'),
  searchInput: document.getElementById('search-input'),

  // Table
  visibleCount: document.getElementById('visible-count'),
  sortSelect: document.getElementById('sort-select'),
  tableHeaders: document.querySelectorAll('.problems-table th.sortable'),
  problemsTbody: document.getElementById('problems-tbody'),

  // Pagination
  paginationContainer: document.getElementById('pagination-container'),
  pageCurrent: document.getElementById('page-current'),
  pageTotal: document.getElementById('page-total'),
  btnPrevPage: document.getElementById('btn-prev-page'),
  btnNextPage: document.getElementById('btn-next-page'),

  // Auth Modal
  authModal: document.getElementById('auth-modal'),
  closeAuthModal: document.getElementById('close-auth-modal'),
  tabLoginBtn: document.getElementById('tab-login-btn'),
  tabRegisterBtn: document.getElementById('tab-register-btn'),
  loginForm: document.getElementById('login-form'),
  registerForm: document.getElementById('register-form'),
  loginError: document.getElementById('login-error'),
  regError: document.getElementById('reg-error'),

  // LeetCode Prompt Modal
  leetcodePromptModal: document.getElementById('leetcode-prompt-modal'),
  closeLcModal: document.getElementById('close-lc-modal'),
  leetcodeHandleForm: document.getElementById('leetcode-handle-form'),
  modalLcUsernameInput: document.getElementById('modal-lc-username'),
  lcPromptError: document.getElementById('lc-prompt-error'),

  // Deep Sync Modal
  deepSyncBtn: document.getElementById('deep-sync-btn'),
  deepSyncIcon: document.getElementById('deep-sync-icon'),
  deepSyncModal: document.getElementById('deep-sync-modal'),
  closeDeepSyncModal: document.getElementById('close-deep-sync-modal'),
  deepSyncForm: document.getElementById('deep-sync-form'),
  sessionCookieInput: document.getElementById('session-cookie-input'),
  deepSyncError: document.getElementById('deep-sync-error'),
  submitDeepSyncBtn: document.getElementById('submit-deep-sync-btn'),

  // Toast
  toast: document.getElementById('toast'),
  toastMessage: document.getElementById('toast-message'),
  toastIcon: document.getElementById('toast-icon')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  setupEventListeners();
  if (state.token) {
    fetchUserDataAndProblems();
  } else {
    fetchGuestProblems();
  }
});

// Event Listeners Setup
function setupEventListeners() {
  // Auth Modal toggles
  elements.authBtn.addEventListener('click', () => showAuthModal(true));
  elements.closeAuthModal.addEventListener('click', () => showAuthModal(false));
  elements.authModal.addEventListener('click', (e) => {
    if (e.target === elements.authModal) showAuthModal(false);
  });

  elements.tabLoginBtn.addEventListener('click', () => switchAuthTab('login'));
  elements.tabRegisterBtn.addEventListener('click', () => switchAuthTab('register'));

  // LeetCode Prompt Modal
  elements.closeLcModal.addEventListener('click', () => showLcPromptModal(false));
  if (elements.editLcBtn) {
    elements.editLcBtn.addEventListener('click', () => {
      if (state.user && state.user.leetcodeUsername) {
        elements.modalLcUsernameInput.value = state.user.leetcodeUsername;
      }
      showLcPromptModal(true);
    });
  }
  elements.leetcodeHandleForm.addEventListener('submit', handleSaveLeetCodeHandle);

  // Auth Forms Submission
  elements.loginForm.addEventListener('submit', handleLogin);
  elements.registerForm.addEventListener('submit', handleRegister);
  elements.logoutBtn.addEventListener('click', handleLogout);

  // Sync Buttons
  elements.syncBtn.addEventListener('click', handleSync);
  if (elements.deepSyncBtn) {
    elements.deepSyncBtn.addEventListener('click', () => {
      showDeepSyncModal(true);
    });
  }
  
  // Deep Sync Modal Listeners
  if (elements.closeDeepSyncModal) {
    elements.closeDeepSyncModal.addEventListener('click', () => showDeepSyncModal(false));
    elements.deepSyncForm.addEventListener('submit', handleDeepSync);
  }

  // Theme Toggle
  if (elements.themeToggleBtn) {
    elements.themeToggleBtn.addEventListener('click', toggleTheme);
  }

  // Pagination Buttons
  if (elements.btnPrevPage) {
    elements.btnPrevPage.addEventListener('click', () => {
      if (state.page > 1) {
        state.page--;
        renderTable();
      }
    });
  }
  if (elements.btnNextPage) {
    elements.btnNextPage.addEventListener('click', () => {
      const totalPages = Math.ceil(state.filteredProblems.length / state.limit) || 1;
      if (state.page < totalPages) {
        state.page++;
        renderTable();
      }
    });
  }

  // Preset Buttons
  elements.presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.presetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filters.minRating = parseInt(btn.dataset.min, 10);
      state.filters.maxRating = parseInt(btn.dataset.max, 10);
      elements.minRatingInput.value = state.filters.minRating > 0 ? state.filters.minRating : '';
      elements.maxRatingInput.value = state.filters.maxRating < 4000 ? state.filters.maxRating : '';
      applyFilters();
    });
  });

  // Custom Range Apply
  elements.applyRangeBtn.addEventListener('click', () => {
    const minVal = parseInt(elements.minRatingInput.value, 10) || 0;
    const maxVal = parseInt(elements.maxRatingInput.value, 10) || 4000;
    state.filters.minRating = minVal;
    state.filters.maxRating = maxVal;
    
    elements.presetButtons.forEach(b => b.classList.remove('active'));
    applyFilters();
  });

  // Solved Radio Filters
  elements.radioTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      elements.radioTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.filters.status = tab.dataset.status;
      applyFilters();
    });
  });

  // Search Input (Debounced)
  let searchTimeout;
  elements.searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.filters.search = e.target.value.toLowerCase().trim();
      applyFilters();
    }, 250);
  });

  // Sort Table Headers (sync with dropdown)
  elements.tableHeaders.forEach(th => {
    th.addEventListener('click', () => {
      const sortKey = th.dataset.sort;
      if (state.sort.key === sortKey) {
        state.sort.asc = !state.sort.asc;
      } else {
        state.sort.key = sortKey;
        // Default id and title to ASC, rating and contest to DESC
        state.sort.asc = (sortKey === 'title' || sortKey === 'id');
      }
      
      syncSortUI();
      applyFilters();
    });
  });

  // Dropdown Sort Change
  if (elements.sortSelect) {
    elements.sortSelect.addEventListener('change', (e) => {
      const [key, dir] = e.target.value.split('-');
      state.sort.key = key;
      state.sort.asc = (dir === 'asc');
      
      syncSortUI();
      applyFilters();
    });
  }
}

// Global Google Credential Response Handler
window.handleGoogleCredentialResponse = async function(response) {
  try {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Google login failed');

    state.token = data.token;
    localStorage.setItem('lc_tracker_token', data.token);
    state.user = data.user;

    // Close Auth Modal
    showAuthModal(false);
    showToast(`Signed in as ${data.user.username || data.user.email}`, 'fa-circle-check');

    await fetchUserDataAndProblems();

    // Show LeetCode prompt modal if missing handle
    if (data.needsLeetcodeUsername || !data.user.leetcodeUsername) {
      showLcPromptModal(true);
    }
  } catch (err) {
    showToast(err.message || 'Google Login failed', 'fa-triangle-exclamation');
  }
};

// Save LeetCode Handle
async function handleSaveLeetCodeHandle(e) {
  e.preventDefault();
  elements.lcPromptError.classList.add('hidden');

  const leetcodeUsername = elements.modalLcUsernameInput.value.trim();
  if (!leetcodeUsername) {
    elements.lcPromptError.textContent = 'Please enter a valid LeetCode handle';
    elements.lcPromptError.classList.remove('hidden');
    return;
  }

  const saveBtn = document.getElementById('save-lc-handle-btn');
  saveBtn.disabled = true;
  saveBtn.innerHTML = `<i class="fa-solid fa-spinner spinning"></i> Syncing with LeetCode...`;

  try {
    const res = await fetch('/api/auth/leetcode-username', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ leetcodeUsername })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save handle');

    state.user = data.user;
    state.solvedSet = new Set(data.solvedIds || []);

    showLcPromptModal(false);
    updateUserBanner();
    updateStats();
    applyFilters();

    showToast(`LeetCode handle updated & synced (${data.user.solvedCount} solved)!`, 'fa-circle-check');
  } catch (err) {
    elements.lcPromptError.textContent = err.message;
    elements.lcPromptError.classList.remove('hidden');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> Save & Sync Progress`;
  }
}

// Fetch Problems & User Solved State
async function fetchUserDataAndProblems() {
  try {
    const res = await fetch('/api/problems', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (res.status === 401 || res.status === 403) {
      handleLogout();
      return;
    }

    const data = await res.json();
    state.allProblems = data.problems || [];
    state.solvedSet = new Set(data.solvedIds || []);
    if (data.user) state.user = { ...state.user, ...data.user };

    updateUserBanner();
    updateStats();
    applyFilters();
  } catch (err) {
    showToast('Failed to load data from server', 'fa-triangle-exclamation');
    fetchGuestProblems();
  }
}

// Guest Mode (when not logged in)
async function fetchGuestProblems() {
  try {
    const res = await fetch('/api/problems');
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    state.allProblems = data.problems || [];
    updateStats();
    applyFilters();
  } catch (err) {
    console.error('Error fetching guest problems:', err);
    elements.problemsTbody.innerHTML = `<tr><td colspan="5" class="text-center">Failed to load problem ratings. Please refresh.</td></tr>`;
  }
}

function applyFilters() {
  if (state.allProblems.length === 0) return;

  // Filter problems
  let filtered = state.allProblems.filter(p => {
    // Rating Range
    if (p.rating < state.filters.minRating || p.rating > state.filters.maxRating) {
      return false;
    }

    // Solved Filter
    const isSolved = state.solvedSet.has(p.id);
    if (state.filters.status === 'solved' && !isSolved) return false;
    if (state.filters.status === 'unsolved' && isSolved) return false;

    // Search Query
    if (state.filters.search) {
      const query = state.filters.search;
      const titleMatch = p.title.toLowerCase().includes(query);
      const idMatch = p.id.toString().includes(query);
      const contestMatch = p.contestName ? p.contestName.toLowerCase().includes(query) : false;
      if (!titleMatch && !idMatch && !contestMatch) return false;
    }

    return true;
  });

  // Sort problems
  filtered.sort((a, b) => {
    let valA, valB;
    if (state.sort.key === 'rating') {
      valA = a.rating;
      valB = b.rating;
    } else if (state.sort.key === 'id') {
      valA = a.id;
      valB = b.id;
    } else if (state.sort.key === 'title') {
      valA = a.title;
      valB = b.title;
    } else if (state.sort.key === 'contest') {
      valA = a.contestName || '';
      valB = b.contestName || '';
    }

    if (valA < valB) return state.sort.asc ? -1 : 1;
    if (valA > valB) return state.sort.asc ? 1 : -1;
    return 0;
  });

  // Save filtered results to state for pagination
  state.filteredProblems = filtered;
  state.page = 1; // Reset to page 1 on new filter

  renderTable();
}

// Render Table Rows
function renderTable() {
  const filtered = state.filteredProblems;
  elements.visibleCount.textContent = filtered.length;
  elements.problemsTbody.innerHTML = '';

  if (filtered.length === 0) {
    elements.problemsTbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center">No problems found matching criteria.</td>
      </tr>
    `;
    elements.paginationContainer.style.display = 'none';
    return;
  }

  // Pagination Logic
  const totalPages = Math.ceil(filtered.length / state.limit) || 1;
  if (state.page > totalPages) state.page = totalPages;
  
  elements.pageCurrent.textContent = state.page;
  elements.pageTotal.textContent = totalPages;
  elements.btnPrevPage.disabled = state.page === 1;
  elements.btnNextPage.disabled = state.page === totalPages;
  
  elements.paginationContainer.style.display = 'flex';

  const startIndex = (state.page - 1) * state.limit;
  const endIndex = Math.min(startIndex + state.limit, filtered.length);
  const pageData = filtered.slice(startIndex, endIndex);

  elements.problemsTbody.innerHTML = pageData.map(p => {
    const isSolved = state.solvedSet.has(p.id);
    const badgeClass = getRatingBadgeClass(p.rating);
    const problemUrl = `https://leetcode.com/problems/${p.titleSlug}/`;

    return `
      <tr class="${isSolved ? 'row-solved' : ''}" data-id="${p.id}">
        <td class="col-check">
          <input type="checkbox" 
                 class="custom-checkbox" 
                 ${isSolved ? 'checked' : ''} 
                 onchange="handleToggleSolved(${p.id}, this.checked)">
        </td>
        <td class="col-id">#${p.id}</td>
        <td class="col-title">
          <a href="${problemUrl}" target="_blank" rel="noopener noreferrer" class="problem-link">
            ${escapeHtml(p.title)}
          </a>
        </td>
        <td class="col-rating">
          <span class="rating-badge ${badgeClass}">${p.rating}</span>
        </td>
        <td class="col-contest">
          <div class="contest-pill">
            <span class="q-index-badge">${p.problemIndex || 'Q'}</span>
            <span>${escapeHtml(p.contestName || p.contestSlug || '-')}</span>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Toggle Solved Checkbox
window.handleToggleSolved = async function(problemId, isChecked) {
  if (!state.token) {
    showToast('Please log in to save your solved progress!', 'fa-circle-info');
    showAuthModal(true);
    const tr = document.querySelector(`tr[data-id="${problemId}"]`);
    if (tr) {
      const cb = tr.querySelector('.custom-checkbox');
      if (cb) cb.checked = !isChecked;
    }
    return;
  }

  // Optimistic UI update
  if (isChecked) {
    state.solvedSet.add(problemId);
  } else {
    state.solvedSet.delete(problemId);
  }

  const tr = document.querySelector(`tr[data-id="${problemId}"]`);
  if (tr) tr.classList.toggle('row-solved', isChecked);

  updateStats();

  try {
    const res = await fetch(`/api/problems/${problemId}/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ solved: isChecked })
    });

    if (!res.ok) throw new Error('Failed to update');
    const data = await res.json();
    state.solvedSet = new Set(data.solvedIds);
    applyFilters(); // This will populate state.filteredProblems and render
  } catch (err) {
    showToast('Could not save solved state to database', 'fa-triangle-exclamation');
  }
};

// Sync with LeetCode
async function handleSync() {
  if (!state.token) {
    showAuthModal(true);
    return;
  }

  if (!state.user || !state.user.leetcodeUsername) {
    showLcPromptModal(true);
    return;
  }

  elements.syncBtn.disabled = true;
  elements.syncIcon.classList.add('spinning');

  try {
    const res = await fetch('/api/problems/sync', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`
      }
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Sync failed');
    }

    state.solvedSet = new Set(data.solvedIds || []);
    if (state.user) {
      state.user.lastSynced = data.lastSynced;
    }

    updateUserBanner();
    updateStats();
    renderTable();

    showToast(data.message || 'Synced successfully!', 'fa-circle-check');
  } catch (err) {
    showToast(err.message || 'Sync failed. Please try again.', 'fa-circle-xmark');
  } finally {
    elements.syncBtn.disabled = false;
    elements.syncIcon.classList.remove('spinning');
  }
}

// Deep Sync with LeetCode Session Cookie
async function handleDeepSync(e) {
  e.preventDefault();
  elements.deepSyncError.classList.add('hidden');

  const sessionCookie = elements.sessionCookieInput.value.trim();
  if (!sessionCookie) return;

  elements.submitDeepSyncBtn.disabled = true;
  elements.submitDeepSyncBtn.innerHTML = `<i class="fa-solid fa-spinner spinning"></i> Syncing...`;

  try {
    const res = await fetch('/api/problems/sync-full', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ sessionCookie })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Deep sync failed');
    }

    state.solvedSet = new Set(data.solvedIds || []);
    if (state.user) {
      state.user.lastSynced = data.lastSynced;
    }

    updateUserBanner();
    updateStats();
    renderTable();

    showDeepSyncModal(false);
    elements.sessionCookieInput.value = '';
    showToast(data.message || 'Deep Sync successful!', 'fa-circle-check');
  } catch (err) {
    elements.deepSyncError.textContent = err.message;
    elements.deepSyncError.classList.remove('hidden');
  } finally {
    elements.submitDeepSyncBtn.disabled = false;
    elements.submitDeepSyncBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-down"></i> Start Deep Sync`;
  }
}

// Authentication Handlers
async function handleLogin(e) {
  e.preventDefault();
  elements.loginError.classList.add('hidden');

  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!res.ok) {
      elements.loginError.textContent = data.error || 'Login failed';
      elements.loginError.classList.remove('hidden');
      return;
    }

    state.token = data.token;
    localStorage.setItem('lc_tracker_token', data.token);
    state.user = data.user;

    showAuthModal(false);
    showToast(`Welcome back, ${data.user.username}!`, 'fa-circle-check');
    await fetchUserDataAndProblems();

    if (data.needsLeetcodeUsername || !data.user.leetcodeUsername) {
      showLcPromptModal(true);
    }
  } catch (err) {
    elements.loginError.textContent = 'Server connection error';
    elements.loginError.classList.remove('hidden');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  elements.regError.classList.add('hidden');

  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  const leetcodeUsername = document.getElementById('reg-leetcode').value.trim();

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, leetcodeUsername })
    });

    const data = await res.json();

    if (!res.ok) {
      elements.regError.textContent = data.error || 'Registration failed';
      elements.regError.classList.remove('hidden');
      return;
    }

    state.token = data.token;
    localStorage.setItem('lc_tracker_token', data.token);
    state.user = data.user;

    showAuthModal(false);
    showToast(`Account created for ${data.user.username}!`, 'fa-circle-check');
    await fetchUserDataAndProblems();

    if (!leetcodeUsername) {
      showLcPromptModal(true);
    }
  } catch (err) {
    elements.regError.textContent = 'Server connection error';
    elements.regError.classList.remove('hidden');
  }
}

function handleLogout() {
  state.token = null;
  state.user = null;
  state.solvedSet.clear();
  localStorage.removeItem('lc_tracker_token');
  
  updateUserBanner();
  updateStats();
  renderTable();
  showToast('Logged out', 'fa-right-from-bracket');
}

// UI Utility Functions
function updateUserBanner() {
  if (state.token && state.user) {
    elements.userBanner.classList.remove('hidden');
    elements.authBtn.classList.add('hidden');
    elements.userLcUsername.textContent = state.user.leetcodeUsername || 'Not connected (click to edit)';
    elements.lastSyncedTime.textContent = state.user.lastSynced ? formatDate(state.user.lastSynced) : 'Never';
  } else {
    elements.userBanner.classList.add('hidden');
    elements.authBtn.classList.remove('hidden');
  }
}

function updateStats() {
  const totalProblems = state.allProblems.length;
  if (totalProblems === 0) return;

  let totalSolved = 0;
  let mediumTotal = 0, mediumSolved = 0;
  let hardTotal = 0, hardSolved = 0;
  let masterTotal = 0, masterSolved = 0;

  state.allProblems.forEach(p => {
    const isSolved = state.solvedSet.has(p.id);
    if (isSolved) totalSolved++;

    if (p.rating >= 1500 && p.rating < 1800) {
      mediumTotal++;
      if (isSolved) mediumSolved++;
    } else if (p.rating >= 1800 && p.rating < 2100) {
      hardTotal++;
      if (isSolved) hardSolved++;
    } else if (p.rating >= 2100) {
      masterTotal++;
      if (isSolved) masterSolved++;
    }
  });

  elements.statTotalSolved.innerHTML = `${totalSolved} <span class="stat-total">/ ${totalProblems}</span>`;
  elements.statTotalProgress.style.width = `${((totalSolved / totalProblems) * 100).toFixed(1)}%`;

  elements.statMediumSolved.innerHTML = `${mediumSolved} <span class="stat-total">/ ${mediumTotal}</span>`;
  elements.statMediumProgress.style.width = mediumTotal > 0 ? `${((mediumSolved / mediumTotal) * 100).toFixed(1)}%` : '0%';

  elements.statHardSolved.innerHTML = `${hardSolved} <span class="stat-total">/ ${hardTotal}</span>`;
  elements.statHardProgress.style.width = hardTotal > 0 ? `${((hardSolved / hardTotal) * 100).toFixed(1)}%` : '0%';

  elements.statMasterSolved.innerHTML = `${masterSolved} <span class="stat-total">/ ${masterTotal}</span>`;
  elements.statMasterProgress.style.width = masterTotal > 0 ? `${((masterSolved / masterTotal) * 100).toFixed(1)}%` : '0%';
}

function getRatingBadgeClass(rating) {
  if (rating < 1400) return 'rating-easy';
  if (rating < 1600) return 'rating-medium';
  if (rating < 1800) return 'rating-med-hard';
  if (rating < 2100) return 'rating-hard';
  return 'rating-master';
}

function syncSortUI() {
  // Sync dropdown value
  if (elements.sortSelect) {
    const dirStr = state.sort.asc ? 'asc' : 'desc';
    elements.sortSelect.value = `${state.sort.key}-${dirStr}`;
  }

  // Sync table header icons
  elements.sortHeaders.forEach(header => {
    header.classList.remove('active-sort');
    const icon = header.querySelector('.sort-icon');
    if (icon) icon.className = 'fa-solid fa-sort sort-icon';
  });

  const activeTh = document.querySelector(`.problems-table th[data-sort="${state.sort.key}"]`);
  if (activeTh) {
    activeTh.classList.add('active-sort');
    const icon = activeTh.querySelector('.sort-icon');
    if (icon) {
      icon.className = state.sort.asc ? 'fa-solid fa-sort-up sort-icon' : 'fa-solid fa-sort-down sort-icon';
    }
  }
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  const icon = elements.themeToggleBtn?.querySelector('i');
  if (icon) {
    icon.className = state.theme === 'light' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }
}

function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('theme', state.theme);
  applyTheme();
}

function showAuthModal(show) {
  if (show) {
    elements.authModal.classList.remove('hidden');
  } else {
    elements.authModal.classList.add('hidden');
  }
}

function showLcPromptModal(show) {
  if (show) {
    elements.leetcodePromptModal.classList.remove('hidden');
  } else {
    elements.leetcodePromptModal.classList.add('hidden');
  }
}

function showDeepSyncModal(show) {
  if (show) {
    elements.deepSyncModal.classList.remove('hidden');
  } else {
    elements.deepSyncModal.classList.add('hidden');
  }
}

function switchAuthTab(tab) {
  if (tab === 'login') {
    elements.tabLoginBtn.classList.add('active');
    elements.tabRegisterBtn.classList.remove('active');
    elements.loginForm.classList.remove('hidden');
    elements.registerForm.classList.add('hidden');
  } else {
    elements.tabRegisterBtn.classList.add('active');
    elements.tabLoginBtn.classList.remove('active');
    elements.registerForm.classList.remove('hidden');
    elements.loginForm.classList.add('hidden');
  }
}

function showToast(message, iconClass = 'fa-circle-check') {
  elements.toastMessage.textContent = message;
  elements.toastIcon.className = `fa-solid ${iconClass}`;
  elements.toast.classList.remove('hidden');

  setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 3500);
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
