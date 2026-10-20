// Assemble src/main.js (+ Three.js) en un seul fichier minifié : public/assets/js/main.js
// Le résultat est déjà fourni dans public/ : ce script ne sert que si vous modifiez le dossier src/.
import { build, context } from 'esbuild';

const options = {
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  outfile: 'public/assets/js/main.js',
  format: 'esm',
  target: 'es2020',
  legalComments: 'none',
  logLevel: 'info',
};

if (process.argv.includes('--watch')) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('Surveillance de src/ …');
} else {
  await build(options);
}
