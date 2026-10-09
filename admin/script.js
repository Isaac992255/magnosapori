// ==================== ESTADO GLOBAL ====================
let currentUser = null;
let categories = [];
let categoriesData = new Map(); // Map<categoryId, items[]>

// ==================== ELEMENTOS DEL DOM ====================
const loginPage = document.getElementById('loginPage');
const dashboardPage = document.getElementById('dashboardPage');
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const userEmail = document.getElementById('userEmail');
const loadingState = document.getElementById('loadingState');
const categoriesContainer = document.getElementById('categoriesContainer');

// ==================== AUTENTICACION ====================

// Check stored session on load
(function checkSession() {
  const stored = getStoredAuth();
  if (stored) {
    currentUser = stored;
    showDashboard();
    loadMenuData();
  } else {
    showLogin();
  }
})();

// Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  loginBtn.disabled = true;
  loginBtn.textContent = 'Iniciando sesion...';
  loginError.classList.add('hidden');

  try {
    await signIn(email, password);
    currentUser = { email };
    showDashboard();
    loadMenuData();
  } catch (error) {
    console.error('Error en login:', error);
    loginError.textContent = getErrorMessage(error.message);
    loginError.classList.remove('hidden');
    loginBtn.disabled = false;
    loginBtn.textContent = 'Iniciar Sesion';
  }
});

// Logout
logoutBtn.addEventListener('click', () => {
  signOut();
  currentUser = null;
  showLogin();
});

// ==================== NAVEGACION ====================

function showLogin() {
  loginPage.classList.remove('hidden');
  dashboardPage.classList.add('hidden');
}

function showDashboard() {
  loginPage.classList.add('hidden');
  dashboardPage.classList.remove('hidden');
  if (userEmail && currentUser) {
    userEmail.textContent = currentUser.email;
  }
}

// ==================== TOAST NOTIFICATIONS ====================

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

// ==================== CARGA DE DATOS ====================

