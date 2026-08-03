import { describe, it, expect } from 'vitest';
import { calculate, normalizeExpression, formatNumber } from '../calculator';

const val = (s: string) => {
  const r = calculate(s);
  return r.ok ? r.value : null;
};

describe('calculate — aritmética exacta', () => {
  it('resuelve el caso del screenshot', () => {
    expect(val('4 × 4')).toBe(16);
  });

  it('respeta la precedencia de operadores', () => {
    expect(val('2+3*4')).toBe(14);
    expect(val('(2+3)*4')).toBe(20);
    expect(val('2^3^2')).toBe(512); // potencia asociativa a la derecha
  });

  it('maneja negativos unarios', () => {
    expect(val('-5+3')).toBe(-2);
    expect(val('-(4*2)')).toBe(-8);
    expect(val('3*-2')).toBe(-6);
  });

  it('acierta donde un modelo de lenguaje suele fallar', () => {
    // Al escribir este test yo mismo puse 14376069 — un dígito equivocado.
    // La calculadora tenía razón. Ese es justamente el punto de la herramienta.
    expect(val('4839 * 2971')).toBe(14376669);
    expect(val('98765 - 43210')).toBe(55555);
  });

  it('divide y saca módulo', () => {
    expect(val('10/4')).toBe(2.5);
    expect(val('10%3')).toBe(1);
  });
});

describe('normalizeExpression — cómo escribe la gente de verdad', () => {
  it('convierte símbolos comunes', () => {
    expect(normalizeExpression('4 × 4')).toBe('4*4');
    expect(normalizeExpression('10 ÷ 2')).toBe('10/2');
    expect(normalizeExpression('5 − 3')).toBe('5-3');
  });

  it('entiende decimales con coma (formato chileno)', () => {
    expect(val('1,5+1,5')).toBe(3);
  });

  it('entiende miles con punto', () => {
    expect(val('1.000+500')).toBe(1500);
  });
});

describe('calculate — errores claros, sin crash', () => {
  it('rechaza división por cero', () => {
    const r = calculate('5/0');
    expect(r.ok).toBe(false);
  });

  it('rechaza paréntesis desbalanceados', () => {
    expect(calculate('(2+3').ok).toBe(false);
    expect(calculate('2+3)').ok).toBe(false);
  });

  it('NO ejecuta código inyectado', () => {
    // Sin eval(): esto debe fallar como expresión inválida, no ejecutarse
    expect(calculate('process.exit(1)').ok).toBe(false);
    expect(calculate('fetch("http://x")').ok).toBe(false);
    expect(calculate('1;alert(1)').ok).toBe(false);
  });

  it('rechaza vacío y expresiones gigantes', () => {
    expect(calculate('').ok).toBe(false);
    expect(calculate('1+'.repeat(200) + '1').ok).toBe(false);
  });
});

describe('formatNumber — legible para la familia', () => {
  it('usa separador de miles chileno', () => {
    expect(formatNumber(1234567)).toBe('1.234.567');
  });
  it('no arrastra ruido de punto flotante', () => {
    expect(formatNumber(0.1 + 0.2)).toBe('0,3');
  });
});
