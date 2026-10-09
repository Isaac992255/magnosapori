// ==================== TV MENU EDITOR ====================

const TV_MENU_ID = 'para-llevar';
// Static header image — fixed, not editable
const STATIC_HEADER_SRC = 'tv-header.png';
// Base canvas size (the native export resolution)
const BASE_W = 1080;
const BASE_H = 1920;

let tvMenuData = null;
let saveTimeout = null;

// ==================== DOM ELEMENTS ====================
const loginPage = document.getElementById('loginPage');
const editorPage = document.getElementById('editorPage');
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const userEmailEl = document.getElementById('userEmail');
const tvCanvas = document.getElementById('tvCanvas');
const tvSections = document.getElementById('tvSections');
const tvHeader = document.getElementById('tvHeader');
const tvFooterText = document.getElementById('tvFooterText');
const footerTextInput = document.getElementById('footerTextInput');
const sectionsList = document.getElementById('sectionsList');
const exportBtn = document.getElementById('exportBtn');
const resolutionSelect = document.getElementById('resolutionSelect');
const customResolution = document.getElementById('customResolution');
const addSectionBtn = document.getElementById('addSectionBtn');

// ==================== AUTH ====================
(function checkSession() {
  const stored = getStoredAuth();
  if (stored) {
    showEditor(stored);
    loadTvMenu();
  } else {
    showLogin();
  }
})();

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  loginBtn.disabled = true;
  loginBtn.textContent = 'Iniciando sesión...';
  loginError.classList.add('hidden');
  try {
    await signIn(email, password);
    showEditor({ email });
    loadTvMenu();
  } catch (error) {
    loginError.textContent = error.message || 'Error de autenticación';
    loginError.classList.remove('hidden');
    loginBtn.disabled = false;
    loginBtn.textContent = 'Iniciar Sesión';
  }
});

logoutBtn.addEventListener('click', () => {
  signOut();
  showLogin();
});

function showLogin() {
  loginPage.classList.remove('hidden');
  editorPage.classList.add('hidden');
}

function showEditor(user) {
  loginPage.classList.add('hidden');
  editorPage.classList.remove('hidden');
  if (userEmailEl) userEmailEl.textContent = user.email || '';
  // Apply preview scaling after editor is visible
  requestAnimationFrame(() => applyPreviewScale());
}

// ==================== PREVIEW SCALING ====================
// The canvas is 1080×1920 px. Scale it down to fit the preview area.
function applyPreviewScale() {
  const wrapper = document.querySelector('.editor-preview-wrapper');
  const container = document.getElementById('tvCanvasContainer');
  if (!wrapper || !container) return;

  const availableW = wrapper.clientWidth - 40; // padding
  const maxPreviewW = Math.min(availableW, 540);
  const scale = maxPreviewW / BASE_W;

  tvCanvas.style.transform = `scale(${scale})`;
  // Set the container to the scaled dimensions so layout works
  container.style.width = (BASE_W * scale + 24) + 'px'; // +24 for padding
  container.style.height = (BASE_H * scale + 24) + 'px';
}

window.addEventListener('resize', applyPreviewScale);

// ==================== TOAST ====================
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ==================== LOAD DATA ====================
async function loadTvMenu() {
  try {
    tvMenuData = await apiGet(`/api/admin/tv-menus/${TV_MENU_ID}`);
    renderAll();
  } catch (err) {
    if (err.message && err.message.includes('404')) {
      // Menu doesn't exist yet — create with defaults
      tvMenuData = {
        id: TV_MENU_ID,
        headerImage: '',
        footerText: 'CONSULTÁ POR EL PLATO DEL DÍA',
        sections: [],
      };
      showToast('Menú TV no encontrado. Creando nuevo...', 'info');
      await saveTvMenu();
    } else {
      console.error('Error loading TV menu:', err);
      showToast('Error al cargar el menú TV', 'error');
    }
  }
}

// ==================== RENDER ALL ====================
function renderAll() {
  renderHeader();
  renderSections();
  renderFooter();
  renderSidebarSections();
}

// ---- Header ----
function renderHeader() {
  // Always use the static header image
  tvHeader.innerHTML = `<img src="${STATIC_HEADER_SRC}" alt="Header">`;
  const headerPreview = document.getElementById('headerPreview');
  if (headerPreview) {
    headerPreview.innerHTML = `<img src="${STATIC_HEADER_SRC}" alt="Preview">`;
  }
}

