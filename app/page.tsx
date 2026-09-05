import {auth,signOut} from '@/auth';
import {redirect} from 'next/navigation';
import Workspace from './workspace';
export const dynamic='force-dynamic';
export default async function Page(){const session=await auth();if(!session?.user?.id)redirect('/login');return <><Workspace/><form className="logout" action={async()=>{'use server';await signOut({redirectTo:'/login'});}}><button type="submit">Sign out</button></form></>;}
