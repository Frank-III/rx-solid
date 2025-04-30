import { createEffect } from 'solid-js'
import { createRx, createRxValue, createRxValueMemo, Rx } from 'src'

export const Counter = () => {
  const count = Rx.make(0)
  const [cntVal, setCount] = createRx(count)
  const doubleCnt = createRxValue(count, v => v * 2)
  const tripleCntStr = createRxValueMemo(count, v => String(v * 3))

  return (
    <div>
      Original: {cntVal()}
      Doubled: {doubleCnt()}
      Tripled: {tripleCntStr()}
      <button onClick={() => setCount(cntVal() + 1)}>+</button>
    </div>
  )
}
