import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes safely, resolving conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Copy text to clipboard and return success boolean. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Format a coordinate pair for display. */
export function formatCoords(lat: number | null, lon: number | null): string {
  if (lat == null || lon == null) return '—';
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

/** Build a location string from parts, filtering nulls. */
export function formatLocation(...parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join(', ') || 'Location unavailable';
}