// Cache-buster: el backend sobrescribe siempre el mismo nombre de archivo
// (p.ej. categories/pasteleria.jpeg) con Cache-Control: max-age=3600.
// Sin esto, Safari iOS muestra la imagen vieja indefinidamente despues
// de actualizarla. Agregamos ?v=<timestamp> para forzar revalidacion.
function withCacheBuster(url, version) {
  if (!url) return url;
  const v = version || Date.now();
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${v}`;
}

async function loadMenuData() {
  try {
    loadingState.classList.add('hidden');
    // Show skeleton cards
    categoriesContainer.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const sk = document.createElement('div');
      sk.className = 'category-card skeleton-card';
      sk.innerHTML = `
        <div class="skeleton-header"><div class="skeleton-line" style="width:40%;height:20px;"></div><div class="skeleton-line" style="width:15%;height:20px;"></div></div>
        <div class="skeleton-body"><div class="skeleton-line" style="width:100%;height:60px;"></div></div>
        <div class="skeleton-items"><div class="skeleton-line" style="width:70%;height:14px;"></div><div class="skeleton-line" style="width:50%;height:14px;"></div><div class="skeleton-line" style="width:60%;height:14px;"></div></div>
      `;
      categoriesContainer.appendChild(sk);
    }
    categoriesContainer.classList.remove('hidden');

    const data = await apiGet('/api/menu');

    categories = data.categories.map(cat => ({
      id: cat.id,
      displayName: cat.name,
      order: cat.order,
      isActive: cat.isActive,
      isFeatured: cat.isFeatured,
      icon: cat.icon || '',
      descripcion: cat.description || '',
      imageUrl: cat.imageUrl || '',
    }));

    categoriesData.clear();
    for (const cat of data.categories) {
      categoriesData.set(cat.id, cat.items || []);
    }

    renderCategories();

    categoriesContainer.classList.remove('hidden');
  } catch (error) {
    console.error('Error cargando datos:', error);
    showToast('Error al cargar los datos del menú', 'error');
    loadingState.classList.add('hidden');
  }
}

// ==================== RENDERIZADO ====================

function renderCategories() {
  categoriesContainer.innerHTML = '';

  categories.forEach(category => {
    const items = categoriesData.get(category.id) || [];
    const categoryCard = createCategoryCard(category, items);
    categoriesContainer.appendChild(categoryCard);
  });
}

function createCategoryCard(category, items) {
  const card = document.createElement('div');
  card.className = 'category-card';
  card.dataset.categoryId = category.id;

  card.innerHTML = `
    <div class="category-header">
      <div class="category-title-group">
        <span
          class="category-icon editable-icon"
          onclick="editCategoryIcon('${category.id}')"
          title="Clic para cambiar emoji"
        >${category.icon || '\u{1F4C1}'}</span>
        <h3
          class="category-name editable-name"
          onclick="editCategoryName('${category.id}')"
          title="Clic para renombrar la categoría"
        >${escapeHtml(category.displayName)}</h3>
      </div>
      <div class="category-order">
        <span>Orden:</span>
        <input
          type="number"
          class="order-input"
          value="${category.order}"
          min="1"
          data-category-id="${category.id}"
          onchange="updateCategoryOrder('${category.id}', this.value)"
        >
      </div>
    </div>

    <div class="category-meta">
      <div class="category-meta-info">
        <div class="category-featured">
          <label>
            <input
              type="checkbox"
              ${category.isFeatured ? 'checked' : ''}
              onchange="toggleCategoryFeatured('${category.id}', this.checked)"
            >
            \u2B50 Destacada
          </label>
        </div>
        <div class="category-description">
          <span class="desc-label">Descripcion de la categoria:</span>
          <textarea
            placeholder="Ej: Todos incluyen guarnicion..."
            onblur="updateCategoryDescription('${category.id}', this.value)"
          >${escapeHtml(category.descripcion || '')}</textarea>
        </div>
      </div>
      <div class="category-meta-image">
        <div class="category-image-section">
          <span class="img-label">Imagen:</span>
          ${category.imageUrl
            ? `<div class="category-image-wrapper">
                <img src="${escapeHtml(withCacheBuster(category.imageUrl, category.imageVersion))}" alt="${escapeHtml(category.displayName)}">
                <label class="image-overlay">
                  \u{1F4F7} Cambiar
                  <input type="file" accept="image/*,image/heic,image/heif" style="display:none;"
                    onchange="uploadCategoryImage('${category.id}', this.files[0], this)">
                </label>
              </div>`
            : `<label class="category-image-placeholder">
                <span>\u{1F4F7}</span>
                <span>Subir imagen</span>
                <input type="file" accept="image/*,image/heic,image/heif" style="display:none;"
                  onchange="uploadCategoryImage('${category.id}', this.files[0], this)">
              </label>`
          }
        </div>
      </div>
    </div>

    <div class="category-actions">
      <button class="btn btn-add" onclick="addNewItem('${category.id}')">
        + Agregar Item
      </button>
    </div>

    <div class="items-container">
      ${items.length > 0 ? createItemsTable(category.id, items) : createEmptyState()}
    </div>
  `;

  return card;
}

function createItemsTable(categoryId, items) {
  const itemsHtml = items.map(item => `
    <tr data-item-id="${item.id}" class="item-main-row">
      <td class="item-name-cell">${escapeHtml(item.nombre)}</td>
      <td class="item-price-cell">
        <span
          class="editable-price"
          onclick="editPrice('${categoryId}', '${item.id}')"
          data-price="${item.precio}"
        >
          $${formatPrice(item.precio)}
        </span>
      </td>
      <td class="actions-cell">
        <button
          class="btn-delete"
          onclick="deleteItem('${categoryId}', '${item.id}', '${escapeHtml(item.nombre)}')"
          title="Eliminar producto"
        >
          🗑
        </button>
      </td>
    </tr>
    <tr data-item-id="${item.id}-desc" class="item-description-row">
      <td colspan="3" class="item-description-cell">
        <span class="description-label">Descripcion:</span>
        <span
          class="editable-description"
          onclick="editDescription('${categoryId}', '${item.id}')"
          data-description="${escapeHtml(item.descripcion || '')}"
          title="Clic para editar descripcion"
        >${escapeHtml(item.descripcion || '')}</span>
      </td>
    </tr>
  `).join('');

  return `
    <table class="items-table">
      <thead>
        <tr>
          <th class="th-name">Nombre</th>
          <th class="th-price">Precio</th>
          <th class="th-actions" style="text-align: right;">Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
  `;
}

function createEmptyState() {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">\u{1F4CB}</div>
      <p class="empty-state-text">No hay items en esta categoria. Hace clic en "Agregar Item" para empezar.</p>
    </div>
  `;
}

