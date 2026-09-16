BEGIN;

-- Operational prerequisite: stop all application instances before execution.
-- Locks are acquired before fingerprints so the audited state cannot change.
LOCK TABLE
  "ProduitAgricole",
  "RecolteOffre",
  "TransactionAcheteur",
  "JournalCroissance"
IN ACCESS EXCLUSIVE MODE;

-- Refuse to operate unless products, offers and inbound references still match
-- the exact read-only audit performed on 2026-09-16.
DO $$
DECLARE
  actual_hash text;
  actual_count bigint;
BEGIN
  SELECT md5(string_agg(row_to_json(p)::text, chr(124) ORDER BY p.id)), count(*)
    INTO actual_hash, actual_count
    FROM "ProduitAgricole" p
   WHERE p.id BETWEEN 19 AND 26;
  IF actual_count <> 8 OR actual_hash IS DISTINCT FROM '917e046b57388449d488b09bbb5a08da' THEN
    RAISE EXCEPTION 'Product inventory changed (count=%, hash=%)', actual_count, actual_hash;
  END IF;

  SELECT md5(string_agg(row_to_json(r)::text, chr(124) ORDER BY r.id)), count(*)
    INTO actual_hash, actual_count
    FROM "RecolteOffre" r;
  IF actual_count <> 26 OR actual_hash IS DISTINCT FROM 'cf8f7753901414e44f5f6254d244c91b' THEN
    RAISE EXCEPTION 'Harvest-offer inventory changed (count=%, hash=%)', actual_count, actual_hash;
  END IF;

  SELECT md5(string_agg(
           jsonb_build_object(
             'id', t.id,
             'type', t.type::text,
             'quantite', t.quantite,
             'prixConvenu', t."prixConvenu",
             'statut', t.statut::text,
             'recolteOffreId', t."recolteOffreId",
             'acheteurId', t."acheteurId",
             'clientRequestId', t."clientRequestId"
           )::text,
           chr(124) ORDER BY t.id
         )), count(*)
    INTO actual_hash, actual_count
    FROM "TransactionAcheteur" t;
  IF actual_count <> 2 OR actual_hash IS DISTINCT FROM '689b5a31f5bb10571ec51495d9fd7867' THEN
    RAISE EXCEPTION 'Transaction references changed (count=%, hash=%)', actual_count, actual_hash;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "TransactionAcheteur" WHERE id=1 AND "recolteOffreId"=1)
     OR NOT EXISTS (SELECT 1 FROM "TransactionAcheteur" WHERE id=2 AND "recolteOffreId"=4) THEN
    RAISE EXCEPTION 'Transaction bindings changed before consolidation';
  END IF;

  SELECT count(*) INTO actual_count FROM "JournalCroissance";
  IF actual_count <> 0 THEN
    RAISE EXCEPTION 'Growth-journal references changed (count=%)', actual_count;
  END IF;
END $$;

-- Canonicals selected by the approved priority rule:
-- referenced offer first, otherwise newest timestampMaj, otherwise lowest ID.
-- Keep: 1, 4, 19, 20, 22, 23, 25, 26.
-- Delete only these 18 explicitly approved duplicate IDs.
DO $$
DECLARE
  deleted_count bigint;
BEGIN
  IF EXISTS (
    SELECT 1
      FROM "TransactionAcheteur"
     WHERE "recolteOffreId" IN (2,3,5,6,7,8,9,10,11,12,13,14,15,16,17,18,21,24)
  ) THEN
    RAISE EXCEPTION 'A duplicate offer scheduled for deletion is referenced by a transaction';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM "JournalCroissance"
     WHERE "recolteOffreId" IN (2,3,5,6,7,8,9,10,11,12,13,14,15,16,17,18,21,24)
  ) THEN
    RAISE EXCEPTION 'A duplicate offer scheduled for deletion is referenced by a growth journal';
  END IF;

  DELETE FROM "RecolteOffre"
   WHERE id IN (2,3,5,6,7,8,9,10,11,12,13,14,15,16,17,18,21,24);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  IF deleted_count <> 18 THEN
    RAISE EXCEPTION 'Expected to delete 18 duplicate offers, deleted %', deleted_count;
  END IF;
END $$;

-- Apply only the four explicitly approved catalogue prices. Each update must
-- affect exactly one currently-null product with the audited ID and name.
DO $$
DECLARE
  changed_count bigint;
