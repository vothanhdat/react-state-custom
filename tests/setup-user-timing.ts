// Browsers have console.timeStamp and performance.measure, and React's development build then records
// every render for the Performance panel, diffing the props of each component that re-renders. Node's
// console in vitest lacks timeStamp, which turns that off: provide it before react-dom loads.
if (typeof console.timeStamp !== 'function') console.timeStamp = () => { }
