// Shows the uploaded logo if there is one, otherwise a tile in the brand colour with initials.
export default function BrandLogo({ name, image, color, size = 56 }) {
  const dimensions = { width: size, height: size };

  if (image) {
    return <img className="brand-logo" src={image} alt={`${name} logo`} style={dimensions} />;
  }

  const initials = name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="brand-tile"
      style={{ ...dimensions, background: color || "var(--color-primary)", fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}