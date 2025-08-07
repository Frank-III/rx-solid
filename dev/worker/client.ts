import * as Worker from '@effect/platform/Worker'
import * as BrowserWorker from '@effect/platform-browser/BrowserWorker'
import { GetId, InitialMessage, Requests } from './schema'
import { Array, Context, Effect, Layer } from 'effect'
import TestWorker from './worker?worker'
import { Atom } from '../../src'

const makePool = Worker.makePoolSerialized<Requests>({
  initialMessage: () => new InitialMessage(),
  minSize: 1,
  maxSize: 10,
  timeToLive: 20000,
  concurrency: 5,
  targetUtilization: 0.8,
}).pipe(Effect.tap(pool => pool.executeEffect(new GetId({ id: '1' }))))

export class Pool extends Context.Tag('app/Pool')<Pool, Effect.Effect.Success<typeof makePool>>() {
  static Live = Layer.scoped(this, makePool).pipe(
    Layer.provide(BrowserWorker.layer(() => new TestWorker())),
  )
}

// atom

const runtime = Atom.runtime(Pool.Live)

export const getIdAtom = runtime.fn((id: string) => {
  console.log('getIdAtom', id)
  return Pool.pipe(
    Effect.flatMap(pool =>
      Effect.forEach(
        Array.range(1, 41),
        id =>
          pool.executeEffect(new GetId({ id: id.toString() })).pipe(
            Effect.tap(Effect.log),
            Effect.annotateLogs({
              atom: 'getIdAtom',
              id,
            }),
          ),
        { concurrency: 'unbounded' },
      ),
    ),
  )
})
