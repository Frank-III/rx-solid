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
import type { ResourceFetcher } from "solid-js"

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

  createEffect(() => {
    const unsubscribe = registry.subscribe(rx, (value: A) => setValue(() => value))
    onCleanup(unsubscribe)
    // return unsubscribe
  })

  return value
}

export const initialValuesSet = globalValue(
  "@effect-rx/rx-solid/initialValuesSet",
  () => new WeakMap<Registry.Registry, WeakSet<Rx.Rx<any>>>()
)

export const createRxInitialValues = (initialValues: Iterable<readonly [Rx.Rx<any>, any]>): void => {
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

export const createRxValue = <A, B = A>(
  rx: Rx.Rx<A>,
  f?: (_: A) => B
): Accessor<A | B> => {
  const registry = useContext(RegistryContext)
  if (f) {
    const rxB = () => Rx.map(rx, f)
    return useStore(registry, rxB())
  }
  return useStore(registry, rx)
}

export const createRxValueMemo = <A, B = A>(
  rx: Rx.Rx<A>,
  f?: (_: A) => B
): Accessor<A | B> => {
  const registry = useContext(RegistryContext)
  if (f) {
    const rxB = createMemo(() => Rx.map(rx, f))
    return useStore(registry, rxB())
  }
  return useStore(registry, rx)
}

function mountRx<A>(registry: Registry.Registry, rx: Rx.Rx<A>): void {
  createEffect(() => {
    const unlisten = registry.mount(rx)
    onCleanup(unlisten)
  })
}

export const useRxMount = <A>(rx: Rx.Rx<A>): void => {
  const registry = useContext(RegistryContext)
  mountRx(registry, rx)
}

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

export const createRx = <R, W>(
  rx: Rx.Writable<R, W>
): readonly [Accessor<R>, (_: W | ((_: R) => W)) => void] => {
  const registry = useContext(RegistryContext)
  const value = useStore(registry, rx)

  const setter = (value: W | ((_: R) => W)) => {
    if (typeof value === "function") {
      registry.set(rx, (value as any)(registry.get(rx)))
    } else {
      registry.set(rx, value)
    }
  }

  return [value, setter] as const
}

export const createRxSetPromise = <E, A, W = Result.Result<A,E>>(
  rx: Rx.Writable<Result.Result<A, E>, W>
) => {
  const registry = useContext(RegistryContext)

  const fetcher: ResourceFetcher<W, Exit.Exit<A, E>> = async (value: W) => {
    return new Promise((resolve) => {
      const unsubscribe = registry.subscribe(rx, (result) => {
        if (result.waiting || result._tag === "Initial") return
        unsubscribe()
        resolve(Result.toExit(result) as Exit.Exit<A, E>)
      }, { immediate: true })
      registry.set(rx, value)
    })
  }

  const [state, { mutate, refetch }] = createResource<Exit.Exit<A, E>, W>(() => registry.get(rx) as W, fetcher)

  return {
    state,
    set: mutate,
    refetch
  }
}

export const createRxSuspense = <A, E>(
  rx: Rx.Rx<Result.Result<A, E>>,
  options?: { readonly suspendOnWaiting?: boolean }
): Resource<Result.Success<A, E> | Result.Failure<A, E>> => {
  const registry = useContext(RegistryContext)

  const fetcher: ResourceFetcher<true, Result.Success<A, E> | Result.Failure<A, E>> =
    async () => {
      return new Promise((resolve) => {
        const unsubscribe = registry.subscribe(rx, (result) => {
          if (result._tag === "Initial" ||
            (options?.suspendOnWaiting && result.waiting)) {
            return
          }
          unsubscribe()
          resolve(result)
        }, { immediate: true })
      })
    }

  const [state, {mutate}] = createResource(fetcher)
  createEffect(() => {
    registry.subscribe(rx, (val) => {
      if (val._tag === "Success") {
        mutate(val)
      }
    })
  })
  return state
}

export const createRxSuspenseSuccess = <A, E>(
  rx: Rx.Rx<Result.Result<A, E>>,
  options?: { readonly suspendOnWaiting?: boolean }
): Resource<Result.Success<A, E>> => {
  const state = createRxSuspense(rx, options)

  const successState = () => {
    const result = state()
    if (result && result._tag === "Failure") {
      throw Cause.squash(result.cause)
    }
    return result as Result.Success<A, E>
  }

  return successState as Resource<Result.Success<A, E>>
}

// Example of handling async data loading
export const createRxAsync = <A, E>(
  rx: Rx.Rx<Result.Result<A, E>>
) => {
  const registry = useContext(RegistryContext)

  const fetcher: ResourceFetcher<true, A> = async () => {
    return new Promise((resolve, reject) => {
      const unsubscribe = registry.subscribe(rx, (result) => {
        if (result._tag === "Initial" || result.waiting) return

        unsubscribe()
        if (result._tag === "Failure") {
          reject(Cause.squash(result.cause))
        } else {
          resolve(result.value)
        }
      }, { immediate: true })
    })
  }


  const [data, { refetch, mutate }] = createResource(fetcher)


  createEffect(() => {
    registry.subscribe(rx, (val) => {
      if (Result.isSuccess(val)) {
        mutate((_) => val.value)
      }
    })
  })

  return {
    data,
    loading: () => data.loading,
    error: () => data.error,
    refetch,
    mutate
  }
}

// Example usage of loading states
export const createRxLoadingState = <A, E>(
  rx: Rx.Rx<Result.Result<A, E>>
) => {
  const registry = useContext(RegistryContext)

  const [state] = createResource(async () => {
    const value = registry.get(rx)
    if (value._tag === "Initial" || value.waiting) {
      return { loading: true, data: undefined, error: undefined }
    }
    if (value._tag === "Failure") {
      return {
        loading: false,
        data: undefined,
        error: Cause.squash(value.cause)
      }
    }
    return { loading: false, data: value.value, error: undefined }
  })

  return state
}

// Example of combining multiple async rx values
export const createRxCombinedAsync = <T extends Record<string, Rx.Rx<Result.Result<any, any>>>>(
  sources: T
) => {
  type ResultType = {
    [K in keyof T]: T[K] extends Rx.Rx<Result.Result<infer A, any>> ? A : never
  }

  const fetcher: ResourceFetcher<true, ResultType> = async () => {
    const entries = Object.entries(sources)
    const results = await Promise.all(
      entries.map(([key, rx]) =>
        createRxAsync(rx).data()
      )
    )

    return Object.fromEntries(
      entries.map(([key], index) => [key, results[index]])
    ) as ResultType
  }

  const [data, { refetch }] = createResource(fetcher)

  return {
    data,
    loading: () => data.loading,
    error: () => data.error,
    refetch
  }
}

// Example usage with error boundaries
export const useRxErrorBoundary = <A, E>(
  rx: Rx.Rx<Result.Result<A, E>>
) => {
  const state = createRxAsync(rx)

  return {
    fallback: (props: { children: (error: Error) => any }) => {
      const error = state.error()
      if (error) {
        return props.children(error)
      }
      return null
    },
    loading: (props: { children: any }) => {
      if (state.loading()) {
        return props.children
      }
      return null
    },
    content: (props: { children: (data: A) => any }) => {
      const data = state.data()
      if (data && !state.loading() && !state.error()) {
        return props.children(data)
      }
      return null
    }
  }
}


export const useRxRefresh = <A>(rx: Rx.Rx<A> & Rx.Refreshable): () => void => {
  const registry = useContext(RegistryContext)
  mountRx(registry, rx)
  return () => registry.refresh(rx)
}

export const useRxSubscribe = <A>(
  rx: Rx.Rx<A>,
  f: (_: A) => void,
  options?: { readonly immediate?: boolean }
): void => {
  const registry = useContext(RegistryContext)
  createEffect(() => {
    const unsubscribe = registry.subscribe(rx, f, options)
    onCleanup(unsubscribe)
  })
}

export const createRxRef = <A>(ref: RxRef.ReadonlyRef<A>): Accessor<A> => {
  const [value, setValue] = createSignal(ref.value)

  createEffect(() => {
    const unsubscribe = ref.subscribe(setValue)
    onCleanup(unsubscribe)
  })

  return value
}

export const createRxRefProp = <A, K extends keyof A>(
  ref: RxRef.RxRef<A>,
  prop: K
): RxRef.RxRef<A[K]> => createMemo(() => ref.prop(prop))()

export const useRxRefPropValue = <A, K extends keyof A>(
  ref: RxRef.RxRef<A>,
  prop: K
): Accessor<A[K]> => createRxRef(createRxRefProp(ref, prop))
