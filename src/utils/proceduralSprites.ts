/**
 * Procedural SVG / Canvas Data URI sprite generator (/src/utils/proceduralSprites.ts).
 * Produces crisp, transparent-background character sprites for all 5 archetypes
 * (`ranger`, `sniper`, `commander`, `trooper`, `sectoid`) so 2D billboard
 * planes with `alphaTest={0.5}` cast sharp 3D silhouette shadows out of the box.
 *
 * Art Direction Pillars enforced:
 * 1. Correct Z-layering & fit of hats/helmets: Headgear is always rendered ON TOP of the head
 *    and pulled low to the brow (y=68..72) with a chiaroscuro brow shadow.
 * 2. Rich heraldic colors (10% accent budget: Royal Gold, Imperial Crimson, Carolean Blue/Yellow,
 *    Glowing Torch/Matchlock Embers) contrasted against dark steel and leather.
 * 3. Distinct top-down Shape Language silhouettes:
 *    - `ranger`: Massive square & rounded heavy cuirassier (broad pauldrons, cuirass, wide cavalier hat).
 *    - `sniper`: Wide horizontal silhouette (sweeping cloak, wide feathered hat pulled low, long horizontal musket).
 *    - `trooper`: Tall, sharp vertical triangle (towering pike/halberd + crested morion helmet pulled over brow).
 *    - `commander`: Asymmetric noble silhouette (flowing white nightshirt, crimson Maltese sash, cane & pistol).
 *    - `sectoid`: Asymmetric mystic/grenadier officer (tall mitre cap over brow, back banner, smoking grenade/censer, parchment seals).
 */

import * as THREE from "three";
import type { UnitArchetype } from "../core/types";

const SPRITE_CACHE: Partial<Record<UnitArchetype, string>> = {};
const TEXTURE_CACHE = new Map<UnitArchetype, THREE.Texture>();
const DEPTH_MATERIAL_CACHE = new Map<UnitArchetype, THREE.MeshDepthMaterial>();

