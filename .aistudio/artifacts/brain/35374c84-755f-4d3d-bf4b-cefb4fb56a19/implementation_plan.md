# Barokní výtvarná režie (Art Direction) & oprava pokrývek hlav jednotek

Tento plán řeší anatomicky věrné posazení klobouků a přileb na hlavách jednotek (v 2D spritech i 3D figurkách) a zavádí čtyři pilíře barokní výtvarné režie (Chiaroscuro šerosvit, pravidlo barev 60-30-10 s živými erbovními akcenty jednotek, okamžitě čitelné siluety všech 5 tříd a sekundární pohyb dýchajícího bojiště).

## User Review & Critical Decisions

> [!IMPORTANT]
> Níže jsou shrnuty vaše potvrzené volby z úvodního dotazníku, které přímo řídí výsledný vizuální styl:

- **Potvrzená volba 1 — Poměr šerosvitu a barevnosti**: **Bohaté erbovní barvy jednotek + barokní šerosvit mapy**. Podlaha a zdivo využijí klidné, nízko-kontrastní zemité tóny v šerosvitu (60 % a 30 %), takže na nich o to výrazněji zazáří syté erbovní barvy jednotek, šarlatové šerpy, královská zlatá, karolínská modř a teplá záře pochodní (10 %).
- **Potvrzená volba 2 — Jazyk tvarů a siluety**: **Výrazně odlišit siluety všech stávajících 5 tříd jednotek**. Každá z 5 tříd (`ranger`, `sniper`, `commander`, `trooper`, `sectoid`) získá unikátní obrys čitelný z ptačí perspektivy (vysoké vertikální píky/halapartny, široké klobouky s vodorovnou hlavní, masivní kyrysy s nárameníky a asymetrické korouhve/relikvie).
- **Potvrzená volba 3 — Živoucnost bojiště (Sekundární pohyb)**: **Kompletní trojice atmosférických efektů** — plazivý dým z černého prachu při zemi s poletujícím popelem a jiskrami, vlající pláště/chocholy/praporce jednotek ve větru a mihotající se barokní pochodně s oltářními svícemi a kužely světla.

---

## 1. Přehled a hlavní koncept

- **Co změna přináší**:
  1. **Oprava klobouků a přileb**: V dosavadních 2D spritech byly klobouky a přilby vykresleny ve vrstvě *před* samotnou hlavou (takže kruh hlavy překrýval krempu klobouku) a umístěny příliš vysoko nad temenem. V 3D modelech seděly klobouky na samotné špičce koule hlavy. Nově budou všechny pokrývky hlavy vykresleny ve vrstvě **nad hlavou**, posazeny hluboko do čela (těsně nad obočí) s vrženým stínem pod krempou.
  2. **Barokní šerosvit a živá barevnost (Chiaroscuro + 60-30-10)**: Klidná, texturově sjednocená dlažba a bláto nechají vyniknout taktickou mřížku, zatímco nasvícený střed bojiště (paprsky světla, mihotavé pochodně, oltářní svíce) a živé erbovní barvy postav dodají scéně vzhled oživeného barokního plátna.
- **Cílový přínos pro hráče**: Okamžitá taktická čitelnost každé jednotky a krytu na první pohled při zachování bohaté, barevně živé a atmosférické estetiky třicetileté války.

---

## 2. Uživatelský zážitek a vizuální design

### A. Oprava pokrývek hlavy (2D Sprity & 3D Modely)
- **Správné vrstvení (Z-Order)**: V procedurálních SVG spritech se pořadí vykreslování změní na: *Zadní cíp pláště / zádová korouhev → Tělo a zbroj → Hlava a obličej → Stín pod krempou na čele → Klobouk / Přilba naražená přes čelo → Bohatý chochol / peří a zlaté kování*.
- **Anatomické posazení na hlavu**:
  - Krempa kavalírských klobouků a okraj přileb se posunou níže (z `y=54..58` na `y=65..70` při středu hlavy `y=78..80`), takže zakryjí horní třetinu hlavy až k obočí a po stranách obepnou spánky.
  - V 3D modelech se skupina klobouku/přilby sníží z `y=1.42` na `y=1.34`, dno koruny obepne lebku a krempa dostane mírné barokní prohnutí se stínem.

