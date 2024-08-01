import * as solid_js from 'solid-js';
import { Accessor, Resource } from 'solid-js';
import * as Registry from '@effect-rx/rx/Registry';
export { Registry };
import * as Rx from '@effect-rx/rx/Rx';
export { Rx };
import * as RxRef from '@effect-rx/rx/RxRef';
export { RxRef };
import * as Result from '@effect-rx/rx/Result';
export { Result };

declare const RegistryContext: solid_js.Context<Registry.Registry | undefined>;
declare const defaultRegistry: Registry.Registry;
declare const injectRegistry: () => Registry.Registry;
declare const useRx: <R, W>(rx: Rx.Writable<R, W>) => [Accessor<R>, (newValue: W) => void];
declare const useRxValue: <A>(rx: Rx.Rx<A>) => Accessor<A>;
declare const useRxSet: <R, W>(rx: Rx.Writable<R, W>) => ((newValue: W) => void);
declare const useRxRef: <A>(rxRef: RxRef.ReadonlyRef<A>) => Accessor<A>;
declare const useRxSuspense: <A, E>(rx: Rx.Rx<Result.Result<A, E>>, suspendOnWaiting?: boolean) => Resource<Result.Result<A, E>>;

export { RegistryContext, defaultRegistry, injectRegistry, useRx, useRxRef, useRxSet, useRxSuspense, useRxValue };
