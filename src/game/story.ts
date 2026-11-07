import type { Epilogue, Unit } from "./types";

const LINES: Record<
  string,
  { sail: string; alley: string; bank: string; stood: string; martyr: string }
> = {
  martin: {
    sail: "Martin držel vesla, dokud světla Malé Strany nezhasla za zády. Rapír mu zůstal na kolenou.",
    alley: "Padl v uličce u paláce. Dragoun, který měl krýt ústup, koupil maršálovi první krok.",
    bank: "Padl na břehu v posledním vzdoru. Rapír zůstal tam, kde loďka už nesahá.",
    stood: "Tři nárazy přežil a do loďky nevstoupil. Rapír si nechal pro ulice, které ho nepropustí.",
    martyr: "Martin, císařský dragoun",
  },
  vaclav: {
    sail: "Václav odplul s mokrým doutnákem a kapsou střelného prachu. Z Klementina ho už nikdo nezkoušel.",
    alley: "Zůstal ležet mezi dlažbou a rozlitým prachem. Student, který vystřelil dřív, než se naučil nabíjet poslepu.",
    bank: "Padl na břehu s mokrým doutnákem. Poslední výstřel patřil břehu, ne řece.",
    stood: "Tři nárazy přežil s vlhkým prachem v kapse. Loďka odrazila bez něj.",
    martyr: "Václav z Klementina",
  },
  jakub: {
    sail: "Mistr Jakub odrazil od břehu s halapartnou přes kolena. Kovárna na Malé Straně vychladla bez něj.",
    alley: "Padl mezi vozy, jak stál — hradba, která se neotevřela.",
    bank: "Padl na břehu, jak stál. Halapartna držela ulici ještě chvíli potom, co loďka zmizela.",
    stood: "Tři nárazy vydržel a zůstal na kamenech. Kovárna na Malé Straně na něj počká marně.",
    martyr: "Mistr Jakub, kovář",
  },
};

const ACC: Record<string, string> = {
  Colloredo: "Colloreda",
  Martin: "Martina",
  Václav: "Václava",
  Jakub: "Jakuba",
  "Švédský mušketýr": "Švédského mušketýra",
  "Švédský pikenýr": "Švédského pikenýra",
  "Švédský granátník": "Švédského granátníka",
  Olof: "Švédského mušketýra",
  Lars: "Švédského mušketýra",
  Erik: "Švédského pikenýra",
  Nils: "Švédského pikenýra",
  Sven: "Švédského vojáka",
  Gustaf: "Švédského vojáka",
  Anders: "Švédského vojáka",
  Per: "Švédského vojáka",
  Karl: "Švédského vojáka",
  Bengt: "Švédského vojáka",
};

export function accName(name: string): string {
  return ACC[name] ?? name;
}

function heroLine(unit: Unit): string {
  const pack = LINES[unit.id];
  if (!pack) return unit.name;
  if (unit.fate === "sailed") return pack.sail;
  if (unit.fate === "alley") return pack.alley;
  if (unit.fate === "stood") return pack.stood;
  return pack.bank;
}

function fallenSwedes(n: number): string {
  if (n <= 0) return "Ze Švédů nepadl nikdo.";
  if (n === 1) return "Ze Švédů padl jeden.";
  if (n <= 4) return `Ze Švédů padli ${n}.`;
  return `Ze Švédů padlo ${n}.`;
}

export function victoryTale(
  heroes: Unit[],
  round: number,
  kills: number,
): Epilogue {
  const survivor = heroes.find((u) => u.fate === "sailed") ?? null;
  const martyrs = heroes.filter((u) => u.id !== survivor?.id);
  const who = survivor ? (LINES[survivor.id]?.martyr ?? survivor.name) : "Nikdo";
  const dead = martyrs.filter((u) => !u.alive).length;
  const stay =
    dead === martyrs.length
      ? "Dva zůstali městu, které je nepojmenuje na pomníku."
      : dead === 0
        ? "Dva zůstali na břehu. Loďka se pro ně nevrátí."
        : "Jeden zůstal ležet, druhý ve tmě uliček. Loďka se nevrátí.";
  const sailedAs =
    survivor?.name === "Jakub" ? "mistra Jakuba" : survivor?.name === "Václav" ? "Václava" : "Martina";
  return {
    outcome: "victory",
    kicker: dead === martyrs.length ? "Přežil jen jeden" : "Odplul jen jeden",
    title: survivor ? `${survivor.name} odplouvá` : "Loďka mizí ve tmě",
    survivor: who,
    martyrs: martyrs.map((u) => ({
      name: LINES[u.id]?.martyr ?? u.name,
      line: heroLine(u),
    })),
    paragraphs: [
      survivor ? `Loďka unesla maršála Colloreda a ${sailedAs}. ${stay}` : "Loďka se odtrhla. Jména na ní už tma neudrží.",
      survivor ? heroLine(survivor) : "",
      `Kolo ${round}. ${fallenSwedes(kills)} Vltava si pamatuje jen světlo lucerny, které se zmenšovalo.`,
    ].filter((p) => p.length > 0),
  };
}

export function defeatTale(
  reason: "colloredo" | "nohero",
  round: number,
  spot: "water" | "street",
): Epilogue {
  if (reason === "colloredo") {
    const line =
      spot === "water"
        ? "Colloredo klesl na nábřeží. Loďka zůstala prázdná a město ztrácí jméno, které ještě drželo hradby."
        : "Colloredo klesl na dlažbu. Bez něj nemá loďka komu sloužit a město ztrácí jméno, které ještě drželo hradby.";
    return {
      outcome: "defeat",
      kicker: "26. července 1648",
      title: "Maršál padl",
      survivor: null,
      martyrs: [],
      paragraphs: [line, "Königsmarkovi muži projdou dál. Malá Strana tu noc nepočká na ráno.", `Konec v kole ${round}.`],
    };
  }
  const line =
    spot === "water"
      ? "Tři hrdinové umlkli dřív, než loďka odrazila. Colloredo stál u vody sám — a sám na ni nesmí."
      : "Tři hrdinové umlkli dřív, než došli k vodě. Colloredo zůstal v uličkách sám — a sám na loďku nesmí.";
  return {
    outcome: "defeat",
    kicker: "26. července 1648",
    title: "Není komu veslovat",
    survivor: null,
    martyrs: [],
    paragraphs: [line, "Švédové ho našli dřív, než proud vzal prázdné veslo.", `Konec v kole ${round}.`],
  };
}