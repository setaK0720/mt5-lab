import { useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  symbols: string[];
}

export function SymbolSelect({ value, onChange, symbols }: Props) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(value);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [value]);

  const filtered = query
    ? symbols.filter((s) => s.toLowerCase().includes(query.toLowerCase()))
    : symbols;

  function handleSelect(s: string) {
    onChange(s);
    setQuery(s);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      setQuery(value);
    } else if (e.key === "Enter" && filtered.length > 0) {
      handleSelect(filtered[0]);
    }
  }

  return (
    <div ref={ref} className="symbol-select">
      <input
        type="text"
        value={query}
        autoComplete="off"
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="シンボル..."
      />
      {open && filtered.length > 0 && (
        <ul className="symbol-dropdown">
          {filtered.slice(0, 60).map((s) => (
            <li
              key={s}
              onMouseDown={() => handleSelect(s)}
              className={`symbol-option${s === value ? " symbol-option-active" : ""}`}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
