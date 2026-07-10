// Base URL for the backend API. Override via VITE_API_URL if needed.
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";

const TOKEN_KEY = "authToken";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Core request helper: attaches JSON headers + bearer token, parses JSON,
// and throws an Error with the server message on failure.
async function request(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // No/invalid JSON body.
  }

  if (!res.ok) {
    const message = data?.message || "Request failed. Please try again.";
    const error = new Error(message);
    error.status = res.status;
    if (data && typeof data === "object") {
      Object.assign(error, data);
    }
    throw error;
  }

  return data;
}

export const apiGet = (path) => request("GET", path);
export const apiPost = (path, body) => request("POST", path, body);
export const apiPut = (path, body) => request("PUT", path, body);
export const apiDelete = (path) => request("DELETE", path);
