import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Users, UserCheck, User, UserCog } from "lucide-react";
import { useLang, toBnNumber } from "@/lib/i18n";
import apiService from "@/lib/api";

function useCountUp(target: number, on: boolean) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!on) return;
    const start = performance.now();
    const dur = 1600;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.floor(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on, target]);
  return val;
}

export function LiveStats() {
  const { t, lang } = useLang();
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [counts, setCounts] = useState({
    total: 548,
    active: 421,
    male: 312,
    female: 236,
  });

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), {
      threshold: 0.3,
    });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    apiService
      .getMembersCount()
      .then((res) => {
        if (res) {
          setCounts({
            total: res.total ?? 548,
            active: res.familyHeads ?? 421, // family heads with monthly payments
            male: res.male ?? 312,
            female: res.female ?? 236,
          });
        }
      })
      .catch((err) => console.error("Failed to fetch member counts:", err));
  }, []);

  const data = [
    { label: "stats.members", value: counts.total, icon: Users, color: "text-primary" },
    { label: "stats.active", value: counts.active, icon: UserCheck, color: "text-success" },
    { label: "stats.male", value: counts.male, icon: User, color: "text-gold" },
    { label: "stats.female", value: counts.female, icon: UserCog, color: "text-primary-glow" },
  ];

  const total = useCountUp(data[0].value, visible);
  const active = useCountUp(data[1].value, visible);
  const male = useCountUp(data[2].value, visible);
  const female = useCountUp(data[3].value, visible);
  const values = [total, active, male, female];

  return (
    <section ref={ref} className="px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 grid items-end gap-5 md:grid-cols-[1fr_.7fr]">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-primary">
              Community at a glance
            </p>
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
              <span className="text-gold">{toBnNumber(counts.total, lang)}+</span>{" "}
              {t("stats.strong")}
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-muted-foreground md:justify-self-end">
            {t("stats.title")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {data.map((d, i) => {
            const Icon = d.icon;
            return (
              <Card
                key={d.label}
                className="group relative overflow-hidden border-border/70 p-5 transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-card sm:p-7"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-12 translate-x-12 group-hover:scale-150 transition-transform" />
                <span className="relative mb-8 grid h-11 w-11 place-items-center rounded-2xl bg-accent">
                  <Icon className={`h-5 w-5 ${d.color}`} />
                </span>
                <div className="relative font-display text-4xl font-bold tabular-nums text-foreground sm:text-5xl">
                  {toBnNumber(values[i], lang)}
                </div>
                <div className="relative mt-2 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  {t(d.label)}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
