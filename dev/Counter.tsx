import { createRx, createRxValue, createRxMemo, Rx } from 'src'

const count = Rx.make(0)

export const Counter = () => {
  const [cntVal, setCount] = createRx(count)
  const doubleCnt = createRxValue(count, v => v * 2)
  const tripleCntStr = createRxMemo(count, v => String(v * 3))

  return (
    <div>
      Original: {cntVal()}
      Doubled: {doubleCnt()}
      Tripled: {tripleCntStr()}
      <button onClick={() => setCount(cntVal() + 1)}>+</button>
    </div>
  )
}
