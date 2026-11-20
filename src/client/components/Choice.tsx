import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";

/** A select over a short list of labelled values. */
export function Choice({
  id,
  testId,
  items,
  value,
  onChange,
  placeholder,
  className = "w-full",
  label,
}: {
  id?: string;
  testId?: string;
  items: { value: string; label: string }[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
}) {
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onChange(next as string);
      }}
    >
      <SelectTrigger id={id} data-testid={testId} className={className} aria-label={label}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
