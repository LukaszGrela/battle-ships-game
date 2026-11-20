import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { DotLoader } from '../DotLoader'

const meta = {
  component: DotLoader,
  tags: ['autodocs'],
} satisfies Meta<typeof DotLoader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithLabel: Story = {
  args: { label: 'Finding opponent...' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('Finding opponent...')
  },
}
