import { describe, expect, it } from 'vitest';
import {
  CLIENT_MODEL_FLASH,
  CLIENT_MODEL_PRO,
  DEEPSEEK_FLASH,
  DEEPSEEK_PRO,
  resolveDeepSeekModel,
} from '../models';

describe('resolveDeepSeekModel', () => {
  it('mapea el modo rápido de la UI a V4.1 Flash', () => {
    expect(resolveDeepSeekModel(CLIENT_MODEL_FLASH)).toBe(DEEPSEEK_FLASH);
  });

  it('mapea el modo Pro de la UI a V4 Pro', () => {
    expect(resolveDeepSeekModel(CLIENT_MODEL_PRO)).toBe(DEEPSEEK_PRO);
  });

  it('usa Flash por defecto', () => {
    expect(resolveDeepSeekModel()).toBe(DEEPSEEK_FLASH);
    expect(resolveDeepSeekModel('otro')).toBe(DEEPSEEK_FLASH);
  });

  it('usa Pro si el pensamiento es extendido', () => {
    expect(resolveDeepSeekModel(CLIENT_MODEL_FLASH, 'extended')).toBe(DEEPSEEK_PRO);
  });
});
