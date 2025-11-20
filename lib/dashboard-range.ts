const MS_PER_DAY = 24 * 60 * 60 * 1000;
const BA_TIMEZONE_OFFSET = "-03:00";

type PlainDate = {
  year: number;
  month: number;
  day: number;
};

export type DashboardPeriod =
  | "day"
  | "week"
  | "month"
  | "quarter"
  | "semester"
  | "year"
  | "custom";

export type DashboardRange = {
  start: string;
  end: string;
};

export type DashboardRangeResult = DashboardRange & {
  period: DashboardPeriod;
  label: string;
};

export type DashboardRangeOptions = {
  referenceDate?: Date;
  customRange?: { start: string; end: string };
};

const RANGE_LABELS: Record<Exclude<DashboardPeriod, "custom">, string> = {
  day: "Hoy",
  week: "Esta semana",
  month: "Mes en curso",
  quarter: "Trimestre en curso",
  semester: "Semestre en curso",
  year: "Año en curso",
};

const getPlainDateInBuenosAires = (reference: Date = new Date()): PlainDate => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(reference);
  const getValue = (type: string) => parts.find(p => p.type === type)?.value ?? "";

  return {
    year: Number(getValue("year")),
    month: Number(getValue("month")),
    day: Number(getValue("day")),
  };
};

const toUTCDate = ({ year, month, day }: PlainDate) =>
  new Date(Date.UTC(year, month - 1, day));

const shiftDays = (plainDate: PlainDate, delta: number): PlainDate => {
  const shifted = new Date(toUTCDate(plainDate).getTime() + delta * MS_PER_DAY);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
};

const formatDateWithOffset = (plainDate: PlainDate, endOfDay = false) => {
  const pad = (value: number, length = 2) => String(value).padStart(length, "0");
  const time = endOfDay ? "23:59:59.999" : "00:00:00.000";
  return `${plainDate.year}-${pad(plainDate.month)}-${pad(plainDate.day)}T${time}${BA_TIMEZONE_OFFSET}`;
};

const startOfWeek = (plainDate: PlainDate): PlainDate => {
  const jsDate = toUTCDate(plainDate);
  const day = jsDate.getUTCDay();
  const delta = day === 0 ? -6 : 1 - day;
  return shiftDays(plainDate, delta);
};

const endOfWeek = (plainDate: PlainDate): PlainDate =>
  shiftDays(startOfWeek(plainDate), 6);

const startOfMonth = (plainDate: PlainDate): PlainDate => ({
  year: plainDate.year,
  month: plainDate.month,
  day: 1,
});

const endOfMonth = (plainDate: PlainDate): PlainDate => {
  const jsDate = new Date(Date.UTC(plainDate.year, plainDate.month, 0));
  return {
    year: jsDate.getUTCFullYear(),
    month: jsDate.getUTCMonth() + 1,
    day: jsDate.getUTCDate(),
  };
};

const startOfQuarter = (plainDate: PlainDate): PlainDate => {
  const startMonth = Math.floor((plainDate.month - 1) / 3) * 3 + 1;
  return { year: plainDate.year, month: startMonth, day: 1 };
};

const endOfQuarter = (plainDate: PlainDate): PlainDate => {
  const start = startOfQuarter(plainDate);
  const endMonth = start.month + 2;
  const jsDate = new Date(Date.UTC(start.year, endMonth, 0));
  return {
    year: jsDate.getUTCFullYear(),
    month: jsDate.getUTCMonth() + 1,
    day: jsDate.getUTCDate(),
  };
};

const startOfSemester = (plainDate: PlainDate): PlainDate => {
  const startMonth = plainDate.month <= 6 ? 1 : 7;
  return { year: plainDate.year, month: startMonth, day: 1 };
};

const endOfSemester = (plainDate: PlainDate): PlainDate => {
  const start = startOfSemester(plainDate);
  const endMonth = start.month + 5;
  const jsDate = new Date(Date.UTC(start.year, endMonth, 0));
  return {
    year: jsDate.getUTCFullYear(),
    month: jsDate.getUTCMonth() + 1,
    day: jsDate.getUTCDate(),
  };
};

const startOfYear = (plainDate: PlainDate): PlainDate => ({
  year: plainDate.year,
  month: 1,
  day: 1,
});

const endOfYear = (plainDate: PlainDate): PlainDate => ({
  year: plainDate.year,
  month: 12,
  day: 31,
});

const parseCustomDate = (value: string): PlainDate | null => {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
};

export const getDashboardRange = (
  period: DashboardPeriod,
  options: DashboardRangeOptions = {},
): DashboardRangeResult => {
  const baseDate = getPlainDateInBuenosAires(options.referenceDate);

  if (period === "custom") {
    const { customRange } = options;
    const startDate = customRange?.start ? parseCustomDate(customRange.start) : null;
    const endDate = customRange?.end ? parseCustomDate(customRange.end) : null;

    if (!startDate || !endDate) {
      throw new Error("Debe proporcionar fechas de inicio y fin válidas para el periodo personalizado");
    }

    if (toUTCDate(startDate) > toUTCDate(endDate)) {
      throw new Error("La fecha de inicio no puede ser posterior a la fecha de fin");
    }

    const safeRange = customRange!;

    return {
      period,
      label: `${safeRange.start} – ${safeRange.end}`,
      start: formatDateWithOffset(startDate, false),
      end: formatDateWithOffset(endDate, true),
    };
  }

  let startDate: PlainDate;
  let endDate: PlainDate;

  switch (period) {
    case "day":
      startDate = baseDate;
      endDate = baseDate;
      break;
    case "week":
      startDate = startOfWeek(baseDate);
      endDate = endOfWeek(baseDate);
      break;
    case "month":
      startDate = startOfMonth(baseDate);
      endDate = endOfMonth(baseDate);
      break;
    case "quarter":
      startDate = startOfQuarter(baseDate);
      endDate = endOfQuarter(baseDate);
      break;
    case "semester":
      startDate = startOfSemester(baseDate);
      endDate = endOfSemester(baseDate);
      break;
    case "year":
      startDate = startOfYear(baseDate);
      endDate = endOfYear(baseDate);
      break;
    default:
      startDate = baseDate;
      endDate = baseDate;
  }

  return {
    period,
    label: RANGE_LABELS[period as Exclude<DashboardPeriod, "custom">],
    start: formatDateWithOffset(startDate, false),
    end: formatDateWithOffset(endDate, true),
  };
};
