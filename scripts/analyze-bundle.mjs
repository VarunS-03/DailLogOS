import { build } from 'vite';

const reportPlugin = {
  name: 'daily-os-bundle-composition-report',
  generateBundle(_options, bundle) {
    for (const output of Object.values(bundle)) {
      if (output.type !== 'chunk') continue;
      const modules = Object.entries(output.modules)
        .map(([id, stats]) => ({
          id: id.replace(`${process.cwd()}\\`, '').replace(`${process.cwd()}/`, '').replaceAll('\\', '/'),
          bytes: stats.renderedLength,
        }))
        .sort((left, right) => right.bytes - left.bytes)
        .slice(0, 15);
      process.stdout.write(`\n${output.fileName} (${output.code.length} bytes)\n`);
      for (const module of modules) {
        process.stdout.write(`  ${String(module.bytes).padStart(8)}  ${module.id}\n`);
      }
    }
  },
};

await build({ plugins: [reportPlugin], logLevel: 'error' });
