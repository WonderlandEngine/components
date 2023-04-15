import {chromeLauncher} from '@web/test-runner';
import {resolve} from 'path';
import {symlinkSync, existsSync, unlinkSync, lstatSync, rmdirSync} from 'fs';

function findDeployFolder() {
    if ('DEPLOY_FOLDER' in process.env) return process.env['DEPLOY_FOLDER'];

    const paths = [
        /* Windows */
        'C:/Program Files/Wonderland/WonderlandEngine/deploy',
        /* MacOS */
        '~/Applications/WonderlandEngine/Contents/Resources/deploy',
        /* Linux */
        '/usr/local/share/wonderlandengine/deploy',
    ];
    for (const path of paths) {
        if (existsSync(path)) return path;
    }
}

const deployRoot = resolve(findDeployFolder());

/* We need to relink every run in case the env var changed,
 * so first remove old link (or old deploy copy) */
if (existsSync('deploy')) {
    /* Previously, we would copy the directory instead of linking it */
    if (!lstatSync('deploy').isSymbolicLink()) {
        console.log(`Deleting old 'deploy' copy.`);
        rmdirSync('deploy', {recursive: true});
    } else {
        console.log(`Deleting old 'deploy' symlink.`);
        unlinkSync('deploy');
    }
}

console.log(`Creating symlink 'deploy' to '${deployRoot}'.`);
symlinkSync(deployRoot, 'deploy', 'junction');

export default {
    concurrency: 10,
    nodeResolve: true,
    files: ['test/**/*.test.js'],

    browsers: [
        chromeLauncher({
            launchOptions: {args: ['--no-sandbox', '--use-gl=angle']},
        }),
    ],

    /* Mocha configuration */
    testFramework: {
        config: {
            ui: 'bdd',
            timeout: '15000',
        },
    },
};
