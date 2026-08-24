import { MICRO_LABEL_CLASS } from '#/lib/controlStyles'

export type SegmentedOption<T extends string> = { value: T; label: string }

/**
 * A row of mutually exclusive choices — shape, activity — as real
 * radios behind chip styling, so keyboard and screen-reader users get the
 * grouping and arrow-key behaviour for free.
 */
export function SegmentedControl<T extends string>({
  label,
  name,
  options,
  value,
  onChange,
}: {
  /** Micro-label above the row. Also names the group for assistive tech. */
  label: string
  /** Radio group name; must be unique on the page. */
  name: string
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <fieldset className="min-w-0">
      <legend className={`mb-1.5 ${MICRO_LABEL_CLASS}`}>{label}</legend>
      <div className="bg-surface-2 flex gap-1 rounded-2xl p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className="min-w-0 flex-1 cursor-pointer text-center"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span className="text-ink-2 peer-checked:bg-surface peer-checked:text-ink peer-focus-visible:outline-moss flex min-h-11 items-center justify-center rounded-xl px-2 text-sm font-medium peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
