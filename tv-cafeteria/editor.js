// ==================== MENÚ TV CAFETERÍA — EDITOR ====================

const TV_MENU_ID = 'cafeteria';
// Designer's template (static layer). Must be inlined: html2canvas exports it
// blank when it is referenced through an <img>.
const SVG_FONDO_URL = encodeURI('para llevar (2).svg');
// Base canvas size (the native export resolution)
const BASE_W = 1080;
const BASE_H = 1920;
// Flex rows (.fila): 72px → 976px, with a 40px minimum gap before the price
const FILA_W = 904;
const FILA_GAP = 40;
// fitText never shrinks a field below this fraction of its base size
const MIN_FONT_RATIO = 0.7;

let menuData = null;
let saveTimeout = null;
let pendingSave = false;

// ==================== DOM ELEMENTS ====================
const loginPage = document.getElementById('loginPage');
const editorPage = document.getElementById('editorPage');
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const userEmailEl = document.getElementById('userEmail');
const tvCanvas = document.getElementById('tvCanvas');
const capaFondo = document.getElementById('capaFondo');
const capaTextos = document.getElementById('capaTextos');
const saveStatusEl = document.getElementById('saveStatus');
const exportBtn = document.getElementById('exportBtn');
const resolutionSelect = document.getElementById('resolutionSelect');
const formatSelect = document.getElementById('formatSelect');
const campos = Array.from(capaTextos.querySelectorAll('.campo'));

// ==================== BACKGROUND SVG + FONTS ====================
const svgReady = loadSvgBackground();
svgReady.catch(() => {}); // reported via toast; export awaits it again
const fontsReady = Promise.all([
  document.fonts.load('400 34px "Inter"'),
  document.fonts.load('italic 400 25px "Inter"'),
]).catch(() => {});

async function loadSvgBackground() {
  try {
    const resp = await fetch(SVG_FONDO_URL);
    if (!resp.ok) throw new Error(`GET ${SVG_FONDO_URL} failed: ${resp.status}`);
    capaFondo.innerHTML = await resp.text();
  } catch (err) {
    console.error('Error loading SVG background:', err);
    showToast('No se pudo cargar el fondo del menú', 'error');
    throw err;
  }
}

