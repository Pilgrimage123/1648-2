# 06: Dynamický řez čelních zdí (Smart Wall Culling) s ponecháním 0,35m soklů (Wall Stubs)

**What to build:** Čelní stěny a pilíře nacházející se mezi kamerou a aktivní jednotkou/interiérem se v závislosti na orientaci kamery automaticky sníží na nízké 0,35 m vysoké kamenné sokly s pískovcovou římsou (*Wall Stubs*). Zadní a boční stěny místnosti zůstávají v plné výšce. Tím se interiér otevře pohledu bez zakrývání jednotek, zatímco půdorys a linie krytů zůstávají zřetelně čitelné.

**Blocked by:** 04: Třístupňová vertikální hierarchie, poloprůhlední duchové (Unit Ghosting) a podnož jednotky

**Status:** closed

- [x] Detekce čelních zdí clonících pohled kamery na aktivní podlaží
- [x] Maticová transformace instancí v `InstancedMesh` snižující čelní zdi na 0,35 m sokly s pískovcovou římsou
- [x] Zadní a boční zdi zůstávají v plné výšce `FLOOR_HEIGHT` (2,4 m)
- [x] Vykreslování soklů splňuje výkonnostní požadavky ADR-0008 (žádné přetváření instančních bufferů za běhu)
