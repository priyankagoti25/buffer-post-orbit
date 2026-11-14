/** The PostOrbit mark (a file in /public, drawn in the ink colour) plus the name. */
export default function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <img src="/logo.png" alt="PostOrbit" width={36} height={36} className="h-9 w-9" />
      <span className="font-display text-[1.4rem] font-semibold leading-none tracking-tight text-ink">PostOrbit</span>
    </span>
  );
}
