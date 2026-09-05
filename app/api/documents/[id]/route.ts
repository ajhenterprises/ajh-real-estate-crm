import {database} from '@/db';
import {getFile} from '@/lib/storage';
import {owner,response,validId} from '@/lib/access';
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){try{
 const userId=await owner();if(!userId)return response({error:'Please sign in.'},401);
 const {id}=await params;if(!validId(id))return response({error:'Not found.'},404);
 const q=await database().query("SELECT data FROM closing_desk.records WHERE id=$1 AND owner_id=$2 AND kind='document'",[id,userId]);
 if(!q.rows.length)return response({error:'Not found.'},404);
 const data=q.rows[0].data;
 if(!data.key.startsWith(`closing-desk/${userId}/`))return response({error:'Not found.'},404);
 const object=await getFile(data.key);if(!object.Body)return response({error:'File unavailable.'},404);
 return new Response(object.Body.transformToWebStream(),{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(data.name)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return response({error:'File temporarily unavailable.'},503);}}
