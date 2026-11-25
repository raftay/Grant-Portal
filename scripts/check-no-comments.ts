import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, extname } from "node:path";
import ts from "typescript";

type Finding = { file: string; line: number; text: string };

const listed = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" });
const tracked = listed.split("\n").filter((file) => file && existsSync(file) && !file.startsWith("documentation/"));
const findings: Finding[] = [];

function report(file: string, source: string, position: number, text: string): void {
  findings.push({ file, line: source.slice(0, position).split("\n").length, text: text.split("\n")[0]!.slice(0, 80) });
}

function checkScript(file: string, source: string): void {
  const kind = /x$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  const seen = new Set<number>();
  const visit = (node: ts.Node): void => {
    if (node.kind !== ts.SyntaxKind.JsxText) {
      const ranges = [
        ...(ts.getLeadingCommentRanges(source, node.getFullStart()) ?? []),
        ...(ts.getTrailingCommentRanges(source, node.getEnd()) ?? []),
      ];
      const insideText = node.parent && ts.isJsxText(node);
      for (const range of ranges) {
        if (insideText || seen.has(range.pos) || inJsxText(tree, range.pos)) continue;
        seen.add(range.pos);
        report(file, source, range.pos, source.slice(range.pos, range.end));
      }
    }
    node.getChildren(tree).forEach(visit);
  };
  visit(tree);
}

function inJsxText(tree: ts.SourceFile, position: number): boolean {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (position < node.getFullStart() || position >= node.getEnd()) return;
    if (node.kind === ts.SyntaxKind.JsxText) found = true;
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return found;
}

function checkPattern(file: string, source: string, quoted: RegExp, comment: RegExp): void {
  const blank = source.replace(quoted, (match) => match.replace(/[^\n]/g, " "));
  for (const match of blank.matchAll(comment)) report(file, source, match.index, source.slice(match.index, match.index + match[0].length));
}

const strings = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g;

for (const file of tracked) {
  const extension = extname(file);
  const name = basename(file);
  const read = () => readFileSync(file, "utf8");
  if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(extension)) checkScript(file, read());
  else if (extension === ".sql") checkPattern(file, read(), /'(?:[^']|'')*'/g, /--[^\n]*|\/\*[\s\S]*?\*\//g);
  else if (extension === ".css") checkPattern(file, read(), strings, /\/\*[\s\S]*?\*\//g);
  else if ([".yml", ".yaml", ".sh"].includes(extension)) checkPattern(file, read(), strings, /(?:^|(?<=\s))#(?!!)[^\n]*/gm);
  else if (name.startsWith(".env") || name === ".gitignore") checkPattern(file, read(), /(?!)/g, /^\s*#[^\n]*/gm);
  else if ([".html", ".svg"].includes(extension)) checkPattern(file, read(), /(?!)/g, /<!--[\s\S]*?-->/g);
}

if (findings.length > 0) {
  for (const { file, line, text } of findings) console.error(`${file}:${line} ${text}`);
  console.error(`${findings.length} comment(s) found outside documentation/`);
  process.exit(1);
}
console.log(`No comments in ${tracked.length} files`);
