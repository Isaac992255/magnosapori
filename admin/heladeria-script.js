// ==================== HELADERÍA ADMIN ====================
let heladeriaCategories = [];
let heladeriaData = new Map();
let heladeriaLoaded = false;

// ==================== TAB SWITCHING ====================

window.switchTab = function(tab) {
  const isCafe = tab === 'cafeteria';
  document.getElementById('cafeteriaSection').style.display = isCafe ? 'block' : 'none';
  document.getElementById('heladeriaSection').style.display = isCafe ? 'none' : 'block';

  const primary = '#73B550';
  const tabCafe = document.getElementById('tabCafeteria');
  const tabHel  = document.getElementById('tabHeladeria');

  tabCafe.style.background = isCafe ? primary : '#e5e7eb';
  tabCafe.style.color      = isCafe ? '#fff'  : '#374151';
  tabHel.style.background  = isCafe ? '#e5e7eb' : primary;
  tabHel.style.color       = isCafe ? '#374151' : '#fff';

  if (!isCafe && !heladeriaLoaded) {
    loadHeladeriaData();
  }
};

// ==================== CARGA DE DATOS ====================

async function loadHeladeriaData() {
  try {
    document.getElementById('heladeriaLoadingState').classList.remove('hidden');
    document.getElementById('heladeriaContainer').classList.add('hidden');

    const snap = await db.collection('_heladeriaCategories').orderBy('order').get();
    heladeriaCategories = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    heladeriaData.clear();
    for (const cat of heladeriaCategories) {
      const items = await db.collection(cat.id).orderBy('orden').get();
      heladeriaData.set(cat.id, items.docs.map(d => ({ id: d.id, ...d.data() })));
    }

    renderHeladeriaCategories();
    heladeriaLoaded = true;

    document.getElementById('heladeriaLoadingState').classList.add('hidden');
    document.getElementById('heladeriaContainer').classList.remove('hidden');
  } catch (e) {
    console.error('Error cargando heladeria:', e);
    alert('Error al cargar heladeria');
    document.getElementById('heladeriaLoadingState').classList.add('hidden');
  }
}

// ==================== RENDERIZADO ====================

function renderHeladeriaCategories() {
  const container = document.getElementById('heladeriaContainer');
  container.innerHTML = '';

  heladeriaCategories.forEach(cat => {
    const flavors = heladeriaData.get(cat.id) || [];
    const card = document.createElement('div');
    card.className = 'category-card';

    const rowsHtml = flavors.map(f => `
      <tr>
        <td style="font-size:15px;padding:10px 8px;">${escapeHtml(f.nombre)}</td>
        <td style="text-align:right;padding:10px 8px;">
          <button
            class="btn-delete"
            onclick="deleteFlavor('${cat.id}','${f.id}','${escapeHtml(f.nombre).replace(/'/g, "\\'")}')">
            Borrar
          </button>
        </td>
      </tr>`).join('');

    const tableHtml = flavors.length > 0
      ? `<table class="items-table">
          <thead><tr><th class="th-name">Gusto</th><th class="th-actions" style="text-align:right;">Acción</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>`
      : `<div class="empty-state">
          <div class="empty-state-icon">🍦</div>
          <p class="empty-state-text">Sin gustos cargados. Agregá el primero.</p>
        </div>`;

    card.innerHTML = `
      <div class="category-header">
        <div class="category-title-group">
          <h3 class="category-name">🍦 ${cat.displayName}</h3>
        </div>
      </div>
      <div class="category-actions">
        <button class="btn btn-add" onclick="addFlavor('${cat.id}')">+ Agregar gusto</button>
      </div>
      <div class="items-container">${tableHtml}</div>`;

    container.appendChild(card);
  });
}

// ==================== CRUD HELADERÍA ====================

window.addFlavor = async function(categoryId) {
  const nombre = prompt('Nombre del nuevo gusto de helado:');
  if (!nombre || !nombre.trim()) return;

  const trimmed = nombre.trim();
  const id = trimmed.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  try {
    const existing = heladeriaData.get(categoryId) || [];
    const maxOrden = existing.length > 0 ? Math.max(...existing.map(f => f.orden || 0)) : 0;

    await db.collection(categoryId).doc(id).set({
      nombre: trimmed,
      orden: maxOrden + 1,
      isAvailable: true,
      categoryId,
    });

    heladeriaLoaded = false;
    heladeriaCategories = [];
    heladeriaData.clear();
    await loadHeladeriaData();
  } catch (e) {
    console.error('Error agregando gusto:', e);
    alert('Error al agregar el gusto');
  }
};

window.deleteFlavor = async function(categoryId, flavorId, flavorName) {
  if (!confirm('Eliminar "' + flavorName + '"?')) return;

  try {
    await db.collection(categoryId).doc(flavorId).delete();
    heladeriaLoaded = false;
    heladeriaCategories = [];
    heladeriaData.clear();
    await loadHeladeriaData();
  } catch (e) {
    console.error('Error eliminando gusto:', e);
    alert('Error al eliminar el gusto');
  }
};
