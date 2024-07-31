import { createContext, useContext, createSignal, onCleanup, createEffect, Accessor, createResource, Resource, createMemo } from 'solid-js';
import * as Registry from "@effect-rx/rx/Registry";
import * as Rx from "@effect-rx/rx/Rx";
import type * as RxRef from "@effect-rx/rx/RxRef";
import { globalValue } from "effect/GlobalValue"
import * as Result from '@effect-rx/rx/Result';

// Re-exporting for easy access
export * as Registry from "@effect-rx/rx/Registry";
export * as Result from "@effect-rx/rx/Result";
export * as Rx from "@effect-rx/rx/Rx";
export * as RxRef from "@effect-rx/rx/RxRef";
import * as Scheduler from "scheduler"

// Context for Registry
export const RegistryContext = createContext<Registry.Registry>();

function scheduleTask(f: () => void): void {
  Scheduler.unstable_scheduleCallback(Scheduler.unstable_LowPriority, f)
}
// Default registry using a global value as fallback
export const defaultRegistry: Registry.Registry = globalValue(
  "@effect-rx/solid/defaultRegistry",
  () => Registry.make({
    scheduleTask,
    defaultIdleTTL: 400
  })
);

// Function to inject the registry, providing a default if not present in context
export const injectRegistry = (): Registry.Registry => {
  const registry = useContext(RegistryContext);
  if (!registry) {
    throw new Error("No registry found");
  }
  return registry;
};


// Hook to use an Rx.Writable, similar to useRx in Vue
export const useRx = <R, W>(rx: Rx.Writable<R, W>): [Accessor<R>, (newValue: W) => void] => {
  const registry = injectRegistry();
  const [value, setValue] = createSignal<R>(registry.get(rx));

  createEffect(() => {
    const cancel = registry.subscribe(rx, setValue as (newValue: R) => void);
    onCleanup(cancel);
  });

  const set = (newValue: W) => registry.set(rx, newValue);

  return [value, set];
};

export const useRxValue = <A>(rx: Rx.Rx<A>): Accessor<A> => {
  const registry = injectRegistry();
  const [value, setValue] = createSignal<A>(registry.get(rx));

  createEffect(() => {
    const cancel = registry.subscribe(rx, setValue as (newValue: A) => void);
    onCleanup(cancel);
  });

  return value;
};

// Hook to set values on an Rx.Writable
export const useRxSet = <R, W>(rx: Rx.Writable<R, W>): (newValue: W) => void => {
  const registry = injectRegistry();
  createEffect(() => {
    const cancel = registry.mount(rx);
    onCleanup(cancel);
  });

  return (newValue: W) => registry.set(rx, newValue);
};

// Hook to use an RxRef
export const useRxRef = <A>(rxRef: RxRef.ReadonlyRef<A>): Accessor<A> => {
  const [value, setValue] = createSignal<A>(rxRef.value);

  createEffect(() => {
    const cancel = rxRef.subscribe(setValue as (newValue: A) => void);
    onCleanup(cancel);
  });

  return value;
};

// Suspense implementation using createResource
// type SuspenseResult<A, E> = Result.Success<A, E> | Result.Failure<A, E>;
// type SuspenseResult<A, E> = {
//   readonly _tag: "Suspended"
//   readonly promise: Promise<void>
//   readonly resolve: () => void
// } | {
//   readonly _tag: "Resolved"
//   readonly result: Result.Success<A, E> | Result.Failure<A, E>
// }
// function makeSuspended(rx: Rx.Rx<any>): {
//   readonly _tag: "Suspended"
//   readonly promise: Promise<void>
//   readonly resolve: () => void
// } {
//   let resolve: () => void
//   const promise = new Promise<void>((_resolve) => {
//     resolve = _resolve
//   })
//   ;(promise as any).rx = rx
//   return {
//     _tag: "Suspended",
//     promise,
//     resolve: resolve!
//   }
// }
// const suspenseRxMap = globalValue(
//   "@effect-rx/rx-react/suspenseMounts",
//   () => new WeakMap<Rx.Rx<any>, Rx.Rx<SuspenseResult<any, any>>>()
// )

