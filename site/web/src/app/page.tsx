const journey = [
  {
    period: "Dec 2019 – Present",
    title: "Associate Specialist Engineer · Java Tech Lead",
    company: "GlobalLogic Latinoamérica",
    location: "Mendoza, Argentina",
    details: [
      "Leading Java delivery with a focus on reliability, clean architecture, and team momentum.",
      "Modern Java stack, microservices, and API integration for enterprise clients.",
    ],
  },
  {
    period: "Jul 2017 – Dec 2019",
    title: "Java Software Developer",
    company: "Aconcagua Software Factory S.A.",
    location: "Mendoza, Argentina",
    details: [
      "Java 8, Spring, Hibernate, MySQL, Redis, AWS.",
    ],
  },
  {
    period: "Aug 2015 – Dec 2019",
    title: "Project Leader",
    company: "Aconcagua Software Factory S.A.",
    location: "Mendoza, Argentina",
    details: [
      "Project planning, CMMI documentation control, and feature analysis.",
    ],
  },
  {
    period: "Nov 2013 – Jul 2015",
    title: "Analyst",
    company: "Aconcagua Software Factory S.A.",
    location: "Mendoza, Argentina",
    details: ["Artifact construction and requirements analysis."],
  },
  {
    period: "Mar 2012 – Nov 2013",
    title: "Maintenance Project Leader",
    company: "Aconcagua Software Factory S.A.",
    location: "Argentina",
    details: ["Support team leadership for maintenance operations."],
  },
  {
    period: "Mar 2010 – Mar 2012",
    title: "Programmer & QA",
    company: "Aconcagua Software Factory S.A.",
    location: "Argentina",
    details: ["PHP, Oracle SQL, test case design and execution."],
  },
  {
    period: "Aug 2008 – Dec 2008",
    title: "Programmer",
    company: "Sommet",
    location: "Argentina",
    details: ["Maintenance, bug fixes, and QA execution."],
  },
];

const skills = [
  "Java Platform",
  "Object-Oriented Design",
  "Java EE",
  "JPA / Hibernate",
  "Web Services",
  "JSF / PrimeFaces",
  "JAX-RS",
  "Spring 4.3",
  "Spring Boot",
  "Angular 5+",
  "HTML5",
  "Microservices",
];

const certifications = [
  "Java, POO, JDBC, Servlets, JSPs",
  "Java EE, Web Services, JSF, EJB",
  "JPA, PrimeFaces, JAX-RS",
  "Angular Avanzado",
  "Angular & Spring Boot: Creando web app full stack",
];

