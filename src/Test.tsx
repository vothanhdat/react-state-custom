
import { createAutoCtx } from './state-utils/createAutoCtx'
import { createRootCtx } from './state-utils/createRootCtx'
import { useCallback, useState } from 'react'
import { useQuickSubscribe } from './state-utils/useQuickSubscribe'

const { useCtxState: useDevCtx } = createAutoCtx(
    createRootCtx(
        "devState",
        ({ }) => {
            const [state, setState] = useState(0)
            return {
                state,
                increase: useCallback(() => setState(f => f + 1), [setState]),
                decrease: useCallback(() => setState(f => f - 1), [setState]),
            }
        }
    )
)



const { useCtxState: useDevAdvanceCtx } = createAutoCtx(
    createRootCtx(
        "devADVState",
        ({ id }: { id: string }) => {
            const [counter, setCounter] = useState(0)
            const [state, setState] = useState(0)
            const [history, setHistory] = useState([state])
            const [historyMap, setHistoryMap] = useState({})

            return {
                id,
                state,
                bifIntState: BigInt(state),
                computed: id + state,
                history,
                counter,
                historyMap,
                testSrt: "aiwioj ".repeat(counter * 3),
                increase: useCallback(() => setState(f => {
                    setCounter(c => {
                        setHistory(h => [...h, f]);
                        setHistoryMap(m => ({ ...m, ['state--' + c]: {f,d: Date.now()} }));
                        return c + 1
                    })
                    return f + 1
                }), [setState]),
                decrease: useCallback(() => setState(f => {
                    setCounter(c => {
                        setHistory(h => [...h, f]);
                        setHistoryMap(m => ({ ...m, ['state--' + c]: {f,d: Date.now()} }));
                        return c + 1
                    })
                    return f - 1
                }), [setState])
            }
        }
    )
)


export const Test = ({ }) => {
    const { state, decrease, increase } = useQuickSubscribe(useDevCtx({}))
    const { state: advState, computed: advComputed, increase: advIncreaser, decrease: advDecrise } = useQuickSubscribe(useDevAdvanceCtx({ id: "name" }))


    return <div>
        <hr />
        <button onClick={increase}>[+]</button>
        <span>{state}</span>
        <button onClick={decrease}>[-]</button>
        <hr />
        <button onClick={advIncreaser}>[+]</button>
        <span>{advState}:{advComputed}:</span>
        <button onClick={advDecrise}>[-]</button>
    </div>
}