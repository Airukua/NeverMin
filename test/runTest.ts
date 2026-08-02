import fs from 'fs';
import path from 'path';
import Mocha from 'mocha';

function collectTestFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      return collectTestFiles(fullPath);
    }

    return fullPath.endsWith('.js') ? [fullPath] : [];
  });
}

async function main(): Promise<void> {
  const mocha = new Mocha({
    ui: 'bdd',
    color: true
  });

  const testRoot = path.join(__dirname, 'suite');
  for (const file of collectTestFiles(testRoot)) {
    mocha.addFile(file);
  }

  await new Promise<void>((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} test(s) failed`));
        return;
      }
      resolve();
    });
  });
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
