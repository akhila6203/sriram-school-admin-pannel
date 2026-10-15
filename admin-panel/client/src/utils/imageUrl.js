const apiUrl = import.meta.env.VITE_API_URL || '/api';

const API_ORIGIN = new URL(
  apiUrl,
  window.location.origin
).origin;

export function getImageUrl(value) {
  if (!value) return '';

  const imagePath = String(value).trim().replace(/\\/g, '/');

  if (/^(https?:\/\/|data:|blob:)/i.test(imagePath)) {
    return imagePath;
  }

  return `${API_ORIGIN}/${imagePath.replace(/^\/+/, '')}`;
}