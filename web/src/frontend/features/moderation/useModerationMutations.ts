import { useMutation } from "@tanstack/react-query";
import { useAuth } from "../auth/auth";
import { resolveIdentity } from "../../../atproto/identity";
import { alertOnError } from "../../app/browser/alerts";
import { invalidateAllCommunityCaches } from "../../features/community/cache";

// Shared ban/unban/hide/unhide mutations
// `ban` accepts either a DID or a handle
export function useModerationMutations() {
  const { writer } = useAuth();

  const ban = useMutation({
    mutationFn: async (identifier: string) => {
      if (!writer) throw new Error("Not signed in");
      const did = identifier.startsWith("did:")
        ? identifier
        : (await resolveIdentity(identifier)).did;
      await writer.banActor(did);
    },
    onSuccess: invalidateAllCommunityCaches,
    onError: alertOnError("ban"),
  });

  const unban = useMutation({
    mutationFn: async (rkeys: string[]) => {
      if (!writer) throw new Error("Not signed in");
      await Promise.all(rkeys.map((rkey) => writer.unbanActor(rkey)));
    },
    onSuccess: invalidateAllCommunityCaches,
    onError: alertOnError("unban"),
  });

  const hide = useMutation({
    mutationFn: async (uri: string) => {
      if (!writer) throw new Error("Not signed in");
      await writer.hidePost(uri);
    },
    onSuccess: invalidateAllCommunityCaches,
    onError: alertOnError("hide"),
  });

  const unhide = useMutation({
    mutationFn: async (rkeys: string[]) => {
      if (!writer) throw new Error("Not signed in");
      await Promise.all(rkeys.map((rkey) => writer.unhidePost(rkey)));
    },
    onSuccess: invalidateAllCommunityCaches,
    onError: alertOnError("unhide"),
  });

  return { ban, unban, hide, unhide };
}
