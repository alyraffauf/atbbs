// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CommunityEditor, { type CommunityDraft } from "./CommunityEditor";

const draft: CommunityDraft = {
  name: "Community",
  description: "Description",
  intro: "Welcome",
  boards: [{ slug: "general", name: "General", description: "Chat" }],
};

afterEach(cleanup);

function submit() {
  fireEvent.submit(
    screen.getByRole("button", { name: "save" }).closest("form")!,
  );
}

describe("CommunityEditor", () => {
  it("shows initial values and submits a normalized draft", async () => {
    const onSave = vi.fn(async () => {});
    render(
      <CommunityEditor
        initialDraft={draft}
        submitLabel="save"
        failureMessage="Save failed."
        onSave={onSave}
      />,
    );
    expect(screen.getByDisplayValue("Community")).toBeInTheDocument();

    fireEvent.change(document.querySelector('input[name="name"]')!, {
      target: { value: "  New name  " },
    });
    fireEvent.change(screen.getByPlaceholderText("slug"), {
      target: { value: "  updates  " },
    });
    fireEvent.change(screen.getByPlaceholderText("Name"), {
      target: { value: "   " },
    });
    submit();

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        name: "New name",
        description: "Description",
        intro: "Welcome",
        boards: [{ slug: "updates", name: "updates", description: "Chat" }],
      }),
    );
  });

  it("validates required content before saving", () => {
    const onSave = vi.fn(async () => {});
    render(
      <CommunityEditor
        initialDraft={{ ...draft, name: " ", boards: [] }}
        submitLabel="save"
        failureMessage="Save failed."
        onSave={onSave}
      />,
    );
    submit();
    expect(
      screen.getByText("Name and at least one board are required."),
    ).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("blocks duplicate submissions while a save is pending", async () => {
    let finishSave!: () => void;
    const onSave = vi.fn(
      () => new Promise<void>((resolve) => (finishSave = resolve)),
    );
    render(
      <CommunityEditor
        initialDraft={draft}
        submitLabel="save"
        failureMessage="Save failed."
        onSave={onSave}
      />,
    );
    submit();
    submit();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "save" })).toBeDisabled();
    finishSave();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "save" })).toBeEnabled(),
    );
  });

  it("shows the supplied failure message after a rejected save", async () => {
    render(
      <CommunityEditor
        initialDraft={draft}
        submitLabel="save"
        failureMessage="Save failed."
        onSave={() => Promise.reject(new Error("network"))}
      />,
    );
    submit();
    expect(await screen.findByText("Save failed.")).toBeInTheDocument();
  });
});
