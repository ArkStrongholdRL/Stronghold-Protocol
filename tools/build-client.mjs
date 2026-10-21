#!/usr/bin/env node
// Optional production build. Source index.html stays usable; publish .cache/client-build/index.html last.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { build, transform } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '.cache/client-build');
await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(path.join(out, 'assets'), { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex').slice(0, 16);
const browserPath = abs => {
  const rel = path.relative(root, abs).split(path.sep).join('/');
  return '/' + (rel.startsWith('public/') ? rel.slice(7) : rel);
};
const result = await build({
  absWorkingDir: root, entryPoints: { main: 'public/js/main.js' },
  outdir: path.join(out, 'assets'), entryNames: '[name]-[hash]', chunkNames: 'chunk-[hash]',
  bundle: true, splitting: true, format: 'esm', platform: 'browser', target: 'es2022',
  minify: true, metafile: true, write: false, legalComments: 'eof',
  plugins: [{ name: 'preserve-original-module-urls', setup(b) {
    b.onResolve({ filter: /^\// }, args => ({ path: args.path, external: true }));
    b.onResolve({ filter: /server\/sim\/detmath\.js$/ }, () => ({ path: '/sim/detmath.js', external: true }));
    b.onLoad({ filter: /\.js$/ }, async args => {
      const original = await fs.readFile(args.path, 'utf8');
      // Workers, trait runtimes and SDK URLs retain their source location after relocation.
      const contents = original.replace(/import\.meta\.url|\(import\.meta\)\.url/g, `new URL(${JSON.stringify(browserPath(args.path))}, globalThis.location.href).href`);
      return { contents, loader: 'js', resolveDir: path.dirname(args.path) };
    });
  } }],
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
await fs.writeFile(path.join(out, 'metafile.json'), JSON.stringify(result.metafile, null, 2));
console.log(JSON.stringify({ output: out, main, css: cssName, chunks: result.outputFiles.length,
  inputModules: Object.keys(result.metafile.inputs).length,
  jsBytes: result.outputFiles.reduce((n, f) => n + f.contents.length, 0), cssFilesCombined: cssPaths.length }, null, 2));
