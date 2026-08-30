import { Card } from "@/components/ui/card";
import { BookOpen, HeartHandshake, Moon } from "lucide-react";
import { useLang } from "@/lib/i18n";

export function Community() {
  const { t } = useLang();
  const items = [
    { icon: Moon, titleKey: "comm.prayers.title", descKey: "comm.prayers.desc" },
    { icon: HeartHandshake, titleKey: "comm.support.title", descKey: "comm.support.desc" },
    { icon: BookOpen, titleKey: "comm.learning.title", descKey: "comm.learning.desc" },
  ];
  return (
    <section className="px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 grid items-end gap-5 md:grid-cols-[1fr_.65fr]">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-primary">
              {t("comm.tagline")}
            </p>
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("comm.title")}</h2>
          </div>
          <p className="text-sm leading-7 text-muted-foreground md:justify-self-end">
            Faith becomes meaningful through prayer, learning and care for every neighbor.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {items.map(({ icon: Icon, titleKey, descKey }, index) => (
            <Card
              key={titleKey}
              className="group relative overflow-hidden border-border/70 p-7 transition hover:-translate-y-1 hover:border-primary/30 hover:shadow-card sm:p-8"
            >
              <span className="absolute right-5 top-3 font-display text-7xl font-bold text-primary/[0.06]">
                0{index + 1}
              </span>
              <div className="mb-10 grid h-14 w-14 place-items-center rounded-2xl bg-hero shadow-elegant transition-transform group-hover:scale-105">
                <Icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="mb-3 text-2xl font-bold">{t(titleKey)}</h3>
              <p className="leading-7 text-muted-foreground">{t(descKey)}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