// function suspenseRx<A, E>(
//   registry: Registry.Registry,
//   rx: Rx.Rx<Result.Result<A, E>>,
//   suspendOnWaiting: boolean
// ): Rx.Rx<SuspenseResult<A, E>> {
//   if (suspenseRxMap.has(rx)) {
//     return suspenseRxMap.get(rx)!
//   }
//   let unmount: (() => void) | undefined
//   let timeout: NodeJS.Timeout | undefined
//   function performMount() {
//     if (timeout !== undefined) {
//       clearTimeout(timeout)
//     }
//     unmount = registry.subscribe(resultRx, constVoid)
//   }
//   function performUnmount() {
//     timeout = undefined
//     if (unmount !== undefined) {
//       unmount()
//       unmount = undefined
//     }
//   }
//   const resultRx = Rx.readable<SuspenseResult<A, E>>(function(get) {
//     let state: SuspenseResult<A, E> = makeSuspended(rx)
//     get.subscribe(rx, function(result) {
//       if (result._tag === "Initial" || (suspendOnWaiting && result.waiting)) {
//         if (state._tag === "Resolved") {
//           state = makeSuspended(rx)
//           get.setSelfSync(state)
//         }
//         if (unmount === undefined) {
//           performMount()
//         }
//       } else {
//         if (unmount !== undefined && timeout === undefined) {
//           timeout = setTimeout(performUnmount, 1000)
//         }
//         if (state._tag === "Resolved") {
//           state = { _tag: "Resolved", result }
//           get.setSelfSync(state)
//         } else {
//           const resolve = state.resolve
//           state = { _tag: "Resolved", result }
//           get.setSelfSync(state)
//           resolve()
//         }
//       }
//     }, { immediate: true })
//     return state
//   })
//   suspenseRxMap.set(rx, resultRx)
//   return resultRx
// }

// /**
//  * @since 1.0.0
//  * @category hooks
//  */
// export const useRxSuspense = <A, E>(
//   rx: Rx.Rx<Result.Result<A, E>>,
//   options?: { readonly suspendOnWaiting?: boolean }
// ): Accessor<Result.Success<A, E> | Result.Failure<A, E>> => {
//   const registry = injectRegistry()
//   const promiseRx = createMemo(() => suspenseRx(registry, rx, options?.suspendOnWaiting ?? false))
//   const result = useStore(registry, promiseRx())
//   if (result()._tag === "Suspended") {
//     throw result.promise
//   }
//   return () => result().result as Result.Success<A, E> | Result.Failure<A, E>
// }

export const useRxSuspense = <A, E>(
  rx: Rx.Rx<Result.Result<A, E>>,
  suspendOnWaiting?: boolean
) => {
  const registry = injectRegistry();
  const [state, {mutate}] = createResource(() => {
    return new Promise<Result.Result<A,E>>((resolve) => {
      const unsubscribe = registry.subscribe(rx, (result) => {
      if (result._tag !== "Initial" && (!suspendOnWaiting || !result.waiting)) {
        resolve(result);
        unsubscribe();
      }
      }, { immediate: true });
    });
  });

  createEffect(() => {
    const cancel = registry.subscribe(rx, mutate);
    onCleanup(cancel);
  })

  return state;
};

// function createSuspenseResource<A, E>(
//   registry: Registry.Registry,
//   rx: Rx.Rx<Result.Result<A, E>>,
//   suspendOnWaiting: boolean
// ) {

//   return createResource(() => new Promise<Rx.Rx<SuspenseResult<A,E>>>((resolve, reject) => {
//     Rx.readable<SuspenseResult<A,E>>(function(get) {
//       const unsubscribe = registry.subscribe(rx, (result) => {
//         if (result._tag !== "Initial" && (!suspendOnWaiting || !result.waiting)) {
//           if (result._tag === "Success") {
//             resolve(result)
//           } else  {
//             reject(result.cause)
//           }
//           unsubscribe();
//         }
//       }, { immediate: true });
//     })
//   }));
// }

// export function useRxSuspense<A, E>(
//   rx: Rx.Rx<Result.Result<A, E>>,
//   options?: { readonly suspendOnWaiting?: boolean }
// ): Resource<SuspenseResult<A,E>> {
//   const registry = injectRegistry();
//   const [result, { mutate }] = createSuspenseResource(registry, rx, options?.suspendOnWaiting ?? false);
//   // createEffect(() => {
//   //   const cancel = registry.subscribe(rx, (_) => mutate);
//   //   onCleanup(cancel);
//   // })
//   return result
// }

// export function useRxSuspenseSuccess<A, E>(
//   rx: Rx.Rx<Result.Result<A, E>>,
//   options?: { readonly suspendOnWaiting?: boolean }
// ): Result.Success<A, E> {
//   const result = useRxSuspense(rx, options)()!;
//   if (result._tag === "Failure") {
//     throw Cause.squash(result.cause);
//   }
//   return result;
// }

// function useStore<A>(registry: Registry.Registry, rx: Rx.Rx<A>): Accessor<A> {
// const [state, setState] = createSignal(registry.get(rx));

//   createEffect(() => {
//     const cancel = registry.subscribe(rx, setState as (newValue: A) => void);
//     onCleanup(cancel);
//   });

//   return state;
// }
