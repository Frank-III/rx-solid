/**
 * @since 1.0.0
 */
import * as Registry from '@effect-atom/atom/Registry'
import * as Result from '@effect-atom/atom/Result'
import * as Atom from '@effect-atom/atom/Atom'
import type * as AtomRef from '@effect-atom/atom/AtomRef'
import * as Cause from 'effect/Cause'
import type * as Exit from 'effect/Exit'
import { globalValue } from 'effect/GlobalValue'
import {
  createContext,
  useContext,
  createSignal,
  createEffect,
  createMemo,
  onCleanup,
  Accessor,
  createResource,
  Resource,
} from 'solid-js'

// Module exports remain the same
export * as Registry from '@effect-atom/atom/Registry'
export * as Result from '@effect-atom/atom/Result'
export * as Atom from '@effect-atom/atom/Atom'
export * as AtomRef from '@effect-atom/atom/AtomRef'

function scheduleTask(f: () => void): void {
  queueMicrotask(f)
}

export const RegistryContext = createContext<Registry.Registry>(
  Registry.make({
    scheduleTask,
    defaultIdleTTL: 400,
  }),
)

interface AtomStore<A> {
  readonly subscribe: (f: () => void) => () => void
  readonly snapshot: () => A
}

export const storeRegistry = globalValue(
  '@effect-rx/atom-solid/storeRegistry',
  () => new WeakMap<Registry.Registry, WeakMap<Atom.Atom<any>, AtomStore<any>>>(),
)

function makeStore<A>(registry: Registry.Registry, atom: Atom.Atom<A>): AtomStore<A> {
  let stores = storeRegistry.get(registry)
  if (stores === undefined) {
    stores = new WeakMap()
    storeRegistry.set(registry, stores)
  }
  const store = stores.get(atom)
  if (store !== undefined) {
    return store
  }
  const newStore: AtomStore<A> = {
    subscribe(f) {
      return registry.subscribe(atom, f)
    },
    snapshot() {
      return registry.get(atom)
    },
  }
  stores.set(atom, newStore)
  return newStore
}

function useStore<A>(registry: Registry.Registry, atom: Atom.Atom<A>): Accessor<A> {
  const [value, setValue] = createSignal(registry.get(atom))

  const unsubscribe = registry.subscribe(atom, (value: A) => setValue(() => value))
  onCleanup(unsubscribe)

  return value
}

export const initialValuesSet = globalValue(
  '@effect-rx/atom-solid/initialValuesSet',
  () => new WeakMap<Registry.Registry, WeakSet<Atom.Atom<any>>>(),
)

// SolidJS-native hydration utilities (inspired by solid-events)

/**
 * Extract state from the current registry for serialization.
 * This follows SolidJS patterns for SSR state transfer.
 *
 * @example
 * // On server:
 * const state = extractAtomState(registry)
 * // Serialize state to HTML or pass as props
 */
export const extractAtomState = (registry: Registry.Registry): Array<readonly [any, any]> => {
  const state: Array<readonly [any, any]> = []
  registry.getNodes().forEach((node, atom) => {
    // Only extract serializable Atom values
    if (typeof atom !== 'function') {
      const value = node.value()
      state.push([atom, value] as const)
    }
  })
  return state
}

/**
 * Create a state extractor function for the current registry context.
 * Useful for SSR scenarios.
 */
export const createAtomStateExtractor = () => {
  const registry = useContext(RegistryContext)
  return () => extractAtomState(registry)
}

/**
 * Initialize Atom values with hydrated state.
 * This should be called early in your app setup, similar to solid-events.
 *
 * @example
 * // In your root component:
 * createAtomHydration(hydratedState)
 */
export const createAtomHydration = (
  initialValues: Iterable<readonly [Atom.Atom<any>, any]>,
): void => {
  const registry = useContext(RegistryContext)
  let set = initialValuesSet.get(registry)
  if (set === undefined) {
    set = new WeakSet()
    initialValuesSet.set(registry, set)
  }
  for (const [atom, value] of initialValues) {
    if (!set.has(atom)) {
      set.add(atom)
      ;(registry as any).ensureNode(atom).setValue(value)
    }
  }
}

// Legacy alias for backward compatibility
export const createAtomInitialValues = createAtomHydration

/**
 * Subscribe to an Atom value and return a SolidJS Accessor.
 *
 * @example
 * const count = Atom.make(0)
 * const countValue = createAtomValue(count)
 * const doubled = createAtomValue(count, n => n * 2)
 */
export const createAtomValue = <A, B = A>(atom: Atom.Atom<A>, f?: (_: A) => B): Accessor<A | B> => {
  const registry = useContext(RegistryContext)

  if (f) {
    // Create a derived Atom and subscribe to it
    const derivedAtom = createMemo(() => Atom.map(atom, f))
    return useStore(registry, derivedAtom())
  }

  return useStore(registry, atom)
}

