#!/usr/bin/env node
// Optional production build. Source index.html stays usable; publish .cache/client-build/index.html last.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { build, transform } from 'esbuild';
import { parse } from 'acorn';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '.cache/client-build');
await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(path.join(out, 'assets'), { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex').slice(0, 16);
const browserPath = abs => {
  const rel = path.relative(root, abs).split(path.sep).join('/');
  return '/' + (rel.startsWith('public/') ? rel.slice(7) : rel);
};
let nativeUrl = null;
let rehearsalUrl = '/js/battle/rehearsalWorker.js';
const browserPlugin = () => ({ name: 'browser-module-contracts', setup(b) {
  b.onResolve({ filter: /nativeSim\.js$/ }, args => {
    if (nativeUrl && path.resolve(args.resolveDir, args.path) === path.join(root, 'public/js/battle/nativeSim.js')) return { path: nativeUrl, external: true };
  });
  b.onResolve({ filter: /^\/sim\// }, args => ({ path: path.join(root, 'server', args.path) }));
  b.onResolve({ filter: /^\// }, args => ({ path: args.path, external: true }));
  b.onResolve({ filter: /data\.js$/ }, args => {
    if (path.resolve(args.resolveDir, args.path) === path.join(root, 'server/data.js')) {
      return { path: 'browser-data', namespace: 'browser-data' };
    }
  });
  b.onLoad({ filter: /.*/, namespace: 'browser-data' }, () => ({
    contents: `import { getSimData } from '/sim/simdata.js';
      export function getData() { return getSimData() || {}; } export function resetData() {}`,
    loader: 'js', resolveDir: root,
  }));
  b.onLoad({ filter: /\.js$/ }, async args => {
    if (args.path === path.join(root, 'server/sim/nodeData.js')) throw new Error('Node-only simulation loader entered browser build');
    let original = await fs.readFile(args.path, 'utf8');
    if (args.path === path.join(root, 'server/sim/simdata.js')) {
      const branch = parse(original, { ecmaVersion: 'latest', sourceType: 'module' }).body.find(n =>
        n.type === 'IfStatement' && n.test.type === 'Identifier' && n.test.name === 'IS_NODE');
      if (!branch || branch.alternate) throw new Error('Cannot identify Node-only simulation initializer');
      original = original.slice(0, branch.start) + original.slice(branch.end);
    }
    const guardedImports = {
      'server/sim/content/index.js': ['./kits/index.js', './tokens.js', './devices.js', './enemies.js', './bosses.js',
        './bonds.js', './garrisons.js', './items.js', './bands.js', './choices.js'],
      'server/sim/content/bonds.js': ['./bonds/core.js', './bonds/addon.js', './support/meta.js'],
      'server/sim/content/bands.js': ['./bands/battle.js', './bands/meta.js'],
    }[path.relative(root, args.path).split(path.sep).join('/')];
    if (guardedImports) {
      const declared = [...original.matchAll(/\b(?:safeImport|load)\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);
      const domains = parse(original, { ecmaVersion: 'latest', sourceType: 'module' }).body
        .filter(n => n.type === 'VariableDeclaration').flatMap(n => n.declarations).find(n => n.id.name === 'DOMAIN_NAMES');
      if (domains) declared.push(...domains.init.elements.map(n => `./${n.value}.js`));
      if (JSON.stringify([...new Set(declared)].sort()) !== JSON.stringify([...guardedImports].sort())) {
        throw new Error('Guarded content registry changed; update browser build mapping');
      }
      // Preserve guarded loading while making its finite module registry visible to the bundler.
      if (original.split('import(path)').length !== 2) throw new Error('Guarded content loader changed');
      const dispatch = '{' + guardedImports.map(p => `${JSON.stringify(p)}: () => import(${JSON.stringify(p)})`).join(',') + '}';
      original = original.replace('import(path)', `(${dispatch})[path]()`);
    }
    if (args.path === path.join(root, 'public/js/battle/rehearsal.js')) {
      original = original.replace("'/js/battle/rehearsalWorker.js'", JSON.stringify(rehearsalUrl));
    }
    // Hash-pinned plugin runtimes and sandbox Worker keep their source endpoints and CSP.
    const contents = original.replace(/import\.meta\.url|\(import\.meta\)\.url/g,
      `new URL(${JSON.stringify(browserPath(args.path))}, globalThis.location.href).href`);
    return { contents, loader: 'js', resolveDir: path.dirname(args.path) };
  });
} });
const common = {
  absWorkingDir: root, bundle: true, format: 'esm', platform: 'browser', target: 'es2022',
  minify: true, metafile: true, write: false, legalComments: 'eof', plugins: [browserPlugin()],
};
// Collapse the engine's dynamic operator registry into one lazy asset rather than hundreds of chunks.
const native = await build({ ...common, entryPoints: ['public/js/battle/nativeSim.js'], outfile: path.join(out, 'native.js') });
if (Object.values(native.metafile.outputs).some(o => o.imports.some(i => i.external))) {
  throw new Error('Built-in simulation must be self-contained; found an external module');
}
const nativeName = `simulation-${hash(native.outputFiles[0].contents)}.js`;
await fs.writeFile(path.join(out, 'assets', nativeName), native.outputFiles[0].contents);
nativeUrl = `/build/assets/${nativeName}?v=${hash(native.outputFiles[0].contents)}`;
// Page and rehearsal Worker share the HTTP asset, with independent state in each realm.
const rehearsal = await build({ ...common, entryPoints: ['public/js/battle/rehearsalWorker.js'],
  outfile: path.join(out, 'rehearsal-worker.js') });
const rehearsalName = `rehearsal-worker-${hash(rehearsal.outputFiles[0].contents)}.js`;
await fs.writeFile(path.join(out, 'assets', rehearsalName), rehearsal.outputFiles[0].contents);
rehearsalUrl = `/build/assets/${rehearsalName}?v=${hash(rehearsal.outputFiles[0].contents)}`;
const result = await build({
  ...common, entryPoints: { main: 'public/js/main.js' },
  outdir: path.join(out, 'assets'), entryNames: '[name]-[hash]', chunkNames: 'chunk-[hash]',
  splitting: true,
});
// The existing static server already gives ?v= URLs immutable caching. Include it
// in every generated chunk reference; do not change cache policy for source JS/JSON.
const urlFor = name => `/build/assets/${name}?v=${name.match(/-([A-Z0-9]+)\.js$/)?.[1] || hash(name)}`;
for (const file of result.outputFiles) {
  const text = file.text.replace(/(["'])\.\/(chunk-[A-Z0-9]+\.js)\1/g,
    (_, q, name) => `${q}./${name}?v=${name.match(/-([A-Z0-9]+)\.js$/)[1]}${q}`);
  await fs.writeFile(file.path, text);
}
const entry = Object.entries(result.metafile.outputs).find(([, v]) => v.entryPoint === 'public/js/main.js');
if (!entry) throw new Error('Missing client entry');
const main = path.basename(entry[0]);
let html = await fs.readFile(path.join(root, 'public/index.html'), 'utf8');
const cssPaths = [...html.matchAll(/<link rel="stylesheet" href="(\/css\/[^"?]+)"\s*\/>/g)].map(m => m[1]);
const css = (await Promise.all(cssPaths.map(p => fs.readFile(path.join(root, 'public', p), 'utf8')))).join('\n');
const compiledCss = (await transform(css, { loader: 'css', minify: true, target: 'es2022' })).code;
const cssName = `styles-${hash(compiledCss)}.css`;
await fs.writeFile(path.join(out, 'assets', cssName), compiledCss);
html = html.replace(/<link rel="stylesheet" href="\/css\/[^"?]+"\s*\/>/g, '');
html = html.replace(/<link rel="modulepreload"[^>]+\/>/g, '');
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, '');
html = html.replace('src="/js/main.js"', `src="${urlFor(main)}"`);
const chunks = entry[1].imports.filter(i => !i.external && i.kind === 'import-statement').map(i => path.basename(i.path));
html = html.replace('</head>', `<link rel="stylesheet" href="/build/assets/${cssName}?v=${hash(compiledCss)}" />\n`
  + [main, ...chunks].map(n => `<link rel="modulepreload" href="${urlFor(n)}" />`).join('\n') + '\n</head>');
await fs.writeFile(path.join(out, 'index.html'), html);
await fs.writeFile(path.join(out, 'metafile.json'), JSON.stringify({ ...result.metafile,
  simulation: native.metafile, rehearsal: rehearsal.metafile }, null, 2));
console.log(JSON.stringify({ output: out, main, css: cssName, chunks: result.outputFiles.length, simulation: nativeName, simulationBytes: native.outputFiles[0].contents.length, rehearsal: rehearsalName, rehearsalBytes: rehearsal.outputFiles[0].contents.length,
  inputModules: Object.keys(result.metafile.inputs).length,
  jsBytes: result.outputFiles.reduce((n, f) => n + f.contents.length, 0), cssFilesCombined: cssPaths.length }, null, 2));
