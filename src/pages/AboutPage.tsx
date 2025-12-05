import HeaderLogo from "../components/HeaderLogo";
import PublicTopNav from "../components/PublicTopNav";
import { IconRun, IconCamera, IconChartBar, IconBrandAndroid, IconBrandApple } from "@tabler/icons-react";


export default function AboutPage() {
  return (
    <div className="min-h-screen bg-movenotes-bg py-10 px-4 text-movenotes-text relative">
      <PublicTopNav />

      {/* Logo */}
      <div className="flex justify-center mb-6">
        <HeaderLogo />
      </div>

{/* Main content container */}
<div className="max-w-3xl mx-auto bg-movenotes-surface shadow-sm rounded-2xl p-8">

  {/* Hero */}
  <h1 className="text-3xl font-semibold text-center text-movenotes-primary mb-4">
    About MoveNotes
  </h1>

  <p className="text-center text-movenotes-text/90 text-lg mb-10 leading-relaxed max-w-2xl mx-auto">
    MoveNotes is a simple, private movement journal that helps you log your 
    activities, reflect on how they felt, and appreciate your movement journey — 
    without GPS pressure or social comparison.
  </p>

        {/* Why */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-movenotes-primary mb-3">
            Why MoveNotes?
          </h2>
          <p className="leading-relaxed mb-4">
            MoveNotes was created for people who enjoy moving without constant tracking
            pressure. No pace stress, no heart-rate dashboards, no competition — just
            a calm place to reflect on runs, walks, rides, yoga, strength training,
            hikes, and more.
          </p>
        </section>

 {/* Features */}
<section className="mb-10">
  <h2 className="text-xl font-semibold text-movenotes-primary mb-4">
    What you can do with MoveNotes
  </h2>

  <ul className="space-y-4 text-sm leading-relaxed">

    {/* Log any activity */}
    <li className="flex items-start space-x-3">
      <span className="text-movenotes-accent">
        <IconRun size={20} strokeWidth={1.7} />
      </span>
      <p className="text-movenotes-muted">
        <span className="font-medium text-movenotes-text">Log any activity</span> — 
        runs, walks, rides, yoga, strength, hikes, and more.
      </p>
    </li>

    {/* Add notes and photos */}
    <li className="flex items-start space-x-3">
      <span className="text-movenotes-accent">
        <IconCamera size={20} strokeWidth={1.7} />
      </span>
      <p className="text-movenotes-muted">
        <span className="font-medium text-movenotes-text">Add notes and photos</span> — 
        remember how your movement felt.
      </p>
    </li>

    {/* Track gentle progress */}
    <li className="flex items-start space-x-3">
      <span className="text-movenotes-accent">
        <IconChartBar size={20} strokeWidth={1.7} />
      </span>
      <p className="text-movenotes-muted">
        <span className="font-medium text-movenotes-text">Track gentle progress</span> — 
        weekly and monthly stats without pressure.
      </p>
    </li>
  </ul>
</section>



        {/* Screenshot placeholders */}
    {/* Screenshots */}
<section className="mb-12">
  <h2 className="text-xl font-semibold text-movenotes-primary mb-3">
    A glimpse inside
  </h2>
  <p className="text-movenotes-muted text-sm mb-6">
    A few moments from the MoveNotes experience.
  </p>

  <div className="grid gap-10">

    {/* Screenshot A */}
    <figure className="flex flex-col items-center">
      <div className="w-64 rounded-xl border border-movenotes-border bg-movenotes-bg shadow-sm overflow-hidden">
        <img
          src="/images/ScreenshotA.png"
          alt="Quick log screen in MoveNotes"
          className="w-full h-auto block"
        />
      </div>
      <figcaption className="text-sm text-movenotes-muted mt-2 text-center">
        Quick-log an activity in seconds.
      </figcaption>
    </figure>

    {/* Screenshot B */}
    <figure className="flex flex-col items-center">
      <div className="w-64 rounded-xl border border-movenotes-border bg-movenotes-bg shadow-sm overflow-hidden">
        <img
          src="/images/ScreenshotB.png"
          alt="Home feed with logged activities"
          className="w-full h-auto block"
        />
      </div>
      <figcaption className="text-sm text-movenotes-muted mt-2 text-center">
        Your movement journal with notes & photos.
      </figcaption>
    </figure>

    {/* Screenshot C */}
    <figure className="flex flex-col items-center">
      <div className="w-64 rounded-xl border border-movenotes-border bg-movenotes-bg shadow-sm overflow-hidden">
        <img
          src="/images/ScreenshotC.png"
          alt="Stats view showing gentle progress"
          className="w-full h-auto block"
        />
      </div>
      <figcaption className="text-sm text-movenotes-muted mt-2 text-center">
        Gentle weekly & monthly progress.
      </figcaption>
    </figure>

  </div>
</section>

{/* PWA install (compact) */}
<section className="mb-10">
  <h2 className="text-xl font-semibold text-movenotes-primary mb-3 flex items-center gap-2">
    <span>Install MoveNotes on your home screen</span>
  </h2>

  <p className="text-sm text-movenotes-muted leading-relaxed mb-4">
    MoveNotes is a web app you can install on your phone, so it opens full-screen
    and feels like a native app.
  </p>

  <div className="space-y-3 text-sm text-movenotes-muted">

    {/* Android */}
    <div className="flex items-start gap-2">
      <IconBrandAndroid size={18} className="mt-0.5 text-movenotes-accent" />
      <p>
        <span className="font-medium text-movenotes-text">Android (Chrome)</span>{" "}
        – Open MoveNotes in Chrome → tap the <strong>⋮</strong> menu →{" "}
        <strong>Add to Home screen</strong> → <strong>Install</strong>.
      </p>
    </div>

    {/* iPhone */}
    <div className="flex items-start gap-2">
      <IconBrandApple size={18} className="mt-0.5 text-movenotes-accent" />
      <p>
        <span className="font-medium text-movenotes-text">iPhone (Safari)</span>{" "}
        – Open MoveNotes in Safari → tap the{" "}
        <strong>Share</strong> button → <strong>Add to Home Screen</strong> →{" "}
        <strong>Add</strong>.
      </p>
    </div>
  </div>
</section>


        {/* Privacy */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-movenotes-primary mb-3">
            Privacy first
          </h2>
          <p className="leading-relaxed text-movenotes-muted">
            MoveNotes collects only what you enter. No GPS tracking, no ads, no social
            feeds, and no hidden analytics.
          </p>
        </section>

        {/* Creator */}
        <section className="mb-6">
          <h2 className="text-xl font-semibold text-movenotes-primary mb-3">
            Built by a real person
          </h2>
          <p className="leading-relaxed text-movenotes-muted">
            MoveNotes is designed and built by Thijs ter Beek — a lifelong runner and cyclist
            who wanted a calmer, more meaningful way to track movement.
          </p>
        </section>

        {/* Call to action */}
        <div className="flex justify-center mt-10">
          <a
            href="/"
            className="bg-amber-300 border border-amber-400 text-primary-text px-6 py-3 rounded-full text-lg font-medium shadow-sm transition transform hover:-translate-y-0.5 active:scale-95"
          >
            Open the app
          </a>
        </div>

      </div>
    </div>
  );
}
