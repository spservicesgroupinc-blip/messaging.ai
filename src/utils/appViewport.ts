/** Keep fixed chat panels above keyboards that only resize the visual viewport. */
export function observeAppViewport(target: Window = window): () => void {
  const viewport = target.visualViewport;
  const style = target.document.documentElement.style;
  const update = () => {
    // Preserve the layout while users pinch zoom for readability.
    if (viewport && Math.abs(viewport.scale - 1) > 0.01) return;
    style.setProperty('--app-height', `${viewport?.height ?? target.innerHeight}px`);
    style.setProperty('--app-offset-top', `${viewport?.offsetTop ?? 0}px`);
  };
  update();
  target.addEventListener('resize', update);
  viewport?.addEventListener('resize', update);
  viewport?.addEventListener('scroll', update);
  return () => {
    target.removeEventListener('resize', update);
    viewport?.removeEventListener('resize', update);
    viewport?.removeEventListener('scroll', update);
    style.removeProperty('--app-height');
    style.removeProperty('--app-offset-top');
  };
}
