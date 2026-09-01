import { describe, expect, it } from "vitest";
import { findOrphanedPaths } from "./find-orphaned-documents";

describe("findOrphanedPaths", () => {
  it("returns nothing when every file on disk has a matching row", () => {
    const filesOnDisk = ["transactions/tx1/a.pdf", "transactions/tx2/b.pdf"];
    const storagePathsInDb = ["transactions/tx1/a.pdf", "transactions/tx2/b.pdf"];
    expect(findOrphanedPaths(filesOnDisk, storagePathsInDb)).toEqual([]);
  });

  it("identifies a file on disk with no matching row as orphaned", () => {
    const filesOnDisk = ["transactions/tx1/a.pdf", "transactions/tx2/orphan.pdf"];
    const storagePathsInDb = ["transactions/tx1/a.pdf"];
    expect(findOrphanedPaths(filesOnDisk, storagePathsInDb)).toEqual(["transactions/tx2/orphan.pdf"]);
  });

  it("never flags a row that has no file — that's a separate (missing-file) problem, not orphaned storage", () => {
    const filesOnDisk = ["transactions/tx1/a.pdf"];
    const storagePathsInDb = ["transactions/tx1/a.pdf", "transactions/tx2/gone.pdf"];
    expect(findOrphanedPaths(filesOnDisk, storagePathsInDb)).toEqual([]);
  });

  it("returns nothing when there are no files on disk", () => {
    expect(findOrphanedPaths([], ["transactions/tx1/a.pdf"])).toEqual([]);
  });

  it("flags every file when there are no Document rows at all (e.g. after a cascade-deleted parent)", () => {
    const filesOnDisk = ["transactions/tx1/a.pdf", "transactions/tx1/b.pdf"];
    expect(findOrphanedPaths(filesOnDisk, [])).toEqual(filesOnDisk);
  });

  it("only flags files that are genuinely unreferenced, leaving referenced ones alone, in a mixed set", () => {
    const filesOnDisk = ["transactions/tx1/kept.pdf", "transactions/tx1/orphan-a.pdf", "transactions/tx2/orphan-b.pdf"];
    const storagePathsInDb = ["transactions/tx1/kept.pdf"];
    expect(findOrphanedPaths(filesOnDisk, storagePathsInDb)).toEqual([
      "transactions/tx1/orphan-a.pdf",
      "transactions/tx2/orphan-b.pdf",
    ]);
  });
});