// ==================== OPERACIONES CRUD ====================

// Normaliza cualquier imagen (incluyendo HEIC/HEIF de iPhone) a JPEG.
// Soluciona 3 problemas en iPhone/Mac:
//   1) HEIC no soportado por el backend
//   2) Orientacion EXIF incorrecta (fotos "rotadas")
//   3) Archivos muy pesados que fallan al subir
async function normalizeImageForUpload(file, maxDim = 1600, quality = 0.85) {
  if (!file) return file;

  // Intentar decodificar con createImageBitmap (respeta EXIF en navegadores modernos,
  // incluido Safari iOS 14+). Si el navegador no puede decodificar HEIC, caemos al file original.
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (e) {
    console.warn('[upload] createImageBitmap fallo, probando <img> fallback:', e);
    try {
      bitmap = await new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
        img.src = url;
      });
    } catch (e2) {
      console.error('[upload] No se pudo decodificar la imagen (posible HEIC no soportado):', e2);
      // Devolver original; mejor intentar subir que bloquear.
      return file;
    }
  }

  const srcW = bitmap.width || bitmap.naturalWidth;
  const srcH = bitmap.height || bitmap.naturalHeight;
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  const dstW = Math.round(srcW * scale);
  const dstH = Math.round(srcH * scale);

  const canvas = document.createElement('canvas');
  canvas.width = dstW;
  canvas.height = dstH;
  const ctx = canvas.getContext('2d');
  // Fondo blanco por si es PNG transparente (el backend espera JPEG)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, dstW, dstH);
  ctx.drawImage(bitmap, 0, 0, dstW, dstH);

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) return file;

  const baseName = (file.name || 'image').replace(/\.[^.]+$/, '');
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}

// Upload category image
window.uploadCategoryImage = async function(categoryId, file, inputEl) {
  if (!file) return;

  // Optimistic preview (usa el archivo original, el navegador suele poder previsualizar HEIC en iOS)
  const card = document.querySelector(`[data-category-id="${categoryId}"]`);
  const imgSection = card?.querySelector('.category-image-section');
  const previewUrl = URL.createObjectURL(file);

  if (imgSection) {
    const wrapper = imgSection.querySelector('.category-image-wrapper');
    if (wrapper) {
      wrapper.querySelector('img').src = previewUrl;
      const overlay = wrapper.querySelector('.image-overlay');
      if (overlay) { overlay.classList.add('uploading'); overlay.textContent = '\u23F3 Subiendo...'; }
    } else {
      const placeholder = imgSection.querySelector('.category-image-placeholder');
      if (placeholder) {
        const newWrapper = document.createElement('div');
        newWrapper.className = 'category-image-wrapper';
        newWrapper.innerHTML = `<img src="${previewUrl}" alt="Preview"><div class="image-overlay uploading">\u23F3 Subiendo...</div>`;
        placeholder.replaceWith(newWrapper);
      }
    }
  }

  try {
    // Convertir a JPEG antes de subir -> soluciona HEIC en iPhone/Mac y orientacion EXIF
    const normalized = await normalizeImageForUpload(file);
    await apiUploadImage(categoryId, normalized);
    URL.revokeObjectURL(previewUrl);
    // Marcar nueva version para que el cache-buster cambie en la proxima render
    const cat = categories.find(c => c.id === categoryId);
    if (cat) cat.imageVersion = Date.now();
    showToast('Imagen actualizada');
    await loadMenuData();
  } catch (error) {
    console.error('Error uploading image:', error);
    URL.revokeObjectURL(previewUrl);
    showToast('Error al subir la imagen', 'error');
    await loadMenuData();
  }
};

// Editar icono/emoji de categoria
window.editCategoryIcon = async function(categoryId) {
  const category = categories.find(c => c.id === categoryId);
  if (!category) return;

  const currentIcon = category.icon || '';
  const newIcon = prompt(
    'Emoji/Icono para "' + category.displayName + '"\n\nIngresa un emoji o deja vacio para sin icono:',
    currentIcon
  );

  if (newIcon === null) return;

  try {
    await apiPut('/api/admin/categories/' + categoryId, { icon: newIcon.trim() });
    showToast('Icono actualizado');
    await loadMenuData();
  } catch (error) {
    console.error('Error actualizando icono:', error);
    showToast('Error al actualizar el icono', 'error');
  }
};

