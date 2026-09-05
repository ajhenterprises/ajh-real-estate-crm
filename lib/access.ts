import 'server-only';
import {auth} from '@/auth';
import {database} from '@/db';
export async function owner(){const session=await auth();if(!session?.user?.id)return null;const result=await database().query('SELECT id FROM public.users WHERE id=$1',[session.user.id]);return result.rows.length?session.user.id:null;}
export function originAllowed(req:Request){const origin=req.headers.get('origin');return !!origin&&origin===new URL(req.url).origin;}
export function response(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});}
export function toRow(r:any){return {id:r.id,kind:r.kind,data:r.data,createdAt:new Date(r.created_at).toISOString(),updatedAt:new Date(r.updated_at).toISOString()};}
export const validId=(id:unknown):id is string=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
