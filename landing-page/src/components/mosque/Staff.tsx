import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Mail, Phone, MessageCircle } from "lucide-react";
import { useLang } from "@/lib/i18n";
import apiService, { backendAssetUrl } from "@/lib/api";

const colors = ["bg-primary", "bg-gold", "bg-success", "bg-primary-glow"];
type StaffMember = {
  id?: number;
  name_bn?: string;
  name_en?: string;
  position_bn?: string;
  position_en?: string;
  bio_bn?: string;
  bio_en?: string;
  photo?: string;
  email?: string;
  phone?: string;
};

export function Staff() {
  const { t, lang } = useLang();
  const [staff, setStaff] = useState<StaffMember[]>([]);

  useEffect(() => {
    apiService
      .getStaff()
      .then((res) => {
        if (res && res.staff) {
          setStaff(res.staff);
        }
      })
      .catch((err) => console.error("Failed to fetch staff:", err));
  }, []);

  return (
    <section className="px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 grid items-end gap-5 md:grid-cols-[1fr_.7fr]">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-gold">
              {t("staff.subtitle")}
            </p>
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("staff.title")}</h2>
          </div>
          <p className="text-sm leading-7 text-muted-foreground md:justify-self-end">
            Accessible leadership, clear responsibilities and service rooted in trust.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {staff.length === 0 ? (
            <p className="text-center text-muted-foreground col-span-4 py-8">
              {lang === "bn" ? "কোন স্টাফ সদস্য পাওয়া যায়নি" : "No staff members found"}
            </p>
          ) : (
            staff.map((s, i) => {
              const name = lang === "bn" ? s.name_bn : s.name_en;
              const position = lang === "bn" ? s.position_bn : s.position_en;
              const bio = lang === "bn" ? s.bio_bn : s.bio_en;

              const photoUrl = backendAssetUrl(s.photo) || null;

              const initial = s.name_en
                ? s.name_en
                    .trim()
                    .split(" ")
                    .filter(Boolean)
                    .map((part: string) => part[0])
                    .join("")
                    .substring(0, 2)
                    .toUpperCase()
                : "ST";

              const color = colors[i % colors.length];

              return (
                <Card
                  key={s.id || i}
                  className="overflow-hidden border-border/70 p-6 text-left transition hover:-translate-y-1 hover:border-primary/30 hover:shadow-card"
                >
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={name}
                      className="mb-5 h-24 w-24 rounded-2xl border object-cover shadow-elegant"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div
                      className={`mb-5 flex h-24 w-24 items-center justify-center rounded-2xl ${color} text-2xl font-bold text-white shadow-elegant`}
                    >
                      {initial}
                    </div>
                  )}
                  <h3 className="font-bold text-foreground">{name}</h3>
                  <p className="text-sm text-primary font-semibold mt-1">{position}</p>
                  <p className="text-xs text-muted-foreground mt-3 line-clamp-3">{bio}</p>
                  <div className="mt-5 flex gap-2 border-t border-border pt-4">
                    <a
                      href={s.email ? `mailto:${s.email}` : "#"}
                      className="w-8 h-8 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground flex items-center justify-center transition"
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </a>
                    <a
                      href={s.phone ? `tel:${s.phone}` : "#"}
                      className="w-8 h-8 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground flex items-center justify-center transition"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                    <a
                      href="#"
                      className="w-8 h-8 rounded-full bg-muted hover:bg-success hover:text-white flex items-center justify-center transition"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </a>
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
