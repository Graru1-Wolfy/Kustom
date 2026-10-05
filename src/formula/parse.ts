export type Ast =
  | { type: "num"; value: number }
  | { type: "str"; value: string }
  | { type: "ident"; name: string }
  | { type: "un"; op: string; expr: Ast }
  | { type: "bin"; op: string; left: Ast; right: Ast }
  | { type: "call"; name: string; args: Ast[] };

class Parser {
  i = 0;
  constructor(readonly s: string) {}

  skip() {
    while (this.i < this.s.length && /\s/.test(this.s[this.i]!)) this.i++;
  }

  peek(token: string): boolean {
    this.skip();
    return this.s.startsWith(token, this.i);
  }

  consume(token: string): boolean {
    if (!this.peek(token)) return false;
    this.i += token.length;
    return true;
  }

  expect(token: string) {
    if (!this.consume(token)) {
      throw new Error(`Expected "${token}" at ${this.i} in "${this.s}"`);
    }
  }

  parse(): Ast {
    const ast = this.parseOr();
    this.skip();
    if (this.i < this.s.length) {
      throw new Error(`Unexpected "${this.s.slice(this.i, this.i + 12)}" in "${this.s}"`);
    }
    return ast;
  }

  parseOr(): Ast {
    let left = this.parseAnd();
    while (this.consume("|")) left = { type: "bin", op: "|", left, right: this.parseAnd() };
    return left;
  }

  parseAnd(): Ast {
    let left = this.parseComp();
    while (this.consume("&")) left = { type: "bin", op: "&", left, right: this.parseComp() };
    return left;
  }

  parseComp(): Ast {
    let left = this.parseAdd();
    const ops = ["!=", ">=", "<=", "~=", "=", ">", "<"] as const;
    for (;;) {
      const op = ops.find((item) => this.peek(item));
      if (!op) break;
      this.consume(op);
      left = { type: "bin", op, left, right: this.parseAdd() };
    }
    return left;
  }

  parseAdd(): Ast {
    let left = this.parseMul();
    while (this.peek("+") || (this.peek("-") && !this.peek("->"))) {
      const op = this.consume("+") ? "+" : (this.consume("-"), "-");
      left = { type: "bin", op, left, right: this.parseMul() };
    }
    return left;
  }

  parseMul(): Ast {
    let left = this.parseUnary();
    while (this.peek("*") || this.peek("/") || this.peek("%")) {
      const op = this.consume("*") ? "*" : this.consume("/") ? "/" : (this.consume("%"), "%");
      left = { type: "bin", op, left, right: this.parseUnary() };
    }
    return left;
  }

  parseUnary(): Ast {
    if (this.consume("-")) return { type: "un", op: "-", expr: this.parseUnary() };
    if (this.consume("!")) return { type: "un", op: "!", expr: this.parseUnary() };
    if (this.peek("~") && !this.peek("~=")) {
      this.consume("~");
      return { type: "un", op: "~", expr: this.parseUnary() };
    }
    return this.parsePostfix();
  }

  parsePostfix(): Ast {
    let expr = this.parsePrimary();
    if (this.peek("~") && !this.peek("~=")) {
      this.consume("~");
      expr = { type: "un", op: "~", expr };
    }
    return expr;
  }

  parsePrimary(): Ast {
    this.skip();
    if (this.consume("(")) {
      const inner = this.parseOr();
      this.expect(")");
      return inner;
    }
    const ch = this.s[this.i];
    if (ch === '"' || ch === "'") return this.parseString();
    if (ch === "[") return this.parseBracketString();
    if (ch === "#") return this.parseHash();
    if (ch && /[0-9]/.test(ch) && /^[0-9]+[A-Za-z_]/.test(this.s.slice(this.i))) {
      const name = this.readIdentLoose();
      if (this.peek("(")) return this.parseCall(name);
      return { type: "ident", name };
    }
    if (ch && /[0-9.]/.test(ch)) {
      const num = this.tryNumber();
      if (num) return num;
    }
    if (ch && /[A-Za-z_]/.test(ch)) {
      const name = this.readIdent();
      if (this.peek("(")) return this.parseCall(name);
      return { type: "ident", name };
    }
    throw new Error(`Unexpected "${this.s.slice(this.i, this.i + 16)}" in "${this.s}"`);
  }

