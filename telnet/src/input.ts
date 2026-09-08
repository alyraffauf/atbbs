const IAC = 0xff;
const SB = 0xfa;
const SE = 0xf0;
const NEGOTIATION = new Set([0xfb, 0xfc, 0xfd, 0xfe]);
const MAX_LINE_BYTES = 256;

type State = "text" | "iac" | "option" | "sub" | "sub-iac";

/** Turns fragmented Telnet streams into bounded, printable command lines. */
export class TelnetInputParser {
  private state: State = "text";
  private bytes: number[] = [];
  private discarding = false;
  private skipLineFeed = false;

  push(chunk: Buffer): string[] {
    const lines: string[] = [];
    for (const byte of chunk) this.consume(byte, lines);
    return lines;
  }

  private consume(byte: number, lines: string[]) {
    if (this.state === "iac") {
      if (byte === IAC) this.append(byte);
      else if (NEGOTIATION.has(byte)) this.state = "option";
      else if (byte === SB) this.state = "sub";
      else this.state = "text";
      if (this.state === "iac") this.state = "text";
      return;
    }
    if (this.state === "option") {
      this.state = "text";
      return;
    }
    if (this.state === "sub") {
      if (byte === IAC) this.state = "sub-iac";
      return;
    }
    if (this.state === "sub-iac") {
      this.state = byte === SE ? "text" : "sub";
      return;
    }
    if (byte === IAC) {
      this.state = "iac";
      return;
    }
    if (byte === 13 || byte === 10) {
      if (byte === 10 && this.skipLineFeed) {
        this.skipLineFeed = false;
        return;
      }
      this.skipLineFeed = byte === 13;
      if (!this.discarding)
        lines.push(
          String.fromCharCode(...this.bytes)
            .replace(/[^ -~]/g, "")
            .trim(),
        );
      this.bytes = [];
      this.discarding = false;
      return;
    }
    this.skipLineFeed = false;
    this.append(byte);
  }

  private append(byte: number) {
    if (this.bytes.length < MAX_LINE_BYTES && !this.discarding)
      this.bytes.push(byte);
    else this.discarding = true;
  }
}
