/**
 * Módulo de integración GitHub para ChimuCode.
 * Conexión segura client-side mediante Personal Access Token (PAT) o OAuth con permisos mínimos (repo: contents, pull requests).
 */

import type { ChimuCodeFile } from './sandbox-types';

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  public_repos: number;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  default_branch: string;
  updated_at: string;
}

export interface GitHubPR {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
  user: { login: string };
  created_at: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: string;
  user: { login: string };
  created_at: string;
}

import type { StorageLike } from './types';

const GITHUB_TOKEN_KEY = 'chimuelo_github_token';
const GITHUB_USER_KEY = 'chimuelo_github_user';

function getStorage(custom?: StorageLike): StorageLike | null {
  if (custom) return custom;
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    return window.localStorage;
  }
  return null;
}

export function getStoredGitHubToken(storage?: StorageLike): string | null {
  const s = getStorage(storage);
  if (!s) return null;
  try {
    return s.getItem(GITHUB_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveStoredGitHubToken(token: string, storage?: StorageLike): void {
  const s = getStorage(storage);
  if (!s) return;
  try {
    s.setItem(GITHUB_TOKEN_KEY, token.trim());
  } catch {}
}

export function clearStoredGitHubToken(storage?: StorageLike): void {
  const s = getStorage(storage);
  if (!s) return;
  try {
    s.removeItem(GITHUB_TOKEN_KEY);
    s.removeItem(GITHUB_USER_KEY);
  } catch {}
}

export function getStoredGitHubUser(storage?: StorageLike): GitHubUser | null {
  const s = getStorage(storage);
  if (!s) return null;
  try {
    const raw = s.getItem(GITHUB_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveStoredGitHubUser(user: GitHubUser, storage?: StorageLike): void {
  const s = getStorage(storage);
  if (!s) return;
  try {
    s.setItem(GITHUB_USER_KEY, JSON.stringify(user));
  } catch {}
}

/**
 * Valida un token de GitHub y obtiene los datos del usuario y scopes otorgados.
 */
export async function validateGitHubToken(token: string): Promise<{
  ok: boolean;
  user?: GitHubUser;
  scopes?: string[];
  error?: string;
}> {
  try {
    const cleanToken = token.trim();
    if (!cleanToken) {
      return { ok: false, error: 'Token no proporcionado.' };
    }

    const res = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        return { ok: false, error: 'Token inválido o expirado.' };
      }
      return { ok: false, error: `Error de GitHub (${res.status}): ${res.statusText}` };
    }

    const data = await res.json();
    const scopesHeader = res.headers.get('x-oauth-scopes') || '';
    const scopes = scopesHeader
      ? scopesHeader.split(',').map((s) => s.trim()).filter(Boolean)
      : ['fine-grained-pat'];

    const user: GitHubUser = {
      login: data.login,
      name: data.name || data.login,
      avatar_url: data.avatar_url,
      html_url: data.html_url,
      public_repos: data.public_repos || 0,
    };

    saveStoredGitHubToken(cleanToken);
    saveStoredGitHubUser(user);

    return { ok: true, user, scopes };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Fallo de conexión con GitHub.' };
  }
}

/**
 * Lista los repositorios del usuario autenticado ordenados por fecha de actualización reciente.
 */
export async function listUserRepos(token: string): Promise<{
  ok: boolean;
  repos?: GitHubRepo[];
  error?: string;
}> {
  try {
    const res = await fetch('https://api.github.com/user/repos?sort=updated&per_page=30&affiliation=owner,collaborator', {
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) {
      return { ok: false, error: `No se pudieron cargar repos (${res.status})` };
    }

    const data = await res.json();
    const repos: GitHubRepo[] = data.map((r: any) => ({
      id: r.id,
      name: r.name,
      full_name: r.full_name,
      private: !!r.private,
      html_url: r.html_url,
      description: r.description,
      default_branch: r.default_branch || 'main',
      updated_at: r.updated_at,
    }));

    return { ok: true, repos };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error al listar repositorios.' };
  }
}

/**
 * Extensiones permitidas para importar como código a ChimuCode.
 */
const IMPORT_EXTENSIONS = new Set([
  'html', 'htm', 'css', 'js', 'ts', 'jsx', 'tsx', 'json', 'py', 'sql', 'sh',
  'md', 'txt', 'svg', 'yml', 'yaml', 'toml', 'xml', 'swift'
]);

/**
 * Clona los archivos textuales de un repositorio en memoria para ChimuCode.
 */
export async function fetchRepoFiles(
  token: string,
  owner: string,
  repo: string,
  branch?: string
): Promise<{ ok: boolean; files?: ChimuCodeFile[]; error?: string }> {
  try {
    const targetBranch = branch || 'main';
    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${targetBranch}?recursive=1`,
      {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!treeRes.ok) {
      return { ok: false, error: `No se encontró el árbol de la rama ${targetBranch} (${treeRes.status}).` };
    }

    const treeData = await treeRes.json();
    if (!Array.isArray(treeData.tree)) {
      return { ok: false, error: 'Formato de árbol inválido recibido de GitHub.' };
    }

    // Filtrar archivos aptos (no binarios, tamaño < 200KB, ignorar node_modules y .git)
    const validItems = treeData.tree.filter((item: any) => {
      if (item.type !== 'blob') return false;
      const path: string = item.path;
      if (path.includes('node_modules/') || path.startsWith('.git/') || path.includes('dist/') || path.includes('build/')) {
        return false;
      }
      const ext = path.split('.').pop()?.toLowerCase();
      if (!ext || !IMPORT_EXTENSIONS.has(ext)) return false;
      if (item.size && item.size > 250000) return false;
      return true;
    }).slice(0, 40); // Máximo 40 archivos principales para mantener contexto ágil

    const loadedFiles: ChimuCodeFile[] = [];

    // Descargar en lotes de 6 concurrentes
    for (let i = 0; i < validItems.length; i += 6) {
      const batch = validItems.slice(i, i + 6);
      const results = await Promise.all(
        batch.map(async (item: any) => {
          try {
            const blobRes = await fetch(item.url, {
              headers: {
                Authorization: `Bearer ${token.trim()}`,
                Accept: 'application/vnd.github.v3+json',
              },
            });
            if (!blobRes.ok) return null;
            const blobData = await blobRes.json();
            const content = blobData.encoding === 'base64'
              ? decodeURIComponent(escape(atob(blobData.content.replace(/\s/g, ''))))
              : blobData.content;

            const ext = item.path.split('.').pop()?.toLowerCase() || 'text';
            let language = 'html';
            if (ext === 'js' || ext === 'jsx') language = 'javascript';
            else if (ext === 'ts' || ext === 'tsx') language = 'typescript';
            else if (ext === 'css') language = 'css';
            else if (ext === 'py') language = 'python';
            else if (ext === 'sql') language = 'sql';
            else if (ext === 'sh') language = 'bash';
            else if (ext === 'json') language = 'json';
            else if (ext === 'swift') language = 'swift';

            return {
              path: item.path,
              language,
              content: content || '',
            } as ChimuCodeFile;
          } catch {
            return null;
          }
        })
      );

      for (const res of results) {
        if (res) loadedFiles.push(res);
      }
    }

    return { ok: true, files: loadedFiles };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error al clonar archivos del repositorio.' };
  }
}

/**
 * Crea una nueva rama en el repositorio a partir de una rama base.
 */
export async function createRepoBranch(
  token: string,
  owner: string,
  repo: string,
  newBranch: string,
  fromBranch: string = 'main'
): Promise<{ ok: boolean; error?: string }> {
  try {
    const baseRefRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${fromBranch}`,
      {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!baseRefRes.ok) {
      return { ok: false, error: `No se pudo obtener la rama base ${fromBranch}.` };
    }

    const baseRefData = await baseRefRes.json();
    const sha = baseRefData?.object?.sha;
    if (!sha) return { ok: false, error: 'No se obtuvo el SHA de la rama base.' };

    const createRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: `refs/heads/${newBranch.trim()}`,
        sha,
      }),
    });

    if (!createRes.ok) {
      const errJson = await createRes.json().catch(() => ({}));
      return { ok: false, error: errJson.message || `No se pudo crear la rama (${createRes.status}).` };
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error al crear rama en GitHub.' };
  }
}

/**
 * Realiza un commit atómico de múltiples archivos a una rama usando la Git Data API de GitHub.
 */
export async function commitFilesToRepo(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  files: ChimuCodeFile[],
  message: string
): Promise<{ ok: boolean; commitSha?: string; commitUrl?: string; error?: string }> {
  try {
    if (!files || files.length === 0) {
      return { ok: false, error: 'No hay archivos para commitear.' };
    }

    const headers = {
      Authorization: `Bearer ${token.trim()}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };

    // 1. Obtener el commit actual de la rama
    const refRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`, {
      headers,
    });
    if (!refRes.ok) {
      return { ok: false, error: `No se encontró la rama ${branch} en ${owner}/${repo}.` };
    }
    const refData = await refRes.json();
    const latestCommitSha = refData?.object?.sha;

    // 2. Obtener el tree SHA de ese commit
    const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits/${latestCommitSha}`, {
      headers,
    });
    if (!commitRes.ok) {
      return { ok: false, error: 'No se pudo leer el último commit de la rama.' };
    }
    const commitData = await commitRes.json();
    const baseTreeSha = commitData?.tree?.sha;

    // 3. Crear el nuevo tree con los archivos
    const treePayload = {
      base_tree: baseTreeSha,
      tree: files.map((f) => ({
        path: f.path,
        mode: '100644',
        type: 'blob',
        content: f.content,
      })),
    };

    const newTreeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
      method: 'POST',
      headers,
      body: JSON.stringify(treePayload),
    });
    if (!newTreeRes.ok) {
      return { ok: false, error: 'No se pudo crear el árbol de archivos en GitHub.' };
    }
    const newTreeData = await newTreeRes.json();
    const newTreeSha = newTreeData?.sha;

    // 4. Crear el commit
    const newCommitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: message || 'Actualización desde ChimuCode',
        tree: newTreeSha,
        parents: [latestCommitSha],
      }),
    });
    if (!newCommitRes.ok) {
      return { ok: false, error: 'No se pudo registrar el commit en GitHub.' };
    }
    const newCommitData = await newCommitRes.json();
    const newCommitSha = newCommitData?.sha;

    // 5. Actualizar la referencia de la rama
    const updateRefRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ sha: newCommitSha, force: false }),
    });

    if (!updateRefRes.ok) {
      return { ok: false, error: 'No se pudo apuntar la rama al nuevo commit.' };
    }

    const commitUrl = `https://github.com/${owner}/${repo}/commit/${newCommitSha}`;
    return { ok: true, commitSha: newCommitSha, commitUrl };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error al commitear cambios en GitHub.' };
  }
}

/**
 * Abre un Pull Request desde la rama origen a la rama destino.
 */
export async function createPullRequest(
  token: string,
  owner: string,
  repo: string,
  title: string,
  body: string,
  headBranch: string,
  baseBranch: string = 'main'
): Promise<{ ok: boolean; prUrl?: string; prNumber?: number; error?: string }> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        body: body || 'Generado y desarrollado en ChimuCode.',
        head: headBranch,
        base: baseBranch,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { ok: false, error: errData.message || `Error al crear PR (${res.status}).` };
    }

    const data = await res.json();
    return {
      ok: true,
      prUrl: data.html_url,
      prNumber: data.number,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error al crear Pull Request en GitHub.' };
  }
}

