import 'server-only';
import {S3Client,PutObjectCommand,GetObjectCommand,DeleteObjectCommand} from '@aws-sdk/client-s3';
function storage(){const {S3_BUCKET,S3_ACCESS_KEY_ID,S3_SECRET_ACCESS_KEY}=process.env;if(!S3_BUCKET||!S3_ACCESS_KEY_ID||!S3_SECRET_ACCESS_KEY)throw Error('Document storage is not configured.');return {bucket:S3_BUCKET,client:new S3Client({region:process.env.S3_REGION||'auto',endpoint:process.env.S3_ENDPOINT||undefined,forcePathStyle:process.env.S3_FORCE_PATH_STYLE==='true',credentials:{accessKeyId:S3_ACCESS_KEY_ID,secretAccessKey:S3_SECRET_ACCESS_KEY}})};}
export async function putFile(key:string,file:File){const {client,bucket}=storage();await client.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:Buffer.from(await file.arrayBuffer()),ContentType:file.type}));}
export async function getFile(key:string){const {client,bucket}=storage();return client.send(new GetObjectCommand({Bucket:bucket,Key:key}));}
export async function deleteFile(key:string){const {client,bucket}=storage();await client.send(new DeleteObjectCommand({Bucket:bucket,Key:key}));}