export default function Home() {
  return (
    <div className="min-h-screen bg-obsidian text-white">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-radial-fade" />
        <div className="absolute inset-0 bg-grid opacity-40" />
        <div className="absolute -top-24 right-[-10%] h-72 w-72 rounded-full bg-glow blur-[120px] opacity-60" />
        <div className="absolute bottom-[-20%] left-[-10%] h-80 w-80 rounded-full bg-glow blur-[140px] opacity-40" />

        <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 py-16 md:px-10 md:py-24">
          <section className="grid gap-10 md:grid-cols-[1.1fr_0.9fr]">
            <div className="flex flex-col gap-8">
              <div className="inline-flex w-fit items-center gap-3 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/70">
                Enterprise Grade · Edgy Execution
              </div>
              <div className="space-y-5">
                <p className="text-sm uppercase tracking-[0.6em] text-white/50">
                  Diego Scifo
                </p>
                <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
                  Java Tech Lead crafting resilient systems, modern platforms, and
                  high-trust engineering teams.
                </h1>
                <p className="text-lg text-white/70 md:text-xl">
                  Based in Mendoza, Argentina. Currently leading Java delivery at
                  GlobalLogic Latinoamérica with a focus on clean architecture,
                  execution clarity, and real-world impact.
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <a
                  className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-3 text-sm font-semibold transition hover:border-white/60 hover:bg-white/10"
                  href="mailto:diegoscifo@yahoo.com.ar"
                >
                  diegoscifo@yahoo.com.ar
                </a>
                <a
                  className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-3 text-sm font-semibold transition hover:border-white/60 hover:bg-white/10"
                  href="https://www.linkedin.com/in/diego-scifo-94953526"
                  target="_blank"
                  rel="noreferrer"
                >
                  LinkedIn Profile
                </a>
                <a
                  className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-3 text-sm font-semibold transition hover:border-white/60 hover:bg-white/10"
                  href="https://www.diegoscifo.com.ar"
                  target="_blank"
                  rel="noreferrer"
                >
                  Personal Site
                </a>
              </div>
            </div>

            <div className="rounded-3xl border border-white/15 bg-white/5 p-8 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                About Me
              </p>
              <p className="mt-4 text-base leading-relaxed text-white/75">
                I am a Java engineer who thrives in environments where clarity,
                accountability, and product impact matter. I enjoy aligning teams
                around shared outcomes, translating complexity into actionable
                roadmaps, and building dependable systems that scale with the
                business. My leadership style blends structure with empathy so
                teams move fast without breaking quality.
              </p>
              <div className="mt-6 grid gap-4 text-sm text-white/70">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span>Current Role</span>
                  <span className="text-white/90">Java Tech Lead</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span>Location</span>
                  <span className="text-white/90">Mendoza, Argentina</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Languages</span>
                  <span className="text-white/90">Spanish · English</span>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                  Career Journey
                </p>
                <h2 className="mt-3 text-2xl font-semibold md:text-3xl">
                  Built on deep Java delivery and multi-year leadership.
                </h2>
              </div>
              <div className="hidden rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/60 md:block">
                2008 → Present
              </div>
            </div>

            <div className="grid gap-6">
              {journey.map((role) => (
                <article
                  key={`${role.period}-${role.title}`}
                  className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-6 backdrop-blur"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-white/60">
                    <span className="uppercase tracking-[0.3em]">
                      {role.period}
                    </span>
                    <span>{role.location}</span>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-white">
                    {role.title}
                  </h3>
                  <p className="text-white/70">{role.company}</p>
                  <div className="mt-4 flex flex-col gap-2 text-sm text-white/70">
                    {role.details.map((detail) => (
                      <p key={detail} className="leading-relaxed">
                        {detail}
                      </p>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-10 md:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-white/15 bg-white/5 p-8">
              <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                Expertise
              </p>
              <h2 className="mt-4 text-2xl font-semibold md:text-3xl">
                Core stack engineered for enterprise performance.
              </h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {skills.map((skill) => (
                  <div
                    key={skill}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80"
                  >
                    {skill}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="rounded-3xl border border-white/15 bg-white/5 p-6">
                <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                  Certifications
                </p>
                <div className="mt-4 flex flex-col gap-3 text-sm text-white/70">
                  {certifications.map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/15 bg-white/5 p-6">
                <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                  Education
                </p>
                <h3 className="mt-3 text-lg font-semibold text-white">
                  Universidad Tecnológica Nacional
                </h3>
                <p className="text-sm text-white/70">
                  Ingeniero en Sistemas de Información · 2001 – 2011
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-white/50">
                  Portfolio
                </p>
                <h2 className="mt-3 text-2xl font-semibold md:text-3xl">
                  Future-ready showcase built for premium clients.
                </h2>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-6">
                <h3 className="text-lg font-semibold text-white">
                  Enterprise Platform Highlights
                </h3>
                <p className="mt-3 text-sm text-white/70">
                  A curated view of large-scale systems, delivery strategy, and
                  leadership wins. Coming soon.
                </p>
                <a
                  className="mt-6 inline-flex items-center rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/60 hover:bg-white/10"
                  href="mailto:diegoscifo@yahoo.com.ar?subject=Portfolio%20Access"
                >
                  Request Early Access
                </a>
              </div>
              <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-6">
                <h3 className="text-lg font-semibold text-white">
                  Personal Projects & Experiments
                </h3>
                <p className="mt-3 text-sm text-white/70">
                  Prototypes, proof-of-concepts, and technical articles that
                  showcase craft and curiosity.
                </p>
                <a
                  className="mt-6 inline-flex items-center rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/60 hover:bg-white/10"
                  href="https://www.diegoscifo.com.ar"
                  target="_blank"
                  rel="noreferrer"
                >
                  Visit Personal Site
                </a>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/15 bg-white/5 p-8 text-center">
            <p className="text-xs uppercase tracking-[0.4em] text-white/50">
              Let’s Connect
            </p>
            <h2 className="mt-4 text-3xl font-semibold">
              Building ambitious systems together.
            </h2>
            <p className="mt-3 text-base text-white/70">
              Available for leadership roles, complex backend projects, and
              architecture advisory.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-4">
              <a
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3 text-sm font-semibold transition hover:border-white/60 hover:bg-white/10"
                href="mailto:diegoscifo@yahoo.com.ar"
              >
                Start a Conversation
              </a>
              <a
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3 text-sm font-semibold transition hover:border-white/60 hover:bg-white/10"
                href="tel:+542623571423"
              >
                +54 262 357 1423
              </a>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
