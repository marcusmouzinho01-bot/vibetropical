// Nome da marca em um só lugar. A logo do Instagram diz "Vibe Tropical"; o comando dizia "Viber". Confirmar com a cliente.
export const BRAND = 'Vibe Tropical'
export const brl = (n: number) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n)
export const dayKey = (d: Date) => d.toLocaleDateString('en-CA')
