import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { useLang, formatTaka, toBnNumber } from "@/lib/i18n";
import apiService from "@/lib/api";

const colors = [
  "bg-primary",
  "bg-gold",
  "bg-primary-glow",
  "bg-success",
  "bg-warning",
  "bg-accent-foreground",
];

type Donation = {
  donorName?: string;
  amount: number;
  donationType?: string;
  dateFormatted?: string;
};

const DEFAULT_DONATIONS = [
  {
    donorName: "মোহাম্মদ রহিম",
    amount: 10000,
    donationType: "General Donation",
    dateFormatted: "Today",
  },
  { donorName: "Anonymous", amount: 5000, donationType: "Zakat", dateFormatted: "Today" },
  {
    donorName: "ফাতিমা খাতুন",
    amount: 2500,
    donationType: "Monthly Subscription",
    dateFormatted: "Yesterday",
  },
  {
    donorName: "আব্দুল্লাহ আল মামুন",
    amount: 25000,
    donationType: "Special Project",
    dateFormatted: "Yesterday",
  },
  {
    donorName: "Anonymous",
    amount: 1000,
    donationType: "General Donation",
    dateFormatted: "2d ago",
  },
  { donorName: "ইউসুফ আহমেদ", amount: 7500, donationType: "Zakat", dateFormatted: "3d ago" },
];

export function Donations() {
  const { t, lang } = useLang();
  const [donations, setDonations] = useState<Donation[]>([]);

  useEffect(() => {
    apiService
      .getRecentDonations(6)
      .then((res) => {
        if (res && res.donations && res.donations.length > 0) {
          setDonations(res.donations);
        }
      })
      .catch((err) => console.error("Failed to fetch recent donations:", err));
  }, []);

  return (
    <section className="px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 grid items-end gap-5 md:grid-cols-[1fr_.7fr]">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-primary">
              Verified community giving
            </p>
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("don.title")}</h2>
          </div>
          <p className="text-sm leading-7 text-muted-foreground md:justify-self-end">
            {t("don.subtitle")}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {donations.length === 0 ? (
            <Card className="col-span-full border-dashed border-primary/25 bg-primary/5 p-10 text-center">
              <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-primary" />
              <h3 className="text-xl font-bold">
                {lang === "bn" ? "যাচাইকৃত দানের তথ্য এখনো নেই" : "No verified donations yet"}
              </h3>
              <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
                {lang === "bn"
                  ? "প্রশাসক কোনো দান যাচাই ও রেকর্ড করলে তা এখানে প্রদর্শিত হবে।"
                  : "Donations appear here after they are recorded and verified by the mosque administration."}
              </p>
            </Card>
          ) : (
            donations.map((d, i) => {
              const isAnonymous =
                !d.donorName || d.donorName === "Anonymous" || d.donorName === "Anonymous Donor";
              const displayName = isAnonymous ? t("don.anonymous") : d.donorName;

              // Generate initials or fallback
              let initial = "A";
              if (!isAnonymous && d.donorName) {
                initial = d.donorName
                  .trim()
                  .split(" ")
                  .filter(Boolean)
                  .map((n: string) => n[0])
                  .join("")
                  .substring(0, 2)
                  .toUpperCase();
              }

              // Translate purpose
              let typeLabel = d.donationType || "General Donation";
              if (typeLabel.toLowerCase().includes("zakat")) typeLabel = t("don.type.zakat");
              else if (typeLabel.toLowerCase().includes("general"))
                typeLabel = t("don.type.general");
              else if (typeLabel.toLowerCase().includes("monthly"))
                typeLabel = t("don.type.monthly");
              else if (typeLabel.toLowerCase().includes("special"))
                typeLabel = t("don.type.special");

              // Format relative time
              let whenStr = d.dateFormatted || "";
              if (lang === "bn") {
                whenStr = whenStr
                  .replace("Today", "আজ")
                  .replace("Yesterday", "গতকাল")
                  .replace("Just now", "এইমাত্র")
                  .replace("m ago", " মিনিট আগে")
                  .replace("h ago", " ঘণ্টা আগে")
                  .replace("d ago", " দিন আগে")
                  .replace("w ago", " সপ্তাহ আগে")
                  .replace("mo ago", " মাস আগে")
                  .replace("yr ago", " বছর আগে");
                whenStr = toBnNumber(whenStr, "bn");
              }

              return (
                <Card
                  key={i}
                  className="border-border/70 p-5 transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-card"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-12 h-12 rounded-full ${colors[i % colors.length]} flex items-center justify-center text-white font-bold text-lg shrink-0`}
                    >
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-foreground truncate">{displayName}</p>
                        <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                      </div>
                      <p className="text-2xl font-bold text-primary mt-1 tabular-nums">
                        {formatTaka(d.amount, lang)}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge
                          variant="secondary"
                          className="bg-accent text-accent-foreground text-xs"
                        >
                          {typeLabel}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{whenStr}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        <div className="text-center mt-10">
          <a
            href="#donate"
            className="inline-flex items-center gap-2 text-primary font-semibold hover:underline"
          >
            {t("don.viewall")} →
          </a>
        </div>
      </div>
    </section>
  );
}
