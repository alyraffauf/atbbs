import { isCanonicalResourceUri } from "@atcute/lexicons/syntax";

export function isValidPostUri(value: string): boolean {
  return isCanonicalResourceUri(value);
}
