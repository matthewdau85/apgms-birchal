#!/usr/bin/env node
'use strict';

const { randomBytes, generateKeyPairSync } = require('node:crypto');
const { stdout } = require('node:process');

const helpMessage = `Usage: node scripts/key-rotate.ts [--secret|--rsa]

Generate credentials for the API gateway JWT signer. By default a random
shared secret is produced. Use --rsa to generate a public/private key pair.
`;

const args = new Set(process.argv.slice(2));

if (args.has('--help') || args.has('-h')) {
  stdout.write(helpMessage);
  process.exit(0);
}

let mode = 'secret';
if (args.has('--rsa')) {
  mode = 'rsa';
} else if (args.has('--secret')) {
  mode = 'secret';
}

if (mode === 'secret') {
  const secret = randomBytes(48).toString('base64url');
  stdout.write('# Update your environment with the new shared secret.\n');
  stdout.write(`# Example (.env / secret manager)\n`);
  stdout.write(`JWT_SECRET=${secret}\n`);
  stdout.write('\n');
  stdout.write('# Remember to redeploy any services that cache the secret.\n');
  process.exit(0);
}

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const formatKeyForEnv = (key) => key.replace(/\r?\n/g, '\\n');

stdout.write('# RSA key pair generated. Distribute the public key and protect the private key.\n');
stdout.write('# Example (.env / secret manager)\n');
stdout.write(`JWT_PUBLIC_KEY="${formatKeyForEnv(publicKey)}"\n`);
stdout.write(`JWT_PRIVATE_KEY="${formatKeyForEnv(privateKey)}"\n`);
stdout.write('\n');
stdout.write('# When storing in a vault, prefer native multi-line secret support and\n');
stdout.write('# update services that read the keys to pick up the rotation.\n');
