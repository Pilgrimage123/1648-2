import type { BuffId } from "../core/types";
import type { UnitLexeme, NamedText } from "./types";

const m = (
  nom: string,
  gen: string,
  dat: string,
  acc: string,
  voc: string,
  loc: string,
  ins: string,
  roleTitle: string,
): UnitLexeme => ({
  gender: "m",
  nom,
  gen,
  dat,
  acc,
  voc,
  loc,
  ins,
  roleTitle,
});

export const csUnits: Record<string, UnitLexeme> = {
  "player-colloredo": m(
    "Hrabě Colloredo",
    "hraběte Colloreda",
    "hraběti Colloredovi",
    "hraběte Colloreda",
    "hrabě Colloredo",
    "hraběti Colloredovi",
    "hrabětem Colloredem",
    "Velkopřevor & Polní maršál (V noční košili · VIP)",
  ),
  "player-jan-matej": m(
    "Jan Matěj",
    "Jana Matěje",
    "Janu Matějovi",
    "Jana Matěje",
    "Jane Matěji",
    "Janu Matějovi",
    "Janem Matějem",
    "Osobní komorník (Kolečková karabina)",
  ),
  "player-vaclav-michalovic": m(
    "Václav z Michalovic",
    "Václava z Michalovic",
    "Václavovi z Michalovic",
    "Václava z Michalovic",
    "Václave z Michalovic",
    "Václavovi z Michalovic",
    "Václavem z Michalovic",
    "Klementinský mušketýr & písař (Odlehčená mušketa M1624)",
  ),
  "player-bartolomej": m(
    "Bratr Bartoloměj",
    "Bratra Bartoloměje",
    "Bratru Bartolomějovi",
    "Bratra Bartoloměje",
    "Bratře Bartoloměji",
    "Bratru Bartolomějovi",
    "Bratrem Bartolomějem",
    "Maltézský zbrojmistr (Starší těžká mušketa s furketou)",
  ),
  "enemy-odowalsky": m(
    "Arnošt Odowalsky",
    "Arnošta Odowalského",
    "Arnoštu Odowalskému",
    "Arnošta Odowalského",
    "Arnošte Odowalský",
    "Arnoštu Odowalském",
    "Arnoštem Odowalským",
    "Velitel švédských mušketýrů (Odlehčená mušketa M1624)",
  ),
  "enemy-garden-musketeer": m(
    "Švédský mušketýr",
    "Švédského mušketýra",
    "Švédskému mušketýrovi",
    "Švédského mušketýra",
    "Švédský mušketýre",
    "Švédském mušketýrovi",
    "Švédským mušketýrem",
    "Mušketýrská hlídka (Odlehčená mušketa M1624)",
  ),
  "enemy-musketeer": m(
    "Královský mušketýr",
    "Královského mušketýra",
    "Královskému mušketýrovi",
    "Královského mušketýra",
    "Královský mušketýre",
    "Královském mušketýrovi",
    "Královským mušketýrem",
    "Švédský mušketýr (Odlehčená mušketa M1624)",
  ),
  "enemy-sniper-roof": m(
    "Mušketýr na belvederu",
    "Mušketýra na belvederu",
    "Mušketýrovi na belvederu",
    "Mušketýra na belvederu",
    "Mušketýre na belvederu",
    "Mušketýrovi na belvederu",
    "Mušketýrem na belvederu",
    "Švédský mušketýr (Odlehčená mušketa M1624 · Belveder)",
  ),
  "enemy-reinforcement-vanguard": m(
    "Předsunutý mušketýr",
    "Předsunutého mušketýra",
    "Předsunutému mušketýrovi",
    "Předsunutého mušketýra",
    "Předsunutý mušketýre",
    "Předsunutém mušketýrovi",
    "Předsunutým mušketýrem",
    "Königsmarckův mušketýr (Odlehčená mušketa M1624)",
  ),
  "player-plachy": m(
    "Jiří Plachý",
    "Jiřího Plachého",
    "Jiřímu Plachému",
    "Jiřího Plachého",
    "Jiří Plachý",
    "Jiřím Plachém",
    "Jiřím Plachým",
    "Jezuitský páter (železný obojek, kolečková pistole)",
  ),
  "player-havel": m(
    "Havel Řezáč",
    "Havla Řezáče",
    "Havlovi Řezáčovi",
    "Havla Řezáče",
    "Havle Řezáči",
    "Havlovi Řezáčovi",
    "Havlem Řezáčem",
    "Řezník od brány (sekáček a zástěra)",
  ),
  "player-ondrej": m(
    "Ondřej Štěrba",
    "Ondřeje Štěrby",
    "Ondřeji Štěrbovi",
    "Ondřeje Štěrbu",
    "Ondřeji Štěrbo",
    "Ondřeji Štěrbovi",
    "Ondřejem Štěrbou",
    "Zloděj střech a lan",
  ),
  "enemy-occultist": m(
    "Švédský okultista",
    "Švédského okultisty",
    "Švédskému okultistovi",
    "Švédského okultistu",
    "Švédský okultisto",
    "Švédském okultistovi",
    "Švédským okultistou",
    "Obřad u svorníku",
  ),
  "enemy-harrier-1": m(
    "Harcovník",
    "Harcovníka",
    "Harcovníkovi",
    "Harcovníka",
    "Harcovníku",
    "Harcovníkovi",
    "Harcovníkem",
    "Harcovník (krátká čepel)",
  ),
  "enemy-harrier-2": m(
    "Harcovník",
    "Harcovníka",
    "Harcovníkovi",
    "Harcovníka",
    "Harcovníku",
    "Harcovníkovi",
    "Harcovníkem",
    "Harcovník (krátká čepel)",
  ),
  "enemy-harrier-3": m(
    "Harcovník",
    "Harcovníka",
    "Harcovníkovi",
    "Harcovníka",
    "Harcovníku",
    "Harcovníkovi",
    "Harcovníkem",
    "Harcovník (krátká čepel)",
  ),
  "enemy-harrier-4": m(
    "Harcovník",
    "Harcovníka",
    "Harcovníkovi",
    "Harcovníka",
    "Harcovníku",
    "Harcovníkovi",
    "Harcovníkem",
    "Harcovník (krátká čepel)",
  ),
  "enemy-reinforcement-reserve": m(
    "Záložní mušketýr",
    "Záložního mušketýra",
    "Záložnímu mušketýrovi",
    "Záložního mušketýra",
    "Záložní mušketýre",
    "Záložním mušketýrovi",
    "Záložním mušketýrem",
    "Švédský mušketýr (Odlehčená mušketa M1624)",
  ),
};

