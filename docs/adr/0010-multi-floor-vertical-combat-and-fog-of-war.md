# 10. Vertikální boj ve více patrech a interakce s mlhou války (Multi-Floor Vertical Combat & Fog of War)

Datum: 2026-11-09

## Stav

Přijato (vyplynulo z /grill-with-docs auditu vertikálního designu XCOM, Jagged Alliance a Phoenix Point)

## Kontext

Boj ve vícepatrových budovách v izometrických taktických hrách přináší zásadní optické a designové problémy:
1. **Vertikální paralaxa**: Na 2D monitoru se postava stojící na střeše či balkonu ve 2. patře promítá na identické souřadnice obrazovky jako políčko v přízemí o několik metrů dál. Hráč snadno ztratí přehled, na jaké podlaze postava fyzicky stojí, a omylem kliká na špatná patra.
2. **Překážení čelních zdí a stropů**: Plošné odřezávání střechy nestačí; plné čelní zdi místností stále zakrývají interiér, což hráče nutí neustále točit kamerou. Úplné smazání stěn zase maže čtení krytů a dveří.
3. **Frustrace z vertikální zrakové linie (Line of Sight)**: Pravidla pro střelbu přes okraj střechy dolů do nádvoří bývají nečitelné – hráč neví, zda voják ze střechy uvidí dolů a zda nepřítel uvidí jeho.
4. **Interakce s mlhou války (Fog of War & Chiaroscuro)**: Zavedení poloprůhledných siluet pro vyšší patra nesmí fungovat jako „wallhack“ pro neodhalené nepřátele v noční tmě, a přepnutí řezu patra nesmí umožnit bezplatné prozkoumávání neznámých interiérů shora.

## Rozhodnutí

### 1. Vizuální hierarchie a poloprůhlední duchové (Unit Visual Ghosting)
- **Aktivní patro (`y === activeFloor`)**: 100% sytost, plné osvětlení a kompletní taktická lišta zdraví/morálky.
- **Vyšší patra (`y > activeFloor`)**: Spatřené nepřátelské a spojenecké jednotky se vykreslí jako poloprůhlední duchové (~30% opacita s modro-šedým obrysem). Hráč neztrácí povědomí o hrozbách nad sebou, ale výhled na mřížku v přízemí zůstává čistý.
- **Nižší patra (`y < activeFloor`)**: Jednotky pod rovinou kamery zůstávají plně hmotné, ale jsou ztmavené o 40 % a desaturované (barokní šerosvitná atmosférická hloubka).
- **Výškový štítek (*Elevation Badge*)**: Kompaktní indikátor `▲ +1` / `▼ -1` u healthbaru informuje o relativním výškovém rozdílu a na aktivním patře automaticky mizí.

### 2. Ukotvení k podlaze a svislá kotva kurzoru (Ground Anchoring & Cursor Drop Line)
- **Svislá kotva kurzoru (*Cursor Drop Line*)**: Při najetí kurzorem na vyvýšenou dlaždici nebo schodiště se promítá svislá přerušovaná linka až na podlahu přízemí s křížkem v mřížce.
- **Stálá podnož chodidel (*Ground Anchor Disc*)**: Každá jednotka ve vyšším patře má pod nohama jemný kruhový podstavec a lokální kontaktní stín (*Contact Shadow*) na úrovni svého patra, čímž oko okamžitě vnímá rovinu jejího stání.

### 3. Chytrý řez čelních zdí (Smart Wall Culling) a sokly (Wall Stubs)
- Čelní zdi ležící mezi kamerou a vybranou jednotkou / kurzorem se automaticky sníží na **0,35 m vysoký kamenný sokl s pískovcovou římsou (*Wall Stub*)**, zatímco zadní a boční stěny zůstávají v plné výšce.
- Místnost se vizuálně otevře, ale půdorys, okna, dveře a linie krytů zůstávají 100% čitelné.

