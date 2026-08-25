import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useLiveGeolocation } from './useLiveGeolocation'

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    value: state,
    configurable: true,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('useLiveGeolocation', () => {
  afterEach(() => {
    // Reset the visibility flag without dispatching a real event: dispatching
    // would run any listener left over from a still-mounting hook in the
    // test that just ran, before that hook's own unmount (registered via
    // Testing Library's cleanup) has had a chance to remove it.
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    })
    // Restore a harmless default so Testing Library's own cleanup (which
    // runs *after* this hook and may still call clearWatch while unmounting)
    // doesn't crash on a missing geolocation object.
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn(),
        watchPosition: vi.fn(),
        clearWatch: vi.fn(),
      },
      configurable: true,
    })
  })

  it('does not start watching when not active', () => {
    const watchPosition = vi.fn()
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: { watchPosition, clearWatch: vi.fn() },
      configurable: true,
    })

    renderHook(() => useLiveGeolocation(false))

    expect(watchPosition).not.toHaveBeenCalled()
  })

  it('starts watching the position once active and reports updates', () => {
    let successCallback: PositionCallback | undefined
    const watchPosition = vi.fn((success: PositionCallback) => {
      successCallback = success
      return 1
    })
    const clearWatch = vi.fn()
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: { watchPosition, clearWatch },
      configurable: true,
    })

    const { result } = renderHook(() => useLiveGeolocation(true))

    expect(watchPosition).toHaveBeenCalledTimes(1)
    expect(result.current.position).toBeNull()

    act(() => {
      successCallback?.({
        coords: { latitude: 52.52, longitude: 13.405 },
      } as GeolocationPosition)
    })

    expect(result.current.position).toEqual({ lat: 52.52, lon: 13.405 })
  })

  it('reports an error when the watch fails, and clears it on the next success', () => {
    let successCallback: PositionCallback | undefined
    let errorCallback: PositionErrorCallback | undefined
    const watchPosition = vi.fn(
      (success: PositionCallback, failure: PositionErrorCallback) => {
        successCallback = success
        errorCallback = failure
        return 1
      },
    )
    const clearWatch = vi.fn()
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: { watchPosition, clearWatch },
      configurable: true,
    })

    const { result } = renderHook(() => useLiveGeolocation(true))

    act(() => {
      errorCallback?.({
        code: 2,
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError)
    })

    expect(result.current.error).toMatch(/location/i)

    act(() => {
      successCallback?.({
        coords: { latitude: 52.52, longitude: 13.405 },
      } as GeolocationPosition)
    })

    expect(result.current.error).toBeNull()
  })

  it('clears the watch when the tab is backgrounded and restarts it when foregrounded again', () => {
    const watchPosition = vi.fn(() => 1)
    const clearWatch = vi.fn()
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: { watchPosition, clearWatch },
      configurable: true,
    })

    renderHook(() => useLiveGeolocation(true))
    expect(watchPosition).toHaveBeenCalledTimes(1)

    setVisibility('hidden')
    expect(clearWatch).toHaveBeenCalledWith(1)

    setVisibility('visible')
    expect(watchPosition).toHaveBeenCalledTimes(2)
  })

  it('clears the watch on unmount', () => {
    const watchPosition = vi.fn(() => 1)
    const clearWatch = vi.fn()
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: { watchPosition, clearWatch },
      configurable: true,
    })

    const { unmount } = renderHook(() => useLiveGeolocation(true))
    unmount()

    expect(clearWatch).toHaveBeenCalledWith(1)
  })
})
