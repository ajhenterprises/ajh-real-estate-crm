import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const source=fs.readFileSync(new URL('./import-legacy.mjs',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
const run=new (Object.getPrototypeOf(async function(){}).constructor)('pg','createHash','S3Client','GetObjectCommand','PutObjectCommand','HeadObjectCommand','process','console',source);
class Get{} class Put{constructor(input){this.input=input;}} class Head{}
async function scenario({done=false,fail=false,cross=false}={}){
 const statements=[],saved=[];
 const fixtures={contacts:[{id:'c1',firstName:'Test',lastName:'Contact',contactType:'LEAD',source:'MANUAL'}],transactions:[],tasks:[{id:'t1',title:'Call',contactId:cross?'foreign':'c1',status:'PENDING',priority:'NORMAL'}],showings:[],expenses:[{id:'e1',vendor:'Test',amount:'12.34',expenseDate:'2026-09-01',categoryId:'cat',deductibleStatus:'NEEDS_REVIEW'}],mileage_records:[],documents:[{id:'d1',filename:'receipt.txt',storagePath:'old/receipt',expenseId:'e1',status:'UPLOADED'}]};
 const db={release(){},async query(sql,args){statements.push(sql);if(sql.includes('SELECT 1 FROM'))return {rowCount:done?1:0};if(sql.includes('SELECT name'))return {rows:[{name:'Aaron Hall'}]};if(sql.includes('SELECT a.*'))return {rows:[]};if(sql.includes('SELECT id,name'))return {rows:[{id:'cat',name:'Software'}]};if(sql.startsWith('SELECT *'))return {rows:fixtures[sql.match(/public\.(\w+)/)[1]]};if(sql.includes('INSERT INTO closing_desk.records')){saved.push({id:args[0],kind:args[2],data:JSON.parse(args[3])});return {rowCount:1};}return {rows:[]};}};
 const proc={env:{VERCEL_PROJECT_PRODUCTION_URL:'ajh-closing-desk.vercel.app',S3_BUCKET:'test',S3_ACCESS_KEY_ID:'test',S3_SECRET_ACCESS_KEY:'test'}};
 class S3{async send(cmd){if(fail)throw Object.assign(Error(),{code:'Denied'});if(cmd instanceof Get)return {Body:{transformToByteArray:async()=>new Uint8Array([1,2])}};if(cmd instanceof Head)return {ContentLength:2};return {};}}
 await run({Pool:class{async connect(){return db;}async end(){}}},createHash,S3,Get,Put,Head,proc,{log(){},error(){}});
 return {statements,saved,proc};
}
const success=await scenario();assert.equal(success.saved.find(r=>r.kind==='expense').data.amount,1234);assert.equal(success.saved.find(r=>r.kind==='task').data.contactId,success.saved.find(r=>r.kind==='contact').id);assert.equal(success.saved.find(r=>r.kind==='document').data.expenseId,success.saved.find(r=>r.kind==='expense').id);assert(success.statements.includes('COMMIT'));
const repeated=await scenario({done:true});assert.equal(repeated.saved.length,0);
for(const options of [{fail:true},{cross:true}]){const result=await scenario(options);assert(result.statements.includes('ROLLBACK'));assert(!result.statements.includes('COMMIT'));assert.equal(result.proc.exitCode,1);}
console.log('Import mapping, cents, links, one-time guard, ownership, and storage failure rollback checks passed.');
