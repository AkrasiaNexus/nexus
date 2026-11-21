import { useState, useEffect } from "react";

export function useStore(store) {
  const [state, setState] = useState(store.getAll());
  useEffect(() => store.subscribe(setState), [store]);
  return state;
}
