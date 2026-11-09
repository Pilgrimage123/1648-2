# 9. Kinematická akční kamera při pohybu a přepadu ze zálohy (XCOM Action Cam)

Datum: 2026-11-09

## Stav

Přijato (vyplynulo z /grill-with-docs auditu akční kamery a mechanik XCOM 2)

## Kontext

V moderních taktických strategiích (zejména sérii *XCOM: Enemy Unknown* a *XCOM 2*) hraje kamera klíčovou roli v udržení filmového tempa a přehlednosti:
1. **Sledování pohybu (Action Tracking Cam)**: Při pohybu vojáka (jak hráče, tak nepřítele) kamera nezůstává pasivně viset na původním stanovišti, nýbrž plynule sleduje pohybující se jednotku, přizpůsobuje výšku podle podlaží (`FloorLevel` P0, P1, P2) a snižuje vzdálenost pro dynamičtější pocit z běhu a sprintu.
2. **Přepad ze zálohy (Overwatch Reaction Cam)**: Při spuštění reakčního výstřelu z hlídky (Overwatch) kamera okamžitě dramaticky střihne/přeletí na reagujícího střelce a sleduje dráhu střely směrem k zachycené jednotce.
3. **Volitelnost (Player Agency)**: Hráč má možnost kinematickou akční kameru kdykoliv vypnout v nastavení (`actionCamEnabled: boolean`), pokud preferuje stabilní přehledový taktický nadhled.

V dosavadní implementaci *Prahy 1648* fungovala Over-the-Shoulder kamera pouze při ručním míření (`actionMode === "shoot"`), zatímco během pohybu jednotky zůstávala kamera na původních souřadnicích `orbitCenterRef`, což nutilo hráče ručně posouvat scénu nebo ztrácet pohybujícího se vojáka z dohledu.

## Rozhodnutí

1. **Implementace sledovací kamery v `TacticalCamera.tsx`**:
   - V případě, že probíhá aktivní pohyb (`activeMovement !== null`) a je povolena `actionCamEnabled`:
     - Kamera plynule centruje svůj `orbitCenterRef` i bod pohledu (`currentLookAtRef`) na pozici pohybujícího se vojáka v reálném čase.
     - Vzdálenost kamery se během pohybu dynamicky sníží (o ~25–30 % pro akčnější úhel pohledu).
     - Při přechodu mezi patry (po točitých či přímých schodištích) kamera plynule následuje vertikální převýšení `y * FLOOR_HEIGHT`.
2. **Kinematický přepad při reakční střelbě (Overwatch Cam)**:
   - Při triggeru Overwatch reakce se kamera plynule orientuje za záda reagujícího střelce, čímž vzniká dramatický střih před dopadem kulky na cíl.
3. **Konfigurace a UI přepínač**:
   - Do `useGameStore` přidat stav `actionCamEnabled: boolean` (výchozí: `true`).
   - Přidat tlačítko s ikonou kamery/filmu a klávesovou nápovědou do `TacticalUtilitiesCapsule` pro rychlé přepínání filmového vs. statického režimu.
4. **Dokumentace v `GLOSSARY.md`**:
   - Zavést kanonický pojem **Kinematická akční kamera** (*Cinematic Action Cam*).

## Důsledky

### Pozitivní
- Hra získává dynamický, filmový ráz odpovídající standardům moderních tahových taktik typu XCOM 2.
- Hráč nikdy neztratí přehled o tom, kam jeho (ani nepřátelský) voják běží a kde zastavil.
- Možnost vypnutí uspokojí hráče preferující čistě statický izometrický šachový nadhled.

### Negativní / Rizika
- Je nutné dbát na to, aby plynulá interpolace (damping) nezpůsobovala kinetózu; damping faktory musí být citlivě odladěny (`6.5` až `8.5`).