/**
 * Lista los Pull Requests abiertos de un repositorio.
 */
export async function listPullRequests(
  token: string,
  owner: string,
  repo: string
): Promise<{ ok: boolean; prs?: GitHubPR[]; error?: string }> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=15`, {
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (!res.ok) return { ok: false, error: `Error ${res.status}` };
    const data = await res.json();
    const prs: GitHubPR[] = data.map((p: any) => ({
      id: p.id,
      number: p.number,
      title: p.title,
      html_url: p.html_url,
      state: p.state,
      user: { login: p.user?.login || 'desconocido' },
      created_at: p.created_at,
    }));
    return { ok: true, prs };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error al listar Pull Requests.' };
  }
}

/**
 * Lista los Issues abiertos de un repositorio.
 */
export async function listIssues(
  token: string,
  owner: string,
  repo: string
): Promise<{ ok: boolean; issues?: GitHubIssue[]; error?: string }> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=15`, {
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (!res.ok) return { ok: false, error: `Error ${res.status}` };
    const data = await res.json();
    const issues: GitHubIssue[] = (data || [])
      .filter((i: any) => !i.pull_request)
      .map((i: any) => ({
        id: i.id,
        number: i.number,
        title: i.title,
        html_url: i.html_url,
        state: i.state,
        user: { login: i.user?.login || 'desconocido' },
        created_at: i.created_at,
      }));
    return { ok: true, issues };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error al listar Issues.' };
  }
}