BEGIN
  UPDATE "ProduitAgricole" SET prix=500.00
   WHERE id=19 AND nom='Tomates fraîches' AND prix IS NULL;
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> 1 THEN RAISE EXCEPTION 'Product 19 price precondition failed'; END IF;

  UPDATE "ProduitAgricole" SET prix=335.00
   WHERE id=20 AND nom='Maïs jaune' AND prix IS NULL;
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> 1 THEN RAISE EXCEPTION 'Product 20 price precondition failed'; END IF;

  UPDATE "ProduitAgricole" SET prix=200.00
   WHERE id=21 AND nom='Manioc frais' AND prix IS NULL;
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> 1 THEN RAISE EXCEPTION 'Product 21 price precondition failed'; END IF;

  UPDATE "ProduitAgricole" SET prix=500.00
   WHERE id=22 AND nom='Régimes de Plantains' AND prix IS NULL;
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> 1 THEN RAISE EXCEPTION 'Product 22 price precondition failed'; END IF;
END $$;

-- Pre-COMMIT invariants. Any divergence raises and rolls back the transaction.
DO $$
DECLARE
  actual_count bigint;
  catalog_count bigint;
  catalog_volume numeric;
BEGIN
  SELECT count(*) INTO actual_count FROM "RecolteOffre";
  IF actual_count <> 8 THEN
    RAISE EXCEPTION 'Expected 8 remaining offers, found %', actual_count;
  END IF;

  IF (SELECT array_agg(id ORDER BY id) FROM "RecolteOffre")
       IS DISTINCT FROM ARRAY[1,4,19,20,22,23,25,26]::bigint[] THEN
    RAISE EXCEPTION 'Remaining offer IDs do not match approved canonicals';
  END IF;

  IF (SELECT count(*) FROM "TransactionAcheteur") <> 2
     OR NOT EXISTS (SELECT 1 FROM "TransactionAcheteur" WHERE id=1 AND "recolteOffreId"=1)
     OR NOT EXISTS (SELECT 1 FROM "TransactionAcheteur" WHERE id=2 AND "recolteOffreId"=4) THEN
    RAISE EXCEPTION 'Transactions 1 and 2 are not preserved on offers 1 and 4';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "TransactionAcheteur" t
    LEFT JOIN "RecolteOffre" r ON r.id=t."recolteOffreId"
    WHERE r.id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM "JournalCroissance" j
    LEFT JOIN "RecolteOffre" r ON r.id=j."recolteOffreId"
    WHERE r.id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM "RecolteOffre" r
    LEFT JOIN "ProduitAgricole" p ON p.id=r."produitAgricoleId"
    WHERE p.id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM "RecolteOffre" r
    LEFT JOIN "GIC" g ON g.id=r."gicId"
    WHERE g.id IS NULL
  ) THEN
    RAISE EXCEPTION 'An orphan foreign key exists after offer consolidation';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "ProduitAgricole" WHERE id=19 AND nom='Tomates fraîches' AND prix=500.00)
     OR NOT EXISTS (SELECT 1 FROM "ProduitAgricole" WHERE id=20 AND nom='Maïs jaune' AND prix=335.00)
     OR NOT EXISTS (SELECT 1 FROM "ProduitAgricole" WHERE id=21 AND nom='Manioc frais' AND prix=200.00)
     OR NOT EXISTS (SELECT 1 FROM "ProduitAgricole" WHERE id=22 AND nom='Régimes de Plantains' AND prix=500.00) THEN
    RAISE EXCEPTION 'One or more approved prices are incorrect';
  END IF;

  IF EXISTS (SELECT 1 FROM "ProduitAgricole" WHERE id BETWEEN 23 AND 26 AND prix IS NOT NULL)
     OR (SELECT count(*) FROM "ProduitAgricole" WHERE id BETWEEN 23 AND 26) <> 4 THEN
    RAISE EXCEPTION 'Products 23 through 26 must exist and keep NULL prices';
  END IF;

  SELECT count(*), sum(r."quantiteDisponible")
    INTO catalog_count, catalog_volume
    FROM "RecolteOffre" r
    JOIN "ProduitAgricole" p ON p.id=r."produitAgricoleId"
   WHERE r."quantiteDisponible" > 0 AND p.prix > 0;
  IF catalog_count <> 4 OR catalog_volume <> 11050.00 THEN
    RAISE EXCEPTION 'Catalog simulation mismatch (cards=%, volume=%)', catalog_count, catalog_volume;
  END IF;
END $$;

COMMIT;
