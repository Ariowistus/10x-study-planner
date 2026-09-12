import { useMemo, useState } from "react";

const WEEKDAYS = ["Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota", "Niedziela"];
const WEEKDAYS_SHORT = ["pon.", "wt.", "śr.", "czw.", "pt.", "sob.", "niedz."];

interface Props {
  initial: number[];
}

function formatHours(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} godz.`;
  return `${hours} godz. ${minutes} min`;
}

/**
 * Weekly availability editor.
 *
 * This is an island rather than a plain form because the weekly total is the
 * number the learner actually reasons about, and seeing it change while typing
 * is what stops them from declaring a budget they will not keep.
 *
 * It still posts as an ordinary form, so it works if the island never hydrates.
 */
export default function AvailabilityEditor({ initial }: Props) {
  const [minutes, setMinutes] = useState<number[]>(() => WEEKDAYS.map((_, index) => initial[index] ?? 0));

  const total = useMemo(() => minutes.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0), [minutes]);

  function update(index: number, raw: string) {
    const parsed = Number.parseInt(raw, 10);
    setMinutes((current) => current.map((value, i) => (i === index ? (Number.isNaN(parsed) ? 0 : parsed) : value)));
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {WEEKDAYS.map((day, index) => {
          const value = Number.isFinite(minutes[index]) ? minutes[index] : 0;
          const free = value === 0;

          return (
            <label key={day} className="flex flex-col gap-1.5">
              <span className="text-ink-faint text-[11px] font-medium tracking-wide uppercase">
                {WEEKDAYS_SHORT[index]}
              </span>
              <input
                type="number"
                inputMode="numeric"
                name={`day-${index}`}
                min={0}
                max={1440}
                step={1}
                value={value}
                onChange={(event) => {
                  update(index, event.target.value);
                }}
                aria-label={`${day} — minuty`}
                data-testid={`availability-${index}`}
                className={`tnum focus:border-brand w-full rounded-[10px] border px-2.5 py-2 text-sm transition-colors focus:outline-none ${
                  free ? "border-line bg-sunken text-ink-faint" : "border-line bg-raised text-ink"
                }`}
              />
            </label>
          );
        })}
      </div>

      <p className="text-ink-muted mt-4 text-sm">
        {"To razem "}
        <strong data-testid="availability-total" className="tnum text-ink font-semibold">
          {formatHours(total)}
        </strong>
        {" tygodniowo. Dzień zostawiony na zerze nigdy nie jest planowany."}
      </p>
    </div>
  );
}