### B. Kompozice bojiště a pravidlo barev 60-30-10
- **60 % — Klidné dominantní plochy (Podlaha a mlha)**:
  - Rozdíl světlosti sousedních polí šachovnice podlahy bude jemný ($\Delta \le 6\%$), v odstínech vlhké břidlicové šedi (`#1e2631` / `#182029`), tmavého bláta a říčního kamene. Taktická mřížka, modré/žluté zóny pohybu a kužely střelby tak budou perfektně čitelné bez vizuálního šumu.
- **30 % — Sekundární barokní struktury (Kryty a zdivo)**:
  - Překážky (nízké zídky, vysoké pilíře, barokní balustrády) ponesou teplejší odstíny zvětralého pískovce (`#6b635b`, `#575049`), tmavého dubového dřeva krovů (`#4a3525`) a kovaného železa s architektonickými římsami a hlavicemi sloupů, které vizuálně oddělí kryt od ploché země.
- **10 % — Akcentové a taktické erbovní barvy**:
  - **Jednotky**: Císařská šarlatová červená (`#dc2626`), královská zlatá (`#facc15`), světlá jelenice (`#e0b878`), švédská karolínská modř (`#2563eb`) s jasně žlutým křížem a sněhobílá noční košile maršála s červeným Maltézským řádem.
  - **Aktivní taktické prvky**: Prachové sudy s měděnými obručemi a žhnoucí zápalnicí, zlaté/tyrkysové štítky aktivního krytu a smaragdově/zlatě nasvícená úniková pramice s lucernou.

### C. Jazyk tvarů (Siluety 5 tříd jednotek z ptačí perspektivy)
1. **Dragoun / Kyrysník (`ranger` — Těžká pěchota)**: **Masivní čtvercová a oblá silueta**. Široká ramena s kovanými plátovými nárameníky, zrcadlově lesklý ocelový kyrys se zlatým lemem, šarlatová šerpa, široký kavalírský klobouk kryjící čelo s mohutným červeným pštrosím chocholem a těžká kolečková karabina.
2. **Ostrostřelec z Klementina (`sniper` — Mušketýr / Střelec)**: **Široká horizontální silueta**. Rozevlátý tmavomodrý učenecký plášť se zlatým šněrováním, široký klobouk stažený do čela s dlouhým zlatým perem a extrémně dlouhá doutnáková mušketa založená do střelecké vidlice (furkety) s jasně žhnoucím oranžovým doutnákem.
3. **Polní maršál Colloredo (`commander` — Velitel / Unikátní postava)**: **Asymetrická vznešená silueta**. Bohatě řasená sněhobílá noční košile se širokými rukávy, šarlatová velkokřížová šerpa s bílým Maltézským křížem, vyřezávaná hůl s jantarovou hlavicí v levé ruce, stříbrná kolečková pistole v pravé ruce a zlatavá velitelská svatozář/relikviář u pasu.
4. **Švédský pikenýr-mušketýr (`trooper` — Pikenýr / Halapartník)**: **Vysoká, ostrá vertikální trojúhelníková silueta**. Ocelový pappenheimský šišák s hřebenem a krytem nosu naražený hluboko do čela, vztyčená halapartna/píka se žlutomodrým praporcem trčící vysoko nad hlavu (okamžitě čitelný trojúhelník shora) a karolínský modro-žlutý kabátec.
5. **Švédský granátník / Polní inkvizitor (`sectoid` — Elitní granátník / Mystický důstojník)**: **Asymetrická, hrozivá silueta s korouhví**. Vysoká špičatá granátnická mitra se zlatým lvem naražená přes čelo, asymetrický zádový praporec (korouhev) vlající za rameny, těžká černěná zbroj a vysoko pozvednutý žhnoucí železný granát s jiskřící zápalnicí.

### D. Živoucnost bojiště (Sekundární pohyb)
- **Plazivý dým a poletující popel**: Kouř z černého prachu se bude převalovat nízko u země v pomalých vlnách, zatímco vzduchem nad nádvořím budou stoupat a poletovat žhnoucí jiskry a vločky popela.
- **Mihotající se pochodně, oltářní svíce a kužely šerosvitu**: Na pilířích a zídkách nádvoří budou hořet kované barokní pochodně a votivní svíce s mihotavou intenzitou světla a poloprůhlednými kužely teplého světla (Chiaroscuro god-rays) prořezávajícími mlhu.
- **Pohyb ve větru u jednotek**: Pláště, chocholy na kloboucích a zádové praporce budou mít jemnou harmonickou animaci vlnění ve větru.

