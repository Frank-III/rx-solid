import {
  useRx,
  useRxSet,
  useRxSuspense,
  useRxValue,
  RegistryContext,
  defaultRegistry,
} from '../src'
import { For, Show, Suspense, createSignal } from 'solid-js'
import * as Todos from './Todos'
import { getIdRx } from './worker/client'
import { Counter } from './Counter'

export default function App() {
  return (
    <RegistryContext.Provider value={defaultRegistry}>
      <Counter />
      {/* <WorkerWrap /> */}
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
    </RegistryContext.Provider>
  )
}

const TodoStreamList = () => {
  const result = useRxSuspense(Todos.stream)
  return (
    <Show when={result()?._tag === 'Success'}>
      <div style={{ 'text-align': 'left' }}>
        {result().value.items.map(todo => (
          <Todo key={todo.id} todo={todo} />
        ))}
      </div>
    </Show>
  )
}

const TodoEffectList = () => {
  const todos = useRxSuspense(Todos.effect)
  return (
    <div style={{ 'text-align': 'left' }}>
      {todos()?.value.map(todo => <Todo key={todo.id} todo={todo} />)}
    </div>
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
  const pull = useRxSet(Todos.stream)
  const done = useRxValue(Todos.streamIsDone)
  return (
    <button onClick={() => pull()} disabled={done()}>
      Pull more
    </button>
  )
}

const PerPageSelect2 = () => {
  const [n, setN] = createSignal(5)

  return (
    <label>
      Per page:
      <select
        value={n()}
        onChange={e => {
          const value = parseInt(e.currentTarget.value, 10)
          console.log('selected:', value)
          setN(value)
        }}
      >
        <option value="5">5</option>
        <option value="10">10</option>
        <option value="20">20</option>
        <option value="55">55</option>
      </select>
    </label>
  )
}

const PerPageSelect = () => {
  const [n, set] = useRx(Todos.perPage)
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
  const getById = useRxSet(getIdRx)
  return <button onClick={() => getById('123')}>Get ID from worker</button>
}
