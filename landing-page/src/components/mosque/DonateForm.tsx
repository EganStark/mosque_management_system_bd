import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, CreditCard, Smartphone, Building2, Heart, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useLang, formatTaka, toBnNumber } from "@/lib/i18n";
import { apiService } from "@/lib/api";

const types = [
  { id: "general", labelKey: "don.type.general" },
  { id: "zakat", labelKey: "don.type.zakat" },
  { id: "monthly", labelKey: "don.type.monthly" },
  { id: "special", labelKey: "don.type.special" },
];

const presets = [
  { amount: 500, label: { bn: "খাবার সহায়তা", en: "Meal Support" } },
  { amount: 2000, label: { bn: "সাপ্তাহিক সহায়তা", en: "Weekly Support" } },
  { amount: 5000, label: { bn: "মাসিক সহায়তা", en: "Monthly Support" } },
  { amount: 10000, label: { bn: "শিক্ষা তহবিল", en: "Education Fund" } },
  { amount: 25000, label: { bn: "মসজিদ রক্ষণাবেক্ষণ", en: "Masjid Maintenance" } },
  { amount: 50000, label: { bn: "বড় প্রকল্প", en: "Major Project" } },
];

const methods = [
  { id: "bkash", name: "bKash", icon: Smartphone, color: "bg-pink-500", num: "+880 1234-567890" },
  { id: "nagad", name: "Nagad", icon: Smartphone, color: "bg-orange-500", num: "+880 9876-543210" },
  {
    id: "bank",
    name: "Bank Transfer",
    icon: Building2,
    color: "bg-primary",
    num: "A/C: 123456789 — Main Branch",
  },
];

const stepLabels = ["Purpose", "Payment", "Details", "Review"];

