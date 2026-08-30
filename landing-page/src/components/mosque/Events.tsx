import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useLang, toBnNumber } from "@/lib/i18n";
import apiService from "@/lib/api";

const monthsEn = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const monthsBn = [
  "জানু",
  "ফেব্রু",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টে",
  "অক্টো",
  "নভে",
  "ডিসে",
];

const categoryColors: Record<string, string> = {
  Regular: "bg-success text-success-foreground",
  Education: "bg-warning text-white",
  Community: "bg-primary text-primary-foreground",
  Meeting: "bg-gold text-gold-foreground",
};

const categoryLabels: Record<string, { bn: string; en: string }> = {
  Regular: { bn: "নিয়মিত", en: "Regular" },
  Education: { bn: "শিক্ষা", en: "Education" },
  Community: { bn: "সম্প্রদায়", en: "Community" },
  Meeting: { bn: "সভা", en: "Meeting" },
};

type MosqueEvent = {
  id?: number;
  occurrence_key?: string;
  occurrence_index?: number;
  event_date: string;
  event_time: string;
  end_time?: string;
  category: string;
  title_bn?: string;
  title_en?: string;
  description_bn?: string;
  description_en?: string;
  location?: string;
};

function normalizedEventDate(value: string) {
  const raw = String(value || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(raw));
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function Events() {
  const { t, lang } = useLang();
  const [events, setEvents] = useState<MosqueEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<MosqueEvent | null>(null);
  const [calendarQuery, setCalendarQuery] = useState("");
  const [calendarCategory, setCalendarCategory] = useState("all");
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );

  useEffect(() => {
    apiService
      .getEvents()
      .then((res) => {
        if (res && res.events) {
          const sortedEvents = [...res.events].sort(
            (a, b) =>
              normalizedEventDate(a.event_date).localeCompare(normalizedEventDate(b.event_date)) ||
              String(a.event_time).localeCompare(String(b.event_time)),
          );
          setEvents(sortedEvents);
          const now = new Date();
          const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
          const todayKey = normalizedEventDate(now.toISOString());
          const openingEvent =
            sortedEvents.find(
              (event) => normalizedEventDate(event.event_date).slice(0, 7) === currentMonthKey,
            ) ||
            sortedEvents.find((event) => normalizedEventDate(event.event_date) >= todayKey) ||
            sortedEvents[sortedEvents.length - 1];
          if (openingEvent) {
            const [year, month] = normalizedEventDate(openingEvent.event_date)
              .slice(0, 7)
              .split("-")
              .map(Number);
            if (year && month) setCalendarMonth(new Date(year, month - 1, 1));
          }
        }
      })
      .catch((err) => console.error("Failed to fetch events:", err));
  }, []);

  const calendarYear = calendarMonth.getFullYear();
  const calendarMonthIndex = calendarMonth.getMonth();
  const firstWeekday = new Date(calendarYear, calendarMonthIndex, 1).getDay();
  const daysInMonth = new Date(calendarYear, calendarMonthIndex + 1, 0).getDate();
  const calendarCells = Array.from(
    { length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 },
    (_, index) => {
      const day = index - firstWeekday + 1;
      return day >= 1 && day <= daysInMonth ? day : null;
    },
  );
  const dateKey = (year: number, month: number, day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const categoryOptions = [...new Set(events.map((event) => event.category).filter(Boolean))];
  const queryNeedle = calendarQuery.trim().toLocaleLowerCase();
  const filteredCalendarEvents = events.filter((event) => {
    const matchesCategory = calendarCategory === "all" || event.category === calendarCategory;
    const searchable =
      `${event.title_bn || ""} ${event.title_en || ""} ${event.description_bn || ""} ${event.description_en || ""} ${event.location || ""}`.toLocaleLowerCase();
    return matchesCategory && (!queryNeedle || searchable.includes(queryNeedle));
  });
  const eventsForDay = (day: number) =>
    filteredCalendarEvents.filter(
      (event) =>
        normalizedEventDate(event.event_date) === dateKey(calendarYear, calendarMonthIndex, day),
    );
  const monthEvents = filteredCalendarEvents
    .filter(
      (event) =>
        normalizedEventDate(event.event_date).slice(0, 7) ===
        `${calendarYear}-${String(calendarMonthIndex + 1).padStart(2, "0")}`,
    )
    .sort(
      (a, b) =>
        normalizedEventDate(a.event_date).localeCompare(normalizedEventDate(b.event_date)) ||
        String(a.event_time).localeCompare(String(b.event_time)),
    );
  const today = new Date();
  const todayKey = normalizedEventDate(today.toISOString());
  const eventsBySource = new Map<string, MosqueEvent[]>();
  events.forEach((event) => {
    const sourceKey =
      event.id != null
        ? `event-${event.id}`
        : event.occurrence_key || `${event.title_en || event.title_bn}:${event.event_date}`;
    const group = eventsBySource.get(sourceKey) || [];
    group.push(event);
    eventsBySource.set(sourceKey, group);
  });
  const displayedEvents = [...eventsBySource.values()]
    .map((group) => {
      const ordered = [...group].sort((a, b) =>
        normalizedEventDate(a.event_date).localeCompare(normalizedEventDate(b.event_date)),
      );
      return (
        ordered.find((event) => normalizedEventDate(event.event_date) >= todayKey) ||
        ordered[ordered.length - 1]
      );
    })
    .sort((a, b) => {
      const aDate = normalizedEventDate(a.event_date);
      const bDate = normalizedEventDate(b.event_date);
      const aUpcoming = aDate >= todayKey;
      const bUpcoming = bDate >= todayKey;
      if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
      return aUpcoming ? aDate.localeCompare(bDate) : bDate.localeCompare(aDate);
    })
    .slice(0, 4);
  const weekdays =
    lang === "bn"
      ? ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহস্পতি", "শুক্র", "শনি"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const eventTimeLabel = (event: MosqueEvent) => {
    const start = toBnNumber(String(event.event_time).slice(0, 5), lang);
    const end = event.end_time ? toBnNumber(String(event.end_time).slice(0, 5), lang) : "";
    return end ? `${start}–${end}` : start;
  };

  return (
    <section id="events" className="px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-primary">
              Community calendar
            </p>
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("ev.title")}</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">{t("ev.subtitle")}</p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="rounded-full border-primary/35 bg-card px-5 text-primary hover:bg-primary hover:text-primary-foreground"
              >
                <Calendar className="w-4 h-4 mr-2" /> {t("ev.viewfull")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[92vh] max-w-6xl overflow-hidden p-0">
              <DialogHeader className="border-b border-border/70 px-6 py-5 pr-12">
                <DialogTitle>
                  {lang === "bn" ? "সম্পূর্ণ অনুষ্ঠান ক্যালেন্ডার" : "Complete event calendar"}
                </DialogTitle>
                <DialogDescription>
                  {lang === "bn"
                    ? "মসজিদের সকল প্রকাশিত অনুষ্ঠান, সময় ও স্থান"
                    : "All published mosque events with their time and location"}
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[73vh] overflow-auto px-4 pb-5 sm:px-6">
                <div className="sticky left-0 z-10 mb-3 grid min-w-[720px] gap-2 bg-background py-2 sm:grid-cols-[1fr_220px_auto]">
                  <input
                    value={calendarQuery}
                    onChange={(event) => {
                      setCalendarQuery(event.target.value);
                      setSelectedEvent(null);
                    }}
                    className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                    placeholder={lang === "bn" ? "অনুষ্ঠান খুঁজুন..." : "Search events..."}
                    aria-label="Search events"
                  />
                  <select
                    value={calendarCategory}
                    onChange={(event) => {
                      setCalendarCategory(event.target.value);
                      setSelectedEvent(null);
                    }}
                    className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                    aria-label="Filter by category"
                  >
                    <option value="all">{lang === "bn" ? "সব বিভাগ" : "All categories"}</option>
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {categoryLabels[category]?.[lang] || category}
                      </option>
                    ))}
                  </select>
                  {(calendarQuery || calendarCategory !== "all") && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCalendarQuery("");
                        setCalendarCategory("all");
                        setSelectedEvent(null);
                      }}
                    >
                      {lang === "bn" ? "রিসেট" : "Reset"}
                    </Button>
                  )}
                </div>
                <div className="sticky left-0 mb-4 flex min-w-[720px] items-center justify-between rounded-xl bg-muted/60 p-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setCalendarMonth(new Date(calendarYear, calendarMonthIndex - 1, 1))
                    }
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <div className="text-center">
                    <strong className="block text-lg">
                      {lang === "bn"
                        ? `${monthsBn[calendarMonthIndex]} ${toBnNumber(String(calendarYear), lang)}`
                        : `${new Intl.DateTimeFormat("en", { month: "long" }).format(calendarMonth)} ${calendarYear}`}
                    </strong>
                    <button
                      className="text-xs text-primary hover:underline"
                      onClick={() =>
                        setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1))
                      }
                    >
                      {lang === "bn" ? "চলতি মাস" : "Current month"}
                    </button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setCalendarMonth(new Date(calendarYear, calendarMonthIndex + 1, 1))
                    }
                    aria-label="Next month"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
                <div className="min-w-[720px] overflow-hidden rounded-2xl border border-border">
                  <div className="grid grid-cols-7 bg-muted/70">
                    {weekdays.map((weekday, index) => (
                      <div
                        key={weekday}
                        className={`border-r border-border px-2 py-3 text-center text-xs font-bold last:border-r-0 ${index === 5 ? "text-primary" : "text-muted-foreground"}`}
                      >
                        {weekday}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 bg-border/60 gap-px">
                    {calendarCells.map((day, index) => {
                      if (!day)
                        return <div key={`empty-${index}`} className="min-h-28 bg-muted/30" />;
                      const dayEvents = eventsForDay(day);
                      const isToday =
                        today.getFullYear() === calendarYear &&
                        today.getMonth() === calendarMonthIndex &&
                        today.getDate() === day;
                      return (
                        <div
                          key={day}
                          className={`min-h-32 bg-background p-2 ${isToday ? "ring-2 ring-inset ring-primary" : ""}`}
                        >
                          <div
                            className={`mb-2 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${isToday ? "bg-primary text-primary-foreground" : "text-foreground"}`}
                          >
                            {toBnNumber(String(day), lang)}
                          </div>
                          <div className="space-y-1">
                            {dayEvents.map((event) => {
                              const title = lang === "bn" ? event.title_bn : event.title_en;
                              return (
                                <button
                                  type="button"
                                  key={
                                    event.occurrence_key ||
                                    `${event.id || title}:${event.event_date}`
                                  }
                                  className="w-full rounded-md border-0 border-l-4 border-primary bg-primary/10 px-2 py-1.5 text-left transition hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary"
                                  title={`${title} — ${eventTimeLabel(event)}`}
                                  onClick={() => setSelectedEvent(event)}
                                >
                                  <strong className="block text-[11px] leading-tight text-foreground">
                                    {title}
                                  </strong>
                                  <span className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {eventTimeLabel(event)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {selectedEvent && (
                  <div className="mt-4 min-w-[720px] rounded-2xl border border-primary/25 bg-primary/5 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge
                            className={
                              categoryColors[selectedEvent.category] ||
                              "bg-secondary text-secondary-foreground"
                            }
                          >
                            {categoryLabels[selectedEvent.category]?.[lang] ||
                              selectedEvent.category}
                          </Badge>
                          <span className="text-sm font-semibold text-primary">
                            {(() => {
                              const [, month, day] = normalizedEventDate(selectedEvent.event_date)
                                .split("-")
                                .map(Number);
                              return `${toBnNumber(String(day), lang)} ${lang === "bn" ? monthsBn[month - 1] : monthsEn[month - 1]}`;
                            })()}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-foreground">
                          {lang === "bn" ? selectedEvent.title_bn : selectedEvent.title_en}
                        </h3>
                        {(lang === "bn"
                          ? selectedEvent.description_bn
                          : selectedEvent.description_en) && (
                          <p className="mt-2 text-sm text-muted-foreground">
                            {lang === "bn"
                              ? selectedEvent.description_bn
                              : selectedEvent.description_en}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {eventTimeLabel(selectedEvent)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {selectedEvent.location || t("brand.name")}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="rounded-full p-2 text-muted-foreground hover:bg-background hover:text-foreground"
                        onClick={() => setSelectedEvent(null)}
                        aria-label="Close event details"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )}
                {monthEvents.length > 0 && (
                  <div className="min-w-[720px] mt-4 rounded-2xl border border-border bg-card">
                    <div className="border-b border-border px-4 py-3 font-bold">
                      {lang === "bn" ? "এই মাসের অনুষ্ঠানসমূহ" : "Events this month"}
                    </div>
                    <div className="divide-y divide-border">
                      {monthEvents.map((event) => {
                        const eventDate = new Date(
                          `${String(event.event_date).slice(0, 10)}T00:00:00`,
                        );
                        const title = lang === "bn" ? event.title_bn : event.title_en;
                        return (
                          <div
                            key={`agenda-${event.occurrence_key || `${event.id || title}:${event.event_date}`}`}
                            className="flex items-center gap-4 px-4 py-3"
                          >
                            <div className="w-16 shrink-0 text-center">
                              <strong className="block text-xl text-primary">
                                {toBnNumber(String(eventDate.getDate()), lang)}
                              </strong>
                              <small>
                                {lang === "bn"
                                  ? monthsBn[eventDate.getMonth()]
                                  : monthsEn[eventDate.getMonth()]}
                              </small>
                            </div>
                            <div className="min-w-0 flex-1">
                              <strong className="block text-foreground">{title}</strong>
                              <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  {eventTimeLabel(event)}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5" />
                                  {event.location || t("brand.name")}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {!filteredCalendarEvents.some((event) => {
                  const date = normalizedEventDate(event.event_date).slice(0, 7);
                  return (
                    date === `${calendarYear}-${String(calendarMonthIndex + 1).padStart(2, "0")}`
                  );
                }) && (
                  <p className="min-w-[720px] py-5 text-center text-sm text-muted-foreground">
                    {lang === "bn"
                      ? "এই মাসে কোনো প্রকাশিত অনুষ্ঠান নেই"
                      : "No published events this month"}
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {displayedEvents.length === 0 ? (
            <p className="text-center text-muted-foreground col-span-2 py-8">
              {lang === "bn" ? "কোন অনুষ্ঠান পাওয়া যায়নি" : "No upcoming events found"}
            </p>
          ) : (
            displayedEvents.map((e, i) => {
              const dateObj = new Date(`${normalizedEventDate(e.event_date)}T00:00:00`);
              const dayStr = String(dateObj.getDate());
              const monStr =
                lang === "bn" ? monthsBn[dateObj.getMonth()] : monthsEn[dateObj.getMonth()];
              const color = categoryColors[e.category] || "bg-secondary text-secondary-foreground";
              const catLabel = categoryLabels[e.category]
                ? categoryLabels[e.category][lang]
                : e.category;
              const title = lang === "bn" ? e.title_bn : e.title_en;
              const desc = lang === "bn" ? e.description_bn : e.description_en;

              return (
                <Card
                  key={i}
                  className="group overflow-hidden border-border/70 p-6 transition-all first:md:col-span-2 hover:-translate-y-1 hover:border-primary/30 hover:shadow-card"
                >
                  <div className="flex gap-5">
                    <div className="w-20 shrink-0 rounded-2xl bg-hero p-3 text-center text-primary-foreground shadow-card">
                      <div className="text-3xl font-bold font-display leading-none">
                        {toBnNumber(dayStr, lang)}
                      </div>
                      <div className="text-xs uppercase tracking-wider mt-1 opacity-90">
                        {monStr}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <Badge className={`${color} mb-2 hover:${color}`}>{catLabel}</Badge>
                      <h3 className="text-lg font-bold text-foreground mb-1">{title}</h3>
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{desc}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> {eventTimeLabel(e)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" /> {e.location || t("brand.name")}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
