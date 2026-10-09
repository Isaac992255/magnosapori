// ==================== MAGNO SAPORI API CLIENT ====================
// Replaces direct Firebase SDK with REST API calls to Cloud Run

const API_BASE = 'https://magno-api-958572325760.southamerica-east1.run.app';
const IDENTITY_API_KEY = 'AIzaSyDaZitjJisptOyH3186pp-eM6tjlNmuNj0';

let idToken = null;
let tokenExpiry = 0;

// ==================== AUTH ====================

async function signIn(email, password) {
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${IDENTITY_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error?.message || 'Login failed');
  }
  const data = await resp.json();
  idToken = data.idToken;
  tokenExpiry = Date.now() + Number(data.expiresIn) * 1000;
  localStorage.setItem('magno_idToken', idToken);
  localStorage.setItem('magno_tokenExpiry', String(tokenExpiry));
  localStorage.setItem('magno_email', email);
  return data;
}

function signOut() {
  idToken = null;
  tokenExpiry = 0;
  localStorage.removeItem('magno_idToken');
  localStorage.removeItem('magno_tokenExpiry');
  localStorage.removeItem('magno_email');
}

function getStoredAuth() {
  const stored = localStorage.getItem('magno_idToken');
  const expiry = Number(localStorage.getItem('magno_tokenExpiry') || '0');
  if (stored && expiry > Date.now()) {
    idToken = stored;
    tokenExpiry = expiry;
    return { email: localStorage.getItem('magno_email') || '' };
  }
  signOut();
  return null;
}

function authHeaders() {
  return {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json',
  };
}

// ==================== API CALLS ====================

async function apiGet(path) {
  const resp = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  if (!resp.ok) throw new Error(`GET ${path} failed: ${resp.status}`);
  return resp.json();
}

async function apiPut(path, body) {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`PUT ${path} failed: ${resp.status}`);
  return resp.json();
}

async function apiPost(path, body) {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`POST ${path} failed: ${resp.status}`);
  return resp.json();
}

async function apiDelete(path) {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!resp.ok) throw new Error(`DELETE ${path} failed: ${resp.status}`);
  return resp.json();
}

async function apiUploadImage(categoryId, file) {
  const formData = new FormData();
  formData.append('image', file);
  const resp = await fetch(`${API_BASE}/api/admin/categories/${categoryId}/image`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${idToken}` },
    body: formData,
  });
  if (!resp.ok) throw new Error(`Upload image failed: ${resp.status}`);
  return resp.json();
}
