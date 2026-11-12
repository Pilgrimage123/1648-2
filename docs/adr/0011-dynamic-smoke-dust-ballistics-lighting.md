# 11. Organické sjednocení dýmu, prachu a explozí s dynamickým šerosvitem a taktickou kauzalitou (Unified Dynamic Smoke, Dust, Blast Shockwave & Chiaroscuro Lighting)

Datum: 2026-11-11

## Stav

Přijato (vyplynulo z `/grill-with-docs` architektonického a doménového auditu).

## Kontext

Stávající implementace kouře, prachu a explozí v projektu vykazovala několik vizuálních a herních nedostatků:
1. **Roztříštěná vizuální reprezentace**: Kouř byl vykreslován jako 3 izolované koule na dlaždici v `InstancedBattlefield.tsx` (`CreepingSmokeTile`), prach ze zásahů zdiva a exploze prachových sudů existovaly jako krátkodobé separátní meshe v `CombatLines3D.tsx` a atmosférické částice žily odděleně v `RainParticles.tsx`. Sousední pole kouře se organicky nespojovala a koule tvořily ostré průsečíky s podlahou a sokly zdí.
2. **Absence dynamického rozptylu světla (Chiaroscuro)**: Výbuchy a výstřely měly separátní bodová světla, která však vnitřně neprosvěcovala oblaka kouře a prachu. Chyběl dramatický barokní efekt vnitřního prozáření dýmu jantarovým plamenem (volumetric forward-scattering).
3. **Plochá a statická fyzika prostředí**: Detonace prachového sudu či granátu pouze plošně nastavila kouř na všechna zasažená pole ($3\times3$) včetně epicentra. V reálné balistice 17. století rázová vlna střed exploze okamžitě vyfoukne a stlačí dým a trosky do expandujícího prstence.
4. **Nerealistická vnitřní ventilace**: V uzavřených sálech paláce (`isEnclosedRoofedCoord`) se sirný dým z mušket choval stejně jako v zahradě, přestože v interiéru způsobuje dusivou clonu, která pomalu vyvětrává otevřenými portály.
5. **Nedostatečná taktická kauzalita kouře**: Kouř dosud uděloval pouze fixní postih k přesnosti (`-10 %` střelci, `-15 %` cíli), bez ohledu na to, zda zrakový paprsek prochází jedním polem, nebo pěti metry neprostupné clony. Chybělo přerušení reakční palby (Overwatch) a zohlednění kontaktního boje.

## Rozhodnutí

### 1. Sjednocené instancované částicové pole (`CombatAtmosphereField`)
- Veškeré atmosférické částice bojiště (černoprachový dým, omítkový prach ze střelby do zdí, žhavé jiskry a popílek) se konsolidují do jediné komponenty `CombatAtmosphereField` v `TacticalScene.tsx`.
- **Soft-Depth Attenuation**: Částice využívají instancované bilboardové quady s vlastním shaderem s měkkým útlumem hloubky (`depthWrite: false`), který eliminuje tvrdé polygony na styku s podlahou či zdmi.
- **Tři specializované materiálové buffery (celkový rozpočet $\le 600$ částic)**:
  1. *Černoprachový dým*: Těžký, pomalu rotující sirný kouř v odstínech břidlice až antracitu (`#1e293b` až `#334155`).
  2. *Omítkový prach*: Jemný pískovcový a vápenný prach (`#d6d3d1`), který se uvolňuje při zásahu překážek a rychle klesá k zemi.
  3. *Žhavé jiskry a popílek*: Vznášející se částice z detonací a hořících doutnáků (`#ea580c` a `#f97316`).

### 2. Fond dynamických záblesků (Dynamic Light Flash Pool) & Chiaroscuro rozptyl
- **Hardwarově bezpečný rozpočet světel**: Maximálně **2 současná explozivní světla** (rádius 12 m, útlum `decay: 2`, doba 450–600 ms, barva `#f97316`) a **1 světlo záblesku hlavně** (rádius 6 m, doba 120 ms, barva `#fde047`) spravovaná FIFO frontou. Where that muzzle light sits, and which steady flames may burn beside it, is decided in ADR-0015. The smoke, dust, and rain rules below stay in force.
- **Injekce uniforem pro vnitřní rozptyl**: Souřadnice a intenzita aktivních záblesků jsou předávány přímo do shaderu `CombatAtmosphereField`. Částice kouře v dosahu světla dynamicky zvyšují svou emisivitu (zářící žhavé jádro a prosvícené okraje), což vytváří dojem hlubokého barokního šerosvitu bez drahého raymarchingu.
- **Ochrana čitelnosti mřížky (Pillary 1 a 2)**: Opacita přízemního kouře je kalibrována tak, aby taktické zóny pohybu (`1 AP Modrá`, `2 AP Zlatá`) zůstaly 100% čitelné.