// ---- Footer ----
function renderFooter() {
  tvFooterText.textContent = tvMenuData.footerText || '';
  footerTextInput.value = tvMenuData.footerText || '';
}

// ---- Sections (canvas) ----
function renderSections() {
  tvSections.innerHTML = '';
  if (!tvMenuData.sections) return;

  tvMenuData.sections.forEach((section, sIdx) => {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'tv-section';
    sectionEl.dataset.sectionIndex = sIdx;

    // Section actions (delete, add item)
    const actionsHtml = `
      <div class="tv-section-actions">
        <button title="Eliminar sección" onclick="deleteSection(${sIdx})">✕</button>
      </div>`;

    // Section name + subtitle (inline if subtitle exists)
    const nameClass = section.layout === 'list' && section.items && section.items.length > 4
      ? 'tv-section-name tv-section-name-large' : 'tv-section-name';
    let html = actionsHtml;

    if (section.subtitle !== null && section.subtitle !== undefined) {
      // Heading + subtitle on the same line
      html += `<div class="tv-section-heading-row">`;
      html += `<span class="${nameClass}" contenteditable="true"
        data-section="${sIdx}" data-field="name"
        onblur="onSectionFieldEdit(this, ${sIdx}, 'name')">${escapeHtml(section.name)}</span>`;
      html += `<span class="tv-section-subtitle" contenteditable="true"
        data-section="${sIdx}" data-field="subtitle"
        onblur="onSectionFieldEdit(this, ${sIdx}, 'subtitle')">${formatSubtitle(section.subtitle)}</span>`;
      html += `</div>`;
    } else {
      html += `<div class="${nameClass}" contenteditable="true"
        data-section="${sIdx}" data-field="name"
        onblur="onSectionFieldEdit(this, ${sIdx}, 'name')">${escapeHtml(section.name)}</div>`;
    }

    // Items
    if (section.layout === 'inline') {
      html += renderInlineLayout(section, sIdx);
    } else {
      html += renderListLayout(section, sIdx);
    }

    // Add item button
    html += `<button class="tv-add-item-btn" onclick="addItem(${sIdx})">+ Agregar ítem</button>`;

    sectionEl.innerHTML = html;
    tvSections.appendChild(sectionEl);
  });
}

function renderListLayout(section, sIdx) {
  if (!section.items || section.items.length === 0) return '';
  return section.items.map((item, iIdx) => `
    <div class="tv-item-row">
      <div class="tv-item-actions">
        <button title="Eliminar" onclick="deleteItem(${sIdx}, ${iIdx})">✕</button>
      </div>
      <span class="tv-item-name" contenteditable="true"
        onblur="onItemEdit(this, ${sIdx}, ${iIdx}, 'name')">${escapeHtml(item.name)}</span>
      <span class="tv-item-price" contenteditable="true"
        onblur="onItemEdit(this, ${sIdx}, ${iIdx}, 'price')">${formatPrice(item.price)}</span>
    </div>
  `).join('');
}

function renderInlineLayout(section, sIdx) {
  if (!section.items || section.items.length === 0) return '';
  const itemsHtml = section.items.map((item, iIdx) => {
    const sep = iIdx < section.items.length - 1 ? '<span class="tv-inline-separator">•</span>' : '';
    return `<span class="tv-inline-item" contenteditable="true"
      onblur="onItemEdit(this, ${sIdx}, ${iIdx}, 'name')">${escapeHtml(item.name)}</span>${sep}`;
  }).join('\n');

  // Price flows inline with the items (same row)
  let priceHtml = '';
  if (section.sharedPrice !== undefined && section.sharedPrice !== null) {
    priceHtml = `<span class="tv-inline-price" contenteditable="true"
      onblur="onSharedPriceEdit(this, ${sIdx})">${formatPrice(section.sharedPrice)}</span>`;
  }

  // Price FIRST (floats right), then items flow around it
  return `<div class="tv-inline-items">${priceHtml}${itemsHtml}</div>`;
}