### 4. Vertikální Line of Sight, vyklonění přes balustrádu a výšková převaha
- **Vyklonění přes okraj (*Edge Peeking*)**: Pokud jednotka stojí na okraji patra přímo u balustrády (`low_wall`), LoS algoritmus v `CombatSystem.ts` automaticky vysune virtuální pozici střelce o 0,35 m přes hranu. Voják vidí strmě dolů do nádvoří (až 75°), aniž by mu vlastní podlaha stínila.
- **Výšková převaha (*High Ground Advantage*)**: Střelec shora dolů získává **+15 % k přesnosti** a částečně obchází nízký kryt cíle.
- **Obrana proti střelbě zdola**: Jednotka na střeše/balkonu za balustrádou má proti střelbě z přízemí garantován **Plný kryt (-40 %)**.

### 5. Prediktivní zaměřovač cílů před pohybem (Pre-Move LoS Crosshair)
- Při najetí myší na cílovou dlaždici pohybu se v reálném čase nad modely nepřátel a v liště cílů (*Target Ribbon*) rozsvítí ikony zaměřovače, které potvrzují přímý LoS a dostřel z dané dlaždice ještě před potvrzením přesunu.

### 6. Priorita kliknutí (Raycast Filtering) a automatické přepínání patra
- Poloprůhlední duchové na neaktivních patrech mají pro pohyb vypnutou detekci raycastu (`pointerEvents: none`); kliknutí myší projde skrz ně na podlahu aktivního patra. Kliknout na ně lze pouze v režimu střelby (`actionMode === "shoot"`).
- Při pohybu po schodišti nebo přepnutí vojáka klávesou `Tab` kamera plynule automaticky adaptuje `activeFloor`.

### 7. Interakce s mlhou války a barokním šerosvitem (Fog of War)
- **Přísný zákaz duchů pro neodhalené nepřátele**: Nepřítel v neprozkoumané temnotě (*unexplored*) nebo v paměti šerosvitu (*shrouded*) se jako duch nikdy nevykreslí. Pokud se pohybuje nebo drží žhnoucí doutnák (`matchlock`), zobrazí se pouze zvukový kontakt (*SoundContact* např. *„Šramot kyrysu na pavlači ▲ +1“*).
- **Zatemnění neprozkoumaných pater (*Floor Cutaway Fog Blackout*)**: Pevné podlahy a stropy blokují výhled vzhůru. Pokud hráč přepne cutaway do patra, kde ještě nebyl, vidí černočernou tmu (Terra Incognita), nikoliv odhalený interiér.
- **Vertikální světlíky a šachty (*Vertical Light Shafts*)**: V místech otevřeného nebe (studna nádvoří `Cour d'honneur`, schodišťové šachty, hlavní oblouk Sala Terreny) světlo i LoS pronikají mezi patry obousměrně.
- **Průhled shora přes přízemní dým (*Smoke Horizon Piercing*)**: Těžký černoprachový kouř leží u země; střelec z věže či balkonu se dívá shora a vidí cíle v kouři i za ním s mírným postihem (-10 % k zásahu místo plného zablokování LoS).
- **Predikce průzkumu na schodišti (*Stairway Recon Preview*)**: Najetí myší na schodiště do neprozkoumaného patra hráče předem informuje o počtu nově odhalitelných polí a případném nebezpečí reakční palby.

## Důsledky

### Pozitivní
- Hráč získává absolutní přehled o vertikálním bojišti bez frustrace z vertikální paralaxy a nepřehledných čelních zdí.
- Zcela odpadá hádání, zda z balkonu půjde vystřelit dolů do nádvoří.
- Zachovává se plné napětí z mlhy války a nočního přepadení paláce bez jakýchkoliv „radarových úniků“.
- Boj o výškovou převahu (obsazení pavlačí a věže) dává obrovskou taktickou výhodu proti přízemnímu kouři a krytům.

### Negativní / Rizika
- Výpočet maticové deformace soklů (`Wall Stubs`) v `InstancedMesh` musí být přesně synchronizován s rotací kamery (`cameraAngle`), aby nedocházelo k propadům FPS (dle ADR-0008).
- Výpočet predikce cílů při hoveru (`hoveredReconPreview`) musí být dobře cachován (memoizován), aby nezatěžoval renderovací smyčku Three.js při rychlém přejíždění myší po mapě.
