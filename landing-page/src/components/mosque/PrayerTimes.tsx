import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  AlertTriangle,
  CloudSun,
  Coffee,
  MapPin,
  Moon,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import apiService from "@/lib/api";
import { toBnNumber, useLang } from "@/lib/i18n";

type Prayer = {
  key: string;
  apiName: string;
  start: string;
  jamaat: string;
  end: string;
  icon: ComponentType<{ className?: string }>;
};

type ForbiddenTime = { key: "sunrise" | "zawal" | "sunset"; start: string; end: string };

const DEFAULT_PRAYERS: Prayer[] = [
  {
    key: "prayer.fajr",
    apiName: "Fajr",
    start: "04:30",
    jamaat: "04:30",
    end: "05:45",
    icon: Sunrise,
  },
  {
    key: "prayer.dhuhr",
    apiName: "Dhuhr",
    start: "12:05",
    jamaat: "12:15",
    end: "15:40",
    icon: Sun,
  },
  {
    key: "prayer.asr",
    apiName: "Asr",
    start: "15:45",
    jamaat: "15:45",
    end: "18:20",
    icon: CloudSun,
  },
  {
    key: "prayer.maghrib",
    apiName: "Maghrib",
    start: "18:25",
    jamaat: "18:25",
    end: "19:50",
    icon: Sunset,
  },
  {
    key: "prayer.isha",
    apiName: "Isha",
    start: "19:55",
    jamaat: "19:55",
    end: "04:15",
    icon: Moon,
  },
];

const DEFAULT_FORBIDDEN: ForbiddenTime[] = [
  { key: "sunrise", start: "05:48", end: "06:08" },
  { key: "zawal", start: "11:55", end: "12:05" },
  { key: "sunset", start: "18:15", end: "18:25" },
];

function parseTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function displayTime(value: string, lang: "bn" | "en") {
  const [hours, minutes] = value.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const time = `${hours % 12 || 12}:${minutes.toString().padStart(2, "0")}`;
  return `${toBnNumber(time, lang)} ${period}`;
}

