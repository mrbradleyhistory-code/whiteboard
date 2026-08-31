import { getFurniture, getSeatDefs } from '../seatingChart'
import { studentNameById } from '../localClassData'
import { openSeatingPngWindow } from '../exportSeatingPng'
import { VIEW_CELL_SIZE } from '../seatLabels'
import SeatingRoomCanvas from './SeatingRoomCanvas'
import { HubButton } from './hubUi'

/** Read-only seating preview for the lesson runner. */
export default function RunnerSeatingView({ chart, students, title = 'Seating chart' }) {
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

  const studentName = (id) => studentNameById(students, id)

  return (
    <div className="wb-runner-seating">
      <div className="wb-room-export">
        <HubButton onClick={() => openSeatingPngWindow({ chart, studentName, title })}>
          Export PNG
        </HubButton>
      </div>
      <SeatingRoomCanvas
        chart={chart}
        designMode={false}
        cellSize={VIEW_CELL_SIZE}
        selectedId={null}
        studentName={studentName}
        onSeatClick={() => {}}
      />
    </div>
  )
}
