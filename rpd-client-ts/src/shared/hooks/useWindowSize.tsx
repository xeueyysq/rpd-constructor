import {useEffect, useState} from 'react'

interface WindowSize {
    width: number | undefined;
    height: number | undefined;
}

export const useWindowSize = (): WindowSize => {
    const [windowSize, setWindowSize] = useState<WindowSize>({
        width: undefined,
        height: undefined,
    })

    useEffect(() => {
        function handleResize(): void {
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight,
            })
        }

        if (typeof window !== 'undefined') {
            window.addEventListener('resize', handleResize)
            handleResize()
            return (): void => window.removeEventListener('resize', handleResize)
        }
    }, [])

    return windowSize
}
