import { describe, expect, it } from "vitest";

import { isSiteRecord } from "./recordGuards";
import { MAX_BOARDS } from "../shared/config/limits";

function siteRecord(boardCount: number) {
  return {
    uri: "at://did:plc:test/xyz.atbbs.site/self",
    cid: "cid",
    value: {
      $type: "xyz.atbbs.site",
      name: "Test",
      description: "",
      intro: "",
      createdAt: "2026-01-01T00:00:00Z",
      boards: Array.from(
        { length: boardCount },
        (_, index) => `at://did:plc:test/xyz.atbbs.board/board-${index}`,
      ),
    },
  };
}

describe("site board limit", () => {
  it("accepts 50 boards", () => {
    expect(isSiteRecord(siteRecord(MAX_BOARDS))).toBe(true);
  });

  it("rejects 51 boards", () => {
    expect(isSiteRecord(siteRecord(MAX_BOARDS + 1))).toBe(false);
  });
});
