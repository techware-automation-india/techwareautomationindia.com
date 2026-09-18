const DEFAULT_API_BASE = import.meta.env.PROD
  ? "https://techwareautomationindia-backend.onrender.com"
  : "http://localhost:4001";

const API_BASE = (import.meta.env.VITE_API_URL || DEFAULT_API_BASE).replace(
  /\/+$/,
  "",
);

const TOKEN_KEY = "authToken";

/*
|--------------------------------------------------------------------------
| TOKEN
|--------------------------------------------------------------------------
*/

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/*
|--------------------------------------------------------------------------
| CORE REQUEST
|--------------------------------------------------------------------------
*/

async function request(method, path, body) {
  const headers = {
    "Content-Type": "application/json",
  };

  const token = getToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  console.log("🌐 API:", `${API_BASE}/api${path}`);

  console.log("🔐 Token:", token ? "FOUND" : "MISSING");

  const response = await fetch(`${API_BASE}/api${path}`, {
    method,

    headers,

    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = data?.message || "Request failed. Please try again.";

    const error = new Error(message);

    error.status = response.status;

    if (data && typeof data === "object") {
      Object.assign(error, data);
    }

    throw error;
  }

  return data;
}

/*
|--------------------------------------------------------------------------
| METHODS
|--------------------------------------------------------------------------
*/

export const apiGet = (path) => request("GET", path);

export const apiPost = (path, body) => request("POST", path, body);

export const apiPut = (path, body) => request("PUT", path, body);

export const apiPatch = (path, body) => request("PATCH", path, body);

export const apiDelete = (path) => request("DELETE", path);
