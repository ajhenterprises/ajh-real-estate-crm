import {database} from '@/db';
import {putFile,deleteFile} from '@/lib/storage';
import {owner,originAllowed,response,validId} from '@/lib/access';
export async function POST(req:Request){let key='';try{
 if(!originAllowed(req))return response({error:'Invalid request origin.'},403);
 const userId=await owner();if(!userId)return response({error:'Please sign in.'},401);
 const form=await req.formData(),file=form.get('file');
 if(!(file instanceof File)||!file.size)return response({error:'Choose a file.'},400);
 if(file.size>4*1024*1024)return response({error:'Files must be 4 MB or smaller.'},400);
 const allowed=['application/pdf','image/jpeg','image/png','text/plain','text/csv','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
 if(!allowed.includes(file.type))return response({error:'Use a PDF, JPG, PNG, TXT, CSV, or Word document.'},400);
 const data:any={name:file.name.slice(0,200),type:file.type,size:file.size,transactionId:String(form.get('transactionId')||''),expenseId:String(form.get('expenseId')||'')};
 for(const [field,kind] of [['transactionId','transaction'],['expenseId','expense']])if(data[field]){
 if(!validId(data[field]))return response({error:'Invalid linked record.'},400);
 const linked=await database().query('SELECT id FROM closing_desk.records WHERE id=$1 AND kind=$2 AND owner_id=$3',[data[field],kind,userId]);if(!linked.rows.length)return response({error:'Linked record not found.'},400);
 }
 const id=crypto.randomUUID();key=`closing-desk/${userId}/${id}`;data.key=key;
 await putFile(key,file);
 await database().query(`INSERT INTO closing_desk.records(id,owner_id,kind,data,created_at,updated_at) VALUES($1,$2,'document',$3,date_trunc('milliseconds',now()),date_trunc('milliseconds',now()))`,[id,userId,JSON.stringify(data)]);
 return response({id});
 }catch{if(key)await deleteFile(key).catch(()=>{});return response({error:'Upload failed. Please retry or check your storage connection.'},503);}}
