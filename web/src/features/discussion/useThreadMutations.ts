import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { PostDraft } from "./components/PostComposer";
import { alertOnError } from "../../frontend/app/browser/alerts";
import { useAuth } from "../auth/auth";
import type { Community } from "../../atbbs/community/read";
import { POST } from "../../atbbs/schema/collections";
import { myThreadsQuery } from "../../frontend/features/dashboard/queries";
import { queryClient } from "../../frontend/app/queryClient";
import { REPLIES_PER_PAGE, type Reply } from "../../atbbs/discussion/replies";
import { bbsUrl } from "../../frontend/app/router/urls";
import type { Thread } from "../../atbbs/discussion/thread";
import {
  appendRefAndReply,
  cancelRefsRefetch,
  getRefs,
  removeRefAndReply,
  setRefs,
} from "../../frontend/features/discussion/cache";
import { pendingAttachmentsFromFiles } from "../../frontend/features/discussion/browser/pendingAttachment";
import type { ReplyRef } from "../../atbbs/discussion/replies";

interface ThreadMutationOptions {
  bbs: Community;
  thread: Thread;
  handle: string;
  page: number;
  setPage: (page: number) => void;
  onReplyCreated: () => void;
}

export function useThreadMutations(options: ThreadMutationOptions) {
  const { bbs, thread, handle, page, setPage, onReplyCreated } = options;
  const { user, writer } = useAuth();
  const navigate = useNavigate();
  const threadUri = thread.uri;

  const createReply = useMutation({
    mutationFn: async (input: PostDraft & { parent: string | null }) => {
      if (!writer || !user) throw new Error("Not signed in");
      const record = await writer.createReply({
        communityDid: bbs.identity.did,
        boardSlug: thread.boardSlug,
        threadUri,
        parent: input.parent ?? undefined,
        body: input.body,
        attachments: pendingAttachmentsFromFiles(input.files),
      });
      return { record, input };
    },
    onSuccess: ({ record, input }) => {
      if (!user) return;
      const { did, rkey } = record;
      const ref: ReplyRef = { did, collection: POST, rkey };
      const reply: Reply = {
        uri: record.uri,
        did,
        rkey,
        authorDid: did,
        replyRkey: rkey,
        handle: user.handle,
        pds: user.pdsUrl,
        body: input.body,
        createdAt: record.createdAt,
        parent: input.parent,
        attachments: record.attachments,
      };
      const refs = appendRefAndReply(threadUri, ref, reply);
      onReplyCreated();
      const lastPage = Math.max(1, Math.ceil(refs.length / REPLIES_PER_PAGE));
      if (page !== lastPage) setPage(lastPage);
    },
    onError: alertOnError("post reply"),
  });

  const deleteReply = useMutation({
    mutationFn: async (reply: Reply) => {
      if (!writer) throw new Error("Not signed in");
      await writer.deletePost(reply.rkey);
      return reply;
    },
    onMutate: async (reply) => {
      await cancelRefsRefetch(threadUri);
      const previousRefs = getRefs(threadUri);
      removeRefAndReply(threadUri, reply.uri);
      return { previousRefs };
    },
    onError: (error, _reply, context) => {
      if (context) setRefs(threadUri, context.previousRefs);
      alertOnError("delete")(error);
    },
  });

  const deleteThread = useMutation({
    mutationFn: async () => {
      if (!writer) throw new Error("Not signed in");
      await writer.deletePost(thread.rkey);
    },
    onSuccess: () => {
      if (user) {
        void queryClient.invalidateQueries(
          myThreadsQuery(user.pdsUrl, user.did),
        );
      }
      navigate(bbsUrl(handle));
    },
    onError: alertOnError("delete"),
  });

  return { createReply, deleteReply, deleteThread };
}
