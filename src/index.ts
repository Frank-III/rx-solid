import {
  createContext,
  useContext,
  createSignal,
  onCleanup,
  Accessor,
  createResource,
  getOwner,
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
export const createRx = <R, W>(
  rx: Rx.Writable<R, W>
): readonly [Accessor<R>, (_: W) => void] => {
  const registry = injectRegistry()
  const [value, setValue] = createSignal<R>(registry.get(rx))

  const cancel = registry.subscribe(rx, (nextValue) => {
    setValue(() => nextValue)
  })

  if (getOwner()) {
    onCleanup(cancel)
  }

  return [value, (_: W) => registry.set(rx, _)] as const
}


export const createRxValue: {
  <A>(rx: Rx.Rx<A>): Accessor<A>
  <A, B>(rx: Rx.Rx<A>, f: (_: A) => B): Accessor<B>
} = <A>(rx: Rx.Rx<A>, f?: (_: A) => A): Accessor<A> => {
  const registry = injectRegistry()

  rx = f ? Rx.map(rx, f) : rx
  const [value, setValue] = createDeepSignal<A>(registry.get(rx))

  const cancel = registry.subscribe(rx, (nextVal) => {
    setValue(() => nextVal)
  })
  if (getOwner()) {
    onCleanup(cancel)
  }

  return value
}

// Hook to set values on an Rx.Writable
export const createRxSet = <R, W>(rx: Rx.Writable<R, W>): (_: W | ((_: R) => W)) => void => {
  const registry = injectRegistry()
  const cancel = registry.mount(rx)

  if (getOwner()) {
    onCleanup(cancel)
  }

  return (newValue: W | ((_: R) => W)) => {
    if (typeof newValue === 'function') {
        return registry.set(rx, (newValue as any)(registry.get(rx)))}
    return registry.set(rx, newValue)
  }
}

// Hook to use an RxRef
export const createRxRef = <A>(rxRef: RxRef.ReadonlyRef<A>): Accessor<A> => {
  const [value, setValue] = createSignal<A>(rxRef.value)

  const cancel = rxRef.subscribe((nextValue) => {
    setValue(() => nextValue)
  })

  if (getOwner()) {
    onCleanup(cancel)
  }

  return value
}

export const createRxSuspense = <A, E>(rx: Rx.Rx<Result.Result<A, E>>, suspendOnWaiting?: boolean) => {
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

  const cancel = registry.subscribe(rx, mutate)
  onCleanup(cancel)

  return state
}
