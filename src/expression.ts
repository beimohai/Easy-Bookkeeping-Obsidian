class ExpressionParser {
  private index = 0;

  constructor(private readonly source: string) {}

  parse(): number {
    const value = this.expression();
    this.skipSpaces();
    if (this.index !== this.source.length || !Number.isFinite(value)) throw new Error("金额算式无效");
    return value;
  }

  private expression(): number {
    let value = this.term();
    while (true) {
      this.skipSpaces();
      if (this.take("+")) value += this.term();
      else if (this.take("-")) value -= this.term();
      else return value;
    }
  }

  private term(): number {
    let value = this.factor();
    while (true) {
      this.skipSpaces();
      if (this.take("*")) value *= this.factor();
      else if (this.take("/")) {
        const divisor = this.factor();
        if (divisor === 0) throw new Error("金额不能除以0");
        value /= divisor;
      } else return value;
    }
  }

  private factor(): number {
    this.skipSpaces();
    if (this.take("+")) return this.factor();
    if (this.take("-")) return -this.factor();
    if (this.take("(")) {
      const value = this.expression();
      this.skipSpaces();
      if (!this.take(")")) throw new Error("金额算式缺少右括号");
      return value;
    }
    const start = this.index;
    while (/[\d.]/.test(this.source[this.index] ?? "")) this.index++;
    const token = this.source.slice(start, this.index);
    if (/^\d*\.\d{3,}$/.test(token)) throw new Error("金额最多只能输入2位小数");
    if (!token || !/^\d+(?:\.\d{0,2})?$|^\.\d{1,2}$/.test(token)) throw new Error("金额算式无效");
    return Number(token);
  }

  private skipSpaces(): void {
    while (/\s/.test(this.source[this.index] ?? "")) this.index++;
  }

  private take(char: string): boolean {
    if (this.source[this.index] !== char) return false;
    this.index++;
    return true;
  }
}

export function evaluateAmount(input: string): number {
  const normalized = input.trim().replace(/[，。、,]/g, ".").replace(/[×xX]/g, "*").replace(/÷/g, "/");
  if (!normalized) throw new Error("请输入金额");
  const parsed = new ExpressionParser(normalized).parse();
  const value = Math.round((parsed + Number.EPSILON) * 100) / 100;
  if (value <= 0) throw new Error("金额必须大于0");
  return value;
}
