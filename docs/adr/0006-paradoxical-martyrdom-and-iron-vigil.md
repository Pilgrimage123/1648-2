# 0006. Paradoxical Martyrdom and the Clementinum Iron Vigil

Date: 2026-11-08
Status: Accepted

## Context

Mission 1 depicts the historic escape of 63-year-old Field Marshal and Grand Prior Rudolf Count Colloredo-Wallsee from the Grand Priory palace on the Lesser Town (Malá Strana) on the night of July 26, 1648. Historical records confirm he was escorted through the gardens to the Čertovka canal by three faithful servants.

To establish deep narrative continuity and emotional weight for the overarching campaign, the scenario must resolve two key design requirements:
1. Historically grounded companion identities representing the Grand Priory convent and its connection to Prague's resistance.
2. A definitive transition where only one companion survives the night, forged through fire and tragedy to become an inducted member of the **Železná vigilie** (*The Iron Vigil* / *Fidelitas Ferrea*) founded by Jesuit Father Jiří Plachý at the Clementinum.

## Decision

1. **Three Historical Companion Identities**:
   - **Jan Matěj (Osobní komorník)**: Colloredo's personal valet, armed with a wheellock carbine (5 tiles/AP). He does not remove the Marshal's limp.
   - **Bratr Bartoloměj (Maltézský zbrojmistr & konventní vartýř)**: Convent armorer with a heavy matchlock musket and rest fork (4 tiles/AP, 4 AP segmented reload) and two petards.
   - **Václav z Michalovic (Klementinský klerik & písař)**: Clementinum scribe stationed on the Piano Nobile with a Swedish lightened musket M1624 (5 tiles/AP).

2. **The Paradoxical Martyrdom Mechanic (*Paradoxní oběť*)**:
   - Upon Marshal Colloredo reaching a Čertovka escape tile (`(3, 0, 2)` or `(4, 0, 2)`), an interactive narrative dilemma pauses the action: the swollen river and small skiff cannot carry everyone while Odowalsky's Swedish vanguard closes in.
   - The player chooses which of the three companions stays behind at the palace gate to mount a suicidal rear-guard action.
   - **The Dramatic Paradox**:
     - The two companions who board the skiff with Colloredo are raked by Swedish musketry from the riverbank while shielding the Marshal with their bodies; they succumb to their wounds upon delivering Colloredo to safety on the Old Town bank.
     - The companion chosen to be sacrificed at the gate detonates the black powder kegs, survives the blast and murky canal waters through grit and fortune, and swims across to the Old Town.

3. **Induction into the Iron Vigil (*Železná vigilie*)**:
   - Father Jiří Plachý recovers the battered survivor on the threshold of the Clementinum, bestowing upon him the black mantle and iron gorget of the Iron Vigil.
   - The survivor permanently gains an exclusive archetype perk for subsequent missions:
     - **Jan Matěj**: *Ocelová věrnost* (+20% shock/panic resistance, +1 AP when rescuing a downed ally).
     - **Bratr Bartoloměj**: *Maltézský pyrotechnik* (+2 grenade throw range, +1 powder keg explosion damage).
     - **Václav z Michalovic**: *Klementinský zápal* (+10% height marksmanship bonus, 0% misfire in torrential rain).

## Consequences

- Creates an unforgettable emotional climax that subverts typical extraction tropes.
- Empowers high player agency with meaningful gameplay differentiation across repeated playthroughs.
- Seamlessly bridges Mission 1's Malá Strana escape with the upcoming defense of the Old Town Bridge Tower.
- Who the player commands after that night, where the Vigil is based, and the Catholic pairing of faith with learning are decided in ADR-0014. The survivor's induction in this ADR is unchanged.
