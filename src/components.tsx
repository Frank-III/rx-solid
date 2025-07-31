/**
 * @since 1.0.0
 */
import * as Registry from "@effect-rx/rx/Registry"
import { createContext, useContext, onCleanup, type ParentComponent } from "solid-js"

function scheduleTask(f: () => void): void {
  queueMicrotask(f)
}

export const RegistryContext = createContext<Registry.Registry>(Registry.make({
  scheduleTask,
  defaultIdleTTL: 400
}))

export interface RegistryProviderProps {
  registry: Registry.Registry
}

export const RegistryProvider: ParentComponent<RegistryProviderProps> = (props) => {
  onCleanup(() => {
    props.registry.dispose()
  })

  return (
    <RegistryContext.Provider value={props.registry}>
      {props.children}
    </RegistryContext.Provider>
  )
}

export interface RxStateProviderProps {
  initialState?: Array<readonly [any, any]>
}

export const RxStateProvider: ParentComponent<RxStateProviderProps> = (props) => {
  // Create a new registry with initial state (like solid-events does with subjects)
  const registry = Registry.make({
    scheduleTask,
    defaultIdleTTL: 400,
    initialValues: props.initialState
  })

  onCleanup(() => {
    registry.dispose()
  })

  return (
    <RegistryContext.Provider value={registry}>
      {props.children}
    </RegistryContext.Provider>
  )
}