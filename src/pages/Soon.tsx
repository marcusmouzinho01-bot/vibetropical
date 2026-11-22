export default function Soon({ title, stage }: { title: string; stage: number }) {
  return <div className="rounded-3xl border-2 border-dashed border-leaf/30 bg-white p-10 text-center">
    <h1 className="font-script text-5xl text-leaf">{title}</h1>
    <p className="mt-2 text-deep/70">Este módulo será construído na etapa {stage}.</p></div>
}
