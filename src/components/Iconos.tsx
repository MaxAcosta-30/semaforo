// Íconos propios (sin dependencia): trazo de 2.2 px, siempre junto a un texto.
const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

export const IconoOk = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="10" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </svg>
);
export const IconoPrecaucion = () => (
  <svg {...base}>
    <path d="M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);
export const IconoAlto = () => (
  <svg {...base}>
    <path d="M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9z" />
    <path d="M8 12h8" />
  </svg>
);
