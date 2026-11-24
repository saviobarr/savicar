// Verifica se um custo (recorrente ou eventual) possui alguma ocorrência dentro do período [start, end]
// start e end são strings "YYYY-MM-DD"
export function custoNoPeriodo(item, start, end) {
  const recurrence = item.recurrence != null ? Number(item.recurrence) : 0

  if (recurrence === 0) {
    if (!item.reference_date) return true
    const d = item.reference_date.substring(0, 10)
    return d >= start && d <= end
  }

  const startDate = new Date(start + 'T00:00:00')
  const endDate   = new Date(end   + 'T00:00:00')

  if (recurrence === 30) {
    // Mensal com due_day: verifica se o dia de vencimento cai em algum mês do período
    const dueDay = item.due_day
    if (!dueDay) return true
    let cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
    while (cur <= endDate) {
      const daysInMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate()
      const actualDay   = Math.min(dueDay, daysInMonth)
      const occurrence  = new Date(cur.getFullYear(), cur.getMonth(), actualDay)
      if (occurrence >= startDate && occurrence <= endDate) return true
      cur.setMonth(cur.getMonth() + 1)
    }
    return false
  }

  if (recurrence === 1) return true // diário: sempre ocorre

  // Para recorrências com intervalo fixo, usa reference_date como ponto de partida
  if (!item.reference_date) return true
  const refDate = new Date(item.reference_date.substring(0, 10) + 'T00:00:00')

  // Calcula quantos intervalos são necessários para atingir ou passar o início do período
  const msPerDay = 86400000
  const diffDays = Math.ceil((startDate - refDate) / msPerDay)
  const startN   = diffDays > 0 ? Math.ceil(diffDays / recurrence) : 0
  const firstHit = new Date(refDate.getTime() + startN * recurrence * msPerDay)
  return firstHit <= endDate
}

export function somaCustosOperacionaisNoPeriodo(items, start, end) {
  return items
    .filter(c => custoNoPeriodo(c, start, end))
    .reduce((acc, c) => acc + Number(c.amount ?? 0), 0)
}
