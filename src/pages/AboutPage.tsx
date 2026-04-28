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

  <div className="text-center text-movenotes-muted text-lg mb-6 leading-relaxed max-w-2xl mx-auto space-y-4">
    <p>MoveNotes is a different way to relate to movement.</p>
    <p>
      Most fitness tools are built around precision: pace, splits, segments,
      records. Over time, it becomes easy to focus on what can be measured, and
      lose sight of what actually mattered.
    </p>
    <p>MoveNotes started from that shift.</p>
    <p>When the numbers began to feel louder than the experience itself.</p>
    <p>This is an attempt to rebalance that.</p>
  </div>

  <div className="max-w-2xl mx-auto mb-8">
    <div className="h-px bg-movenotes-border/60" />
  </div>

  {/* How it works */}
  <section className="mb-10">
    <h2 className="text-xl font-semibold text-movenotes-primary mb-3">
      A low-fidelity approach
    </h2>
    <p className="leading-relaxed mb-4">
      MoveNotes is intentionally low-fidelity by design.
    </p>
    <p className="leading-relaxed mb-4">
      Instead of detailed performance metrics, it keeps things simple: duration
      or distance if you want it, a note or reflection, and a photo from the
      moment.
    </p>
    <p className="leading-relaxed">
      It creates space for the parts that usually get lost: how something felt,
      what stood out, and why it mattered that day. Because movement is more
      than data.
    </p>
  </section>

        {/* Why */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-movenotes-primary mb-3">
            Logging an activity
          </h2>
          <p className="leading-relaxed mb-4">
            There are two natural ways to add an activity.
          </p>
          <p className="leading-relaxed mb-4">
            You can log it manually, using simple presets like running, cycling,
            or walking: quick to add, with just enough structure to capture the
            moment.
          </p>
          <p className="leading-relaxed">
            Or, if you already track activities with Strava, you can choose to
            bring them in. Imported activities are reduced to their essentials,
            keeping the focus on the experience rather than the breakdown. Both
            approaches lead to the same place: a record that leaves room for
            reflection.
          </p>
        </section>

        {/* A small note */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-movenotes-primary mb-3">
            The Gentle Circle
          </h2>
          <p className="leading-relaxed mb-4">
            MoveNotes includes a small, intentional social layer called The
            Gentle Circle.
          </p>
          <p className="leading-relaxed mb-4">
            It's a space to share moments, not performances.
          </p>
          <p className="leading-relaxed">
            No likes. No leaderboards. No comparison metrics. Just glimpses into
            how others experience movement: a short note after a run, a photo
            from a ride, a simple &quot;this felt good today&quot;. It's designed
            for connection without pressure, a quieter way of being social.
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
        <span className="font-medium text-movenotes-text">Log manually or import from Strava</span> — 
        whatever gets you to a simpler record of the experience.
      </p>
    </li>

    {/* Add notes and photos */}
    <li className="flex items-start space-x-3">
      <span className="text-movenotes-accent">
        <IconCamera size={20} strokeWidth={1.7} />
      </span>
      <p className="text-movenotes-muted">
        <span className="font-medium text-movenotes-text">Add notes and photos</span> — 
        hold on to what stood out, how it felt, and why it mattered that day.
      </p>
    </li>

    {/* Track gentle progress */}
    <li className="flex items-start space-x-3">
      <span className="text-movenotes-accent">
        <IconChartBar size={20} strokeWidth={1.7} />
      </span>
      <p className="text-movenotes-muted">
        <span className="font-medium text-movenotes-text">Track gentle progress</span> — 
        less noise, more awareness, more honesty.
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
            MoveNotes collects only what you choose to enter. No ads, no hidden
            analytics, and no pressure to turn movement into performance.
          </p>
        </section>

        {/* Creator */}
        <section className="mb-6">
          <h2 className="text-xl font-semibold text-movenotes-primary mb-3">
            An ongoing experiment
          </h2>
          <p className="leading-relaxed mb-4 text-movenotes-muted">
            MoveNotes is still evolving.
          </p>
          <p className="leading-relaxed mb-4 text-movenotes-muted">
            It's an exploration of what happens when you design against
            over-optimization, make space for subjectivity, and treat movement
            as something to experience, not just measure.
          </p>
          <p className="leading-relaxed text-movenotes-muted">
            It doesn't replace tools like Strava. It simply offers another
            layer, one where movement isn't reduced to numbers. If that
            resonates, you're in the right place.
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
