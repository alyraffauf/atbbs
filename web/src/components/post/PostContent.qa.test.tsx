// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import PostContent from "./PostContent";

const attachments = [
  { file: { ref: { $link: "first-cid" } }, name: "first.txt" },
  { file: { ref: { $link: "second-cid" } }, name: "second.txt" },
];

afterEach(cleanup);

describe("PostContent", () => {
  it("renders embedded attachments without duplicating their links", () => {
    render(
      <PostContent
        body="[first](attachment:first.txt)"
        attachments={attachments}
        pds="https://pds.example"
        did="did:plc:author"
      />,
    );
    expect(screen.getAllByText("first.txt")).toHaveLength(1);
  });

  it("renders attachments that are not embedded in the body", () => {
    const { container } = render(
      <PostContent
        body="Body"
        attachments={attachments}
        pds="https://pds.example"
        did="did:plc:author"
        attachmentListClassName="attachment-list"
      />,
    );
    expect(screen.getByText("first.txt")).toBeInTheDocument();
    expect(screen.getByText("second.txt")).toBeInTheDocument();
    expect(container.querySelector(".attachment-list")).toBeInTheDocument();
  });

  it("renders only the body when there are no attachments", () => {
    const { container } = render(
      <PostContent
        body="Just text"
        pds="https://pds.example"
        did="did:plc:author"
      />,
    );
    expect(screen.getByText("Just text")).toBeInTheDocument();
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });
});
