import { useEffect, useState, useSyncExternalStore } from 'react';

function subscribeOnline(listener: () => void) {
  window.addEventListener('online', listener); window.addEventListener('offline', listener);
  return () => { window.removeEventListener('online', listener); window.removeEventListener('offline', listener); };
}
export const useOnline = () => useSyncExternalStore(subscribeOnline, () => navigator.onLine);
export function useMobile() {
  const query = '(max-width: 1023px)';
  return useSyncExternalStore(listener => {
    const media = matchMedia(query); media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, () => matchMedia(query).matches);
}
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let baseline = window.visualViewport?.height ?? innerHeight;
    let width = innerWidth;
    const update = () => {
      const viewport = window.visualViewport;
      if (viewport && Math.abs(viewport.scale - 1) > 0.01) return;
      const height = viewport?.height ?? innerHeight;
      if (innerWidth !== width) { width = innerWidth; baseline = height; }
      const editable = document.activeElement?.matches('input, textarea, [contenteditable="true"]');
      if (!editable) baseline = Math.max(baseline, height);
      setVisible(Boolean(editable && baseline - height > 120));
    };
    window.visualViewport?.addEventListener('resize', update);
    window.addEventListener('resize', update);
    document.addEventListener('focusin', update); document.addEventListener('focusout', update);
    return () => {
      window.visualViewport?.removeEventListener('resize', update); window.removeEventListener('resize', update);
      document.removeEventListener('focusin', update); document.removeEventListener('focusout', update);
    };
  }, []);
  return visible;
}
