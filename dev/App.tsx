import {
  createAtom,
  createAtomSet,
  createAtomResource,
  createAtomValue,
  createAtomMemo,
  createAtomEffect,
  RegistryContext,
  Registry,
} from '../src'
import { RegistryProvider } from '../src/components'
import { For, Show, Suspense, createSignal } from 'solid-js'
import * as Todos from './Todos'
import { getIdAtom } from './worker/client'
import { Counter } from './Counter'
import { HydrationExample } from './HydrationExample'

const PrimitivesShowcase = () => {
  // Showcase the new SolidJS-native primitives
  const [count, setCount] = createAtom(Todos.perPage)
  const doubled = createAtomMemo(Todos.perPage, n => n * 2)
  const tripled = createAtomValue(Todos.perPage, n => n * 3)

  // Demonstrate createAtomEffect for side effects
  createAtomEffect(Todos.perPage, value => {
    console.log('🔄 Per page changed to:', value)
  })

  return (
    <div
      style={{
        padding: '20px',
        border: '2px solid #4ade80',
        'border-radius': '8px',
        'background-color': '#f0fdf4',
        margin: '20px 0',
      }}
    >
      <h2>🧩 SolidJS-Native Primitives</h2>
      <div
        style={{
          display: 'grid',
          'grid-template-columns': 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '15px',
        }}
      >
        <div style={{ padding: '10px', 'background-color': 'white', 'border-radius': '6px' }}>
          <h4>🔢 createAtom</h4>
          <p>
            Value: <strong>{count()}</strong>
          </p>
          <div style={{ display: 'flex', 'flex-direction': 'column', gap: '5px' }}>
            <button onClick={() => setCount(c => c + 1)}>⬆️ +1</button>
            <button onClick={() => setCount(c => c - 1)}>⬇️ -1</button>
          </div>
        </div>

        <div style={{ padding: '10px', 'background-color': 'white', 'border-radius': '6px' }}>
          <h4>🧠 createAtomMemo</h4>
          <p>
            Doubled: <strong>{doubled()}</strong>
          </p>
          <small>Memoized computation</small>
        </div>

        <div style={{ padding: '10px', 'background-color': 'white', 'border-radius': '6px' }}>
          <h4>🔄 createAtomValue</h4>
          <p>
            Tripled: <strong>{tripled()}</strong>
          </p>
          <small>Direct transformation</small>
        </div>

        <div style={{ padding: '10px', 'background-color': 'white', 'border-radius': '6px' }}>
          <h4>⚙️ createAtomEffect</h4>
          <p>Side effects active</p>
          <small>Check console for logs</small>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const registry = Registry.make({
    scheduleTask: (f: () => void) => queueMicrotask(f),
    defaultIdleTTL: 400,
  })

  return (
    <RegistryProvider registry={registry}>
      <div style={{ padding: '20px' }}>
        <h1>🚀 atom-solid: SolidJS-Native Primitives</h1>
        <p>Clean, focused primitives for Effect-Atom integration with SolidJS</p>

        {/* New Primitives Showcase */}
        <PrimitivesShowcase />

        {/* Hydration Example */}
        <HydrationExample />

        {/* Original Examples */}
        <div style={{ 'margin-top': '40px' }}>
          <Counter />
          <WorkerWrap />

          <h3>Stream list</h3>
          <Suspense fallback={<p>Loading...</p>}>
            <TodoStreamList />
          </Suspense>
          <PullButton />
          <br />
          <PerPageSelect />

          <h3>Effect list</h3>
          <Suspense fallback={<p>Loading...</p>}>
            <TodoEffectList />
          </Suspense>
        </div>
      </div>
    </RegistryProvider>
  )
}

const TodoStreamList = () => {
  const result = createAtomValue(Todos.stream)
  return (
    <>
      <Show
        when={(() => {
          const res = result()
          return res?._tag === 'Success' && res.value
        })()}
      >
        {res => (
          <div style={{ 'text-align': 'left' }}>
            <For each={res().items}>{todo => <Todo todo={todo} />}</For>
          </div>
        )}
      </Show>
      <p>{result()?.waiting ? 'Waiting' : 'Loaded'}</p>
    </>
  )
}

const TodoEffectList = () => {
  const todos = createAtomResource(Todos.effect)
  return (
    <Show
      when={(() => {
        const res = todos()
        return res?._tag === 'Success' && res
      })()}
    >
      {res => (
        <div style={{ 'text-align': 'left' }}>
          <For each={res().value}>{todo => <Todo todo={todo} />}</For>
        </div>
      )}
    </Show>
  )
}

function Todo({ todo }: { readonly todo: Todos.Todo }) {
  return (
    <p>
      <input checked={todo.completed} type="checkbox" disabled />
      &nbsp;{todo.title}
    </p>
  )
}

const PullButton = () => {
  const pull = createAtomSet(Todos.stream)
  const done = createAtomValue(Todos.streamIsDone)
  return (
    <button onClick={() => pull()} disabled={done()}>
      Pull more
    </button>
  )
}

const PerPageSelect = () => {
  const [n, set] = createAtom(Todos.perPage)
  return (
    <label>
      Per page:
      <select value={n()} onChange={e => set(Number(e.target.value))}>
        <option value="5">5</option>
        <option value="10">10</option>
        <option value="20">20</option>
        <option value="55">55</option>
      </select>
    </label>
  )
}

function WorkerWrap() {
  const [mount, setMount] = createSignal(false)
  return (
    <>
      <button onClick={() => setMount(_ => !_)}>{mount() ? 'Stop' : 'Start'} worker</button>
      <Show when={mount()}>
        <WorkerButton />
      </Show>
    </>
  )
}

function WorkerButton() {
  const getById = createAtomSet(getIdAtom)
  return <button onClick={() => getById('123')}>Get ID from worker</button>
}