export const csWeapons: Record<string, NamedText> = {
  colloredo_wheellock_pistol: { name: "Maršálova osobní kolečková pistole" },
  wheellock_carbine: { name: "Kolečková dragounská karabina" },
  matchlock_musket_fork: { name: "Starší těžká mušketa (s furketou)" },
  swedish_musket: { name: "Švédská odlehčená mušketa (M1624)" },
  heavy_arquebus: { name: "Starší těžká mušketa (s furketou)" },
  plachy_pistol: { name: "Plachého kolečková pistole" },
  havel_pistol: { name: "Řezníkova bambitka" },
  ondrej_pistol: { name: "Štěrbova bambitka" },
  harrier_pistol: { name: "Harcovnická pistole" },
  occultist_pistol: { name: "Okultistova pistole" },
  powder_keg: { name: "Výbuch prachového sudu" },
  grenade: { name: "Litinová petarda (3×3)" },
};

export const csMelee: Record<string, NamedText> = {
  colloredo_pistol_butt: {
    name: "Pažba vybité bambitky",
    description:
      "Hrabě v noční košili nemá meč. Zoufale se brání úderem těžké ořechové pažby své vystřelené pistole (minimální poškození proti kyrysu).",
  },
  heavy_musket_butt: {
    name: "Úder pažbou těžké muškety",
    description:
      "Osmikilová španělská mušketa otočená jako těžký okovaný kyj (6–8 HP, 25 % šance na otřesení cíle, vysype případné rozpracované nabíjení).",
  },
  swedish_musket_butt: {
    name: "Úder pažbou švédské muškety",
    description:
      "Spolehlivý nouzový úder okovanou pažbou švédské odlehčené muškety M1624 na blízko (4–6 HP).",
  },
  valet_cleaver: {
    name: "Lovecký tesák komorníka",
    description:
      "Ostrý lovecký tesák na černou zvěř, kterým Jan Matěj dokáže probodnout slabiny nepřátelského kyrysu.",
  },
  cleric_dagger: {
    name: "Úder pažbou švédské muškety",
    description:
      "Spolehlivý nouzový úder pažbou odlehčené muškety klementinského studenta Václava z Michalovic (4–6 HP).",
  },
  maltese_broadsword: {
    name: "Maltézský válečný meč & kord",
    description: "Těžká kovaná sečná čepel ukovaná v maltézské zbrojnici.",
  },
  swedish_dagger: {
    name: "Úder pažbou švédské muškety",
    description:
      "Nouzový úder pažbou odlehčené švédské muškety M1624 v boji tělo na tělo (4–6 HP).",
  },
  butcher_cleaver: {
    name: "Řezníkův sekáček",
    description: "Těžký řeznický sekáček, kterým Havel drží ústí brány.",
  },
  thief_knife: {
    name: "Nůž na provazy",
    description: "Krátký nůž Ondřeje Štěrby.",
  },
  harrier_blade: {
    name: "Krátká čepel harcovníka",
    description: "Lehká čepel bez kyrysu.",
  },
  fist: {
    name: "Pěstní souboj",
    description: "Zoufalý boj holýma rukama.",
  },
};

