import type { DateRange } from '../types/index.js';

interface DateRangePickerProps {
  dateRange: DateRange;
  onChange: (range: DateRange) => void;
}

const PRESETS: Array<{ label: string; days: number }> = [
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
];

export function DateRangePicker({ dateRange, onChange }: DateRangePickerProps) {
  const setPreset = (days: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    onChange({
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    });
  };

  return (
    <div className="date-range-picker">
      <div className="date-inputs">
        <label>
          From
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) =>
              onChange({ ...dateRange, startDate: e.target.value })
            }
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) =>
              onChange({ ...dateRange, endDate: e.target.value })
            }
          />
        </label>
      </div>
      <div className="date-presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.days}
            className="btn btn-small"
            onClick={() => setPreset(preset.days)}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