---

## 3. Klíčová produktová rozhodnutí a kompromisy

- **Rozhodnutí 1: Zachování živé barevnosti uvnitř barokního šerosvitu**
  - *Zvolený přístup*: Ztlumení kontrastu samotné podlahy (60 %) a sjednocení kamenného zdiva (30 %), ale zvýšení sytosti a světelného kontrastu erbovních barev jednotek, chocholů, šerp a ohňů (10 %).
  - *Proč*: Čistě temná scéna by působila fádně a zhoršila čitelnost jednotek; kontrast sytých erbovních barev proti klidnému šerosvitu podlahy dává hře živý, malířský vzhled (styl Rembrandtovy *Noční hlídky*).
  - *Zvažované alternativy*: Plošné ztmavení všech barev včetně jednotek — zamítnuto, protože by postavy splynuly s pozadím.
- **Rozhodnutí 2: Unifikace 2D spritů a 3D modelů pod stejným jazykem tvarů**
  - *Zvolený přístup*: Upravit jak procedurální SVG sprity (s `alphaTest` vrženými stíny), tak skládané 3D modely, aby přepínání režimu `2D / 3D` v HUDu zachovalo identické siluety, barvy i opravené klobouky.
  - *Proč*: Hráč může kdykoliv přepnout mezi 2D malovanými figurkami a 3D modely; obě varianty musí ctít stejnou výtvarnou režii.

---

## 4. Technická architektura a tok dat

### Architektonické schéma vizuálního pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        TacticalScene (R3F Canvas)                       │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Chiaroscuro Lighting Rig                                          │  │
│  │ • Středový nasvícený plán (Teplé kužely světla + Directional Key) │  │
│  │ • Okrajová viněta a hluboká mlha (60 % břidlicové šero)           │  │
│  │ • Mihotající se pochodně a oltářní svíce (Flickering PointLights) │  │
│  └───────────────┬───────────────────────────────────┬───────────────┘  │
│                  ▼                                   ▼                  │
│  ┌───────────────────────────────┐   ┌───────────────────────────────┐  │
│  │     InstancedBattlefield      │   │    Atmospheric Particles      │  │
│  │ • 60 % Klidná dlažba/bláto    │   │ • RainParticles (déšť)        │  │
│  │ • 30 % Barokní zdivo s římsou │   │ • AshAndEmbers (popel/jiskry) │  │
│  │ • 10 % Sudy, pramice, majáky  │   │ • Plazivý dým u země          │  │
│  │ • Kované pochodně a svícny    │   │ • Kužely světla (God-rays)    │  │
│  └───────────────────────────────┘   └───────────────────────────────┘  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     UnitActor (5 tříd postav)                     │  │
│  │  • Sekundární pohyb ve větru (vlnění plášťů, chocholů a praporců) │  │
│  │  ├── UnitVisual2D (SVG Sprity):                                   │  │
│  │  │    Klobouky/přilby ve vrstvě NAD hlavou, naražené přes čelo,   │  │
│  │  │    výrazné siluety (píky, vidlice s mušketou, kyrysy, mitry)   │  │
│  │  └── UnitVisual3D (Kompozitní 3D figurky):                        │  │
│  │       Snížené klobouky/přilby obepínající hlavu, 3D píky,         │  │
│  │       vlající pláště, zádové korouhve a žhnoucí doutnáky          │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Mapování stavu a interaktivních prvků
- **Vykreslování 2D spritů a jejich 3D stínů**: Aktualizované SVG sprity s opravenými klobouky a výraznými siluetami automaticky propisují svůj obrys i do `MeshDepthMaterial` (`alphaTest={0.5}`), takže vržené stíny na dlažbě budou přesně odpovídat širokým kloboukům, chocholům a vztyčeným píkám.
- **Animace živoucnosti v herní smyčce (`useFrame`)**:
  - Mihotání pochodní a svící plynule moduluje intenzitu a poloměr světla pomocí součtu harmonických funkcí (`sin(t * 7.3) + cos(t * 13.1)`), bez alokací paměti v render loopu.
  - Plazivý dým na zakouřených polích i ambientní přízemní opar využívají plynulou horizontální rotaci a pulzaci měřítka při zemi.
  - Poletující popel a jiskry využijí instancovaný částicový systém (`InstancedMesh`), který funguje za každého počasí a dodává bojišti neustálý pohyb.
