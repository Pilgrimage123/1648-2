import type { MessageId as CatalogId } from "./cs-messages";
import type { UiMessageId } from "./cs-ui";
import type { MessageParams } from "./types";

/** Every key a locale pack must implement: simulation catalog plus HUD extras. */
export type MessageId = CatalogId | UiMessageId;

/**
 * Language-neutral sentence. `id` selects the template. `params` are facts
 * (unit ids, numbers, flags). A locale pack declines and pluralizes them.
 */
export interface Phrase {
  id: MessageId;
  params?: MessageParams;
}

export function phrase(id: MessageId, params?: MessageParams): Phrase {
  return params ? { id, params } : { id };
}
