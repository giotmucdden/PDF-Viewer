import { useState, useMemo } from "react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toDateStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function todayStr() {
  const d = new Date();
  return toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
}

export default function Calendar({ setlists = [], selectedDate, onSelectDate, compact }) {
  const today = todayStr();
  const initial = selectedDate || today;
  const [year, setYear] = useState(Number(initial.slice(0, 4)));
  const [month, setMonth] = useState(Number(initial.slice(5, 7)) - 1);

  // Group setlists by date for dot indicators
  const setlistsByDate = useMemo(() => {
    const map = {};
    for (const sl of setlists) {
      const d = sl.date || "";
      if (!map[d]) map[d] = [];
      map[d].push(sl);
    }
    return map;
  }, [setlists]);

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const goToday = () => {
    const d = new Date();
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    onSelectDate?.(today);
  };

  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  return (
    <div className={`cal ${compact ? "cal-compact" : ""}`}>
      <div className="cal-header">
        <button className="cal-nav" onClick={prevMonth}>‹</button>
        <button className="cal-month-label" onClick={goToday}>
          {MONTHS[month]} {year}
        </button>
        <button className="cal-nav" onClick={nextMonth}>›</button>
      </div>

      <div className="cal-days">
        {DAYS.map((d) => (
          <div key={d} className="cal-day-name">{d}</div>
        ))}
      </div>

      <div className="cal-grid">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} className="cal-cell empty" />;

          const dateStr = toDateStr(year, month, day);
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDate;
          const count = (setlistsByDate[dateStr] || []).length;

          return (
            <div
              key={dateStr}
              className={`cal-cell ${isToday ? "today" : ""} ${isSelected ? "selected" : ""} ${count > 0 ? "has-events" : ""}`}
              onClick={() => onSelectDate?.(dateStr)}
            >
              <span className="cal-day-num">{day}</span>
              {count > 0 && (
                <div className="cal-dots">
                  {count <= 3
                    ? Array.from({ length: count }).map((_, j) => (
                        <span key={j} className="cal-dot" />
                      ))
                    : <span className="cal-count">{count}</span>
                  }
                </div>
              )}
            </div>
          );
        })}
      </div>

      <input type="hidden" data-month-key={monthKey} />
    </div>
  );
}

Calendar.todayStr = todayStr;
Calendar.getMonthKey = (dateStr) => dateStr?.slice(0, 7) || "";
