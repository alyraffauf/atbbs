// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import PostContent from "./PostContent";

const attachments = [
  {
    name: "first.txt",
    downloadUrl: "https://pds.example/blob/first-cid",
    imageUrl: "https://cdn.example/image/first-cid",
  },
  { name: "second.txt", downloadUrl: "https://pds.example/blob/second-cid" },
];

afterEach(cleanup);

describe("PostContent", () => {
  it("renders embedded attachments without duplicating their links", () => {
    render(
      <PostContent
        body="[first](attachment:first.txt)"
        attachments={attachments}
      />,
    );
    expect(screen.getAllByText("first.txt")).toHaveLength(1);
  });

  it("uses prepared image and download URLs for embedded images", () => {
    render(
      <PostContent
        body="![first](attachment:first.txt)"
        attachments={attachments}
      />,
    );
    expect(screen.getByRole("img", { name: "first" })).toHaveAttribute(
      "src",
      "https://cdn.example/image/first-cid",
    );
    expect(
      screen.getByRole("img", { name: "first" }).closest("a"),
    ).toHaveAttribute("href", "https://pds.example/blob/first-cid");
  });
});
