import { describe, expect, it } from "vitest";
import {
  createScanner,
  LanguageVariant,
  SyntaxKind,
  type Scanner,
} from "typescript/unstable/ast";

const modules = import.meta.glob("./src/**/*.{ts,tsx}", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

const productionModules = Object.entries(modules).filter(
  ([path]) => !path.endsWith(".test.ts") && !path.endsWith(".test.tsx"),
);

const browserGlobals = new Set([
  "Blob",
  "File",
  "OffscreenCanvas",
  "createImageBitmap",
  "document",
  "localStorage",
  "window",
]);

function normalizePath(path: string): string {
  const segments: string[] = [];
  for (const segment of path.split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") segments.pop();
    else segments.push(segment);
  }
  return `/${segments.join("/")}`;
}

function resolveImport(sourcePath: string, specifier: string): string | undefined {
  if (!specifier.startsWith(".")) return undefined;
  const sourceDirectory = sourcePath.slice(0, sourcePath.lastIndexOf("/"));
  return normalizePath(`${sourceDirectory}/${specifier}`);
}

interface Token {
  kind: SyntaxKind;
  value: string;
}

function scan(source: string): Token[] {
  const scanner: Scanner = createScanner(true, LanguageVariant.Standard, source);
  const tokens: Token[] = [];
  let kind = scanner.scan();
  while (kind !== SyntaxKind.EndOfFile) {
    tokens.push({ kind, value: scanner.getTokenValue() });
    kind = scanner.scan();
  }
  return tokens;
}

function importedSpecifiers(tokens: Token[]): string[] {
  const specifiers: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (
      token.kind !== SyntaxKind.ImportKeyword &&
      token.kind !== SyntaxKind.ExportKeyword
    ) {
      continue;
    }

    for (let next = index + 1; next < tokens.length; next += 1) {
      const candidate = tokens[next];
      if (candidate.kind === SyntaxKind.StringLiteral) {
        specifiers.push(candidate.value);
        break;
      }
      if (
        candidate.kind === SyntaxKind.SemicolonToken ||
        candidate.kind === SyntaxKind.ImportKeyword ||
        candidate.kind === SyntaxKind.ExportKeyword
      ) {
        break;
      }
    }
  }
  return specifiers;
}

function inspectModules(): string[] {
  const violations: string[] = [];

  for (const [relativePath, source] of productionModules) {
    const path = normalizePath(relativePath);
    const tokens = scan(source);
    const imports = importedSpecifiers(tokens);

    for (const specifier of imports) {
      const target = resolveImport(path, specifier);
      const label = `${path} imports ${specifier}`;
      const importsUiDependency =
        specifier === "react" ||
        specifier.startsWith("react/") ||
        specifier.startsWith("@tanstack/") ||
        specifier.startsWith("react-router");

      if (path.startsWith("/src/atproto/")) {
        if (
          target?.startsWith("/src/atbbs/") ||
          target?.startsWith("/src/frontend/") ||
          target?.startsWith("/src/lexicons/") ||
          importsUiDependency
        ) {
          violations.push(label);
        }
      }

      if (path.startsWith("/src/atbbs/")) {
        if (target?.startsWith("/src/frontend/") || importsUiDependency) {
          violations.push(label);
        }
      }

      if (path.startsWith("/src/frontend/")) {
        if (
          target?.startsWith("/src/atproto/") ||
          target?.startsWith("/src/lexicons/") ||
          target?.endsWith("/atproto/repository") ||
          target?.endsWith("/atproto/uri")
        ) {
          violations.push(label);
        }
      }

      if (path.startsWith("/src/frontend/ui/")) {
        if (
          target?.startsWith("/src/atbbs/") ||
          target?.startsWith("/src/atproto/") ||
          target?.includes("/frontend/features/") ||
          /(^|\/)queries(?:\.|\/|$)/.test(specifier)
        ) {
          violations.push(label);
        }
      }

      if (
        specifier === "@atcute/oauth-browser-client" &&
        path !== "/src/frontend/features/auth/auth.ts"
      ) {
        violations.push(`${label} outside the auth implementation`);
      }

      if (/(^|\/)(shared|common|utils)(\/|$)/.test(specifier)) {
        violations.push(`${label} through a broad catch-all module`);
      }
    }

    if (path.startsWith("/src/atbbs/")) {
      if (path.endsWith(".tsx")) violations.push(`${path} contains JSX`);
      for (const token of tokens) {
        if (
          token.kind === SyntaxKind.Identifier &&
          browserGlobals.has(token.value)
        ) {
          violations.push(`${path} uses browser global ${token.value}`);
        }
      }
    }

    if (/(^|\/)(shared|common|utils)(\/|$)/.test(path)) {
      violations.push(`${path} is in a broad catch-all directory`);
    }
  }

  return [...new Set(violations)].sort();
}

describe("three-tier architecture", () => {
  it("keeps imports and browser APIs inside their owning layer", () => {
    expect(inspectModules()).toEqual([]);
  });
});
