interface PendoAgent {
  track(eventName: string, properties?: Record<string, string | number | boolean>): void;
}

declare const pendo: PendoAgent | undefined;
