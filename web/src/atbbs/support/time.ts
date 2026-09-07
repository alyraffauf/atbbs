/** ISO datetime branded so it is assignable to atcute's datetime types. */
export type IsoDatetime = `${number}-${number}-${number}T${string}`;

export function nowIso(): IsoDatetime {
  return new Date().toISOString() as IsoDatetime;
}
