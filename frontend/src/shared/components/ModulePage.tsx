type ModulePageProps = {
  title: string
  description: string
}

export function ModulePage({ title, description }: ModulePageProps) {
  return (
    <section className="panel">
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  )
}

