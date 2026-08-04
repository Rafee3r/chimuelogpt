import { describe, it, expect } from 'vitest';
import { friendlyApiError, isRetryableStatus, backoffDelay } from '../api-errors';

describe('friendlyApiError — nunca mostrar JSON crudo al usuario', () => {
  it('traduce el 503 real de DeepSeek del screenshot', () => {
    const raw = '{"error":{"message":"Service is too busy. We advise users to temporarily switch to alternative LLM API service providers.","type":"service_unavailable_error"}}';
    const e = friendlyApiError(503, raw);
    expect(e.message).toBe('El servicio está saturado en este momento. Intenta de nuevo en un ratito.');
    expect(e.retryable).toBe(true);
    // Nada del payload técnico se filtra
    expect(e.message).not.toContain('503');
    expect(e.message).not.toContain('{');
    expect(e.message.toLowerCase()).not.toContain('llm');
  });

  it('distingue límite de tasa', () => {
    expect(friendlyApiError(429).retryable).toBe(true);
    expect(friendlyApiError(429).message).toContain('demanda');
  });

  it('marca los errores de configuración como NO reintentables', () => {
    expect(friendlyApiError(401).retryable).toBe(false);
    expect(friendlyApiError(402, 'Insufficient Balance').retryable).toBe(false);
    expect(friendlyApiError(402, 'Insufficient Balance').message).toContain('saldo');
  });

  it('sugiere reformular ante un 400', () => {
    const e = friendlyApiError(400, '{"error":"invalid_request_error"}');
    expect(e.retryable).toBe(false);
    expect(e.message).toContain('otra forma');
  });

  it('tiene un mensaje digno para lo desconocido', () => {
    const e = friendlyApiError(418, 'soy una tetera');
    expect(e.message).toBe('No pude completar la respuesta. Intenta de nuevo.');
    expect(e.message).not.toContain('tetera');
  });

  it('detecta la causa por el cuerpo aunque el status sea genérico', () => {
    expect(friendlyApiError(500, 'Service is too busy').message).toContain('saturado');
  });
});

describe('isRetryableStatus', () => {
  it('reintenta saturación y errores del proveedor', () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
  });
  it('no reintenta errores del cliente', () => {
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(401)).toBe(false);
    expect(isRetryableStatus(402)).toBe(false);
  });
});

describe('backoffDelay', () => {
  it('crece exponencialmente', () => {
    expect(backoffDelay(0)).toBe(1000);
    expect(backoffDelay(1)).toBe(2000);
    expect(backoffDelay(2)).toBe(4000);
  });
});
