const steps = ['Elige tu descuento', 'Actívalo', 'Muéstralo al pagar y ahorra']

export default function LatidoCardUsageSteps({ id }) {
  return (
    <ol className="lc-usage-steps" id={id}>
      {steps.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  )
}
