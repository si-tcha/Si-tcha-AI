import type { AgronomistHistoryEntry } from './growthService';

export interface AgronomistConsultationInput {
  crop: string;
  category: string;
  question: string;
  answer: string;
  disclaimer: string;
  askedAt: string;
}

export type AgronomistPersistenceOutcome =
  | { status: 'saved'; entry: AgronomistHistoryEntry }
  | { status: 'volatile'; entry: AgronomistHistoryEntry };

export async function persistOrKeepAgronomistAnswer(
  input: AgronomistConsultationInput,
  persist: (input: AgronomistConsultationInput) => Promise<AgronomistHistoryEntry>,
): Promise<AgronomistPersistenceOutcome> {
  try {
    return { status: 'saved', entry: await persist(input) };
  } catch {
    return {
      status: 'volatile',
      entry: {
        id: `agro-volatile-${Date.now()}`,
        ...input,
        notSavedLocally: true,
      },
    };
  }
}
