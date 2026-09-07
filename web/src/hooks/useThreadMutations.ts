import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { Did } from "@atcute/lexicons/syntax";
import type { PostDraft } from "../components/form/ComposeForm";
import { alertOnError } from "../shared/config/alerts";
import { useAuth } from "../features/auth/auth";
import type { BBS } from "../lib/bbs";
import { BOARD, POST } from "../shared/config/lexicon";
import { myThreadsQuery } from "../lib/queries/dashboard";
import { queryClient } from "../app/queryClient";
import { REPLIES_PER_PAGE, type Reply } from "../lib/replies";
import { bbsUrl } from "../shared/config/routes";
import type { ThreadRoot } from "../lib/thread";
import {
  appendRefAndReply,
  cancelRefsRefetch,
  getRefs,
  removeRefAndReply,
  setRefs,
} from "../lib/threadCache";
import { nowIso } from "../shared/config/util";
import { makeAtUri, parseAtUri } from "../shared/protocol/uri";
import { createPost } from "../lib/discussionRecords";
import { deleteRecord, uploadAttachments } from "../shared/protocol/repository";
import type { BacklinkRef } from "../shared/protocol/backlinks";

interface ThreadMutationOptions {
  bbs: BBS;
  thread: ThreadRoot;
  handle: string;
  page: number;
  setPage: (page: number) => void;
  onReplyCreated: () => void;
}

export function useThreadMutations(options: ThreadMutationOptions) {
  const { bbs, thread, handle, page, setPage, onReplyCreated } = options;
  const { user, repo } = useAuth();
  const navigate = useNavigate();
  const threadUri = thread.uri;

  const createReply = useMutation({
    mutationFn: async (input: PostDraft & { parent: string | null }) => {
      if (!repo || !user) throw new Error("Not signed in");
      const boardUri = makeAtUri(
        bbs.identity.did as Did,
        BOARD,
        thread.boardSlug,
      );
      const attachments = await uploadAttachments(repo, input.files);
      const record = await createPost(repo, boardUri, input.body, {
        root: threadUri,
        parent: input.parent ?? undefined,
        attachments,
      });
      return { record, input, attachments };
    },
    onSuccess: ({ record, input, attachments }) => {
      if (!user) return;
      const { did, rkey } = parseAtUri(record.uri);
      const ref: BacklinkRef = { did, collection: POST, rkey };
      const reply: Reply = {
        uri: record.uri,
        did,
        rkey,
        handle: user.handle,
        pds: user.pdsUrl,
        body: input.body,
        createdAt: nowIso(),
        parent: input.parent,
        attachments: attachments as Reply["attachments"],
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
      if (!repo) throw new Error("Not signed in");
      await deleteRecord(repo, POST, reply.rkey);
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
      if (!repo) throw new Error("Not signed in");
      await deleteRecord(repo, POST, thread.rkey);
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
