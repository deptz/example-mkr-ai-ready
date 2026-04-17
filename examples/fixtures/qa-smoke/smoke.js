const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const fixtureRoot = __dirname;
const healthPort = process.env.PORT || '3180';
const requiredFiles = ['package.json', 'server.js', 'Dockerfile', 'docker-compose.yml'];
const requiredPackages = [
	'@playwright/test',
	'typescript',
	'express',
	'ejs',
	'connect-flash',
	'express-session',
	'express-validator',
	'pg',
	'uuid',
];

function assertFixtureFiles() {
	for (const relativePath of requiredFiles) {
		const absolutePath = path.join(fixtureRoot, relativePath);
		if (!fs.existsSync(absolutePath)) {
			throw new Error(`missing required fixture file: ${relativePath}`);
		}
	}
}

function assertInstalledPackages() {
	for (const packageName of requiredPackages) {
		require.resolve(packageName, { paths: [fixtureRoot] });
	}
}

function requestHealth(port) {
	return new Promise((resolve, reject) => {
		const req = http.get(
			{
				host: '127.0.0.1',
				port,
				path: '/health',
				timeout: 1000,
			},
			(res) => {
				let body = '';
				res.setEncoding('utf8');
				res.on('data', (chunk) => {
					body += chunk;
				});
				res.on('end', () => {
					if (res.statusCode !== 200 || !body.includes('ok')) {
						reject(new Error(`unexpected health response: ${res.statusCode} ${body}`));
						return;
					}
					resolve();
				});
			}
		);
		req.on('error', reject);
		req.on('timeout', () => {
			req.destroy(new Error('health request timed out'));
		});
	});
}

async function waitForHealth(port, timeoutMs) {
	const deadline = Date.now() + timeoutMs;
	let lastError;
	while (Date.now() < deadline) {
		try {
			await requestHealth(port);
			return;
		} catch (error) {
			lastError = error;
			await new Promise((resolve) => setTimeout(resolve, 200));
		}
	}
	throw lastError || new Error('server did not become healthy');
}

async function main() {
	assertFixtureFiles();
	assertInstalledPackages();

	const child = spawn(process.execPath, ['server.js'], {
		cwd: fixtureRoot,
		env: {
			...process.env,
			PORT: String(healthPort),
			NODE_ENV: 'test',
		},
		stdio: ['ignore', 'pipe', 'pipe'],
	});

	let stderr = '';
	child.stderr.on('data', (chunk) => {
		stderr += chunk.toString();
	});

	try {
		await waitForHealth(healthPort, 5000);
		console.log('SMOKE_OK');
	} catch (error) {
		throw new Error(stderr ? `${error.message}\n${stderr.trim()}` : error.message);
	} finally {
		child.kill('SIGTERM');
	}
}

main().catch((error) => {
	console.error(error.message);
	process.exit(1);
});