const AMBER = "\x1b[38;5;208m";
const RESET = "\x1b[0m";
const LINE_WIDTH = 75;
export const LOGO = `  ${AMBER}▞▀▖${RESET}▌  ▌\r\n  ${AMBER}▌▙▌${RESET}▛▀▖▛▀▖▞▀▘\r\n  ${AMBER}▌▀ ${RESET}▌ ▌▌ ▌▝▀▖\r\n  ${AMBER}▝▀ ${RESET}▀▀ ▀▀ ▀▀\r\n`;
export function sanitizePublicText(value: unknown) {
  return [...String(value)]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 0x20 && (code < 0x7f || code > 0x9f);
    })
    .join("");
}
export function formatDatetimeUtc(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? value
    : `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
export function wrap(text: string) {
  return text
    .split("\r\n")
    .map((line) => {
      if (line.length <= LINE_WIDTH) return line;
      const indent = " ".repeat(line.length - line.trimStart().length);
      const words = line.trim().split(/\s+/);
      const output: string[] = [];
      let current = "";
      for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (current && indent.length + next.length > LINE_WIDTH) {
          output.push(indent + current);
          current = word;
        } else current = next;
      }
      if (current) output.push(indent + current);
      return output.join("\r\n");
    })
    .join("\r\n");
}
type Bbs = {
  site: {
    name: string;
    description: string;
    intro: string;
    boards: { name: string; description: string }[];
  };
  news: { title: string; body: string; createdAt: string }[];
  moderationStale: boolean;
};
const lines = (body: string) =>
  body
    .split(/\r?\n/)
    .map((line) => `    ${sanitizePublicText(line)}\r\n`)
    .join("");
export function welcome() {
  return `\r\n${LOGO}\r\n  This is a read-only telnet gateway for AT Protocol BBSes.\r\n  Please dial a BBS.\r\n\r\n`;
}
export function bbs(view: Bbs) {
  let output = `\r\n  ${sanitizePublicText(view.site.name)}\r\n  ${sanitizePublicText(view.site.description)}\r\n`;
  if (view.moderationStale)
    output += "  Warning: using cached moderation data.\r\n";
  if (view.site.intro) output += `\r\n${lines(view.site.intro)}`;
  output += "\r\n";
  if (view.site.boards.length)
    output += `  Boards\r\n${view.site.boards.map((board, index) => `    ${index + 1}. ${sanitizePublicText(board.name)}: ${sanitizePublicText(board.description)}\r\n`).join("")}\r\n`;
  if (view.news.length)
    output += `  Latest News: ${sanitizePublicText(view.news[0].title)}\r\n\r\n`;
  return output + "[#] open board  [n] news  [q] quit\r\n";
}
export function board(
  view: { name: string; description: string },
  threads: {
    title: string;
    handle: string;
    createdAt: string;
    lastActivityAt: string;
  }[],
  next: boolean,
) {
  const entries = threads.length
    ? threads
        .map(
          (thread, index) =>
            `  ${index + 1}. ${sanitizePublicText(thread.title)}  ·  ${sanitizePublicText(thread.handle)}  ·  ${formatDatetimeUtc(thread.lastActivityAt || thread.createdAt)}\r\n`,
        )
        .join("")
    : "  No threads yet.\r\n";
  return `\r\n  ${sanitizePublicText(view.name)}\r\n  ${sanitizePublicText(view.description)}\r\n\r\n${entries}\r\n${["[#] open thread", ...(next ? ["[n] next"] : []), "[b] back", "[q] quit"].join("  ")}\r\n`;
}
export function threadHeader(view: {
  title: string;
  handle: string;
  body: string;
  createdAt: string;
}) {
  return `\r\n  ${sanitizePublicText(view.title)}\r\n  by ${sanitizePublicText(view.handle)}  ·  ${formatDatetimeUtc(view.createdAt)}\r\n\r\n${lines(view.body)}\r\n`;
}
export function replies(
  items: { handle: string; body: string; createdAt: string }[],
) {
  return items
    .map(
      (item) =>
        `  ${sanitizePublicText(item.handle)}  ·  ${formatDatetimeUtc(item.createdAt)}\r\n${lines(item.body)}\r\n`,
    )
    .join("");
}
export function threadPrompt(more: boolean) {
  return `${["[b] back", ...(more ? ["[n] show more"] : []), "[q] quit"].join("  ")}\r\n`;
}
export function news(
  items: { title: string; body: string; createdAt: string }[],
) {
  return `\r\n  News:\r\n\r\n${items.map((item) => `  ${sanitizePublicText(item.title)}  ·  ${formatDatetimeUtc(item.createdAt)}\r\n${lines(item.body)}\r\n`).join("")}[b] back  [q] quit\r\n`;
}
