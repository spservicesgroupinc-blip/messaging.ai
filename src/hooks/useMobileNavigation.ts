import { useCallback, useEffect, useState } from 'react';
export type MobileTab = 'channels' | 'dms' | 'people';
interface MobileRoute { tab: MobileTab; conversation: string | null }
const ROOT: MobileRoute = { tab: 'channels', conversation: null };
function readRoute(): MobileRoute { return history.state?.relayMobile ?? ROOT; }
export function useMobileNavigation(onConversation: (id: string) => void, closeOverlay: () => void) {
  const [route, setRoute] = useState<MobileRoute>(readRoute);
  useEffect(() => {
    if (!history.state?.relayMobile) history.replaceState({ ...history.state, relayMobile: ROOT }, '');
    const pop = () => { const next = readRoute(); closeOverlay(); setRoute(next); if (next.conversation) onConversation(next.conversation); };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, [onConversation, closeOverlay]);
  const navigate = useCallback((next: MobileRoute) => {
    const state = { ...history.state, relayMobile: next };
    delete state.relayOverlay;
    if (history.state?.relayOverlay) history.replaceState(state, ''); else history.pushState(state, '');
    setRoute(next); closeOverlay();
  }, [closeOverlay]);
  return {
    ...route,
    showTab: (tab: MobileTab) => navigate({ tab, conversation: null }),
    open: (id: string, tab: MobileTab) => navigate({ tab, conversation: id }),
    back: () => { if (history.state?.relayMobile?.conversation) history.back(); else navigate({ tab: route.tab, conversation: null }); },
    reset: () => { history.replaceState({ relayMobile: ROOT }, ''); setRoute(ROOT); },
  };
}
