const path = require('path');
const { spawn } = require('child_process');
const { version } = require('./package.json');

function runCommand(cmd, args = []) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${cmd} ${args.join(' ')}`);

    const child = spawn(cmd, args, {
      stdio: 'inherit',
      shell: true,
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with exit code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

async function releaseExists(tag) {
  try {
    await runCommand('gh', ['release', 'view', tag]);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const tag = `${version}`;

  try {
    // -----------------------------
    // STEP 1: BUILD
    // -----------------------------
    console.log('--------------------------------');
    console.log(' Building Linux x64 Installers ');
    console.log('--------------------------------');

    await runCommand(
      path.join(__dirname, 'node_modules/.bin/electron-builder'),
      ['-l']
    );

    console.log('✔ All Linux installers created successfully!');

    // -----------------------------
    // STEP 2: CREATE OR CHECK RELEASE
    // -----------------------------
    console.log('\n--------------------------------');
    console.log(` Checking for existing release: ${tag} `);
    console.log('--------------------------------');

    if (await releaseExists(tag)) {
      console.log(`⏭ Release ${tag} already exists. Skipping creation.`);
    } else {
      console.log(`Creating new draft release: ${tag}...`);

      await runCommand('gh', [
        'release', 'create', tag,
        '--draft',
        '--title', tag,
        '--notes', 'TBD'
      ]);

      console.log(`✔ Draft release ${tag} created.`);
    }

    // -----------------------------
    // STEP 3: UPLOAD ASSETS
    // -----------------------------
    console.log('\n--------------------------------');
    console.log(` Uploading assets for ${tag} `);
    console.log('--------------------------------');

    // adjust file paths to match your actual output files
    const assetPaths = [
      '"' + path.join(__dirname, `dist/OOTP-Uniform-Maker_${version}_amd64.deb`) +'"',
      '"' + path.join(__dirname, `dist/OOTP-Uniform-Maker-${version}.x86_64.rpm`) +'"'
    ];

    await runCommand('gh', [
      'release', 'upload', tag,
      ...assetPaths,
      '--clobber'
    ]);

    console.log(`✔ Assets uploaded to ${tag}`);

    console.log('\n🎉 Build + release + upload complete!');

  } catch (err) {
    console.error('\n❌ Error during build/release/upload:', err);
    process.exit(1);
  }
}

main();
