import { getFurniture, getSeatDefs, studentAtSeat } from '../seatingChart'
import { studentNameById } from '../localClassData'
import SeatingRoomCanvas from './SeatingRoomCanvas'

/** Read-only seating preview for the lesson runner. */
export default function RunnerSeatingView({ chart, students }) {
  if (!chart) {
    return (
      <p className="wb-lesson-runner__panel-empty">
        No seating chart for this class. Build one in Class tools → Groups &amp; seating.
      </p>
    )
  }

  const seats = getSeatDefs(chart)
  if (!seats.length && !getFurniture(chart).length) {
    return <p className="wb-lesson-runner__panel-empty">This chart has no desks yet.</p>
  }

  return (
    <div className="wb-runner-seating">
      <SeatingRoomCanvas
        chart={chart}
        designMode={false}
        selectedId={null}
        studentName={(id) => studentNameById(students, id)}
        onSeatClick={() => {}}
      />
    </div>
  )
}
