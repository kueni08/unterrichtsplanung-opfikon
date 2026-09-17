import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const origin='http://localhost:8787';
const secrets=await fs.readFile(new URL('../work/bootstrap/Zugaenge.md',import.meta.url),'utf8');
function password(name) { return secrets.split(`**${name}**: `)[1].split('`')[1]; }
async function request(path,method='GET',value,session,extra={}) { return fetch(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(session?{Cookie:session}:{}),...extra},body:value===undefined?undefined:JSON.stringify(value)}); }
async function login(username) { const r=await request('/api/login','POST',{username,password:password(username)}); assert.equal(r.status,200); assert.match(r.headers.get('set-cookie'),/HttpOnly/); assert.match(r.headers.get('set-cookie'),/SameSite=Strict/); return r.headers.get('set-cookie').split(';')[0]; }
test('protected shared plan, authorisation, concurrent edits and retry safety',async()=>{
  assert.equal((await request('/api/plan')).status,401);
  assert.equal((await request('/api/login','POST',{username:'nici',password:'wrong'})).status,401);
  const admin=await login('koordination'); const teacher=await login('nici');
  assert.equal((await request('/api/users','GET',undefined,teacher)).status,403);
  assert.equal((await request('/api/logout','POST',undefined,admin,{Origin:'https://other.example'})).status,403);
  const day={attendance:[],note:'',meetings:[]};
  const current=await (await request('/api/plan','GET',undefined,admin)).json();
  const data=current.data || {groups:[],teachers:[],templates:{},weeks:{'2026-09-14':{sessions:[],days:{mo:day,di:day,mi:day,do:day,fr:day}}}};
  let revision=current.revision;
  const first={data,revision,operationId:crypto.randomUUID(),urgent:false};
  const created=await request('/api/plan','PUT',first,admin); assert.equal(created.status,200); revision=(await created.json()).revision;
  const attempt={data:structuredClone(data),revision,operationId:crypto.randomUUID(),urgent:false};
  const duplicate=await request('/api/plan','PUT',first,admin); assert.equal(duplicate.status,200); assert.equal((await duplicate.json()).revision,revision);
  const forbidden=structuredClone(attempt); forbidden.data.groups.push({id:'test',name:'Test',short:'T',color:'#123456',children:''});
  assert.equal((await request('/api/plan','PUT',forbidden,teacher)).status,403);
  const writes=await Promise.all([request('/api/plan','PUT',attempt,admin),request('/api/plan','PUT',{...attempt,operationId:crypto.randomUUID()},teacher)]);
  assert.deepEqual(writes.map(r=>r.status).sort(),[200,409]);
  const final=await (await request('/api/plan','GET',undefined,teacher)).json(); assert.equal(final.revision,revision+1);
  const invalid=await request('/api/plan','PUT',{revision:final.revision,operationId:crypto.randomUUID(),urgent:false,data:{weeks:'bad'}},admin); assert.equal(invalid.status,400);
  assert.equal((await request('/api/logout','POST',undefined,teacher)).status,200);
  assert.equal((await request('/api/me','GET',undefined,teacher)).status,401);
});
