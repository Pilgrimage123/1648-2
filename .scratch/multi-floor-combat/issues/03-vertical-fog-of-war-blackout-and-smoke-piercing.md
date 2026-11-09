# 03: Vertikální mlha války: Zatemnění neprozkoumaných pater a průhled přes kouř (Smoke Piercing)

**What to build:** Plné podlahy a stropy v budovách blokují LoS a průzkum směrem vzhůru. Při ručním přepnutí řezu patra kamerou (`activeFloor = 1` nebo `2`) se dosud neprozkoumané místnosti a chodby zobrazí v černočerné tmě (*Terra Incognita*), což eliminuje bezplatné špehování. Přes definované vertikální světlíky (studna nádvoří, architektonické oblouky, schodišťové šachty) se naopak světlo z výbuchů i LoS šíří obousměrně. Střelec na vyšším patře (`shooter.y > target.y`) vidí přes přízemní černoprachový kouř pouze s mírným -10% postihem.

**Blocked by:** 01: Vertikální Line of Sight, vyklonění přes balustrádu (Edge Peeking) a výšková převaha (+15 %)

**Status:** closed

- [x] Dlaždice neprozkoumaných vyšších pater zůstávají v cutawayi černé/nezobrazené, dokud k nim nevznikne přímý LoS
- [x] Vertikální průduchy (`isCourtyardWell`, schodiště, Sala Terrena arch) propojují osvětlení a viditelnost mezi patry P0 a P1
- [x] Funkce `checkFogLineOfSight3D` v `FogOfWar.ts` implementuje pravidlo Smoke Horizon Piercing (-10 % k zásahu shora místo neprůhledné zdi)
- [x] Testovací sada ověřuje oddělené paměťové stavy mlhy války pro jednotlivá patra
