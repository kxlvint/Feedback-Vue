import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

// Plugins are registered on the dayjs singleton, so this must happen exactly once.
// Doing it in a module means the import graph guarantees that: the side effect runs
// on first import and never again, no matter how many components use the helpers.
dayjs.extend(relativeTime)

/** "3 hours ago" — for the timestamp shown on each feedback item. */
export function fromNow(iso: string): string {
  return dayjs(iso).fromNow()
}

/** "30 Oct 2026, 2:14 PM" — the exact time, for tooltips and <time> titles. */
export function formatExact(iso: string): string {
  return dayjs(iso).format('D MMM YYYY, h:mm A')
}

export { dayjs }
