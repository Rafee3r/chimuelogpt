import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateGitHubToken,
  listUserRepos,
  createPullRequest,
  listPullRequests,
  listIssues,
  getStoredGitHubToken,
  saveStoredGitHubToken,
  clearStoredGitHubToken,
} from '../github';

import { makeStorage } from './helpers';

describe('GitHub storage helpers', () => {
  it('guarda, lee y borra el token de GitHub limpiamente', () => {
    const storage = makeStorage();
    expect(getStoredGitHubToken(storage)).toBeNull();
    saveStoredGitHubToken('ghp_test123', storage);
    expect(getStoredGitHubToken(storage)).toBe('ghp_test123');
    clearStoredGitHubToken(storage);
    expect(getStoredGitHubToken(storage)).toBeNull();
  });
});

describe('validateGitHubToken', () => {
  it('retorna error si el token está vacío', async () => {
    const res = await validateGitHubToken('  ');
    expect(res.ok).toBe(false);
    expect(res.error).toContain('Token no proporcionado');
  });

  it('valida token exitosamente y extrae scopes y usuario', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      headers: {
        get: (h: string) => (h === 'x-oauth-scopes' ? 'repo, user' : null),
      },
      json: async () => ({
        login: 'octocat',
        name: 'The Octocat',
        avatar_url: 'https://github.com/images/octocat.png',
        html_url: 'https://github.com/octocat',
        public_repos: 8,
      }),
    });

    const res = await validateGitHubToken('ghp_validToken');
    expect(res.ok).toBe(true);
    expect(res.user?.login).toBe('octocat');
    expect(res.scopes).toEqual(['repo', 'user']);
  });

  it('maneja error 401 de token inválido', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    const res = await validateGitHubToken('ghp_badToken');
    expect(res.ok).toBe(false);
    expect(res.error).toContain('inválido o expirado');
  });
});

describe('listUserRepos', () => {
  it('mapea correctamente los repositorios del usuario', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 101,
          name: 'mi-app',
          full_name: 'octocat/mi-app',
          private: false,
          html_url: 'https://github.com/octocat/mi-app',
          description: 'App de prueba',
          default_branch: 'main',
          updated_at: '2026-10-10T00:00:00Z',
        },
      ],
    });

    const res = await listUserRepos('token');
    expect(res.ok).toBe(true);
    expect(res.repos).toHaveLength(1);
    expect(res.repos?.[0].full_name).toBe('octocat/mi-app');
  });
});

describe('createPullRequest', () => {
  it('crea pull request y devuelve URL y número', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        html_url: 'https://github.com/octocat/mi-app/pull/1',
        number: 1,
      }),
    });

    const res = await createPullRequest('token', 'octocat', 'mi-app', 'Feature nueva', 'Desc', 'feature-branch', 'main');
    expect(res.ok).toBe(true);
    expect(res.prNumber).toBe(1);
    expect(res.prUrl).toBe('https://github.com/octocat/mi-app/pull/1');
  });
});

describe('listPullRequests & listIssues', () => {
  it('lista PRs abiertos', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 1, number: 42, title: 'Fix bug', html_url: 'url', state: 'open', user: { login: 'dev' }, created_at: '' },
      ],
    });

    const res = await listPullRequests('token', 'octocat', 'mi-app');
    expect(res.ok).toBe(true);
    expect(res.prs).toHaveLength(1);
    expect(res.prs?.[0].number).toBe(42);
  });

  it('lista issues abiertos filtrando pull requests', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 1, number: 10, title: 'Bug report', html_url: 'url', state: 'open', user: { login: 'tester' }, created_at: '' },
        { id: 2, number: 11, title: 'PR issue', html_url: 'url', state: 'open', user: { login: 'tester' }, pull_request: {}, created_at: '' },
      ],
    });

    const res = await listIssues('token', 'octocat', 'mi-app');
    expect(res.ok).toBe(true);
    expect(res.issues).toHaveLength(1);
    expect(res.issues?.[0].number).toBe(10);
  });
});
