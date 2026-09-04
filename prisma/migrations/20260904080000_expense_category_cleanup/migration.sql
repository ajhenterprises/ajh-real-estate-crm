-- Cleans up the default expense category list to match a clearer,
-- real-estate-specific vocabulary. Every existing expense keeps its
-- category — nothing here deletes an Expense row, and no category is
-- dropped until every expense referencing it has been reassigned (the
-- categoryId foreign key is ON DELETE RESTRICT, so this would fail loudly
-- rather than silently if that weren't true).
--
-- Three kinds of change:
--  1. Rename in place (same id) — the category's meaning didn't change,
--     just its label. Every expense already using it is unaffected.
--  2. Split — one old category becomes two new, more specific ones.
--     Since which specific new category each historical expense belongs
--     in can't be determined from stored data (and this app adds no AI to
--     guess), every existing expense defaults to the first/more common of
--     the two — agents can manually move individual expenses to the
--     other new category afterward from the expense edit form.
--  3. Fold — an old category that doesn't map cleanly to anything in the
--     new list merges into the closest remaining category.

-- Step 1: rename in place (id unchanged, so no expense reassignment needed).
UPDATE "expense_categories" SET "name" = 'Marketing & Advertising' WHERE "id" = 'expcat_advertising_marketing' AND "ownerId" IS NULL;
UPDATE "expense_categories" SET "name" = 'Brokerage Transfer / Change of Brokerage' WHERE "id" = 'expcat_brokerage_fees' AND "ownerId" IS NULL;
UPDATE "expense_categories" SET "name" = 'Photography / Videography' WHERE "id" = 'expcat_photography_video' AND "ownerId" IS NULL;
UPDATE "expense_categories" SET "name" = 'Technology / Software' WHERE "id" = 'expcat_software_subscriptions' AND "ownerId" IS NULL;
UPDATE "expense_categories" SET "name" = 'Office / Business Supplies' WHERE "id" = 'expcat_office_supplies' AND "ownerId" IS NULL;
UPDATE "expense_categories" SET "name" = 'Education / Training' WHERE "id" = 'expcat_education_training' AND "ownerId" IS NULL;
UPDATE "expense_categories" SET "name" = 'Mileage / Vehicle' WHERE "id" = 'expcat_vehicle_mileage' AND "ownerId" IS NULL;

-- Step 2: insert new categories — the other half of each split, plus
-- genuinely new ones. Same idempotent WHERE NOT EXISTS pattern the
-- original seed migration uses (NULL <> NULL breaks ON CONFLICT here).
INSERT INTO "expense_categories" ("id", "name", "isSystemDefault", "ownerId", "createdAt")
SELECT v.id, v.name, true, NULL, CURRENT_TIMESTAMP
FROM (VALUES
    ('expcat_signs', 'Signs'),
    ('expcat_print_materials', 'Business Cards / Print Materials'),
    ('expcat_mls_listing_services', 'MLS / Listing Services'),
    ('expcat_association_dues', 'Association / REALTOR® Dues'),
    ('expcat_license_renewal', 'License Renewal'),
    ('expcat_continuing_education', 'Continuing Education'),
    ('expcat_legal_accounting', 'Legal / Accounting')
) AS v(id, name)
WHERE NOT EXISTS (
    SELECT 1 FROM "expense_categories" ec WHERE ec."ownerId" IS NULL AND ec."name" = v.name
);

-- Step 3: reassign every expense off a retiring category before it's
-- deleted. Split categories default to the more common/primary half;
-- folded categories move to the closest remaining category.
UPDATE "expenses" SET "categoryId" = 'expcat_mls_listing_services' WHERE "categoryId" = 'expcat_mls_association';
UPDATE "expenses" SET "categoryId" = 'expcat_signs' WHERE "categoryId" = 'expcat_signs_printing';
UPDATE "expenses" SET "categoryId" = 'expcat_advertising_marketing' WHERE "categoryId" = 'expcat_lead_generation';
UPDATE "expenses" SET "categoryId" = 'expcat_office_supplies' WHERE "categoryId" IN ('expcat_postage_shipping', 'expcat_home_office');
UPDATE "expenses" SET "categoryId" = 'expcat_other' WHERE "categoryId" = 'expcat_bank_fees';

-- Step 4: retiring categories are now unreferenced — safe to remove so
-- they no longer appear in the category picker or reports.
DELETE FROM "expense_categories"
WHERE "id" IN (
    'expcat_mls_association',
    'expcat_signs_printing',
    'expcat_lead_generation',
    'expcat_postage_shipping',
    'expcat_home_office',
    'expcat_bank_fees'
)
AND "ownerId" IS NULL;
