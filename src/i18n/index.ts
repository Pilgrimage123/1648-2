/**
 * React bindings for the locale runtime. Core and the store import `./runtime`
 * so headless modules do not pull in React.
 */
import { useSyncExternalStore } from "react";
import {
  getLocale,
  subscribeLocale,
  text,
  type MessageId,
  type MessageParams,
} from "./runtime";

export * from "./runtime";

export function useLocale() {
  return useSyncExternalStore(subscribeLocale, getLocale, getLocale);
}

export function useT(): (id: MessageId, params?: MessageParams) => string {
  const locale = useLocale();
  return (id, params) => text(id, params, locale);
}
