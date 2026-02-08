import HeaderLogo from "../components/HeaderLogo";
import PublicTopNav from "../components/PublicTopNav";
import { IconRun, IconCamera, IconChartBar, IconBrandAndroid, IconBrandApple } from "@tabler/icons-react";


export default function AboutPage() {
  const screenshots = [
    {
      base: "Screenshot_20260107-102338",
      title: "Journal",
      description: "Write what you did and how it felt.",
      alt: "Journal entry screen in MoveNotes.",
    },
    {
      base: "Screenshot_20260107-102321",
      title: "Quick log",
      description: "Log an activity in seconds.",
      alt: "Quick log screen for adding an activity.",
    },
    {
      base: "Screenshot_20260107-102355",
      title: "Calendar",
      description: "See your movement days at a glance.",
      alt: "Calendar view with movement days highlighted.",
    },
    {
      base: "Screenshot_20260107-102424",
      title: "Direction",
      description: "Gentle goals, tracked over time.",
      alt: "Goals and progress overview screen.",
    },
    {
      base: "Screenshot_20260107-102414",
      title: "Trends",
      description: "Notice patterns, not pressure.",
      alt: "Trends and insights view.",
    },
  ];

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

  <div className="text-center text-movenotes-text/90 text-lg mb-10 leading-relaxed max-w-2xl mx-auto space-y-4">
    <p>MoveNotes is a quiet place to notice your movement.</p>
    <p>It's not about performance, streaks, or improvement.</p>
    <p>It's not about optimizing your body or collecting data.</p>
    <p>MoveNotes is for paying attention — gently, without pressure.</p>
    <p>
      After a walk, a run, a ride, or any kind of movement, you can leave a short
      note about how it felt. Nothing to complete. Nothing to prove. Just noticing
      what's already there.
    </p>
    <p>You don't need to change your routine or commit to anything.</p>
    <p>MoveNotes works best when approached slowly.</p>
    <p>It's a small, independent project, made slowly in Brussels.</p>
  </div>

        {/* Why */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-movenotes-primary mb-3">
            Why MoveNotes?
          </h2>
          <p className="leading-relaxed mb-4">
            MoveNotes is a simple, private movement journal for people who enjoy moving
            without constant tracking pressure.
          </p>
          <p className="leading-relaxed mb-4">
            There's no pace stress, no heart-rate dashboards, and no social comparison — just
            a calm place to reflect on runs, walks, rides, yoga, strength training, hikes,
            and more.
          </p>
          <p className="leading-relaxed">
            Instead of measuring performance, MoveNotes makes space for reflection: how
            movement feels, how it fits into your day, and how your body responds over time.
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



        {/* Screenshots */}
<section className="mb-12">
  <h2 className="text-xl font-semibold text-movenotes-primary mb-3">
    A glimpse inside
  </h2>
  <p className="text-movenotes-muted text-sm mb-6">
    Swipe through a few moments from the MoveNotes experience.
  </p>

  <div className="relative">
    <div className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-6 -mx-4 px-4 scroll-smooth">
      {screenshots.map((shot) => (
        <figure
          key={shot.base}
          className="snap-center shrink-0 w-64 sm:w-72 md:w-80"
        >
          <div className="relative rounded-2xl border border-movenotes-border bg-movenotes-bg shadow-sm overflow-hidden">
            <picture>
              <source
                type="image/webp"
                srcSet={`/images/about_screens/${shot.base}-540.webp 540w, /images/about_screens/${shot.base}-810.webp 810w, /images/about_screens/${shot.base}-1080.webp 1080w`}
                sizes="(min-width: 768px) 320px, (min-width: 640px) 288px, 75vw"
              />
              <img
                src={`/images/about_screens/${shot.base}-810.jpg`}
                srcSet={`/images/about_screens/${shot.base}-540.jpg 540w, /images/about_screens/${shot.base}-810.jpg 810w, /images/about_screens/${shot.base}-1080.jpg 1080w`}
                sizes="(min-width: 768px) 320px, (min-width: 640px) 288px, 75vw"
                alt={shot.alt}
                className="w-full h-auto block"
                loading="lazy"
              />
            </picture>
            <div className="absolute inset-x-0 bottom-0 p-4 text-white bg-gradient-to-t from-black/75 via-black/30 to-transparent">
              <p className="text-sm font-semibold tracking-wide">{shot.title}</p>
              <p className="text-xs text-white/90 mt-1">{shot.description}</p>
            </div>
          </div>
        </figure>
      ))}
    </div>
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
