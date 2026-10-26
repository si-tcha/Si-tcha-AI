-- Programmes agricoles : publication agent, suivi de dossier et rappels.
-- Migration additive et forward-only : aucun programme existant n'est supprimé.

ALTER TABLE "ProgrammeAgricole"
  ADD COLUMN IF NOT EXISTS "statut" VARCHAR(20) NOT NULL DEFAULT 'PUBLIE',
  ADD COLUMN IF NOT EXISTS "estDemo" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "CandidatureProgramme" (
  "id" BIGSERIAL NOT NULL,
  "statut" VARCHAR(30) NOT NULL DEFAULT 'ASSISTANCE_DEMANDEE',
  "demandeAssistance" TEXT,
  "noteAgent" TEXT,
  "submittedAt" TIMESTAMPTZ,
  "assistanceRequestedAt" TIMESTAMPTZ,
  "lastReminderAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "programmeAgricoleId" BIGINT NOT NULL,
  "agriculteurId" BIGINT NOT NULL,
  CONSTRAINT "CandidatureProgramme_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CandidatureProgramme_programmeAgricoleId_fkey"
    FOREIGN KEY ("programmeAgricoleId") REFERENCES "ProgrammeAgricole"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CandidatureProgramme_agriculteurId_fkey"
    FOREIGN KEY ("agriculteurId") REFERENCES "Agriculteur"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CandidatureProgramme_programmeAgricoleId_agriculteurId_key"
  ON "CandidatureProgramme"("programmeAgricoleId", "agriculteurId");
CREATE INDEX IF NOT EXISTS "CandidatureProgramme_agriculteurId_statut_idx"
  ON "CandidatureProgramme"("agriculteurId", "statut");
CREATE INDEX IF NOT EXISTS "CandidatureProgramme_programmeAgricoleId_statut_idx"
  ON "CandidatureProgramme"("programmeAgricoleId", "statut");

-- Programmes de démonstration : clairement étiquetés et sans prétention
-- d'être des aides officielles. Les agents peuvent les remplacer ou les clôturer.
INSERT INTO "ProgrammeAgricole" ("nom", "description", "criteresEligibilite", "dateLimite", "urlLien", "statut", "estDemo")
SELECT v."nom", v."description", v."criteresEligibilite", v."dateLimite", v."urlLien", 'PUBLIE', true
FROM (VALUES
  ('Programme démo — Appui intrants', 'Exemple de programme à remplacer par une opportunité validée par SI-TCHA.', 'Compte agriculteur approuvé et dossier à compléter avec l’agent.', DATE '2026-12-15', ''),
  ('Programme démo — Accompagnement maraîchage', 'Exemple de suivi technique et administratif pour les producteurs.', 'Être membre actif d’un GIC et demander une assistance.', DATE '2027-01-15', ''),
  ('Programme démo — Modernisation des exploitations', 'Exemple de programme de préparation de dossier pour financement.', 'Projet agricole documenté et échange préalable avec l’agent.', DATE '2027-02-15', '')
) AS v("nom", "description", "criteresEligibilite", "dateLimite", "urlLien")
WHERE NOT EXISTS (
  SELECT 1 FROM "ProgrammeAgricole" p WHERE p."nom" = v."nom"
);
