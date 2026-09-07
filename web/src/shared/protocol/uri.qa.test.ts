import { describe, expect, it } from "vitest";

import { makeAtUri, parseAtUri } from "./uri";

describe("AT URI helpers", () => {
  it("parses canonical record URIs", () => {
    expect(
      parseAtUri("at://did:plc:alice/app.bsky.feed.post/3kexample"),
    ).toEqual({
      did: "did:plc:alice",
      collection: "app.bsky.feed.post",
      rkey: "3kexample",
    });
  });

  it.each([
    "at://did:plc:alice",
    "at://did:plc:alice/app.bsky.feed.post",
    "at://alice.example/app.bsky.feed.post/3kexample",
    "at://did:plc:alice/app.bsky.feed.post/3kexample/extra",
    "at://did:plc:alice/app.bsky.feed.post/3kexample#fragment",
    "at://did:plc:alice/not-a-collection/3kexample",
    "at://did:plc:alice/app.bsky.feed.post/invalid key",
  ])("rejects non-canonical record URI %s", (uri) => {
    expect(() => parseAtUri(uri)).toThrow(SyntaxError);
  });

  it("constructs a canonical record URI", () => {
    expect(
      makeAtUri(
        "did:plc:alice",
        "app.bsky.feed.post",
        "3kexample",
      ),
    ).toBe("at://did:plc:alice/app.bsky.feed.post/3kexample");
  });
});
