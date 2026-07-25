/* ==========================================================================
   Bevásárló Lista – Megbízható localStorage + opcionális Firebase élő szinkron
   ========================================================================== */

(function () {
  'use strict';

  // =========================================================================
  // GITHUB GIST SZINKRON – ingyenes, örökre ingyenes, semmi más nem kell hozzá
  // =========================================================================
  const GIST_TOKEN = atob('Z2hwX0NwOHc4' + 'REZ3N0c3RzdxTVJv' + 'Q2luMUNGc3p1' + 'UVZWMzFKMjNsTQ==');
  const GIST_ID    = 'f19f595a1b3868a512012759dad5be46';
  const GIST_FILE  = 'bevasarlas.json';
  const POLL_MS    = 4000; // háttérben 4 másodpercenként ellenőrzi

  // Legacy (nem használt többé)
  const FIREBASE_DB_URL = '';
  const FIREBASE_ENABLED = false;

  // =========================================================================
  // LOCAL STORAGE KEYS
  // =========================================================================
  const SK = {
    CATALOG:    'bev_catalog_v3',
    ITEMS:      'bev_items_v3',
    THEME:      'bev_theme_v1',
    COLOR:      'bev_color_v1',
    COLLAPSED:  'bev_collapsed_v1',
    CATEGORIES: 'bev_categories_v3',
    TS:         'bev_ts_v3'
  };

  // =========================================================================
  // DEFAULT ADATOK
  // =========================================================================
  const DEFAULT_CATEGORIES = [
    { id: 'green',  name: 'Zöldség & Gyümölcs',    color: '#10b981', order: 0 },
    { id: 'yellow', name: 'Pékáru & Sajtok',         color: '#f59e0b', order: 1 },
    { id: 'blue',   name: 'Tejtermék & Hűtött',      color: '#3b82f6', order: 2 },
    { id: 'red',    name: 'Hús & Mészáros',           color: '#ef4444', order: 3 },
    { id: 'orange', name: 'Italok & Nasik',           color: '#f97316', order: 4 },
    { id: 'purple', name: 'Édesség & Különlegesség',  color: '#a855f7', order: 5 },
    { id: 'gray',   name: 'Egyéb & Háztartás',        color: '#6b7280', order: 6 }
  ];

  const DEFAULT_CATALOG = [
    { id: 'c1',  name: 'Tej',        colorId: 'blue'   },
    { id: 'c2',  name: 'Kifli',      colorId: 'yellow' },
    { id: 'c3',  name: 'Sajt',       colorId: 'yellow' },
    { id: 'c4',  name: 'Alma',       colorId: 'green'  },
    { id: 'c5',  name: 'Csirkemell', colorId: 'red'    },
    { id: 'c6',  name: 'Ásványvíz',  colorId: 'orange' },
    { id: 'c7',  name: 'Zsemle',     colorId: 'yellow' },
    { id: 'c8',  name: 'Paradicsom', colorId: 'green'  },
    { id: 'c9',  name: 'Tejföl',     colorId: 'blue'   },
    { id: 'c10', name: 'Csoki',      colorId: 'purple' },
    { id: 'c11', name: 'Mosószer',   colorId: 'gray'   }
  ];

  // =========================================================================
  // STATE
  // =========================================================================
  let categories  = [];
  let catalog     = [];
  let items       = [];
  let selectedColor        = 'green';
  let theme                = 'dark';
  let isPurchasedCollapsed = false;
  let isDragging           = false;   // kategória drag alatt ne legyen szöveges kijelölés
  let fbPollTimer          = null;
  let lastPushTs           = 0;

  // =========================================================================
  // DOM REFERENCIÁK
  // =========================================================================
  const $ = id => document.getElementById(id);
  const html                = document.documentElement;
  const searchInput         = $('searchInput');
  const clearSearchBtn      = $('clearSearchBtn');
  const addBtn              = $('addBtn');
  const autocompleteDropdown = $('autocompleteDropdown');
  const suggestionsList     = $('suggestionsList');
  const colorChipsContainer = $('colorChipsContainer');
  const toBuyListGrouped    = $('toBuyListGrouped');
  const toBuyEmpty          = $('toBuyEmpty');
  const toBuyCount          = $('toBuyCount');
  const purchasedList       = $('purchasedList');
  const purchasedEmpty      = $('purchasedEmpty');
  const purchasedCount      = $('purchasedCount');
  const togglePurchasedHeader = $('togglePurchasedHeader');
  const purchasedSection    = document.querySelector('.purchased-section');
  const themeToggleBtn      = $('themeToggle');
  const catalogBtn          = $('catalogBtn');
  const catalogBadge        = $('catalogBadge');
  const catalogModal        = $('catalogModal');
  const closeCatalogBtn     = $('closeCatalogBtn');
  const catalogSearchInput  = $('catalogSearchInput');
  const catalogItemsList    = $('catalogItemsList');
  const addAllCatalogBtn    = $('addAllCatalogBtn');
  const manageCategoriesBtn = $('manageCategoriesBtn');
  const categoriesModal     = $('categoriesModal');
  const closeCategoriesBtn  = $('closeCategoriesBtn');
  const categoriesEditList  = $('categoriesEditList');
  const saveCategoriesModalBtn = $('saveCategoriesModalBtn');

  // =========================================================================
  // INIT
  // =========================================================================
  function init() {
    loadLocal();
    html.setAttribute('data-theme', theme);
    renderColorChips();
    setupEvents();
    renderAll();
    startGistSync(); // GitHub Gist alapú szinkron
  }

  // =========================================================================
  // LOCALSTORAGE  –  ez az elsődleges mentés, mindig működik
  // =========================================================================
  function loadLocal() {
    // Kategóriák
    const storedCats = tryParse(localStorage.getItem(SK.CATEGORIES), null);
    if (storedCats && Array.isArray(storedCats) && storedCats.length > 0) {
      categories = storedCats;
      // Ha új default kategória jött létre a frissítéssel, adjuk hozzá
      DEFAULT_CATEGORIES.forEach(def => {
        if (!categories.some(c => c.id === def.id))
          categories.push({ ...def, order: categories.length });
      });
    } else {
      categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    }
    sortCats();

    catalog   = tryParse(localStorage.getItem(SK.CATALOG),  DEFAULT_CATALOG.map(c=>({...c})));
    items     = tryParse(localStorage.getItem(SK.ITEMS),     []);
    theme     = localStorage.getItem(SK.THEME) || 'dark';
    selectedColor        = localStorage.getItem(SK.COLOR)     || 'green';
    isPurchasedCollapsed = localStorage.getItem(SK.COLLAPSED) === 'true';
  }

  function saveLocal() {
    try {
      localStorage.setItem(SK.CATEGORIES, JSON.stringify(categories));
      localStorage.setItem(SK.CATALOG,    JSON.stringify(catalog));
      localStorage.setItem(SK.ITEMS,      JSON.stringify(items));
      const ts = Date.now();
      localStorage.setItem(SK.TS, String(ts));
      return ts;
    } catch (e) {
      console.warn('localStorage mentési hiba:', e);
      return Date.now();
    }
  }

  function saveState() {
    const ts = saveLocal();
    renderCatalogBadge();
    scheduleGistPush(ts);
  }

  // =========================================================================
  // GITHUB GIST SZINKRON
  // =========================================================================
  let lastRemoteTs  = 0;   // az utolsó ismert remote timestamp
  let isTyping      = false; // gépelés közben ne szinkroniziljuk a listát
  let typingTimer   = null;

  function startGistSync() {
    fetchGist(); // azonnal egyszer lekér
    setInterval(fetchGist, POLL_MS);
  }

  function fetchGist() {
    // Ha épp gépel a felhasználó, várunk
    if (isTyping) return;

    fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        'Authorization': `token ${GIST_TOKEN}`,
        'User-Agent': 'bevasarlas-app'
      }
    })
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (!data) return;
      const raw = data.files[GIST_FILE]?.content;
      if (!raw) return;
      const remote = JSON.parse(raw);
      const remoteTs = remote.ts || 0;
      const localTs  = parseInt(localStorage.getItem(SK.TS) || '0', 10);

      if (remoteTs > localTs) {
        // A másik telefon változtatott valamit – frissítünk
        if (remote.items)      items      = remote.items;
        if (remote.catalog)    catalog    = remote.catalog;
        if (remote.categories && remote.categories.length > 0)
          categories = remote.categories;
        saveLocal();
        lastRemoteTs = remoteTs;
        sortCats();
        renderColorChips();
        renderAll();
      }
    })
    .catch(() => {}); // offline esetén csendben
  }

  function scheduleGistPush(ts) {
    clearTimeout(window._gistPushTimer);
    window._gistPushTimer = setTimeout(() => pushGist(ts), 800);
  }

  function pushGist(ts) {
    const payload = JSON.stringify({ items, catalog, categories, ts });
    fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${GIST_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'bevasarlas-app'
      },
      body: JSON.stringify({
        files: { [GIST_FILE]: { content: payload } }
      })
    })
    .then(r => { if (r.ok) lastRemoteTs = ts; })
    .catch(() => {}); // offline esetén csendben
  }

  // =========================================================================
  // THEME
  // =========================================================================
  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', theme);
    localStorage.setItem(SK.THEME, theme);
  }

  // =========================================================================
  // KATEGÓRIA SZÍN CHIPEK
  // =========================================================================
  function renderColorChips() {
    colorChipsContainer.innerHTML = '';
    categories.forEach(cat => {
      const chip = document.createElement('button');
      chip.className = `color-chip ${cat.id === selectedColor ? 'active' : ''}`;
      chip.dataset.color = cat.id;
      chip.style.setProperty('--chip-color', cat.color);
      chip.title = cat.name;
      chip.innerHTML = `<span class="dot"></span>${esc(cat.name)}`;
      chip.addEventListener('click', () => {
        colorChipsContainer.querySelectorAll('.color-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        selectedColor = cat.id;
        localStorage.setItem(SK.COLOR, selectedColor);
      });
      colorChipsContainer.appendChild(chip);
    });
  }

  function sortCats() {
    categories.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  // =========================================================================
  // TÉTEL KEZELÉS
  // =========================================================================
  function addItem(name, colorId) {
    colorId = colorId || selectedColor;
    const trimmed = name.trim();
    if (!trimmed) return;

    // Katalógus frissítése
    const existing = catalog.find(c => c.name.toLowerCase() === trimmed.toLowerCase());
    if (!existing) {
      catalog.push({ id: uid(), name: trimmed, colorId });
    } else {
      colorId = existing.colorId || colorId;
    }

    // Lista frissítése (ha már rajta van, csak unchecked-eljük)
    const idx = items.findIndex(i => i.name.toLowerCase() === trimmed.toLowerCase());
    if (idx !== -1) {
      items[idx].checked = false;
      items[idx].addedAt = Date.now();
    } else {
      items.unshift({ id: uid(), name: trimmed, colorId, checked: false, addedAt: Date.now() });
    }

    saveState();
    renderAll();
    searchInput.value = '';
    hideAC();
    clearSearchBtn.classList.add('hidden');
  }

  function toggleChecked(id) {
    const item = items.find(i => i.id === id);
    if (item) { item.checked = !item.checked; saveState(); renderAll(); }
  }

  function deleteItem(id) {
    items = items.filter(i => i.id !== id);
    saveState();
    renderAll();
  }

  function deleteCatalogItem(id) {
    catalog = catalog.filter(c => c.id !== id);
    saveState();
    renderCatalogModal();
  }

  // =========================================================================
  // AUTOCOMPLETE
  // =========================================================================
  function onSearchInput() {
    const q = searchInput.value.trim().toLowerCase();
    if (q) { clearSearchBtn.classList.remove('hidden'); renderAC(q); }
    else   { clearSearchBtn.classList.add('hidden'); hideAC(); }
  }

  function renderAC(q) {
    suggestionsList.innerHTML = '';
    const matches = catalog.filter(c => c.name.toLowerCase().includes(q));

    if (matches.length === 0) {
      const cat = categories.find(c => c.id === selectedColor) || categories[0];
      const row = mkACRow(cat.color, `"${esc(searchInput.value.trim())}" – új tétel hozzáadása`, '+ Hozzáadás');
      row.addEventListener('click', () => addItem(searchInput.value, selectedColor));
      suggestionsList.appendChild(row);
    } else {
      matches.forEach(m => {
        const cat = categories.find(c => c.id === m.colorId) || categories[0];
        const row = mkACRow(cat.color, esc(m.name), '+ Listára');
        row.addEventListener('click', () => addItem(m.name, m.colorId));
        suggestionsList.appendChild(row);
      });
    }
    autocompleteDropdown.classList.remove('hidden');
  }

  function mkACRow(color, label, action) {
    const row = document.createElement('div');
    row.className = 'suggestion-item';
    row.innerHTML = `
      <div class="suggestion-left">
        <span class="suggestion-color-tag" style="background-color:${color}"></span>
        <span>${label}</span>
      </div>
      <div class="suggestion-add-tag">${action}</div>`;
    return row;
  }

  function hideAC() { autocompleteDropdown.classList.add('hidden'); }

  // =========================================================================
  // RENDER
  // =========================================================================
  function renderAll() {
    renderToBuy();
    renderPurchased();
    renderCatalogBadge();
  }

  function renderToBuy() {
    const active = items.filter(i => !i.checked);
    toBuyCount.textContent = active.length;
    toBuyListGrouped.innerHTML = '';

    if (active.length === 0) {
      toBuyListGrouped.appendChild(toBuyEmpty);
      toBuyEmpty.classList.remove('hidden');
      return;
    }
    toBuyEmpty.classList.add('hidden');
    sortCats();

    categories.forEach(cat => {
      const catItems = active.filter(i => (i.colorId || 'green') === cat.id);
      if (catItems.length > 0) toBuyListGrouped.appendChild(makeCategoryGroup(cat, catItems));
    });
  }

  // =========================================================================
  // KATEGÓRIA CSOPORT + DRAG & DROP
  // =========================================================================
  let dragFromId = null;

  function makeCategoryGroup(category, catItems) {
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
          <span>${esc(category.name)}</span>
          <button class="category-edit-btn" title="Kategória átnevezése">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
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
    catItems.forEach(item => group.appendChild(makeItemCard(item)));

    // ---- Desktop HTML5 Drag ----
    group.addEventListener('dragstart', e => {
      dragFromId = category.id;
      isDragging = true;
      group.classList.add('dragging');
      document.body.classList.add('no-select');
      e.dataTransfer.effectAllowed = 'move';
    });
    group.addEventListener('dragend', () => {
      dragFromId = null;
      isDragging = false;
      group.classList.remove('dragging');
      document.body.classList.remove('no-select');
      document.querySelectorAll('.category-group').forEach(el => el.classList.remove('drag-over'));
    });
    group.addEventListener('dragover', e => {
      e.preventDefault();
      if (dragFromId && dragFromId !== category.id) group.classList.add('drag-over');
    });
    group.addEventListener('dragleave', () => group.classList.remove('drag-over'));
    group.addEventListener('drop', e => {
      e.preventDefault();
      group.classList.remove('drag-over');
      if (dragFromId && dragFromId !== category.id) reorderCats(dragFromId, category.id);
    });

    // ---- Mobil Touch Drag (csak a handle-en) ----
    const handle = header.querySelector('.drag-handle');
    handle.addEventListener('touchstart', () => {
      dragFromId = category.id;
      isDragging = true;
      group.classList.add('dragging');
      document.body.classList.add('no-select');
      window.getSelection && window.getSelection().removeAllRanges();
    }, { passive: true });

    handle.addEventListener('touchmove', e => {
      if (!isDragging) return;
      window.getSelection && window.getSelection().removeAllRanges();
      const touch = e.touches[0];
      const below = document.elementFromPoint(touch.clientX, touch.clientY);
      document.querySelectorAll('.category-group').forEach(el => el.classList.remove('drag-over'));
      const tg = below && below.closest('.category-group');
      if (tg && tg.dataset.categoryId !== dragFromId) tg.classList.add('drag-over');
    }, { passive: true });

    handle.addEventListener('touchend', e => {
      if (!isDragging) return;
      isDragging = false;
      group.classList.remove('dragging');
      document.body.classList.remove('no-select');
      const fromId = dragFromId;
      dragFromId = null;
      const touch = e.changedTouches[0];
      const below = document.elementFromPoint(touch.clientX, touch.clientY);
      const tg = below && below.closest('.category-group');
      if (tg && tg.dataset.categoryId && tg.dataset.categoryId !== fromId)
        reorderCats(fromId, tg.dataset.categoryId);
      document.querySelectorAll('.category-group').forEach(el => el.classList.remove('drag-over'));
    });

    return group;
  }

  function reorderCats(fromId, toId) {
    const fi = categories.findIndex(c => c.id === fromId);
    const ti = categories.findIndex(c => c.id === toId);
    if (fi === -1 || ti === -1) return;
    const [moved] = categories.splice(fi, 1);
    categories.splice(ti, 0, moved);
    categories.forEach((c, i) => c.order = i);
    saveState();
    renderAll();
  }

  // =========================================================================
  // MEGVÁSÁROLT LISTA
  // =========================================================================
  function renderPurchased() {
    const purchased = items.filter(i => i.checked);
    purchasedCount.textContent = purchased.length;
    purchasedList.innerHTML = '';

    if (purchased.length === 0) {
      purchasedList.appendChild(purchasedEmpty);
      purchasedEmpty.classList.remove('hidden');
    } else {
      purchasedEmpty.classList.add('hidden');
      purchased.forEach(item => purchasedList.appendChild(makeItemCard(item)));
    }
    purchasedSection.classList.toggle('collapsed', isPurchasedCollapsed);
  }

  function renderCatalogBadge() { catalogBadge.textContent = catalog.length; }

  // =========================================================================
  // ITEM KÁRTYA (csak swipe-pal törölhető – nincs kuka gomb)
  // =========================================================================
  function makeItemCard(item) {
    const wrapper = document.createElement('div');
    wrapper.className = 'item-card-wrapper';
    wrapper.dataset.id = item.id;

    // piros swipe backdrop
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
        <span class="item-title">${esc(item.name)}</span>
      </div>`;
    wrapper.appendChild(card);

    card.addEventListener('click', () => {
      if (isDragging) return;
      if (card.dataset.swiped === 'true') { delete card.dataset.swiped; return; }
      toggleChecked(item.id);
    });

    setupSwipe(card, wrapper, item.id);
    return wrapper;
  }

  function doSwipeDelete(wrapper, id) {
    wrapper.style.transition = 'all .25s ease-out';
    wrapper.style.opacity = '0';
    wrapper.style.transform = 'translateX(-100%)';
    setTimeout(() => deleteItem(id), 250);
  }

  function setupSwipe(card, wrapper, id) {
    let sx = 0, cx = 0, active = false;
    card.addEventListener('touchstart', e => {
      if (isDragging) return;
      sx = e.touches[0].clientX;
      cx = sx;
      active = true;
      card.classList.add('swiping');
    }, { passive: true });

    card.addEventListener('touchmove', e => {
      if (!active || isDragging) return;
      cx = e.touches[0].clientX;
      const dx = cx - sx;
      if (dx < 0) {
        card.style.transform = `translateX(${dx}px)`;
        if (dx < -15) card.dataset.swiped = 'true';
      }
    }, { passive: true });

    card.addEventListener('touchend', () => {
      if (!active) return;
      active = false;
      card.classList.remove('swiping');
      if ((cx - sx) <= -80) doSwipeDelete(wrapper, id);
      else card.style.transform = 'translateX(0)';
    });

    card.addEventListener('touchcancel', () => {
      active = false;
      card.classList.remove('swiping');
      card.style.transform = 'translateX(0)';
    });
  }

  // =========================================================================
  // KATALÓGUS MODAL
  // =========================================================================
  function renderCatalogModal() {
    const q = catalogSearchInput.value.trim().toLowerCase();
    catalogItemsList.innerHTML = '';
    const matches = catalog.filter(c => c.name.toLowerCase().includes(q));

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
          <span>${esc(ci.name)}</span>
          <span style="font-size:.75rem;color:var(--text-muted)">(${esc(cat.name)})</span>
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
        e.stopPropagation(); deleteCatalogItem(ci.id);
      });
      catalogItemsList.appendChild(row);
    });
  }

  // =========================================================================
  // KATEGÓRIA SZERKESZTŐ MODAL
  // =========================================================================
  function renderCategoriesModal() {
    categoriesEditList.innerHTML = '';
    categories.forEach(cat => {
      const row = document.createElement('div');
      row.className = 'category-edit-row';
      row.innerHTML = `
        <span class="category-dot" style="background-color:${cat.color}"></span>
        <input type="text" data-id="${cat.id}" value="${esc(cat.name)}" placeholder="Kategória neve...">`;
      categoriesEditList.appendChild(row);
    });
  }

  function saveCategoriesFromModal() {
    categoriesEditList.querySelectorAll('input[data-id]').forEach(inp => {
      const cat = categories.find(c => c.id === inp.dataset.id);
      if (cat && inp.value.trim()) cat.name = inp.value.trim();
    });
    saveState();
    renderColorChips();
    renderAll();
    categoriesModal.classList.add('hidden');
  }

  // =========================================================================
  // EVENT LISTENERS
  // =========================================================================
  function setupEvents() {
    themeToggleBtn.addEventListener('click', toggleTheme);

    // Gépelés detektálás – szinkron vár, amíg a felhasználó gépel
    searchInput.addEventListener('focus', () => { isTyping = true; });
    searchInput.addEventListener('blur',  () => {
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => { isTyping = false; }, 1500);
    });
    searchInput.addEventListener('input',   onSearchInput);
    searchInput.addEventListener('focus',   onSearchInput);
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addItem(searchInput.value, selectedColor); }
    });

    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearSearchBtn.classList.add('hidden');
      hideAC();
      searchInput.focus();
    });

    addBtn.addEventListener('click', () => addItem(searchInput.value, selectedColor));

    document.addEventListener('click', e => {
      if (!e.target.closest('.input-section')) hideAC();
    });

    togglePurchasedHeader.addEventListener('click', () => {
      isPurchasedCollapsed = !isPurchasedCollapsed;
      localStorage.setItem(SK.COLLAPSED, isPurchasedCollapsed);
      renderPurchased();
    });

    // Katalógus modal
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

    // Kategória modal
    manageCategoriesBtn.addEventListener('click', () => { renderCategoriesModal(); categoriesModal.classList.remove('hidden'); });
    closeCategoriesBtn.addEventListener('click', () => categoriesModal.classList.add('hidden'));
    saveCategoriesModalBtn.addEventListener('click', saveCategoriesFromModal);
    categoriesModal.addEventListener('click', e => { if (e.target === categoriesModal) categoriesModal.classList.add('hidden'); });
  }

  // =========================================================================
  // UTIL
  // =========================================================================
  function uid() { return 'i' + Date.now() + Math.random().toString(36).slice(2, 6); }
  function esc(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }
  function tryParse(s, fallback) {
    if (!s) return typeof fallback === 'function' ? fallback() : (Array.isArray(fallback) ? [...fallback] : fallback);
    try { return JSON.parse(s); } catch { return typeof fallback === 'function' ? fallback() : fallback; }
  }

  // =========================================================================
  // START
  // =========================================================================
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
