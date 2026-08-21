#!/usr/bin/env node
/**
 * Publication vers le dépôt PUBLIC mister-guiiug/mister-family-map, exécutée
 * depuis le poste de travail — AUCUNE minute GitHub Actions consommée, aucun
 * secret à configurer : le push utilise vos identifiants git habituels.
 *
 * Ne publie QUE la branche main et, sur demande, un tag v* atteignable
 * depuis main. Jamais une autre branche.
 *
 * Usage :
 *   npm run mirror                        # publie main (mode mirror)
 *   npm run mirror:snapshot               # publie un instantané filtré
 *   npm run mirror -- --tag v0.1.0        # publie main + le tag v0.1.0
 *   npm run mirror -- --dry-run           # montre ce qui serait poussé
 *   npm run mirror -- --skip-verify       # saute le contrôle qualité (déconseillé)
 *   npm run mirror -- --remote git@github.com:mister-guiiug/mister-family-map.git
 *
 * Modes :
 *   mirror   (défaut) : main publié à l'identique (historique complet).
 *   snapshot          : arbre de main (ou du tag) filtré par
 *                       .github/mirror-exclude.txt, SANS l'historique privé —
 *                       un commit public par publication, chaîné au précédent.
 *
 * Garde-fou qualité : `npm run verify` (format, lint, types, tests, build)
 * doit passer avant tout push — la publication remplace la CI privée.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_REMOTE = 'https://github.com/mister-guiiug/mister-family-map.git';
const EXCLUDE_FILE = '.github/mirror-exclude.txt';

function parseArgs(argv) {
  const args = {
    mode: 'mirror',
    tag: null,
    remote: DEFAULT_REMOTE,
    dryRun: false,
    skipVerify: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--mode') args.mode = argv[++i] ?? '';
    else if (a === '--tag') args.tag = argv[++i] ?? null;
    else if (a === '--remote') args.remote = argv[++i] ?? DEFAULT_REMOTE;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--skip-verify') args.skipVerify = true;
    else fail(`Option inconnue : ${a}`);
  }
  if (!['mirror', 'snapshot'].includes(args.mode))
    fail(`--mode doit être mirror ou snapshot (reçu : ${args.mode})`);
  if (args.tag && !/^v\d/.test(args.tag))
    fail(`Seuls les tags v* sont publiables (reçu : ${args.tag})`);
  return args;
}

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function git(gitArgs, options = {}) {
  return execFileSync('git', gitArgs, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  // Pré-requis : arbre propre, branche main présente et à jour du remote privé.
  if (git(['status', '--porcelain']) !== '')
    fail(
      'Arbre de travail non propre — committez ou remisez avant de publier.'
    );
  try {
    git(['rev-parse', '--verify', 'main']);
  } catch {
    fail(
      'La branche main n’existe pas localement (git fetch origin main && git checkout main).'
    );
  }
  const behind = git(['rev-list', '--count', 'main..origin/main']);
  if (behind !== '0')
    fail(
      `main local est en retard de ${behind} commit(s) sur origin/main — faites un pull d’abord.`
    );

  const srcRef = args.tag ?? 'main';
  if (args.tag) {
    try {
      git(['rev-parse', '--verify', `refs/tags/${args.tag}`]);
    } catch {
      fail(`Le tag ${args.tag} n’existe pas localement.`);
    }
    try {
      git(['merge-base', '--is-ancestor', srcRef, 'main']);
    } catch {
      fail(
        `Le tag ${args.tag} n’est pas atteignable depuis main — non publiable.`
      );
    }
  }

  // Contrôle qualité : remplace la CI (aucun runner privé disponible).
  if (!args.skipVerify) {
    console.log('▶ npm run verify (format · lint · types · tests · build)…');
    execFileSync('npm', ['run', 'verify'], { stdio: 'inherit' });
  } else {
    console.warn('⚠ --skip-verify : publication sans contrôle qualité.');
  }

  const srcSha = git(['rev-parse', srcRef]);
  console.log(
    `▶ Source : ${srcRef} (${srcSha.slice(0, 12)}) · mode ${args.mode}`
  );

  const push = pushArgs => {
    if (args.dryRun) {
      console.log(`  [dry-run] git push ${pushArgs.join(' ')}`);
      return;
    }
    execFileSync('git', ['push', ...pushArgs], { stdio: 'inherit' });
  };

  if (args.mode === 'mirror') {
    push(['--force', args.remote, 'refs/heads/main:refs/heads/main']);
    if (args.tag)
      push([
        '--force',
        args.remote,
        `refs/tags/${args.tag}:refs/tags/${args.tag}`,
      ]);
  } else {
    publishSnapshot(args, srcRef, srcSha, push);
  }

  console.log('✔ Publication terminée.');
  if (args.tag) {
    console.log(
      `  Release publique (facultatif, nécessite gh) :\n` +
        `  gh release create ${args.tag} --repo mister-guiiug/mister-family-map --generate-notes`
    );
  }
}

function publishSnapshot(args, srcRef, srcSha, push) {
  // Index temporaire : on filtre l'arbre SANS toucher au worktree.
  const tmp = mkdtempSync(join(tmpdir(), 'mfm-mirror-'));
  const env = { ...process.env, GIT_INDEX_FILE: join(tmp, 'index') };
  try {
    git(['read-tree', srcRef], { env });

    let excludes = [];
    try {
      excludes = git(['show', `${srcRef}:${EXCLUDE_FILE}`], { env })
        .split('\n')
        .map(line => line.trim())
        .filter(line => line !== '' && !line.startsWith('#'));
    } catch {
      // Pas de fichier d'exclusion dans la réf source : rien à filtrer.
    }
    for (const path of excludes) {
      git(['rm', '-r', '-q', '--cached', '--ignore-unmatch', '--', path], {
        env,
      });
    }
    const tree = git(['write-tree'], { env });

    // Parent = main public actuel → historique public linéaire, sans jamais
    // pousser l'historique privé.
    let parent = '';
    const remoteMain = git(['ls-remote', args.remote, 'refs/heads/main']);
    if (remoteMain !== '') {
      parent = remoteMain.split('\t')[0] ?? '';
      if (parent) git(['fetch', args.remote, 'refs/heads/main']);
    }

    const label = args.tag ?? 'main';
    const message = `Publication publique de ${label} (source ${srcSha.slice(0, 12)})`;
    const commitArgs = ['commit-tree', tree, '-m', message];
    if (parent) commitArgs.splice(2, 0, '-p', parent);
    const commit = git(commitArgs, {
      env: {
        ...env,
        GIT_AUTHOR_NAME: 'mister-family-map mirror',
        GIT_AUTHOR_EMAIL: 'mirror@localhost',
        GIT_COMMITTER_NAME: 'mister-family-map mirror',
        GIT_COMMITTER_EMAIL: 'mirror@localhost',
      },
    });

    console.log(
      `▶ Instantané ${commit.slice(0, 12)} (${excludes.length} exclusion(s))`
    );
    push([args.remote, `${commit}:refs/heads/main`]);
    if (args.tag) {
      git(['tag', '-f', args.tag, commit]);
      push([
        '--force',
        args.remote,
        `refs/tags/${args.tag}:refs/tags/${args.tag}`,
      ]);
      // Repose le tag local sur son commit d'origine (le tag privé reste privé).
      git(['tag', '-f', args.tag, srcSha]);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

main();
