/* ─────────── Calculadora determinista ───────────
   Los modelos de lenguaje predicen texto, no calculan: con números largos
   se equivocan con seguridad total. Esta herramienta evalúa la expresión
   de verdad y le entrega el resultado exacto a la IA.

   Evaluador propio (shunting-yard). NO usa eval() ni Function(): la
   expresión viene del texto del usuario y ejecutarla sería una vía directa
   de inyección de código.
*/

export type CalcResult =
  | { ok: true; value: number; formatted: string }
  | { ok: false; error: string };

type Token = { type: 'num'; value: number } | { type: 'op'; value: string } | { type: 'paren'; value: '(' | ')' };

/* 'u-' = negación unaria. Es un operador propio con la precedencia más alta:
   insertar un 0 implícito (0 - x) rompía casos como 3*-2, porque el * se
   evaluaba antes que la resta y daba -2 en vez de -6. */
const PRECEDENCE: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3, 'u-': 4 };
const RIGHT_ASSOC = new Set(['^', 'u-']);
const UNARY = new Set(['u-']);

/** Normaliza símbolos que la gente escribe de verdad: ×, ÷, comas, etc. */
export function normalizeExpression(raw: string): string {
  return raw
    .replace(/[×✕✖]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/−/g, '-')          // guion largo unicode
    .replace(/\s+/g, '')
    // 1.234,56 (formato chileno) → 1234.56
    .replace(/(\d)\.(?=\d{3}\b)/g, '$1')
    .replace(/,(\d+)/g, '.$1');
}

function tokenize(expr: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (/\d|\./.test(c)) {
      let num = '';
      while (i < expr.length && /[\d.]/.test(expr[i])) num += expr[i++];
      const value = parseFloat(num);
      if (Number.isNaN(value)) return null;
      tokens.push({ type: 'num', value });
      continue;
    }
    if (c === '+' || c === '-' || c === '*' || c === '/' || c === '%' || c === '^') {
      // Negativo unario: al inicio, tras otro operador, o tras '('
      const prev = tokens[tokens.length - 1];
      const isUnary = c === '-' && (!prev || prev.type === 'op' || (prev.type === 'paren' && prev.value === '('));
      tokens.push({ type: 'op', value: isUnary ? 'u-' : c });
      i++;
      continue;
    }
    if (c === '(' || c === ')') {
      tokens.push({ type: 'paren', value: c });
      i++;
      continue;
    }
    return null; // carácter no permitido
  }
  return tokens;
}

function toRPN(tokens: Token[]): Token[] | null {
  const out: Token[] = [];
  const stack: Token[] = [];
  for (const t of tokens) {
    if (t.type === 'num') out.push(t);
    else if (t.type === 'op') {
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.type !== 'op') break;
        const higher = PRECEDENCE[top.value] > PRECEDENCE[t.value];
        const sameAndLeftAssoc = PRECEDENCE[top.value] === PRECEDENCE[t.value] && !RIGHT_ASSOC.has(t.value);
        if (higher || sameAndLeftAssoc) out.push(stack.pop()!);
        else break;
      }
      stack.push(t);
    } else if (t.value === '(') stack.push(t);
    else {
      let found = false;
      while (stack.length) {
        const top = stack.pop()!;
        if (top.type === 'paren' && top.value === '(') { found = true; break; }
        out.push(top);
      }
      if (!found) return null; // paréntesis desbalanceado
    }
  }
  while (stack.length) {
    const top = stack.pop()!;
    if (top.type === 'paren') return null;
    out.push(top);
  }
  return out;
}

function evalRPN(rpn: Token[]): number | null {
  const st: number[] = [];
  for (const t of rpn) {
    if (t.type === 'num') { st.push(t.value); continue; }
    if (t.type !== 'op') return null;

    // Operadores unarios consumen un solo operando
    if (UNARY.has(t.value)) {
      const x = st.pop();
      if (x === undefined) return null;
      st.push(-x);
      continue;
    }

    const b = st.pop();
    const a = st.pop();
    if (a === undefined || b === undefined) return null;
    switch (t.value) {
      case '+': st.push(a + b); break;
      case '-': st.push(a - b); break;
      case '*': st.push(a * b); break;
      case '/':
        if (b === 0) return null;
        st.push(a / b); break;
      case '%':
        if (b === 0) return null;
        st.push(a % b); break;
      case '^': st.push(Math.pow(a, b)); break;
      default: return null;
    }
  }
  return st.length === 1 ? st[0] : null;
}

/** Formato local chileno, sin decimales innecesarios. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const rounded = Math.round(n * 1e10) / 1e10;
  return rounded.toLocaleString('es-CL', { maximumFractionDigits: 10 });
}

export function calculate(raw: string): CalcResult {
  const expr = normalizeExpression(raw || '');
  if (!expr) return { ok: false, error: 'Expresión vacía' };
  if (expr.length > 200) return { ok: false, error: 'Expresión demasiado larga' };

  const tokens = tokenize(expr);
  if (!tokens || tokens.length === 0) return { ok: false, error: 'La expresión tiene caracteres no válidos' };

  const rpn = toRPN(tokens);
  if (!rpn) return { ok: false, error: 'Paréntesis desbalanceados' };

  const value = evalRPN(rpn);
  if (value === null) return { ok: false, error: 'No se pudo resolver (¿división por cero?)' };
  if (!Number.isFinite(value)) return { ok: false, error: 'El resultado no es un número válido' };

  return { ok: true, value, formatted: formatNumber(value) };
}
