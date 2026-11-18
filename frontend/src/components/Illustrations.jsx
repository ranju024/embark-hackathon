// Flat illustrations drawn as inline SVG: no image files, no licences, sharp at any size.

const C = {
  green: "#14452f", leaf: "#3fa66a", mint: "#cfe7d6", sand: "#f6f3ec",
  terracotta: "#b8521f", sun: "#f6c453", amber: "#e8a317", amberDark: "#b97f0b",
  red: "#c8473d", redDark: "#97322a",
};

const BAG_COLORS = {
  organic: [C.leaf, C.green],
  dry: [C.amber, C.amberDark],
  special: [C.red, C.redDark],
};

function Motif({ kind }) {
  if (kind === "organic") {
    return (
      <>
        <path d="M32 74 C20 66 20 50 34 44 C46 52 44 66 32 74 Z" fill="#fff" fillOpacity="0.92" />
        <path d="M32 74 L34 52" stroke={C.green} strokeWidth="2" strokeLinecap="round" />
      </>
    );
  }
  if (kind === "dry") {
    return (
      <>
        <rect x="26" y="50" width="12" height="26" rx="4" fill="#fff" fillOpacity="0.92" />
        <rect x="29" y="44" width="6" height="8" rx="2" fill="#fff" fillOpacity="0.92" />
      </>
    );
  }
  return (
    <>
      <rect x="23" y="52" width="18" height="24" rx="3" fill="#fff" fillOpacity="0.92" />
      <rect x="29" y="48" width="6" height="5" rx="1" fill="#fff" fillOpacity="0.92" />
      <path d="M32 57 L29 66 H34 L31 73" stroke={C.red} strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </>
  );
}

// A bag drawn in a 64 x 92 box.
function Bag({ kind }) {
  const [body, knot] = BAG_COLORS[kind] || BAG_COLORS.organic;
  return (
    <>
      <path d="M8 26 Q8 12 22 12 L26 2 H38 L42 12 Q56 12 56 26 L58 78 Q58 90 46 90 H18 Q6 90 6 78 Z" fill={body} />
      <path d="M26 2 H38 L36 12 H28 Z" fill={knot} />
      <path d="M14 30 Q12 54 15 80" stroke="#fff" strokeOpacity="0.25" strokeWidth="4" strokeLinecap="round" fill="none" />
      <Motif kind={kind} />
    </>
  );
}

export function WasteBag({ kind = "organic", className }) {
  return (
    <svg className={className} viewBox="0 0 64 92" role="img" aria-label={`${kind} waste bag`}>
      <Bag kind={kind} />
    </svg>
  );
}

const QR_CELLS = ["11101", "10111", "11010", "01111", "10101"];

export function HeroIllustration({ className }) {
  return (
    <svg className={className} viewBox="0 0 480 340" role="img" aria-label="A house with a QR code beside bags of sorted waste">
      <circle cx="392" cy="74" r="70" fill={C.sun} fillOpacity="0.16" />
      <circle cx="392" cy="74" r="44" fill={C.sun} />

      <path d="M0 262 Q120 196 236 244 T480 228 V340 H0 Z" fill="#2a7a52" />
      <path d="M0 296 Q150 246 290 286 T480 276 V340 H0 Z" fill="#1d5f3f" />

      <rect x="40" y="248" width="6" height="34" fill="#0f3a27" />
      <circle cx="43" cy="236" r="22" fill={C.leaf} />

      <rect x="96" y="146" width="196" height="146" rx="10" fill={C.sand} />
      <path d="M78 158 L194 62 L310 158 Z" fill={C.terracotta} />
      <rect x="170" y="212" width="46" height="80" rx="6" fill={C.green} />
      <circle cx="206" cy="254" r="3.5" fill={C.sun} />
      <rect x="114" y="176" width="40" height="40" rx="6" fill={C.mint} />
      <path d="M134 176 V216 M114 196 H154" stroke={C.sand} strokeWidth="3" />

      <rect x="234" y="176" width="44" height="44" rx="6" fill="#fff" />
      {QR_CELLS.flatMap((row, r) =>
        [...row].map((cell, i) =>
          cell === "1" ? (
            <rect key={`${r}-${i}`} x={240 + i * 7} y={182 + r * 7} width="6" height="6" rx="1" fill={C.green} />
          ) : null
        )
      )}

      <g transform="translate(318 206) scale(0.95)"><Bag kind="organic" /></g>
      <g transform="translate(372 216) scale(0.85)"><Bag kind="dry" /></g>
      <g transform="translate(420 228) scale(0.7)"><Bag kind="special" /></g>
    </svg>
  );
}

export function TruckIllustration({ className }) {
  return (
    <svg className={className} viewBox="0 0 280 160" role="img" aria-label="A waste collection truck on its route">
      <rect x="0" y="136" width="280" height="6" rx="3" fill={C.mint} />

      <path d="M214 26 c0-12 9-20 19-20 s19 8 19 20 c0 14-19 34-19 34 s-19-20-19-34z" fill={C.terracotta} />
      <circle cx="233" cy="26" r="7" fill="#fff" />

      <rect x="14" y="52" width="140" height="70" rx="8" fill={C.green} />
      <path d="M84 70 c-14 6-16 20-6 30 c12-2 22-14 20-28 c-4-2-9-3-14-2z" fill={C.leaf} />

      <path d="M160 74 h38 q8 0 13 7 l16 22 q3 4 3 9 v10 h-70 z" fill={C.terracotta} />
      <path d="M170 82 h24 l14 20 h-38 z" fill={C.mint} />

      {[56, 116, 206].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="124" r="16" fill="#0f1f17" />
          <circle cx={cx} cy="124" r="6" fill="#9fb3a6" />
        </g>
      ))}
    </svg>
  );
}