// ---- Sidebar sections list ----
function renderSidebarSections() {
  sectionsList.innerHTML = '';
  if (!tvMenuData.sections) return;

  tvMenuData.sections.forEach((section, sIdx) => {
    const el = document.createElement('div');
    el.className = 'section-control-item';
    const count = section.items ? section.items.length : 0;
    const layoutLabel = section.layout === 'inline' ? '(inline)' : '(lista)';
    el.innerHTML = `
      <span class="section-name-label">${escapeHtml(section.name)}</span>
      <span class="section-item-count">${count} items ${layoutLabel}</span>
      <button title="Alternar layout" onclick="toggleLayout(${sIdx})">↔</button>
      <button title="Eliminar" onclick="deleteSection(${sIdx})">✕</button>
    `;
    sectionsList.appendChild(el);
  });
}

// ==================== FORMATTING ====================
function formatPrice(price) {
  if (price === undefined || price === null) return '';
  const num = Number(price);
  return '$ ' + num.toLocaleString('es-AR', { minimumFractionDigits: 0 });
}

function parsePrice(text) {
  // Remove $ and dots, parse as number
  const cleaned = text.replace(/\$/g, '').replace(/\./g, '').replace(/,/g, '.').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function formatSubtitle(text) {
  if (!text) return '';
  // Wrap text in italics where "ensalada" appears (matching original)
  return text.replace(/(ensalada)/gi, '<em>$1</em>');
}

function escapeHtml(str) {
  if (!str) return '';
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

// ==================== EDITING HANDLERS ====================

// Section field (name, subtitle)
window.onSectionFieldEdit = function(el, sIdx, field) {
  const newValue = el.textContent.trim();
  if (!tvMenuData.sections[sIdx]) return;
  tvMenuData.sections[sIdx][field] = newValue;
  scheduleSave();
  renderSidebarSections();
};

// Item field (name, price) in list layout
window.onItemEdit = function(el, sIdx, iIdx, field) {
  if (!tvMenuData.sections[sIdx] || !tvMenuData.sections[sIdx].items[iIdx]) return;

  if (field === 'price') {
    const rawPrice = parsePrice(el.textContent);
    tvMenuData.sections[sIdx].items[iIdx].price = rawPrice;
    el.textContent = formatPrice(rawPrice);
  } else {
    tvMenuData.sections[sIdx].items[iIdx][field] = el.textContent.trim();
  }
  scheduleSave();
};

// Shared price edit for inline layout
window.onSharedPriceEdit = function(el, sIdx) {
  if (!tvMenuData.sections[sIdx]) return;
  const rawPrice = parsePrice(el.textContent);
  tvMenuData.sections[sIdx].sharedPrice = rawPrice;
  el.textContent = formatPrice(rawPrice);
  scheduleSave();
};

// Footer edit from canvas
tvFooterText.addEventListener('blur', () => {
  tvMenuData.footerText = tvFooterText.textContent.trim();
  footerTextInput.value = tvMenuData.footerText;
  scheduleSave();
});

// Footer edit from sidebar input
document.getElementById('updateFooterBtn').addEventListener('click', () => {
  tvMenuData.footerText = footerTextInput.value.trim();
  tvFooterText.textContent = tvMenuData.footerText;
  scheduleSave();
  showToast('Pie actualizado');
});

// ==================== SECTION OPERATIONS ====================

window.addItem = function(sIdx) {
  const section = tvMenuData.sections[sIdx];
  if (!section) return;

  if (section.layout === 'inline') {
    section.items.push({ name: 'NUEVO ÍTEM' });
  } else {
    section.items.push({ name: 'NUEVO ÍTEM', price: 0 });
  }

  renderSections();
  renderSidebarSections();
  scheduleSave();
  showToast('Ítem agregado');
};

window.deleteItem = function(sIdx, iIdx) {
  const section = tvMenuData.sections[sIdx];
  if (!section || !section.items[iIdx]) return;
  const name = section.items[iIdx].name;
  if (!confirm(`¿Eliminar "${name}"?`)) return;

  section.items.splice(iIdx, 1);
  renderSections();
  renderSidebarSections();
  scheduleSave();
  showToast('Ítem eliminado');
};

window.deleteSection = function(sIdx) {
  const section = tvMenuData.sections[sIdx];
  if (!section) return;
  if (!confirm(`¿Eliminar la sección "${section.name}" y todos sus ítems?`)) return;

  tvMenuData.sections.splice(sIdx, 1);
  renderSections();
  renderSidebarSections();
  scheduleSave();
  showToast('Sección eliminada');
};

window.toggleLayout = function(sIdx) {
  const section = tvMenuData.sections[sIdx];
  if (!section) return;

  if (section.layout === 'inline') {
    section.layout = 'list';
    // Ensure items have prices
    section.items.forEach(item => {
      if (item.price === undefined) item.price = section.sharedPrice || 0;
    });
    delete section.sharedPrice;
  } else {
    section.layout = 'inline';
    // Set shared price from first item or 0
    section.sharedPrice = (section.items[0] && section.items[0].price) || 0;
  }

  renderSections();
  renderSidebarSections();
  scheduleSave();
};

addSectionBtn.addEventListener('click', () => {
  const name = prompt('Nombre de la nueva sección (ej: EMPANADAS):');
  if (!name) return;

  // Ask for layout type
  const isInline = confirm('¿Los ítems comparten el mismo precio? (Aceptar = sí, Cancelar = no)');

  const newSection = {
    name: name.toUpperCase(),
    subtitle: null,
    layout: isInline ? 'inline' : 'list',
    items: [],
  };

  if (isInline) {
    newSection.sharedPrice = 0;
  }

  tvMenuData.sections.push(newSection);
  renderSections();
  renderSidebarSections();
  scheduleSave();
  showToast('Sección agregada');
});

// ==================== HEADER (static — no upload needed) ====================
// The header image is a fixed asset at tv-header.png

// ==================== AUTO-SAVE ====================
function scheduleSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => saveTvMenu(), 1200);
}

