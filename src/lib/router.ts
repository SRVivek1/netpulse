/**
 * Client-side router — switches visible panels and updates nav active state.
 * Reads feature config that was embedded in the page by Astro at build time.
 */

// Feather-style icon paths (24×24 viewBox)
const ICON_PATHS: Record<string, string> = {
  globe:        '<path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  'map-pin':    '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  zap:          '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  search:       '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  activity:     '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  shield:       '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  code:         '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  'share-2':    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
  lock:         '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  mail:         '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  'git-branch': '<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  'chevron-right': '<polyline points="9 18 15 12 9 6"/>',
};

function makeIcon(name: string): string {
  const paths = ICON_PATHS[name] ?? '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
    style="width:100%;height:100%">${paths}</svg>`;
}

function injectIcons() {
  document.querySelectorAll<HTMLElement>('.np-icon-slot[data-icon]').forEach((el) => {
    const name = el.dataset.icon ?? '';
    el.innerHTML = makeIcon(name);
  });
}

function navigateTo(featureId: string) {
  // Update nav buttons
  document.querySelectorAll<HTMLElement>('[data-feature]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.feature === featureId);
  });

  // Show the right panel, hide others
  document.querySelectorAll<HTMLElement>('.np-panel').forEach((panel) => {
    const isActive = panel.dataset.panel === featureId;
    panel.style.display = isActive ? 'block' : 'none';
  });

  // Update header title
  const activeBtn = document.querySelector<HTMLElement>(
    `#np-sidebar [data-feature="${featureId}"]`
  );
  const label = activeBtn?.querySelector<HTMLElement>('span.flex-1')?.textContent?.trim() ?? '';
  const iconName = activeBtn?.querySelector<HTMLElement>('.np-icon-slot')?.dataset.icon ?? '';
  const titleEl = document.getElementById('np-header-title');
  if (titleEl) {
    titleEl.innerHTML = `
      <span style="width:16px;height:16px;display:inline-flex;color:rgb(56 189 248)">${makeIcon(iconName)}</span>
      <span>${label}</span>
    `;
  }

  // Persist to URL hash for bookmarking
  history.replaceState(null, '', `#${featureId}`);
}

export function initRouter(defaultFeature: string) {
  injectIcons();

  // Click handlers on all nav buttons
  document.querySelectorAll<HTMLButtonElement>('[data-feature]').forEach((btn) => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.feature!));
  });

  // Restore from URL hash or fall back to default
  const hash = location.hash.slice(1);
  const panels = [...document.querySelectorAll<HTMLElement>('.np-panel')]
    .map((p) => p.dataset.panel!);

  const initial = panels.includes(hash) ? hash : defaultFeature;
  navigateTo(initial);
}
