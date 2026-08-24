import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const geocodeLocationMock = vi.fn()
vi.mock('#/server/functions/geocodeLocation', () => ({
  geocodeLocation: (...args: unknown[]) => geocodeLocationMock(...args),
}))

import { LocationPicker } from './LocationPicker'

describe('LocationPicker', () => {
  afterEach(() => {
    geocodeLocationMock.mockReset()
  })

  it('calls onChange with a manually entered lat/lon', () => {
    const onChange = vi.fn()
    render(
      <LocationPicker
        legend="Start point"
        idPrefix="start"
        value={null}
        onChange={onChange}
        onError={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText(/latitude/i), {
      target: { value: '52.52' },
    })
    fireEvent.change(screen.getByLabelText(/longitude/i), {
      target: { value: '13.405' },
    })
    fireEvent.click(screen.getByRole('button', { name: /set pin manually/i }))

    expect(onChange).toHaveBeenCalledWith({ lat: 52.52, lon: 13.405 })
  })

  it('resolves a searched location name to a lat/lon via geocoding', async () => {
    geocodeLocationMock.mockResolvedValue({
      lat: 52.52,
      lon: 13.405,
      label: 'Berlin, Germany',
    })
    const onChange = vi.fn()
    render(
      <LocationPicker
        legend="Start point"
        idPrefix="start"
        value={null}
        onChange={onChange}
        onError={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText(/search location/i), {
      target: { value: 'Berlin' },
    })
    fireEvent.click(screen.getByRole('button', { name: /search/i }))

    await vi.waitFor(() =>
      expect(onChange).toHaveBeenCalledWith({ lat: 52.52, lon: 13.405 }),
    )
    expect(geocodeLocationMock).toHaveBeenCalledWith({
      data: { query: 'Berlin' },
    })
  })

  it('reports an error when geocoding fails to resolve the query', async () => {
    geocodeLocationMock.mockRejectedValue(new Error('No location found'))
    const onError = vi.fn()
    render(
      <LocationPicker
        legend="Start point"
        idPrefix="start"
        value={null}
        onChange={vi.fn()}
        onError={onError}
      />,
    )

    fireEvent.change(screen.getByLabelText(/search location/i), {
      target: { value: 'Nowhereville' },
    })
    fireEvent.click(screen.getByRole('button', { name: /search/i }))

    await vi.waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        expect.stringMatching(/could not find/i),
      ),
    )
  })

  it('only shows the "use current location" button when showCurrentLocation is set', () => {
    const { rerender } = render(
      <LocationPicker
        legend="Start point"
        idPrefix="start"
        value={null}
        onChange={vi.fn()}
        onError={vi.fn()}
      />,
    )
    expect(
      screen.queryByRole('button', { name: /use current location/i }),
    ).toBeNull()

    rerender(
      <LocationPicker
        legend="Start point"
        idPrefix="start"
        value={null}
        onChange={vi.fn()}
        onError={vi.fn()}
        showCurrentLocation
      />,
    )
    expect(
      screen.getByRole('button', { name: /use current location/i }),
    ).toBeInTheDocument()
  })
})
