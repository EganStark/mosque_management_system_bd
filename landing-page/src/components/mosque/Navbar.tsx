import { useEffect, useState } from "react";
import { Languages, Menu, Moon, Sparkles, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

const links = [
  { href: "#prayer", key: "nav.prayer" },
  { href: "#notices", key: "nav.notices" },
  { href: "#events", key: "nav.events" },
  { href: "#gallery", key: "nav.gallery" },
  { href: "#contact", key: "nav.contact" },
];

export function Navbar() {
  const { lang, setLang, t } = useLang();
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-border/70 bg-background/90 shadow-[0_18px_60px_-42px_rgba(15,23,42,.75)] backdrop-blur-2xl"
          : "bg-gradient-to-b from-slate-950/55 to-transparent"
      }`}
    >
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-20">
        <a
          href="#home"
          className="group flex min-w-0 items-center gap-3"
          aria-label={t("brand.name")}
        >
          <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-gold/35 bg-primary text-primary-foreground shadow-[0_12px_28px_-14px_rgba(13,148,136,.85)]">
            <Sparkles className="h-5 w-5" />
            <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-background bg-gold" />
          </span>
          <span className="min-w-0">
            <span
              className={`block truncate font-display text-base font-bold leading-tight sm:text-lg ${scrolled ? "text-foreground" : "text-white"}`}
            >
              {t("brand.name")}
            </span>
            <span
              className={`hidden text-[10px] font-semibold uppercase tracking-[0.2em] sm:block ${scrolled ? "text-muted-foreground" : "text-white/65"}`}
            >
              Faith · Community · Service
            </span>
          </span>
        </a>

        <nav className="hidden items-center gap-1 rounded-full border border-border/50 bg-card/55 p-1.5 shadow-sm backdrop-blur-xl lg:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-full px-3.5 py-2 text-sm font-semibold text-foreground/75 transition hover:bg-accent hover:text-primary"
            >
              {t(link.key)}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLang(lang === "bn" ? "en" : "bn")}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-border/70 bg-card/75 px-3 text-xs font-bold text-foreground shadow-sm backdrop-blur-xl transition hover:border-primary/40 hover:text-primary"
            aria-label="Change language"
          >
            <Languages className="h-4 w-4" />
            <span>{lang === "bn" ? "EN" : "বাংলা"}</span>
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="grid h-10 w-10 place-items-center rounded-full border border-border/70 bg-card/75 text-foreground shadow-sm backdrop-blur-xl transition hover:border-primary/40 hover:text-primary"
            aria-label={theme === "dark" ? "Use light theme" : "Use dark theme"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Button
            asChild
            className="hidden h-10 rounded-full bg-primary px-5 text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 sm:inline-flex"
          >
            <a href="#donate">{t("nav.donate")}</a>
          </Button>
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="grid h-10 w-10 place-items-center rounded-full border border-border/70 bg-card/75 text-foreground lg:hidden"
            aria-label="Open navigation"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-border/70 bg-background/96 px-4 py-4 shadow-xl backdrop-blur-2xl lg:hidden">
          <div className="mx-auto grid max-w-7xl gap-1">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 text-sm font-semibold text-foreground/80 transition hover:bg-accent hover:text-primary"
              >
                {t(link.key)}
              </a>
            ))}
            <Button asChild className="mt-2 rounded-xl bg-primary text-primary-foreground">
              <a href="#donate" onClick={() => setOpen(false)}>
                {t("nav.donate")}
              </a>
            </Button>
          </div>
        </nav>
      )}
    </header>
  );
}
