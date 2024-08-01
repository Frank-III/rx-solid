import { createContext, useContext, createSignal, createEffect, onCleanup, createResource } from 'solid-js';
import * as Registry from '@effect-rx/rx/Registry';
export { Registry };
import { globalValue } from 'effect/GlobalValue';
import * as Result from '@effect-rx/rx/Result';
export { Result };
import * as Rx from '@effect-rx/rx/Rx';
export { Rx };
import * as RxRef from '@effect-rx/rx/RxRef';
export { RxRef };
import * as Scheduler from 'scheduler';

// src/index.ts
var RegistryContext = createContext();
function scheduleTask(f) {
  Scheduler.unstable_scheduleCallback(Scheduler.unstable_LowPriority, f);
}
var defaultRegistry = globalValue(
  "@effect-rx/solid/defaultRegistry",
  () => Registry.make({
    scheduleTask,
    defaultIdleTTL: 400
  })
);
var injectRegistry = () => {
  const registry = useContext(RegistryContext);
  if (!registry) {
    throw new Error("No registry found");
  }
  return registry;
};
var useRx = (rx) => {
  const registry = injectRegistry();
  const [value, setValue] = createSignal(registry.get(rx));
  createEffect(() => {
    const cancel = registry.subscribe(rx, setValue);
    onCleanup(cancel);
  });
  const set = (newValue) => registry.set(rx, newValue);
  return [value, set];
};
var useRxValue = (rx) => {
  const registry = injectRegistry();
  const [value, setValue] = createSignal(registry.get(rx));
  createEffect(() => {
    const cancel = registry.subscribe(rx, setValue);
    onCleanup(cancel);
  });
  return value;
};
var useRxSet = (rx) => {
  const registry = injectRegistry();
  createEffect(() => {
    const cancel = registry.mount(rx);
    onCleanup(cancel);
  });
  return (newValue) => registry.set(rx, newValue);
};
var useRxRef = (rxRef) => {
  const [value, setValue] = createSignal(rxRef.value);
  createEffect(() => {
    const cancel = rxRef.subscribe(setValue);
    onCleanup(cancel);
  });
  return value;
};
var useRxSuspense = (rx, suspendOnWaiting) => {
  const registry = injectRegistry();
  const [state, { mutate }] = createResource(() => {
    return new Promise((resolve) => {
      const unsubscribe = registry.subscribe(
        rx,
        (result) => {
          if (result._tag !== "Initial" && (!suspendOnWaiting || !result.waiting)) {
            resolve(result);
            unsubscribe();
          }
        },
        { immediate: true }
      );
    });
  });
  createEffect(() => {
    const cancel = registry.subscribe(rx, mutate);
    onCleanup(cancel);
  });
  return state;
};

export { RegistryContext, defaultRegistry, injectRegistry, useRx, useRxRef, useRxSet, useRxSuspense, useRxValue };
