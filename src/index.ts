/**
 * @since 1.0.0
 */
import * as Registry from "@effect-rx/rx/Registry"
import * as Result from "@effect-rx/rx/Result"
import * as Rx from "@effect-rx/rx/Rx"
import type * as RxRef from "@effect-rx/rx/RxRef"
import * as Cause from "effect/Cause"
import type * as Exit from "effect/Exit"
import { globalValue } from "effect/GlobalValue"
import { createContext, useContext, createSignal, createEffect, createMemo, onCleanup, Accessor, createResource, Resource } from "solid-js"

// Module exports remain the same
export * as Registry from "@effect-rx/rx/Registry"
export * as Result from "@effect-rx/rx/Result"
export * as Rx from "@effect-rx/rx/Rx"
export * as RxRef from "@effect-rx/rx/RxRef"

function scheduleTask(f: () => void): void {
  queueMicrotask(f)
}

export const RegistryContext = createContext<Registry.Registry>(Registry.make({
  scheduleTask,
  defaultIdleTTL: 400
}))

interface RxStore<A> {
  readonly subscribe: (f: () => void) => () => void
  readonly snapshot: () => A
}

export const storeRegistry = globalValue(
  "@effect-rx/rx-solid/storeRegistry",
  () => new WeakMap<Registry.Registry, WeakMap<Rx.Rx<any>, RxStore<any>>>()
)

function makeStore<A>(registry: Registry.Registry, rx: Rx.Rx<A>): RxStore<A> {
  let stores = storeRegistry.get(registry)
  if (stores === undefined) {
    stores = new WeakMap()
    storeRegistry.set(registry, stores)
  }
  const store = stores.get(rx)
  if (store !== undefined) {
    return store
  }
  const newStore: RxStore<A> = {
    subscribe(f) {
      return registry.subscribe(rx, f)
    },
    snapshot() {
      return registry.get(rx)
    }
  }
  stores.set(rx, newStore)
  return newStore
}

function useStore<A>(registry: Registry.Registry, rx: Rx.Rx<A>): Accessor<A> {
  const [value, setValue] = createSignal(registry.get(rx))

  const unsubscribe = registry.subscribe(rx, (value: A) => setValue(() => value))
  onCleanup(unsubscribe)

  return value
}

export const initialValuesSet = globalValue(
  "@effect-rx/rx-solid/initialValuesSet",
  () => new WeakMap<Registry.Registry, WeakSet<Rx.Rx<any>>>()
)

// SolidJS-native hydration utilities (inspired by solid-events)

/**
 * Extract state from the current registry for serialization.
 * This follows SolidJS patterns for SSR state transfer.
 * 
 * @example
 * // On server:
 * const state = extractRxState(registry)
 * // Serialize state to HTML or pass as props
 */
export const extractRxState = (registry: Registry.Registry): Array<readonly [any, any]> => {
  const state: Array<readonly [any, any]> = []
  registry.getNodes().forEach((node, rx) => {
    // Only extract serializable RX values
    if (typeof rx !== 'function') {
      const value = node.value()
      state.push([rx, value] as const)
    }
  })
  return state
}

/**
 * Create a state extractor function for the current registry context.
 * Useful for SSR scenarios.
 */
export const createRxStateExtractor = () => {
  const registry = useContext(RegistryContext)
  return () => extractRxState(registry)
}

/**
 * Initialize Rx values with hydrated state.
 * This should be called early in your app setup, similar to solid-events.
 * 
 * @example
 * // In your root component:
 * createRxHydration(hydratedState)
 */
export const createRxHydration = (initialValues: Iterable<readonly [Rx.Rx<any>, any]>): void => {
  const registry = useContext(RegistryContext)
  let set = initialValuesSet.get(registry)
  if (set === undefined) {
    set = new WeakSet()
    initialValuesSet.set(registry, set)
  }
  for (const [rx, value] of initialValues) {
    if (!set.has(rx)) {
      set.add(rx)
      ;(registry as any).ensureNode(rx).setValue(value)
    }
  }
}

// Legacy alias for backward compatibility
export const createRxInitialValues = createRxHydration

/**
 * Subscribe to an Rx value and return a SolidJS Accessor.
 * 
 * @example
 * const count = Rx.make(0)
 * const countValue = createRxValue(count)
 * const doubled = createRxValue(count, n => n * 2)
 */
