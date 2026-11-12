import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8001";
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("storybook_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const mediaUrl = (path) => (path ? `${BACKEND_URL}${path}` : null);

export function formatApiError(detail) {
  if (detail == null) return "Algo salió mal. Intentá de nuevo.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export async function downloadPdf(path, title) {
  const { data } = await api.get(path, { responseType: "blob" });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(title || "storybook").replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 60) || "storybook"}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
