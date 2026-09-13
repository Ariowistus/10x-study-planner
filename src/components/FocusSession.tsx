import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Check } from "lucide-react";

interface Props {
  id: string;
  title: string;
  date: string;
  minutes: number;
  weekStart: string;
}

/** The timer is a local aid. Only an explicit form submission records progress. */
export default function FocusSession({ id, title, date, minutes, weekStart }: Props) {
  const duration = Math.min(minutes, 25) * 60;
  const [remaining, setRemaining] = useState(duration);
  const [running, setRunning] = useState(false);
  const deadline = useRef(0);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const next = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0) setRunning(false);
    };
    const interval = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [running]);

  function toggle() {
    if (running) {
      setRemaining(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
      setRunning(false);
    } else {
      const seconds = remaining === 0 ? duration : remaining;
      deadline.current = Date.now() + seconds * 1000;
      setRemaining(seconds);
      setRunning(true);
    }
  }

  return (
    <section className="focus-panel" aria-label="Najbliższa sesja nauki">
      <div className="min-w-0 flex-1">
        <p className="text-brand text-sm font-medium">Następny krok · {date}</p>
        <h2 className="mt-3 text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">{title}</h2>
        <p className="text-ink-muted mt-3 max-w-sm text-sm leading-relaxed">
          W planie: {minutes} min. Zacznij od {Math.min(minutes, 25)} minut skupienia. Jedna rzecz naraz.
        </p>
        <form method="POST" action={`/api/sessions/${id}`} className="mt-5">
          <input type="hidden" name="status" value="done" />
          <input type="hidden" name="week" value={weekStart} />
          <button type="submit" className="focus-complete">
            <Check size={16} aria-hidden="true" /> Zakończ sesję ({minutes} min)
          </button>
        </form>
      </div>
      <div className="focus-clock">
        <p className="text-ink-faint text-xs">Skupienie</p>
        <p role="timer" aria-label="Pozostały czas skupienia" className="tnum my-2 font-mono text-5xl tracking-tight">
          {String(Math.floor(remaining / 60)).padStart(2, "0")}:{String(remaining % 60).padStart(2, "0")}
        </p>
        <div className="flex items-center justify-center gap-2">
          <button type="button" onClick={toggle} className="timer-toggle">
            {running ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
            {running ? "Pauza" : remaining === 0 ? "Jeszcze raz" : "Start"}
          </button>
          <button
            type="button"
            aria-label="Resetuj minutnik"
            className="timer-reset"
            onClick={() => {
              setRunning(false);
              setRemaining(duration);
            }}
          >
            <RotateCcw size={16} aria-hidden="true" />
          </button>
        </div>
        <p role="status" className="text-ink-muted mt-3 min-h-8 max-w-48 text-xs leading-relaxed">
          {remaining === 0
            ? "Czas na przerwę. Zapisz sesję, gdy skończysz cały zaplanowany czas."
            : "Minutnik działa do opuszczenia strony."}
        </p>
      </div>
    </section>
  );
}