export const createRxValue = <A, B = A>(
  rx: Rx.Rx<A>,
  f?: (_: A) => B
): Accessor<A | B> => {
  const registry = useContext(RegistryContext)
  
  if (f) {
    // Create a derived Rx and subscribe to it
    const derivedRx = createMemo(() => Rx.map(rx, f))
    return useStore(registry, derivedRx())
  }
  
  return useStore(registry, rx)
}

/**
 * Create a computed Rx value using SolidJS createMemo.
 * This is optimized for cases where the mapping function is expensive.
 * 
 * @example
 * const count = Rx.make(0)
 * const expensive = createRxMemo(count, n => expensiveComputation(n))
 */
export const createRxMemo = <A, B>(
  rx: Rx.Rx<A>,
  f: (_: A) => B
): Accessor<B> => {
  const registry = useContext(RegistryContext)
  const memoizedRx = createMemo(() => Rx.map(rx, f))
  return useStore(registry, memoizedRx())
}

function mountRx<A>(registry: Registry.Registry, rx: Rx.Rx<A>): void {
  const unlisten = registry.mount(rx)
  onCleanup(unlisten)
}

/**
 * Create a side effect that runs when an Rx value changes.
 * Uses SolidJS createEffect for reactive side effects.
 * 
 * @example
 * const count = Rx.make(0)
 * createRxEffect(count, (value) => {
 *   console.log('Count changed:', value)
 * })
 */
export const createRxEffect = <A>(
  rx: Rx.Rx<A>,
  fn: (value: A) => void,
  options?: { immediate?: boolean }
): void => {
  const value = createRxValue(rx)
  
  createEffect(() => {
    fn(value())
  })
  
  // Also handle immediate execution if requested
  if (options?.immediate) {
    fn(value())
  }
}

/**
 * Mount an Rx value to keep it active.
 * This ensures the Rx value stays subscribed and doesn't get garbage collected.
 */
export const createRxMount = <A>(rx: Rx.Rx<A>): void => {
  const registry = useContext(RegistryContext)
  mountRx(registry, rx)
}

/**
 * Create a setter function for a writable Rx value.
 * Use this when you only need the setter, not the getter.
 * 
 * @example
 * const countRx = Rx.make(0)
 * const setCount = createRxSet(countRx)
 * 
 * setCount(n => n + 1)
 * setCount(42)
 */
export const createRxSet = <R, W>(rx: Rx.Writable<R, W>) => {
  const registry = useContext(RegistryContext)
  mountRx(registry, rx)

  return (value: W | ((_: R) => W)) => {
    if (typeof value === "function") {
      registry.set(rx, (value as any)(registry.get(rx)))
    } else {
      registry.set(rx, value)
    }
  }
}

/**
 * Create a reactive getter/setter pair for a writable Rx value.
 * Similar to createSignal but for Effect-RX values.
 * 
 * @example
 * const countRx = Rx.make(0)
 * const [count, setCount] = createRx(countRx)
 * 
 * setCount(n => n + 1) // updater function
 * setCount(42)         // direct value
 */
export const createRx = <R, W>(
  rx: Rx.Writable<R, W>
): readonly [Accessor<R>, (_: W | ((_: R) => W)) => void] => {
  const registry = useContext(RegistryContext)
  const value = useStore(registry, rx)

  const setter = (newValue: W | ((_: R) => W)) => {
    if (typeof newValue === "function") {
      registry.set(rx, (newValue as any)(registry.get(rx)))
    } else {
      registry.set(rx, newValue)
    }
  }

  return [value, setter] as const
}

/**
 * Create a Resource-based setter for async Rx values.
 * This provides SolidJS Resource integration for async operations.
 * 
 * @example
 * const todoRx = Rx.make(todoEffect)
 * const { resource, set, refetch } = createRxResourceSet(todoRx)
 * 
 * // Trigger async operation
 * set(newTodoData)
 */
export const createRxResourceSet = <E, A, W = Result.Result<A,E>>(
  rx: Rx.Writable<Result.Result<A, E>, W>
) => {
  const registry = useContext(RegistryContext)

  const fetcher = async (value: W) => {
    return new Promise<Exit.Exit<A, E>>((resolve) => {
      const unsubscribe = registry.subscribe(rx, (result) => {
        if (result.waiting || result._tag === "Initial") return
        unsubscribe()
        resolve(Result.toExit(result) as Exit.Exit<A, E>)
      }, { immediate: true })
      registry.set(rx, value)
    })
  }

  const [resource, { mutate, refetch }] = createResource<Exit.Exit<A, E>, W>(
    () => registry.get(rx) as W, 
    fetcher
  )

  return {
    resource,
    set: mutate,
    refetch
  }
}

