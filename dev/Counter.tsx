import { createEffect } from 'solid-js'
import { Rx, useRx, useRxValue } from 'src'

export const Counter = () => {
  const count = Rx.make(0)
  const [cntVal, setCount] = useRx(count)
  const doubleCnt = useRxValue(count, v => v * 2)

  return (
    <div>
      Original: {cntVal()}
      Doubled: {doubleCnt()}
      <button onClick={() => setCount(cntVal() + 1)}>+</button>
    </div>
  )
}
