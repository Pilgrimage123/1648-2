/**
 * Procedural SVG / Canvas Data URI sprite generator (/src/utils/proceduralSprites.ts).
 * Produces crisp, transparent-background character sprites for 2 player archetypes
 * (`ranger`, `sniper`) and 2 enemy archetypes (`trooper`, `sectoid`) so 2D billboard
 * planes with `alphaTest={0.5}` cast sharp 3D silhouette shadows out of the box.
 */

import * as THREE from "three";
import type { UnitArchetype } from "../core/types";

const SPRITE_CACHE: Partial<Record<UnitArchetype, string>> = {};
const TEXTURE_CACHE = new Map<UnitArchetype, THREE.Texture>();
const DEPTH_MATERIAL_CACHE = new Map<UnitArchetype, THREE.MeshDepthMaterial>();

function buildSvgMarkup(archetype: UnitArchetype): string {
  switch (archetype) {
    case "ranger":
      // Imperial Dragoon / Vanguard (Crimson sash, plumed cavalier hat, breastplate, carbine + rapier)
      return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 320" width="512" height="640">
        <defs>
          <linearGradient id="coat" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#8b2635"/>
            <stop offset="100%" stop-color="#4e121b"/>
          </linearGradient>
          <linearGradient id="steel" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#9fb1c4"/>
            <stop offset="50%" stop-color="#eef5fc"/>
            <stop offset="100%" stop-color="#5d6b7a"/>
          </linearGradient>
          <linearGradient id="buff" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#d8b074"/>
            <stop offset="100%" stop-color="#8e6532"/>
          </linearGradient>
        </defs>
        <!-- Cavalier Plume -->
        <path d="M138 22 C172 8, 204 26, 198 54 C182 44, 158 42, 138 38 Z" fill="#e63946" stroke="#22090c" stroke-width="4"/>
        <!-- Wide-Brimmed Hat -->
        <ellipse cx="128" cy="54" rx="54" ry="13" fill="#231c18" stroke="#110d0a" stroke-width="4"/>
        <path d="M95 52 C98 24, 158 24, 161 52 Z" fill="#322822" stroke="#110d0a" stroke-width="4"/>
        <rect x="98" y="45" width="60" height="6" rx="3" fill="#e9c46a"/>
        <!-- Head & Mustache -->
        <circle cx="128" cy="78" r="21" fill="#f1c29b" stroke="#2b1d14" stroke-width="4"/>
        <circle cx="120" cy="74" r="3" fill="#1d1612"/>
        <circle cx="137" cy="74" r="3" fill="#1d1612"/>
        <path d="M114 86 Q128 81 142 86 Q135 93 128 89 Q121 93 114 86 Z" fill="#3d2618"/>
        <!-- Flowing Baroque Cloak -->
        <path d="M82 104 L54 228 L102 222 L96 112 Z" fill="url(#coat)" stroke="#240b10" stroke-width="4"/>
        <!-- Buff Coat & Steel Cuirass -->
        <path d="M84 104 L172 104 L182 214 L74 214 Z" fill="url(#buff)" stroke="#2b1d14" stroke-width="5"/>
        <path d="M92 106 L164 106 L156 178 L128 190 L100 178 Z" fill="url(#steel)" stroke="#242b33" stroke-width="5"/>
        <!-- Imperial Crimson Sash -->
        <path d="M92 114 L164 166 L156 182 L86 130 Z" fill="#c1121f" stroke="#3b060a" stroke-width="3"/>
        <!-- Left & Right Arms / Gauntlets -->
        <path d="M74 110 L56 168 L76 174 L92 122 Z" fill="url(#buff)" stroke="#2b1d14" stroke-width="4"/>
        <path d="M164 110 L192 158 L174 170 L154 124 Z" fill="url(#buff)" stroke="#2b1d14" stroke-width="4"/>
        <!-- Riding Boots & Breeches -->
        <rect x="90" y="210" width="30" height="44" rx="6" fill="#4a3728" stroke="#1e150f" stroke-width="4"/>
        <rect x="136" y="210" width="30" height="44" rx="6" fill="#4a3728" stroke="#1e150f" stroke-width="4"/>
        <path d="M84 246 L124 246 L120 306 L82 306 Z" fill="#231b16" stroke="#0f0b09" stroke-width="5"/>
        <path d="M132 246 L172 246 L174 306 L136 306 Z" fill="#231b16" stroke="#0f0b09" stroke-width="5"/>
        <!-- Wheellock Carbine Held Across Chest -->
        <rect x="52" y="148" width="166" height="12" rx="4" transform="rotate(-14 128 154)" fill="#5c3a21" stroke="#1e1108" stroke-width="4"/>
        <rect x="120" y="144" width="112" height="7" rx="2" transform="rotate(-14 128 154)" fill="#cbd5e1" stroke="#1e293b" stroke-width="3"/>
        <circle cx="132" cy="158" r="8" fill="#eab308" stroke="#422006" stroke-width="3"/>
      </svg>`;

    case "sniper":
      // Clementinum Sharpshooter / Sniper (Dark scholar cloak, feather cap, long matchlock musket with glowing match)
      return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 320" width="512" height="640">
        <defs>
          <linearGradient id="scholar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#2b3a4a"/>
            <stop offset="100%" stop-color="#141c24"/>
          </linearGradient>
          <linearGradient id="trim" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#d4a359"/>
            <stop offset="100%" stop-color="#f4d58d"/>
          </linearGradient>
        </defs>
        <!-- Tall Feather -->
        <path d="M142 14 C168 6, 184 30, 164 54 C156 38, 150 28, 142 14 Z" fill="#f4d58d" stroke="#281d0b" stroke-width="4"/>
        <!-- Cavalier Felt Hat -->
        <ellipse cx="128" cy="56" rx="48" ry="11" fill="#1a1d24" stroke="#0b0d11" stroke-width="4"/>
        <path d="M96 55 C102 26, 154 26, 160 55 Z" fill="#252b37" stroke="#0b0d11" stroke-width="4"/>
        <!-- Head -->
        <circle cx="128" cy="78" r="20" fill="#f3c8a6" stroke="#2b1d14" stroke-width="4"/>
        <circle cx="121" cy="75" r="3" fill="#161920"/>
        <circle cx="138" cy="75" r="3" fill="#161920"/>
        <!-- White Scholar Collar -->
        <path d="M100 98 L156 98 L168 118 L128 112 L88 118 Z" fill="#f1faee" stroke="#2b323b" stroke-width="4"/>
        <!-- Long Coat & Powder Bandolier -->
        <path d="M84 106 L172 106 L188 238 L68 238 Z" fill="url(#scholar)" stroke="#0d1117" stroke-width="5"/>
        <line x1="128" y1="108" x2="128" y2="236" stroke="url(#trim)" stroke-width="5"/>
        <!-- Apostle Powder Flasks Bandolier -->
        <path d="M94 110 L166 192" stroke="#7f5539" stroke-width="9" stroke-linecap="round"/>
        <rect x="108" y="132" width="8" height="16" rx="2" fill="#e9c46a" stroke="#221909" stroke-width="2"/>
        <rect x="124" y="148" width="8" height="16" rx="2" fill="#e9c46a" stroke="#221909" stroke-width="2"/>
        <rect x="140" y="164" width="8" height="16" rx="2" fill="#e9c46a" stroke="#221909" stroke-width="2"/>
        <!-- Boots -->
        <path d="M90 236 L122 236 L118 306 L86 306 Z" fill="#1f1916" stroke="#0d0a08" stroke-width="5"/>
        <path d="M134 236 L166 236 L170 306 L138 306 Z" fill="#1f1916" stroke="#0d0a08" stroke-width="5"/>
        <!-- Long Matchlock Musket & Fork Rest -->
        <line x1="184" y1="118" x2="184" y2="306" stroke="#8d6e63" stroke-width="7" stroke-linecap="round"/>
        <path d="M174 106 Q184 124 194 106" fill="none" stroke="#cbd5e1" stroke-width="5" stroke-linecap="round"/>
        <rect x="36" y="138" width="196" height="10" rx="3" transform="rotate(-8 134 142)" fill="#6d4c41" stroke="#241712" stroke-width="4"/>
        <rect x="94" y="134" width="144" height="6" rx="2" transform="rotate(-8 134 142)" fill="#e2e8f0" stroke="#1e293b" stroke-width="3"/>
        <!-- Glowing Matchcord Ember -->
        <circle cx="118" cy="134" r="6" fill="#ff7b00" stroke="#fff3b0" stroke-width="3"/>
      </svg>`;

    case "trooper":
      // Swedish Musketeer / Trooper (Carolean royal blue & yellow coat, steel morion/pot helmet, musket)
      return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 320" width="512" height="640">
        <defs>
          <linearGradient id="swedeBlue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#1d4ed8"/>
            <stop offset="100%" stop-color="#172554"/>
          </linearGradient>
          <linearGradient id="swedeGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#facc15"/>
            <stop offset="100%" stop-color="#ca8a04"/>
          </linearGradient>
        </defs>
        <!-- Steel Pot Helmet (Pappenheimer) -->
        <path d="M88 62 C88 26, 168 26, 168 62 Z" fill="#94a3b8" stroke="#1e293b" stroke-width="5"/>
        <path d="M74 62 L182 62 L172 70 L84 70 Z" fill="#cbd5e1" stroke="#1e293b" stroke-width="4"/>
        <!-- Yellow Swedish Plume -->
        <path d="M128 24 C104 10, 78 24, 84 48 C100 40, 114 38, 128 36 Z" fill="#facc15" stroke="#422006" stroke-width="4"/>
        <!-- Head & Beard -->
        <circle cx="128" cy="82" r="20" fill="#ecc19c" stroke="#2b1d14" stroke-width="4"/>
        <circle cx="118" cy="78" r="3" fill="#1e293b"/>
        <circle cx="135" cy="78" r="3" fill="#1e293b"/>
        <path d="M114 90 L142 90 L128 106 Z" fill="#d97706" stroke="#451a03" stroke-width="3"/>
        <!-- Royal Blue & Yellow Coat -->
        <path d="M82 106 L174 106 L186 220 L70 220 Z" fill="url(#swedeBlue)" stroke="#0f172a" stroke-width="5"/>
        <!-- Yellow Cross / Turnbacks -->
        <path d="M118 106 L138 106 L142 220 L114 220 Z" fill="url(#swedeGold)" stroke="#422006" stroke-width="3"/>
        <path d="M70 198 L104 220 L70 220 Z" fill="url(#swedeGold)"/>
        <path d="M186 198 L152 220 L186 220 Z" fill="url(#swedeGold)"/>
        <!-- Arms -->
        <path d="M76 112 L56 168 L76 176 L92 124 Z" fill="url(#swedeBlue)" stroke="#0f172a" stroke-width="4"/>
        <path d="M180 112 L200 168 L180 176 L164 124 Z" fill="url(#swedeBlue)" stroke="#0f172a" stroke-width="4"/>
        <!-- Yellow Breeches & Dark Boots -->
        <rect x="88" y="218" width="32" height="40" rx="5" fill="#eab308" stroke="#422006" stroke-width="4"/>
        <rect x="136" y="218" width="32" height="40" rx="5" fill="#eab308" stroke="#422006" stroke-width="4"/>
        <path d="M84 250 L122 250 L118 306 L82 306 Z" fill="#1e293b" stroke="#090d16" stroke-width="5"/>
        <path d="M134 250 L172 250 L174 306 L138 306 Z" fill="#1e293b" stroke="#090d16" stroke-width="5"/>
        <!-- Swedish Musket -->
        <rect x="44" y="150" width="172" height="11" rx="3" transform="rotate(10 128 155)" fill="#78350f" stroke="#271003" stroke-width="4"/>
        <rect x="38" y="146" width="118" height="7" rx="2" transform="rotate(10 128 155)" fill="#94a3b8" stroke="#0f172a" stroke-width="3"/>
      </svg>`;

    case "commander":
      // Field Marshal Rudolf Count Colloredo in white nightshirt & red Maltese cross order sash,
      // limping with walking cane in one hand and personal wheellock pistol in the other
      return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 320" width="512" height="640">
        <defs>
          <linearGradient id="nightshirt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="60%" stop-color="#e2e8f0"/>
            <stop offset="100%" stop-color="#cbd5e1"/>
          </linearGradient>
          <linearGradient id="malteseRed" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#dc2626"/>
            <stop offset="100%" stop-color="#991b1b"/>
          </linearGradient>
        </defs>
        <!-- Flowing White Silver Hair & Beard of the 63-year-old Marshal -->
        <path d="M102 46 C102 20, 154 20, 154 46 C168 56, 172 82, 162 104 C150 94, 150 78, 148 70 C140 70, 116 70, 108 70 C106 78, 106 94, 94 104 C84 82, 88 56, 102 46 Z" fill="#f1f5f9" stroke="#94a3b8" stroke-width="3"/>
        <!-- Face & Aged Wrinkles -->
        <circle cx="128" cy="74" r="20" fill="#f8d5b8" stroke="#332218" stroke-width="3"/>
        <circle cx="120" cy="70" r="2.5" fill="#1e293b"/>
        <circle cx="136" cy="70" r="2.5" fill="#1e293b"/>
        <!-- Silver Grand Marshal Mustache & Goatee -->
        <path d="M112 80 Q128 76 144 80 Q138 90 128 86 Q118 90 112 80 Z" fill="#ffffff" stroke="#94a3b8" stroke-width="2"/>
        <path d="M124 88 L132 88 L128 102 Z" fill="#ffffff" stroke="#94a3b8" stroke-width="2"/>
        <!-- Ruffled Nightshirt Collar -->
        <path d="M106 98 Q128 92 150 98 Q140 108 128 104 Q116 108 106 98 Z" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/>
        <!-- Long White Nightshirt Body (No Cuirass!) -->
        <path d="M84 102 L172 102 L184 252 L72 252 Z" fill="url(#nightshirt)" stroke="#475569" stroke-width="4"/>
        <!-- Order of Malta Crimson Ribbon & Maltese Cross -->
        <path d="M96 104 L164 196 L150 208 L82 116 Z" fill="url(#malteseRed)" stroke="#7f1d1d" stroke-width="3"/>
        <!-- White 8-pointed Maltese Cross Pendant -->
        <polygon points="128,142 133,150 142,145 137,154 146,159 137,164 142,173 133,168 128,176 123,168 114,173 119,164 110,159 119,154 114,145 123,150" fill="#ffffff" stroke="#b91c1c" stroke-width="1.5"/>
        <!-- Loose Nightshirt Sleeves -->
        <path d="M78 106 L50 168 L70 174 L90 116 Z" fill="url(#nightshirt)" stroke="#475569" stroke-width="3"/>
        <path d="M174 106 L202 162 L182 170 L162 116 Z" fill="url(#nightshirt)" stroke="#475569" stroke-width="3"/>
        <!-- Limping Bare Legs / Slippers (Handicap from 7 bullet wounds at Lützen 1632) -->
        <rect x="94" y="250" width="24" height="34" rx="4" fill="#f8d5b8" stroke="#332218" stroke-width="3"/>
        <rect x="138" y="250" width="24" height="34" rx="4" fill="#f8d5b8" stroke="#332218" stroke-width="3"/>
        <ellipse cx="106" cy="286" rx="16" ry="7" fill="#78350f" stroke="#271003" stroke-width="3"/>
        <ellipse cx="150" cy="286" rx="16" ry="7" fill="#78350f" stroke="#271003" stroke-width="3"/>
        <!-- Left Hand Leaning on Carved Wooden Walking Cane -->
        <line x1="56" y1="170" x2="52" y2="296" stroke="#5c3821" stroke-width="6" stroke-linecap="round"/>
        <ellipse cx="56" cy="168" rx="8" ry="5" fill="#d97706" stroke="#451a03" stroke-width="2"/>
        <!-- Right Hand Holding Personal Silver Wheellock Pistol -->
        <rect x="180" y="156" width="56" height="10" rx="3" transform="rotate(-18 190 160)" fill="#451a03" stroke="#172554" stroke-width="3"/>
        <rect x="200" y="152" width="40" height="6" rx="2" transform="rotate(-18 190 160)" fill="#e2e8f0" stroke="#0f172a" stroke-width="2"/>
        <circle cx="196" cy="160" r="5" fill="#f59e0b" stroke="#78350f" stroke-width="2"/>
      </svg>`;

    case "sectoid":
      // Elite Swedish Grenadier / Officer (Heavy blackened half-plate, tall mitre/plume, glowing iron grenade & pike/carbine)
      return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 320" width="512" height="640">
        <defs>
          <linearGradient id="darkPlate" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#475569"/>
            <stop offset="50%" stop-color="#94a3b8"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </linearGradient>
          <linearGradient id="eliteCape" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#1e3a8a"/>
            <stop offset="100%" stop-color="#091128"/>
          </linearGradient>
        </defs>
        <!-- Tall Grenadier Mitre Cap / Lion Crest -->
        <path d="M94 58 L128 12 L162 58 Z" fill="#1e3a8a" stroke="#facc15" stroke-width="5"/>
        <circle cx="128" cy="40" r="9" fill="#facc15" stroke="#422006" stroke-width="3"/>
        <rect x="88" y="54" width="80" height="10" rx="4" fill="#facc15" stroke="#422006" stroke-width="3"/>
        <!-- Face & Eyepatch -->
        <circle cx="128" cy="80" r="20" fill="#e2b48d" stroke="#2b1d14" stroke-width="4"/>
        <line x1="110" y1="68" x2="146" y2="82" stroke="#0f172a" stroke-width="4"/>
        <circle cx="120" cy="76" r="5" fill="#0f172a"/>
        <circle cx="137" cy="76" r="3" fill="#ef4444"/>
        <!-- Heavy Cape & Pauldrons -->
        <path d="M68 106 L188 106 L202 236 L54 236 Z" fill="url(#eliteCape)" stroke="#090d16" stroke-width="5"/>
        <ellipse cx="82" cy="116" rx="22" ry="15" fill="url(#darkPlate)" stroke="#0f172a" stroke-width="4"/>
        <ellipse cx="174" cy="116" rx="22" ry="15" fill="url(#darkPlate)" stroke="#0f172a" stroke-width="4"/>
        <!-- Heavy Half-Plate Cuirass with Gold Trim -->
        <path d="M88 104 L168 104 L160 194 L128 210 L96 194 Z" fill="url(#darkPlate)" stroke="#facc15" stroke-width="4"/>
        <line x1="128" y1="106" x2="128" y2="208" stroke="#facc15" stroke-width="4"/>
        <!-- Raised Left Hand Holding Lit Iron Grenade -->
        <circle cx="58" cy="126" r="15" fill="#1e293b" stroke="#f8fafc" stroke-width="4"/>
        <circle cx="58" cy="106" r="8" fill="#fb923c" stroke="#fef08a" stroke-width="3"/>
        <!-- Heavy Armored Tassets & Boots -->
        <path d="M86 196 L124 196 L120 248 L80 248 Z" fill="url(#darkPlate)" stroke="#0f172a" stroke-width="4"/>
        <path d="M132 196 L170 196 L176 248 L136 248 Z" fill="url(#darkPlate)" stroke="#0f172a" stroke-width="4"/>
        <rect x="86" y="248" width="32" height="58" rx="4" fill="#0f172a" stroke="#020617" stroke-width="4"/>
        <rect x="138" y="248" width="32" height="58" rx="4" fill="#0f172a" stroke="#020617" stroke-width="4"/>
        <!-- Officer Carbine / Halberd -->
        <rect x="78" y="154" width="144" height="12" rx="4" transform="rotate(14 148 160)" fill="#451a03" stroke="#0f172a" stroke-width="4"/>
        <rect x="64" y="150" width="98" height="8" rx="2" transform="rotate(14 148 160)" fill="#cbd5e1" stroke="#0f172a" stroke-width="3"/>
      </svg>`;
  }
}

/**
 * Returns a Data URI (`data:image/svg+xml;utf8,...`) for the requested unit archetype.
 */
export function getProceduralSpriteDataUri(archetype: UnitArchetype): string {
  const cached = SPRITE_CACHE[archetype];
  if (cached) return cached;

  const svg = buildSvgMarkup(archetype).trim();
  const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  SPRITE_CACHE[archetype] = dataUri;
  return dataUri;
}

/**
 * Returns a cached, shared THREE.Texture for the requested archetype to prevent WebGL memory leaks.
 */
export function getSharedSpriteTexture(archetype: UnitArchetype): THREE.Texture {
  let tex = TEXTURE_CACHE.get(archetype);
  if (!tex) {
    const uri = getProceduralSpriteDataUri(archetype);
    const loader = new THREE.TextureLoader();
    tex = loader.load(uri);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    TEXTURE_CACHE.set(archetype, tex);
  }
  return tex;
}

/**
 * Returns a cached, shared THREE.MeshDepthMaterial for shadow-casting billboards.
 */
export function getSharedDepthMaterial(
  archetype: UnitArchetype,
): THREE.MeshDepthMaterial {
  let mat = DEPTH_MATERIAL_CACHE.get(archetype);
  if (!mat) {
    const tex = getSharedSpriteTexture(archetype);
    mat = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      map: tex,
      alphaTest: 0.5,
    });
    DEPTH_MATERIAL_CACHE.set(archetype, mat);
  }
  return mat;
}