/**
 * Create a computed Atom value using SolidJS createMemo.
 * This is optimized for cases where the mapping function is expensive.
 *
 * @example
 * const count = Atom.make(0)
 * const expensive = createAtomMemo(count, n => expensiveComputation(n))
 */
export const createAtomMemo = <A, B>(atom: Atom.Atom<A>, f: (_: A) => B): Accessor<B> => {
  const registry = useContext(RegistryContext)
  const memoizedAtom = createMemo(() => Atom.map(atom, f))
  return useStore(registry, memoizedAtom())
}

function mountAtom<A>(registry: Registry.Registry, atom: Atom.Atom<A>): void {
  const unlisten = registry.mount(atom)
  onCleanup(unlisten)
}

/**
 * Create a side effect that runs when an Atom value changes.
 * Uses SolidJS createEffect for reactive side effects.
 *
 * @example
 * const count = Atom.make(0)
 * createAtomEffect(count, (value) => {
 *   console.log('Count changed:', value)
 * })
 */
export const createAtomEffect = <A>(
  atom: Atom.Atom<A>,
  fn: (value: A) => void,
  options?: { immediate?: boolean },
): void => {
  const value = createAtomValue(atom)

  createEffect(() => {
    fn(value())
  })

  // Also handle immediate execution if requested
  if (options?.immediate) {
    fn(value())
  }
}

/**
 * Mount an Atom value to keep it active.
 * This ensures the Atom value stays subscribed and doesn't get garbage collected.
 */
export const createAtomMount = <A>(atom: Atom.Atom<A>): void => {
  const registry = useContext(RegistryContext)
  mountAtom(registry, atom)
}

/**
 * Create a setter function for a writable Atom value.
 * Use this when you only need the setter, not the getter.
 *
 * @example
 * const countAtom = Atom.make(0)
 * const setCount = createAtomSet(countAtom)
 *
 * setCount(n => n + 1)
 * setCount(42)
 */
export const createAtomSet = <R, W>(atom: Atom.Writable<R, W>) => {
  const registry = useContext(RegistryContext)
  mountAtom(registry, atom)

  return (value: W | ((_: R) => W)) => {
    if (typeof value === 'function') {
      registry.set(atom, (value as any)(registry.get(atom)))
    } else {
      registry.set(atom, value)
    }
  }
}

/**
 * Create a reactive getter/setter pair for a writable Atom value.
 * Similar to createSignal but for Effect-Atom values.
 *
 * @example
 * const countAtom = Atom.make(0)
 * const [count, setCount] = createAtom(countAtom)
 *
 * setCount(n => n + 1) // updater function
 * setCount(42)         // direct value
 */
export const createAtom = <R, W>(
  atom: Atom.Writable<R, W>,
): readonly [Accessor<R>, (_: W | ((_: R) => W)) => void] => {
  const registry = useContext(RegistryContext)
  const value = useStore(registry, atom)

  const setter = (newValue: W | ((_: R) => W)) => {
    if (typeof newValue === 'function') {
      registry.set(atom, (newValue as any)(registry.get(atom)))
    } else {
      registry.set(atom, newValue)
    }
  }

  return [value, setter] as const
}

/**
 * Create a Resource-based setter for async Atom values.
 * This provides SolidJS Resource integration for async operations.
 *
 * @example
 * const todoAtom = Atom.make(todoEffect)
 * const { resource, set, refetch } = createAtomResourceSet(todoAtom)
 *
 * // Trigger async operation
 * set(newTodoData)
 */
export const createAtomResourceSet = <E, A, W = Result.Result<A, E>>(
  atom: Atom.Writable<Result.Result<A, E>, W>,
) => {
  const registry = useContext(RegistryContext)

  const fetcher = async (value: W) => {
    return new Promise<Exit.Exit<A, E>>(resolve => {
      const unsubscribe = registry.subscribe(
        atom,
        result => {
          if (result.waiting || result._tag === 'Initial') return
          unsubscribe()
          resolve(Result.toExit(result) as Exit.Exit<A, E>)
        },
        { immediate: true },
      )
      registry.set(atom, value)
    })
  }

  const [resource, { mutate, refetch }] = createResource<Exit.Exit<A, E>, W>(
    () => registry.get(atom) as W,
    fetcher,
  )

  return {
    resource,
    set: mutate,
    refetch,
  }
}

/**
 * Create a SolidJS Resource from an Effect-Atom Result.
 * This provides native SolidJS async handling with Suspense support.
 *
 * @example
 * const todosAtom = Atom.make(todoEffect)
 * const todos = createAtomResource(todosAtom)
 *
 * return (
 *   <Suspense fallback="Loading...">
 *     <div>{todos()?.value}</div>
 *   </Suspense>
 * )
 */
