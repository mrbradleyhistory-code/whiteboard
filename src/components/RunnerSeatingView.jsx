import { getSeatDefs, studentAtSeat } from '../seatingChart'
import { studentNameById } from '../localClassData'

export default function RunnerSeatingView({ chart, students }) {
  if (!chart) {
    return (
      <p className="wb-lesson-runner__panel-empty">
        No seating chart for this class. Build one in Class tools → Groups &amp; seating.
      </p>
    )
  }

  const seats = getSeatDefs(chart)
  if (!seats.length) {
    return <p className="wb-lesson-runner__panel-empty">This chart has no desks yet.</p>
  }

  const rows = chart.rows || 5
  const cols = chart.cols || 6
  const seatKeys = new Set(seats.map(s => s.key))

  const renderCell = (row, col) => {
    const key = `${row}-${col}`
    if (!seatKeys.has(key)) {
      return <div key={key} className="wb-seating__void" aria-hidden />
    }
    const studentId = studentAtSeat(chart.assignments, key)
    const name = studentId ? studentNameById(students, studentId) : ''
    return (
      <div
        key={key}
        className={`wb-seating__seat wb-runner-seating__seat${studentId ? ' wb-seating__seat--filled' : ''}`}
      >
        {name ? (
          <span className="wb-seating__name">{name}</span>
        ) : (
          <span className="wb-seating__empty">—</span>
        )}
      </div>
    )
  }

  return (
    <div className="wb-runner-seating">
      <p className="wb-hub-hint wb-runner-seating__front">Front of room</p>
      <div className="wb-seating__grid-wrap">
        <div
          className="wb-seating__grid wb-runner-seating__grid"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(52px, 1fr))` }}
        >
          {Array.from({ length: rows }, (_, row) =>
            Array.from({ length: cols }, (_, col) => renderCell(row, col)),
          )}
        </div>
      </div>
    </div>
  )
}
