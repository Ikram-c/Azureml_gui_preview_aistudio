/**
 * Pure utility functions for Azure Cloud Send (file size formatting, wildcard filename validation,
 * and repository search filtering).
 */

export function formatBytes(bytes: number): string {
  if (bytes < 0 || !Number.isFinite(bytes)) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function matchesWildcard(
  filename: string,
  pattern: string,
  enableValidation: boolean = true
): boolean {
  if (!enableValidation) return true;
  const trimmed = pattern.trim();
  if (!trimmed || trimmed === '*.*' || trimmed === '*') {
    return true;
  }
  const escaped = trimmed
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  try {
    return new RegExp(`^${escaped}$`, 'i').test(filename);
  } catch {
    return true;
  }
}

export interface SearchableRepo {
  name: string;
  nameWithOwner: string;
  visibility: string;
  clone_url: string;
  html_url: string;
  description: string;
  language: string;
  stars?: number;
  updated_at: string;
  cloned?: boolean;
}

export function filterRepositories<T extends SearchableRepo>(repos: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return repos;
  return repos.filter(
    (r) =>
      r.nameWithOwner.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      (r.language && r.language.toLowerCase().includes(q))
  );
}
