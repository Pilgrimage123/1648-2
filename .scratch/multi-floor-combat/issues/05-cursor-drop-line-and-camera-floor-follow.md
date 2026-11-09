# 05: Svislá kotva 3D kurzoru (Cursor Drop Line) a automatické sledování patra kamerou

**What to build:** Odstranění optického klamu vertikální paralaxy při míření do vyšších pater: při najetí kurzorem na vyvýšenou dlaždici (`y >= 1`) se promítá svislá přerušovaná linka až k podlaze přízemí s křížkem v mřížce. A* path line se na schodištích zřetelně láme podél schodišťového tělesa. Kamera automaticky plynule adaptuje `activeFloor` při pohybu jednotky po schodišti nebo při přepínání vojáků klávesou `Tab`.

**Blocked by:** 04: Třístupňová vertikální hierarchie, poloprůhlední duchové (Unit Ghosting) a podnož jednotky

**Status:** closed

- [x] Vykreslení 3D svislé přerušované linie od kurzoru v patře k odpovídajícímu poli v přízemí
- [x] Vizuální zalomení čáry pohybu (*Path Preview Line*) podél schodiště ve 3D scéně
- [x] Plynulé automatické přepnutí `activeFloor` v kameře při stoupání po schodech a při výběru jednotky v jiném patře
