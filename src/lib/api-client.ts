/** Build URLs for the backend that the frontend is connected to.
 * Leave NEXT_PUBLIC_API_BASE_URL empty to use same-origin /api routes.
 */
const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');
export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${apiBase}${normalized}`;
}