export function DonateForm() {
  const { t, lang } = useLang();
  const [step, setStep] = useState(1);
  const [type, setType] = useState("general");
  const [amount, setAmount] = useState(5000);
  const [custom, setCustom] = useState("");
  const [method, setMethod] = useState("bkash");
  const [form, setForm] = useState({ name: "", phone: "", email: "", tid: "", anon: false });
  const [done, setDone] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const finalAmount = custom ? Number(custom) : amount;
  const selectedMethod = methods.find((m) => m.id === method)!;
  const typeLabel = t(types.find((x) => x.id === type)!.labelKey);

  async function submit() {
    if (!form.name || !form.phone || !form.tid) {
      toast.error("Please fill in all required fields");
      return;
    }
    try {
      setSubmitting(true);
      const result = await apiService.submitDonation({
        donationType: type,
        amount: finalAmount,
        paymentMethod: method,
        transactionId: form.tid,
        donorName: form.name,
        phone: form.phone,
        email: form.email,
        isAnonymous: form.anon,
      });
      setConfirmation(result.confirmationNumber);
      setDone(true);
      toast.success(t("form.success"));
    } catch {
      toast.error(
        lang === "bn"
          ? "দান জমা দেওয়া যায়নি। লেনদেন নম্বর যাচাই করুন।"
          : "Donation could not be submitted. Check the transaction ID.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      id="donate"
      className="relative overflow-hidden bg-hero px-4 py-20 text-primary-foreground sm:px-6 lg:py-28"
    >
      <div className="absolute inset-0 arabic-pattern opacity-20" />
      <div className="relative mx-auto max-w-6xl">
        <div className="mb-12 grid items-end gap-5 md:grid-cols-[1fr_.8fr]">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold/20 border border-gold/40 text-gold text-xs font-semibold tracking-wider uppercase mb-4">
              <Heart className="w-3.5 h-3.5" /> SADAQAH JARIYAH
            </div>
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("form.title")}</h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-primary-foreground/75 md:justify-self-end">
            {t("form.subtitle")}
          </p>
        </div>

        {done ? (
          <Card className="max-w-2xl mx-auto p-10 text-center text-foreground">
            <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-5">
              <Check className="w-8 h-8 text-success" />
            </div>
            <h3 className="text-2xl font-bold mb-3">{t("form.success")}</h3>
            <p className="text-muted-foreground mb-2">
              Confirmation #:{" "}
              <span className="font-mono font-bold text-primary">{confirmation}</span>
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              {formatTaka(finalAmount, lang)} — {typeLabel}
            </p>
            <Button
              onClick={() => {
                setDone(false);
                setStep(1);
              }}
              className="bg-primary text-primary-foreground"
            >
              {t("nav.home")}
            </Button>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Form */}
            <Card className="bg-card p-5 text-foreground shadow-2xl shadow-black/15 sm:p-8 lg:col-span-2">
              {/* Stepper */}
              <div className="mb-9 grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((s) => (
                  <div key={s} className="min-w-0">
                    <div
                      className={`mb-2 h-1.5 w-full rounded-full transition ${step >= s ? "bg-primary" : "bg-muted"}`}
                    />
                    <p
                      className={`truncate text-[10px] font-bold uppercase tracking-wider ${step === s ? "text-primary" : "text-muted-foreground"}`}
                    >
                      {toBnNumber(s, lang)}. {stepLabels[s - 1]}
                    </p>
                  </div>
                ))}
              </div>

              {step === 1 && (
                <div className="space-y-6 animate-fade-in">
                  <h3 className="text-xl font-bold">{t("form.step1")}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {types.map((tp) => (
                      <button
                        key={tp.id}
                        onClick={() => setType(tp.id)}
                        className={`p-3 rounded-lg border-2 text-sm font-semibold transition ${
                          type === tp.id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-foreground/70 hover:border-primary/50"
                        }`}
                      >
                        {t(tp.labelKey)}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {presets.map((p) => (
                      <button
                        key={p.amount}
                        onClick={() => {
                          setAmount(p.amount);
                          setCustom("");
                        }}
                        className={`p-4 rounded-xl border-2 text-left transition hover:-translate-y-0.5 ${
                          amount === p.amount && !custom
                            ? "border-primary bg-accent shadow-card"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="text-lg font-bold text-primary">
                          {formatTaka(p.amount, lang)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{p.label[lang]}</div>
                      </button>
                    ))}
                  </div>
                  <div>
                    <Label>{t("form.custom")}</Label>
                    <Input
                      type="number"
                      min="100"
                      inputMode="numeric"
                      placeholder="0"
                      value={custom}
                      onChange={(e) => setCustom(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4 animate-fade-in">
                  <h3 className="text-xl font-bold">{t("form.step2")}</h3>
                  {methods.map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setMethod(m.id)}
                        className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 text-left transition ${
                          method === m.id
                            ? "border-primary bg-accent"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div
                          className={`w-12 h-12 rounded-full ${m.color} flex items-center justify-center text-white shrink-0`}
                        >
                          <Icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          <div className="font-bold">{m.name}</div>
                          <div className="text-sm text-muted-foreground">{m.num}</div>
                        </div>
                        {method === m.id && <Check className="w-5 h-5 text-primary" />}
                      </button>
                    );
                  })}
                  <div className="p-4 rounded-lg bg-accent/50 text-sm">
                    <strong>{lang === "bn" ? "নির্দেশনা:" : "Instructions:"}</strong>{" "}
                    {lang === "bn"
                      ? `${formatTaka(finalAmount, lang)} পাঠান ${selectedMethod.num} নম্বরে ${selectedMethod.name} অ্যাপের মাধ্যমে।`
                      : `Send ${formatTaka(finalAmount, lang)} to ${selectedMethod.num} via the ${selectedMethod.name} app.`}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4 animate-fade-in">
                  <h3 className="text-xl font-bold">{t("form.step3")}</h3>
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
                      <Label>{t("form.phone")} *</Label>
                      <Input
                        inputMode="tel"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="+880"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label>{t("form.email")}</Label>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>{t("form.tid")} *</Label>
                    <Input
                      value={form.tid}
                      onChange={(e) => setForm({ ...form, tid: e.target.value })}
                      className="mt-1.5 font-mono"
                    />
                    <p className="text-xs text-muted-foreground mt-1">{t("form.tidHelp")}</p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={form.anon}
                      onCheckedChange={(c) => setForm({ ...form, anon: !!c })}
                    />
                    <span className="text-sm">{t("form.anonymous")}</span>
                  </label>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-4 animate-fade-in">
                  <h3 className="text-xl font-bold">{t("form.step4")}</h3>
                  <Card className="p-5 bg-accent border-primary/30">
                    <Row label={typeLabel} value={t(types.find((x) => x.id === type)!.labelKey)} />
                    <Row
                      label={lang === "bn" ? "পরিমাণ" : "Amount"}
                      value={formatTaka(finalAmount, lang)}
                      highlight
                    />
                    <Row
                      label={lang === "bn" ? "পেমেন্ট" : "Payment Method"}
                      value={selectedMethod.name}
                    />
                    <Row
                      label={lang === "bn" ? "দাতা" : "Donor"}
                      value={form.anon ? t("don.anonymous") : form.name || "—"}
                    />
                    <Row label="TID" value={form.tid || "—"} />
                  </Card>
                  <div className="space-y-2 text-sm">
                    <Confirm
                      text={
                        lang === "bn"
                          ? "সকল দান প্রসেস করার আগে যাচাই করা হয়"
                          : "All donations are verified before processing"
                      }
                    />
                    <Confirm
                      text={
                        lang === "bn"
                          ? "আপনার গোপনীয়তা সুরক্ষিত"
                          : "Your privacy is respected and protected"
                      }
                    />
                    <Confirm
                      text={
                        lang === "bn"
                          ? "১০০% তহবিল সম্প্রদায়ের কাজে ব্যবহৃত হয়"
                          : "100% of funds go to community programs"
                      }
                    />
                  </div>
                </div>
              )}

              <div className="mt-8 flex justify-between gap-3 border-t border-border pt-6">
                <Button variant="outline" disabled={step === 1} onClick={() => setStep(step - 1)}>
                  {t("form.back")}
                </Button>
                {step < 4 ? (
                  <Button
                    onClick={() => setStep(step + 1)}
                    className="rounded-full bg-primary px-6 text-primary-foreground"
                  >
                    {t("form.next")}
                  </Button>
                ) : (
                  <Button
                    onClick={submit}
                    disabled={submitting}
                    size="lg"
                    className="rounded-full bg-gold-gradient px-6 text-gold-foreground hover:opacity-90"
                  >
                    <Heart className="w-4 h-4 mr-2" /> {t("form.submit")}
                  </Button>
                )}
              </div>
            </Card>

            {/* Summary sidebar */}
            <Card className="sticky top-24 h-fit border-white/10 bg-white/95 p-6 text-foreground shadow-2xl shadow-black/15 dark:bg-card/95">
              <h4 className="font-bold mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" /> {t("form.summary")}
              </h4>
              <div className="space-y-3 text-sm">
                <SumRow label={lang === "bn" ? "ধরন" : "Type"} value={typeLabel} />
                <SumRow
                  label={lang === "bn" ? "পরিমাণ" : "Amount"}
                  value={formatTaka(finalAmount, lang)}
                  big
                />
                <SumRow label={lang === "bn" ? "পদ্ধতি" : "Method"} value={selectedMethod.name} />
                <SumRow
                  label={lang === "bn" ? "ধাপ" : "Step"}
                  value={`${toBnNumber(step, lang)} / ${toBnNumber(4, lang)}`}
                />
              </div>
              <div className="mt-6 p-4 rounded-lg bg-accent">
                <CreditCard className="w-5 h-5 text-primary mb-2" />
                <p className="text-xs text-muted-foreground">
                  {lang === "bn"
                    ? "সব দান যাচাই-বাছাই করার পর প্রকাশ্যে দেখানো হবে।"
                    : "All donations are verified before being publicly displayed."}
                </p>
              </div>
            </Card>
          </div>
        )}
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className={`font-semibold ${highlight ? "text-primary text-lg" : ""}`}>{value}</span>
    </div>
  );
}
function SumRow({ label, value, big = false }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-bold ${big ? "text-2xl text-primary" : ""}`}>{value}</span>
    </div>
  );
}
function Confirm({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2">
      <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
      <span className="text-muted-foreground">{text}</span>
    </div>
  );
}
