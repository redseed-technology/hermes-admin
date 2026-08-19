import Link from "next/link";
import { Brand } from "@/components/brand";

const features = [
  {
    number: "01",
    title: "Create an identity",
    body: "Give each Hermes agent a clear purpose and personality before it is deployed.",
  },
  {
    number: "02",
    title: "Keep profiles isolated",
    body: "Every profile belongs to its owner and is ready to map to a dedicated container.",
  },
  {
    number: "03",
    title: "Deploy when ready",
    body: "DigitalOcean provisioning comes next. Local profile management works today.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f6f7f2] text-[#14231d]">
      <div className="hero-grid relative">
        <div className="absolute inset-x-0 top-0 h-1 bg-[#d8ff5f]" />
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-7 lg:px-10">
          <Brand />
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn btn-ghost btn-sm rounded-full px-5">
              Log in
            </Link>
            <Link
              href="/register"
              className="btn btn-sm rounded-full border-0 bg-[#14231d] px-5 text-white shadow-none hover:bg-[#254237]"
            >
              Get started
            </Link>
          </div>
        </nav>

        <section className="mx-auto grid max-w-7xl items-center gap-14 px-6 pb-24 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:pb-32 lg:pt-24">
          <div>
            <div className="badge h-auto gap-2 rounded-full border-[#c8d0c8] bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#355347]">
              <span className="size-2 rounded-full bg-[#79a900]" />
              Local-first agent platform
            </div>
            <h1 className="mt-7 max-w-3xl text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
              Shape your Hermes agents before they go live.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#597067]">
              Create and manage secure agent profiles today. Later, every profile becomes an isolated
              container running on your DigitalOcean infrastructure.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register"
                className="btn h-13 rounded-full border-0 bg-[#14231d] px-7 text-white shadow-none hover:bg-[#254237]"
              >
                Create your first agent
                <span aria-hidden="true">→</span>
              </Link>
              <a href="#how-it-works" className="btn h-13 rounded-full border-[#c8d0c8] bg-white px-7 shadow-none">
                See how it works
              </a>
            </div>
            <p className="mt-5 text-sm text-[#72857d]">No DigitalOcean credentials needed for local setup.</p>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute -inset-8 -z-10 rounded-full bg-[#d8ff5f]/40 blur-3xl" />
            <div className="rounded-[2rem] border border-[#cad3ca] bg-[#14231d] p-4 shadow-[0_35px_90px_-45px_rgba(20,35,29,0.65)] sm:p-6">
              <div className="mb-6 flex items-center justify-between px-1">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a8baae]">Agent profile</p>
                  <p className="mt-1 text-sm text-white">Configuration preview</p>
                </div>
                <span className="badge border-[#52665c] bg-[#21372e] text-[#d8ff5f]">Draft</span>
              </div>

              <div className="rounded-[1.5rem] bg-[#f8faf5] p-6 text-[#14231d]">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="grid size-12 place-items-center rounded-2xl bg-[#d8ff5f] text-lg font-bold">H</div>
                    <div>
                      <h2 className="font-semibold">Customer Concierge</h2>
                      <p className="mt-1 text-sm text-[#6b7e75]">Friendly · Support</p>
                    </div>
                  </div>
                  <div className="size-3 rounded-full bg-[#aab7b0] ring-4 ring-[#edf0ec]" />
                </div>
                <div className="my-6 h-px bg-[#dfe5df]" />
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#819087]">Purpose</p>
                <p className="mt-2 leading-7 text-[#40564d]">
                  Help customers find clear answers and guide them through account questions.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white p-4 ring-1 ring-[#e2e7e2]">
                    <p className="text-xs text-[#7a8d84]">Runtime</p>
                    <p className="mt-1 text-sm font-semibold">Shared container</p>
                  </div>
                  <div className="rounded-2xl bg-white p-4 ring-1 ring-[#e2e7e2]">
                    <p className="text-xs text-[#7a8d84]">Deployment</p>
                    <p className="mt-1 text-sm font-semibold">Not deployed</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section id="how-it-works" className="border-t border-[#d9dfd8] bg-white py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#6a850a]">Built in stages</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
              A clean foundation for containerized agents.
            </h2>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {features.map((feature) => (
              <article key={feature.number} className="card rounded-[1.5rem] border border-[#dfe5df] bg-[#fafbf8] shadow-none">
                <div className="card-body gap-5 p-7">
                  <span className="font-mono text-sm text-[#7f950c]">{feature.number}</span>
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                  <p className="leading-7 text-[#61746b]">{feature.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-[#d9dfd8] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-7 text-sm text-[#728078] sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <Brand />
          <p>Local MVP · DigitalOcean deployment coming next</p>
        </div>
      </footer>
    </main>
  );
}