// ==================== AUTH ====================
// Called at the end of the file, once every const below is initialized
function checkSession() {
  const stored = getStoredAuth();
  if (stored) {
    showEditor(stored);
    loadMenu();
  } else {
    showLogin();
  }
}

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
    // Session expired mid-edit: keep the in-memory menu and retry the save
    if (menuData) {
      if (pendingSave) saveMenu();
    } else {
      loadMenu();
    }
  } catch (error) {
    loginError.textContent = error.message || 'Error de autenticación';
    loginError.classList.remove('hidden');
  } finally {
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

function isAuthError(err) {
  return /\b(401|403)\b/.test((err && err.message) || '');
}

// ==================== PREVIEW SCALING ====================
// The canvas is 1080×1920 px. Scale it down to fit the preview area (width and height).
function applyPreviewScale() {
  const wrapper = document.querySelector('.editor-preview-wrapper');
  const container = document.getElementById('tvCanvasContainer');
  if (!wrapper || !container) return;

  const availableW = wrapper.clientWidth - 24; // container padding
  const availableH = window.innerHeight - container.getBoundingClientRect().top + window.scrollY - 48;
  const scale = Math.max(0.3, Math.min(availableW / BASE_W, availableH / BASE_H, 1));

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

// ==================== SAVE STATUS ====================
const SAVE_STATUS_TEXT = {
  idle: '—',
  loading: 'Cargando menú...',
  pending: 'Cambios sin guardar...',
  saving: 'Guardando...',
  saved: 'Guardado ✓',
  error: 'Error al guardar. Reintentando con el próximo cambio.',
  auth: 'Sesión expirada: iniciá sesión para guardar.',
  loadError: 'No se pudo cargar el menú. Recargá la página.',
};

function setSaveStatus(state) {
  saveStatusEl.dataset.state = state === 'loadError' ? 'error' : state;
  saveStatusEl.textContent = SAVE_STATUS_TEXT[state] || '';
}

// ==================== LOAD DATA ====================
async function loadMenu() {
  setSaveStatus('loading');
  try {
    const remote = await apiGet(`/api/admin/tv-menus/${TV_MENU_ID}`);
    menuData = mergeWithDefaults(remote);
    await renderAll();
    setSaveStatus('saved');
  } catch (err) {
    if (err.message && err.message.includes('404')) {
      // Menu doesn't exist yet — create with defaults
      menuData = mergeWithDefaults(null);
      await renderAll();
      showToast('Menú creado con los valores por defecto', 'info');
      pendingSave = true;
      await saveMenu();
    } else if (isAuthError(err)) {
      signOut();
      showLogin();
    } else {
      console.error('Error loading TV menu:', err);
      showToast('Error al cargar el menú', 'error');
      setSaveStatus('loadError');
    }
  }
}

// Remote values are applied over the fixed slots by id; anything missing or of
// the wrong type falls back to the default, so schema changes never break the canvas.
function mergeWithDefaults(remote) {
  const merged = JSON.parse(JSON.stringify(window.MENU_CAFETERIA_DEFAULT));
  const remoteSections = (remote && Array.isArray(remote.sections)) ? remote.sections : [];

  merged.sections.forEach((section) => {
    const rSection = remoteSections.find((s) => s && s.id === section.id);
    if (!rSection || !Array.isArray(rSection.items)) return;

    section.items.forEach((item) => {
      const rItem = rSection.items.find((i) => i && i.id === item.id);
      if (!rItem) return;
      if (typeof rItem.name === 'string' && rItem.name.trim()) item.name = rItem.name;
      if ('subtitle' in item && typeof rItem.subtitle === 'string') item.subtitle = rItem.subtitle;
      if ('price' in item && isValidPrice(rItem.price)) item.price = rItem.price;
      if (Array.isArray(item.prices) && Array.isArray(rItem.prices)) {
        item.prices = item.prices.map((p, idx) => (isValidPrice(rItem.prices[idx]) ? rItem.prices[idx] : p));
      }
    });
  });
  return merged;
}

function findItem(itemId) {
  for (const section of menuData.sections) {
    const item = section.items.find((i) => i.id === itemId);
    if (item) return item;
  }
  return null;
}

// ==================== RENDER ====================
async function renderAll() {
  campos.forEach(renderField);
  await fontsReady;
  fitAll();
}

function renderField(el) {
  const item = findItem(el.dataset.item);
  if (!item) return;
  el.textContent = formatFieldValue(el.dataset.field, getFieldValue(item, el.dataset.field));
}

function getFieldValue(item, field) {
  if (field.startsWith('prices.')) return item.prices[Number(field.split('.')[1])];
  return item[field];
}

function setFieldValue(item, field, value) {
  if (field.startsWith('prices.')) {
    item.prices[Number(field.split('.')[1])] = value;
  } else {
    item[field] = value;
  }
}

function isPriceField(field) {
  return field === 'price' || field.startsWith('prices.');
}

function formatFieldValue(field, value) {
  return isPriceField(field) ? formatPrice(value) : (value || '');
}

// ==================== FIT TEXT ====================
// Shrinks a field until it fits its slot (down to MIN_FONT_RATIO), and flags it
// in red if it still overflows. offsetWidth ignores the preview transform.
function fitCampo(el) {
  const maxWidth = maxWidthFor(el);
  el.style.fontSize = '';
  if (!isFinite(maxWidth)) return;

  const base = parseFloat(getComputedStyle(el).fontSize);
  let size = base;
  while (el.offsetWidth > maxWidth && size > base * MIN_FONT_RATIO) {
    size -= 0.5;
    el.style.fontSize = size + 'px';
  }
  el.classList.toggle('desborda', el.offsetWidth > maxWidth);
}

function maxWidthFor(el) {
  if (el.dataset.max) return Number(el.dataset.max);
  const fila = el.closest('.fila');
  if (fila && !isPriceField(el.dataset.field)) {
    const precio = fila.querySelector('[data-field="price"]');
    return FILA_W - precio.offsetWidth - FILA_GAP;
  }
  return Infinity;
}

function fitAll() {
  campos.forEach(fitCampo);
}

// A price change alters the room left for the name and detail in its row
function fitRelated(el) {
  const fila = el.closest('.fila');
  if (fila) {
    fila.querySelectorAll('.campo').forEach(fitCampo);
  } else {
    fitCampo(el);
  }
}

// ==================== FORMATTING ====================
function formatPrice(price) {
  if (price === undefined || price === null) return '';
  const num = Number(price);
  return '$ ' + num.toLocaleString('es-AR', { minimumFractionDigits: 0 });
}

function parsePrice(text) {
  // Remove $, spaces and dots (thousands separator), parse as number
  const cleaned = text.replace(/\$/g, '').replace(/\s/g, '').replace(/\./g, '').replace(/,/g, '.').trim();
  return cleaned ? Number(cleaned) : NaN;
}

function isValidPrice(value) {
  return typeof value === 'number' && isFinite(value) && value > 0;
}

// ==================== EDITING HANDLERS ====================
capaTextos.addEventListener('focusout', (e) => {
  const el = e.target.closest('.campo');
  if (el) commitField(el);
});

capaTextos.addEventListener('input', (e) => {
  const el = e.target.closest('.campo');
  if (el) fitRelated(el);
});

function commitField(el) {
  if (!menuData) return;
  const item = findItem(el.dataset.item);
  if (!item) return;
  const field = el.dataset.field;
  const previous = getFieldValue(item, field);
  let next;

  if (isPriceField(field)) {
    next = parsePrice(el.textContent);
    if (!isValidPrice(next)) {
      showToast('Precio inválido: escribí solo números (ej: 5000)', 'error');
      next = previous;
    }
  } else {
    next = el.textContent.replace(/\s+/g, ' ').trim();
    if (field === 'name') next = next.toLocaleUpperCase('es-AR');
    if (field === 'name' && !next) {
      showToast('El nombre no puede quedar vacío', 'error');
      next = previous;
    }
  }

  el.textContent = formatFieldValue(field, next);
  fitRelated(el);

  if (next !== previous) {
    setFieldValue(item, field, next);
    scheduleSave();
  }
}

// Enter confirms, Escape restores the saved value
capaTextos.addEventListener('keydown', (e) => {
  const el = e.target.closest('.campo');
  if (!el) return;
  if (e.key === 'Enter') {
    e.preventDefault();
    el.blur();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    renderField(el);
    fitRelated(el);
    el.blur();
  }
});

// Paste as plain text only (no formatting, no line breaks)
capaTextos.addEventListener('paste', (e) => {
  const el = e.target.closest('.campo');
  if (!el) return;
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData('text/plain').replace(/\s+/g, ' ');
  document.execCommand('insertText', false, text);
});

// ==================== AUTO-SAVE ====================
function scheduleSave() {
  pendingSave = true;
  setSaveStatus('pending');
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => saveMenu(), 1200);
}

async function saveMenu() {
  clearTimeout(saveTimeout);
  setSaveStatus('saving');
  try {
    await apiPut(`/api/admin/tv-menus/${TV_MENU_ID}`, { sections: menuData.sections });
    pendingSave = false;
    setSaveStatus('saved');
  } catch (err) {
    console.error('Error saving TV menu:', err);
    if (isAuthError(err)) {
      setSaveStatus('auth');
      showToast('La sesión expiró. Iniciá sesión de nuevo para guardar.', 'error');
      showLogin();
    } else {
      setSaveStatus('error');
      showToast('Error al guardar cambios', 'error');
    }
  }
}

window.addEventListener('beforeunload', (e) => {
  if (pendingSave) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ==================== EXPORT ====================
exportBtn.addEventListener('click', async () => {
  const progress = document.getElementById('exportProgress');
  exportBtn.disabled = true;
  progress.classList.remove('hidden');

  try {
    const [targetW, targetH] = resolutionSelect.value.split('x').map(Number);
    const format = formatSelect.value;
    const canvas = await renderCanvas(targetW / BASE_W);
    const blob = await canvasToBlob(canvas, format);
    downloadBlob(blob, `menu-cafeteria-${targetW}x${targetH}.${format}`);
    showToast(`Imagen exportada (${targetW}×${targetH})`);
  } catch (err) {
    console.error('Export error:', err);
    showToast('Error al exportar la imagen', 'error');
  } finally {
    exportBtn.disabled = false;
    progress.classList.add('hidden');
  }
});

async function renderCanvas(scale) {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  await svgReady;
  await document.fonts.ready;

  // Hide edit UI and remove the preview transform so html2canvas sees the real 1080×1920 canvas
  tvCanvas.classList.add('exporting');
  const prevTransform = tvCanvas.style.transform;
  tvCanvas.style.transform = 'none';
  try {
    await new Promise((r) => setTimeout(r, 200));
    return await html2canvas(tvCanvas, {
      scale: scale,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: BASE_W,
      height: BASE_H,
    });
  } finally {
    tvCanvas.style.transform = prevTransform;
    tvCanvas.classList.remove('exporting');
    applyPreviewScale();
  }
}

// toBlob instead of toDataURL: a 4K PNG as a data URL is too heavy to download reliably
function canvasToBlob(canvas, format) {
  const type = format === 'jpg' ? 'image/jpeg' : 'image/png';
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), type, 0.95);
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ==================== EXPOSE FOR TESTING (Playwright) ====================
window.renderCanvas = renderCanvas;
window.getMenuData = () => menuData;
window.whenReady = () => Promise.all([svgReady, fontsReady]);

checkSession();
