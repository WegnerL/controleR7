import { useState, useRef, useEffect, KeyboardEvent } from "react";
import type React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface EditableCellProps {
  value: string | number | null | undefined;
  onSave: (value: string) => void;
  type?: "text" | "number";
  className?: string;
  formatter?: (v: string | number | null | undefined) => string;
  placeholder?: string;
  /** Conteúdo customizado exibido no modo de visualização (string ou JSX) */
  displayValue?: React.ReactNode;
}

export function EditableCell({
  value,
  onSave,
  type = "text",
  className,
  formatter,
  placeholder = "-",
  displayValue,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const display = displayValue !== undefined
    ? displayValue
    : formatter ? formatter(value) : (value !== null && value !== undefined && value !== "" ? String(value) : placeholder);

  function startEdit() {
    setDraft(value !== null && value !== undefined ? String(value) : "");
    setEditing(true);
  }

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    setEditing(false);
    if (draft !== String(value ?? "")) {
      onSave(draft);
    }
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") setEditing(false);
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKey}
        className={cn("h-7 text-xs px-1.5 bg-input border-primary", className)}
        step={type === "number" ? "0.01" : undefined}
      />
    );
  }

  return (
    <span
      onClick={startEdit}
      className={cn(
        "block cursor-pointer rounded px-1 py-0.5 text-xs hover:bg-accent transition-colors min-w-[40px]",
        (displayValue === undefined && (value === null || value === undefined || value === "")) ? "text-muted-foreground" : "",
        className
      )}
      title="Clique para editar"
    >
      {display}
    </span>
  );
}
