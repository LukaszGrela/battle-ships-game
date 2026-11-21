import type { CSSProperties } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Waves } from "../Waves";

const meta = {
  title: "components/Waves",
  component: Waves,
  tags: ["autodocs"],
  args: {
    direction: "right",
    timeout: false,
    paused: false,
    onDrained: fn(),
  },
  argTypes: {
    direction: {
      control: "inline-radio",
      options: ["left", "right"],
    },
    timeout: {
      control: "boolean",
      description: "Drains the wave over `--wave-timout-duration`.",
    },
    paused: { control: "boolean" },
    onDrained: { control: false },
    style: { control: "object" },
    className: { control: false },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 480, padding: "2rem 1rem" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Waves>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LeftToRight: Story = {
  args: {
    direction: "left",
  },
};

export const TimeoutDrain: Story = {
  args: {
    timeout: true,
    style: { "--wave-timout-duration": "6s" } as CSSProperties,
  },
};

export const PausedDrain: Story = {
  args: {
    timeout: true,
    paused: true,
    style: { "--wave-timout-duration": "6s" } as CSSProperties,
  },
};

export const CustomStroke: Story = {
  args: {
    style: {
      "--waves-stroke-width": "3px",
      "--waves-stroke": "var(--gold, #d4a94a)",
    } as CSSProperties,
  },
};
