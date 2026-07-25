/* ==========================================================================
   Bevásárló Lista - Firebase Realtime Database + Live Multi-device Sync
   ========================================================================== */

(function () {
  'use strict';

  // =========================================================================
  // FIREBASE CONFIGURATION (ingyenes Realtime Database)
  // =========================================================================
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDemo-ReplaceWithYours",
    authDomain: "bevasarlas-dufi1984.firebaseapp.com",
    databaseURL: "https://bevasarlas-dufi1984-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "bevasarlas-dufi1984",
    storageBucket: "bevasarlas-dufi1984.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:0000000000000000000000"
  };

  // A közös adatbázis elérési útvonal - mindenki ugyanazt a listát látja
  const DB_PATH = 'bevasarlas/main';

  // =========================================================================
  // LOCAL STORAGE KEYS (offline fallback)
  // =========================================================================
  const STORAGE_KEYS = {
    CATALOG: 'bevasarlas_catalog_v2',
    ITEMS: 'bevasarlas_current_items_v2',
    THEME: 'bevasarlas_theme_v1',
    SELECTED_COLOR: 'bevasarlas_color_v1',
    PURCHASED_COLLAPSED: 'bevasarlas_purchased_collapsed_v1',
    CATEGORIES: 'bevasarlas_categories_v2'
  };

  // =========================================================================
  // DEFAULT CATEGORIES
  // =========================================================================
  const DEFAULT_CATEGORIES = [
    { id: 'green',  name: 'Zöldség & Gyümölcs',     color: '#10b981', order: 0 },
    { id: 'yellow', name: 'Pékáru & Sajtok',          color: '#f59e0b', order: 1 },
    { id: 'blue',   name: 'Tejtermék & Hűtött',       color: '#3b82f6', order: 2 },
    { id: 'red',    name: 'Hús & Mészáros',            color: '#ef4444', order: 3 },
    { id: 'orange', name: 'Italok & Nasik',            color: '#f97316', order: 4 },
    { id: 'purple', name: 'Édesség & Különlegesség',   color: '#a855f7', order: 5 },
    { id: 'gray',   name: 'Egyéb & Háztartás',         color: '#6b7280', order: 6 }
  ];

  const DEFAULT_CATALOG = [
    { id: 'cat-1',  name: 'Tej',        colorId: 'blue'   },
    { id: 'cat-2',  name: 'Kifli',      colorId: 'yellow' },
    { id: 'cat-3',  name: 'Sajt',       colorId: 'yellow' },
    { id: 'cat-4',  name: 'Alma',       colorId: 'green'  },
    { id: 'cat-5',  name: 'Csirkemell', colorId: 'red'    },
    { id: 'cat-6',  name: 'Ásványvíz',  colorId: 'orange' },
    { id: 'cat-7',  name: 'Zsemle',     colorId: 'yellow' },
    { id: 'cat-8',  name: 'Paradicsom', colorId: 'green'  },
    { id: 'cat-9',  name: 'Tejföl',     colorId: 'blue'   },
    { id: 'cat-10', name: 'Csoki',      colorId: 'purple' },
    { id: 'cat-11', name: 'Mosószer',   colorId: 'gray'   }
  ];

  const DEFAULT_ITEMS = [
    { id: 'item-1', name: 'Tej',   colorId: 'blue',   checked: false, addedAt: Date.now() - 3000 },
    { id: 'item-2', name: 'Kifli', colorId: 'yellow', checked: false, addedAt: Date.now() - 2000 },
    { id: 'item-3', name: 'Sajt',  colorId: 'yellow', checked: false, addedAt: Date.now() - 1000 }
  ];

  // =========================================================================
  // APPLICATION STATE
  // =========================================================================
  let categories  = [];
  let catalog     = [];
  let items       = [];
  let selectedColor       = 'green';
  let theme               = 'dark';
  let isPurchasedCollapsed = false;
  let firebaseDb           = null;
  let dbRef                = null;
  let isFirebaseReady      = false;
  let remoteUpdatePending  = false; // guard against re-render loop
  let isDraggingCategory   = false; // used to disable text selection during drag

  // =========================================================================
  // DOM ELEMENTS
  // =========================================================================
  const htmlElement         = document.documentElement;
  const searchInput         = document.getElementById('searchInput');
  const clearSearchBtn      = document.getElementById('clearSearchBtn');
  const addBtn              = document.getElementById('addBtn');
  const autocompleteDropdown = document.getElementById('autocompleteDropdown');
  const suggestionsList     = document.getElementById('suggestionsList');
  const colorChipsContainer = document.getElementById('colorChipsContainer');

  const toBuyListGrouped  = document.getElementById('toBuyListGrouped');
  const toBuyEmpty        = document.getElementById('toBuyEmpty');
  const toBuyCount        = document.getElementById('toBuyCount');

  const purchasedList     = document.getElementById('purchasedList');
  const purchasedEmpty    = document.getElementById('purchasedEmpty');
  const purchasedCount    = document.getElementById('purchasedCount');
  const togglePurchasedHeader = document.getElementById('togglePurchasedHeader');
  const purchasedSection  = document.querySelector('.purchased-section');

  const themeToggleBtn    = document.getElementById('themeToggle');
  const catalogBtn        = document.getElementById('catalogBtn');
  const catalogBadge      = document.getElementById('catalogBadge');
  const catalogModal      = document.getElementById('catalogModal');
  const closeCatalogBtn   = document.getElementById('closeCatalogBtn');
  const catalogSearchInput = document.getElementById('catalogSearchInput');
  const catalogItemsList  = document.getElementById('catalogItemsList');
  const addAllCatalogBtn  = document.getElementById('addAllCatalogBtn');

  const manageCategoriesBtn   = document.getElementById('manageCategoriesBtn');
  const categoriesModal       = document.getElementById('categoriesModal');
  const closeCategoriesBtn    = document.getElementById('closeCategoriesBtn');
  const categoriesEditList    = document.getElementById('categoriesEditList');
  const saveCategoriesModalBtn = document.getElementById('saveCategoriesModalBtn');

  const syncStatusDot   = { className: '', classList: { add: ()=>{}, remove: ()=>{} } }; // removed from UI
  const syncBtn         = { title: '' }; // removed from UI

  // =========================================================================
  // INIT
  // =========================================================================
  function init() {
    loadLocalState();
    setupTheme();
    renderColorChips();
    setupEventListeners();
    renderAll();
    initFirebase();
  }

  // =========================================================================
  // FIREBASE INITIALIZATION & LIVE SYNC
  // =========================================================================
  function initFirebase() {
    setSyncStatus('syncing');

    // Load Firebase SDK dynamically
    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = buildFirebaseModuleCode();
    document.head.appendChild(script);
  }

  function buildFirebaseModuleCode() {
    // Firebase v9 modular SDK via CDN
    return `
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getDatabase, ref, onValue, set, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

const firebaseConfig = ${JSON.stringify(FIREBASE_CONFIG)};
const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);
const dataRef = ref(db, '${DB_PATH}');

// Expose helpers to the main app scope
window._fbSet = (data) => set(dataRef, data);
window._fbOnValue = (callback) => onValue(dataRef, callback);
window._fbServerTimestamp = serverTimestamp;

// Signal ready
window.dispatchEvent(new CustomEvent('firebase-ready'));
    `;
  }

  window.addEventListener('firebase-ready', () => {
    isFirebaseReady = true;

    // Subscribe to live updates
    window._fbOnValue((snapshot) => {
      const remoteData = snapshot.val();
      if (!remoteData) {
        // Database is empty – push our local state up as the initial value
        pushToFirebase();
        return;
      }

      // Only update if the remote timestamp is newer than our local state
      const remoteTs = remoteData.updatedAt || 0;
      const localTs  = parseInt(localStorage.getItem('bevasarlas_ts') || '0', 10);

      if (remoteTs > localTs) {
        remoteUpdatePending = true;
        applyRemoteData(remoteData);
        remoteUpdatePending = false;
      }

      setSyncStatus('synced');
    });
  });

  function applyRemoteData(remoteData) {
    if (remoteData.items)      items      = remoteData.items;
    if (remoteData.catalog)    catalog    = remoteData.catalog;
    if (remoteData.categories) categories = remoteData.categories;

    // Save locally for offline use
    saveLocalStateOnly();
    sortCategories();
    renderColorChips();
    renderAll();
  }

  function pushToFirebase() {
    if (!isFirebaseReady || remoteUpdatePending) return;

    const ts = Date.now();
    localStorage.setItem('bevasarlas_ts', ts.toString());
    setSyncStatus('syncing');

    const payload = {
      items:      items,
      catalog:    catalog,
      categories: categories,
      updatedAt:  ts
    };

    window._fbSet(payload)
      .then(() => setSyncStatus('synced'))
      .catch(() => setSyncStatus('synced')); // fail silently, local data still saved
  }

  // =========================================================================
  // LOCAL STATE (used as offline fallback and initial load)
  // =========================================================================
  function loadLocalState() {
    const storedCats = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (storedCats) {
      try {
        categories = JSON.parse(storedCats);
        DEFAULT_CATEGORIES.forEach(def => {
          if (!categories.some(c => c.id === def.id)) categories.push({ ...def, order: categories.length });
        });
      } catch (e) { categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)); }
    } else {
      categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    }
    sortCategories();

    const storedCatalog = localStorage.getItem(STORAGE_KEYS.CATALOG);
    catalog = storedCatalog ? tryParse(storedCatalog, DEFAULT_CATALOG) : [...DEFAULT_CATALOG];

    const storedItems = localStorage.getItem(STORAGE_KEYS.ITEMS);
    items = storedItems ? tryParse(storedItems, DEFAULT_ITEMS) : [...DEFAULT_ITEMS];

    theme               = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
    selectedColor       = localStorage.getItem(STORAGE_KEYS.SELECTED_COLOR) || 'green';
    isPurchasedCollapsed = localStorage.getItem(STORAGE_KEYS.PURCHASED_COLLAPSED) === 'true';
  }

  function saveLocalStateOnly() {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
    localStorage.setItem(STORAGE_KEYS.CATALOG,    JSON.stringify(catalog));
    localStorage.setItem(STORAGE_KEYS.ITEMS,       JSON.stringify(items));
  }

  function saveState() {
    saveLocalStateOnly();
    pushToFirebase();
    renderCatalogBadge();
  }

  function tryParse(str, fallback) {
    try { return JSON.parse(str); } catch (e) { return fallback; }
  }

  // =========================================================================
  // SYNC STATUS INDICATOR
  // =========================================================================
  function setSyncStatus(status) {
    syncStatusDot.className = 'sync-pulse-dot';
    if (status === 'syncing') {
      syncStatusDot.classList.add('syncing');
      syncBtn.title = 'Szinkronizálás...';
    } else if (status === 'error') {
      syncStatusDot.classList.add('error');
      syncBtn.title = 'Szinkronizálási hiba';
    } else {
      syncBtn.title = 'Élő szinkronizáció aktív ✓';
    }
  }

  // =========================================================================
  // THEME
  // =========================================================================
  function setupTheme() { htmlElement.setAttribute('data-theme', theme); }
  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    htmlElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  }

  // =========================================================================
  // COLOR CHIPS
  // =========================================================================
  function renderColorChips() {
    colorChipsContainer.innerHTML = '';
    categories.forEach(cat => {
      const chip = document.createElement('button');
      chip.className = `color-chip ${cat.id === selectedColor ? 'active' : ''}`;
      chip.dataset.color = cat.id;
      chip.style.setProperty('--chip-color', cat.color);
      chip.title = cat.name;
      chip.innerHTML = `<span class="dot"></span>${escapeHtml(cat.name)}`;
      chip.addEventListener('click', () => {
        colorChipsContainer.querySelectorAll('.color-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        selectedColor = cat.id;
        localStorage.setItem(STORAGE_KEYS.SELECTED_COLOR, selectedColor);
      });
      colorChipsContainer.appendChild(chip);
    });
  }

  function sortCategories() {
    categories.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  // =========================================================================
  // ITEM MANAGEMENT
  // =========================================================================
  function addItem(name, colorId = selectedColor) {
    const trimmed = name.trim();
    if (!trimmed) return;

    // Keep catalog up-to-date
    const match = catalog.find(c => c.name.toLowerCase() === trimmed.toLowerCase());
    if (!match) {
      catalog.push({ id: uid(), name: trimmed, colorId });
    } else {
      colorId = match.colorId || colorId;
    }

    const existing = items.findIndex(i => i.name.toLowerCase() === trimmed.toLowerCase());
    if (existing !== -1) {
      items[existing].checked = false;
      items[existing].colorId = colorId;
      items[existing].addedAt = Date.now();
    } else {
      items.unshift({ id: uid(), name: trimmed, colorId, checked: false, addedAt: Date.now() });
    }

    saveState();
    renderAll();
    searchInput.value = '';
    hideAutocomplete();
    clearSearchBtn.classList.add('hidden');
  }

  function toggleItemChecked(itemId) {
    const item = items.find(i => i.id === itemId);
    if (item) { item.checked = !item.checked; saveState(); renderAll(); }
  }

  function deleteItem(itemId) {
    items = items.filter(i => i.id !== itemId);
    saveState();
    renderAll();
  }

  function deleteFromCatalog(catalogId) {
    catalog = catalog.filter(c => c.id !== catalogId);
    saveState();
    renderCatalogModal();
  }

  // =========================================================================
  // AUTOCOMPLETE
  // =========================================================================
  function handleSearchInput() {
    const q = searchInput.value.trim().toLowerCase();
    if (q) { clearSearchBtn.classList.remove('hidden'); renderAutocomplete(q); }
    else   { clearSearchBtn.classList.add('hidden'); hideAutocomplete(); }
  }

  function renderAutocomplete(query) {
    suggestionsList.innerHTML = '';
    const matches = catalog.filter(c => c.name.toLowerCase().includes(query));

    if (matches.length === 0) {
      const row = document.createElement('div');
      row.className = 'suggestion-item';
      const cat = categories.find(c => c.id === selectedColor) || categories[0];
      row.innerHTML = `
        <div class="suggestion-left">
          <span class="suggestion-color-tag" style="background-color:${cat.color}"></span>
          <span>"${escapeHtml(searchInput.value.trim())}" felvétele újként</span>
        </div>
        <div class="suggestion-add-tag">+ Hozzáadás</div>`;
      row.addEventListener('click', () => addItem(searchInput.value, selectedColor));
      suggestionsList.appendChild(row);
    } else {
      matches.forEach(m => {
        const cat = categories.find(c => c.id === m.colorId) || categories[0];
        const row = document.createElement('div');
        row.className = 'suggestion-item';
        row.innerHTML = `
          <div class="suggestion-left">
            <span class="suggestion-color-tag" style="background-color:${cat.color}"></span>
            <span>${escapeHtml(m.name)}</span>
          </div>
          <div class="suggestion-add-tag">+ Listára</div>`;
        row.addEventListener('click', () => addItem(m.name, m.colorId));
        suggestionsList.appendChild(row);
      });
    }
    autocompleteDropdown.classList.remove('hidden');
  }

  function hideAutocomplete() { autocompleteDropdown.classList.add('hidden'); }

  // =========================================================================
  // RENDER
  // =========================================================================
  function renderAll() {
    renderToBuyListGrouped();
    renderPurchasedList();
    renderCatalogBadge();
  }

  function renderToBuyListGrouped() {
    const active = items.filter(i => !i.checked);
    toBuyCount.textContent = active.length;
    toBuyListGrouped.innerHTML = '';

    if (active.length === 0) {
      toBuyListGrouped.appendChild(toBuyEmpty);
      toBuyEmpty.classList.remove('hidden');
      return;
    }
    toBuyEmpty.classList.add('hidden');
    sortCategories();

    categories.forEach(cat => {
      const catItems = active.filter(i => (i.colorId || 'green') === cat.id);
      if (catItems.length > 0) toBuyListGrouped.appendChild(createCategoryGroup(cat, catItems));
    });
  }

  function createCategoryGroup(category, catItems) {
    const group = document.createElement('div');
    group.className = 'category-group';
    group.dataset.categoryId = category.id;
    group.draggable = true;

    const header = document.createElement('div');
    header.className = 'category-group-header';
    header.innerHTML = `
      <div class="category-header-left">
        <span class="drag-handle">⠿</span>
        <div class="category-title-badge">
          <span class="category-dot" style="background-color:${category.color}"></span>
          <span>${escapeHtml(category.name)}</span>
          <button class="category-edit-btn" title="Kategória átnevezése">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
        </div>
      </div>
      <span class="category-item-count">${catItems.length} db</span>`;

    header.querySelector('.category-edit-btn').addEventListener('click', e => {
      e.stopPropagation();
      const n = prompt(`"${category.name}" kategória új neve:`, category.name);
      if (n && n.trim()) { category.name = n.trim(); saveState(); renderColorChips(); renderAll(); }
    });

    group.appendChild(header);
    catItems.forEach(item => group.appendChild(createItemCard(item)));
    setupCategoryDnD(group, category.id);
    return group;
  }

  // =========================================================================
  // DRAG AND DROP – kategória csoportok rendezése
  // Fontos: drag közben a szöveges kijelölés tiltott (mobil bug fix)
  // =========================================================================
  let draggedCategoryId = null;

  function setupCategoryDnD(group, categoryId) {
    // ---- Desktop HTML5 drag events ----
    group.addEventListener('dragstart', e => {
      draggedCategoryId = categoryId;
      isDraggingCategory = true;
      group.classList.add('dragging');
      document.body.classList.add('no-select');
      e.dataTransfer.effectAllowed = 'move';
    });

    group.addEventListener('dragend', () => {
      draggedCategoryId = null;
      isDraggingCategory = false;
      group.classList.remove('dragging');
      document.body.classList.remove('no-select');
      document.querySelectorAll('.category-group').forEach(el => el.classList.remove('drag-over'));
    });

    group.addEventListener('dragover', e => {
      e.preventDefault();
      if (draggedCategoryId && draggedCategoryId !== categoryId) group.classList.add('drag-over');
    });

    group.addEventListener('dragleave', () => group.classList.remove('drag-over'));

    group.addEventListener('drop', e => {
      e.preventDefault();
      group.classList.remove('drag-over');
      if (draggedCategoryId && draggedCategoryId !== categoryId) reorderCategories(draggedCategoryId, categoryId);
    });

    // ---- Mobile touch drag on the handle only ----
    const handle = group.querySelector('.drag-handle');

    handle.addEventListener('touchstart', e => {
      draggedCategoryId = categoryId;
      isDraggingCategory = true;
      group.classList.add('dragging');
      document.body.classList.add('no-select');
      window.getSelection && window.getSelection().removeAllRanges();
    }, { passive: true });

    handle.addEventListener('touchmove', e => {
      if (!isDraggingCategory) return;
      window.getSelection && window.getSelection().removeAllRanges();
      const touch = e.touches[0];
      const below = document.elementFromPoint(touch.clientX, touch.clientY);
      document.querySelectorAll('.category-group').forEach(el => el.classList.remove('drag-over'));
      const targetGroup = below && below.closest('.category-group');
      if (targetGroup && targetGroup.dataset.categoryId !== draggedCategoryId)
        targetGroup.classList.add('drag-over');
    }, { passive: true });

    handle.addEventListener('touchend', e => {
      if (!isDraggingCategory) return;
      isDraggingCategory = false;
      group.classList.remove('dragging');
      document.body.classList.remove('no-select');
      draggedCategoryId = null;

      const touch = e.changedTouches[0];
      const below = document.elementFromPoint(touch.clientX, touch.clientY);
      const targetGroup = below && below.closest('.category-group');
      if (targetGroup && targetGroup.dataset.categoryId && targetGroup.dataset.categoryId !== categoryId)
        reorderCategories(categoryId, targetGroup.dataset.categoryId);

      document.querySelectorAll('.category-group').forEach(el => el.classList.remove('drag-over'));
    });
  }

  function reorderCategories(fromId, toId) {
    const fromIdx = categories.findIndex(c => c.id === fromId);
    const toIdx   = categories.findIndex(c => c.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = categories.splice(fromIdx, 1);
    categories.splice(toIdx, 0, moved);
    categories.forEach((c, i) => c.order = i);
    saveState();
    renderAll();
  }

  // =========================================================================
  // PURCHASED LIST
  // =========================================================================
  function renderPurchasedList() {
    const purchased = items.filter(i => i.checked);
    purchasedCount.textContent = purchased.length;
    purchasedList.innerHTML = '';

    if (purchased.length === 0) {
      purchasedList.appendChild(purchasedEmpty);
      purchasedEmpty.classList.remove('hidden');
    } else {
      purchasedEmpty.classList.add('hidden');
      purchased.forEach(item => purchasedList.appendChild(createItemCard(item)));
    }

    purchasedSection.classList.toggle('collapsed', isPurchasedCollapsed);
  }

  function renderCatalogBadge() { catalogBadge.textContent = catalog.length; }

  // =========================================================================
  // ITEM CARD (Bring-style single row + swipe-to-delete)
  // =========================================================================
  function createItemCard(item) {
    const wrapper = document.createElement('div');
    wrapper.className = 'item-card-wrapper';
    wrapper.dataset.id = item.id;

    const backdrop = document.createElement('div');
    backdrop.className = 'item-delete-backdrop';
    backdrop.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
      <span>Törlés</span>`;
    wrapper.appendChild(backdrop);

    const card = document.createElement('div');
    card.className = `item-card ${item.checked ? 'purchased' : ''}`;
    card.innerHTML = `
      <div class="item-left">
        <span class="category-indicator" data-color="${item.colorId || 'green'}"></span>
        <div class="custom-checkbox">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <span class="item-title">${escapeHtml(item.name)}</span>
      </div>`;
    wrapper.appendChild(card);

    card.addEventListener('click', e => {
      if (isDraggingCategory) return;
      if (card.dataset.hasSwiped === 'true') { delete card.dataset.hasSwiped; return; }
      toggleItemChecked(item.id);
    });

    setupSwipe(card, wrapper, item.id);
    return wrapper;
  }

  function swipeDelete(wrapper, itemId) {
    wrapper.style.transition = 'all .25s ease-out';
    wrapper.style.opacity = '0';
    wrapper.style.transform = 'translateX(-100%)';
    setTimeout(() => deleteItem(itemId), 250);
  }

  function setupSwipe(card, wrapper, itemId) {
    let startX = 0, currentX = 0, active = false;

    card.addEventListener('touchstart', e => {
      if (isDraggingCategory) return;
      startX = e.touches[0].clientX;
      currentX = startX;
      active = true;
      card.classList.add('swiping');
    }, { passive: true });

    card.addEventListener('touchmove', e => {
      if (!active || isDraggingCategory) return;
      currentX = e.touches[0].clientX;
      const dx = currentX - startX;
      if (dx < 0) {
        card.style.transform = `translateX(${dx}px)`;
        if (dx < -15) card.dataset.hasSwiped = 'true';
      }
    }, { passive: true });

    card.addEventListener('touchend', () => {
      if (!active) return;
      active = false;
      card.classList.remove('swiping');
      const dx = currentX - startX;
      if (dx <= -80) swipeDelete(wrapper, itemId);
      else card.style.transform = 'translateX(0)';
    });

    card.addEventListener('touchcancel', () => {
      active = false;
      card.classList.remove('swiping');
      card.style.transform = 'translateX(0)';
    });
  }

  // =========================================================================
  // CATALOG MODAL
  // =========================================================================
  function renderCatalogModal() {
    const filter = catalogSearchInput.value.trim().toLowerCase();
    catalogItemsList.innerHTML = '';

    const matches = catalog.filter(c => c.name.toLowerCase().includes(filter));
    if (matches.length === 0) {
      catalogItemsList.innerHTML = `<div class="empty-state small"><p class="empty-desc">Nincs találat</p></div>`;
      return;
    }

    matches.forEach(ci => {
      const isActive = items.some(i => i.name.toLowerCase() === ci.name.toLowerCase() && !i.checked);
      const cat = categories.find(c => c.id === ci.colorId) || categories[0];
      const row = document.createElement('div');
      row.className = 'catalog-item-row';
      row.innerHTML = `
        <div class="catalog-item-left">
          <span class="category-indicator" data-color="${ci.colorId || 'green'}"></span>
          <span>${escapeHtml(ci.name)}</span>
          <span style="font-size:.75rem;color:var(--text-muted)">(${escapeHtml(cat.name)})</span>
        </div>
        <div class="catalog-actions">
          <button class="catalog-add-btn">${isActive ? '✓ Listán' : '+ Listára'}</button>
          <button class="item-btn delete-cat-btn">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>`;

      row.querySelector('.catalog-add-btn').addEventListener('click', e => {
        e.stopPropagation(); addItem(ci.name, ci.colorId); renderCatalogModal();
      });
      row.querySelector('.delete-cat-btn').addEventListener('click', e => {
        e.stopPropagation(); deleteFromCatalog(ci.id);
      });
      catalogItemsList.appendChild(row);
    });
  }

  // =========================================================================
  // CATEGORY MANAGER MODAL
  // =========================================================================
  function renderCategoriesModal() {
    categoriesEditList.innerHTML = '';
    categories.forEach(cat => {
      const row = document.createElement('div');
      row.className = 'category-edit-row';
      row.innerHTML = `
        <span class="category-dot" style="background-color:${cat.color}"></span>
        <input type="text" data-id="${cat.id}" value="${escapeHtml(cat.name)}" placeholder="Kategória neve...">`;
      categoriesEditList.appendChild(row);
    });
  }

  function saveCategoriesFromModal() {
    categoriesEditList.querySelectorAll('input[data-id]').forEach(input => {
      const cat = categories.find(c => c.id === input.dataset.id);
      if (cat && input.value.trim()) cat.name = input.value.trim();
    });
    saveState();
    renderColorChips();
    renderAll();
    categoriesModal.classList.add('hidden');
  }

  // =========================================================================
  // SYNC MODAL
  // =========================================================================
  function renderSyncModal() {
    syncCodeInput.value = window.location.href.split('?')[0];
    customSyncCodeInput.value = '';
  }

  // =========================================================================
  // EVENT LISTENERS
  // =========================================================================
  function setupEventListeners() {
    themeToggleBtn.addEventListener('click', toggleTheme);

    searchInput.addEventListener('input', handleSearchInput);
    searchInput.addEventListener('focus', handleSearchInput);
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addItem(searchInput.value, selectedColor); }
    });

    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearSearchBtn.classList.add('hidden');
      hideAutocomplete();
      searchInput.focus();
    });

    addBtn.addEventListener('click', () => addItem(searchInput.value, selectedColor));

    document.addEventListener('click', e => {
      if (!e.target.closest('.input-section')) hideAutocomplete();
    });

    togglePurchasedHeader.addEventListener('click', () => {
      isPurchasedCollapsed = !isPurchasedCollapsed;
      localStorage.setItem(STORAGE_KEYS.PURCHASED_COLLAPSED, isPurchasedCollapsed);
      renderPurchasedList();
    });

    // Catalog
    catalogBtn.addEventListener('click', () => {
      catalogSearchInput.value = '';
      renderCatalogModal();
      catalogModal.classList.remove('hidden');
    });
    closeCatalogBtn.addEventListener('click', () => catalogModal.classList.add('hidden'));
    catalogModal.addEventListener('click', e => { if (e.target === catalogModal) catalogModal.classList.add('hidden'); });
    catalogSearchInput.addEventListener('input', renderCatalogModal);
    addAllCatalogBtn.addEventListener('click', () => {
      catalog.forEach(ci => addItem(ci.name, ci.colorId));
      catalogModal.classList.add('hidden');
    });

    // Categories
    manageCategoriesBtn.addEventListener('click', () => { renderCategoriesModal(); categoriesModal.classList.remove('hidden'); });
    closeCategoriesBtn.addEventListener('click', () => categoriesModal.classList.add('hidden'));
    saveCategoriesModalBtn.addEventListener('click', saveCategoriesFromModal);
    categoriesModal.addEventListener('click', e => { if (e.target === categoriesModal) categoriesModal.classList.add('hidden'); });

    // Sync button removed from UI - no event listeners needed
  }

  // =========================================================================
  // UTILITIES
  // =========================================================================
  function uid() {
    return 'id-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  // =========================================================================
  // BOOTSTRAP
  // =========================================================================
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
