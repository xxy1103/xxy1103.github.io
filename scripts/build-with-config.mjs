#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { enableImageOptimizationOnBuild } from '../src/config/features.mjs';

function runCommand(command) {
	execSync(command, {
		stdio: 'inherit',
	});
}

async function main() {
	if (enableImageOptimizationOnBuild) {
		console.log('[build-with-config] Image optimization is enabled. Running optimize:images...');
		runCommand('npm run optimize:images');
	} else {
		console.log('[build-with-config] Image optimization is disabled. Skipping optimize:images.');
	}

	console.log('[build-with-config] Running Astro build...');
	runCommand('npm run build:astro');
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
