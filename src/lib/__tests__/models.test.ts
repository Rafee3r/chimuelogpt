import { describe, expect, it } from 'vitest';
import {
  CLIENT_MODEL_FLASH,
  CLIENT_MODEL_PRO,
  CLIENT_MODEL_UNCENSORED,
  DEEPSEEK_FLASH,
  isUncensoredModel,
  resolveDeepSeekModel,
} from '../models';

describe('resolveDeepSeekModel', () => {
  it('mapea el modo rápido de la UI a V4.1 Flash', () => {
    expect(resolveDeepSeekModel(CLIENT_MODEL_FLASH)).toBe(DEEPSEEK_FLASH);
  });

  it('mapea cualquier modelo anterior (incluido Pro) a Flash', () => {
    expect(resolveDeepSeekModel(CLIENT_MODEL_PRO)).toBe(DEEPSEEK_FLASH);
  });

  it('usa Flash por defecto', () => {
    expect(resolveDeepSeekModel()).toBe(DEEPSEEK_FLASH);
    expect(resolveDeepSeekModel('otro')).toBe(DEEPSEEK_FLASH);
  });

  it('usa Flash incluso si el pensamiento es extendido', () => {
    expect(resolveDeepSeekModel(CLIENT_MODEL_FLASH, 'extended')).toBe(DEEPSEEK_FLASH);
  });
});

describe('isUncensoredModel', () => {
  it('detecta correctamente el modelo sin censura', () => {
    expect(isUncensoredModel(CLIENT_MODEL_UNCENSORED)).toBe(true);
    expect(isUncensoredModel('gpt-4o-mini')).toBe(true);
    expect(isUncensoredModel('sin-censura')).toBe(true);
    expect(isUncensoredModel(CLIENT_MODEL_FLASH)).toBe(false);
    expect(isUncensoredModel(CLIENT_MODEL_PRO)).toBe(false);
    expect(isUncensoredModel()).toBe(false);
  });
});
