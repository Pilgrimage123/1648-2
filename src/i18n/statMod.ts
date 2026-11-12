import type { StatModifier } from "../core/types";
import { phrase } from "./phrase";
import type { MessageId } from "./phrase";
import type { MeasureUnit, MessageParams } from "./types";

/** Shot and melee math row. The label is a phrase, so a language switch redraws it. */
export function statMod(
  id: string,
  label: MessageId,
  value: number,
  unit: MeasureUnit,
  kind: StatModifier["kind"],
  opts?: { detail?: MessageId; params?: MessageParams },
): StatModifier {
  return {
    id,
    label: phrase(label, opts?.params),
    detail: opts?.detail ? phrase(opts.detail, opts.params) : undefined,
    value,
    unit,
    kind,
  };
}