export const createAtomResource = <A, E>(
  atom: Atom.Atom<Result.Result<A, E>>,
  options?: { readonly suspendOnWaiting?: boolean },
): Resource<Result.Success<A, E> | Result.Failure<A, E>> => {
  const registry = useContext(RegistryContext)

  const fetcher = () => {
    const currentValue = registry.get(atom)

    // Return resolved values immediately
    if (currentValue._tag !== 'Initial' && !(options?.suspendOnWaiting && currentValue.waiting)) {
      return currentValue as Result.Success<A, E> | Result.Failure<A, E>
    }

    // Create promise for unresolved values
    return new Promise<Result.Success<A, E> | Result.Failure<A, E>>(resolve => {
      const unsubscribe = registry.subscribe(
        atom,
        result => {
          if (result._tag === 'Initial' || (options?.suspendOnWaiting && result.waiting)) {
            return
          }
          unsubscribe()
          resolve(result as Result.Success<A, E> | Result.Failure<A, E>)
        },
        { immediate: false },
      )
    })
  }

  const [resource, { mutate }] = createResource(fetcher)

  // Keep resource in sync with Atom updates
  const unsubscribe = registry.subscribe(atom, result => {
    if (Result.isNotInitial(result) && !(options?.suspendOnWaiting && result.waiting)) {
      mutate(() => result as Result.Success<A, E> | Result.Failure<A, E>)
    }
  })

  onCleanup(unsubscribe)

  return resource
}

/**
 * Create a SolidJS Resource that only returns success values.
 * Failures are thrown as errors for ErrorBoundary to catch.
 *
 * @example
 * const todos = createAtomResourceSuccess(todosAtom)
 *
 * return (
 *   <ErrorBoundary fallback="Error loading">
 *     <Suspense fallback="Loading...">
 *       <div>{todos()?.value}</div>
 *     </Suspense>
 *   </ErrorBoundary>
 * )
 */
export const createAtomResourceSuccess = <A, E>(
  atom: Atom.Atom<Result.Result<A, E>>,
  options?: { readonly suspendOnWaiting?: boolean },
): Resource<Result.Success<A, E>> => {
  const resource = createAtomResource(atom, options)

  const successResource = () => {
    const result = resource()
    if (result && result._tag === 'Failure') {
      throw Cause.squash(result.cause)
    }
    return result as Result.Success<A, E>
  }

  return successResource as Resource<Result.Success<A, E>>
}

// For complex async patterns, use solid-query or build on top of createAtomResource
// This keeps atom-solid focused on core primitives

/**
 * Create a refresh function for an Atom value.
 * This forces the Atom to re-evaluate, useful for manual cache invalidation.
 */
export const createAtomRefresh = <A>(atom: Atom.Atom<A>): (() => void) => {
  const registry = useContext(RegistryContext)
  mountAtom(registry, atom)
  return () => registry.refresh(atom)
}

/**
 * Subscribe to an Atom value with a callback function.
 * The subscription is automatically cleaned up when the component unmounts.
 *
 * @example
 * const count = Atom.make(0)
 * createAtomSubscribe(count, (value) => {
 *   console.log('Count changed:', value)
 * }, { immediate: true })
 */
export const createAtomSubscribe = <A>(
  atom: Atom.Atom<A>,
  fn: (_: A) => void,
  options?: { readonly immediate?: boolean },
): void => {
  const registry = useContext(RegistryContext)
  const unsubscribe = registry.subscribe(atom, fn, options)
  onCleanup(unsubscribe)
}

/**
 * Create a SolidJS Accessor from an AtomRef.
 * AtomRef is Effect-Atom's way of handling references to reactive values.
 */
export const createAtomRef = <A>(ref: AtomRef.ReadonlyRef<A>): Accessor<A> => {
  const [value, setValue] = createSignal(ref.value)

  const unsubscribe = ref.subscribe(setValue)
  onCleanup(unsubscribe)

  return value
}

/**
 * Create a derived AtomRef that focuses on a specific property.
 * Uses SolidJS createMemo for optimal performance.
 */
export const createAtomRefProp = <A, K extends keyof A>(
  ref: AtomRef.AtomRef<A>,
  prop: K,
): AtomRef.AtomRef<A[K]> => createMemo(() => ref.prop(prop))()

/**
 * Create an Accessor for a specific property of an AtomRef.
 * Combines createAtomRefProp and createAtomRef for convenience.
 */
export const createAtomRefPropValue = <A, K extends keyof A>(
  ref: AtomRef.AtomRef<A>,
  prop: K,
): Accessor<A[K]> => createAtomRef(createAtomRefProp(ref, prop))
