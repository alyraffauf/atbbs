import { describe, expect, it } from "vitest";

import { parseClientMetadata } from "./auth";

const metadata = {
  client_id: "https://bbs.example/client-metadata.json",
  client_name: "atbbs",
  client_uri: "https://bbs.example",
  redirect_uris: ["https://bbs.example/oauth/callback"],
  scope: "atproto repo:xyz.atbbs.post",
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
  token_endpoint_auth_method: "none",
  application_type: "web",
  dpop_bound_access_tokens: true,
};

describe("OAuth client metadata", () => {
  it("derives the OAuth settings from valid metadata", () => {
    expect(parseClientMetadata(metadata)).toEqual({
      clientId: metadata.client_id,
      redirectUri: metadata.redirect_uris[0],
      scope: metadata.scope,
    });
  });

  it.each([
    ["missing redirect", { ...metadata, redirect_uris: [] }],
    [
      "multiple redirects",
      { ...metadata, redirect_uris: ["https://one", "https://two"] },
    ],
    ["missing DPoP", { ...metadata, dpop_bound_access_tokens: false }],
    ["incomplete grants", { ...metadata, grant_types: ["authorization_code"] }],
  ])("rejects %s", (_label, value) => {
    expect(() => parseClientMetadata(value)).toThrow(
      "OAuth client metadata is invalid.",
    );
  });

  it("rejects malformed metadata URLs", () => {
    expect(() =>
      parseClientMetadata({ ...metadata, client_uri: "not a URL" }),
    ).toThrow("OAuth client metadata contains an invalid URL.");
  });
});
