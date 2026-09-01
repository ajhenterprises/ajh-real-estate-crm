import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestContact, createTestUser, getTestDb, hasTestDatabase, resetTestDatabase } from "@/test/db";
import { findOrphanedPaths, listFilesRecursive } from "./find-orphaned-documents";

/**
 * Proves the documented, accepted Phase 8 limitation is actually detectable
 * in practice: a Document row removed via database-level cascade (not
 * through deleteDocument) leaves its physical file behind, and this
 * script's real filesystem-walk + real DB query correctly flags it —
 * exercising listFilesRecursive and findOrphanedPaths together, against a
 * real temp directory and the dedicated test database, rather than only
 * the pure set-difference logic in find-orphaned-documents.test.ts.
 */
describe.skipIf(!hasTestDatabase)("find-orphaned-documents (cascade-orphan integration)", () => {
  let storageRoot: string;

  beforeEach(async () => {
    await resetTestDatabase();
    storageRoot = await mkdtemp(path.join(tmpdir(), "ajh-crm-orphan-test-"));
  });

  afterEach(async () => {
    await rm(storageRoot, { recursive: true, force: true });
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("flags a file left behind when its Document row is removed by a cascading parent deletion", async () => {
    const db = getTestDb();
    const owner = await createTestUser();
    const contact = await createTestContact(owner.id);

    const key = `contacts/${contact.id}/cascade-orphan.pdf`;
    const filePath = path.join(storageRoot, key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, "fake pdf bytes");

    await db.document.create({
      data: {
        filename: "cascade-orphan.pdf",
        documentType: "OTHER",
        storagePath: key,
        fileSize: 14,
        mimeType: "application/pdf",
        uploadedByUserId: owner.id,
        contactId: contact.id,
      },
    });

    // No application code path does this (Phase 8's Objective B inspection
    // confirmed zero in-app deletion of User/Contact/Client/Transaction
    // rows) — this simulates the only way it can currently happen: direct
    // database administration relying on the schema's onDelete: Cascade.
    await db.user.delete({ where: { id: owner.id } });

    const storagePathsInDb = (await db.document.findMany({ select: { storagePath: true } })).map(
      (d) => d.storagePath,
    );
    const filesOnDisk = await listFilesRecursive(storageRoot, storageRoot);
    const orphaned = findOrphanedPaths(filesOnDisk, storagePathsInDb);

    expect(filesOnDisk).toEqual([key]);
    expect(storagePathsInDb).toEqual([]);
    expect(orphaned).toEqual([key]);
  });

  it("does not flag a file whose Document row was removed through the normal deleteDocument path", async () => {
    const db = getTestDb();
    const owner = await createTestUser();
    const contact = await createTestContact(owner.id);

    const key = `contacts/${contact.id}/properly-deleted.pdf`;
    const filePath = path.join(storageRoot, key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, "fake pdf bytes");

    await db.document.create({
      data: {
        filename: "properly-deleted.pdf",
        documentType: "OTHER",
        storagePath: key,
        fileSize: 14,
        mimeType: "application/pdf",
        uploadedByUserId: owner.id,
        contactId: contact.id,
      },
    });

    // File deleted first, exactly like deleteDocument does, before the row.
    await rm(filePath);
    await db.document.deleteMany({ where: { storagePath: key } });

    const storagePathsInDb = (await db.document.findMany({ select: { storagePath: true } })).map(
      (d) => d.storagePath,
    );
    const filesOnDisk = await listFilesRecursive(storageRoot, storageRoot);
    const orphaned = findOrphanedPaths(filesOnDisk, storagePathsInDb);

    expect(filesOnDisk).toEqual([]);
    expect(orphaned).toEqual([]);
  });
});
