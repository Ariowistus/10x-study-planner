import { useMemo, useState } from "react";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface Props {
  initial: number[];
}

function formatHours(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {WEEKDAYS.map((day, index) => (
          <label key={day} className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">{day.slice(0, 3)}</span>
            <input
              type="number"
              inputMode="numeric"
              name={`day-${index}`}
              min={0}
              max={1440}
              step={1}
              value={Number.isFinite(minutes[index]) ? minutes[index] : 0}
              onChange={(event) => {
                update(index, event.target.value);
              }}
              aria-label={`${day} minutes`}
              data-testid={`availability-${index}`}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-slate-900 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none"
            />
          </label>
        ))}
      </div>

      <p className="mt-4 text-sm text-slate-600">
        Weekly budget:{" "}
        <strong data-testid="availability-total" className="font-semibold text-slate-900">
          {formatHours(total)}
        </strong>
      </p>
    </div>
  );
}
