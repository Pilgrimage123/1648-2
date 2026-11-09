# 01: Vertikální Line of Sight, vyklonění přes balustrádu (Edge Peeking) a výšková převaha (+15 %)

**What to build:** Střelec stojící na okraji patra nebo pavlače (např. Piano Nobile či Maltézská věž) přímo u zábradlí (`low_wall`) se automaticky vykloní o 0,35 m přes hranu, čímž získá přímý 3D Bresenham Line of Sight dolů do nádvoří pod úhlem až 75° bez blokování podlahou vlastního patra. Střelba shora dolů získává taktický bonus +15 % k přesnosti (*High Ground Advantage*) a částečně obchází nízký kryt cíle. Obránce za balustrádou má proti střelbě z přízemí garantován plný kryt (-40 %).

**Blocked by:** None (can start immediately)

**Status:** closed

- [x] 3D Bresenham algoritmus v `CombatSystem.ts` podporuje Edge Peeking na okrajích podlaží s přesahem 0,35 m
- [x] Střelba shora dolů (`attacker.y > target.y`) uděluje `+15 %` bonus k šanci na zásah (`hitChance`) v kalkulátoru střelby
- [x] Střelba shora částečně degraduje nízký kryt (`half` cover cíle redukován na `none`)
- [x] Cíl na vyvýšeném patře za balustrádou má proti střelbě zespodu (`attacker.y < target.y`) plný kryt (`full`)
- [x] Nové testy v testovacím skriptu ověřují Edge Peeking, výškový bonus a krytí ve všech směrech
