import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const geocodeLocationMock = vi.fn()
vi.mock('#/server/functions/geocodeLocation', () => ({
  geocodeLocation: (...args: unknown[]) => geocodeLocationMock(...args),
}))

import { LocationPicker } from './LocationPicker'

/** The picker as the stop point renders it: no GPS, so search is open already. */
function renderPicker(overrides: Record<string, unknown> = {}) {
  return render(
    <LocationPicker
      legend="Start point"
      shortLabel="From"
      idPrefix="start"
      value={null}
      onChange={vi.fn()}
      onError={vi.fn()}
      hint="Tap the map to drop a pin"
      {...overrides}
    />,
  )
}

/** The button that runs the query, not the one that reveals the field. */
function searchButton(): HTMLElement {
  return screen.getByRole('button', { name: 'Search' })
}

describe('LocationPicker', () => {
  afterEach(() => {
    geocodeLocationMock.mockReset()
  })

  it('calls onChange with a manually entered lat/lon', () => {
    const onChange = vi.fn()
    renderPicker({ onChange })

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
    renderPicker({ onChange })

    fireEvent.change(screen.getByLabelText(/search for a place/i), {
      target: { value: 'Berlin' },
    })
    fireEvent.click(searchButton())

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
    renderPicker({ onError })

    fireEvent.change(screen.getByLabelText(/search for a place/i), {
      target: { value: 'Nowhereville' },
    })
    fireEvent.click(searchButton())

    await vi.waitFor(() =>
      expect(onError).toHaveBeenCalledWith(
        expect.stringMatching(/could not find/i),
      ),
    )
  })

  it('keeps the raw coordinate fields folded away behind a disclosure', () => {
    renderPicker()

    const disclosure = screen.getByText(/enter coordinates/i).closest('details')
    expect(disclosure).not.toHaveAttribute('open')
    expect(disclosure).toContainElement(screen.getByLabelText(/latitude/i))
    expect(disclosure).toContainElement(screen.getByLabelText(/longitude/i))
  })

  it('shows the hint in place of a value while the point is unset', () => {
    const { rerender } = renderPicker()
    expect(screen.getByText('Tap the map to drop a pin')).toBeInTheDocument()

    rerender(
      <LocationPicker
        legend="Start point"
        shortLabel="From"
        idPrefix="start"
        value={{ lat: 52.52, lon: 13.405 }}
        onChange={vi.fn()}
        onError={vi.fn()}
        hint="Tap the map to drop a pin"
      />,
    )

    // Once there is a point, the instruction has done its job and the row
    // spends its one line on what the point actually is.
    expect(screen.queryByText('Tap the map to drop a pin')).toBeNull()
    expect(screen.getByText('52.520, 13.405')).toBeInTheDocument()
  })

  it('only shows the "use current location" button when showCurrentLocation is set', () => {
    const { rerender } = renderPicker()
    expect(
      screen.queryByRole('button', { name: /use my current location/i }),
    ).toBeNull()

    rerender(
      <LocationPicker
        legend="Start point"
        shortLabel="From"
        idPrefix="start"
        value={null}
        onChange={vi.fn()}
        onError={vi.fn()}
        hint="Tap the map to drop a pin"
        showCurrentLocation
      />,
    )
    expect(
      screen.getByRole('button', { name: /use my current location/i }),
    ).toBeInTheDocument()
  })

  /**
   * Where the map and GPS can set the point, the sheet spends one line on it
   * and nothing more until the user asks for another way in.
   */
  it('folds the search away where quicker ways to set the point exist', () => {
    renderPicker({ showCurrentLocation: true })

    expect(screen.queryByLabelText(/search for a place/i)).toBeNull()
    expect(screen.queryByText(/enter coordinates/i)).toBeNull()

    const toggle = screen.getByRole('button', {
      name: 'Search or enter coordinates',
    })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText(/search for a place/i)).toBeInTheDocument()
    expect(screen.getByText(/enter coordinates/i)).toBeInTheDocument()
  })
})
