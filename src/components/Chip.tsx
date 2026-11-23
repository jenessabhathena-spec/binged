// A pill-shaped choice built on a real checkbox or radio, so it works with a keyboard and screen readers.
// Styling reads the input's :checked state through Tailwind's `peer`.
export function Chip({ type, name, value, label, defaultChecked }: {
  type: "checkbox" | "radio"; name: string; value: string; label: string; defaultChecked?: boolean;
}) {
  return (
    <label className="cursor-pointer">
      <input type={type} name={name} value={value} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="inline-block rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-medium transition peer-checked:border-brand peer-checked:bg-brand peer-checked:text-brand-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand">
        {label}
      </span>
    </label>
  );
}

export function Section({ title, hint, error, children }: { title: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2.5">
      <legend className="text-sm font-semibold">
        {title} <span className="font-normal text-muted">(optional)</span>
      </legend>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      <div className="flex flex-wrap gap-2">{children}</div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </fieldset>
  );
}
