// Module-level store — survives component unmounts, shared across all hook instances
let _ids = new Set()
const _subs = new Set()

function notify() { _subs.forEach(fn => fn(new Set(_ids))) }

export const unreadStore = {
  add(id)    { _ids.add(id);    notify() },
  remove(id) { _ids.delete(id); notify() },
  replace(ids) {
    _ids = new Set(ids || [])
    notify()
  },
  clear()    { _ids.clear();    notify() },
  get()      { return new Set(_ids) },
  subscribe(fn) { _subs.add(fn); return () => _subs.delete(fn) },
}
