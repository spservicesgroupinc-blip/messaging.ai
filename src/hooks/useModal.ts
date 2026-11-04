import { useEffect, useRef, useSyncExternalStore, type RefObject } from 'react';

let activeModal: { release: (restoreFocus: boolean) => void; close: () => void } | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());
export function useAnyModal() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => Boolean(activeModal));
}
/** One modal at a time, including action sheets; desktop docked panels stay non-modal. */
export function useModal(ref: RefObject<HTMLElement | null>, enabled: boolean, onClose: () => void) {
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const panel = ref.current;
    if (!enabled || !panel) return;
    if (activeModal) { const previous = activeModal; activeModal = null; previous.release(false); previous.close(); }
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const inerted: [HTMLElement, boolean][] = [];
    let branch: HTMLElement = panel;
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && sibling instanceof HTMLElement && !['SCRIPT', 'STYLE'].includes(sibling.tagName)) {
          inerted.push([sibling, sibling.inert]); sibling.inert = true;
        }
      }
      branch = branch.parentElement;
    }
    const controls = () => Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]')).filter(element => element.getClientRects().length && !element.closest('[inert]'));
    const focusFirst = () => (panel.querySelector<HTMLElement>('[data-modal-focus]') ?? controls()[0] ?? panel).focus();
    focusFirst();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close.current(); }
      if (event.key !== 'Tab') return;
      const items = controls(); const first = items[0]; const last = items[items.length - 1];
      if (!items.length) { event.preventDefault(); panel.focus(); }
      else if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    const focusin = (event: FocusEvent) => { if (!panel.contains(event.target as Node)) focusFirst(); };
    document.addEventListener('keydown', keydown, true); document.addEventListener('focusin', focusin);
    const modal = {
      close: () => close.current(),
      release: (restoreFocus: boolean) => {
        document.removeEventListener('keydown', keydown, true); document.removeEventListener('focusin', focusin);
        inerted.forEach(([element, wasInert]) => { element.inert = wasInert; });
        if (restoreFocus && previousFocus?.isConnected && !previousFocus.closest('[inert]')) previousFocus.focus();
      },
    };
    activeModal = modal;
    notify();
    return () => { if (activeModal === modal) { activeModal = null; modal.release(true); notify(); } };
  }, [enabled, ref]);
}
