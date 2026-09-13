#!/usr/bin/env node
/**
 * Publication vers le dépôt PUBLIC mister-guiiug/mister-family-map, exécutée
 * depuis le poste de travail — AUCUNE minute GitHub Actions consommée, aucun
 * secret à configurer : le push utilise vos identifiants git habituels.
 *
 * Ne publie QUE la BRANCHE PAR DÉFAUT du dépôt privé et, sur demande, un tag
 * v* atteignable depuis elle. Jamais une autre branche.
 *
 * Elle était codée en dur à `main`, et ça a coûté trois semaines de dérive :
 * la branche par défaut de ce dépôt n'est pas `main`, les PR atterrissaient
 * donc ailleurs, `main` ne bougeait plus, et le miroir public publiait
 * fidèlement une branche morte — 27 paquets de retard sans que rien ne le
 * signale. Le workflow `sync-from-private.yml` lit déjà la branche par défaut
 * à l'exécution ; ce script fait désormais pareil, et les deux mécanismes
 * désignent enfin la même chose.
 *
 * La DESTINATION publique, elle, reste `main` : c'est la branche du miroir.
 *
 * Usage :
 *   npm run mirror                        # publie la branche par défaut
 *   npm run mirror:snapshot               # publie un instantané filtré
 *   npm run mirror -- --tag v0.1.0        # publie la branche + le tag v0.1.0
 *   npm run mirror -- --dry-run           # montre ce qui serait poussé
 *   npm run mirror -- --skip-verify       # saute le contrôle qualité (déconseillé)
 *   npm run mirror -- --forcer            # publie MÊME si le miroir a de l'avance
 *                                         # (ses commits en trop sont EFFACÉS)
 *   npm run mirror -- --remote git@github.com:mister-guiiug/mister-family-map.git
 *
 * Modes :
 *   mirror   (défaut) : la branche publiée à l'identique (historique complet).
 *   snapshot          : son arbre (ou celui du tag) filtré par
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

/** Branche du MIROIR public. Elle ne dépend pas de celle du privé. */
const BRANCHE_PUBLIQUE = 'main';

/**
 * La branche par défaut du dépôt privé, lue à l'exécution.
 *
 * `refs/remotes/origin/HEAD` est un miroir LOCAL de ce que le serveur annonce,
 * et il peut dater : un `git remote set-head origin -a` le rafraîchit, et c'est
 * ce qu'on fait ici avant de le lire. Sans ce rafraîchissement, changer la
 * branche par défaut côté GitHub ne serait vu par personne.
 *
 * Repli sur `main` si le dépôt n'a pas de HEAD distant (clone partiel, remote
 * ajouté à la main) — c'est le comportement d'avant, donc pas une surprise.
 */
function brancheParDefaut() {
  try {
    git(['remote', 'set-head', 'origin', '-a']);
  } catch {
    // Pas de remote `origin`, ou pas de réseau : on lira la valeur en cache.
  }
  try {
    const ref = git(['symbolic-ref', 'refs/remotes/origin/HEAD']);
    return ref.replace('refs/remotes/origin/', '');
  } catch {
    return BRANCHE_PUBLIQUE;
  }
}

