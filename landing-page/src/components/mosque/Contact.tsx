import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Phone, Mail, MapPin, Clock, Facebook, Youtube, Instagram, Send } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { apiService } from "@/lib/api";

export function Contact() {
  const { t, lang } = useLang();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "general",
    message: "",
  });

  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || form.message.length < 10) {
      toast.error(
        lang === "bn"
          ? "অনুগ্রহ করে সকল ফিল্ড সঠিকভাবে পূরণ করুন"
          : "Please fill all required fields correctly",
      );
      return;
    }
    try {
      setSubmitting(true);
      const result = await apiService.submitContactForm(form);
      toast.success(
        `${lang === "bn" ? "বার্তা গ্রহণ হয়েছে" : "Message received"}: ${result.ticketNumber}`,
      );
      setForm({ name: "", email: "", phone: "", subject: "general", message: "" });
    } catch {
      toast.error(
        lang === "bn"
          ? "বার্তা পাঠানো যায়নি। আবার চেষ্টা করুন।"
          : "Message could not be sent. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="contact" className="px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 grid items-end gap-5 md:grid-cols-[1fr_.7fr]">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-primary">
              Visit · Call · Write
            </p>
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("contact.title")}</h2>
          </div>
          <p className="text-sm leading-7 text-muted-foreground md:justify-self-end">
            {t("contact.subtitle")}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
          {/* Info */}
          <div className="space-y-5">
            <InfoCard
              icon={Phone}
              title={lang === "bn" ? "ফোন" : "Phone"}
              value="+880 1234-567890"
            />
            <InfoCard icon={Mail} title="Email" value="info@baiturrahman.org" />
            <InfoCard
              icon={MapPin}
              title={lang === "bn" ? "ঠিকানা" : "Location"}
              value={
                lang === "bn"
                  ? "১২৩ ইসলামিক সড়ক, ঢাকা ১০০০, বাংলাদেশ"
                  : "123 Islamic Street, Dhaka 1000, Bangladesh"
              }
            />
            <InfoCard
              icon={Clock}
              title={t("contact.hours")}
              value={
                lang === "bn"
                  ? "সোম–শুক্র: সকাল ৯টা – বিকাল ৫টা\nশনি: সকাল ১০টা – দুপুর ২টা\nরবি: বন্ধ"
                  : "Mon–Fri: 9:00 AM – 5:00 PM\nSat: 10:00 AM – 2:00 PM\nSun: Closed"
              }
            />

            <div className="flex gap-3 pt-2">
              {[Facebook, Youtube, Instagram].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-11 h-11 rounded-full bg-primary text-primary-foreground hover:bg-gold hover:text-gold-foreground flex items-center justify-center transition shadow-card"
                >
                  <Icon className="w-5 h-5" />
                </a>
              ))}
            </div>

            <div className="rounded-xl overflow-hidden border border-border shadow-card aspect-[16/10]">
              <iframe
                title="Mosque location"
                src="https://www.openstreetmap.org/export/embed.html?bbox=90.38,23.78,90.42,23.81&layer=mapnik"
                className="w-full h-full"
                loading="lazy"
              />
            </div>
          </div>

          {/* Form */}
          <Card className="border-border/70 p-6 shadow-card sm:p-8">
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label>{t("form.name")} *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Email *</Label>
                  <Input
                    inputMode="tel"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>{t("form.phone")}</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
              </div>
              <div>
                <Label>{t("contact.subject")}</Label>
                <Select
                  value={form.subject}
                  onValueChange={(v) => setForm({ ...form, subject: v })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">
                      {lang === "bn" ? "সাধারণ জিজ্ঞাসা" : "General Inquiry"}
                    </SelectItem>
                    <SelectItem value="rental">
                      {lang === "bn" ? "অনুষ্ঠান ভাড়া" : "Event Rental"}
                    </SelectItem>
                    <SelectItem value="volunteer">
                      {lang === "bn" ? "স্বেচ্ছাসেবক" : "Volunteer"}
                    </SelectItem>
                    <SelectItem value="other">{lang === "bn" ? "অন্যান্য" : "Other"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("contact.message")} *</Label>
                <Textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={5}
                  className="mt-1.5"
                />
              </div>
              <Button
                type="submit"
                disabled={submitting}
                size="lg"
                className="h-12 w-full rounded-full bg-hero text-primary-foreground hover:opacity-90"
              >
                <Send className="w-4 h-4 mr-2" /> {t("contact.send")}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </section>
  );
}

function InfoCard({
  icon: Icon,
  title,
  value,
}: {
  icon: typeof Phone;
  title: string;
  value: string;
}) {
  return (
    <Card className="flex items-start gap-4 border-border/70 p-5 transition hover:border-primary/30 hover:shadow-card">
      <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
          {title}
        </p>
        <p className="font-semibold text-foreground whitespace-pre-line">{value}</p>
      </div>
    </Card>
  );
}