function buildSvgMarkup(archetype: UnitArchetype): string {
  switch (archetype) {
    case "ranger":
      // Heavy Infantry / Imperial Cuirassier-Dragoon:
      // Massive square & rounded silhouette — broad segmented pauldrons, heavy steel cuirass,
      // vivid scarlet cloak & sash, wide-brimmed cavalier hat pulled down over the brow.
      return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 320" width="512" height="640">
        <defs>
          <linearGradient id="crimsonCape" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#b91c1c"/>
            <stop offset="55%" stop-color="#7f1d1d"/>
            <stop offset="100%" stop-color="#3b0707"/>
          </linearGradient>
          <linearGradient id="steelCuirass" x1="0" y1="0" x2="1" y2="0.4">
            <stop offset="0%" stop-color="#475569"/>
            <stop offset="38%" stop-color="#f1f5f9"/>
            <stop offset="62%" stop-color="#94a3b8"/>
            <stop offset="100%" stop-color="#1e293b"/>
          </linearGradient>
          <linearGradient id="buffLeather" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#e5bc7a"/>
            <stop offset="100%" stop-color="#855826"/>
          </linearGradient>
          <linearGradient id="royalGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fef08a"/>
            <stop offset="50%" stop-color="#eab308"/>
            <stop offset="100%" stop-color="#854d0e"/>
          </linearGradient>
        </defs>

        <!-- 1. Back Billowing Baroque Crimson Cloak (Wide Mass) -->
        <path d="M64 102 C38 148, 30 212, 42 268 L198 264 C210 216, 198 150, 186 104 Z" fill="url(#crimsonCape)" stroke="#1f0507" stroke-width="4"/>

        <!-- 2. Heavy Riding Boots & Armored Greaves -->
        <rect x="84" y="212" width="36" height="44" rx="8" fill="#5c3a21" stroke="#1e1108" stroke-width="4"/>
        <rect x="136" y="212" width="36" height="44" rx="8" fill="#5c3a21" stroke="#1e1108" stroke-width="4"/>
        <path d="M78 244 L124 244 L120 308 L76 308 Z" fill="#1c1613" stroke="#090706" stroke-width="5"/>
        <path d="M132 244 L178 244 L180 308 L136 308 Z" fill="#1c1613" stroke="#090706" stroke-width="5"/>
        <!-- Golden Boot Spurs & Knee Cops -->
        <ellipse cx="101" cy="246" rx="18" ry="8" fill="url(#steelCuirass)" stroke="#1e293b" stroke-width="3"/>
        <ellipse cx="155" cy="246" rx="18" ry="8" fill="url(#steelCuirass)" stroke="#1e293b" stroke-width="3"/>

        <!-- 3. Buff Coat Skirt & Steel Tassets (Massive Square Silhouette) -->
        <path d="M72 104 L184 104 L196 220 L60 220 Z" fill="url(#buffLeather)" stroke="#2b180a" stroke-width="5"/>
        <path d="M78 182 L124 182 L120 222 L72 222 Z" fill="url(#steelCuirass)" stroke="#1e293b" stroke-width="4"/>
        <path d="M132 182 L178 182 L184 222 L136 222 Z" fill="url(#steelCuirass)" stroke="#1e293b" stroke-width="4"/>

        <!-- 4. Heavy Mirror-Polished Steel Cuirass with Royal Gold Rim -->
        <path d="M82 102 L174 102 L168 182 L128 196 L88 182 Z" fill="url(#steelCuirass)" stroke="#0f172a" stroke-width="5"/>
        <path d="M128 104 L128 194" stroke="#facc15" stroke-width="3"/>
        <path d="M84 104 L172 104" stroke="url(#royalGold)" stroke-width="4"/>

        <!-- 5. Imperial Scarlet Field Sash with Gold Fringe -->
        <path d="M84 112 L172 168 L162 186 L76 130 Z" fill="#dc2626" stroke="#450a0a" stroke-width="3"/>
        <path d="M168 178 L194 214 L176 222 L156 184 Z" fill="#dc2626" stroke="#450a0a" stroke-width="3"/>
        <line x1="176" y1="222" x2="194" y2="214" stroke="#facc15" stroke-width="4"/>

        <!-- 6. Massive Rounded Steel Pauldrons (Broad Shoulder Read) -->
        <ellipse cx="72" cy="116" rx="28" ry="18" fill="url(#steelCuirass)" stroke="#0f172a" stroke-width="4"/>
        <ellipse cx="184" cy="116" rx="28" ry="18" fill="url(#steelCuirass)" stroke="#0f172a" stroke-width="4"/>
        <path d="M48 118 Q72 128 96 118" fill="none" stroke="#facc15" stroke-width="3"/>
        <path d="M160 118 Q184 128 208 118" fill="none" stroke="#facc15" stroke-width="3"/>

        <!-- 7. Armored Arms & Gauntlets -->
        <path d="M62 124 L46 172 L70 180 L84 134 Z" fill="url(#buffLeather)" stroke="#2b180a" stroke-width="4"/>
        <path d="M194 124 L210 164 L186 174 L172 134 Z" fill="url(#buffLeather)" stroke="#2b180a" stroke-width="4"/>

        <!-- 8. Head & Steel Gorget (Drawn BEFORE Hat so Hat covers forehead!) -->
        <ellipse cx="128" cy="100" rx="26" ry="10" fill="url(#steelCuirass)" stroke="#0f172a" stroke-width="3"/>
        <circle cx="128" cy="80" r="20" fill="#f1c29b" stroke="#2b1d14" stroke-width="4"/>
        <!-- Chiaroscuro Brow Shadow cast by the Hat Brim -->
        <path d="M108 74 Q128 80 148 74 L148 64 L108 64 Z" fill="#1a0f0a" opacity="0.55"/>
        <!-- Eyes & Imperial Mustache -->
        <circle cx="120" cy="79" r="2.8" fill="#1d1612"/>
        <circle cx="136" cy="79" r="2.8" fill="#1d1612"/>
        <path d="M112 88 Q128 82 144 88 Q137 96 128 91 Q119 96 112 88 Z" fill="#3d2314"/>
        <path d="M124 93 L132 93 L128 101 Z" fill="#3d2314"/>

        <!-- 9. Wide-Brimmed Cavalier Hat Pulled Firmly Down Over Forehead (ON TOP of Head!) -->
        <!-- Hat Crown hugging the skull -->
        <path d="M96 68 C96 36, 160 36, 160 68 Z" fill="#261f1b" stroke="#0c0908" stroke-width="4"/>
        <!-- Sweeping Baroque Brim pulled down to y=68 over the brow -->
        <path d="M62 66 C88 54, 168 58, 196 64 C180 76, 86 76, 62 66 Z" fill="#181310" stroke="#090706" stroke-width="4"/>
        <!-- Royal Gold Hatband & Buckle -->
        <rect x="97" y="59" width="62" height="7" rx="3" fill="url(#royalGold)" stroke="#422006" stroke-width="2"/>
        <rect x="123" y="57" width="10" height="11" rx="2" fill="#fef08a" stroke="#713f12" stroke-width="2"/>
        <!-- Grand Scarlet & Gold Ostrich Plume Flowing in the Wind -->
        <path d="M142 58 C166 26, 212 24, 216 58 C202 52, 184 56, 166 64 Z" fill="#ef4444" stroke="#450a0a" stroke-width="3.5"/>
        <path d="M134 52 C156 16, 198 12, 204 42 C186 36, 164 42, 148 56 Z" fill="#facc15" stroke="#713f12" stroke-width="3"/>

        <!-- 10. Heavy Wheellock Carbine Held Across Chest -->
        <rect x="48" y="148" width="168" height="13" rx="4" transform="rotate(-12 128 154)" fill="#5c3a21" stroke="#1e1108" stroke-width="4"/>
        <rect x="114" y="144" width="116" height="7.5" rx="2" transform="rotate(-12 128 154)" fill="#e2e8f0" stroke="#0f172a" stroke-width="3"/>
        <circle cx="132" cy="156" r="8.5" fill="url(#royalGold)" stroke="#422006" stroke-width="3"/>
      </svg>`;

    case "sniper":
      // Musketeer / Clementinum Sharpshooter:
      // Wide horizontal silhouette — sweeping cloak with fluttering ribbons, wide cavalier hat
      // with tall golden plume pulled low over the brow, extra-long horizontal musket on fork rest.
      return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 320" width="512" height="640">
        <defs>
          <linearGradient id="scholarCloak" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1e3a5f"/>
            <stop offset="60%" stop-color="#15253b"/>
            <stop offset="100%" stop-color="#0a111c"/>
          </linearGradient>
          <linearGradient id="goldBraid" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#facc15"/>
            <stop offset="50%" stop-color="#fef08a"/>
            <stop offset="100%" stop-color="#ca8a04"/>
          </linearGradient>
        </defs>

        <!-- 1. Wide Billowing Baroque Cloak (Creates Wide Wing-Like Silhouette) -->
        <path d="M80 104 C44 134, 22 188, 18 248 C52 242, 74 246, 94 242 L176 242 C198 248, 222 238, 238 228 C226 176, 204 132, 174 104 Z" fill="url(#scholarCloak)" stroke="#070b12" stroke-width="4"/>
        <!-- Crimson Cloak Lining & Gold Edge -->
        <path d="M22 244 C48 232, 68 236, 86 238 L78 148 C56 176, 36 210, 22 244 Z" fill="#991b1b" opacity="0.85"/>
        <path d="M18 248 C52 242, 74 246, 94 242" fill="none" stroke="url(#goldBraid)" stroke-width="3.5"/>

        <!-- 2. Boots -->
        <path d="M88 236 L122 236 L118 308 L84 308 Z" fill="#1c1715" stroke="#090706" stroke-width="5"/>
        <path d="M134 236 L168 236 L172 308 L138 308 Z" fill="#1c1715" stroke="#090706" stroke-width="5"/>
        <rect x="86" y="232" width="38" height="14" rx="3" fill="#78350f" stroke="#1e1108" stroke-width="3"/>
        <rect x="132" y="232" width="38" height="14" rx="3" fill="#78350f" stroke="#1e1108" stroke-width="3"/>

        <!-- 3. Fitted Jesuit/Scholar Coat with Gold Embroidery -->
        <path d="M82 104 L174 104 L188 238 L68 238 Z" fill="url(#scholarCloak)" stroke="#090d16" stroke-width="5"/>
        <line x1="128" y1="108" x2="128" y2="236" stroke="url(#goldBraid)" stroke-width="5"/>
        <!-- Crimson Shoulder Ribbons -->
        <path d="M78 106 L58 134 L72 140 L88 114 Z" fill="#dc2626" stroke="#450a0a" stroke-width="3"/>
        <path d="M178 106 L198 134 L184 140 L168 114 Z" fill="#dc2626" stroke="#450a0a" stroke-width="3"/>

        <!-- 4. Apostle Powder Flasks Bandolier -->
        <path d="M92 110 L168 194" stroke="#78350f" stroke-width="9" stroke-linecap="round"/>
        <rect x="104" y="130" width="9" height="17" rx="2" fill="url(#goldBraid)" stroke="#221909" stroke-width="2"/>
        <rect x="122" y="148" width="9" height="17" rx="2" fill="url(#goldBraid)" stroke="#221909" stroke-width="2"/>
        <rect x="140" y="166" width="9" height="17" rx="2" fill="url(#goldBraid)" stroke="#221909" stroke-width="2"/>

        <!-- 5. Crisp White Baroque Falling Collar -->
        <path d="M96 98 L160 98 L172 120 L128 112 L84 120 Z" fill="#f8fafc" stroke="#1e293b" stroke-width="3.5"/>

        <!-- 6. Head (Drawn BEFORE Hat so Hat covers forehead & brow!) -->
        <circle cx="128" cy="80" r="19.5" fill="#f3c8a6" stroke="#2b1d14" stroke-width="4"/>
        <!-- Deep Chiaroscuro Hat Shadow across Upper Face -->
        <path d="M108 76 Q128 82 148 76 L148 64 L108 64 Z" fill="#0f141c" opacity="0.6"/>
        <!-- Keen Sharpshooter Eyes -->
        <circle cx="120" cy="80" r="2.6" fill="#0f172a"/>
        <circle cx="137" cy="80" r="2.8" fill="#f59e0b"/>
        <path d="M120 90 Q128 87 136 90" fill="none" stroke="#3d2314" stroke-width="2.5" stroke-linecap="round"/>

        <!-- 7. Wide Slouch Cavalier Hat Pulled Low Over Brow (ON TOP of Head!) -->
        <!-- Hat Crown -->
        <path d="M96 69 C98 36, 158 36, 160 69 Z" fill="#1e2530" stroke="#090c10" stroke-width="4"/>
        <!-- Wide Dramatic Slouch Brim Tilted Over Brow (y=69) -->
        <path d="M56 72 C88 56, 168 54, 202 64 C178 79, 88 80, 56 72 Z" fill="#121720" stroke="#07090d" stroke-width="4"/>
        <!-- Crimson & Gold Hat Cord -->
        <path d="M97 62 Q128 67 159 62" fill="none" stroke="url(#goldBraid)" stroke-width="5"/>
        <!-- Sweeping Golden-White Pheasant & Ostrich Plumes -->
        <path d="M144 58 C178 22, 224 26, 228 60 C206 50, 180 54, 156 62 Z" fill="#fef08a" stroke="#422006" stroke-width="3.5"/>
        <path d="M136 54 C166 14, 206 12, 212 40 C190 34, 168 42, 148 56 Z" fill="#f97316" stroke="#431407" stroke-width="3"/>

        <!-- 8. Extra-Long Horizontal Matchlock Musket & Fork Rest (Wide Silhouette Signature) -->
        <line x1="192" y1="116" x2="192" y2="308" stroke="#78350f" stroke-width="7" stroke-linecap="round"/>
        <path d="M180 104 Q192 124 204 104" fill="none" stroke="#e2e8f0" stroke-width="5" stroke-linecap="round"/>
        <rect x="14" y="138" width="228" height="10.5" rx="3" transform="rotate(-5 134 142)" fill="#5c3a21" stroke="#1e1108" stroke-width="4"/>
        <rect x="76" y="134" width="172" height="6.5" rx="2" transform="rotate(-5 134 142)" fill="#f1f5f9" stroke="#0f172a" stroke-width="3"/>
        <!-- Glowing Matchcord Ember & Rising Smoke Wisp -->
        <circle cx="110" cy="134" r="7.5" fill="#f97316" stroke="#fef08a" stroke-width="3"/>
        <path d="M110 124 C104 110, 118 98, 112 84" fill="none" stroke="#fde047" stroke-width="2.5" stroke-linecap="round" opacity="0.85"/>
      </svg>`;

    case "trooper":
      // Swedish Pikeman / Halberdier-Musketeer:
      // Tall, sharp vertical triangle silhouette — towering vertical pike/halberd jutting to y=4
      // with Swedish blue/gold pennant, pointed Pappenheimer/Morion steel helmet pulled down over the brow.
      return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 320" width="512" height="640">
        <defs>
          <linearGradient id="swedeBlue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#2563eb"/>
            <stop offset="65%" stop-color="#1d4ed8"/>
            <stop offset="100%" stop-color="#172554"/>
          </linearGradient>
          <linearGradient id="swedeGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fef08a"/>
            <stop offset="50%" stop-color="#facc15"/>
            <stop offset="100%" stop-color="#ca8a04"/>
          </linearGradient>
          <linearGradient id="helmetSteel" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#64748b"/>
            <stop offset="50%" stop-color="#f8fafc"/>
            <stop offset="100%" stop-color="#334155"/>
          </linearGradient>
        </defs>

        <!-- 1. Towering Vertical Halberd / Pike (Creates Sharp Vertical Triangle Silhouette) -->
        <line x1="60" y1="28" x2="60" y2="308" stroke="#78350f" stroke-width="8" stroke-linecap="round"/>
        <!-- Fluttering Swedish Blue & Gold Pennant near Pike Tip -->
        <path d="M64 44 L122 52 L98 66 L124 78 L64 74 Z" fill="url(#swedeGold)" stroke="#422006" stroke-width="3"/>
        <path d="M64 52 L106 58 L64 66 Z" fill="#1d4ed8"/>
        <!-- Razor-Sharp Steel Pike Spearhead & Halberd Axe Blade -->
        <polygon points="60,2 48,36 60,30 72,36" fill="url(#helmetSteel)" stroke="#0f172a" stroke-width="3.5"/>
        <path d="M60 32 C34 26, 28 54, 60 48 Z" fill="url(#helmetSteel)" stroke="#0f172a" stroke-width="3.5"/>
        <polygon points="60,34 80,40 60,46" fill="url(#helmetSteel)" stroke="#0f172a" stroke-width="3"/>

        <!-- 2. Yellow Breeches & Dark Boots -->
        <rect x="88" y="216" width="32" height="42" rx="5" fill="url(#swedeGold)" stroke="#422006" stroke-width="4"/>
        <rect x="136" y="216" width="32" height="42" rx="5" fill="url(#swedeGold)" stroke="#422006" stroke-width="4"/>
        <path d="M84 250 L122 250 L118 308 L82 308 Z" fill="#1e293b" stroke="#090d16" stroke-width="5"/>
        <path d="M134 250 L172 250 L174 308 L138 308 Z" fill="#1e293b" stroke="#090d16" stroke-width="5"/>

        <!-- 3. Carolean Royal Blue & Yellow Coat -->
        <path d="M80 106 L176 106 L188 220 L68 220 Z" fill="url(#swedeBlue)" stroke="#0f172a" stroke-width="5"/>
        <!-- Vivid Yellow Cross / Turnbacks & Brass Buttons -->
        <path d="M116 106 L140 106 L144 220 L112 220 Z" fill="url(#swedeGold)" stroke="#422006" stroke-width="3"/>
        <path d="M80 146 L176 146 L178 164 L78 164 Z" fill="url(#swedeGold)" stroke="#422006" stroke-width="3"/>
        <path d="M68 192 L106 220 L68 220 Z" fill="url(#swedeGold)" stroke="#422006" stroke-width="2.5"/>
        <path d="M188 192 L150 220 L188 220 Z" fill="url(#swedeGold)" stroke="#422006" stroke-width="2.5"/>

        <!-- 4. Arms -->
        <path d="M76 112 L52 164 L72 172 L92 124 Z" fill="url(#swedeBlue)" stroke="#0f172a" stroke-width="4"/>
        <path d="M180 112 L202 168 L182 176 L164 124 Z" fill="url(#swedeBlue)" stroke="#0f172a" stroke-width="4"/>

        <!-- 5. Head & Nordic Beard (Drawn BEFORE Helmet so Helmet covers forehead!) -->
        <circle cx="128" cy="82" r="20" fill="#ecc19c" stroke="#2b1d14" stroke-width="4"/>
        <!-- Brow Shadow Under Helmet Brim -->
        <path d="M108 78 Q128 84 148 78 L148 66 L108 66 Z" fill="#0f172a" opacity="0.55"/>
        <circle cx="119" cy="81" r="2.8" fill="#0f172a"/>
        <circle cx="137" cy="81" r="2.8" fill="#0f172a"/>
        <path d="M112 91 L144 91 L128 109 Z" fill="#d97706" stroke="#451a03" stroke-width="3"/>

        <!-- 6. Pointed Steel Morion / Pappenheimer Helmet Pulled Down Over Forehead (ON TOP of Head!) -->
        <!-- Tall Pointed Comb/Crest -->
        <path d="M120 52 L128 18 L136 52 Z" fill="url(#swedeGold)" stroke="#422006" stroke-width="3.5"/>
        <!-- Yellow & Blue Plume Flowing Back -->
        <path d="M132 34 C162 18, 194 32, 188 58 C168 48, 150 48, 132 46 Z" fill="url(#swedeGold)" stroke="#422006" stroke-width="3.5"/>
        <!-- Steel Helmet Skull Dome Pulled Down to y=72 -->
        <path d="M92 72 C92 34, 164 34, 164 72 Z" fill="url(#helmetSteel)" stroke="#0f172a" stroke-width="4.5"/>
        <line x1="128" y1="34" x2="128" y2="72" stroke="#facc15" stroke-width="3"/>
        <!-- Curved Morion Brim Pulled Low Over Brow (y=72) -->
        <path d="M72 68 Q128 80 184 68 Q128 60 72 68 Z" fill="#cbd5e1" stroke="#0f172a" stroke-width="4"/>
        <!-- Steel Cheekguards & Nasal Bar Framing Face -->
        <path d="M98 71 L94 90 L106 88 L106 72 Z" fill="#94a3b8" stroke="#0f172a" stroke-width="3"/>
        <path d="M158 71 L162 90 L150 88 L150 72 Z" fill="#94a3b8" stroke="#0f172a" stroke-width="3"/>
        <line x1="128" y1="70" x2="128" y2="85" stroke="#e2e8f0" stroke-width="3.5" stroke-linecap="round"/>

        <!-- 7. Sidearm Musket Slung Across Body -->
        <rect x="64" y="152" width="156" height="10.5" rx="3" transform="rotate(12 136 156)" fill="#78350f" stroke="#271003" stroke-width="4"/>
        <rect x="58" y="148" width="108" height="6.5" rx="2" transform="rotate(12 136 156)" fill="#cbd5e1" stroke="#0f172a" stroke-width="3"/>
      </svg>`;

    case "commander":
      // Field Marshal Rudolf Count Colloredo:
      // Asymmetric noble silhouette — flowing silver-white hair & baroque curls framing and covering
      // the crown of his head, golden commander halo crest, white nightshirt, vivid scarlet Order of Malta
      // sash & 8-pointed cross, carved walking cane, and silver wheellock pistol.
      return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 320" width="512" height="640">
        <defs>
          <linearGradient id="nightshirt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="65%" stop-color="#f1f5f9"/>
            <stop offset="100%" stop-color="#cbd5e1"/>
          </linearGradient>
          <linearGradient id="malteseRed" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#ef4444"/>
            <stop offset="50%" stop-color="#dc2626"/>
            <stop offset="100%" stop-color="#7f1d1d"/>
          </linearGradient>
          <linearGradient id="marshalGold" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#fef08a"/>
            <stop offset="50%" stop-color="#eab308"/>
            <stop offset="100%" stop-color="#a16207"/>
          </linearGradient>
        </defs>

        <!-- 1. Baroque Mystic Golden Halo / Grand Prior Radiance behind Head -->
        <circle cx="128" cy="74" r="38" fill="none" stroke="url(#marshalGold)" stroke-width="3" stroke-dasharray="8 5" opacity="0.85"/>

        <!-- 2. Back Layer of Flowing Silver Hair -->
        <path d="M92 64 C80 84, 82 106, 94 114 L162 114 C174 106, 176 84, 164 64 Z" fill="#e2e8f0" stroke="#64748b" stroke-width="3"/>

        <!-- 3. Ruffled Nightshirt Collar & Flowing White Nightshirt Body -->
        <path d="M82 102 L174 102 L190 254 L66 254 Z" fill="url(#nightshirt)" stroke="#334155" stroke-width="4.5"/>
        <!-- Gold Hem Trim on Nightshirt -->
        <line x1="68" y1="246" x2="188" y2="246" stroke="url(#marshalGold)" stroke-width="4"/>

        <!-- 4. Order of Malta Scarlet Grand Cross Ribbon & Maltese Cross -->
        <path d="M94 102 L168 198 L152 212 L78 116 Z" fill="url(#malteseRed)" stroke="#450a0a" stroke-width="3.5"/>
        <!-- White 8-pointed Maltese Cross Pendant with Gold Jewel -->
        <polygon points="128,138 134,148 144,142 138,152 148,158 138,164 144,174 134,168 128,178 122,168 112,174 118,164 108,158 118,152 112,142 122,148" fill="#ffffff" stroke="#b91c1c" stroke-width="2"/>
        <circle cx="128" cy="158" r="4" fill="#facc15"/>

        <!-- 5. Billowing Asymmetric Sleeves & Fluttering Imperial Wax-Sealed Scroll -->
        <path d="M78 106 L46 168 L70 176 L90 118 Z" fill="url(#nightshirt)" stroke="#334155" stroke-width="3.5"/>
        <path d="M178 106 L208 160 L186 170 L164 118 Z" fill="url(#nightshirt)" stroke="#334155" stroke-width="3.5"/>
        <!-- Fluttering Parchment Scroll & Red Wax Seal at Waist -->
        <path d="M168 196 C192 204, 208 224, 202 244 L182 238 C186 222, 176 210, 162 204 Z" fill="#fef3c7" stroke="#78350f" stroke-width="2.5"/>
        <circle cx="192" cy="236" r="6" fill="#dc2626" stroke="#450a0a" stroke-width="2"/>

        <!-- 6. Limping Legs & Baroque Velvet Slippers with Gold Buckles -->
        <rect x="94" y="252" width="24" height="34" rx="4" fill="#f8d5b8" stroke="#332218" stroke-width="3"/>
        <rect x="138" y="252" width="24" height="34" rx="4" fill="#f8d5b8" stroke="#332218" stroke-width="3"/>
        <ellipse cx="106" cy="288" rx="17" ry="8" fill="#991b1b" stroke="#450a0a" stroke-width="3"/>
        <ellipse cx="150" cy="288" rx="17" ry="8" fill="#991b1b" stroke="#450a0a" stroke-width="3"/>
        <rect x="102" y="283" width="8" height="6" fill="#facc15"/>
        <rect x="146" y="283" width="8" height="6" fill="#facc15"/>

        <!-- 7. Ruffled Lace Collar -->
        <path d="M100 98 Q128 90 156 98 Q144 110 128 105 Q112 110 100 98 Z" fill="#ffffff" stroke="#94a3b8" stroke-width="3"/>

        <!-- 8. Face & Aged Aristocratic Features -->
        <circle cx="128" cy="76" r="20" fill="#f8d5b8" stroke="#332218" stroke-width="3.5"/>
        <circle cx="120" cy="74" r="2.6" fill="#1e293b"/>
        <circle cx="136" cy="74" r="2.6" fill="#1e293b"/>
        <!-- Silver Grand Marshal Mustache & Goatee -->
        <path d="M110 82 Q128 77 146 82 Q139 92 128 87 Q117 92 110 82 Z" fill="#ffffff" stroke="#64748b" stroke-width="2"/>
        <path d="M123 89 L133 89 L128 104 Z" fill="#ffffff" stroke="#64748b" stroke-width="2"/>

        <!-- 9. Top Crown of Silver Hair & Velvet Nightcap/Biretta Pulled Over Forehead (ON TOP of Head!) -->
        <path d="M100 68 C96 42, 160 42, 156 68 C144 62, 112 62, 100 68 Z" fill="#991b1b" stroke="#450a0a" stroke-width="3.5"/>
        <path d="M96 68 Q128 60 160 68 Q166 80 158 92 C154 78, 150 68, 128 66 C106 68, 102 78, 98 92 Q90 80 96 68 Z" fill="#f8fafc" stroke="#64748b" stroke-width="3"/>
        <path d="M98 67 Q128 61 158 67" fill="none" stroke="url(#marshalGold)" stroke-width="4"/>

        <!-- 10. Left Hand Leaning on Carved Walking Cane & Right Hand Holding Silver Wheellock Pistol -->
        <line x1="54" y1="170" x2="50" y2="298" stroke="#5c3821" stroke-width="7" stroke-linecap="round"/>
        <ellipse cx="54" cy="168" rx="10" ry="6" fill="url(#marshalGold)" stroke="#451a03" stroke-width="2.5"/>
        <rect x="182" y="152" width="60" height="11" rx="3" transform="rotate(-18 190 160)" fill="#451a03" stroke="#0f172a" stroke-width="3"/>
        <rect x="200" y="148" width="46" height="6.5" rx="2" transform="rotate(-18 190 160)" fill="#f8fafc" stroke="#0f172a" stroke-width="2.5"/>
        <circle cx="198" cy="158" r="6" fill="#f59e0b" stroke="#fef08a" stroke-width="2"/>
      </svg>`;

    case "sectoid":
      // Elite Swedish Grenadier / Mystic Field Inquisitor:
      // Asymmetric, imposing silhouette — tall pointed brass-and-blue mitre cap pulled firmly
      // over the forehead, tall asymmetric back banner with fluttering parchment seals,
      // heavy blackened armor, and raised smoking grenade/censer with glowing embers.
      return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 320" width="512" height="640">
        <defs>
          <linearGradient id="darkPlate" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#334155"/>
            <stop offset="48%" stop-color="#cbd5e1"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </linearGradient>
          <linearGradient id="eliteCape" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#1e3a8a"/>
            <stop offset="100%" stop-color="#091128"/>
          </linearGradient>
          <linearGradient id="mitreGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fef08a"/>
            <stop offset="50%" stop-color="#facc15"/>
            <stop offset="100%" stop-color="#a16207"/>
          </linearGradient>
        </defs>

        <!-- 1. Asymmetric Back Standard / War Banner & Fluttering Parchment Seals (Mystic Silhouette) -->
        <line x1="184" y1="18" x2="168" y2="140" stroke="#78350f" stroke-width="6" stroke-linecap="round"/>
        <line x1="162" y1="26" x2="212" y2="34" stroke="url(#mitreGold)" stroke-width="5" stroke-linecap="round"/>
        <path d="M166 28 L210 35 L224 98 L192 84 L172 102 Z" fill="#1e3a8a" stroke="url(#mitreGold)" stroke-width="3.5"/>
        <polygon points="190,46 196,58 208,58 198,66 202,78 190,70 178,78 182,66 172,58 184,58" fill="#facc15"/>
        <!-- Fluttering Parchment Purity Ribbon -->
        <path d="M210 52 C232 58, 244 76, 238 96 L224 90 C228 76, 220 64, 206 60 Z" fill="#fef3c7" stroke="#78350f" stroke-width="2.5"/>

        <!-- 2. Heavy Cape & Armored Tassets / Boots -->
        <path d="M64 106 L192 106 L208 242 L48 242 Z" fill="url(#eliteCape)" stroke="#090d16" stroke-width="5"/>
        <path d="M84 196 L124 196 L120 250 L78 250 Z" fill="url(#darkPlate)" stroke="#0f172a" stroke-width="4"/>
        <path d="M132 196 L172 196 L178 250 L136 250 Z" fill="url(#darkPlate)" stroke="#0f172a" stroke-width="4"/>
        <rect x="86" y="248" width="32" height="58" rx="4" fill="#0f172a" stroke="#020617" stroke-width="4"/>
        <rect x="138" y="248" width="32" height="58" rx="4" fill="#0f172a" stroke="#020617" stroke-width="4"/>

        <!-- 3. Heavy Half-Plate Cuirass with Royal Gold Trim -->
        <path d="M86 104 L170 104 L162 196 L128 212 L94 196 Z" fill="url(#darkPlate)" stroke="url(#mitreGold)" stroke-width="4.5"/>
        <line x1="128" y1="106" x2="128" y2="210" stroke="url(#mitreGold)" stroke-width="4"/>
        <!-- Spiked Asymmetric Pauldrons -->
        <ellipse cx="80" cy="116" rx="24" ry="16" fill="url(#darkPlate)" stroke="#facc15" stroke-width="3.5"/>
        <ellipse cx="176" cy="116" rx="24" ry="16" fill="url(#darkPlate)" stroke="#facc15" stroke-width="3.5"/>

        <!-- 4. Face & Eyepatch (Drawn BEFORE Mitre Cap so Mitre covers forehead!) -->
        <circle cx="128" cy="82" r="20" fill="#e2b48d" stroke="#2b1d14" stroke-width="4"/>
        <!-- Chiaroscuro Brow Shadow Under Mitre Headband -->
        <path d="M108 78 Q128 84 148 78 L148 66 L108 66 Z" fill="#090d16" opacity="0.6"/>
        <line x1="108" y1="74" x2="148" y2="84" stroke="#0f172a" stroke-width="4"/>
        <circle cx="119" cy="80" r="5.5" fill="#0f172a"/>
        <circle cx="137" cy="80" r="3.2" fill="#ef4444"/>
        <path d="M118 92 Q128 88 138 92" fill="none" stroke="#1e293b" stroke-width="3"/>

        <!-- 5. Tall Grenadier Mitre Cap Pulled Down Over Forehead (ON TOP of Head!) -->
        <path d="M92 70 L128 10 L164 70 Z" fill="#1e3a8a" stroke="url(#mitreGold)" stroke-width="5"/>
        <path d="M104 68 L128 24 L152 68 Z" fill="url(#mitreGold)" stroke="#422006" stroke-width="2.5"/>
        <circle cx="128" cy="48" r="8" fill="#dc2626" stroke="#fef08a" stroke-width="2.5"/>
        <!-- Brass Headband Sitting Snugly Across Forehead at y=64..74 -->
        <rect x="88" y="63" width="80" height="11" rx="4" fill="url(#mitreGold)" stroke="#422006" stroke-width="3.5"/>
        <circle cx="102" cy="68.5" r="2.5" fill="#dc2626"/>
        <circle cx="128" cy="68.5" r="3" fill="#dc2626"/>
        <circle cx="154" cy="68.5" r="2.5" fill="#dc2626"/>

        <!-- 6. Raised Left Hand Holding Lit Iron Grenade / Smoking Censer -->
        <circle cx="48" cy="122" r="16" fill="#1e293b" stroke="#cbd5e1" stroke-width="4"/>
        <circle cx="48" cy="100" r="9.5" fill="#f97316" stroke="#fef08a" stroke-width="3.5"/>
        <circle cx="36" cy="88" r="4" fill="#fef08a"/>
        <circle cx="60" cy="86" r="3.5" fill="#fb923c"/>

        <!-- 7. Officer Carbine / Halberd -->
        <rect x="78" y="154" width="148" height="12" rx="4" transform="rotate(14 148 160)" fill="#451a03" stroke="#0f172a" stroke-width="4"/>
        <rect x="62" y="150" width="102" height="8" rx="2" transform="rotate(14 148 160)" fill="#e2e8f0" stroke="#0f172a" stroke-width="3"/>
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
