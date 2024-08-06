import {
  createContext,
  useContext,
  createSignal,
  onCleanup,
  createEffect,
  Accessor,
  createResource,
  // Resource,
  // createMemo,
} from 'solid-js'
import * as Registry from '@effect-rx/rx/Registry'
import * as Rx from '@effect-rx/rx/Rx'
import type * as RxRef from '@effect-rx/rx/RxRef'
import { globalValue } from 'effect/GlobalValue'
import * as Result from '@effect-rx/rx/Result'

// Re-exporting for easy access
export * as Registry from '@effect-rx/rx/Registry'
export * as Result from '@effect-rx/rx/Result'
export * as Rx from '@effect-rx/rx/Rx'
export * as RxRef from '@effect-rx/rx/RxRef'
import * as Scheduler from 'scheduler'
import { createDeepSignal } from './extra'

// Context for Registry
export const RegistryContext = createContext<Registry.Registry>()

function scheduleTask(f: () => void): void {
  Scheduler.unstable_scheduleCallback(Scheduler.unstable_LowPriority, f)
}
// Default registry using a global value as fallback
export const defaultRegistry: Registry.Registry = globalValue(
  '@effect-rx/solid/defaultRegistry',
  () =>
    Registry.make({
      scheduleTask,
      defaultIdleTTL: 400,
    }),
)

// Function to inject the registry, providing a default if not present in context
export const injectRegistry = (): Registry.Registry => {
  const registry = useContext(RegistryContext)
  if (!registry) {
    throw new Error('No registry found')
  }
  return registry
}

// Hook to use an Rx.Writable, similar to useRx in Vue
export const useRx = <R, W>(rx: Rx.Writable<R, W>): [Accessor<R>, (newValue: W) => void] => {
  const registry = injectRegistry()
  const [value, setValue] = createDeepSignal<R>(registry.get(rx))

  createEffect(() => {
    const cancel = registry.subscribe(rx, setValue as (newValue: R) => void)
    onCleanup(cancel)
  })

  const set = (newValue: W) => registry.set(rx, newValue)

  return [value, set]
}

export const useRxValue: {
  <A>(rx: Rx.Rx<A>): Accessor<A>
  <A, B>(rx: Rx.Rx<A>, f: (_: A) => B): Accessor<B>
} = <A>(rx: Rx.Rx<A>, f?: (_: A) => A): Accessor<A> => {
  const registry = injectRegistry()
  const [value, setValue] = createDeepSignal<A>(registry.get(rx))
  const derivedVal = f ? () => f(value()): value

  createEffect(() => {
    // set value here would also change the derived value
    const cancel = registry.subscribe(rx, setValue as (newValue: A) => void)
    onCleanup(cancel)
  })

  return derivedVal
}

// Hook to set values on an Rx.Writable
export const useRxSet = <R, W>(rx: Rx.Writable<R, W>): (_: W | ((_: R) => W)) => void => {
  const registry = injectRegistry()
  createEffect(() => {
    const cancel = registry.mount(rx)
    onCleanup(cancel)
  })

  return (newValue: W | ((_: R) => W)) => {
    if (typeof newValue === 'function') {
        return registry.set(rx, (newValue as any)(registry.get(rx)))}
    return registry.set(rx, newValue)
  }
}

// Hook to use an RxRef
export const useRxRef = <A>(rxRef: RxRef.ReadonlyRef<A>): Accessor<A> => {
  const [value, setValue] = createDeepSignal<A>(rxRef.value)

  createEffect(() => {
    const cancel = rxRef.subscribe(setValue as (newValue: A) => void)
    onCleanup(cancel)
  })

  return value
}

export const useRxSuspense = <A, E>(rx: Rx.Rx<Result.Result<A, E>>, suspendOnWaiting?: boolean) => {
  const registry = injectRegistry()
  const [state, { mutate }] = createResource(() => {
    return new Promise<Result.Result<A, E>>(resolve => {
      const unsubscribe = registry.subscribe(
        rx,
        result => {
          if (result._tag !== 'Initial' && (!suspendOnWaiting || !result.waiting)) {
            resolve(result)
            unsubscribe()
          }
        },
        { immediate: true },
      )
    })
  }, {storage: createDeepSignal})

  createEffect(() => {
    const cancel = registry.subscribe(rx, mutate)
    onCleanup(cancel)
  })

  return state
}