export const csAbilities: Record<string, NamedText> = {
  protector_oath: {
    name: "Přísaha komorníka",
    subtitle: "Věrná stráž",
    description:
      "Přiskočí k maršálovi, přehodí přes něj těžký plášť a zahalí stanoviště kouřem.",
  },
  klementinum_verdict: {
    name: "Svatováclavský ortel",
    subtitle: "Průrazná salva",
    description:
      "Suchý prach z Klementina: vyšší zásah i krit, průraz krytu a žádné selhání v dešti.",
  },
  maltese_shrapnel: {
    name: "Maltézská pekelná salva",
    subtitle: "Šrapnel a dým",
    description: "Železný šrapnel, kouřová clona a jedna petarda navíc.",
  },
  marshal_command: {
    name: "Rozkaz maršála",
    subtitle: "Autorita velitele",
    description: "Spojenci získají akční body a širší zorné pole.",
  },
};

export const csBuffs: Record<BuffId, string> = {
  limp: "Těžké kulhání (zranění z Lützenu)",
  detained_1: "ZADRŽEN ŠVÉDY (1/2 kola) — Vyprostěte jej!",
  detained_2: "ZAJAT ŠVÉDY (2/2 kola)!",
  choking: "Záchvat kašle (zadýmení interiéru: -1 Pohyb)",
};

export const csDoors: Record<string, string> = {
  "door-salaterrena-west": "Západní křídlo portálu Sala Terreny",
  "door-salaterrena-east": "Východní křídlo portálu Sala Terreny",
  "door-bedroom-west": "Západní křídlo dveří ložnice velkopřevora (P1)",
  "door-bedroom-east": "Východní křídlo dveří ložnice velkopřevora (P1)",
  "door-armory": "Kované dveře maltézské zbrojnice",
  "door-garden-west-gate": "Západní branka do Maltézské uličky",
  "door-convent-east": "Dveře kapitulního sálu a knihovny",
};

export const csPerks: Record<string, { name: string; desc: string }> = {
  steel_loyalty: {
    name: "Ocelová věrnost",
    desc: "+20 % odolnost proti šoku a panice, +1 AP při záchraně raněného druha",
  },
  maltese_pyrotechnician: {
    name: "Maltézský pyrotechnik",
    desc: "+2 k dosahu vrhání granátů, výbuchy prachu způsobují o +1 vyšší poškození",
  },
  clementine_zeal: {
    name: "Klementinský zápal",
    desc: "+10 % k přesnosti při střelbě z vyvýšených míst / věže, 0 % šance na selhání zbraně v dešti",
  },
};

export const csMeasures = {
  percent: "%",
  hp: "HP",
  armor: "ZBROJ",
} as const;
