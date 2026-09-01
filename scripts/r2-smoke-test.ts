/**
 * Manual, operator-run smoke test against a REAL configured S3/R2 bucket —
 * never imported by application code or the automated test suite (those
 * use a fake S3 client — see src/lib/storage/s3.test.ts — deliberately, so
 * CI doesn't need real cloud credentials). Not wired into any npm script or
 * CI job on purpose: it costs real API calls against production storage and
 * needs real S3_* credentials in the environment. Run by hand only:
 *
 *   npx tsx --env-file=.env scripts/r2-smoke-test.ts
 *
 * Exercises put -> get -> verify contents -> delete -> verify gone against
 * whatever S3_* endpoint/bucket is currently configured, and always
 * attempts to clean up the test object afterward, even on failure.
 */
import { randomUUID } from "node:crypto";
import { S3StorageAdapter } from "../src/lib/storage/s3";

const KEY = `smoke-test/${randomUUID()}.txt`;
const CONTENT = `AJH Real Estate CRM R2 smoke test — ${new Date().toISOString()}`;

function step(name: string, ok: boolean, detail?: string) {
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

async function main() {
  const adapter = new S3StorageAdapter();
  let uploadOk = false;
  let retrieveOk = false;
  let contentsOk = false;
  let deleteOk = false;
  let confirmedGoneOk = false;

  try {
    await adapter.put({ key: KEY, body: Buffer.from(CONTENT, "utf8"), contentType: "text/plain" });
    uploadOk = step("upload", true, KEY);
  } catch (error) {
    step("upload", false, String(error));
    throw error;
  }

  try {
    const bytes = await adapter.get(KEY);
    retrieveOk = step("retrieve", true, `${bytes.length} bytes`);
    contentsOk = step("contents match", bytes.toString("utf8") === CONTENT);
  } catch (error) {
    step("retrieve", false, String(error));
  }

  try {
    await adapter.delete(KEY);
    deleteOk = step("delete", true);
  } catch (error) {
    step("delete", false, String(error));
  }

  try {
    await adapter.get(KEY);
    step("confirm deleted", false, "get() unexpectedly succeeded after delete");
  } catch (error) {
    const isEnoent = typeof error === "object" && error !== null && (error as { code?: unknown }).code === "ENOENT";
    confirmedGoneOk = step("confirm deleted (ENOENT after delete)", isEnoent, isEnoent ? undefined : String(error));
  }

  console.log("");
  console.log("Summary:");
  console.log(`  upload:           ${uploadOk ? "PASS" : "FAIL"}`);
  console.log(`  retrieve:         ${retrieveOk ? "PASS" : "FAIL"}`);
  console.log(`  contents match:   ${contentsOk ? "PASS" : "FAIL"}`);
  console.log(`  delete:           ${deleteOk ? "PASS" : "FAIL"}`);
  console.log(`  confirmed gone:   ${confirmedGoneOk ? "PASS" : "FAIL"}`);

  const allPass = uploadOk && retrieveOk && contentsOk && deleteOk && confirmedGoneOk;
  process.exitCode = allPass ? 0 : 1;
}

main().catch(async (error) => {
  console.error("Smoke test crashed:", error);
  // Best-effort cleanup even if something above threw before its own delete ran.
  try {
    await new S3StorageAdapter().delete(KEY);
    console.log(`Cleanup: deleted ${KEY} after failure.`);
  } catch {
    console.error(`Cleanup WARNING: could not confirm deletion of ${KEY} — check the bucket manually.`);
  }
  process.exitCode = 1;
});
