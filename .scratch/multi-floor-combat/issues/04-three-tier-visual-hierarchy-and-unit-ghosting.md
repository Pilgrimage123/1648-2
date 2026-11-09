# 04: Třístupňová vertikální hierarchie, poloprůhlední duchové (Unit Ghosting) a podnož jednotky

**What to build:** Nahrazení binárního skrývání postav (`unit.pos.y !== activeFloor -> return null`) třístupňovou vertikální hierarchií: aktivní patro 100%, nižší patra ztmavená o 40% v barokním šerosvitu, vyšší patra jako poloprůhlední duchové (~30% opacita). Duchové se zobrazují VÝHRADNĚ pro jednotky aktivně odhalené v mlze války (`visibleEnemyIds.has(id)`). Každá vyvýšená jednotka má pod nohama kruhovou podnož (*Ground Anchor Disc*), tvrdý lokální stín a výškový štítek (`▲ +1` / `▼ -1`). Raycast pro pohyb prochází skrz duchy na podlahu aktivního patra.

**Blocked by:** 03: Vertikální mlha války: Zatemnění neprozkoumaných pater a průhled přes kouř (Smoke Piercing)

**Status:** closed

- [x] `UnitActor.tsx` renderuje jednotky na vyšších patrech jako 30% poloprůhledné duchy
- [x] Jednotky na nižších patrech jsou desaturované a ztmavené o 40 %
- [x] Neodhalené jednotky ve tmě/mlze se jako duchové nikdy nevykreslí (pouze `SoundContact`)
- [x] Vykreslení kruhového podstavce (*Ground Anchor Disc*) a lokálního stínu pod nohama každé vyvýšené jednotky
- [x] Vypnutí raycastu pro pohyb přes duchy (`pointerEvents: none`), funguje pouze v režimu `actionMode === "shoot"`
- [x] Výškový štítek (*Elevation Badge* `▲ +1` / `▼ -1`) u zdraví postavy
