import { createEffect } from 'solid-js'
import { createRx, createRxValue, Rx } from 'src'

export const Counter = () => {
  const count = Rx.make(0)
  const [cntVal, setCount] = createRx(count)
  const doubleCnt = createRxValue(count, v => v * 2)

  return (
    <div>
      Original: {cntVal()}
      Doubled: {doubleCnt()}
      <button onClick={() => setCount(cntVal() + 1)}>+</button>
    </div>
  )
}
