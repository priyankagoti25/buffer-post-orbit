export default function Loading({ label = 'Loading…', className = '' }: { label?: string; className?: string }) {
  return (
    <div role="status" className={`flex items-center justify-center gap-3 py-12 text-sm text-muted ${className}`}>
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-sage-300 border-t-forest-700" />
      {label}
    </div>
  );
}
