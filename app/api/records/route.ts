import {database} from '@/db';
import {validate,checkMileageAttachment} from '@/lib/model';
import {owner,originAllowed,response,toRow,validId} from '@/lib/access';
export const dynamic='force-dynamic';
export async function GET(){try{const id=await owner();if(!id)return response({error:'Please sign in.'},401);const q=await database().query('SELECT * FROM closing_desk.records WHERE owner_id=$1 ORDER BY created_at DESC',[id]);return response(q.rows.map(toRow));}catch{return response({error:'Unable to load records. Please retry.'},503);}}
export async function POST(req:Request){
 try{
 if(!originAllowed(req))return response({error:'Invalid request origin.'},403);
 const userId=await owner();if(!userId)return response({error:'Please sign in.'},401);
 let body:any;try{body=await req.json();}catch{return response({error:'Invalid request.'},400);}
 let data:any;try{data=validate(body.kind,body.data);}catch(e){return response({error:(e as Error).message},400);}
 const db=database();
 for(const [key,kind] of [['contactId','contact'],['transactionId','transaction']])if(data[key]){
 if(!validId(data[key]))return response({error:'Invalid linked record.'},400);
 const linked=await db.query('SELECT id FROM closing_desk.records WHERE id=$1 AND kind=$2 AND owner_id=$3',[data[key],kind,userId]);
 if(!linked.rows.length)return response({error:'Linked record not found.'},400);
 }
 if(data.linkedId){
  const kindMap:any={Showing:'showing',Meeting:'note',Training:'note',Transaction:'transaction',Contact:'contact',Activity:'note',Other:'note'};
  const linkedKind=kindMap[data.linkedType];
  if(!linkedKind||!validId(data.linkedId))return response({error:'Invalid mileage attachment.'},400);
  const linked=await db.query('SELECT * FROM closing_desk.records WHERE id=$1 AND kind=$2 AND owner_id=$3',[data.linkedId,linkedKind,userId]);
  if(!linked.rows.length)return response({error:'The mileage attachment was not found.'},400);
  try{checkMileageAttachment(data,toRow(linked.rows[0]));}catch(e){return response({error:(e as Error).message},400);}
 }
 if(body.id){
 if(!validId(body.id)||typeof body.updatedAt!=='string'||!Number.isFinite(Date.parse(body.updatedAt)))return response({error:'Invalid record version.'},400);
 const q=await db.query(`UPDATE closing_desk.records SET data=$1,updated_at=date_trunc('milliseconds',clock_timestamp()) WHERE id=$2 AND owner_id=$3 AND kind=$4 AND updated_at=$5::timestamptz RETURNING *`,[JSON.stringify(data),body.id,userId,body.kind,body.updatedAt]);
 if(!q.rows.length)return response({error:'This record changed or is unavailable. Reload before saving.'},409);
 return response(toRow(q.rows[0]));
 }
 const q=await db.query(`INSERT INTO closing_desk.records(id,owner_id,kind,data,created_at,updated_at) VALUES($1,$2,$3,$4,date_trunc('milliseconds',now()),date_trunc('milliseconds',now())) RETURNING *`,[crypto.randomUUID(),userId,body.kind,JSON.stringify(data)]);
 return response(toRow(q.rows[0]));
 }catch{return response({error:'Unable to save. Please retry.'},503);}
}
