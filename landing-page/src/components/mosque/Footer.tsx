import { Moon, Facebook, Youtube, Instagram, Phone, Mail, MapPin } from "lucide-react";
import { useLang } from "@/lib/i18n";

export function Footer() {
  const { t, lang } = useLang();
  const year = new Date().getFullYear();
  return (
    <footer className="relative overflow-hidden bg-[#07131f] px-4 pb-6 pt-20 text-white/70 sm:px-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(45,212,191,.13),transparent_28rem)]" />
      <div className="relative mx-auto max-w-7xl">
        <div className="mb-14 grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-hero">
                <Moon className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <div className="font-display font-bold text-white">{t("brand.name")}</div>
              </div>
            </div>
            <p className="max-w-sm text-sm leading-7">{t("footer.about")}</p>
          </div>

          <FCol
            title={t("footer.quick")}
            links={[
              { label: t("nav.home"), href: "#home" },
              { label: t("nav.prayer"), href: "#prayer" },
              { label: t("nav.events"), href: "#events" },
              { label: t("nav.notices"), href: "#notices" },
              { label: t("nav.gallery"), href: "#gallery" },
            ]}
          />

          <FCol
            title={t("footer.donate")}
            links={[
              { label: t("don.type.general"), href: "#donate" },
              { label: t("don.type.zakat"), href: "#donate" },
              { label: t("don.type.monthly"), href: "#donate" },
              { label: t("don.type.special"), href: "#donate" },
            ]}
          />

          <div>
            <h4 className="font-bold text-white mb-4 text-sm uppercase tracking-wider">
              {t("footer.social")}
            </h4>
            <div className="flex gap-3 mb-5">
              {[Facebook, Youtube, Instagram].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-9 h-9 rounded-full bg-white/10 hover:bg-gold flex items-center justify-center transition"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 mt-1 text-gold shrink-0" />
                {lang === "bn" ? "১২৩ ইসলামিক সড়ক, ঢাকা" : "123 Islamic Street, Dhaka"}
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-gold" />
                +880 1234-567890
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-gold" />
                info@baiturrahman.org
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs sm:flex-row">
          <p>
            © {year} {t("brand.name")}. {t("footer.rights")}.
          </p>
          <div className="flex gap-5">
            <a href="#" className="hover:text-gold">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-gold">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h4 className="font-bold text-white mb-4 text-sm uppercase tracking-wider">{title}</h4>
      <ul className="space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.label}>
            <a href={l.href} className="hover:text-gold transition">
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
