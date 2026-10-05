// react-state-custom/schedulers: when readers re-render for a change, as the `schedule` option of
// createStore, useStore and useMultipleStore takes it, and the helpers built on the same queues.
// Each factory is imported only where it is used, so an app that schedules nothing ships none of them.
export { scheduled, sync, type Scheduler, type ScheduledTask } from "../state-utils/schedule"
export { frame, throttle, debounce, idle } from "../state-utils/schedulers"
export { useFrameState } from "../state-utils/useFrameState"
