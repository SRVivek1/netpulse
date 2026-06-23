/** Navigate to another feature panel via the app's hash router. */
const HASH_ALIASES: Record<string, string> = { geolocation_map: 'ip_discovery' };

export function navigateToFeature(featureId: string): void {
  const resolved = HASH_ALIASES[featureId] ?? featureId;
  const btn = document.querySelector<HTMLElement>(`[data-feature="${resolved}"]`);
  if (btn) {
    btn.click();
    return;
  }
  window.location.hash = resolved;
}
