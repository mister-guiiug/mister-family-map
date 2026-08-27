import { create } from 'zustand';
import type { PlaceDraft } from '../../entities/place/model';
import { UNKNOWN_FEATURES } from '../../entities/place/model';
import { store } from '../../shared/api/storage';

/**
 * Parcours de contribution : brouillon persisté LOCALEMENT à chaque étape
 * (reprise après interruption), envoyé seulement à la dernière étape.
 */

export const WIZARD_STEPS = [
  'position',
  'doublons',
  'essentiel',
  'famille',
  'photos',
  'apercu',
  'regles',
] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export const WIZARD_STEP_LABELS: Record<WizardStep, string> = {
  position: 'Position sur la carte',
  doublons: 'Lieux similaires',
  essentiel: 'Informations essentielles',
  famille: 'Infos famille',
  photos: 'Photos (facultatif)',
  apercu: 'Prévisualisation',
  regles: 'Règles de contribution',
};

/** Sans le préfixe : `store` remet `mfm_`, la clé reste `mfm_place_wizard_draft`. */
const DRAFT_KEY = 'place_wizard_draft';

export function emptyPlaceDraft(): PlaceDraft {
  return {
    name: '',
    categoryId: '',
    shortDescription: '',
    description: '',
    coordinates: { lat: 46.6, lng: 2.4 },
    address: '',
    city: '',
    ageRange: null,
    durationMinutes: null,
    price: { kind: 'unknown' },
    openingHours: null,
    websiteUrl: null,
    phone: null,
    features: { ...UNKNOWN_FEATURES },
    practicalTips: '',
  };
}

interface WizardState {
  step: WizardStep;
  draft: PlaceDraft;
  rulesAccepted: boolean;
  setStep: (step: WizardStep) => void;
  updateDraft: (partial: Partial<PlaceDraft>) => void;
  setRulesAccepted: (accepted: boolean) => void;
  restore: () => void;
  clear: () => void;
}

export const usePlaceWizardStore = create<WizardState>((set, get) => ({
  step: 'position',
  draft: emptyPlaceDraft(),
  rulesAccepted: false,
  setStep(step) {
    set({ step });
    store.set(DRAFT_KEY, { step, draft: get().draft });
  },
  updateDraft(partial) {
    const draft = { ...get().draft, ...partial };
    set({ draft });
    store.set(DRAFT_KEY, { step: get().step, draft });
  },
  setRulesAccepted(rulesAccepted) {
    set({ rulesAccepted });
  },
  restore() {
    const saved = store.get<{ step: WizardStep; draft: PlaceDraft } | null>(
      DRAFT_KEY,
      null
    );
    if (saved) set({ step: saved.step, draft: saved.draft });
  },
  clear() {
    store.remove(DRAFT_KEY);
    set({ step: 'position', draft: emptyPlaceDraft(), rulesAccepted: false });
  },
}));