export function PrayerTimes() {
  const { t, lang } = useLang();
  const [now, setNow] = useState(new Date());
  const [hijriDate, setHijriDate] = useState("17 Dhul-Hijjah 1447");
  const [prayers, setPrayers] = useState(DEFAULT_PRAYERS);
  const [fasting, setFasting] = useState({ sahriEnd: "04:20", iftar: "18:25" });
  const [forbidden, setForbidden] = useState(DEFAULT_FORBIDDEN);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    apiService
      .getPrayerTimes()
      .then((response) => {
        if (response.hijriDate) setHijriDate(response.hijriDate);
        if (response.fasting) setFasting(response.fasting);
        if (response.forbidden?.length) setForbidden(response.forbidden);
        if (response.prayers?.length) {
          setPrayers((current) =>
            current.map((prayer) => {
              const received = response.prayers.find(
                (item: { name: string }) =>
                  item.name.toLowerCase() === prayer.apiName.toLowerCase(),
              );
              return received
                ? {
                    ...prayer,
                    start: received.start ?? received.time ?? prayer.start,
                    jamaat: received.jamaat ?? received.time ?? prayer.jamaat,
                    end: received.end ?? prayer.end,
                  }
                : prayer;
            }),
          );
        }
      })
      .catch((error) => console.error("Failed to load prayer schedule:", error));
  }, []);

  const { nextIndex, countdown } = useMemo(() => {
    let nextIndex = prayers.findIndex((prayer) => parseTime(prayer.jamaat) > now);
    if (nextIndex < 0) nextIndex = 0;
    const nextTime = parseTime(prayers[nextIndex].jamaat);
    if (nextIndex === 0 && nextTime <= now) nextTime.setDate(nextTime.getDate() + 1);
    const difference = Math.max(0, nextTime.getTime() - now.getTime());
    const hours = Math.floor(difference / 3_600_000);
    const minutes = Math.floor((difference % 3_600_000) / 60_000);
    const seconds = Math.floor((difference % 60_000) / 1_000);
    return {
      nextIndex,
      countdown: [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":"),
    };
  }, [now, prayers]);

  const copy = {
    schedule: lang === "bn" ? "আজকের ইবাদতের সময়সূচি" : "Today's worship schedule",
    start: lang === "bn" ? "ওয়াক্ত শুরু" : "Waqt starts",
    jamaat: lang === "bn" ? "জামাত" : "Jamaat",
    end: lang === "bn" ? "ওয়াক্ত শেষ" : "Waqt ends",
    sahri: lang === "bn" ? "সাহরির শেষ সময়" : "Sahri ends",
    iftar: lang === "bn" ? "ইফতারের সময়" : "Iftar time",
    forbidden: lang === "bn" ? "নামাজের নিষিদ্ধ সময়" : "Prohibited prayer times",
    warning:
      lang === "bn"
        ? "এই সময়গুলোতে নফল বা সাধারণ নামাজ আদায় করবেন না। স্থানীয় আলেমের নির্দেশনা অনুসরণ করুন।"
        : "Avoid voluntary or general prayer during these periods. Follow guidance from your local imam.",
  };

  const forbiddenLabels = {
    sunrise: lang === "bn" ? "সূর্যোদয়ের সময়" : "During sunrise",
    zawal: lang === "bn" ? "ঠিক দ্বিপ্রহর (যাওয়াল)" : "At solar noon (Zawal)",
    sunset: lang === "bn" ? "সূর্যাস্তের সময়" : "During sunset",
  };

  return (
    <section id="prayer" className="overflow-hidden px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 grid items-end gap-5 md:grid-cols-[1fr_auto]">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-primary">
              {copy.schedule}
            </p>
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("prayer.title")}</h2>
            <p className="mt-3 font-semibold text-gold">{toBnNumber(hijriDate, lang)}</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm">
            <MapPin className="h-4 w-4 text-primary" /> {t("brand.name")}
          </div>
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-[1.45fr_.55fr]">
          <Card className="relative overflow-hidden border-0 bg-hero text-primary-foreground shadow-elegant">
            <div className="absolute inset-0 opacity-10 arabic-pattern" />
            <div className="relative grid h-full items-center gap-8 p-7 sm:p-9 md:grid-cols-[1fr_auto] lg:p-11">
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] opacity-70">
                  {t("prayer.next")}
                </p>
                <h3 className="text-5xl font-bold sm:text-6xl">{t(prayers[nextIndex].key)}</h3>
                <p className="mt-2 text-2xl font-semibold text-gold">
                  {displayTime(prayers[nextIndex].jamaat, lang)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-5 text-center backdrop-blur-md sm:min-w-64">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] opacity-70">
                  {t("prayer.in")}
                </p>
                <div className="font-mono text-3xl font-bold tabular-nums sm:text-4xl">
                  {toBnNumber(countdown, lang)}
                </div>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
            <FastingCard
              icon={Coffee}
              label={copy.sahri}
              time={displayTime(fasting.sahriEnd, lang)}
              tone="teal"
            />
            <FastingCard
              icon={Sparkles}
              label={copy.iftar}
              time={displayTime(fasting.iftar, lang)}
              tone="gold"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {prayers.map((prayer, index) => {
            const Icon = prayer.icon;
            const isNext = index === nextIndex;
            return (
              <Card
                key={prayer.key}
                className={`p-5 transition hover:-translate-y-1 hover:shadow-card ${isNext ? "border-primary/60 bg-primary/8 ring-1 ring-primary/15" : "border-border bg-card"}`}
              >
                <div className="mb-5 flex items-center justify-between">
                  <span
                    className={`grid h-10 w-10 place-items-center rounded-xl ${isNext ? "bg-primary text-primary-foreground" : "bg-accent text-primary"}`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  {isNext && (
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                      Next
                    </span>
                  )}
                </div>
                <h3 className="mb-4 text-xl font-bold">{t(prayer.key)}</h3>
                <TimeRow label={copy.start} value={displayTime(prayer.start, lang)} />
                <TimeRow label={copy.jamaat} value={displayTime(prayer.jamaat, lang)} strong />
                <TimeRow label={copy.end} value={displayTime(prayer.end, lang)} />
              </Card>
            );
          })}
        </div>

        <Card className="mt-6 overflow-hidden border-amber-500/25 bg-amber-500/6">
          <div className="grid gap-6 p-6 lg:grid-cols-[.8fr_2fr] lg:p-8">
            <div>
              <span className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <h3 className="text-2xl font-bold">{copy.forbidden}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy.warning}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {forbidden.map((period) => (
                <div
                  key={period.key}
                  className="rounded-2xl border border-amber-500/20 bg-card/75 p-4"
                >
                  <p className="text-sm font-bold">{forbiddenLabels[period.key]}</p>
                  <p className="mt-2 font-mono text-sm font-semibold text-amber-700 dark:text-amber-300">
                    {displayTime(period.start, lang)} – {displayTime(period.end, lang)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
          {lang === "bn"
            ? "সময় ঋতু ও অবস্থান অনুযায়ী পরিবর্তিত হয়। মসজিদের সর্বশেষ সময়সূচি অনুসরণ করুন।"
            : "Times change by season and location. Always follow the latest timetable published by the mosque."}
        </p>
      </div>
    </section>
  );
}

function TimeRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-t border-border/70 py-2.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-bold text-primary" : "font-semibold"}>{value}</span>
    </div>
  );
}

function FastingCard({
  icon: Icon,
  label,
  time,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  time: string;
  tone: "teal" | "gold";
}) {
  const classes =
    tone === "gold"
      ? "border-gold/30 bg-gold/10 text-gold"
      : "border-primary/25 bg-primary/8 text-primary";
  return (
    <Card className={`flex items-center gap-4 p-5 ${classes}`}>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-current/10">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider opacity-75">{label}</p>
        <p className="mt-1 text-xl font-bold text-foreground">{time}</p>
      </div>
    </Card>
  );
}
