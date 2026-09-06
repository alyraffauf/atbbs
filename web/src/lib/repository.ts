import type { Client } from "@atcute/client";

export interface AuthenticatedRepo {
  client: Client;
  did: `did:${string}:${string}`;
}
