import { Input } from "@/components/ui/input";
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
    <Input
      {...inputValue}
      type="time"
      id={id}
      aria-label={label}
      step="1"
      disabled={disabled}
      onChange={(event) => onChange?.(event.currentTarget.value)}
      className={cn(
        "appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none",
        className,
      )}
    />
  );
}

const DatePickerDemo = () => {
  return (
    <TimePicker id="time-picker" label="Time input" defaultValue="08:30:00" />
  );
};

export default DatePickerDemo;
