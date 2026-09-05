import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import {createHmac} from 'node:crypto';
import {database} from '@/db';
export const {handlers,auth,signIn,signOut}=NextAuth({
 trustHost:true,
 pages:{signIn:'/login'},
 session:{strategy:'jwt',maxAge:60*60*12},
 cookies:{sessionToken:{name:process.env.NODE_ENV==='production'?'__Secure-closing-desk.session-token':'closing-desk.session-token',options:{httpOnly:true,sameSite:'lax',path:'/',secure:process.env.NODE_ENV==='production'}}},
 providers:[Credentials({credentials:{email:{type:'email'},password:{type:'password'}},async authorize(credentials){
 const email=typeof credentials.email==='string'?credentials.email.trim().toLowerCase():'';
 const password=typeof credentials.password==='string'?credentials.password:'';
 if(!email||email.length>254||!password||password.length>1024||!process.env.AUTH_SECRET)return null;
 const db=database();const key=createHmac('sha256',process.env.AUTH_SECRET).update(email).digest('hex');
 const limit=await db.query(`INSERT INTO closing_desk.login_attempts(key,attempts,window_start) VALUES($1,1,now())
 ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN closing_desk.login_attempts.window_start < now()-interval '15 minutes' THEN 1 ELSE closing_desk.login_attempts.attempts+1 END,
 window_start=CASE WHEN closing_desk.login_attempts.window_start < now()-interval '15 minutes' THEN now() ELSE closing_desk.login_attempts.window_start END RETURNING attempts`,[key]);
 if(limit.rows[0].attempts>10)return null;
 const result=await db.query('SELECT id,email,name,"passwordHash" FROM public.users WHERE lower(email) = $1 LIMIT 1',[email]);
 const user=result.rows[0];
 if(!user||!await bcrypt.compare(password,user.passwordHash))return null;
 await db.query('DELETE FROM closing_desk.login_attempts WHERE key = $1',[key]);
 return {id:user.id,email:user.email,name:user.name};
 }} )],
 callbacks:{jwt({token,user}){if(user)token.userId=user.id;return token;},session({session,token}){if(session.user)session.user.id=String(token.userId||'');return session;}}
});
