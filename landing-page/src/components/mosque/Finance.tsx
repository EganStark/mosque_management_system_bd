import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useLang, formatTaka, toBnNumber } from "@/lib/i18n";
import apiService from "@/lib/api";

type FinanceStats = {
  thisMonth?: { collections?: number; expenses?: number; balance?: number };
  trends?: { collectionsTrend?: number; expensesTrend?: number; balanceTrend?: number };
  lastUpdated?: string;
};

export function Finance() {
  const { t, lang } = useLang();
  const [updated, setUpdated] = useState(new Date());
  const [stats, setStats] = useState<FinanceStats | null>(null);

  useEffect(() => {
    const fetchStats = () => {
      apiService
        .getDashboardStats()
        .then((res) => {
          if (res) {
            setStats(res);
            if (res.lastUpdated) {
              setUpdated(new Date(res.lastUpdated));
            }
          }
        })
        .catch((err) => console.error("Failed to fetch finance stats:", err));
    };

    fetchStats();
    const id = setInterval(fetchStats, 60000);
    return () => clearInterval(id);
  }, []);

  const collectionsAmt = stats?.thisMonth?.collections ?? 125450;
  const expensesAmt = stats?.thisMonth?.expenses ?? 85200;
  const balanceAmt = stats?.thisMonth?.balance ?? 240250;

  const collectionsTrend = stats?.trends?.collectionsTrend ?? 12;
  const expensesTrend = stats?.trends?.expensesTrend ?? -5;
  const balanceTrend = stats?.trends?.balanceTrend ?? 8;

  const items = [
    {
      key: "fin.collections",
      amount: collectionsAmt,
      trend: collectionsTrend,
      up: collectionsTrend >= 0,
      icon: TrendingUp,
      bg: "bg-success/10",
      iconColor: "text-success",
    },
    {
      key: "fin.expenses",
      amount: expensesAmt,
      trend: expensesTrend,
      up: expensesTrend >= 0,
      icon: TrendingDown,
      bg: "bg-destructive/10",
      iconColor: "text-destructive",
    },
    {
      key: "fin.balance",
      amount: balanceAmt,
      trend: balanceTrend,
      up: balanceTrend >= 0,
      icon: Wallet,
      bg: "bg-gold/15",
      iconColor: "text-gold",
    },
  ];

  return (
    <section className="px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-7xl rounded-[2rem] border border-border/70 bg-card/70 p-5 shadow-card backdrop-blur-sm sm:p-8 lg:p-12">
        <div className="mb-12 grid items-end gap-5 md:grid-cols-[1fr_.8fr]">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-gold">
              Financial transparency
            </p>
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("fin.title")}</h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground md:justify-self-end">
            {t("fin.subtitle")}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {items.map((item) => {
            const Icon = item.icon;
            const TrendIcon = item.up ? ArrowUpRight : ArrowDownRight;
            return (
              <Card
                key={item.key}
                className="border-border/70 p-6 transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-card sm:p-7"
              >
                <div className="flex items-start justify-between mb-6">
                  <div
                    className={`w-14 h-14 rounded-2xl ${item.bg} flex items-center justify-center`}
                  >
                    <Icon className={`w-7 h-7 ${item.iconColor}`} />
                  </div>
                  <div
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      item.up ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    <TrendIcon className="w-3 h-3" />
                    {toBnNumber(Math.abs(item.trend), lang)}%
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-2 uppercase tracking-wider font-medium">
                  {t(item.key)}
                </p>
                <p className="text-3xl sm:text-4xl font-bold font-display text-foreground tabular-nums">
                  {formatTaka(item.amount, lang)}
                </p>
              </Card>
            );
          })}
        </div>

        <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground before:h-2 before:w-2 before:rounded-full before:bg-success">
          {t("fin.updated")}: {updated.toLocaleTimeString(lang === "bn" ? "bn-BD" : "en-US")}
        </p>
      </div>
    </section>
  );
}
