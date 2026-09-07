// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import PostActions from "./PostActions";
import PostMeta from "./PostMeta";

describe("post controls", () => {
  it("renders the author as a router link", () => {
    render(
      <MemoryRouter>
        <PostMeta handle="alice.example" createdAt="2026-01-01T00:00:00Z" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "alice.example" })).toHaveAttribute(
      "href",
      "/profile/alice.example",
    );
  });

  it("uses a disclosure and closes it after selecting an action", () => {
    const onDelete = vi.fn();
    render(<PostActions actions={[{ kind: "delete", onSelect: onDelete }]} />);
    const disclosure = screen.getByText("delete").closest("details")!;
    const summary = screen.getByLabelText("Post actions");

    fireEvent.click(summary);
    expect(disclosure).toHaveAttribute("open");
    fireEvent.click(screen.getByRole("button", { name: /delete/ }));
    expect(onDelete).toHaveBeenCalledOnce();
    expect(disclosure).not.toHaveAttribute("open");
  });
});
