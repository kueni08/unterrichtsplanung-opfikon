// Generates initial credentials locally; never commit the resulting SQL or passwords.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hashPassword, token } from '../shared/security.ts';
const folder = resolve(process.argv[2] || 'work/bootstrap');
await mkdir(folder, { recursive: true });
const accounts = [{ username: 'koordination', name: 'Koordination', role: 'admin', teacherId: 't1' }, { username: 'nici', name: 'Nici', role: 'teacher', teacherId: 't1' }];
let sql=''; let text='# Persönliche Startzugänge\n\nVertraulich – nicht in GitHub hochladen. Passwörter nach der ersten Anmeldung unter „Konto & Teamzugänge“ ändern.\n\n';
for (const account of accounts) {
  const password=token().slice(0,24); const hash=await hashPassword(password);
  sql+=`INSERT OR IGNORE INTO users(id,username,name,password_hash,role,teacher_id) VALUES('${crypto.randomUUID()}','${account.username}','${account.name}','${hash}','${account.role}','${account.teacherId}');\n`;
  text+=`- **${account.username}**: \`${password}\`\n`;
}
const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const raw=new Uint8Array(await crypto.subtle.exportKey('raw',keys.publicKey));
const jwk=await crypto.subtle.exportKey('jwk',keys.privateKey);
const publicKey=Buffer.from(raw).toString('base64url');
await writeFile(resolve(folder,'bootstrap.sql'),sql);
await writeFile(resolve(folder,'Zugaenge.md'),text);
await writeFile(resolve(folder,'push-secrets.json'),JSON.stringify({VAPID_PUBLIC_KEY:publicKey,VAPID_PRIVATE_KEY:jwk.d,VAPID_SUBJECT:'mailto:marc.kueni@gmail.com'}));
console.log('Initial accounts and push keys prepared in the requested private folder.');
