export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface RealtimeEvent {
  id: string;
  type: string;
  channel: string;
  sentAt: string;
  data: Record<string, unknown>;
}

/**
 * Opens the same-origin SSE feed. Vite proxies `/api` to the local relay while
 * developing; production should route this path to the relay at the edge.
 */
export function subscribeToRealtime(
  channel: string,
  onEvent: (event: RealtimeEvent) => void,
  onStatus: (status: RealtimeStatus) => void,
): () => void {
  const source = new EventSource(`/api/events?channel=${encodeURIComponent(channel)}`);
  onStatus('connecting');

  source.addEventListener('connected', () => onStatus('connected'));
  source.onopen = () => onStatus('connected');
  source.onerror = () => {
    // EventSource retries automatically. It remains useful to show that the
    // lobby is attempting to restore the connection rather than claiming it
    // is live while the relay is unreachable.
    onStatus(source.readyState === EventSource.CLOSED ? 'disconnected' : 'error');
  };

  source.onmessage = (message) => {
    try {
      const data = JSON.parse(message.data) as Record<string, unknown>;
      onEvent({
        id: message.lastEventId,
        type: message.type || 'message',
        channel: String(data.channel ?? channel),
        sentAt: String(data.sentAt ?? ''),
        data,
      });
    } catch {
      // Ignore malformed messages so a bad event cannot tear down the lobby.
    }
  };

  // Named SSE events do not reach onmessage, so listen for the room/lobby
  // events currently emitted by the relay as well as its generic message.
  for (const type of ['room.created', 'room.joined', 'lobby.notice']) {
    source.addEventListener(type, (message) => {
      try {
        const event = message as MessageEvent<string>;
        const data = JSON.parse(event.data) as Record<string, unknown>;
        onEvent({
          id: event.lastEventId,
          type,
          channel: String(data.channel ?? channel),
          sentAt: String(data.sentAt ?? ''),
          data,
        });
      } catch {
        // Ignore malformed messages.
      }
    });
  }

  return () => {
    source.close();
    onStatus('disconnected');
  };
}

export async function publishRealtimeEvent(
  event: string,
  data: Record<string, unknown>,
  channel = 'lobby',
): Promise<void> {
  const response = await fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel, event, data }),
  });
  if (!response.ok) throw new Error(`Realtime relay returned ${response.status}`);
}
