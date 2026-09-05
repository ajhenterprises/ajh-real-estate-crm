import pg from 'pg';
if(!process.env.DATABASE_URL){console.log('Database connection not set. Sign-in remains unavailable until configuration is complete.');process.exit(0);}
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:15000});
const client=await pool.connect();
try{
 await client.query('BEGIN');
 await client.query("SELECT pg_advisory_xact_lock(814236907)");
 await client.query('CREATE SCHEMA IF NOT EXISTS closing_desk');
 await client.query(`CREATE TABLE IF NOT EXISTS closing_desk.records (
 id uuid PRIMARY KEY, owner_id text NOT NULL, kind text NOT NULL,
 data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`);
 await client.query('CREATE INDEX IF NOT EXISTS closing_records_owner_kind ON closing_desk.records(owner_id,kind)');
 await client.query(`CREATE TABLE IF NOT EXISTS closing_desk.login_attempts (
 key text PRIMARY KEY, attempts integer NOT NULL DEFAULT 0, window_start timestamptz NOT NULL DEFAULT now())`);
 await client.query('COMMIT');
 console.log('Closing desk schema ready. Existing CRM tables were not changed.');
}catch(e){await client.query('ROLLBACK');console.error('Closing desk database setup failed. Check database connectivity and permissions.');process.exitCode=1;}finally{client.release();await pool.end();}
