import type { Socket } from "node:net";
import { TelnetInputParser } from "./input.js";
import { TelnetLoader } from "./loader.js";
import * as render from "./renderer.js";

const PROMPT_TIMEOUT_MS = 120_000;
type ReplyPage = Awaited<ReturnType<TelnetLoader["loadReplies"]>>;

export async function runSession(socket: Socket, loader: TelnetLoader) {
  const controller = new AbortController();
  socket.once("close", () => controller.abort());
  const input = new SocketInput(socket);
  const write = async (text: string) => {
    if (socket.destroyed || socket.write(render.wrap(text))) return;
    await waitForDrain(socket);
  };
  await write(render.welcome());
  await write("handle> ");
  const handle = await input.nextLine(PROMPT_TIMEOUT_MS);
  if (!handle) return;
  let bbs: Awaited<ReturnType<TelnetLoader["loadBbs"]>>;
  try {
    bbs = await loader.loadBbs(handle, controller.signal);
  } catch {
    await write("  Could not reach that BBS.\r\n");
    return;
  }
  let state: "bbs" | "board" | "news" | "thread" = "bbs";
  let boardIndex = 0;
  let threads: Awaited<ReturnType<TelnetLoader["loadThreads"]>>["threads"] = [];
  let cursor: string | null = null;
  let selectedThread: (typeof threads)[number] | undefined;
  let replyPage: ReplyPage | undefined;
  while (!controller.signal.aborted) {
    if (state === "bbs")
      await write(
        render.bbs({
          site: bbs.community.site,
          news: bbs.news,
          moderationStale: bbs.moderationStale,
        }),
      );
    if (state === "board")
      await write(
        render.board(
          bbs.community.site.boards[boardIndex],
          threads,
          cursor !== null,
        ),
      );
    if (state === "news") await write(render.news(bbs.news));
    if (state === "thread" && replyPage)
      await write(
        render.threadPrompt(replyPage.page + 1 < replyPage.totalPages),
      );
    await write("> ");
    const command = await input.nextLine(PROMPT_TIMEOUT_MS);
    if (command === null) {
      await write("\r\n  Connection inactive.\r\n");
      return;
    }
    if (!command || command === "q") break;
    if (state === "bbs") {
      if (command === "n" && bbs.news.length) state = "news";
      else if (/^\d+$/.test(command)) {
        const index = Number(command) - 1;
        if (index >= 0 && index < bbs.community.site.boards.length) {
          boardIndex = index;
          try {
            const page = await loader.loadThreads(
              bbs,
              bbs.community.site.boards[index].slug,
              null,
              controller.signal,
            );
            threads = page.threads;
            cursor = page.cursor;
            state = "board";
          } catch {
            await write("  Could not load threads.\r\n");
          }
        }
      }
    } else if (state === "board") {
      if (command === "b") state = "bbs";
      else if (command === "n" && cursor) {
        try {
          const page = await loader.loadThreads(
            bbs,
            bbs.community.site.boards[boardIndex].slug,
            cursor,
            controller.signal,
          );
          threads = page.threads;
          cursor = page.cursor;
        } catch {
          await write("  Could not load threads.\r\n");
        }
      } else if (/^\d+$/.test(command)) {
        const thread = threads[Number(command) - 1];
        if (thread) {
          selectedThread = thread;
          await write(
            render.threadHeader({ ...thread, handle: thread.handle }),
          );
          try {
            replyPage = await loader.loadReplies(
              bbs,
              thread.uri,
              0,
              undefined,
              controller.signal,
            );
            await write(render.replies(replyPage.replies));
            state = "thread";
          } catch {
            await write("  Could not load replies.\r\n");
          }
        }
      }
    } else if (state === "thread" && selectedThread && replyPage) {
      if (command === "b") state = "board";
      else if (command === "n" && replyPage.page + 1 < replyPage.totalPages) {
        try {
          replyPage = await loader.loadReplies(
            bbs,
            selectedThread.uri,
            replyPage.page + 1,
            replyPage.refs,
            controller.signal,
          );
          await write(render.replies(replyPage.replies));
        } catch {
          await write("  Could not load replies.\r\n");
        }
      }
    } else if (state === "news" && command === "b") state = "bbs";
  }
  await write("\r\n  Goodbye!\r\n");
}

function waitForDrain(socket: Socket): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      socket.off("drain", finish);
      socket.off("close", finish);
      socket.off("error", finish);
      resolve();
    };
    socket.once("drain", finish);
    socket.once("close", finish);
    socket.once("error", finish);
  });
}

class SocketInput {
  private static readonly MAX_QUEUED_LINES = 16;
  private readonly parser = new TelnetInputParser();
  private readonly lines: string[] = [];
  private readonly waiters: ((line: string | null) => void)[] = [];
  private closed = false;
  constructor(socket: Socket) {
    socket.on("data", (chunk: Buffer) => {
      for (const line of this.parser.push(chunk)) this.add(line);
    });
    socket.once("close", () => this.close());
    socket.once("error", () => this.close());
  }
  nextLine(timeoutMs: number): Promise<string | null> {
    if (this.lines.length) return Promise.resolve(this.lines.shift() ?? null);
    if (this.closed) return Promise.resolve(null);
    return new Promise((resolve) => {
      const finish = (line: string | null) => {
        clearTimeout(timer);
        resolve(line);
      };
      const timer = setTimeout(() => {
        this.waiters.splice(this.waiters.indexOf(finish), 1);
        finish(null);
      }, timeoutMs);
      this.waiters.push(finish);
    });
  }
  private add(line: string) {
    const waiter = this.waiters.shift();
    if (waiter) waiter(line);
    else if (this.lines.length < SocketInput.MAX_QUEUED_LINES)
      this.lines.push(line);
  }
  private close() {
    this.closed = true;
    for (const waiter of this.waiters.splice(0)) waiter(null);
  }
}