function parseArgs(argv) {
  const args = {
    mode: 'mirror',
    tag: null,
    remote: DEFAULT_REMOTE,
    dryRun: false,
    skipVerify: false,
    forcer: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--mode') args.mode = argv[++i] ?? '';
    else if (a === '--tag') args.tag = argv[++i] ?? null;
    else if (a === '--remote') args.remote = argv[++i] ?? DEFAULT_REMOTE;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--skip-verify') args.skipVerify = true;
    else if (a === '--forcer') args.forcer = true;
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

/**
 * Lance `npm run <script>`, y compris sous Windows.
 *
 * POURQUOI CE DÉTOUR. Sous Windows, `npm` n'est pas un exécutable mais
 * `npm.cmd` : `execFileSync('npm', …)` échoue en `ENOENT`, et le viser
 * directement échoue en `EINVAL` depuis que Node refuse de lancer un `.cmd`
 * sans shell (CVE-2024-27980).
 *
 * On appelle donc le CLI npm AVEC LE MÊME NODE. `npm_execpath` est posé par
 * npm lui-même, et ce script s'invoque par `npm run mirror` : le chemin est
 * donc là, et l'on évite le shell — dont Node déprécie l'usage avec des
 * arguments (DEP0190). Le repli n'existe que pour un `node scripts/mirror.mjs`
 * lancé à la main.
 */
function npmRun(script, options = {}) {
  const npmCli = process.env.npm_execpath;
  if (npmCli?.endsWith('.js')) {
    return execFileSync(process.execPath, [npmCli, 'run', script], {
      stdio: 'inherit',
      ...options,
    });
  }
  return execFileSync('npm', ['run', script], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  // Pré-requis : arbre propre, branche source présente et à jour du remote privé.
  if (git(['status', '--porcelain']) !== '')
    fail(
      'Arbre de travail non propre — committez ou remisez avant de publier.'
    );

  const source = brancheParDefaut();
  try {
    git(['rev-parse', '--verify', source]);
  } catch {
    fail(
      `La branche ${source} n’existe pas localement (git fetch origin ${source} && git checkout ${source}).`
    );
  }
  const behind = git(['rev-list', '--count', `${source}..origin/${source}`]);
  if (behind !== '0')
    fail(
      `${source} local est en retard de ${behind} commit(s) sur origin/${source} — faites un pull d’abord.`
    );

  const srcRef = args.tag ?? source;
  if (args.tag) {
    try {
      git(['rev-parse', '--verify', `refs/tags/${args.tag}`]);
    } catch {
      fail(`Le tag ${args.tag} n’existe pas localement.`);
    }
    try {
      git(['merge-base', '--is-ancestor', srcRef, source]);
    } catch {
      fail(
        `Le tag ${args.tag} n’est pas atteignable depuis ${source} — non publiable.`
      );
    }
  }

  // Contrôle qualité : remplace la CI (aucun runner privé disponible).
  if (!args.skipVerify) {
    console.log('▶ npm run verify (format · lint · types · tests · build)…');
    npmRun('verify');
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
    garderLeMiroir(args, srcSha);
    push([
      '--force',
      args.remote,
      `refs/heads/${source}:refs/heads/${BRANCHE_PUBLIQUE}`,
    ]);
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

/**
 * Refuse de publier quand le miroir porte des commits que la source n'a pas.
 *
 * La publication est un `git push --force` : sans cette garde, elle EFFACE.
 * Ce n'est pas théorique — le 06/09/2026 le développement est passé du privé au
 * public sans que le miroir suive, et huit commits ont été perdus. Le workflow
 * `sync-from-private.yml` porte cette garde depuis ; le script, qui pousse
 * pourtant avec les mêmes armes, ne l'avait pas.
 *
 * Elle compte, et surtout elle NOMME ce qui disparaîtrait : un nombre seul ne
 * permet pas de décider.
 */
function garderLeMiroir(args, srcSha) {
  const tete = git([
    'ls-remote',
    args.remote,
    `refs/heads/${BRANCHE_PUBLIQUE}`,
  ]);
  if (tete === '') return; // miroir vide : rien à perdre
  const distant = tete.split('\t')[0];

  // La référence distante n'est pas dans le dépôt local tant qu'on ne l'a pas
  // cherchée — `merge-base` répondrait « not a valid object » au lieu de trancher.
  try {
    git(['fetch', '--quiet', args.remote, `refs/heads/${BRANCHE_PUBLIQUE}`]);
  } catch {
    fail(
      `Impossible de lire ${BRANCHE_PUBLIQUE} sur le miroir — publication annulée.`
    );
  }

  try {
    git(['merge-base', '--is-ancestor', distant, srcSha]);
    return; // le miroir est un ancêtre : la publication n'ajoute que du neuf
  } catch {
    // Le miroir a divergé — on liste avant de refuser.
  }

  const perdus = git(['log', '--oneline', `${srcSha}..${distant}`]);
  const lignes = perdus === '' ? [] : perdus.split('\n');
  if (args.forcer) {
    console.warn(
      `⚠ --forcer : ${lignes.length} commit(s) du miroir vont être EFFACÉS.`
    );
    for (const l of lignes) console.warn(`    ${l}`);
    return;
  }
  fail(
    `Le miroir porte ${lignes.length} commit(s) absent(s) de la source — un ` +
      `push --force les effacerait :\n` +
      lignes.map(l => `    ${l}`).join('\n') +
      `\n  Réconciliez d'abord — les deux commandes, telles quelles :\n` +
      `    git fetch ${args.remote} ${BRANCHE_PUBLIQUE}\n` +
      `    git merge FETCH_HEAD\n` +
      `  ou relancez avec --forcer, en connaissance de cause.`
  );
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

    // Parent = branche publique actuelle → historique public linéaire, sans
    // jamais pousser l'historique privé.
    let parent = '';
    const tetePublique = git([
      'ls-remote',
      args.remote,
      `refs/heads/${BRANCHE_PUBLIQUE}`,
    ]);
    if (tetePublique !== '') {
      parent = tetePublique.split('\t')[0] ?? '';
      if (parent) git(['fetch', args.remote, `refs/heads/${BRANCHE_PUBLIQUE}`]);
    }

    // `srcRef` vaut déjà le tag demandé, ou la branche par défaut du privé.
    const label = srcRef;
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
    push([args.remote, `${commit}:refs/heads/${BRANCHE_PUBLIQUE}`]);
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
