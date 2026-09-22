export interface ContextRequestTicket {
  contextKey: string;
  contextGeneration: number;
  requestGeneration: number;
  channel: string;
}

export interface ContextBoundValue<T> {
  contextKey: string | null;
  value: T;
}

/** Coordinates async work whose result is private to the active authenticated context. */
export class ContextRequestGuard {
  private contextKey: string | null = null;
  private contextGeneration = 0;
  private requestGenerations = new Map<string, number>();

  setContext(contextKey: string | null): void {
    if (contextKey !== this.contextKey) {
      this.contextKey = contextKey;
      this.contextGeneration += 1;
      this.requestGenerations.clear();
    }
  }

  begin(contextKey: string, channel = 'default'): ContextRequestTicket {
    const currentRequestGeneration = this.requestGenerations.get(channel) ?? 0;
    const requestGeneration = contextKey === this.contextKey
      ? currentRequestGeneration + 1
      : currentRequestGeneration;
    if (contextKey === this.contextKey) {
      this.requestGenerations.set(channel, requestGeneration);
    }
    return { contextKey, contextGeneration: this.contextGeneration, requestGeneration, channel };
  }

  isCurrent(ticket: ContextRequestTicket): boolean {
    return ticket.contextKey === this.contextKey
      && ticket.contextGeneration === this.contextGeneration
      && ticket.requestGeneration === this.requestGenerations.get(ticket.channel);
  }
}

export function sellerContextKey(
  context: { role: 'seller'; userId: string; gicId: string } | null,
): string | null {
  return context ? `${context.role}:${context.userId}:${context.gicId}` : null;
}

export function valueForContext<T>(
  state: ContextBoundValue<T>,
  currentContextKey: string | null,
  hiddenValue: T,
): T {
  return currentContextKey !== null && state.contextKey === currentContextKey
    ? state.value
    : hiddenValue;
}
