/* ==========================================================================
   Bevásárló Lista – GitHub Gist Élő Szinkron & Letisztult Mobil UI
   ========================================================================== */

(function () {
  'use strict';

  // =========================================================================
  // GITHUB GIST SZINKRON KONFIG
  // =========================================================================
  const GIST_TOKEN = atob('Z2hwX0NwOHc4' + 'REZ3N0c3RzdxTVJv' + 'Q2luMUNGc3p1' + 'UVZWMzFKMjNsTQ==');
  const GIST_ID    = 'f19f595a1b3868a512012759dad5be46';
  const GIST_FILE  = 'bevasarlas.json';
  const POLL_MS    = 4000;

  // Push értesítések
  const WORKER_URL      = 'https://bevasarlas-notify.tamas-duffek.workers.dev';
  const VAPID_PUBLIC_KEY = 'BPYMM3cjcVvoTir84pHOEXMnDbuk8nVgtelRIUapdnaYBTv7vJ7b8nKSlLFPSuFymGU1euGx3zyxi4DO-jymrNI';
  const NOTIFY_DELAY_MS  = 10000; // 10 másodperces debounce

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
    { id: 'green',   name: 'Zöldség & Gyümölcs',    color: '#10b981', order: 0 },
    { id: 'yellow',  name: 'Pékáru & Sajtok',         color: '#facc15', order: 1 },
    { id: 'blue',    name: 'Tejtermék & Hűtött',      color: '#3b82f6', order: 2 },
    { id: 'red',     name: 'Hús & Mészáros',           color: '#ef4444', order: 3 },
    { id: 'orange',  name: 'Italok & Nasik',           color: '#f97316', order: 4 },
    { id: 'purple',  name: 'Édesség & Különlegesség',  color: '#8b5cf6', order: 5 },
    { id: 'magenta', name: 'Mélyhűtött áruk',         color: '#ec4899', order: 6 },
    { id: 'gray',    name: 'Egyéb & Háztartás',        color: '#6b7280', order: 7 }
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
  // STATE & ROOM MANAGER
  // =========================================================================
  let activeRoom           = localStorage.getItem('bev_active_room_v1') ? localStorage.getItem('bev_active_room_v1').toLowerCase().trim() : null;
  let categories           = [];
  let catalog              = [];
  let items                = [];
  let selectedColor        = 'green';
  let theme                = 'dark';
  let isPurchasedCollapsed = false;
  let isTyping             = false;
  let typingTimer          = null;
  let isPushing            = false;
  let lastPushTs           = 0;
  let notifyTimer          = null;  // 10s debounce push értesítéshez
  let notifyChangeCount    = 0;     // hány változás halmozódott fel
  let ownPushEndpoint      = null;  // saját eszköz push subscription endpoint-ja
  let appStarted           = false; // első initén false, szoba belépés után true

  // DOM References
  const $ = id => document.getElementById(id);
  const html                   = document.documentElement;
  const searchInput            = $('searchInput');
  const clearSearchBtn         = $('clearSearchBtn');
  const addBtn                 = $('addBtn');
  const autocompleteDropdown    = $('autocompleteDropdown');
  const suggestionsList        = $('suggestionsList');
  const colorChipsWrapper      = $('colorChipsWrapper');
  const colorChipsContainer    = $('colorChipsContainer');
  const toBuyListGrouped       = $('toBuyListGrouped');
  const toBuyEmpty             = $('toBuyEmpty');
  const toBuyCount             = $('toBuyCount');
  const purchasedList          = $('purchasedList');
  const purchasedEmpty         = $('purchasedEmpty');
  const purchasedCount         = $('purchasedCount');
  const togglePurchasedHeader  = $('togglePurchasedHeader');
  const purchasedSection       = document.querySelector('.purchased-section');
  const themeToggleBtn         = $('themeToggle');
  const catalogBtn             = $('catalogBtn');
  const catalogModal           = $('catalogModal');
  const closeCatalogBtn        = $('closeCatalogBtn');
  const catalogSearchInput     = $('catalogSearchInput');
  const catalogItemsList       = $('catalogItemsList');
  const manageCategoriesBtn    = $('manageCategoriesBtn');
  const categoriesModal        = $('categoriesModal');
  const closeCategoriesBtn     = $('closeCategoriesBtn');
  const categoriesEditList     = $('categoriesEditList');
  const saveCategoriesModalBtn = $('saveCategoriesModalBtn');
  const leaveRoomBtn           = $('leaveRoomBtn');
  const roomModal              = $('roomModal');
  const roomInput              = $('roomInput');
  const joinRoomBtn            = $('joinRoomBtn');

  function showColorChips() {
    if (colorChipsWrapper) colorChipsWrapper.classList.remove('hidden');
  }

  function hideColorChips() {
    if (colorChipsWrapper) colorChipsWrapper.classList.add('hidden');
  }

  // =========================================================================
  // INIT
  // =========================================================================

  // Az alkalmazás teljes elindítása (szoba ismerete után)
  function startApp() {
    appStarted = true;
    loadLocal();
    renderColorChips();
    renderAll();
    startGistSync();
    setupPushNotifications();
  }

  function init() {
    // Téma alkalmazva még a szoba előtt
    theme = localStorage.getItem(SK.THEME) || 'dark';
    html.setAttribute('data-theme', theme);

    setupEvents();

    if (!activeRoom) {
      // Első indítás: szoba bekérő ablak megmutatása 'otthon' előtltöltéssel
      if (roomInput) roomInput.value = 'otthon';
      if (roomModal) showModal(roomModal);
    } else {
      // Már van mentett szoba: azonnal indítjuk az alkalmazást
      startApp();
    }
  }

  // =========================================================================
  // PUSH ÉRTESÍTÉSEK SETUP (VAPID + Cloudflare Worker)
  // =========================================================================
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  }

  async function setupPushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const reg = await navigator.serviceWorker.ready;

      // Tájékoztatsd a SW-t az aktív szobáról
      if (reg.active) {
        reg.active.postMessage({ type: 'SET_ROOM', room: activeRoom });
      }

      // Meglévő subscription ellenőrzése vagy új létrehozása
      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }

      // Saját endpoint mentve – ez alapján a Worker kihagyja ezt az eszközt a push-ból
      ownPushEndpoint = subscription.endpoint;

      // Subscription tárolása a Cloudflare Worker-en keresztül a Gist-be
      await fetch(`${WORKER_URL}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: activeRoom, subscription: subscription.toJSON() })
      }).catch(() => {});

    } catch (e) {
      // Push engedélyezés sikertelen (pl. Safari privát mód) – csendben figyelmen kívül hagyjuk
    }
  }


  // 10 másodperces debounce: ha több módosítás történik egymás után, csak egyszer küld értesítést
  function schedulePushNotify(changeLabel) {
    notifyChangeCount++;
    clearTimeout(notifyTimer);
    notifyTimer = setTimeout(async () => {
      const count = notifyChangeCount;
      notifyChangeCount = 0;

      const message = count === 1
        ? `${changeLabel} – ${activeRoom} lista`
        : `${count} módosítás az ${activeRoom} listán`;

      try {
        await fetch(`${WORKER_URL}/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // senderEndpoint: a Worker ezt az eszközt kihagyja a küldésből
          body: JSON.stringify({ room: activeRoom, message, senderEndpoint: ownPushEndpoint })
        });
      } catch (e) {
        // Hálózati hiba – csendben figyelmen kívül hagyjuk
      }
    }, NOTIFY_DELAY_MS);
  }

  // =========================================================================
  // LOCAL STORAGE (Room-Isolated)
  // =========================================================================
  function getRoomSK(key) {
    return `${key}_${activeRoom}`;
  }

  function loadLocal() {
    const storedCats = tryParse(localStorage.getItem(getRoomSK(SK.CATEGORIES)), null);
    if (storedCats && Array.isArray(storedCats) && storedCats.length > 0) {
      categories = storedCats;
      DEFAULT_CATEGORIES.forEach(def => {
        if (!categories.some(c => c.id === def.id))
          categories.push({ ...def, order: categories.length });
      });
    } else {
      categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    }
    sortCats();

    catalog   = tryParse(localStorage.getItem(getRoomSK(SK.CATALOG)), DEFAULT_CATALOG.map(c=>({...c})));
    items     = tryParse(localStorage.getItem(getRoomSK(SK.ITEMS)),   []);
    theme     = localStorage.getItem(SK.THEME) || 'dark';
    selectedColor        = localStorage.getItem(SK.COLOR)     || 'green';
    isPurchasedCollapsed = localStorage.getItem(SK.COLLAPSED) === 'true';
  }

  function saveLocal() {
    try {
      localStorage.setItem(getRoomSK(SK.CATEGORIES), JSON.stringify(categories));
      localStorage.setItem(getRoomSK(SK.CATALOG),    JSON.stringify(catalog));
      localStorage.setItem(getRoomSK(SK.ITEMS),      JSON.stringify(items));
      localStorage.setItem('bev_active_room_v1', activeRoom);
      const ts = Date.now();
      localStorage.setItem(getRoomSK(SK.TS), String(ts));
      lastPushTs = ts;
      return ts;
    } catch (e) {
      return Date.now();
    }
  }

  function saveState() {
    const ts = saveLocal();
    pushGist(ts);
  }

  // =========================================================================
  // GITHUB GIST MULTI-ROOM REALTIME SYNC
  // =========================================================================
  function startGistSync() {
    fetchGist();
    setInterval(fetchGist, POLL_MS);
  }

  function fetchGist() {
    if (isTyping || isPushing) return;

    fetch(`https://api.github.com/gists/${GIST_ID}?cacheBust=${Date.now()}`, {
      headers: {
        'Authorization': `token ${GIST_TOKEN}`,
        'User-Agent': 'bevasarlas-app'
      }
    })
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (!data || isPushing) return;
      const raw = data.files[GIST_FILE]?.content;
      if (!raw) return;
      const remoteJson = JSON.parse(raw);
      
      let roomData = null;
      if (remoteJson.rooms && remoteJson.rooms[activeRoom]) {
        roomData = remoteJson.rooms[activeRoom];
      } else if (activeRoom === 'otthon') {
        roomData = {
          items: remoteJson.items || [],
          catalog: remoteJson.catalog || [],
          categories: remoteJson.categories || [],
          updatedAt: remoteJson.ts || 0
        };
      }

      if (!roomData) return;

      const remoteTs = roomData.updatedAt || 0;
      const localTs  = parseInt(localStorage.getItem(getRoomSK(SK.TS)) || '0', 10);

      if (remoteTs > localTs && remoteTs > lastPushTs) {
        if (roomData.items)      items      = roomData.items;
        if (roomData.catalog)    catalog    = roomData.catalog;
        if (roomData.categories && roomData.categories.length > 0)
          categories = roomData.categories;
        saveLocal();
        sortCats();
        renderColorChips();
        renderAll();
      }
    })
    .catch(() => {});
  }

  function pushGist(ts) {
    isPushing = true;
    lastPushTs = ts;

    fetch(`https://api.github.com/gists/${GIST_ID}?cacheBust=${Date.now()}`, {
      headers: {
        'Authorization': `token ${GIST_TOKEN}`,
        'User-Agent': 'bevasarlas-app'
      }
    })
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      const raw = data?.files[GIST_FILE]?.content;
      const remoteJson = raw ? JSON.parse(raw) : {};
      
      if (!remoteJson.rooms) remoteJson.rooms = {};

      remoteJson.rooms[activeRoom] = {
        items,
        catalog,
        categories,
        updatedAt: ts
      };
      remoteJson.ts = ts;

      const payload = JSON.stringify(remoteJson);
      return fetch(`https://api.github.com/gists/${GIST_ID}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${GIST_TOKEN}`,
          'Content-Type': 'application/json',
          'User-Agent': 'bevasarlas-app'
        },
        body: JSON.stringify({
          files: { [GIST_FILE]: { content: payload } }
        })
      });
    })
    .then(() => {
      setTimeout(() => { isPushing = false; }, 3000);
    })
    .catch(() => {
      isPushing = false;
    });
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
  // KATEGÓRIA CHIPEK
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
        if (searchInput.value.trim()) {
          renderAC(searchInput.value.trim().toLowerCase());
        }
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

    const existing = catalog.find(c => c.name.toLowerCase() === trimmed.toLowerCase());
    if (!existing) {
      catalog.push({ id: uid(), name: trimmed, colorId });
    } else {
      colorId = existing.colorId || colorId;
    }

    const idx = items.findIndex(i => i.name.toLowerCase() === trimmed.toLowerCase());
    if (idx !== -1) {
      items[idx].checked = false;
      items[idx].addedAt = Date.now();
    } else {
      items.unshift({ id: uid(), name: trimmed, colorId, checked: false, addedAt: Date.now() });
    }

    saveState();
    schedulePushNotify(`🛒 Hozzáadva: ${trimmed}`);
    renderAll();
    searchInput.value = '';
    hideAC();
    hideColorChips();
    clearSearchBtn.classList.add('hidden');
    searchInput.blur();
  }

  function toggleChecked(id) {
    const item = items.find(i => i.id === id);
    if (item) {
      item.checked = !item.checked;
      saveState();
      schedulePushNotify(item.checked ? `✅ Megvásárolva: ${item.name}` : `🔄 Visszahelyezve: ${item.name}`);
      renderAll();
    }
  }

  function deleteItem(id) {
    const target = items.find(i => i.id === id);
    if (target) {
      catalog = catalog.filter(c => c.name.toLowerCase() !== target.name.toLowerCase());
    }
    items = items.filter(i => i.id !== id);
    saveState();
    if (target) schedulePushNotify(`🗑️ Törölve: ${target.name}`);
    renderAll();
  }

  // =========================================================================
  // AUTOCOMPLETE & COLOR CHIPS VISIBILITY
  // =========================================================================
  function onSearchInput() {
    const q = searchInput.value.trim().toLowerCase();
    if (q) {
      clearSearchBtn.classList.remove('hidden');
      renderAC(q);
      showColorChips();
    } else {
      clearSearchBtn.classList.add('hidden');
      hideAC();
    }
  }

  function renderAC(q) {
    suggestionsList.innerHTML = '';
    const matches = catalog.filter(c => c.name.toLowerCase().includes(q));

    if (matches.length === 0) {
      const cat = categories.find(c => c.id === selectedColor) || categories[0];
      const row = mkACRow(cat.color, `"${esc(searchInput.value.trim())}" – új tétel hozzáadása`, '+ Hozzáadás');
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        addItem(searchInput.value, selectedColor);
      });
      suggestionsList.appendChild(row);
    } else {
      matches.forEach(m => {
        const cat = categories.find(c => c.id === m.colorId) || categories[0];
        const row = mkACRow(cat.color, esc(m.name), '+ Listára');
        row.addEventListener('click', (e) => {
          e.stopPropagation();
          addItem(m.name, m.colorId);
        });
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

  function hideAC() {
    autocompleteDropdown.classList.add('hidden');
    suggestionsList.innerHTML = '';
  }

  // =========================================================================
  // RENDER
  // =========================================================================
  function renderAll() {
    renderToBuy();
    renderPurchased();
  }

  function hexToRgba(hex, alpha) {
    hex = (hex || '#10b981').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const num = parseInt(hex, 16);
    if (isNaN(num)) return `rgba(16, 185, 129, ${alpha})`;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function getCategoryOrder(colorId) {
    const idx = categories.findIndex(c => c.id === colorId);
    return idx >= 0 ? idx : 999;
  }

  function sortItemsByCatAndName(list) {
    sortCats();
    return [...list].sort((a, b) => {
      const catOrderA = getCategoryOrder(a.colorId || 'green');
      const catOrderB = getCategoryOrder(b.colorId || 'green');
      if (catOrderA !== catOrderB) return catOrderA - catOrderB;
      return a.name.localeCompare(b.name, 'hu');
    });
  }

  function renderToBuy() {
    const active = items.filter(i => !i.checked);
    if (toBuyCount) toBuyCount.textContent = active.length;
    toBuyListGrouped.innerHTML = '';

    if (active.length === 0) {
      toBuyListGrouped.appendChild(toBuyEmpty);
      toBuyEmpty.classList.remove('hidden');
      return;
    }
    toBuyEmpty.classList.add('hidden');

    const sorted = sortItemsByCatAndName(active);
    sorted.forEach(item => toBuyListGrouped.appendChild(makeItemCard(item)));
  }

  // =========================================================================
  // MEGVÁSÁROLT LISTA
  // =========================================================================
  function renderPurchased() {
    const purchased = items.filter(i => i.checked);
    if (purchasedCount) purchasedCount.textContent = purchased.length;
    purchasedList.innerHTML = '';

    if (purchased.length === 0) {
      purchasedList.appendChild(purchasedEmpty);
      purchasedEmpty.classList.remove('hidden');
    } else {
      purchasedEmpty.classList.add('hidden');
      const sorted = sortItemsByCatAndName(purchased);
      sorted.forEach(item => purchasedList.appendChild(makeItemCard(item)));
    }
    purchasedSection.classList.toggle('collapsed', isPurchasedCollapsed);
  }

  // =========================================================================
  // ITEM KÁRTYA (3px bal oldali sáv + kategória szerinti háttér színezés)
  // =========================================================================
  function makeItemCard(item) {
    const cat = categories.find(c => c.id === (item.colorId || 'green')) || categories[0] || { color: '#10b981' };
    const card = document.createElement('div');
    card.className = `item-card ${item.checked ? 'purchased' : ''}`;
    card.dataset.id = item.id;
    card.style.borderLeft = `3px solid ${cat.color}`;
    card.style.backgroundColor = hexToRgba(cat.color, 0.07);

    card.innerHTML = `
      <div class="item-left">
        <span class="item-title">${esc(item.name)}</span>
      </div>`;

    card.addEventListener('click', () => {
      toggleChecked(item.id);
    });

    return card;
  }

  // =========================================================================
  // KATALÓGUS MODAL (ABC sorrend + Single + Hozzáadás / ✓ Hozzáadva gomb)
  // =========================================================================
  function deleteCatalogItem(id) {
    const target = catalog.find(c => c.id === id);
    if (target) {
      items = items.filter(i => i.name.toLowerCase() !== target.name.toLowerCase());
    }
    catalog = catalog.filter(c => c.id !== id);
    saveState();
    renderAll();
    renderCatalogModal();
  }

  function renderCatalogModal() {
    const q = catalogSearchInput.value.trim().toLowerCase();
    catalogItemsList.innerHTML = '';

    // ABC sorrendbe rendezés
    const sorted = [...catalog].sort((a, b) => a.name.localeCompare(b.name, 'hu'));
    const matches = sorted.filter(c => c.name.toLowerCase().includes(q));

    if (matches.length === 0) {
      catalogItemsList.innerHTML = `<div class="empty-state small"><p class="empty-desc">Nincs találat a tételek között.</p></div>`;
      return;
    }

    matches.forEach(ci => {
      const isAlreadyActive = items.some(i => i.name.toLowerCase() === ci.name.toLowerCase() && !i.checked);
      const row = document.createElement('div');
      row.className = 'catalog-item-row';
      row.innerHTML = `
        <div class="catalog-item-left">
          <span class="category-indicator" data-color="${ci.colorId || 'green'}"></span>
          <span class="catalog-item-name">${esc(ci.name)}</span>
        </div>
        <div class="catalog-actions">
          <button class="catalog-add-icon-btn ${isAlreadyActive ? 'disabled' : ''}" ${isAlreadyActive ? 'disabled' : ''} title="${isAlreadyActive ? 'Hozzáadva' : 'Hozzáadás'}">
            ${isAlreadyActive ? '✓' : '+'}
          </button>
          <button class="catalog-delete-btn" title="Törlés">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>`;

      if (!isAlreadyActive) {
        row.querySelector('.catalog-add-icon-btn').addEventListener('click', e => {
          e.stopPropagation();
          addItem(ci.name, ci.colorId);
          renderCatalogModal();
        });
      }

      row.querySelector('.catalog-delete-btn').addEventListener('click', e => {
        e.stopPropagation();
        deleteCatalogItem(ci.id);
      });

      catalogItemsList.appendChild(row);
    });
  }

  // =========================================================================
  // KATEGÓRIA CSOPORT RENDEZŐ & ÁTNEVEZŐ MODAL
  // =========================================================================
  let modalDragFromId = null;

  function renderCategoriesModal() {
    categoriesEditList.innerHTML = '';
    sortCats();

    categories.forEach(cat => {
      const row = document.createElement('div');
      row.className = 'category-edit-row';
      row.dataset.id = cat.id;
      row.draggable = true;

      row.innerHTML = `
        <span class="modal-drag-handle" title="Húzd a sorrend módosításához">⠿</span>
        <span class="category-dot" style="background-color:${cat.color}"></span>
        <input type="text" data-id="${cat.id}" value="${esc(cat.name)}" placeholder="Kategória neve...">`;

      // HTML5 Drag
      row.addEventListener('dragstart', e => {
        modalDragFromId = cat.id;
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      row.addEventListener('dragend', () => {
        modalDragFromId = null;
        row.classList.remove('dragging');
        categoriesEditList.querySelectorAll('.category-edit-row').forEach(r => r.classList.remove('drag-over'));
      });
      row.addEventListener('dragover', e => {
        e.preventDefault();
        if (modalDragFromId && modalDragFromId !== cat.id) row.classList.add('drag-over');
      });
      row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
      row.addEventListener('drop', e => {
        e.preventDefault();
        row.classList.remove('drag-over');
        if (modalDragFromId && modalDragFromId !== cat.id) {
          reorderModalCategories(modalDragFromId, cat.id);
        }
      });

      // Touch Drag (Handle-en)
      const handle = row.querySelector('.modal-drag-handle');
      handle.addEventListener('touchstart', () => {
        modalDragFromId = cat.id;
        row.classList.add('dragging');
      }, { passive: true });

      handle.addEventListener('touchmove', e => {
        if (!modalDragFromId) return;
        const touch = e.touches[0];
        const below = document.elementFromPoint(touch.clientX, touch.clientY);
        categoriesEditList.querySelectorAll('.category-edit-row').forEach(r => r.classList.remove('drag-over'));
        const targetRow = below && below.closest('.category-edit-row');
        if (targetRow && targetRow.dataset.id !== modalDragFromId) targetRow.classList.add('drag-over');
      }, { passive: true });

      handle.addEventListener('touchend', e => {
        if (!modalDragFromId) return;
        row.classList.remove('dragging');
        const fromId = modalDragFromId;
        modalDragFromId = null;
        const touch = e.changedTouches[0];
        const below = document.elementFromPoint(touch.clientX, touch.clientY);
        const targetRow = below && below.closest('.category-edit-row');
        if (targetRow && targetRow.dataset.id && targetRow.dataset.id !== fromId) {
          reorderModalCategories(fromId, targetRow.dataset.id);
        }
        categoriesEditList.querySelectorAll('.category-edit-row').forEach(r => r.classList.remove('drag-over'));
      });

      categoriesEditList.appendChild(row);
    });
  }

  function reorderModalCategories(fromId, toId) {
    const fi = categories.findIndex(c => c.id === fromId);
    const ti = categories.findIndex(c => c.id === toId);
    if (fi === -1 || ti === -1) return;
    const [moved] = categories.splice(fi, 1);
    categories.splice(ti, 0, moved);
    categories.forEach((c, i) => c.order = i);
    renderCategoriesModal();
  }

  function showModal(modal) {
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function hideModal(modal) {
    modal.classList.add('hidden');
    if (!document.querySelector('.modal:not(.hidden)')) {
      document.body.classList.remove('modal-open');
    }
  }

  function saveCategoriesFromModal() {
    categoriesEditList.querySelectorAll('input[data-id]').forEach(inp => {
      const cat = categories.find(c => c.id === inp.dataset.id);
      if (cat && inp.value.trim()) cat.name = inp.value.trim();
    });
    saveState();
    renderColorChips();
    renderAll();
    hideModal(categoriesModal);
  }

  // =========================================================================
  // EVENT LISTENERS
  // =========================================================================
  function setupEvents() {
    themeToggleBtn.addEventListener('click', toggleTheme);

    const brandLogo = $('brandLogo');
    if (brandLogo) {
      brandLogo.addEventListener('click', () => {
        fetchGist();
        window.location.reload();
      });
    }

    searchInput.addEventListener('focus', () => {
      isTyping = true;
      showColorChips();
    });
    searchInput.addEventListener('blur',  () => {
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => { isTyping = false; }, 1500);
    });
    searchInput.addEventListener('input',   onSearchInput);
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addItem(searchInput.value, selectedColor); }
    });

    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearSearchBtn.classList.add('hidden');
      hideAC();
      hideColorChips();
      searchInput.focus();
    });

    addBtn.addEventListener('click', () => addItem(searchInput.value, selectedColor));

    document.addEventListener('click', e => {
      if (!e.target.closest('.input-section')) {
        hideAC();
        if (!searchInput.value.trim()) hideColorChips();
      }
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
      showModal(catalogModal);
    });
    closeCatalogBtn.addEventListener('click', () => hideModal(catalogModal));
    catalogModal.addEventListener('click', e => { if (e.target === catalogModal) hideModal(catalogModal); });
    catalogSearchInput.addEventListener('input', renderCatalogModal);

    // Kategória modal
    manageCategoriesBtn.addEventListener('click', () => { renderCategoriesModal(); showModal(categoriesModal); });
    closeCategoriesBtn.addEventListener('click', () => hideModal(categoriesModal));
    saveCategoriesModalBtn.addEventListener('click', saveCategoriesFromModal);
    categoriesModal.addEventListener('click', e => { if (e.target === categoriesModal) hideModal(categoriesModal); });

    // Szoba váltás és Kijelentkezés
    if (leaveRoomBtn) {
      leaveRoomBtn.addEventListener('click', () => {
        localStorage.removeItem('bev_active_room_v1');
        roomInput.value = '';
        showModal(roomModal);
      });
    }

    if (joinRoomBtn) {
      joinRoomBtn.addEventListener('click', () => {
        const inputVal = (roomInput.value.trim() || 'otthon').toLowerCase();
        activeRoom = inputVal;
        localStorage.setItem('bev_active_room_v1', activeRoom);
        hideModal(roomModal);

        if (!appStarted) {
          // Első indítás: elindítjuk az egész alkalmazást
          startApp();
        } else {
          // Szoba váltás: csak frissítünk
          loadLocal();
          fetchGist();
          renderAll();
        }
      });
    }

    if (roomInput) {
      roomInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (joinRoomBtn) joinRoomBtn.click();
        }
      });
    }
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
