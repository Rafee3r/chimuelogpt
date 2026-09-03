import { describe, it, expect } from 'vitest';
import {
  verificarClave, sesionVigente,
  CLAVE_FAMILIAR, EPOCA_SESION, CLAVES_ANTIGUAS,
} from '../auth';

describe('verificarClave', () => {
  it('acepta la clave actual', () => {
    expect(verificarClave('chichimu')).toBe('ok');
  });

  it('tolera mayúsculas y espacios (el teclado del celular pone ambas)', () => {
    expect(verificarClave('  ChiChiMu ')).toBe('ok');
    expect(verificarClave('CHICHIMU')).toBe('ok');
  });

  it('distingue una clave vieja de una equivocada', () => {
    /* La diferencia importa: "te equivocaste" hace que insistan con la
       misma tecla; "la clave cambió" hace que pidan la nueva. */
    for (const vieja of CLAVES_ANTIGUAS) {
      expect(verificarClave(vieja)).toBe('old');
    }
    expect(verificarClave('cualquier cosa')).toBe('wrong');
    expect(verificarClave('')).toBe('wrong');
  });

  it('no deja pasar algo parecido a la clave', () => {
    expect(verificarClave('chichimu1')).toBe('wrong');
    expect(verificarClave('chichim')).toBe('wrong');
    expect(verificarClave('chimu')).toBe('wrong');
  });
});

describe('sesionVigente', () => {
  it('acepta solo la época actual', () => {
    expect(sesionVigente(EPOCA_SESION)).toBe(true);
  });

  it('ECHA a los dispositivos de versiones antiguas', () => {
    /* Esta es LA prueba del requisito "que se cierren sesión aun en
       dispositivos que iniciaron en versiones antiguas".
       Verificado en el historial de git: todas las versiones previas
       guardaron exactamente el texto "true". */
    expect(sesionVigente('true')).toBe(false);
  });

  it('echa cualquier valor que no sea la época exacta', () => {
    for (const v of ['true', 'True', 'TRUE', 'v1', 'v3', '1', 'yes', 'ok', '']) {
      expect(sesionVigente(v)).toBe(false);
    }
  });

  it('trata como cerrada la sesión inexistente', () => {
    expect(sesionVigente(null)).toBe(false);
  });

  it('la clave y la época no se confunden entre sí', () => {
    // Un despiste al editar podría dejar la clave como valor de sesión.
    expect(sesionVigente(CLAVE_FAMILIAR)).toBe(false);
  });
});
