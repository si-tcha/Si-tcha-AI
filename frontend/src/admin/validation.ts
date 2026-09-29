export type AdminGicForm = {
  gicName: string;
  reference: string;
  bassinProductionId: string;
  activities: string;
  legalStatus: string;
  logoUrl: string;
  leaderName: string;
  leaderPhone: string;
  leaderPin: string;
  confirmPin: string;
};

export function normalizeAdminPhone(value: string): string | null {
  const compact = value.replace(/[\s().-]/g, '');
  if (/^6[2-9]\d{7}$/.test(compact)) return `+237${compact}`;
  if (/^2376[2-9]\d{7}$/.test(compact)) return `+${compact}`;
  if (/^\+2376[2-9]\d{7}$/.test(compact)) return compact;
  return null;
}

export function validateAdminGicForm(form: AdminGicForm): string | null {
  if (form.gicName.trim().length < 2) return 'Le nom du GIC doit contenir au moins 2 caractères.';
  if (form.reference.trim().length < 2) return 'La référence du GIC est requise.';
  if (!/^[1-9]\d*$/.test(form.bassinProductionId)) return 'Sélectionnez un bassin de production.';
  if (form.activities.trim().length < 2) return 'Les activités principales sont requises.';
  if (form.legalStatus.trim().length < 2) return 'Le statut de légalisation est requis.';
  if (form.logoUrl.trim()) {
    try {
      new URL(form.logoUrl.trim());
    } catch {
      return 'L’URL du logo est invalide.';
    }
  }
  if (form.leaderName.trim().length < 2) return 'Le nom du leader est requis.';
  if (!normalizeAdminPhone(form.leaderPhone)) return 'Le téléphone du leader est invalide.';
  if (!/^\d{4,6}$/.test(form.leaderPin)) return 'Le PIN du leader doit contenir entre 4 et 6 chiffres.';
  if (form.leaderPin !== form.confirmPin) return 'Les deux PIN ne correspondent pas.';
  return null;
}
