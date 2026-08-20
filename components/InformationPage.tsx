import Link from "next/link";
import PublicHeader from "./PublicHeader";

export type InformationSection = { title: string; paragraphs: string[] };

export default function InformationPage({ eyebrow, title, intro, sections }: { eyebrow: string; title: string; intro: string; sections: InformationSection[] }) {
  return <main className="information-page"><PublicHeader /><header className="information-heading shell"><Link href="/">← Volver al inicio</Link><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{intro}</p></header><article className="information-content shell">{sections.map((section) => <section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>)}</article></main>;
}
