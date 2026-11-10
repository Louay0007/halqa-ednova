// Hint-ladder T0 templates (F-HINT, blueprint §2.3). Served without model calls;
// L4 is assembled from the hidden Quick Take at serve time (HintService).
// Fallback chain: topic+lang → topic+en → generic+en.

export interface HintTemplate {
  L1: string;
  L2: string;
  L3: string;
}

const BS_EN: HintTemplate = {
  L1: 'What must be true about the array BEFORE you start halving? Check card bs-en-01.',
  L2: 'Is the list [5,1,4] sorted? Try one halving step on paper and see what breaks.',
  L3: 'Worked micro-example (different target): find 3 in [1,3,5,7] → mid=3 ✔ in 1 step. Now retry yours: which half survives the first comparison?',
};

const BS_FR: HintTemplate = {
  L1: 'Quelle condition faut-il AVANT de diviser ? Revois la carte bs-fr-01.',
  L2: 'La liste [5,1,4] est-elle triée ? Fais une étape à la main et regarde ce qui casse.',
  L3: 'Micro-exemple (autre cible) : chercher 3 dans [1,3,5,7] → milieu=3 ✔ en 1 étape. À toi : quelle moitié survit à la première comparaison ?',
};

const BS_AR: HintTemplate = {
  L1: 'ما الشرط اللازم قبل أن نبدأ القسمة؟ راجع البطاقة bs-ar-01.',
  L2: 'هل القائمة [5,1,4] مرتبة؟ جرّب خطوة واحدة بيدك ولاحظ أين ينهار البحث.',
  L3: 'مثال مصغّر (هدف مختلف): ابحث عن 3 في [1,3,5,7] ← الوسط=3 ✔ في خطوة. الآن حاول أنت: أي نصف يبقى بعد أول مقارنة؟',
};

const BS_DARIJA: HintTemplate = {
  L1: 'شنو الشرط اللي لازم قبل ما نقسمو؟ شوف الـcarte bs-fr-01.',
  L2: 'الليستة [5,1,4] مرتبة؟ جرّب خطوة وحدة.',
  L3: 'Exemple صغير (هدف آخر): نلوجو على 3 في [1,3,5,7] ← الوسط 3 ✔ في خطوة. توا أنت: أناهي شيرة تبقى بعد أول مقارنة؟',
};

const FRAC_EN: HintTemplate = {
  L1: 'What does the bottom number count — pieces or wholes? Check card frac-en-01.',
  L2: 'Draw 3/4 and 3/5 as pizzas. Which slice is bigger — a fourth or a fifth?',
  L3: 'Micro-example: 1/2 of 6 apples = 3. Now compare 2/3 vs 2/4 the same way: same top, different bottoms.',
};

const GENERIC_EN: HintTemplate = {
  L1: 'Restate the question in your own words. What exactly is being asked?',
  L2: 'Try the smallest concrete example you can think of, by hand.',
  L3: 'Solve the tiny example fully, then map each step back to the real question.',
};

const GENERIC_FR: HintTemplate = {
  L1: 'Reformule la question avec tes mots. Que cherche-t-on exactement ?',
  L2: 'Essaie le plus petit exemple concret possible, à la main.',
  L3: 'Résous le mini-exemple, puis reporte chaque étape sur la vraie question.',
};

const TABLE: Record<string, Record<string, HintTemplate>> = {
  binary_search: { en: BS_EN, fr: BS_FR, ar: BS_AR, darija: BS_DARIJA },
  fractions: { en: FRAC_EN },
  generic: { en: GENERIC_EN, fr: GENERIC_FR },
};

export function getHintTemplate(topic: string, lang: string): HintTemplate {
  const byTopic = TABLE[topic] ?? TABLE.generic;
  return byTopic[lang] ?? byTopic.en ?? TABLE.generic.en;
}