async function saveTvMenu() {
  try {
    await apiPut(`/api/admin/tv-menus/${TV_MENU_ID}`, {
      sections: tvMenuData.sections,
      footerText: tvMenuData.footerText,
    });
    console.log('TV menu saved');
  } catch (err) {
    console.error('Error saving TV menu:', err);
    showToast('Error al guardar cambios', 'error');
  }
}

// ==================== RESOLUTION / EXPORT ====================
resolutionSelect.addEventListener('change', () => {
  customResolution.classList.toggle('hidden', resolutionSelect.value !== 'custom');
});

exportBtn.addEventListener('click', async () => {
  const progress = document.getElementById('exportProgress');
  exportBtn.disabled = true;
  progress.classList.remove('hidden');

  try {
    // Determine target resolution
    let targetW, targetH;
    if (resolutionSelect.value === 'custom') {
      targetW = parseInt(document.getElementById('customWidth').value) || 1080;
      targetH = parseInt(document.getElementById('customHeight').value) || 1920;
    } else {
      const [w, h] = resolutionSelect.value.split('x').map(Number);
      targetW = w;
      targetH = h;
    }

    // Add exporting class to hide edit UI
    tvCanvas.classList.add('exporting');

    // Temporarily remove the preview transform so html2canvas sees the real 1080×1920 canvas
    const prevTransform = tvCanvas.style.transform;
    tvCanvas.style.transform = 'none';

    // Wait for fonts to be ready
    await document.fonts.ready;
    await new Promise(r => setTimeout(r, 200));

    // Scale: the canvas is 1080×1920. For 1080×1920 output, scale=1.
    // For 2160×3840, scale=2, etc.
    const scale = targetW / BASE_W;

    const canvas = await html2canvas(tvCanvas, {
      scale: scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#000000',
      logging: false,
      width: BASE_W,
      height: BASE_H,
    });

    // Restore preview transform
    tvCanvas.style.transform = prevTransform;
    tvCanvas.classList.remove('exporting');
    applyPreviewScale();

    // Download
    const link = document.createElement('a');
    link.download = `menu-${TV_MENU_ID}-${targetW}x${targetH}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    showToast(`Imagen exportada (${targetW}×${targetH})`);
  } catch (err) {
    console.error('Export error:', err);
    tvCanvas.style.transform = '';
    tvCanvas.classList.remove('exporting');
    applyPreviewScale();
    showToast('Error al exportar la imagen', 'error');
  } finally {
    exportBtn.disabled = false;
    progress.classList.add('hidden');
  }
});

// ==================== PREVENT NEWLINES IN CONTENTEDITABLE ====================
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.getAttribute('contenteditable') === 'true') {
    e.preventDefault();
    e.target.blur();
  }
});

// ==================== EXPOSE FOR TESTING (Playwright) ====================
window.setMenuData = function(data) { tvMenuData = data; };
window.renderAll = renderAll;
window.applyPreviewScale = applyPreviewScale;