### 3. Fyzika rázové vlny a vnitřní ventilace
- **Rázová vlna výbuchu (*Blast Shockwave Displacement*)**:
  - Epicentrum detonace ($r \le 1$) je rázovou vlnou okamžitě vyčištěno od kouře (`smokeTurns = 0`), čímž se odhalí ohořelý kráter.
  - Vytlačená masa kouře a trosek je stlačena do obvodového prstence ($r = 2..3$), kde nastaví `smokeTurns = 3` v interiéru nebo `2` v exteriéru.
  - Vizuální částice obdrží okamžitý radiální impuls $\vec{v}_{\text{impulse}}$ směrem od epicentra.
- **Vnitřní stagnace (*Indoor Smoke Stagnation*)**:
  - V krytých sálech paláce (`isEnclosedRoofedCoord`) přetrvává kouř 3–4 tahy (oproti 2 tahům na volném prostranství).
  - Za deště (`weather === "rain"`) je venkovní kouř redukován na 1 tah a polétavý prach usedá okamžitě.
- **Průvanové odvětrávání portálů (*Through-Draft Portal Venting*)**:
  - Kouř na polích do vzdálenosti 2 kroků od otevřených vnějších dveří (`isDoorOpen === true` hraničící se zahradou) vyvětrává dvojnásobnou rychlostí (`smokeTurns` klesá o 2 za tah).

### 4. Inteligentní taktické efekty a pravidla boje
- **Kumulativní clona kouře (*Cumulative Smoke Concealment*)**:
  - Pokud 3D Bresenhamův paprsek zrakové linie protne $\ge 2$ po sobě jdoucí pole s aktivním kouřem (`smokeTurns > 0`), přímá viditelnost je **zcela přerušena**. Cíl nelze zaměřit přímou střelbou ani reakční palbou.
- **Výjimka výškové převahy (*Smoke Horizon Piercing*)**:
  - Střelec na vyšším patře (`shooter.y > target.y`, např. věž či Piano Nobile) vidí skrz až 2 kouřová pole s postihem `-20 %` k zásahu.
- **Výjimka kontaktního dosahu (*Point-Blank Proximity Rule*)**:
  - Na vzdálenost $\le 1,5$ pole (kontaktní boj/melee) je kumulativní clona kouře ignorována; jednotky mohou bojovat zblízka s běžným postihem `-10 %` za kouř.
- **Přerušení hlídky kouřem (*Smoke Overwatch Disruption*)**:
  - Vstup jednotky do hustého kouře nebo vytvoření kouřové clony přeruší reakční zrakovou linii švédských mušketýrů v hlídce (Overwatch).
- **Zadýmení a záchvat kašle (*Black-Powder Choking Debuff*)**:
  - Jednotka, která ukončí tah v uzavřené místnosti (`isEnclosedRoofedCoord`) v aktivním kouři, obdrží na další tah postih `-1 Pohyblivost` kvůli dusivým zplodinám.
- **Odolnost těžké zbroje (*Cuirassier Respiratory Resistance*)**:
  - Vojáci s neporušenou těžkou zbrojí a morionem s nákrčníkem (`armor > 0 && hp === maxHp`, např. kyrysníci a maršál Colloredo) jsou vůči zadýmení imunní.
- **Zábleskový a zvukový kontakt (*Muzzle Flash & Sound Contact*)**:
  - Výstřel ze zbraně skrz kouřovou clonu odhalí v mlze války pouze dočasnou značku záblesku/zvuku, nikoli kompletní 3D model či statistiky střelce.

## Důsledky

### Pozitivní
- Hluboká historická věrnost baroknímu bojišti 17. století plnému sirného dýmu a dramatického šerosvitu.
- Granáty a prachové sudy získávají dvojí taktické využití: likvidaci nepřátel v epicentru a okamžité vytvoření krycího kouřového valu na obvodu.
- Odstranění desítek samostatných meshů pro kouř zvyšuje stabilitu FPS a šetří paměť GPU.
- Hráč může využít kouř k bezpečnému proběhnutí zónou švédského Overwatche.

### Rizika a mitigace
- **Vizuální vrstvení**: Částice s `depthWrite: false` musí být správně řazeny a renderovány až po neprůhledné geometrii terénu.
- **Výpočetní zátěž LoS**: Počítadlo kumulativního kouře je integrováno přímo do stávajícího průchodu Bresenhamova algoritmu v `CombatSystem.ts`, takže nevytváří žádné dodatečné raycasty.
