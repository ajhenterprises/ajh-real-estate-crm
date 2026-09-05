import pg from 'pg';
import {createHash} from 'node:crypto';
import {S3Client,GetObjectCommand,PutObjectCommand,HeadObjectCommand} from '@aws-sdk/client-s3';
const owner='cmtkxlpsd000004l6fl2plnd7';
const env=process.env;
// This explicit one-time migration is restricted to the verified CRM owner.
if(env.VERCEL_PROJECT_PRODUCTION_URL!=='ajh-closing-desk.vercel.app'){console.log('Legacy import skipped outside Closing Desk production project.');process.exit(0);}
const pool=new pg.Pool({connectionString:env.DATABASE_URL,max:1,connectionTimeoutMillis:15000});
const db=await pool.connect();
const id=(table,value)=>value?(()=>{const h=createHash('sha256').update(`ajh-import:${owner}:${table}:${value}`).digest('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;})():'';
const day=v=>v?new Date(v).toISOString().slice(0,10):'';
const title=v=>String(v||'').toLowerCase().replace(/_/g,' ').replace(/^./,c=>c.toUpperCase());
const cents=v=>v==null?'':Math.round(Number(v)*100);
const notes=(r,extra=[])=>[r.notes,r.description,...extra].filter(Boolean).join('\n');
try{
 await db.query('BEGIN');
 await db.query('SELECT pg_advisory_xact_lock(814236908)');
 await db.query('CREATE TABLE IF NOT EXISTS closing_desk.import_runs (owner_id text PRIMARY KEY, completed_at timestamptz NOT NULL, counts jsonb NOT NULL)');
 if((await db.query('SELECT 1 FROM closing_desk.import_runs WHERE owner_id=$1',[owner])).rowCount){await db.query('COMMIT');console.log('Legacy CRM import already completed.');process.exitCode=0;}
 else {
 const users=await db.query('SELECT name FROM public.users WHERE id=$1',[owner]);
 if(users.rows[0]?.name!=='Aaron Hall')throw Error('Unexpected source account');
 const records={};
 for(const [table,field] of [['contacts','ownerId'],['transactions','ownerId'],['tasks','assignedUserId'],['showings','ownerId'],['expenses','ownerId'],['mileage_records','ownerId'],['documents','uploadedByUserId']])records[table]=(await db.query(`SELECT * FROM public.${table} WHERE "${field}"=$1`,[owner])).rows;
 records.contact_activities=(await db.query('SELECT a.* FROM public.contact_activities a JOIN public.contacts c ON c.id=a."contactId" WHERE c."ownerId"=$1',[owner])).rows;
 const categories=Object.fromEntries((await db.query('SELECT id,name FROM public.expense_categories WHERE "ownerId"=$1 OR "ownerId" IS NULL',[owner])).rows.map(r=>[r.id,r.name]));
 const own=(table,value)=>!value||records[table].some(r=>r.id===value);
 const link=(table,value)=>{if(!own(table,value))throw Error('Source relationship crosses account boundary');return id(table,value);};
 const counts={};
 async function save(table,r,kind,data){
  data.legacySource={table,id:r.id,record:r};
  const result=await db.query(`INSERT INTO closing_desk.records(id,owner_id,kind,data,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING`,[id(table,r.id),owner,kind,JSON.stringify(data),r.createdAt||r.uploadedAt||new Date(),r.updatedAt||r.createdAt||r.uploadedAt||new Date()]);
  counts[kind]=(counts[kind]||0)+result.rowCount;
 }
 for(const r of records.contacts)await save('contacts',r,'contact',{name:[r.firstName,r.lastName].filter(Boolean).join(' '),email:r.email||'',phone:r.phone||'',type:({BUYER:'Buyer',SELLER:'Seller',BUYER_AND_SELLER:'Buyer & seller'})[r.clientType]||({LEAD:'Lead',PAST_CLIENT:'Past client',VENDOR:'Vendor'})[r.contactType]||'Other',status:({LEAD:'New',ACTIVE_CLIENT:'Active',INACTIVE_CLIENT:'Nurture',PAST_CLIENT:'Past client'})[r.contactType]||'Active',source:({FOLLOW_UP_BOSS:'Follow Up Boss',BOLDTRAIL:'BoldTrail',REALTOR_COM:'Realtor.com'})[r.source]||title(r.source),followUp:day(r.nextFollowUpDate),notes:notes(r,[r.preferredName&&`Preferred name: ${r.preferredName}`,r.secondaryPhone&&`Other phone: ${r.secondaryPhone}`,[r.address,r.city,r.state,r.zip].filter(Boolean).join(', ')])});
 for(const r of records.transactions)await save('transactions',r,'transaction',{name:[r.propertyAddress,r.propertyCity,r.propertyState,r.propertyZip].filter(Boolean).join(', ')||'Imported transaction',contactId:link('contacts',r.contactId),side:title(r.type),status:({PROSPECT:'Prospecting',UNDER_CONTRACT:'Under contract',PENDING:'Closing'})[r.status]||title(r.status),price:cents(r.purchasePrice??r.listingPrice),commission:cents(r.commissionAmount),date:day(r.actualClosingDate||r.expectedClosingDate),notes:notes(r)});
 for(const r of records.tasks)await save('tasks',r,'task',{name:r.title,date:day(r.dueDate),priority:r.priority==='URGENT'?'High':title(r.priority),status:r.status==='PENDING'?'Open':'Complete',contactId:link('contacts',r.contactId),transactionId:link('transactions',r.transactionId),notes:notes(r,[r.status==='CANCELLED'?'Original status: Cancelled':'',r.category])});
 for(const r of records.showings){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(r.scheduledAt)).map(p=>[p.type,p.value]));await save('showings',r,'showing',{name:r.propertyAddress,contactId:link('contacts',r.contactId),date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`,status:title(r.status),notes:notes(r)});}
 for(const r of records.expenses)await save('expenses',r,'expense',{name:r.vendor,amount:cents(r.amount),date:day(r.expenseDate),category:categories[r.categoryId]||'Other',status:({NEEDS_REVIEW:'Needs review',NOT_DEDUCTIBLE:'Not deductible',DEDUCTIBLE:'Deductible'})[r.deductibleStatus],businessUse:r.businessUsePercent??'',transactionId:link('transactions',r.transactionId),contactId:link('contacts',r.contactId),notes:notes(r,[r.businessPurpose,`Payment method: ${title(r.paymentMethod)}`])});
 for(const r of records.mileage_records)await save('mileage_records',r,'mileage',{name:r.businessPurpose,date:day(r.date),from:r.startLocation,to:r.destination,miles:Number(r.miles),linkedType:r.transactionId?'Transaction':r.contactId?'Contact':'',linkedId:r.transactionId?link('transactions',r.transactionId):link('contacts',r.contactId),notes:notes(r)});
 for(const r of records.contact_activities)await save('contact_activities',r,'note',{name:r.description.slice(0,500),type:({CALL:'Call',EMAIL:'Email',TEXT:'Text',NOTE_ADDED:'Note'})[r.type]||'Other',date:day(r.createdAt),contactId:link('contacts',r.contactId),notes:r.description});
 const docs=records.documents.filter(r=>r.status!=='PENDING_DELETION');
 if(docs.length){
  if(!env.S3_BUCKET||!env.S3_ACCESS_KEY_ID||!env.S3_SECRET_ACCESS_KEY)throw Error('Storage settings missing');
  const s3=new S3Client({region:env.S3_REGION,endpoint:env.S3_ENDPOINT,forcePathStyle:env.S3_FORCE_PATH_STYLE==='true',credentials:{accessKeyId:env.S3_ACCESS_KEY_ID,secretAccessKey:env.S3_SECRET_ACCESS_KEY}});
  for(const r of docs){
   const key=`closing-desk/${owner}/${id('documents',r.id)}`;
   const obj=await s3.send(new GetObjectCommand({Bucket:env.S3_BUCKET,Key:r.storagePath}));
   const body=await obj.Body.transformToByteArray();
   await s3.send(new PutObjectCommand({Bucket:env.S3_BUCKET,Key:key,Body:body,ContentType:obj.ContentType||'application/octet-stream'}));
   const check=await s3.send(new HeadObjectCommand({Bucket:env.S3_BUCKET,Key:key}));
   if(check.ContentLength!==body.length)throw Error('Document copy size mismatch');
   await save('documents',r,'document',{name:r.filename,key,type:obj.ContentType||r.mimeType||'application/octet-stream',size:body.length,contactId:link('contacts',r.contactId),transactionId:link('transactions',r.transactionId),expenseId:link('expenses',r.expenseId)});
  }
 }
 await db.query('INSERT INTO closing_desk.import_runs VALUES($1,now(),$2)',[owner,JSON.stringify(counts)]);
 await db.query('COMMIT');console.log('Legacy CRM import completed:',JSON.stringify(counts));
 }
}catch(error){await db.query('ROLLBACK');console.error('Legacy import stopped. Original records preserved. Error type:',error.name,'code:',error.code||error.Code||'unknown');process.exitCode=1;}finally{db.release();await pool.end();}
