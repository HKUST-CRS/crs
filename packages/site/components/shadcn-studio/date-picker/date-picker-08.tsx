import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type TimePickerProps = {
  id: string;
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

export function TimePicker({
  id,
  label,
  value,
  defaultValue,
  onChange,
  disabled,
  className,
}: TimePickerProps) {
  const inputValue = value === undefined ? { defaultValue } : { value };

  return (
    <div className={cn("flex w-full max-w-xs flex-col gap-2", className)}>
      <Label htmlFor={id} className="px-1">
        {label}
      </Label>
      <Input
        {...inputValue}
        type="time"
        id={id}
        step="1"
        disabled={disabled}
        onChange={(event) => onChange?.(event.currentTarget.value)}
        className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
      />
    </div>
  );
}

const DatePickerDemo = () => {
  return (
    <TimePicker id="time-picker" label="Time input" defaultValue="08:30:00" />
  );
};

export default DatePickerDemo;
