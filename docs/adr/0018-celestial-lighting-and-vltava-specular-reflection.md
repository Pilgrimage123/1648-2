# 0018. Nebeské osvětlení a sluneční odlesk na Vltavě (Celestial Lighting and Vltava Specular Reflection)

Datum: 2026-11-12

## Stav

Přijato (vyplynulo z `/grill-with-docs` architektonického rozhovoru).

## Kontext a rozhodnutí

V dosavadní architektuře docházelo k prolínání pojmů „dynamické osvětlení“ pro transientní záblesky výstřelů (ADR-0011), diegetická praktická světla plamenů (ADR-0015) a nebeská směrová světla. Navíc v Misi 2 (ranní obrana Staroměstské mostecké věže 26. července 1648) přicházelo směrové světlo chybně ze západu (`[-14, 30, 16]`) namísto ranního východu a hladina řeky Vltavy vykazovala pouze uniformní tlumený odstín bez charakteristického protisvětelného slunečního třpytu.

Rozhodli jsme se:
1. **Explicitně rozčlenit světelnou hierarchii do 3 samostatných vrstev**:
   - **Nebeský světelný zdroj (*Celestial Directional Light*)**: globální směrové světlo vrhající stíny a určující denní dobu (chladný půlnoční měsíc v Misi 1 `[14, 28, 13]` vs. autentické ranní slunce v Misi 2 `[22, 24, 8]` vycházející na východě nad Starým Městem).
   - **Praktická diegetická světla (*Diegetic Practical Lights*, ADR-0015)**: stabilní rozpočtovaná světla viditelných těles (svícny, pochodně, lucerna, doutnáky) s fyzikálním zhasínáním deštěm a útlumem při detonaci.
   - **Bojový zábleskový fond (*Combat Flash Pool*, ADR-0011)**: transientní bodové záblesky z hlavní a explozí sudu/granátů prosvěcující částice kouře.
2. **Přidat směrový sluneční odlesk Vltavy (*Vltava Morning Sun Specular Reflection*) v Misi 2**:
   - V `DynamicWaterField` (`InstancedBattlefield.tsx`) se pro dlaždice Vltavy počítá směrový Fresnelův zrcadlový třpyt vztažený k opravenému rannímu slunečnímu vektoru a severnímu toku řeky.
   - Odlesk využívá bledě zlatavou paletu (`#fde68a` / `#fef3c7`) s exponenciálním zrcadlovým útlumem, čímž ctí pravidlo 60-30-10 (voda zůstává 60% klidným podkladem a odlesk tvoří chiaroscuro akcent bez rušení čitelnosti mostovky a střílen).
   - Efekt dynamicky reaguje na počasí: plný lesk za jasného počasí (`clear`), matně rozptýlené vlnky za deště (`rain`) a úplné potlačení v ranní říční mlze (`fog`).
   - Noční Čertovka v Misi 1 zůstává ušetřena slunečních reflexí a zachovává si chladný stříbřitý měsíční svit a teplou zář lucerny pramice.

## Důsledky

- Astronomická a historická věrnost ranního střetu na Karlově mostě s dlouhými stíny věže a pilířů padajícími na západ.
- Dramatické barokní chiaroscuro na hladině Vltavy s nulovým dopadem na snímkovou frekvenci (GPU instancing bez dalších render-passů).
- Stoprocentní zachování čitelnosti taktické mřížky a zón pohybu (Pillar 1 a Pillar 2).
