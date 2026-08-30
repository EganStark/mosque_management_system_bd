import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Megaphone, Calendar, Users, ArrowRight } from "lucide-react";
import { useLang, toBnNumber } from "@/lib/i18n";
import apiService from "@/lib/api";

type Cat = "event" | "emergency" | "meeting" | "general";
type Announcement = {
  id?: number;
  category?: Cat;
  title_bn?: string;
  title_en?: string;
  content_bn?: string;
  content_en?: string;
  publish_date: string;
};

const catMeta: Record<Cat, { icon: typeof Megaphone; color: string; bg: string }> = {
  event: { icon: Calendar, color: "text-success", bg: "bg-success/10" },
  emergency: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
  meeting: { icon: Users, color: "text-primary", bg: "bg-primary/10" },
  general: { icon: Megaphone, color: "text-muted-foreground", bg: "bg-muted" },
};

export function Announcements() {
  const { t, lang } = useLang();
  const [filter, setFilter] = useState<"all" | Cat>("all");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    apiService
      .getAnnouncements("all", 10)
      .then((res) => {
        if (res && res.announcements) {
          setAnnouncements(res.announcements);
        }
      })
      .catch((err) => console.error("Failed to fetch announcements:", err));
  }, []);

  const tabs: Array<{ k: "all" | Cat; label: string }> = [
    { k: "all", label: t("ann.all") },
    { k: "event", label: t("ann.events") },
    { k: "emergency", label: t("ann.emergency") },
    { k: "meeting", label: t("ann.meetings") },
  ];

  const filtered =
    filter === "all" ? announcements : announcements.filter((a) => a.category === filter);

  // Sort emergencies to the top
  const sorted = [...filtered].sort((a, b) =>
    a.category === "emergency" ? -1 : b.category === "emergency" ? 1 : 0,
  );

  return (
    <section id="notices" className="px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-primary">
              Community bulletin
            </p>
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("ann.title")}</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            Important mosque updates, gatherings and community information in one clear place.
          </p>
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.k}
              onClick={() => setFilter(tab.k)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                filter === tab.k
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground/70 hover:bg-accent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {sorted.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {lang === "bn" ? "কোন ঘোষণা পাওয়া যায়নি" : "No announcements found"}
            </p>
          ) : (
            sorted.map((a, i) => {
              const catKey = (a.category || "general") as Cat;
              const meta = catMeta[catKey] || catMeta.general;
              const Icon = meta.icon;
              const isEmergency = catKey === "emergency";
              const title = lang === "bn" ? a.title_bn : a.title_en;
              const text = lang === "bn" ? a.content_bn : a.content_en;

              const dateObj = new Date(a.publish_date);
              let dateStr =
                lang === "bn"
                  ? dateObj.toLocaleDateString("bn-BD", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : dateObj.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    });

              if (lang === "bn") {
                dateStr = toBnNumber(dateStr, "bn");
              }

              return (
                <Card
                  key={a.id || i}
                  className={`group cursor-pointer p-6 transition hover:-translate-y-1 hover:shadow-card ${
                    isEmergency ? "border-destructive/40 bg-destructive/5" : "border-border/60"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-11 h-11 rounded-xl ${meta.bg} flex items-center justify-center shrink-0`}
                    >
                      <Icon className={`w-5 h-5 ${meta.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isEmergency && <Badge variant="destructive">{t("ann.emergency")}</Badge>}
                        <h3 className="font-bold text-foreground">{title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{text}</p>
                      <p className="text-xs text-muted-foreground mt-2">{dateStr}</p>
                    </div>
                    <ArrowRight className="mt-2 h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
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
