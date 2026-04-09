import { NextResponse } from "next/server";

const careerData = {
  name: "Diego Scifo",
  title: "Java Tech Lead",
  location: "Mendoza, Argentina",
  bio: "I am a Java engineer who thrives in environments where clarity, accountability, and product impact matter. I enjoy aligning teams around shared outcomes, translating complexity into actionable roadmaps, and building dependable systems that scale with the business. My leadership style blends structure with empathy so teams move fast without breaking quality.",
  journey: [
    {
      period: "Dec 2019 – Present",
      title: "Associate Specialist Engineer · Java Tech Lead",
      company: "GlobalLogic Latinoamérica",
      location: "Mendoza, Argentina",
      details: "Leading Java delivery with a focus on reliability, clean architecture, and team momentum. Modern Java stack, microservices, and API integration for enterprise clients."
    },
    {
      period: "Jul 2017 – Dec 2019",
      title: "Java Software Developer",
      company: "Aconcagua Software Factory S.A.",
      location: "Mendoza, Argentina",
      details: "Java 8, Spring, Hibernate, MySQL, Redis, AWS."
    },
    {
      period: "Aug 2015 – Dec 2019",
      title: "Project Leader",
      company: "Aconcagua Software Factory S.A.",
      location: "Mendoza, Argentina",
      details: "Project planning, CMMI documentation control, and feature analysis."
    },
    {
      period: "Nov 2013 – Jul 2015",
      title: "Analyst",
      company: "Aconcagua Software Factory S.A.",
      location: "Mendoza, Argentina",
      details: "Artifact construction and requirements analysis."
    },
    {
      period: "Mar 2012 – Nov 2013",
      title: "Maintenance Project Leader",
      company: "Aconcagua Software Factory S.A.",
      location: "Argentina",
      details: "Support team leadership for maintenance operations."
    },
    {
      period: "Mar 2010 – Mar 2012",
      title: "Programmer & QA",
      company: "Aconcagua Software Factory S.A.",
      location: "Argentina",
      details: "PHP, Oracle SQL, test case design and execution."
    },
    {
      period: "Aug 2008 – Dec 2008",
      title: "Programmer",
      company: "Sommet",
      location: "Argentina",
      details: "Maintenance, bug fixes, and QA execution."
    }
  ],
  skills: [
    "Java Platform", "Object-Oriented Design", "Java EE", "JPA / Hibernate",
    "Web Services", "JSF / PrimeFaces", "JAX-RS", "Spring 4.3", "Spring Boot",
    "Angular 5+", "HTML5", "Microservices"
  ],
  education: "Universidad Tecnológica Nacional, Ingeniero en Sistemas de Información (2001 – 2011)"
};

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "API Key missing" }, { status: 500 });
    }

    const systemPrompt = `
      You are Diego Scifo's Digital Twin. You are an expert AI version of Diego Scifo, a Java Tech Lead based in Mendoza, Argentina.
      Your goal is to answer questions about Diego's career, skills, and professional mindset based on the following data:
      
      CAREER OVERVIEW:
      ${careerData.bio}
      
      SKILLS:
      ${careerData.skills.join(", ")}
      
      EXPERIENCE:
      ${careerData.journey.map(j => `- ${j.period}: ${j.title} at ${j.company}. ${j.details}`).join("\n")}
      
      EDUCATION:
      ${careerData.education}

      GUIDELINES:
      - Be professional, technical, yet approachable.
      - Speak in the first person ("I", "my") as if you are Diego's twin.
      - If asked about things not in your background, politely state that it's outside your current professional scope but you're always curious about new technologies.
      - Keep responses concise and impactful.
    `;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://diegoscifo.com.ar", // Optional, for OpenRouter tracking
        "X-Title": "Diego Scifo Digital Twin", // Optional
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b:free",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages
        ]
      })
    });

    const data = await response.json();
    
    if (data.error) {
      console.error("OpenRouter Error:", data.error);
      return NextResponse.json({ error: data.error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Chat API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