// Renombrar categoria (cambia displayName, no el id)
window.editCategoryName = async function(categoryId) {
  const category = categories.find(c => c.id === categoryId);
  if (!category) return;

  const newName = prompt(
    'Nuevo nombre para la categoría:\n(Esto cambia solo el nombre visible, no el identificador interno)',
    category.displayName || ''
  );

  if (newName === null) return;
  const trimmed = newName.trim();
  if (!trimmed) {
    showToast('El nombre no puede estar vacío', 'error');
    return;
  }
  if (trimmed === category.displayName) return;

  try {
    await apiPut('/api/admin/categories/' + categoryId, { displayName: trimmed });
    showToast('Nombre actualizado');
    await loadMenuData();
  } catch (error) {
    console.error('Error actualizando nombre:', error);
    showToast('Error al actualizar el nombre', 'error');
  }
};

// Actualizar orden de categoria
window.updateCategoryOrder = async function(categoryId, newOrder) {
  try {
    const order = parseInt(newOrder);
    if (isNaN(order) || order < 1) {
      showToast('El orden debe ser un número mayor a 0', 'error');
      await loadMenuData();
      return;
    }

    await apiPut('/api/admin/categories/' + categoryId, { order: order });
    showToast('Orden actualizado');
    await loadMenuData();
  } catch (error) {
    console.error('Error actualizando orden:', error);
    showToast('Error al actualizar el orden', 'error');
  }
};

// Actualizar descripcion de categoria
window.updateCategoryDescription = async function(categoryId, newDescription) {
  try {
    await apiPut('/api/admin/categories/' + categoryId, { descripcion: newDescription.trim() });
    showToast('Descripción guardada');
  } catch (error) {
    console.error('Error actualizando descripcion:', error);
    showToast('Error al actualizar la descripción', 'error');
  }
};

// Marcar/desmarcar categoria como destacada (maximo 4)
window.toggleCategoryFeatured = async function(categoryId, isChecked) {
  try {
    if (isChecked) {
      const featuredCount = categories.filter(c => c.isFeatured).length;
      if (featuredCount >= 4) {
        showToast('Máximo 4 categorías destacadas', 'error');
        await loadMenuData();
        return;
      }
    }

    await apiPut('/api/admin/categories/' + categoryId, { isFeatured: isChecked });
    showToast(isChecked ? 'Categoría destacada' : 'Categoría desmarcada');
    await loadMenuData();
  } catch (error) {
    console.error('Error actualizando destacada:', error);
    showToast('Error al actualizar la categoría', 'error');
  }
};

// Editar precio inline
window.editPrice = function(categoryId, itemId) {
  const priceSpan = event.target;
  const currentPrice = priceSpan.dataset.price;

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'price-input';
  input.value = currentPrice;
  input.step = '0.01';
  input.min = '0';

  input.onblur = async function() {
    const newPrice = parseFloat(this.value);

    if (isNaN(newPrice) || newPrice < 0) {
      showToast('El precio debe ser un número válido', 'error');
      priceSpan.style.display = 'inline-block';
      this.remove();
      return;
    }

    try {
      await apiPut('/api/admin/categories/' + categoryId + '/items/' + itemId, { precio: newPrice });

      priceSpan.textContent = '$' + formatPrice(newPrice);
      priceSpan.dataset.price = newPrice;
      priceSpan.style.display = 'inline-block';
      this.remove();

      const items = categoriesData.get(categoryId);
      const item = items.find(i => i.id === itemId);
      if (item) item.precio = newPrice;

      showToast('Precio actualizado');
    } catch (error) {
      console.error('Error actualizando precio:', error);
      showToast('Error al actualizar el precio', 'error');
      priceSpan.style.display = 'inline-block';
      this.remove();
    }
  };

  input.onkeydown = function(e) {
    if (e.key === 'Enter') this.blur();
    else if (e.key === 'Escape') {
      priceSpan.style.display = 'inline-block';
      this.remove();
    }
  };

  priceSpan.style.display = 'none';
  priceSpan.parentNode.insertBefore(input, priceSpan);
  input.focus();
  input.select();
};

