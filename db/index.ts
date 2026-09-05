import 'server-only';
import {Pool} from 'pg';
const globalPg=globalThis as unknown as {closingPool?:Pool};
export function database(){
 if(!process.env.DATABASE_URL)throw new Error('Database is not configured.');
 return globalPg.closingPool??=(new Pool({connectionString:process.env.DATABASE_URL,max:3,idleTimeoutMillis:20000,connectionTimeoutMillis:10000}));
}
