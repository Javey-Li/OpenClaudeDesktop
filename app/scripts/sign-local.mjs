import path from 'node:path';
import {execFileSync} from 'node:child_process';
const app=path.resolve(import.meta.dirname,'../../releases/Code Desktop-darwin-arm64/Code Desktop.app');
// Ad-hoc signing for this local Mac build, not a notarized distribution signature.
execFileSync('codesign',['--force','--deep','--sign','-','--preserve-metadata=entitlements',app],{stdio:'inherit'});
execFileSync('codesign',['--verify','--deep','--strict',app],{stdio:'inherit'});
console.log('Local ad-hoc signature verified.');
