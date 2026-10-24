const faqs = [
  { question: "¿Cuánto tardan en preparar mi pedido?", answer: "Trabajamos a pedido: la fabricación toma entre 3 y 5 días hábiles. Después, el envío por BlueExpress suma 1 a 2 días más." },
  { question: "¿Hacen envíos a regiones?", answer: "Sí, enviamos todos los días a todo Chile con BlueExpress. La tarifa es fija: $3.500 para cualquier parte del país." },
  { question: "¿De qué material están hechos los cortadores?", answer: "Nuestros cortadores se fabrican en plástico de uso alimentario, liviano y diseñado para lograr cortes definidos." },
  { question: "¿Puedo lavar mis cortadores con agua caliente?", answer: "Recomendamos lavarlos a mano con agua fría o tibia y jabón suave. No uses agua caliente ni lavavajillas, porque el calor puede deformarlos." },
];

export default function ProductBenefitsFaq() {
  return <>
    <section className="product-benefits shell" aria-labelledby="product-benefits-title">
      <div className="benefits-intro"><h2 id="product-benefits-title">Diseñados para durar</h2><p>Creamos herramientas mágicas utilizando tecnología de impresión 3D de alta precisión y materiales amigables con el planeta.</p></div>
      <div className="benefit-cards">
        <article><span aria-hidden="true">🌱</span><strong>Material Bio-Plástico</strong><h3>PLA Premium</h3><p>Material liviano de origen vegetal, ideal para crear formas precisas.</p></article>
        <article><span aria-hidden="true">✦</span><strong>Alta precisión</strong><h3>Impresión 3D</h3><p>Bordes definidos y detalles nítidos para resultados consistentes.</p></article>
        <article><span aria-hidden="true">♡</span><strong>Hecho con cariño</strong><h3>Producción local</h3><p>Cada molde se prepara especialmente para tu pedido.</p></article>
      </div>
    </section>
    <section className="product-faq shell" aria-labelledby="product-faq-title">
      <h2 id="product-faq-title" className="faq-main-title">¿Tienes dudas? ¡Te ayudamos!</h2>
      <div>
        {faqs.map((faq) => <details key={faq.question}><summary>{faq.question}<span aria-hidden="true">⌄</span></summary><p>{faq.answer}</p></details>)}
      </div>
    </section>
  </>;
}
