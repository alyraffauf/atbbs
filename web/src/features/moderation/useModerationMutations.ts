import { useMutation } from "@tanstack/react-query";
import { useAuth } from "../auth/auth";
import { resolveIdentity } from "../../atproto/identity";
import {
  createBan,
  createHide,
  deleteBan,
  deleteHide,
} from "./data/moderationRecords";
import { alertOnError } from "../../frontend/app/browser/alerts";

// Shared ban/unban/hide/unhide mutations
// `ban` accepts either a DID or a handle
export function useModerationMutations() {
  const { repo } = useAuth();

  const ban = useMutation({
    mutationFn: async (identifier: string) => {
      if (!repo) throw new Error("Not signed in");
      const did = identifier.startsWith("did:")
        ? identifier
        : (await resolveIdentity(identifier)).did;
      await createBan(repo, did);
    },
    onError: alertOnError("ban"),
  });

  const unban = useMutation({
    mutationFn: async (rkeys: string[]) => {
      if (!repo) throw new Error("Not signed in");
      await Promise.all(rkeys.map((rkey) => deleteBan(repo, rkey)));
    },
    onError: alertOnError("unban"),
  });

  const hide = useMutation({
    mutationFn: async (uri: string) => {
      if (!repo) throw new Error("Not signed in");
      await createHide(repo, uri);
    },
    onError: alertOnError("hide"),
  });

  const unhide = useMutation({
    mutationFn: async (rkeys: string[]) => {
      if (!repo) throw new Error("Not signed in");
      await Promise.all(rkeys.map((rkey) => deleteHide(repo, rkey)));
    },
    onError: alertOnError("unhide"),
  });

  return { ban, unban, hide, unhide };
}
