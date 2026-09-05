import {auth,signIn} from '@/auth';
import {AuthError} from 'next-auth';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Login({searchParams}:{searchParams:Promise<{error?:string}>}){
 const session=await auth();if(session?.user?.id)redirect('/');const {error}=await searchParams;
 const configured=!!process.env.DATABASE_URL&&!!process.env.AUTH_SECRET;
 return <main className="login-shell"><section className="login-card"><div className="login-brand">AJH</div><p className="eyebrow">REAL ESTATE · CLOSING DESK</p><h1>Welcome back.</h1><p className="muted">Sign in with your existing CRM account.</p>{!configured?<p role="status">Your new workspace is being connected. Sign-in will be available once setup is complete.</p>:<form action={async(form:FormData)=>{'use server';try{await signIn('credentials',{email:form.get('email'),password:form.get('password'),redirectTo:'/'});}catch(e){if(e instanceof AuthError)redirect('/login?error=credentials');throw e;}}}>{error&&<p role="alert" className="form-error">Unable to sign in. Check your email and password, or wait 15 minutes if you’ve tried several times.</p>}<label>Email<input name="email" type="email" autoComplete="username" required/></label><label>Password<input name="password" type="password" autoComplete="current-password" required/></label><button className="primary" type="submit">Sign in</button></form>}<p className="muted">Your contacts and documents stay private.</p></section></main>;
}
