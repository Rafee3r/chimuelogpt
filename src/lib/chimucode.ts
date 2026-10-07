import type { SandboxEngine, SandboxLanguage, SandboxResult } from './sandbox-types';

export interface ChimuCodeSnippet {
  id: string;
  title: string;
  description: string;
  language: SandboxLanguage;
  engine: SandboxEngine;
  code: string;
}

export const CHIMUCODE_STARTER_SNIPPETS: ChimuCodeSnippet[] = [
  {
    id: 'js-fibonacci',
    title: 'Secuencia Fibonacci (JS)',
    description: 'Calcula números de Fibonacci en Web Worker del navegador',
    language: 'javascript',
    engine: 'worker',
    code: `// Cálculo Fibonacci en cliente (Web Worker)
function fibonacci(n) {
  const seq = [0, 1];
  for (let i = 2; i < n; i++) {
    seq.push(seq[i - 1] + seq[i - 2]);
  }
  return seq;
}

console.log("Primeros 15 números de Fibonacci:");
console.log(fibonacci(15));
`,
  },
  {
    id: 'py-math-stats',
    title: 'Estadísticas Matemáticas (Python Cloud)',
    description: 'Calcula media, mediana y varianza con Python en backend',
    language: 'python',
    engine: 'cloud',
    code: `# Análisis numérico en Cloud Sandbox
import statistics

data = [12.5, 18.2, 14.1, 22.0, 19.8, 15.4, 25.1, 13.9]

print(f"Muestra: {data}")
print(f"Media: {statistics.mean(data):.2f}")
print(f"Mediana: {statistics.median(data):.2f}")
print(f"Desviación estándar: {statistics.stdev(data):.2f}")
`,
  },
  {
    id: 'js-data-transform',
    title: 'Procesamiento de Datos (JS Client)',
    description: 'Filtra y agrupa un JSON de ejemplo sin enviar datos a la red',
    language: 'javascript',
    engine: 'worker',
    code: `const productos = [
  { nombre: "Manzanas", precio: 1200, categoria: "Fruta" },
  { nombre: "Leche", precio: 950, categoria: "Lácteos" },
  { nombre: "Plátanos", precio: 800, categoria: "Fruta" },
  { nombre: "Yogur", precio: 450, categoria: "Lácteos" }
];

const totalPorCategoria = productos.reduce((acc, p) => {
  acc[p.categoria] = (acc[p.categoria] || 0) + p.precio;
  return acc;
}, {});

console.log("Total gastado por categoría:");
console.log(totalPorCategoria);
`,
  },
];

export function parseChimuCodeCommand(input: string): {
  isCommand: boolean;
  command?: 'help' | 'clear' | 'run' | 'reset';
  rawCode?: string;
} {
  const trimmed = input.trim();
  if (trimmed === '/help') return { isCommand: true, command: 'help' };
  if (trimmed === '/clear') return { isCommand: true, command: 'clear' };
  if (trimmed === '/run') return { isCommand: true, command: 'run' };
  if (trimmed === '/reset') return { isCommand: true, command: 'reset' };

  return { isCommand: false, rawCode: input };
}

export function formatTerminalTimestamp(): string {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
