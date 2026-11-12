import type { MessageFn } from "./types";

/**
 * HUD copy that does not belong to the simulation catalog.
 * Add keys here while wiring components. A new language implements the same keys.
 */
export const csUiMessages = {
  "ui.sacrifice.matej.perkName": () => "Ocelová věrnost",
  "ui.sacrifice.bart.perkName": () => "Maltézský pyrotechnik",
  "ui.sacrifice.vaclav.perkName": () => "Klementinský zápal",

  "ui.capture.done": () => "Zajetí dokonáno · 2/2 kola zadržení",
  "ui.capture.shackled": () => "Švédští dragouni spoutali maršála Colloreda!",
  "ui.epilogue.again": () => "Hrát znovu",
  "ui.epilogue.wipe.heading": () => "Odowalského zrada odražena:",
  "ui.epilogue.wipe.body": () =>
    "Švédský přepadový oddíl byl v zahradě Velkopřevorství do jednoho pobit! Cesta k rybářské pramici na Čertovce je zcela volná. Maršál Colloredo bezpečně přeplouvá rozvodněnou Vltavu, aby na pravém břehu zorganizoval legendární obranu Prahy.",
  "ui.epilogue.defeat.surrounded": () =>
    "Obklíčen bez ochranky a zajat po 2 kolech (Kořist a výkupné):",
  "ui.epilogue.defeat.fallen": () => "Družina padla a maršál zůstal v moci Švédů:",
  "ui.epilogue.defeat.down": () =>
    "Sražen k zemi a nevyproštěn včas (Zajetí po 2 kolech):",
  "ui.epilogue.defeat.surroundedBody": () =>
    "Švédští vojáci pronikli přímo k nechráněnému maršálu Rudolfu Colloredovi a drželi jej v šachu po dvě kola, aniž by jej jeho družina dokázala vyprostit. Maršál byl v noční košili odzbrojen a spoután pro královské výkupné (100 000 říšských tolarů).",
  "ui.epilogue.defeat.fallenBody": () =>
    "Všichni věrní obránci z maršálova doprovodu v zahradě Velkopřevorství padli. Zraněného polního maršála Rudolfa Colloreda už neměl kdo vyprostit ze švédského obklíčení a dragouni jej odvlekli v poutech.",
  "ui.epilogue.defeat.downBody": () =>
    "Polní maršál Rudolf Colloredo klesl pod švédskou palbou k zemi (0 HP) a během dvou kol nebyl svou družinou vyproštěn. Švédští dragouni jej v noční košili spoutali pro tučné výkupné (100 000 říšských tolarů).",
  "ui.epilogue.defeat.coda": () =>
    "Stejně jako na Hradčanech a Malé Straně, kde padlo do zajetí přes 200 šlechticů včetně kardinála Harracha a purkrabího Martinice, ztratila Praha svého vrchního velitele — nikdo nezorganizoval posádku na Karlově mostě včas a celá Praha padla do rukou generála Königsmarcka!",

  "ui.splash.round": (p) => `Kolo ${p.count ?? 0} · Anno 1648`,
  "ui.splash.player": () => "Útěk maršála Colloreda",
  "ui.splash.enemy": () => "Přepad Odowalského",
  "ui.splash.player.r3": () => "Polnice z Mostecké ulice! Těžké švédské posily dorazí v kole 5!",
  "ui.splash.player.r4": () =>
    "POZOR: Švédská jízda obkličuje bránu — posily vtrhnou v příštím kole!",
  "ui.splash.player.r5": () => "POPLACH: Švédská jízda generála Königsmarcka vpadla do zahrady!",
  "ui.splash.player.escort": () =>
    "Eskortujte kulhajícího maršála k rybářské pramici na Čertovce!",
  "ui.splash.enemy.body": () => "Švédští dragouni prohledávají zahradu Velkopřevorství!",

  "ui.mission.aria": () => "Stav mise a kolo",
  "ui.mission.drag": () => "Tažením myší můžete stužku stavu mise odsunout",
  "ui.mission.round": (p) => `Kolo ${p.count ?? 0}`,
  "ui.mission.defenders": () => "Obránci",
  "ui.mission.swedes": () => "Švédové",
  "ui.mission.detainedTip": (p) =>
    `POZOR: Maršál Colloredo je zadržen Švédy (${p.progress ?? 0}/2 kola)!`,
  "ui.mission.boatTip": (p) =>
    `Vzdálenost maršála Colloreda k rybářské pramici na Čertovce: ${p.distance ?? 0} polí`,
  "ui.mission.detained": (p) => `Maršál ZADRŽEN (${p.progress ?? 0}/2)`,
  "ui.mission.boat": () => "Pramice",
  "ui.mission.escape": () => "ÚNIK!",
  "ui.mission.reinforcementHere": () =>
    "Švédská jízda generála Königsmarcka vtrhla severní branou do zahrady!",
  "ui.mission.reinforcementIn": (p) =>
    `Švédské jízdní posily dorazí za ${p.count ?? 0} kola`,
  "ui.mission.reinforcementGarden": () => "Posily v zahradě!",
  "ui.mission.reinforcement": () => "Posily",
  "ui.mission.enemyTipSeen": (p) =>
    `Zbývá ${p.count ?? 0} Švédů (${p.required ?? 0} v přímém dohledu)`,
  "ui.mission.enemyTip": (p) => `Zbývá ${p.count ?? 0} Švédů`,
  "ui.mission.enemies": () => "Švédů",
  "ui.mission.seen": (p) => `(${p.count ?? 0} vid.)`,
  "ui.mission.weatherCycle": (p) => `Přepnout počasí: ${p.names ?? ""}`,
  "ui.weather.rain.short": () => "Liják",
  "ui.weather.fog.short": () => "Mlha",
  "ui.weather.clear.short": () => "Jasno",
  "ui.mission.reset": () => "Vrátit stužku na výchozí místo",
  "ui.mission.expand": () => "Rozbalit stav mise",
  "ui.mission.collapse": () => "Sbalit stav mise",

  "ui.camera.action": () => "Akční kinematická kamera [C]",
  "ui.render.mode": () => "Přepnout 2D sprity / 3D modely [M]",
  "ui.fullscreen": () => "Celá obrazovka [F]",
  "ui.advisor.toggle": () => "Taktický rádce [H]",
  "ui.battle.restart": () => "Restartovat bitvu",
  "ui.floors.sectionAria": () => "Průřez pater Velkopřevorského paláce",
  "ui.floors.section": () => "Průřez pater",
  "ui.floors.sight": (p) => `· Dohled ${p.distance ?? 0}m`,
  "ui.floors.cycle": () => "[V] Přepnout",
  "ui.contact.mark": () => "[?] Kontakt",
  "ui.contact.fog": () => "Kontakt v šerosvitu",
  "ui.contact.approach": (p) =>
    `${p.names ?? ""} — Přibližte se s jednotkou nebo vystoupejte na strážní věž pro odhalení cíle`,

  "ui.chronicle.heading": (p) => `Diarium Belli (${p.count ?? 0})`,

  "ui.portrait.named": (p) => `Portrét postavy ${p.names ?? ""}`,
  "ui.portrait.archetype": (p) => `Portrét archetype ${p.names ?? ""}`,
  "ui.portrait.vip": () => "VIP Hrdina (Vyžaduje ochranu)",

  "ui.cover.full": () => "Plný kryt (−40 % k šanci nepřítele na zásah)",
  "ui.cover.half": () => "Poloviční kryt (−20 % k šanci nepřítele na zásah)",
  "ui.cover.none": () => "Bez krytu (0 % obranný bonus)",

  "ui.tutorial.aria": () => "Rozkaz velení tutoriálu",
  "ui.tutorial.tip.collapse": () => "Sbalit taktickou nápovědu",
  "ui.tutorial.tip.expand": () => "Rozbalit detailní taktickou nápovědu",
  "ui.tutorial.tip.hide": () => "Skrýt radu",
  "ui.tutorial.tip.show": () => "Taktická rada",
  "ui.tutorial.skip": () => "Přeskočit skriptovaný výcvik a přejít přímo do volného boje [Shift+H]",
  "ui.tutorial.skipLabel": () => "Přeskočit výcvik",
  "ui.tutorial.minimize": () => "Minimalizovat rádce [H]",
  "ui.tutorial.enemyTurn": () => "Tah Švédů...",
  "ui.tutorial.lesson": () => "Taktické ponaučení:",

  "ui.advisor.aria": () => "Taktický rádce",
  "ui.advisor.drag": () => "Tažením lze rádce posunout",
  "ui.advisor.chip": (p) => `Rádce ${p.count ?? 1}/4:`,
  "ui.advisor.collapse": () => "Sbalit rádce",
  "ui.advisor.expand": () => "Rozbalit rady pro tento krok",
  "ui.advisor.collapseLabel": () => "Sbalit",
  "ui.advisor.detail": () => "Detail",
  "ui.advisor.reset": () => "Vrátit na výchozí místo",
  "ui.advisor.close": () => "Zavřít rádce [H]",
  "ui.advisor.next": () => "Další",
  "ui.advisor.done": () => "Hotovo",
  "ui.advisor.1.title": () => "Ovládání XCOM 2: LKM Výběr · PKM Pohyb",
  "ui.advisor.1.dialogue": () =>
    "Vaše Excelence! Po těch sedmi střelných ranách u Lützenu těžce kulháte a sotva stojíte na nohou! Zůstanu při vás a budeme se krýt za zídkami zahradou k Čertovce!",
  "ui.advisor.1.t1": () =>
    "Levé tlačítko (LKM): Kliknutím na vojáka jej aktivujete a ovládáte ikony schopností ve spodní liště.",
  "ui.advisor.1.t2": () =>
    "Pravé tlačítko (PKM — Move / Dash): Umístěte kurzor na políčko v modré (1 AP) nebo žluté (2 AP) zóně a klikněte pravým tlačítkem — voják se okamžitě vydá na cestu.",
  "ui.advisor.1.t3": () =>
    "Postih „Těžké kulhání“: Zraněný maršál Colloredo ujde kvůli starým zraněním z Lützenu jen 3 pole za 1 AP.",
  "ui.advisor.1.t4": () =>
    "Ochrana maršála & Zajetí: Švédové po hraběti nikdy nestřílí (chtějí jej živého pro výkupné), ale zajmou jej za 1 AP těsně vedle něj nebo do 3 polí s nabitou zbraní! Na družinu nebudou střílet, pokud stojí do 3 polí od hraběte a střelec hraběte vidí.",
  "ui.advisor.1.t5": () =>
    "Cíl eskorty: Probojujte se s maršálem Colloredem skrz zahradu plnou švédských hlídek k rybářské pramici na Čertovce!",
  "ui.advisor.2.title": () => "Střelba, Hlavy cílů & Zteč zblízka (PKM)",
  "ui.advisor.2.dialogue": () =>
    "Pozor, pane! Švédští mušketýři mají odlehčené gustaviánské muškety M1624, zatímco naši obránci mohou nepřítele ztečovat i chladnou zbraní!",
  "ui.advisor.2.t1": () =>
    "Výběr cíle (LKM): V režimu střelby [2] levým kliknutím na ikonu hlavy nepřítele v pravém dolním rohu přepínáte mezi viditelnými cíli.",
  "ui.advisor.2.t2": () =>
    "Útok zblízka (XCOM 2 — PKM): Pravým kliknutím přímo na nepřítele v dosahu provedete okamžitý přesun spojený se seknutím — samotný útok už nestojí další AP navíc!",
  "ui.advisor.2.t3": () =>
    "Zrušení akce (PKM): Pravé tlačítko v menu střelby či granátu akci zruší a vrátí vás na bojiště.",
  "ui.advisor.3.title": () => "Fázové nabíjení, Petardy (LKM) & Sudy",
  "ui.advisor.3.dialogue": () =>
    "Moje těžká mušketa potřebuje na nabití 4 AP, švédská s papírovými patronami jen 2 AP — nabíjet však můžeme postupně po 1 AP mezi přesuny!",
  "ui.advisor.3.t1": () =>
    "Fázové nabíjení po 1 AP [R]: Investujte 1 AP do kroku nabíjení a za druhý AP ustupte pravým tlačítkem do krytu.",
  "ui.advisor.3.t2": () =>
    "Házení granátů / petard [4]: Po zvolení petardy v liště zamíříte a levým kliknutím (LKM) hod potvrdíte (pravým kliknutím zrušíte).",
  "ui.advisor.3.t3": () =>
    "Prachové sudy: Trefa nebo petarda odpálí sud na ploše 3×3. Maják označuje nejbližší sud u paláce.",
  "ui.advisor.4.title": () => "Schodiště, Patra paláce & Pramice",
  "ui.advisor.4.dialogue": () =>
    "Za zahradou teče Čertovka! Rybář čeká s pramicí u dřevěného mola. Využijte schodiště do 1. patra i na Maltézskou věž pro palebnou převahu!",
  "ui.advisor.4.t1": () =>
    "Schodiště [V / PgUp / PgDn]: Výšková převaha z 1. a 2. patra přidává +15 % k zásahu a rozšiřuje dohled.",
  "ui.advisor.4.t2": () =>
    "Cíl mise: Doveďte maršála Colloreda na únikové molo k pramici na Čertovce!",
  "ui.advisor.4.dock": (p) =>
    `Cíl mise: Doveďte maršála Colloreda na molo [${p.x ?? 0}, ${p.y ?? 0}, ${p.z ?? 0}] k pramici na Čertovce!`,

  "ui.door.closePortal": () => "Zavřít portál (0 AP)",
  "ui.door.openPortal": () => "Otevřít dvoukřídlý portál (0 AP)",
  "ui.door.close": () => "Zavřít dveře (0 AP)",
  "ui.door.open": () => "Otevřít dveře (0 AP)",
  "ui.stair.climb": (p) =>
    `Pravým/levým kliknutím vyběhnout/seběhnout po schodišti do patra P${p.floor ?? 0} (${p.count ?? 0} AP)`,
  "ui.stair.look": (p) => `Kliknutím přepnout pohled kamery do patra P${p.floor ?? 0}`,
  "ui.recon.los": () => "Počet nepřátel v přímé palebné linii z této dlaždice",
  "ui.recon.revealed": () => "Nově odhalení nepřátelé v šerosvitu",
  "ui.grenade.throw": () => "💥 LKM: Hodit petardu (3×3)",
  "ui.grenade.out": () => "Mimo dosah hodu (>8m)",
  "ui.grenade.back": () => "PKM: Zpět",
  "ui.boat.certovka": () => "Pramice na Čertovce",

  "ui.loss.captured": () => "ZAJAT! (2/2)",
  "ui.loss.detained": (p) => `ZADRŽEN (${p.progress ?? 1}/2)`,
  "ui.loss.volley": (p) =>
    p.chance === undefined ? "PALBA" : `PALBA · ${p.chance}%`,
  "ui.loss.throesBadge": (p) => `VZEPĚTÍ (${p.hp ?? 0} HP)`,
  "ui.loss.cuirass": (p) => `KYRYS (${p.count ?? 0})`,
  "ui.loss.shaken": () => "OTŘESEN",
  "ui.overwatch.active": () => "Hlídka (Overwatch) aktivní",

  "ui.inspect.hidden": () =>
    "Jméno, zbraň a schopnosti zůstávají skryté, dokud postavu neuvidíte.",
  "ui.inspect.cover": () => "Kryt proti střelbě",
  "ui.inspect.occupant": (p) =>
    `Na poli stojí ${p.names ?? ""}. Klepněte na postavu pro její list.`,
  "ui.inspect.glance": (p) => `${p.names ?? ""} · hledí ${p.facing ?? ""}`,
  "ui.inspect.firearm": () => "Palná zbraň",
  "ui.inspect.melee": () => "Zbraň nablízko",
  "ui.inspect.abilities": () => "Schopnosti a stavy",

  "ui.ribbon.soldierAria": () => "Status vybraného vojáka",
  "ui.ribbon.medallionDrag": () =>
    "Tažením lze medailon posunout · Kliknutím nebo klávesou [Tab] přepnete vojáka",
  "ui.ribbon.squadTip": (p) => {
    const hp = `${p.hp ?? 0}/${p.required ?? 0}`;
    const vitals = p.agony ? `V POSLEDNÍM VZEPĚTÍ: ${hp}` : hp;
    const ended = p.open ? "" : " — Tah ukončen";
    return `${p.names ?? ""} (${vitals} HP, ${p.count ?? 0} AP)${ended}`;
  },
  "ui.ribbon.nextSoldier": () => "Další dostupný voják čety [Tab]",
  "ui.ribbon.pistolEmpty": () => "Vybitá",
  "ui.ribbon.reload": (p) => `Nabití ${p.progress ?? 0}/${p.required ?? 0}`,
  "ui.ribbon.health": (p) => `Zdraví: ${p.hp ?? 0}/${p.required ?? 0}`,
  "ui.ribbon.armor": (p) => `Zbroj: ${p.armor ?? 0}/${p.required ?? 0}`,
  "ui.ribbon.ap": (p) => `Akční body: ${p.count ?? 0}/${p.required ?? 0} AP`,
  "ui.ribbon.targetsAria": () => "Viditelné cíle v dohledu",
  "ui.ribbon.prevTarget": () => "Předchozí cíl [Shift+Tab]",
  "ui.ribbon.nextTarget": () => "Další cíl [Tab]",
  "ui.ribbon.targetTip": (p) =>
    `${p.names ?? ""} · ${p.chance ?? 0}% zásah (LKM: Zaměřit cíl)`,
  "ui.ribbon.barAria": () => "Taktická akční lišta",
  "ui.ribbon.noLos": () => "Žádný cíl v přímém dohledu (3D LoS)",
  "ui.ribbon.backAim": () => "Zpět (PKM / Esc)",
  "ui.ribbon.hitBreak": () => "Rozpad zásahu",
  "ui.ribbon.breakdown": () => "Rozpad",
  "ui.ribbon.breakdownTip": () => "Zobrazit matematický rozpad bonusů a postihů",
  "ui.ribbon.cancelAim": () => "Zrušit míření [Pravé tlačítko myši / Esc]",
  "ui.ribbon.fire": () => "PAL!",
  "ui.ribbon.fireCost": (p) => `${p.count ?? 1} AP · [LKM / ⎵]`,
  "ui.ribbon.critArmor": () => "Krit & Kyrys",
  "ui.ribbon.noMelee": () => "Žádný nepřítel na sousední dlaždici (1m)",
  "ui.ribbon.backMelee": () => "Zpět (Esc)",
  "ui.ribbon.meleeHead": (p, ctx) => `Zblízka · ${ctx.melee(p.meleeId)}`,
  "ui.ribbon.strike": () => "ÚDER!",
  "ui.ribbon.strikeCost": () => "1 AP · [⎵]",
  "ui.ribbon.dockDrag": () => "Tažením lze dok schopností odsunout",
  "ui.ribbon.move.title": () => "Taktický přesun & Sprint",
  "ui.ribbon.move.cost": () => "1–2 AP",
  "ui.ribbon.move.summary": (p) =>
    `Pravým tlačítkem myši (PKM) na políčko okamžitě vyšlete vojáka na cestu. Modrá zóna (1 AP): Běžný přesun (${p.count ?? 4} polí). Zlatá zóna (2 AP): Sprint.`,
  "ui.ribbon.move.detail": () =>
    "XCOM 2 Zteč: Pravým klikem přímo na nepřítele v dosahu provedete okamžitý přesun spojený se seknutím (+0 AP navíc)!",
  "ui.ribbon.move.blocked": () => "Nyní nelze zadat rozkaz",
  "ui.ribbon.move.noAp": () => "Voják již nemá žádné volné akční body (tah ukončen)",
  "ui.ribbon.move.aria": () => "Pohyb [1]",
  "ui.ribbon.fireTitle": (p, ctx) => `Palba: ${ctx.weapon(p.weaponId) || "Střelná zbraň"}`,
  "ui.ribbon.fireEnds": (p) => `${p.count ?? 1} AP (ukončuje tah)`,
  "ui.ribbon.shoot.summary": (p) =>
    `Výstřel z pušky/muškety ukončuje tah vojáka. Zranění ${p.damage ?? 4}–${p.required ?? 6} HP · Průraz zbroje ${p.armor ?? 1} · Dostřel ${p.distance ?? 12}m.`,
  "ui.ribbon.shoot.detail": () =>
    "LKM na ikonu hlavy nepřítele vpravo dole přepíná cíle · PKM míření zruší.",
  "ui.ribbon.shoot.blocked": () => "Nyní nelze střílet",
  "ui.ribbon.shoot.noAp": () => "Nedostatek AP pro střelbu",
  "ui.ribbon.shoot.pistolSpent": () =>
    "Kolečková bambitka maršála byla vystřelena (použijte pažbu [B])",
  "ui.ribbon.shoot.empty": (p) =>
    `Hlaveň je prázdná — nejprve nabijte [R] (${p.progress ?? 0}/${p.required ?? 0} AP)`,
  "ui.ribbon.shoot.noLos": () =>
    "Žádný nepřítel není v přímé viditelnosti (3D LoS) z této dlaždice",
  "ui.ribbon.shoot.aria": () => "Střelba [2]",
  "ui.ribbon.reload.title": () => "Fázové nabíjení hlavně",
  "ui.ribbon.reload.cost": () => "1 AP / krok",
  "ui.ribbon.reload.pistol": () =>
    "Kolečkovou bambitku maršála Colloreda nelze uprostřed šarvátky znovu natáhnout.",
  "ui.ribbon.reload.progress": (p) =>
    `Postup nabíjení: ${p.progress ?? 0}/${p.required ?? 0} AP. Každý stisk investuje 1 AP a postup se přenáší do dalších kol.`,
  "ui.ribbon.reload.ready": (p) =>
    `Zbraň je plně nabitá (${p.required ?? 0}/${p.required ?? 0} AP) a připravená k výstřelu.`,
  "ui.ribbon.reload.blocked": () => "Nyní nelze nabíjet",
  "ui.ribbon.reload.pistolNo": () => "Jednoranná bambitka nelze v boji přebít",
  "ui.ribbon.reload.full": () => "Zbraň je již plně nabitá",
  "ui.ribbon.reload.noAp": () => "Nedostatek AP (vyžaduje 1 AP na krok)",
  "ui.ribbon.reload.aria": () => "Nabít zbraň [R]",
  "ui.ribbon.meleeTitle": (p, ctx) => `Boj zblízka: ${ctx.melee(p.meleeId) || "Pažba"}`,
  "ui.ribbon.melee.cost": () => "1 AP (0 AP při zteči)",
  "ui.ribbon.melee.summary": (p) =>
    `Zranění ${p.damage ?? 2}–${p.required ?? 4} HP. Pravým kliknutím (PKM) přímo na nepřítele v dosahu provedete okamžitý přesun spojený se seknutím bez další AP ceny!`,
  "ui.ribbon.melee.detail": () =>
    "Tip: Klikněte pravým tlačítkem přímo na nepřítele v dosahu pohybu pro okamžitou zteč!",
  "ui.ribbon.melee.blocked": () => "Nyní nelze útočit",
  "ui.ribbon.melee.noAp": () => "Nedostatek AP pro úder",
  "ui.ribbon.melee.none": () =>
    "Žádný nepřítel nestojí na sousední dlaždici (použijte PKM zteč z dálky)",
  "ui.ribbon.melee.aria": () => "Útok zblízka [B]",
  "ui.ribbon.overwatch.cone": () => "Připravená salva (90° kužel)",
  "ui.ribbon.overwatch.ring": () => "Hlídka — Overwatch (360°)",
  "ui.ribbon.overwatch.coneBody": (p) =>
    `Doutnáková mušketa zaměří 90° palebný sektor před střelcem (${p.facing ?? ""}) a automaticky vypálí na prvního Švéda v pohybu.`,
  "ui.ribbon.overwatch.ringBody": () =>
    "Kolečkový zámek umožňuje okamžitou reaktivní palbu v okruhu 360° na pohybujícího se nepřítele.",
  "ui.ribbon.overwatch.blocked": () => "Nyní nelze aktivovat hlídku",
  "ui.ribbon.overwatch.active": () => "Hlídka je již aktivní",
  "ui.ribbon.overwatch.empty": () => "Nelze držet hlídku s vybitou hlavní (nejprve nabijte [R])",
  "ui.ribbon.overwatch.need": (p) => `Vyžaduje ${p.required ?? 0} AP`,
  "ui.ribbon.overwatch.aria": () => "Hlídka [3]",
  "ui.ribbon.grenade.title": () => "Litinová petarda s černým prachem",
  "ui.ribbon.grenade.cost": () => "1 AP",
  "ui.ribbon.grenade.summary": () =>
    "Plošný výbuch 3×3 (dosah 8m): způsobí 4 HP poškození, strhne 1 bod zbroje, zničí nízké kryty a odpálí prachové sudy.",
  "ui.ribbon.grenade.detail": (p) =>
    `LKM: Potvrdit hod do zóny · PKM: Zrušit míření (Zbývá: ${p.count ?? 0})`,
  "ui.ribbon.grenade.blocked": () => "Nyní nelze házet petardu",
  "ui.ribbon.grenade.none": () => "Voják již nemá žádné další petardy",
  "ui.ribbon.grenade.noAp": () => "Nedostatek AP pro hod petardy",
  "ui.ribbon.grenade.aria": () => "Petarda [4]",
  "ui.ribbon.ability.renew": (p) => `Obnovení za ${p.count ?? 0} kola`,
  "ui.ribbon.ability.ready": (p) => `Obnova: ${p.count ?? 0} kola`,
  "ui.ribbon.ability.blocked": () => "Nyní nelze použít schopnost",
  "ui.ribbon.ability.cooling": (p) => `Schopnost je v obnově (${p.count ?? 0} kola)`,
  "ui.ribbon.ability.need": (p) => `Vyžaduje ${p.required ?? 0} AP`,
  "ui.ribbon.ability.aria": (p) => `${p.names ?? ""} [5]`,
  "ui.ribbon.end.title": () => "Ukončit tah obránců",
  "ui.ribbon.end.cost": () => "Konec kola",
  "ui.ribbon.end.spent": () =>
    "Všichni obránci již vyčerpali své akční body. Předá iniciativu švédské hlídce.",
  "ui.ribbon.end.open": () =>
    "Předá tah švédské hlídce generála Königsmarcka i se zbývajícími AP.",
  "ui.ribbon.end.aria": () => "Ukončit tah [Mezerník]",
  "ui.ribbon.end.label": () => "Konec",

  "ui.title.aria": () => "Praha 1648: Víra v časech olova",
  "ui.title.place": () => "Praha",
  "ui.title.year": () => "1648",
  "ui.title.subtitle": () => "Víra v časech olova",
  "ui.title.anno": () => "Anno Salutis",
  "ui.title.company": () => "Železná vigilie",
  "ui.title.motto": () => "Fidelitas Ferrea",
  "ui.title.date": () => "26. července 1648",
  "ui.briefing.kicker": () => "Praha, 26. července 1648",
  "ui.briefing.title": () => "Vyberte ráno",
  "ui.briefing.start": () => "Zahájit",
  "ui.briefing.mission1.index": () => "Mise I",
  "ui.briefing.mission1.when": () => "Noc",
  "ui.briefing.mission1.place": () => "Velkopřevorský palác",
  "ui.briefing.mission1.title": () => "Útěk",
  "ui.briefing.mission1.body": () =>
    "Maršál Colloredo v noční košili, zahrada a pramice na Čertovce.",
  "ui.briefing.mission2.index": () => "Mise II",
  "ui.briefing.mission2.when": () => "Ráno",
  "ui.briefing.mission2.place": () => "Staroměstská mostecká věž",
  "ui.briefing.mission2.chip": () => "Železná mříž",
  "ui.briefing.mission2.title": () => "Mříž",
  "ui.briefing.mission2.body": () =>
    "Páter Plachý, řezník a zloděj lan. Harcovníci na prahu, jeden okultista u svorníku.",
  "ui.splash.m2.player": () => "Spusťte mříž",
  "ui.splash.m2.enemy": () => "Harcovníci na prahu",
  "ui.splash.m2.player.body": () =>
    "Rumpál je v síni nad klenbou. Nápis pod střechou přidá obřadu kolo.",
  "ui.splash.m2.enemy.body": () =>
    "Démoničtí harcovníci stojí na prahu. Okultista jde několik kol za nimi.",
  "ui.floor.m2.2.title": () => "Ochoz pod střechou",
  "ui.floor.m2.2.sub": () => "Nápis a světci východního průčelí",
  "ui.floor.m2.1.title": () => "Síň s rumpálem",
  "ui.floor.m2.1.sub": () => "Odtud se spouští železná mříž",
  "ui.floor.m2.0.title": () => "Průjezd a práh",
  "ui.floor.m2.0.sub": () => "Most na západ, náměstí na východ",
  "ui.mission.rite": (p) => `Obřad ${p.progress ?? 0}/${p.required ?? 3}`,
  "ui.mission.windlass": (p) => `Rumpál ${p.progress ?? 0}/${p.required ?? 1}`,
  "ui.mission.windlassHp": (p) => `Rumpál ${p.hp ?? 0} HP`,
  "ui.epilogue.m2.title": () => "Mříž dosedla",
  "ui.epilogue.m2.body": () =>
    "Železo sedí v ústí průjezdu a stráž věže ještě drží. V Klementinu nabídne Plachý přísahu krve a železa těm, kdo přežili. Sám neskládá noviciát.",
  "ui.epilogue.m2.defeat.rite": () => "Obřad byl rychlejší než železo.",
  "ui.epilogue.m2.defeat.plachy": () => "Páter padl. Věž se bez něj neudrží.",
  "ui.epilogue.m2.defeat.wiped": () => "Obrana věže padla do posledního muže.",
  "ui.epilogue.m2.defeat.windlass": () => "Rumpál je zničený a mříž zůstala nahoře.",
  "ui.epilogue.m2.other": () => "Jiná mise",
  "ui.ribbon.kneel": () => "Pokleknout, 1 AP",
  "ui.ribbon.kneel.aria": () => "Pokleknout u nápisu za 1 AP",
  "ui.ribbon.unpin": () => "Vyrazit západku, 1 AP",
  "ui.ribbon.unpin.aria": () => "Vyrazit západku rumpálu za 1 AP",
  "ui.ribbon.severRope": () => "Přeříznout lano, 1 AP",
  "ui.ribbon.severRope.aria": () => "Přeříznout kotevní lano mříže za 1 AP",
  "ui.ribbon.douse": () => "Uhasit oheň, 1 AP",
  "ui.ribbon.douse.aria": () => "Uhasit hořící rumpál za 1 AP",
  "ui.mission.windlassBurning": () => "Rumpál hoří! (−3 HP)",
  "ui.mission.ropeTaut": () => "Lano napnuto",
  "ui.oath.both": () => "Přijmout oba",
  "ui.oath.havel": () => "Jen Havla",
  "ui.oath.ondrej": () => "Jen Ondřeje",
  "ui.oath.neither": () => "Nepřijmout nikoho",
  "ui.oath.done": () => "Přísaha je zapsaná.",
} satisfies Record<string, MessageFn>;

export type UiMessageId = keyof typeof csUiMessages;
