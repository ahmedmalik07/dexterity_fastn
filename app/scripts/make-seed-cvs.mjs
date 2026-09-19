#!/usr/bin/env node
/**
 * Generates the five test CVs from the spec into ../seed/.
 * All names and contact details are fictional.
 *
 *   node scripts/make-seed-cvs.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "..", "seed");
mkdirSync(outDir, { recursive: true });

const CVS = [
  {
    file: "1-strong-react.pdf",
    lines: [
      "AYESHA NOOR",
      "ayesha.noor@example.com | +92 300 1234567 | Islamabad",
      "github.com/example-ayesha",
      "",
      "SUMMARY",
      "Frontend developer with 2 years building production React applications.",
      "",
      "EXPERIENCE",
      "Frontend Developer, Fictional Softworks (2024 - present)",
      "- Built and shipped 4 customer dashboards in React 18 and TypeScript.",
      "- Migrated a legacy jQuery admin panel to Next.js App Router.",
      "- Wrote unit and integration tests with Jest and React Testing Library.",
      "- Cut first-contentful-paint from 4.1s to 1.3s by code-splitting routes.",
      "",
      "Junior Web Developer, Madeup Digital (2023 - 2024)",
      "- Built responsive marketing pages in React and Tailwind CSS.",
      "- Integrated REST APIs and handled form validation with Zod.",
      "",
      "PROJECTS",
      "expense-tracker - Next.js + TypeScript + Postgres, 300 monthly users.",
      "ui-kit - open source React component library, 40 GitHub stars.",
      "",
      "SKILLS",
      "React, Next.js, TypeScript, JavaScript, HTML, CSS, Tailwind, Git, Jest, REST APIs",
      "",
      "EDUCATION",
      "BS Computer Science, Fictional University Islamabad, 2023",
    ],
  },
  {
    file: "2-strong-react-native.pdf",
    lines: [
      "BILAL AHMED",
      "bilal.ahmed@example.com | +92 321 7654321 | Lahore",
      "portfolio: example-bilal.dev",
      "",
      "SUMMARY",
      "Mobile and web developer, 3 years across React Native and React for web.",
      "",
      "EXPERIENCE",
      "React Native Developer, Imaginary Apps (2023 - present)",
      "- Shipped two React Native apps to the Play Store, 20k combined installs.",
      "- Shared a TypeScript component layer between the app and its React web portal.",
      "- Set up CI with GitHub Actions running type checks and tests on every PR.",
      "",
      "Web Developer (contract), Various clients (2022 - 2023)",
      "- Built React single page apps for three small businesses.",
      "- Handled state with Redux Toolkit and later with React Query.",
      "",
      "PROJECTS",
      "habit-app - React Native + Expo, offline-first, SQLite sync.",
      "weather-web - React + Vite dashboard consuming a public REST API.",
      "",
      "SKILLS",
      "React, React Native, TypeScript, JavaScript, Redux, React Query, Git, Expo, CSS",
      "",
      "EDUCATION",
      "BSc Software Engineering, Invented Institute of Technology, 2022",
    ],
  },
  {
    file: "3-maybe-html-css.pdf",
    lines: [
      "SANA TARIQ",
      "sana.tariq@example.com | +92 333 5551234 | Rawalpindi",
      "",
      "SUMMARY",
      "Web designer moving into frontend development. Strong HTML, CSS and JavaScript.",
      "",
      "EXPERIENCE",
      "Web Designer, Pretend Media House (2023 - present)",
      "- Hand-coded 30+ landing pages in semantic HTML and CSS.",
      "- Wrote vanilla JavaScript for sliders, modals and form validation.",
      "- Built two WordPress themes from Figma designs.",
      "",
      "Intern, Nonexistent Agency (2022)",
      "- Converted PSD designs into responsive HTML and CSS.",
      "",
      "PROJECTS",
      "recipe-site - static site, vanilla JavaScript, fetches a public API.",
      "portfolio - CSS grid and flexbox, no framework.",
      "",
      "SKILLS",
      "HTML, CSS, JavaScript, Bootstrap, Figma, WordPress, Git",
      "Completed an online 'Intro to React' course in 2024, no professional React work yet.",
      "",
      "EDUCATION",
      "BA Graphic Design, Fictional Arts College, 2022",
    ],
  },
  {
    file: "4-weak-java-backend.pdf",
    lines: [
      "USMAN KHAN",
      "usman.khan@example.com | +92 345 9876543 | Karachi",
      "",
      "SUMMARY",
      "Backend engineer with 4 years in Java and Spring Boot microservices.",
      "",
      "EXPERIENCE",
      "Senior Java Developer, Make-Believe Systems (2022 - present)",
      "- Designed and maintained 6 Spring Boot microservices on AWS ECS.",
      "- Tuned PostgreSQL queries, cutting p95 latency from 800ms to 120ms.",
      "- Built Kafka consumers handling 2 million events per day.",
      "",
      "Java Developer, Hypothetical Bank Tech (2020 - 2022)",
      "- Maintained a core banking batch system in Java 8.",
      "- Wrote JUnit test suites and Jenkins build pipelines.",
      "",
      "SKILLS",
      "Java, Spring Boot, Hibernate, PostgreSQL, Kafka, Docker, AWS, Maven, JUnit, Jenkins",
      "",
      "EDUCATION",
      "MS Computer Science, Imaginary National University, 2020",
    ],
  },
];

async function textCv({ file, lines }) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  for (const [index, line] of lines.entries()) {
    const isHeading = index === 0 || /^[A-Z][A-Z\s]{3,}$/.test(line);
    page.drawText(line, {
      x: 45,
      y,
      size: index === 0 ? 16 : isHeading ? 11 : 9.5,
      font: index === 0 || isHeading ? bold : font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= index === 0 ? 24 : isHeading ? 16 : 13;
  }

  writeFileSync(join(outDir, file), await pdf.save());
  console.log("✓", file);
}

/** A scanned-looking CV: shapes only, no extractable text. Tests the fallback path. */
async function imageOnlyCv() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);

  page.drawRectangle({ x: 45, y: 760, width: 260, height: 20, color: rgb(0.25, 0.25, 0.25) });
  page.drawRectangle({ x: 45, y: 735, width: 380, height: 8, color: rgb(0.6, 0.6, 0.6) });

  let y = 690;
  for (let block = 0; block < 6; block++) {
    page.drawRectangle({ x: 45, y, width: 150, height: 10, color: rgb(0.35, 0.35, 0.35) });
    y -= 22;
    for (let line = 0; line < 4; line++) {
      page.drawRectangle({
        x: 45,
        y,
        width: 420 - Math.random() * 120,
        height: 6,
        color: rgb(0.72, 0.72, 0.72),
      });
      y -= 14;
    }
    y -= 14;
  }

  writeFileSync(join(outDir, "5-unreadable-scan.pdf"), await pdf.save());
  console.log("✓ 5-unreadable-scan.pdf (no extractable text, by design)");
}

for (const cv of CVS) await textCv(cv);
await imageOnlyCv();
console.log(`\nSeed CVs written to ${outDir}`);
