/* ==========================================================================
   Bevásárló Lista - Application Logic (JavaScript)
   ========================================================================== */

(function () {
  'use strict';

  // --- LOCAL STORAGE KEYS ---
  const STORAGE_KEYS = {
    CATALOG: 'bevasarlas_catalog_v1',
    ITEMS: 'bevasarlas_current_items_v1',
    THEME: 'bevasarlas_theme_v1',
    SELECTED_COLOR: 'bevasarlas_color_v1',
    PURCHASED_COLLAPSED: 'bevasarlas_purchased_collapsed_v1',
    CATEGORIES: 'bevasarlas_categories_v1'
  };

  // --- DEFAULT CATEGORIES ---
  const DEFAULT_CATEGORIES = [
    { id: 'green', defaultName: 'Zöld', name: 'Zöldség & Gyümölcs', color: '#10b981', order: 0 },
    { id: 'yellow', defaultName: 'Sárga', name: 'Pékáru & Sajtok', color: '#f59e0b', order: 1 },
    { id: 'blue', defaultName: 'Kék', name: 'Tejtermék & Hűtött', color: '#3b82f6', order: 2 },
    { id: 'red', defaultName: 'Piros', name: 'Hús & Mészáros', color: '#ef4444', order: 3 },
    { id: 'orange', defaultName: 'Narancs', name: 'Italok & Nasik', color: '#f97316', order: 4 },
    { id: 'purple', defaultName: 'Lila', name: 'Édesség & Különlegesség', color: '#a855f7', order: 5 },
    { id: 'gray', defaultName: 'Szürke', name: 'Egyéb & Háztartás', color: '#6b7280', order: 6 }
  ];

  // --- DEFAULT MASTER CATALOG DEMO ITEMS ---
  const DEFAULT_CATALOG = [
    { id: 'cat-1', name: 'Tej', colorId: 'blue' },
    { id: 'cat-2', name: 'Kifli', colorId: 'yellow' },
    { id: 'cat-3', name: 'Sajt', colorId: 'yellow' },
    { id: 'cat-4', name: 'Alma', colorId: 'green' },
    { id: 'cat-5', name: 'Csirkemell', colorId: 'red' },
    { id: 'cat-6', name: 'Ásványvíz', colorId: 'orange' },
    { id: 'cat-7', name: 'Zsemle', colorId: 'yellow' },
    { id: 'cat-8', name: 'Paradicsom', colorId: 'green' },
    { id: 'cat-9', name: 'Tejföl', colorId: 'blue' },
    { id: 'cat-10', name: 'Csoki', colorId: 'purple' },
    { id: 'cat-11', name: 'Mosószer', colorId: 'gray' }
  ];

  // --- DEFAULT INITIAL SHOPPING LIST ---
  const DEFAULT_ITEMS = [
    { id: 'item-1', name: 'Tej', colorId: 'blue', checked: false, addedAt: Date.now() - 3000 },
    { id: 'item-2', name: 'Kifli', colorId: 'yellow', checked: false, addedAt: Date.now() - 2000 },
    { id: 'item-3', name: 'Sajt', colorId: 'yellow', checked: false, addedAt: Date.now() - 1000 }
  ];

  // --- STATE ---
  let categories = [];
  let catalog = [];
  let items = [];
  let selectedColor = 'green';
  let theme = 'dark';
  let isPurchasedCollapsed = false;

  // --- DOM ELEMENTS ---
  const htmlElement = document.documentElement;
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const addBtn = document.getElementById('addBtn');
  const autocompleteDropdown = document.getElementById('autocompleteDropdown');
  const suggestionsList = document.getElementById('suggestionsList');
  const colorChipsContainer = document.getElementById('colorChipsContainer');

  const toBuyListGrouped = document.getElementById('toBuyListGrouped');
  const toBuyEmpty = document.getElementById('toBuyEmpty');
  const toBuyCount = document.getElementById('toBuyCount');

  const purchasedList = document.getElementById('purchasedList');
  const purchasedEmpty = document.getElementById('purchasedEmpty');
  const purchasedCount = document.getElementById('purchasedCount');
  const togglePurchasedHeader = document.getElementById('togglePurchasedHeader');
  const purchasedSection = document.querySelector('.purchased-section');

  const themeToggleBtn = document.getElementById('themeToggle');
  const catalogBtn = document.getElementById('catalogBtn');
  const catalogBadge = document.getElementById('catalogBadge');
  const catalogModal = document.getElementById('catalogModal');
  const closeCatalogBtn = document.getElementById('closeCatalogBtn');
  const catalogSearchInput = document.getElementById('catalogSearchInput');
  const catalogItemsList = document.getElementById('catalogItemsList');
  const addAllCatalogBtn = document.getElementById('addAllCatalogBtn');

  const manageCategoriesBtn = document.getElementById('manageCategoriesBtn');
  const categoriesModal = document.getElementById('categoriesModal');
  const closeCategoriesBtn = document.getElementById('closeCategoriesBtn');
  const categoriesEditList = document.getElementById('categoriesEditList');
  const saveCategoriesModalBtn = document.getElementById('saveCategoriesModalBtn');

  // --- INIT APPLICATION ---
  function init() {
    loadState();
    setupTheme();
    renderColorChips();
    setupEventListeners();
    renderAll();
  }

  // --- LOAD STATE FROM LOCALSTORAGE ---
  function loadState() {
    // Load Categories
    const storedCategories = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (storedCategories) {
      try {
        categories = JSON.parse(storedCategories);
        // Ensure all default color ids exist in loaded categories
        DEFAULT_CATEGORIES.forEach(defCat => {
          if (!categories.some(c => c.id === defCat.id)) {
            categories.push({ ...defCat, order: categories.length });
          }
        });
      } catch (e) {
        categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
      }
    } else {
      categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
      saveCategories();
    }

    // Sort categories by order
    sortCategories();

    // Load Catalog
    const storedCatalog = localStorage.getItem(STORAGE_KEYS.CATALOG);
    if (storedCatalog) {
      try { catalog = JSON.parse(storedCatalog); } catch (e) { catalog = [...DEFAULT_CATALOG]; }
    } else {
      catalog = [...DEFAULT_CATALOG];
      saveCatalog();
    }

    // Load Items
    const storedItems = localStorage.getItem(STORAGE_KEYS.ITEMS);
    if (storedItems) {
      try { items = JSON.parse(storedItems); } catch (e) { items = [...DEFAULT_ITEMS]; }
    } else {
      items = [...DEFAULT_ITEMS];
      saveItems();
    }

    // Load Theme & Settings
    theme = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
    selectedColor = localStorage.getItem(STORAGE_KEYS.SELECTED_COLOR) || 'green';
    isPurchasedCollapsed = localStorage.getItem(STORAGE_KEYS.PURCHASED_COLLAPSED) === 'true';
  }

  function sortCategories() {
    categories.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  function saveCategories() {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  }

  function saveCatalog() {
    localStorage.setItem(STORAGE_KEYS.CATALOG, JSON.stringify(catalog));
    renderCatalogBadge();
  }

  function saveItems() {
    localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
  }

  function saveTheme() {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  }

  function saveSelectedColor() {
    localStorage.setItem(STORAGE_KEYS.SELECTED_COLOR, selectedColor);
  }

  // --- THEME MANAGEMENT ---
  function setupTheme() {
    htmlElement.setAttribute('data-theme', theme);
  }

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    htmlElement.setAttribute('data-theme', theme);
    saveTheme();
  }

  // --- COLOR CHIPS MANAGEMENT ---
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
        const allChips = colorChipsContainer.querySelectorAll('.color-chip');
        allChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        selectedColor = cat.id;
        saveSelectedColor();
      });

      colorChipsContainer.appendChild(chip);
    });
  }

  // --- ITEM MANAGEMENT LOGIC ---
  function addItem(name, colorId = selectedColor) {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    // Check catalog match
    const catalogMatch = catalog.find(c => c.name.toLowerCase() === trimmedName.toLowerCase());
    if (!catalogMatch) {
      const newCatItem = {
        id: 'cat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        name: trimmedName,
        colorId: colorId
      };
      catalog.push(newCatItem);
      saveCatalog();
    } else {
      if (colorId === selectedColor && catalogMatch.colorId) {
        colorId = catalogMatch.colorId;
      }
    }

    // Add or restore in active list
    const existingIndex = items.findIndex(i => i.name.toLowerCase() === trimmedName.toLowerCase());
    if (existingIndex !== -1) {
      items[existingIndex].checked = false;
      items[existingIndex].colorId = colorId;
      items[existingIndex].addedAt = Date.now();
    } else {
      items.unshift({
        id: 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        name: trimmedName,
        colorId: colorId,
        checked: false,
        addedAt: Date.now()
      });
    }

    saveItems();
    renderAll();

    searchInput.value = '';
    hideAutocomplete();
    clearSearchBtn.classList.add('hidden');
  }

  function toggleItemChecked(itemId) {
    const item = items.find(i => i.id === itemId);
    if (item) {
      item.checked = !item.checked;
      saveItems();
      renderAll();
    }
  }

  function deleteItem(itemId) {
    items = items.filter(i => i.id !== itemId);
    saveItems();
    renderAll();
  }

  function deleteFromCatalog(catalogId) {
    catalog = catalog.filter(c => c.id !== catalogId);
    saveCatalog();
    renderCatalogModal();
    renderAutocomplete();
  }

  // --- AUTOCOMPLETE LOGIC ---
  function handleSearchInput() {
    const query = searchInput.value.trim().toLowerCase();
    if (query.length > 0) {
      clearSearchBtn.classList.remove('hidden');
      renderAutocomplete(query);
    } else {
      clearSearchBtn.classList.add('hidden');
      hideAutocomplete();
    }
  }

  function renderAutocomplete(query = '') {
    const trimmed = query.trim().toLowerCase();
    suggestionsList.innerHTML = '';

    if (!trimmed) {
      hideAutocomplete();
      return;
    }

    const matches = catalog.filter(c => c.name.toLowerCase().includes(trimmed));

    if (matches.length === 0) {
      const newItemRow = document.createElement('div');
      newItemRow.className = 'suggestion-item';
      const catObj = categories.find(c => c.id === selectedColor) || categories[0];
      newItemRow.innerHTML = `
        <div class="suggestion-left">
          <span class="suggestion-color-tag" style="background-color: ${catObj.color};"></span>
          <span>"${escapeHtml(searchInput.value.trim())}" felvétele újként</span>
        </div>
        <div class="suggestion-add-tag">+ Hozzáadás</div>
      `;
      newItemRow.addEventListener('click', () => {
        addItem(searchInput.value, selectedColor);
      });
      suggestionsList.appendChild(newItemRow);
    } else {
      matches.forEach(match => {
        const catObj = categories.find(c => c.id === match.colorId) || categories[0];
        const itemRow = document.createElement('div');
        itemRow.className = 'suggestion-item';
        itemRow.innerHTML = `
          <div class="suggestion-left">
            <span class="suggestion-color-tag" style="background-color: ${catObj.color};"></span>
            <span>${escapeHtml(match.name)}</span>
          </div>
          <div class="suggestion-add-tag">+ Listára</div>
        `;
        itemRow.addEventListener('click', () => {
          addItem(match.name, match.colorId);
        });
        suggestionsList.appendChild(itemRow);
      });
    }

    autocompleteDropdown.classList.remove('hidden');
  }

  function hideAutocomplete() {
    autocompleteDropdown.classList.add('hidden');
  }

  // --- RENDER FUNCTIONS ---
  function renderAll() {
    renderToBuyListGrouped();
    renderPurchasedList();
    renderCatalogBadge();
  }

  // --- RENDER GROUPED TO-BUY LIST WITH DRAG & DROP REORDERING ---
  function renderToBuyListGrouped() {
    const activeItems = items.filter(i => !i.checked);
    toBuyCount.textContent = activeItems.length;

    toBuyListGrouped.innerHTML = '';

    if (activeItems.length === 0) {
      toBuyListGrouped.appendChild(toBuyEmpty);
      toBuyEmpty.classList.remove('hidden');
      return;
    }

    toBuyEmpty.classList.add('hidden');

    // Group items by category colorId
    sortCategories();

    categories.forEach(category => {
      const categoryItems = activeItems.filter(item => (item.colorId || 'green') === category.id);

      // Only render category group if it contains active items
      if (categoryItems.length > 0) {
        const groupEl = createCategoryGroupElement(category, categoryItems);
        toBuyListGrouped.appendChild(groupEl);
      }
    });
  }

  function createCategoryGroupElement(category, categoryItems) {
    const groupContainer = document.createElement('div');
    groupContainer.className = 'category-group';
    groupContainer.dataset.categoryId = category.id;
    groupContainer.draggable = true;

    // Header
    const groupHeader = document.createElement('div');
    groupHeader.className = 'category-group-header';
    groupHeader.innerHTML = `
      <div class="category-header-left">
        <span class="drag-handle" title="Húzd a sorrend módosításához">⠿</span>
        <div class="category-title-badge">
          <span class="category-dot" style="background-color: ${category.color};"></span>
          <span>${escapeHtml(category.name)}</span>
          <button class="category-edit-btn" title="Kategória átnevezése">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
        </div>
      </div>
      <span class="category-item-count">${categoryItems.length} db</span>
    `;

    // Inline edit category button handler
    const editBtn = groupHeader.querySelector('.category-edit-btn');
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openCategoryRenamePrompt(category);
    });

    groupContainer.appendChild(groupHeader);

    // Render Items under this category
    categoryItems.forEach(item => {
      const itemWrapper = createItemCardElement(item);
      groupContainer.appendChild(itemWrapper);
    });

    // --- HTML5 & TOUCH DRAG AND DROP REORDERING ---
    setupCategoryDragAndDrop(groupContainer, category.id);

    return groupContainer;
  }

  function openCategoryRenamePrompt(category) {
    const newName = prompt(`"${category.name}" kategória új neve:`, category.name);
    if (newName !== null && newName.trim() !== '') {
      category.name = newName.trim();
      saveCategories();
      renderColorChips();
      renderAll();
    }
  }

  // --- CATEGORY DRAG AND DROP HANDLERS ---
  let draggedCategoryId = null;

  function setupCategoryDragAndDrop(groupContainer, categoryId) {
    // HTML5 Drag Events
    groupContainer.addEventListener('dragstart', (e) => {
      draggedCategoryId = categoryId;
      groupContainer.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', categoryId);
    });

    groupContainer.addEventListener('dragend', () => {
      draggedCategoryId = null;
      groupContainer.classList.remove('dragging');
      document.querySelectorAll('.category-group').forEach(el => el.classList.remove('drag-over'));
    });

    groupContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (draggedCategoryId && draggedCategoryId !== categoryId) {
        groupContainer.classList.add('drag-over');
      }
    });

    groupContainer.addEventListener('dragleave', () => {
      groupContainer.classList.remove('drag-over');
    });

    groupContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      groupContainer.classList.remove('drag-over');

      if (draggedCategoryId && draggedCategoryId !== categoryId) {
        reorderCategories(draggedCategoryId, categoryId);
      }
    });

    // Mobile Touch Drag Fallback on Handle ⠿
    const handle = groupContainer.querySelector('.drag-handle');
    let touchStartY = 0;

    handle.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
      draggedCategoryId = categoryId;
      groupContainer.classList.add('dragging');
    }, { passive: true });

    handle.addEventListener('touchmove', (e) => {
      if (!draggedCategoryId) return;
      const currentY = e.touches[0].clientY;
      const elementBelow = document.elementFromPoint(e.touches[0].clientX, currentY);
      if (!elementBelow) return;

      const targetGroup = elementBelow.closest('.category-group');
      document.querySelectorAll('.category-group').forEach(el => el.classList.remove('drag-over'));

      if (targetGroup && targetGroup.dataset.categoryId !== draggedCategoryId) {
        targetGroup.classList.add('drag-over');
      }
    }, { passive: true });

    handle.addEventListener('touchend', (e) => {
      if (!draggedCategoryId) return;
      groupContainer.classList.remove('dragging');

      const endY = e.changedTouches[0].clientY;
      const elementBelow = document.elementFromPoint(e.changedTouches[0].clientX, endY);
      
      if (elementBelow) {
        const targetGroup = elementBelow.closest('.category-group');
        if (targetGroup && targetGroup.dataset.categoryId && targetGroup.dataset.categoryId !== draggedCategoryId) {
          reorderCategories(draggedCategoryId, targetGroup.dataset.categoryId);
        }
      }

      draggedCategoryId = null;
      document.querySelectorAll('.category-group').forEach(el => el.classList.remove('drag-over'));
    });
  }

  function reorderCategories(draggedId, targetId) {
    const draggedIdx = categories.findIndex(c => c.id === draggedId);
    const targetIdx = categories.findIndex(c => c.id === targetId);

    if (draggedIdx !== -1 && targetIdx !== -1) {
      const [movedCategory] = categories.splice(draggedIdx, 1);
      categories.splice(targetIdx, 0, movedCategory);

      // Re-assign order numbers
      categories.forEach((cat, idx) => {
        cat.order = idx;
      });

      saveCategories();
      renderAll();
    }
  }

  function renderPurchasedList() {
    const purchased = items.filter(i => i.checked);
    purchasedCount.textContent = purchased.length;

    purchasedList.innerHTML = '';

    if (purchased.length === 0) {
      purchasedList.appendChild(purchasedEmpty);
      purchasedEmpty.classList.remove('hidden');
    } else {
      purchasedEmpty.classList.add('hidden');
      purchased.forEach(item => {
        const itemEl = createItemCardElement(item);
        purchasedList.appendChild(itemEl);
      });
    }

    if (isPurchasedCollapsed) {
      purchasedSection.classList.add('collapsed');
    } else {
      purchasedSection.classList.remove('collapsed');
    }
  }

  function renderCatalogBadge() {
    catalogBadge.textContent = catalog.length;
  }

  // --- SINGLE LINE ITEM CARD WITH TOUCH SWIPE DELETE ---
  function createItemCardElement(item) {
    const wrapper = document.createElement('div');
    wrapper.className = 'item-card-wrapper';
    wrapper.dataset.id = item.id;

    const backdrop = document.createElement('div');
    backdrop.className = 'item-delete-backdrop';
    backdrop.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
      <span>Törlés</span>
    `;
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
      </div>
      <div class="item-right-actions">
        <button class="item-btn delete-btn" title="Törlés" aria-label="Tétel törlése">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
    `;

    wrapper.appendChild(card);

    card.addEventListener('click', (e) => {
      if (e.target.closest('.delete-btn')) return;
      if (card.dataset.hasSwiped === 'true') {
        delete card.dataset.hasSwiped;
        return;
      }
      toggleItemChecked(item.id);
    });

    const delBtn = card.querySelector('.delete-btn');
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      animateAndDeleteWrapper(wrapper, item.id);
    });

    setupSwipeGesture(card, wrapper, item.id);

    return wrapper;
  }

  function animateAndDeleteWrapper(wrapper, itemId) {
    wrapper.style.transition = 'all 0.25s ease-out';
    wrapper.style.opacity = '0';
    wrapper.style.transform = 'translateX(-100%)';
    setTimeout(() => {
      deleteItem(itemId);
    }, 250);
  }

  function setupSwipeGesture(card, wrapper, itemId) {
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    const deleteThreshold = -80;

    card.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      currentX = startX;
      isDragging = true;
      card.classList.add('swiping');
    }, { passive: true });

    card.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      currentX = e.touches[0].clientX;
      const deltaX = currentX - startX;

      if (deltaX < 0) {
        card.style.transform = `translateX(${deltaX}px)`;
        if (deltaX < -15) {
          card.dataset.hasSwiped = 'true';
        }
      }
    }, { passive: true });

    card.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;
      card.classList.remove('swiping');
      const deltaX = currentX - startX;

      if (deltaX <= deleteThreshold) {
        animateAndDeleteWrapper(wrapper, itemId);
      } else {
        card.style.transform = 'translateX(0)';
      }
    });

    card.addEventListener('touchcancel', () => {
      isDragging = false;
      card.classList.remove('swiping');
      card.style.transform = 'translateX(0)';
    });
  }

  // --- MASTER CATALOG MODAL ---
  function renderCatalogModal() {
    const filter = catalogSearchInput.value.trim().toLowerCase();
    catalogItemsList.innerHTML = '';

    const matches = catalog.filter(c => c.name.toLowerCase().includes(filter));

    if (matches.length === 0) {
      catalogItemsList.innerHTML = `
        <div class="empty-state small">
          <p class="empty-desc">Nincs találat a könyvtárban</p>
        </div>
      `;
      return;
    }

    matches.forEach(catItem => {
      const isAlreadyActive = items.some(i => i.name.toLowerCase() === catItem.name.toLowerCase() && !i.checked);
      const catObj = categories.find(c => c.id === catItem.colorId) || categories[0];

      const row = document.createElement('div');
      row.className = 'catalog-item-row';
      row.innerHTML = `
        <div class="catalog-item-left">
          <span class="category-indicator" data-color="${catItem.colorId || 'green'}"></span>
          <span>${escapeHtml(catItem.name)}</span>
          <span style="font-size: 0.75rem; color: var(--text-muted);">(${escapeHtml(catObj.name)})</span>
        </div>
        <div class="catalog-actions">
          <button class="catalog-add-btn">
            ${isAlreadyActive ? '✓ Listán' : '+ Listára'}
          </button>
          <button class="item-btn delete-cat-btn" title="Törlés a könyvtárból" aria-label="Törlés">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>
      `;

      const addBtnEl = row.querySelector('.catalog-add-btn');
      addBtnEl.addEventListener('click', (e) => {
        e.stopPropagation();
        addItem(catItem.name, catItem.colorId);
        renderCatalogModal();
      });

      const delCatBtn = row.querySelector('.delete-cat-btn');
      delCatBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteFromCatalog(catItem.id);
      });

      catalogItemsList.appendChild(row);
    });
  }

  // --- CATEGORIES MANAGEMENT MODAL ---
  function renderCategoriesModal() {
    categoriesEditList.innerHTML = '';

    categories.forEach(cat => {
      const row = document.createElement('div');
      row.className = 'category-edit-row';
      row.innerHTML = `
        <span class="category-dot" style="background-color: ${cat.color};"></span>
        <input type="text" data-id="${cat.id}" value="${escapeHtml(cat.name)}" placeholder="Kategória neve...">
      `;
      categoriesEditList.appendChild(row);
    });
  }

  function saveCategoriesFromModal() {
    const inputs = categoriesEditList.querySelectorAll('input[data-id]');
    inputs.forEach(input => {
      const catId = input.dataset.id;
      const val = input.value.trim();
      const cat = categories.find(c => c.id === catId);
      if (cat && val) {
        cat.name = val;
      }
    });

    saveCategories();
    renderColorChips();
    renderAll();
    categoriesModal.classList.add('hidden');
  }

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    themeToggleBtn.addEventListener('click', toggleTheme);

    searchInput.addEventListener('input', handleSearchInput);
    searchInput.addEventListener('focus', handleSearchInput);

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addItem(searchInput.value, selectedColor);
      }
    });

    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearSearchBtn.classList.add('hidden');
      hideAutocomplete();
      searchInput.focus();
    });

    addBtn.addEventListener('click', () => {
      addItem(searchInput.value, selectedColor);
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.input-section')) {
        hideAutocomplete();
      }
    });

    togglePurchasedHeader.addEventListener('click', () => {
      isPurchasedCollapsed = !isPurchasedCollapsed;
      localStorage.setItem(STORAGE_KEYS.PURCHASED_COLLAPSED, isPurchasedCollapsed ? 'true' : 'false');
      renderPurchasedList();
    });

    // Catalog Modal
    catalogBtn.addEventListener('click', () => {
      catalogSearchInput.value = '';
      renderCatalogModal();
      catalogModal.classList.remove('hidden');
    });

    closeCatalogBtn.addEventListener('click', () => {
      catalogModal.classList.add('hidden');
    });

    catalogModal.addEventListener('click', (e) => {
      if (e.target === catalogModal) {
        catalogModal.classList.add('hidden');
      }
    });

    catalogSearchInput.addEventListener('input', () => {
      renderCatalogModal();
    });

    addAllCatalogBtn.addEventListener('click', () => {
      catalog.forEach(catItem => {
        addItem(catItem.name, catItem.colorId);
      });
      catalogModal.classList.add('hidden');
    });

    // Categories Modal
    manageCategoriesBtn.addEventListener('click', () => {
      renderCategoriesModal();
      categoriesModal.classList.remove('hidden');
    });

    closeCategoriesBtn.addEventListener('click', () => {
      categoriesModal.classList.add('hidden');
    });

    saveCategoriesModalBtn.addEventListener('click', saveCategoriesFromModal);

    categoriesModal.addEventListener('click', (e) => {
      if (e.target === categoriesModal) {
        categoriesModal.classList.add('hidden');
      }
    });
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
