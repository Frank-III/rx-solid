import { createEffect } from 'solid-js'
import { Rx, useRx } from 'src'

export const Counter = () => {
  const count = Rx.make(0)
  const [cntVal, setCount] = useRx(count)

  return (
    <div>
      {cntVal()}
      <button onClick={() => setCount(cntVal() + 1)}>+</button>
    </div>
  )
}
