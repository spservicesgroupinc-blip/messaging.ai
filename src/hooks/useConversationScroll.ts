import { useLayoutEffect, useRef, useState } from 'react';
import type { EnrichedMessage } from '../utils/sheetsProtocol';
const positions = new Map<string, number>();
export function useConversationScroll(key: string, messages: EnrichedMessage[]) {
  const stream = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const previous = useRef(new Set<string>());
  const initialized = useRef(false);
  const [hasNew, setHasNew] = useState(false);
  useLayoutEffect(() => {
    const node = stream.current;
    if (!node) return;
    const added = messages.some(message => !previous.current.has(message.message_id));
    if (!initialized.current) {
      node.scrollTop = positions.get(key) ?? node.scrollHeight;
      initialized.current = true;
      nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
    } else if (nearBottom.current) node.scrollTop = node.scrollHeight;
    else if (added) setHasNew(true);
    previous.current = new Set(messages.map(message => message.message_id));
  }, [key, messages]);
  return {
    stream, hasNew,
    onScroll: () => { const node = stream.current; if (!node) return; positions.set(key, node.scrollTop); nearBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80; if (nearBottom.current) setHasNew(false); },
    jump: () => { const node = stream.current; if (node) { node.scrollTop = node.scrollHeight; positions.set(key, node.scrollTop); nearBottom.current = true; setHasNew(false); } },
  };
}
