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
        hint="Tap the map to drop a pin, or:"
      />,
    )

    fireEvent.change(screen.getByLabelText(/latitude/i), {
      target: { value: '52.52' },
    })
    fireEvent.change(screen.getByLabelText(/longitude/i), {
      target: { value: '13.405' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: /use these coordinates/i }),
    )

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
        hint="Tap the map to drop a pin, or:"
      />,
    )

    fireEvent.change(screen.getByLabelText(/search for a place/i), {
      target: { value: 'Berlin' },
    })
    fireEvent.click(screen.getByRole('button', { name: /search/i }))

    await vi.waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        { lat: 52.52, lon: 13.405 },
        'Berlin, Germany',
      ),
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
        hint="Tap the map to drop a pin, or:"
      />,
    )

    fireEvent.change(screen.getByLabelText(/search for a place/i), {
      target: { value: 'Nowhereville' },
    })
    fireEvent.click(screen.getByRole('button', { name: /search/i }))

    await vi.waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        expect.stringMatching(/could not find/i),
      ),
    )
  })

  it('keeps the raw coordinate fields folded away behind a disclosure', () => {
    render(
      <LocationPicker
        legend="Start point"
        idPrefix="start"
        value={null}
        onChange={vi.fn()}
        onError={vi.fn()}
        hint="Tap the map to drop a pin, or:"
      />,
    )

    const disclosure = screen.getByText(/enter coordinates/i).closest('details')
    expect(disclosure).not.toHaveAttribute('open')
    expect(disclosure).toContainElement(screen.getByLabelText(/latitude/i))
    expect(disclosure).toContainElement(screen.getByLabelText(/longitude/i))
  })

  it('only shows the "use current location" button when showCurrentLocation is set', () => {
    const { rerender } = render(
      <LocationPicker
        legend="Start point"
        idPrefix="start"
        value={null}
        onChange={vi.fn()}
        onError={vi.fn()}
        hint="Tap the map to drop a pin, or:"
      />,
    )
    expect(
      screen.queryByRole('button', { name: /use my current location/i }),
    ).toBeNull()

    rerender(
      <LocationPicker
        legend="Start point"
        idPrefix="start"
        value={null}
        onChange={vi.fn()}
        onError={vi.fn()}
        hint="Tap the map to drop a pin, or:"
        showCurrentLocation
      />,
    )
    expect(
      screen.getByRole('button', { name: /use my current location/i }),
    ).toBeInTheDocument()
  })
})
