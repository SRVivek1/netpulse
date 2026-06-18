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

/** Convert a 2-letter ISO country code to a flag emoji. */
export function countryFlag(code: string | null): string {
  if (!code || code.length !== 2) return '';
  return Array.from(code.toUpperCase())
    .map(c => String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0)))
    .join('');
}

const CONTINENT_NAMES: Record<string, string> = {
  AF: 'Africa', AN: 'Antarctica', AS: 'Asia', EU: 'Europe',
  NA: 'North America', OC: 'Oceania', SA: 'South America',
};

/** Expand a 2-letter continent code to its full name. */
export function continentName(code: string | null): string | null {
  if (!code) return null;
  return CONTINENT_NAMES[code] ?? code;
}
