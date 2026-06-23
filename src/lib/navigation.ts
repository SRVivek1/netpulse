/** Navigate to another feature panel via the app's hash router. */
export function navigateToFeature(featureId: string): void {
  const btn = document.querySelector<HTMLElement>(`[data-feature="${featureId}"]`);
  if (btn) {
    btn.click();
    return;
  }
  window.location.hash = featureId;
}
