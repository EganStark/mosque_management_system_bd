import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, MapPin, Clock } from "lucide-react";
import { useLang, toBnNumber } from "@/lib/i18n";
import apiService from "@/lib/api";

type JanazaNotice = {
  id?: number;
  deceased_name_bn?: string;
  deceased_name_en?: string;
  janaza_date: string;
  janaza_time: string;
  location_bn?: string;
  location_en?: string;
  message_bn?: string;
  message_en?: string;
};

const DEFAULT_NOTICES = [
  {
    deceased_name_bn: "মরহুম আব্দুল করিম",
    deceased_name_en: "Marhum Abdul Karim",
    janaza_date: "2026-05-30T00:00:00.000Z",
    janaza_time: "বাদ আসর",
    location_bn: "মসজিদ প্রাঙ্গণ",
    location_en: "Mosque Prayer Hall",
    message_bn:
      "আল্লাহ তাঁকে জান্নাতুল ফিরদাউস নসিব করুন। ইন্না লিল্লাহি ওয়া ইন্না ইলাইহি রাজিউন।",
    message_en: "May Allah grant him Jannatul Firdaus. Inna lillahi wa inna ilayhi raji'un.",
  },
  {
    deceased_name_bn: "মরহুমা রোকেয়া বেগম",
    deceased_name_en: "Marhuma Rokeya Begum",
    janaza_date: "2026-05-27T00:00:00.000Z",
    janaza_time: "বাদ যোহর",
    location_bn: "মসজিদ প্রাঙ্গণ",
    location_en: "Mosque Prayer Hall",
    message_bn: "আল্লাহ তাঁর সকল গুনাহ মাফ করে দিন।",
    message_en: "May Allah forgive all her sins and grant her Paradise.",
  },
];

export function Janaza() {
  const { t, lang } = useLang();
  const [notices, setNotices] = useState<JanazaNotice[]>(DEFAULT_NOTICES);

  useEffect(() => {
    apiService
      .getJanazaNotices(5)
      .then((res) => {
        if (res && res.notices && res.notices.length > 0) {
          setNotices(res.notices);
        }
      })
      .catch((err) => console.error("Failed to fetch Janaza notices:", err));
  }, []);

  return (
    <section className="px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 rounded-[2rem] border border-gold/20 bg-gold/5 p-7 text-center sm:p-10">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-gold">
            Inna lillahi wa inna ilayhi raji'un
          </p>
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("jan.title")}</h2>
          <p className="mt-3 font-display italic text-muted-foreground">{t("jan.subtitle")}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {notices.map((n, i) => {
            const name = lang === "bn" ? n.deceased_name_bn : n.deceased_name_en;
            const loc = lang === "bn" ? n.location_bn : n.location_en;
            const msg = lang === "bn" ? n.message_bn : n.message_en;

            const dateObj = new Date(n.janaza_date);
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
            const dateTimeStr = `${dateStr} — ${n.janaza_time}`;

            return (
              <Card
                key={n.id || i}
                className="border-border/70 p-6 transition hover:-translate-y-1 hover:border-gold/35 hover:shadow-card"
              >
                <div className="flex items-center gap-2 text-gold mb-3">
                  <Heart className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    In Loving Memory
                  </span>
                </div>
                <h3 className="text-xl font-bold font-display mb-2">{name}</h3>
                <div className="space-y-1.5 text-sm text-muted-foreground mb-3">
                  <p className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" /> {dateTimeStr}
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5" /> {loc}
                  </p>
                </div>
                <p className="text-sm italic text-foreground/80">{msg}</p>
              </Card>
            );
          })}
        </div>
        <div className="text-center mt-8">
          <Button
            variant="outline"
            className="rounded-full border-primary/35 px-6 text-primary hover:bg-primary hover:text-primary-foreground"
          >
            {t("jan.viewall")}
          </Button>
        </div>
      </div>
    </section>
  );
}
