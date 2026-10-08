// Client-side Pendo Track Events. The Pendo agent exposes a global `pendo` once
// its install snippet has loaded; until then (or when it's blocked) tracking is a
// silent no-op, and a tracking failure never interrupts the upload → enrich →
// export flow.

// Track types registered in Pendo — each name must be sent exactly as written.
export type TrackEventName =
  | 'csv_file_uploaded'
  | 'csv_upload_failed'
  | 'data_enrichment_completed'
  | 'data_enrichment_failed'
  | 'ai_device_classification_completed'
  | 'enriched_data_exported';

// Flat values only. Properties that are `undefined` are left out of the event.
export type TrackProperties = Record<string, string | number | boolean | undefined>;

interface PendoAgent {
  track: (eventName: string, properties?: TrackProperties) => void;
}

export function trackEvent(eventName: TrackEventName, properties: TrackProperties): void {
  try {
    const pendo = (window as Window & { pendo?: PendoAgent }).pendo;
    if (!pendo) return;
    pendo.track(
      eventName,
      Object.fromEntries(Object.entries(properties).filter(([, value]) => value !== undefined)),
    );
  } catch {
    // Analytics must never break the app.
  }
}
