import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const inputBase =
  "w-full rounded-[10px] border bg-raised px-3 py-2.5 pl-10 text-sm text-ink placeholder-ink-faint transition-colors focus:outline-none";

interface FormFieldProps {
  id: string;
  name?: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  hint?: ReactNode;
  icon: ReactNode;
  endContent?: ReactNode;
}

export function FormField({
  id,
  name,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  hint,
  icon,
  endContent,
}: FormFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="text-ink-faint mb-1.5 block text-[11px] font-medium tracking-wide uppercase">
        {label}
      </label>
      <div className="relative">
        <span className="text-ink-faint absolute top-1/2 left-3 size-4 -translate-y-1/2">{icon}</span>
        <input
          id={id}
          name={name ?? id}
          type={type}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          className={cn(inputBase, error ? "border-danger focus:border-danger" : "border-line focus:border-brand")}
        />
        {endContent}
      </div>
      {error ? (
        <p className="text-danger mt-1.5 flex items-center gap-1 text-xs">
          <CircleAlert className="size-3 shrink-0" />
          {error}
        </p>
      ) : (
        hint
      )}
    </div>
  );
}
