import { createAtom, createAtomValue, createAtomMemo, Atom } from 'src'

const count = Atom.make(0)

export const Counter = () => {
  const [cntVal, setCount] = createAtom(count)
  const doubleCnt = createAtomValue(count, v => v * 2)
  const tripleCntStr = createAtomMemo(count, v => String(v * 3))

  return (
    <div>
      Original: {cntVal()}
      Doubled: {doubleCnt()}
      Tripled: {tripleCntStr()}
      <button onClick={() => setCount(cntVal() + 1)}>+</button>
    </div>
  )
}
