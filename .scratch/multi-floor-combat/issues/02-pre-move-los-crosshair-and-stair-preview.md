# 02: Prediktivní zaměřovač cílů před pohybem (Pre-Move LoS Crosshair) a indikace schodiště

**What to build:** V režimu pohybu (`actionMode === "move"`), jakmile hráč najede kurzorem na kandidátní dlaždici na mřížce (zejména na schodišti, pavlači či vyvýšeném patře), hra v reálném čase spočítá, kteří nepřátelé budou z této dlaždice v přímém dohledu (LoS) a dosahu zbraně, a rozsvítí nad nimi v 3D scéně i v Target Ribbonu varovné zaměřovací ikony. Při najetí na schodiště do neprozkoumaného patra se v TileHoverIndicator zobrazí počet odhalitelných polí.

**Blocked by:** 01: Vertikální Line of Sight, vyklonění přes balustrádu (Edge Peeking) a výšková převaha (+15 %)

**Status:** closed

- [x] Funkce `previewReconFromTile` v `FogOfWar.ts` vrací seznam nepřátel s garantovaným LoS z cílového pole
- [x] V 3D scéně nad hlavami viditelných cílů a v Target Ribbonu se rozsvěcují zaměřovací křížky při najetí na pole
- [x] Najetí na schodiště v `InstancedBattlefield.tsx` a `TileHoverIndicator` jasně komunikuje počet odhalitelných dlaždic
- [x] Pohybový preview nezatěžuje výkon renderovací smyčky (memoizováno)
