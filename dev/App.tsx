import {
  createRx,
  createRxSet,
  createRxSuspense,
  createRxValue,
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
    </RegistryContext.Provider>
  )
}

const TodoStreamList = () => {
  const result = createRxSuspense(Todos.stream)
  return (
    <>
      <Show
        when={(() => {
          const res = result()
          return res?._tag === 'Success' && res
        })()}
      >
        {res => (
          <div style={{ 'text-align': 'left' }}>
            <For each={res().value.items}>{todo => <Todo todo={todo} />}</For>
          </div>
        )}
      </Show>
      <p>{result()?.waiting ? 'Waiting' : 'Loaded'}</p>
    </>
  )
}

const TodoEffectList = () => {
  const todos = createRxSuspense(Todos.effect)
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
  const pull = createRxSet(Todos.stream)
  const done = createRxValue(Todos.streamIsDone)
  return (
    <button onClick={() => pull()} disabled={done()}>
      Pull more
    </button>
  )
}

const PerPageSelect = () => {
  const [n, set] = createRx(Todos.perPage)
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
  const getById = createRxSet(getIdRx)
  return <button onClick={() => getById('123')}>Get ID from worker</button>
}