// Editar descripcion inline
window.editDescription = function(categoryId, itemId) {
  const descSpan = event.target;
  if (descSpan.querySelector('.description-input')) return;

  const currentDesc = descSpan.dataset.description;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'description-input';
  input.value = currentDesc;
  input.placeholder = 'Descripcion opcional';

  input.onblur = async function() {
    const newDesc = this.value.trim();

    try {
      await apiPut('/api/admin/categories/' + categoryId + '/items/' + itemId, { descripcion: newDesc });

      descSpan.textContent = newDesc;
      descSpan.dataset.description = newDesc;
      descSpan.style.display = 'inline-block';
      this.remove();

      const items = categoriesData.get(categoryId);
      const item = items.find(i => i.id === itemId);
      if (item) item.descripcion = newDesc;

      showToast('Descripción actualizada');
    } catch (error) {
      console.error('Error actualizando descripcion:', error);
      showToast('Error al actualizar la descripción', 'error');
      descSpan.style.display = 'inline-block';
      this.remove();
    }
  };

  input.onkeydown = function(e) {
    if (e.key === 'Enter') this.blur();
    else if (e.key === 'Escape') {
      descSpan.style.display = 'inline-block';
      this.remove();
    }
  };

  descSpan.style.display = 'none';
  descSpan.parentNode.insertBefore(input, descSpan);
  input.focus();
  input.select();
};

// Variables globales para el modal
let currentCategoryForAdd = null;

// Agregar nuevo item - abrir modal
window.addNewItem = function(categoryId) {
  currentCategoryForAdd = categoryId;
  const modal = document.getElementById('addItemModal');
  const form = document.getElementById('addItemForm');

  form.reset();
  modal.classList.remove('hidden');

  setTimeout(() => {
    document.getElementById('itemName').focus();
  }, 100);
};

// Cerrar modal
window.closeAddItemModal = function() {
  const modal = document.getElementById('addItemModal');
  modal.classList.add('hidden');
  currentCategoryForAdd = null;
};

// Manejar submit del formulario
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('addItemForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!currentCategoryForAdd) return;

      const submitBtn = document.getElementById('addItemSubmitBtn');
      const nombre = document.getElementById('itemName').value.trim();
      const descripcion = document.getElementById('itemDescription').value.trim();
      const precio = parseFloat(document.getElementById('itemPrice').value);

      if (!nombre) {
        showToast('El nombre es obligatorio', 'error');
        return;
      }

      if (isNaN(precio) || precio < 0) {
        showToast('El precio debe ser un número válido', 'error');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Agregando...';

      try {
        const items = categoriesData.get(currentCategoryForAdd) || [];
        const maxOrder = items.length > 0
          ? Math.max(...items.map(i => i.orden || 0))
          : 0;

        await apiPost('/api/admin/categories/' + currentCategoryForAdd + '/items', {
          nombre: nombre,
          descripcion: descripcion,
          precio: precio,
          orden: maxOrder + 1,
        });

        closeAddItemModal();
        showToast('Ítem agregado');
        await loadMenuData();
      } catch (error) {
        console.error('Error agregando item:', error);
        showToast('Error al agregar el ítem', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Agregar item';
      }
    });
  }
});

// Eliminar item
window.deleteItem = async function(categoryId, itemId, itemName) {
  const confirmed = confirm('Estas seguro que queres eliminar "' + itemName + '"?');
  if (!confirmed) return;

  try {
    await apiDelete('/api/admin/categories/' + categoryId + '/items/' + itemId);
    showToast('Ítem eliminado');
    await loadMenuData();
  } catch (error) {
    console.error('Error eliminando item:', error);
    showToast('Error al eliminar el ítem', 'error');
  }
};

// ==================== UTILIDADES ====================

function formatPrice(price) {
  return price.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

function getErrorMessage(errorCode) {
  const messages = {
    'INVALID_EMAIL': 'El email no es valido',
    'USER_DISABLED': 'Este usuario ha sido deshabilitado',
    'EMAIL_NOT_FOUND': 'Usuario no encontrado',
    'INVALID_PASSWORD': 'Contrasena incorrecta',
    'INVALID_LOGIN_CREDENTIALS': 'Credenciales invalidas',
    'TOO_MANY_ATTEMPTS_TRY_LATER': 'Demasiados intentos. Intenta mas tarde',
  };

  for (const [key, msg] of Object.entries(messages)) {
    if (errorCode.includes(key)) return msg;
  }
  return 'Error al iniciar sesion. Intenta nuevamente.';
}

// ==================== INICIALIZACION ====================

console.log('Magno Sapori - Panel de Administracion cargado');
