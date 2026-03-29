"use client";

import * as RadixSelect from "@radix-ui/react-select";
import { CaretDown, Check } from "@phosphor-icons/react";
import { cn } from "../utils";

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

function Select({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  label,
  error,
  disabled,
  className,
}: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-[var(--foreground)]">
          {label}
        </label>
      )}
      <RadixSelect.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <RadixSelect.Trigger
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-[var(--radius-sm)] border bg-transparent px-3 text-sm outline-none transition-colors",
            "text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]",
            "focus:border-[var(--ring)] focus:ring-1 focus:ring-[var(--ring)]",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error ? "border-[var(--destructive)]" : "border-[var(--input)]",
            className
          )}
        >
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon>
            <CaretDown size={16} className="text-[var(--muted-foreground)]" />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content
            className="z-[100] max-h-[300px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--popover)] shadow-[var(--shadow-lg)]"
            position="popper"
            sideOffset={4}
          >
            <RadixSelect.Viewport className="p-1">
              {options
                .filter((opt) => opt.value !== "")
                .map((opt) => (
                  <RadixSelect.Item
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                    className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors hover:bg-[var(--accent)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                  >
                    <RadixSelect.ItemIndicator>
                      <Check size={14} weight="bold" className="text-[var(--primary)]" />
                    </RadixSelect.ItemIndicator>
                    <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                  </RadixSelect.Item>
                ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
      {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}
    </div>
  );
}

export { Select, type SelectOption };