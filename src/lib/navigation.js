// React Router increments idx only for navigation inside this app. An external
// link starts at zero, even when the browser has other pages in its history.
export function returnWithinApp(navigate, fallback, historyState = typeof window === 'undefined' ? null : window.history.state) {
  if (Number.isInteger(historyState?.idx) && historyState.idx > 0) {
    navigate(-1)
  } else {
    navigate(fallback, { replace:true })
  }
}