/**
 * Create a SolidJS Resource from an Effect-RX Result.
 * This provides native SolidJS async handling with Suspense support.
 * 
 * @example
 * const todosRx = Rx.make(todoEffect)
 * const todos = createRxResource(todosRx)
 * 
 * return (
 *   <Suspense fallback="Loading...">
 *     <div>{todos()?.value}</div>
 *   </Suspense>
 * )
 */
export const createRxResource = <A, E>(
  rx: Rx.Rx<Result.Result<A, E>>,
  options?: { readonly suspendOnWaiting?: boolean }
): Resource<Result.Success<A, E> | Result.Failure<A, E>> => {
  const registry = useContext(RegistryContext)

  const fetcher = () => {
    const currentValue = registry.get(rx)
    
    // Return resolved values immediately
    if (currentValue._tag !== "Initial" && 
        !(options?.suspendOnWaiting && currentValue.waiting)) {
      return currentValue as Result.Success<A, E> | Result.Failure<A, E>
    }

    // Create promise for unresolved values
    return new Promise<Result.Success<A, E> | Result.Failure<A, E>>((resolve) => {
      const unsubscribe = registry.subscribe(rx, (result) => {
        if (result._tag === "Initial" ||
          (options?.suspendOnWaiting && result.waiting)) {
          return
        }
        unsubscribe()
        resolve(result as Result.Success<A, E> | Result.Failure<A, E>)
      }, { immediate: false })
    })
  }

  const [resource, { mutate }] = createResource(fetcher)
  
  // Keep resource in sync with Rx updates
  const unsubscribe = registry.subscribe(rx, (result) => {
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
 * const todos = createRxResourceSuccess(todosRx)
 * 
 * return (
 *   <ErrorBoundary fallback="Error loading">
 *     <Suspense fallback="Loading...">
 *       <div>{todos()?.value}</div>
 *     </Suspense>
 *   </ErrorBoundary>
 * )
 */
export const createRxResourceSuccess = <A, E>(
  rx: Rx.Rx<Result.Result<A, E>>,
  options?: { readonly suspendOnWaiting?: boolean }
): Resource<Result.Success<A, E>> => {
  const resource = createRxResource(rx, options)

  const successResource = () => {
    const result = resource()
    if (result && result._tag === "Failure") {
      throw Cause.squash(result.cause)
    }
    return result as Result.Success<A, E>
  }

  return successResource as Resource<Result.Success<A, E>>
}

// For complex async patterns, use solid-query or build on top of createRxResource
// This keeps rx-solid focused on core primitives


/**
 * Create a refresh function for an Rx value.
 * This forces the Rx to re-evaluate, useful for manual cache invalidation.
 */
export const createRxRefresh = <A>(rx: Rx.Rx<A>): () => void => {
  const registry = useContext(RegistryContext)
  mountRx(registry, rx)
  return () => registry.refresh(rx)
}

/**
 * Subscribe to an Rx value with a callback function.
 * The subscription is automatically cleaned up when the component unmounts.
 * 
 * @example
 * const count = Rx.make(0)
 * createRxSubscribe(count, (value) => {
 *   console.log('Count changed:', value)
 * }, { immediate: true })
 */
export const createRxSubscribe = <A>(
  rx: Rx.Rx<A>,
  fn: (_: A) => void,
  options?: { readonly immediate?: boolean }
): void => {
  const registry = useContext(RegistryContext)
  const unsubscribe = registry.subscribe(rx, fn, options)
  onCleanup(unsubscribe)
}

/**
 * Create a SolidJS Accessor from an RxRef.
 * RxRef is Effect-RX's way of handling references to reactive values.
 */
export const createRxRef = <A>(ref: RxRef.ReadonlyRef<A>): Accessor<A> => {
  const [value, setValue] = createSignal(ref.value)

  const unsubscribe = ref.subscribe(setValue)
  onCleanup(unsubscribe)

  return value
}

/**
 * Create a derived RxRef that focuses on a specific property.
 * Uses SolidJS createMemo for optimal performance.
 */
export const createRxRefProp = <A, K extends keyof A>(
  ref: RxRef.RxRef<A>,
  prop: K
): RxRef.RxRef<A[K]> => createMemo(() => ref.prop(prop))()

/**
 * Create an Accessor for a specific property of an RxRef.
 * Combines createRxRefProp and createRxRef for convenience.
 */
export const createRxRefPropValue = <A, K extends keyof A>(
  ref: RxRef.RxRef<A>,
  prop: K
): Accessor<A[K]> => createRxRef(createRxRefProp(ref, prop))