  parseCall(name: string): Ast {
    this.expect("(");
    const args: Ast[] = [];
    if (!this.peek(")")) {
      let index = 0;
      do {
        if ((name === "df" && index === 0) || (name === "tf" && index === 1)) args.push(this.parseFormat());
        else if (name === "tf" && index === 0) args.push(this.parseDateOrExpr());
        else args.push(this.parseOr());
        index++;
      } while (this.consume(","));
    }
    this.expect(")");
    return { type: "call", name: name.toLowerCase(), args };
  }

  parseFormat(): Ast {
    this.skip();
    if (this.s[this.i] === '"' || this.s[this.i] === "'") return this.parseString();
    if (/^[A-Za-z_][A-Za-z0-9_]*\s*\(/.test(this.s.slice(this.i))) return this.parseOr();
    return { type: "str", value: this.readRawArgument() };
  }

  parseDateOrExpr(): Ast {
    this.skip();
    const rest = this.s.slice(this.i);
    const cut = rest.search(/[,)]/);
    const slice = (cut === -1 ? rest : rest.slice(0, cut)).trim();
    if (/^(?:[ar]?\d+(?:\.\d+)?[yMwdhms])+$/.test(slice)) {
      this.i += rest.indexOf(slice) + slice.length;
      return { type: "str", value: slice };
    }
    return this.parseOr();
  }

  readRawArgument(): string {
    this.skip();
    const start = this.i;
    let depth = 0;
    let quote = "";
    while (this.i < this.s.length) {
      const ch = this.s[this.i]!;
      if (quote) {
        if (ch === quote && this.s[this.i - 1] !== "\\") quote = "";
        this.i++;
        continue;
      }
      if (ch === '"' || ch === "'") quote = ch;
      else if (ch === "(") depth++;
      else if (ch === ")") {
        if (depth === 0) break;
        depth--;
      } else if (ch === "," && depth === 0) break;
      this.i++;
    }
    return this.s.slice(start, this.i).trim();
  }

  parseString(): Ast {
    const quote = this.s[this.i]!;
    this.i++;
    let out = "";
    while (this.i < this.s.length) {
      const ch = this.s[this.i]!;
      if (ch === "\\" && this.i + 1 < this.s.length) {
        const next = this.s[this.i + 1]!;
        out += next === "n" ? "\n" : next;
        this.i += 2;
        continue;
      }
      if (ch === quote) {
        this.i++;
        return { type: "str", value: out };
      }
      out += ch;
      this.i++;
    }
    throw new Error("Unclosed string");
  }

  parseBracketString(): Ast {
    const start = this.i;
    this.i++;
    while (this.i < this.s.length && this.s[this.i] !== "]") this.i++;
    if (this.s[this.i] === "]") this.i++;
    return { type: "str", value: this.s.slice(start, this.i) };
  }

  parseHash(): Ast {
    const start = this.i;
    this.i++;
    const hexStart = this.i;
    while (this.i < this.s.length && /[0-9a-fA-F]/.test(this.s[this.i]!)) this.i++;
    const len = this.i - hexStart;
    if (len === 3 || len === 4 || len === 6 || len === 8) {
      return { type: "str", value: this.s.slice(start, this.i) };
    }
    this.i = start + 1;
    return { type: "str", value: "#" };
  }

  tryNumber(): Ast | null {
    const start = this.i;
    if (this.s[this.i] === "." && !/[0-9]/.test(this.s[this.i + 1] ?? "")) return null;
    while (this.i < this.s.length && /[0-9.]/.test(this.s[this.i]!)) this.i++;
    const text = this.s.slice(start, this.i);
    if (!text || text === "." || Number.isNaN(Number(text))) {
      this.i = start;
      return null;
    }
    return { type: "num", value: Number(text) };
  }

  readIdent(): string {
    return this.readIdentLoose();
  }

  readIdentLoose(): string {
    const start = this.i;
    this.i++;
    while (this.i < this.s.length && /[A-Za-z0-9_]/.test(this.s[this.i]!)) this.i++;
    return this.s.slice(start, this.i);
  }
}

export function parseFormula(source: string): Ast {
  return new Parser(source.trim()).parse();
}

export function isDateCode(value: string): boolean {
  return /^(?:[ar]?\d+(?:\.\d+)?[yMwdhms])+$/.test(value);
}
